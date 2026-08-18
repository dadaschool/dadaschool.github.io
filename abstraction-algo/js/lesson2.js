/* =========================================================
   lesson2.js — 2차시 실험실 「골든타임을 사수하라」

     0단계 조감도 → 노선도  : 손잡이를 끌면 도시에서 필요 없는 것부터 사라진다
     1단계 알고리즘 조립기   : 블록을 쌓으면 의사코드와 순서도가 함께 만들어지고,
                              ▶ 를 누르면 그 알고리즘대로 응급차가 실제로 달린다
     2단계 효율성 실험실     : 알고리즘 A(거리)와 B(시간)를 나란히 달리게 해 비교하고,
                              모든 길을 펼쳐 탐욕 방법의 한계를 확인한다

   지도와 알고리즘 계산은 js/map2.js, 순서도 그리기는 js/flow.js 가 맡는다.
   ========================================================= */
(function () {
  "use strict";

  var SAVE_KEY = "aa-lesson2";
  var save = {};
  try { save = JSON.parse(sessionStorage.getItem(SAVE_KEY) || "{}"); } catch (e) { save = {}; }
  function keep() {
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
    drawProgress();
  }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function stamp(e) {
    var s = el("div", "stamp", e);
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1200);
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

  /* ---------------------------------------------------------
     단계 이동 · 진행 게이지
     --------------------------------------------------------- */
  var IDS = ["s0", "s1", "s2"];
  function goto(id) {
    IDS.forEach(function (k) { $(k).classList.toggle("hidden", k !== id); });
    document.querySelectorAll(".step-btn").forEach(function (x) { x.classList.toggle("on", x.dataset.go === id); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { goto(b.dataset.go); });
  });

  function drawProgress() {
    var g = [save.cityDone, save.decompOk, save.codeOk, save.raced, save.explored];
    var done = g.filter(Boolean).length;
    $("progFill").style.width = (done / g.length * 100) + "%";
    $("progText").textContent = done + " / " + g.length;
    document.querySelectorAll(".step-btn").forEach(function (b) {
      if (b.dataset.go === "s0") b.classList.toggle("done", !!save.cityDone);
      if (b.dataset.go === "s1") b.classList.toggle("done", !!(save.decompOk && save.codeOk));
      if (b.dataset.go === "s2") b.classList.toggle("done", !!(save.raced && save.explored));
    });
  }

  /* =========================================================
     0단계 — 조감도에서 노선도로
     ========================================================= */
  var cityCv = $("cityStage"), cg = cityCv.getContext("2d");
  var CW = cityCv.width, CH = cityCv.height;
  var N = Map2.NODES, E = Map2.EDGES;

  /* 건물·나무·자동차는 무작위가 아니라 고정 위치여야 손잡이를 끌 때 흔들리지 않는다 */
  var CITY = (function () {
    var seed = 20260811;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var buildings = [], trees = [], cars = [];
    for (var i = 0; i < 34; i++) {
      buildings.push({ x: 40 + rnd() * (CW - 110), y: 40 + rnd() * (CH - 120), w: 28 + rnd() * 46, h: 26 + rnd() * 60, t: rnd() });
    }
    for (var j = 0; j < 22; j++) trees.push({ x: 40 + rnd() * (CW - 80), y: 40 + rnd() * (CH - 70), r: 8 + rnd() * 7 });
    E.forEach(function (e, k) {
      cars.push({ e: k, t: 0.25 + rnd() * .5 });
      cars.push({ e: k, t: 0.05 + rnd() * .3 });
    });
    return { buildings: buildings, trees: trees, cars: cars };
  })();

  function nodeById(id) { return Map2.nodeOf(id); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function fadeOut(t, from, to) { return 1 - clamp01((t - from) / (to - from)); }
  function fadeIn(t, from, to) { return clamp01((t - from) / (to - from)); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  function drawCity(t) {
    cg.fillStyle = t < .55 ? "#132a3f" : "#0f172a";
    cg.fillRect(0, 0, CW, CH);

    /* 블록(건물) — 20%부터 사라진다 */
    var aB = fadeOut(t, .18, .46);
    if (aB > 0) {
      CITY.buildings.forEach(function (b) {
        cg.globalAlpha = aB * (.28 + b.t * .35);
        cg.fillStyle = "#94a3b8";
        roundRect(cg, b.x, b.y, b.w, b.h, 4);
        cg.fill();
      });
      cg.globalAlpha = 1;
    }
    /* 나무 */
    var aT = fadeOut(t, .18, .46);
    if (aT > 0) {
      cg.globalAlpha = aT * .5;
      CITY.trees.forEach(function (o) {
        cg.fillStyle = "#22c55e";
        cg.beginPath(); cg.arc(o.x, o.y, o.r, 0, 6.284); cg.fill();
      });
      cg.globalAlpha = 1;
    }

    /* 도로 — 넓은 회색 도로에서 가는 색선으로 바뀐다 */
    E.forEach(function (e) {
      var a = nodeById(e.a), b = nodeById(e.b);
      var col = Map2.colorOf(e.min);
      var w = lerp(26, 9, clamp01((t - .44) / .3));
      cg.lineCap = "round";
      /* 아스팔트 */
      cg.strokeStyle = "#475569";
      cg.globalAlpha = fadeOut(t, .44, .74);
      cg.lineWidth = w + 6;
      cg.beginPath(); cg.moveTo(a.x, a.y); cg.lineTo(b.x, b.y); cg.stroke();
      /* 색 선 */
      cg.globalAlpha = fadeIn(t, .44, .74) * .95 + .05;
      cg.strokeStyle = col.css;
      cg.lineWidth = lerp(6, 9, clamp01((t - .44) / .3));
      cg.beginPath(); cg.moveTo(a.x, a.y); cg.lineTo(b.x, b.y); cg.stroke();
      cg.globalAlpha = 1;

      /* 중앙선 — 도로가 도로처럼 보일 때만 */
      var aC = fadeOut(t, .3, .55);
      if (aC > 0) {
        cg.globalAlpha = aC * .8;
        cg.strokeStyle = "#fbbf24";
        cg.lineWidth = 2;
        cg.setLineDash([9, 9]);
        cg.beginPath(); cg.moveTo(a.x, a.y); cg.lineTo(b.x, b.y); cg.stroke();
        cg.setLineDash([]);
        cg.globalAlpha = 1;
      }
    });

    /* 자동차·사람 — 가장 먼저 사라진다 */
    var aCar = fadeOut(t, .02, .2);
    if (aCar > 0) {
      cg.globalAlpha = aCar;
      cg.font = "18px 'Segoe UI Emoji',sans-serif";
      cg.textAlign = "center"; cg.textBaseline = "middle";
      CITY.cars.forEach(function (c) {
        var e = E[c.e], a = nodeById(e.a), b = nodeById(e.b);
        cg.fillText("🚗", lerp(a.x, b.x, c.t), lerp(a.y, b.y, c.t));
      });
      cg.globalAlpha = 1;
    }

    /* 지역 — 건물 그림에서 동그란 노드로 */
    cg.textAlign = "center"; cg.textBaseline = "middle";
    N.forEach(function (n) {
      var r = lerp(30, 34, fadeIn(t, .6, 1));
      cg.globalAlpha = fadeIn(t, .55, .85) * .9;
      cg.fillStyle = n.id === "hosp" ? "#dc2626" : n.id === "home" ? "#2563eb" : "#1e293b";
      cg.beginPath(); cg.arc(n.x, n.y, r, 0, 6.284); cg.fill();
      cg.lineWidth = 3;
      cg.strokeStyle = "#e2e8f0";
      cg.stroke();
      cg.globalAlpha = 1;

      cg.font = "27px 'Segoe UI Emoji',sans-serif";
      cg.fillText(n.em, n.x, n.y - 2);
      cg.fillStyle = "#f1f5f9";
      cg.font = "bold 17px 'Malgun Gothic',sans-serif";
      cg.fillText(n.name, n.x, n.y + r + 16);
    });

    /* 마지막에 거리 숫자가 나타난다 */
    var aNum = fadeIn(t, .82, 1);
    if (aNum > 0) {
      cg.globalAlpha = aNum;
      E.forEach(function (e) {
        var a = nodeById(e.a), b = nodeById(e.b);
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cg.fillStyle = "rgba(15,23,42,.9)";
        roundRect(cg, mx - 40, my - 15, 80, 30, 8);
        cg.fill();
        cg.fillStyle = "#e2e8f0";
        cg.font = "bold 15px 'Malgun Gothic',sans-serif";
        cg.fillText(e.m + "m", mx, my);
      });
      cg.globalAlpha = 1;
    }
  }

  var LEGENDS = [
    { at: 0, t: "0% — 있는 그대로의 도시" },
    { at: 20, t: "20% — 사람과 자동차를 지웠다" },
    { at: 45, t: "45% — 건물 모양과 나무를 지웠다" },
    { at: 70, t: "70% — 도로 폭을 선 하나로 바꿨다" },
    { at: 95, t: "100% — 지역과 길만 남았다" }
  ];
  var slider = $("absSlider");
  function onSlide() {
    var v = +slider.value;
    drawCity(v / 100);
    var lab = LEGENDS[0];
    LEGENDS.forEach(function (L) { if (v >= L.at) lab = L; });
    $("absLabel").textContent = lab.t;
    document.querySelectorAll(".abs-legend .leg").forEach(function (g) {
      g.classList.toggle("on", v >= +g.dataset.at);
    });
    if (v >= 100 && !save.cityDone) { save.cityDone = true; stamp("🗺️"); keep(); }
    $("cityDone").hidden = !save.cityDone;
    $("cityTip").textContent = v >= 100
      ? "이제 컴퓨터가 다룰 수 있는 모습이 되었습니다."
      : "손잡이를 끌면 필요 없는 것부터 사라집니다.";
  }
  slider.addEventListener("input", onSlide);
  onSlide();

  /* =========================================================
     1단계 - 1 : 문제 분해
     ========================================================= */
  var PARTS = [
    { t: "환자의 상태를 확인한다", em: "🩺", need: true },
    { t: "병원까지 가장 좋은 길을 찾는다", em: "🗺️", need: true },
    { t: "가는 길의 신호를 처리한다", em: "🚦", need: true },
    { t: "응급차를 깨끗이 세차한다", em: "🧼", need: false },
    { t: "구급대원의 점심 메뉴를 정한다", em: "🍱", need: false },
    { t: "차에 좋은 음악을 튼다", em: "🎵", need: false }
  ];
  var picked = save.parts ? save.parts.slice() : [];

  function drawDecomp() {
    var host = $("decomp");
    host.innerHTML = "";
    PARTS.forEach(function (p, i) {
      var on = picked.indexOf(i) >= 0;
      var b = el("button", "partcard" + (on ? " on" : ""));
      b.type = "button";
      b.innerHTML = '<span class="em">' + p.em + '</span><span class="tx">' + p.t + '</span>' +
        '<span class="mk">' + (on ? "✔" : "＋") + '</span>';
      b.addEventListener("click", function () {
        if (on) picked = picked.filter(function (x) { return x !== i; });
        else if (picked.length >= 3) { PdfKit.toast("작은 문제는 3개까지 고를 수 있습니다.", "warn"); return; }
        else picked.push(i);
        save.parts = picked.slice();
        drawDecomp();
        judgeDecomp();
        keep();
      });
      host.appendChild(b);
    });
  }
  function judgeDecomp() {
    var host = $("decompVerdict");
    host.innerHTML = "";
    if (picked.length < 3) return;
    var ok = picked.every(function (i) { return PARTS[i].need; });
    save.decompOk = ok;
    var v = el("div", "verdict " + (ok ? "ok" : "no"));
    v.innerHTML = ok
      ? "<b>정확합니다 👍</b>큰 문제 하나가 <b>손댈 수 있는 작은 문제 셋</b>이 되었습니다. " +
        "이제 각각을 알고리즘으로 만들면 됩니다. 오늘은 그중 <b>‘신호를 처리하며 병원까지 간다’</b>를 만들어 봅니다."
      : "<b>다시 볼까요</b>고른 것 중에 <b>‘응급 구조 성공’과 상관없는 것</b>이 있습니다. " +
        "세차·점심·음악은 그 자체로 나쁜 일은 아니지만, 이 문제를 푸는 데는 도움이 되지 않습니다.";
    host.appendChild(v);
    if (ok) stamp("🧩");
    keep();
  }
  drawDecomp(); judgeDecomp();

  /* =========================================================
     1단계 - 2 : 알고리즘 조립기
     ========================================================= */
  var PAL = ["confirm", "loop", "siren", "waitRed", "move", "loopEnd", "handover"];
  var code = save.code ? save.code.slice() : [];

  function drawPalette() {
    var host = $("palette");
    host.innerHTML = "";
    PAL.forEach(function (id) {
      var b = Flow.BLOCKS[id];
      var kind = b.kind === "loopEnd" ? "loop" : b.kind;
      var btn = el("button", "block " + kind);
      btn.type = "button";
      btn.innerHTML = '<span class="bk">' + kindName(b.kind) + '</span>' +
        '<span class="em">' + b.em + '</span>' +
        '<span class="tx">' + (b.kind === "if" ? "만약 " + b.when + ", " + b.then : b.text) + '</span>';
      btn.addEventListener("click", function () { code.push(id); redrawCode(); });
      host.appendChild(btn);
    });
  }
  function kindName(k) {
    return k === "seq" ? "순차" : k === "if" ? "선택" : "반복";
  }

  function redrawCode() {
    var host = $("code");
    host.innerHTML = "";
    $("codeCount").textContent = code.length + "줄";
    save.code = code.slice();

    if (!code.length) {
      host.appendChild(el("li", "empty", "위에서 블록을 눌러 쌓으세요."));
      $("flow").innerHTML = '<p class="empty">아직 블록이 없습니다.</p>';
      keep();
      return;
    }

    var lines = Flow.pseudo(code);
    lines.forEach(function (L, i) {
      var kind = L.kind === "loopEnd" ? "loop" : L.kind;
      var li = el("li", "codeline " + kind);
      li.innerHTML = '<span class="ln">' + (i + 1) + '</span>' +
        '<span class="pad">' + L.pad + '</span>' +
        '<span class="em">' + L.em + '</span>' +
        '<span class="tx">' + L.text + '</span>';
      var x = el("button", "tinybtn del", "✕");
      x.type = "button"; x.title = "이 줄 지우기";
      x.addEventListener("click", function () { code.splice(i, 1); redrawCode(); });
      li.appendChild(x);
      host.appendChild(li);
    });

    var r = Flow.render(code);
    $("flow").innerHTML = r.svg +
      (r.open ? '<p class="flowwarn">⚠ <b>반복 끝</b>을 넣지 않아 반복이 닫히지 않았습니다.</p>' : "") +
      (r.stray ? '<p class="flowwarn">⚠ 열지 않은 반복을 닫으려 했습니다.</p>' : "");
    keep();
  }

  $("clearCode").addEventListener("click", function () {
    code = [];
    redrawCode();
    $("runVerdict").innerHTML = "";
    $("fiveCond").innerHTML = "";
    resetRoad();
  });
  $("sampleCode").addEventListener("click", function () {
    code = ["confirm", "loop", "siren", "move", "loopEnd", "handover"];
    redrawCode();
    PdfKit.toast("교과서 예시를 넣었습니다. ▶ 로 달려 보세요.");
  });

  drawPalette(); redrawCode();

  /* ---------------------------------------------------------
     응급차가 달리는 도로
     --------------------------------------------------------- */
  var rc = $("roadStage"), rg = rc.getContext("2d");
  var RW = rc.width, RH = rc.height;
  var CELLS = 6;
  var REDS = [2, 5];                       /* 이 칸 앞에 빨간불이 있다 */
  var car = { cell: 0, x: 0, time: 0, siren: false, stopped: false };

  function cellX(c) { return 90 + c * ((RW - 190) / CELLS); }

  function drawRoad() {
    var g = rg.createLinearGradient(0, 0, 0, RH);
    g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#1e293b");
    rg.fillStyle = g; rg.fillRect(0, 0, RW, RH);

    /* 도로 */
    rg.fillStyle = "#334155";
    rg.fillRect(60, 128, RW - 120, 66);
    rg.strokeStyle = "#fbbf24";
    rg.setLineDash([16, 14]); rg.lineWidth = 3;
    rg.beginPath(); rg.moveTo(60, 161); rg.lineTo(RW - 60, 161); rg.stroke();
    rg.setLineDash([]);

    rg.textAlign = "center"; rg.textBaseline = "middle";

    /* 출발·도착 */
    rg.font = "38px 'Segoe UI Emoji',sans-serif";
    rg.fillText("🏠", cellX(0), 92);
    rg.fillText("🏥", cellX(CELLS), 92);
    rg.fillStyle = "#cbd5e1";
    rg.font = "16px 'Malgun Gothic',sans-serif";
    rg.fillText("집", cellX(0), 66);
    rg.fillText("병원", cellX(CELLS), 66);

    /* 칸 눈금 */
    for (var c = 0; c <= CELLS; c++) {
      rg.strokeStyle = "rgba(255,255,255,.18)";
      rg.lineWidth = 2;
      rg.beginPath(); rg.moveTo(cellX(c), 128); rg.lineTo(cellX(c), 194); rg.stroke();
    }

    /* 신호등 */
    REDS.forEach(function (c) {
      var x = cellX(c);
      var passed = car.cell >= c;
      rg.fillStyle = "#0f172a";
      roundRect(rg, x - 13, 208, 26, 40, 7); rg.fill();
      rg.fillStyle = passed ? "#22c55e" : "#ef4444";
      rg.beginPath(); rg.arc(x, 228, 10, 0, 6.284); rg.fill();
      rg.fillStyle = "rgba(226,232,240,.75)";
      rg.font = "13px 'Malgun Gothic',sans-serif";
      rg.fillText(passed ? "통과" : "빨간불", x, 254);
    });

    /* 응급차 */
    var cx = cellX(car.x);
    if (car.siren) {
      rg.fillStyle = "rgba(239,68,68,.32)";
      rg.beginPath(); rg.arc(cx, 158, 40, 0, 6.284); rg.fill();
    }
    rg.font = "46px 'Segoe UI Emoji',sans-serif";
    rg.fillText("🚑", cx, 160);
    if (car.stopped) {
      rg.fillStyle = "#fca5a5";
      rg.font = "bold 16px 'Malgun Gothic',sans-serif";
      rg.fillText("멈춤", cx, 118);
    }

    /* 시계 */
    rg.fillStyle = car.time > Map2.GOLDEN ? "#fca5a5" : "#a7f3d0";
    rg.font = "bold 22px 'Malgun Gothic',sans-serif";
    rg.textAlign = "right";
    rg.fillText("⏱ " + car.time + "분 / 골든타임 " + Map2.GOLDEN + "분", RW - 24, 36);
    rg.textAlign = "center";
  }
  function resetRoad() {
    car = { cell: 0, x: 0, time: 0, siren: false, stopped: false };
    drawRoad();
    $("roadTip").textContent = "▶ 를 누르면 내가 만든 알고리즘대로 응급차가 움직입니다.";
  }
  resetRoad();

  function slideCar(to, ms) {
    return new Promise(function (done) {
      var from = car.x, start = null;
      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / ms);
        car.x = from + (to - from) * p;
        drawRoad();
        if (p < 1) requestAnimationFrame(frame); else { car.x = to; drawRoad(); done(); }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------------------------------------------------------
     내가 만든 알고리즘을 그대로 실행한다
     --------------------------------------------------------- */
  var running2 = false;

  async function runCode() {
    if (running2) return;
    if (!code.length) { PdfKit.toast("먼저 블록을 쌓아 알고리즘을 만들어 주세요.", "warn"); return; }
    running2 = true;
    $("runCode").disabled = true;
    $("runVerdict").innerHTML = "";
    resetRoad();

    var parsed = Flow.parse(code);
    var st = { moves: 0, loops: 0, infinite: false, blocked: false, handled: null, confirmed: false, handed: false };

    async function exec(body) {
      for (var i = 0; i < body.length; i++) {
        if (st.blocked || st.infinite) return;
        var n = body[i];
        var b = Flow.BLOCKS[n.id];

        if (n.kind === "loop") {
          while (car.cell < CELLS) {
            if (++st.loops > 24) { st.infinite = true; return; }
            var before = car.cell;
            await exec(n.body);
            if (st.blocked || st.infinite) return;
            if (car.cell === before) {
              /* 한 바퀴 돌았는데 한 칸도 못 갔다 → 영원히 끝나지 않는다 */
              if (st.loops > 3) { st.infinite = true; return; }
            }
          }
          /* ⚠ 여기서 return 하면 안 된다.
             반복이 끝난 뒤에 오는 블록(환자 인계 등)을 실행하지 못한다. */

        } else if (n.kind === "if") {
          var isRed = REDS.indexOf(car.cell) >= 0;
          $("roadTip").textContent = "🚦 신호등을 확인합니다 — " + (isRed ? "빨간불!" : "초록불");
          if (isRed) {
            st.handled = n.id;
            car.siren = (n.id === "siren");
            drawRoad();
            await wait(420);
            car.siren = false;
          } else {
            await wait(200);
          }

        } else if (n.id === "move") {
          var isRed2 = REDS.indexOf(car.cell) >= 0;
          if (isRed2 && st.handled === null) {
            car.stopped = true;
            drawRoad();
            $("roadTip").textContent = "🛑 빨간불인데 아무 처리도 하지 않아 멈췄습니다.";
            st.blocked = true;
            return;
          }
          var cost = 1;
          if (isRed2 && st.handled === "siren") cost = 2;
          if (isRed2 && st.handled === "waitRed") cost = 4;
          if (isRed2 && st.handled === "waitRed") {
            $("roadTip").textContent = "🛑 파란불이 될 때까지 기다립니다… (4분)";
            await wait(500);
          }
          car.cell++;
          car.time += cost;
          st.moves++;
          st.handled = null;
          $("roadTip").textContent = "🚑 " + car.cell + "칸째 — 지금까지 " + car.time + "분";
          await slideCar(car.cell, 340);

        } else if (n.id === "confirm") {
          st.confirmed = true;
          $("roadTip").textContent = "🏥 병원 위치를 확인했습니다.";
          await wait(340);

        } else if (n.id === "handover") {
          if (car.cell >= CELLS) st.handed = true;
          $("roadTip").textContent = car.cell >= CELLS
            ? "🩺 환자를 인계했습니다!"
            : "🩺 …아직 병원이 아닌데 인계하려 했습니다.";
          await wait(420);
        }
      }
    }

    await exec(parsed.tree.body);

    var arrived = car.cell >= CELLS;
    var inTime = car.time <= Map2.GOLDEN;
    var perfect = arrived && st.handed && inTime && !st.infinite && !st.blocked;

    var v = el("div", "verdict " + (perfect ? "ok" : "no"));
    if (st.infinite) {
      v.innerHTML = "<b>영원히 끝나지 않습니다 ♾️</b>" +
        "반복 안에 <b>‘앞으로 한 칸 이동한다’</b>가 없으면 조건이 영영 바뀌지 않습니다. " +
        "알고리즘은 <b>반드시 끝나야</b> 합니다 — 이것을 <b>유한성</b>이라고 합니다.";
      $("roadTip").textContent = "♾️ 무한 반복! 몇 바퀴를 돌아도 제자리여서 강제로 멈췄습니다.";
    } else if (st.blocked) {
      v.innerHTML = "<b>빨간불에 갇혔습니다 🛑</b>" +
        "일어날 수 있는 상황을 <b>선택 구조</b>로 미리 정해 두지 않으면 알고리즘은 거기서 멈춥니다. " +
        "🚦 나 🛑 블록을 반복 안에 넣어 보세요.";
    } else if (!arrived) {
      v.innerHTML = "<b>병원에 닿지 못했습니다</b>" +
        (st.moves <= 1
          ? "한 칸만 가고 끝났습니다. <b>반복 구조</b>가 없으면 명령은 한 번씩만 실행됩니다."
          : "이동이 모자랍니다. 병원까지는 " + CELLS + "칸입니다.");
    } else if (!st.handed) {
      v.innerHTML = "<b>도착했지만 할 일이 남았습니다</b>" +
        "병원에 닿기만 해서는 문제가 풀리지 않습니다. 반복이 끝난 뒤 <b>🩺 환자를 인계한다</b>를 넣어야 " +
        "<b>목표 상태</b>에 닿습니다.";
    } else if (!inTime) {
      v.innerHTML = "<b>도착했지만 " + car.time + "분 — 골든타임을 넘겼습니다 ⏱️</b>" +
        "빨간불마다 <b>멈춰서 기다렸기</b> 때문입니다. 응급차는 사이렌을 켜면 <b>서행하며 통과</b>할 수 있습니다. " +
        "🚦 블록으로 바꾸어 다시 달려 보세요. <b>같은 목적지라도 방법에 따라 시간이 달라집니다.</b>";
    } else {
      v.innerHTML = "<b>구조 성공! 🎉 " + car.time + "분에 도착했습니다</b>" +
        "순차 · 선택 · 반복 세 구조가 모두 제 역할을 했습니다. " +
        "이제 <b>어느 길로 갈 것인가</b>를 따질 차례입니다.";
      stamp("🎉");
      save.codeOk = true;
      save.codeTime = car.time;
    }
    $("runVerdict").appendChild(v);

    drawFive(st, arrived, inTime);
    keep();
    running2 = false;
    $("runCode").disabled = false;
  }
  $("runCode").addEventListener("click", runCode);

  function drawFive(st, arrived, inTime) {
    var rows = [
      { t: "입력 — 필요한 것을 받는가", ok: st.confirmed, no: "‘병원 위치를 확인한다’가 없습니다." },
      { t: "출력 — 결과가 나오는가", ok: st.handed, no: "‘환자를 인계한다’가 없습니다." },
      { t: "명확성 — 애매한 명령이 없는가", ok: !Flow.parse(code).open && !Flow.parse(code).stray, no: "반복이 열린 채로 남아 있습니다." },
      { t: "수행 가능성 — 실제로 해낼 수 있는가", ok: arrived && !st.blocked, no: "병원까지 가지 못했습니다." },
      { t: "유한성 — 언젠가 끝나는가", ok: !st.infinite, no: "무한 반복에 빠졌습니다." }
    ];
    var host = $("fiveCond");
    host.innerHTML = "";
    rows.forEach(function (r) {
      var row = el("div", "checkrow " + (r.ok ? "ok" : "no"));
      row.innerHTML = '<span class="ci">' + (r.ok ? "✅" : "❌") + '</span><span>' + r.t + '</span>' +
        '<b>' + (r.ok ? "지킴" : r.no) + '</b>';
      host.appendChild(row);
    });
  }

  /* =========================================================
     2단계 — 효율성 실험실
     ========================================================= */
  var mc = $("mapStage"), mg = mc.getContext("2d");
  var MW = mc.width, MH = mc.height;
  var runners = [];                   /* 달리는 응급차들 */
  var curEdges = Map2.cloneEdges();
  var curCard = null;

  function drawMap() {
    var g = mg.createLinearGradient(0, 0, 0, MH);
    g.addColorStop(0, "#0b1220"); g.addColorStop(1, "#152238");
    mg.fillStyle = g; mg.fillRect(0, 0, MW, MH);

    mg.textAlign = "center"; mg.textBaseline = "middle";
    mg.lineCap = "round";

    /* 도로 */
    curEdges.forEach(function (e) {
      var a = Map2.nodeOf(e.a), b = Map2.nodeOf(e.b);
      var col = Map2.colorOf(e.min);
      if (e.blocked) {
        mg.strokeStyle = "#475569";
        mg.setLineDash([10, 10]);
      } else {
        mg.strokeStyle = col.css;
        mg.setLineDash([]);
      }
      mg.lineWidth = 10;
      mg.globalAlpha = e.blocked ? .45 : .92;
      mg.beginPath(); mg.moveTo(a.x, a.y); mg.lineTo(b.x, b.y); mg.stroke();
      mg.globalAlpha = 1;
      mg.setLineDash([]);

      /* 거리·시간 표 */
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      mg.fillStyle = "rgba(15,23,42,.92)";
      roundRect(mg, mx - 52, my - 17, 104, 34, 9); mg.fill();
      mg.strokeStyle = e.blocked ? "#64748b" : col.css;
      mg.lineWidth = 2; mg.stroke();
      mg.fillStyle = e.blocked ? "#94a3b8" : "#f1f5f9";
      mg.font = "bold 15px 'Malgun Gothic',sans-serif";
      mg.fillText(e.blocked ? "공사중" : e.m + "m · " + e.min + "분", mx, my);
    });

    /* 지역 */
    Map2.NODES.forEach(function (n) {
      mg.fillStyle = n.id === "hosp" ? "#dc2626" : n.id === "home" ? "#2563eb" : "#1e293b";
      mg.beginPath(); mg.arc(n.x, n.y, 34, 0, 6.284); mg.fill();
      mg.lineWidth = 3; mg.strokeStyle = "#e2e8f0"; mg.stroke();
      mg.font = "27px 'Segoe UI Emoji',sans-serif";
      mg.fillText(n.em, n.x, n.y - 2);
      mg.fillStyle = "#f1f5f9";
      mg.font = "bold 17px 'Malgun Gothic',sans-serif";
      mg.fillText(n.name, n.x, n.y + 52);
    });

    /* 달리는 응급차 */
    runners.forEach(function (r) {
      mg.fillStyle = r.color;
      mg.globalAlpha = .3;
      mg.beginPath(); mg.arc(r.x, r.y, 26, 0, 6.284); mg.fill();
      mg.globalAlpha = 1;
      mg.font = "34px 'Segoe UI Emoji',sans-serif";
      mg.fillText("🚑", r.x, r.y);
      mg.fillStyle = r.color;
      mg.font = "bold 16px 'Malgun Gothic',sans-serif";
      mg.fillText(r.label, r.x, r.y - 30);
    });
  }
  drawMap();

  function makeRunner(label, color, path, offset) {
    var n0 = Map2.nodeOf(path[0]);
    return { label: label, color: color, path: path, i: 0, x: n0.x + offset, y: n0.y + offset, off: offset };
  }

  function moveRunners(ms) {
    return new Promise(function (done) {
      var start = null;
      var froms = runners.map(function (r) { return { x: r.x, y: r.y }; });
      var tos = runners.map(function (r) {
        var nx = Map2.nodeOf(r.path[Math.min(r.i + 1, r.path.length - 1)]);
        return { x: nx.x + r.off, y: nx.y + r.off };
      });
      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / ms);
        var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        runners.forEach(function (r, i) {
          r.x = froms[i].x + (tos[i].x - froms[i].x) * e;
          r.y = froms[i].y + (tos[i].y - froms[i].y) * e;
        });
        drawMap();
        if (p < 1) requestAnimationFrame(frame);
        else { runners.forEach(function (r) { if (r.i < r.path.length - 1) r.i++; }); done(); }
      }
      requestAnimationFrame(frame);
    });
  }

  var racing = false;
  async function race(which) {
    if (racing) return;
    racing = true;
    ["raceA", "raceB", "raceBoth"].forEach(function (id) { $(id).disabled = true; });
    $("raceVerdict").innerHTML = "";

    var A = Map2.greedy("m", curEdges);
    var B = Map2.greedy("min", curEdges);
    runners = [];
    if (which !== "B") runners.push(makeRunner("A", "#60a5fa", A.path, -13));
    if (which !== "A") runners.push(makeRunner("B", "#f87171", B.path, 13));
    drawMap();

    var maxLen = Math.max.apply(null, runners.map(function (r) { return r.path.length; }));
    for (var s = 1; s < maxLen; s++) {
      $("mapTip").textContent = s + "번째 이동 중…";
      await moveRunners(760);
    }

    fillRaceTable(which, A, B);
    $("mapTip").textContent = "도착했습니다. 아래 표에서 거리와 시간을 비교해 보세요.";
    save.raced = true;
    save.raceA = { path: A.path.map(Map2.nameOf), m: A.totalM, min: A.totalMin };
    save.raceB = { path: B.path.map(Map2.nameOf), m: B.totalM, min: B.totalMin };
    keep();
    stamp("🏁");

    racing = false;
    ["raceA", "raceB", "raceBoth"].forEach(function (id) { $(id).disabled = false; });
  }

  function fillRaceTable(which, A, B) {
    var tb = $("raceTable").querySelector("tbody");
    tb.innerHTML = "";
    function row(label, res, cls) {
      var tr = el("tr", cls);
      tr.innerHTML =
        '<td class="left"><b>' + label + '</b></td>' +
        '<td class="left">' + Map2.pathText(res.path) + (res.stuck ? " <b style='color:#dc2626'>(막다른 길!)</b>" : "") + '</td>' +
        '<td><b>' + res.totalM.toLocaleString() + 'm</b></td>' +
        '<td><b>' + res.totalMin + '분</b>' + (res.totalMin > Map2.GOLDEN ? ' <span style="color:#dc2626">초과</span>' : "") + '</td>';
      tb.appendChild(tr);
    }
    if (which !== "B") row("🔵 알고리즘 A (거리 기준)", A);
    if (which !== "A") row("🔴 알고리즘 B (시간 기준)", B);

    if (which === "both") {
      var v = el("div", "verdict info");
      var shorter = A.totalM <= B.totalM ? "A" : "B";
      var faster = A.totalMin <= B.totalMin ? "A" : "B";
      v.innerHTML = "<b>같은 지도인데 길이 다릅니다</b>" +
        "거리는 <b>" + shorter + "</b>가 " + Math.abs(A.totalM - B.totalM).toLocaleString() + "m 짧고, " +
        "시간은 <b>" + faster + "</b>가 " + Math.abs(A.totalMin - B.totalMin) + "분 빠릅니다. " +
        "바꾼 것은 <b>②번 규칙 한 줄</b>뿐입니다.<br><br>" +
        "심정지 환자를 태운 지금, <b>‘최적’의 기준</b>은 무엇이어야 할까요? " +
        (A.totalMin > Map2.GOLDEN
          ? "A로 가면 골든타임 " + Map2.GOLDEN + "분을 넘깁니다."
          : "") +
        " 그런데 잠깐 — <b>B가 찾은 길이 정말 가장 빠른 길일까요?</b> 아래에서 확인해 봅시다.";
      $("raceVerdict").appendChild(v);
    }
  }

  $("raceA").addEventListener("click", function () { race("A"); });
  $("raceB").addEventListener("click", function () { race("B"); });
  $("raceBoth").addEventListener("click", function () { race("both"); });

  /* ---------------------------------------------------------
     모든 길 펼쳐 보기 — 탐욕 방법의 한계
     --------------------------------------------------------- */
  $("showAll").addEventListener("click", function () {
    var paths = Map2.allPaths(curEdges);
    var A = Map2.greedy("m", curEdges);
    var B = Map2.greedy("min", curEdges);
    var bestMin = Math.min.apply(null, paths.map(function (p) { return p.totalMin; }));
    var bestM = Math.min.apply(null, paths.map(function (p) { return p.totalM; }));

    var host = $("allPaths");
    host.innerHTML = "";
    var wrap = el("div", "tablescroll");
    var t = el("table", "grid");
    t.innerHTML = "<thead><tr><th class='left'>집에서 병원까지 가는 길</th><th>거리</th><th>시간</th><th>누가 찾았나</th></tr></thead>";
    var tb = el("tbody");
    paths.forEach(function (p) {
      var isA = sameArr(p.path, A.path), isB = sameArr(p.path, B.path);
      var badge = (isA ? "🔵 A " : "") + (isB ? "🔴 B " : "");
      var mark = (p.totalMin === bestMin ? "⏱️ 가장 빠름 " : "") + (p.totalM === bestM ? "📏 가장 짧음" : "");
      var tr = el("tr", (p.totalMin === bestMin || p.totalM === bestM) ? "hi" : "");
      tr.innerHTML = "<td class='left'>" + Map2.pathText(p.path) + " <b style='color:var(--brand)'>" + mark + "</b></td>" +
        "<td>" + p.totalM.toLocaleString() + "m</td><td>" + p.totalMin + "분</td>" +
        "<td>" + (badge || "—") + "</td>";
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    host.appendChild(wrap);

    var missedTime = B.totalMin > bestMin;
    var missedDist = A.totalM > bestM;
    var v = el("div", "verdict " + (missedTime || missedDist ? "no" : "ok"));
    v.innerHTML = "<b>욕심쟁이 방법의 함정</b>" +
      (missedTime
        ? "시간을 기준으로 삼은 <b>B</b>는 " + B.totalMin + "분이 걸렸지만, 실제로 가장 빠른 길은 <b>" + bestMin + "분</b>입니다. " +
          "출발점에서 <b>가장 빨라 보이는 길</b>을 골랐다가, 그 뒤에 오는 느린 길을 만난 것입니다.<br>"
        : "") +
      (missedDist
        ? "거리를 기준으로 삼은 <b>A</b>도 " + A.totalM.toLocaleString() + "m를 갔지만, 가장 짧은 길은 <b>" + bestM.toLocaleString() + "m</b>입니다.<br>"
        : "") +
      "<br>바로 앞만 보고 고르는 방법은 <b>빠르고 쉽지만 늘 최선은 아닙니다.</b> " +
      "그래서 실제 내비게이션은 이 표처럼 <b>여러 경로를 한꺼번에 따져 본 뒤</b> 답을 내놓습니다.";
    host.appendChild(v);

    save.explored = true;
    keep();
    stamp("🔍");
  });

  function sameArr(a, b) {
    return a.length === b.length && a.every(function (v, i) { return v === b[i]; });
  }

  /* ---------------------------------------------------------
     상황 카드
     --------------------------------------------------------- */
  function drawCards() {
    var host = $("cardPick");
    host.innerHTML = "";
    Map2.CARDS.forEach(function (c) {
      var b = el("button", "situation" + (curCard === c.id ? " on" : "") +
        ((save.cardsDone || []).indexOf(c.id) >= 0 ? " done" : ""));
      b.type = "button";
      b.innerHTML = '<span class="em">' + c.em + '</span><span class="tt">' + c.title + '</span>';
      b.addEventListener("click", function () { openCard(c); });
      host.appendChild(b);
    });
  }

  function openCard(c) {
    curCard = c.id;
    curEdges = Map2.edgesWithCard(c.id);
    runners = [];
    drawMap();
    drawCards();
    $("mapTip").textContent = c.em + " " + c.title + " — 지도의 숫자가 바뀌었습니다.";

    var host = $("cardBody");
    host.innerHTML = "";
    var box = el("div", "situbox");
    box.innerHTML = '<h3>' + c.em + ' ' + c.title + '</h3><p class="sd">' + c.desc + '</p>' +
      '<p class="ask">' + c.ask + '</p>';
    var row = el("div", "chips");
    [["m", "📏 거리를 기준으로"], ["min", "⏱️ 시간을 기준으로"]].forEach(function (o) {
      var b = el("button", "chip", o[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        row.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        judgeCard(c, o[0], box);
      });
      row.appendChild(b);
    });
    box.appendChild(row);
    host.appendChild(box);

    var back = el("div", "btnrow");
    var rb = el("button", "btn ghost", "↺ 원래 지도로 되돌리기");
    rb.type = "button";
    rb.addEventListener("click", function () {
      curCard = null;
      curEdges = Map2.cloneEdges();
      runners = [];
      drawMap(); drawCards();
      $("cardBody").innerHTML = "";
      $("mapTip").textContent = "원래 지도로 돌아왔습니다.";
    });
    back.appendChild(rb);
    host.appendChild(back);
  }

  async function judgeCard(c, basis, box) {
    var old = box.querySelector(".verdict");
    if (old) old.remove();
    var res = Map2.greedy(basis, curEdges);
    var paths = Map2.allPaths(curEdges);
    var bestMin = Math.min.apply(null, paths.map(function (p) { return p.totalMin; }));
    var bestM = Math.min.apply(null, paths.map(function (p) { return p.totalM; }));

    var ok = basis === c.want;
    var v = el("div", "verdict " + (ok ? "ok" : "no"));

    /* 고른 기준에 맞는 이야기만 한다.
       연료가 급한 상황에서 골든타임을 따지면 오히려 헷갈린다. */
    var tail;
    if (basis === "min") {
      tail = (res.totalMin > Map2.GOLDEN
          ? "골든타임 " + Map2.GOLDEN + "분을 <b>넘겼습니다.</b> 상황이 나빠지면 같은 알고리즘도 늦어집니다. "
          : "골든타임 " + Map2.GOLDEN + "분 안에 들어왔습니다. ") +
        "그런데 이 상황에서 가장 빠른 길은 <b>" + bestMin + "분</b>입니다" +
        (res.totalMin > bestMin ? " — 탐욕 방법은 여기서도 최선을 놓쳤습니다." : " — 이번에는 탐욕 방법이 최선을 찾았습니다.");
    } else {
      tail = "이 상황에서 가장 짧은 길은 <b>" + bestM.toLocaleString() + "m</b>입니다" +
        (res.totalM > bestM ? " — 탐욕 방법은 여기서도 최선을 놓쳤습니다." : " — 이번에는 탐욕 방법이 최선을 찾았습니다.") +
        /* 급한 상황인지 아닌지는 '내가 고른 기준'이 아니라 '카드가 준 상황'이 정한다 */
        (c.want === "m"
          ? " 시간은 " + res.totalMin + "분이 걸렸지만, 지금은 급한 상황이 아닙니다."
          : " 그런데 이 길은 <b>" + res.totalMin + "분</b>이 걸립니다. 시간을 기준으로 삼았다면 <b>" +
            Map2.greedy("min", curEdges).totalMin + "분</b>에 닿을 수 있었습니다.");
    }

    v.innerHTML = "<b>" + (ok ? "좋은 판단입니다 👍" : "다시 생각해 볼까요") + "</b>" +
      (ok ? "" : (c.want === "min"
        ? "이 상황은 <b>사람의 생명</b>이 걸려 있습니다. 기름값보다 <b>1분</b>이 중요합니다.<br>"
        : "이 상황은 급하지 않고 <b>연료가 부족</b>합니다. 이럴 때는 거리를 아끼는 쪽이 낫습니다.<br>")) +
      "고른 기준으로 달리면 <b>" + Map2.pathText(res.path) + "</b> — " +
      res.totalM.toLocaleString() + "m · " + res.totalMin + "분입니다. " + tail;
    box.appendChild(v);

    save.cardsDone = save.cardsDone || [];
    if (save.cardsDone.indexOf(c.id) < 0) save.cardsDone.push(c.id);
    keep();
    drawCards();

    /* 그 상황에서 실제로 달려 보여 준다 */
    runners = [makeRunner(basis === "m" ? "거리" : "시간", basis === "m" ? "#60a5fa" : "#f87171", res.path, 0)];
    drawMap();
    for (var s = 1; s < res.path.length; s++) await moveRunners(620);
  }
  drawCards();

  drawProgress();
})();
