/* ============================================================
   student.js — 학생 화면

   주소만 열면 «6자리 숫자를 넣는 화면» 이 먼저 나온다.
   숫자를 넣으면 그 ② 연결 문제를 받아 Connect.mount 로 띄운다.
   `#code=NNNNNN` · `#q=<base64>` 로 들어오면 곧바로 문제로 간다.

   실제 연결 시뮬(보드·부품·채점·연결표)은 js/connect/connect.js 가 한다.
   ============================================================ */
(function (g) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var conn = null;   /* Connect.mount 가 돌려준 것 */
  var prob = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function partName(entry) {
    if (entry && entry.def) return entry.def.name || "직접 만든 부품";
    var p = g.Parts && Parts.byId(entry && entry.id);
    return p ? p.name + (p.model ? " (" + p.model + ")" : "") : "(부품)";
  }

  function boot() {
    bindOnce();
    Code.ping(function () {});   /* «쓸 곳» 이 있는지 미리 물어 둔다 (byCode 가 쓴다) */

    var p = Code.fromUrl();
    var m = /[#&]code=(\d{6})/.exec(location.hash);
    if (p) { prob = p; startPlay(); }
    else if (m) { $("code6").value = m[1]; go6(); }
    else showStart();

    window.addEventListener("hashchange", function () {
      var q = Code.fromUrl();
      if (q) { prob = q; startPlay(); return; }
      var c = /[#&]code=(\d{6})/.exec(location.hash);
      if (c) { $("code6").value = c[1]; go6(); }
    });
  }

  function showStart() {
    $("startCard").hidden = false;
    $("playWrap").hidden = true;
    if (conn) { conn.destroy(); conn = null; }
  }

  function startPlay() {
    $("startCard").hidden = true;
    $("playWrap").hidden = false;
    $("probTitle").textContent = prob.t || "연결 문제";
    var names = (prob.parts || []).map(partName);
    var ext = (prob.ext || []).length
      ? " · 확장프로그램 " + prob.ext.map(function (x) { return "「" + x + "」"; }).join(" ") : "";
    $("prep").innerHTML = "마이크로비트 · Keyestudio 확장보드 · " + esc(names.join(" · ")) +
      (prob.usb ? " · 보조배터리" : "") + esc(ext);

    if (conn) conn.destroy();
    conn = Connect.mount($("connectHost"), prob, {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function go6(inId, msgId) {
    inId = inId || "code6"; msgId = msgId || "code6msg";
    var v = String($(inId).value || "").replace(/\D/g, "");
    if (v.length !== 6) { $(msgId).textContent = "숫자 6자리를 넣어 주세요."; return; }
    $(msgId).textContent = "찾고 있습니다…";
    Code.byCode(v, function (p, err) {
      if (!p) {
        $(msgId).innerHTML = "❌ " + esc(err || "없는 번호입니다") +
          " <b>선생님께 번호를 다시 물어보세요.</b>";
        return;
      }
      $(msgId).textContent = "";
      prob = p;
      location.hash = "code=" + v;   /* 새로고침해도 그 문제가 남게 */
      startPlay();
    });
  }

  function bindCode(inId, msgId, btnId) {
    var go = function () { go6(inId, msgId); };
    $(btnId).onclick = go;
    $(inId).onkeydown = function (ev) { if (ev.key === "Enter") go(); };
    $(inId).oninput = function () {
      var v = this.value.replace(/\D/g, "").slice(0, 6);
      if (v !== this.value) this.value = v;
      $(msgId).textContent = "";
      if (v.length === 6) go();
    };
  }

  function bindOnce() {
    bindCode("code6", "code6msg", "btnGo6");
    bindCode("code6b", "code6bmsg", "btnGo6b");
    $("btnDemo").onclick = function () { prob = Code.demo(); startPlay(); };
    $("btnBackStart").onclick = function () {
      location.hash = "";
      $("code6").value = ""; $("code6b").value = "";
      $("code6msg").textContent = "여섯 자리를 다 넣으면 저절로 시작합니다.";
      showStart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  }

  g.Student = { boot: boot };
})(window);
