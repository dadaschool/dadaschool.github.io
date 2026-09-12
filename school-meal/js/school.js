/**
 * 학교 고르기 — 목록 불러오기 · 찾기 · 기억하기
 *
 * 🔴 목록을 .json 이 아니라 .js 로 두고 <script> 로 불러온다.
 *    file:// (더블클릭)에서는 fetch 가 막히지만 <script> 는 되기 때문이다.
 *    이 프로젝트가 지켜 온 «더블클릭으로 열린다» 를 살리려는 것이다.
 *
 * 🔴 목록을 미리 파일로 담아 두는 까닭 :
 *    인증키 없이 NEIS 로 학교를 검색하면 «5개» 까지만 나오고
 *    다음 쪽으로 넘어갈 수도 없다. 그러면 학교를 고를 수가 없다.
 */

(function (전역) {
  "use strict";

  // 시도교육청 17곳 — 코드가 곧 파일 이름이다(schools/S10.js).
  var 교육청 = [
    ["B10", "서울"], ["C10", "부산"], ["D10", "대구"], ["E10", "인천"],
    ["F10", "광주"], ["G10", "대전"], ["H10", "울산"], ["I10", "세종"],
    ["J10", "경기"], ["K10", "강원"], ["M10", "충북"], ["N10", "충남"],
    ["P10", "전북"], ["Q10", "전남"], ["R10", "경북"], ["S10", "경남"],
    ["T10", "제주"],
  ];

  var 교육청이름 = {};
  교육청.forEach(function (p) { 교육청이름[p[0]] = p[1]; });

  var 종류이름 = { 초: "초등학교", 중: "중학교", 고: "고등학교" };

  var 기억열쇠 = "school-meal.학교";
  var 불러온것 = {};      // 시도코드 → Promise

  // ── 목록 불러오기 ──────────────────────────────────────────────

  /**
   * 시도교육청 한 곳의 목록을 불러온다.
   * 이미 불러왔으면 곧바로 돌려준다(같은 파일을 두 번 받지 않는다).
   */
  function 불러오기(시도) {
    if (!교육청이름[시도]) {
      return Promise.reject(new Error("모르는 교육청 코드입니다 : " + 시도));
    }
    if (불러온것[시도]) return 불러온것[시도];

    불러온것[시도] = new Promise(function (풀기, 미룸) {
      // 이미 창에 들어와 있으면(캐시) 다시 받지 않는다
      if (전역["SCHOOLS_" + 시도]) return 풀기(전역["SCHOOLS_" + 시도]);

      var 태그 = document.createElement("script");
      var 끝났나 = false;
      var 시계 = setTimeout(function () {
        if (끝났나) return;
        끝났나 = true;
        미룸(new Error("학교 목록을 받지 못했습니다 : " + 시도));
      }, 20000);

      태그.src = "schools/" + 시도 + ".js?v=202609122144";
      태그.onload = function () {
        if (끝났나) return;
        끝났나 = true;
        clearTimeout(시계);
        var 목록 = 전역["SCHOOLS_" + 시도];
        if (!Array.isArray(목록)) {
          미룸(new Error("학교 목록 파일의 모양이 다릅니다 : " + 시도));
        } else {
          풀기(목록);
        }
      };
      태그.onerror = function () {
        if (끝났나) return;
        끝났나 = true;
        clearTimeout(시계);
        미룸(new Error("학교 목록 파일이 없습니다 : schools/" + 시도 + ".js"));
      };
      document.head.appendChild(태그);
    });

    // 실패했으면 다음에 다시 해 볼 수 있게 지워 둔다
    불러온것[시도]["catch"](function () { delete 불러온것[시도]; });
    return 불러온것[시도];
  }

  /** 열일곱 곳을 모두 불러온다. 일부가 없어도 있는 것만으로 이어 간다. */
  function 전국불러오기() {
    return Promise.all(교육청.map(function (p) {
      return 불러오기(p[0])["catch"](function () { return null; });
    })).then(function (것들) {
      var 있음 = 것들.filter(Boolean).length;
      if (있음 === 0) throw new Error("학교 목록이 하나도 없습니다.");
      return 있음;
    });
  }

  /** 이미 불러온 시도 코드들 */
  function 불러온시도() {
    return 교육청.map(function (p) { return p[0]; })
                 .filter(function (c) { return Array.isArray(전역["SCHOOLS_" + c]); });
  }

  // ── 찾기 ───────────────────────────────────────────────────────

  /** 배열 한 줄 → 다루기 쉬운 모양 */
  function 만들기(시도, 줄) {
    return {
      시도: 시도,
      시도이름: 교육청이름[시도] || 시도,
      코드: 줄[0],
      이름: 줄[1],
      지역: 줄[2] || "",
      종류: 줄[3] || "",
      종류이름: 종류이름[줄[3]] || "",
    };
  }

  /**
   * 학교 찾기.
   *   글    : 검색어. 학교 이름과 시·군·구를 함께 본다.
   *   시도  : 코드를 주면 그곳만, 비우면 «불러온 곳 전부» 에서 찾는다.
   *   제한  : 최대 몇 개까지 (기본 60)
   *
   * 이름이 검색어로 «시작하는» 학교를 앞에 놓는다 —
   * 「거제」로 찾을 때 「거제중학교」가 「대우거제중학교」보다 먼저 나와야 한다.
   */
  function 찾기(글, 시도, 제한) {
    var 말 = String(글 == null ? "" : 글).replace(/\s+/g, "").trim();
    제한 = 제한 || 60;
    var 볼곳 = 시도 ? [시도] : 불러온시도();
    var 앞선것 = [], 담긴것 = [], 지역것 = [];

    for (var i = 0; i < 볼곳.length; i++) {
      var 목록 = 전역["SCHOOLS_" + 볼곳[i]];
      if (!Array.isArray(목록)) continue;

      for (var j = 0; j < 목록.length; j++) {
        var 줄 = 목록[j];
        var 이름 = 줄[1] || "";
        var 지역 = 줄[2] || "";

        if (!말) {                       // 검색어가 없으면 그 시도 전체
          앞선것.push(만들기(볼곳[i], 줄));
        } else if (이름.indexOf(말) === 0) {
          앞선것.push(만들기(볼곳[i], 줄));
        } else if (이름.indexOf(말) > 0) {
          담긴것.push(만들기(볼곳[i], 줄));
        } else if (지역.indexOf(말) === 0) {
          지역것.push(만들기(볼곳[i], 줄));
        }

        if (앞선것.length >= 제한) break;
      }
      if (앞선것.length >= 제한) break;
    }

    return 앞선것.concat(담긴것, 지역것).slice(0, 제한);
  }

  /** 코드로 학교 하나 찾기(주소에 ?school=… 이 있을 때 쓴다) */
  function 하나찾기(시도, 코드) {
    var 목록 = 전역["SCHOOLS_" + 시도];
    if (!Array.isArray(목록)) return null;
    for (var i = 0; i < 목록.length; i++) {
      if (String(목록[i][0]) === String(코드)) return 만들기(시도, 목록[i]);
    }
    return null;
  }

  // ── 기억하기 ───────────────────────────────────────────────────
  // 🔒 여기 저장되는 것은 «학교 코드와 이름» 뿐이다.
  //    학생 이름·학번 같은 개인정보는 이 앱이 아예 받지 않는다.

  function 기억() {
    try {
      var 글 = localStorage.getItem(기억열쇠);
      if (!글) return null;
      var 것 = JSON.parse(글);
      if (!것 || !것.시도 || !것.코드 || !것.이름) return null;
      if (!교육청이름[것.시도]) return null;
      return 것;
    } catch (e) { return null; }
  }

  function 기억하기(학교) {
    if (!학교 || !학교.시도 || !학교.코드) return;
    try {
      localStorage.setItem(기억열쇠, JSON.stringify({
        시도: 학교.시도, 코드: 학교.코드, 이름: 학교.이름,
        지역: 학교.지역 || "", 종류: 학교.종류 || "",
      }));
    } catch (e) { /* 저장 못 해도 그만 */ }
  }

  function 잊기() {
    try { localStorage.removeItem(기억열쇠); } catch (e) { /* 무시 */ }
  }

  // ── 주소로 학교 지정 ───────────────────────────────────────────
  // …/?school=S10-9111056  →  고르는 화면 없이 그 학교가 바로 열린다.
  // 영양사님이 학부모에게 링크를 보낼 때 쓴다.

  function 주소읽기(검색글) {
    var 글 = 검색글 == null
      ? (typeof location !== "undefined" ? location.search : "")
      : 검색글;
    // 🔴 학교 코드는 «숫자» 가 아니다. 국립대 부설학교는 `C020714` 처럼 영문으로 시작한다
    //    (경상국립대·공주대·제주대 부설 5곳에서 실제로 확인). 숫자만 받으면 그 학교들의
    //    주소가 통째로 안 열린다.
    var 맞음 = String(글).match(/[?&]school=([A-Z]\d{2})-([A-Za-z0-9]{1,10})/i);
    if (!맞음) return null;
    var 시도 = 맞음[1].toUpperCase();
    if (!교육청이름[시도]) return null;
    return { 시도: 시도, 코드: 맞음[2] };
  }

  function 주소만들기(학교, 밑주소) {
    if (!학교) return "";
    var 밑 = 밑주소 == null
      ? (typeof location !== "undefined"
          ? location.href.split("?")[0].split("#")[0] : "")
      : 밑주소;
    return 밑 + "?school=" + 학교.시도 + "-" + 학교.코드;
  }

  /** 이 앱이 켜질 때 «간단 보기(홈페이지에 끼워 넣기)» 인가 */
  function 간단보기(검색글) {
    var 글 = 검색글 == null
      ? (typeof location !== "undefined" ? location.search : "")
      : 검색글;
    return /[?&]embed=1(&|$)/i.test(String(글));
  }

  전역.School = {
    교육청: 교육청,
    교육청이름: 교육청이름,
    종류이름: 종류이름,
    불러오기: 불러오기,
    전국불러오기: 전국불러오기,
    불러온시도: 불러온시도,
    찾기: 찾기,
    하나찾기: 하나찾기,
    기억: 기억,
    기억하기: 기억하기,
    잊기: 잊기,
    주소읽기: 주소읽기,
    주소만들기: 주소만들기,
    간단보기: 간단보기,
    _만들기: 만들기,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).School;
}
