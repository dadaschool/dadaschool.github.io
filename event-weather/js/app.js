/**
 * app.js — 화면을 움직이는 곳
 *
 * 🔴 이 앱이 절대 하지 않는 것
 *   ① 열하루 뒤 이후를 «예보» 라고 말하지 않는다 (그런 것은 존재하지 않는다)
 *   ② 「이 날로 하세요」 라고 정해 주지 않는다 — 정하는 것은 사람이다
 *   ③ 표본 수를 감추지 않는다 — 「27%」 가 아니라 「30년 중 8번」
 *   ④ 결측을 0 으로 세지 않는다 (stat.js 가 막지만 화면도 «자료가 있는 N년» 이라 적는다)
 *   ⑤ «가짜» 자료를 진짜인 척 보여 주지 않는다 (지울 수 없는 빨간 띠)
 */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var 만들 = function (태그, 클래스, 글) {
    var e = document.createElement(태그);
    if (클래스) e.className = 클래스;
    if (글 != null) e.textContent = 글;
    return e;
  };

  /* ── 행사마다 무엇을 보나 ────────────────────────────────
     🔴 «나쁜 날씨» 의 뜻이 행사마다 다르다. 하나로 뭉치면 안 된다. */
  var 행사들 = {
    운동회: {
      기간: false,
      줄: ["비", "큰비", "더위", "강풍", "최고", "최저"],
      말: "운동장에서 하루 종일 — 비와 더위(온열질환), 천막을 날리는 바람을 봅니다."
    },
    소풍: {
      기간: false,
      줄: ["비", "큰비", "강풍", "최고", "최저"],
      말: "걸어 다니는 하루 — 비와 바람을 봅니다. 가는 곳이 다르면 «행선지» 를 따로 고르세요."
    },
    야영: {
      기간: true,
      줄: ["내내맑음", "하루라도비", "이틀이상비", "큰비", "밤최저", "낮최고"],
      말: "여러 날을 이어서 — 사흘을 «실제로» 들여다보고, 밤 추위도 함께 봅니다."
    }
  };

  /* 줄마다 «이름 · 어느 쪽이 좋은가 · 어떤 값인가».
     🔴 «좋은쪽» 이 필요한 까닭 : 막대가 길면 좋은 줄(내내 비 없음)과 나쁜 줄
        (하루라도 비)이 섞여 있다. 색으로 갈라 두지 않으면 «막대가 길다 = 좋다» 로
        잘못 읽는다. 초록 막대는 좋은 쪽, 주황 막대는 나쁜 쪽이다. */
  var 줄뜻 = {
    비:        { 이름: "비 온 날",      좋은쪽: "낮을수록", 꼴: "비율" },
    큰비:      { 이름: "큰비",          좋은쪽: "낮을수록", 꼴: "비율" },
    더위:      { 이름: "더위",          좋은쪽: "낮을수록", 꼴: "비율" },
    강풍:      { 이름: "강풍",          좋은쪽: "낮을수록", 꼴: "비율" },
    최고:      { 이름: "낮 최고기온",   좋은쪽: null,       꼴: "온도" },
    최저:      { 이름: "밤 최저기온",   좋은쪽: null,       꼴: "온도" },
    내내맑음:   { 이름: "내내 비 없음",  좋은쪽: "높을수록", 꼴: "비율" },
    하루라도비: { 이름: "하루라도 비",   좋은쪽: "낮을수록", 꼴: "비율" },
    이틀이상비: { 이름: "이틀 이상 비",  좋은쪽: "낮을수록", 꼴: "비율" },
    밤최저:    { 이름: "가장 추운 밤",  좋은쪽: null,       꼴: "온도" },
    낮최고:    { 이름: "가장 더운 낮",  좋은쪽: null,       꼴: "온도" }
  };
  function 줄이름의(열쇠) { return (줄뜻[열쇠] && 줄뜻[열쇠].이름) || 열쇠; }

  /* ── 지금 고른 것 ───────────────────────────────────────── */
  var 상태 = {
    행사: "운동회",
    지점: null,        // 번호
    행선지: null,      // 번호 (소풍에서만)
    날짜: [],          // "YYYY-MM-DD"
    일수: 3,
    짚은것: 0,         // 상세로 펼쳐 볼 후보 번호
    기준: { 비: 1, 큰비: 20, 더위: 33, 추위: 0, 강풍: 14 },
    폭: 3, 최근: 10,
    예보: { 키: null, 담음: {}, 부르는중: false }   // 담음 : "nx,ny,기준" → 결과
  };
  var 저장열쇠 = "event-weather.설정";

  function 저장() {
    try {
      localStorage.setItem(저장열쇠, JSON.stringify({
        행사: 상태.행사, 지점: 상태.지점, 일수: 상태.일수,
        기준: 상태.기준, 폭: 상태.폭, 최근: 상태.최근
      }));
    } catch (e) { /* 비밀 창이면 저장이 막힌다 — 그래도 앱은 돌아간다 */ }
  }
  function 불러오기() {
    try {
      var 것 = JSON.parse(localStorage.getItem(저장열쇠) || "null");
      if (!것) return;
      if (것.행사 && 행사들[것.행사]) 상태.행사 = 것.행사;
      if (것.지점) 상태.지점 = Number(것.지점);
      if (것.일수) 상태.일수 = Number(것.일수);
      if (것.폭 != null) 상태.폭 = Number(것.폭);
      if (것.최근) 상태.최근 = Number(것.최근);
      if (것.기준) for (var k in 상태.기준) if (것.기준[k] != null) 상태.기준[k] = Number(것.기준[k]);
    } catch (e) {}
  }

  /* ── 날짜 다루기 ────────────────────────────────────────── */
  var 요일글 = ["일", "월", "화", "수", "목", "금", "토"];
  function 날쪼개기(글) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(글 || ""));
    if (!m) return null;
    return { 해: +m[1], 월: +m[2], 일: +m[3] };
  }
  function 날꾸미기(글, 일수) {
    var d = 날쪼개기(글); if (!d) return "";
    var 요일 = 요일글[new Date(Date.UTC(d.해, d.월 - 1, d.일)).getUTCDay()];
    var 앞 = d.월 + "월 " + d.일 + "일(" + 요일 + ")";
    if (!일수 || 일수 < 2) return 앞;
    var 끝 = new Date(Date.UTC(d.해, d.월 - 1, d.일) + (일수 - 1) * 86400000);
    return 앞 + " ~ " + (끝.getUTCMonth() + 1) + "월 " + 끝.getUTCDate() + "일";
  }
  /** 오늘부터 며칠 뒤인가 (예보가 있는 기간인지 알려면 필요하다) */
  function 며칠뒤(글) {
    var d = 날쪼개기(글); if (!d) return null;
    var 오늘 = new Date();
    var 오늘UTC = Date.UTC(오늘.getFullYear(), 오늘.getMonth(), 오늘.getDate());
    return Math.round((Date.UTC(d.해, d.월 - 1, d.일) - 오늘UTC) / 86400000);
  }

  /* ── 신호 정하기 ────────────────────────────────────────
     🔴 신호는 «훑어보기» 를 도우려는 것이고, 결정하라는 것이 아니다.
        그래서 신호 옆에 근거 숫자를 언제나 함께 그린다. */
  /**
   * 한눈에 볼 신호를 정한다.
   *
   * 🔴 **예보가 있으면 예보가 이긴다.**
   *    30년 통계는 «그 무렵이 대개 어떤가» 이고, 예보는 «이번에 어떤가» 다.
   *    사흘 뒤 일을 30년 평균으로 «조심» 이라고 하면 안 된다 —
   *    실제로 비가 안 온다는데 빨간불이 뜨는 일이 있었다(사용자 지적).
   *
   * 🔴 다만 **무엇을 근거로 한 신호인지 반드시 밝힌다.**
   *    말없이 근거가 바뀌면 «왜 초록이지?» 를 알 수 없다.
   *      예보 기준   기간을 예보가 다 덮을 때
   *      예보+통계   기간의 일부만 덮을 때 → **둘 중 나쁜 쪽**을 쓴다
   *                  (사흘 중 마지막 날에 비가 잦은데 «무난» 이라고 하면 안 된다)
   *      통계 기준   예보가 없을 때
   */
  function 신호정하기(요약, 구간, 예보, 덮는일수, 필요한일수) {
    var 빛들 = [{ 빛: "초록", 글: "무난" }, { 빛: "노랑", 글: "살핌" }, { 빛: "빨강", 글: "조심" }];

    function 통계로() {
      var 위험 = 0;
      function 올림(값, 노랑금, 빨강금) {
        if (값 == null) return;
        if (값 >= 빨강금) 위험 = Math.max(위험, 2);
        else if (값 >= 노랑금) 위험 = Math.max(위험, 1);
      }
      if (구간) {
        올림(구간.하루라도비.비율, 0.34, 0.50);
        올림(구간.큰비.비율, 0.10, 0.20);
      } else if (요약) {
        올림(요약.비.비율, 0.25, 0.40);
        올림(요약.큰비.비율, 0.07, 0.15);
        if (상태.행사 === "운동회") 올림(요약.더위.비율, 0.15, 0.30);
        올림(요약.강풍.비율, 0.10, 0.20);
      }
      return 위험;
    }

    function 예보로(f) {
      var 위험 = 0;
      function 올림(값, 노랑금, 빨강금) {
        if (값 == null) return;
        if (값 >= 빨강금) 위험 = Math.max(위험, 2);
        else if (값 >= 노랑금) 위험 = Math.max(위험, 1);
      }
      올림(f.강수확률, 30, 60);
      올림(f.총강수, 5, 20);
      // 비·눈이 오리라고 콕 집어 말한 날은 적어도 «살핌»
      if (f.강수형태) 위험 = Math.max(위험, 1);
      if (상태.행사 === "운동회" || 상태.행사 === "소풍") {
        올림(f.최고, 상태.기준.더위 - 2, 상태.기준.더위);
      }
      올림(f.최대풍속, 9, 상태.기준.강풍);
      // 야영은 밤 추위도 본다 (기준보다 낮으면 빨강)
      if (상태.행사 === "야영" && f.최저 != null && f.최저 <= 상태.기준.추위) 위험 = 2;
      return 위험;
    }

    if (!예보) {
      var 것 = 빛들[통계로()];
      return { 빛: 것.빛, 글: 것.글, 근거: "통계", 근거글: "통계 기준" };
    }

    var 다덮나 = !덮는일수 || !필요한일수 || 덮는일수 >= 필요한일수;
    var 위험 = 다덮나 ? 예보로(예보) : Math.max(예보로(예보), 통계로());
    var 난것 = 빛들[위험];
    return {
      빛: 난것.빛, 글: 난것.글,
      근거: 다덮나 ? "예보" : "예보+통계",
      근거글: 다덮나 ? "예보 기준"
                     : "예보 " + 덮는일수 + "일 + 나머지는 통계"
    };
  }

  /* ── 숫자 꾸미기 ────────────────────────────────────────
     🔴 «표본 수» 를 반드시 함께 낸다. 「27%」 만 있으면 사람이 판단할 수 없다. */
  /**
   * 비율 칸 — 막대 + 숫자 + 표본을 **한 줄**에.
   *
   * 🔴 왜 막대인가 : 「43%」와 「33%」를 숫자로 견주려면 읽고 셈해야 한다.
   *    막대는 눈으로 바로 갈린다. 후보를 다섯 개 놓으면 차이가 더 크다.
   * 🔴 왜 색을 나누나 : «내내 비 없음» 은 길수록 좋고 «하루라도 비» 는 길수록 나쁘다.
   *    한 색이면 «막대가 길다 = 좋다» 로 잘못 읽는다.
   * 🔴 표본 수는 여전히 **반드시** 함께 낸다. 다만 두 줄로 늘리지 않고 옆에 붙인다.
   */
  function 셈칸(것, 뒷말, 좋은쪽) {
    var 칸 = 만들("div", "셀");
    if (!것 || !것.표본) {
      칸.appendChild(만들("span", "없음", "자료 없음"));
      return 칸;
    }
    var 비율 = 것.비율 || 0;
    var 좋나 = 좋은쪽 === "높을수록" ? 비율 >= 0.5 : 비율 < 0.34;

    // 🔴 막대를 값 «뒤» 에 깔았다. 위에 따로 두면 줄이 하나 더 생겨
    //    표가 통째로 길어진다(줄마다 12px = 여섯 줄이면 72px).
    var 막 = 만들("div", "막대 " + (좋나 ? "좋음" : (비율 >= 0.6 ? "나쁨" : "보통")));
    막.style.width = Math.max(3, Math.round(비율 * 100)) + "%";
    칸.appendChild(막);
    칸.classList.add("막대깔림");

    var 값줄 = 만들("div", "값줄");
    값줄.appendChild(만들("b", "값", Math.round(비율 * 100) + "%"));
    값줄.appendChild(만들("span", "표본", 것.셈 + " / " + 것.표본 + (뒷말 || "일")));
    칸.appendChild(값줄);
    return 칸;
  }

  /** 온도·수치 칸 — 평균을 크게, 범위를 옆에 작게 */
  function 값칸(것, 단위, 자릿수) {
    var 칸 = 만들("div", "셀");
    if (!것 || !것.표본 || 것.평균 == null) {
      칸.appendChild(만들("span", "없음", "자료 없음"));
      return 칸;
    }
    var 값줄 = 만들("div", "값줄 온도줄");
    값줄.appendChild(만들("b", "값", 것.평균.toFixed(자릿수 == null ? 1 : 자릿수) + 단위));
    값줄.appendChild(만들("span", "표본",
      것.최소.toFixed(0) + "~" + 것.최대.toFixed(0) + 단위 + " · " + 것.표본 + "일"));
    칸.appendChild(값줄);
    return 칸;
  }

  /** 기간 모드의 평균 온도 칸 */
  function 기간온도칸(평균, 표본) {
    var 칸 = 만들("div", "셀");
    if (평균 == null) { 칸.appendChild(만들("span", "없음", "자료 없음")); return 칸; }
    var 값줄 = 만들("div", "값줄 온도줄");
    값줄.appendChild(만들("b", "값", 평균.toFixed(1) + "℃"));
    값줄.appendChild(만들("span", "표본", 표본 + "해 평균"));
    칸.appendChild(값줄);
    return 칸;
  }

  /* ── 셈하기 ─────────────────────────────────────────────── */
  /** 후보 하나를 셈한다. @return { 날, 요약, 구간, 견줌, 신호 } 또는 null */
  function 후보셈(표, 날글) {
    var d = 날쪼개기(날글); if (!d) return null;
    var 기간 = 행사들[상태.행사].기간;
    var 뜻 = { 월: d.월, 일: d.일, 폭: 상태.폭, 기준: 상태.기준 };

    var 요약 = null, 구간 = null, 견줌 = null;
    if (기간) {
      구간 = Stat.구간(표, { 월: d.월, 일: d.일, 일수: 상태.일수, 기준: 상태.기준 });
    } else {
      견줌 = Stat.견주기(표, { 월: d.월, 일: d.일, 폭: 상태.폭, 기준: 상태.기준, 최근: 상태.최근 });
      요약 = 견줌.온통;
    }
    var 것 = {
      날: 날글, 요약: 요약, 구간: 구간, 견줌: 견줌, 며칠뒤: 며칠뒤(날글)
    };
    // 🔴 예보가 있으면 그것을 근거로 신호를 매긴다 (통계보다 예보가 이긴다)
    var f = 예보값(것);
    것.예보 = f;
    것.신호 = 신호정하기(요약, 구간, f, f ? f.일수 : 0, 기간 ? 상태.일수 : 1);
    return 것;
  }

  /* ── 비교표 그리기 ──────────────────────────────────────── */
  function 비교그리기(표, 후보들) {
    var 집 = $("비교");
    집.textContent = "";

    if (!표) {
      var 빔 = 만들("div", "빈결과");
      빔.appendChild(만들("p", null, "먼저 왼쪽에서 관측지점을 골라 주세요."));
      집.appendChild(빔);
      return;
    }
    var 쓸것 = 후보들.filter(function (c) { return c; });
    if (!쓸것.length) {
      var 빔2 = 만들("div", "빈결과");
      빔2.appendChild(만들("p", null, "왼쪽에서 후보 날짜를 넣어 주세요."));
      빔2.appendChild(만들("p", "꼬리말", "둘 이상 넣으면 나란히 견주어 볼 수 있습니다."));
      집.appendChild(빔2);
      return;
    }

    var 기간 = 행사들[상태.행사].기간;
    var 겉 = 만들("div", "비교집");
    var 표틀 = 만들("table", "비교");

    // 머리 — 날짜
    var thead = 만들("thead"), 머리줄 = 만들("tr");
    머리줄.appendChild(만들("th", "항목", 기간 ? "기간" : "후보 날짜"));
    쓸것.forEach(function (c, i) {
      var th = 만들("th");
      th.appendChild(document.createTextNode(날꾸미기(c.날, 기간 ? 상태.일수 : 0)));
      var 밑 = 만들("span", "요일");
      // 열흘 안쪽이면 «예보를 볼 수 있는 기간» 이라고 알려 준다
      // 🔴 «예보를 함께 보세요» 라고만 적으면 D−7 에도 예보가 있는 줄 안다.
      //    지금 있는 것은 단기예보(사흘 뒤까지)뿐이므로 그대로 적는다.
      var d = c.며칠뒤;
      밑.textContent =
        d == null ? "과거 통계만"
        : d < 0 ? "지난 날"
        : c.예보 ? "D−" + d + " · 예보 있음"
        : d <= 10 ? "D−" + d + " · 예보는 아직 (중기예보 준비 중)"
        : "과거 통계만";
      th.appendChild(밑);
      머리줄.appendChild(th);
    });
    thead.appendChild(머리줄);
    표틀.appendChild(thead);

    var tbody = 만들("tbody");

    // 신호 줄
    var 신호줄 = 만들("tr");
    신호줄.appendChild(만들("th", "항목", "한눈에"));
    쓸것.forEach(function (c) {
      var td = 만들("td");
      td.appendChild(만들("span", "신호 " + c.신호.빛, c.신호.글));
      // 🔴 말없이 근거가 바뀌면 «왜 초록이지?» 를 알 수 없다. 반드시 적는다.
      td.appendChild(만들("span", "근거 " + (c.신호.근거 === "통계" ? "통계근거" : "예보근거"),
                          c.신호.근거글));
      신호줄.appendChild(td);
    });
    tbody.appendChild(신호줄);

    /* ── 🌦 예보 줄 ─────────────────────────────────────────
       🔴 예보가 있는 후보에만 값이 들어가고, 나머지 칸은 «—» 다.
          «예보» 와 «과거 통계» 를 한 표에 두되 **가름줄로 확실히 갈라** 둔다.
          섞여 보이면 열흘 뒤 통계를 예보로 읽는 사고가 난다. */
    var 예보들 = 쓸것.map(예보값);
    var 예보있나 = 예보들.some(function (f) { return f; });

    if (예보있나) {
      var 가름1 = 만들("tr", "가름 예보가름");
      var 가th = 만들("th", "항목", "🌦 예보");
      가th.colSpan = 1;
      가름1.appendChild(가th);
      쓸것.forEach(function (c, i) {
        var td = 만들("td", "가름말");
        td.textContent = 예보들[i]
          ? (예보들[i].일수 > 1 ? 예보들[i].일수 + "일치 예보" : "예보 있음")
          : "예보 없음";
        가름1.appendChild(td);
      });
      tbody.appendChild(가름1);

      [
        ["강수확률", function (f) { return f.강수확률 == null ? null : f.강수확률 + "%"; },
                     function (f) { return f.강수확률 >= 60; }],
        ["예상 강수량", function (f) { return f.총강수 > 0 ? f.총강수 + "mm" : "없음"; },
                       function (f) { return f.총강수 >= 20; }],
        ["하늘", function (f) { return (f.하늘 || "—") + (f.강수형태 ? " · " + f.강수형태 : ""); },
                 function (f) { return !!f.강수형태; }],
        ["기온", function (f) {
                   return (f.최저 == null ? "—" : f.최저 + "°") + " ~ " +
                          (f.최고 == null ? "—" : f.최고 + "°"); },
                 function (f) { return f.최고 != null && f.최고 >= 상태.기준.더위; }],
        ["바람", function (f) { return f.최대풍속 == null ? null : f.최대풍속 + "m/s"; },
                 function (f) { return f.최대풍속 >= 9; }]
      ].forEach(function (줄) {
        var tr = 만들("tr", "예보줄자리");
        tr.appendChild(만들("th", "항목", 줄[0]));
        쓸것.forEach(function (c, i) {
          var f = 예보들[i];
          var td = 만들("td");
          if (!f) { td.appendChild(만들("span", "없음", "—")); }
          else {
            var 값 = 줄[1](f);
            if (값 == null) td.appendChild(만들("span", "없음", "—"));
            else td.appendChild(만들("span", "예보값" + (줄[2](f) ? " 센값" : ""), 값));
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    /* ── 📊 과거 통계 줄 ────────────────────────────────── */
    var 해수 = Object.keys(표.해).length;
    var 가름2 = 만들("tr", "가름 통계가름");
    가름2.appendChild(만들("th", "항목", "📊 과거 " + 해수 + "해"));
    쓸것.forEach(function () {
      가름2.appendChild(만들("td", "가름말",
        기간 ? "그 기간을 해마다 셈" : "그 무렵 ±" + 상태.폭 + "일"));
    });
    tbody.appendChild(가름2);

    // 항목 줄들
    행사들[상태.행사].줄.forEach(function (열쇠) {
      var tr = 만들("tr");
      tr.appendChild(만들("th", "항목", 줄이름의(열쇠)));
      쓸것.forEach(function (c) {
        var td = 만들("td");
        td.appendChild(칸그리기(열쇠, c));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // 자세히 보기
    var 더 = 만들("tr");
    더.appendChild(만들("th", "항목", ""));
    쓸것.forEach(function (c, i) {
      var td = 만들("td");
      var b = 만들("button", "작은단추", 상태.짚은것 === i ? "▾ 닫기" : "자세히");
      b.addEventListener("click", function () {
        상태.짚은것 = (상태.짚은것 === i) ? -1 : i;
        다시그리기();
      });
      td.appendChild(b);
      더.appendChild(td);
    });
    tbody.appendChild(더);

    표틀.appendChild(tbody);
    겉.appendChild(표틀);
    집.appendChild(겉);

    // 🔴 앱이 정해 주지 않는다는 것을 적어 둔다
    var 말 = 만들("div", "정하기");
    말.appendChild(만들("b", null, "이 앱은 날짜를 정해 주지 않습니다. "));
    말.appendChild(document.createTextNode(
      행사들[상태.행사].말 +
      " 신호는 훑어보기를 돕는 것일 뿐이고, 판단의 근거는 옆의 숫자와 표본 수입니다."));
    집.appendChild(말);
  }

  /** 한 칸 그리기 */
  function 칸그리기(열쇠, c) {
    var 요 = c.요약, 구 = c.구간;
    var 좋 = (줄뜻[열쇠] || {}).좋은쪽;
    switch (열쇠) {
      case "비":   return 셈칸(요.비, null, 좋);
      case "큰비": return 구 ? 셈칸(구.큰비, "해", 좋) : 셈칸(요.큰비, null, 좋);
      case "더위": return 셈칸(요.더위, null, 좋);
      case "강풍": return 셈칸(요.강풍, null, 좋);
      case "최고": return 값칸(요.최고, "℃");
      case "최저": return 값칸(요.최저, "℃");
      case "내내맑음":   return 셈칸(구.내내맑음, "해", 좋);
      case "하루라도비": return 셈칸(구.하루라도비, "해", 좋);
      case "이틀이상비": return 셈칸(구.이틀이상비, "해", 좋);
      case "밤최저": return 기간온도칸(구.평균최저, 구.표본);
      case "낮최고": return 기간온도칸(구.평균최고, 구.표본);
    }
    return document.createTextNode("");
  }

  /* ── 상세 그리기 ────────────────────────────────────────── */
  function 상세그리기(표, 후보들) {
    var 집 = $("상세");
    집.textContent = "";
    var c = 후보들[상태.짚은것];
    if (!표 || !c) return;

    var 기간 = 행사들[상태.행사].기간;
    var 칸 = 만들("div", "상세칸");
    칸.appendChild(만들("h3", null, 날꾸미기(c.날, 기간 ? 상태.일수 : 0) + " 를 자세히"));

    var 어디 = 만들("p", "어디언제");
    어디.textContent = 표.이름 + " 관측소 · " + 표.시작 + "~" + 표.끝 + "년 자료" +
      (기간 ? " · " + 상태.일수 + "일 이어서 봄"
            : " · 앞뒤 " + 상태.폭 + "일까지 함께 봄");
    칸.appendChild(어디);

    if (기간) 기간상세(칸, c);
    else 하루상세(칸, c);

    집.appendChild(칸);
  }

  /** 야영 — 해마다 그 며칠이 어땠는지 한 줄로 늘어놓는다 */
  function 기간상세(칸, c) {
    var 구 = c.구간;
    칸.appendChild(만들("p", "꼬리말",
      "해마다 그 " + 구.일수 + "일을 «실제로» 들여다본 것입니다. " +
      "하루 확률을 곱해서 낸 값이 아닙니다 — 날씨는 하루하루가 따로 놀지 않아 곱하면 실제보다 낮게 나옵니다."));

    var 줄 = 만들("div", "해줄");
    구.해마다.forEach(function (해것) {
      var 칸하나 = 만들("div", "해칸" +
        (!해것.온전 ? " 빔" : 해것.큰비 ? " 큰비" : 해것.비온날 > 0 ? " 비옴" : ""));
      칸하나.appendChild(만들("b", null, String(해것.해).slice(2)));
      칸하나.appendChild(document.createTextNode(
        !해것.온전 ? "자료없음"
        : 해것.비온날 === 0 ? "맑음"
        : 해것.비온날 + "일 " + Math.round(해것.총강수) + "mm"));
      줄.appendChild(칸하나);
    });
    칸.appendChild(줄);

    var 보기 = 만들("div", "보기줄");
    보기.appendChild(만들("span", "b4", "비 없음"));
    보기.appendChild(만들("span", "b1", "비"));
    보기.appendChild(만들("span", "b2", "큰비(" + 상태.기준.큰비 + "mm 이상)"));
    보기.appendChild(만들("span", "b3", "자료 없음 — 셈에서 뺐습니다"));
    칸.appendChild(보기);

    if (구.뺀해) {
      칸.appendChild(만들("p", "꼬리말",
        "⚠ 자료가 빠진 해가 " + 구.뺀해 + "번 있어 그 해는 통째로 뺐습니다. " +
        "반쪽 자료로 「내내 맑았다」 를 말할 수 없기 때문입니다."));
    }
  }

  /** 운동회·소풍 — 30년과 최근 N년을 나란히 */
  function 하루상세(칸, c) {
    var 견 = c.견줌;
    if (!견) return;

    var 견줌칸 = 만들("div", "견줌");
    [["온통", 견.온통, 견.온통기간], ["요새", 견.요새, 견.요새기간]].forEach(function (한쌍) {
      var 이름 = 한쌍[0] === "온통" ? "지난 " + (견.온통기간[1] - 견.온통기간[0] + 1) + "년"
                                    : "최근 " + (견.요새기간[1] - 견.요새기간[0] + 1) + "년";
      var 것 = 한쌍[1], 기간 = 한쌍[2];
      var d = 만들("div");
      d.appendChild(만들("h4", null, 이름 + " (" + 기간[0] + "~" + 기간[1] + ")"));
      var v = 만들("p", "값");
      v.textContent = "비 " + (것.비.비율 == null ? "—" : Math.round(것.비.비율 * 100) + "%") +
                      " · 최고 " + (것.최고.평균 == null ? "—" : 것.최고.평균.toFixed(1) + "℃");
      d.appendChild(v);
      d.appendChild(만들("p", "표본", "자료 있는 " + 것.비.표본 + "일 중 " + 것.비.셈 + "번 비"));
      견줌칸.appendChild(d);
    });
    칸.appendChild(견줌칸);

    // 🔴 «요새가 더 덥다» 를 눈에 보이게 — 30년 평균만 보면 기온을 낮게 잡는다
    if (견.온통.최고.평균 != null && 견.요새.최고.평균 != null) {
      var 차 = 견.요새.최고.평균 - 견.온통.최고.평균;
      var 말 = 만들("p", "차이" + (차 >= 0.5 ? " 더움" : ""));
      말.className = "꼬리말 안내";
      말.textContent = 차 >= 0.5
        ? "🔴 최근이 " + 차.toFixed(1) + "℃ 더 덥습니다. 30년 평균만 보면 더위를 낮게 잡게 됩니다."
        : (차 <= -0.5 ? "최근이 " + (-차).toFixed(1) + "℃ 서늘합니다."
                      : "최근과 30년 평균이 거의 같습니다(" + 차.toFixed(1) + "℃ 차이).");
      칸.appendChild(말);
    }

    // 낱낱 표
    var 표 = 만들("table", "낱낱");
    var thead = 만들("thead"), tr = 만들("tr");
    ["", "지난 " + (견.온통기간[1] - 견.온통기간[0] + 1) + "년", "최근 " + (견.요새기간[1] - 견.요새기간[0] + 1) + "년"]
      .forEach(function (h) { tr.appendChild(만들("th", null, h)); });
    thead.appendChild(tr); 표.appendChild(thead);

    var tbody = 만들("tbody");
    [
      ["비 온 날", function (s) { return s.비; }, "%"],
      ["큰비(" + 상태.기준.큰비 + "mm↑)", function (s) { return s.큰비; }, "%"],
      ["더위(" + 상태.기준.더위 + "℃↑)", function (s) { return s.더위; }, "%"],
      ["강풍(" + 상태.기준.강풍 + "m/s↑)", function (s) { return s.강풍; }, "%"]
    ].forEach(function (줄) {
      var r = 만들("tr");
      r.appendChild(만들("th", null, 줄[0]));
      [견.온통, 견.요새].forEach(function (s) {
        var 것 = 줄[1](s);
        r.appendChild(만들("td", null,
          !것.표본 ? "자료 없음"
          : Math.round(것.비율 * 100) + "% (" + 것.셈 + "/" + 것.표본 + ")"));
      });
      tbody.appendChild(r);
    });
    [["낮 최고", "최고"], ["밤 최저", "최저"]].forEach(function (줄) {
      var r = 만들("tr");
      r.appendChild(만들("th", null, 줄[0]));
      [견.온통, 견.요새].forEach(function (s) {
        var 것 = s[줄[1]];
        r.appendChild(만들("td", null, 것.평균 == null ? "자료 없음"
          : 것.평균.toFixed(1) + "℃ (" + 것.최소.toFixed(0) + "~" + 것.최대.toFixed(0) + ")"));
      });
      tbody.appendChild(r);
    });
    표.appendChild(tbody);
    칸.appendChild(표);
  }

  /* ── 다시 그리기 ────────────────────────────────────────── */
  var 지금표 = null;

  function 다시그리기() {
    기준요약쓰기();
    var 후보들 = 상태.날짜.map(function (날) {
      return 지금표 ? 후보셈(지금표, 날) : null;
    }).filter(function (c) { return c; });

    if (상태.짚은것 >= 후보들.length) 상태.짚은것 = 후보들.length ? 0 : -1;
    비교그리기(지금표, 후보들);
    상세그리기(지금표, 후보들);
    예보챙기기();
    $("가짜띠").hidden = !(지금표 && 지금표.가짜);
  }

  function 기준요약쓰기() {
    $("기준지금").textContent =
      "±" + 상태.폭 + "일 · 비 " + 상태.기준.비 + "mm · 더위 " + 상태.기준.더위 +
      "℃ · 최근 " + 상태.최근 + "년";
  }

  /* ── 지점 고르기 ────────────────────────────────────────── */
  function 시도채우기() {
    var 목록 = (Data.목록 && Data.목록.목록) || [];
    var 시도칸 = $("시도");
    시도칸.textContent = "";
    var 시도들 = Place.시도들(목록);
    if (!시도들.length) {
      시도칸.appendChild(new Option("— 자료가 없습니다 —", ""));
      return;
    }
    시도들.forEach(function (s) { 시도칸.appendChild(new Option(s, s)); });

    // 이미 고른 지점이 있으면 그 시·도로 맞춘다
    var 고름 = 상태.지점 ? Data.지점찾기(상태.지점) : null;
    시도칸.value = (고름 && 고름.시도) || 시도들[0];
    지점채우기();
  }

  function 지점채우기() {
    var 목록 = (Data.목록 && Data.목록.목록) || [];
    var 지점칸 = $("지점");
    var 그것들 = Place.그시도지점(목록, $("시도").value);
    지점칸.textContent = "";
    그것들.forEach(function (s) {
      지점칸.appendChild(new Option(s.이름 + " (" + s.번호 + ")", String(s.번호)));
    });
    var 고름 = 상태.지점 && 그것들.some(function (s) { return s.번호 === 상태.지점; });
    지점칸.value = String(고름 ? 상태.지점 : (그것들[0] && 그것들[0].번호) || "");
    행선지채우기();
    지점바꾸기(Number(지점칸.value));
  }

  function 행선지채우기() {
    var 목록 = (Data.목록 && Data.목록.목록) || [];
    var 칸 = $("행선지");
    var 지금 = 칸.value;
    칸.textContent = "";
    칸.appendChild(new Option("— 학교와 같음 —", ""));
    목록.forEach(function (s) {
      칸.appendChild(new Option(s.이름 + " (" + s.시도 + ")", String(s.번호)));
    });
    칸.value = 지금 || "";
  }

  /** 실제로 볼 지점 — 소풍이고 행선지를 골랐으면 그쪽 */
  function 볼지점() {
    if (상태.행사 === "소풍" && 상태.행선지) return 상태.행선지;
    return 상태.지점;
  }

  function 지점바꾸기(번호) {
    if (번호) 상태.지점 = Number(번호);
    저장();
    자료물려오기();
  }

  /**
   * 🚨 관측 기록이 짧은 지점을 화면에서 알린다.
   *
   * 김해시(2008~)·북창원(2009~)·북부산(2023~)처럼 **늦게 생긴 관측소**가
   * 실제로 있다. 자료가 잘못된 것이 아니라 사실이다. 그런데 3해치로 낸
   * 「33%」 와 30해치로 낸 「33%」 는 무게가 전혀 다른데, 화면에서는
   * 똑같은 «33%» 로 보인다.
   *
   * 🔴 표본 수는 칸마다 이미 적고 있지만, 그것만으로는 눈에 안 들어온다.
   *    그래서 지점을 고른 순간 **결과 칸 맨 위에서 한 번 더** 말해 준다.
   *    특히 «기간(야영)» 모드는 해마다 한 번씩만 세므로 3해면 표본이 셋뿐이다.
   */
  function 짧은자료알리기(해수) {
    var 칸 = $("짧은자료");
    if (!칸) return;
    if (해수 >= 20) { 칸.hidden = true; 칸.textContent = ""; return; }

    칸.textContent = "";
    칸.className = "짧은자료" + (해수 < 10 ? " 아주짧음" : "");
    var 세 = 만들("b", null,
      해수 < 10 ? "⚠ 이 관측소는 자료가 " + 해수 + "해뿐입니다 — 통계로 보기에는 너무 짧습니다."
                : "⚠ 이 관측소는 자료가 " + 해수 + "해입니다 (보통 30해로 봅니다).");
    칸.appendChild(세);
    var 말 = 만들("span", null,
      "늦게 생긴 관측소라 자료가 짧은 것이고 잘못된 것은 아닙니다. " +
      "다만 표본이 적으면 숫자가 크게 흔들립니다" +
      (행사들[상태.행사].기간
        ? " — 특히 지금 보시는 «기간» 은 해마다 한 번씩만 세므로 표본이 " + 해수 + "개뿐입니다."
        : ".") +
      " 옆에 있는 관측소와 견주어 보시기를 권합니다.");
    칸.appendChild(말);
    칸.hidden = false;
  }

  /* ══ 🌦 예보 (모드 B) ═══════════════════════════════════════
     🔴 예보가 닿는 곳은 D+0~D+2 (단기예보) 까지다.
        그보다 먼 날에는 **아무 말도 하지 않는다.** 지어내지 않는다.
     🔒 인증키는 server.py 가 들고 있다. 화면은 서버에게 묻는다.
     ⚠ 더블클릭(file://)으로 열면 서버가 없어 예보를 못 본다 — 그건 잘못이
       아니라 «못 보는 상태» 일 뿐이라, 조용히 넘어가고 통계만 보여 준다. */

  /** 지금 보는 곳의 격자(nx, ny). 좌표표가 없으면 null */
  function 지금격자() {
    if (!지금표 || !뿌리격자표()) return null;
    var 지점 = Data.지점찾기(볼지점());
    if (!지점 || !지점.시도) return null;
    var 자리 = Place.시군구자리(지점.시도, 지점.시군구 || 지점.이름);
    if (!자리) return null;
    if (자리.nx != null && 자리.ny != null) return { nx: 자리.nx, ny: 자리.ny };
    // 여러 구를 아우른 자리는 nx 가 비어 있다 — 위경도에서 셈한다
    var g = window.Grid && window.Grid.격자로(자리.위도, 자리.경도);
    return g && g.안에있나 ? { nx: g.nx, ny: g.ny } : null;
  }
  function 뿌리격자표() { return window.격자표 && window.격자표.것들 ? window.격자표 : null; }

  /** 후보 날짜 가운데 «예보가 있는» 것이 하나라도 있나 */
  function 예보볼날있나() {
    // ⚠ 단기예보는 발표 시각에 따라 «사흘 뒤» 까지 오기도 한다. 범위를 좁게 잡으면
    //   자료는 왔는데 화면에 안 나온다. 넉넉히 물어보고, 실제로 그 날이 있는지는
    //   예보값() 이 판단한다(없으면 그 칸이 «예보 없음» 이 된다).
    return 상태.날짜.some(function (날) {
      var d = 며칠뒤(날);
      if (d == null) return false;
      var 끝 = d + (행사들[상태.행사].기간 ? 상태.일수 - 1 : 0);
      return 끝 >= 0 && d <= 3;
    });
  }

  /**
   * 후보 하나의 예보를 꺼낸다. 없으면 null.
   *
   * 🔴 «기간(야영)» 이면 여러 날에 걸치는데, 예보는 사흘 뒤까지뿐이다.
   *    그래서 **예보가 있는 날만** 아우르고 «몇 일치인지» 를 함께 알려 준다.
   *    사흘 가운데 하루만 예보가 있는데 «사흘 예보» 인 척하면 안 된다.
   */
  function 예보값(c) {
    var 담 = 지금예보();
    if (!담 || !담.됐나) return null;

    var 기간 = 행사들[상태.행사].기간;
    var 일수 = 기간 ? 상태.일수 : 1;
    var d0 = 날쪼개기(c.날);
    if (!d0) return null;

    var 모음 = [];
    for (var i = 0; i < 일수; i++) {
      var 그날 = new Date(Date.UTC(d0.해, d0.월 - 1, d0.일) + i * 86400000);
      var 열쇠 = 그날.getUTCFullYear() +
        String(그날.getUTCMonth() + 1).padStart(2, "0") +
        String(그날.getUTCDate()).padStart(2, "0");
      var 것 = 담.날마다[열쇠];
      if (것) 모음.push(것);
    }
    if (!모음.length) return null;
    if (모음.length === 1) {
      var 하나 = {}; for (var k in 모음[0]) 하나[k] = 모음[0][k];
      하나.일수 = 1; return 하나;
    }

    // 여러 날 — 행사에 나쁜 쪽으로 아우른다 (가장 높은 강수확률, 가장 추운 밤 …)
    var 합 = { 일수: 모음.length, 강수확률: null, 총강수: 0, 최저: null, 최고: null,
               최대풍속: null, 하늘: null, 강수형태: null };
    var 하늘순 = { "맑음": 1, "구름많음": 2, "흐림": 3 }, 하늘최악 = 0;
    모음.forEach(function (그) {
      if (그.강수확률 != null) 합.강수확률 = Math.max(합.강수확률 == null ? -1 : 합.강수확률, 그.강수확률);
      합.총강수 += 그.총강수 || 0;
      if (그.최저 != null) 합.최저 = 합.최저 == null ? 그.최저 : Math.min(합.최저, 그.최저);
      if (그.최고 != null) 합.최고 = 합.최고 == null ? 그.최고 : Math.max(합.최고, 그.최고);
      if (그.최대풍속 != null) 합.최대풍속 = Math.max(합.최대풍속 == null ? -1 : 합.최대풍속, 그.최대풍속);
      if (그.하늘 && (하늘순[그.하늘] || 0) > 하늘최악) { 하늘최악 = 하늘순[그.하늘]; 합.하늘 = 그.하늘; }
      if (그.강수형태 && !합.강수형태) 합.강수형태 = 그.강수형태;
    });
    합.총강수 = Math.round(합.총강수 * 10) / 10;
    return 합;
  }

  /** 지금 지점·시각에 해당하는 예보 결과 (담아 둔 것) */
  function 지금예보() {
    var 격 = 지금격자();
    if (!격 || !window.Fcst) return null;
    var 기준 = Fcst.기준시각();
    return 상태.예보.담음[격.nx + "," + 격.ny + "," + 기준.base_date + 기준.base_time] || null;
  }

  function 예보챙기기() {
    var 칸 = $("예보칸");
    if (!칸) return;

    // 볼 날이 없으면 카드를 아예 내린다 (빈 카드를 남기지 않는다)
    if (!예보볼날있나() || !지금표) { 칸.hidden = true; return; }

    var 격 = 지금격자();
    if (!격) {
      // 좌표표가 없어 격자를 모른다 — 왜 못 보는지 한 줄로 알려 준다
      예보그리기({ 못함: "coords" });
      return;
    }
    if (상태.예보.키 && !상태.예보.키.단기예보) {
      예보그리기({ 못함: 상태.예보.키.서버없음 ? "server" : "key" });
      return;
    }

    var 기준 = Fcst.기준시각();
    var 열쇠 = 격.nx + "," + 격.ny + "," + 기준.base_date + 기준.base_time;
    if (상태.예보.담음[열쇠]) { 예보그리기(상태.예보.담음[열쇠]); return; }
    if (상태.예보.부르는중 === 열쇠) return;

    상태.예보.부르는중 = 열쇠;
    예보그리기({ 부르는중: true });
    Fcst.단기가져오기(격.nx, 격.ny).then(function (r) {
      상태.예보.부르는중 = false;
      r.격자 = 격;
      상태.예보.담음[열쇠] = r;
      // 🔴 표 안에 예보 줄을 그려야 하므로 통째로 다시 그린다.
      //    (다시그리기 → 예보챙기기 로 돌아오지만 이미 담아 두었으므로 멈춘다)
      다시그리기();
    });
  }

  /**
   * 예보 «띠» — 값은 표 안에 그린다. 여기서는 «언제 낸 예보인가» 만 말한다.
   * 🔴 이 한 줄이 없으면 표 안의 예보 줄이 «언제 것» 인지 알 수 없다.
   *    예보는 하루 여덟 번 바뀌므로 발표 시각이 값만큼 중요하다.
   */
  function 예보그리기(r) {
    var 칸 = $("예보칸");
    칸.textContent = "";
    칸.className = "예보칸";
    칸.hidden = false;

    if (r.부르는중) {
      칸.appendChild(만들("span", "예보띠글", "🌦 예보를 가져오는 중…"));
      return;
    }

    if (r.못함) {
      var 말 = {
        coords: "예보를 보려면 시·군·구 좌표표가 필요합니다 — tools/격자표_만들기.js 로 만드세요.",
        key: "예보 인증키가 없습니다 — node tools/키_넣기.js 로 넣으면 사흘 뒤까지 함께 보입니다.",
        // 🔴 «서버가 없다» 는 두 경우가 있고 할 말이 다르다.
        //    ① 더블클릭(file://) — 로컬 서버로 열면 된다
        //    ② 사이트(http) 인데 중계가 없다 — 방문자는 할 수 있는 것이 없다
        //    ②에 «python server.py» 라고 하면 방문자에게 뜻이 통하지 않는다.
        server: (location.protocol === "file:")
          ? "더블클릭으로 열면 예보를 볼 수 없습니다 — python server.py 로 여시면 함께 보입니다."
          : "이 사이트에서는 과거 통계만 봅니다. 행사가 가까워지면 기상청 예보를 따로 확인하세요."
      }[r.못함];
      칸.className = "예보칸 못함";
      칸.appendChild(만들("span", "예보띠글", "🌦 " + 말));
      return;
    }

    if (!r.됐나) {
      칸.className = "예보칸 못함";
      var 글 = "🌦 예보를 가져오지 못했습니다 — " + (r.잘못 || "");
      if (r.속 && r.속.어떻게) {
        var 어 = r.속.어떻게;
        글 += " (" + (Array.isArray(어) ? 어.join(" · ") : String(어)) + ")";
      }
      칸.appendChild(만들("span", "예보띠글", 글));
      return;
    }

    var b = r.기준;
    var 띠 = 만들("span", "예보띠글");
    띠.appendChild(만들("b", null, "🌦 기상청 예보"));
    띠.appendChild(document.createTextNode(
      "  " + b.base_date.slice(4, 6) + "/" + b.base_date.slice(6, 8) + " " +
      b.base_time.slice(0, 2) + "시 발표 · 격자 " + r.격자.nx + "," + r.격자.ny +
      " · 사흘 뒤까지만 있습니다. 행사 당일 아침에 한 번 더 보세요."));
    칸.appendChild(띠);
  }

  function 자료물려오기() {
    var 번호 = 볼지점();
    var 알림 = $("고른곳");
    if (!번호) {
      알림.className = "고른곳 빔";
      알림.textContent = "지점을 고르면 여기에 자료 기간이 나옵니다.";
      지금표 = null; 다시그리기(); return;
    }
    알림.className = "고른곳";
    알림.textContent = "자료를 부르는 중…";

    Data.자료부르기(번호).then(function (난것) {
      if (!난것.있나) {
        알림.className = "고른곳 빔";
        알림.textContent = "이 지점의 자료가 이 앱에 없습니다. 위의 「📦 다른 지역 자료 넣기」 로 넣어 주세요.";
        지금표 = null; 다시그리기(); return;
      }
      지금표 = Stat.풀기(난것.자료);
      var 해수 = Object.keys(지금표.해).length;
      알림.className = "고른곳";
      알림.textContent = 지금표.이름 + " (" + 지금표.지점 + ") · " +
        지금표.시작 + "~" + 지금표.끝 + "년 " + 해수 + "해 자료" +
        (난것.어디서 === "넣은것" ? " · 넣어 두신 것" : "");
      짧은자료알리기(해수);
      다시그리기();
    });
  }

  /* ── 날짜 칸 ────────────────────────────────────────────── */
  function 날짜그리기() {
    var 집 = $("날짜들");
    집.textContent = "";
    상태.날짜.forEach(function (날, i) {
      var li = 만들("li");
      var 칸 = document.createElement("input");
      칸.type = "date"; 칸.value = 날;
      // 🔴 숫자·날짜 칸은 input 과 change 를 «둘 다» 듣는다.
      //    change 만 들으면 다른 곳을 눌러야 값이 바뀌어 «안 된다» 는 신고가 온다.
      ["input", "change"].forEach(function (무엇) {
        칸.addEventListener(무엇, function () {
          상태.날짜[i] = 칸.value; 다시그리기();
        });
      });
      li.appendChild(칸);

      var 뺌 = 만들("button", "빼기", "✕");
      뺌.type = "button";
      뺌.title = "이 후보 빼기";
      뺌.disabled = 상태.날짜.length <= 1;
      뺌.addEventListener("click", function () {
        상태.날짜.splice(i, 1); 날짜그리기(); 다시그리기();
      });
      li.appendChild(뺌);
      집.appendChild(li);
    });
    $("날짜추가").disabled = 상태.날짜.length >= 5;
  }

  /** 처음 열었을 때 넣어 둘 후보 — 다음 달 같은 요일 언저리 */
  function 첫날짜() {
    var 오늘 = new Date();
    var 씨 = new Date(오늘.getFullYear(), 오늘.getMonth(), 오늘.getDate() + 30);
    function 글로(d) {
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    }
    var 둘째 = new Date(씨.getTime() + 7 * 86400000);
    return [글로(씨), 글로(둘째)];
  }

  /* ── 학교 찾기 ──────────────────────────────────────────── */
  function 학교칸챙기기() {
    var 시도 = $("시도").value;
    var 코드 = Place.시도코드(시도);
    if (!코드) { $("학교찾기줄").hidden = true; return; }
    Place.학교부르기(코드).then(function (목록) {
      // 🔴 목록이 없으면 이 칸을 저절로 숨긴다. 없어도 앱은 그대로 돌아간다.
      $("학교찾기줄").hidden = !목록 || !목록.length;
    });
  }

  function 학교찾기붙이기() {
    var 글칸 = $("학교글"), 집 = $("학교찾은것");
    function 닫기() { 집.hidden = true; 집.textContent = ""; }

    글칸.addEventListener("input", function () {
      var 코드 = Place.시도코드($("시도").value);
      if (!코드) return 닫기();
      Place.학교부르기(코드).then(function (목록) {
        if (!목록) return 닫기();
        var 찾은 = Place.학교찾기(목록, 글칸.value, 12);
        집.textContent = "";
        if (!글칸.value.replace(/\s/g, "")) return 닫기();
        if (!찾은.length) {
          var 빔 = 만들("li", "알림", "찾는 학교가 없습니다. 아래에서 관측지점을 바로 고르셔도 됩니다.");
          집.appendChild(빔); 집.hidden = false; return;
        }
        찾은.forEach(function (학교) {
          var li = 만들("li");
          li.appendChild(document.createTextNode(학교.이름));
          li.appendChild(만들("span", "어디", 학교.시군구));
          li.addEventListener("click", function () { 학교고름(학교); 닫기(); });
          집.appendChild(li);
        });
        if (Place.맛보기인가(코드)) {
          집.appendChild(만들("li", "알림",
            "⚠ 학교 목록이 «일부» 입니다. 전체를 넣으려면 tools/학교목록_만들기.js 를 인증키로 돌리세요."));
        }
        집.hidden = false;
      });
    });
    글칸.addEventListener("blur", function () { setTimeout(닫기, 180); });
  }

  function 학교고름(학교) {
    var 목록 = (Data.목록 && Data.목록.목록) || [];
    var 시도 = $("시도").value;
    var 난것 = Place.시군구로(목록, 시도, 학교.시군구);
    $("학교글").value = 학교.이름;

    if (난것.어떻게 === "이름이같다") {
      상태.지점 = 난것.지점.번호;
      $("지점").value = String(상태.지점);
      지점바꾸기(상태.지점);
    } else if (난것.어떻게 === "거리로골랐다") {
      // 격자표로 거리를 재어 골랐다. 🔴 «어림잡은 것» 임을 반드시 말한다.
      상태.지점 = 난것.지점.번호;
      $("지점").value = String(상태.지점);
      지점바꾸기(상태.지점);
      var 알림3 = $("고른곳");
      var 뒤 = 만들("span", "꼬리말");
      뒤.textContent = " · " + 학교.시군구 + " 에는 관측소가 없어 " +
        Math.round(난것.거리) + "km 떨어진 " + 난것.지점.이름 + " 으로 잡았습니다" +
        " (동네 가운데끼리 잰 어림값입니다). 다르게 보시려면 위에서 바꾸세요.";
      알림3.appendChild(뒤);
    } else if (난것.어떻게 === "여럿이다") {
      // 같은 시군구에 관측소가 둘 이상이다 (창원시 = 창원 + 북창원).
      // 어느 쪽이 가까운지는 좌표가 있어야 아는데 아직 없으므로 «그 둘만» 보여 준다.
      var 알림2 = $("고른곳");
      알림2.className = "고른곳 빔";
      알림2.textContent = 학교.시군구 + " 에는 관측소가 " + 난것.고를것.length + "곳 있습니다 — " +
        난것.고를것.map(function (s) { return s.이름 + "(" + s.번호 + ")"; }).join(" · ") +
        ". 아래에서 골라 주세요.";
    } else {
      // 🔴 «골라야 한다» 를 «저절로 골랐다» 로 바꾸지 않는다.
      //    지점 위경도가 없어 어디가 가까운지 정말로 알 수 없다.
      //    엉뚱한 지점을 조용히 골라 주면 그 통계로 날짜를 정하게 된다.
      var 알림 = $("고른곳");
      알림.className = "고른곳 빔";
      알림.textContent = 학교.시군구 + " 에는 관측소가 없습니다. " +
        "아래에서 가까운 곳을 직접 골라 주세요.";
    }
  }

  /* ── 자료 꾸러미 창 ─────────────────────────────────────── */
  function 꾸러미붙이기() {
    var 덮개 = $("꾸러미덮개");
    $("꾸러미열기").addEventListener("click", function () {
      덮개.hidden = false;
      $("담긴지점수").textContent = String(((Data.목록 && Data.목록.목록) || []).length);
      넣은것그리기();
    });
    $("꾸러미닫기").addEventListener("click", function () { 덮개.hidden = true; });
    덮개.addEventListener("click", function (e) { if (e.target === 덮개) 덮개.hidden = true; });

    $("꾸러미파일").addEventListener("change", function (e) {
      var 파일들 = Array.prototype.slice.call(e.target.files || []);
      if (!파일들.length) return;
      var 결과칸 = $("꾸러미결과");
      결과칸.className = "꾸러미결과";
      결과칸.textContent = "읽는 중…";

      Promise.all(파일들.map(function (f) {
        return f.text().then(function (글) { return Data.꾸러미넣기(글); });
      })).then(function (것들) {
        var 된것 = [], 잘못 = [];
        것들.forEach(function (r) {
          된것 = 된것.concat(r.된것);
          if (r.잘못) 잘못.push(r.잘못);
        });
        if (된것.length) {
          결과칸.className = "꾸러미결과 됨";
          결과칸.textContent = "✔ " + 된것.map(function (r) { return r.이름; }).join(" · ") +
            " — 모두 " + 된것.length + "곳을 넣었습니다.";
          목록에더하기(된것);
        } else {
          결과칸.className = "꾸러미결과 안됨";
          결과칸.textContent = 잘못.join(" / ") || "넣지 못했습니다.";
        }
        넣은것그리기();
        e.target.value = "";
      });
    });
  }

  /** 넣은 지점을 화면의 고르는 칸에도 더한다 */
  function 목록에더하기(된것) {
    if (!Data.목록) return;
    if (!Data.목록.목록) Data.목록.목록 = [];
    된것.forEach(function (r) {
      var 있나 = Data.목록.목록.some(function (s) { return s.번호 === r.번호; });
      if (!있나) {
        Data.목록.목록.push({
          번호: r.번호, 이름: r.이름, 시도: "넣어 둔 것", 시군구: "",
          위도: null, 경도: null
        });
      }
    });
    시도채우기();
  }

  function 넣은것그리기() {
    var 집 = $("넣은것목록");
    Data.넣은것들().then(function (번호들) {
      집.textContent = "";
      if (!번호들.length) {
        집.appendChild(만들("p", "꼬리말", "아직 넣어 둔 자료가 없습니다."));
        return;
      }
      집.appendChild(만들("b", null, "넣어 두신 자료 (" + 번호들.length + "곳)"));
      var ul = 만들("ul");
      번호들.forEach(function (번호) {
        var li = 만들("li");
        var 것 = Data.지점찾기(번호);
        li.appendChild(document.createTextNode((것 ? 것.이름 + " " : "") + "(" + 번호 + ")"));
        var b = 만들("button", null, "빼기");
        b.type = "button";
        b.addEventListener("click", function () {
          Data.넣은것지우기(번호).then(넣은것그리기);
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
      집.appendChild(ul);
    });
  }

  /* ── 붙이기 ─────────────────────────────────────────────── */
  function 행사붙이기() {
    var 집 = $("행사단추");
    Array.prototype.forEach.call(집.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        상태.행사 = b.dataset.행사;
        Array.prototype.forEach.call(집.querySelectorAll("button"), function (x) {
          x.classList.toggle("켜짐", x === b);
        });
        행사맞추기();
        저장();
        자료물려오기();
      });
    });
  }

  function 행사맞추기() {
    var 것 = 행사들[상태.행사];
    $("일수줄").hidden = !것.기간;
    $("행선지줄").hidden = 상태.행사 !== "소풍";
    Array.prototype.forEach.call($("행사단추").querySelectorAll("button"), function (x) {
      x.classList.toggle("켜짐", x.dataset.행사 === 상태.행사);
    });
  }

  function 숫자칸붙이기(id, 넣기) {
    var 칸 = $(id);
    if (!칸) return;
    // 🔴 input 과 change 를 둘 다 듣는다 (change 만 들으면 «안 바뀐다» 는 신고가 온다)
    ["input", "change"].forEach(function (무엇) {
      칸.addEventListener(무엇, function () {
        var v = Number(칸.value);
        if (!isFinite(v)) return;
        넣기(v); 저장(); 다시그리기();
      });
    });
  }

  function 시작() {
    불러오기();
    상태.날짜 = 첫날짜();

    // 저장해 둔 기준을 칸에 되살린다
    $("폭").value = 상태.폭;
    $("최근").value = 상태.최근;
    $("일수").value = 상태.일수;
    ["비", "큰비", "더위", "추위", "강풍"].forEach(function (k) {
      if ($(k)) $(k).value = 상태.기준[k];
    });

    행사맞추기();
    행사붙이기();
    날짜그리기();
    학교찾기붙이기();
    꾸러미붙이기();

    $("날짜추가").addEventListener("click", function () {
      if (상태.날짜.length >= 5) return;
      var 끝 = 상태.날짜[상태.날짜.length - 1] || 첫날짜()[0];
      var d = 날쪼개기(끝);
      var 다음 = new Date(Date.UTC(d.해, d.월 - 1, d.일) + 7 * 86400000);
      상태.날짜.push(다음.toISOString().slice(0, 10));
      날짜그리기(); 다시그리기();
    });

    $("시도").addEventListener("change", function () { 지점채우기(); 학교칸챙기기(); });
    $("지점").addEventListener("change", function () { 지점바꾸기(Number($("지점").value)); });
    $("행선지").addEventListener("change", function () {
      상태.행선지 = $("행선지").value ? Number($("행선지").value) : null;
      자료물려오기();
    });

    숫자칸붙이기("폭", function (v) { 상태.폭 = Math.max(0, Math.min(10, v)); });
    숫자칸붙이기("최근", function (v) { 상태.최근 = Math.max(3, Math.min(30, v)); });
    숫자칸붙이기("일수", function (v) { 상태.일수 = Math.max(1, Math.min(7, v)); });
    ["비", "큰비", "더위", "추위", "강풍"].forEach(function (k) {
      숫자칸붙이기(k, function (v) { 상태.기준[k] = v; });
    });

    $("인쇄").addEventListener("click", function () {
      if (!지금표) { alert("먼저 관측지점을 골라 주세요."); return; }
      var 후보들 = 상태.날짜.map(function (날) { return 후보셈(지금표, 날); })
                            .filter(function (c) { return c; });
      Report.인쇄({
        표: 지금표, 후보들: 후보들, 행사: 상태.행사,
        기간: 행사들[상태.행사].기간, 일수: 상태.일수,
        폭: 상태.폭, 기준: 상태.기준, 최근: 상태.최근,
        줄: 행사들[상태.행사].줄, 줄이름: (function () {
          var m = {}; for (var k in 줄뜻) m[k] = 줄뜻[k].이름; return m;
        })(),
        날꾸미기: 날꾸미기, 가짜: !!지금표.가짜
      });
    });

    // 인증키가 있는지 한 번만 물어본다 (키 자체는 오지 않는다).
    // 서버 없이 열었으면 조용히 «서버없음» 이 되고 앱은 그대로 돈다.
    if (window.Fcst) {
      Fcst.키있나().then(function (것) { 상태.예보.키 = 것; 예보챙기기(); });
    }

    Data.목록부르기().then(function () {
      시도채우기();
      학교칸챙기기();
      기준요약쓰기();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", 시작);
  else 시작();
})();
