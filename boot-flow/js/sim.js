/* =========================================================
   sim.js — 시뮬레이터 화면 (boot-flow)
   ---------------------------------------------------------
   js/pc.js(엔진)가 돌려준 «걸음(hop)» 목록을 받아
     · 오른쪽 «컴퓨터 내부» 그림 위로 데이터 꾸러미를 움직이고
     · 걸음이 끝날 때마다 가운데 «사용자 화면» 을 그 걸음의 모습으로 바꾼다.

   ⚠ requestAnimationFrame 을 쓰지 않는다 — 이 개발 환경의 미리보기 창은
     프레임을 그리지 않아 rAF 가 돌지 않는다(루트 CLAUDE.md). setInterval 로 움직인다.
   ⚠ 화면은 «걸음의 view» 만 보고 그린다. 엔진 상태(pc.state())를 직접 읽어
     그리면 데이터가 도착하기도 전에 화면이 먼저 바뀌어 «출력» 이 거짓말이 된다.
   ========================================================= */
(function () {
  "use strict";

  var PC = window.PC;
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------
     그림 재료
     --------------------------------------------------------- */
  var STAGE = { "입력": "#2563eb", "처리": "#d97706", "저장": "#059669", "출력": "#7c3aed" };
  var STAGE_ORDER = ["입력", "처리", "저장", "출력"];
  var LAYERS = [["user", "👤 사용자"], ["app", "응용 소프트웨어"], ["os", "운영체제"], ["hw", "하드웨어"]];

  /* 그림판 (viewBox 1100 × 600) — 진짜 메인보드처럼
     가운데 검은 기판(x 200~900)이 메인보드, 왼쪽 바깥이 입력 장치(키보드·마우스·USB),
     오른쪽 바깥이 출력 장치(모니터·스피커)와 전원 공급 장치다.
     BOX 는 부품 하나가 차지하는 자리(빛나기·✗·«고장» 표시에 쓴다),
     FOCUS 는 «그 자리에서 일하는» 걸음의 꾸러미가 머무는 곳이다. */
  var BOX = {
    KBD:   { x: 10,  y: 22,  w: 156, h: 120 },
    MOUSE: { x: 10,  y: 150, w: 156, h: 134 },
    USB:   { x: 10,  y: 290, w: 156, h: 170 },
    ROM:   { x: 262, y: 250, w: 110, h: 112 },
    CPU:   { x: 405, y: 40,  w: 210, h: 258 },
    RAM:   { x: 632, y: 22,  w: 232, h: 322 },
    SSD:   { x: 262, y: 390, w: 390, h: 190 },
    MON:   { x: 925, y: 15,  w: 170, h: 190 },
    SPK:   { x: 925, y: 205, w: 170, h: 178 },
    PSU:   { x: 925, y: 395, w: 170, h: 175 }
  };
  var FOCUS = {
    KBD: [88, 61], MOUSE: [90, 195], USB: [90, 370], ROM: [315, 286], CPU: [510, 140],
    RAM: [670, 190], SSD: [420, 420], MON: [1010, 75], SPK: [1005, 258], PSU: [1010, 457]
  };
  /* 기판 위의 길(버스) — 꺾인 금색 선. 앞쪽 부품 → 뒤쪽 부품 순서로 적었다.
     반대로 가는 걸음은 이 점들을 거꾸로 따라간다.
     ⚠ 점을 옮기면 글자·부품과 겹치지 않는지 다시 잴 것(CLAUDE.md 의 재는 법). */
  var TRACE = {
    "KBD>CPU":   [[150, 62], [219, 75], [420, 75]],
    "MOUSE>CPU": [[118, 195], [219, 200], [300, 200], [300, 125], [420, 125]],
    "USB>CPU":   [[150, 372], [219, 338], [250, 338], [250, 374], [382, 374], [382, 175], [420, 175]],   /* 롬 이름표 아래로 돌아간다 */
    "ROM>CPU":   [[345, 288], [400, 288], [400, 215], [420, 215]],
    "PSU>CPU":   [[945, 465], [885, 465], [835, 465], [835, 385], [575, 385], [575, 232]],
    "CPU>RAM":   [[600, 160], [670, 160]],
    "CPU>SSD":   [[470, 232], [470, 400]],
    "RAM>SSD":   [[670, 334], [670, 420], [560, 420]],
    "CPU>MON":   [[600, 215], [620, 215], [620, 350], [848, 350], [848, 150], [890, 150], [945, 120]],
    "CPU>SPK":   [[600, 62], [625, 62], [625, 20], [868, 20], [868, 250], [890, 250], [975, 258]]
  };
  function hasEdge(a, b) { return !!(TRACE[a + ">" + b] || TRACE[b + ">" + a]); }
  function center(id) { return { x: FOCUS[id][0], y: FOCUS[id][1] }; }
  /* 바로 잇는 길이 없으면 CPU 를 거쳐 간다 (예 : USB → RAM) */
  function route(path) {
    var out = [path[0]];
    for (var i = 1; i < path.length; i++) {
      var a = out[out.length - 1], b = path[i];
      if (a !== b && !hasEdge(a, b) && a !== "CPU" && b !== "CPU") out.push("CPU");
      out.push(b);
    }
    return out;
  }
  /* 부품 이름 목록 → 실제로 지나가는 점들 */
  function routePoints(r) {
    if (r.length === 1) return [FOCUS[r[0]].slice()];
    var out = [];
    for (var i = 0; i + 1 < r.length; i++) {
      var a = r[i], b = r[i + 1], seg;
      if (TRACE[a + ">" + b]) seg = TRACE[a + ">" + b].slice();
      else if (TRACE[b + ">" + a]) seg = TRACE[b + ">" + a].slice().reverse();
      else seg = [FOCUS[a], FOCUS[b]];
      out = out.concat(out.length ? seg.slice(1) : seg);
    }
    return out;
  }

  /* ---------------------------------------------------------
     상태
     --------------------------------------------------------- */
  var pcMain = PC.create(), pcLab = PC.create();
  var pc = pcMain;
  var tab = 1;
  var view = pc.snapshot();
  var queue = [], cur = null, curT = 0, timer = null;
  var paused = false, speed = "normal", lastHops = [];
  var failIds = {}, activeIds = [], activeColor = null;
  var speakerText = "", speakerUntil = 0, lastPrinted = "";
  var seenMain = {}, seenLab = {};
  var cpuIdx = 0;
  var mission = "ui";
  var lab = { mode: "explore", fault: null, quiz: null, prev: null, asked: 0, right: 0, answer: null, showWhy: false };

  function seen() { return tab === 3 ? seenLab : seenMain; }

  /* =========================================================
     행동 → 무대 위의 흐름
     ---------------------------------------------------------
     사용자 지시(2026-10-16) — *"사용자 화면에서 조작하면 컴퓨터 화면으로 바뀌면서 어떤 일을 하는지 보여주고,
     일을 다하고나면 다시 사용자 화면이 보이게"* · *"어떤 작업 중인지 설명이 나오고난 뒤에 데이터가 흘러가도록"*
     그래서 행동 하나는 이렇게 흘러간다 :
       ① 여는 카드(intro) — 컴퓨터 내부로 바뀌며 «무슨 일을, 몇 걸음으로» 를 먼저 말한다
       ② 걸음마다 — [설명 읽기] 설명과 지나갈 길·부품이 먼저 빛나고 «출발까지» 막대가 찬다
                    → [이동] 그다음에 데이터 꾸러미가 길을 따라 움직인다
       ③ 닫는 카드(outro) — «다 됐어요» 뒤 사용자 화면으로 돌아가 결과를 보여 준다
     줄(queue)에는 걸음(hop)과 카드({kind:'intro'|'outro'})가 섞여 들어간다.
     ========================================================= */
  var SPD = {
    slow:   { intro: 2600, read: 1.6, move: 2000, outro: 1500 },
    normal: { intro: 1800, read: 1.0, move: 1300, outro: 1000 },
    fast:   { intro: 700,  read: 0.4, move: 550,  outro: 400 }
  };
  var watch = true;          // 조작할 때마다 컴퓨터 안 보여 주기
  var phase = "read";        // 걸음 안의 단계 : read(설명 읽기) → move(이동)
  var lastTitle = "";

  /* 설명 글이 길수록 읽을 시간을 더 준다 */
  function readTime(h) { return Math.min(5200, 900 + String(h.msg || "").length * 30) * SPD[speed].read; }

  function phaseDur() {
    var S = SPD[speed];
    if (cur.kind === "intro") return S.intro;
    if (cur.kind === "outro") return S.outro;
    if (phase === "read") return readTime(cur);
    return cur.route.length > 1 ? S.move : S.move * 0.7;
  }

  var KEYWORD = { "←": "← 방향키", "→": "→ 방향키", " ": "스페이스 바", "⌫": "지우기", "⏎": "Enter" };
  /* 행동에 붙일 이름 — 여는 카드와 «방금 한 일» 에 쓴다 */
  function titleOf(name, a, hops) {
    var A = PC.APPS, st = pc.state();
    switch (name) {
      case "power":
        if (hops[0].boot) return "⏻ 전원 켜기 — 부팅";
        if (hops.some(function (h) { return h.shut; })) return "⏻ 시스템 종료";
        if (st.dialog) return "⏻ 종료 — 저장할지 묻기";
        return "⏻ 전원 끄기";
      case "key":
        return (a[1] === "MOUSE" ? "🖱 화상 키보드 " : "⌨ ") + (KEYWORD[a[0]] || "‘" + a[0] + "’ 키") + " 누르기";
      case "open": return A[a[0]].icon + " " + A[a[0]].name + " 실행 — " + ({ cui: "명령어로", nui: "터치로" }[a[1]] || "아이콘으로");
      case "close": return "✕ " + A[a[0]].name + " 닫기";
      case "save": return "💾 메모장 글 저장";
      case "print": return "🖨 메모장 글 인쇄";
      case "dialog": return { save: "💾 저장하고 계속", discard: "저장 안 하고 계속", cancel: "취소" }[a[0]] || "확인 창";
      case "device":
        var nm = a[0] === "usb" ? "USB 메모리" : "프린터";
        return st[a[0]] ? "🔌 " + nm + " 연결" : "⏏ " + nm + " 빼기";
      case "file":
        return { search: "🔍 글 파일 찾기", open: "📂 「" + a[1] + "」 열기", copy: "📄 「" + a[1] + "」 복사",
                 "delete": "🗑 「" + a[1] + "」 삭제" }[a[0]] || "📁 파일";
      case "focus": return "🖱 " + A[a[0]].name + " 창으로 바꾸기";
      case "lock": return "🔒 화면 잠금";
      case "osk": return "⌨ 화상 키보드";
      case "mode": return "화면 방식 바꾸기 — " + String(a[0]).toUpperCase();
    }
    return name;
  }

  function act(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    var hops = pc[name].apply(null, args);
    if (!hops || !hops.length) return;
    var title = titleOf(name, args, hops);
    hops.forEach(function (h, i) { h._i = i + 1; h._n = hops.length; h._title = title; });
    lastHops = hops.slice(); lastTitle = title;
    setLast();
    if (!watch) {                       // 안을 보여 주지 않기 — 결과만 곧바로
      skipAll();
      finishAll(hops);
      return;
    }
    if (!cur && !queue.length) failIds = {};
    queue.push({ kind: "intro", title: title, n: hops.length, hops: hops });
    queue = queue.concat(hops);
    queue.push({ kind: "outro", title: title });
    kick();
    updateCtl();
  }

  function kick() { if (!timer) timer = setInterval(tick, 40); }

  function tick() {
    if (paused) return;
    if (!cur) {
      if (!queue.length) { clearInterval(timer); timer = null; endFlow(); return; }
      begin(queue.shift());
    }
    curT += 40 / phaseDur();
    var bar = $("capBar");
    if (cur.kind === "intro" || cur.kind === "outro") {
      if (bar) bar.style.width = Math.min(100, curT * 100) + "%";
      if (curT >= 1) {
        var wasOutro = cur.kind === "outro";
        cur = null;
        if (wasOutro && !queue.length) setMode("user");
        updateCtl();
      }
      return;
    }
    if (phase === "read") {                       // 설명을 읽는 동안 — 꾸러미는 출발점에서 기다린다
      if (bar) bar.style.width = Math.min(100, curT * 100) + "%";
      if (curT >= 1) { phase = "move"; curT = 0; if (bar) bar.style.width = "100%"; }
      return;
    }
    if (curT >= 1) { finishHop(cur); cur = null; updateCtl(); return; }
    movePacket(cur, curT);
  }

  function begin(item) {
    cur = item; curT = 0;
    if (item.kind === "intro") {
      setMode("inside");
      activeIds = []; activeColor = null; hidePacket(); renderBoard(); lightChips(null);
      $("capAct").textContent = item.title;
      $("capStep").textContent = "모두 " + item.n + "걸음";
      $("nowMsg").innerHTML = "🔍 컴퓨터 안에서는 무슨 일이 일어날까요? 이 일은 <b>" + item.n + "걸음</b>으로 이루어집니다.";
      $("nowWhere").innerHTML = item.hops.slice(0, 7).map(function (h, i) {
        return "<span class='bf-tag' style='background:" + (STAGE[h.stage] || "#64748b") + "'>" + (i + 1) + " " + esc(h.data || "") + "</span>";
      }).join(" ") + (item.n > 7 ? " …" : "");
      return;
    }
    if (item.kind === "outro") {
      activeIds = []; activeColor = null; hidePacket(); renderBoard(); lightChips(null);
      $("capStep").textContent = "끝";
      $("nowMsg").innerHTML = queue.length ? "✅ 다 됐어요! 이어서 다음 일을 봅니다."
                                           : "✅ 다 됐어요! 사용자 화면으로 돌아가 결과를 확인해 보세요.";
      $("nowWhere").textContent = "";
      return;
    }
    /* 걸음 — 먼저 설명, 그다음 이동 */
    item.route = route(item.path);
    phase = "read";
    activeIds = item.route.slice();
    activeColor = STAGE[item.stage] || "#64748b";
    renderBoard();
    showNow(item);
    if (item.boot || item.shut) renderGuide();
    movePacket(item, 0);                          // 출발점에 꾸러미를 세워 둔다
  }

  function failPart(h) { return h.failAt || h.route[h.route.length - 1]; }

  function finishHop(h) {
    if (h.fail) failIds[failPart(h)] = true;
    applyView(h.view);
    handleEvents(h.ev);
  }

  function endFlow() {
    activeIds = []; activeColor = null;
    hidePacket();
    renderBoard();
    lightChips(null);
    renderGuide();
    updateCtl();
  }

  /* 걸음 목록을 애니메이션 없이 한꺼번에 끝낸다 (소리·인쇄도 잃지 않게) */
  function finishAll(list) {
    var hops = list.filter(function (h) { return !h.kind; });
    if (!hops.length) return;
    var sound = null, printed = null;
    hops.forEach(function (h) {
      h.route = h.route || route(h.path);
      if (h.fail) failIds[failPart(h)] = true;
      if (h.view.sound) sound = h.view.sound;
      if (h.view.printed) printed = h.view.printed;
      handleEvents(h.ev);
    });
    var last = hops[hops.length - 1];
    var v = {}; for (var k in last.view) v[k] = last.view[k];
    if (sound) v.sound = sound;
    if (printed) v.printed = printed;
    applyView(v);
    showNow(last);
  }

  /* 남은 것을 모두 끝내고 사용자 화면으로 */
  function skipAll() {
    var list = (cur ? [cur] : []).concat(queue);
    queue = []; cur = null;
    if (timer) { clearInterval(timer); timer = null; }
    if (!list.length) return;
    finishAll(list);
    endFlow();
    setMode("user");
  }

  function replay() {
    if (cur || queue.length || !lastHops.length) return;
    failIds = {};
    var copies = lastHops.map(function (h) { var c = {}; for (var k in h) if (k !== "_pts") c[k] = h[k]; return c; });
    queue = [{ kind: "intro", title: lastTitle + " (다시 보기)", n: copies.length, hops: copies }]
      .concat(copies, [{ kind: "outro", title: lastTitle }]);
    kick();
    updateCtl();
  }

  function applyView(v) {
    view = v;
    if (v.sound) { speakerText = v.sound; speakerUntil = Date.now() + 3000; }
    if (v.printed) lastPrinted = v.printed;
    renderBoard();
    renderScreen();
    renderButtons();
  }

  function handleEvents(evs) {
    if (!evs) return;
    var S = seen();
    evs.forEach(function (e) {
      S[e.ev] = true;
      if (e.app) S[e.ev + ":" + e.app] = true;
      if (e.via) S[e.ev + "@" + e.via] = true;
    });
    renderGuide();
  }

  /* ---------- 무대 : 사용자 화면 ↔ 컴퓨터 내부 ---------- */
  function setMode(m) {
    var st = $("stage"), same = st.getAttribute("data-mode") === m;
    Array.prototype.forEach.call($("views").children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === m);
    });
    if (same) return;
    st.setAttribute("data-mode", m);
    if (m === "inside") renderBoard();
  }
  $("views").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-view]") : null;
    if (t) setMode(t.getAttribute("data-view"));
  });
  $("watch").addEventListener("change", function () { watch = this.checked; });

  /* 사용자 화면 아래 «방금 한 일» 줄 */
  function setLast() {
    var bar = $("lastBar");
    if (!lastHops.length) {
      bar.innerHTML = "<span>👉 위 화면을 직접 눌러 보세요. 누를 때마다 <b>컴퓨터 안</b>으로 들어가 무슨 일이 일어나는지 보여 줍니다.</span>";
      return;
    }
    bar.innerHTML = "<span>방금 한 일 : <b>" + esc(lastTitle) + "</b> · 컴퓨터 안에서 " + lastHops.length + "걸음</span>" +
      "<button type='button' class='btn' id='btnReplay'>🔍 컴퓨터 안 다시 보기</button>";
  }
  $("lastBar").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("#btnReplay") : null;
    if (t) replay();
  });

  /* =========================================================
     «지금» 상자와 꼬리표
     ========================================================= */
  function nodeName(id) { return PC.NODES[id].name; }

  function showNow(h) {
    var pre = h.boot ? "<b class='bf-step'>부팅 " + "➊➋➌➍➎".charAt(h.boot - 1) + "</b> "
            : (h.shut ? "<b class='bf-step'>종료 " + h.shut + "</b> " : "");
    $("capAct").textContent = h._title || "컴퓨터 내부";
    $("capStep").textContent = h._n ? h._i + " / " + h._n + "걸음" : "";
    $("nowMsg").innerHTML = pre + esc(h.msg) + (h.fail ? " <b class='bf-x'>✗</b>" : "");
    var r = h.route || route(h.path);
    $("nowWhere").innerHTML = "<span class='bf-tag' style='background:" + (STAGE[h.stage] || "#64748b") + "'>" + esc(h.stage) + "</span> " +
      "📍 " + (r.length > 1 ? r.map(nodeName).map(esc).join(" → ") : esc(nodeName(r[0])) + " 에서") +
      (h.data ? " · 데이터 : <b>" + esc(h.data) + "</b>" : "");
    var bar = $("capBar"); if (bar) bar.style.width = "0%";
    lightChips(h);
  }

  function chipRow(host, list, on) {
    host.innerHTML = list.map(function (it) {
      var lit = on.indexOf(it[0]) >= 0;
      return "<span class='bf-chip" + (lit ? " on" : "") + "'" +
             (lit && it[2] ? " style='--c:" + it[2] + "'" : "") + ">" + esc(it[1]) + "</span>";
    }).join(it2arrow(host));
  }
  /* 오른쪽 옆 칸 — «누가 일하나» 만 위에서 아래로 화살표를 잇는다 */
  function it2arrow(host) { return host.id === "layers" ? "<span class='bf-arr'>↓</span>" : ""; }

  function lightChips(h) {
    chipRow($("stages"), STAGE_ORDER.map(function (s) { return [s, s, STAGE[s]]; }), h && h.stage ? [h.stage] : []);
    var lay = [];
    if (h) {
      lay = [].concat(h.layer || []);
      var r = h.route || h.path;
      var userIn = h.stage === "입력" && /^(KBD|MOUSE|MON)$/.test(r[0]);
      var userOut = r.length > 1 && r[r.length - 1] === "MON" && !h.fail;
      if (userIn || userOut) lay.push("user");
    }
    chipRow($("layers"), LAYERS.map(function (l) { return [l[0], l[1], "#0f766e"]; }), lay);
    chipRow($("osfn"), PC.OSFN_ORDER.map(function (k) { return [k, PC.OSFN[k], "#b45309"]; }), h && h.os ? [h.os] : []);
  }

  /* =========================================================
     컴퓨터 내부 그림 (SVG) — 진짜 메인보드처럼 · 움직이게
     ---------------------------------------------------------
     · 정적인 그림(기판 · 소켓 · 램 슬롯 · 길 · 주변 기기)은 **한 번만** 그린다(buildBoard).
       바뀌는 것(빛남 · 램 칩 색 · 화면 · 소리 · ✗)만 #bfDyn 에 다시 그린다(renderBoard).
       통째로 다시 그리면 CSS 애니메이션(팬 회전 등)이 걸음마다 처음부터 다시 시작해 덜컹거린다.
     · 움직임은 두 갈래다
         - 데이터 꾸러미 : setInterval 로 좌표를 옮긴다(rAF 금지 — 루트 CLAUDE.md)
         - 팬 회전 · 길 위의 흐름 · LED 깜빡임 · 소리 물결 : CSS 애니메이션(css 의 .bf-board)
     ========================================================= */
  function txt(x, y, s, size, opt) {
    opt = opt || {};
    return "<text x='" + x + "' y='" + y + "' font-size='" + size + "'" +
           (opt.anchor ? " text-anchor='" + opt.anchor + "'" : "") +
           " fill='" + (opt.fill || "#111827") + "'" + (opt.bold ? " font-weight='bold'" : "") +
           (opt.cls ? " class='" + opt.cls + "'" : "") +
           (opt.id ? " id='" + opt.id + "'" : "") + ">" + esc(s) + "</text>";
  }
  function rect(x, y, w, h, fill, extra) {
    return "<rect x='" + x + "' y='" + y + "' width='" + w + "' height='" + h + "' fill='" + fill + "'" + (extra || "") + "/>";
  }
  function pts(list) { return list.map(function (p) { return p[0] + "," + p[1]; }).join(" "); }
  function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function textWidth(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e80 ? 21 : 12;
    return w;
  }

  function labShowsFault() { return tab === 3 && lab.mode === "explore"; }
  function labHidesDetail() { return tab === 3 && lab.mode === "quiz" && lab.answer === null; }

  /* ---------- 한 번만 그리는 것 ---------- */
  function buildBoard() {
    var o = "";
    o += "<defs>" +
      "<filter id='bfGlow' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='5' result='b'/>" +
      "<feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>" +
      "<pattern id='bfGrid' width='24' height='24' patternUnits='userSpaceOnUse'><path d='M24 0H0V24' fill='none' stroke='#2b3a33' stroke-width='1'/></pattern>" +
      "<linearGradient id='bfHs' x1='0' x2='1'><stop offset='0' stop-color='#cbd5e1'/><stop offset='.5' stop-color='#94a3b8'/><stop offset='1' stop-color='#cbd5e1'/></linearGradient>" +
      "</defs>";

    /* 기판 */
    o += rect(200, 12, 700, 576, "#15201b", " rx='16' stroke='#0a100d' stroke-width='3'");
    o += rect(200, 12, 700, 576, "url(#bfGrid)", " rx='16' opacity='.55'");
    [[214, 26], [886, 26], [214, 574], [886, 574], [560, 300]].forEach(function (h) {
      o += "<circle cx='" + h[0] + "' cy='" + h[1] + "' r='7' fill='#0b0f0d' stroke='#c0a062' stroke-width='3'/>";
    });
    o += txt(880, 582, "BOOT-FLOW MB-1000  REV 1.0", 12, { anchor: "end", fill: "#7d9a8c" });

    /* 길(버스) — 구리선 두 겹 */
    Object.keys(TRACE).forEach(function (k) {
      var p = pts(TRACE[k]);
      o += "<polyline points='" + p + "' fill='none' stroke='#6b5523' stroke-width='6' stroke-linejoin='round' stroke-linecap='round'/>";
      o += "<polyline points='" + p + "' fill='none' stroke='#d9b45a' stroke-width='1.6' stroke-linejoin='round' opacity='.75'/>";
    });

    /* 뒤판 단자(왼쪽) */
    o += rect(200, 40, 38, 440, "#a3acb6", " rx='4' stroke='#64748b'");
    o += "<circle cx='219' cy='75' r='12' fill='#7c3aed' stroke='#312e81' stroke-width='2'/>";
    o += "<circle cx='219' cy='200' r='12' fill='#16a34a' stroke='#14532d' stroke-width='2'/>";
    o += rect(207, 322, 24, 14, "#1f2937", " rx='2'") + rect(211, 326, 16, 5, "#2563eb");
    o += rect(207, 342, 24, 14, "#1f2937", " rx='2'") + rect(211, 346, 16, 5, "#2563eb");
    /* 오른쪽 단자 — HDMI · 소리 · 전원 24핀 */
    o += rect(880, 140, 20, 20, "#374151", " rx='3'");
    o += "<circle cx='890' cy='244' r='7' fill='#22c55e'/><circle cx='890' cy='262' r='7' fill='#f472b6'/>";
    o += rect(874, 430, 22, 70, "#f5f5f4", " rx='3' stroke='#a8a29e'");
    for (var pi = 0; pi < 6; pi++) o += rect(878, 436 + pi * 10, 6, 6, "#a8a29e") + rect(886, 436 + pi * 10, 6, 6, "#a8a29e");

    /* CPU — 소켓 · 방열판 · 팬 */
    o += rect(420, 50, 180, 180, "#d6d3d1", " rx='6' stroke='#78716c' stroke-width='3'");
    o += rect(432, 62, 156, 156, "url(#bfHs)", " rx='6'");
    for (var fx = 440; fx <= 580; fx += 9) o += "<line x1='" + fx + "' y1='66' x2='" + fx + "' y2='214' stroke='#64748b' stroke-width='1.5'/>";
    o += "<circle cx='510' cy='140' r='66' fill='#0f172a' stroke='#334155' stroke-width='4'/>";
    o += "<g class='fan'>";
    for (var bi = 0; bi < 7; bi++) {
      o += "<path transform='rotate(" + (bi * 360 / 7) + " 510 140)' d='M510,140 C518,112 540,90 566,92 C556,114 534,130 510,140 Z' fill='#475569'/>";
    }
    o += "<circle cx='510' cy='140' r='16' fill='#94a3b8'/></g>";

    /* 램 슬롯 4개 (초록·주황 — 사진 속 메인보드처럼) */
    [["640", "#3f8f45"], ["662", "#d9762b"], ["684", "#3f8f45"], ["706", "#d9762b"]].forEach(function (s) {
      o += rect(+s[0], 48, 16, 286, s[1], " rx='3'") + rect(+s[0] - 1, 44, 18, 8, "#f5f5f4", " rx='2'") + rect(+s[0] - 1, 330, 18, 8, "#f5f5f4", " rx='2'");
    });
    o += txt(640, 40, "주기억 장치(RAM)", 18, { bold: true, fill: "#f1f5f9" });

    /* 롬(바이오스 칩) */
    o += rect(285, 262, 60, 48, "#0b0f14", " rx='3'");
    for (var li = 0; li < 6; li++) o += rect(289 + li * 9, 257, 4, 6, "#c0a062") + rect(289 + li * 9, 309, 4, 6, "#c0a062");
    o += rect(293, 274, 44, 22, "#f8fafc", " rx='2'") + txt(315, 290, "BIOS", 13, { anchor: "middle", bold: true });
    o += txt(315, 336, "롬(ROM)", 18, { anchor: "middle", bold: true, fill: "#f1f5f9" });
    o += txt(315, 358, "바이오스", 17, { anchor: "middle", fill: "#9fb3a8" });

    /* 보조 기억 장치 — M.2 SSD */
    o += rect(280, 400, 280, 40, "#0b0f14", " rx='4' stroke='#475569' stroke-width='2'");
    o += rect(280, 404, 14, 32, "#c0a062");
    o += rect(306, 408, 52, 24, "#1e293b") + rect(366, 408, 52, 24, "#1e293b") + rect(426, 408, 40, 24, "#1e293b");
    o += rect(476, 410, 60, 20, "#f8fafc", " rx='2'") + txt(506, 425, "SSD", 13, { anchor: "middle", bold: true });
    o += txt(280, 468, "보조 기억 장치(SSD)", 19, { bold: true, fill: "#f1f5f9" });
    o += txt(500, 468, "· 꺼져도 남음", 17, { fill: "#9fb3a8" });

    /* 칩셋 · 확장 슬롯(장식) */
    o += rect(720, 430, 90, 70, "url(#bfHs)", " rx='6'");
    for (var cx2 = 728; cx2 <= 802; cx2 += 8) o += "<line x1='" + cx2 + "' y1='434' x2='" + cx2 + "' y2='496' stroke='#64748b'/>";
    o += txt(765, 518, "칩셋", 13, { anchor: "middle", fill: "#9fb3a8" });
    o += rect(660, 528, 210, 12, "#facc15", " rx='3'") + rect(660, 552, 210, 12, "#f5f5f4", " rx='3'");
    [[396, 58], [396, 236], [624, 236], [262, 230], [742, 386], [812, 386]].forEach(function (c) {
      o += "<circle cx='" + c[0] + "' cy='" + c[1] + "' r='8' fill='#1f2937' stroke='#64748b' stroke-width='2'/>";
    });
    o += "<circle cx='252' cy='30' r='5' class='led pwr' fill='#14532d'/>";
    o += txt(262, 34, "PWR", 11, { fill: "#7d9a8c" });

    /* ── 바깥 기기 : 왼쪽 입력 ── */
    o += rect(18, 30, 140, 62, "#e5e7eb", " rx='8' stroke='#94a3b8' stroke-width='2'");
    for (var ky = 0; ky < 3; ky++) for (var kx = 0; kx < 9; kx++) o += rect(25 + kx * 14.6, 37 + ky * 16, 11, 12, "#fff", " rx='2' stroke='#cbd5e1'");
    o += "<path d='M158,62 C190,62 192,75 207,75' fill='none' stroke='#475569' stroke-width='5'/>";
    o += txt(88, 116, "키보드", 20, { anchor: "middle", bold: true });
    o += txt(88, 139, "입력 장치", 17, { anchor: "middle", fill: "#6b7280" });

    o += "<ellipse cx='90' cy='195' rx='28' ry='38' fill='#e5e7eb' stroke='#94a3b8' stroke-width='2'/>";
    o += "<line x1='90' y1='158' x2='90' y2='190' stroke='#94a3b8' stroke-width='2'/><line x1='63' y1='190' x2='117' y2='190' stroke='#94a3b8' stroke-width='2'/>";
    o += rect(87, 168, 6, 12, "#64748b", " rx='3'");
    o += "<path d='M118,195 C170,195 182,200 207,200' fill='none' stroke='#475569' stroke-width='5'/>";
    o += txt(90, 258, "마우스", 20, { anchor: "middle", bold: true });
    o += txt(90, 281, "입력 장치", 17, { anchor: "middle", fill: "#6b7280" });

    o += txt(90, 308, "USB 장치", 20, { anchor: "middle", bold: true });
    o += txt(90, 452, "주변 장치", 17, { anchor: "middle", fill: "#6b7280" });

    /* ── 바깥 기기 : 오른쪽 출력 · 전원 ── */
    o += rect(935, 25, 150, 100, "#111827", " rx='8'");
    o += rect(1000, 125, 20, 22, "#475569") + rect(972, 146, 76, 8, "#475569", " rx='3'");
    o += "<path d='M900,150 C925,150 925,122 945,120' fill='none' stroke='#475569' stroke-width='5'/>";
    o += txt(1010, 178, "모니터", 20, { anchor: "middle", bold: true });

    o += rect(975, 215, 60, 86, "#1f2937", " rx='10'");
    o += "<circle cx='1005' cy='242' r='15' fill='#374151' stroke='#9ca3af' stroke-width='2'/><circle cx='1005' cy='242' r='5' fill='#9ca3af'/>";
    o += "<circle cx='1005' cy='280' r='10' fill='#374151' stroke='#9ca3af' stroke-width='2'/>";
    o += "<path d='M900,250 C935,250 945,258 975,258' fill='none' stroke='#475569' stroke-width='5'/>";
    o += txt(1005, 322, "스피커", 20, { anchor: "middle", bold: true });
    o += txt(1005, 345, "출력 장치", 17, { anchor: "middle", fill: "#6b7280" });

    o += rect(945, 405, 130, 104, "#374151", " rx='8'");
    o += "<circle cx='1010' cy='457' r='38' fill='#1f2937' stroke='#9ca3af' stroke-width='3'/>";
    o += "<g class='psufan'>";
    for (var pb = 0; pb < 5; pb++) o += "<path transform='rotate(" + (pb * 72) + " 1010 457)' d='M1010,457 C1016,438 1030,428 1042,432 C1034,446 1022,454 1010,457 Z' fill='#6b7280'/>";
    o += "</g>";
    o += "<circle cx='1063' cy='416' r='5' class='led psuled' fill='#14532d'/>";
    ["#facc15", "#ef4444", "#111827"].forEach(function (c, i) {
      o += "<line x1='945' y1='" + (459 + i * 6) + "' x2='896' y2='" + (459 + i * 6) + "' stroke='" + c + "' stroke-width='3'/>";
    });
    o += txt(1010, 534, "전원 공급 장치", 18, { anchor: "middle", bold: true });
    o += txt(1010, 557, "전기를 나눠 줌", 17, { anchor: "middle", fill: "#6b7280" });

    /* 바뀌는 층 · 꾸러미 층 */
    o += "<g id='bfDyn'></g>";
    o += "<g id='pkt' visibility='hidden'>" +
      "<polyline id='pktPath' fill='none' stroke-width='7' stroke-linejoin='round' stroke-linecap='round' class='flow' filter='url(#bfGlow)'/>" +
      [6, 5, 4, 3, 2, 1].map(function (k) { return "<circle class='trail' data-k='" + k + "' r='" + (11 - k) + "'/>"; }).join("") +
      "<circle id='pktRing' r='0' fill='none' stroke-width='4'/>" +
      "<circle id='pktGlow' r='13' filter='url(#bfGlow)'/><circle id='pktCore' r='6' fill='#fff'/>" +
      "<rect id='pktBox' rx='14' height='36' stroke='#fff' stroke-width='3'/>" +
      "<text id='pktTxt' font-size='19' font-weight='bold' fill='#fff' text-anchor='middle'></text></g>";
    $("board").innerHTML = o;
  }

  /* ---------- 바뀔 때마다 다시 그리는 것 ---------- */
  function boxGlow(id, color) {
    var B = BOX[id];
    return rect(B.x, B.y, B.w, B.h, color, " rx='14' fill-opacity='.14' stroke='" + color + "' stroke-width='5' filter='url(#bfGlow)' class='glow'");
  }

  function screenMini(b, m) {
    /* 모니터 그림 안의 작은 화면 — 사용자 화면과 같은 단계를 색으로 보여 준다 */
    var x = 943, y = 33, w = 134, h = 84, o = "";
    if (b.power && b.faults.mon) {
      return rect(x, y, w, h, "#000") + txt(x + w / 2, y + 48, "신호 없음", 16, { anchor: "middle", fill: "#9ca3af", bold: true });
    }
    var ph = m && m.phase;
    if (!b.power || ph === "off") return rect(x, y, w, h, "#020617");
    if (ph === "post" || ph === "boot" || ph === "stuck") {
      o += rect(x, y, w, h, "#0b1220");
      for (var i = 0; i < Math.min(5, (m.post || []).length); i++) {
        o += rect(x + 8, y + 10 + i * 13, 40 + ((i * 37) % 70), 5, /찾을 수 없|⚠|확인하세요|설치/.test(m.post[i]) ? "#fca5a5" : "#cbd5e1");
      }
      return o;
    }
    if (ph === "login") {
      return rect(x, y, w, h, "#1e40af") + "<circle cx='" + (x + w / 2) + "' cy='" + (y + 32) + "' r='12' fill='#e0f2fe'/>" +
             rect(x + 37, y + 54, 60, 12, "#fff", " rx='3'");
    }
    o += rect(x, y, w, h, m.ui === "cui" ? "#0b0f14" : m.ui === "nui" ? "#9d174d" : "#0e7490");
    for (var j = 0; j < 4; j++) o += rect(x + 8, y + 8 + j * 16, 12, 11, m.ui === "cui" ? "#22c55e" : "#e0f2fe", " rx='2'");
    if (m.focus) o += rect(x + 30, y + 10, w - 38, h - 28, "#f8fafc", " rx='3'") + rect(x + 30, y + 10, w - 38, 8, "#cbd5e1");
    o += rect(x, y + h - 9, w, 9, "#0f172a");
    return o;
  }

  function renderBoard() {
    var b = view.board, m = view.mon || {}, o = "";
    var svg = $("board");
    if (!$("bfDyn")) buildBoard();
    svg.setAttribute("class", "bf-board" + (b.power ? " on" : "") +
      (b.power && (b.apps.length || activeIds.indexOf("CPU") >= 0) ? " hot" : ""));

    /* 꺼져 있으면 기판을 어둡게 */
    if (!b.power) o += rect(200, 12, 700, 576, "#000", " rx='16' opacity='.35'");

    /* 지나가는 길과 부품을 빛나게 */
    activeIds.forEach(function (id) { if (BOX[id]) o += boxGlow(id, activeColor || "#f59e0b"); });

    /* 램 막대 — 칩 하나 = 1칸(1GB) · 두 막대에 네 칸씩 */
    var ramGone = b.faults.ram && !labHidesDetail();
    if (!ramGone) {
      var cells = [];
      b.ram.forEach(function (blk) { for (var i = 0; i < blk.size; i++) cells.push(blk.id); });
      var ramOn = activeIds.indexOf("RAM") >= 0;
      [638, 682].forEach(function (sx, s) {
        o += rect(sx, 52, 20, 276, "#166534", " rx='3' stroke='#052e16'");
        for (var c = 0; c < 4; c++) {
          var id = cells[s * 4 + c];
          var col = !id ? "#0b0f14" : id === "os" ? "#14b8a6" : id === "boot" ? "#94a3b8" : "#3b82f6";
          o += rect(sx + 3, 62 + c * 66, 14, 54, col, " rx='2'" + (id && ramOn ? " class='glow'" : ""));
        }
      });
    } else {
      o += txt(673, 192, "비어", 16, { anchor: "middle", bold: true, fill: "#fca5a5" });
      o += txt(673, 216, "있음", 16, { anchor: "middle", bold: true, fill: "#fca5a5" });
    }
    /* 램 안에 무엇이 있나 — 옆에 목록 */
    var used = 0, row = 0;
    if (!ramGone) {
      b.ram.forEach(function (blk) {
        var yy = 74 + row * 40;
        var col = blk.id === "os" ? "#14b8a6" : blk.id === "boot" ? "#94a3b8" : "#3b82f6";
        o += txt(732, yy, cut(blk.name, 6), 17, { bold: true, fill: "#f1f5f9" });
        for (var i = 0; i < blk.size; i++) o += rect(732 + i * 15, yy + 6, 12, 12, col, " rx='2'");
        used += blk.size; row++;
      });
      var free = b.ramTotal - used;
      var yf = 74 + row * 40;
      o += txt(732, yf, "빈자리 " + free + "칸", 17, { fill: "#9fb3a8" });
      for (var f = 0; f < free; f++) o += rect(732 + f * 15, yf + 6, 12, 12, "none", " rx='2' stroke='#9fb3a8' stroke-width='1.5'");
    }

    /* CPU 이름표 — 지금 무엇을 처리하나 */
    var now;
    if (!b.power) now = "꺼짐";
    else if (b.phase !== "desktop" && b.phase !== "login") now = b.phase === "stuck" ? "멈춤" : "부팅 중";
    else if (!b.apps.length) now = "운영체제 실행 중";
    else {
      var names = ["운영체제"].concat(b.apps.map(function (a) { return PC.APPS[a].name; }));
      now = "▶ " + names[cpuIdx % names.length];
    }
    o += rect(408, 238, 204, 58, "#0b1220", " rx='10' stroke='#334155' stroke-width='2'");
    o += txt(510, 261, "중앙 처리 장치(CPU)", 19, { anchor: "middle", bold: true, fill: "#f8fafc" });
    o += txt(510, 287, now, 19, { anchor: "middle", bold: true, fill: "#fbbf24", id: "cpuNow" });

    /* 보조 기억 장치 안 — 프로그램 · 파일 */
    var sys = labHidesDetail() ? ["부팅 프로그램", "운영체제"] : b.sys.slice(0, 2);
    if (!labHidesDetail() && b.sys.indexOf("운영체제") < 0) sys = [b.sys[0], "운영체제 없음 ✗"];
    var cx = 280;
    sys.forEach(function (n) {
      var w = textWidth(n) * 0.82 + 18, bad = /✗/.test(n);
      o += rect(cx, 480, w, 30, bad ? "#7f1d1d" : "#064e3b", " rx='8' stroke='" + (bad ? "#f87171" : "#34d399") + "'");
      o += txt(cx + 9, 501, n, 16, { bold: true, fill: bad ? "#fecaca" : "#d1fae5" });
      cx += w + 8;
    });
    o += txt(cx + 4, 501, "📝🎮🎵📁📊", 16, { fill: "#f1f5f9" });
    b.files.slice(0, 4).forEach(function (fn, i) {
      o += txt(280 + (i % 2) * 190, 534 + Math.floor(i / 2) * 26, "📄 " + cut(fn, 9), 16, { fill: "#e2e8f0" });
    });
    if (b.files.length > 4) o += txt(640, 560, "외 " + (b.files.length - 4) + "개", 14, { anchor: "end", fill: "#9fb3a8" });
    /* SSD 가 일할 때 깜빡이는 LED */
    o += "<circle cx='550' cy='420' r='5' fill='" + (b.power ? "#22c55e" : "#14532d") + "'" +
         (activeIds.indexOf("SSD") >= 0 ? " class='blink'" : "") + "/>";

    /* USB 장치 */
    if (b.usb || b.printer) o += "<path d='M150,372 C185,372 190,338 207,338' fill='none' stroke='#475569' stroke-width='5'/>";
    if (b.usb) {
      o += rect(26, 348, 44, 22, "#2563eb", " rx='4'") + rect(70, 352, 14, 14, "#cbd5e1");
      o += txt(48, 392, "USB 메모리", 13, { anchor: "middle", fill: "#1e3a8a", bold: true });
    }
    if (b.printer) {
      o += rect(92, 330, 64, 40, "#e5e7eb", " rx='6' stroke='#64748b' stroke-width='2'") + rect(100, 322, 48, 10, "#f8fafc", " stroke='#94a3b8'");
      o += txt(124, 392, "프린터", 13, { anchor: "middle", fill: "#1e3a8a", bold: true });
      if (lastPrinted) {
        o += rect(98, 398, 52, 40, "#fff", " stroke='#94a3b8'");
        o += txt(124, 422, cut(lastPrinted.replace(/\n/g, " "), 3), 14, { anchor: "middle" });
      }
    }
    if (!b.usb && !b.printer) o += txt(90, 372, "(연결 안 됨)", 15, { anchor: "middle", fill: "#9ca3af" });

    /* 모니터 화면 · 터치 */
    o += screenMini(b, m);
    if (b.ui === "nui") o += txt(1010, 201, "👆 터치 입력도 받음", 15, { anchor: "middle", fill: "#2563eb", bold: true });
    else o += txt(1010, 201, "출력 장치", 17, { anchor: "middle", fill: "#6b7280" });

    /* 스피커 소리 */
    var sp = Date.now() < speakerUntil ? speakerText : (b.power && b.apps.indexOf("music") >= 0 ? "♪ 음악 재생 중" : "");
    if (sp) {
      ["M1042,240 Q1054,258 1042,276", "M1052,230 Q1070,258 1052,286", "M1062,220 Q1086,258 1062,296"].forEach(function (d, i) {
        o += "<path d='" + d + "' fill='none' stroke='#a78bfa' stroke-width='4' stroke-linecap='round' class='wave' style='animation-delay:" + (i * 0.2) + "s'/>";
      });
      o += txt(1005, 370, sp, 17, { anchor: "middle", bold: true, fill: "#7c3aed", id: "spkText" });
    }

    /* 키보드·마우스가 신호를 보낼 때 */
    if (activeIds[0] === "KBD") o += rect(22, 34, 132, 54, activeColor, " rx='6' opacity='.35' class='blink'");
    if (activeIds[0] === "MOUSE") o += "<path d='M62,190 A28,38 0 0 1 90,157 L90,190 Z' fill='" + activeColor + "' opacity='.5' class='blink'/>";

    /* 고장(직접 고장 내 보기에서만 보인다) */
    if (labShowsFault()) {
      PC.FAULT_ORDER.forEach(function (k) {
        if (!b.faults[k]) return;
        var B = BOX[PC.FAULTS[k].part];
        o += rect(B.x, B.y, B.w, B.h, "none", " rx='14' stroke='#ef4444' stroke-width='4' stroke-dasharray='12 8'");
        o += rect(B.x + B.w - 84, B.y - 12, 78, 28, "#dc2626", " rx='14'");
        o += txt(B.x + B.w - 45, B.y + 8, "고장", 17, { anchor: "middle", bold: true, fill: "#fff" });
      });
    }
    /* 막힌 곳 ✗ */
    Object.keys(failIds).forEach(function (id) {
      var B = BOX[id]; if (!B) return;
      /* «고장» 표가 같은 모서리에 있으면 ✗ 를 오른쪽 변을 따라 조금 내린다(둘이 겹쳤다) */
      var tagged = labShowsFault() && PC.FAULT_ORDER.some(function (k) { return b.faults[k] && PC.FAULTS[k].part === id; });
      var fy = B.y + (tagged ? 60 : 26);
      o += "<circle cx='" + (B.x + B.w - 20) + "' cy='" + fy + "' r='22' fill='#dc2626' stroke='#fff' stroke-width='3'/>";
      o += txt(B.x + B.w - 20, fy + 10, "✗", 28, { anchor: "middle", bold: true, fill: "#fff" });
    });

    /* PSU · 전원 LED */
    var on = !!b.power;
    var led = svg.querySelectorAll(".led");
    for (var li = 0; li < led.length; li++) led[li].setAttribute("fill", on ? "#22c55e" : "#14532d");

    $("bfDyn").innerHTML = o;
    if (cur && !cur.kind) movePacket(cur, phase === "read" ? 0 : curT); else hidePacket();   /* 카드(intro/outro)에는 꾸러미가 없다 */
  }

  /* ---------- 데이터 꾸러미 ---------- */
  function pathOf(h) {
    if (h._pts) return h._pts;
    var p = routePoints(h.route), acc = [0];
    for (var i = 1; i < p.length; i++) acc.push(acc[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    h._pts = { p: p, acc: acc, len: acc[acc.length - 1] };
    return h._pts;
  }
  function pointAt(P, t) {
    if (P.p.length === 1 || !P.len) return { x: P.p[0][0], y: P.p[0][1] };
    var d = Math.max(0, Math.min(1, t)) * P.len, i = 1;
    while (i < P.acc.length - 1 && P.acc[i] < d) i++;
    var a = P.p[i - 1], b = P.p[i], seg = (P.acc[i] - P.acc[i - 1]) || 1, k = (d - P.acc[i - 1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
  }

  function movePacket(h, t) {
    var g = $("pkt"); if (!g) return;
    var P = pathOf(h), color = h.fail && t > 0.85 ? "#dc2626" : (STAGE[h.stage] || "#475569");
    var p = pointAt(P, t), single = P.p.length === 1;
    $("pktPath").setAttribute("points", single ? "" : pts(P.p));
    $("pktPath").setAttribute("stroke", color);
    $("pktPath").setAttribute("opacity", single ? 0 : 0.55);
    Array.prototype.forEach.call(g.querySelectorAll(".trail"), function (c) {
      var k = +c.getAttribute("data-k"), q = pointAt(P, t - k * 0.035);
      c.setAttribute("cx", q.x); c.setAttribute("cy", q.y);
      c.setAttribute("fill", color); c.setAttribute("opacity", single ? 0 : (0.6 - k * 0.08));
    });
    var ring = $("pktRing");
    ring.setAttribute("cx", p.x); ring.setAttribute("cy", p.y); ring.setAttribute("stroke", color);
    ring.setAttribute("r", single ? 14 + ((t * 3) % 1) * 46 : 0);
    ring.setAttribute("opacity", single ? 1 - ((t * 3) % 1) : 0);
    $("pktGlow").setAttribute("cx", p.x); $("pktGlow").setAttribute("cy", p.y); $("pktGlow").setAttribute("fill", color);
    $("pktCore").setAttribute("cx", p.x); $("pktCore").setAttribute("cy", p.y);
    var label = h.data || "데이터", w = textWidth(label) * 0.95 + 26;
    var lx = Math.max(w / 2 + 4, Math.min(1096 - w / 2, p.x)), ly = Math.max(22, p.y - 38);
    var box = $("pktBox"), tx = $("pktTxt");
    box.setAttribute("x", lx - w / 2); box.setAttribute("y", ly - 18); box.setAttribute("width", w); box.setAttribute("fill", color);
    tx.setAttribute("x", lx); tx.setAttribute("y", ly + 7); tx.textContent = label;
    g.setAttribute("visibility", "visible");
    g.setAttribute("data-x", Math.round(p.x)); g.setAttribute("data-y", Math.round(p.y));
  }
  function hidePacket() { var g = $("pkt"); if (g) g.setAttribute("visibility", "hidden"); }

  /* CPU 가 번갈아 처리하는 모습 · 소리 끝나면 지우기 */
  setInterval(function () {
    var b = view.board;
    cpuIdx++;
    var el = $("cpuNow");
    if (el && b.power && b.apps.length && (b.phase === "desktop" || b.phase === "login")) {
      var names = ["운영체제"].concat(b.apps.map(function (a) { return PC.APPS[a].name; }));
      el.textContent = "▶ " + names[cpuIdx % names.length];
    }
    if (speakerUntil && Date.now() > speakerUntil) { speakerUntil = 0; renderBoard(); }
  }, 900);

  /* =========================================================
     사용자 화면 (모니터 안)
     ========================================================= */
  function btn(act, label, attrs, cls) {
    var a = "";
    for (var k in (attrs || {})) a += " data-" + k + "='" + esc(attrs[k]) + "'";
    return "<button type='button' class='" + (cls || "sc-btn") + "' data-act='" + act + "'" + a + ">" + label + "</button>";
  }

  function renderScreen() {
    var m = view.mon || { phase: "off" }, b = view.board, html;
    if (b.power && b.faults.mon) {
      html = "<div class='sc-nosig'><div>신호 없음</div><small>모니터 연결을 확인하세요</small></div>";
    } else if (m.phase === "off") {
      html = b.power ? "<div class='sc-black'></div>"
                     : "<div class='sc-off'><div>⏻</div><p>아래 <b>전원 버튼</b>을 눌러 켜 보세요</p></div>";
    } else if (m.phase === "post" || m.phase === "boot" || m.phase === "stuck") {
      html = "<div class='sc-bios'><div class='sc-bios-h'>바이오스(BIOS) — 하드웨어 점검</div>" +
             m.post.map(function (l) {
               return "<div class='" + (/찾을 수 없|⚠|확인하세요|설치/.test(l) ? "bad" : "") + "'>" + esc(l) + "</div>";
             }).join("") +
             (m.phase === "post" && !m.stuck ? "<div class='sc-blink'>부팅 프로그램을 불러오는 중…</div>" : "") +
             "</div>";
    } else if (m.phase === "login") {
      html = loginScreen(m);
    } else {
      html = desktopScreen(m);
    }
    $("screen").innerHTML = html;
  }

  function noticeBar(m) {
    if (!m.notice) return "";
    return "<div class='sc-notice " + esc(m.notice.kind) + "'>" + esc(m.notice.text) + "</div>";
  }

  function loginScreen(m) {
    var dots = "";
    for (var i = 0; i < m.pwLen; i++) dots += "●";
    var osk = "";
    if (m.osk) {
      osk = "<div class='sc-osk'>" + ["1", "2", "3", "4"].map(function (k) {
        return btn("osk-key", k, { k: k });
      }).join("") + btn("osk-key", "⌫", { k: "⌫" }) + btn("osk-key", "확인", { k: "⏎" }, "sc-btn pri") + "</div>";
    }
    return "<div class='sc-login'>" + noticeBar(m) +
      "<div class='sc-avatar'>👤</div><div class='sc-user'>학생</div>" +
      "<div class='sc-pw'>" + (dots || "<span class='ph'>비밀번호</span>") + "</div>" +
      (m.pwMsg ? "<div class='sc-err'>" + esc(m.pwMsg) + "</div>" : "<div class='sc-hint'>비밀번호 <b>1234</b> 를 키보드로 치고 Enter</div>") +
      btn("osk", m.osk ? "화상 키보드 닫기" : "⌨ 화상 키보드", {}, "sc-btn") + osk + "</div>";
  }

  function launcher(m) {
    if (m.ui === "cui") {
      return "<div class='sc-cui'><div class='sc-cui-p'>C:\\&gt; 명령어 입력</div>" +
        PC.APP_ORDER.map(function (a) {
          return btn("open", "&gt; " + esc(PC.APPS[a].name), { app: a, via: "cui" }, "sc-cmd");
        }).join("") + "</div>";
    }
    return "<div class='sc-icons " + (m.ui === "nui" ? "nui" : "") + "'>" + PC.APP_ORDER.map(function (a) {
      var A = PC.APPS[a];
      return btn("open", "<span class='ic'>" + A.icon + "</span><span>" + esc(A.name) + "</span>",
                 { app: a, via: m.ui === "nui" ? "nui" : "gui" }, "sc-icon");
    }).join("") + "</div>";
  }

  function windowBody(m, app) {
    var A = PC.APPS[app];
    var head = "<div class='sc-wh'><span>" + A.icon + " " + esc(A.name) +
      (app === "notepad" ? " — " + esc(m.note.file || "제목 없음") + (m.note.dirty ? " <b class='dot'>●</b>" : "") : "") +
      "</span><span class='sp'></span>";
    if (app === "notepad") head += btn("save", "💾 저장") + btn("print", "🖨 인쇄");
    head += btn("close", "✕", { app: app }, "sc-btn x") + "</div>";
    var body = "";
    if (app === "notepad") {
      body = "<div class='sc-note'>" + esc(m.note.text).replace(/\n/g, "<br>") + "<span class='caret'>▌</span></div>" +
             "<div class='sc-wf'>키보드로 쓰세요 · 저장하지 않은 글은 <b>●</b> 표시</div>";
    } else if (app === "game") {
      var g = m.game, cells = "";
      for (var i = 0; i < 10; i++) {
        cells += "<div class='gc'>" + (i === g.x ? "<span class='gch" + (g.y ? " up" : "") + "'>🏃</span>" : "") +
                 (g.star && i === 7 ? "<span class='gst'>⭐</span>" : "") + "</div>";
      }
      body = "<div class='sc-game'><div class='gs'>점수 " + g.score + "</div><div class='gt'>" + cells + "</div></div>" +
             "<div class='sc-wf'>← → 이동 · 스페이스 바 점프</div>";
    } else if (app === "music") {
      body = "<div class='sc-music'>🎵 교실 노래 재생 중 <span>♪ ♫ ♪</span></div>" +
             "<div class='sc-wf'>음악은 창을 바꿔도 계속 나옵니다</div>";
    } else if (app === "explorer") {
      var hit = m.search || [];
      body = "<div class='sc-ex'>" + btn("search", "🔍 글 파일 찾기") +
        "<div class='sc-exh'>💽 보조 기억 장치 › 내 문서</div>" +
        m.files.map(function (f) {
          return "<div class='sc-exr" + (hit.indexOf(f.name) >= 0 ? " hit" : "") + "'><span>" + (f.danger ? "❓" : "📄") + " " + esc(f.name) + "</span>" +
            btn("file", "열기", { op: "open", name: f.name }) +
            (f.danger ? "" : btn("file", "복사", { op: "copy", name: f.name })) +
            btn("file", "삭제", { op: "delete", name: f.name }) + "</div>";
        }).join("") +
        (m.usb ? "<div class='sc-exh'>💾 USB 메모리</div>" + m.usbFiles.map(function (f) {
          return "<div class='sc-exr'><span>📄 " + esc(f.name) + "</span>" +
            btn("file", "열기", { op: "open", name: f.name, usb: "1" }) + "</div>";
        }).join("") : "") +
        "<div class='sc-exh small'>🗑 휴지통 " + m.trash.length + "개</div></div>";
    } else if (app === "taskmgr") {
      var t = m.tm;
      body = "<table class='sc-tm'>" +
        "<tr><th>실행 중인 프로그램</th><td>" + esc(t.running.join(", ") || "-") + "</td></tr>" +
        "<tr><th>CPU 이용률</th><td><b>" + t.cpu + " %</b></td></tr>" +
        "<tr><th>프로세스 수</th><td><b>" + t.procs + " 개</b></td></tr>" +
        "<tr><th>전체 메모리 용량</th><td>" + t.total + " GB</td></tr>" +
        "<tr><th>사용 중인 메모리 용량</th><td><b>" + t.used + " GB</b></td></tr>" +
        "<tr><th>사용 가능한 메모리 용량</th><td><b>" + t.free + " GB</b></td></tr></table>";
    }
    return "<div class='sc-wnd'>" + head + "<div class='sc-wb'>" + body + "</div></div>";
  }

  function desktopScreen(m) {
    var win = m.focus ? windowBody(m, m.focus)
      : "<div class='sc-empty'>" + (m.ui === "cui" ? "왼쪽 명령어를 눌러 프로그램을 실행하세요"
          : m.ui === "nui" ? "👆 왼쪽 타일을 손가락으로 눌러 보세요" : "왼쪽 아이콘을 눌러 프로그램을 실행하세요") + "</div>";
    var tasks = m.apps.map(function (a) {
      return btn("focus", PC.APPS[a].icon + " " + esc(PC.APPS[a].name), { app: a }, "sc-tab" + (a === m.focus ? " on" : ""));
    }).join("");
    var dlg = "";
    if (m.dialog) {
      dlg = "<div class='sc-dlgback'><div class='sc-dlg'><p>메모장에 <b>저장하지 않은 글</b>이 있습니다.<br>저장할까요?</p><div>" +
            btn("dialog", "💾 저장", { v: "save" }, "sc-btn pri") + btn("dialog", "저장 안 함", { v: "discard" }) +
            btn("dialog", "취소", { v: "cancel" }) + "</div></div></div>";
    }
    return "<div class='sc-desk ui-" + esc(m.ui) + "'>" + noticeBar(m) +
      "<div class='sc-body'><div class='sc-launch'>" + launcher(m) + "</div><div class='sc-area'>" + win + "</div></div>" +
      "<div class='sc-task'>" + btn("lock", "🔒 잠금", {}, "sc-tab") + "<div class='sc-tabs'>" + tasks + "</div>" +
      btn("power", "⏻ 종료", {}, "sc-tab off") + "</div>" + dlg + "</div>";
  }

  /* 모니터 안의 단추 — 한 곳에서 받는다 */
  $("screen").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var a = t.getAttribute("data-act"), d = function (k) { return t.getAttribute("data-" + k); };
    if (a === "open") act("open", d("app"), d("via"));
    else if (a === "close") act("close", d("app"));
    else if (a === "focus") act("focus", d("app"));
    else if (a === "save") act("save");
    else if (a === "print") act("print");
    else if (a === "dialog") act("dialog", d("v"));
    else if (a === "file") act("file", d("op"), d("name"), d("usb") === "1");
    else if (a === "search") act("file", "search");
    else if (a === "lock") act("lock");
    else if (a === "power") act("power");
    else if (a === "osk") act("osk");
    else if (a === "osk-key") act("key", d("k"), "MOUSE");
  });

  /* =========================================================
     키보드 · 본체 단추
     ========================================================= */
  var KEYS = [["1"], ["2"], ["3"], ["4"], ["가"], ["나"], ["다"], ["라"],
              ["←"], ["→"], [" ", "스페이스"], ["⌫", "⌫ 지우기"], ["⏎", "Enter"]];
  $("keys").innerHTML = KEYS.map(function (k) {
    return "<button type='button' class='bf-key" + (k[0] === " " ? " wide" : "") + "' data-k='" + esc(k[0]) + "'>" + esc(k[1] || k[0]) + "</button>";
  }).join("");
  $("keys").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-k]") : null;
    if (t) act("key", t.getAttribute("data-k"), "KBD");
  });
  /* 진짜 키보드도 받는다 (교사 PC 에서 시연할 때) */
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    var tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var map = { ArrowLeft: "←", ArrowRight: "→", " ": " ", Backspace: "⌫", Enter: "⏎" };
    var k = map[e.key] || (e.key && e.key.length === 1 ? e.key : null);
    if (!k) return;
    e.preventDefault();
    act("key", k, "KBD");
  });

  $("btnPower").addEventListener("click", function () { act("power"); });
  $("btnUsb").addEventListener("click", function () { act("device", "usb"); });
  $("btnPrn").addEventListener("click", function () { act("device", "printer"); });

  function renderButtons() {
    var b = view.board;
    $("btnPower").classList.toggle("on", !!b.power);
    $("btnPower").textContent = b.power ? "⏻ 전원 (켜짐)" : "⏻ 전원";
    $("btnUsb").textContent = b.usb ? "⏏ USB 메모리 빼기" : "🔌 USB 메모리 꽂기";
    $("btnPrn").textContent = b.printer ? "⏏ 프린터 빼기" : "🖨 프린터 연결";
  }

  /* =========================================================
     흐름 조절 단추
     ========================================================= */
  $("btnPause").addEventListener("click", function () { paused = !paused; updateCtl(); });
  $("btnSkip").addEventListener("click", skipAll);
  $("speed").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-speed]") : null;
    if (!t) return;
    speed = t.getAttribute("data-speed");
    updateCtl();
  });
  function updateCtl() {
    var left = queue.length + (cur ? 1 : 0);
    $("btnPause").textContent = paused ? "▶ 계속" : "⏸ 멈춤";
    $("btnPause").classList.toggle("primary", paused);
    $("btnSkip").textContent = "⏭ 건너뛰기" + (left ? " (" + left + ")" : "");
    $("btnSkip").disabled = !left;
    var rb = $("btnReplay"); if (rb) rb.disabled = !!left;
    Array.prototype.forEach.call($("speed").children, function (c) {
      c.classList.toggle("on", c.getAttribute("data-speed") === speed);
    });
  }

  /* =========================================================
     왼쪽 안내 — 탭마다
     ========================================================= */
  var TASKS = [
    { k: "booted", t: "⏻ 전원을 켜고 부팅 지켜보기",
      how: "아래 <b>⏻ 전원</b>을 누르세요. 오른쪽에서 데이터가 어디서 어디로 가는지 따라가 보세요.",
      q: "CPU 는 가장 먼저 어디에 있는 프로그램을 실행했나요?" },
    { k: "login-ok", t: "🔑 비밀번호 1234 로 로그인",
      how: "키보드로 <b>1 2 3 4</b> 를 누르고 <b>Enter</b>.",
      q: "화면에는 왜 숫자가 아니라 ● 로 보일까요?" },
    { k: "opened:notepad", t: "📝 메모장 열기",
      how: "바탕 화면의 <b>📝 메모장</b> 아이콘을 누르세요.",
      q: "메모장 프로그램은 어디에서 어디로 옮겨진 뒤 실행되었나요?" },
    { k: "typed", t: "⌨ 글자 쓰기",
      how: "키보드의 <b>가 나 다 라</b> 를 눌러 보세요.",
      q: "글자 하나를 누를 때 입력·처리·저장·출력이 각각 어디서 일어났나요?" },
    { k: "saved", t: "💾 저장하기",
      how: "메모장의 <b>💾 저장</b>을 누르세요.",
      q: "저장하기 전에 글은 어디에 있었나요? 저장한 뒤에는요?" },
    { k: "game-move", t: "🎮 게임에서 방향키 · 스페이스 바",
      how: "<b>🎮 게임</b>을 열고 <b>← →</b>, <b>스페이스</b>를 눌러 보세요.",
      q: "키를 누르면 사용자 → ( ) → ( ) → 하드웨어 순서로 전달돼요. 빈칸은?" },
    { k: "closed", t: "✕ 프로그램 닫기",
      how: "창의 <b>✕</b>를 누르세요. 저장하지 않은 글이 있으면 어떻게 되나요?",
      q: "프로그램을 닫으면 주기억 장치는 어떻게 바뀌었나요?" },
    { k: "shutdown", t: "⏻ 시스템 종료",
      how: "아래 줄의 <b>⏻ 종료</b>를 누르세요. 종료 과정 4단계를 지켜보세요.",
      q: "꺼진 뒤 주기억 장치와 보조 기억 장치에는 각각 무엇이 남았나요?" },
    { k: "persist", t: "🔁 다시 켜서 저장한 글 열기",
      how: "다시 켜고 로그인한 뒤 <b>📁 파일 탐색기</b>에서 «내 글.txt» 를 여세요.",
      q: "껐다 켰는데도 글이 남아 있는 까닭은?" }
  ];

  var MISSIONS = [
    { k: "ui", steps: [["opened@gui", "🖱 아이콘을 눌러 열기 (GUI)"], ["opened@cui", "⌨ 명령어로 열기 (CUI)"], ["opened@nui", "👆 화면을 터치해 열기 (NUI)"]],
      lead: "컴퓨터를 쉽게 쓸 수 있는 환경을 줍니다.",
      tip: "아래 단추로 화면 방식을 바꾼 뒤 아무 프로그램이나 열어 보세요. <b>첫 걸음(입력)만 다르고</b> 그 뒤는 똑같습니다.",
      done: "방식은 달라도 운영체제가 사용자의 뜻을 받아 똑같이 프로그램을 실행해 주었습니다." },
    { k: "dev", steps: [["usb-ready", "🔌 USB 메모리 꽂기"], ["printer-ready", "🖨 프린터 연결"], ["printed", "📝 메모장 글 인쇄하기"]],
      lead: "연결된 입출력 장치·주변 장치가 정상으로 동작하도록 관리합니다.",
      tip: "모니터 아래 단추로 장치를 연결하고, 메모장에서 <b>🖨 인쇄</b>를 눌러 보세요.",
      done: "운영체제가 새 장치를 알아보고 드라이버를 준비해, 프린터가 알아듣는 신호로 바꿔 보냈습니다." },
    { k: "sec", steps: [["lock", "🔒 화면 잠그기"], ["login-fail", "🔑 비밀번호를 틀려 보기"], ["blocked", "❓ «출처 모를 파일» 열어 보기"]],
      lead: "계정·비밀번호로 컴퓨터를 지키고, 악성 소프트웨어를 막습니다.",
      tip: "아래 줄의 <b>🔒 잠금</b> → 틀린 비밀번호, 그리고 <b>📁 파일 탐색기</b>에서 «출처 모를 파일» 을 열어 보세요.",
      done: "비밀번호가 틀리면 들어갈 수 없고, 의심스러운 파일은 실행되기 전에 검사해 막았습니다." },
    { k: "mem", steps: [["mem-full", "📚 프로그램을 계속 열어 «메모리 부족» 보기"], ["mem-freed", "✕ 하나를 닫아 자리 돌려받기"]],
      lead: "주기억 장치의 자리를 나눠 주고(배분), 다 쓰면 돌려받습니다(회수).",
      tip: "오른쪽 <b>주기억 장치</b>의 칸을 보면서 프로그램을 하나씩 여세요. 8칸이 차면?",
      done: "주기억 장치는 크기가 한정되어 있어, 운영체제가 자리를 나눠 주고 닫을 때 돌려받습니다." },
    { k: "file", steps: [["saved", "💾 메모장 글 저장"], ["search", "🔍 글 파일 찾기"], ["copy", "📄 파일 복사"], ["delete", "🗑 파일 삭제"]],
      lead: "파일과 폴더를 관리하고 찾기·복사·삭제 도구를 줍니다.",
      tip: "<b>📁 파일 탐색기</b>를 열어 보세요. 파일은 모두 <b>보조 기억 장치</b>에 있습니다.",
      done: "파일이 어디에 어떤 이름으로 있는지 운영체제가 기억하고 있어 쉽게 찾고 다룰 수 있었습니다." },
    { k: "proc", steps: [["opened:music", "🎵 음악 켜기"], ["opened:game", "🎮 음악을 켠 채 게임 열기"], ["multi", "📊 작업 관리자로 확인"]],
      lead: "여러 프로그램이 동시에 실행될 때 CPU 를 나눠 주고 충돌을 막습니다.",
      tip: "오른쪽 <b>CPU</b> 칸을 보세요 — 프로그램을 번갈아 조금씩 처리합니다. 작업 관리자에서 <b>CPU 이용률·프로세스 수</b>를 적어 보세요.",
      done: "CPU 는 하나지만 운영체제가 아주 빠르게 번갈아 나눠 주어 동시에 실행되는 것처럼 보였습니다." }
  ];

  function stepsList(steps, active, list) {
    return "<ol class='g-steps'>" + steps.map(function (s, i) {
      var on = active === i + 1;
      return "<li class='" + (on ? "on" : "") + (list && list[i] ? " ok" : "") + "'>" + esc(s) + "</li>";
    }).join("") + "</ol>";
  }

  function renderGuide() {
    var S = seen(), html = "";
    var nowBoot = cur && cur.boot, nowShut = cur && cur.shut;

    if (tab === 1) {
      var next = -1;
      TASKS.forEach(function (t, i) { if (next < 0 && !S[t.k]) next = i; });
      /* 가장 중요한 «지금 해 볼 일» 을 맨 위에 — 창이 낮아 안내가 길어지면 아래가 잘리기 때문 */
      if (next >= 0) {
        var T = TASKS[next];
        html += "<div class='g-card top'><div class='g-ch'>👉 " + (next + 1) + ". " + esc(T.t) + "</div><p>" + T.how + "</p>" +
                "<p class='g-q'>🤔 " + esc(T.q) + "</p></div>";
      } else {
        html += "<div class='g-card top ok'><b>🎉 모두 해 보았습니다!</b><p>이제 학습지를 풀어 보세요.</p></div>";
      }
      /* 부팅·종료 과정 — 그 일이 일어나는 동안(과 처음 켜기 전)에만 보인다 */
      if (nowBoot || nowShut || !S.booted) {
        var shutMode = !!nowShut;
        html += "<h3>" + (shutMode ? "종료의 과정" : "부팅의 과정") + "</h3>" +
                stepsList(shutMode ? PC.SHUT_STEPS : PC.BOOT_STEPS, shutMode ? nowShut : nowBoot);
      }
      html += "<h3>해 볼 일</h3><ul class='g-tasks'>" + TASKS.map(function (t, i) {
        return "<li class='" + (S[t.k] ? "ok" : "") + (i === next ? " now" : "") + "'>" +
               "<span class='g-ck'>" + (S[t.k] ? "✓" : i + 1) + "</span>" + esc(t.t) + "</li>";
      }).join("") + "</ul>";
    }

    if (tab === 2) {
      if (view.board.phase !== "desktop") {
        html += "<div class='g-card'><p>운영체제 미션은 <b>바탕 화면</b>에서 합니다.</p>" +
                "<button type='button' class='btn primary' data-g='quick'>⚡ 바로 바탕 화면으로</button>" +
                "<p class='g-small'>(부팅 과정은 ① 탭에서 봅니다)</p></div>";
      }
      html += "<h2>운영체제의 기능 여섯 가지</h2><div class='g-mgrid'>" + MISSIONS.map(function (M) {
        var ok = M.steps.every(function (s) { return S[s[0]]; });
        return "<button type='button' class='g-m" + (M.k === mission ? " on" : "") + (ok ? " ok" : "") + "' data-m='" + M.k + "'>" +
               (ok ? "✓ " : "") + esc(PC.OSFN[M.k]) + "</button>";
      }).join("") + "</div>";
      var M = MISSIONS.filter(function (x) { return x.k === mission; })[0];
      var allOk = M.steps.every(function (s) { return S[s[0]]; });
      html += "<div class='g-card'><div class='g-ch'>" + esc(PC.OSFN[M.k]) + "</div><p class='g-lead'>" + esc(M.lead) + "</p>" +
              "<ul class='g-sub'>" + M.steps.map(function (s) {
                return "<li class='" + (S[s[0]] ? "ok" : "") + "'><span class='g-ck'>" + (S[s[0]] ? "✓" : "○") + "</span>" + esc(s[1]) + "</li>";
              }).join("") + "</ul><p class='g-tip'>" + M.tip + "</p>";
      if (M.k === "ui") {
        html += "<div class='g-ui'>" + [["gui", "🖱 GUI"], ["cui", "⌨ CUI"], ["nui", "👆 NUI"]].map(function (u) {
          return "<button type='button' class='g-uib" + (view.board.ui === u[0] ? " on" : "") + "' data-ui='" + u[0] + "'>" + u[1] + "</button>";
        }).join("") + "</div>";
      }
      if (allOk) html += "<p class='g-done'>✅ " + esc(M.done) + "</p>";
      html += "</div>";
    }

    if (tab === 3) html += labGuide(S);

    $("guide").innerHTML = html;
  }

  function labGuide(S) {
    var html = "<div class='bf-seg wide'>" +
      "<button type='button' data-lab='explore' class='" + (lab.mode === "explore" ? "on" : "") + "'>🔍 직접 고장 내 보기</button>" +
      "<button type='button' data-lab='quiz' class='" + (lab.mode === "quiz" ? "on" : "") + "'>🎲 수수께끼 고장</button></div>";
    if (lab.mode === "explore") {
      html += "<h2>무엇을 고장 낼까요?</h2><div class='g-faults'>" +
        "<button type='button' class='g-f" + (!lab.fault ? " on" : "") + "' data-fault=''>✅ 정상 컴퓨터</button>" +
        PC.FAULT_ORDER.map(function (k) {
          var F = PC.FAULTS[k];
          return "<button type='button' class='g-f" + (lab.fault === k ? " on" : "") + "' data-fault='" + k + "'>" + F.icon + " " + esc(F.name) + "</button>";
        }).join("") + "</div>";
      html += "<div class='g-card'><p>⏻ <b>전원</b>을 켜고, <b>어느 단계에서 멈추는지</b> 오른쪽을 보세요.</p>";
      if (lab.fault) {
        var F = PC.FAULTS[lab.fault];
        html += lab.showWhy
          ? "<p class='g-why'><b>멈추는 곳 : " + esc(F.where) + "</b><br>" + F.why + "</p>"
          : "<button type='button' class='btn' data-g='why'>💡 해설 보기</button>";
      }
      html += "</div>";
    } else {
      html += "<div class='g-card'><div class='g-ch'>🎲 문제 " + (lab.asked || "-") + " · 맞힌 수 " + lab.right + "</div>";
      if (!lab.quiz) {
        html += "<p>컴퓨터 한 대가 <b>몰래</b> 고장 났습니다. 켜 보고 어디가 고장인지 맞혀 보세요.</p>" +
                "<button type='button' class='btn primary' data-g='newq'>🎲 새 문제</button></div>";
        return html;
      }
      html += "<p>⏻ 전원을 켜고, 필요하면 로그인도 해 보세요. <b>어디가 고장일까요?</b></p></div><div class='g-faults'>" +
        PC.FAULT_ORDER.map(function (k) {
          var F = PC.FAULTS[k], cls = "";
          if (lab.answer) cls = k === lab.quiz ? " right" : (k === lab.answer ? " wrong" : "");
          return "<button type='button' class='g-f" + cls + "' data-ans='" + k + "'" + (lab.answer ? " disabled" : "") + ">" + F.icon + " " + esc(F.name) + "</button>";
        }).join("") + "</div>";
      if (lab.answer) {
        var Q = PC.FAULTS[lab.quiz];
        html += "<div class='g-card " + (lab.answer === lab.quiz ? "ok" : "no") + "'><b>" +
                (lab.answer === lab.quiz ? "⭕ 정답입니다!" : "❌ 정답은 «" + esc(Q.name) + "»") + "</b>" +
                "<p class='g-why'><b>멈추는 곳 : " + esc(Q.where) + "</b><br>" + Q.why + "</p>" +
                "<button type='button' class='btn primary' data-g='newq'>🎲 다음 문제</button></div>";
      }
    }
    return html;
  }

  function setLabFault(k) {
    skipAll();
    failIds = {};
    var f = {}; if (k) f[k] = true;
    view = pcLab.reset(f);
    speakerUntil = 0; lastPrinted = "";
    setMode("user");
    lastHops = [];
    $("nowMsg").textContent = "⏻ 전원 버튼을 눌러 켜 보세요.";
    $("nowWhere").textContent = "";
    renderAll();
  }

  $("guide").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button") : null;
    if (!t) return;
    var g = t.getAttribute("data-g");
    if (t.hasAttribute("data-m")) { mission = t.getAttribute("data-m"); renderGuide(); return; }
    if (t.hasAttribute("data-ui")) { act("mode", t.getAttribute("data-ui")); renderGuide(); return; }
    if (g === "quick") {
      skipAll(); failIds = {};
      view = pc.quickBoot(); lastHops = []; speakerUntil = 0; setMode("user"); setLast();
      $("nowMsg").textContent = "바탕 화면에서 시작합니다(부팅을 건너뛰었습니다).";
      $("nowWhere").textContent = "";
      renderAll(); return;
    }
    if (t.hasAttribute("data-lab")) {
      lab.mode = t.getAttribute("data-lab");
      lab.quiz = null; lab.answer = null; lab.fault = null; lab.showWhy = false;
      setLabFault(null); return;
    }
    if (t.hasAttribute("data-fault")) {
      lab.fault = t.getAttribute("data-fault") || null; lab.showWhy = false;
      setLabFault(lab.fault); return;
    }
    if (g === "why") { lab.showWhy = true; renderGuide(); return; }
    if (g === "newq") {
      var pool = PC.FAULT_ORDER.filter(function (k) { return k !== lab.prev; });
      lab.quiz = pool[Math.floor(Math.random() * pool.length)];
      lab.prev = lab.quiz; lab.answer = null; lab.asked++;
      setLabFault(lab.quiz); return;
    }
    if (t.hasAttribute("data-ans") && !lab.answer) {
      lab.answer = t.getAttribute("data-ans");
      if (lab.answer === lab.quiz) lab.right++;
      renderAll(); return;
    }
  });

  /* =========================================================
     탭
     ========================================================= */
  function go(n) {
    n = +n || 1;
    if (n === tab && pc === (n === 3 ? pcLab : pcMain)) { renderAll(); return; }
    skipAll();
    tab = n;
    pc = tab === 3 ? pcLab : pcMain;
    view = pc.snapshot();
    failIds = {}; lastHops = [];
    Array.prototype.forEach.call($("tabs").children, function (b) {
      b.classList.toggle("on", +b.getAttribute("data-tab") === tab);
    });
    $("nowMsg").textContent = "사용자 화면에서 무언가를 해 보면, 여기서 컴퓨터 안의 일이 차례로 보입니다.";
    $("nowWhere").textContent = "";
    $("capAct").textContent = "🔍 컴퓨터 내부"; $("capStep").textContent = "";
    setMode("user"); setLast();
    if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
    renderAll();
  }
  $("tabs").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-tab]") : null;
    if (t) go(t.getAttribute("data-tab"));
  });
  window.addEventListener("hashchange", function () { go(location.hash.slice(1)); });

  function renderAll() {
    renderBoard(); renderScreen(); renderButtons(); renderGuide(); lightChips(cur); updateCtl();
  }

  tab = 0;
  go(location.hash.slice(1) || 1);

  /* 검사용 손잡이 — 학생 화면에는 영향이 없다 */
  window.BootSim = {
    act: act, skip: skipAll, go: go,
    pc: function () { return pc; },
    view: function () { return view; },
    seen: seen,
    busy: function () { return queue.length + (cur ? 1 : 0); },
    mode: function () { return $("stage").getAttribute("data-mode"); },
    phase: function () { return cur ? (cur.kind || phase) : null; },
    setWatch: function (w) { watch = !!w; $("watch").checked = watch; },
    setSpeed: function (s) { speed = s; updateCtl(); },
    pause: function (p) { paused = !!p; updateCtl(); },
    packet: function () { var g = $("pkt"); return g ? { vis: g.getAttribute("visibility"), x: +g.getAttribute("data-x"), y: +g.getAttribute("data-y") } : null; },
    lab: lab, mission: function (k) { mission = k; renderGuide(); }
  };
})();
