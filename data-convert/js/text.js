/* =========================================================
   text.js — 글자(문자) 변환 계산과 코드표 자료

   영어는 **아스키코드**, 한글은 **유니코드**를 쓴다.
   화면과 상관없는 계산·자료만 담아서 학습 화면과 평가가 같은 것을 쓰게 한다.

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  /* 한글 완성형(가~힣) 유니코드 범위 */
  var HAN_BASE = 0xAC00;          // '가' = 44032
  var HAN_END  = 0xD7A3;          // '힣' = 55203
  var HAN_COUNT = HAN_END - HAN_BASE + 1;   // 11172자

  /* 초성 19 · 중성 21 · 종성 28 (순서가 곧 번호다) */
  var CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  var JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  var JONG = ["없음","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ",
              "ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

  /* 글자 종류 구분 */
  function kindOf(ch) {
    var c = ch.codePointAt(0);
    if (c === 32) return "space";
    if (c >= 33 && c <= 126) return "ascii";              // 눈에 보이는 아스키 문자
    if (c >= HAN_BASE && c <= HAN_END) return "hangul";   // 완성형 한글
    if (c >= 0x3131 && c <= 0x318E) return "jamo";        // 낱자(ㄱ, ㅏ …)
    return "other";
  }

  var KIND_NAME = {
    ascii: "영어·기호 (아스키코드)",
    space: "공백 (아스키코드)",
    hangul: "한글 (유니코드)",
    jamo: "한글 낱자 (유니코드)",
    other: "그 밖의 문자 (유니코드)"
  };

  /* 그 글자를 몇 비트로 보여 줄지 — **교과서 기준**이다.
       아스키 코드  : 7비트 (동아출판 59쪽 "7비트를 사용하여 128(2⁷)개")
       유니코드     : 16비트 = 2바이트 (같은 쪽 "하나의 문자를 16비트(2바이트)로 표현")
     ⚠ 예전에는 아스키를 8비트로 두었는데, 교과서 아스키 코드표(상위 3비트 + 하위 4비트)와
       지도서 예시답안(LOVE = 1001100(2) …)이 모두 **7자리**라 7로 바꿨다.
       실제 저장은 1바이트(8비트)이므로 앞에 0을 하나 더 붙인 8자리도 정답으로 인정한다. */
  function bitsFor(ch) {
    var k = kindOf(ch);
    return (k === "ascii" || k === "space") ? 7 : 16;
  }

  /* 16진수로 적을 때 몇 자리인가 — 아스키 41(16) 2자리, 유니코드 AC00(16) 4자리 */
  function hexLen(bits) { return bits === 7 ? 2 : 4; }

  function codeOf(ch) { return ch.codePointAt(0); }

  function padLeft(s, n) {
    s = String(s);
    while (s.length < n) s = "0" + s;
    return s;
  }

  /* 2진수 문자열. 읽기 쉽게 빈칸을 넣어 준다(group=true).
     7비트는 **상위 3비트 + 하위 4비트**로 끊는다 — 교과서 아스키 코드표(ZONE·DGT)와 같은 모양이다. */
  function toBin(code, bits, group) {
    var s = padLeft(code.toString(2), bits);
    if (!group) return s;
    if (bits === 7) return s.slice(0, 3) + " " + s.slice(3);
    return s.replace(/(.{4})(?=.)/g, "$1 ");
  }

  function toHex(code, bits) {
    return padLeft(code.toString(16).toUpperCase(), hexLen(bits));
  }

  /* ---------------------------------------------------------
     4진수 — **코드표에 적는 값**이다 (2026-08-12 사용자 지시)

     왜 10진수가 아니고 4진수인가?
       한글 유니코드는 44032~55203 이라 10진수로 주면 **16으로 계속 나눠야** 한다.
       중1에게 `49324 ÷ 16` 을 네 번 하게 하는 것은 무겁다.
       4진수는 **한 자리가 정확히 2비트**여서 자리를 묶거나 펼치기만 하면 된다 —
         0 → 00 · 1 → 01 · 2 → 10 · 3 → 11
         4진수 2자리 = 16진수 1자리   (예 30 → 1100 → C)
       그래서 `사 = 30002230(4)` → 2자리씩 묶으면 곧바로 `C0AC(16)` 이 된다.
       숫자 변환 영역에서 배운 **비트 묶기·쪼개기**가 그대로 쓰인다.

     자릿수 : 아스키는 1바이트(8비트) = **4자리**, 유니코드는 16비트 = **8자리**.
       (아스키 코드는 7비트지만 4진수 한 자리가 2비트라 홀수로는 딱 맞지 않는다.
        4진수 4자리 → 2진수 8자리로 펼친 뒤 **앞의 0 하나를 떼면** 7자리 아스키 코드다.)
     --------------------------------------------------------- */
  function quadLen(bits) { return bits === 7 ? 4 : 8; }
  function toQuad(code, bits) { return padLeft(code.toString(4), quadLen(bits)); }

  /* 4진수 한 자리 ↔ 2비트 대응표 (화면에 그대로 보여 준다) */
  var QUAD_BITS = [
    { q: "0", b: "00" }, { q: "1", b: "01" }, { q: "2", b: "10" }, { q: "3", b: "11" }
  ];

  /* 교과서 표기법 — 21(10) = 10101(2), 0041(16) 처럼 진수를 괄호로 적는다.
     PDF 에도 그대로 들어가야 해서 HTML 태그 없이 글자만 쓴다. */
  var BASE_OF = { bin: 2, quad: 4, dec: 10, hex: 16 };
  function notate(text, target) { return text + "(" + (BASE_OF[target] || target) + ")"; }

  /* ---------------------------------------------------------
     한글 자모 분해
       코드값 − 44032 = ((초성번호 × 21) + 중성번호) × 28 + 종성번호
     --------------------------------------------------------- */
  function decompose(ch) {
    var c = codeOf(ch);
    if (c < HAN_BASE || c > HAN_END) return null;
    var idx = c - HAN_BASE;
    var cho = Math.floor(idx / 588);
    var jung = Math.floor((idx % 588) / 28);
    var jong = idx % 28;
    return {
      code: c, idx: idx,
      choIdx: cho, jungIdx: jung, jongIdx: jong,
      cho: CHO[cho], jung: JUNG[jung], jong: JONG[jong],
      /* 계산 과정을 그대로 문장으로 만들어 준다 */
      formula: "44032 + (" + cho + " × 588) + (" + jung + " × 28) + " + jong +
               " = " + (HAN_BASE + cho * 588 + jung * 28 + jong)
    };
  }

  /* 자모 번호로 글자를 만든다(표에서 눌러 볼 때 쓴다) */
  function compose(cho, jung, jong) {
    return String.fromCharCode(HAN_BASE + (cho * 21 + jung) * 28 + jong);
  }

  /* ---------------------------------------------------------
     글자 하나의 정보 묶음
     --------------------------------------------------------- */
  function infoOf(ch) {
    var k = kindOf(ch);
    var bits = bitsFor(ch);
    var code = codeOf(ch);
    return {
      ch: ch, kind: k, kindName: KIND_NAME[k],
      code: code, bits: bits,
      dec: String(code),
      /* 코드표에 적는 값 — 4진수 (아스키 4자리 · 유니코드 8자리) */
      quad: toQuad(code, bits),
      hex: toHex(code, bits),
      bin: toBin(code, bits, true),
      binRaw: toBin(code, bits, false),
      /* 실제 저장 형태 — 아스키 7비트도 컴퓨터는 1바이트(8비트)에 담는다(앞에 0 하나).
         지도서 : "초기에는 7비트의 문자 코드와 1비트의 패리티 비트를 합쳐 8비트(1바이트)" */
      storeBits: (bits === 7) ? 8 : 16,
      storeBin: padLeft(code.toString(2), (bits === 7) ? 8 : 16),
      bytes: (bits === 7) ? 1 : 2,
      /* 유니코드로 적은 모양 — 영어 글자도 유니코드로는 16비트·16진수 4자리다.
         교과서 59쪽 「'A'의 다양한 표현 방법」 : 아스키 1000001(2) / 유니코드 0041(16) */
      uniHex: padLeft(code.toString(16).toUpperCase(), 4),
      uniBin: padLeft(code.toString(2), 16),
      hangul: (k === "hangul") ? decompose(ch) : null
    };
  }

  /* 문자열 전체 → 글자별 정보 목록 */
  function infoList(str) {
    return Array.from(String(str || "")).map(infoOf);
  }

  /* ---------------------------------------------------------
     코드 → 글자 (되돌리기)
       학습 화면에서 **코드를 넣어 글자를 찾는 방향**을 배울 때 쓴다.
       교과서 59쪽 활동의 "전달받은 아스키 코드 → 전달받은 문자" 쪽이다.

       raw  : 빈칸·쉼표로 나눈 코드 여러 개 ("1000001 1000010" · "C0AC B791" · "65 66")
       base : "bin" | "dec" | "hex"
       돌려주는 것 : { chars, items, errors }
         items  : [{ text, code, ch, ok, why }]  — 코드 하나마다 성공/실패를 알려 준다
         errors : 잘못된 조각의 안내 문구 목록
     --------------------------------------------------------- */
  var BASE_NUM = { bin: 2, quad: 4, dec: 10, hex: 16 };
  var BASE_OK = {
    bin: /^[01]+$/,
    quad: /^[0-3]+$/,
    dec: /^[0-9]+$/,
    hex: /^[0-9A-F]+$/
  };
  var BASE_UNIT = { bin: "0과 1", quad: "0 · 1 · 2 · 3", dec: "0~9 숫자", hex: "0~9 와 A~F" };
  var NAMES_KO = { bin: "2진수", quad: "4진수", dec: "10진수", hex: "16진수" };

  /* 이 앱이 다루는 글자 범위 — 그 밖의 코드는 받지 않고 이유를 알려 준다 */
  function inTaughtRange(code) {
    if (code >= 32 && code <= 126) return true;                 // 영어·숫자·기호 (아스키)
    if (code >= HAN_BASE && code <= HAN_END) return true;       // 한글 완성형
    if (code >= 0x3131 && code <= 0x318E) return true;          // 한글 낱자 (ㄱ, ㅏ …)
    return false;
  }

  function parseCodes(raw, base) {
    var b = BASE_NUM[base] ? base : "dec";
    var parts = String(raw == null ? "" : raw).trim().toUpperCase()
      .replace(/U\+/g, "").replace(/0X/g, "")                   // U+AC00 · 0xAC00 도 받는다
      .split(/[\s,·]+/).filter(function (s) { return s !== ""; });
    var items = [], errors = [], chars = "";
    parts.forEach(function (p) {
      var item = { text: p, code: null, ch: null, ok: false, why: "" };
      if (!BASE_OK[b].test(p)) {
        item.why = "\"" + p + "\" 은(는) " + NAMES_KO[b] + "로 쓸 수 없습니다 (" + BASE_UNIT[b] + "만).";
      } else {
        var code = parseInt(p, BASE_NUM[b]);
        item.code = code;
        if (!inTaughtRange(code)) {
          item.why = "코드 " + code + " — 이 학습기가 다루는 범위 밖입니다 " +
                     "(영어·기호 32~126 · 한글 44032~55203).";
        } else {
          item.ok = true;
          item.ch = String.fromCharCode(code);
          chars += item.ch;
        }
      }
      if (!item.ok) errors.push(item.why);
      items.push(item);
    });
    return { chars: chars, items: items, errors: errors };
  }

  /* ---------------------------------------------------------
     아스키코드 표 자료 (눈에 보이는 32~126)
       화면에서 묶어 보여 주기 좋게 네 덩이로 나눈다.
     --------------------------------------------------------- */
  var ASCII_GROUPS = [
    { key: "digit", name: "숫자", from: 48, to: 57 },
    { key: "upper", name: "영어 대문자", from: 65, to: 90 },
    { key: "lower", name: "영어 소문자", from: 97, to: 122 },
    { key: "sym1", name: "기호 (32~47)", from: 32, to: 47 },
    { key: "sym2", name: "기호 (58~64)", from: 58, to: 64 },
    { key: "sym3", name: "기호 (91~96)", from: 91, to: 96 },
    { key: "sym4", name: "기호 (123~126)", from: 123, to: 126 }
  ];

  function asciiGroup(key) {
    var g = ASCII_GROUPS.filter(function (x) { return x.key === key; })[0];
    if (!g) return null;
    var rows = [];
    for (var c = g.from; c <= g.to; c++) rows.push(infoOf(String.fromCharCode(c)));
    return { key: g.key, name: g.name, rows: rows };
  }

  /* 그 글자가 속한 아스키 묶음을 찾아 준다(평가에서 참고표를 붙일 때 쓴다) */
  function groupOfChar(ch) {
    var c = codeOf(ch);
    for (var i = 0; i < ASCII_GROUPS.length; i++) {
      var g = ASCII_GROUPS[i];
      if (c >= g.from && c <= g.to) return asciiGroup(g.key);
    }
    return null;
  }

  /* ---------------------------------------------------------
     문제에 쓰는 낱말 자료
       수준을 **글자 수**로 나누므로(하 1글자 / 중 2~3글자 / 상 4~5글자)
       길이별로 낱말이 골고루 있어야 한다.
       뜻 없는 무작위 글자 대신 **수업에서 쓰는 말**을 골라 두었다.
     --------------------------------------------------------- */
  var WORDS = {
    en: [
      "A", "B", "C", "G", "K", "M", "Q", "Z", "a", "d", "g", "k", "m", "q", "z", "0", "3", "5", "7", "9",
      "AI", "OK", "Hi", "ID", "up", "go", "on", "no",
      "CPU", "USB", "RGB", "bit", "web", "app", "key", "dot", "net", "run",
      "byte", "code", "data", "file", "link", "node", "port", "user", "text", "bits",
      "input", "pixel", "sound", "logic", "robot", "image", "cloud", "digit"
    ],
    ko: [
      "가", "글", "별", "달", "산", "꽃", "눈", "비", "해", "물", "밤", "빛",
      "한글", "정보", "학교", "코딩", "자료", "숫자", "문자", "화면", "그림", "소리",
      "컴퓨터", "데이터", "디지털", "자료실", "하늘색", "이진법",
      "정보수업", "인공지능", "컴퓨터실", "이진숫자", "코딩교실",
      "디지털자료", "정보처리반", "이진법변환"
    ]
  };

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* 길이가 맞는 낱말 하나 (kind : "en" | "ko") */
  function pickWord(kind, minLen, maxLen) {
    var all = WORDS[kind === "ko" ? "ko" : "en"];
    var pool = all.filter(function (w) { return w.length >= minLen && w.length <= maxLen; });
    return pick(pool.length ? pool : all);
  }

  /* 영어 + 한글을 이어 붙여 섞인 문제를 만든다 (평가용)
     1글자짜리는 섞을 수 없어 한 종류만 돌려준다. */
  function pickMixed(minLen, maxLen) {
    if (maxLen < 2) return pickWord(Math.random() < 0.5 ? "en" : "ko", 1, 1);
    for (var t = 0; t < 60; t++) {
      var need = randInt(Math.max(2, minLen), maxLen);
      var enLen = randInt(1, need - 1);
      var koLen = need - enLen;
      var en = pickWord("en", enLen, enLen);
      var ko = pickWord("ko", koLen, koLen);
      if (en.length === enLen && ko.length === koLen) {
        return Math.random() < 0.5 ? (en + ko) : (ko + en);
      }
    }
    return pickWord("en", 1, 1) + pickWord("ko", 1, 1);
  }

  /* 어떤 진수로 답하게 할지는 **글자 종류가 정한다** — 교과서를 그대로 따른다.
       영어  : 아스키 코드  → 2진수 7자리   (59쪽 활동 "전달할 아스키 코드")
       한글  : 유니코드     → 16진수 4자리  (59쪽 활동 "변환된 유니코드", 예시답안 사 C0AC(16))
       섞임  : 유니코드로 통일 → 16진수 4자리 (영어도 유니코드로는 4자리 — 'A' = 0041(16))
     ⚠ 10진수는 **답으로 쓰지 않는다.** 코드표에 적어 주는 값이 10진수라 답까지 10진수면
       변환이 아니라 베끼기가 되고, 단원평가 3번 ③ "문자는 십진수로 표현된다"가 틀린 보기다. */
  function targetFor(kind) { return kind === "en" ? "bin" : "hex"; }

  /* 코드 → 글자 문제에 쓸 '후보 글자' — 정답 글자에 같은 종류 글자를 섞어 표를 만든다.
     한글은 11,172자를 다 보여줄 수 없어(교과서는 표를 내려받아 Ctrl+F 로 찾는다)
     뜻 있는 글자만 모아 코드값 순으로 늘어놓는다. */
  function candidates(word, extra) {
    /* 같은 글자가 두 번 나오는 낱말("data" 의 a, "app" 의 p)도 표에는 한 번만 넣는다 */
    var want = Array.from(String(word || "")).filter(function (c, i, a) { return a.indexOf(c) === i; });
    var hasKo = want.some(function (c) { return kindOf(c) === "hangul"; });
    var hasEn = want.some(function (c) { return kindOf(c) !== "hangul"; });
    var pool = [];
    if (hasKo) {
      WORDS.ko.forEach(function (w) {
        Array.from(w).forEach(function (c) { if (pool.indexOf(c) === -1) pool.push(c); });
      });
    }
    if (hasEn) {
      WORDS.en.forEach(function (w) {
        Array.from(w).forEach(function (c) { if (pool.indexOf(c) === -1) pool.push(c); });
      });
    }
    pool = pool.filter(function (c) { return want.indexOf(c) === -1; });
    var out = want.slice();
    var n = Math.max(0, (extra == null ? 6 : extra));
    for (var i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    /* 코드값 순으로 정렬 — 표에서 찾기 쉽게 (교과서 코드표도 코드값 순이다) */
    return out.sort(function (a, b) { return codeOf(a) - codeOf(b); });
  }

  /* (예전 방식) 낱글자 뽑기 — 학습 화면 예시 등에 쓴다 */
  function pickAscii(kind) {
    var pool;
    if (kind === "upper") pool = asciiGroup("upper").rows;
    else if (kind === "lower") pool = asciiGroup("lower").rows;
    else if (kind === "digit") pool = asciiGroup("digit").rows;
    else pool = asciiGroup("upper").rows.concat(asciiGroup("lower").rows, asciiGroup("digit").rows);
    return pick(pool).ch;
  }

  function pickHangul() { return pickWord("ko", 1, 1); }

  global.TextCode = {
    HAN_BASE: HAN_BASE, HAN_END: HAN_END, HAN_COUNT: HAN_COUNT,
    CHO: CHO, JUNG: JUNG, JONG: JONG,
    ASCII_GROUPS: ASCII_GROUPS,
    KIND_NAME: KIND_NAME,
    kindOf: kindOf,
    bitsFor: bitsFor,
    hexLen: hexLen,
    codeOf: codeOf,
    padLeft: padLeft,
    toBin: toBin,
    toHex: toHex,
    toQuad: toQuad,
    quadLen: quadLen,
    QUAD_BITS: QUAD_BITS,
    notate: notate,
    decompose: decompose,
    compose: compose,
    infoOf: infoOf,
    infoList: infoList,
    parseCodes: parseCodes,
    inTaughtRange: inTaughtRange,
    BASE_UNIT: BASE_UNIT,
    NAMES_KO: NAMES_KO,
    asciiGroup: asciiGroup,
    groupOfChar: groupOfChar,
    WORDS: WORDS,
    pickWord: pickWord,
    pickMixed: pickMixed,
    targetFor: targetFor,
    candidates: candidates,
    pickAscii: pickAscii,
    pickHangul: pickHangul
  };
})(window);
