/* =========================================================
   sim.js — 실험실 화면 (mb-noise)
   ---------------------------------------------------------
   계산은 전부 js/noise.js 가 한다. 이 파일은 **그리고 · 누르고 · 끄는** 일만 한다.

   🔴 requestAnimationFrame 을 쓰지 않는다.
      이 프로젝트의 미리보기 창은 화면을 그리지 않아서 rAF 가 한 번도 돌지 않는다
      (루트 CLAUDE.md · EnergyKeeper 의 겪은 것). 그래서 **setInterval 로 돌리고
      캔버스는 상태가 바뀔 때마다 곧바로 그린다.** 덕분에 검사도 할 수 있다.

   🔴 시계(tick)는 0.1초다 — 수업자료 10쪽의 «[0.1]초 기다리기» 와 같은 값이다.
      이 숫자를 바꾸면 화면과 학생이 짜는 코드가 어긋난다.

   ⚠ 보이지 않는 스테이지의 시계는 멈춘다. 다섯 개가 동시에 돌면 느려진다.
   ========================================================= */
(function () {
  "use strict";

  var N = window.Noise;
  var TICK = 100;               // ms — 0.1초

  /* 기준값은 ② ③ ④ 가 **함께** 쓴다. 한곳에 둬야 ②에서 정한 값이 ④에 그대로 간다. */
  var state = { t1: N.DEFAULT.t1, t2: N.DEFAULT.t2, le: false, seed: 2026 };

  /* ---------------------------------------------------------
     자잘한 도구
     --------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function txt(el, s) { if (el) el.textContent = s; }
  function show(el, yes) { if (el) el.classList.toggle("hidden", !yes); }

  /* 조사 — 「안전 가 나오지 않습니다」 가 실제로 화면에 나갔다.
     구간 이름(안전·주의·경고)이 데이터에서 오므로 글자로 박아 둘 수 없다.
     (data-convert 의 UI.josa · mb-connect 의 Parts.josa 와 같은 이유) */
  function part(word, pair) {                // 조사만 돌려준다
    var s = String(word || "");
    var p = pair.split("/");                 // "이/가" → 받침 있음 / 없음
    if (!s) return p[1];
    var code = s.charCodeAt(s.length - 1);
    var hangul = code >= 0xAC00 && code <= 0xD7A3;
    return (hangul && (code - 0xAC00) % 28 !== 0) ? p[0] : p[1];
  }
  function josa(word, pair) { return word + part(word, pair); }

  /* LED 5×5 칸 25개를 만들어 둔다 */
  function makeLed(host) {
    if (!host) return [];
    host.innerHTML = "";
    var cells = [];
    for (var i = 0; i < 25; i++) {
      var c = document.createElement("i");
      host.appendChild(c); cells.push(c);
    }
    return cells;
  }
  /* 아이콘(5×5 격자)을 그린다 */
  function drawIcon(cells, grid) {
    for (var i = 0; i < 25; i++) {
      var r = Math.floor(i / 5), c = i % 5;
      cells[i].classList.toggle("on", !!(grid && grid[r] && grid[r][c]));
    }
  }
  /* 소리 크기를 막대로 그린다 (아직 판단하지 않는 ① 스테이지용) */
  function drawLevel(cells, v) {
    var lit = Math.max(0, Math.min(5, Math.round(v / 255 * 5)));
    for (var i = 0; i < 25; i++) {
      var r = Math.floor(i / 5);              // 0 = 맨 위
      cells[i].classList.toggle("on", (4 - r) < lit);
    }
  }

  /* 상황 고르는 단추 만들기 */
  function sceneChips(host, keys, pick, onPick) {
    if (!host) return;
    host.innerHTML = "";
    keys.forEach(function (k) {
      var s = N.scene(k);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (k === pick() ? " on" : "");
      b.dataset.k = k;
      b.innerHTML = '<span style="font-size:21px">' + s.emoji + "</span> " + s.name;
      b.addEventListener("click", function () {
        onPick(k);
        all(".chip", host).forEach(function (x) { x.classList.toggle("on", x.dataset.k === k); });
      });
      host.appendChild(b);
    });
  }

  /* ---------------------------------------------------------
     스테이지 전환 — 보이지 않는 스테이지의 시계는 멈춘다
     --------------------------------------------------------- */
  var timers = {};
  function setTimer(name, fn) {
    if (timers[name]) { clearInterval(timers[name]); timers[name] = null; }
    if (fn) timers[name] = setInterval(fn, TICK);
  }

  var current = 1;
  function goStage(n) {
    current = n;
    all("section[data-stage]").forEach(function (s) {
      s.classList.toggle("on", s.dataset.stage === String(n));
    });
    all("#stageTabs .scene-btn").forEach(function (b) {
      b.classList.toggle("on", b.dataset.go === String(n));
    });

    setTimer("s1", n === 1 ? s1tick : null);
    setTimer("s4", n === 4 ? s4tick : null);

    if (n === 2) s2draw();
    if (n === 3) s3draw();
    if (n === 4) s4sync();
    if (n === 5) s5draw();
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
  }

  /* =========================================================
     ① 값이 흐른다
     ---------------------------------------------------------
     한 번의 «왕복» 을 4틱(0.4초)에 나눠 보여 준다.
       0틱 센서가 잰다 · 1틱 무선으로 간다 · 2틱 변수에 담긴다 · 3틱 화면에 보인다
     연결을 끊으면 1틱에서 멈춘다 — «코드는 그대로인데 값이 안 변한다» 를 겪게 하려는 것.
     ========================================================= */
  var s1 = { scene: "talk", stream: null, led: [], p: 0, sensor: 0, varVal: 0, bt: true };

  function s1init() {
    s1.stream = N.makeStream(state.seed);
    s1.led = makeLed($("s1led"));
    sceneChips($("s1scenes"), ["quiet", "talk", "clap", "chair", "shout"],
      function () { return s1.scene; },
      function (k) { s1.scene = k; txt($("s1tip"), N.scene(k).tip); });
    txt($("s1tip"), N.scene(s1.scene).tip);

    on($("s1bt"), "change", function () {
      s1.bt = this.checked;
      $("s1air").classList.toggle("off", !s1.bt);
      show($("s1cut"), !s1.bt);
      show($("s1warn"), !s1.bt);
      if (!s1.bt) s1.p = 1;
    });
  }

  function s1tick() {
    /* 센서는 연결과 상관없이 계속 잰다 — 이것이 핵심이다.
       «값이 멈춘 것» 은 센서가 죽어서가 아니라 **길이 끊겨서** 다. */
    if (s1.p === 0) {
      s1.sensor = s1.stream.next(s1.scene);
      txt($("s1val"), s1.sensor);
      txt($("s1r1"), s1.sensor);
      drawLevel(s1.led, s1.sensor);
    }
    if (s1.bt) {
      if (s1.p === 2) { s1.varVal = s1.sensor; txt($("s1var"), s1.varVal); txt($("s1r2"), s1.varVal); }
      if (s1.p === 3) {
        txt($("s1say"), "소음크기 " + s1.varVal + " 라고 말했어요");
        txt($("s1bot"), "🤖");
      }
    } else {
      txt($("s1say"), "새 값이 오지 않습니다");
      txt($("s1bot"), "😵");
    }

    /* 무선 구간의 점 */
    var pk = $("s1pk");
    if (pk) pk.style.left = (s1.bt ? (s1.p * 33) : 0) + "%";

    /* 흐름 표시등 */
    all("#s1flow .st").forEach(function (e) {
      var i = Number(e.dataset.f);
      e.classList.toggle("on", s1.bt ? (i === s1.p) : (i === 0));
      e.classList.toggle("dead", !s1.bt && i >= 1);
    });

    /* 🔴 연결이 끊겨도 **센서는 계속 잰다** — 이것이 이 스테이지의 결론이다.
       예전에는 p 를 1 에 고정해서 센서값까지 함께 멈췄고, 그러면
       «센서가 고장 났다» 로 잘못 읽힌다. 0 과 1 을 오가게 해서
       센서는 살아 있고 **길만 끊겼다** 는 것이 보이게 한다. */
    s1.p = s1.bt ? ((s1.p + 1) % 4) : (s1.p === 0 ? 1 : 0);
  }

  /* =========================================================
     ② 기준값 정하기  ★
     ========================================================= */
  var s2 = { pick: "quiet", rec: [], seedStep: 0 };

  /* 그래프의 자리 — 그리기와 «끌기» 가 같은 값을 본다 */
  var plot = { x: 0, y: 0, w: 0, h: 0, vmax: 220 };

  function s2init() {
    var cv = $("cvTime"); if (cv) { cv.width = 1800; cv.height = 878; }
    var ch = $("cvHist"); if (ch) { ch.width = 1240; ch.height = 800; }

    sceneChips($("s2scenes"), ["quiet", "talk", "clap", "chair", "shout"],
      function () { return s2.pick; }, function (k) { s2.pick = k; });

    on($("s2rec"), "click", function () { record(s2.pick, 100); });
    on($("s2all"), "click", function () {
      /* 수업자료 12쪽의 네 가지 상황 그대로 */
      ["quiet", "talk", "clap", "shout"].forEach(function (k) { record(k, 100); });
    });
    on($("s2clear"), "click", function () { s2.rec = []; s2.seedStep = 0; s2draw(); });
    on($("s2reset"), "click", function () {
      state.t1 = N.DEFAULT.t1; state.t2 = N.DEFAULT.t2; state.le = false;
      $("s2le").checked = false; syncSliders(); s2draw();
    });

    on($("s2t1"), "input", function () {
      state.t1 = Number(this.value);
      if (state.t1 >= state.t2) { state.t2 = state.t1 + 1; }
      syncSliders(); s2draw();
    });
    on($("s2t2"), "input", function () {
      state.t2 = Number(this.value);
      if (state.t2 <= state.t1) { state.t1 = state.t2 - 1; }
      syncSliders(); s2draw();
    });
    on($("s2le"), "change", function () { state.le = this.checked; s2draw(); });

    dragLines(cv);
    syncSliders();
    s2draw();
  }

  function syncSliders() {
    if ($("s2t1")) $("s2t1").value = state.t1;
    if ($("s2t2")) $("s2t2").value = state.t2;
    txt($("s2t1lab"), state.t1);
    txt($("s2t2lab"), state.t2);
    txt($("s4t1"), state.t1);
    txt($("s4t2"), state.t2);
  }

  /* 기록 더하기 — 씨앗을 조금씩 바꿔 «다시 재면 조금 다른 값» 이 되게 한다.
     그래도 씨앗에서 나오므로 재현된다. */
  function record(sceneKey, n) {
    s2.seedStep++;
    var st = N.makeStream(state.seed + s2.seedStep * 977);
    for (var i = 0; i < n; i++) s2.rec.push({ scene: sceneKey, v: st.next(sceneKey) });
    s2draw();
  }

  /* --------- 그래프 끌기 --------- */
  function dragLines(cv) {
    if (!cv) return;
    var grab = null;

    function valAt(ev) {
      var r = cv.getBoundingClientRect();
      var y = (ev.clientY - r.top) / r.height * cv.height;
      var v = (plot.y + plot.h - y) / plot.h * plot.vmax;
      return Math.max(0, Math.min(255, Math.round(v)));
    }
    cv.addEventListener("pointerdown", function (ev) {
      if (!s2.rec.length) return;
      var v = valAt(ev);
      var d1 = Math.abs(v - state.t1), d2 = Math.abs(v - state.t2);
      if (Math.min(d1, d2) > 14) return;
      grab = d1 <= d2 ? "t1" : "t2";
      cv.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!grab) return;
      var v = valAt(ev);
      if (grab === "t1") state.t1 = Math.min(v, state.t2 - 1);
      else state.t2 = Math.max(v, state.t1 + 1);
      syncSliders(); s2draw();
    });
    ["pointerup", "pointercancel"].forEach(function (e) {
      cv.addEventListener(e, function () { grab = null; });
    });
  }

  /* --------- 그리기 --------- */
  function s2draw() {
    drawTime();
    drawHist();
    var s = N.stats(s2.rec, state.t1, state.t2, state.le);
    txt($("s2n"), s.n);
    txt($("s2fa"), s.n ? s.falseAlarm + "%" : "–");
    txt($("s2ms"), s.n ? s.miss + "%" : "–");
    fillSceneTable(s);
    advice(s);
  }

  function drawTime() {
    var cv = $("cvTime"); if (!cv) return;
    var g = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);

    plot.x = 82; plot.y = 40; plot.w = W - 110; plot.h = H - 100;
    plot.vmax = 220;
    var P = plot;
    var yOf = function (v) { return P.y + P.h - v / P.vmax * P.h; };

    /* 구간 색칠 — 지금 기준으로 어디가 안전·주의·경고인가 */
    var yT1 = yOf(Math.min(state.t1, P.vmax)), yT2 = yOf(Math.min(state.t2, P.vmax));
    g.fillStyle = "#ecfdf5"; g.fillRect(P.x, yT1, P.w, P.y + P.h - yT1);
    g.fillStyle = "#fffbeb"; g.fillRect(P.x, yT2, P.w, yT1 - yT2);
    g.fillStyle = "#fef2f2"; g.fillRect(P.x, P.y, P.w, yT2 - P.y);

    /* 눈금 */
    g.strokeStyle = "#e5e7eb"; g.lineWidth = 2;
    g.fillStyle = "#6b7280"; g.font = "26px system-ui, sans-serif"; g.textAlign = "right";
    for (var v = 0; v <= P.vmax; v += 40) {
      var y = yOf(v);
      g.beginPath(); g.moveTo(P.x, y); g.lineTo(P.x + P.w, y); g.stroke();
      g.fillText(String(v), P.x - 12, y + 9);
    }

    if (!s2.rec.length) {
      g.fillStyle = "#9ca3af"; g.font = "34px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText("위의 단추로 소음을 재 보세요", P.x + P.w / 2, P.y + P.h / 2);
      drawThresh(g, P, yOf);
      return;
    }

    /* 상황이 바뀌는 구간을 세로 띠와 이름으로 표시 */
    var stepX = P.w / s2.rec.length;
    var start = 0;
    g.textAlign = "center";
    for (var i = 1; i <= s2.rec.length; i++) {
      if (i === s2.rec.length || s2.rec[i].scene !== s2.rec[start].scene) {
        var x0 = P.x + start * stepX, x1 = P.x + i * stepX;
        g.strokeStyle = "#cbd5e1"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x1, P.y); g.lineTo(x1, P.y + P.h); g.stroke();
        var sc = N.scene(s2.rec[start].scene);
        g.fillStyle = "#334155"; g.font = "27px system-ui, sans-serif";
        if (x1 - x0 > 90) g.fillText(sc.emoji + " " + sc.name, (x0 + x1) / 2, P.y - 12);
        start = i;
      }
    }

    /* 값 꺾은선 */
    g.strokeStyle = "#1e293b"; g.lineWidth = 2.4; g.beginPath();
    s2.rec.forEach(function (r, i) {
      var x = P.x + (i + 0.5) * stepX, y = yOf(Math.min(r.v, P.vmax));
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();

    /* 경고로 판정된 점만 빨갛게 찍는다 — 헛경보가 어디서 나는지 눈에 띈다 */
    g.fillStyle = "#dc2626";
    s2.rec.forEach(function (r, i) {
      if (N.judge(r.v, state.t1, state.t2, state.le) !== "danger") return;
      g.beginPath();
      g.arc(P.x + (i + 0.5) * stepX, yOf(Math.min(r.v, P.vmax)), 5, 0, Math.PI * 2);
      g.fill();
    });

    drawThresh(g, P, yOf);
  }

  function drawThresh(g, P, yOf) {
    [[state.t1, "#059669", "안전 ↔ 주의"], [state.t2, "#dc2626", "주의 ↔ 경고"]].forEach(function (t) {
      if (t[0] > P.vmax) return;
      var y = yOf(t[0]);
      g.strokeStyle = t[1]; g.lineWidth = 5; g.setLineDash([16, 10]);
      g.beginPath(); g.moveTo(P.x, y); g.lineTo(P.x + P.w, y); g.stroke();
      g.setLineDash([]);
      g.fillStyle = t[1]; g.font = "bold 27px system-ui, sans-serif"; g.textAlign = "left";
      g.fillText(t[2] + "  " + t[0], P.x + 12, y - 12);
      /* 끌 수 있다는 손잡이 */
      g.beginPath(); g.arc(P.x + P.w - 16, y, 15, 0, Math.PI * 2); g.fill();
    });
  }

  function drawHist() {
    var cv = $("cvHist"); if (!cv) return;
    var g = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);

    var x0 = 70, y0 = 40, w = W - 100, h = H - 110;
    var BIN = 10, bins = 23;                     // 0~229
    var cnt = new Array(bins).fill(0);
    s2.rec.forEach(function (r) {
      var b = Math.min(bins - 1, Math.floor(r.v / BIN));
      cnt[b]++;
    });
    var top = Math.max(1, Math.max.apply(null, cnt));

    g.strokeStyle = "#e5e7eb"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, y0 + h); g.lineTo(x0 + w, y0 + h); g.stroke();

    var bw = w / bins;
    for (var i = 0; i < bins; i++) {
      var mid = i * BIN + BIN / 2;
      var lv = N.judge(mid, state.t1, state.t2, state.le);
      g.fillStyle = lv === "safe" ? "#34d399" : lv === "warn" ? "#fbbf24" : "#f87171";
      var bh = cnt[i] / top * h;
      g.fillRect(x0 + i * bw + 2, y0 + h - bh, bw - 4, bh);
    }

    g.fillStyle = "#6b7280"; g.font = "24px system-ui, sans-serif"; g.textAlign = "center";
    for (var v = 0; v <= 220; v += 40) {
      g.fillText(String(v), x0 + v / (bins * BIN) * w, y0 + h + 34);
    }
    g.textAlign = "left";
    g.fillText("소리 크기 →", x0, y0 + h + 70);

    if (!s2.rec.length) {
      g.fillStyle = "#9ca3af"; g.font = "30px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText("기록이 없습니다", x0 + w / 2, y0 + h / 2);
    }
  }

  function fillSceneTable(s) {
    var tb = $("s2tbl"); if (!tb) return;
    var body = tb.querySelector("tbody");
    body.innerHTML = "";
    N.SCENES.forEach(function (sc) {
      var b = s.byScene[sc.key];
      if (!b) return;
      var tr = document.createElement("tr");
      /* 경고할 필요가 없는데 경고가 뜬 줄을 노랗게 — 헛경보가 «어디서» 나는지 보인다 */
      if (!sc.alarm && b.danger > 0) tr.className = "hi";
      if (sc.alarm && b.danger < b.n) tr.className = "hi";
      tr.innerHTML =
        "<td class='left'>" + sc.emoji + " " + sc.name + (sc.alarm ? " <b>(울려야 함)</b>" : "") + "</td>" +
        "<td class='num'>" + b.avg + "</td><td class='num'>" + b.max + "</td>" +
        "<td class='num'>" + b.safe + "</td><td class='num'>" + b.warn + "</td>" +
        "<td class='num'><b>" + b.danger + "</b></td>";
      body.appendChild(tr);
    });
    if (!body.children.length) {
      body.innerHTML = "<tr><td colspan='6' style='color:var(--sub)'>아직 기록이 없습니다.</td></tr>";
    }
  }

  /* 숫자만 보여 주면 «그래서 뭘 하라는 건데?» 가 된다. 한 줄로 읽어 준다. */
  function advice(s) {
    var box = $("s2msg"); if (!box) return;
    if (!s.n) { box.innerHTML = "먼저 소음을 재 보세요."; return; }

    /* 수업자료 12쪽의 네 상황만 재면 «헛경보의 주범» 이 빠진다.
       의자 끄는 소리를 재 보라고 늘 권한다 — 그것이 ⑤ 확장 미션으로 이어진다. */
    var noChair = Object.keys(s.byScene).indexOf("chair") < 0;
    var nudge = noChair
      ? " <b>🪑 의자 끄는 소리</b>도 재 보세요 — 조용한데 <b>가끔 한 번</b> 튀는 값이 진짜 문제입니다."
      : "";

    if (noChair && s.falseAlarm === 0 && s.miss === 0) {
      box.innerHTML = "완벽해 보이지요?" + nudge;
      return;
    }
    if (s.miss > 0) {
      box.innerHTML = "⚠ 기준이 <b>너무 높습니다.</b> 정말 시끄러운 순간을 <b>" + s.miss +
        "%</b> 놓치고 있습니다(" + s.missN + " / " + s.missOf + "번). 경보등이 있어도 안 울리면 없는 것과 같습니다.";
      return;
    }
    if (s.falseAlarm >= 8) {
      box.innerHTML = "⚠ 기준이 <b>너무 낮습니다.</b> 경고할 필요가 없는데 <b>" + s.falseAlarm +
        "%</b> 나 울립니다. 자꾸 헛울리면 아무도 그 경보를 믿지 않게 됩니다.";
      return;
    }
    if (s.falseAlarm > 0) {
      box.innerHTML = "괜찮은 기준입니다. 헛경보 <b>" + s.falseAlarm + "%</b> · 놓침 <b>0%</b>. " +
        "남은 헛경보는 <b>순간적으로 튀는 소리</b> 때문입니다 → " +
        "<b>⑤ 3초 이상일 때만</b> 에서 이것을 없애 봅니다." + nudge;
      return;
    }
    box.innerHTML = "헛경보도 놓침도 없습니다. 다만 <b>기준을 더 올리면</b> 어떻게 되는지도 확인해 보세요." + nudge;
  }

  /* =========================================================
     ③ 조건문 갈림길
     ========================================================= */
  var s3 = { order: "safeFirst", v: 45, hit: -1, level: null };

  var LOOK = { safe: "안전", warn: "주의", danger: "경고" };

  function s3init() {
    /* 빠른 값 단추 — 수업자료 25쪽의 네 경계값 + 평범한 값 둘 */
    var host = $("s3quick");
    if (host) {
      [45, 59, 60, 119, 120, 180].forEach(function (v) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = String(v);
        b.addEventListener("click", function () { $("s3v").value = v; s3run(); });
        host.appendChild(b);
      });
    }

    var oh = $("s3orders");
    if (oh) {
      N.ORDERS.forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (o.key === s3.order ? " on" : "");
        b.dataset.k = o.key;
        b.textContent = o.name;
        b.addEventListener("click", function () {
          s3.order = o.key;
          all(".chip", oh).forEach(function (x) { x.classList.toggle("on", x.dataset.k === o.key); });
          s3.hit = -1; s3.level = null;
          s3draw();
        });
        oh.appendChild(b);
      });
    }

    on($("s3run"), "click", s3run);
    on($("s3v"), "keydown", function (e) { if (e.key === "Enter") s3run(); });
    on($("s3le"), "change", function () {
      state.le = this.checked;
      if ($("s2le")) $("s2le").checked = this.checked;
      s3.hit = -1; s3.level = null;
      s3draw();
    });
    s3draw();
  }

  function s3run() {
    var v = Number($("s3v").value);
    if (!isFinite(v)) return;
    v = Math.max(0, Math.min(255, Math.round(v)));
    $("s3v").value = v;
    s3.v = v;
    var r = N.runOrder(v, s3.order, state.t1, state.t2, state.le);
    s3.hit = r.hit; s3.level = r.level;
    s3draw();
  }

  /* 세 가지 순서의 «갈림길» 정의 — 블록 그림과 판정이 같은 곳에서 나온다 */
  function branches(orderKey) {
    var op = state.le ? "≤" : "<";
    var ge = state.le ? ">" : "≥";
    if (orderKey === "warnFirst") {
      return [{ cmp: op + " " + state.t2, lv: "warn" },
              { cmp: op + " " + state.t1, lv: "safe" },
              { lv: "danger" }];
    }
    if (orderKey === "dangerFirst") {
      return [{ cmp: ge + " " + state.t2, lv: "danger" },
              { cmp: ge + " " + state.t1, lv: "warn" },
              { lv: "safe" }];
    }
    return [{ cmp: op + " " + state.t1, lv: "safe" },
            { cmp: op + " " + state.t2, lv: "warn" },
            { lv: "danger" }];
  }

  function s3draw() {
    var o = N.order(s3.order);
    txt($("s3note"), o.note);
    if ($("s3le")) $("s3le").checked = state.le;

    /* --- 블록 그림 --- */
    var host = $("s3blocks");
    if (host) {
      var br = branches(s3.order);
      var h = "";
      h += blk("start", "시작하기 버튼을 클릭했을 때");
      h += blk("loop", "계속 반복하기");
      h += '<div class="mn-in">';
      h +=   blk("var", "<span class='hole'>소음크기</span>를 <span class='hole'>마이크로비트 소리 크기</span>로 정하기");

      /* 걸린 갈래는 «만일» 줄과 그 안의 실행 블록을 **함께** 빛낸다.
         조건 줄만 빛내면 «그래서 무엇이 실행됐는지» 가 안 보인다. */
      h +=   blk("cond", "만일 <span class='hole'>소음크기 " + br[0].cmp + "</span> 이라면", s3.hit === 0);
      h +=   '<div class="mn-in">' + resultBlocks(br[0].lv, s3.hit === 0) + "</div>";
      h +=   '<div class="mn-else">아니면</div>';
      h +=   '<div class="mn-in">';
      h +=     blk("cond", "만일 <span class='hole'>소음크기 " + br[1].cmp + "</span> 이라면", s3.hit === 1);
      h +=     '<div class="mn-in">' + resultBlocks(br[1].lv, s3.hit === 1) + "</div>";
      h +=     '<div class="mn-else">아니면</div>';
      h +=     '<div class="mn-in">' + resultBlocks(br[2].lv, s3.hit === 2) + "</div>";
      h +=   "</div>";
      h +=   blk("wait", "<span class='hole'>0.1</span>초 기다리기");
      h += "</div>";
      host.innerHTML = h;
    }

    /* --- 결과 --- */
    if (s3.level) {
      var L = N.LEVELS[s3.level];
      txt($("s3face"), L.emoji);
      var vb = $("s3verdict");
      vb.textContent = "소음크기 " + s3.v + " → " + L.name + " · 아이콘 " + L.icon + (L.beep ? " · 비프음" : "");
      vb.style.background = L.key === "safe" ? "var(--ok-bg)" : L.key === "warn" ? "var(--warn-bg)" : "var(--no-bg)";
      vb.style.color = L.color;
    } else {
      txt($("s3face"), "❓");
      var vb2 = $("s3verdict");
      vb2.textContent = "값을 넣고 ▶ 를 눌러 보세요";
      vb2.style.background = "var(--band)"; vb2.style.color = "var(--sub)";
    }

    s3band();
    s3edge();
  }

  function blk(cls, html, lit) {
    return '<span class="mn-blk ' + cls + (lit ? " lit" : "") + '">' + html + "</span>";
  }
  function resultBlocks(lv, lit) {
    var L = N.LEVELS[lv];
    var h = blk("look", "모양을 <span class='hole'>" + LOOK[lv] + "</span>으로 바꾸기", lit);
    h += blk("hw", "마이크로비트에 아이콘 <span class='hole'>" + L.icon + "</span> 출력", lit);
    if (L.beep) h += blk("snd", "소리 <span class='hole'>비프음</span> 재생하기", lit);
    return h;
  }

  /* 0~200 을 모두 넣어 본 띠 — 순서를 바꾸면 통째로 달라진다 */
  function s3band() {
    var host = $("s3band"); if (!host) return;
    host.innerHTML = "";
    var seen = { safe: 0, warn: 0, danger: 0 };
    for (var v = 0; v <= 200; v++) {
      var lv = N.runOrder(v, s3.order, state.t1, state.t2, state.le).level;
      seen[lv]++;
      var i = document.createElement("i");
      i.className = lv;
      host.appendChild(i);
    }
    var msg = $("s3bandmsg");
    if (!msg) return;
    var missing = ["safe", "warn", "danger"].filter(function (k) { return seen[k] === 0; });
    if (missing.length) {
      var names = missing.map(function (k) { return N.LEVELS[k].name; });
      msg.innerHTML = "🚨 <b>" + names.join(" · ") + "</b>" + part(names[names.length - 1], "이/가") +
        " <b>한 번도 나오지 않습니다.</b> " + N.order(s3.order).note;
    } else {
      msg.innerHTML = "안전 <b>" + seen.safe + "</b>칸 · 주의 <b>" + seen.warn +
        "</b>칸 · 경고 <b>" + seen.danger + "</b>칸 — 세 구간이 모두 나옵니다. " + N.order(s3.order).note;
    }
  }

  function s3edge() {
    var tb = $("s3edge"); if (!tb) return;
    var body = tb.querySelector("tbody");
    body.innerHTML = "";
    [state.t1 - 1, state.t1, state.t2 - 1, state.t2].forEach(function (v) {
      var tr = document.createElement("tr");
      var cells = ["safeFirst", "dangerFirst", "warnFirst"].map(function (k) {
        var lv = N.runOrder(v, k, state.t1, state.t2, state.le).level;
        return "<td><span class='pill " + lv + "'>" + N.LEVELS[lv].name + "</span></td>";
      });
      tr.innerHTML = "<td class='num'><b>" + v + "</b></td>" + cells.join("");
      body.appendChild(tr);
    });
  }

  /* =========================================================
     ④ 다시 보내기
     ========================================================= */
  var s4 = { scene: "talk", stream: null, led: [], p: 0, wait: 1, since: 0, sensor: 0, shown: 0, level: "safe" };

  function s4init() {
    s4.stream = N.makeStream(state.seed + 31);
    s4.led = makeLed($("s4led"));
    sceneChips($("s4scenes"), ["quiet", "talk", "clap", "shout"],
      function () { return s4.scene; }, function (k) { s4.scene = k; });

    on($("s4wait"), "input", function () {
      s4.wait = Number(this.value);
      txt($("s4waitLab"), (s4.wait / 10).toFixed(1) + "초");
      var m = $("s4waitMsg");
      if (s4.wait <= 2) m.innerHTML = "빠르게 따라옵니다. 대신 컴퓨터가 <b>더 자주</b> 일합니다.";
      else if (s4.wait <= 8) m.innerHTML = "조금 굼뜹니다. 소리가 바뀌고 <b>" + (s4.wait / 10).toFixed(1) +
        "초</b> 뒤에야 LED 가 바뀝니다.";
      else m.innerHTML = "너무 느립니다. 박수를 쳐도 <b>LED 가 아예 반응하지 못하고</b> 지나갑니다.";
    });
    txt($("s4waitLab"), "0.1초");
    $("s4waitMsg").innerHTML = "빠르게 따라옵니다. 대신 컴퓨터가 <b>더 자주</b> 일합니다.";
  }

  function s4sync() { syncSliders(); }

  function s4tick() {
    /* 센서는 늘 0.1초마다 잰다 */
    s4.sensor = s4.stream.next(s4.scene);
    txt($("s4val"), s4.sensor);

    /* 판단은 «기다리기» 만큼에 한 번만 — 이것이 지연의 정체다 */
    s4.since++;
    if (s4.since >= s4.wait) {
      s4.since = 0;
      s4.shown = s4.sensor;
      s4.level = N.judge(s4.shown, state.t1, state.t2, state.le);
      var L = N.LEVELS[s4.level];
      txt($("s4var"), s4.shown);
      txt($("s4face"), L.emoji);
      var vb = $("s4verdict");
      vb.textContent = L.name;
      vb.style.background = L.key === "safe" ? "var(--ok-bg)" : L.key === "warn" ? "var(--warn-bg)" : "var(--no-bg)";
      vb.style.color = L.color;
      drawIcon(s4.led, N.ICONS[L.icon]);
      txt($("s4beep"), L.beep ? "🔔 비프음" : "");
    }

    /* 두 방향의 점 */
    var up = $("s4pkUp"), dn = $("s4pkDn");
    if (up) up.style.left = (s4.p * 25) + "%";
    if (dn) dn.style.left = (75 - s4.p * 25) + "%";
    s4.p = (s4.p + 1) % 4;
  }

  /* =========================================================
     ⑤ 3초 이상일 때만
     ========================================================= */
  var s5 = { rec: [], hold: 3 };

  /* 60초 = 600표본. 조용 → 박수 → 대화 → 의자 → 큰 소리 → 조용 */
  var S5PLAN = [
    { scene: "quiet", n: 100 }, { scene: "clap", n: 100 }, { scene: "talk", n: 100 },
    { scene: "chair", n: 100 }, { scene: "shout", n: 100 }, { scene: "quiet", n: 100 }
  ];

  function s5init() {
    var cv = $("cvHold"); if (cv) { cv.width = 1800; cv.height = 878; }
    on($("s5make"), "click", function () {
      s5.rec = N.mixed(S5PLAN, state.seed + 7);
      s5draw();
    });
    on($("s5hold"), "input", function () {
      s5.hold = Number(this.value) / 10;
      txt($("s5holdLab"), s5.hold.toFixed(1) + "초");
      s5draw();
    });
    s5draw();
  }

  function s5draw() {
    drawHold();
    var box = $("s5msg");
    if (!s5.rec.length) {
      ["s5raw", "s5held", "s5saved", "s5lost"].forEach(function (id) { txt($(id), "–"); });
      if (box) box.innerHTML = "먼저 교실을 만들어 보세요.";
      return;
    }
    var c = N.compareSustain(s5.rec, state.t2, s5.hold, N.DEFAULT.dt, state.le);
    txt($("s5raw"), c.rawOn + "번");
    txt($("s5held"), c.heldOn + "번");
    txt($("s5saved"), c.savedFalse + "번");
    txt($("s5lost"), c.lostReal + "번");

    if (!box) return;
    if (s5.hold === 0) {
      box.innerHTML = "지속 조건이 <b>없는 상태</b>입니다. 박수 한 번, 의자 한 번에도 경보가 울립니다.";
    } else if (c.heldOn === 0) {
      box.innerHTML = "⚠ <b>너무 깁니다.</b> 정말 시끄러운 순간에도 경보가 <b>한 번도</b> 울리지 않습니다.";
    } else if (c.savedFalse > 0 && c.lostReal === 0) {
      box.innerHTML = "👍 헛경보 <b>" + c.savedFalse + "번</b>이 사라졌고, 진짜 경고는 <b>하나도</b> 놓치지 않았습니다.";
    } else if (c.lostReal > 0) {
      var extra = "";
      /* 더 짧게 해도 헛경보가 그대로 사라지는지 스스로 확인해 보게 한다 —
         «3초» 는 수업자료의 예시일 뿐 최적값이 아니다. */
      if (s5.hold > 0.5) {
        var shorter = N.compareSustain(s5.rec, state.t2, s5.hold - 0.5, N.DEFAULT.dt, state.le);
        if (shorter.savedFalse >= c.savedFalse) {
          extra = " 👉 <b>" + (s5.hold - 0.5).toFixed(1) + "초로 줄여도</b> 헛경보는 그대로 사라집니다. " +
                  "더 짧게 해 보세요.";
        }
      }
      box.innerHTML = "헛경보 <b>" + c.savedFalse + "번</b>이 사라진 대신, 진짜 시끄러운 순간 <b>" +
        c.lostReal + "번</b>이 «기다리는 동안» 지나갔습니다. " +
        "<b>얼마나 기다릴지는 우리가 정하는 것</b>입니다." + extra;
    } else {
      box.innerHTML = "지속 시간을 더 늘려 보세요.";
    }
  }

  function drawHold() {
    var cv = $("cvHold"); if (!cv) return;
    var g = cv.getContext("2d");
    var W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);

    var x0 = 82, w = W - 110;
    var gh = H - 250, gy = 40;                   // 위쪽 : 값 그래프
    var vmax = 220;
    var yOf = function (v) { return gy + gh - v / vmax * gh; };

    g.strokeStyle = "#e5e7eb"; g.lineWidth = 2;
    g.fillStyle = "#6b7280"; g.font = "26px system-ui, sans-serif"; g.textAlign = "right";
    for (var v = 0; v <= vmax; v += 40) {
      var y = yOf(v);
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke();
      g.fillText(String(v), x0 - 12, y + 9);
    }

    if (!s5.rec.length) {
      g.fillStyle = "#9ca3af"; g.font = "34px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText("「🎬 60초 교실 만들기」 를 눌러 보세요", x0 + w / 2, gy + gh / 2);
      return;
    }

    var stepX = w / s5.rec.length;

    /* 상황 구분 */
    var start = 0;
    g.textAlign = "center";
    for (var i = 1; i <= s5.rec.length; i++) {
      if (i === s5.rec.length || s5.rec[i].scene !== s5.rec[start].scene) {
        var xa = x0 + start * stepX, xb = x0 + i * stepX;
        g.strokeStyle = "#cbd5e1"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(xb, gy); g.lineTo(xb, gy + gh); g.stroke();
        var sc = N.scene(s5.rec[start].scene);
        g.fillStyle = "#334155"; g.font = "26px system-ui, sans-serif";
        g.fillText(sc.emoji + " " + sc.name, (xa + xb) / 2, gy - 12);
        start = i;
      }
    }

    /* 값 */
    g.strokeStyle = "#1e293b"; g.lineWidth = 2.2; g.beginPath();
    s5.rec.forEach(function (r, i) {
      var x = x0 + (i + 0.5) * stepX, y = yOf(Math.min(r.v, vmax));
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.stroke();

    /* 경고 기준선 */
    var yT = yOf(Math.min(state.t2, vmax));
    g.strokeStyle = "#dc2626"; g.lineWidth = 4; g.setLineDash([16, 10]);
    g.beginPath(); g.moveTo(x0, yT); g.lineTo(x0 + w, yT); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#dc2626"; g.font = "bold 26px system-ui, sans-serif"; g.textAlign = "left";
    g.fillText("경고 기준 " + state.t2, x0 + 12, yT - 12);

    /* 아래쪽 두 줄 : 지속 조건 없이 / 켜고 */
    var c = N.compareSustain(s5.rec, state.t2, s5.hold, N.DEFAULT.dt, state.le);
    var rows = [
      { y: gy + gh + 52, on: c.raw, label: "지속 조건 없이", color: "#f87171" },
      { y: gy + gh + 148, on: c.held, label: "3초 이상 지속될 때만".replace("3", s5.hold.toFixed(1)), color: "#b91c1c" }
    ];
    rows.forEach(function (row) {
      g.fillStyle = "#f1f5f9"; g.fillRect(x0, row.y, w, 56);
      g.fillStyle = row.color;
      s5.rec.forEach(function (r, i) {
        if (row.on[i]) g.fillRect(x0 + i * stepX, row.y, Math.max(1.4, stepX), 56);
      });
      g.strokeStyle = "#cbd5e1"; g.lineWidth = 2; g.strokeRect(x0, row.y, w, 56);
      g.fillStyle = "#334155"; g.font = "bold 27px system-ui, sans-serif"; g.textAlign = "right";
      g.fillText(row.label, x0 - 12, row.y + 37);
    });
  }

  /* =========================================================
     시작
     ========================================================= */
  all("#stageTabs .scene-btn").forEach(function (b) {
    b.addEventListener("click", function () { goStage(Number(b.dataset.go)); });
  });

  s1init(); s2init(); s3init(); s4init(); s5init();

  /* 홈 화면의 카드가 `sim.html#3` 처럼 스테이지를 지정해 온다.
     주소로 바로 열 수 있어야 교사가 «지금은 ③번만» 하고 링크를 줄 수 있다. */
  function fromHash() {
    var n = Number(String(location.hash || "").replace("#", ""));
    return (n >= 1 && n <= 5) ? n : 1;
  }
  goStage(fromHash());
  window.addEventListener("hashchange", function () { goStage(fromHash()); });

  /* ---------------------------------------------------------
     검사용 손잡이 — 학생 화면에는 아무 영향이 없다.
     화면 애니메이션 없이도 계산·그리기를 직접 돌려볼 수 있다.
     --------------------------------------------------------- */
  window.NoiseSim = {
    state: state,
    go: goStage,
    tick1: s1tick, tick4: s4tick,
    s1: s1, s2: s2, s3: s3, s4: s4, s5: s5,
    record: record,
    setThresh: function (t1, t2, le) {
      state.t1 = t1; state.t2 = t2; state.le = !!le;
      syncSliders(); s2draw(); s3draw(); s5draw();
    },
    setOrder: function (k) { s3.order = k; s3.hit = -1; s3.level = null; s3draw(); },
    run3: function (v) { $("s3v").value = v; s3run(); return { hit: s3.hit, level: s3.level }; },
    make5: function () { s5.rec = N.mixed(S5PLAN, state.seed + 7); s5draw(); },
    setHold: function (h) { s5.hold = h; if ($("s5hold")) $("s5hold").value = h * 10; s5draw(); },
    draw: function () { s2draw(); s3draw(); s5draw(); }
  };
})();
