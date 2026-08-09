/* =========================================================
   sim.js — 스마트하우스 무선통신 시뮬레이터 (화면)

   스테이지 3개가 실습 3개와 1:1 로 붙어 있다.
     ① 명령이 누구에게 가는가   → 실습① 그룹 텔레포트(오리)
     ② 기기를 어떻게 찾는가     → 실습② 보물찾기
     ③ 가까이 가면 반응한다     → 실습③ 근접 비콘

   계산은 전부 js/radio.js 가 한다. 이 파일은 그리고 만지는 일만 맡는다.
   ========================================================= */
(function (global) {
  "use strict";

  var R = global.Radio;

  /* ---------------------------------------------------------
     0. 화면 상수
     --------------------------------------------------------- */
  var C = {
    ink: "#111827", sub: "#4b5563", faint: "#9ca3af",
    line: "#d1d5db", brand: "#4f46e5", band: "#eef2ff",
    ok: "#059669", no: "#dc2626", warn: "#d97706",
    floor: "#f8fafc", floor2: "#eef2f7", wall: "#334155",
    grass: "#e7f3e3", road: "#e5e7eb", sky: "#f1f5f9"
  };
  var FONT = "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif";

  /* 전파가 화면에서 퍼지는 속도(m/s). 실제 빛의 속도로 그리면 보이지 않는다 */
  var WAVE_MPS = 16;

  /* ---------------------------------------------------------
     1. 상태
     --------------------------------------------------------- */
  var S = {
    stage: 1,
    scene: "house",          // 스테이지 1 에서만 house / duck
    cv: null, g: null,
    W: 0, H: 0,              // 캔버스 실제 픽셀
    world: { w: 25, h: 10.5 },
    pad: 16,                 // 바깥 여백(px) — 집 이름표가 위쪽에서 잘리지 않을 만큼
    scale: 1, ox: 0, oy: 0,
    waves: [],               // 퍼지는 전파 {x,y,born,color}
    flash: {},               // 기기별 반짝임 {key: 남은시간}
    now: 0,
    drag: null,
    rng: R.makeRng(20260808),
    log: []
  };

  /* 스테이지별 데이터는 여기에 담는다 */
  var one = null, duck = null, two = null, three = null;

  /* ---------------------------------------------------------
     2. 스테이지 설명 문구
     --------------------------------------------------------- */
  var STAGES = {
    1: {
      title: "명령이 누구에게 가는가",
      lead: "무선 명령은 편지가 아니라 확성기다. 근처에 있는 모두가 듣는다. " +
            "그런데도 거실등만 켜지는 이유는 두 가지 — 그룹 번호와 주소다.",
      hint: "<b>모두가 듣지만, 자기 이름일 때만 실행한다.</b> " +
            "실습①의 <code>if message == str(myID)</code> 가 바로 이 줄이다.",
      note: "이 스테이지에서는 신호가 항상 닿는다고 봅니다. 거리 이야기는 스테이지 ②에서 합니다.",
      next: "실습① <b>그룹 텔레포트</b> — 오리를 무선으로 주고받는다. " +
            "지금 익힌 '그룹을 맞추고, 받을 사람 번호를 메시지에 담는다'가 그대로 나온다.",
      link: "https://microbit.org/ko/projects/make-it-code-it/group-teleporting-duck/",
      slides: [5, 6]
    },
    2: {
      title: "기기를 어떻게 찾는가",
      lead: "숨은 비콘 3개가 200밀리초마다 자기 번호를 외치고 있다. " +
            "가까이 갈수록 번호가 자주 뜬다 — 그것이 유일한 단서다.",
      hint: "<b>왜 가까울수록 자주 뜰까?</b> 신호가 약해지면 패킷이 <u>가끔씩만</u> 도착하기 때문이다. " +
            "완전히 끊기는 것이 아니라 '띄엄띄엄' 온다.",
      note: "파란 수신기를 끌어서 옮기세요. 화살표 키로도 움직입니다.",
      next: "실습② <b>보물찾기</b> — 비콘을 교실에 숨기고 찾아낸다. " +
            "여기서 정한 <b>송신 출력</b>과 <b>전송 간격</b>을 그대로 쓰면 된다.",
      link: "https://microbit.org/ko/projects/make-it-code-it/treasure-hunt/",
      slides: [7, 8, 9]
    },
    3: {
      title: "가까이 가면 반응한다",
      lead: "신호 세기(RSSI)를 숫자로 읽으면 '얼마나 가까운지'를 짐작할 수 있다. " +
            "그 숫자로 현관등을 자동으로 켜 보자.",
      hint: "<b>정답이 하나가 아니다.</b> 임계값을 높이면 문 앞에서도 안 켜지고(미탐), " +
            "낮추면 지나가던 사람에게 켜진다(오탐). 둘 다 0으로 만드는 값을 찾아야 한다.",
      note: "사람을 끌어서 옮길 수도 있고, 걷기 시험으로 자동 채점할 수도 있습니다.",
      next: "실습③ <b>근접 비콘</b> — 신호 세기를 LED 밝기로 바꾼다. " +
            "여기서 본 <b>비례 변환(map)</b> 계산이 그 코드의 핵심이다.",
      link: "https://microbit.org/ko/projects/make-it-code-it/proximity-beacon/",
      slides: [10, 11, 12]
    }
  };

  /* ---------------------------------------------------------
     3. micro:bit 5×5 숫자 글꼴
     --------------------------------------------------------- */
  var GLYPH = {
    "0": ["01100", "10010", "10010", "10010", "01100"],
    "1": ["00100", "01100", "00100", "00100", "01110"],
    "2": ["11100", "00010", "01100", "10000", "11110"],
    "3": ["11110", "00010", "01100", "00010", "11110"],
    "4": ["10010", "10010", "11110", "00010", "00010"],
    "5": ["11110", "10000", "11110", "00010", "11110"],
    "6": ["01110", "10000", "11110", "10010", "01100"],
    "7": ["11110", "00010", "00100", "01000", "01000"],
    "8": ["01100", "10010", "01100", "10010", "01100"],
    "9": ["01100", "10010", "01110", "00010", "01100"],
    "?": ["01100", "10010", "00100", "00000", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000"]
  };

  /* ---------------------------------------------------------
     4. 장면 만들기
     --------------------------------------------------------- */

  /* --- 스테이지 1 : 우리 집 + 옆집 --- */
  function buildOne() {
    var wallsMine = [
      /* 바깥벽 (현관문 자리는 비워 둔다) */
      { x1: 0.5, y1: 0.5, x2: 11.5, y2: 0.5 },
      { x1: 11.5, y1: 0.5, x2: 11.5, y2: 9.8 },
      { x1: 11.5, y1: 9.8, x2: 6.2, y2: 9.8 },
      { x1: 4.2, y1: 9.8, x2: 0.5, y2: 9.8 },
      { x1: 0.5, y1: 9.8, x2: 0.5, y2: 0.5 },
      /* 안쪽 벽 (문 자리를 비워 둔다) */
      { x1: 6.0, y1: 0.5, x2: 6.0, y2: 2.6 },
      { x1: 6.0, y1: 4.2, x2: 6.0, y2: 9.8 },
      { x1: 6.0, y1: 5.4, x2: 8.8, y2: 5.4 },
      { x1: 10.2, y1: 5.4, x2: 11.5, y2: 5.4 }
    ];
    var wallsNb = wallsMine.map(function (w) {
      return { x1: w.x1 + 13, y1: w.y1, x2: w.x2 + 13, y2: w.y2 };
    });

    one = {
      walls: wallsMine.concat(wallsNb),
      houses: [
        { x: 0.5, y: 0.5, w: 11, h: 9.3, name: "우리 집 (1호)", mine: true },
        { x: 13.5, y: 0.5, w: 11, h: 9.3, name: "옆집 (2호)", mine: false }
      ],
      rooms: [
        { x: 3.2, y: 1.3, t: "거실" }, { x: 8.7, y: 1.3, t: "주방" }, { x: 8.7, y: 6.4, t: "안방" },
        { x: 16.2, y: 1.3, t: "거실" }, { x: 21.7, y: 1.3, t: "주방" }, { x: 21.7, y: 6.4, t: "안방" }
      ],
      devices: [
        { key: "light", icon: "💡", name: "거실등", x: 3.0, y: 3.2, mine: true, on: false },
        { key: "curtain", icon: "🪟", name: "커튼", x: 1.3, y: 6.6, mine: true, on: false },
        { key: "lock", icon: "🚪", name: "도어락", x: 5.2, y: 9.2, mine: true, on: false },
        { key: "boiler", icon: "🌡️", name: "보일러", x: 9.6, y: 3.0, mine: true, on: false },
        { key: "light", icon: "💡", name: "거실등(2호)", x: 16.0, y: 3.2, mine: false, on: false },
        { key: "lock", icon: "🚪", name: "도어락(2호)", x: 18.2, y: 9.2, mine: false, on: false }
      ],
      remote: { x: 3.4, y: 7.9 },
      myGroup: 7, nbGroup: 7, remGroup: 7,
      target: "all", cmd: true,
      pending: []
    };
    S.world = { w: 25, h: 10.5 };
  }

  /* --- 스테이지 1 : 오리 릴레이 --- */
  function buildDuck(n) {
    n = n || 4;
    var people = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      people.push({
        id: i + 1,
        x: 12.5 + Math.cos(a) * 6.6,
        y: 5.6 + Math.sin(a) * 3.6,
        got: 0
      });
    }
    people[0].got = 1;
    duck = { people: people, holder: 1, tosses: 0, flying: null, group: 42 };
    S.world = { w: 25, h: 10.5 };
  }

  /* --- 스테이지 2 : 숨은 비콘 찾기 --- */
  var BEACON_SETS = [
    [{ x: 2.2, y: 2.2 }, { x: 14.2, y: 2.6 }, { x: 13.0, y: 9.2 }],
    [{ x: 6.8, y: 1.6 }, { x: 10.2, y: 9.6 }, { x: 2.0, y: 9.8 }],
    [{ x: 1.6, y: 6.4 }, { x: 15.4, y: 8.0 }, { x: 7.4, y: 3.2 }]
  ];

  function buildTwo(setIdx) {
    var set = BEACON_SETS[(setIdx || 0) % BEACON_SETS.length];
    two = {
      setIdx: setIdx || 0,
      walls: [
        { x1: 0.5, y1: 0.5, x2: 16.5, y2: 0.5 },
        { x1: 16.5, y1: 0.5, x2: 16.5, y2: 11 },
        { x1: 16.5, y1: 11, x2: 0.5, y2: 11 },
        { x1: 0.5, y1: 11, x2: 0.5, y2: 0.5 },
        { x1: 0.5, y1: 4.5, x2: 3.0, y2: 4.5 },
        { x1: 4.5, y1: 4.5, x2: 8.5, y2: 4.5 },
        { x1: 8.5, y1: 0.5, x2: 8.5, y2: 2.5 },
        { x1: 8.5, y1: 4.0, x2: 8.5, y2: 11 },
        { x1: 8.5, y1: 5.5, x2: 12.0, y2: 5.5 },
        { x1: 13.5, y1: 5.5, x2: 16.5, y2: 5.5 }
      ],
      rooms: [
        { x: 4.4, y: 1.3, t: "공부방" }, { x: 4.4, y: 5.3, t: "거실" },
        { x: 12.4, y: 1.3, t: "주방" }, { x: 12.4, y: 6.3, t: "안방" }
      ],
      beacons: set.map(function (p, i) {
        return { id: i + 1, x: p.x, y: p.y, found: false, lastRecv: -1, hits: [] };
      }),
      rx: { x: 8.0, y: 8.0 },
      /* 출력 0 으로 시작한다. 6(기본값)으로 두면 집 전체에서 100% 잡혀
         '가까울수록 자주 뜬다'는 단서가 아예 사라진다. */
      power: 0, interval: 200, reveal: false,
      nextSend: 0, blink: null
    };
    S.world = { w: 17, h: 11.5 };
  }

  /* --- 스테이지 3 : 현관등 자동화 --- */
  function buildThree() {
    three = {
      /* ⚠ 세계 높이가 곧 그림 크기다.
         캔버스 높이를 화면에 맞춰 묶어 두었으므로(조작이 같이 보여야 한다)
         세계가 세로로 길면 배율이 떨어져 글자와 아이콘이 뭉개진다.
         집을 낮게 잡되 **길은 비콘에서 충분히 멀리** 두어야 한다 —
         문턱 -46 dBm 과 길 -57 dBm 의 차이가 이 스테이지의 전부이기 때문이다. */
      walls: [
        { x1: 7, y1: 0.5, x2: 19, y2: 0.5 },
        { x1: 19, y1: 0.5, x2: 19, y2: 5.6 },
        { x1: 19, y1: 5.6, x2: 14.0, y2: 5.6 },
        { x1: 11.6, y1: 5.6, x2: 7, y2: 5.6 },
        { x1: 7, y1: 5.6, x2: 7, y2: 0.5 },
        { x1: 13.2, y1: 0.5, x2: 13.2, y2: 3.4 }
      ],
      beacon: { x: 12.8, y: 4.5 },
      door: { x: 12.8, y: 5.6 },
      person: { x: 3.0, y: 9.2 },
      power: 6, thr: -70, noise: true,
      lightOn: false, rssi: -95,
      hist: [], histAt: 0,
      walk: null,
      score: null
    };
    S.world = { w: 24, h: 10.8 };
  }

  /* ---------------------------------------------------------
     5. 좌표 변환 · 캔버스 크기
     --------------------------------------------------------- */
  /* 캔버스 높이는 CSS 가 화면 높이에 맞춰 정한다(조작이 같이 보여야 하므로).
     세계의 비율은 스테이지마다 다르지만, 남는 자리는 fit() 이 여백으로 처리한다.
     ⚠ 스크립트에서 캔버스 크기를 직접 정하지 말 것 —
        ResizeObserver → fit → style 로 크기가 서로를 밀어내는 되먹임이 생긴다. */
  function fit() {
    var cv = S.cv;
    var rect = cv.getBoundingClientRect();
    var w = Math.max(320, Math.round(rect.width));
    /* 높이는 CSS 의 aspect-ratio 가 정한다. 스크립트가 style 을 건드리면
       크기가 서로를 밀어내는 되먹임이 생긴다(EnergyKeeper 에서 겪은 문제). */
    var h = Math.max(200, Math.round(rect.height));
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    S.W = cv.width; S.H = cv.height;
    S.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.VW = w; S.VH = h;

    var sx = (w - S.pad * 2) / S.world.w;
    var sy = (h - S.pad * 2) / S.world.h;
    S.scale = Math.min(sx, sy);
    S.ox = (w - S.world.w * S.scale) / 2;
    S.oy = (h - S.world.h * S.scale) / 2;
  }

  function PX(x) { return S.ox + x * S.scale; }
  function PY(y) { return S.oy + y * S.scale; }
  function MX(px) { return (px - S.ox) / S.scale; }
  function MY(py) { return (py - S.oy) / S.scale; }

  /* ---------------------------------------------------------
     6. 그리기 도구
     --------------------------------------------------------- */
  function rect(g, x, y, w, h, fill, stroke, lw) {
    g.beginPath();
    g.rect(PX(x), PY(y), w * S.scale, h * S.scale);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
  }

  function drawWalls(g, walls) {
    g.strokeStyle = C.wall;
    g.lineWidth = Math.max(3, S.scale * 0.22);
    g.lineCap = "round";
    walls.forEach(function (w) {
      g.beginPath();
      g.moveTo(PX(w.x1), PY(w.y1));
      g.lineTo(PX(w.x2), PY(w.y2));
      g.stroke();
    });
  }

  function label(g, x, y, text, size, color, align) {
    g.fillStyle = color || C.sub;
    g.font = (size || 15) + "px " + FONT;
    g.textAlign = align || "center";
    g.textBaseline = "middle";
    g.fillText(text, PX(x), PY(y));
  }

  /* 말풍선. 캔버스 밖으로 잘리지 않게 가로 위치를 안쪽으로 밀어 넣는다 */
  function chip(g, x, y, text, bg, fg, size) {
    size = size || 14;
    g.font = "bold " + size + "px " + FONT;
    var w = g.measureText(text).width + 16;
    var h = size + 12;
    var cx = R.clamp(PX(x), w / 2 + 2, S.VW - w / 2 - 2);
    var cy = R.clamp(PY(y), h / 2 + 2, S.VH - h / 2 - 2);
    var px = cx - w / 2, py = cy - h / 2;
    g.fillStyle = bg;
    roundRect(g, px, py, w, h, 7); g.fill();
    g.fillStyle = fg;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, cx, cy + 1);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* 퍼지는 전파 그리기 — 이 앱의 얼굴이다 */
  function drawWaves(g) {
    var live = [];
    for (var i = 0; i < S.waves.length; i++) {
      var w = S.waves[i];
      var age = (S.now - w.born) / 1000;
      var r = age * WAVE_MPS;
      if (r > w.max) continue;
      live.push(w);
      var fade = 1 - r / w.max;
      /* 얇은 원 세 겹으로 파동처럼 보이게 한다 */
      g.strokeStyle = "rgb(" + (w.rgb || "79,70,229") + ")";
      g.lineWidth = Math.max(1.5, S.scale * 0.09);
      for (var k = 0; k < 3; k++) {
        var rr = r - k * 0.75;
        if (rr <= 0) continue;
        g.globalAlpha = fade * (1 - k * 0.28) * 0.75;
        g.beginPath();
        g.arc(PX(w.x), PY(w.y), rr * S.scale, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    S.waves = live;
  }

  function pushWave(x, y, max, rgb) {
    S.waves.push({ x: x, y: y, born: S.now, max: max || 30, rgb: rgb });
  }

  /* ---------------------------------------------------------
     7. 스테이지 1 그리기
     --------------------------------------------------------- */
  function drawOne(g) {
    var o = one;
    /* 바닥 */
    o.houses.forEach(function (h) {
      rect(g, h.x, h.y, h.w, h.h, h.mine ? "#ffffff" : C.floor2);
    });
    o.rooms.forEach(function (r) { label(g, r.x, r.y, r.t, 14, C.faint); });
    drawWalls(g, o.walls);

    /* 집 이름표 — 이름 길이를 재서 그룹 번호를 그 뒤에 붙인다 */
    o.houses.forEach(function (h) {
      g.textAlign = "left"; g.textBaseline = "bottom";
      g.fillStyle = h.mine ? C.brand : C.faint;
      g.font = "bold 17px " + FONT;
      g.fillText(h.name, PX(h.x), PY(h.y) - 6);
      var nameW = g.measureText(h.name).width;
      g.font = "14px " + FONT;
      g.fillStyle = C.sub;
      g.fillText("기기 그룹 " + (h.mine ? o.myGroup : o.nbGroup) + "번", PX(h.x) + nameW + 14, PY(h.y) - 6);
    });

    drawWaves(g);

    /* 기기 */
    o.devices.forEach(function (d, i) {
      var px = PX(d.x), py = PY(d.y);
      var rr = Math.max(17, S.scale * 0.75);
      /* 켜졌을 때 빛나는 테 */
      if (d.on) {
        g.beginPath(); g.arc(px, py, rr * 1.75, 0, Math.PI * 2);
        g.fillStyle = "rgba(217,119,6,.20)"; g.fill();
      }
      g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2);
      g.fillStyle = d.on ? "#fff7ed" : "#ffffff";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = d.on ? C.warn : (d.mine ? C.line : "#e5e7eb");
      g.stroke();

      g.font = Math.round(rr * 1.15) + "px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(d.icon, px, py + 1);

      g.font = "13px " + FONT;
      g.fillStyle = d.mine ? C.sub : C.faint;
      g.textBaseline = "top";
      g.fillText(d.name, px, py + rr + 4);

      /* 방금 무슨 일이 있었는지 */
      var f = S.flash["dev" + i];
      if (f && f.t > S.now) {
        var txt = f.kind === "run" ? "실행!" : (f.kind === "mine" ? "주소 다름" : "그룹 다름");
        var bg = f.kind === "run" ? C.ok : (f.kind === "mine" ? C.faint : C.no);
        chip(g, d.x, d.y - 1.3, txt, bg, "#fff", 13);
      }
    });

    /* 리모컨 */
    var rm = o.remote;
    var rw = 1.5, rh = 2.2;
    g.save();
    roundRect(g, PX(rm.x - rw / 2), PY(rm.y - rh / 2), rw * S.scale, rh * S.scale, 8);
    g.fillStyle = C.brand; g.fill();
    g.restore();
    g.fillStyle = "#fff";
    g.font = "bold 13px " + FONT;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("리모컨", PX(rm.x), PY(rm.y) - 8);
    g.font = "bold 15px " + FONT;
    g.fillText("G" + o.remGroup, PX(rm.x), PY(rm.y) + 12);
  }

  /* ---------------------------------------------------------
     8. 오리 릴레이 그리기
     --------------------------------------------------------- */
  function drawDuck(g) {
    var d = duck;
    g.fillStyle = C.sky;
    g.fillRect(PX(0.2), PY(0.2), (S.world.w - 0.4) * S.scale, (S.world.h - 0.4) * S.scale);

    label(g, 12.5, 0.9, "같은 그룹 " + d.group + "번 · 오리를 가진 사람만 보낼 수 있다", 15, C.sub);

    /* 날아가는 오리 */
    if (d.flying) {
      var f = d.flying;
      var t = Math.min(1, (S.now - f.born) / 700);
      var a = f.from, b = f.to;
      var x = a.x + (b.x - a.x) * t;
      var y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 1.4;
      g.font = Math.round(S.scale * 1.4) + "px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("🐤", PX(x), PY(y));
      chip(g, (a.x + b.x) / 2, (a.y + b.y) / 2 - 0.6, "\"" + f.msg + "\"", C.brand, "#fff", 13);
    }

    drawWaves(g);

    d.people.forEach(function (p) {
      var px = PX(p.x), py = PY(p.y);
      var rr = Math.max(20, S.scale * 0.9);
      var has = d.holder === p.id && !d.flying;
      g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2);
      g.fillStyle = has ? "#fef3c7" : "#fff";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = has ? C.warn : C.line;
      g.stroke();
      g.fillStyle = C.ink;
      g.font = "bold " + Math.round(rr * 0.9) + "px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(p.id), px, py + 1);
      if (has) {
        g.font = Math.round(rr * 0.95) + "px " + FONT;
        g.fillText("🐤", px + rr * 0.95, py - rr * 0.8);
      }
      g.font = "13px " + FONT;
      g.fillStyle = p.got > 0 ? C.ok : C.faint;
      g.textBaseline = "top";
      g.fillText(p.got > 0 ? "받음 " + p.got + "회" : "아직", px, py + rr + 5);
    });

    chip(g, 12.5, 5.6, "넘긴 횟수 " + d.tosses, "#fff", C.ink, 16);
  }

  /* ---------------------------------------------------------
     9. 스테이지 2 그리기
     --------------------------------------------------------- */
  function drawTwo(g) {
    var t = two;
    rect(g, 0.5, 0.5, 16, 10.5, "#ffffff");
    t.rooms.forEach(function (r) { label(g, r.x, r.y, r.t, 14, C.faint); });
    drawWalls(g, t.walls);

    drawWaves(g);

    /* 비콘 */
    t.beacons.forEach(function (b) {
      var px = PX(b.x), py = PY(b.y);
      var show = t.reveal || b.found;
      var rr = Math.max(15, S.scale * 0.62);
      if (show) {
        g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2);
        g.fillStyle = b.found ? "#ecfdf5" : "#fff";
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = b.found ? C.ok : C.warn;
        g.stroke();
        g.fillStyle = C.ink;
        g.font = "bold " + Math.round(rr * 0.95) + "px " + FONT;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(b.id), px, py + 1);
        if (b.found) chip(g, b.x, b.y - 0.95, "찾음!", C.ok, "#fff", 12);
      } else {
        /* 숨어 있을 때는 아주 흐린 점만 (디버깅용이 아니라 방향감을 위해서) */
        g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2);
        g.fillStyle = "rgba(0,0,0,.06)"; g.fill();
      }
    });

    /* 수신기 */
    var rx = t.rx;
    var rr2 = Math.max(16, S.scale * 0.68);
    g.beginPath(); g.arc(PX(rx.x), PY(rx.y), rr2 * 1.9, 0, Math.PI * 2);
    g.fillStyle = "rgba(79,70,229,.10)"; g.fill();
    g.beginPath(); g.arc(PX(rx.x), PY(rx.y), rr2, 0, Math.PI * 2);
    g.fillStyle = C.brand; g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 13px " + FONT;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("RX", PX(rx.x), PY(rx.y) + 1);
    g.font = "13px " + FONT;
    g.fillStyle = C.sub;
    g.textBaseline = "top";
    g.fillText("수신기 (끌어서 이동)", PX(rx.x), PY(rx.y) + rr2 + 5);
  }

  /* ---------------------------------------------------------
     10. 스테이지 3 그리기
     --------------------------------------------------------- */
  function drawThree(g) {
    var t = three;

    /* 마당과 길 — 길은 걷기 시험이 지나가는 자리다(그래프로 덮지 말 것) */
    rect(g, 0.2, 5.6, 23.6, 2.8, C.grass);
    rect(g, 0.2, 8.4, 23.6, 1.6, C.road);
    label(g, 1.4, 9.2, "길", 14, C.faint);
    label(g, 3.2, 6.6, "마당", 14, "#86a37e");

    /* 집 */
    rect(g, 7, 0.5, 12, 5.1, "#ffffff");
    label(g, 10.0, 1.5, "거실", 14, C.faint);
    label(g, 16.2, 1.5, "주방", 14, C.faint);
    drawWalls(g, t.walls);

    /* 현관문 */
    g.strokeStyle = C.warn;
    g.lineWidth = Math.max(3, S.scale * 0.22);
    g.beginPath(); g.moveTo(PX(11.6), PY(5.6)); g.lineTo(PX(14.0), PY(5.6)); g.stroke();
    label(g, 10.0, 5.95, "현관문", 13, C.warn);

    drawWaves(g);

    /* 현관등 — 문 오른쪽 바깥벽에 달려 있다 (비콘과 겹치지 않게).
       이모지(🌑)는 기기마다 색이 달라 꺼진 상태가 보라색 덩어리로 보였다. 직접 그린다. */
    var lx = 16.4, ly = 6.4, lr = Math.max(12, S.scale * 0.42);
    if (t.lightOn) {
      g.beginPath(); g.arc(PX(lx), PY(ly), lr * 3.2, 0, Math.PI * 2);
      g.fillStyle = "rgba(250,204,21,.30)"; g.fill();
    }
    g.beginPath(); g.arc(PX(lx), PY(ly), lr, 0, Math.PI * 2);
    g.fillStyle = t.lightOn ? "#fde047" : "#e5e7eb";
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = t.lightOn ? C.warn : C.faint;
    g.stroke();
    g.font = "bold 13px " + FONT;
    g.fillStyle = t.lightOn ? C.warn : C.faint;
    g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(t.lightOn ? "현관등 ON" : "현관등 OFF", PX(lx), PY(ly) + lr + 5);

    /* 비콘 */
    var b = t.beacon;
    g.beginPath(); g.arc(PX(b.x), PY(b.y), Math.max(10, S.scale * 0.34), 0, Math.PI * 2);
    g.fillStyle = C.warn; g.fill();
    g.font = "13px " + FONT;
    g.fillStyle = C.sub; g.textBaseline = "middle"; g.textAlign = "left";
    g.fillText("비콘", PX(b.x) + 15, PY(b.y));

    /* 사람 */
    function person(p, kind) {
      var px = PX(p.x), py = PY(p.y);
      var rr = Math.max(12, S.scale * 0.42);
      g.beginPath(); g.arc(px, py, rr, 0, Math.PI * 2);
      g.fillStyle = kind === "nb" ? "#f3f4f6" : "#dbeafe";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = kind === "nb" ? C.faint : C.brand;
      g.stroke();
      g.font = Math.round(rr * 1.1) + "px " + FONT;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(kind === "nb" ? "🚶" : "🧍", px, py + 1);
    }
    /* 이름표는 사람 아래에 붙인다 (위에 붙이면 현관문을 가린다) */
    if (t.walk) {
      person(t.walk.pos, t.walk.kind);
      chip(g, t.walk.pos.x, t.walk.pos.y + 1.05,
           t.walk.kind === "nb" ? "옆집 사람 · 지나감" : "우리 집 사람 · 귀가",
           t.walk.kind === "nb" ? C.faint : C.brand, "#fff", 13);
    } else {
      person(t.person, "me");
      chip(g, t.person.x, t.person.y + 1.05, "끌어서 옮기기", C.brand, "#fff", 13);
    }

    /* RSSI 그래프 — 집 왼쪽 빈 자리에 얹는다 */
    drawChart(g, 0.4, 0.6, 6.2, 4.6);
  }

  /* 최근 신호 세기 꺾은선. 오른쪽 끝이 '지금'이다. */
  var HIST_MAX = 240;
  function drawChart(g, x, y, w, h) {
    var t = three;
    var px = PX(x), py = PY(y), pw = w * S.scale, ph = h * S.scale;
    g.fillStyle = "rgba(255,255,255,.94)";
    roundRect(g, px, py, pw, ph, 8); g.fill();
    g.strokeStyle = C.line; g.lineWidth = 1.5; g.stroke();

    g.fillStyle = C.sub;
    g.font = "bold 13px " + FONT;
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("신호 세기 (최근 12초)", px + 8, py + 6);

    var top = py + 24, hh = ph - 34;
    function vy(r) { return top + hh - (r - R.RSSI_MIN) / (R.RSSI_MAX - R.RSSI_MIN) * hh; }

    /* 임계선 */
    var ty = vy(t.thr);
    g.strokeStyle = C.no; g.lineWidth = 2;
    g.setLineDash([7, 5]);
    g.beginPath(); g.moveTo(px + 6, ty); g.lineTo(px + pw - 6, ty); g.stroke();
    g.setLineDash([]);
    /* 임계값은 선 오른쪽 끝에, 눈금은 왼쪽에 — 서로 겹치지 않게 */
    g.fillStyle = C.no;
    g.font = "bold 13px " + FONT;
    g.textAlign = "right"; g.textBaseline = ty < top + 16 ? "top" : "bottom";
    g.fillText("임계값 " + t.thr, px + pw - 8, ty + (ty < top + 16 ? 3 : -3));

    /* 신호 세기 곡선 — 오른쪽 끝이 지금 */
    if (t.hist.length > 1) {
      var n = t.hist.length;
      var stepX = (pw - 12) / (HIST_MAX - 1);
      g.beginPath();
      for (var i = 0; i < n; i++) {
        var xx = px + pw - 6 - (n - 1 - i) * stepX;
        var yy = vy(t.hist[i]);
        if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.strokeStyle = C.brand; g.lineWidth = 2.5; g.stroke();
    }
    g.fillStyle = C.faint;
    g.font = "12px " + FONT;
    g.textAlign = "left"; g.textBaseline = "top";
    g.fillText("-42 강함", px + 8, top);
    g.textBaseline = "bottom";
    g.fillText("-95 약함", px + 8, top + hh);
  }

  /* ---------------------------------------------------------
     11. 그리기 진입점
     --------------------------------------------------------- */
  function draw() {
    var g = S.g;
    if (!g) return;
    g.clearRect(0, 0, S.VW, S.VH);
    g.fillStyle = C.floor;
    g.fillRect(0, 0, S.VW, S.VH);
    g.textAlign = "center"; g.textBaseline = "middle";

    if (S.stage === 1) { if (S.scene === "duck") drawDuck(g); else drawOne(g); }
    else if (S.stage === 2) drawTwo(g);
    else drawThree(g);
  }

  /* ---------------------------------------------------------
     12. 스테이지 1 동작
     --------------------------------------------------------- */
  var TARGET_NAME = {
    all: "모두", light: "거실등", lock: "도어락", curtain: "커튼", boiler: "보일러"
  };

  function sendOne() {
    var o = one;
    pushWave(o.remote.x, o.remote.y, 30);
    addLog("보냄", "group=" + o.remGroup + " · to=" + (o.target === "all" ? "all" : o.target) +
           " · cmd=" + (o.cmd ? "ON" : "OFF"), "send");

    o.devices.forEach(function (d, i) {
      var grp = d.mine ? o.myGroup : o.nbGroup;
      var dd = R.dist(o.remote, d);
      var kind;
      if (grp !== o.remGroup) kind = "group";
      else if (o.target !== "all" && o.target !== d.key) kind = "mine";
      else kind = "run";

      o.pending.push({
        at: S.now + dd / WAVE_MPS * 1000,
        i: i, kind: kind, on: o.cmd
      });
    });
  }

  function stepOne() {
    var o = one;
    if (!o.pending.length) return;
    var rest = [];
    var acted = false;
    for (var i = 0; i < o.pending.length; i++) {
      var p = o.pending[i];
      if (S.now < p.at) { rest.push(p); continue; }
      acted = true;
      var d = o.devices[p.i];
      if (p.kind === "run") d.on = p.on;
      S.flash["dev" + p.i] = { t: S.now + 1400, kind: p.kind };
      var who = (d.mine ? "" : "[옆집] ") + d.name;
      if (p.kind === "run") addLog(who, "실행 → " + (p.on ? "켜짐" : "꺼짐"), "ok");
      else if (p.kind === "mine") addLog(who, "들었지만 내 주소가 아님 → 그냥 둠", "skip");
      else addLog(who, "그룹이 달라 아예 못 알아들음", "no");
    }
    o.pending = rest;
    /* 기기 상태가 바뀌었을 때만 미션을 다시 본다 (매 프레임 검사하지 않는다) */
    if (acted) updateMissions();
  }

  /* ---------------------------------------------------------
     13. 오리 릴레이 동작
     --------------------------------------------------------- */
  function duckShake() {
    var d = duck;
    if (d.flying) return;
    var me = d.people.filter(function (p) { return p.id === d.holder; })[0];
    if (!me) return;
    /* 자기 자신이 아닌 번호가 나올 때까지 다시 뽑는다 (실습 코드와 같은 규칙) */
    var to = me.id;
    var guard = 0;
    while (to === me.id && guard++ < 50) {
      to = 1 + Math.floor(S.rng() * d.people.length);
    }
    var target = d.people.filter(function (p) { return p.id === to; })[0];
    pushWave(me.x, me.y, 26);
    d.flying = { from: { x: me.x, y: me.y }, to: { x: target.x, y: target.y }, msg: to, born: S.now };
    target.got++;
    d.tosses++;
    addLog("플레이어 " + me.id, "흔들기 → radio.send(\"" + to + "\") · 모두가 듣는다", "send");
    d.people.forEach(function (p) {
      if (p.id === to) addLog("플레이어 " + p.id, "내 번호다 → 오리를 받음 🐤", "ok");
      else if (p.id !== me.id) addLog("플레이어 " + p.id, "\"" + to + "\" 은 내 번호가 아님 → 무시", "skip");
    });
    updateMissions();
  }

  /* 날아가던 오리가 도착하면 주인이 바뀐다 */
  function stepDuck() {
    var d = duck;
    if (d && d.flying && S.now - d.flying.born >= 700) {
      d.holder = d.flying.msg;
      d.flying = null;
    }
  }

  /* ---------------------------------------------------------
     14. 스테이지 2 동작
     --------------------------------------------------------- */
  function stepTwo(dt) {
    var t = two;
    if (S.now < t.nextSend) return;
    t.nextSend = S.now + t.interval;

    t.beacons.forEach(function (b) {
      var r = R.rssi({ from: b, to: t.rx, power: t.power, walls: t.walls, rng: S.rng, noise: 2.5 });
      var got = R.delivered(r, S.rng);
      b.hits.push({ t: S.now, got: got });
      if (b.hits.length > 60) b.hits.shift();
      if (got) {
        b.lastRecv = S.now;
        t.blink = { id: b.id, until: S.now + Math.min(180, t.interval * 0.8) };
        pushWave(b.x, b.y, 5, "217,119,6");
        addLog("수신", "비콘 " + b.id + "번 · " + r.toFixed(0) + " dBm", "ok");
      }
    });
    checkFound();
    updateSide();
  }

  /* 최근 3초 동안 받은 비율 */
  function recvRate(b) {
    var cut = S.now - 3000;
    var recent = b.hits.filter(function (h) { return h.t >= cut; });
    if (!recent.length) return 0;
    var n = recent.filter(function (h) { return h.got; }).length;
    return n / recent.length;
  }

  function checkFound() {
    var t = two;
    t.beacons.forEach(function (b) {
      if (b.found) return;
      /* 1.5m 안까지 다가가서 실제로 잘 받고 있으면 '찾았다' */
      if (R.dist(b, t.rx) <= 1.5 && recvRate(b) >= 0.6) {
        b.found = true;
        addLog("🎉 발견", "비콘 " + b.id + "번을 찾았다!", "ok");
        PdfKit.toast("비콘 " + b.id + "번을 찾았습니다!", "ok");
        updateMissions();
      }
    });
  }

  /* ---------------------------------------------------------
     15. 스테이지 3 동작
     --------------------------------------------------------- */
  var WALK_PLAN = [
    { kind: "me" }, { kind: "nb" }, { kind: "me" },
    { kind: "nb" }, { kind: "me" }, { kind: "nb" }
  ];

  function startWalk() {
    var t = three;
    t.score = { ok: 0, miss: 0, false: 0, done: 0 };
    t.hist = [];
    nextWalker(0);
  }

  function nextWalker(i) {
    var t = three;
    if (i >= WALK_PLAN.length) {
      t.walk = null;
      finishWalk();
      return;
    }
    var kind = WALK_PLAN[i].kind;
    var path = kind === "me"
      ? [{ x: -0.8, y: 9.2 }, { x: 12.8, y: 9.2 }, { x: 12.8, y: 6.3 }]
      : [{ x: -0.8, y: 9.2 }, { x: 24.8, y: 9.2 }];
    t.walk = {
      idx: i, kind: kind, path: path, seg: 0, u: 0,
      pos: { x: path[0].x, y: path[0].y },
      litOnce: false, arrived: false
    };
  }

  function stepThree(dt) {
    var t = three;
    var from = t.walk ? t.walk.pos : t.person;

    /* 신호 세기 계산 */
    var r = R.rssi({
      from: t.beacon, to: from, power: t.power, walls: t.walls,
      rng: t.noise ? S.rng : null, noise: 2.5
    });
    t.rssi = r;
    t.lightOn = r > t.thr;
    /* 그래프는 50ms 마다 한 점씩 — 240점이면 약 12초를 보여 준다 */
    if (S.now - t.histAt >= 50) {
      t.histAt = S.now;
      t.hist.push(r);
      if (t.hist.length > HIST_MAX) t.hist.shift();
    }

    if (t.lightOn && (S.now % 400) < 20) pushWave(t.beacon.x, t.beacon.y, 8, "217,119,6");

    /* 걷기 시험 진행 */
    if (t.walk) {
      var w = t.walk;
      if (t.lightOn) w.litOnce = true;
      var a = w.path[w.seg], b = w.path[w.seg + 1];
      if (!b) {
        judgeWalker(w);
        nextWalker(w.idx + 1);
      } else {
        var len = R.dist(a, b);
        w.u += (2.6 * dt / 1000) / len;             // 걷는 속도 2.6 m/s
        if (w.u >= 1) { w.u = 0; w.seg++; }
        var aa = w.path[w.seg], bb = w.path[w.seg + 1];
        if (bb) {
          w.pos.x = aa.x + (bb.x - aa.x) * w.u;
          w.pos.y = aa.y + (bb.y - aa.y) * w.u;
        } else {
          w.pos.x = aa.x; w.pos.y = aa.y;
        }
      }
    }
    updateSide();
  }

  function judgeWalker(w) {
    var t = three;
    if (!t.score) return;
    t.score.done++;
    if (w.kind === "me") {
      if (t.lightOn) { t.score.ok++; addLog("귀가", "현관 도착 · 등이 켜져 있음 ✓", "ok"); }
      else { t.score.miss++; addLog("귀가", "현관 도착 · 등이 꺼져 있음 (미탐) ✗", "no"); }
    } else {
      if (w.litOnce) { t.score["false"]++; addLog("옆집 사람", "그냥 지나갔는데 등이 켜졌다 (오탐) ✗", "no"); }
      else { addLog("옆집 사람", "지나감 · 등은 그대로 ✓", "ok"); }
    }
  }

  function finishWalk() {
    var t = three;
    var s = t.score;
    if (!s) return;
    var msg = "성공 " + s.ok + "/3 · 미탐 " + s.miss + " · 오탐 " + s["false"];
    if (s.ok === 3 && s["false"] === 0) PdfKit.toast("완벽합니다! " + msg, "ok");
    else PdfKit.toast(msg + " — 임계값이나 출력을 조절해 보세요", "warn");
    updateMissions();
  }

  /* ---------------------------------------------------------
     16. 옆 패널 갱신
     --------------------------------------------------------- */
  function setLed(pattern, brightness) {
    var box = document.getElementById("mbscreen");
    if (!box) return;
    var cells = box.children;
    for (var i = 0; i < 25; i++) {
      var row = Math.floor(i / 5), col = i % 5;
      var on = pattern ? pattern[row].charAt(col) === "1" : false;
      cells[i].style.opacity = on ? String(0.12 + 0.88 * (brightness == null ? 1 : brightness / 9)) : "0.06";
    }
  }

  function updateSide() {
    var rssiEl = document.getElementById("gRssi");
    var barEl = document.getElementById("gBar");
    var distEl = document.getElementById("gDist");
    var rateEl = document.getElementById("gRate");
    var wallEl = document.getElementById("gWalls");
    var capEl = document.getElementById("mbCaption");

    if (S.stage === 2) {
      var t = two;
      /* 가장 센 비콘을 계기판에 보여 준다 */
      var best = null, bestR = -999;
      t.beacons.forEach(function (b) {
        var r = R.rssi({ from: b, to: t.rx, power: t.power, walls: t.walls });
        if (r > bestR) { bestR = r; best = b; }
      });
      rssiEl.textContent = bestR.toFixed(0) + " dBm";
      barEl.style.width = pct(bestR) + "%";
      distEl.textContent = best ? R.dist(best, t.rx).toFixed(1) + " m (가장 가까운 비콘)" : "—";
      if (rateEl) rateEl.textContent = Math.round(R.deliveryRate(bestR) * 100) + " %";

      var blink = t.blink && t.blink.until > S.now ? t.blink.id : null;
      setLed(GLYPH[blink == null ? " " : String(blink)], 9);
      capEl.textContent = blink == null ? "…" : "비콘 " + blink + "번 수신";

    } else if (S.stage === 3) {
      var th = three;
      var from = th.walk ? th.walk.pos : th.person;
      rssiEl.textContent = th.rssi.toFixed(0) + " dBm";
      barEl.style.width = pct(th.rssi) + "%";
      distEl.textContent = R.dist(th.beacon, from).toFixed(1) + " m";
      if (wallEl) wallEl.textContent = R.wallsBetween({ walls: th.walls, from: th.beacon, to: from }) + " 장";

      /* 비례 변환(map) — 실습③ 코드의 핵심 */
      var lv = Math.round(R.clamp(R.mapRange(th.rssi, R.RSSI_MIN, R.RSSI_MAX, 0, 9), 0, 9));
      setLed(GLYPH[String(lv)], 9);
      capEl.innerHTML = "map(" + th.rssi.toFixed(0) + ", -95, -42, 0, 9) = <b>" + lv + "</b>" +
                        " → 현관등 " + (th.lightOn ? "<b>ON</b>" : "OFF");
    }

    /* 미션 판정은 값이 바뀔 때마다 확인한다 */
    if (S.stage !== 1) updateMissions();
  }

  function pct(r) {
    return Math.round(R.clamp((r - R.RSSI_MIN) / (R.RSSI_MAX - R.RSSI_MIN), 0, 1) * 100);
  }

  /* ---------------------------------------------------------
     17. 패킷 모니터
     --------------------------------------------------------- */
  function addLog(who, what, kind) {
    S.log.unshift({ who: who, what: what, kind: kind, t: S.now });
    if (S.log.length > 40) S.log.pop();
    var box = document.getElementById("log");
    if (!box) return;
    var html = "";
    for (var i = 0; i < Math.min(14, S.log.length); i++) {
      var e = S.log[i];
      html += '<div class="logrow ' + (e.kind || "") + '"><b>' + esc(e.who) + '</b> ' + esc(e.what) + '</div>';
    }
    box.innerHTML = html;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------------------------------------------------------
     18. 미션
     --------------------------------------------------------- */
  var MISSIONS = {
    "1house": [
      {
        t: "💡 거실등만 켜기",
        d: "우리 집 거실등 하나만 켜져 있고, 나머지 기기는 모두 꺼져 있게 만들어라. <b>옆집 기기도 포함이다.</b>",
        why: "그룹이 같으면 옆집 기기도 같은 주소(<code>light</code>)에 반응한다. " +
             "주소만으로는 옆집과 나를 구분할 수 없다.",
        ok: function () {
          var on = one.devices.filter(function (d) { return d.on; });
          return on.length === 1 && on[0].mine && on[0].key === "light";
        }
      },
      {
        t: "🚫 옆집과 섞이지 않게",
        d: "옆집 그룹을 <b>7번 그대로 둔 채</b>, 우리 집 도어락을 열어라. 옆집 도어락은 열리면 안 된다.",
        why: "<b>리모컨과 우리 집 기기를 둘 다</b> 다른 번호로 옮겨야 한다. " +
             "한쪽만 바꾸면 우리 집도 말을 듣지 않는다. 이것이 실습①의 <code>radio.setGroup()</code> 이다.",
        ok: function () {
          var o = one;
          if (o.nbGroup !== 7) return false;
          var myLock = o.devices.filter(function (d) { return d.mine && d.key === "lock"; })[0];
          var nbOn = o.devices.filter(function (d) { return !d.mine && d.on; });
          return myLock.on && nbOn.length === 0 && o.myGroup !== o.nbGroup;
        }
      }
    ],
    "1duck": [
      {
        t: "🐤 모두 한 번씩",
        d: "오리를 넘겨서 <b>모든 참가자가 최소 한 번</b> 받아 보게 하라.",
        why: "무작위로 뽑으면 누군가는 오래 못 받는다. 실습에서도 같은 일이 벌어진다 — " +
             "그때 '왜 안 오지?'가 아니라 '아직 내 번호가 안 나왔구나'로 이해하면 된다.",
        ok: function () {
          return duck.people.every(function (p) { return p.got > 0; });
        }
      }
    ],
    "2": [
      {
        t: "🔍 숨은 비콘 3개 찾기",
        d: "수신기를 움직여 비콘 3개를 모두 찾아라. (비콘 1.5m 안 + 수신률 60% 이상)",
        why: "신호 세기 숫자를 못 봐도 <b>번호가 뜨는 빈도</b>만으로 거리를 알 수 있다. " +
             "이것이 실습②의 유일한 단서다.",
        ok: function () { return two.beacons.every(function (b) { return b.found; }); }
      },
      {
        t: "📡 출력을 7로 올려 보기",
        d: "송신 출력을 <b>7</b>로 올리고, 비콘 3개가 모두 <b>거의 안 끊기고</b> 들어오는 것을 확인하라. " +
           "(수신률 90% 이상)",
        why: "출력을 최대로 올리면 집 안 어디에 서 있어도 셋 다 100% 로 들어온다. " +
             "<b>그러면 어디가 가까운지 알 수 없다.</b> 세게 보내는 것이 늘 좋은 것은 아니다 — " +
             "위치를 짚으려면 <u>일부러</u> 약하게 보내야 한다.",
        ok: function () {
          return two.power === 7 && two.beacons.every(function (b) { return recvRate(b) >= 0.9; });
        }
      },
      {
        t: "⏱️ 간격 1초로 늘려 3개 찾기",
        d: "출력을 다시 <b>2 이하</b>로 낮추고 전송 간격을 <b>1000ms 이상</b>으로 늘린 채 3개를 모두 찾아라.",
        why: "간격을 늘리면 배터리는 오래 가지만 <b>단서가 드물어져</b> 찾기가 훨씬 힘들다. " +
             "실습②의 3단계에서 정해야 하는 것이 바로 이 맞바꿈이다.",
        ok: function () {
          return two.power <= 2 && two.interval >= 1000 &&
                 two.beacons.every(function (b) { return b.found; });
        }
      }
    ],
    "3": [
      {
        t: "🎯 오탐 0 · 미탐 0",
        d: "걷기 시험에서 우리 집 사람 3명은 모두 켜지고, 옆집 사람 3명에게는 한 번도 켜지지 않게 하라.",
        why: "임계값 하나로 '가까움'과 '멂'을 가르는 것이 근접 자동화의 전부다. " +
             "신호가 흔들리기 때문에 여유(마진)를 두고 정해야 한다.",
        ok: function () {
          var s = three.score;
          return !!s && s.done === 6 && s.ok === 3 && s["false"] === 0;
        }
      }
    ]
  };

  function missionKey() {
    if (S.stage === 1) return S.scene === "duck" ? "1duck" : "1house";
    return String(S.stage);
  }

  function renderMissions() {
    var list = MISSIONS[missionKey()] || [];
    var box = document.getElementById("missionList");
    var html = "";
    list.forEach(function (m, i) {
      html += '<div class="mission" id="mi' + i + '">' +
              '<div class="mhead"><span class="mmark">○</span><b>' + m.t + '</b></div>' +
              '<p class="mdesc">' + m.d + '</p>' +
              '<div class="mwhy" hidden><b>왜 그럴까</b><br>' + m.why + '</div>' +
              '</div>';
    });
    box.innerHTML = html || '<p class="tinynote">이 장면에는 미션이 없습니다.</p>';
    updateMissions();
  }

  function updateMissions() {
    var list = MISSIONS[missionKey()] || [];
    list.forEach(function (m, i) {
      var el = document.getElementById("mi" + i);
      if (!el) return;
      var done = false;
      try { done = !!m.ok(); } catch (e) { done = false; }
      if (done && !el.classList.contains("done")) {
        el.classList.add("done");
        el.querySelector(".mmark").textContent = "●";
        el.querySelector(".mwhy").hidden = false;
        PdfKit.toast("미션 성공 — " + m.t, "ok");
      }
    });
  }

  /* ---------------------------------------------------------
     19. 입력 (끌기)
     --------------------------------------------------------- */
  function pointerPos(e) {
    var rect = S.cv.getBoundingClientRect();
    return { x: MX(e.clientX - rect.left), y: MY(e.clientY - rect.top) };
  }

  function onDown(e) {
    var p = pointerPos(e);
    if (S.stage === 1 && S.scene === "house") {
      if (R.dist(p, one.remote) < 1.6) S.drag = "remote";
    } else if (S.stage === 2) {
      if (R.dist(p, two.rx) < 1.6) S.drag = "rx";
    } else if (S.stage === 3) {
      if (!three.walk && R.dist(p, three.person) < 1.6) S.drag = "person";
    }
    if (S.drag) { S.cv.setPointerCapture(e.pointerId); e.preventDefault(); }
  }

  function onMove(e) {
    if (!S.drag) return;
    var p = pointerPos(e);
    var t = { x: R.clamp(p.x, 0.3, S.world.w - 0.3), y: R.clamp(p.y, 0.3, S.world.h - 0.3) };
    if (S.drag === "remote") { one.remote.x = t.x; one.remote.y = t.y; }
    else if (S.drag === "rx") { two.rx.x = t.x; two.rx.y = t.y; checkFound(); updateSide(); }
    else if (S.drag === "person") { three.person.x = t.x; three.person.y = t.y; }
    e.preventDefault();
  }

  function onUp(e) {
    if (S.drag && S.cv.hasPointerCapture(e.pointerId)) S.cv.releasePointerCapture(e.pointerId);
    S.drag = null;
  }

  function onKey(e) {
    var step = e.shiftKey ? 1.2 : 0.4;
    var t = null;
    if (S.stage === 2) t = two.rx;
    else if (S.stage === 3 && !three.walk) t = three.person;
    if (!t) return;
    var k = e.key;
    if (k === "ArrowLeft") t.x -= step;
    else if (k === "ArrowRight") t.x += step;
    else if (k === "ArrowUp") t.y -= step;
    else if (k === "ArrowDown") t.y += step;
    else return;
    t.x = R.clamp(t.x, 0.3, S.world.w - 0.3);
    t.y = R.clamp(t.y, 0.3, S.world.h - 0.3);
    if (S.stage === 2) checkFound();
    updateSide();
    e.preventDefault();
  }

  /* ---------------------------------------------------------
     20. 애니메이션 루프
     --------------------------------------------------------- */
  function step(dt) {
    if (S.stage === 1) { if (S.scene === "duck") stepDuck(); else stepOne(); }
    else if (S.stage === 2) stepTwo(dt);
    else if (S.stage === 3) stepThree(dt);
  }

  var lastTs = 0;
  function tick(ts) {
    S.now = ts;
    var dt = Math.min(50, ts - lastTs || 16);
    lastTs = ts;
    step(dt);
    draw();
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     21. 화면 전환
     --------------------------------------------------------- */
  function syncPanels() {
    var key = missionKey() === "1duck" ? "1duck" : String(S.stage);
    /* data-key : 조작 묶음(장면까지 구분) */
    Array.prototype.forEach.call(document.querySelectorAll("[data-key]"), function (el) {
      el.hidden = el.getAttribute("data-key") !== key;
    });
    /* data-for : 스테이지 번호만 본다 */
    Array.prototype.forEach.call(document.querySelectorAll("[data-for]"), function (el) {
      var list = el.getAttribute("data-for").split(/\s+/);
      el.hidden = list.indexOf(String(S.stage)) < 0;
    });
    document.getElementById("scenePick").hidden = S.stage !== 1;
  }

  function setStage(n) {
    S.stage = n;
    S.scene = "house";
    S.waves = []; S.flash = {}; S.log = [];
    document.getElementById("log").innerHTML = "";

    if (n === 1) buildOne();
    else if (n === 2) buildTwo(two ? two.setIdx : 0);
    else buildThree();

    var meta = STAGES[n];
    document.getElementById("stageNo").textContent = "스테이지 " + n;
    document.getElementById("stageTitle").textContent = meta.title;
    document.getElementById("stageLead").textContent = meta.lead;
    document.getElementById("stageHint").innerHTML = meta.hint;
    document.getElementById("labNote").textContent = meta.note;
    document.getElementById("nextLead").innerHTML = meta.next;
    document.getElementById("nextLink").href = meta.link;
    /* 이 스테이지에 해당하는 수업 슬라이드 (slides.js 가 없으면 그냥 넘어간다) */
    if (global.Slides) Slides.strip("stageSlides", meta.slides, { title: "수업 슬라이드" });

    Array.prototype.forEach.call(document.querySelectorAll("#stagePick .btn"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-stage") === String(n));
    });
    Array.prototype.forEach.call(document.querySelectorAll("#scenePick .btn"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-scene") === "house");
    });

    syncPanels();
    renderMissions();
    fit();
    updateSetup();
    if (n !== 1) updateSide();
    draw();
  }

  function setScene(name) {
    S.scene = name;
    S.waves = [];
    if (name === "duck") buildDuck(+document.getElementById("dPlayers").value);
    else buildOne();
    Array.prototype.forEach.call(document.querySelectorAll("#scenePick .btn"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-scene") === name);
    });
    syncPanels();
    renderMissions();
    fit();
    draw();
  }

  /* ---------------------------------------------------------
     22. 실습에 넘길 값 요약
     --------------------------------------------------------- */
  function updateSetup() {
    var box = document.getElementById("setupSummary");
    var html = "";
    if (S.stage === 1) {
      html = row("radio.setGroup()", one.myGroup + "번") +
             row("메시지 형식", '"주소:명령" 예) "light:ON"') +
             row("받는 쪽 판정", "내 주소일 때만 실행");
    } else if (S.stage === 2) {
      html = row("radio.setTransmitPower()", two.power + " (" + R.TX_DBM[two.power] + " dBm)") +
             row("전송 간격", two.interval + " ms (1분에 " + Math.round(60000 / two.interval) + "번)") +
             row("배터리 예상", Math.round(R.batteryHours(two.interval, two.power) / 24) + " 일 (절전 사용 시)");
    } else {
      html = row("radio.setTransmitPower()", three.power + " (" + R.TX_DBM[three.power] + " dBm)") +
             row("임계값 (RSSI)", three.thr + " dBm") +
             row("비례 변환", "map(신호, -95, -42, 0, 9)");
    }
    box.innerHTML = html;
  }

  function row(k, v) {
    return '<div class="sr"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  }

  /* ---------------------------------------------------------
     23. 시작
     --------------------------------------------------------- */
  function bind(id, ev, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  function start() {
    S.cv = document.getElementById("lab");
    S.g = S.cv.getContext("2d");

    /* LED 25칸 만들기 */
    var box = document.getElementById("mbscreen");
    for (var i = 0; i < 25; i++) {
      var d = document.createElement("i");
      box.appendChild(d);
    }

    /* 스테이지 / 장면 */
    Array.prototype.forEach.call(document.querySelectorAll("#stagePick .btn"), function (b) {
      b.addEventListener("click", function () { setStage(+b.getAttribute("data-stage")); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#scenePick .btn"), function (b) {
      b.addEventListener("click", function () { setScene(b.getAttribute("data-scene")); });
    });

    /* 스테이지 1 */
    bind("s1group", "input", function (e) {
      one.remGroup = +e.target.value;
      document.getElementById("s1groupV").textContent = e.target.value;
      updateMissions();
    });
    bind("s1myGroup", "input", function (e) {
      one.myGroup = +e.target.value;
      document.getElementById("s1myGroupV").textContent = e.target.value;
      updateSetup(); updateMissions();
    });
    bind("s1nbGroup", "input", function (e) {
      one.nbGroup = +e.target.value;
      document.getElementById("s1nbGroupV").textContent = e.target.value;
      updateMissions();
    });
    bind("s1target", "change", function (e) { one.target = e.target.value; });
    bind("s1cmdOn", "click", function () {
      one.cmd = true;
      document.getElementById("s1cmdOn").classList.add("on");
      document.getElementById("s1cmdOff").classList.remove("on");
    });
    bind("s1cmdOff", "click", function () {
      one.cmd = false;
      document.getElementById("s1cmdOff").classList.add("on");
      document.getElementById("s1cmdOn").classList.remove("on");
    });
    bind("s1send", "click", sendOne);
    bind("s1reset", "click", function () {
      one.devices.forEach(function (d) { d.on = false; });
      addLog("초기화", "모든 기기를 껐다", "skip");
      updateMissions();
    });

    /* 오리 릴레이 */
    bind("dPlayers", "input", function (e) {
      document.getElementById("dPlayersV").textContent = e.target.value;
      buildDuck(+e.target.value);
      renderMissions();
    });
    bind("dShake", "click", duckShake);
    bind("dAuto", "click", function () {
      var n = 0;
      var iv = setInterval(function () {
        duckShake();
        if (++n >= 10) clearInterval(iv);
      }, 780);
    });
    bind("dReset", "click", function () {
      buildDuck(+document.getElementById("dPlayers").value);
      renderMissions();
    });

    /* 스테이지 2 */
    bind("s2power", "input", function (e) {
      two.power = +e.target.value;
      document.getElementById("s2powerV").textContent = e.target.value;
      document.getElementById("s2powerDbm").textContent = R.TX_DBM[two.power] + " dBm";
      updateBattery(); updateSetup(); updateSide();
    });
    bind("s2interval", "input", function (e) {
      two.interval = +e.target.value;
      document.getElementById("s2intervalV").textContent = e.target.value + " ms";
      updateBattery(); updateSetup(); updateMissions();
    });
    bind("s2reveal", "click", function () {
      two.reveal = !two.reveal;
      document.getElementById("s2reveal").textContent = two.reveal ? "🙈 다시 감추기" : "👀 비콘 위치 보기";
    });
    bind("s2shuffle", "click", function () {
      var next = two.setIdx + 1;
      buildTwo(next);
      /* 새로 만들면 기본값으로 돌아가므로 슬라이더가 가리키는 값을 다시 넣어 준다 */
      two.power = +document.getElementById("s2power").value;
      two.interval = +document.getElementById("s2interval").value;
      document.getElementById("s2reveal").textContent = "👀 비콘 위치 보기";
      renderMissions();
      PdfKit.toast("비콘을 다시 숨겼습니다", "ok");
    });
    bind("s2reset", "click", function () {
      two.beacons.forEach(function (b) { b.found = false; b.hits = []; });
      renderMissions();
    });

    /* 스테이지 3 */
    bind("s3power", "input", function (e) {
      three.power = +e.target.value;
      document.getElementById("s3powerV").textContent = e.target.value;
      document.getElementById("s3powerDbm").textContent = R.TX_DBM[three.power] + " dBm";
      updateSetup();
    });
    bind("s3thr", "input", function (e) {
      three.thr = +e.target.value;
      document.getElementById("s3thrV").textContent = e.target.value;
      updateSetup();
    });
    bind("s3noise", "change", function (e) { three.noise = e.target.checked; });
    bind("s3walk", "click", startWalk);
    bind("s3stop", "click", function () { three.walk = null; three.score = null; });

    /* 끌기 */
    S.cv.addEventListener("pointerdown", onDown);
    S.cv.addEventListener("pointermove", onMove);
    S.cv.addEventListener("pointerup", onUp);
    S.cv.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKey);

    global.addEventListener("resize", function () { fit(); draw(); });
    if (global.ResizeObserver) {
      new ResizeObserver(function () { fit(); draw(); }).observe(S.cv);
    }

    /* 홈에서 ?s=2 처럼 스테이지를 지정해 들어올 수 있다 */
    var want = parseInt((/[?&]s=(\d)/.exec(location.search) || [])[1], 10);
    setStage(want >= 1 && want <= 3 ? want : 1);
    updateBattery();
    requestAnimationFrame(tick);
  }

  function updateBattery() {
    if (!two) return;
    var el = document.getElementById("s2battery");
    var rt = document.getElementById("s2rate");
    if (el) el.textContent = Math.round(R.batteryHours(two.interval, two.power) / 24) + " 일";
    if (rt) rt.textContent = Math.round(60000 / two.interval);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* 검사용 손잡이 — 학생 화면에는 영향이 없다.
     이 개발 환경은 미리보기 창이 숨겨져 있어 requestAnimationFrame 이 돌지 않는다.
     그때 Sim.run(밀리초) 로 계산만 직접 굴려 확인한다. */
  global.Sim = {
    _s: S,
    stages: function () { return { one: one, duck: duck, two: two, three: three }; },
    setStage: setStage, setScene: setScene,
    run: function (ms, slice) {
      slice = slice || 16;
      var end = S.now + ms;
      while (S.now < end) { S.now += slice; step(slice); }
      draw();
    },
    send: sendOne, shake: duckShake, walk: startWalk,
    draw: draw, fit: fit
  };
})(window);
