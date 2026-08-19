/* =========================================================
   basic.js — 아날로그와 디지털 · 비트와 바이트

   교과서 근거 : 동아출판 22개정 중등 정보 Ⅱ.데이터 **52 · 54 · 55쪽**
     · 52쪽 : **아날로그 데이터** = "소리나 빛, 바람, 온도 등과 같이 데이터를 **연속적으로**
       표현한 것으로, 자연에서 얻을 수 있는 데이터"
       **디지털 데이터** = "연속적으로 변화하는 값을 **일정한 숫자로 끊어서** 나타낸 것으로,
       컴퓨팅 시스템에서 처리되는 데이터" (전압–시간 그래프 두 개가 나란히 있다)
     · 54쪽 : 컴퓨팅 시스템은 전기가 흐르는 **ON(1)** 과 흐르지 않는 **OFF(0)** 만 인식한다.
       그 0과 1 하나가 **비트(bit)**, 8개를 묶은 것이 **바이트(byte)** = 256(2⁸)가지.
       기억 용량 단위 B → KB → … → ZB 는 2¹⁰ 배씩 커진다.
       활동 : "**3비트로 표현할 수 있는 데이터를 모두 작성해 보자**"(8칸)
     · 55쪽 : 그림 Ⅱ-4 「데이터 전송 과정에서 잡음에 따른 데이터의 변화」 —
       아날로그는 잡음이 섞이면 **원래의 신호로 복원이 어렵고**,
       디지털은 잡음이 섞여도 **원래의 신호로 복원이 가능하다.**
       또 "디지털 데이터는 … 시간의 흐름에 따른 **변질이 일어나지 않고**,
       전송·공유하는 과정에서도 정보의 **변조가 적다**"
       활동 : 아날로그 → 디지털로 **전환된 사례**를 조사한다(필름 카메라 → 디지털 카메라).

   ⚠ 잡음은 `Math.random()` 을 쓰지 않고 **씨앗(seed)** 으로 만든다.
     ① 검사를 다시 돌려도 같은 값이 나와야 하고
     ② 교실에서 교사 화면과 학생 화면이 **같은 그림**이어야 설명이 된다.

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  function padLeft(s, n) {
    s = String(s);
    while (s.length < n) s = "0" + s;
    return s;
  }

  /* ---------------------------------------------------------
     씨앗으로 만드는 잡음 — 같은 씨앗이면 언제나 같은 잡음
     (선형 합동법. 교실에서 "다시 보내기" 를 눌러도 재현된다)
     --------------------------------------------------------- */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;           /* 0 이상 1 미만 */
    };
  }

  /* -amp ~ +amp 사이의 잡음 */
  function noiseAt(seed, i, amp) {
    var r = rng((seed + i * 2654435761) >>> 0);
    r();                               /* 첫 값은 씨앗 냄새가 남아 버린다 */
    return (r() * 2 - 1) * amp;
  }

  /* ---------------------------------------------------------
     아날로그 신호 — 자연에서 오는 값(연속)
       t 는 0~1, 돌려주는 값은 0~1
       ⚠ **0.5 근처에 오래 머물지 않게** 골랐다. 디지털 판정선이 0.5 인데
         원래 값이 0.5 에 붙어 있으면 잡음이 조금만 있어도 판정이 흔들려
         "디지털은 되살릴 수 있다" 는 교과서 결론이 흐려진다.
     --------------------------------------------------------- */
  function analogAt(t) {
    var v = 0.5
          + 0.34 * Math.sin(t * Math.PI * 2 * 1.5)
          + 0.11 * Math.sin(t * Math.PI * 2 * 3.5 + 0.7);
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  /* 연속 신호를 일정한 숫자로 **끊어서** 나타낸다 (교과서 52쪽 정의)
       bits 비트 → 2^bits 단계. 돌려주는 것은 정숫값(0 ~ 2^bits-1) */
  function stepsOf(bits) { return Math.pow(2, bits); }

  function digitize(v, bits) {
    var top = stepsOf(bits) - 1;
    var k = Math.round(v * top);
    return k < 0 ? 0 : (k > top ? top : k);
  }

  /* 정숫값을 다시 0~1 크기로 (계단 그래프를 그릴 때 쓴다) */
  function levelValue(k, bits) { return k / (stepsOf(bits) - 1); }

  /* 표를 만든다 — 소리 영역의 표와 **같은 열 구조**로 둔다(두 영역이 이어진다) */
  function sampleTable(n, bits) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : i / (n - 1);
      var v = analogAt(t);
      var k = digitize(v, bits);
      out.push({
        i: i, t: t, raw: v, level: k,
        back: levelValue(k, bits),
        bin: padLeft(k.toString(2), bits)
      });
    }
    return out;
  }

  /* ---------------------------------------------------------
     잡음 실험 (교과서 55쪽 그림 Ⅱ-4)

       아날로그 : 보낸 값 + 잡음 → **그것이 원래 값인지 알 방법이 없다.**
                  받는 쪽이 할 수 있는 것이 없으므로 오차가 그대로 남는다.
       디지털  : 0 또는 1 만 보낸다(전압 0V / 1V). 잡음이 섞여도 받는 쪽은
                  **0.5보다 크면 1, 작으면 0** 으로 판정한다 →
                  잡음이 0.5 보다 작으면 **완벽히 되살아난다.**

       ⚠ 잡음이 0.5 를 넘으면 디지털도 틀린다. 그 사실을 숨기지 말 것 —
         "디지털이 마법이라서 안 틀린다" 가 아니라 **판정선까지 여유가 있어서**
         틀리지 않는 것이다. 그 여유를 넘으면 똑같이 깨진다.
     --------------------------------------------------------- */
  var THRESHOLD = 0.5;

  /* 아날로그 전송 — n 개 지점을 보낸다 */
  function sendAnalog(n, amp, seed) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : i / (n - 1);
      var v = analogAt(t);
      var got = v + noiseAt(seed, i, amp);
      out.push({ i: i, t: t, sent: v, got: got, err: Math.abs(got - v) });
    }
    return out;
  }

  /* 디지털 전송 — 비트 하나를 전압 0 또는 1 로 보낸다 */
  function sendDigital(bits, amp, seed) {
    return bits.map(function (b, i) {
      var got = b + noiseAt(seed, i, amp);
      var fixed = (got > THRESHOLD) ? 1 : 0;
      return { i: i, sent: b, got: got, fixed: fixed, ok: fixed === b };
    });
  }

  /* 아날로그 오차를 "전체 크기의 몇 %" 로 — 절댓값만 보면 크기를 알 수 없다 */
  function avgErrorPct(rows) {
    if (!rows.length) return 0;
    var s = rows.reduce(function (a, r) { return a + r.err; }, 0);
    return s / rows.length * 100;
  }

  function wrongBits(rows) {
    return rows.filter(function (r) { return !r.ok; }).length;
  }

  /* ---------------------------------------------------------
     복사(전송)를 여러 번 되풀이하면 (교과서 55쪽 "변질이 일어나지 않고")

       아날로그 : 복사할 때마다 잡음이 **쌓이고 신호도 조금 약해진다**
                 → 세대가 갈수록 원본과 멀어진다.
       디지털  : 복사할 때마다 잡음이 섞이지만 **매번 판정으로 되살리므로**
                 다음 세대로 넘어가는 값은 늘 깨끗한 0 또는 1 이다 → 오차가 늘지 않는다.

       ⚠ 아날로그 쪽에 **감쇠**(`FADE`)를 넣은 이유 : 잡음만 쌓으면 오차가 세대의 √배로만
         자라(무작위 걸음) 어떤 씨앗에서는 30번 복사해도 눈에 띄게 나빠지지 않는다.
         실제 아날로그 복사는 잡음만 끼는 게 아니라 **대비가 옅어지고 흐려진다**
         (비디오테이프를 복사한 것을 또 복사하면 그렇다). 그것을 가운데 값으로
         조금씩 다가가게 하여 나타냈다 — 그래야 세대가 갈수록 **반드시** 나빠진다.
     --------------------------------------------------------- */
  var FADE = 0.97;                   /* 한 세대마다 신호가 3% 옅어진다 */

  /* 복사 한 번의 잡음은 **작게** 둔다(±0.03).
     ⚠ 이 값을 키우면 안 된다 — 잡음이 크면 무작위 걸음이 커져 오차가 세대마다
       들쭉날쭉해지고, 어떤 씨앗에서는 10번 복사가 30번 복사보다 나빠 보인다.
       ±0.03 에서는 씨앗 40가지 모두 `1번 < 3번 < 10번 < 30번` 으로 커지고
       30번은 1번의 **7배 이상**이 된다(검사로 확인).
     이것이 실제 경험과도 맞는다 — **한 번 복사하면 거의 그대로지만
     여러 번 되풀이하면 못 알아보게 된다.** */
  var COPY_AMP = 0.03;

  function copyChain(gens, n, amp, seed, bits) {
    /* 아날로그 — 값을 그대로 다음 세대로 넘긴다(잡음이 누적 + 조금씩 옅어짐) */
    var cur = [];
    for (var i = 0; i < n; i++) cur.push(analogAt(n === 1 ? 0 : i / (n - 1)));
    var orig = cur.slice();

    /* 디지털 — 비트를 넘긴다(세대마다 판정으로 되살림) */
    var dig = bits.slice();
    var digOrig = bits.slice();

    var out = [];
    for (var g = 1; g <= gens; g++) {
      cur = cur.map(function (v, i) {
        return 0.5 + (v - 0.5) * FADE + noiseAt(seed + g * 7919, i, amp);
      });
      var aErr = cur.reduce(function (a, v, i) { return a + Math.abs(v - orig[i]); }, 0) / n * 100;

      dig = dig.map(function (b, i) {
        var got = b + noiseAt(seed + g * 104729, i, amp);
        return (got > THRESHOLD) ? 1 : 0;      /* 되살려서 넘긴다 */
      });
      var dWrong = dig.reduce(function (a, b, i) { return a + (b === digOrig[i] ? 0 : 1); }, 0);

      out.push({ gen: g, analogPct: aErr, analogNow: cur.slice(),
                 digitalWrong: dWrong, digitalNow: dig.slice() });
    }
    return { rows: out, analogOrigin: orig, digitalOrigin: digOrig };
  }

  /* ---------------------------------------------------------
     비트와 바이트 (교과서 54쪽) — `number.html` 에서 옮겨 왔다
     --------------------------------------------------------- */
  var UNITS = [
    ["B (바이트)",     "8비트",   "1 B"],
    ["KB (킬로바이트)", "2¹⁰ B",   "1,024 B"],
    ["MB (메가바이트)", "2¹⁰ KB",  "1,048,576 B"],
    ["GB (기가바이트)", "2¹⁰ MB",  "약 10억 B"],
    ["TB (테라바이트)", "2¹⁰ GB",  "약 1조 B"],
    ["PB (페타바이트)", "2¹⁰ TB",  "약 1000조 B"],
    ["EB (엑사바이트)", "2¹⁰ PB",  "약 100경 B"],
    ["ZB (제타바이트)", "2¹⁰ EB",  "약 10해 B"]
  ];

  var BIT_MEAN = [
    [1, "켜짐 / 꺼짐 · 참 / 거짓"],
    [2, "네 가지 (예 : 매우 나쁨 ~ 매우 좋음)"],
    [3, "여덟 가지 (예 : 소리 크기 0~7)"],
    [8, "256가지 = <b>1바이트</b> (예 : 글자 하나)"]
  ];

  /* 용량 문제용 — 단위 이름과 바이트 수. 계산이 정수로 딱 맞는 것만 쓴다. */
  var UNIT_FACTOR = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 };

  function unitToBytes(v, unit) { return v * (UNIT_FACTOR[unit] || 1); }

  /* ---------------------------------------------------------
     아날로그 → 디지털로 바뀐 사례 (교과서 55쪽 활동)
       ⚠ '무엇이 좋아졌나' 는 교과서가 말한 세 가지 중 하나로만 적는다 —
         ① 복사·편집이 쉽다 ② 시간이 지나도 변질되지 않는다 ③ 전송·공유 때 변조가 적다.
         그래야 잡음 실험·복사 실험과 말이 이어진다.
     --------------------------------------------------------- */
  var SWITCHED = [
    { a: "필름 카메라 · 즉석 카메라", d: "디지털 카메라 · 스마트폰 카메라",
      why: "필름을 살 필요가 없고 <b>편집·공유가 쉽다</b>" },
    { a: "LP판 · 카세트테이프", d: "음원 파일 (MP3)",
      why: "여러 번 들어도 <b>닳지 않는다</b>(변질되지 않는다)" },
    { a: "비디오테이프", d: "동영상 파일",
      why: "<b>복사해도 화질이 그대로다</b>" },
    { a: "종이 지도", d: "지도 앱 · 내비게이션",
      why: "길이 바뀌면 <b>고쳐서 바로 나눠 줄 수 있다</b>" },
    { a: "수은 온도계 (눈금)", d: "디지털 온도계 (숫자)",
      why: "사람마다 <b>다르게 읽지 않는다</b>" },
    { a: "손편지", d: "전자우편",
      why: "<b>보내는 동안 글자가 흐려지지 않는다</b>(변조가 적다)" }
  ];

  /* 아날로그인가 디지털인가 — 연습·평가에서 고르게 한다.
     기준은 교과서 정의 하나뿐이다 : **연속인가, 숫자로 끊었는가.** */
  var SORT_ITEMS = [
    { name: "공기가 떨리는 소리",        kind: "a", why: "크기가 <b>끊임없이</b> 변한다" },
    { name: "수은 온도계의 눈금 높이",   kind: "a", why: "높이가 <b>연속</b>이라 눈금 사이 값도 있다" },
    { name: "바늘 시계의 바늘 각도",     kind: "a", why: "각도가 <b>연속</b>으로 돈다" },
    { name: "종이에 연필로 그린 그림",   kind: "a", why: "선의 진하기가 <b>연속</b>이다" },
    { name: "해가 비치는 밝기",          kind: "a", why: "자연에서 오는 값이라 <b>연속</b>이다" },
    { name: "바람의 세기",               kind: "a", why: "자연에서 오는 값이라 <b>연속</b>이다" },
    { name: "MP3 음원 파일",             kind: "d", why: "소리를 <b>숫자로 끊어</b> 적어 두었다" },
    { name: "스마트폰으로 찍은 사진",     kind: "d", why: "픽셀마다 <b>숫자</b>로 적혀 있다" },
    { name: "전자저울에 뜨는 무게 숫자",  kind: "d", why: "<b>숫자로 끊어</b> 보여 준다" },
    { name: "디지털 시계의 시각 표시",    kind: "d", why: "1초 단위 <b>숫자</b>다" },
    { name: "문서 파일에 적힌 글자",      kind: "d", why: "글자마다 <b>코드 숫자</b>로 적혀 있다" },
    { name: "USB 에 담긴 동영상",        kind: "d", why: "프레임마다 <b>0과 1</b>로 적혀 있다" }
  ];

  global.Basic = {
    THRESHOLD: THRESHOLD,
    COPY_AMP: COPY_AMP,
    FADE: FADE,
    UNITS: UNITS,
    BIT_MEAN: BIT_MEAN,
    UNIT_FACTOR: UNIT_FACTOR,
    SWITCHED: SWITCHED,
    SORT_ITEMS: SORT_ITEMS,
    padLeft: padLeft,
    rng: rng,
    noiseAt: noiseAt,
    analogAt: analogAt,
    stepsOf: stepsOf,
    digitize: digitize,
    levelValue: levelValue,
    sampleTable: sampleTable,
    sendAnalog: sendAnalog,
    sendDigital: sendDigital,
    avgErrorPct: avgErrorPct,
    wrongBits: wrongBits,
    copyChain: copyChain,
    unitToBytes: unitToBytes
  };
})(window);
