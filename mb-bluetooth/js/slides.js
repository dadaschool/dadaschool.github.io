/* =========================================================
   slides.js — 수업 슬라이드 끼워 넣기

   선생님이 만든 수업자료 16장(slides/s01.webp … s16.webp)을
   앱의 알맞은 자리에 나눠 넣고, 누르면 크게 볼 수 있게 한다.

   외부 라이브러리 0개 · fetch 0건 → file:// 더블클릭에서도 그대로 동작한다.
   ========================================================= */
(function (global) {
  "use strict";

  /* 16장이 각각 무엇인가 — 캡션은 화면과 크게 보기에 함께 나온다 */
  var DATA = [
    { n: 1,  t: "스마트하우스, 선 없이 잇기",        c: "이 프로젝트가 무엇인지 한 장으로" },
    { n: 2,  t: "왜 무선이어야 하는가",              c: "선이 엉킨 집(문제) ↔ 무선으로 이은 집(목표)" },
    { n: 3,  t: "3단계 엔지니어링 마스터 플랜",      c: "시뮬레이터로 먼저 이해하고 → 실물로 확인한다" },
    { n: 4,  t: "무엇을 재고 무엇을 움직일까",        c: "입력(센서) → 출력(장치) 짝 짓기" },
    { n: 5,  t: "무선 명령은 편지가 아니라 확성기",   c: "근처가 다 듣는다 · radio.setGroup() 으로 나눈다" },
    { n: 6,  t: "micro:bit Radio vs 진짜 블루투스",  c: "다르지만 채널·주소·신호 세기 개념은 똑같다" },
    { n: 7,  t: "보이지 않는 기기를 찾는 법",        c: "GPS 없이 위치를 아는 방법" },
    { n: 8,  t: "거리와 신호 세기 (RSSI)",           c: "가까울수록 자주·강하게 뜬다" },
    { n: 9,  t: "실전 활동 — 숨겨진 비콘 보물찾기",   c: "출력·간격을 정하고, 배터리를 달고, 모둠이 찾는다" },
    { n: 10, t: "가까이 가면 스스로 반응하게",        c: "신호 세기를 0~9 숫자로 바꾼다(비례 변환)" },
    { n: 11, t: "시스템의 운명을 정하는 숫자 — 임계값", c: "반응이 시작되는 정확한 기준점" },
    { n: 12, t: "오탐과 미탐",                       c: "너무 민감해도, 너무 둔감해도 안 된다" },
    { n: 13, t: "우리 모둠 스마트하우스 최종 설계도",  c: "학습지 16문항으로 정리해 낸다" },
    { n: 14, t: "제출과 데이터 보안 규칙",            c: "제출하면 잠기고, 정답 코드로 해설이 열린다" },
    { n: 15, t: "실습 점검 체크리스트",              c: "안 될 때 이 순서로 확인한다" },
    { n: 16, t: "소프트웨어와 하드웨어가 만나면",     c: "코드가 화면 밖으로 나와 세상을 바꾼다" }
  ];

  function meta(n) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].n === n) return DATA[i];
    return { n: n, t: "슬라이드 " + n, c: "" };
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function src(n) { return "slides/s" + pad(n) + ".webp"; }

  /* ---------------------------------------------------------
     자리에 슬라이드 끼워 넣기

       Slides.strip(칸, [5, 6], { title: "수업 슬라이드" })

     칸이 문자열이면 그 id 를 찾는다. 없으면 아무 일도 하지 않는다.
     --------------------------------------------------------- */
  function strip(host, list, opt) {
    opt = opt || {};
    if (typeof host === "string") host = document.getElementById(host);
    if (!host || !list || !list.length) return;

    var html = '<div class="slidestrip">';
    if (opt.title !== false) {
      html += '<div class="slidestrip-h">🖼️ ' + (opt.title || "수업 슬라이드") +
              ' <span class="dim">— 누르면 크게 보입니다</span></div>';
    }
    html += '<div class="slidestrip-b">';
    list.forEach(function (n) {
      var m = meta(n);
      html += '<figure class="slidecard" data-slide="' + n + '" tabindex="0" role="button" ' +
              'aria-label="' + esc(m.t) + ' 크게 보기">' +
              '<img src="' + src(n) + '" alt="' + esc(m.t) + '" loading="lazy" decoding="async">' +
              '<figcaption><b>' + esc(m.t) + '</b>' +
              (m.c ? '<span>' + esc(m.c) + '</span>' : "") + '</figcaption>' +
              '</figure>';
    });
    html += "</div></div>";
    host.innerHTML = html;

    Array.prototype.forEach.call(host.querySelectorAll(".slidecard"), function (el) {
      el.addEventListener("click", function () { open(+el.getAttribute("data-slide"), list); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(+el.getAttribute("data-slide"), list); }
      });
    });
  }

  /* ---------------------------------------------------------
     크게 보기 — 화면 전체를 덮는다. ← → 로 넘기고 Esc 로 닫는다.
     --------------------------------------------------------- */
  var box = null, seq = [], at = 0;

  function open(n, list) {
    seq = (list && list.length) ? list.slice() : DATA.map(function (d) { return d.n; });
    at = Math.max(0, seq.indexOf(n));
    if (!box) build();
    box.hidden = false;
    document.body.style.overflow = "hidden";
    show();
    box.querySelector(".sv-close").focus();
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    document.body.style.overflow = "";
  }

  function move(d) {
    at = (at + d + seq.length) % seq.length;
    show();
  }

  function show() {
    var m = meta(seq[at]);
    box.querySelector(".sv-img").src = src(seq[at]);
    box.querySelector(".sv-img").alt = m.t;
    box.querySelector(".sv-t").textContent = m.t;
    box.querySelector(".sv-c").textContent = m.c || "";
    box.querySelector(".sv-n").textContent = (at + 1) + " / " + seq.length;
    box.querySelector(".sv-prev").hidden = seq.length < 2;
    box.querySelector(".sv-next").hidden = seq.length < 2;
  }

  function build() {
    box = document.createElement("div");
    box.className = "slideview";
    box.hidden = true;
    box.innerHTML =
      '<button class="sv-close" aria-label="닫기">✕</button>' +
      '<button class="sv-prev" aria-label="이전">‹</button>' +
      '<figure class="sv-fig">' +
      '<img class="sv-img" alt="">' +
      '<figcaption><b class="sv-t"></b><span class="sv-c"></span>' +
      '<em class="sv-n"></em></figcaption>' +
      "</figure>" +
      '<button class="sv-next" aria-label="다음">›</button>';
    document.body.appendChild(box);

    box.querySelector(".sv-close").addEventListener("click", close);
    box.querySelector(".sv-prev").addEventListener("click", function () { move(-1); });
    box.querySelector(".sv-next").addEventListener("click", function () { move(1); });
    /* 그림 바깥(어두운 곳)을 누르면 닫는다 */
    box.addEventListener("click", function (e) { if (e.target === box) close(); });

    document.addEventListener("keydown", function (e) {
      if (!box || box.hidden) return;
      if (e.key === "Escape") { close(); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { move(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { move(1); e.preventDefault(); }
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  global.Slides = { DATA: DATA, strip: strip, open: open, close: close, src: src, meta: meta };
})(window);
