/* =========================================================
   noise.js — 소음 데이터 엔진 (mb-noise)
   ---------------------------------------------------------
   이 파일은 **화면을 전혀 모른다.** DOM · 캔버스 · 이벤트가 한 줄도 없다.
   그래서 브라우저 없이 `node tools/검사/verify_noise.cjs` 로 검사할 수 있다.

   무엇을 계산하나
     ① 교실 상황(조용 · 대화 · 박수 …)에서 나오는 **소음값**을 만든다.
     ② 그 값을 기준값 두 개로 **안전 / 주의 / 경고** 로 나눈다.
     ③ 기준값을 바꿨을 때의 **헛경보 · 놓침**을 센다.  ← 이 앱의 결론
     ④ 「3초 이상 지속될 때만 경고」 를 계산한다.

   🔴 값이 왜 이 숫자인가 — 수업자료 슬라이드 13 의 실측 예시를 그대로 따랐다.
      조용 30 · 대화 75 · 박수 130 · 큰 소리 180.
      **이 숫자를 바꾸면 슬라이드와 앱이 어긋난다.** 바꿀 일이 생기면 슬라이드도 함께 고칠 것.
      (실제 수업에서는 학생이 자기 교실에서 측정한 값을 쓰게 되어 있으므로,
       이 값들은 «시뮬레이터의 기본 교실» 이라고 보면 된다.)

   🔴 난수는 반드시 **씨앗**에서 나온다. `Math.random` 을 쓰지 않는다.
      같은 씨앗 = 늘 같은 소음. 그래야 ① 검사가 가능하고 ② 종이로 뽑은 값과
      화면의 값이 같고 ③ 반마다 다른 교실을 줄 수 있다.
      (data-convert 에서 `Math.random` 이 섞여 들어가 종이와 화면이 어긋난 적이 있다)
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     씨앗 난수 (mulberry32)
     짧고 빠르고, 같은 씨앗이면 어느 브라우저에서나 같은 수열이 나온다.
     --------------------------------------------------------- */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------
     교실 상황
       base     : 늘 깔려 있는 소리 크기
       swing    : 흔들림 폭 (±)
       spikeP   : 한 표본에서 «큰 소리» 가 터질 확률
       spikeAmp : 터졌을 때 얹히는 크기
       spikeLen : 그 큰 소리가 몇 표본 동안 이어지는가 (0.1초 = 1표본)
       alarm    : **이 상황은 정말 경고해야 하는가**
                  ← 헛경보·놓침을 세는 기준. 박수·의자는 «순간» 이라 false 다.
                    이 판단이 확장 미션 ⑤(3초 이상 지속될 때만 경고)의 근거가 된다.
     --------------------------------------------------------- */
  var SCENES = [
    { key: "quiet", name: "조용히 앉아 있기", emoji: "🤫", guess: "낮음",
      base: 30, swing: 8, spikeP: 0, spikeAmp: 0, spikeLen: 1, alarm: false,
      tip: "아무도 말하지 않는 자습 시간입니다." },

    { key: "talk", name: "친구와 대화하기", emoji: "💬", guess: "보통",
      base: 75, swing: 16, spikeP: 0.05, spikeAmp: 35, spikeLen: 2, alarm: false,
      tip: "모둠 활동 중입니다. 시끄럽지만 수업이 되는 정도예요." },

    /* ⚠ base + swing + spikeAmp × 1.15 = 130 이 되게 맞춘 값이다(슬라이드 13 의 «박수 130»).
       셋 중 하나만 바꾸면 최고값이 어긋나고 verify_noise.cjs 가 잡는다. */
    { key: "clap", name: "박수치기", emoji: "👏", guess: "높음",
      base: 50, swing: 10, spikeP: 0.22, spikeAmp: 61, spikeLen: 2, alarm: false,
      tip: "짧고 큰 소리가 순간순간 터집니다. 계속 시끄러운 것은 아닙니다." },

    { key: "chair", name: "의자 끄는 소리", emoji: "🪑", guess: "?",
      base: 35, swing: 9, spikeP: 0.08, spikeAmp: 115, spikeLen: 1, alarm: false,
      tip: "조용한데 가끔 «끼익» 하고 아주 큰 값이 튑니다. 헛경보의 주범이에요." },

    { key: "shout", name: "큰 소리 내기", emoji: "📣", guess: "매우 높음",
      base: 178, swing: 20, spikeP: 0.05, spikeAmp: 22, spikeLen: 2, alarm: true,
      tip: "모두가 떠들고 있습니다. 이때는 정말로 경보가 울려야 합니다." }
  ];

  function scene(key) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].key === key) return SCENES[i];
    return SCENES[0];
  }

  /* ---------------------------------------------------------
     소음값 만들기
     스트림은 «지금 터진 큰 소리가 몇 표본 남았는가» 를 기억한다.
     그래야 박수가 «순간» 이고 큰 소리가 «지속» 이라는 차이가 생긴다.
     --------------------------------------------------------- */
  function makeStream(seed) {
    var r = rng(seed);
    var left = 0, amp = 0;

    return {
      /* 다음 표본 하나. sceneKey 를 바꾸면 그 순간부터 상황이 바뀐다. */
      next: function (sceneKey) {
        var s = scene(sceneKey);
        if (left <= 0 && s.spikeP > 0 && r() < s.spikeP) {
          left = s.spikeLen;
          amp = s.spikeAmp * (0.85 + r() * 0.3);
        }
        var v = s.base + (r() * 2 - 1) * s.swing;
        if (left > 0) { v += amp; left--; }
        return clampVal(v);
      },
      reset: function () { left = 0; amp = 0; }
    };
  }

  /* 소리 크기는 음수가 없고, 마이크가 읽을 수 있는 위쪽 한계가 있다.
     엔트리·micro:bit 의 「소리 크기」 도 0 이상의 정수로 들어온다. */
  function clampVal(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  /* 한 상황에서 표본 n 개 */
  function series(sceneKey, n, seed) {
    var st = makeStream(seed), out = [];
    for (var i = 0; i < n; i++) out.push(st.next(sceneKey));
    return out;
  }

  /* 상황이 섞인 표본. plan = [{scene:"quiet", n:30}, …] */
  function mixed(plan, seed) {
    var st = makeStream(seed), out = [];
    (plan || []).forEach(function (p) {
      for (var i = 0; i < p.n; i++) out.push({ scene: p.scene, v: st.next(p.scene) });
    });
    return out;
  }

  /* ---------------------------------------------------------
     판정 — 안전 / 주의 / 경고
       le=false : 슬라이드 그대로 «< 60» · «< 120»  (기본)
       le=true  : «≤ 60» · «≤ 120» 으로 바꿔 본 경우
     경계값(59·60·119·120)이 어디로 가는지가 이 함수 하나로 갈린다.
     --------------------------------------------------------- */
  var LEVELS = {
    safe:   { key: "safe",   name: "안전", icon: "Happy", color: "#059669", beep: false, emoji: "🙂" },
    warn:   { key: "warn",   name: "주의", icon: "Meh",   color: "#d97706", beep: false, emoji: "😐" },
    danger: { key: "danger", name: "경고", icon: "Sad",   color: "#dc2626", beep: true,  emoji: "😣" }
  };

  function judge(v, t1, t2, le) {
    if (le ? (v <= t1) : (v < t1)) return "safe";
    if (le ? (v <= t2) : (v < t2)) return "warn";
    return "danger";
  }

  /* 「경고인가」 만 따로 — 지속 조건과 통계가 같은 기준을 쓰게 한다 */
  function isDanger(v, t2, le) {
    return le ? (v > t2) : (v >= t2);
  }

  /* ---------------------------------------------------------
     조건 순서 실험 (슬라이드 17~19 의 중첩 «만일 / 아니면»)
     ---------------------------------------------------------
     🔴 이 앱에서 가장 중요한 실험이다.
        순서를 바꾸면 «틀린다» 가 아니라 — **조건도 함께 바꿔야 한다.**
        그것을 모르면 «아니면 안에 만일을 넣는다» 가 그냥 외우는 규칙이 된다.
     --------------------------------------------------------- */
  var ORDERS = [
    { key: "safeFirst", name: "작은 값부터 (수업자료 순서)", ok: true,
      steps: ["만일  소음크기 < 60  이라면 → 안전",
              "아니면 만일  소음크기 < 120  이라면 → 주의",
              "아니면 → 경고"],
      note: "작은 값부터 걸러 내므로 «아니면» 에 남는 것이 자연스럽게 큰 값이 된다." },

    { key: "warnFirst", name: "큰 값부터인데 부등호는 그대로 (함정)", ok: false,
      steps: ["만일  소음크기 < 120  이라면 → 주의",
              "아니면 만일  소음크기 < 60  이라면 → 안전",
              "아니면 → 경고"],
      note: "60보다 작은 값은 120보다도 작으므로 <b>첫 줄에서 이미 «주의» 로 잡힌다.</b> " +
            "두 번째 줄은 영원히 실행되지 않아 «안전» 이 한 번도 나오지 않는다." },

    { key: "dangerFirst", name: "큰 값부터 + 부등호도 뒤집기", ok: true,
      steps: ["만일  소음크기 ≥ 120  이라면 → 경고",
              "아니면 만일  소음크기 ≥ 60  이라면 → 주의",
              "아니면 → 안전"],
      note: "순서를 바꾸려면 <b>부등호도 함께 뒤집어야</b> 한다. 이렇게 하면 결과는 첫 번째와 완전히 같다." }
  ];

  function order(key) {
    for (var i = 0; i < ORDERS.length; i++) if (ORDERS[i].key === key) return ORDERS[i];
    return ORDERS[0];
  }

  /* 순서대로 실제로 흘려 본다. 어느 줄에서 멈췄는지(hit)까지 돌려준다 —
     화면이 그 줄만 빛나게 하는 데 쓴다. */
  function runOrder(v, orderKey, t1, t2, le) {
    var lt = function (a, b) { return le ? (a <= b) : (a < b); };
    var ge = function (a, b) { return le ? (a > b) : (a >= b); };

    if (orderKey === "warnFirst") {
      if (lt(v, t2)) return { level: "warn", hit: 0 };
      if (lt(v, t1)) return { level: "safe", hit: 1 };
      return { level: "danger", hit: 2 };
    }
    if (orderKey === "dangerFirst") {
      if (ge(v, t2)) return { level: "danger", hit: 0 };
      if (ge(v, t1)) return { level: "warn", hit: 1 };
      return { level: "safe", hit: 2 };
    }
    if (lt(v, t1)) return { level: "safe", hit: 0 };
    if (lt(v, t2)) return { level: "warn", hit: 1 };
    return { level: "danger", hit: 2 };
  }

  /* ---------------------------------------------------------
     통계 — 헛경보와 놓침  ★ 이 앱의 결론
     ---------------------------------------------------------
     records = [{ scene, v }, …]
       헛경보 : 경고할 필요가 없는 상황(alarm:false)인데 «경고» 가 뜬 비율
       놓침   : 정말 경고해야 하는 상황(alarm:true)인데 «경고» 가 안 뜬 비율

     기준값을 올리면 헛경보가 줄고 놓침이 는다. 내리면 반대다.
     **둘 다 0 으로 만드는 기준값은 없다** — 그래서 «정답» 이 아니라 «설계» 다.
     --------------------------------------------------------- */
  function stats(records, t1, t2, le) {
    var counts = { safe: 0, warn: 0, danger: 0 };
    var byScene = {};
    var faN = 0, faHit = 0, msN = 0, msHit = 0;

    (records || []).forEach(function (rec) {
      var lv = judge(rec.v, t1, t2, le);
      counts[lv]++;

      var s = scene(rec.scene);
      if (!byScene[s.key]) {
        byScene[s.key] = { key: s.key, name: s.name, emoji: s.emoji, alarm: s.alarm,
                           n: 0, safe: 0, warn: 0, danger: 0, min: Infinity, max: -Infinity, sum: 0 };
      }
      var b = byScene[s.key];
      b.n++; b[lv]++; b.sum += rec.v;
      if (rec.v < b.min) b.min = rec.v;
      if (rec.v > b.max) b.max = rec.v;

      if (s.alarm) { msN++; if (lv !== "danger") msHit++; }
      else { faN++; if (lv === "danger") faHit++; }
    });

    Object.keys(byScene).forEach(function (k) {
      var b = byScene[k];
      b.avg = b.n ? Math.round(b.sum / b.n) : 0;
      if (!b.n) { b.min = 0; b.max = 0; }
    });

    var n = (records || []).length;
    return {
      n: n,
      counts: counts,
      pct: {
        safe: pct(counts.safe, n), warn: pct(counts.warn, n), danger: pct(counts.danger, n)
      },
      byScene: byScene,
      falseAlarm: pct(faHit, faN),   // 헛경보율 (%)
      miss: pct(msHit, msN),         // 놓침률 (%)
      falseAlarmN: faHit, falseAlarmOf: faN,
      missN: msHit, missOf: msN
    };
  }

  function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }

  /* ---------------------------------------------------------
     확장 미션 : 3초 이상 지속될 때만 경고 (슬라이드 26-A)
     ---------------------------------------------------------
     경고 조건이 **연달아** holdSec 동안 참일 때만 경보를 켠다.
     박수(2표본 = 0.2초)는 걸러지고, 정말 시끄러운 상태만 남는다.
     --------------------------------------------------------- */
  function sustain(vals, t2, holdSec, dt, le) {
    /* ⚠ «3초 지속» 은 표본 30개가 아니라 **31개**다.
       0.0초에 시작한 표본이 3.0초에도 아직 참이어야 3초가 «지난» 것이다
       (표본 0 ~ 표본 30 = 31개). 30개로 세면 2.9초 만에 경보가 울린다. */
    var need = holdSec > 0 ? Math.round(holdSec / (dt || 0.1)) + 1 : 1;
    var run = 0;
    return (vals || []).map(function (v) {
      run = isDanger(v, t2, le) ? run + 1 : 0;
      return run >= need;
    });
  }

  /* 지속 조건을 넣기 전/후를 한 번에 비교 — 화면과 검사가 같은 것을 본다 */
  function compareSustain(records, t2, holdSec, dt, le) {
    var vals = records.map(function (r) { return r.v; });
    var raw = vals.map(function (v) { return isDanger(v, t2, le); });
    var held = sustain(vals, t2, holdSec, dt, le);
    var rawOn = 0, heldOn = 0, savedFalse = 0, lostReal = 0;

    records.forEach(function (rec, i) {
      var s = scene(rec.scene);
      if (raw[i]) rawOn++;
      if (held[i]) heldOn++;
      if (raw[i] && !held[i]) { if (s.alarm) lostReal++; else savedFalse++; }
    });

    return {
      raw: raw, held: held,
      rawOn: rawOn, heldOn: heldOn,
      savedFalse: savedFalse,   // 지속 조건 덕에 사라진 헛경보
      lostReal: lostReal        // 지속 조건 때문에 늦어진 진짜 경고
    };
  }

  /* ---------------------------------------------------------
     micro:bit LED 5×5 아이콘
     ⚠ 엔트리·MakeCode 의 실제 아이콘 픽셀과 한 칸씩 다를 수 있다.
       여기서는 «얼굴이 세 가지로 확실히 구별되는 것» 만 지킨다.
       실제 블록 이름(Happy · Meh · Sad)은 LEVELS 에 있다.
     --------------------------------------------------------- */
  var ICONS = {
    Happy: [[0,1,0,1,0],
            [0,1,0,1,0],
            [0,0,0,0,0],
            [1,0,0,0,1],
            [0,1,1,1,0]],
    Meh:   [[0,1,0,1,0],
            [0,1,0,1,0],
            [0,0,0,0,0],
            [1,1,1,1,1],
            [0,0,0,0,0]],
    Sad:   [[0,1,0,1,0],
            [0,1,0,1,0],
            [0,0,0,0,0],
            [0,1,1,1,0],
            [1,0,0,0,1]]
  };

  /* ---------------------------------------------------------
     기본값 — 슬라이드 14 의 예시 기준
     --------------------------------------------------------- */
  var DEFAULT = { t1: 60, t2: 120, le: false, dt: 0.1, hold: 3 };

  global.Noise = {
    SCENES: SCENES, LEVELS: LEVELS, ORDERS: ORDERS, ICONS: ICONS, DEFAULT: DEFAULT,
    rng: rng, scene: scene, order: order,
    makeStream: makeStream, series: series, mixed: mixed,
    judge: judge, isDanger: isDanger, runOrder: runOrder,
    stats: stats, sustain: sustain, compareSustain: compareSustain,
    clampVal: clampVal
  };

  /* node 에서도 쓸 수 있게 (검사 파일용) */
  if (typeof module === "object" && module.exports) module.exports = global.Noise;

})(typeof window !== "undefined" ? window : globalThis);
