/* =========================================================
   radio.js — micro:bit 무선 통신 계산 엔진

   화면을 전혀 모른다. 거리·벽·송신출력만 받아서
   ① 신호 세기(RSSI)가 얼마인지  ② 그 패킷이 도착할지
   두 가지를 계산한다.

   실습 3개(그룹 텔레포트 · 보물찾기 · 근접 비콘)가 모두
   이 계산 위에서 돌아간다.
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     1. micro:bit 의 실제 값들

     radio.setTransmitPower(0~7) 이 내보내는 세기(dBm).
     nRF52 칩이 실제로 쓰는 단계와 같게 맞췄다.
     0 이 가장 약하고(-30dBm) 7 이 가장 세다(+4dBm).
     micro:bit 의 기본값은 6 이다.
     --------------------------------------------------------- */
  var TX_DBM = [-30, -20, -16, -12, -8, -4, 0, 4];

  /* MakeCode 의 '신호 세기' 블록이 돌려주는 범위.
     -95 가 가장 약하고 -42 가 가장 세다. (파이썬은 -98 ~ -45) */
  var RSSI_MIN = -95;
  var RSSI_MAX = -42;

  /* 2.4GHz 전파가 1m 를 가는 동안 줄어드는 양(dB). 자유공간 손실이다. */
  var LOSS_1M = 40;

  /* 거리가 멀어질 때 줄어드는 정도.
     아무것도 없는 벌판은 2.0, 가구와 벽이 있는 집 안은 2.5 정도다. */
  var PATH_N = 2.5;

  /* 벽 하나를 지날 때마다 더 줄어드는 양(dB).
     콘크리트는 더 크지만 교실에서 다룰 수준으로 6dB 로 잡았다. */
  var WALL_DB = 6;

  /* 패킷이 100% 도착하는 경계와, 아예 못 받는 바닥.
     이 사이에서는 '가끔' 도착한다 → 보물찾기에서 가까울수록 자주 뜨는 이유다. */
  var GOOD_DB = -80;
  var FLOOR_DB = RSSI_MIN;

  /* ---------------------------------------------------------
     2. 작은 도구들
     --------------------------------------------------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* MakeCode 의 '비례 변환(map)' 블록과 같은 계산.
     스테이지 3 에서 RSSI(-95~-42) 를 LED 밝기(0~9) 로 바꿀 때 쓴다. */
  function mapRange(v, a1, a2, b1, b2) {
    if (a2 === a1) return b1;
    return b1 + (v - a1) * (b2 - b1) / (a2 - a1);
  }

  /* 두 점 사이의 거리(m) */
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------------------------------------------------------
     3. 씨앗을 주는 난수 (mulberry32)

     Math.random 을 그대로 쓰지 않는 이유 :
     학생마다 결과가 달라지면 "선생님, 저는 안 돼요" 가 나온다.
     같은 씨앗을 주면 언제 열어도 같은 흔들림이 재현된다.
     (ai-class 의 K-Means 에서 얻은 교훈과 같은 판단)
     --------------------------------------------------------- */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 가우시안에 가까운 흔들림(dB). 실제 RSSI 는 가만히 있어도 ±2~4dB 흔들린다. */
  function jitter(rng, amount) {
    var u = (rng() + rng() + rng() - 1.5) * 2;   // -3~3 근처, 가운데가 두껍다
    return u * amount / 3;
  }

  /* ---------------------------------------------------------
     4. 벽 세기 — 신호가 지나가는 길에 벽이 몇 개인가

     벽은 선분 {x1,y1,x2,y2} 목록이다.
     보내는 곳과 받는 곳을 이은 직선이 벽과 만나면 한 장 센다.
     --------------------------------------------------------- */
  function segCross(a, b, c, d) {
    function cross(o, p, q) {
      return (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
    }
    var d1 = cross(a, b, c), d2 = cross(a, b, d);
    var d3 = cross(c, d, a), d4 = cross(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  function countWalls(walls, from, to) {
    if (!walls || !walls.length) return 0;
    var n = 0;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (segCross(from, to, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) n++;
    }
    return n;
  }

  /* ---------------------------------------------------------
     5. 신호 세기 계산 — 이 파일의 심장

       RSSI = 송신세기 − 1m손실 − 거리손실 − 벽손실 (+ 흔들림)

     opt = {
       from, to   : {x, y}  (단위 m)
       power      : 0~7     (radio.setTransmitPower)
       walls      : 벽 선분 목록 (없어도 됨)
       rng        : 흔들림용 난수 (없으면 흔들리지 않는다)
       noise      : 흔들림 크기(dB), 기본 2.5
     }
     --------------------------------------------------------- */
  function rssi(opt) {
    var d = Math.max(0.3, dist(opt.from, opt.to));      // 0.3m 보다 가까우면 같은 자리로 본다
    var tx = TX_DBM[clamp(opt.power == null ? 6 : opt.power, 0, 7)];
    var walls = countWalls(opt.walls, opt.from, opt.to);

    var v = tx - LOSS_1M - 10 * PATH_N * Math.log(d) / Math.LN10 - walls * WALL_DB;
    if (opt.rng) v += jitter(opt.rng, opt.noise == null ? 2.5 : opt.noise);

    return clamp(v, RSSI_MIN, RSSI_MAX);
  }

  /* 벽을 몇 장 지났는지만 따로 알고 싶을 때 (화면에 설명으로 띄운다) */
  function wallsBetween(opt) {
    return countWalls(opt.walls, opt.from, opt.to);
  }

  /* ---------------------------------------------------------
     6. 이 패킷이 도착할까

     신호가 -75dBm 보다 세면 거의 다 도착하고,
     -95dBm 에 가까워지면 거의 못 받는다. 그 사이에서는 가끔 받는다.
     → 보물찾기에서 "가까이 갈수록 ID 가 자주 뜨는" 것이 바로 이 구간이다.
     --------------------------------------------------------- */
  function deliveryRate(r) {
    if (r >= GOOD_DB) return 1;
    if (r <= FLOOR_DB) return 0;
    var t = (r - FLOOR_DB) / (GOOD_DB - FLOOR_DB);   // 0~1
    return t * t;                                     // 아래쪽에서 더 빨리 나빠진다
  }

  function delivered(r, rng) {
    return (rng ? rng() : Math.random()) < deliveryRate(r);
  }

  /* ---------------------------------------------------------
     7. 배터리 — 전송 간격이 수명을 정한다

     보물찾기 3단계('배터리를 아끼려면')를 숫자로 보여 주려고 넣었다.

     ⚠ 전제 : **보낼 때만 깨어나는 절전(sleep) 방식**으로 짰다고 본다.
        micro:bit 를 그냥 켜 두면(계속 반복문을 돌면) 전류가 8mA 쯤으로 일정해
        간격을 아무리 늘려도 수명이 거의 안 변한다. 그러면 학생이 조절해 볼 것이 없다.
        그래서 '절전을 쓴다면 이만큼 차이가 난다'를 보여 주고,
        화면에도 그 전제를 함께 적어 둔다. 정확한 제품 수치가 아니라 어림값이다.

     AAA 2개 = 대략 1000mAh 로 잡았다.
     --------------------------------------------------------- */
  function batteryHours(intervalMs, power) {
    var SLEEP_MA = 0.6;                                     // 잠들어 있을 때
    var ACTIVE_MA = 10 + TX_DBM[clamp(power, 0, 7)] * 0.2;  // 깨어나 보낼 때
    var ACTIVE_MS = 8;                                      // 한 번 보내는 데 걸리는 시간
    var avg = SLEEP_MA + ACTIVE_MA * ACTIVE_MS / Math.max(20, intervalMs);
    return 1000 / avg;
  }

  /* ---------------------------------------------------------
     8. 내보내기
     --------------------------------------------------------- */
  global.Radio = {
    TX_DBM: TX_DBM,
    RSSI_MIN: RSSI_MIN,
    RSSI_MAX: RSSI_MAX,
    WALL_DB: WALL_DB,
    PATH_N: PATH_N,
    LOSS_1M: LOSS_1M,
    GOOD_DB: GOOD_DB,

    clamp: clamp,
    mapRange: mapRange,
    dist: dist,
    makeRng: makeRng,
    jitter: jitter,
    countWalls: countWalls,
    wallsBetween: wallsBetween,
    rssi: rssi,
    deliveryRate: deliveryRate,
    delivered: delivered,
    batteryHours: batteryHours
  };
})(window);
