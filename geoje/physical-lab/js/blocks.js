/* ============================================================
   Blocks — 코드 도식 그리기 (메이크코드·엔트리 «블록처럼» 보이게)

   차시 데이터가 짧은 줄 목록을 주면 블록 모양으로 그린다.
   실제 캡처가 아니라 «흉내» 다 — 색·글자를 우리가 통제하고 저작권 걱정이 없다.
   교사가 실제 캡처 이미지를 올리면 이 도식 아래에 함께 보인다(lesson.js).

   줄 하나 = [카테고리, "  들여쓴 글"]
     카테고리 : loop | logic | basic | input | pins | music | var | radio | note
     들여쓰기 : 글 앞의 공백 2칸 = 한 단계

   Blocks.render(hostEl, lines, env)   env: "makecode" | "entry"
   ============================================================ */
(function (g) {
  "use strict";

  var COL = {
    makecode: {
      loop: "#0aa1a1", logic: "#3cae3c", basic: "#1E88E5", input: "#2f5fd0",
      pins: "#7a5bd0", music: "#8e44ad", var: "#d9822b", radio: "#c2410c", note: "#64748b"
    },
    entry: {
      loop: "#7c5cff", logic: "#f2b134", basic: "#4a90e2", input: "#4a90e2",
      pins: "#4a90e2", music: "#7c5cff", var: "#d9822b", radio: "#c2410c", note: "#64748b"
    }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function render(host, lines, env) {
    lines = lines || [];
    var col = COL[env] || COL.makecode;
    var html = '<div class="blocks ' + env + '">';
    lines.forEach(function (ln) {
      var cat = (ln[0] || "basic");
      var text = String(ln[1] || "");
      var indent = 0;
      var m = text.match(/^( +)/);
      if (m) { indent = Math.floor(m[1].length / 2); text = text.slice(m[1].length); }
      var isNote = cat === "note";
      html += '<div class="blk' + (isNote ? " note" : "") + '" style="margin-left:' + (indent * 20) + 'px;' +
        (isNote ? "" : "background:" + (col[cat] || col.basic)) + '">' + esc(text) + "</div>";
    });
    html += "</div>";
    host.innerHTML = html;
  }

  g.Blocks = { render: render };
})(window);
