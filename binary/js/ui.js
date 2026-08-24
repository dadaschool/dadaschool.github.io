/* =========================================================
   ui.js — 화면을 짧게 유지하는 공용 부품 두 개

   왜 필요한가 (2026-08-12 사용자 지시)
     참고한 원에듀(wonedu.org) 사이트는 설명·시뮬레이터·퀴즈를 **한 페이지에 다 쌓아**
     문서 높이가 12,900px 이나 된다. 좋은 점은 "시뮬레이터 하나당 한 화면"이라는 것이고,
     나쁜 점은 그것들을 세로로 이어 붙여 끝없이 스크롤해야 하는 것이다.
     → **좋은 점만** 가져온다 : 시뮬레이터는 한 화면에 담고, 화면 사이는 **탭으로** 넘긴다.

   ① UI.subTabs — ① 학습 탭 안에서 **시뮬레이터를 하나씩** 보여 준다.
   ② UI.pager   — 연습·평가에서 **문제를 하나씩** 보여 준다.
   ③ UI.josa    — 문제를 만들 때 낱말에 맞는 **조사**(은/는 · 이/가 …)를 붙인다.

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ⚠ 다섯 영역(basic·number·text·image·sound)이 이 파일을 함께 쓴다.
     여기를 고치면 다섯 화면이 같이 바뀐다 — 한쪽만 손대는 일이 없어진다.
   ========================================================= */
