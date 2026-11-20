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
  const CDN_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
  // 교내 서버판은 config.js 의 PYODIDE_URL 로 서버가 직접 내는 사본을 쓴다 (교내망에서는 jsDelivr 가 안 열린다).
  // Worker 는 blob 주소에서 돌아 상대 주소를 못 푸므로 여기서 절대 주소로 바꿔 넘긴다.
  const INDEX_URL = (function () {
    const own = (global.PYCODING_CONFIG || {}).PYODIDE_URL;
    if (!own) return CDN_URL;
    try { return new URL(own, global.location ? global.location.href : undefined).href.replace(/\/?$/, "/"); }
    catch (e) { return CDN_URL; }
  })();
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
            reject(new Error("파이썬을 불러오지 못했습니다. 네트워크 연결을 확인하고 새로고침하세요. (" + m.error + ")"));
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

  /* crypto.subtle 은 «보안 출처»(https · localhost)에서만 있다. 교내 서버(http://10.x.x.x)에서는 브라우저가 없애므로
     같은 값을 내는 순수 JS 구현(FIPS 180-4)으로 대신한다. 두 값이 같은지는 server-go 시험에서 확인한다. */
  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function sha256Plain(bytes) {
    const len = bytes.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    dv.setUint32(total - 4, (len << 3) >>> 0);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15], y = W[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = W[i - 16] + s0 + W[i - 7] + s1;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + SHA_K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, (v) => v.toString(16).padStart(8, "0")).join("");
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const subtle = global.crypto && global.crypto.subtle;
    if (subtle) {
      const buf = await subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Plain(bytes);
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

  /* ---------- 테스트별 결과 — 피드백 재료 (2026-11-15) ----------
     서버에 보내는 짧은 모양: [{ s: "pass"|"wrong"|"error"|"timeout", k: "NameError", l: 3, d: "space" }]
     d(틀린 모양)는 정답 출력을 아는 교사 화면(재확인)에서만 붙는다 — 학생 화면에는 정답 출력이 없다. */
  function detailOf(g) {
    return (g.results || []).map((r) => {
      const o = { s: r.ok ? "pass" : r.kind === "Timeout" ? "timeout" : r.kind ? "error" : "wrong" };
      if (!r.ok && r.kind && r.kind !== "Timeout") o.k = r.kind;
      if (!r.ok && r.line) o.l = r.line;
      if (!r.ok && r.diff) o.d = r.diff;
      return o;
    });
  }

  const DIFF_TEXT = {
    none: "값을 돌려주지 않음 (return 을 빠뜨렸거나 print 로 출력함)",
    type: "자료형이 다름 (글자 '3' 과 숫자 3 처럼)",
    empty: "아무것도 출력하지 않음",
    space: "띄어쓰기·줄바꿈만 다름",
    case: "대소문자만 다름",
    format: "숫자는 맞고 출력 형식이 다름",
    lines: "출력 줄 수가 다름",
    value: "값이 다름",
  };

  function classifyWrong(type, expected, actual) {
    const e = normalize(expected), a = normalize(actual);
    if (type === "func") {
      if (a === "None" && e !== "None") return "none";
      if (a.replace(/^['"]|['"]$/g, "") === e.replace(/^['"]|['"]$/g, "")) return "type";
    }
    if (!a.trim()) return "empty";
    const squash = (t) => t.replace(/\s+/g, "");
    if (squash(a) === squash(e)) return "space";
    if (a.toLowerCase() === e.toLowerCase()) return "case";
    const nums = (t) => (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const na = nums(a), ne = nums(e);
    if (ne.length && na.length === ne.length && na.every((x, i) => Math.abs(x - ne[i]) < 1e-9)) return "format";
    if (a.split("\n").length !== e.split("\n").length) return "lines";
    return "value";
  }

  /* 교사용: 정답 코드의 테스트별 정답 (classifyWrong 의 기준) */
  async function referenceAnswers(runner, problem, maxSec) {
    if (!(problem.refCode || "").trim()) return null;
    const raw = await runner.run(problem.refCode, casesOf(problem, problem.tests || []), maxSec);
    return raw.map((r) => answerText(problem, r));
  }

  /* grade 와 같고, refAnswers 가 있으면 틀린 테스트에 «틀린 모양»(diff)을 붙인다 */
  async function gradeDetailed(runner, problem, code, refAnswers, maxSec) {
    const tests = problem.tests || [];
    const raw = await runner.run(code, casesOf(problem, tests), maxSec);
    const results = [];
    let passed = 0;
    for (let i = 0; i < tests.length; i++) {
      const r = raw[i];
      const ans = answerText(problem, r);
      const ok = ans != null && (await hashAnswer(problem.id, i, ans)) === tests[i].hash;
      if (ok) passed++;
      const item = { ok, kind: r.kind, msg: r.msg, line: r.line, ms: r.ms };
      if (!ok && !r.kind && refAnswers && refAnswers[i] != null) item.diff = classifyWrong(problem.type, refAnswers[i], ans);
      results.push(item);
    }
    return { passed, total: tests.length, results };
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
    sha256Plain, Runner, grade, checkExamples, detailOf, classifyWrong, referenceAnswers, gradeDetailed, DIFF_TEXT, buildFromReference, normalize, explain, hashAnswer,
    TOPICS, LEVELS, PYODIDE_VERSION, INDEX_URL, HARNESS,
  };
})(typeof window !== "undefined" ? window : globalThis);
