/* ============================================================
   Bench — 공통 «센서 실험대»

   차시 데이터의 cfg.type 으로 갈라진다:
     "digital-presence"  사람/물체가 있으면 1, 없으면 «유지시간» 만큼 1 유지 (PIR·리드·적외선 장애물 …)
     "analog-level"      학생이 센서값을 끌어 올리고 내린다 → 임계값을 넘으면 출력이 켜진다 (조도·물·압력 …)
     "rgb-mix"           R·G·B 세 값을 섞어 색을 만든다 (RGB LED)

   규칙 (mb-noise 와 같다)
     · requestAnimationFrame 을 쓰지 않는다. setInterval(…,100) + 상태 바뀔 때 즉시 그리기.
     · Math.random 을 쓰지 않는다.  · 저장하지 않는다.

   Bench.mount(hostEl, cfg) → { destroy() }
   ============================================================ */
(function (g) {
  "use strict";

  var W = 560, H = 340, DT = 100, KEEP = 130;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function realBox(real) {
    return el("div", "realbox", "<b>실물로는</b> " + real.real + "<br><b>여기서는</b> " + real.sim);
  }
  function mkCanvas() {
    var c = el("canvas"); c.width = W; c.height = H;
    c.setAttribute("aria-label", "센서 실험대 화면");
    return c;
  }

  /* ── 1. digital-presence (PIR 계열) ─────────────────── */
  function digitalPresence(host, cfg) {
    var canvas = mkCanvas(), ctx = canvas.getContext("2d");
    var left = el("div"); left.appendChild(canvas);
    left.appendChild(el("p", "rd", "화면을 눌러 사람을 <b>감지 구역 안/밖</b>으로 옮겨 보세요."));
    host.appendChild(left);
    var ctrl = el("div", "ctrl"); host.appendChild(ctrl);

    var lamp = el("div", "lamp", '<span class="bulb"></span><span class="lampt">OUT = 0</span>');
    ctrl.appendChild(lamp);
    var pbtn = el("button", "", "사람 들어오기 ▶"); pbtn.type = "button";
    ctrl.appendChild(el("div", "fld")).appendChild(pbtn);

    var hold = cfg.hold || { min: 0.5, max: 10, val: 3, step: 0.5, unit: "초", label: "감지 후 반응할 시간" };
    var holdVal = hold.val;
    var hf = el("div", "fld");
    hf.appendChild(el("label", "", hold.label + " : <b class=\"hv\">" + holdVal + "</b> " + (hold.unit || "초")));
    var range = el("input"); range.type = "range";
    range.min = hold.min; range.max = hold.max; range.step = hold.step || 0.5; range.value = holdVal;
    hf.appendChild(range);
    hf.appendChild(el("p", "rd", "= 코드의 <code>일시정지 (" + Math.round(holdVal * 1000) + ") ms</code>"));
    ctrl.appendChild(hf);

    var outs = cfg.outputs || [{ k: "led", name: "LED" }, { k: "relay", name: "릴레이(문)" }];
    var outK = outs[0].k;
    var of = el("div", "fld"); of.appendChild(el("label", "", "무엇을 켤까"));
    var seg = el("div", "seg");
    outs.forEach(function (o, i) {
      var bt = el("button", i === 0 ? "on" : "", o.name); bt.type = "button";
      bt.onclick = function () {
        outK = o.k; seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        bt.classList.add("on"); draw();
      };
      seg.appendChild(bt);
    });
    of.appendChild(seg); ctrl.appendChild(of);
    if (cfg.real) ctrl.appendChild(realBox(cfg.real));

    var personIn = false, tPrev = Date.now(), sinceSeen = 9e9, line = [];
    var ZONE = { x: W * 0.30, w: W * 0.44 };

    function step(mark) {
      if (personIn) sinceSeen = 0;
      var out = sinceSeen < holdVal * 1000 ? 1 : 0;
      line.push({ p: personIn ? 1 : 0, o: out });
      while (line.length > KEEP) line.shift();
      draw();
    }
    function tick() {
      var now = Date.now(); var dt = now - tPrev; tPrev = now;
      if (!personIn) sinceSeen += dt;
      step();
    }
    function setPerson(v) {
      personIn = v; pbtn.textContent = v ? "사람 나가기 ◀" : "사람 들어오기 ▶";
      tPrev = Date.now(); step();
    }

    function draw() {
      var cur = line.length ? line[line.length - 1] : { p: 0, o: 0 };
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f2f6fc"; ctx.fillRect(12, 12, W - 24, 176);
      ctx.strokeStyle = "#c7d2e0"; ctx.lineWidth = 2; ctx.strokeRect(12, 12, W - 24, 176);
      ctx.fillStyle = cur.p ? "rgba(47,158,68,.16)" : "rgba(120,140,170,.10)";
      ctx.fillRect(ZONE.x, 14, ZONE.w, 172);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = cur.p ? "#2f9e44" : "#9aa7b8";
      ctx.strokeRect(ZONE.x, 14, ZONE.w, 172); ctx.setLineDash([]);
      ctx.fillStyle = "#68788d"; ctx.font = "13px 'Malgun Gothic',sans-serif";
      ctx.fillText("감지 구역", ZONE.x + 8, 30);
      ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(W - 34, 64, 14, 0, 6.3); ctx.fill();
      ctx.fillStyle = cur.p ? "#2f9e44" : "#94a3b8"; ctx.beginPath(); ctx.arc(W - 34, 64, 6, 0, 6.3); ctx.fill();
      var px = cur.p ? (ZONE.x + ZONE.w / 2) : (W * 0.14);
      ctx.fillStyle = cur.p ? "#1f6f47" : "#5b6875";
      ctx.beginPath(); ctx.arc(px, 120, 11, 0, 6.3); ctx.fill();
      ctx.fillRect(px - 9, 132, 18, 34);
      ctx.font = "12px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#5b6875";
      ctx.fillText(cur.p ? "구역 안" : "구역 밖", px - 20, 180);

      var on = cur.o === 1, ox = 40, oy = 214;
      ctx.fillStyle = "#1b2430"; ctx.font = "bold 13px 'Malgun Gothic',sans-serif";
      ctx.fillText("출력", ox, oy - 8);
      var oname = ""; outs.forEach(function (o) { if (o.k === outK) oname = o.name; });
      if (outK === "voice") {
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.moveTo(ox, oy + 16); ctx.lineTo(ox + 12, oy + 16); ctx.lineTo(ox + 24, oy + 4);
        ctx.lineTo(ox + 24, oy + 52); ctx.lineTo(ox + 12, oy + 40); ctx.lineTo(ox, oy + 40);
        ctx.closePath(); ctx.fill();
        if (on) {
          ctx.strokeStyle = "#2f9e44"; ctx.lineWidth = 2.5;
          [8, 15, 22].forEach(function (r) { ctx.beginPath(); ctx.arc(ox + 26, oy + 28, r, -0.9, 0.9); ctx.stroke(); });
          ctx.fillStyle = "#1f6f47"; ctx.font = "bold 15px 'Malgun Gothic',sans-serif";
          ctx.fillText("“어서 오세요!”", ox + 58, oy + 33);
        } else { ctx.fillStyle = "#94a3b8"; ctx.font = "13px 'Malgun Gothic',sans-serif"; ctx.fillText("조용", ox + 44, oy + 33); }
      } else if (outK === "relay") {
        ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, 46, 60);
        ctx.fillStyle = on ? "#d3f9d8" : "#eef2f7"; var dw = on ? 10 : 40;
        ctx.fillRect(ox + 3, oy + 3, dw, 54); ctx.strokeRect(ox + 3, oy + 3, dw, 54);
        ctx.fillStyle = "#5b6875"; ctx.fillText(on ? "문 열림" : "문 닫힘", ox + 56, oy + 34);
      } else {
        ctx.beginPath(); ctx.arc(ox + 22, oy + 30, 16, 0, 6.3);
        ctx.fillStyle = on ? "#ffd43b" : "#e2e8f0"; ctx.fill();
        ctx.strokeStyle = on ? "#e8a90c" : "#c7d2e0"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#5b6875"; ctx.fillText(on ? oname + " 켜짐" : oname + " 꺼짐", ox + 46, oy + 34);
      }
      ctx.font = "bold 38px 'Malgun Gothic',sans-serif";
      ctx.fillStyle = cur.o ? "#2f9e44" : "#94a3b8";
      ctx.fillText("OUT = " + cur.o, W - 210, oy + 38);
      ctx.font = "12px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#68788d";
      ctx.fillText(cur.o && !cur.p ? "사람이 나갔지만 아직 유지 중" : (cur.o ? "사람 감지" : "감지 없음"), W - 210, oy + 56);

      drawTimeline(ctx, line, [
        { key: "p", col: "#5b6875", lab: "사람" },
        { key: "o", col: "#2f9e44", lab: "OUT" }
      ]);
      lamp.classList.toggle("on", cur.o === 1);
      lamp.querySelector(".lampt").textContent = "OUT = " + cur.o;
    }

    pbtn.onclick = function () { setPerson(!personIn); };
    range.oninput = function () {
      holdVal = parseFloat(this.value);
      hf.querySelector(".hv").textContent = holdVal;
      hf.querySelector(".rd").innerHTML = "= 코드의 <code>일시정지 (" + Math.round(holdVal * 1000) + ") ms</code>";
      draw();
    };
    canvas.addEventListener("pointerdown", function (e) {
      var r = canvas.getBoundingClientRect(); var x = (e.clientX - r.left) * (W / r.width);
      setPerson(x >= ZONE.x && x <= ZONE.x + ZONE.w);
    });
    var timer = setInterval(tick, DT);
    setPerson(false);
    return { destroy: function () { clearInterval(timer); } };
  }

  /* ── 2. analog-level (조도·물·압력 …) ──────────────── */
  function analogLevel(host, cfg) {
    var s = cfg.sensor || { name: "값", min: 0, max: 1023, val: 500, lowLabel: "작음", highLabel: "큼" };
    var th = cfg.thresh || { val: Math.round(((s.min || 0) + (s.max || 1023)) / 2), label: "이 값을 넘으면 켜기", dir: "above" };
    var out = cfg.output || { name: "LED", onText: "켜짐", offText: "꺼짐" };
    var sval = s.val, tVal = th.val;

    var canvas = mkCanvas(), ctx = canvas.getContext("2d");
    var left = el("div"); left.appendChild(canvas);
    left.appendChild(el("p", "rd", "왼쪽 손잡이로 <b>" + s.name + "</b> 을 바꿔 보고, 언제 출력이 켜지는지 살펴보세요."));
    host.appendChild(left);
    var ctrl = el("div", "ctrl"); host.appendChild(ctrl);

    var lamp = el("div", "lamp", '<span class="bulb"></span><span class="lampt"></span>');
    ctrl.appendChild(lamp);

    function slider(labelHtml, min, max, val, onIn) {
      var f = el("div", "fld");
      var lab = el("label", "", labelHtml);
      f.appendChild(lab);
      var r = el("input"); r.type = "range"; r.min = min; r.max = max; r.value = val;
      r.oninput = function () { onIn(parseFloat(this.value), lab); };
      f.appendChild(r);
      return f;
    }
    ctrl.appendChild(slider("지금 " + s.name + " : <b class=\"sv\">" + sval + "</b>", s.min, s.max, sval, function (v, lab) {
      sval = v; lab.querySelector(".sv").textContent = v; draw();
    }));
    ctrl.appendChild(slider("기준값 (" + th.label + ") : <b class=\"tv\">" + tVal + "</b>", s.min, s.max, tVal, function (v, lab) {
      tVal = v; lab.querySelector(".tv").textContent = v; draw();
    }));
    ctrl.appendChild(el("p", "rd", "코드의 <code>만약 &lt;" + s.name +
      (th.dir === "below" ? " &lt; " : " &gt; ") + "기준값&gt; 이면</code> 과 같은 판단입니다."));
    if (cfg.real) ctrl.appendChild(realBox(cfg.real));

    function isOn() { return th.dir === "below" ? sval < tVal : sval > tVal; }

    function draw() {
      var on = isOn();
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      // 세로 게이지
      var gx = 60, gy = 30, gw = 70, gh = 240;
      ctx.strokeStyle = "#c7d2e0"; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, gw, gh);
      var frac = (sval - s.min) / (s.max - s.min || 1);
      ctx.fillStyle = "#74c0fc";
      ctx.fillRect(gx + 2, gy + gh - gh * frac + 1, gw - 4, gh * frac - 2);
      // 기준선
      var tf = (tVal - s.min) / (s.max - s.min || 1);
      var ty = gy + gh - gh * tf;
      ctx.strokeStyle = "#e03131"; ctx.setLineDash([6, 4]); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(gx - 12, ty); ctx.lineTo(gx + gw + 12, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c92a2a"; ctx.font = "12px 'Malgun Gothic',sans-serif";
      ctx.fillText("기준 " + tVal, gx + gw + 16, ty + 4);
      ctx.fillStyle = "#334155"; ctx.font = "13px 'Malgun Gothic',sans-serif";
      ctx.fillText(s.highLabel || "큼", gx - 6, gy - 8);
      ctx.fillText(s.lowLabel || "작음", gx - 6, gy + gh + 18);
      ctx.font = "bold 30px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#1b2430";
      ctx.fillText(s.name + " = " + sval, gx + gw + 60, gy + 30);
      ctx.font = "14px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#5b6875";
      ctx.fillText("(0 ~ " + s.max + " 사이의 아날로그 값)", gx + gw + 60, gy + 54);

      // 출력
      var ox = gx + gw + 60, oy = 150;
      ctx.beginPath(); ctx.arc(ox + 24, oy + 26, 20, 0, 6.3);
      ctx.fillStyle = on ? "#ffd43b" : "#e2e8f0"; ctx.fill();
      ctx.strokeStyle = on ? "#e8a90c" : "#c7d2e0"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = "bold 20px 'Malgun Gothic',sans-serif";
      ctx.fillStyle = on ? "#1a7f37" : "#94a3b8";
      ctx.fillText(out.name + " " + (on ? (out.onText || "켜짐") : (out.offText || "꺼짐")), ox + 58, oy + 33);
      ctx.font = "14px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#5b6875";
      ctx.fillText(th.dir === "below"
        ? (on ? s.name + " 이 기준보다 작다 → 켜기" : s.name + " 이 기준 이상 → 끄기")
        : (on ? s.name + " 이 기준보다 크다 → 켜기" : s.name + " 이 기준 이하 → 끄기"), ox, oy + 74);

      lamp.classList.toggle("on", on);
      lamp.querySelector(".lampt").textContent = out.name + " " + (on ? (out.onText || "켜짐") : (out.offText || "꺼짐"));
    }
    draw();
    return { destroy: function () {} };
  }

  /* ── 3. rgb-mix (RGB LED 색 혼합) ──────────────────── */
  function rgbMix(host, cfg) {
    var canvas = mkCanvas(), ctx = canvas.getContext("2d");
    var left = el("div"); left.appendChild(canvas);
    left.appendChild(el("p", "rd", "R·G·B 세 손잡이를 움직여 원하는 색을 만들어 보세요. 세 값이 코드로 그대로 들어갑니다."));
    host.appendChild(left);
    var ctrl = el("div", "ctrl"); host.appendChild(ctrl);
    var rgb = [200, 60, 40];
    var names = ["빨강 R", "초록 G", "파랑 B"];
    var cols = ["#e03131", "#2f9e44", "#1c5fb4"];
    names.forEach(function (nm, i) {
      var f = el("div", "fld");
      var lab = el("label", "", nm + " : <b class=\"v\">" + rgb[i] + "</b>");
      lab.style.color = cols[i];
      f.appendChild(lab);
      var r = el("input"); r.type = "range"; r.min = 0; r.max = 255; r.value = rgb[i];
      r.oninput = function () { rgb[i] = parseInt(this.value, 10); lab.querySelector(".v").textContent = rgb[i]; draw(); };
      f.appendChild(r);
      ctrl.appendChild(f);
    });
    if (cfg.real) ctrl.appendChild(realBox(cfg.real));

    function hex(n) { return ("0" + n.toString(16)).slice(-2).toUpperCase(); }
    function bin8(n) { return ("00000000" + n.toString(2)).slice(-8); }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      ctx.fillRect(24, 24, 220, 220);
      ctx.strokeStyle = "#c7d2e0"; ctx.strokeRect(24, 24, 220, 220);
      var x = 270;
      ctx.fillStyle = "#1b2430"; ctx.font = "bold 26px Consolas,'Malgun Gothic',sans-serif";
      ctx.fillText("#" + hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]), x, 60);
      ctx.font = "15px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#5b6875";
      ["빨강 R", "초록 G", "파랑 B"].forEach(function (nm, i) {
        ctx.fillStyle = cols[i]; ctx.font = "bold 15px 'Malgun Gothic',sans-serif";
        ctx.fillText(nm + " = " + rgb[i], x, 100 + i * 44);
        ctx.fillStyle = "#5b6875"; ctx.font = "14px Consolas,monospace";
        ctx.fillText("2진수 " + bin8(rgb[i]), x, 118 + i * 44);
      });
      ctx.fillStyle = "#1b2430"; ctx.font = "bold 15px 'Malgun Gothic',sans-serif";
      ctx.fillText("24비트 : " + bin8(rgb[0]) + " " + bin8(rgb[1]) + " " + bin8(rgb[2]), x, 244);
    }
    draw();
    return { destroy: function () {} };
  }

  /* ── 4. sequence (신호등 — 순차 제어) ─────────────── */
  function sequence(host, cfg) {
    var steps = cfg.steps || [
      { name: "빨강", col: "#e03131", sec: 3 },
      { name: "초록", col: "#2f9e44", sec: 3 },
      { name: "노랑", col: "#e8a90c", sec: 1 }
    ];
    var canvas = mkCanvas(), ctx = canvas.getContext("2d");
    var left = el("div"); left.appendChild(canvas);
    left.appendChild(el("p", "rd", "각 색이 켜지는 시간을 손잡이로 바꿔 보세요. 코드는 이 순서를 그대로 반복합니다."));
    host.appendChild(left);
    var ctrl = el("div", "ctrl"); host.appendChild(ctrl);

    steps.forEach(function (st, i) {
      var f = el("div", "fld");
      var lab = el("label", "", st.name + " 시간 : <b class=\"v\">" + st.sec + "</b> 초");
      lab.style.color = st.col;
      f.appendChild(lab);
      var r = el("input"); r.type = "range"; r.min = 1; r.max = 8; r.step = 1; r.value = st.sec;
      r.oninput = function () { st.sec = parseInt(this.value, 10); lab.querySelector(".v").textContent = st.sec; };
      f.appendChild(r);
      ctrl.appendChild(f);
    });
    if (cfg.real) ctrl.appendChild(realBox(cfg.real));

    var idx = 0, elapsed = 0, tPrev = Date.now();
    function tick() {
      var now = Date.now(); elapsed += (now - tPrev) / 1000; tPrev = now;
      if (elapsed >= steps[idx].sec) { elapsed = 0; idx = (idx + 1) % steps.length; }
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#22262e"; ctx.fillRect(W / 2 - 44, 20, 88, 250);
      steps.forEach(function (st, i) {
        var cy = 60 + i * 80;
        ctx.beginPath(); ctx.arc(W / 2, cy, 30, 0, 6.3);
        ctx.fillStyle = idx === i ? st.col : "#3b414c"; ctx.fill();
      });
      ctx.fillStyle = "#1b2430"; ctx.font = "bold 24px 'Malgun Gothic',sans-serif";
      ctx.fillText("지금 : " + steps[idx].name + " (" + Math.ceil(steps[idx].sec - elapsed) + "초 남음)", W / 2 + 70, 130);
      ctx.font = "14px 'Malgun Gothic',sans-serif"; ctx.fillStyle = "#5b6875";
      ctx.fillText("코드 : 켜기 → 기다리기 → 끄기 → 다음 색 …", W / 2 + 70, 160);
    }
    var timer = setInterval(tick, DT); draw();
    return { destroy: function () { clearInterval(timer); } };
  }

  /* 타임라인 공용 그리기 */
  function drawTimeline(ctx, line, rows) {
    var gx = 40, gy = H - 44, gw = W - 80, gh = 34;
    ctx.strokeStyle = "#c7d2e0"; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
    ctx.font = "10px 'Malgun Gothic',sans-serif";
    rows.forEach(function (r, ri) {
      var yc = gy + 10 + ri * 14;
      ctx.fillStyle = "#8b95a3"; ctx.fillText(r.lab, gx - 26, yc + 3);
      ctx.strokeStyle = r.col; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i < line.length; i++) {
        var x = gx + (i / KEEP) * gw;
        var y = yc + (line[i][r.key] ? -4 : 4);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  function mount(host, cfg) {
    cfg = cfg || {};
    host.innerHTML = ""; host.className = "bench";
    var inst;
    if (cfg.type === "analog-level") inst = analogLevel(host, cfg);
    else if (cfg.type === "rgb-mix") inst = rgbMix(host, cfg);
    else if (cfg.type === "sequence") inst = sequence(host, cfg);
    else inst = digitalPresence(host, cfg);
    return { destroy: function () { if (inst && inst.destroy) inst.destroy(); host.innerHTML = ""; } };
  }

  g.Bench = { mount: mount };
})(window);
