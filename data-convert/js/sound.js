/* =========================================================
   sound.js — 소리의 디지털 표현 계산과 자료

   교과서 근거 : 동아출판 22개정 중등 정보 Ⅱ.데이터 **60~61쪽**
     "아날로그 신호인 소리를 컴퓨팅 시스템에서 처리하고 저장하기 위해서는
      **표본화 → 양자화 → 부호화** 의 단계에 따라 디지털 데이터로 변환하는 과정을 거쳐야 한다."
       · 표본화 : 아날로그 신호를 **일정한 시간 간격으로 끊어** 주는 과정
       · 양자화 : 표본화로 얻은 값을 **정수로 변환**하는 과정
       · 부호화 : 정수를 **이진수 형태로** 바꾸어 주는 과정
     61쪽 : 표본화 간격이 **넓을수록 손실↑ · 데이터양↓**, **좁을수록 손실↓ · 데이터양↑**
     61쪽 활동 표의 열이 `시간(초) | 신호 크기 | 정숫값 | 이진수` 라서 이 앱도 같은 열을 쓴다.

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  var STAGES = [
    { key: "sample",   name: "표본화", what: "일정한 시간 간격으로 끊어 값을 읽는다" },
    { key: "quantize", name: "양자화", what: "읽은 값을 가까운 정수로 바꾼다" },
    { key: "encode",   name: "부호화", what: "정수를 이진수로 바꾼다" }
  ];

  /* 양자화 비트 수 → 단계 수. 2비트면 4단계(0~3), 3비트면 8단계(0~7) */
  function levelsOf(bits) { return Math.pow(2, bits); }
  function maxLevel(bits) { return levelsOf(bits) - 1; }

  function padLeft(s, n) {
    s = String(s);
    while (s.length < n) s = "0" + s;
    return s;
  }

  /* 정수 → 이진수 (비트 수만큼 자리를 채운다) */
  function encode(v, bits) { return padLeft(Math.round(v).toString(2), bits); }

  /* 이진수 → 정수 (되돌리기 문제에 쓴다). 어긋나면 null */
  function decode(bin, bits) {
    var s = String(bin == null ? "" : bin).trim().replace(/\s+/g, "");
    if (!/^[01]+$/.test(s)) return null;
    if (s.length !== bits && s.length !== 1) {
      /* 앞의 0을 뺀 짧은 답도 값이 맞으면 인정하려면 길이 검사를 느슨하게 둔다 */
      if (s.length > bits) return null;
    }
    return parseInt(s, 2);
  }

  /* ---------------------------------------------------------
     **디지털 → 아날로그** (복호화 · D/A 변환)
       저장된 0과 1을 다시 소리로 되살리는 방향이다.
       ① 비트를 bits 자리씩 끊는다 ② 정수로 되돌린다 ③ 점을 이어 파형을 되살린다

       text : "111 011 010" 처럼 띄어 쓰거나 "111011010" 처럼 붙여 써도 된다.
       돌려주는 것 : { levels, samples, items, errors, bitCount }
     --------------------------------------------------------- */
  function decodeBits(text, bits, gap) {
    var raw = String(text == null ? "" : text).trim();
    var errors = [], items = [];
    if (raw === "") return { levels: [], samples: [], items: [], errors: ["이진수를 먼저 넣어 주세요."], bitCount: 0 };
    if (/[^01\s,·]/.test(raw)) {
      return { levels: [], samples: [], items: [], bitCount: 0,
               errors: ["0과 1만 넣을 수 있습니다. 다른 글자가 섞여 있습니다."] };
    }
    var pieces;
    var spaced = /[\s,·]/.test(raw);
    if (spaced) {
      pieces = raw.split(/[\s,·]+/).filter(function (s) { return s !== ""; });
    } else {
      /* 붙여 쓴 경우 : bits 자리씩 끊는다 */
      if (raw.length % bits !== 0) {
        return { levels: [], samples: [], items: [], bitCount: raw.length,
                 errors: ["비트가 " + raw.length + "개인데 " + bits + "자리씩 끊으면 딱 맞지 않습니다. " +
                          bits + "의 배수로 넣거나 빈칸으로 띄어 쓰세요."] };
      }
      pieces = raw.match(new RegExp(".{" + bits + "}", "g")) || [];
    }
    var levels = [];
    pieces.forEach(function (p, i) {
      var item = { text: p, level: null, ok: false, why: "" };
      if (p.length !== bits) {
        item.why = (i + 1) + "번째 \"" + p + "\" 은(는) " + p.length + "자리입니다 — " +
                   bits + "비트로 저장했다면 " + bits + "자리여야 합니다.";
      } else {
        item.level = parseInt(p, 2);
        item.ok = true;
        levels.push(item.level);
      }
      if (!item.ok) errors.push(item.why);
      items.push(item);
    });
    /* 되살린 표본 — 정수가 그대로 신호 크기가 된다(소수점 아래는 이미 버려졌다) */
    var g = gap || 1;
    var samples = levels.map(function (v, i) {
      return {
        t: Math.round((i * g) * 1000) / 1000,
        raw: v, level: v, bin: encode(v, bits)
      };
    });
    return { levels: levels, samples: samples, items: items, errors: errors,
             bitCount: pieces.length * bits };
  }

  /* ---------------------------------------------------------
     ① 학습 화면용 — **고정된 아날로그 파형**
        표본화 간격을 바꿔도 원래 파형은 그대로여야 "간격이 넓으면 손실이 커진다"를
        보여 줄 수 있다. 그래서 간격과 무관한 함수로 둔다.
     --------------------------------------------------------- */
  /* parts 의 숫자는 [8초 창 안에서 몇 번 진동하는가, 크기, 시작 위치] 다.
     ⚠ 진동 횟수를 낮추면 2초 간격으로도 원래 소리를 거의 따라가서
        "간격이 넓으면 손실이 커진다"가 화면에 나타나지 않는다.
        표본 간격 2초(= 8초에 5개)로는 **2번 넘게 진동하는 성분을 놓치도록** 골랐다. */
  /* short : 좁은 칸의 단추에 쓰는 짧은 이름. 긴 이름(name)은 안내 문구에서 쓴다.
     ⚠ 좌우 두 칸 배치에서 왼쪽 칸이 416px 이라 긴 이름은 단추가 두 줄로 접힌다. */
  var WAVES = {
    a: { name: "파형 A (느린 소리)", short: "A 느린", secs: 8, parts: [[1.0, 1.00, 0.0], [3.0, 0.32, 1.1]] },
    b: { name: "파형 B (빠른 소리)", short: "B 빠른", secs: 8, parts: [[2.0, 0.85, 0.6], [5.0, 0.45, 2.2]] },
    c: { name: "파형 C (섞인 소리)", short: "C 섞인", secs: 8, parts: [[1.5, 0.80, 0.4], [4.0, 0.42, 0.0], [7.0, 0.24, 1.7]] }
  };

  /* 시각 t(초) 에서의 신호 크기 — 0 ~ maxLevel(bits) 안으로 들어온다 */
  function waveAt(t, waveKey, bits) {
    var w = WAVES[waveKey] || WAVES.a;
    var top = maxLevel(bits);
    var mid = top / 2;
    var sum = 0, amp = 0;
    w.parts.forEach(function (p) {
      sum += p[1] * Math.sin(2 * Math.PI * p[0] * (t / w.secs) + p[2]);
      amp += p[1];
    });
    var v = mid + (sum / amp) * mid * 0.94;      // 0.94 : 위아래가 잘리지 않게 살짝 여유
    return Math.min(top, Math.max(0, v));
  }

  /* 표본화 — 간격 gap(초)마다 값을 읽는다 */
  function sampleWave(waveKey, bits, gap) {
    var w = WAVES[waveKey] || WAVES.a;
    var out = [];
    for (var t = 0; t <= w.secs + 1e-9; t += gap) {
      var raw = waveAt(t, waveKey, bits);
      out.push({
        t: Math.round(t * 1000) / 1000,
        raw: Math.round(raw * 1000) / 1000,           // 신호 크기(소수)
        level: Math.round(raw),                        // 정숫값(양자화)
        bin: encode(Math.round(raw), bits)             // 이진수(부호화)
      });
    }
    return out;
  }

  /* 양자화 오차 — |신호 크기 − 정숫값| 의 합과 가장 큰 값 */
  function quantError(samples) {
    var sum = 0, max = 0;
    samples.forEach(function (s) {
      var e = Math.abs(s.raw - s.level);
      sum += e;
      if (e > max) max = e;
    });
    return { sum: Math.round(sum * 1000) / 1000, max: Math.round(max * 1000) / 1000 };
  }

  /* 데이터 양 — 표본 수 × 비트 수 */
  function dataBits(count, bits) { return count * bits; }

  /* ---------------------------------------------------------
     표본화 손실 — **표본 사이에 있던 소리를 버려서** 원래 파형과 달라진 양

     ⚠ 교과서 61쪽은 손실의 원인을 **두 가지로 나눠** 설명한다.
        ① 표본화 : "일부 데이터가 표본에 포함되지 않을 수 있는데, 이때 포함되지 않는 데이터가 손실된다"
                   → **간격**이 넓을수록 커진다.
        ② 양자화 : "표본화 단계에서 읽은 값을 정수로 변환하는 과정에서 오차가 발생"
                   → **비트 수**가 적을수록 커진다.
     두 값을 한 숫자로 섞으면 안 된다. 실제로 섞어서 재어 보니
     2비트·느린 파형에서는 간격을 넓혀도 숫자가 커지지 않아 교과서 결론이 화면에서 사라졌다.
     그래서 이 함수는 **표본화만** 잰다 — 정수로 바꾸기 전의 값(raw)을 이어 붙여 비교한다.
     양자화 오차는 quantError() 가 따로 잰다.
     --------------------------------------------------------- */
  function sampleLoss(waveKey, bits, gap) {
    var w = WAVES[waveKey] || WAVES.a;
    var sm = sampleWave(waveKey, bits, gap);
    var sum = 0, max = 0, cnt = 0;
    var STEPS = 800;
    for (var k = 0; k <= STEPS; k++) {
      var t = w.secs * k / STEPS;
      var real = waveAt(t, waveKey, bits);
      /* 표본 두 개 사이를 곧은 선으로 이어 되살린 값 */
      var i = Math.min(sm.length - 2, Math.max(0, Math.floor(t / gap)));
      var t0 = sm[i].t, t1 = sm[i + 1].t;
      var f = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      var got = sm[i].raw * (1 - f) + sm[i + 1].raw * f;
      var e = Math.abs(real - got);
      sum += e; cnt++;
      if (e > max) max = e;
    }
    return {
      max: Math.round(max * 1000) / 1000,
      mean: Math.round(sum / cnt * 1000) / 1000
    };
  }

  /* ---------------------------------------------------------
     ② 연습·평가용 — **정숫값을 먼저 정하고** 그 값 근처로 파형을 만든다
        학생이 그래프에서 값을 읽어야 하므로 **반올림 결과가 하나로 정해져야** 한다.
        0.5 근처 값이 나오면 정답이 둘이 되어 채점이 불공정해진다.
        → 정수에서 0.06 ~ 0.34 만 흔든다(0.5 와 최소 0.16 떨어진다).
     --------------------------------------------------------- */
  function makeSamples(count, bits, gap) {
    var top = maxLevel(bits);
    var out = [];
    var prev = null;
    for (var i = 0; i < count; i++) {
      /* 소리처럼 보이도록 앞 값에서 너무 멀리 뛰지 않게 고른다 */
      var lv;
      var tries = 0;
      do {
        lv = Math.floor(Math.random() * (top + 1));
        tries++;
      } while (prev !== null && Math.abs(lv - prev) > Math.max(2, Math.ceil(top / 2)) && tries < 40);
      prev = lv;

      var jitter = (0.06 + Math.random() * 0.28) * (Math.random() < 0.5 ? -1 : 1);
      var raw = lv + jitter;
      if (raw < 0) raw = lv + Math.abs(jitter);            // 0 아래로 내려가지 않게
      if (raw > top) raw = lv - Math.abs(jitter);          // 최댓값 위로 올라가지 않게
      out.push({
        t: Math.round((i + 1) * gap * 1000) / 1000,
        raw: Math.round(raw * 100) / 100,
        level: lv,
        bin: encode(lv, bits)
      });
    }
    return out;
  }

  /* 표본점을 지나는 매끄러운 곡선 — 코사인 보간을 쓴다.
     두 점 사이에서 값이 두 점의 범위를 벗어나지 않아(넘침 없음)
     그래프와 표가 절대 어긋나지 않는다. */
  function curveThrough(samples, stepsPerGap) {
    if (!samples.length) return [];
    var pts = [];
    var n = samples.length;
    var steps = stepsPerGap || 24;
    /* 처음과 끝을 자연스럽게 하려고 양쪽에 같은 값을 하나씩 덧붙인다 */
    var ys = [samples[0].raw].concat(samples.map(function (s) { return s.raw; }),
                                     [samples[n - 1].raw]);
    for (var i = 0; i < ys.length - 1; i++) {
      for (var k = 0; k < steps; k++) {
        var f = k / steps;
        var m = (1 - Math.cos(f * Math.PI)) / 2;           // 코사인 보간
        pts.push({ x: i - 1 + f, y: ys[i] * (1 - m) + ys[i + 1] * m });
      }
    }
    pts.push({ x: ys.length - 2, y: ys[ys.length - 1] });
    return pts;
  }

  global.SoundCode = {
    STAGES: STAGES,
    WAVES: WAVES,
    levelsOf: levelsOf,
    maxLevel: maxLevel,
    padLeft: padLeft,
    encode: encode,
    decode: decode,
    decodeBits: decodeBits,
    waveAt: waveAt,
    sampleWave: sampleWave,
    quantError: quantError,
    dataBits: dataBits,
    sampleLoss: sampleLoss,
    makeSamples: makeSamples,
    curveThrough: curveThrough
  };
})(window);
