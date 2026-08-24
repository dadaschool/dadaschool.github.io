/* ============================================================
   학생 화면 — 부품 핀과 확장보드 구멍을 눌러 선을 잇는다.

   조작 : 부품 핀을 누른 뒤 보드 구멍을 누르면 선이 생긴다 (거꾸로도 된다).
          선을 누르면 지워진다.
   ============================================================ */
(function (g) {
  "use strict";

  var prob = null;          /* 지금 푸는 문제 */
  var wires = [];           /* [{pi, pn, h, c}] */
  var sel = null;           /* 고른 것 : {kind:'pin', pi, pn} 또는 {kind:'hole', h} */
  var judged = null;        /* 채점 결과 (없으면 아직 안 눌렀다) */
  var hintHole = null;      /* 힌트로 깜박이는 구멍 */

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rich(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }
  function hex(k) {
    for (var i = 0; i < Parts.COLORS.length; i++) if (Parts.COLORS[i].k === k) return Parts.COLORS[i].hex;
    return "#1c5fb4";
  }
  function partOf(pi) { return Code.part(prob.parts[pi]); }
  function pinOf(pi, pn) {
    var ps = partOf(pi).pins;
    for (var i = 0; i < ps.length; i++) if (ps[i].n === pn) return ps[i];
    return null;
  }

  /* 선 색은 **앱이 정한다**(학생이 고르지 않는다).
     전원 빨강 · 접지 검정 · 신호는 **그 센서 안에서 몇 번째 신호핀인지**로 색을 달리한다.
     한 센서의 선이 모두 같은 색이면 어느 선이 어느 핀인지 알 수 없다(사용자 지적). */
  function colorOf(pi, pn) {
    var ps = partOf(pi).pins, k = 0;
    for (var i = 0; i < ps.length; i++) {
      var isSig = ps[i].role === "sig" || ps[i].role === "sda" || ps[i].role === "scl";
      if (ps[i].n === pn) return Parts.wireColor(ps[i].role, k);
      if (isSig) k++;
    }
    return "blue";
  }

  /* ── 시작 ──────────────────────────────────────────────
     🔴 주소만 열면 **6자리 숫자를 넣는 화면**이 먼저 나온다(2026-08-24 사용자 지시).
        문제를 받기 전에 보드·부품을 보여 주면 학생이 무엇을 해야 하는지 헷갈린다.
        `#q=…`(주소에 문제를 담은 것)나 `#code=NNNNNN` 으로 들어오면 곧바로 문제로 간다. */
  function boot() {
    bindOnce();
    Code.ping(function () {});      /* 서버가 있는지 미리 물어 둔다 (byCode 가 쓴다) */

    var p = Code.fromUrl();
    var m = /[#&]code=(\d{6})/.exec(location.hash);
    if (p) { prob = p; startPlay(); }
    else if (m) { $("code6").value = m[1]; go6(); }
    else showStart();

    window.addEventListener("resize", drawWires);

    /* 무대의 크기가 바뀌면 다시 그린다.
       `resize` 만 듣고 있으면 **글꼴이 늦게 뜰 때·부품 카드가 늘어날 때** 선이
       구멍에서 떨어진 채로 남는다(가로로 굴리며 확인하다 실제로 봤다). */
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { drawWires(); });
      ro.observe($("stage"));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWires);
    window.addEventListener("hashchange", function () {
      var q = Code.fromUrl();
      if (q) { prob = q; startPlay(); return; }
      var c = /[#&]code=(\d{6})/.exec(location.hash);
      if (c) { $("code6").value = c[1]; go6(); }
    });
  }

  /* 시작 화면 ↔ 문제 화면 — 한 곳에서만 여닫는다 */
  function showStart() {
    $("startCard").hidden = false;
    $("playWrap").hidden = true;
    $("title").textContent = "마이크로비트 연결 시뮬레이터";
  }
  function startPlay() {
    $("startCard").hidden = true;
    $("playWrap").hidden = false;
    reset(true);
  }

  function reset(full) {
    wires = []; sel = null; judged = null; hintHole = null;
    if (full) {
      $("title").textContent = prob.t;
      $("boardHost").innerHTML = Board.render(prob);
      paintParts();
      paintColors();
      paintPrep();
    }
    paintScore();
    $("res").innerHTML = '<p class="hint">선을 다 이은 뒤 <b>확인하기</b> 를 누르세요.</p>';
    $("doneBox").innerHTML = "";
    drawWires();
    paintTable();
    syncMarks();
  }

  /* ── 준비물 ──────────────────────────────────────────── */
  function paintPrep() {
    var names = prob.parts.map(function (e) {
      var p = Code.part(e);
      return p.name + (p.model ? " (" + p.model + ")" : "");
    });
    var ex = (prob.ext || []).length
      ? " · 확장프로그램 " + prob.ext.map(function (x) { return "「" + x + "」"; }).join(" ")
      : "";
    $("prep").innerHTML = "마이크로비트 · Keyestudio 확장보드 · " + esc(names.join(" · ")) +
      (prob.usb ? " · 보조배터리" : "") + esc(ex);
  }

  /* ── 부품 카드 ───────────────────────────────────────── */
  function paintParts() {
    var h = "";
    prob.parts.forEach(function (entry, pi) {
      var p = Code.part(entry);
      /* 전원은 3V3 아니면 5V 다(«아무거나» 를 없앴다). 5V 는 눈에 띄게 둔다 —
         꽂을 자리가 좁고 학생이 가장 많이 틀리는 곳이다 */
      var five = p.power === "5V";
      h += '<div class="part" style="background:' + esc(p.pcb) + '">';
      h += Parts.face(p.face);
      h += '<div class="pinfo"><div class="pname">' + esc(p.name) + "</div>" +
           '<div class="pmodel">' + esc(p.model || "") + "</div>" +
           '<span class="ppower' + (five ? "" : " any") + '">전원 <b>' + esc(p.power) +
           "</b></span></div>";
      h += '<div class="ppins">';
      p.pins.forEach(function (pin) {
        var want = (entry.pin || {})[pin.n];
        var off = pin.role === "sig" && (want === null || want === undefined || want === "");
        var sub = off ? "쓰지 않음" : (pin.role === "sig" ? want + "번" : (pin.sub || Parts.ROLE_NAME[pin.role]));
        h += '<div class="ppin' + (off ? " done" : "") + '">' +
               '<span class="plab"><b>' + esc(pin.n) + "</b><i>" + esc(sub) + "</i></span>" +
               (off
                 ? '<span class="ho nc" title="쓰지 않는 핀"></span>'
                 : '<button type="button" class="ho ' + roleCol(pin.role) + '" data-pi="' + pi +
                   '" data-pn="' + esc(pin.n) + '" aria-label="' + esc(p.name + " " + pin.n + " 핀") + '"></button>') +
             "</div>";
      });
      h += "</div></div>";
    });
    $("parts").innerHTML = h;
  }

  /* 부품 핀의 구멍 색 — 학생이 «이 핀은 무슨 핀인가» 를 색으로도 알게 한다 */
  function roleCol(role) {
    if (role === "vcc") return "v";
    if (role === "gnd") return "g";
    return "s";
  }

  /* ── 색 안내 ─────────────────────────────────────────── */
  /* 학생이 색을 고르지 않으므로 «무슨 색이 무슨 뜻인지» 만 보여 준다 */
  function paintColors() {
    var used = {};
    prob.parts.forEach(function (entry, pi) {
      Code.part(entry).pins.forEach(function (pin) {
        var want = (entry.pin || {})[pin.n];
        if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
        used[colorOf(pi, pin.n)] = true;
      });
    });
    $("picks").innerHTML = Parts.COLORS.filter(function (c) { return used[c.k]; })
      .map(function (c) {
        return '<span class="leg"><span class="dot" style="background:' + c.hex + '"></span>' +
               esc(c.name) + " <i>" + esc(c.use) + "</i></span>";
      }).join("");
  }

  /* ── 눌렀을 때 ───────────────────────────────────────── */
  function bindOnce() {
    document.addEventListener("click", function (ev) {
      var t = ev.target;

      /* 번호 배지를 누르면 그 선을 지운다 — 선 위를 누르는 방식은 쓸 수 없다.
         선을 보드 «위» 에 그리기 때문에, 선을 누르는 넓은 판을 두면 그 판이
         보드의 구멍 클릭을 가로챈다(구멍을 누르려는데 선이 지워진다). */
      var tg = t.closest && t.closest("g.tagno");
      if (tg) { cutWire(Number(tg.dataset.wire)); return; }

      var ho = t.closest && t.closest(".ho");
      if (ho && !ho.classList.contains("nc") && !ho.classList.contains("off")) {
        if (ho.dataset.pn !== undefined) tapPin(Number(ho.dataset.pi), ho.dataset.pn);
        else if (ho.dataset.h) tapHole(ho.dataset.h);
        return;
      }

    });

    /* 6자리 코드 — 시작 화면과 «다른 문제 열기» 두 곳에 있고 하는 일은 같다.
       긴 코드·파일로 여는 길은 지금 쓰지 않는다(2026-08-24 사용자 지시).
       `js/code.js` 에는 그 기능이 남아 있으니 필요하면 화면만 되살리면 된다. */
    bindCode("code6", "code6msg", "btnGo6");
    bindCode("code6b", "code6bmsg", "btnGo6b");
    $("btnDemo").onclick = function () { prob = Code.demo(); startPlay(); };
    $("btnBackStart").onclick = function () {
      location.hash = "";
      $("code6").value = ""; $("code6b").value = "";
      $("code6msg").textContent = "여섯 자리를 다 넣으면 저절로 시작합니다.";
      showStart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    $("btnCheck").onclick = check;
    $("btnPrintTable").onclick = printTable;
    $("btnHint").onclick = hint;
    $("btnUndo").onclick = function () { if (wires.length) { wires.pop(); after(); } };
    $("btnClear").onclick = function () { if (wires.length && confirm("선을 모두 지울까요?")) { wires = []; after(); } };
    /* ⚠ 긴 코드(`MBC1.…`)·문제 파일로 여는 단추는 **학생 화면에서 뺐다**
       (2026-08-24 사용자 지시 — *"일단 지금은 긴코드 접속은 사용안할거야"*).
       `js/code.js` 의 `decode`·`readFile` 은 그대로 있으니, 필요해지면
       화면에 칸만 다시 만들면 된다. 주소에 담는 `#q=…` 도 여전히 열린다. */
  }

  /* 6자리 코드 칸 이어 주기 — 여섯 자리를 다 넣으면 저절로 시작한다
     (학생이 단추를 못 찾는 일을 막는다) */
  function bindCode(inId, msgId, btnId) {
    var go = function () { go6(inId, msgId); };
    $(btnId).onclick = go;
    $(inId).onkeydown = function (ev) { if (ev.key === "Enter") go(); };
    $(inId).oninput = function () {
      var v = this.value.replace(/\D/g, "").slice(0, 6);
      if (v !== this.value) this.value = v;
      $(msgId).textContent = "";
      if (v.length === 6) go();
    };
  }

  /* 6자리 코드 → 그 문제로 바로 간다 */
  function go6(inId, msgId) {
    inId = inId || "code6"; msgId = msgId || "code6msg";
    var v = String($(inId).value || "").replace(/\D/g, "");
    if (v.length !== 6) { $(msgId).textContent = "숫자 6자리를 넣어 주세요."; return; }
    $(msgId).textContent = "찾고 있습니다…";
    Code.byCode(v, function (p, err) {
      if (!p) {
        $(msgId).innerHTML = "❌ " + esc(err || "없는 번호입니다") +
          " <b>선생님께 번호를 다시 물어보세요.</b>";
        return;
      }
      $(msgId).textContent = "";
      prob = p;
      /* 새로고침해도 그 문제가 남게 주소에 담아 둔다 */
      location.hash = "code=" + v;
      startPlay();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function tapPin(pi, pn) {
    /* 이미 이어진 핀을 다시 누르면 **그 선을 지운다.** 「선을 눌러 지우세요」 라고만
       알려 주던 때에는 학생이 지우는 길을 찾지 못했다. */
    var w0 = wireOfPin(pi, pn);
    if (w0 >= 0) {
      say("<b>" + esc(partOf(pi).name + " · " + pn) + "</b> 의 선을 지웠습니다.");
      cutWire(w0);
      return;
    }
    if (sel && sel.kind === "hole") { join(pi, pn, sel.h); return; }
    sel = (sel && sel.kind === "pin" && sel.pi === pi && sel.pn === pn) ? null : { kind: "pin", pi: pi, pn: pn };
    if (sel) {
      var pin = pinOf(pi, pn);
      say("<b>" + esc(partOf(pi).name + " · " + pn) + "</b> 를 골랐습니다 (" +
          esc(Parts.ROLE_NAME[pin.role]) + "). 이제 보드에서 꽂을 구멍을 누르세요.");
    } else say("");
    syncMarks();
  }

  function tapHole(h) {
    /* 이미 쓰는 구멍을 다시 누르면 그 선을 지운다 (핀과 같은 규칙) */
    var w0 = wireOfHole(h);
    if (w0 >= 0) {
      say("<b>" + esc(Board.label(h)) + "</b> 에 꽂혀 있던 선을 지웠습니다.");
      cutWire(w0);
      return;
    }
    if (sel && sel.kind === "pin") { join(sel.pi, sel.pn, h); return; }
    sel = (sel && sel.kind === "hole" && sel.h === h) ? null : { kind: "hole", h: h };
    if (sel) say("<b>" + esc(Board.label(h)) + "</b> 구멍을 골랐습니다. 이제 이을 부품의 핀을 누르세요.");
    else say("");
    syncMarks();
  }

  function join(pi, pn, h) {
    wires.push({ pi: pi, pn: pn, h: h, c: colorOf(pi, pn) });
    sel = null; hintHole = null;
    say("<b>" + esc(partOf(pi).name + " · " + pn) + "</b> → <b>" + esc(Board.label(h)) +
        "</b> 이었습니다. <span class=\"pm\">번호 동그라미를 누르면 지워집니다.</span>");
    after();
  }

  function cutWire(i) { wires.splice(i, 1); after(); }
  function after() {
    judged = null;
    $("doneBox").innerHTML = "";
    paintScore(); drawWires(); paintTable(); syncMarks();
  }

  function wireOfPin(pi, pn) {
    for (var i = 0; i < wires.length; i++) if (wires[i].pi === pi && wires[i].pn === pn) return i;
    return -1;
  }
  function wireOfHole(h) {
    for (var i = 0; i < wires.length; i++) if (wires[i].h === h) return i;
    return -1;
  }
  function say(html) { $("tip").innerHTML = html || "&nbsp;"; }

  /* ── 표시 상태 맞추기 ────────────────────────────────── */
  function syncMarks() {
    document.querySelectorAll(".ho").forEach(function (el) {
      el.classList.remove("sel", "busy", "judge-ok", "judge-bad");
    });
    if (sel) {
      var q = sel.kind === "pin"
        ? '.ho[data-pi="' + sel.pi + '"][data-pn="' + CSS.escape(sel.pn) + '"]'
        : '.ho[data-h="' + CSS.escape(sel.h) + '"]';
      var el = document.querySelector(q);
      if (el) el.classList.add("sel");
    }
    if (hintHole) {
      var hh = document.querySelector('.ho[data-h="' + CSS.escape(hintHole) + '"]');
      if (hh) hh.classList.add("sel");
    }
    wires.forEach(function (w) {
      mark('.ho[data-h="' + CSS.escape(w.h) + '"]', "busy");
      mark('.ho[data-pi="' + w.pi + '"][data-pn="' + CSS.escape(w.pn) + '"]', "busy");
    });
    if (judged) {
      judged.rows.forEach(function (r) {
        mark('.ho[data-h="' + CSS.escape(r.hole) + '"]', r.ok ? "judge-ok" : "judge-bad");
      });
    }
    function mark(q, cls) { var e = document.querySelector(q); if (e) e.classList.add(cls); }
  }

  function paintScore() {
    var need = requiredCount();
    $("score").innerHTML = "이은 선 <b>" + wires.length + "</b> / 이어야 하는 선 <b>" + need + "</b>" +
      (judged ? " &nbsp;·&nbsp; 맞은 선 <b style='color:var(--ok)'>" + judged.good +
        "</b> · 틀린 선 <b style='color:var(--no)'>" + judged.bad + "</b>" : "");
    $("btnCheck").disabled = wires.length === 0;
    /* 다 맞히기 전에는 연결표를 뽑을 수 없다 — 틀린 표를 들고 꽂으면 부품이 탄다 */
    $("btnPrintTable").disabled = !(judged && judged.done);
    $("btnPrintTable").title = (judged && judged.done)
      ? "연결표를 종이로 뽑습니다" : "먼저 «확인하기» 로 모두 맞혀야 뽑을 수 있습니다";
    $("btnUndo").disabled = wires.length === 0;
    $("btnClear").disabled = wires.length === 0;
  }

  function requiredCount() {
    var n = 0;
    prob.parts.forEach(function (entry) {
      Code.part(entry).pins.forEach(function (pin) {
        var want = (entry.pin || {})[pin.n];
        if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
        n++;
      });
    });
    return n;
  }

  /* ── 선 그리기 ───────────────────────────────────────── */
  function drawWires() {
    var stage = $("stage"), svg = $("wires");
    if (!stage || !svg) return;
    var s = stage.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + Math.round(s.width) + " " + Math.round(s.height));
    svg.setAttribute("width", Math.round(s.width));
    svg.setAttribute("height", Math.round(s.height));

    /* 선이 꺾이는 «통로» — 부품 카드의 오른쪽 끝과 보드의 왼쪽 끝 사이.
       여기서만 꺾으므로 선이 부품 카드나 보드의 구멍 위를 지나가지 않는다. */
    var pr = $("parts").getBoundingClientRect(), br = $("board") ? $("board").getBoundingClientRect() : null;
    var lane = br ? { a: pr.right - s.left + 14, b: br.left - s.left - 14 } : null;

    var h = "";
    wires.forEach(function (w, i) {
      var a = center('.ho[data-pi="' + w.pi + '"][data-pn="' + CSS.escape(w.pn) + '"]', s);
      var b = center('.ho[data-h="' + CSS.escape(w.h) + '"]', s);
      if (!a || !b) return;
      var d = elbow(a, b, i, lane);
      var col = hex(w.c);
      var st = judged ? judged.rows.filter(function (r) { return r.pi === w.pi && r.pn === w.pn; })[0] : null;
      var r1 = function (n) { return Math.round(n * 10) / 10; };

      if (st) h += '<path class="glow" d="' + d + '" stroke="' + (st.ok ? "#2f9e44" : "#e03131") + '"/>';
      h += '<path class="case" d="' + d + '"/>';
      h += '<path class="w" d="' + d + '" stroke="' + col + '"/>';
      /* 선의 두 끝에 알을 박는다 — «이 구멍» 이라는 것이 한눈에 보이게 */
      h += '<circle class="end" cx="' + r1(a.x) + '" cy="' + r1(a.y) + '" r="4.5" fill="' + col + '"/>';
      h += '<circle class="end" cx="' + r1(b.x) + '" cy="' + r1(b.y) + '" r="4.5" fill="' + col + '"/>';
      /* 번호 배지 — 아래 연결표의 번호와 같다. 실물에 꽂을 때 표와 대조하며 쓴다.
         🔴 **부품 핀 바로 옆**에 놓는다. 꺾이는 세로 줄 위에 놓았더니 차선 간격(약 13px)이
            배지 지름(19px)보다 좁아 **서로 겹쳤다**. 핀의 y 는 저마다 다르므로 여기서는 겹치지 않는다. */
      var bx = r1(lane ? lane.a + 12 : a.x + 22), by = r1(a.y);
      h += '<g class="tagno" data-wire="' + i + '" tabindex="0" role="button">' +
           '<circle cx="' + bx + '" cy="' + by + '" r="10.5" fill="' + col + '"/>' +
           '<text x="' + bx + '" y="' + by + '">' + (i + 1) + "</text>" +
           "<title>" + (i + 1) + "번 선 — 누르면 지워집니다</title></g>";
    });
    svg.innerHTML = h;

    function center(q, s) {
      var e = document.querySelector(q);
      if (!e) return null;
      var r = e.getBoundingClientRect();
      return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
    }
  }

  /* 회로도처럼 직각으로 꺾는다. 꺾는 자리는 **통로 안에서** 선마다 조금씩 옮겨
     겹치지 않게 한다. 통로를 벗어나면 구멍 위에 선이 얹히므로 반드시 안으로 잘라 넣는다. */
  function elbow(a, b, i, lane) {
    var mx;
    if (lane && lane.b > lane.a + 20) {
      var n = Math.max(1, Math.min(wires.length, 10));      /* 통로에 낼 차선 수 */
      var step = (lane.b - lane.a) / (n + 1);
      mx = lane.a + step * ((i % n) + 1);
    } else {
      mx = a.x + (b.x - a.x) * 0.42 + ((i % 7) - 3) * 12;    /* 통로가 좁으면 예전 방식 */
    }
    if (lane) mx = Math.max(lane.a, Math.min(lane.b, mx));
    var r = function (v) { return Math.round(v * 10) / 10; };
    return "M" + r(a.x) + " " + r(a.y) + " H" + r(mx) + " V" + r(b.y) + " H" + r(b.x);
  }

  /* ── 확인하기 ────────────────────────────────────────── */
  function check() {
    judged = Judge.all(prob, wires, Code.part);
    hintHole = null;
    var h = "";

    judged.rows.forEach(function (r) {
      var cls = r.ok ? (r.warn ? "warn" : "ok") : "bad";
      var mk = r.ok ? (r.warn ? "⚠" : "✓") : "✗";
      h += '<div class="rline ' + cls + '"><span class="mk">' + mk + "</span><div class=\"rt\">" +
             "<b>" + esc(r.part + " · " + r.pn) + "</b> → <code>" + esc(Board.label(r.hole)) + "</code>" +
             (r.msg ? "<p>" + rich(r.msg) + "</p>" : "") +
             (r.warn ? "<p>" + rich(r.warn) + "</p>" : "") +
           "</div></div>";
    });

    judged.missing.forEach(function (m) {
      h += '<div class="rline bad"><span class="mk">–</span><div class="rt"><b>' +
           esc(m.part + " · " + m.pn) + "</b>" + Parts.josa(m.pn, "은는") +
           " 아직 이어지지 않았습니다 (" + esc(Parts.ROLE_NAME[m.role]) + ").</div></div>";
    });

    $("res").innerHTML = h;
    paintScore();
    drawWires();
    paintTable();
    syncMarks();

    if (judged.done) {
      var extra = judged.warns
        ? '<p class="hint">색 약속만 조금 다릅니다 — 위의 ⚠ 를 보고 다음에는 맞춰 보세요.</p>' : "";
      $("doneBox").innerHTML =
        '<div class="done"><h2>🎉 연결을 모두 맞혔습니다</h2>' +
        "<p>이제 아래 연결표대로 실물에 꽂으면 됩니다.</p>" + extra + "</div>" +
        extCard();
      $("doneBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      $("doneBox").innerHTML = "";
    }
  }

  function extCard() {
    if (!(prob.ext || []).length) return "";
    return '<div class="extcard"><b>선을 이었다고 끝이 아닙니다.</b><br>' +
      "MakeCode 에서 <b>확장프로그램</b>을 추가해야 이 부품의 블록이 나옵니다 — " +
      prob.ext.map(function (x) { return '<span class="tagx">' + esc(x) + "</span>"; }).join(" ") +
      '<p class="hint" style="margin-top:6px">MakeCode → 톱니바퀴(⚙) → <b>확장프로그램</b> → 이름을 검색해 추가</p></div>';
  }

  /* ── 연결표 — 늘 보이고, 선을 이을 때마다 바로 늘어난다 ────────
     이 표를 보고 **실물에 꽂는다.** 표의 번호가 화면의 선 위 배지 번호와 같다. */
  function paintTable() {
    if (!wires.length) {
      $("tableBox").innerHTML =
        '<p class="hint">선을 이으면 여기에 <b>어디와 어디를 이었는지</b> 표로 쌓입니다. ' +
        "이 표를 보고 실물에 꽂습니다.</p>";
      return;
    }
    var rows = "";
    wires.forEach(function (w, i) {
      var pin = pinOf(w.pi, w.pn), c = null;
      Parts.COLORS.forEach(function (x) { if (x.k === w.c) c = x; });
      var st = judged ? judged.rows.filter(function (r) { return r.pi === w.pi && r.pn === w.pn; })[0] : null;
      var mk = !st ? "" : (st.ok ? (st.warn ? "⚠" : "✓") : "✗");
      var cls = !st ? "" : (st.ok ? (st.warn ? " rw" : " ro") : " rb");
      rows += '<tr class="' + cls.trim() + '">' +
        '<td class="c"><span class="wno" style="background:' + (c ? c.hex : "#888") + '">' + (i + 1) + "</span></td>" +
        "<td>" + esc(partOf(w.pi).name) + "</td>" +
        '<td class="c"><b>' + esc(w.pn) + "</b></td>" +
        '<td class="c">' + esc(Parts.ROLE_NAME[pin.role]) + "</td>" +
        '<td class="c">→</td>' +
        '<td class="c"><b>' + esc(Board.label(w.h)) + "</b></td>" +
        '<td><span class="swatch" style="background:' + (c ? c.hex : "#888") + '"></span>' +
        esc(c ? c.name : "") + "</td>" +
        '<td class="c">' + mk + "</td></tr>";
    });
    $("tableBox").innerHTML =
      '<table class="tb wire"><tr><th class="c">번호</th><th>부품</th><th class="c">핀</th>' +
      '<th class="c">무슨 핀</th><th class="c"></th><th class="c">확장보드의 어디</th>' +
      '<th>선 색</th><th class="c">확인</th></tr>' + rows + "</table>" +
      '<p class="hint">번호는 화면에서 그 선 위에 붙어 있는 동그라미 번호와 같습니다.</p>';
  }

  /* 다 맞힌 연결표를 종이로 뽑는다 — 실물에 꽂을 때 화면을 보지 않아도 되게.
     ⚠ 다 맞히기 전에는 뽑을 수 없다(틀린 표를 들고 실물에 꽂으면 부품이 탄다). */
  function printTable() {
    if (!judged || !judged.done) return;
    var rows = wires.map(function (w, i) {
      var pin = pinOf(w.pi, w.pn), c = null;
      Parts.COLORS.forEach(function (x) { if (x.k === w.c) c = x; });
      return "<tr><td class='c'><b>" + (i + 1) + "</b></td><td>" + esc(partOf(w.pi).name) +
             "</td><td class='c'><b>" + esc(w.pn) + "</b></td><td class='c'>" +
             esc(Parts.ROLE_NAME[pin.role]) + "</td><td class='c'>→</td><td class='c'><b>" +
             esc(Board.label(w.h)) + "</b></td><td class='c'>" + esc(c ? c.name : "") +
             "</td><td class='c' style='width:34px'></td></tr>";
    }).join("");
    var ext = (prob.ext || []).length ? prob.ext.join(" · ") : "없음";
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' +
      esc(prob.t) + " — 연결표</title><style>" +
      "body{font-family:'Malgun Gothic',sans-serif;margin:16mm 14mm;color:#111;font-size:12pt}" +
      "h1{font-size:17pt;margin:0 0 4px}.st{color:#555;margin:0 0 12px;font-size:11pt}" +
      "table{border-collapse:collapse;width:100%;font-size:11pt}" +
      "th,td{border:1px solid #999;padding:5px 7px}th{background:#eef2ff}td.c,th.c{text-align:center}" +
      ".nm{margin:0 0 12px;font-size:11pt}.nm span{display:inline-block;border-bottom:1px solid #333;width:90px;margin-right:18px}" +
      ".bx{border:1px solid #999;border-left:5px solid #333;padding:8px 12px;margin:12px 0;font-size:11pt}" +
      "@page{size:A4;margin:14mm}</style></head><body>" +
      "<h1>" + esc(prob.t) + " — 연결표</h1>" +
      '<p class="st">점퍼 V1 = ' + esc(prob.v1) + " · V2 = " + esc(prob.v2) +
      " &nbsp;|&nbsp; 확장프로그램 : " + esc(ext) + "</p>" +
      '<p class="nm">학년·반 <span></span> 번호 <span></span> 이름 <span></span></p>' +
      "<table><tr><th class='c'>번호</th><th>부품</th><th class='c'>핀</th><th class='c'>무슨 핀</th>" +
      "<th class='c'></th><th class='c'>확장보드의 어디</th><th class='c'>선 색</th><th class='c'>꽂음</th></tr>" +
      rows + "</table>" +
      '<div class="bx"><b>꽂기 전에 확인</b><br>' +
      "① 전원을 뽑아 둔 상태에서 꽂는다 &nbsp; ② 빨강(전원)·검정(접지)을 먼저, 신호선을 나중에<br>" +
      "③ 다 꽂은 뒤 <b>한 번 더 표와 대조</b>하고 전원을 넣는다</div>" +
      "</body></html>";
    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 막혀 있습니다.\n주소창 오른쪽의 팝업 차단 표시를 눌러 허용해 주세요."); return; }
    w.document.open(); w.document.write(html); w.document.close();
    /* 인쇄 창이 두 번 뜨지 않게 문패를 둔다 (js/print.js 와 같은 이유 — 지우지 말 것) */
    var printed = false;
    function askPrint() { if (printed) return; printed = true; try { w.focus(); w.print(); } catch (e) {} }
    w.onload = askPrint;
    setTimeout(askPrint, 700);
  }

  /* ── 힌트 — 아직 안 이은 핀 하나의 «꽂을 자리» 를 깜박여 준다 ── */
  function hint() {
    var target = null;
    prob.parts.forEach(function (entry, pi) {
      if (target) return;
      var part = Code.part(entry);
      part.pins.forEach(function (pin) {
        if (target) return;
        var want = (entry.pin || {})[pin.n];
        if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
        if (wireOfPin(pi, pin.n) >= 0) return;
        target = { pi: pi, pin: pin, want: want, part: part };
      });
    });
    if (!target) { say("이을 핀이 남아 있지 않습니다. <b>확인하기</b> 를 눌러 보세요."); return; }

    var h = suggest(target.part, target.pin, target.want);
    if (!h) {
      /* 꽂을 자리가 모두 차 있는 경우 — 5V 단자가 하나뿐일 때 실제로 생긴다.
         «자리가 없다» 로 끝내지 않고 왜 그런지까지 알려 준다. */
      say("💡 <b>" + esc(target.part.name + " · " + target.pin.n) + "</b> 을 꽂을 자리가 " +
          "<b>이미 다 차 있습니다.</b> 다른 선을 눌러 지우고 자리를 바꿔 보세요" +
          (target.pin.role === "vcc" && target.part.power === "5V"
            ? " — <code>5V 단자</code> 는 한 곳뿐이라, 5V 가 필요한 부품이 여러 개면 " +
              "선생님이 점퍼 <code>V1</code> 을 5V 로 옮겨 주어야 합니다."
            : "."));
      sel = { kind: "pin", pi: target.pi, pn: target.pin.n };
      hintHole = null;
      syncMarks();
      return;
    }
    hintHole = h;
    sel = { kind: "pin", pi: target.pi, pn: target.pin.n };
    say("💡 <b>" + esc(target.part.name + " · " + target.pin.n) + "</b> (" +
        esc(Parts.ROLE_NAME[target.pin.role]) + ") " + Parts.josa(target.pin.n, "은는") +
        " <b>" + esc(Board.label(h)) + "</b> 에 꽂으면 됩니다. 노란 테두리가 깜박이는 곳입니다.");
    syncMarks();
    var el = document.querySelector('.ho[data-h="' + CSS.escape(h) + '"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  /* 꽂을 수 있는 자리를 «좋은 순서» 로 모두 늘어놓는다.
     정답이 여러 곳인 핀(전원·접지)이 있으므로 하나만 돌려주면 안 된다 —
     그 한 곳이 이미 차 있으면 힌트가 영원히 같은 자리를 가리킨다(실제로 그랬다). */
  function candidates(part, pin, want) {
    var g1 = Board.LEFT.map(function (n) { return "L-" + n; });
    var g2 = Board.RIGHT.filter(function (n) { return n !== "NC"; }).map(function (n) { return "R-" + n; })
      .concat(Board.IIC.map(function (n) { return "IIC-" + n; }))
      .concat(Board.SPI.map(function (n) { return "SPI-" + n; }));

    if (pin.role === "sda") return ["IIC-19-S", "R-19-S"];
    if (pin.role === "scl") return ["IIC-20-S", "R-20-S"];
    if (pin.role === "sig") {
      var n = Number(want);
      var list = [];
      if (n <= 9) list.push("L-" + n + "-S");
      else {
        list.push("R-" + n + "-S");
        if (Board.SPI.indexOf(n) >= 0) list.push("SPI-" + n + "-S");
        if (Board.IIC.indexOf(n) >= 0) list.push("IIC-" + n + "-S");
      }
      return list;
    }
    if (pin.role === "gnd")
      return g1.concat(g2).map(function (p) { return p + "-G"; });

    /* 전원 — 전압이 맞는 줄을 먼저, 그다음 단자 */
    var need = part.power || "any";
    var out = [];
    if (need === "any" || prob.v1 === need) out = out.concat(g1.map(function (p) { return p + "-V"; }));
    if (need === "any" || prob.v2 === need) out = out.concat(g2.map(function (p) { return p + "-V"; }));
    if (need === "any") out.push("PWR-5V", "PWR-3V3");
    else out.push(need === "5V" ? "PWR-5V" : "PWR-3V3");
    return out;
  }

  function suggest(part, pin, want) {
    var list = candidates(part, pin, want);
    for (var i = 0; i < list.length; i++) if (wireOfHole(list[i]) < 0) return list[i];
    return null;
  }

  g.App = { boot: boot };
})(window);
