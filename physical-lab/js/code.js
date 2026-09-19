/* ============================================================
   code.js — ② 연결 문제를 «담는 곳» 과 «6자리 숫자 코드»

   mb-connect/js/code.js 를 가져와 이 앱에 맞게 다듬었다.
   문제의 모양은 각 차시의 `connect` 와 같다 :
   {
     n:12,                      차시 번호 (있으면 목록에 함께 보인다)
     t:"자동문 — 인체감지 연결",  제목
     v1:"3V3", v2:"3V3",        점퍼
     usb:false,                 보조배터리(micro USB) 표시
     color:true,                선 색 약속을 «주의» 로 알려 줄지
     ext:["SONAR"],             확장프로그램 (없으면 빈 배열)
     parts:[
       { id:"pir", pin:{ OUT:0 } },                                사전에 있는 부품
       { def:{ name:"…", power:"5V", ext:"", pins:[…] }, pin:{ S:5 } }   교사가 만든 부품
     ]
   }

   ⚠ 교사가 만든 부품은 «정의를 문제 안에» 담는다(`entry.def`) — 그러지 않으면
     학생 화면(`Connect.mount`)이 그 부품을 모른다.

   ── ② 연결 문제를 «담는 곳» 이 셋이다 (순서대로 본다) ──────────
     ① `js/config.js` 의 **Worker**  — 채워져 있으면 늘 이쪽. 사이트에서도 쓰기가 된다
     ② 지금 페이지의 **server.py**   — 교사 PC 에서 켤 때
     ③ 사이트에 함께 올려 둔 **파일**(`q/NNNNNN.json`) — 읽기만

   🔴 ①②의 API 모양이 **같다.** 그래서 화면 코드는 어느 쪽인지 몰라도 된다.
   ============================================================ */
(function (g) {
  "use strict";

  /* 빠진 칸을 기본값으로 메운다 */
  function fill(o) {
    o = o || {};
    o.t = o.t || "연결 문제";
    o.v1 = o.v1 || "3V3";
    o.v2 = o.v2 || "3V3";
    o.usb = o.usb === true;
    o.color = o.color !== false;
    o.ext = o.ext || [];
    o.parts = (o.parts || []).map(function (p) { return { id: p.id, def: p.def, pin: p.pin || {} }; });
    return o;
  }

  function valid(o) {
    return o && typeof o === "object" && Array.isArray(o.parts) && o.parts.length > 0;
  }

  /* 주소에서 읽기 — #q=<base64(JSON)> (미리보기·나눠 주기용) */
  function b64d(s) {
    var t = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    var raw = atob(t), b = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i);
    return new TextDecoder().decode(b);
  }
  function b64e(s) {
    var b = new TextEncoder().encode(s), out = "";
    for (var i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
    return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromUrl() {
    var m = /[#&?]q=([^&]+)/.exec(location.hash + "&" + location.search);
    if (!m) return null;
    try { var o = JSON.parse(b64d(decodeURIComponent(m[1]))); return valid(o) ? fill(o) : null; }
    catch (e) { return null; }
  }
  function encode(prob) { return b64e(JSON.stringify(prob)); }

  /* 번호 없이 연습할 때 쓰는 보기 문제 — 12차시(자동문·인체감지) */
  function demo() {
    return fill({
      n: 12, t: "보기 문제 · 자동문 — 인체감지(PIR) 연결",
      v1: "3V3", v2: "3V3", usb: false, color: true, ext: [],
      parts: [{ id: "pir", pin: { OUT: 0 } }]
    });
  }

  /* ── 교사 코드 — 화면이 열릴 때 한 번 받아 메모리에만 들고 있다 ──
     🔴 평문이 아니라 해시(SHA-256)를 머리글(`X-Teacher-Hash`)로 보낸다.
        HTTP 머리글에는 ASCII 만 넣을 수 있어서 한글 코드가 아예 나가지 않는다.
     서버·Worker 는 저장해 둔 해시와 그대로 견준다(다시 해시하지 않는다). */
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

  /* 어디에 물을까 — WORKER 가 채워져 있으면 그 Worker, 아니면 지금 페이지(교사 PC) */
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

  /* «쓸 곳» 이 있는지 한 번만 물어 두고 기억한다 (`null` = 아직 모른다) */
  var serverOk = null;
  function ping(done) {
    if (serverOk !== null) { done(serverOk); return; }
    jfetch("ping", null, function (j) { serverOk = !!(j && j.ok); done(serverOk); });
  }

  /* 교사 코드가 맞는지 — 목록을 한 번 불러 본다(200 이면 맞음 · 403 이면 틀림).
     서버가 없으면(`file://`) 확인할 길이 없으므로 통과시키고 화면이 그 사실을 알린다. */
  function checkTeacher(code, done) {
    setTeacher(code);
    if (!base() && location.protocol === "file:") { done(true, "nocheck"); return; }
    jfetch("codes", null, function (j, err) {
      if (j) { done(true, ""); return; }
      if (/서버에 연결/.test(err || "")) { done(true, "nocheck"); return; }
      done(false, err || "코드가 맞지 않습니다");
    });
  }

  /* 그냥 파일 하나 읽기 — 서버가 없는 곳(GitHub Pages)에서 쓴다 */
  function plain(path, done) {
    if (!g.fetch) { done(null); return; }
    g.fetch(path, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (o) { done(valid(o) ? o : null); })
      .catch(function () { done(null); });
  }

  /* ── 6자리 숫자로 문제 찾기 — `q/NNNNNN.json` 한 길만 쓴다 ── */
  function byCode(code, done) {
    var c = String(code || "").replace(/\D/g, "");
    if (c.length !== 6) { done(null, "6자리 숫자를 넣어 주세요"); return; }
    plain(base() + "q/" + c + ".json", function (o) {
      if (o) { done(fill(o), ""); return; }
      /* Worker 를 쓰는데 그 번호가 없으면, 예전에 사이트에 함께 올려 둔 파일도 찾아본다 */
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

  /* 이미 만든 코드의 문제를 고친다 — **같은 번호로 덮어쓴다** */
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
    fill: fill, valid: valid, fromUrl: fromUrl, encode: encode, demo: demo,
    ping: ping, byCode: byCode, makeCode: makeCode, saveCode: saveCode,
    setTeacher: setTeacher, checkTeacher: checkTeacher,
    codes: codes, delCode: delCode
  };
})(window);
