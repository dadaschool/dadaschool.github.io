/* =========================================================
   lesson1.js — 1차시 실험실 「문제를 컴퓨터의 말로」

   두 가지 실험이 들어 있다.
     ① 분리배출 구조화 — 초기 상태·목표 상태·수행 작업을 정하면
        그 순서 그대로 로봇이 실행한다. 잘못 정하면 잘못 움직인다.
        (문제를 정의하는 일이 곧 기계의 명령어를 쓰는 일임을 눈으로 보게 한다)
     ② 스마트워치 화면 디자이너 — 정보 12개 중 무엇을 남길지 고르고,
        글자를 픽토그램으로 바꿔 자리를 아낀다. 2초 테스트로 효과를 확인한다.

   저장하는 것 : 실험 결과(고른 상태·작업 순서·남긴 정보)를 sessionStorage 에 둔다.
                학습지에서 이어받아 옮겨 적기 쉽게 하려는 것이며 개인정보가 아니다.
                탭을 닫으면 사라진다.
   ========================================================= */
(function () {
  "use strict";

  var SAVE_KEY = "aa-lesson1";
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

  /* 성공했을 때 화면 가운데에 잠깐 뜨는 도장 */
  function stamp(emoji) {
    var s = el("div", "stamp", emoji);
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1200);
  }

  /* ---------------------------------------------------------
     0. 단계 이동 · 진행 게이지
     --------------------------------------------------------- */
  var sections = { s1: $("s1"), s2: $("s2") };
  document.querySelectorAll(".step-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var go = b.dataset.go;
      document.querySelectorAll(".step-btn").forEach(function (x) { x.classList.toggle("on", x === b); });
      Object.keys(sections).forEach(function (k) { sections[k].classList.toggle("hidden", k !== go); });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* 오늘 해내야 할 5가지 */
  function goals() {
    return [
      save.q1ok, save.q2ok, save.robotOk,
      save.designOk, (save.test12 != null && save.testMine != null)
    ];
  }
  function drawProgress() {
    var g = goals(), done = g.filter(Boolean).length;
    $("progFill").style.width = (done / g.length * 100) + "%";
    $("progText").textContent = done + " / " + g.length;
    document.querySelectorAll(".step-btn").forEach(function (b) {
      if (b.dataset.go === "s1") b.classList.toggle("done", !!(save.q1ok && save.q2ok && save.robotOk));
      if (b.dataset.go === "s2") b.classList.toggle("done", !!(save.designOk && save.test12 != null && save.testMine != null));
    });
  }

  /* =========================================================
     스테이지 1 — 분리배출 구조화
     ========================================================= */

  /* 보기 — 초기 상태 */
  var Q1 = [
    { t: "캔·종이·음식물이 뒤섞인 채 쓰레기통에 담겨 있다", ok: true },
    { t: "쓰레기를 종류별로 모두 나눈 상태이다", ok: false, why: "그건 우리가 <b>도착하고 싶은</b> 모습입니다. 시작이 아니라 목표 상태예요." },
    { t: "쓰레기가 하나도 없는 깨끗한 교실이다", ok: false, why: "쓰레기가 없으면 풀 문제 자체가 없습니다. 문제가 있는 <b>지금 모습</b>을 적어야 합니다." }
  ];
  /* 보기 — 목표 상태 */
  var Q2 = [
    { t: "캔·플라스틱·종이·유리·일반으로 분류가 끝난 상태이다", ok: true },
    { t: "쓰레기를 열심히 정리하는 중이다", ok: false, why: "‘하는 중’은 <b>끝난 모습</b>이 아닙니다. 목표 상태는 언제 멈춰야 하는지 알려 주는 기준이어야 합니다." },
    { t: "쓰레기통이 예쁜 색으로 칠해져 있다", ok: false, why: "예쁜 것과 <b>분리배출이 끝난 것</b>은 다른 이야기입니다. 문제와 상관없는 조건이에요." }
  ];

  /* 수행 작업 카드 — need 가 true 인 3장만 필요하고, 순서는 order 대로여야 한다 */
  var TASKS = [
    { id: "check", t: "재활용할 수 있는지 판별한다", em: "🔍", need: true, order: 1 },
    { id: "sort",  t: "종류별(캔·종이·유리…)로 나눈다", em: "🗂️", need: true, order: 2 },
    { id: "out",   t: "해당하는 통에 배출한다", em: "🚮", need: true, order: 3 },
    { id: "weigh", t: "쓰레기의 무게를 잰다", em: "⚖️", need: false },
    { id: "color", t: "색깔이 예쁜 것을 골라 둔다", em: "🎨", need: false }
  ];

  var plan = save.plan ? save.plan.slice() : [];

  /* ---------------------------------------------------------
     ①② 패널 접기

     맞히면 저절로 접는다. 접지 않으면 오른쪽 칸이 길어져서
     아래의 ③ 수행 작업과 «▶ 로봇 실행» 단추가 화면 밖으로 밀려
     로봇이 움직이는 것을 아예 못 보게 된다(실제로 그런 문제가 있었다).
     제목을 누르면 다시 펼쳐진다 — 고른 답을 확인하거나 바꾸고 싶을 때를 위해서다.
     --------------------------------------------------------- */
  function setFold(panel, folded) {
    panel.classList.toggle("folded", folded);
    var head = panel.querySelector(".foldhead");
    if (head) head.setAttribute("aria-expanded", folded ? "false" : "true");
  }

  function foldSummary(panel, list, idx) {
    var sum = panel.querySelector(".foldsum");
    if (!sum) return;
    sum.innerHTML = "✅ <b>" + "①②③".charAt(idx) + "</b> " + list[idx].t +
      '<span class="again">제목을 누르면 다시 고를 수 있어요</span>';
  }

  /* 제목을 눌러 여닫기 (키보드 Enter·Space 도 받는다) */
  document.querySelectorAll(".foldable .foldhead").forEach(function (head) {
    var panel = head.closest(".foldable");
    function toggle() { setFold(panel, !panel.classList.contains("folded")); }
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  function drawQ(host, list, savedKey, okKey) {
    var panel = host.closest(".foldable");
    host.innerHTML = "";
    list.forEach(function (o, i) {
      var b = el("button", "opt");
      b.type = "button";
      b.innerHTML = '<span class="tag">' + "①②③".charAt(i) + '</span><span>' + o.t + '</span>';
      if (save[savedKey] === i) b.classList.add(o.ok ? "right" : "wrong");
      b.addEventListener("click", function () {
        save[savedKey] = i;
        save[okKey] = o.ok;
        host.querySelectorAll(".opt").forEach(function (x) { x.classList.remove("right", "wrong"); });
        b.classList.add(o.ok ? "right" : "wrong");
        var old = host.parentNode.querySelector(".verdict");
        if (old) old.remove();
        var v = el("div", "verdict " + (o.ok ? "ok" : "no"));
        v.innerHTML = o.ok
          ? "<b>맞습니다 👍</b>" + (savedKey === "q1" ? "문제가 시작되는 지금 모습을 정확히 적었습니다." : "여기에 닿으면 멈춰도 된다 — 그 기준이 분명합니다.")
          : "<b>다시 생각해 볼까요</b>" + o.why;
        host.parentNode.appendChild(v);
        keep();

        if (o.ok) {
          stamp("✅");
          foldSummary(panel, list, i);
          /* 「맞습니다」를 읽을 틈을 주고 나서 접는다 */
          setTimeout(function () { setFold(panel, true); }, 900);
        } else {
          setFold(panel, false);      /* 틀렸으면 펼친 채로 두어 다시 고르게 한다 */
        }
      });
      host.appendChild(b);
    });

    /* 새로고침해도 맞힌 것은 접힌 채로 되살린다 */
    if (save[okKey] && save[savedKey] != null) {
      foldSummary(panel, list, save[savedKey]);
      setFold(panel, true);
    }
  }
  drawQ($("q1"), Q1, "q1", "q1ok");
  drawQ($("q2"), Q2, "q2", "q2ok");

  /* ---- 작업 카드 담기 ---- */
  function drawPool() {
    var pool = $("pool");
    pool.innerHTML = "";
    TASKS.forEach(function (t) {
      var used = plan.indexOf(t.id) >= 0;
      var b = el("button", "taskcard" + (used ? " used" : ""));
      b.type = "button";
      b.disabled = used;
      b.innerHTML = '<span class="em">' + t.em + '</span><span>' + t.t + '</span>';
      b.addEventListener("click", function () {
        plan.push(t.id);
        drawPool(); drawPlan();
      });
      pool.appendChild(b);
    });
  }

  function drawPlan() {
    var host = $("plan");
    host.innerHTML = "";
    $("planCount").textContent = plan.length + "개";
    /* 순서를 바꿀 때마다 저장한다 — 새로고침해도 짜 놓은 순서가 남는다 */
    save.plan = plan.slice();
    keep();
    if (!plan.length) {
      host.appendChild(el("li", "empty", "위에서 작업을 눌러 담으세요."));
      return;
    }
    plan.forEach(function (id, i) {
      var t = TASKS.filter(function (x) { return x.id === id; })[0];
      var li = el("li", "planitem");
      li.innerHTML =
        '<span class="pno">' + (i + 1) + '</span>' +
        '<span class="em">' + t.em + '</span>' +
        '<span class="ptxt">' + t.t + '</span>';
      var tools = el("span", "ptools");
      [["▲", "위로", -1], ["▼", "아래로", 1]].forEach(function (m) {
        var b = el("button", "tinybtn", m[0]);
        b.type = "button"; b.title = m[1];
        b.disabled = (m[2] < 0 && i === 0) || (m[2] > 0 && i === plan.length - 1);
        b.addEventListener("click", function () {
          var j = i + m[2];
          var tmp = plan[i]; plan[i] = plan[j]; plan[j] = tmp;
          drawPlan();
        });
        tools.appendChild(b);
      });
      var x = el("button", "tinybtn del", "✕");
      x.type = "button"; x.title = "빼기";
      x.addEventListener("click", function () { plan.splice(i, 1); drawPool(); drawPlan(); });
      tools.appendChild(x);
      li.appendChild(tools);
      host.appendChild(li);
    });
  }
  drawPool(); drawPlan();

  $("resetBin").addEventListener("click", function () {
    plan = [];
    drawPool(); drawPlan();
    $("binVerdict").innerHTML = "";
    $("binLog").innerHTML = '<p class="empty">아직 실행하지 않았습니다.</p>';
    resetScene();
  });

  /* ---------------------------------------------------------
     무대 그리기 — 쓰레기 8개와 통 4개
     --------------------------------------------------------- */
  var cv = $("binStage"), ctx = cv.getContext("2d");
  var W = cv.width, H = cv.height;

  var BINS = [
    { em: "♻️", name: "캔·플라스틱", kinds: ["can", "plastic"], x: 150 },
    { em: "📄", name: "종이",        kinds: ["paper"],          x: 370 },
    { em: "🍾", name: "유리",        kinds: ["glass"],          x: 590 },
    { em: "🗑️", name: "일반쓰레기",  kinds: ["trash"],          x: 800 }
  ];
  var BIN_Y = 430;

  var ITEM_DEF = [
    { em: "🥫", name: "캔",      kind: "can" },
    { em: "🧴", name: "페트병",  kind: "plastic" },
    { em: "🥤", name: "플라스틱컵", kind: "plastic" },
    { em: "📄", name: "종이",    kind: "paper" },
    { em: "📦", name: "상자",    kind: "paper" },
    { em: "🍾", name: "유리병",  kind: "glass" },
    { em: "🍎", name: "사과심",  kind: "trash" },
    { em: "🔋", name: "건전지",  kind: "trash" }
  ];

  var items = [];
  var binCount = [0, 0, 0, 0];
  var binDirty = [false, false, false, false];   // 잘못 들어온 것이 섞였는가

  function resetScene() {
    items = ITEM_DEF.map(function (d, i) {
      var col = i % 4, row = Math.floor(i / 4);
      var x = 300 + col * 78 + (row === 1 ? 38 : 0);
      var y = 120 + row * 74;
      return {
        em: d.em, name: d.name, kind: d.kind,
        x: x, y: y, tx: x, ty: y, home: { x: x, y: y },
        tag: null, gone: false, wobble: Math.random() * 6.28
      };
    });
    binCount = [0, 0, 0, 0];
    binDirty = [false, false, false, false];
    draw();
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

  function draw() {
    /* 배경 */
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b2545");
    g.addColorStop(1, "#12304f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 바닥 */
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.fillRect(0, BIN_Y + 96, W, H - BIN_Y - 96);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    /* 제목 */
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.font = "20px 'Malgun Gothic',sans-serif";
    ctx.fillText("우리 교실 쓰레기통", W / 2, 58);

    /* 통 */
    BINS.forEach(function (b, i) {
      var w = 168, h = 118, x = b.x - w / 2, y = BIN_Y;
      ctx.fillStyle = binDirty[i] ? "rgba(220,38,38,.28)" : "rgba(255,255,255,.09)";
      roundRect(ctx, x, y, w, h, 16);
      ctx.fill();
      ctx.strokeStyle = binDirty[i] ? "#f87171" : "rgba(255,255,255,.34)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "40px 'Segoe UI Emoji',sans-serif";
      ctx.fillText(b.em, b.x, y + 40);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 19px 'Malgun Gothic',sans-serif";
      ctx.fillText(b.name, b.x, y + 82);

      if (binCount[i] > 0) {
        ctx.fillStyle = binDirty[i] ? "#ef4444" : "#34d399";
        ctx.beginPath();
        ctx.arc(b.x + 66, y + 12, 20, 0, 6.284);
        ctx.fill();
        ctx.fillStyle = "#0b2545";
        ctx.font = "bold 20px 'Malgun Gothic',sans-serif";
        ctx.fillText(String(binCount[i]), b.x + 66, y + 13);
      }
    });

    /* 쓰레기 */
    items.forEach(function (it) {
      if (it.gone) return;
      ctx.font = "46px 'Segoe UI Emoji',sans-serif";
      ctx.fillText(it.em, it.x, it.y);
      ctx.fillStyle = "rgba(226,232,240,.8)";
      ctx.font = "15px 'Malgun Gothic',sans-serif";
      ctx.fillText(it.name, it.x, it.y + 34);

      if (it.tag) {
        var ok = it.tag === "ok";
        ctx.fillStyle = ok ? "#10b981" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(it.x + 24, it.y - 22, 15, 0, 6.284);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 17px 'Malgun Gothic',sans-serif";
        ctx.fillText(ok ? "♻" : "✕", it.x + 24, it.y - 21);
      }
    });
  }

  /* 아이템을 목표 위치까지 부드럽게 옮긴다 */
  function tween(ms) {
    return new Promise(function (done) {
      var start = null;
      var from = items.map(function (it) { return { x: it.x, y: it.y }; });
      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / ms);
        var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOutQuad
        items.forEach(function (it, i) {
          it.x = from[i].x + (it.tx - from[i].x) * e;
          it.y = from[i].y + (it.ty - from[i].y) * e;
        });
        draw();
        if (p < 1) requestAnimationFrame(frame); else done();
      }
      requestAnimationFrame(frame);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function tip(msg) { $("binTip").textContent = msg; }

  function logLine(em, text, kind) {
    var host = $("binLog");
    if (host.querySelector(".empty")) host.innerHTML = "";
    var row = el("div", "logrow " + (kind || ""));
    row.innerHTML = '<span class="lem">' + em + '</span><span>' + text + '</span>';
    host.appendChild(row);
  }

  /* ---------------------------------------------------------
     로봇 실행 — 학생이 정한 순서 그대로 수행한다
     --------------------------------------------------------- */
  var running = false;

  $("runBin").addEventListener("click", async function () {
    if (running) return;
    if (!plan.length) {
      PdfKit.toast("먼저 수행 작업을 골라 담아 주세요.", "warn");
      return;
    }
    running = true;
    $("runBin").disabled = true;
    $("binVerdict").innerHTML = "";
    $("binLog").innerHTML = "";
    resetScene();

    /* ⚠ 무대를 화면 가운데로 끌어온다.
       오른쪽 칸(①②③)이 길어서 ▶ 단추는 페이지 한참 아래에 있다. 거기까지 스크롤하면
       왼쪽 캔버스가 화면 위로 밀려나 **로봇이 움직이는 것을 못 본다.**
       ①② 를 접어도 300px 남짓만 줄어들어 근본적으로 해결되지 않는다.
       그래서 실행하는 순간 무대로 데려간다. */
    $("binStage").scrollIntoView({ behavior: "smooth", block: "center" });
    await wait(420);          /* 스크롤이 끝난 뒤 움직이기 시작해야 첫 장면을 놓치지 않는다 */

    var didCheck = false, didSort = false, problems = [];

    for (var i = 0; i < plan.length; i++) {
      var id = plan[i];

      if (id === "check") {
        tip("🔍 재활용할 수 있는지 판별하는 중…");
        logLine("🔍", "재활용 여부를 판별했습니다.");
        for (var k = 0; k < items.length; k++) {
          items[k].tag = items[k].kind === "trash" ? "no" : "ok";
          draw();
          await wait(90);
        }
        didCheck = true;
        await wait(350);

      } else if (id === "sort") {
        tip("🗂️ 종류별로 나누는 중…");
        if (!didCheck) {
          logLine("⚠️", "무엇이 재활용인지 <b>모르는 채로</b> 나눕니다. 로봇은 겉모습만 보고 줄을 세웠습니다.", "warn");
          problems.push("판별을 하기 전에 나누어서, 재활용이 아닌 것까지 재활용 줄에 섞였습니다.");
        } else {
          logLine("🗂️", "종류별로 줄을 세웠습니다.");
        }
        /* 종류별로 통 위에 줄 세우기 */
        var lane = [0, 0, 0, 0];
        items.forEach(function (it) {
          var bi = didCheck ? binIndexOf(it.kind) : binIndexOf(it.kind === "trash" ? "can" : it.kind);
          it.tx = BINS[bi].x - 46 + (lane[bi] % 3) * 46;
          it.ty = 300 + Math.floor(lane[bi] / 3) * 56;
          lane[bi]++;
        });
        await tween(750);
        didSort = true;
        await wait(300);

      } else if (id === "out") {
        tip("🚮 통에 배출하는 중…");
        if (!didSort) {
          logLine("⚠️", "나누지 않은 채 <b>한 통에 몰아서</b> 버립니다.", "warn");
          problems.push("종류별로 나누기 전에 버려서, 모든 쓰레기가 한 통에 뒤섞였습니다.");
        }
        if (!didCheck) {
          problems.push("판별하지 않고 버려서, 사과심·건전지 같은 <b>일반쓰레기가 재활용통</b>에 들어갔습니다.");
        }
        for (var m = 0; m < items.length; m++) {
          var it = items[m];
          var bi;
          if (!didSort) bi = 0;                               // 나누지 않았으면 전부 첫 통
          else if (!didCheck) bi = binIndexOf(it.kind === "trash" ? "can" : it.kind);
          else bi = binIndexOf(it.kind);
          it.tx = BINS[bi].x;
          it.ty = BIN_Y + 20;
          await tween(220);
          it.gone = true;
          binCount[bi]++;
          if (BINS[bi].kinds.indexOf(it.kind) < 0) binDirty[bi] = true;
          draw();
        }
        logLine("🚮", "배출을 마쳤습니다.");
        await wait(350);

      } else {
        /* 필요 없는 작업 */
        var t = TASKS.filter(function (x) { return x.id === id; })[0];
        tip(t.em + " " + t.t + " …?");
        logLine(t.em, "“" + t.t + "”를 수행했습니다. <b>목표 상태와 아무 상관이 없습니다.</b>", "warn");
        problems.push("“" + t.t + "”는 목표 상태에 다가가지 못하는 <b>불필요한 작업</b>입니다.");
        await wait(700);
      }
    }

    /* 빠뜨린 작업 확인 */
    if (plan.indexOf("check") < 0) problems.push("<b>판별</b>을 아예 하지 않았습니다. 무엇이 재활용인지 모르면 자동화할 수 없습니다.");
    if (plan.indexOf("sort") < 0) problems.push("<b>분류</b>를 하지 않았습니다. 목표 상태는 ‘종류별로 나뉜 상태’입니다.");
    if (plan.indexOf("out") < 0) problems.push("<b>배출</b>을 하지 않았습니다. 정리만 하고 끝내면 목표 상태에 닿지 못합니다.");

    var perfect = problems.length === 0 &&
      plan.length === 3 && plan[0] === "check" && plan[1] === "sort" && plan[2] === "out";

    var v = el("div", "verdict " + (perfect ? "ok" : "no"));
    if (perfect) {
      v.innerHTML = "<b>완벽합니다! 🎉</b>모든 쓰레기가 제 통에 들어갔습니다. " +
        "여러분이 정한 <b>판별 → 분류 → 배출</b> 순서가 곧 로봇의 명령어가 되었습니다.";
      tip("🎉 목표 상태 도달! 분류가 끝났습니다.");
      stamp("🎉");
      save.robotOk = true;
      $("binSoWhat").hidden = false;
    } else {
      v.innerHTML = "<b>목표 상태에 닿지 못했습니다</b><ul style='margin:8px 0 0;padding-left:22px'>" +
        problems.map(function (p) { return "<li>" + p + "</li>"; }).join("") +
        "</ul><p style='margin:10px 0 0'>순서를 고쳐서 다시 실행해 보세요.</p>";
      tip("실패했습니다. 실행 기록을 보고 순서를 고쳐 보세요.");
      save.robotOk = false;
    }
    $("binVerdict").appendChild(v);

    save.plan = plan.slice();
    save.planText = plan.map(function (id) {
      return TASKS.filter(function (x) { return x.id === id; })[0].t;
    });
    keep();

    running = false;
    $("runBin").disabled = false;
  });

  function binIndexOf(kind) {
    for (var i = 0; i < BINS.length; i++) if (BINS[i].kinds.indexOf(kind) >= 0) return i;
    return 3;
  }

  resetScene();

  /* =========================================================
     스테이지 2 — 스마트워치 화면 디자이너
     ========================================================= */

  var INFO = [
    { id: "temp",  name: "기온",       picto: "🌡️", text: "기온 23℃",              key: true },
    { id: "sky",   name: "하늘 상태",  picto: "🌧️", text: "비 (시간당 5mm)",        key: true },
    { id: "rainp", name: "강수 확률",  picto: "☔",  text: "강수확률 80%",           key: true },
    { id: "feels", name: "체감온도",   picto: "🥶",  text: "체감온도 21℃" },
    { id: "hum",   name: "습도",       picto: "💧",  text: "습도 65%" },
    { id: "wdir",  name: "풍향",       picto: "🧭",  text: "북서풍" },
    { id: "wspd",  name: "풍속",       picto: "🌬️", text: "풍속 3.2m/s" },
    { id: "dust",  name: "미세먼지",   picto: "😷",  text: "미세먼지 나쁨" },
    { id: "uv",    name: "자외선",     picto: "🕶️", text: "자외선 보통" },
    { id: "sun",   name: "일출 시각",  picto: "🌅",  text: "일출 06:12" },
    { id: "pres",  name: "기압",       picto: "📊",  text: "1013hPa" },
    { id: "desc",  name: "상세 설명",  picto: "📝",  text: "오후부터 비가 내리겠으며 밤에 그치겠습니다" }
  ];
  var CAP = 6;                                   // 화면이 담을 수 있는 칸 수

  var chosen = save.chosen ? save.chosen.slice() : [];        // [{id, picto:true/false}]
  function infoOf(id) { return INFO.filter(function (x) { return x.id === id; })[0]; }
  function usedCells() {
    return chosen.reduce(function (a, c) { return a + (c.picto ? 1 : 2); }, 0);
  }

  function drawInfoList() {
    var host = $("infoList");
    host.innerHTML = "";
    INFO.forEach(function (o) {
      var on = chosen.some(function (c) { return c.id === o.id; });
      var b = el("button", "infocard" + (on ? " on" : ""));
      b.type = "button";
      b.innerHTML = '<span class="em">' + o.picto + '</span>' +
        '<span class="nm">' + o.name + '</span>' +
        '<span class="tx">' + o.text + '</span>' +
        '<span class="pick">' + (on ? "올림" : "＋") + '</span>';
      b.addEventListener("click", function () {
        if (on) chosen = chosen.filter(function (c) { return c.id !== o.id; });
        else chosen.push({ id: o.id, picto: false });
        renderWatch();
      });
      host.appendChild(b);
    });
  }

  function drawChosen() {
    var host = $("chosenList");
    host.innerHTML = "";
    if (!chosen.length) {
      host.appendChild(el("p", "empty", "아직 올린 정보가 없습니다."));
      return;
    }
    chosen.forEach(function (c, i) {
      var o = infoOf(c.id);
      var row = el("div", "chosenrow");
      row.innerHTML = '<span class="em">' + (c.picto ? o.picto : "🔤") + '</span><span class="nm">' + o.name + '</span>';
      var tog = el("button", "tog" + (c.picto ? " on" : ""));
      tog.type = "button";
      tog.textContent = c.picto ? "픽토그램 (1칸)" : "글자 (2칸)";
      tog.title = "글자 ↔ 픽토그램 바꾸기";
      tog.addEventListener("click", function () { chosen[i].picto = !chosen[i].picto; renderWatch(); });
      row.appendChild(tog);
      var x = el("button", "tinybtn del", "✕");
      x.type = "button"; x.title = "내리기";
      x.addEventListener("click", function () { chosen.splice(i, 1); renderWatch(); });
      row.appendChild(x);
      host.appendChild(row);
    });
  }

  function drawWatchScreen(host, list, small) {
    host.innerHTML = "";
    if (!list.length) {
      host.appendChild(el("p", "watch-empty", "왼쪽에서 정보를 골라 보세요"));
      return;
    }
    var used = 0;
    list.forEach(function (c) {
      var o = infoOf(c.id);
      var cells = c.picto ? 1 : 2;
      var over = used + cells > CAP;              // 화면 밖으로 밀려난 것
      used += cells;
      var d = el("div", "wtile" + (c.picto ? " picto" : " word") + (over ? " over" : ""));
      d.innerHTML = c.picto
        ? '<span class="wem">' + o.picto + '</span>' + (o.id === "temp" ? '<span class="wnum">23°</span>' : "")
        : '<span class="wtx">' + o.text + '</span>';
      host.appendChild(d);
    });
    if (used > CAP && !small) {
      host.appendChild(el("div", "wcut", "⛔ 여기부터 화면 밖 — 보이지 않습니다"));
    }
  }

  function renderWatch() {
    drawInfoList();
    drawChosen();
    drawWatchScreen($("watchScreen"), chosen);

    var used = usedCells();
    $("capFill").style.width = Math.min(100, used / CAP * 100) + "%";
    $("capFill").classList.toggle("over", used > CAP);
    $("capText").textContent = "화면 " + used + " / " + CAP + "칸" + (used > CAP ? " — 넘쳤어요!" : "");

    /* 디자인 점검 */
    var host = $("designCheck");
    host.innerHTML = "";
    var keys = ["temp", "sky", "rainp"];
    var hasKeys = keys.filter(function (k) { return chosen.some(function (c) { return c.id === k; }); });
    var pictoN = chosen.filter(function (c) { return c.picto; }).length;

    var checks = [
      { ok: hasKeys.length === 3, t: "비 오는 날 꼭 필요한 정보 3가지(하늘 상태·기온·강수 확률)를 남겼다", now: hasKeys.length + " / 3" },
      { ok: used <= CAP, t: "화면 밖으로 넘치지 않는다", now: used + " / " + CAP + "칸" },
      { ok: pictoN >= 2, t: "글자를 픽토그램으로 2개 이상 바꾸었다", now: pictoN + "개" }
    ];
    checks.forEach(function (c) {
      var row = el("div", "checkrow " + (c.ok ? "ok" : "no"));
      row.innerHTML = '<span class="ci">' + (c.ok ? "✅" : "⬜") + '</span><span>' + c.t + '</span><b>' + c.now + '</b>';
      host.appendChild(row);
    });

    var allOk = checks.every(function (c) { return c.ok; });
    if (allOk && !save.designOk) { stamp("⌚"); }
    if (allOk) {
      host.appendChild(el("div", "verdict ok",
        "<b>훌륭한 추상화입니다 👏</b>정보를 <b>지운 것</b>이 아니라, 이동 중인 사람에게 <b>필요한 것만 남긴</b> 것입니다."));
      $("pictoSoWhat").hidden = false;
    }
    save.designOk = allOk;
    save.chosen = chosen.slice();
    save.kept = chosen.map(function (c) { return infoOf(c.id).name + (c.picto ? "(픽토그램)" : ""); });
    save.removed = INFO.filter(function (o) {
      return !chosen.some(function (c) { return c.id === o.id; });
    }).map(function (o) { return o.name; });
    keep();
  }
  renderWatch();

  /* ---------------------------------------------------------
     2초 테스트 — 화면을 2초만 보여 주고 세 가지를 묻는다
     --------------------------------------------------------- */
  var QUIZ = [
    { q: "지금 비가 오고 있나요?", opts: ["비가 온다", "맑다", "눈이 온다"], a: 0 },
    { q: "기온은 몇 도였나요?",     opts: ["18℃", "21℃", "23℃", "27℃"],   a: 2 },
    { q: "우산을 챙겨야 할까요?",   opts: ["챙긴다", "안 챙겨도 된다"],      a: 0 }
  ];

  function flash(list, small) {
    return new Promise(function (done) {
      var back = $("flashBack"), view = $("flashView"), count = $("flashCount");
      back.classList.remove("hidden");
      view.className = "flash-view" + (small ? " watch-mode" : " full-mode");
      view.innerHTML = "";
      var n = 3;
      count.textContent = n;
      count.hidden = false;
      var t = setInterval(function () {
        n--;
        if (n > 0) { count.textContent = n; return; }
        clearInterval(t);
        count.hidden = true;
        if (small) drawWatchScreen(view, chosen, true);
        else {
          INFO.forEach(function (o) {
            view.appendChild(el("div", "ftile", '<b>' + o.name + '</b><span>' + o.text + '</span>'));
          });
        }
        setTimeout(function () {
          back.classList.add("hidden");
          done();
        }, 2000);
      }, 700);
    });
  }

  function askQuiz(label, whichKey) {
    var host = $("testResult");
    host.innerHTML = "";
    var box = el("div", "quizbox");
    box.appendChild(el("p", "quizhead", "🧐 " + label + " — 방금 본 화면을 떠올려 답해 보세요."));
    var answers = [];
    QUIZ.forEach(function (Q, qi) {
      var wrap = el("div", "quizq");
      wrap.appendChild(el("p", "quizq-t", (qi + 1) + ". " + Q.q));
      var row = el("div", "chips");
      Q.opts.forEach(function (o, oi) {
        var b = el("button", "chip", o);
        b.type = "button";
        b.addEventListener("click", function () {
          answers[qi] = oi;
          row.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
          if (answers.filter(function (a) { return a != null; }).length === QUIZ.length) grade();
        });
        row.appendChild(b);
      });
      wrap.appendChild(row);
      box.appendChild(wrap);
    });
    host.appendChild(box);

    function grade() {
      var score = 0;
      QUIZ.forEach(function (Q, i) { if (answers[i] === Q.a) score++; });
      save[whichKey] = score;
      keep();
      var v = el("div", "verdict " + (score === 3 ? "ok" : "info"));
      v.innerHTML = "<b>" + label + " : 3문제 중 " + score + "개 정답</b>" +
        (score === 3 ? "2초 만에 다 읽었습니다." : "2초로는 다 읽기 어려웠지요?");
      box.appendChild(v);
      showCompare();
    }
  }

  function showCompare() {
    if (save.test12 == null || save.testMine == null) return;
    var host = $("testResult");
    var c = el("div", "compare");
    c.innerHTML =
      '<p class="minihead">두 화면을 나란히 놓고 보면</p>' +
      barRow("📋 원본 12개 화면", save.test12) +
      barRow("⌚ 내가 만든 화면", save.testMine) +
      '<div class="verdict ' + (save.testMine >= save.test12 ? "ok" : "info") + '">' +
        (save.testMine > save.test12
          ? "<b>추상화가 이겼습니다 🏆</b>정보를 <b>덜</b> 보여 줬는데 <b>더</b> 정확히 읽혔습니다. 이것이 추상화가 하는 일입니다."
          : save.testMine === save.test12
            ? "<b>같은 점수네요</b>그렇다면 <b>같은 답을 더 작은 화면으로</b> 얻은 셈입니다. 손목시계에는 그쪽이 낫습니다."
            : "<b>어라, 원본이 더 높네요</b>혹시 <b>꼭 필요한 정보</b>를 지우지는 않았나요? 추상화는 아무거나 지우는 것이 아닙니다.") +
      '</div>';
    host.appendChild(c);
  }
  function barRow(label, score) {
    return '<div class="cmp-row"><span class="cmp-n">' + label + '</span>' +
      '<span class="cmp-track"><span class="cmp-fill" style="width:' + (score / 3 * 100) + '%"></span></span>' +
      '<b>' + score + '/3</b></div>';
  }

  $("test12").addEventListener("click", async function () {
    await flash(null, false);
    askQuiz("원본 12개 화면", "test12");
  });
  $("testMine").addEventListener("click", async function () {
    if (!chosen.length) { PdfKit.toast("먼저 시계 화면에 정보를 올려 주세요.", "warn"); return; }
    await flash(chosen, true);
    askQuiz("내가 만든 화면", "testMine");
  });

  drawProgress();
})();
