/**
 * 날짜 셈 — 컴퓨터 날짜를 읽고, 주 단위로 앞뒤로 움직인다.
 *
 * 🔴 여기서는 시간(시·분)을 절대 쓰지 않는다.
 *    new Date("2026-09-01") 처럼 만들면 «세계 표준시 자정» 으로 읽혀
 *    우리나라에서는 8월 31일 아침 9시가 된다(하루가 밀린다).
 *    그래서 언제나 new Date(년, 월, 일) 로만 만든다.
 */

(function (전역) {
  "use strict";

  var 요일글자 = ["일", "월", "화", "수", "목", "금", "토"];

  /** 시·분·초를 떼어 낸 «날짜만» 으로 만든다 */
  function 날짜만(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /** 컴퓨터가 아는 오늘 */
  function 오늘() {
    return 날짜만(new Date());
  }

  /**
   * 그 날이 속한 주의 «월요일».
   * 일요일은 그 주의 마지막 날이므로 엿새 전 월요일로 간다.
   */
  function 주시작(d) {
    var x = 날짜만(d);
    var 요일 = x.getDay();              // 0=일 1=월 … 6=토
    var 뒤로 = 요일 === 0 ? 6 : 요일 - 1;
    x.setDate(x.getDate() - 뒤로);
    return x;
  }

  /**
   * 앱을 열었을 때 «처음 보여 줄 주».
   *
   * 토요일·일요일에 열면 이번 주 급식은 이미 다 끝났다.
   * 그때는 다음 주를 보여 준다 — 주말에 궁금한 것은 «내일 뭐 먹지» 이기 때문이다.
   * (그 주 식단이 아직 안 올라왔으면 화면이 «아직 등록되지 않았습니다» 를 안내한다.)
   */
  function 처음볼주(오늘날) {
    var 오 = 날짜만(오늘날 || new Date());
    var 요일 = 오.getDay();
    if (요일 === 0 || 요일 === 6) {      // 일 · 토
      return 주더하기(주시작(오), 1);
    }
    return 주시작(오);
  }

  /** 주 단위로 옮기기. n 이 음수면 지난 주 쪽으로. */
  function 주더하기(월요일, n) {
    var x = 날짜만(월요일);
    x.setDate(x.getDate() + n * 7);
    return x;
  }

  /** 하루 단위로 옮기기 */
  function 날더하기(d, n) {
    var x = 날짜만(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  /** 그 주의 월~금 다섯 날. 주말은 급식이 없으므로 담지 않는다. */
  function 평일들(월요일) {
    var 모음 = [];
    for (var i = 0; i < 5; i++)모음.push(날더하기(월요일, i));
    return 모음;
  }

  /** Date → "20260901" (NEIS 가 쓰는 모양) */
  function ymd(d) {
    var x = 날짜만(d);
    var 월 = x.getMonth() + 1;
    var 일 = x.getDate();
    return "" + x.getFullYear() + (월 < 10 ? "0" : "") + 월 + (일 < 10 ? "0" : "") + 일;
  }

  /** "20260901" → Date. 모양이 틀리면 null. */
  function ymd읽기(글) {
    var s = String(글 == null ? "" : 글).trim();
    if (!/^\d{8}$/.test(s)) return null;
    var 년 = +s.slice(0, 4), 월 = +s.slice(4, 6), 일 = +s.slice(6, 8);
    if (월 < 1 || 월 > 12 || 일 < 1 || 일 > 31) return null;
    var d = new Date(년, 월 - 1, 일);
    // 2월 31일 같은 «없는 날» 은 다른 날로 굴러가므로 되짚어 확인한다.
    if (d.getFullYear() !== 년 || d.getMonth() !== 월 - 1 || d.getDate() !== 일) return null;
    return d;
  }

  /** Date → "2026-09-01" (달력 입력칸이 쓰는 모양) */
  function 입력값(d) {
    var s = ymd(d);
    return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  }

  /** "2026-09-01" → Date */
  function 입력값읽기(글) {
    var s = String(글 == null ? "" : 글).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return ymd읽기(s.replace(/-/g, ""));
  }

  /** 요일 한 글자 */
  function 요일(d) {
    return 요일글자[날짜만(d).getDay()];
  }

  /** "9월 1일 (월)" */
  function 짧게(d) {
    var x = 날짜만(d);
    return (x.getMonth() + 1) + "월 " + x.getDate() + "일 (" + 요일(x) + ")";
  }

  /** 그 주를 한 줄로. 해가 바뀌는 주도 알아볼 수 있게 앞쪽에만 연도를 붙인다. */
  function 주이름(월요일) {
    var 시 = 날짜만(월요일);
    var 끝 = 날더하기(시, 4);
    var 앞 = 시.getFullYear() + ". " + (시.getMonth() + 1) + ". " + 시.getDate();
    var 뒤 = (시.getFullYear() === 끝.getFullYear() ? "" : 끝.getFullYear() + ". ") +
             (끝.getMonth() + 1) + ". " + 끝.getDate();
    return 앞 + " ~ " + 뒤;
  }

  /** 두 날이 같은 날인가 */
  function 같은날(a, b) {
    if (!a || !b) return false;
    return ymd(a) === ymd(b);
  }

  /** 그 날이 그 주(월~금) 안에 있는가 — «오늘» 을 강조할지 정할 때 쓴다 */
  function 주안에(월요일, 날) {
    if (!날) return false;
    var s = ymd(월요일);
    var e = ymd(날더하기(월요일, 4));
    var t = ymd(날);
    return t >= s && t <= e;
  }

  전역.DateUtil = {
    요일글자: 요일글자,
    날짜만: 날짜만,
    오늘: 오늘,
    주시작: 주시작,
    처음볼주: 처음볼주,
    주더하기: 주더하기,
    날더하기: 날더하기,
    평일들: 평일들,
    ymd: ymd,
    ymd읽기: ymd읽기,
    입력값: 입력값,
    입력값읽기: 입력값읽기,
    요일: 요일,
    짧게: 짧게,
    주이름: 주이름,
    같은날: 같은날,
    주안에: 주안에,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).DateUtil;
}
