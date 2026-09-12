/**
 * NEIS 급식 API — 부르고, 정리하고, 저장해 둔다.
 *
 * 🔴 인증키를 쓰지 않는다.
 *    키를 앱에 넣으면 «만든 사람 키 하나» 로 모든 방문자가 몰려
 *    하루 한도(ERROR-337)를 다 쓰는 순간 그날 아무도 급식을 못 본다.
 *    키 없이 부르면 방문자마다 따로 세므로 서로에게 번지지 않는다.
 *
 * 🔴 키가 없으면 «한 번에 5줄» 까지만 온다(직접 재서 확인했다. pIndex 도 무시된다).
 *    그래서 MMEAL_SC_CODE=2(중식)로 걸러 월~금 다섯 줄 안에 반드시 들어가게 한다.
 *    조식·석식을 넣으려면 한 주가 15줄이 되어 이 방법이 깨진다 — 넣지 말 것.
 */

(function (전역) {
  "use strict";

  var 주소 = "https://open.neis.go.kr/hub/mealServiceDietInfo";
  var 중식 = "2";
  var 기다림 = 15000;          // 15초면 못 받은 것으로 본다
  var 캐시열쇠 = "school-meal.캐시";
  var 캐시최대 = 40;            // 주 40개어치만 들고 있는다

  // ── 저장해 두기 ────────────────────────────────────────────────
  // localStorage 는 사생활 보호 모드·용량 초과에서 «던진다».
  // 저장이 안 되는 것은 아쉬울 뿐이니 조용히 넘기고 앱은 그대로 돈다.

  function 캐시읽기() {
    try {
      var 글 = localStorage.getItem(캐시열쇠);
      return 글 ? JSON.parse(글) || {} : {};
    } catch (e) { return {}; }
  }

  function 캐시쓰기(뭉치) {
    try {
      var 열쇠들 = Object.keys(뭉치);
      if (열쇠들.length > 캐시최대) {
        // 오래 전에 받은 것부터 버린다
        열쇠들.sort(function (a, b) {
          return (뭉치[a].받은때 || 0) - (뭉치[b].받은때 || 0);
        });
        열쇠들.slice(0, 열쇠들.length - 캐시최대).forEach(function (k) {
          delete 뭉치[k];
        });
      }
      localStorage.setItem(캐시열쇠, JSON.stringify(뭉치));
    } catch (e) { /* 저장 못 해도 그만 */ }
  }

  function 열쇠(시도, 학교, 시작ymd) {
    return 시도 + "-" + 학교 + "-" + 시작ymd;
  }

  /**
   * 저장해 둔 것을 언제까지 믿을까.
   * 이미 지나간 주는 식단이 바뀌지 않으므로 오래 믿고,
   * 이번 주·앞으로 올 주는 영양사님이 고칠 수 있으므로 짧게 믿는다.
   */
  function 유효기간(끝ymd) {
    var 오늘 = 전역.DateUtil.ymd(전역.DateUtil.오늘());
    return 끝ymd < 오늘 ? 30 * 24 * 3600 * 1000 : 3 * 3600 * 1000;
  }

  // ── 응답 정리 ──────────────────────────────────────────────────

  /** "<br/>" 로 나뉜 여러 줄을 배열로. 태그 표기가 몇 가지라 다 받아 준다. */
  function 여러줄(글) {
    if (!글) return [];
    return String(글)
      .split(/<br\s*\/?>/i)
      .map(function (s) { return s.replace(/\s+/g, " ").trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  /** "탄수화물(g) : 113.2" → { 이름:"탄수화물(g)", 값:"113.2" } */
  function 영양한줄(줄) {
    var 자리 = 줄.indexOf(":");
    if (자리 < 0) return { 이름: 줄, 값: "" };
    return {
      이름: 줄.slice(0, 자리).trim(),
      값: 줄.slice(자리 + 1).trim(),
    };
  }

  /** API 한 줄 → 화면이 쓰는 모양 */
  function 한끼정리(행) {
    var 메뉴 = 여러줄(행.DDISH_NM).map(function (줄) {
      return 전역.Allergy.가르기(줄);
    });
    return {
      날짜: String(행.MLSV_YMD || ""),
      종류: String(행.MMEAL_SC_NM || "중식"),
      학교: String(행.SCHUL_NM || ""),
      메뉴: 메뉴,
      알레르기: 전역.Allergy.모으기(메뉴),
      칼로리: String(행.CAL_INFO || "").trim(),
      영양: 여러줄(행.NTR_INFO).map(영양한줄),
      급식인원: 행.MLSV_FGR ? String(행.MLSV_FGR).replace(/\.00$/, "") : "",
    };
  }

  /** 응답 뭉치에서 결과 코드와 행을 꺼낸다 */
  function 풀기(응답) {
    if (응답 && 응답.RESULT) {
      return { 코드: String(응답.RESULT.CODE || ""), 메시지: String(응답.RESULT.MESSAGE || ""), 행들: [] };
    }
    var 뭉치 = 응답 && 응답.mealServiceDietInfo;
    if (!Array.isArray(뭉치) || 뭉치.length < 2) {
      return { 코드: "ERROR-모양", 메시지: "받은 자료의 모양이 다릅니다.", 행들: [] };
    }
    var 머리 = 뭉치[0] && 뭉치[0].head;
    var 결과 = (머리 && 머리[1] && 머리[1].RESULT) || {};
    return {
      코드: String(결과.CODE || "INFO-000"),
      메시지: String(결과.MESSAGE || ""),
      행들: (뭉치[1] && 뭉치[1].row) || [],
    };
  }

  /** 오류 코드를 사람이 읽는 말로 */
  function 오류말(코드, 메시지) {
    if (코드 === "ERROR-337") {
      return "오늘은 급식 정보를 더 불러올 수 없습니다(교육부 서버의 하루 조회 한도). 잠시 뒤 다시 열어 주세요.";
    }
    if (코드 === "INFO-300" ||코드 === "ERROR-290") {
      return "교육부 급식 서버가 요청을 거절했습니다. 잠시 뒤 다시 열어 주세요.";
    }
    if (코드 === "네트워크") {
      return "인터넷에 연결되어 있는지 확인해 주세요.";
    }
    if (코드 === "시간초과") {
      return "교육부 급식 서버가 응답하지 않습니다. 잠시 뒤 다시 열어 주세요.";
    }
    return "급식 정보를 불러오지 못했습니다." + (메시지 ? " (" + 메시지 + ")" : "");
  }

  // ── 부르기 ─────────────────────────────────────────────────────

  function 부르기(url) {
    // AbortController 가 없는 낡은 브라우저에서도 죽지 않게 감싼다.
    var 끊개 = typeof AbortController !== "undefined" ? new AbortController() : null;
    var 시계 = setTimeout(function () { if (끊개) 끊개.abort(); }, 기다림);

    return fetch(url, 끊개 ? { signal: 끊개.signal } : undefined)
      .then(function (답) {
        clearTimeout(시계);
        if (!답.ok) throw new Error("HTTP " + 답.status);
        return 답.json();
      })
      .catch(function (e) {
        clearTimeout(시계);
        var 이름 = e && e.name === "AbortError" ? "시간초과" : "네트워크";
        var 잘못 = new Error(이름);
        잘못.코드 = 이름;
        throw 잘못;
      });
  }

  /**
   * 한 주(월~금)의 중식을 받는다.
   *
   * 돌려주는 것 :
   *   { ok:true,  끼니: { "20260901": {…}, … }, 출처: "api" | "캐시" }
   *   { ok:false, 코드, 안내, 끼니: {…저장해 둔 것이 있으면 그것…}, 출처: "캐시" }
   *
   * 🔴 실패해도 저장해 둔 것이 있으면 그것을 함께 돌려준다.
   *    학부모가 급식실 앞에서 열었는데 «오류» 만 나오면 아무 쓸모가 없다.
   */
  function 주간급식(시도, 학교, 월요일, 옵션) {
    옵션 = 옵션 || {};
    var D = 전역.DateUtil;
    var 시작 = D.ymd(월요일);
    var 끝 = D.ymd(D.날더하기(월요일, 4));
    var k = 열쇠(시도, 학교, 시작);

    var 뭉치 = 캐시읽기();
    var 있던것 = 뭉치[k];
    var 신선 = 있던것 && (Date.now() - (있던것.받은때 || 0)) < 유효기간(끝);

    if (신선 && !옵션.새로) {
      return Promise.resolve({ ok: true, 끼니: 있던것.끼니 || {}, 출처: "캐시" });
    }

    var url = 주소 + "?Type=json&pIndex=1&pSize=5" +
      "&ATPT_OFCDC_SC_CODE=" + encodeURIComponent(시도) +
      "&SD_SCHUL_CODE=" + encodeURIComponent(학교) +
      "&MMEAL_SC_CODE=" + 중식 +
      "&MLSV_FROM_YMD=" + 시작 +
      "&MLSV_TO_YMD=" + 끝;

    return 부르기(url).then(function (응답) {
      var 푼것 = 풀기(응답);

      // INFO-200 = «그 주에 등록된 급식이 없다». 오류가 아니라 «빈 주» 다.
      if (푼것.코드 === "INFO-200") {
        var 빈것 = {};
        뭉치[k] = { 받은때: Date.now(), 끼니: 빈것 };
        캐시쓰기(뭉치);
        return { ok: true, 끼니: 빈것, 출처: "api" };
      }

      if (푼것.코드 !== "INFO-000") {
        return {
          ok: false,
          코드: 푼것.코드,
          안내: 오류말(푼것.코드, 푼것.메시지),
          끼니: (있던것 && 있던것.끼니) || {},
          출처: 있던것 ? "캐시" : "없음",
        };
      }

      var 끼니 = {};
      푼것.행들.forEach(function (행) {
        var 한끼 = 한끼정리(행);
        if (한끼.날짜) 끼니[한끼.날짜] = 한끼;
      });

      뭉치[k] = { 받은때: Date.now(), 끼니: 끼니 };
      캐시쓰기(뭉치);
      return { ok: true, 끼니: 끼니, 출처: "api" };
    }).catch(function (e) {
      var 코드 = e && e.코드 ? e.코드 : "네트워크";
      return {
        ok: false,
        코드: 코드,
        안내: 오류말(코드, ""),
        끼니: (있던것 && 있던것.끼니) || {},
        출처: 있던것 ? "캐시" : "없음",
      };
    });
  }

  /** 저장해 둔 급식을 모두 지운다(설정에서 쓸 수 있게 열어 둔다) */
  function 캐시비우기() {
    try { localStorage.removeItem(캐시열쇠); } catch (e) { /* 무시 */ }
  }

  전역.Neis = {
    주간급식: 주간급식,
    캐시비우기: 캐시비우기,
    // 아래는 검사에서 쓴다
    _여러줄: 여러줄,
    _한끼정리: 한끼정리,
    _풀기: 풀기,
    _오류말: 오류말,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).Neis;
}
