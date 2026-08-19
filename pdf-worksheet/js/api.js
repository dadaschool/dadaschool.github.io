/* =========================================================
   api.js — Worker(중계 서버)와 이야기하는 부분
   ---------------------------------------------------------
   왜 노션을 직접 부르지 않는가
     ① 노션 API 는 브라우저에서 직접 못 부른다(CORS 차단).
     ② 토큰을 학생이 받는 파일에 넣으면 누구나 꺼내 볼 수 있다.
     → 토큰은 Worker 의 비밀 변수에만 두고, 학생 브라우저는 이 주소만 안다.

   ⚠ 보내는 칸 이름(action·task·klass·no·name)은 **반드시 ASCII** 로 둔다.
     multipart 는 칸 이름을 헤더(Content-Disposition)에 싣는데, 거기에 한글을 넣으면
     받는 쪽(파이썬 email 모듈·Cloudflare Worker)이 헤더를 제대로 못 읽는다.
     실제로 칸 이름을 "반" 으로 했다가 목록이 안 나오는 문제가 났다.
     한글은 **값**에만 넣는다(본문은 UTF-8 이라 문제없다).

  ⚠ 개인정보를 주소(query string)에 절대 넣지 않는다.
     주소는 브라우저 기록·서버 로그·중계 장비에 그대로 남는다.
     그래서 이름·학번은 **본문(FormData)** 으로만 보낸다.

   ⚠ PDF 를 base64 로 바꾸지 않는다.
     base64 는 용량이 1.33배로 늘고, Worker 무료 요금제의 CPU 한도(10ms)를
     넘길 위험이 있다. multipart/form-data 로 **바이너리 그대로** 보내면
     Worker 는 받은 것을 노션으로 흘려보내기만 하면 되어 CPU 를 거의 안 쓴다.
   ========================================================= */
(function (global) {
  "use strict";

  function base() {
    var w = (global.CONFIG && global.CONFIG.WORKER) || "";
    if (w) return String(w).replace(/\/+$/, "");
    /* 설정이 비어 있고 localhost 에서 열었다면 **같은 서버**를 쓴다.
       server.py 의 시험 모드가 Worker 를 흉내 내므로, 노션·Cloudflare 설정을
       하기 전에도 앱을 그대로 확인할 수 있다. 학생에게 나눠 줄 때는
       config.js 의 WORKER 에 실제 주소가 들어가므로 이 경로는 쓰이지 않는다. */
    var h = global.location && global.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return global.location.origin;
    return "";
  }

  function ready() { return !!base(); }

  /* http 로는 보내지 않는다 — 학생 이름이 평문으로 흐르지 않게.
     수업 준비용 localhost 만 예외로 둔다. */
  function checkScheme(url) {
    if (/^https:\/\//i.test(url)) return true;
    if (/^http:\/\/localhost([:/]|$)/i.test(url)) return true;
    if (/^http:\/\/127\.0\.0\.1([:/]|$)/i.test(url)) return true;
    return false;
  }

  async function post(action, fields, file) {
    var url = base();
    if (!url) throw new Error("설정이 끝나지 않았습니다 (js/config.js 의 WORKER).");
    if (!checkScheme(url)) throw new Error("Worker 주소는 https 여야 합니다.");

    var form = new FormData();
    form.append("action", action);
    Object.keys(fields || {}).forEach(function (k) {
      if (fields[k] !== undefined && fields[k] !== null) form.append(k, String(fields[k]));
    });
    if (file) form.append("pdf", file.blob, file.name);

    /* ⚠ 제출 키를 **헤더가 아니라 본문**으로 보낸다.
       HTTP 헤더는 ASCII 만 담을 수 있어서, 선생님이 키를 「수업2026」처럼 한글로
       정하면 헤더를 만드는 순간 브라우저가 오류를 낸다(검사에서 실제로 걸렸다).
       본문은 UTF-8 이라 어떤 글자든 괜찮다. 주소가 아니라 본문이라 기록에도 안 남는다. */
    var key = (global.CONFIG && global.CONFIG.SUBMIT_KEY) || "";
    if (key) form.append("skey", String(key));

    var res;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch (e) {
      throw new Error("서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
    }

    /* PDF 를 받는 요청은 JSON 이 아니라 파일이 온다 */
    var type = res.headers.get("Content-Type") || "";
    if (type.indexOf("application/pdf") === 0) {
      if (!res.ok) throw new Error("활동지를 받지 못했습니다.");
      return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
    }

    var data;
    try { data = await res.json(); }
    catch (e) { throw new Error("서버가 이상한 답을 보냈습니다 (" + res.status + ")."); }

    /* 시험 모드(server.py)인지 기억해 둔다 — 화면에 크게 알려 주기 위해서다.
       ⚠ 이 표시가 없어서 «노션에 댓글이 안 달린다» 는 혼란이 실제로 있었다.
         시험 모드에서는 제출물이 노션이 아니라 demo/제출/ 에만 저장된다. */
    if (data && typeof data.demo === "boolean") global.API.demo = data.demo;

    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || "요청이 처리되지 않았습니다.");
    }
    return data;
  }

  global.API = {
    ready: ready,

    /* 반 목록 — 노션 「다중 선택」 칸에 있는 값을 그대로 가져온다.
       그래서 반이 늘어도 앱을 고칠 필요가 없다. */
    classes: function () {
      return post("classes", {}).then(function (d) { return d.classes || []; });
    },

    /* 그 반에게 열려 있는 활동지 목록.
       ⚠ 닫힌 것·마감된 것은 Worker 가 아예 보내지 않는다(목록에서 고를 수 없다). */
    tasks: function (klass) {
      return post("tasks", { klass: klass }).then(function (d) { return d.tasks || []; });
    },

    /* 활동지 PDF 받기. 노션 파일 주소는 1시간 뒤 만료되므로 Worker 가 바이트를 대신 가져다 준다. */
    pdf: function (taskId) {
      return post("pdf", { task: taskId }).then(function (d) { return d.bytes; });
    },

    /* 이미 낸 것이 있는지 — 있다/없다와 몇 번째인지만 돌려준다.
       ⚠ 다른 학생 이름이나 노션 페이지 id 는 절대 돌려주지 않는다(명단 유출 방지). */
    check: function (info) {
      return post("check", info);
    },

    /* 제출 */
    submit: function (info, blob, filename) {
      return post("submit", info, { blob: blob, name: filename });
    },

    /* 교사용 제출 현황 */
    report: function (teacherKey, taskId) {
      return post("report", { key: teacherKey, task: taskId || "" });
    },

    /* 교사용 — 「제출」 표를 처음 한 번 만든다 */
    setup: function (teacherKey) {
      return post("setup", { key: teacherKey });
    }
  };
})(window);
