/* ============================================================
   문제 담기 — 주소(URL) · 붙여넣기 코드 · 파일. 세 방법이 모두 같은 글자를 쓴다.

   문제의 모양
   {
     v:1,
     t:"초음파센서 회로도",     제목
     v1:"3V3", v2:"3V3",        점퍼
     usb:true,                  보조배터리(micro USB) 표시
     color:true,                색 약속을 «주의» 로 알려 줄지
     free:false,                true 면 신호핀 번호를 학생이 자유롭게 (지금은 교사가 지정)
     ext:["SONAR"],             확장프로그램 (없으면 빈 배열)
     parts:[
       { id:"hcsr04", pin:{ Trig:1, Echo:2 } },      사전에 있는 부품
       { def:{ name:"…", power:"5V", ext:"", pins:[…] }, pin:{ S:5 } }   교사가 만든 부품
     ]
   }

   ⚠ 교사가 만든 부품은 «정의를 문제 안에» 담는다. 그러지 않으면 학생 화면이
     그 부품을 모른다 (교사의 브라우저에만 있게 된다).
   ============================================================ */
(function (g) {
  "use strict";

  var TAG = "MBC1.";   /* 붙여넣기 코드 앞에 붙는 표시 */

  /* 한글이 들어가므로 UTF-8 로 바꾼 뒤 base64 로 만든다 */
  function b64e(s) {
    var b = new TextEncoder().encode(s), out = "";
    for (var i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
    return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64d(s) {
    var t = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    var raw = atob(t), b = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i);
    return new TextDecoder().decode(b);
  }

  function encode(prob) { return b64e(JSON.stringify(prob)); }

  function decode(text) {
    if (!text) return null;
    var s = String(text).trim();
    if (s.indexOf(TAG) === 0) s = s.slice(TAG.length);
    s = s.replace(/\s+/g, "");
    try {
      var o = JSON.parse(s.charAt(0) === "{" ? s : b64d(s));
      return valid(o) ? fill(o) : null;
    } catch (e) { return null; }
  }

  function valid(o) { return o && typeof o === "object" && Array.isArray(o.parts) && o.parts.length > 0; }

  /* 빠진 칸을 기본값으로 메운다 — 예전에 만든 문제도 계속 열리게 하려는 것 */
  function fill(o) {
    o.v = o.v || 1;
    o.t = o.t || "마이크로비트 연결 실습";
    o.v1 = o.v1 || "3V3";
    o.v2 = o.v2 || "3V3";
    o.usb = o.usb !== false;
    o.color = o.color !== false;
    o.ext = o.ext || [];
    o.parts.forEach(function (p) { p.pin = p.pin || {}; });
    return o;
  }

  /* 부품 항목 → 부품 정의 (사전에서 찾거나, 문제에 담긴 정의를 쓴다) */
  function part(entry) {
    if (entry.def) {
      var d = entry.def;
      return {
        id: "custom", name: d.name || "직접 만든 부품", model: d.model || "",
        pcb: d.pcb || "#39414d", face: "custom",
        power: d.power === "5V" ? "5V" : "3V3", ext: d.ext || "", note: d.note || "",
        pins: d.pins || []
      };
    }
    return g.Parts.byId(entry.id) || {
      id: entry.id, name: "(모르는 부품)", model: "", pcb: "#6b7280", face: "custom",
      power: "3V3", ext: "", note: "", pins: []
    };
  }

  /* 주소에서 읽기 — #q=… 를 쓴다 (물음표 뒤가 아니라 # 뒤라 서버가 필요 없다) */
  function fromUrl() {
    var m = /[#&?]q=([^&]+)/.exec(location.hash + "&" + location.search);
    return m ? decode(decodeURIComponent(m[1])) : null;
  }

  function url(prob, page) {
    var base = location.href.replace(/[#?].*$/, "");
    if (page) base = base.replace(/[^/]*$/, page);
    return base + "#q=" + encode(prob);
  }

  function download(prob) {
    var name = (prob.t || "연결문제").replace(/[\\/:*?"<>|]/g, "_") + ".mbconnect.json";
    var blob = new Blob([JSON.stringify(prob, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function readFile(file, done) {
    var r = new FileReader();
    r.onload = function () { done(decode(String(r.result))); };
    r.onerror = function () { done(null); };
    r.readAsText(file);
  }

  /* 처음 열었을 때 보여 주는 보기 문제 — 선생님이 주신 초음파 회로도 그대로 */
  function demo() {
    return fill({
      v: 1, t: "초음파센서 회로도", v1: "3V3", v2: "3V3", usb: true, color: true,
      ext: ["SONAR"],
      parts: [
        { id: "hcsr04", pin: { Trig: 1, Echo: 2 } },
        { id: "led", pin: { S: 8 } }
      ]
    });
  }

  /* ── 6자리 숫자 코드 ────────────────────────────────────────
     긴 코드(MBC1.eyJ2Ijox…)를 학생에게 불러 주는 것이 너무 어려웠다(사용자 지적).
     6자리에는 문제를 담을 수 없으므로 **문제를 어딘가에 두고 번호만 부른다.**

     ── 그 «어딘가» 가 세 군데다 (순서대로 본다) ──────────────
       ① `js/config.js` 의 **Worker**  — 채워져 있으면 늘 이쪽. 사이트에서도 쓰기가 된다
       ② 지금 페이지의 **server.py**   — 교사 PC 에서 켤 때
       ③ 사이트에 함께 올려 둔 **파일**(`q/NNNNNN.json`) — 읽기만

     🔴 ①②의 API 모양이 **같다.** 그래서 화면 코드는 어느 쪽인지 몰라도 된다.
     🔴 ① 을 채우면 **교사가 PC 에서 아무것도 하지 않아도** 사이트에서 문제를 만들고
        고치고 지운다(2026-08-24 사용자 지시). 만드는 방법은 `worker/설치안내.md`.
     ⚠ ①이 비어 있으면 주소는 **상대 주소**('api/…')가 된다. 하위 폴더에 올라가면
       그 폴더 아래를 찾아 404 가 되고, 그것이 «쓸 곳 없음» 판정이 된다. */

  /* 교사 코드 — 화면이 열릴 때 한 번 받아 **메모리에만** 들고 있다.
     저장하지 않는다(새로고침하면 다시 넣는다) — `mb-bluetooth` 와 같은 판단이다.

     🔴 **평문이 아니라 해시(SHA-256)를 머리글로 보낸다.** 이유가 둘이다.
       ① HTTP 머리글에는 **ASCII 만** 넣을 수 있다. 교사 코드에 한글이 한 자라도 있으면
          브라우저가 요청을 아예 만들지 못한다(`Cannot convert argument to a ByteString`).
          검사(`verify_worker.mjs`)가 이 오류로 실제로 걸렸다.
       ② 평문이 네트워크를 오가지 않는다.
     서버·Worker 는 저장해 둔 해시와 **그대로** 견준다(다시 해시하지 않는다).
     ⚠ 머리글 이름이 `X-Teacher-Hash` 다 — 예전 이름(`X-Teacher-Code`)과 다르다.
       한쪽만 고치면 **조용히 통과하는 대신 403 으로 막힌다**(그러라고 이름을 바꿨다). */
  var teacherHashP = null;

  function sha256hex(s) {
    var enc = new TextEncoder().encode(s);
    return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      var b = new Uint8Array(buf), out = "";
      for (var i = 0; i < b.length; i++) out += ("0" + b[i].toString(16)).slice(-2);
      return out;
    });
  }

  function setTeacher(code) {
    var s = String(code || "");
    teacherHashP = s ? sha256hex(s) : null;
    return teacherHashP;
  }

  /* 어디에 물을까 —
       ① `js/config.js` 의 `WORKER` 가 채워져 있으면 **그 Worker**
          (GitHub Pages 에서도 문제를 만들고 고칠 수 있게 하는 길)
       ② 아니면 지금 페이지가 있는 곳(교사 PC 의 `server.py`)
     🔴 두 곳의 API 모양이 **같다.** 그래서 화면 코드는 어느 쪽인지 몰라도 된다. */
  function base() {
    var w = (g.CONFIG && g.CONFIG.WORKER) || "";
    return w ? w.replace(/\/+$/, "") + "/" : "";
  }

  function jfetch(path, opt, done) {
    if (!g.fetch) { done(null, "이 브라우저에서는 쓸 수 없습니다"); return; }
    opt = opt || {};
    (teacherHashP || Promise.resolve("")).then(function (hash) {
      if (hash) opt.headers = Object.assign({}, opt.headers || {}, { "X-Teacher-Hash": hash });
      return g.fetch(base() + "api/" + path, opt);
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { done(x.ok ? x.j : null, x.ok ? "" : (x.j && x.j.error) || "오류"); })
      .catch(function () { done(null, "서버에 연결할 수 없습니다"); });
  }

  /* 문제를 «쓸 곳» 이 있는지 한 번만 물어 두고 기억한다 (`null` = 아직 모른다).
     Worker 가 설정되어 있으면 사이트에서도 참이 된다 — 그때는 PC 서버가 필요 없다. */
  var serverOk = null;
  function ping(done) {
    if (serverOk !== null) { done(serverOk); return; }
    jfetch("ping", null, function (j) { serverOk = !!(j && j.ok); done(serverOk); });
  }

  /* 그냥 파일 하나 읽기 — GitHub Pages 처럼 서버가 없는 곳에서 쓴다 */
  function plain(path, done) {
    if (!g.fetch) { done(null); return; }
    g.fetch(path, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) { done(valid(o) ? o : null); })
      .catch(function () { done(null); });
  }

  /* ── 6자리 숫자로 문제 찾기 ────────────────────────────────
     🔴 **`q/NNNNNN.json` 한 길만 쓴다.** 교사 PC 의 `server.py` 도, GitHub Pages 도
        같은 주소로 답한다 — 그래서 «사이트에서만 안 되는» 일이 생기지 않는다.
        · 교사 PC : `server.py` 가 `data/문제/` 에서 꺼내 준다 (방금 만든 코드도 곧바로)
        · 사이트  : 배포 스크립트가 `data/문제/*.json` 을 `q/` 로 함께 올려 둔다

     ⚠ 주소를 **ASCII(`q/`)로 둔다** — 한글 폴더(`문제/`)는 요청이 오는 길에
       글자가 깨져 아예 안 맞았다(실제로 겪음).

     ⚠ **배포 스크립트의 그 복사를 빼면** 학생이 코드를 넣어도 «없는 번호» 만 나온다.
     ⚠ 교사가 새로 만든 코드는 **다시 올려야** 사이트에서 쓸 수 있다. */
  function byCode(code, done) {
    var c = String(code || "").replace(/\D/g, "");
    if (c.length !== 6) { done(null, "6자리 숫자를 넣어 주세요"); return; }
    plain(base() + "q/" + c + ".json", function (o) {
      if (o) { done(fill(o), ""); return; }
      /* Worker 를 쓰는데 그 번호가 없으면, 예전에 사이트에 함께 올려 둔 파일도 찾아본다.
         (Worker 를 쓰기 전에 만든 문제가 아직 남아 있을 수 있다) */
      if (base()) {
        plain("q/" + c + ".json", function (o2) {
          done(o2 ? fill(o2) : null, "그 번호의 문제를 찾을 수 없습니다");
        });
        return;
      }
      done(null, "그 번호의 문제를 찾을 수 없습니다");
    });
  }

  function makeCode(prob, done) {
    jfetch("code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prob)
    }, function (j, err) { done(j && j.code ? j.code : null, err); });
  }

  /* 이미 만든 코드의 문제를 고친다 — **같은 번호로 덮어쓴다.**
     새 번호를 만들면 학생에게 다시 불러 줘야 하기 때문이다. */
  function saveCode(code, prob, done) {
    jfetch("code/" + String(code).replace(/\D/g, ""), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prob)
    }, function (j, err) { done(!!(j && j.ok), err); });
  }

  function codes(done) {
    jfetch("codes", null, function (j) { done((j && j.list) || []); });
  }

  function delCode(code, done) {
    jfetch("code/" + String(code).replace(/\D/g, ""), { method: "DELETE" },
      function (j, err) { done(!!(j && j.ok), err); });
  }

  g.Code = {
    TAG: TAG, encode: encode, decode: decode, part: part, fill: fill,
    fromUrl: fromUrl, url: url, download: download, readFile: readFile, demo: demo,
    ping: ping, byCode: byCode, makeCode: makeCode, saveCode: saveCode,
    setTeacher: setTeacher,
    codes: codes, delCode: delCode
  };
})(window);
