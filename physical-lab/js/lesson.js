/* ============================================================
   lesson.js — 차시 페이지 (?n=12) 를 조립한다

   실제 조립은 js/lessonview.js 의 LessonView.mount 가 한다.
   이 파일은 ?n= 을 읽어 window.LESSONS[n] 을 넘겨 줄 뿐이다.
   (자유 문제(6자리 코드)는 student.js 가 같은 LessonView 를 쓴다.)
   ============================================================ */
(function () {
  "use strict";
  var el = UI.el;

  var n = parseInt((location.search.match(/[?&]n=(\d+)/) || [])[1], 10) || 0;
  var L = (window.LESSONS || {})[n];

  var wrap = document.getElementById("wrap");
  var stepHost = document.getElementById("steps");
  document.getElementById("crumbTitle").textContent = L ? (n + "차시 · " + L.title) : (n ? n + "차시" : "차시");
  document.title = (L ? n + "차시 · " + L.title : "차시") + " — 센서 공작소";

  if (!L) {
    stepHost.style.display = "none";
    wrap.appendChild(el("div", "card", "<h2>이 차시는 준비 중입니다</h2>" +
      "<p class=\"hint\">계획은 잡혀 있고, 아직 만드는 중이에요. <a href=\"index.html\">← 차시 목록으로</a></p>"));
    return;
  }

  window.LessonView.mount(wrap, stepHost, L, { n: n, hideEmpty: false });
})();
