/* 학번 알아내기 ─ 사진 옆에 적힌 글자에서 학년·반·번호·이름을 뽑는다.
 *
 * 이 앱이 다루는 PDF 는 형식이 제각각이다. NEIS 출력물은 「1학년 1반 3번」 처럼
 * 풀어서 적지만, 업체 시안은 「10103」·「1-1-3」·「3번 홍길동」 일 수 있다.
 * 그래서 여러 형식을 모두 시도해 보고 「가장 많이 맞은 것」 을 고른다.
 *
 * 🔴 화면(DOM)을 쓰지 않는다 — 브라우저 없이 검사할 수 있어야 한다.
 */
(function (root) {
  "use strict";

  var 한글 = "가-힣";

  // 이름이 아닌 것으로 걸러 낼 낱말 (머리글·안내문에 흔히 나온다)
  var 이름아님 = /^(학년|반|번|번호|성명|이름|사진|학생|남|여|계|합계|비고|담임|출력|년|월|일|쪽|페이지)$/;

  /* ── 형식 목록 ──────────────────────────────────────────────
   * 위에 있을수록 더 많은 정보를 담고 있어 먼저 시도한다.
   * re 는 「한 덩어리의 글자」 하나에 대고 본다.
   */
  var PATTERNS = [
    {
      key: "말로풀어씀",
      label: "N학년 N반 N번",
      보기: "1학년 1반 3번",
      re: new RegExp("(\\d{1,2})\\s*\\ud559\\ub144\\s*(\\d{1,2})\\s*\\ubc18\\s*(\\d{1,3})\\s*\\ubc88"),
      take: function (m) { return { grade: +m[1], cls: +m[2], num: +m[3] }; }
    },
    {
      key: "구분자",
      label: "N-N-N",
      보기: "1-1-3 · 1.1.3",
      re: /(?:^|[^\d])(\d{1,2})\s*[-.·/]\s*(\d{1,2})\s*[-.·/]\s*(\d{1,3})(?![\d])/,
      take: function (m) { return { grade: +m[1], cls: +m[2], num: +m[3] }; }
    },
    {
      key: "다섯자리",
      label: "5자리 학번",
      보기: "10103",
      re: /(?:^|[^\d])(\d)(\d{2})(\d{2})(?![\d])/,
      take: function (m) { return { grade: +m[1], cls: +m[2], num: +m[3] }; }
    },
    {
      key: "네자리",
      label: "4자리 학번",
      보기: "1103",
      re: /(?:^|[^\d])(\d)(\d)(\d{2})(?![\d])/,
      take: function (m) { return { grade: +m[1], cls: +m[2], num: +m[3] }; }
    },
    {
      key: "반번호",
      label: "N반 N번",
      보기: "1반 3번",
      re: new RegExp("(\\d{1,2})\\s*\\ubc18\\s*(\\d{1,3})\\s*\\ubc88"),
      take: function (m) { return { cls: +m[1], num: +m[2] }; }
    },
    {
      key: "번호만",
      label: "N번",
      보기: "3번",
      re: new RegExp("(?:^|[^\\d])(\\d{1,3})\\s*\\ubc88(?![\\uD638])"), // 「3번」 ─ 「번호」 는 제외
      take: function (m) { return { num: +m[1] }; }
    },
    {
      key: "숫자만",
      label: "숫자만",
      보기: "3",
      re: /^\s*(\d{1,3})\s*$/,
      take: function (m) { return { num: +m[1] }; }
    }
  ];

  /* 글자 덩어리 하나에서 이름을 찾는다.
   * 한글 2~5자이면서, 숫자·「학년/반/번」 같은 낱말이 아닌 것. */
  function 이름찾기(t) {
    if (!t) return null;
    var s = String(t).trim();
    // 「1학년 1반 3번 홍길동」 처럼 한 줄에 같이 있으면 뒤쪽 한글 덩어리를 집는다
    var all = s.match(new RegExp("[" + 한글 + "]{2,5}", "g"));
    if (!all) return null;
    for (var i = all.length - 1; i >= 0; i--) {
      if (!이름아님.test(all[i])) {
        // 「홍길동」 앞뒤에 숫자가 붙어 있어도 이름만 돌려준다
        return all[i];
      }
    }
    return null;
  }

  /* 글자 덩어리 여러 개(한 사람 몫)에서 학번 조각과 이름을 뽑는다.
   * pat 를 주면 그 형식만 쓰고, 안 주면 위에서부터 처음 맞는 것을 쓴다. */
  function 한사람(texts, pat) {
    var got = null, name = null, used = null;
    var list = pat ? [pat] : PATTERNS;

    for (var p = 0; p < list.length && !got; p++) {
      for (var i = 0; i < texts.length; i++) {
        var m = list[p].re.exec(String(texts[i] || ""));
        if (m) { got = list[p].take(m); used = list[p].key; break; }
      }
    }
    // 이름은 학번과 다른 덩어리에 있을 수도, 같은 덩어리에 있을 수도 있다
    for (var j = 0; j < texts.length && !name; j++) name = 이름찾기(texts[j]);

    if (!got && !name) return null;
    return { part: got, name: name, pattern: used };
  }

  /* 여러 사람 몫을 놓고 「어느 형식이 가장 잘 맞나」 를 투표로 정한다. */
  function 형식고르기(사람들) {
    var 점수 = [];
    for (var p = 0; p < PATTERNS.length; p++) {
      var hit = 0;
      for (var i = 0; i < 사람들.length; i++) {
        var ts = 사람들[i];
        for (var k = 0; k < ts.length; k++) {
          if (PATTERNS[p].re.test(String(ts[k] || ""))) { hit++; break; }
        }
      }
      점수.push({ key: PATTERNS[p].key, label: PATTERNS[p].label, 보기: PATTERNS[p].보기, hit: hit, pat: PATTERNS[p] });
    }
    // 많이 맞은 것 우선, 같으면 목록에서 위에 있는(정보가 많은) 것 우선
    점수.sort(function (a, b) { return b.hit - a.hit; });
    return 점수;
  }

  /* 학년·반·번호 → 5자리 학번.
   * 반과 번호는 두 자리로 채운다 (3학년 1반 12번 → 30112).
   *
   * 🚨 말이 되는 값인지 반드시 본다. 예전에는 0 이나 큰 수를 그대로 받아
   *    「01024」 같은 학번이 만들어졌고, 저장할 때 **「0학년 10반」 폴더**가 생겼다.
   *    오류가 나지 않아 폴더를 열어 보기 전에는 알 수 없다. */
  function 학번만들기(part, 기본) {
    if (!part) return null;
    var g = part.grade, c = part.cls, n = part.num;
    if (g == null && 기본) g = 기본.grade;
    if (c == null && 기본) c = 기본.cls;
    if (g == null || c == null || n == null) return null;
    if (!(g >= 1 && g <= 6)) return null;       // 학년은 1~6 (0학년은 없다)
    if (!(c >= 1 && c <= 99)) return null;      // 반은 1~99
    if (!(n >= 1 && n <= 99)) return null;      // 번호는 1~99 (두 자리를 넘으면 5자리에 못 담는다)
    return String(g) + 두자리(c) + 두자리(n);
  }

  /* 손으로 적어 넣은 학번이 말이 되나 */
  function 학번맞나(sid) {
    if (!/^\d{5}$/.test(sid)) return false;
    return 학번만들기({ grade: +sid[0], cls: +sid.slice(1, 3), num: +sid.slice(3) }) === sid;
  }

  function 두자리(n) { return (n < 10 ? "0" : "") + n; }

  /* 파일 이름에서 학년·반을 짐작한다 ─ 「사진_1-1.pdf」·「1학년 2반.pdf」 */
  function 파일이름에서(name) {
    if (!name) return null;
    var s = String(name).replace(/\.[a-zA-Z]+$/, "");
    var m = new RegExp("(\\d{1,2})\\s*\\ud559\\ub144\\s*(\\d{1,2})\\s*\\ubc18").exec(s);
    if (m) return { grade: +m[1], cls: +m[2] };
    m = /(?:^|[^\d])(\d)\s*[-_.]\s*(\d{1,2})(?![\d])/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 6 && +m[2] >= 1 && +m[2] <= 20) return { grade: +m[1], cls: +m[2] };
    return null;
  }

  /* 5자리 학번 → 「1학년 1반」 (저장 폴더 이름에 쓴다) */
  function 반이름(sid, 기본) {
    if (학번맞나(sid)) {
      return (+sid[0]) + "학년 " + (+sid.slice(1, 3)) + "반";
    }
    if (기본 && 기본.grade != null && 기본.cls != null) {
      return 기본.grade + "학년 " + 기본.cls + "반";
    }
    return null;
  }

  root.IdParse = {
    PATTERNS: PATTERNS,
    한사람: 한사람,
    이름찾기: 이름찾기,
    형식고르기: 형식고르기,
    학번만들기: 학번만들기,
    학번맞나: 학번맞나,
    파일이름에서: 파일이름에서,
    반이름: 반이름
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
