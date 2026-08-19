/* =========================================================
   convert.js — 진수 변환 계산 (화면과 상관없는 순수 계산만 담는다)

   왜 파일을 나누었나?
     학습 화면(number.html)과 평가가 **같은 계산**을 써야 한다.
     한 곳에만 두면 "화면에서는 맞는데 채점은 틀리는" 일이 생기지 않는다.

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  var DIGITS = "0123456789ABCDEF";
  var BASES = [2, 4, 8, 10, 16];
  var NAMES = { 2: "2진수", 4: "4진수", 8: "8진수", 10: "10진수", 16: "16진수" };
  var MAX = 1023;                    // 다루는 값의 범위 : 0 ~ 1023 (2진수 10자리)

  /* 그 진수에서 쓸 수 있는 숫자 글자 (16진수는 A~F 까지) */
  function digitsOf(base) { return DIGITS.slice(0, base); }

  /* 그 진수로 1023 을 적으면 몇 자리인가 → 카드 개수·입력 길이 제한에 쓴다 */
  function widthOf(base) { return toBase(MAX, base).length; }

  /* 값 → 그 진수 문자열 */
  function toBase(n, base) {
    n = Math.floor(Number(n));
    if (!(n > 0)) return "0";
    var s = "";
    while (n > 0) {
      s = DIGITS.charAt(n % base) + s;
      n = Math.floor(n / base);
    }
    return s;
  }

  /* 그 진수 문자열 → 값. 글자가 하나라도 어긋나면 null 을 돌려준다(오류 대신). */
  function fromBase(str, base) {
    var s = String(str == null ? "" : str).trim().toUpperCase().replace(/\s+/g, "");
    if (s === "") return null;
    var v = 0;
    for (var i = 0; i < s.length; i++) {
      var d = DIGITS.indexOf(s.charAt(i));
      if (d < 0 || d >= base) return null;
      v = v * base + d;
    }
    return v;
  }

  function isValid(str, base) { return fromBase(str, base) !== null; }

  /* ---------------------------------------------------------
     어떤 방법으로 가르칠지 정한다 (조합만 보면 정해진다)
       10 → B      : 반복 나누기
       B → 10      : 자리값 곱셈
       2 ↔ 4·8·16  : 비트 묶기·쪼개기 (2진수 몇 자리가 한 글자가 되는지)
       4·8·16 끼리 : 2진수를 거쳐 두 번에 (펼치기 → 묶기)
     --------------------------------------------------------- */
  function methodOf(from, to) {
    if (from === to) return "same";
    /* 10진수 → 4진수는 **2진수를 거쳐 두 번에** 한다 (2026-08-19 사용자 지시).
       4로 반복해 나누는 것은 중1에게 익숙하지 않은데, 10→2 는 이미 배운 것이고
       2→4 는 **두 자리씩 묶기**만 하면 된다(4진수 한 자리 = 2비트).
       그래서 「두 방법 비교」(반복 나누기 vs 자리값 카드) 대신 이 방법을 보여 준다.
       ⚠ 10→8 · 10→16 은 아직 반복 나누기다 — 바꿀 때는 여기 한 줄만 늘린다. */
    if (from === 10 && to === 4) return "dec2";
    if (from === 10) return "divide";
    if (to === 10) return "place";
    if (from === 2 || to === 2) return "group";
    return "via2";
  }

  var METHOD_INFO = {
    divide: {
      name: "반복 나누기",
      how: "몫을 더 나눌 수 없을 때까지 나누고(2진수면 몫이 1), " +
           "마지막 몫과 나머지들을 아래에서 위로 거꾸로 읽습니다."
    },
    fill: {
      name: "자리값 카드로 채우기 (쉬운 방법)",
      how: "나누지 않고, 큰 자리값부터 몇 번 들어가는지 세어 카드에 적고 그만큼 뺍니다. " +
           "2진수라면 '쓸 수 있나 / 없나'만 판단하면 됩니다."
    },
    place: {
      name: "자리값 곱셈",
      how: "각 자리의 숫자에 그 자리의 자리값을 곱해서 모두 더합니다."
    },
    group: {
      name: "비트 묶기 · 쪼개기",
      how: "2진수 몇 자리가 한 글자가 되는지를 이용해 묶거나 쪼갭니다(중간 계산이 필요 없습니다)."
    },
    via2: {
      name: "2진수를 거쳐 두 번에",
      how: "먼저 2진수로 쪼갠 뒤, 그 2진수를 다시 묶습니다."
    },
    dec2: {
      name: "2진수를 거쳐 두 번에",
      how: "먼저 10진수를 2로 나누어 2진수로 바꾸고, 그 2진수를 오른쪽부터 두 자리씩 묶습니다. " +
           "이미 배운 두 가지를 이어서 하는 것이라 새로 배울 것이 없습니다."
    },
    same: {
      name: "같은 진수",
      how: "변환 전과 변환 후가 같습니다. 다른 진수를 골라 주세요."
    }
  };

  /* ---------------------------------------------------------
     ① 반복 나누기 단계 (10진수 n → base 진수)
        [{ value, quotient, remainder, digit }]  digit 은 A~F 를 반영한 글자
     --------------------------------------------------------- */
  function divideSteps(n, base) {
    var steps = [];
    n = Math.floor(Number(n));
    if (!(n > 0)) {
      return [{ value: 0, quotient: 0, remainder: null, digit: "", single: true, done: true }];
    }
    /* **교과서 절차**(동아출판 56쪽) : 몫이 더 나눌 수 없을 때까지 나눈다.
       2진수라면 "몫이 1이 될 때까지"와 같은 말이고, 4·8·16진수에도 그대로 통한다.
       마지막 몫은 맨 앞 자리 숫자가 되므로 readUp 이 그것부터 읽는다. */
    var v = n;
    while (v >= base) {
      var q = Math.floor(v / base);
      var r = v % base;
      steps.push({ value: v, quotient: q, remainder: r, digit: DIGITS.charAt(r), done: q < base });
      v = q;
    }
    if (steps.length === 0) {
      /* 이미 한 자리라 나눌 필요가 없다 (예 : 9 를 16진수로) */
      steps.push({ value: n, quotient: n, remainder: null, digit: "", single: true, done: true });
    }
    return steps;
  }

  /* 나누기 단계를 교과서대로 읽는다 — **마지막 몫**을 먼저, 그다음 나머지를 아래에서 위로.
     단계를 잘라 넘겨도(한 단계씩 보기) 그때까지의 읽기가 나온다. */
  function readUp(steps) {
    if (!steps || !steps.length) return "";
    var last = steps[steps.length - 1];
    if (last.single) return DIGITS.charAt(last.quotient);
    /* 아직 더 나눌 수 있는 단계까지만 잘라 넘긴 경우엔 나머지만 이어 준다
       (그 몫은 아직 한 자리가 아니어서 자리 숫자로 쓸 수 없다) */
    var s = last.done ? DIGITS.charAt(last.quotient) : "";
    for (var i = steps.length - 1; i >= 0; i--) s += steps[i].digit;
    return s;
  }

  /* ---------------------------------------------------------
     ①-2 자리값 카드로 채우기 (10진수 n → base 진수) — "쉬운 방법"
        나누지 않고, **큰 자리값부터 몇 번 들어가는지** 세어 카드에 적고 그만큼 뺀다.
        2진수에서는 몫이 0 또는 1 뿐이라 "쓸 수 있나 / 없나" 판단이 된다.

        placesOf(n, base) : n 보다 작거나 같은 가장 큰 자리값부터 1까지
        fillSteps(n, base) : [{ place, pw, count, digit, before, after, tooBig }]
          count  = 그 자리값이 몇 번 들어가는가(= 그 자리 숫자)
          tooBig = 남은 수보다 자리값이 커서 쓸 수 없는 자리(카드에 × 를 보여 준다)
     --------------------------------------------------------- */
  function placesOf(n, base) {
    var places = [];
    var top = 1, pw = 0;
    n = Math.floor(Number(n));
    if (!(n > 0)) return [{ place: 1, pw: 0 }];
    while (top * base <= n) { top *= base; pw++; }
    for (var p = top, k = pw; p >= 1; p = p / base, k--) places.push({ place: p, pw: k });
    return places;
  }

  function fillSteps(n, base) {
    var rest = Math.floor(Number(n));
    if (!(rest > 0)) rest = 0;
    return placesOf(rest, base).map(function (pl) {
      var count = Math.floor(rest / pl.place);
      var before = rest;
      rest = rest - count * pl.place;
      return {
        place: pl.place, pw: pl.pw, count: count, digit: DIGITS.charAt(count),
        before: before, after: rest, tooBig: count === 0
      };
    });
  }

  /* ---------------------------------------------------------
     ② 자리값 곱셈 단계 (base 진수 문자열 → 10진수)
        [{ char, digit, place, product, sum }]  sum 은 그때까지의 누적 합
     --------------------------------------------------------- */
  function placeSteps(str, base) {
    var s = String(str).trim().toUpperCase();
    var out = [];
    var sum = 0;
    for (var i = 0; i < s.length; i++) {
      var d = DIGITS.indexOf(s.charAt(i));
      var place = Math.pow(base, s.length - 1 - i);
      var product = d * place;
      sum += product;
      out.push({ char: s.charAt(i), digit: d, place: place, product: product, sum: sum });
    }
    return out;
  }

  /* ---------------------------------------------------------
     ③ 비트 묶기 · 쪼개기
        4진수 = 2자리, 8진수 = 3자리, 16진수 = 4자리씩 짝이 된다.
     --------------------------------------------------------- */
  function bitsPer(base) {
    if (base === 4) return 2;
    if (base === 8) return 3;
    if (base === 16) return 4;
    if (base === 2) return 1;
    return 0;                        // 10진수는 2의 거듭제곱이 아니라 묶을 수 없다
  }

  function padLeft(s, len) {
    s = String(s);
    while (s.length < len) s = "0" + s;
    return s;
  }

  /* 2진수 문자열을 k 자리씩 묶는다(왼쪽은 0으로 채운다) → [{bits, digit, value}] */
  function groupBits(bin, k) {
    var s = String(bin).replace(/\s+/g, "");
    var need = Math.ceil(s.length / k) * k;
    s = padLeft(s, need);
    var out = [];
    for (var i = 0; i < s.length; i += k) {
      var bits = s.substr(i, k);
      var v = parseInt(bits, 2);
      out.push({ bits: bits, digit: DIGITS.charAt(v), value: v });
    }
    return out;
  }

  /* base 진수 문자열의 각 글자를 k 자리 2진수로 쪼갠다 → [{digit, value, bits}] */
  function splitDigits(str, base) {
    var k = bitsPer(base);
    var s = String(str).trim().toUpperCase();
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var v = DIGITS.indexOf(s.charAt(i));
      out.push({ digit: s.charAt(i), value: v, bits: padLeft(v.toString(2), k) });
    }
    return out;
  }

  /* 앞의 0을 없앤다("0000" 은 "0" 으로) — 묶기 결과를 읽기 좋게 */
  function trimZero(s) {
    var t = String(s).replace(/^0+/, "");
    return t === "" ? "0" : t;
  }

  global.Convert = {
    DIGITS: DIGITS,
    BASES: BASES,
    NAMES: NAMES,
    MAX: MAX,
    METHOD_INFO: METHOD_INFO,
    digitsOf: digitsOf,
    widthOf: widthOf,
    placesOf: placesOf,
    fillSteps: fillSteps,
    toBase: toBase,
    fromBase: fromBase,
    isValid: isValid,
    methodOf: methodOf,
    divideSteps: divideSteps,
    readUp: readUp,
    placeSteps: placeSteps,
    bitsPer: bitsPer,
    groupBits: groupBits,
    splitDigits: splitDigits,
    padLeft: padLeft,
    trimZero: trimZero
  };
})(window);
