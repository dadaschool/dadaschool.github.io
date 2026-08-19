/* =========================================================
   api.js — 저장소와 이야기하는 부분
   ---------------------------------------------------------
   저장소가 **둘**이고, 설정으로 고른다 (js/config.js).

     노션   ← Cloudflare Worker (worker/worksheet-proxy.js)
     드라이브 ← Apps Script 웹앱  (drive/제출저장.gs)

     SOURCE : 활동지 목록·PDF 를 어디서 가져오나   "notion" | "drive"
     TARGET : 제출을 어디로 보내나                 "notion" | "drive" | "both"

   왜 브라우저가 노션·드라이브를 직접 못 부르는가
     ① 둘 다 브라우저에서 직접 부를 수 없다(CORS 차단).
     ② 토큰·권한을 학생이 받는 파일에 넣으면 누구나 꺼내 볼 수 있다.
     → 중계 서버(Worker · Apps Script)에만 권한을 두고, 학생 브라우저는 주소만 안다.

   ⚠ 보내는 방식이 저장소마다 다르다. 이유가 각각 있다.

     노션(Worker)  : multipart/form-data + **바이너리 그대로**
       base64 로 바꾸면 용량이 1.33배로 늘고, Cloudflare 무료 요금제의
       CPU 한도(10ms)를 넘길 위험이 있다.

     드라이브(Apps Script) : text/plain 본문에 JSON + PDF 는 **base64**
       Apps Script 는 multipart 를 제대로 못 읽고, application/json 으로 보내면
       브라우저가 preflight(OPTIONS)를 먼저 보내는데 Apps Script 가 그것을
       처리하지 못해 CORS 오류가 난다. **text/plain 은 «단순 요청» 이라 preflight 가 없다.**
       Apps Script 는 CPU 한도가 넉넉해 base64 가 문제되지 않는다.

   ⚠ 보내는 칸 이름(action·task·klass·no·name)은 **반드시 ASCII** 로 둔다.
     multipart 는 칸 이름을 헤더에 싣는데, 거기에 한글을 넣으면 받는 쪽이
     헤더를 제대로 못 읽는다. 실제로 칸 이름을 "반" 으로 했다가 목록이 안 나왔다.
     한글은 **값**에만 넣는다.

   ⚠ 개인정보를 주소(query string)에 절대 넣지 않는다.
     주소는 브라우저 기록·서버 로그·중계 장비에 그대로 남는다.
     그래서 이름·학번은 **본문**으로만 보낸다.
   ========================================================= */
