/* ============================================================
   UI — 작은 공용 도구 + 차시 탭 막대

   화면이 길어지지 않게, 6단계를 **탭**으로 만든다.
   탭을 누르면 그 단계 화면만 보인다(나머지는 숨긴다).
   ============================================================ */
(function (g) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* `코드` → <code> · **굵게** → <b> · 차시 데이터에 직접 쓴 <b> <i> <br> 은 그대로 살린다
     (esc 로 한 번 막은 뒤 이 셋만 되살리므로 그 밖의 태그는 계속 무해하다) */
  function rich(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/&lt;(\/?)(b|i|br)\s*\/?&gt;/gi, "<$1$2>");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* 탭 막대
       host    : 넣을 자리
       defs    : [{ id:"s1", k:"①", label:"개념" }, ...]
       onSelect: function(id){ ... }  (탭이 바뀔 때. 처음 한 번은 부르지 않는다)
     돌려주는 것 : { select(id), mark(id, done), active() }
  */
  function tabs(host, defs, onSelect) {
    host.innerHTML = "";
    host.className = "steps noprint";
    var links = {};
    var cur = null;

    defs.forEach(function (d) {
      var a = el("button", null, '<span class="k">' + d.k + "</span>" + d.label);
      a.type = "button";
      a.setAttribute("role", "tab");
      a.onclick = function () { select(d.id, true); };
      links[d.id] = a;
      host.appendChild(a);
    });

    function select(id, fire) {
      if (!links[id]) return;
      cur = id;
      defs.forEach(function (d) { links[d.id].classList.toggle("on", d.id === id); });
      if (fire && onSelect) onSelect(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function mark(id, done) {
      /* ⚠ 클래스 이름을 «done» 으로 쓰지 말 것 — app.css 의 전역 `.done`(연결 성공 상자)와
         충돌해 탭에 초록 그러데이션·큰 여백이 붙어 배열이 어긋난다(사용자 신고). */
      if (links[id]) links[id].classList.toggle("tdone", !!done);
    }

    return { select: select, mark: mark, active: function () { return cur; } };
  }

  g.UI = { esc: esc, rich: rich, el: el, tabs: tabs };
})(window);
