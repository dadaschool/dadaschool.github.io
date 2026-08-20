/* =========================================================
   review.js — 단원 정리·복습 자료와 종합평가 문제 은행

   무엇을 담는가
     ① TERMS      : 핵심 용어 플래시카드 (앞면 = 용어 / 뒷면 = 뜻 + 어디서 배웠나)
     ② CHECKS     : 스스로 학습 점검 체크리스트 (항목마다 복습할 화면 주소)
     ③ makeExam() : 단원 종합평가 12문항 (다섯 영역에서 골고루)

   ⚠ **정답은 반드시 계산 모듈에서 가져온다.**
     `Convert` · `TextCode` · `ImageCode` · `SoundCode` · `Basic` 이 답을 만든다.
     여기서 답을 손으로 적어 두면 계산 모듈을 고쳤을 때 **종합평가만 옛날 답을 들고 있게 된다.**
     문제의 *말*은 새로 썼지만 *답*은 한 곳에서만 나온다.

   ⚠ 복습 주소(`where`)는 `페이지#sim=키` 형식이다. `js/ui.js` 의 `UI.subTabs` 가
     그 해시를 읽어 해당 시뮬레이터를 바로 연다. **하위 탭 키를 바꾸면 여기도 고칠 것.**
     ⚠ `number.html` 만 예외다 — 하위 탭을 없애고 「방법 고르기」로 바꿨으므로(2026-08-19)
       그 페이지가 `HASH_PICK` 표로 예전 키(`conv`·`cards`·`cmp`)를 직접 받는다.
       **여기의 링크는 고치지 않아도 된다.**

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  var AREAS = [
    { key: "basic",  name: "아날로그와 디지털", icon: "0️⃣", page: "basic.html"  },
    { key: "number", name: "숫자(진수) 변환",   icon: "🔢", page: "number.html" },
    { key: "text",   name: "글자 변환",         icon: "🔤", page: "text.html"   },
    { key: "image",  name: "이미지 변환",       icon: "🖼", page: "image.html"  },
    { key: "sound",  name: "소리 변환",         icon: "🔊", page: "sound.html"  }
  ];

  /* ---------------------------------------------------------
     ① 핵심 용어 — 교과서 52~63쪽에서 굵게 나온 말만 골랐다.
        `page` 는 교과서 쪽수, `where` 는 우리 앱에서 그 말을 만나는 화면.
     --------------------------------------------------------- */
  var TERMS = [
    { area: "basic", t: "데이터",
      d: "관찰·실험·조사·측정으로 얻은 값이나 사실. 문자·소리·이미지·동영상 등 여러 모습이 있다.",
      page: 52, where: "basic.html" },
    { area: "basic", t: "아날로그 데이터",
      d: "소리·빛·바람·온도처럼 <b>연속적으로</b> 표현한 것. 자연에서 얻는 데이터다.",
      page: 52, where: "basic.html#sim=ad" },
    { area: "basic", t: "디지털 데이터",
      d: "연속으로 변하는 값을 <b>일정한 숫자로 끊어서</b> 나타낸 것. 컴퓨터가 처리하는 데이터다.",
      page: 52, where: "basic.html#sim=ad" },
    { area: "basic", t: "비트 (bit)",
      d: "컴퓨터가 나타낼 수 있는 <b>가장 작은 정보의 단위</b>. 전기가 흐르는 ON(1)과 흐르지 않는 OFF(0).",
      page: 54, where: "basic.html#sim=bit" },
    { area: "basic", t: "바이트 (byte)",
      d: "비트 <b>8개</b>를 묶은 단위. 256(2<sup>8</sup>)가지를 나타낼 수 있다.",
      page: 54, where: "basic.html#sim=bit" },
    { area: "basic", t: "잡음 (noise)",
      d: "보내는 동안 열이나 충격 때문에 생기는 <b>의도하지 않은 신호</b>.",
      page: 55, where: "basic.html#sim=noi" },
    { area: "basic", t: "디지털이 잡음에 강한 까닭",
      d: "0과 1 두 가지만 보내므로 잡음이 <b>판정선(0.5)까지의 여유</b>보다 작으면 원래 값을 되살릴 수 있다.",
      page: 55, where: "basic.html#sim=noi" },

    { area: "number", t: "2진수",
      d: "0과 1 두 개의 숫자만으로 수를 나타내는 방법. 컴퓨터가 쓰는 진법이다.",
      page: 56, where: "number.html#sim=conv" },
    { area: "number", t: "자리값",
      d: "각 자리가 뜻하는 크기. 2진수는 오른쪽부터 <b>1 · 2 · 4 · 8 · 16 …</b> 으로 2배씩 커진다.",
      page: 56, where: "number.html#sim=cards" },
    { area: "number", t: "10진수 → 2진수",
      d: "<b>몫이 1이 될 때까지 2로 나누고</b>, 마지막 몫과 나머지를 <b>아래에서 위로</b> 읽는다.",
      page: 56, where: "number.html#sim=conv" },
    { area: "number", t: "16진수",
      d: "0~9와 A~F 열여섯 개로 나타낸다. <b>2진수 4자리 = 16진수 1자리</b> 라서 짧게 적을 수 있다.",
      page: 57, where: "number.html#sim=conv" },

    { area: "text", t: "아스키코드 (ASCII)",
      d: "영어 알파벳·숫자·기호를 나타내는 코드. 문자 하나를 <b>7비트</b>로 적는다.",
      page: 59, where: "text.html#sim=encode" },
    { area: "text", t: "유니코드 (Unicode)",
      d: "세계 여러 나라의 문자를 함께 나타내려고 만든 코드. 한글은 <b>16비트</b>(16진수 4자리)로 적는다.",
      page: 59, where: "text.html#sim=encode" },
    { area: "text", t: "한글 유니코드 계산식",
      d: "<b>44032 + 초성×588 + 중성×28 + 종성</b>. 초성 19 · 중성 21 · 종성 28 → 모두 11,172자.",
      page: 59, where: "text.html#sim=jamo" },

    { area: "image", t: "픽셀 (pixel)",
      d: "이미지에서 가장 작은 크기의 공간을 차지하며 <b>하나의 색상 값</b>을 가진 사각형 점. '화소'라고도 한다.",
      page: 62, where: "image.html#sim=bm" },
    { area: "image", t: "비트맵 (bitmap)",
      d: "이미지를 <b>픽셀</b>로 나누어 표현하는 방식. 세밀하지만 확대하면 <b>계단 현상</b>이 생긴다.",
      page: 62, where: "image.html#sim=bm" },
    { area: "image", t: "벡터 (vector)",
      d: "점·선·면의 <b>수학적인 정보</b>로 표현하는 방식. 확대·축소해도 다시 계산되어 변형이 없다.",
      page: 62, where: "image.html#sim=vec" },
    { area: "image", t: "계단 현상",
      d: "화면의 가장자리가 매끄럽지 않고 <b>계단처럼</b> 보이는 현상.",
      page: 62, where: "image.html#sim=res" },
    { area: "image", t: "해상도",
      d: "이미지의 <b>픽셀 수</b>. '가로 픽셀 수 × 세로 픽셀 수' 로 적는다. 많을수록 선명하지만 용량이 커진다.",
      page: 63, where: "image.html#sim=res" },
    { area: "image", t: "색 깊이",
      d: "픽셀 하나(또는 한 색)를 <b>몇 비트</b>로 적는가. 줄이면 용량이 줄지만 색이 끊긴다.",
      page: 62, where: "image.html#sim=dep" },
    { area: "image", t: "프레임 · 프레임률",
      d: "동영상의 <b>한 장</b>이 프레임, 1초당 프레임 수가 <b>프레임률(fps)</b>. 24fps 이상을 흔히 쓴다.",
      page: 63, where: "image.html#sim=vid" },

    { area: "sound", t: "표본화 (샘플링)",
      d: "이어지는 소리를 <b>일정한 시간 간격으로</b> 나누어 값을 읽는 것.",
      page: 60, where: "sound.html#sim=ad" },
    { area: "sound", t: "양자화",
      d: "읽은 값을 <b>가장 가까운 정숫값</b>으로 바꾸는 것. 비트 수가 많을수록 원래 소리에 가깝다.",
      page: 60, where: "sound.html#sim=ad" },
    { area: "sound", t: "부호화",
      d: "정숫값을 <b>2진수(0과 1)</b>로 바꾸어 적는 것.",
      page: 61, where: "sound.html#sim=ad" },
    { area: "sound", t: "표본화 간격과 손실",
      d: "간격을 넓히면 데이터 양은 줄지만 <b>원래 소리와 멀어진다</b>.",
      page: 61, where: "sound.html#sim=cmp" }
  ];

  /* ---------------------------------------------------------
     ② 스스로 학습 점검 — "나는 이것을 할 수 있는가"
        성취기준 [9정02-01] 을 학생의 말로 풀어 썼다.
     --------------------------------------------------------- */
  var CHECKS = [
    { area: "basic", q: "아날로그 데이터와 디지털 데이터의 차이를 <b>내 말로</b> 설명할 수 있다.",
      where: "basic.html#sim=ad" },
    { area: "basic", q: "디지털 데이터가 <b>잡음에 강하고 복사해도 나빠지지 않는 까닭</b>을 설명할 수 있다.",
      where: "basic.html#sim=noi" },
    { area: "basic", q: "<b>비트와 바이트</b>가 무엇인지 알고, n비트로 몇 가지를 나타내는지 구할 수 있다.",
      where: "basic.html#sim=bit" },
    { area: "number", q: "<b>10진수를 2진수로</b> 바꿀 수 있다 (몫이 1이 될 때까지 나누고 거꾸로 읽기).",
      where: "number.html#sim=conv" },
    { area: "number", q: "<b>2진수를 10진수로</b> 바꿀 수 있다 (자리값을 더하기).",
      where: "number.html#sim=cards" },
    { area: "number", q: "2진수를 <b>4·8·16진수로 묶어</b> 바꿀 수 있다.",
      where: "number.html#sim=conv" },
    { area: "text", q: "<b>아스키코드</b>로 영어 글자를 2진수로 바꿀 수 있다 (7비트).",
      where: "text.html#sim=encode" },
    { area: "text", q: "<b>유니코드</b>로 한글 글자를 16진수 4자리로 바꿀 수 있다.",
      where: "text.html#sim=decode" },
    { area: "image", q: "<b>비트맵</b>을 이진수로 적고, 이진수를 보고 그림을 되살릴 수 있다.",
      where: "image.html#sim=bm" },
    { area: "image", q: "<b>해상도와 색 깊이</b>로 이미지 용량을 구할 수 있다.",
      where: "image.html#sim=res" },
    { area: "image", q: "<b>비트맵과 벡터</b>의 차이를 알고 계단 현상을 설명할 수 있다.",
      where: "image.html#sim=vec" },
    { area: "sound", q: "소리를 <b>표본화 → 양자화 → 부호화</b> 순서로 바꿀 수 있다.",
      where: "sound.html#sim=ad" },
    { area: "sound", q: "저장된 <b>0과 1을 소리로 되돌리는</b> 과정을 설명할 수 있다.",
      where: "sound.html#sim=da" },
    { area: "sound", q: "<b>표본화 간격·양자화 비트</b>가 소리 품질과 용량에 주는 영향을 설명할 수 있다.",
      where: "sound.html#sim=cmp" }
  ];

  /* ---------------------------------------------------------
     ③ 단원 종합평가 — 12문항 · 다섯 영역에서 골고루

        문항 하나 = { area, what, text, cells:[{head, answer, unit}], aid, why }
          cells  : 답칸 (판정은 화면 쪽에서 한다)
          aid    : 문제에 함께 줘야 하는 자료 (코드표·전압표 …)
          why    : 채점 뒤 보여 줄 풀이

        ⚠ 답(`answer`)은 **전부 계산 모듈에서** 나온다. 손으로 적지 말 것.
     --------------------------------------------------------- */
  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }

  function padLeft(s, n) {
    s = String(s);
    while (s.length < n) s = "0" + s;
    return s;
  }

  /* --- 기초 --- */
  function qBitKinds(rnd) {
    var n = pick([3, 4, 5, 6, 8], rnd);
    return {
      area: "basic", what: "비트와 가지 수",
      text: "<b>" + n + "비트</b>로 나타낼 수 있는 데이터는 몇 가지입니까?",
      cells: [{ head: "가지 수", answer: String(Math.pow(2, n)) }],
      why: "2를 " + n + "번 곱합니다 → 2<sup>" + n + "</sup> = " + Math.pow(2, n) + "가지"
    };
  }

  function qUnit(rnd) {
    var u = pick([[2, "KB"], [4, "KB"], [3, "MB"], [5, "MB"]], rnd);
    var bytes = global.Basic.unitToBytes(u[0], u[1]);
    return {
      area: "basic", what: "용량 단위",
      text: "<b>" + u[0] + " " + u[1] + "</b>" + josa(u[1]) + " 몇 <b>바이트(B)</b> 입니까?",
      cells: [{ head: "바이트(B)", answer: String(bytes) }],
      why: u[0] + " " + u[1] + " = " + bytes.toLocaleString() + " B (1 KB = 1,024 B)"
    };
  }

  function qAnalog(rnd) {
    var it = pick(global.Basic.SORT_ITEMS, rnd);
    return {
      area: "basic", what: "아날로그 / 디지털",
      text: "<b>" + it.name + "</b>" + josa(it.name) + " 아날로그 데이터입니까, 디지털 데이터입니까?",
      choose: ["아날로그", "디지털"],
      answerChoice: (it.kind === "a") ? "아날로그" : "디지털",
      why: it.why
    };
  }

  /* --- 숫자(진수) --- */
  function qToBinary(rnd) {
    var v = 20 + Math.floor((rnd || Math.random)() * 100);      /* 20 ~ 119 */
    return {
      area: "number", what: "10진수 → 2진수",
      text: "<b>" + v + "(10)</b> 을 <b>2진수</b>로 바꾸시오.",
      cells: [{ head: "2진수", answer: global.Convert.toBase(v, 2) }],
      why: v + " 을 몫이 1이 될 때까지 2로 나누고 거꾸로 읽으면 " +
           global.Convert.toBase(v, 2) + "(2) 입니다."
    };
  }

  function qFromBinary(rnd) {
    var v = 20 + Math.floor((rnd || Math.random)() * 100);
    var bin = global.Convert.toBase(v, 2);
    return {
      area: "number", what: "2진수 → 10진수",
      text: "<b>" + bin + "(2)</b> 를 <b>10진수</b>로 바꾸시오.",
      cells: [{ head: "10진수", answer: String(v) }],
      why: Array.from(bin).map(function (c, i) {
        return c === "1" ? Math.pow(2, bin.length - 1 - i) : null;
      }).filter(Boolean).join(" + ") + " = " + v
    };
  }

  function qGroup(rnd) {
    var v = 20 + Math.floor((rnd || Math.random)() * 200);
    var to = pick([8, 16], rnd);
    return {
      area: "number", what: "2진수 → " + to + "진수",
      text: "<b>" + global.Convert.toBase(v, 2) + "(2)</b> 를 <b>" + to + "진수</b>로 바꾸시오.",
      cells: [{ head: to + "진수", answer: global.Convert.toBase(v, to) }],
      why: "2진수 " + global.Convert.bitsPer(to) + "자리씩 오른쪽부터 묶으면 " +
           global.Convert.toBase(v, to) + "(" + to + ") 입니다."
    };
  }

  /* --- 글자 --- */
  function qAscii(rnd) {
    var ch = pick("ABCDEHKLMNPRSTabcdehiknorst".split(""), rnd);
    var code = global.TextCode.codeOf(ch);
    return {
      area: "text", what: "영어 글자 → 아스키코드",
      text: "글자 <b>" + ch + "</b> 의 아스키코드를 <b>2진수 7자리</b>로 쓰시오.",
      cells: [{ head: ch + " 의 코드", answer: padLeft(code.toString(2), 7) }],
      aid: { kind: "ascii", chars: [ch] },
      why: ch + " → " + code + "(10) → " + padLeft(code.toString(2), 7) + "(2)"
    };
  }

  function qHangul(rnd) {
    var ch = pick("가나다라마바사아자하강산물불별봄밤꽃집손발눈비".split(""), rnd);
    var code = global.TextCode.codeOf(ch);
    return {
      area: "text", what: "한글 글자 → 유니코드",
      text: "글자 <b>" + ch + "</b> 의 유니코드를 <b>16진수 4자리</b>로 쓰시오. " +
            "(4진수 <b>" + global.TextCode.toQuad(code, 16) + "</b> 을 두 자리씩 묶으면 됩니다)",
      cells: [{ head: ch + " 의 코드(16진수)", answer: global.TextCode.toHex(code, 16) }],
      aid: { kind: "quad", ch: ch, quad: global.TextCode.toQuad(code, 16) },
      why: ch + " → 4진수 " + global.TextCode.toQuad(code, 16) + " → 두 자리씩 묶어 16진수 " +
           global.TextCode.toHex(code, 16) + "(16)"
    };
  }

  /* --- 이미지 --- */
  function qGrid(rnd) {
    var grid = global.ImageCode.randomGrid(4, 3, 1);
    var bins = global.ImageCode.gridBins(grid, 1, false);
    return {
      area: "image", what: "비트맵 → 이진수",
      text: "아래 <b>4 × 3</b> 비트맵(1비트)을 <b>줄마다 이진수</b>로 이어 쓰시오.",
      cells: bins.map(function (b, i) { return { head: (i + 1) + "줄", answer: b }; }),
      aid: { kind: "grid", grid: grid, bits: 1 },
      why: bins.map(function (b, i) { return (i + 1) + "줄 " + grid[i].join(" ") + " → " + b; }).join(" · ")
    };
  }

  function qSize(rnd) {
    var s = pick([{ w: 16, h: 8, bits: 2 }, { w: 20, h: 10, bits: 2 },
                  { w: 32, h: 16, bits: 1 }, { w: 8, h: 16, bits: 3 }], rnd);
    var sz = global.ImageCode.sizeOf(s.w, s.h, s.bits);
    return {
      area: "image", what: "해상도 → 용량",
      text: "해상도 <b>" + s.w + " × " + s.h + "</b> 이고 픽셀마다 <b>" + s.bits +
            "비트</b>인 이미지의 <b>전체 비트 수</b>와 <b>용량(바이트)</b> 을 구하시오.",
      cells: [{ head: "전체 비트", answer: String(sz.bitsTotal) },
              { head: "용량(바이트)", answer: String(sz.bytes) }],
      why: s.w + " × " + s.h + " = " + sz.pixels + "픽셀 · × " + s.bits + "비트 = " +
           sz.bitsTotal + "비트 · ÷ 8 = " + sz.bytes + "바이트"
    };
  }

  /* --- 소리 --- */
  function qQuant(rnd) {
    var bits = 3;
    var levels = [0, 0, 0].map(function () {
      return Math.floor((rnd || Math.random)() * global.SoundCode.levelsOf(bits));
    });
    return {
      area: "sound", what: "양자화 → 부호화",
      text: "표본의 정숫값이 <b>" + levels.join(" · ") + "</b> 입니다. " +
            "각각을 <b>" + bits + "비트 이진수</b>로 나타내시오.",
      cells: levels.map(function (v, i) {
        return { head: (i + 1) + "번 (" + v + ")", answer: padLeft(v.toString(2), bits) };
      }),
      why: levels.map(function (v) { return v + " → " + padLeft(v.toString(2), bits); }).join(" · ")
    };
  }

  function qDataBits(rnd) {
    var n = pick([8, 10, 12, 16], rnd);
    var bits = pick([2, 3, 4], rnd);
    return {
      area: "sound", what: "소리의 데이터 양",
      text: "표본 <b>" + n + "개</b>를 <b>" + bits + "비트</b>로 저장하면 데이터는 " +
            "모두 <b>몇 비트</b>입니까?",
      cells: [{ head: "전체 비트", answer: String(n * bits) }],
      why: n + " × " + bits + " = " + (n * bits) + "비트"
    };
  }

  /* 조사 — `js/ui.js` 의 것을 쓴다(같은 규칙을 두 곳에 두지 않는다) */
  function josa(w) { return (global.UI && global.UI.josa) ? global.UI.josa(w, "은는") : "은"; }

  /* 12문항을 순서대로 만든다 — **영역이 골고루** 섞이게 자리를 정해 두었다.
     ⚠ 문항 수·영역 배분을 바꾸면 `AREA_MAX`(화면 쪽 영역별 분석)도 함께 바뀐다. */
  var PLAN = [
    qBitKinds, qToBinary, qAscii, qGrid, qQuant,
    qUnit,     qFromBinary, qHangul, qSize, qDataBits,
    qAnalog,   qGroup
  ];

  function makeExam(rnd) {
    return PLAN.map(function (f, i) {
      var q = f(rnd);
      q.no = i + 1;
      q.points = 1;
      return q;
    });
  }

  /* 영역마다 몇 문항인가 — 종합평가 결과의 '영역별 분석' 에 쓴다 */
  function areaCounts() {
    var c = {};
    AREAS.forEach(function (a) { c[a.key] = 0; });
    makeExam(function () { return 0.5; }).forEach(function (q) { c[q.area]++; });
    return c;
  }

  global.Review = {
    AREAS: AREAS,
    TERMS: TERMS,
    CHECKS: CHECKS,
    makeExam: makeExam,
    areaCounts: areaCounts,
    padLeft: padLeft
  };
})(window);