(function (global) {
  "use strict";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------------------------------------------------------
     ③ 조사 고르기 — `낱말 + 은/는` 을 문제 글에서 만들 때 쓴다

       왜 필요한가 : 문제를 **자동으로 만들면** 낱말이 그때그때 달라진다.
       `이름 + " 은"` 으로 붙여 두면 「소리 은」·「높이 은」·「16 KB 은」 처럼
       어색한 글이 학생에게 그대로 나간다(실제로 그렇게 나갔다).

       판단 기준은 **마지막 글자에 받침이 있는가** 하나다.
         · 한글 : 유니코드 계산으로 종성을 본다 (`(코드 - 44032) % 28`)
         · 숫자 : 읽는 소리로 본다 (0 영·1 일·3 삼·6 육·7 칠·8 팔 → 받침 있음)
         · 영문 : 읽는 소리로 본다 (L 엘·M 엠·N 엔·R 알 만 받침 있음)
     --------------------------------------------------------- */
  var DIGIT_JONG = { "0": 1, "1": 1, "3": 1, "6": 1, "7": 1, "8": 1 };   /* 영·일·삼·육·칠·팔 */
  var ALPHA_JONG = { L: 1, M: 1, N: 1, R: 1 };                            /* 엘·엠·엔·알 */

  function hasJong(word) {
    var s = String(word == null ? "" : word).replace(/[)\]}»”"'\s]+$/, "");
    if (!s) return false;
    var ch = s.slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return ((code - 0xAC00) % 28) !== 0;
    if (/[0-9]/.test(ch)) return !!DIGIT_JONG[ch];
    if (/[A-Za-z]/.test(ch)) return !!ALPHA_JONG[ch.toUpperCase()];
    return false;                     /* 기호로 끝나면 받침 없음으로 본다 */
  }

  /* 「ㄹ 받침」인가 — `으로/로` 만 규칙이 다르다. 받침이 ㄹ 이면 **「로」** 를 쓴다
     (연필로 · 1로 · 서울로). ㄹ 을 빼먹으면 「연필으로」 같은 글이 나간다. */
  var DIGIT_RIEUL = { "1": 1, "7": 1, "8": 1 };      /* 일 · 칠 · 팔 */
  var ALPHA_RIEUL = { L: 1, R: 1 };                  /* 엘 · 알 */

  function endsRieul(word) {
    var s = String(word == null ? "" : word).replace(/[)\]}»”"'\s]+$/, "");
    if (!s) return false;
    var ch = s.slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return ((code - 0xAC00) % 28) === 8;   /* 종성 ㄹ */
    if (/[0-9]/.test(ch)) return !!DIGIT_RIEUL[ch];
    if (/[A-Za-z]/.test(ch)) return !!ALPHA_RIEUL[ch.toUpperCase()];
    return false;
  }

  /* pair 는 "은는" · "이가" · "을를" · "과와" · "으로로" 처럼 **받침 있을 때 / 없을 때** 순서 */
  function josa(word, pair) {
    var p = String(pair || "은는");
    if (p === "으로로") return (hasJong(word) && !endsRieul(word)) ? "으로" : "로";
    return hasJong(word) ? p.charAt(0) : p.charAt(1);
  }

  /* 낱말과 조사를 붙여서 돌려준다 — `UI.with("소리", "은는")` → `"소리는"` */
  function withJosa(word, pair) { return word + josa(word, pair); }

  /* ---------------------------------------------------------
     ① 하위 탭 — 시뮬레이터 고르기

       barEl : 단추를 담을 빈 요소
       spec  : [{ key, label, cards: ['카드id', ...], note }]
               한 화면이 카드 여러 장일 수 있고, 카드를 여러 탭이 함께 쓸 수도 있다
               (예 : 소리의 표·그래프 카드는 A→D 와 D→A 가 같이 쓴다).
       opts  : { onChange(key), initial }

       돌려주는 것 : { go(key), current() }
     --------------------------------------------------------- */
  function subTabs(barEl, spec, opts) {
    opts = opts || {};
    if (!barEl) return { go: function () {}, current: function () { return null; } };
    barEl.innerHTML = "";
    barEl.setAttribute("role", "tablist");
    if (!barEl.getAttribute("aria-label")) barEl.setAttribute("aria-label", "시뮬레이터 고르기");

    /* 이 묶음이 다루는 카드 전체 — 고르지 않은 카드는 숨긴다 */
    var allCards = [];
    spec.forEach(function (s) {
      (s.cards || []).forEach(function (id) {
        if (allCards.indexOf(id) === -1) allCards.push(id);
      });
    });

    var btns = [];
    var cur = null;

    function show(key, focus) {
      var picked = null;
      spec.forEach(function (s) { if (s.key === key) picked = s; });
      if (!picked) return;
      cur = key;

      var on = picked.cards || [];
      allCards.forEach(function (id) {
        var c = document.getElementById(id);
        if (c) c.hidden = (on.indexOf(id) === -1);
      });

      btns.forEach(function (b) {
        var sel = (b.dataset.sub === key);
        b.classList.toggle("on", sel);
        b.setAttribute("aria-selected", sel ? "true" : "false");
        b.tabIndex = sel ? 0 : -1;
        if (sel && focus) b.focus();
      });

      if (opts.onChange) opts.onChange(key, picked);
    }

    spec.forEach(function (s, i) {
      var b = el("button", "subtab", s.label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.sub = s.key;
      b.addEventListener("click", function () { show(s.key, false); });
      b.addEventListener("keydown", function (e) {
        var k = null;
        if (e.key === "ArrowRight") k = spec[(i + 1) % spec.length].key;
        else if (e.key === "ArrowLeft") k = spec[(i - 1 + spec.length) % spec.length].key;
        else if (e.key === "Home") k = spec[0].key;
        else if (e.key === "End") k = spec[spec.length - 1].key;
        if (k) { e.preventDefault(); show(k, true); }
      });
      barEl.appendChild(b);
      btns.push(b);
    });

    /* 주소에 `#sim=키` 가 있으면 그 화면부터 연다.
       복습 화면(`review.html`)의 「복습하기」 단추가 곧바로 그 시뮬레이터로 보내려고 쓴다 —
       `sound.html#sim=cmp` 처럼. 없는 키면 조용히 무시하고 첫 화면을 연다.
       ⚠ 다섯 영역이 이 함수를 함께 쓰므로 여기 한 곳만 있으면 모든 페이지가 된다. */
    function fromHash() {
      var m = String(location.hash || "").match(/sim=([A-Za-z0-9_-]+)/);
      if (!m) return null;
      var found = spec.filter(function (s) { return s.key === m[1]; })[0];
      return found ? found.key : null;
    }

    show(fromHash() || opts.initial || spec[0].key, false);
    /* 같은 페이지 안에서 주소만 바뀌어도 따라간다 */
    window.addEventListener("hashchange", function () {
      var k = fromHash();
      if (k) show(k, false);
    });
    return { go: function (k) { show(k, false); }, current: function () { return cur; } };
  }

  /* ---------------------------------------------------------
     ② 문제 넘기기 — 한 번에 한 문제만

       barEl  : 넘기기 단추를 담을 빈 요소
       panels : [{ el, label, short }]  el 은 보이거나 숨을 요소
                마지막에 「전체 확인」 같은 요약 화면을 넣어도 된다.
       opts   : { onChange(i, panel), lead }

       돌려주는 것 : { go(i), index(), count }
     --------------------------------------------------------- */
  function pager(barEl, panels, opts) {
    opts = opts || {};
    if (!barEl || !panels || !panels.length) {
      return { go: function () {}, index: function () { return 0; }, count: 0 };
    }
    barEl.innerHTML = "";
    var idx = 0;
    var prev = el("button", "btn pagerbtn", "◀ 이전");
    var next = el("button", "btn pagerbtn", "다음 ▶");
    prev.type = next.type = "button";

    var nums = el("span", "pagernums");
    var numBtns = panels.map(function (p, i) {
      var b = el("button", "btn pagernum", p.short || p.label);
      b.type = "button";
      b.setAttribute("aria-label", p.label);
      b.addEventListener("click", function () { go(i); });
      nums.appendChild(b);
      return b;
    });

    function go(i, focusIt) {
      if (i < 0 || i >= panels.length) return;
      idx = i;
      panels.forEach(function (p, k) { if (p.el) p.el.hidden = (k !== i); });
      numBtns.forEach(function (b, k) {
        var on = (k === i);
        b.classList.toggle("on", on);
        b.setAttribute("aria-current", on ? "true" : "false");
      });
      prev.disabled = (i === 0);
      next.disabled = (i === panels.length - 1);
      /* 넘길 때마다 그 화면의 맨 위가 보이게 — 아래쪽을 보고 있었다면 올려 준다 */
      if (focusIt && panels[i].el) {
        var r = panels[i].el.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.6) {
          panels[i].el.scrollIntoView({ block: "start" });
        }
      }
      if (opts.onChange) opts.onChange(i, panels[i]);
    }

    prev.addEventListener("click", function () { go(idx - 1, true); });
    next.addEventListener("click", function () { go(idx + 1, true); });

    barEl.appendChild(prev);
    barEl.appendChild(nums);
    barEl.appendChild(next);
    if (opts.lead) barEl.appendChild(el("span", "pagerlead", opts.lead));

    go(0, false);
    return { go: function (i) { go(i, true); }, index: function () { return idx; }, count: panels.length };
  }

  global.UI = { subTabs: subTabs, pager: pager, josa: josa, withJosa: withJosa, hasJong: hasJong };
})(window);
