/* =========================================================
   pycoding 실행·채점 엔진 — 학생 화면(index.html)과 교사 화면(teacher.html)이 함께 쓴다.

   ⚠ 이 파일만 페이지 밖에 따로 둔 이유: 정답 해시를 만드는 쪽(교사)과 비교하는 쪽(학생)의
     실행 방식·정규화가 한 글자라도 다르면 맞는 답이 틀린 답이 된다. 그래서 한 벌만 둔다.

   하는 일
     · 파이썬(Pyodide)을 «Web Worker» 안에서 돌린다 → 무한 반복이어도 화면이 안 멈춘다
     · 시간 제한: 파이썬 안에서 줄 단위로 시간을 재고(sys.settrace), 그래도 안 끝나면 Worker 를 통째로 끊는다
     · input() 은 미리 받은 입력 칸 내용을 한 줄씩 읽는다. input("안내 문구") 의 문구는 출력하지 않는다
       (코드업 방식 채점에서 안내 문구 때문에 틀리는 일을 막는다)
     · 출력 비교: 줄 끝 공백과 마지막 빈 줄은 무시한다
     · 정답 출력 대신 SHA-256 해시로 비교한다 → 학생 화면에 정답이 내려가지 않는다
   ========================================================= */
(function (global) {
  "use strict";

  const PYODIDE_VERSION = "0.26.4";
  const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
  const DEFAULT_TIME_SEC = 2;      // 테스트 하나당 시간 제한(초)

  /* ---------- Worker 안에서 도는 파이썬 실행기 ---------- */
  const HARNESS = String.raw`
import sys, io, builtins, time, traceback

class _PycTimeout(BaseException):
    pass

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
        if self.tell() + len(s) > 100000:
            raise _PycOutputLimit()
        return super().write(s)

def _pyc_run_one(code, stdin, call, max_sec):
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
    start = time.monotonic()
    count = [0]

    def tracer(frame, event, arg):
        count[0] += 1
        if (count[0] & 511) == 0 and time.monotonic() - start > max_sec:
            raise _PycTimeout()
        return tracer

    old = (sys.stdout, sys.stderr, sys.stdin)
    sys.stdout = out
    sys.stderr = out
    sys.stdin = src
    try:
        try:
            compiled = compile(code, "<내 코드>", "exec")
        except SyntaxError as e:
            res["kind"] = type(e).__name__
            res["msg"] = str(e.msg)
            res["line"] = e.lineno
            return res
        sys.settrace(tracer)
        try:
            try:
                exec(compiled, g)
            except SystemExit:
                pass
            if call:
                r = eval(compile(call, "<채점>", "eval"), g)
                res["ret"] = repr(r)
        finally:
            sys.settrace(None)
    except _PycTimeout:
        res["kind"] = "Timeout"
    except _PycOutputLimit:
        res["kind"] = "OutputLimit"
    except RecursionError as e:
        res["kind"] = "RecursionError"
        res["msg"] = str(e)
    except BaseException as e:
        res["kind"] = type(e).__name__
        res["msg"] = str(e)
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename == "<내 코드>":
                res["line"] = fr.lineno
    finally:
        sys.stdout, sys.stderr, sys.stdin = old
        res["stdout"] = out.getvalue()
        res["ms"] = int((time.monotonic() - start) * 1000)
    return res

def _pyc_run_batch(code, cases, max_sec):
    return [_pyc_run_one(code, c.get("stdin", ""), c.get("call", ""), max_sec) for c in cases]
`;

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
      const fn = py.globals.get("_pyc_run_batch");
      const cases = py.toPy(m.cases);
      const r = fn(m.code, cases, m.maxSec);
      const out = r.toJs({ dict_converter: Object.fromEntries });
      r.destroy(); cases.destroy(); fn.destroy();
      self.postMessage({ type: "result", id: m.id, results: out });
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
      this.pending = null;
      this.busy = Promise.resolve();
    }

    ready() {
      if (this.readyPromise) return this.readyPromise;
      this.onStatus("loading");
      this.readyPromise = new Promise((resolve, reject) => {
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
        const w = new Worker(url);
        this.worker = w;
        w.onmessage = (ev) => {
          const m = ev.data;
          if (m.type === "ready") { this.onStatus("ready"); resolve(); }
          else if (m.type === "initError") {
            this.onStatus("error", m.error);
            this.readyPromise = null;
            reject(new Error("파이썬을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요. (" + m.error + ")"));
          } else if (this.pending && m.id === this.pending.id) {
            const p = this.pending; this.pending = null; clearTimeout(p.timer);
            if (m.type === "result") p.resolve(m.results);
            else p.reject(new Error(m.error));
          }
        };
        w.onerror = (e) => {
          this.onStatus("error", e.message);
          this.readyPromise = null;
          reject(new Error("파이썬 실행기를 시작하지 못했습니다: " + e.message));
        };
        w.postMessage({ type: "init", indexURL: INDEX_URL, harness: HARNESS });
      });
      return this.readyPromise;
    }

    restart() {
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.readyPromise = null;
      return this.ready();
    }

    /* cases: [{stdin, call}] → [{stdout, ret, kind, msg, line, ms}] */
    run(code, cases, maxSec) {
      const job = this.busy.then(() => this._run(code, cases, maxSec || DEFAULT_TIME_SEC));
      this.busy = job.catch(() => {});
      return job;
    }

    async _run(code, cases, maxSec) {
      await this.ready();
      const id = ++this.seq;
      const hardMs = (maxSec * cases.length + 4) * 1000;  // 파이썬 안 시간 재기가 못 잡는 경우의 마지막 안전장치
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = null;
          this.restart().catch(() => {});
          resolve(cases.map(() => ({ stdout: "", ret: null, kind: "Timeout", msg: null, line: null, ms: hardMs })));
        }, hardMs);
        this.pending = { id, resolve, reject, timer };
        this.worker.postMessage({ type: "run", id, code, cases, maxSec });
      });
    }
  }

  /* ---------- 비교·해시 ---------- */
  function normalize(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n?/g, "\n")
      .split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n")
      .replace(/\n+$/, "");
  }

  // 함수형은 반환값의 repr, 입출력형은 출력 전체
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

  function casesOf(problem, list) {
    return list.map((t) => (problem.type === "func" ? { stdin: "", call: t.call || "" } : { stdin: t.input || "", call: "" }));
  }

  /* 채점: tests 의 해시와 비교. → {passed, total, results:[{ok, kind, msg, line, ms}]} */
  async function grade(runner, problem, code, maxSec) {
    const tests = problem.tests || [];
    const raw = await runner.run(code, casesOf(problem, tests), maxSec);
    const results = [];
    let passed = 0;
    for (let i = 0; i < tests.length; i++) {
      const r = raw[i];
      const ans = answerText(problem, r);
      const ok = ans != null && (await hashAnswer(problem.id, i, ans)) === tests[i].hash;
      if (ok) passed++;
      results.push({ ok, kind: r.kind, msg: r.msg, line: r.line, ms: r.ms });
    }
    return { passed, total: tests.length, results };
  }

  /* 예시(정답 공개) 돌려 보기 → [{ok, expected, actual, kind, msg, line}] */
  async function checkExamples(runner, problem, code, maxSec) {
    const ex = problem.examples || [];
    if (!ex.length) return [];
    const raw = await runner.run(code, casesOf(problem, ex), maxSec);
    return ex.map((e, i) => {
      const r = raw[i];
      const actual = problem.type === "func" ? (r.ret == null ? "" : r.ret) : r.stdout;
      return {
        ok: !r.kind && normalize(actual) === normalize(e.output),
        expected: e.output, actual, kind: r.kind, msg: r.msg, line: r.line, input: e.input, call: e.call,
      };
    });
  }

  /* 교사용: 정답 코드로 예시 출력과 테스트 해시를 만든다 */
  async function buildFromReference(runner, problem, maxSec) {
    const ref = problem.refCode || "";
    if (!ref.trim()) throw new Error(problem.id + ": 정답 코드가 없습니다.");
    const exIn = problem.examples || [];
    const tIn = problem.tests || [];
    const raw = await runner.run(ref, casesOf(problem, exIn.concat(tIn)), maxSec);
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

  /* ---------- 오류를 중학생 말로 ---------- */
  const HINTS = {
    Timeout: ["시간 초과", "너무 오래 걸려서 멈췄어요. 끝나지 않는 반복(무한 반복)이 있는지 확인하세요."],
    OutputLimit: ["출력이 너무 많아요", "출력이 너무 많아서 멈췄어요. 반복이 끝나지 않는지 확인하세요."],
    SyntaxError: ["문법 오류", "괄호·따옴표 짝, 콜론(:), 철자를 확인하세요."],
    IndentationError: ["들여쓰기 오류", "줄 앞 공백(들여쓰기)이 맞지 않아요. if·for·def 다음 줄은 4칸 들여 씁니다."],
    TabError: ["들여쓰기 오류", "탭과 공백이 섞여 있어요. 공백 4칸으로 통일하세요."],
    NameError: ["이름 오류", "만들지 않은 변수나 함수 이름을 썼어요. 철자와 대소문자를 확인하세요. 글자는 따옴표로 감싸야 해요."],
    TypeError: ["자료형 오류", "글자와 숫자를 섞어 계산했을 수 있어요. input() 으로 받은 값은 글자라서 int() 로 바꿔야 계산돼요."],
    ValueError: ["값 오류", "숫자로 바꿀 수 없는 값을 int() 로 바꾸려 했거나, 입력 개수가 맞지 않아요."],
    ZeroDivisionError: ["0으로 나누기", "0으로 나눌 수 없어요."],
    EOFError: ["입력 부족", "input() 을 입력 줄 수보다 많이 썼어요. 입력 칸과 input() 개수를 확인하세요."],
    IndexError: ["범위 오류", "없는 위치의 값을 꺼내려 했어요."],
    KeyError: ["키 오류", "없는 키를 찾았어요."],
    AttributeError: ["속성 오류", "그 값에는 없는 기능(.뒤의 이름)을 썼어요. 철자를 확인하세요."],
    RecursionError: ["재귀 오류", "함수가 자기 자신을 끝없이 불렀어요."],
    ImportError: ["불러오기 오류", "이 연습장에서는 쓸 수 없는 모듈이에요."],
    ModuleNotFoundError: ["불러오기 오류", "없는 모듈이에요."],
  };

  function explain(r) {
    const h = HINTS[r.kind] || ["실행 오류 (" + r.kind + ")", "오류 메시지를 읽고 코드를 확인하세요."];
    return { title: h[0], hint: h[1], line: r.line || null, msg: r.msg || "" };
  }

  const TOPICS = [
    { key: "out", name: "출력" }, { key: "in", name: "입력" }, { key: "calc", name: "연산" },
    { key: "if", name: "조건" }, { key: "loop", name: "반복" }, { key: "func", name: "함수" },
  ];
  const LEVELS = { 1: "따라하기", 2: "적용", 3: "응용", 4: "도전" };

  global.PyCoding = {
    Runner, grade, checkExamples, buildFromReference, normalize, explain, hashAnswer,
    TOPICS, LEVELS, PYODIDE_VERSION, INDEX_URL, HARNESS,
  };
})(typeof window !== "undefined" ? window : globalThis);
