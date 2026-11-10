/* =========================================================
   pyclub 실행·채점 엔진 — 학생 화면(index.html)과 교사 화면(teacher.html)이 함께 쓴다.
   pycoding/runner.js 를 바탕으로 했다. 해시 규칙·출력 비교·input() 안내 문구 처리는 pycoding 과 «똑같아야» 한다
   (두 시스템이 같은 문제 은행을 쓰므로, 한 글자라도 다르면 pycoding 문제가 동아리 화면에서 틀린 답이 된다).

   pycoding 과 다른 점
     · 줄 단위 시간 재기(sys.settrace)를 쓰지 않는다 — 코드가 몇 배 느려져 알고리즘 시간 비교가 흐려진다.
       대신 테스트마다 시간을 재고, 제한을 넘으면 Web Worker 를 통째로 끊고 다시 띄운다.
     · 테스트마다 실행 시간(ms)을 돌려준다 → «실제 크기라면» 예상 시간 계산에 쓴다
     · 문제 형식 4가지: io(입력→출력) · func(함수 반환값) · choice(객관식 번호) · short(단답)
       choice · short 는 파이썬을 돌리지 않고 답을 정규화해 해시를 비교한다.
   ========================================================= */
(function (global) {
  "use strict";

  const PYODIDE_VERSION = "0.26.4";
  const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
  const DEFAULT_TIME_SEC = 2;      // 테스트 하나당 시간 제한(초) — 문제마다 timeLimit 으로 바꿀 수 있다
  const GRACE_MS = 1500;           // Worker 쪽 시간 재기 오차·메시지 지연 여유

  /* ---------- Worker 안에서 도는 파이썬 실행기 (server/tools/build.py 도 이 코드를 CPython 으로 실행한다) ---------- */
  const HARNESS = String.raw`
import sys, io, builtins, time, traceback

class _PycOutputLimit(BaseException):
    pass

_PYC_BLOCK = ("js", "pyodide", "pyodide_js", "micropip", "_pyodide")
_pyc_real_import = builtins.__import__

def _pyc_guard_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name.split(".")[0] in _PYC_BLOCK:
        raise ImportError("'" + name + "' 모듈은 이 연습장에서 쓸 수 없어요")
    return _pyc_real_import(name, globals, locals, fromlist, level)

class _PycOut(io.StringIO):
    def write(self, s):
        if self.tell() + len(s) > 2000000:
            raise _PycOutputLimit()
        return super().write(s)

def _pyc_run_one(code, stdin, call, max_sec=0):
    out = _PycOut()
    src = io.StringIO(stdin)

    def _input(prompt=""):
        line = src.readline()
        if line == "":
            raise EOFError("입력이 더 없어요")
        return line.rstrip("\n").rstrip("\r")

    bi = dict(builtins.__dict__)
    bi["input"] = _input
    bi["__import__"] = _pyc_guard_import
    g = {"__name__": "__main__", "__builtins__": bi}
    res = {"stdout": "", "ret": None, "kind": None, "msg": None, "line": None, "ms": 0}
    old = (sys.stdout, sys.stderr, sys.stdin, sys.getrecursionlimit())
    sys.stdout = out
    sys.stderr = out
    sys.stdin = src
    start = time.perf_counter()
    try:
        try:
            compiled = compile(code, "<내 코드>", "exec")
        except SyntaxError as e:
            res["kind"] = type(e).__name__
            res["msg"] = str(e.msg)
            res["line"] = e.lineno
            return res
        start = time.perf_counter()
        try:
            exec(compiled, g)
        except SystemExit:
            pass
        if call:
            r = eval(compile(call, "<채점>", "eval"), g)
            res["ret"] = repr(r)
    except _PycOutputLimit:
        res["kind"] = "OutputLimit"
    except RecursionError as e:
        res["kind"] = "RecursionError"
        res["msg"] = str(e)
    except MemoryError as e:
        res["kind"] = "MemoryError"
    except BaseException as e:
        res["kind"] = type(e).__name__
        res["msg"] = str(e)
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename == "<내 코드>":
                res["line"] = fr.lineno
    finally:
        res["ms"] = int((time.perf_counter() - start) * 1000)
        sys.stdout, sys.stderr, sys.stdin = old[0], old[1], old[2]
        sys.setrecursionlimit(old[3])
        res["stdout"] = out.getvalue()
    if max_sec and res["kind"] is None and res["ms"] > max_sec * 1000:
        res["kind"] = "Timeout"
    return res
`;

  // Worker: 테스트를 하나씩 돌리고 끝날 때마다 결과를 보낸다 → 바깥에서 테스트별로 시간을 잴 수 있다
  const WORKER_SRC = `
let py = null;
self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      importScripts(m.indexURL + "pyodide.js");
      py = await loadPyodide({ indexURL: m.indexURL });
      py.runPython(m.harness);
      self.postMessage({ type: "ready" });
      return;
    }
    if (m.type === "run") {
      const fn = py.globals.get("_pyc_run_one");
      for (let i = 0; i < m.cases.length; i++) {
        self.postMessage({ type: "start", id: m.id, i });
        const c = m.cases[i];
        let out;
        try {
          const r = fn(m.code, c.stdin || "", c.call || "", m.maxSec);
          out = r.toJs({ dict_converter: Object.fromEntries });
          r.destroy();
        } catch (e) {
          out = { stdout: "", ret: null, kind: "Crash", msg: String(e && e.message || e).slice(0, 300), line: null, ms: 0 };
        }
        self.postMessage({ type: "case", id: m.id, i, result: out });
        if (out.kind === "Crash") break;
      }
      fn.destroy();
      self.postMessage({ type: "done", id: m.id });
    }
  } catch (e) {
    self.postMessage({ type: m.type === "init" ? "initError" : "runError", id: m.id, error: String(e && e.message || e) });
  }
};`;

  /* ---------- 실행기 ---------- */
  class Runner {
    constructor(onStatus) {
      this.onStatus = onStatus || function () {};
      this.worker = null;
      this.readyPromise = null;
      this.seq = 0;
      this.job = null;
      this.busy = Promise.resolve();
    }

    ready() {
      if (this.readyPromise) return this.readyPromise;
      this.onStatus("loading");
      this.readyPromise = new Promise((resolve, reject) => {
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
        const w = new Worker(url);
        this.worker = w;
        w.onmessage = (ev) => this._onMessage(ev.data, resolve, reject);
        w.onerror = (e) => {
          this.onStatus("error", e.message);
          this.readyPromise = null;
          reject(new Error("파이썬 실행기를 시작하지 못했습니다: " + e.message));
        };
        w.postMessage({ type: "init", indexURL: INDEX_URL, harness: HARNESS });
      });
      return this.readyPromise;
    }

    _onMessage(m, resolve, reject) {
      if (m.type === "ready") { this.onStatus("ready"); resolve(); return; }
      if (m.type === "initError") {
        this.onStatus("error", m.error);
        this.readyPromise = null;
        reject(new Error("파이썬을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요. (" + m.error + ")"));
        return;
      }
      const j = this.job;
      if (!j || m.id !== j.id) return;
      if (m.type === "start") j.startCase(m.i);
      else if (m.type === "case") j.caseDone(m.i, m.result);
      else if (m.type === "done") j.finish();
      else if (m.type === "runError") j.fail(new Error(m.error));
    }

    restart() {
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.readyPromise = null;
      return this.ready();
    }

    /* cases: [{stdin, call}] → [{stdout, ret, kind, msg, line, ms}] (cases 와 같은 길이) */
    run(code, cases, maxSec) {
      const job = this.busy.then(() => this._runAll(code, cases, maxSec || DEFAULT_TIME_SEC));
      this.busy = job.catch(() => {});
      return job;
    }

    // 시간 초과로 Worker 를 끊으면, 다시 띄워 남은 테스트를 이어서 돌린다
    async _runAll(code, cases, maxSec) {
      const results = new Array(cases.length).fill(null);
      let from = 0;
      while (from < cases.length) {
        await this.ready();
        const part = await this._runPart(code, cases.slice(from), maxSec);
        for (let i = 0; i < part.results.length; i++) if (part.results[i]) results[from + i] = part.results[i];
        if (part.killedAt == null) {
          // 비정상 종료(Crash)로 멈췄으면 남은 테스트는 같은 결과로 채운다
          const crash = part.results.find((r) => r && r.kind === "Crash");
          for (let i = from; i < cases.length; i++) if (!results[i]) results[i] = crash || { stdout: "", ret: null, kind: "Crash", msg: null, line: null, ms: 0 };
          if (crash) await this.restart().catch(() => {});
          break;
        }
        results[from + part.killedAt] = { stdout: "", ret: null, kind: "Timeout", msg: null, line: null, ms: Math.round(maxSec * 1000) };
        from += part.killedAt + 1;
        // 한 테스트가 시간 초과면 남은 테스트는 돌리지 않는다 (테스트마다 실행기를 다시 띄우면 수십 초가 걸린다)
        for (let i = from; i < cases.length; i++) results[i] = { stdout: "", ret: null, kind: "Skipped", msg: null, line: null, ms: 0 };
        this.restart().catch(() => {});   // 다음 실행을 위해 미리 다시 띄워 둔다 (기다리지 않음)
        break;
      }
      return results;
    }

    _runPart(code, cases, maxSec) {
      const id = ++this.seq;
      return new Promise((resolve, reject) => {
        const results = new Array(cases.length).fill(null);
        let timer = null;
        const limitMs = maxSec * 1000 + GRACE_MS;
        const job = {
          id,
          startCase: (i) => {
            clearTimeout(timer);
            timer = setTimeout(() => {          // 이 테스트가 제한 시간을 넘김 → 끊는다
              this.job = null;
              if (this.worker) this.worker.terminate();
              this.worker = null; this.readyPromise = null;
              resolve({ results, killedAt: i });
            }, limitMs);
          },
          caseDone: (i, r) => { clearTimeout(timer); results[i] = r; },
          finish: () => { clearTimeout(timer); this.job = null; resolve({ results, killedAt: null }); },
          fail: (e) => { clearTimeout(timer); this.job = null; reject(e); },
        };
        this.job = job;
        this.worker.postMessage({ type: "run", id, code, cases, maxSec });
      });
    }
  }

  /* ---------- 비교·해시 (pycoding 과 똑같이) ---------- */
  function normalize(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n?/g, "\n")
      .split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n")
      .replace(/\n+$/, "");
  }

  // 단답·객관식 답: 앞뒤 공백 없애고, 안쪽 공백은 한 칸으로, 쉼표 뒤 공백 통일, 전각 숫자는 반각으로
  function normalizeShort(text) {
    return String(text == null ? "" : text)
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[①②③④⑤]/g, (c) => String("①②③④⑤".indexOf(c) + 1))
      .trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  }

  function answerText(problem, r) {
    if (r.kind) return null;
    return problem.type === "func" ? normalize(r.ret) : normalize(r.stdout);
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function hashAnswer(problemId, index, answer) {
    return sha256("pycoding|" + problemId + "|" + index + "|" + answer);
  }

  const isPaper = (p) => p.type === "choice" || p.type === "short";

  function casesOf(problem, list) {
    return list.map((t) => (problem.type === "func" ? { stdin: "", call: t.call || "" } : { stdin: t.input || "", call: "" }));
  }

  function timeOf(problem) {
    const t = Number(problem.timeLimit);
    return t > 0 ? t : DEFAULT_TIME_SEC;
  }

  /* 1교시(필기) 채점 — 파이썬 없이 */
  async function gradePaper(problem, answer) {
    const a = normalizeShort(answer);
    const t = (problem.tests || [])[0];
    const ok = !!a && !!t && (await hashAnswer(problem.id, 0, a)) === t.hash;
    return { passed: ok ? 1 : 0, total: 1, results: [{ ok, kind: null, ms: 0 }], answer: a };
  }

  /* 코드 채점: tests 의 해시와 비교. → {passed, total, results:[{ok, kind, msg, line, ms}], maxMs} */
  async function grade(runner, problem, code) {
    const tests = problem.tests || [];
    const raw = await runner.run(code, casesOf(problem, tests), timeOf(problem));
    const results = [];
    let passed = 0, maxMs = 0, maxMsIndex = -1;
    for (let i = 0; i < tests.length; i++) {
      const r = raw[i];
      const ans = answerText(problem, r);
      const ok = ans != null && (await hashAnswer(problem.id, i, ans)) === tests[i].hash;
      if (ok) passed++;
      if (!r.kind && r.ms >= maxMs) { maxMs = r.ms; maxMsIndex = i; }
      results.push({ ok, kind: r.kind, msg: r.msg, line: r.line, ms: r.ms });
    }
    return { passed, total: tests.length, results, maxMs, maxMsIndex };
  }

  /* 예시(정답 공개) 돌려 보기 → [{ok, expected, actual, kind, msg, line, ms}] */
  async function checkExamples(runner, problem, code) {
    const ex = problem.examples || [];
    if (!ex.length) return [];
    const raw = await runner.run(code, casesOf(problem, ex), timeOf(problem));
    return ex.map((e, i) => {
      const r = raw[i];
      const actual = problem.type === "func" ? (r.ret == null ? "" : r.ret) : r.stdout;
      return {
        ok: !r.kind && normalize(actual) === normalize(e.output),
        expected: e.output, actual, kind: r.kind, msg: r.msg, line: r.line, ms: r.ms, input: e.input, call: e.call,
      };
    });
  }

  /* 교사용: 해시가 없는 문제(손으로 쓴 JSON)는 정답 코드·정답으로 예시 출력과 테스트 해시를 만든다 */
  async function buildFromReference(runner, problem) {
    if (isPaper(problem)) {
      const ans = normalizeShort(problem.answer != null ? problem.answer : problem.refCode);
      if (!ans) throw new Error(problem.id + ": 정답(answer)이 없습니다.");
      return Object.assign({}, problem, { refCode: ans, tests: [{ hash: await hashAnswer(problem.id, 0, ans) }] });
    }
    const ref = problem.refCode || "";
    if (!ref.trim()) throw new Error(problem.id + ": 정답 코드가 없습니다.");
    const exIn = problem.examples || [];
    const tIn = problem.tests || [];
    const raw = await runner.run(ref, casesOf(problem, exIn.concat(tIn)), timeOf(problem) * 3);
    const bad = raw.findIndex((r) => r.kind);
    if (bad >= 0) {
      const r = raw[bad];
      const where = bad < exIn.length ? "예시 " + (bad + 1) : "테스트 " + (bad - exIn.length + 1);
      throw new Error(problem.id + ": 정답 코드가 " + where + "에서 오류를 냈습니다 — " + explain(r).title + (r.msg ? " (" + r.msg + ")" : ""));
    }
    const examples = exIn.map((e, i) => {
      const r = raw[i];
      const o = problem.type === "func" ? r.ret : normalize(r.stdout);
      return problem.type === "func" ? { call: e.call, output: o } : { input: e.input || "", output: o };
    });
    const tests = [];
    for (let i = 0; i < tIn.length; i++) {
      const r = raw[exIn.length + i];
      const h = await hashAnswer(problem.id, i, answerText(problem, r));
      tests.push(problem.type === "func" ? { call: tIn[i].call, hash: h } : { input: tIn[i].input || "", hash: h });
    }
    return Object.assign({}, problem, { examples, tests });
  }

  /* ---------- 실제 크기라면 (내 코드) ----------
     scale = {nHere, nFull, ...}. 가장 오래 걸린 테스트 시간으로, 복잡도 가정마다 실제 크기 시간을 어림한다. */
  function estimateMine(scale, ms) {
    if (!scale || !(scale.nHere > 0) || !(scale.nFull > scale.nHere) || !(ms >= 0)) return null;
    const r = scale.nFull / scale.nHere;
    const t = Math.max(ms, 1) / 1000;
    const lg = Math.log2(scale.nFull) / Math.max(1, Math.log2(scale.nHere));
    return [
      { label: "O(N)", sec: t * r },
      { label: "O(N log N)", sec: t * r * lg },
      { label: "O(N²)", sec: t * r * r },
    ];
  }

  function fmtSec(sec) {
    if (sec < 0.01) return "0.01초 미만";
    if (sec < 10) return sec.toFixed(2).replace(/\.?0+$/, "") + "초";
    if (sec < 120) return Math.round(sec) + "초";
    if (sec < 7200) return "약 " + Math.round(sec / 60) + "분";
    if (sec < 172800) return "약 " + Math.round(sec / 3600) + "시간";
    return "약 " + Math.round(sec / 86400).toLocaleString("ko-KR") + "일";
  }

  /* ---------- 오류 안내 ---------- */
  const HINTS = {
    Timeout: ["시간 초과", "제한 시간 안에 끝나지 않았어요. 무한 반복이 없는지, 더 빠른 알고리즘(복잡도)이 있는지 생각해 보세요."],
    Skipped: ["채점 안 함", "앞의 테스트가 시간 초과라 남은 테스트는 돌리지 않았어요."],
    Crash: ["실행기 멈춤", "파이썬 실행기가 멈췄어요. 재귀가 너무 깊거나 메모리를 너무 많이 썼을 수 있어요."],
    OutputLimit: ["출력이 너무 많아요", "출력이 너무 많아서 멈췄어요."],
    MemoryError: ["메모리 부족", "메모리를 너무 많이 썼어요. 큰 리스트를 여러 개 만들지 않는지 확인하세요."],
    SyntaxError: ["문법 오류", "괄호·따옴표 짝, 콜론(:), 철자를 확인하세요."],
    IndentationError: ["들여쓰기 오류", "줄 앞 공백(들여쓰기)이 맞지 않아요."],
    TabError: ["들여쓰기 오류", "탭과 공백이 섞여 있어요. 공백 4칸으로 통일하세요."],
    NameError: ["이름 오류", "만들지 않은 변수나 함수 이름을 썼어요. 철자와 대소문자를 확인하세요."],
    TypeError: ["자료형 오류", "자료형이 맞지 않는 연산이에요. input() 으로 받은 값은 문자열입니다."],
    ValueError: ["값 오류", "바꿀 수 없는 값을 바꾸려 했거나, 한 줄의 입력 개수가 맞지 않아요."],
    ZeroDivisionError: ["0으로 나누기", "0으로 나눌 수 없어요."],
    EOFError: ["입력 부족", "입력을 준 것보다 더 많이 읽으려 했어요."],
    IndexError: ["범위 오류", "리스트·문자열의 없는 위치를 썼어요. 경계(0, N-1)를 확인하세요."],
    KeyError: ["키 오류", "딕셔너리에 없는 키를 찾았어요."],
    AttributeError: ["속성 오류", "그 값에는 없는 기능(. 뒤의 이름)을 썼어요."],
    RecursionError: ["재귀 깊이 초과", "재귀가 너무 깊어요. 종료 조건을 확인하거나 sys.setrecursionlimit 또는 반복문으로 바꿔 보세요."],
    ImportError: ["불러오기 오류", "이 연습장에서는 쓸 수 없는 모듈이에요."],
    ModuleNotFoundError: ["불러오기 오류", "없는 모듈이에요."],
  };

  function explain(r) {
    const h = HINTS[r.kind] || ["실행 오류 (" + r.kind + ")", "오류 메시지를 읽고 코드를 확인하세요."];
    return { title: h[0], hint: h[1], line: r.line || null, msg: r.msg || "" };
  }

  /* ---------- 문제 묶음·주제 ---------- */
  const BANKS = {
    pyclub: {
      name: "동아리",
      topics: [
        { key: "ds", name: "자료구조" }, { key: "al", name: "알고리즘" },
        { key: "koi", name: "정올대비" }, { key: "w1", name: "1교시준비" },
      ],
      levels: { 1: "기초", 2: "기본", 3: "중급", 4: "심화", 5: "고급" },
    },
    pycoding: {
      name: "pycoding",
      topics: [
        { key: "out", name: "출력" }, { key: "in", name: "입력" }, { key: "calc", name: "연산" },
        { key: "if", name: "조건" }, { key: "loop", name: "반복" }, { key: "func", name: "함수" },
      ],
      levels: { 1: "따라하기", 2: "적용", 3: "응용", 4: "도전" },
    },
  };
  const bankOf = (topic) => (BANKS.pyclub.topics.some((t) => t.key === topic) ? "pyclub" : "pycoding");
  const topicName = (topic) => {
    for (const b of Object.values(BANKS)) { const t = b.topics.find((x) => x.key === topic); if (t) return t.name; }
    return topic;
  };

  global.PyClub = {
    Runner, grade, gradePaper, checkExamples, buildFromReference, normalize, normalizeShort, explain, hashAnswer,
    estimateMine, fmtSec, isPaper, timeOf, BANKS, bankOf, topicName, PYODIDE_VERSION, INDEX_URL, HARNESS, DEFAULT_TIME_SEC,
  };
})(typeof window !== "undefined" ? window : globalThis);
