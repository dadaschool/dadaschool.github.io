/* =========================================================
   keyboard.js — 자판(키보드) 배열과 한글 조합

   왜 필요한가
     글자 → 코드 를 배우고 나면 "그 글자를 어떻게 넣었나" 가 남는다.
       영어 : 1키 = 1글자 = 1코드          (A 키 → 'A' → 65)
       한글 : 자모 여러 키를 모아 1글자    (ㅎ ㅏ ㄴ → '한' → 54620)
     이 파일은 자판 배열 자료와 **한글 조합기**만 담는다(화면 그리기는 text.html).

   ⚠ ES 모듈(import/export)을 쓰지 않는다. file:// 더블클릭 실행을 지키기 위해서다.
   ⚠ 이 파일을 만들었으면 `vite.config.js` 의 CLASSIC_SCRIPTS 에도 넣어야 한다
     (안 넣으면 빌드 결과에서 빠져 사이트에서만 깨진다).

   📌 배열 근거
     · 두벌식 표준  : KS X 5002
     · 세벌식 최종  : 공병우 3-91. clee704/hangul-js 의 매핑을 유니코드 값으로 대조해 옮겼다
     · 드보락       : ANSI Dvorak Simplified Keyboard
   ========================================================= */
(function (global) {
  "use strict";

  /* 자판 위 글쇠 자리 — 실제 키보드와 같은 네 줄 */
  var ROWS = [
    "1234567890".split(""),
    "qwertyuiop".split(""),
    "asdfghjkl;'".split(""),
    "zxcvbnm,./".split("")
  ];

  /* 줄마다 시작 자리를 조금씩 밀어 실제 키보드처럼 계단으로 보이게 한다 */
  var ROW_OFFSET = [0, 0.5, 0.75, 1.25];

  /* 어느 손으로 치는 자리인가 — 자판 종류와 상관없이 «자리» 가 정한다.
     타자 기본 자세 기준으로 왼손은 1~5·qwert·asdfg·zxcvb, 나머지는 오른손. */
  var LEFT_SEATS = "12345qwertasdfgzxcvb".split("");
  function handOf(seat) { return LEFT_SEATS.indexOf(seat) >= 0 ? "left" : "right"; }

  /* 양손 검지의 «기준 자리» — 실제 키보드에 돌기가 있는 두 글쇠다.
     여기에 검지를 얹고 시작하므로 자판을 익힐 때 가장 먼저 찾는 자리다. */
  var HOME_SEATS = ["f", "j"];
  function isHome(seat) { return HOME_SEATS.indexOf(seat) >= 0; }

  /* 빈칸(스페이스) 자리 — 글쇠 네 줄과 따로 그린다(엄지로 치는 자리라 손 색을 안 준다) */
  var SPACE_SEAT = " ";

  /* ---------------------------------------------------------
     영어 자판
     --------------------------------------------------------- */
  var QWERTY = {};
  ROWS.forEach(function (row) { row.forEach(function (k) { QWERTY[k] = k; }); });

  /* 드보락 — 같은 «자리» 에 다른 글자가 온다 */
  var DVORAK_ROWS = [
    "1234567890".split(""),
    "',.pyfgcrl".split(""),
    "aoeuidhtns-".split(""),
    ";qjkxbmwvz".split("")
  ];
  var DVORAK = {};
  ROWS.forEach(function (row, r) {
    row.forEach(function (k, i) { DVORAK[k] = DVORAK_ROWS[r][i]; });
  });

  /* ---------------------------------------------------------
     한글 자판 — 글쇠마다 «어떤 낱자» 이고 «무슨 벌(자리)» 인지를 함께 적는다
       role : "cho"(첫소리) · "jung"(가운뎃소리) · "jong"(끝소리) · "any"(두벌식 닿소리)
     --------------------------------------------------------- */

  /* 두벌식 표준(KS X 5002) — 낱자를 닿소리·홀소리 두 벌로만 나눈다.
     닿소리 글쇠는 자리에 따라 첫소리도 받침도 되므로 role 이 "any" 다. */
  var DUBEOL = {
    q: ["ㅂ", "any"], w: ["ㅈ", "any"], e: ["ㄷ", "any"], r: ["ㄱ", "any"], t: ["ㅅ", "any"],
    y: ["ㅛ", "jung"], u: ["ㅕ", "jung"], i: ["ㅑ", "jung"], o: ["ㅐ", "jung"], p: ["ㅔ", "jung"],
    a: ["ㅁ", "any"], s: ["ㄴ", "any"], d: ["ㅇ", "any"], f: ["ㄹ", "any"], g: ["ㅎ", "any"],
    h: ["ㅗ", "jung"], j: ["ㅓ", "jung"], k: ["ㅏ", "jung"], l: ["ㅣ", "jung"],
    z: ["ㅋ", "any"], x: ["ㅌ", "any"], c: ["ㅊ", "any"], v: ["ㅍ", "any"],
    b: ["ㅠ", "jung"], n: ["ㅜ", "jung"], m: ["ㅡ", "jung"]
  };
  var DUBEOL_SHIFT = {
    q: ["ㅃ", "any"], w: ["ㅉ", "any"], e: ["ㄸ", "any"], r: ["ㄲ", "any"], t: ["ㅆ", "any"],
    o: ["ㅒ", "jung"], p: ["ㅖ", "jung"]
  };

  /* 세벌식 최종(3-91) — 첫소리·가운뎃소리·끝소리가 **각각 다른 자리**에 있다.
     오른손 = 첫소리 · 왼손 안쪽 = 가운뎃소리 · 왼손 바깥(맨 왼쪽·숫자줄) = 끝소리 */
  var SEBEOL = {
    /* 끝소리(받침) — 왼쪽 바깥 */
    "1": ["ㅎ", "jong"], "2": ["ㅆ", "jong"], "3": ["ㅂ", "jong"],
    q: ["ㅅ", "jong"], w: ["ㄹ", "jong"],
    a: ["ㅇ", "jong"], s: ["ㄴ", "jong"],
    z: ["ㅁ", "jong"], x: ["ㄱ", "jong"],
    /* 가운뎃소리(홀소리) — 왼쪽 안쪽 + 숫자줄 */
    "4": ["ㅛ", "jung"], "5": ["ㅠ", "jung"], "6": ["ㅑ", "jung"],
    "7": ["ㅖ", "jung"], "8": ["ㅢ", "jung"],
    e: ["ㅕ", "jung"], r: ["ㅐ", "jung"], t: ["ㅓ", "jung"],
    d: ["ㅣ", "jung"], f: ["ㅏ", "jung"], g: ["ㅡ", "jung"],
    c: ["ㅔ", "jung"], v: ["ㅗ", "jung"], b: ["ㅜ", "jung"],
    /* 첫소리(닿소리) — 오른손 */
    "0": ["ㅋ", "cho"],
    y: ["ㄹ", "cho"], u: ["ㄷ", "cho"], i: ["ㅁ", "cho"], o: ["ㅊ", "cho"], p: ["ㅍ", "cho"],
    h: ["ㄴ", "cho"], j: ["ㅇ", "cho"], k: ["ㄱ", "cho"], l: ["ㅈ", "cho"], ";": ["ㅂ", "cho"],
    n: ["ㅅ", "cho"], m: ["ㅎ", "cho"], "'": ["ㅌ", "cho"]
  };
  /* 윗글쇠 — 된소리 받침과 겹받침 13개가 여기 있다(세벌식이 겹받침을 한 번에 치는 이유) */
  var SEBEOL_SHIFT = {
    "1": ["ㄲ", "jong"], "2": ["ㄺ", "jong"], "3": ["ㅈ", "jong"],
    "4": ["ㄿ", "jong"], "5": ["ㄾ", "jong"],
    q: ["ㅍ", "jong"], w: ["ㅌ", "jong"], e: ["ㄵ", "jong"], r: ["ㅀ", "jong"], t: ["ㄽ", "jong"],
    a: ["ㄷ", "jong"], s: ["ㄶ", "jong"], d: ["ㄼ", "jong"], f: ["ㄻ", "jong"],
    z: ["ㅊ", "jong"], x: ["ㅄ", "jong"], c: ["ㅋ", "jong"], v: ["ㄳ", "jong"]
  };

  /* ---------------------------------------------------------
     한글 조합 — 자모를 모아 완성형 한 글자로
     --------------------------------------------------------- */
  var CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  var JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
  var JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

  /* 두벌식에서 홀소리 두 개가 만나 하나가 되는 자리 (ㅗ + ㅏ = ㅘ) */
  var JUNG_PAIR = {
    "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
    "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ"
  };
  /* 두벌식에서 받침 두 개가 겹치는 자리 (ㄱ + ㅅ = ㄳ) */
  var JONG_PAIR = {
    "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ",
    "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ"
  };
  /* 겹받침을 도로 둘로 (뒤 자모가 다음 글자의 첫소리로 넘어갈 때 쓴다) */
  var JONG_SPLIT = {};
  Object.keys(JONG_PAIR).forEach(function (k) {
    JONG_SPLIT[JONG_PAIR[k]] = [k.charAt(0), k.charAt(1)];
  });
  /* 겹홀소리를 도로 둘로 (지우기에서 쓴다) */
  var JUNG_SPLIT = {};
  Object.keys(JUNG_PAIR).forEach(function (k) {
    JUNG_SPLIT[JUNG_PAIR[k]] = [k.charAt(0), k.charAt(1)];
  });

  function compose(cho, jung, jong) {
    var ci = CHO.indexOf(cho), vi = JUNG.indexOf(jung), ti = JONG.indexOf(jong || "");
    if (ci < 0 || vi < 0 || ti < 0) return null;
    return String.fromCharCode(0xAC00 + (ci * 21 + vi) * 28 + ti);
  }

  /* 조합기 — 글쇠를 하나씩 받아 «확정된 글자들» 과 «조합 중인 글자» 를 들고 있는다 */
  function Composer(kind) {
    this.kind = kind;           // "dubeol" | "sebeol"
    this.done = "";             // 확정된 글자들
    this.cho = ""; this.jung = ""; this.jong = "";
  }
  Composer.prototype.cur = function () {
    if (!this.cho && !this.jung && !this.jong) return "";
    if (this.cho && this.jung) return compose(this.cho, this.jung, this.jong) || "";
    return this.cho || this.jung || this.jong;   // 아직 글자가 안 된 낱자 하나
  };
  Composer.prototype.text = function () { return this.done + this.cur(); };
  Composer.prototype.flush = function () {
    this.done += this.cur();
    this.cho = this.jung = this.jong = "";
  };
  Composer.prototype.reset = function () {
    this.done = ""; this.cho = this.jung = this.jong = "";
  };
  Composer.prototype.back = function () {
    if (this.jong) {
      var sp = JONG_SPLIT[this.jong];
      this.jong = sp ? sp[0] : "";
    } else if (this.jung) {
      var sv = JUNG_SPLIT[this.jung];
      this.jung = sv ? sv[0] : "";
    } else if (this.cho) {
      this.cho = "";
    } else if (this.done) {
      this.done = this.done.slice(0, -1);
    }
    return this.text();
  };

  /* 빈칸(스페이스) — 조합 중인 글자를 **확정하고** 빈칸을 넣는다.
     한글에서 스페이스는 «지금 글자를 끝낸다» 는 뜻이기도 하다. */
  Composer.prototype.space = function () {
    this.flush();
    this.done += " ";
    return this.text();
  };

  /* 낱자 하나를 넣는다. role 은 세벌식에서만 뜻이 있다. */
  Composer.prototype.put = function (jamo, role) {
    if (this.kind === "sebeol") return this.putSebeol(jamo, role);
    return this.putDubeol(jamo);
  };

  /* 세벌식 — 자리가 정해져 있어 규칙이 단순하다.
     같은 자리가 이미 차 있으면 지금 글자를 확정하고 새 글자를 시작한다. */
  Composer.prototype.putSebeol = function (jamo, role) {
    if (role === "cho") {
      if (this.cho) this.flush();
      this.cho = jamo;
    } else if (role === "jung") {
      if (this.jung) this.flush();
      this.jung = jamo;
    } else {
      if (this.jong || !this.cho || !this.jung) this.flush();
      this.jong = jamo;
    }
    return this.text();
  };

  /* 두벌식 — 닿소리가 첫소리인지 받침인지 «앞뒤를 보고» 정한다.
     이것이 두벌식에서 «받침이 다음 글자로 넘어가는» 까닭이다. */
  Composer.prototype.putDubeol = function (jamo) {
    var isVowel = JUNG.indexOf(jamo) >= 0;
    if (isVowel) {
      if (!this.jung && this.cho) {
        this.jung = jamo;
      } else if (!this.jung && !this.cho) {
        this.flush();
        this.jung = jamo;
      } else if (JUNG_PAIR[this.jung + jamo]) {
        this.jung = JUNG_PAIR[this.jung + jamo];          /* ㅗ + ㅏ = ㅘ */
      } else if (this.jong) {
        /* 받침이 다음 글자의 첫소리로 넘어간다 */
        var sp = JONG_SPLIT[this.jong];
        var keep = sp ? sp[0] : "";
        var moved = sp ? sp[1] : this.jong;
        this.jong = keep;
        this.flush();
        this.cho = moved; this.jung = jamo;
      } else {
        this.flush();
        this.jung = jamo;
      }
      return this.text();
    }
    /* 닿소리 */
    if (!this.cho && !this.jung) { this.cho = jamo; return this.text(); }
    if (this.cho && !this.jung) { this.flush(); this.cho = jamo; return this.text(); }
    if (!this.jong) {
      if (JONG.indexOf(jamo) > 0) { this.jong = jamo; }
      else { this.flush(); this.cho = jamo; }
      return this.text();
    }
    if (JONG_PAIR[this.jong + jamo]) { this.jong = JONG_PAIR[this.jong + jamo]; return this.text(); }
    this.flush(); this.cho = jamo;
    return this.text();
  };

  /* ---------------------------------------------------------
     자판 목록 — 화면이 이대로 그린다
     --------------------------------------------------------- */
  var LAYOUTS = {
    qwerty: {
      key: "qwerty", name: "QWERTY", lang: "en", map: QWERTY, shift: null,
      point: "1키 = 1글자 = 1코드",
      desc: "가장 널리 쓰는 영어 자판입니다. 1873년 타자기 시절의 배열이 그대로 굳었습니다. " +
            "자주 쓰는 글자가 흩어져 있어 손이 많이 움직이지만, 모두가 쓰기 때문에 표준이 되었습니다."
    },
    dvorak: {
      key: "dvorak", name: "드보락 (Dvorak)", lang: "en", map: DVORAK, shift: null,
      point: "자리만 다를 뿐 1키 = 1글자 = 1코드 — 코드값은 QWERTY 와 똑같다",
      desc: "1936년에 <b>손이 덜 움직이게</b> 다시 설계한 영어 자판입니다. 가운뎃줄에 홀소리(a o e u i)와 " +
            "자주 쓰는 닿소리(d h t n s)를 몰아 두어 영어 글의 대부분을 가운뎃줄에서 칩니다. " +
            "더 편하지만 이미 QWERTY 를 쓰는 사람이 너무 많아 널리 퍼지지는 못했습니다."
    },
    dubeol: {
      key: "dubeol", name: "두벌식 (표준)", lang: "ko", map: DUBEOL, shift: DUBEOL_SHIFT,
      point: "닿소리 글쇠 하나가 첫소리도 받침도 된다 → 컴퓨터가 앞뒤를 보고 판단한다",
      desc: "한국 표준 자판(KS X 5002)입니다. 낱자를 <b>닿소리·홀소리 두 벌</b>로 나누어 " +
            "왼손은 닿소리, 오른손은 홀소리를 칩니다. 글쇠가 적어 배우기 쉽지만, " +
            "같은 닿소리 글쇠가 <b>첫소리도 되고 받침도 되어</b> 컴퓨터가 앞뒤를 보고 정합니다. " +
            "그래서 «받침이 다음 글자로 넘어가는» 일이 생깁니다."
    },
    sebeol: {
      key: "sebeol", name: "세벌식 최종 (3-91)", lang: "ko", map: SEBEOL, shift: SEBEOL_SHIFT,
      point: "첫소리·가운뎃소리·끝소리 자리가 달라 컴퓨터가 판단할 것이 없다",
      desc: "공병우 박사가 만든 자판입니다. 낱자를 <b>첫소리·가운뎃소리·끝소리 세 벌</b>로 나눠 " +
            "<b>자리가 아예 다릅니다</b> — 오른손은 첫소리, 왼손 안쪽은 홀소리, 왼손 바깥은 받침. " +
            "겹받침도 윗글쇠로 한 번에 칩니다. 손을 번갈아 쓰게 되어 빠르지만 " +
            "글쇠가 많아 익히는 데 시간이 듭니다."
    }
  };

  global.Keyboard = {
    ROWS: ROWS, ROW_OFFSET: ROW_OFFSET,
    LEFT_SEATS: LEFT_SEATS, HOME_SEATS: HOME_SEATS, SPACE_SEAT: SPACE_SEAT,
    handOf: handOf, isHome: isHome,
    LAYOUTS: LAYOUTS,
    CHO: CHO, JUNG: JUNG, JONG: JONG,
    JUNG_PAIR: JUNG_PAIR, JONG_PAIR: JONG_PAIR,
    JUNG_SPLIT: JUNG_SPLIT, JONG_SPLIT: JONG_SPLIT,
    compose: compose,
    Composer: Composer
  };
})(window);
