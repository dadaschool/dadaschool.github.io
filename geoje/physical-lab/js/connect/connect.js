/* ============================================================
   Connect — 확장보드 연결 시뮬레이터를 «부품»으로 감싼 것

   mb-connect 의 js/app.js 를 가져와 다음을 뺐다:
     · 주소(#q=)·6자리 코드·데모·서버·Worker 층
     · 문서 전역 id (getElementById) → host 안에서만 찾는다
   그래서 한 페이지 안에서 차시마다 하나씩 붙일 수 있다.

   쓰는 법
     var c = Connect.mount(hostEl, prob, { onSolved: function(){...} });
     prob = { t, v1:"3V3", v2:"3V3", usb:false, color:true, ext:[],
              parts:[ { id:"pir", pin:{ OUT:0 } } ] }
     c.solved()  → 다 맞혔는가
     c.setProb(newProb)  → 다른 문제로 갈아 끼운다
     c.destroy()

   ⚠ board.js · judge.js · parts.js 는 mb-connect 에서 그대로 복제했다.
     그 앱에서 채점·보드·부품 사전을 고치면 여기도 반영할 것.
   ============================================================ */
(function (g) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rich(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/&lt;(\/?)(b|i|br)\s*\/?&gt;/gi, "<$1$2>");
  }
  function hex(k) {
    for (var i = 0; i < Parts.COLORS.length; i++) if (Parts.COLORS[i].k === k) return Parts.COLORS[i].hex;
    return "#1c5fb4";
  }

  /* 부품 항목 → 부품 정의 (mb-connect 의 js/code.js part() 와 같다) */
  function resolvePart(entry) {
    if (entry && entry.def) {
      var d = entry.def;
      return {
        id: "custom", name: d.name || "직접 만든 부품", model: d.model || "",
        pcb: d.pcb || "#39414d", face: "custom",
        power: d.power === "5V" ? "5V" : "3V3", ext: d.ext || "", note: d.note || "",
        pins: d.pins || []
      };
    }
    return Parts.byId(entry && entry.id) || {
      id: entry && entry.id, name: "(모르는 부품)", model: "", pcb: "#6b7280", face: "custom",
      power: "3V3", ext: "", note: "", pins: []
    };
  }

  function fillProb(o) {
    o = o || {};
    o.t = o.t || "연결 문제";
    o.v1 = o.v1 || "3V3";
    o.v2 = o.v2 || "3V3";
    o.usb = o.usb === true;              /* 기본은 보조배터리 없음 */
    o.color = o.color !== false;
    o.ext = o.ext || [];
    o.parts = (o.parts || []).map(function (p) { return { id: p.id, def: p.def, pin: p.pin || {} }; });
    return o;
  }

  var SHELL =
    '<div class="row" style="margin-bottom:8px">' +
      '<span class="cScore">이은 선 <b>0</b></span>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="cHint">💡 힌트</button>' +
      '<button type="button" class="cUndo">↶ 되돌리기</button>' +
      '<button type="button" class="cClear">🧹 지우기</button>' +
      '<button type="button" class="pri big cCheck">확인하기</button>' +
    '</div>' +
    '<div class="cBanner" hidden></div>' +
    '<p class="hint cTip" style="margin:0 0 8px">&nbsp;</p>' +
    '<div class="picks cPicks" style="margin:0 0 8px"></div>' +
    '<div class="stagescroll"><div class="stage cStage">' +
      '<svg class="wires cWires" xmlns="http://www.w3.org/2000/svg"></svg>' +
      '<div class="parts cParts"></div>' +
      '<div class="cBoardHost"></div>' +
    '</div></div>' +
    '<div class="cDone"></div>' +
    '<div class="row" style="margin:14px 0 8px">' +
      '<h3 style="margin:0">연결표 <span class="pm">— 이 표를 보고 실물에 꽂습니다</span></h3>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="cPrintTable" disabled>🖨 연결표 인쇄</button>' +
    '</div>' +
    '<div class="cTable"></div>' +
    '<h3 style="margin:14px 0 6px">확인 결과</h3>' +
    '<div class="res cRes"></div>';

  function mount(host, prob, opts) {
    opts = opts || {};
    prob = fillProb(prob);
    host.innerHTML = SHELL;

    var wires = [], sel = null, judged = null, hintHole = null;
    var q = function (s) { return host.querySelector(s); };

    var elStage = q(".cStage"), elWires = q(".cWires"), elParts = q(".cParts"),
        elBoardHost = q(".cBoardHost"), elRes = q(".cRes"), elDone = q(".cDone"),
        elTable = q(".cTable"), elScore = q(".cScore"),
        elPicks = q(".cPicks"), elTip = q(".cTip"), elBanner = q(".cBanner");
    var btnCheck = q(".cCheck"), btnPrint = q(".cPrintTable"), btnHint = q(".cHint"),
        btnUndo = q(".cUndo"), btnClear = q(".cClear");

    function partOf(pi) { return resolvePart(prob.parts[pi]); }
    function pinOf(pi, pn) {
      var ps = partOf(pi).pins;
      for (var i = 0; i < ps.length; i++) if (ps[i].n === pn) return ps[i];
      return null;
    }
    /* 선 색: 전원 빨강 · 접지 검정 · 신호는 그 센서 안에서 몇 번째 신호핀인지로 색을 달리 */
    function colorOf(pi, pn) {
      var ps = partOf(pi).pins, k = 0;
      for (var i = 0; i < ps.length; i++) {
        var isSig = ps[i].role === "sig" || ps[i].role === "sda" || ps[i].role === "scl";
        if (ps[i].n === pn) return Parts.wireColor(ps[i].role, k);
        if (isSig) k++;
      }
      return "blue";
    }
    function roleCol(role) { return role === "vcc" ? "v" : role === "gnd" ? "g" : "s"; }
    function say(html) { elTip.innerHTML = html || "&nbsp;"; }

    /* ── 그리기 ─────────────────────────────────────────── */
    function reset() {
      wires = []; sel = null; judged = null; hintHole = null;
      elBoardHost.innerHTML = Board.render(prob);
      paintParts(); paintColors();
      paintScore();
      elRes.innerHTML = '<p class="hint">선을 다 이은 뒤 <b>확인하기</b> 를 누르세요.</p>';
      elDone.innerHTML = "";
      elBanner.hidden = true; elBanner.className = "cBanner";
      drawWires(); paintTable(); syncMarks();
    }

    function paintParts() {
      var h = "";
      prob.parts.forEach(function (entry, pi) {
        var p = resolvePart(entry);
        var five = p.power === "5V";
        h += '<div class="part" style="background:' + esc(p.pcb) + '">';
        h += Parts.face(p.face);
        h += '<div class="pinfo"><div class="pname">' + esc(p.name) + "</div>" +
             '<div class="pmodel">' + esc(p.model || "") + "</div>" +
             '<span class="ppower' + (five ? "" : " any") + '">전원 <b>' + esc(p.power) + "</b></span></div>";
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
      elParts.innerHTML = h;
    }

    function paintColors() {
      var used = {};
      prob.parts.forEach(function (entry, pi) {
        resolvePart(entry).pins.forEach(function (pin) {
          var want = (entry.pin || {})[pin.n];
          if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
          used[colorOf(pi, pin.n)] = true;
        });
      });
      elPicks.innerHTML = Parts.COLORS.filter(function (c) { return used[c.k]; }).map(function (c) {
        return '<span class="leg"><span class="dot" style="background:' + c.hex + '"></span>' +
               esc(c.name) + " <i>" + esc(c.use) + "</i></span>";
      }).join("");
    }

    function requiredCount() {
      var n = 0;
      prob.parts.forEach(function (entry) {
        resolvePart(entry).pins.forEach(function (pin) {
          var want = (entry.pin || {})[pin.n];
          if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
          n++;
        });
      });
      return n;
    }

    function paintScore() {
      var need = requiredCount();
      elScore.innerHTML = "이은 선 <b>" + wires.length + "</b> / <b>" + need + "</b>" +
        (judged ? " &nbsp; <b class='sOk'>✓ " + judged.good + "</b> <b class='sNo'>✗ " + judged.bad + "</b>" : "");
      btnCheck.disabled = wires.length === 0;
      btnPrint.disabled = !(judged && judged.done);
      btnUndo.disabled = wires.length === 0;
      btnClear.disabled = wires.length === 0;
    }

    /* ── 선택·연결 ─────────────────────────────────────── */
    function wireOfPin(pi, pn) {
      for (var i = 0; i < wires.length; i++) if (wires[i].pi === pi && wires[i].pn === pn) return i;
      return -1;
    }
    function wireOfHole(h) {
      for (var i = 0; i < wires.length; i++) if (wires[i].h === h) return i;
      return -1;
    }
    function tapPin(pi, pn) {
      var w0 = wireOfPin(pi, pn);
      if (w0 >= 0) { say("<b>" + esc(partOf(pi).name + " · " + pn) + "</b> 의 선을 지웠습니다."); cutWire(w0); return; }
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
      var w0 = wireOfHole(h);
      if (w0 >= 0) { say("<b>" + esc(Board.label(h)) + "</b> 에 꽂혀 있던 선을 지웠습니다."); cutWire(w0); return; }
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
      judged = null; elDone.innerHTML = "";
      elBanner.hidden = true; elBanner.className = "cBanner";
      paintScore(); drawWires(); paintTable(); syncMarks();
    }

    function syncMarks() {
      host.querySelectorAll(".ho").forEach(function (el) {
        el.classList.remove("sel", "busy", "judge-ok", "judge-bad");
      });
      if (sel) {
        var s = sel.kind === "pin"
          ? '.ho[data-pi="' + sel.pi + '"][data-pn="' + CSS.escape(sel.pn) + '"]'
          : '.ho[data-h="' + CSS.escape(sel.h) + '"]';
        var e = host.querySelector(s); if (e) e.classList.add("sel");
      }
      if (hintHole) {
        var hh = host.querySelector('.ho[data-h="' + CSS.escape(hintHole) + '"]');
        if (hh) hh.classList.add("sel");
      }
      wires.forEach(function (w) {
        mark('.ho[data-h="' + CSS.escape(w.h) + '"]', "busy");
        mark('.ho[data-pi="' + w.pi + '"][data-pn="' + CSS.escape(w.pn) + '"]', "busy");
      });
      if (judged) judged.rows.forEach(function (r) {
        mark('.ho[data-h="' + CSS.escape(r.hole) + '"]', r.ok ? "judge-ok" : "judge-bad");
      });
      function mark(s, cls) { var e = host.querySelector(s); if (e) e.classList.add(cls); }
    }

    /* ── 선 그리기 (mb-connect 와 같은 elbow 규칙) ──────── */
    function drawWires() {
      if (!elStage || !elWires) return;
      var s = elStage.getBoundingClientRect();
      elWires.setAttribute("viewBox", "0 0 " + Math.round(s.width) + " " + Math.round(s.height));
      elWires.setAttribute("width", Math.round(s.width));
      elWires.setAttribute("height", Math.round(s.height));

      var board = host.querySelector(".board");
      var pr = elParts.getBoundingClientRect();
      var br = board ? board.getBoundingClientRect() : null;
      var lane = br ? { a: pr.right - s.left + 14, b: br.left - s.left - 14 } : null;

      var h = "", r1 = function (n) { return Math.round(n * 10) / 10; };
      wires.forEach(function (w, i) {
        var a = center('.ho[data-pi="' + w.pi + '"][data-pn="' + CSS.escape(w.pn) + '"]', s);
        var b = center('.ho[data-h="' + CSS.escape(w.h) + '"]', s);
        if (!a || !b) return;
        var d = elbow(a, b, i, lane), col = hex(w.c);
        var st = judged ? judged.rows.filter(function (r) { return r.pi === w.pi && r.pn === w.pn; })[0] : null;
        if (st) h += '<path class="glow" d="' + d + '" stroke="' + (st.ok ? "#2f9e44" : "#e03131") + '"/>';
        h += '<path class="case" d="' + d + '"/>';
        h += '<path class="w" d="' + d + '" stroke="' + col + '"/>';
        h += '<circle class="end" cx="' + r1(a.x) + '" cy="' + r1(a.y) + '" r="4.5" fill="' + col + '"/>';
        h += '<circle class="end" cx="' + r1(b.x) + '" cy="' + r1(b.y) + '" r="4.5" fill="' + col + '"/>';
        var bx = r1(lane ? lane.a + 12 : a.x + 22), by = r1(a.y);
        /* 채점 뒤에는 번호 배지를 초록(맞음)·빨강(틀림)으로 칠해 보드 위에서 바로 눈에 띄게 한다.
           번호는 그대로 둔다 — 아래 연결표의 번호와 짝을 맞춰야 하기 때문이다. */
        var badgeCol = st ? (st.ok ? "#2f9e44" : "#e03131") : col;
        var badgeR = st && !st.ok ? 12.5 : 10.5;
        var badgeCls = st ? (st.ok ? " ok" : " bad") : "";
        h += '<g class="tagno' + badgeCls + '" data-wire="' + i + '" tabindex="0" role="button">' +
             (st ? '<circle cx="' + bx + '" cy="' + by + '" r="' + (badgeR + 3) +
               '" fill="none" stroke="' + badgeCol + '" stroke-width="2.5" opacity=".55"/>' : "") +
             '<circle cx="' + bx + '" cy="' + by + '" r="' + badgeR + '" fill="' + badgeCol + '"/>' +
             '<text x="' + bx + '" y="' + by + '">' + (st && !st.ok ? "✗" : (i + 1)) + "</text>" +
             "<title>" + (i + 1) + "번 선" + (st ? (st.ok ? " — 맞음" : " — 틀림") : "") +
             " · 누르면 지워집니다</title></g>";
      });
      elWires.innerHTML = h;

      function center(sSel, s) {
        var e = host.querySelector(sSel);
        if (!e) return null;
        var r = e.getBoundingClientRect();
        return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
      }
    }
    function elbow(a, b, i, lane) {
      var mx;
      if (lane && lane.b > lane.a + 20) {
        var n = Math.max(1, Math.min(wires.length, 10));
        var step = (lane.b - lane.a) / (n + 1);
        mx = lane.a + step * ((i % n) + 1);
      } else {
        mx = a.x + (b.x - a.x) * 0.42 + ((i % 7) - 3) * 12;
      }
      if (lane) mx = Math.max(lane.a, Math.min(lane.b, mx));
      var r = function (v) { return Math.round(v * 10) / 10; };
      return "M" + r(a.x) + " " + r(a.y) + " H" + r(mx) + " V" + r(b.y) + " H" + r(b.x);
    }

    /* ── 확인하기 ─────────────────────────────────────── */
    function check() {
      judged = Judge.all(prob, wires, resolvePart);
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
      elRes.innerHTML = h;
      paintScore(); drawWires(); paintTable(); syncMarks();

      /* 🔴 판정 결과를 «확인하기» 바로 아래에 큼직하게 띄운다.
         예전에는 결과가 보드·연결표 아래에 있어 학생이 틀린 줄 모르고 넘어갔다(사용자 신고). */
      if (judged.done) {
        elBanner.hidden = false;
        elBanner.className = "cBanner ok";
        elBanner.innerHTML = "🎉 <b>연결을 모두 맞혔습니다!</b> 아래 연결표대로 실물에 꽂으면 됩니다." +
          (judged.warns ? " <span class=\"bnote\">(선 색 약속만 조금 다릅니다 — 아래 ⚠ 참고)</span>" : "");
        var extra = judged.warns
          ? '<p class="hint">색 약속만 조금 다릅니다 — 위의 ⚠ 를 보고 다음에는 맞춰 보세요.</p>' : "";
        elDone.innerHTML =
          '<div class="done"><h2>🎉 연결을 모두 맞혔습니다</h2>' +
          "<p>이제 아래 연결표대로 실물에 꽂으면 됩니다.</p>" + extra + "</div>" + extCard();
        if (opts.onSolved) opts.onSolved();
      } else {
        elBanner.hidden = false;
        elBanner.className = "cBanner bad";
        elBanner.innerHTML =
          "❌ <b>아직 " + judged.bad + "곳이 틀렸어요.</b> 확장보드에서 " +
          "<span class=\"rout\">빨간 테두리</span> 가 틀린 곳입니다. " +
          "<button type=\"button\" class=\"bJump\">틀린 곳 보기 ▾</button>";
        elDone.innerHTML = "";
        var jb = elBanner.querySelector(".bJump");
        if (jb) jb.onclick = function () {
          var firstBad = elRes.querySelector(".rline.bad");
          if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
        };
      }
      elBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function extCard() {
      if (!(prob.ext || []).length) return "";
      return '<div class="extcard"><b>선을 이었다고 끝이 아닙니다.</b><br>' +
        "MakeCode 에서 <b>확장프로그램</b>을 추가해야 이 부품의 블록이 나옵니다 — " +
        prob.ext.map(function (x) { return '<span class="tagx">' + esc(x) + "</span>"; }).join(" ") +
        '<p class="hint" style="margin-top:6px">MakeCode → 톱니바퀴(⚙) → <b>확장프로그램</b> → 이름을 검색해 추가</p></div>';
    }

    /* ── 연결표 ───────────────────────────────────────── */
    function paintTable() {
      if (!wires.length) {
        elTable.innerHTML = '<p class="hint">선을 이으면 여기에 <b>어디와 어디를 이었는지</b> 표로 쌓입니다.</p>';
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
          '<td><span class="swatch" style="background:' + (c ? c.hex : "#888") + '"></span>' + esc(c ? c.name : "") + "</td>" +
          '<td class="c">' + mk + "</td></tr>";
      });
      elTable.innerHTML =
        '<table class="tb wire"><tr><th class="c">번호</th><th>부품</th><th class="c">핀</th>' +
        '<th class="c">무슨 핀</th><th class="c"></th><th class="c">확장보드의 어디</th>' +
        '<th>선 색</th><th class="c">확인</th></tr>' + rows + "</table>" +
        '<p class="hint">번호는 화면에서 그 선 위에 붙어 있는 동그라미 번호와 같습니다.</p>';
    }
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
        "③ 다 꽂은 뒤 <b>한 번 더 표와 대조</b>하고 전원을 넣는다</div></body></html>";
      var w = window.open("", "_blank");
      if (!w) { alert("팝업이 막혀 있습니다. 주소창 오른쪽의 팝업 차단 표시를 눌러 허용해 주세요."); return; }
      w.document.open(); w.document.write(html); w.document.close();
      var printed = false;
      function askPrint() { if (printed) return; printed = true; try { w.focus(); w.print(); } catch (e) {} }
      w.onload = askPrint;
      setTimeout(askPrint, 700);
    }

    /* ── 힌트 (mb-connect candidates/suggest 규칙) ─────── */
    function hint() {
      var target = null;
      prob.parts.forEach(function (entry, pi) {
        if (target) return;
        var part = resolvePart(entry);
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
        say("💡 <b>" + esc(target.part.name + " · " + target.pin.n) + "</b> 을 꽂을 자리가 " +
            "<b>이미 다 차 있습니다.</b> 다른 선을 눌러 지우고 자리를 바꿔 보세요" +
            (target.pin.role === "vcc" && target.part.power === "5V"
              ? " — <code>5V 단자</code> 는 한 곳뿐입니다."
              : "."));
        sel = { kind: "pin", pi: target.pi, pn: target.pin.n }; hintHole = null; syncMarks(); return;
      }
      hintHole = h; sel = { kind: "pin", pi: target.pi, pn: target.pin.n };
      say("💡 <b>" + esc(target.part.name + " · " + target.pin.n) + "</b> (" +
          esc(Parts.ROLE_NAME[target.pin.role]) + ") " + Parts.josa(target.pin.n, "은는") +
          " <b>" + esc(Board.label(h)) + "</b> 에 꽂으면 됩니다. 노란 테두리가 깜박이는 곳입니다.");
      syncMarks();
      var el = host.querySelector('.ho[data-h="' + CSS.escape(h) + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    function candidates(part, pin, want) {
      var g1 = Board.LEFT.map(function (n) { return "L-" + n; });
      var g2 = Board.RIGHT.filter(function (n) { return n !== "NC"; }).map(function (n) { return "R-" + n; })
        .concat(Board.IIC.map(function (n) { return "IIC-" + n; }))
        .concat(Board.SPI.map(function (n) { return "SPI-" + n; }));
      if (pin.role === "sda") return ["IIC-19-S", "R-19-S"];
      if (pin.role === "scl") return ["IIC-20-S", "R-20-S"];
      if (pin.role === "sig") {
        var n = Number(want), list = [];
        if (n <= 9) list.push("L-" + n + "-S");
        else {
          list.push("R-" + n + "-S");
          if (Board.SPI.indexOf(n) >= 0) list.push("SPI-" + n + "-S");
          if (Board.IIC.indexOf(n) >= 0) list.push("IIC-" + n + "-S");
        }
        return list;
      }
      if (pin.role === "gnd") return g1.concat(g2).map(function (p) { return p + "-G"; });
      var need = part.power || "any", out = [];
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

    /* ── 이벤트 (host 안에서만) ───────────────────────── */
    function onClick(ev) {
      var t = ev.target;
      var tg = t.closest && t.closest("g.tagno");
      if (tg && host.contains(tg)) { cutWire(Number(tg.dataset.wire)); return; }
      var ho = t.closest && t.closest(".ho");
      if (ho && host.contains(ho) && !ho.classList.contains("nc") && !ho.classList.contains("off")) {
        if (ho.dataset.pn !== undefined) tapPin(Number(ho.dataset.pi), ho.dataset.pn);
        else if (ho.dataset.h) tapHole(ho.dataset.h);
      }
    }
    host.addEventListener("click", onClick);
    btnCheck.onclick = check;
    btnPrint.onclick = printTable;
    btnHint.onclick = hint;
    btnUndo.onclick = function () { if (wires.length) { wires.pop(); after(); } };
    btnClear.onclick = function () { if (wires.length && confirm("선을 모두 지울까요?")) { wires = []; after(); } };

    var onResize = function () { drawWires(); };
    window.addEventListener("resize", onResize);
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { drawWires(); }); ro.observe(elStage); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWires);

    reset();

    return {
      solved: function () { return !!(judged && judged.done); },
      redraw: drawWires,
      setProb: function (p) { prob = fillProb(p); reset(); },
      destroy: function () {
        host.removeEventListener("click", onClick);
        window.removeEventListener("resize", onResize);
        if (ro) ro.disconnect();
        host.innerHTML = "";
      }
    };
  }

  g.Connect = { mount: mount };
})(window);