(function (global) {
  "use strict";

  function cfg(k, d) {
    var v = global.CONFIG && global.CONFIG[k];
    return (v === undefined || v === null || v === "") ? d : v;
  }

  function source() { return String(cfg("SOURCE", "notion")).toLowerCase(); }
  function target() { return String(cfg("TARGET", "notion")).toLowerCase(); }

  function notionBase() {
    var w = cfg("WORKER", "");
    if (w) return String(w).replace(/\/+$/, "");
    /* 설정이 비어 있고 localhost 에서 열었다면 **같은 서버**를 쓴다.
       server.py 의 시험 모드가 Worker 를 흉내 내므로, 노션·Cloudflare 설정을
       하기 전에도 앱을 그대로 확인할 수 있다. */
    var h = global.location && global.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return global.location.origin;
    return "";
  }

  function driveBase() {
    return String(cfg("DRIVE", "")).replace(/\/+$/, "");
  }

  /* http 로는 보내지 않는다 — 학생 이름이 평문으로 흐르지 않게.
     수업 준비용 localhost 만 예외로 둔다. */
  function okScheme(url) {
    if (/^https:\/\//i.test(url)) return true;
    if (/^http:\/\/localhost([:/]|$)/i.test(url)) return true;
    if (/^http:\/\/127\.0\.0\.1([:/]|$)/i.test(url)) return true;
    return false;
  }

  function ready() {
    var s = source(), t = target();
    if (s === "drive" && !driveBase()) return false;
    if (s === "notion" && !notionBase()) return false;
    if ((t === "drive" || t === "both") && !driveBase()) return false;
    if ((t === "notion" || t === "both") && !notionBase()) return false;
    return true;
  }

  /* ⚠ 설정 조합 하나는 원리상 불가능하다.
     활동지를 드라이브에서 가져오면 활동지 id 가 **드라이브 파일 id** 인데,
     노션 Worker 는 그것이 «노션에 열려 있는 활동지» 인지 확인할 수 없어 거절한다.
     그래서 미리 막고 이유를 알려 준다. */
  function configError() {
    var s = source(), t = target();
    if (s === "drive" && (t === "notion" || t === "both")) {
      return "설정이 맞지 않습니다 — 활동지를 드라이브에서 가져오면(SOURCE=\"drive\") " +
             "제출도 드라이브로만 보낼 수 있습니다(TARGET=\"drive\"). js/config.js 를 확인해 주세요.";
    }
    if (s !== "notion" && s !== "drive") return "SOURCE 는 \"notion\" 또는 \"drive\" 여야 합니다.";
    if (t !== "notion" && t !== "drive" && t !== "both") {
      return "TARGET 은 \"notion\" · \"drive\" · \"both\" 중 하나여야 합니다.";
    }
    return null;
  }

  /* =========================================================
     노션 쪽 (Cloudflare Worker · multipart)
     ========================================================= */
  async function postNotion(action, fields, file) {
    var url = notionBase();
    if (!url) throw new Error("노션 주소가 설정되지 않았습니다 (js/config.js 의 WORKER).");
    if (!okScheme(url)) throw new Error("Worker 주소는 https 여야 합니다.");

    var form = new FormData();
    form.append("action", action);
    Object.keys(fields || {}).forEach(function (k) {
      if (fields[k] !== undefined && fields[k] !== null) form.append(k, String(fields[k]));
    });
    if (file) form.append("pdf", file.blob, file.name);

    /* ⚠ 제출 키를 **헤더가 아니라 본문**으로 보낸다.
       HTTP 헤더는 ASCII 만 담을 수 있어서, 키를 「수업2026」처럼 한글로 정하면
       헤더를 만드는 순간 브라우저가 오류를 낸다(검사에서 실제로 걸렸다). */
    var key = cfg("SUBMIT_KEY", "");
    if (key) form.append("skey", String(key));

    var res;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch (e) {
      throw new Error("노션 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
    }

    var type = res.headers.get("Content-Type") || "";
    if (type.indexOf("application/pdf") === 0) {
      if (!res.ok) throw new Error("활동지를 받지 못했습니다.");
      return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
    }

    var data;
    try { data = await res.json(); }
    catch (e) { throw new Error("노션 서버가 이상한 답을 보냈습니다 (" + res.status + ")."); }

    if (data && typeof data.demo === "boolean") global.API.demo = data.demo;
    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || "요청이 처리되지 않았습니다.");
    }
    return data;
  }

  /* =========================================================
     드라이브 쪽 (Apps Script · text/plain + base64)
     ========================================================= */
  async function postDrive(action, fields, pdfBytes, filename) {
    var url = driveBase();
    if (!url) throw new Error("드라이브 주소가 설정되지 않았습니다 (js/config.js 의 DRIVE).");
    if (!okScheme(url)) throw new Error("드라이브 주소는 https 여야 합니다.");

    var body = Object.assign({ action: action }, fields || {});
    var key = cfg("SUBMIT_KEY", "");
    if (key) body.skey = String(key);
    if (pdfBytes) {
      body.pdf = toBase64(pdfBytes);
      body.filename = filename || "제출.pdf";
    }

    var res;
    try {
      /* ⚠ Content-Type 을 text/plain 으로 둔다 — 이유는 파일 머리말 참고.
         application/json 으로 바꾸면 CORS 오류가 난다. */
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("드라이브 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
    }

    var data;
    try { data = await res.json(); }
    catch (e) {
      throw new Error("드라이브 서버가 이상한 답을 보냈습니다. " +
        "웹앱을 「모든 사용자」로 배포했는지 확인해 주세요 (" + res.status + ").");
    }
    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || "요청이 처리되지 않았습니다.");
    }
    return data;
  }

  /* Uint8Array → base64. 한 번에 String.fromCharCode 로 넘기면
     인수가 너무 많아 터지므로 조금씩 잘라 붙인다. */
  function toBase64(bytes) {
    var CHUNK = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += CHUNK) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
    }
    return btoa(parts.join(""));
  }

  function fromBase64(b64) {
    var bin = atob(String(b64));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* =========================================================
     앱이 부르는 것들
     ========================================================= */
  global.API = {
    ready: ready,
    configError: configError,
    source: source,
    target: target,
    demo: false,

    /* 반 목록 — SOURCE 가 정한 곳에서 */
    classes: function () {
      if (source() === "drive") {
        return postDrive("classes", {}).then(function (d) { return d.classes || []; });
      }
      return postNotion("classes", {}).then(function (d) { return d.classes || []; });
    },

    /* 그 반에게 열려 있는 활동지 목록.
       ⚠ 닫힌 것·마감된 것은 중계 서버가 아예 보내지 않는다. */
    tasks: function (klass) {
      if (source() === "drive") {
        return postDrive("tasks", { klass: klass }).then(function (d) { return d.tasks || []; });
      }
      return postNotion("tasks", { klass: klass }).then(function (d) { return d.tasks || []; });
    },

    /* 활동지 PDF 받기 */
    pdf: function (taskId, klass) {
      if (source() === "drive") {
        return postDrive("pdf", { task: taskId, klass: klass })
          .then(function (d) { return fromBase64(d.pdf); });
      }
      return postNotion("pdf", { task: taskId, klass: klass }).then(function (d) { return d.bytes; });
    },

    /* 이미 낸 것이 있는지 — 있다/없다와 몇 번째인지만 돌려준다.
       ⚠ 다른 학생 이름이나 페이지·파일 id 는 절대 돌려주지 않는다(명단 유출 방지). */
    check: function (info) {
      if (target() === "drive") return postDrive("check", info);
      return postNotion("check", info);
    },

    /* 제출.
       TARGET="both" 면 **노션을 먼저** 보낸다(그쪽이 학생에게 보이는 «냈다» 의 기준).
       드라이브가 실패해도 제출은 성공으로 보고 driveError 로 알린다. */
    submit: async function (info, bytes, notionName, driveInfo) {
      var t = target();
      var blob = new Blob([bytes], { type: "application/pdf" });

      if (t === "drive") {
        return await postDrive("submit", Object.assign({}, info, driveInfo), bytes, notionName);
      }

      var r = await postNotion("submit", info, { blob: blob, name: notionName });
      if (t === "both") {
        try {
          await postDrive("submit", Object.assign({}, info, driveInfo), bytes, notionName);
          r.driveOk = true;
        } catch (e) {
          r.driveOk = false;
          r.driveError = e.message;
        }
      }
      return r;
    },

    /* 교사용 제출 현황 */
    report: function (teacherKey, taskId, taskTitle) {
      if (target() === "drive") {
        if (!taskId) {
          /* 드라이브에서는 활동지 목록을 SOURCE 쪽에서 가져온다 */
          if (source() === "drive") {
            return postDrive("tasksAll", { key: teacherKey }).catch(function () {
              return { ok: true, tasks: [] };
            });
          }
          return postNotion("report", { key: teacherKey, task: "" });
        }
        return postDrive("report", { key: teacherKey, taskTitle: taskTitle || "" });
      }
      return postNotion("report", { key: teacherKey, task: taskId || "" });
    },

    /* 교사용 — 수업 전에 반 폴더를 미리 만든다 (드라이브만) */
    prepare: function (teacherKey, taskTitle, classes) {
      return postDrive("prepare", { key: teacherKey, taskTitle: taskTitle, classes: classes });
    },

    /* 교사용 — 「제출」 표를 처음 한 번 만든다 (노션만) */
    setup: function (teacherKey) {
      return postNotion("setup", { key: teacherKey });
    },

    /* 설정이 어디서 어긋났는지 */
    diag: function (teacherKey) {
      if (target() === "drive") return postDrive("diag", { key: teacherKey });
      return postNotion("diag", { key: teacherKey });
    }
  };
})(window);
