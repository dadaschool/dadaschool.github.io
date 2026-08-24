/* ============================================================
   선생님 화면 — 문제를 만든다.

   ⚠ 교사가 «직접 만든 부품» 은 정의를 **문제 안에** 담는다(`entry.def`).
     그러지 않으면 학생 화면이 그 부품을 모른다 — 정의가 교사의 브라우저에만 남는다.
   ============================================================ */
(function (g) {
  "use strict";

  var prob = { v: 1, t: "초음파센서 회로도", v1: "3V3", v2: "3V3", usb: true, color: true, ext: [], parts: [] };
  var extra = [];   /* 교사가 손으로 적은 확장프로그램 이름 */

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* 사양·설명에 쓴 `코드` 와 **굵게** 를 살린다 (학생 화면의 rich 와 같은 규칙) */
  function rich(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }

  function boot() {
    /* 🔴 교사 코드로 열지 않으면 아무것도 보이지 않는다.
       코드는 `js/locked.js` 의 암호문을 여는 열쇠이고, 서버의 쓰기 API 도 같은 코드를 본다.
       ⚠ 코드를 저장하지 않는다 — 새로고침하면 다시 넣는다(`mb-bluetooth` 와 같은 판단). */
    $("btnGate").onclick = openGate;
    $("tcode").onkeydown = function (ev) { if (ev.key === "Enter") openGate(); };
    $("tcode").focus();
  }

  function openGate() {
    var code = ($("tcode").value || "").trim();
    if (!code) { $("gateMsg").textContent = "코드를 넣어 주세요."; return; }
    if (!window.Lock || !Lock.available()) {
      $("gateMsg").textContent = "이 브라우저에서는 잠금을 열 수 없습니다(https 또는 localhost 로 열어 주세요).";
      return;
    }
    $("btnGate").disabled = true;
    $("btnGate").textContent = "여는 중…";
    $("gateMsg").textContent = "";
    Lock.open(window.LOCKED && LOCKED.teacher, code).then(function (val) {
      notes = val;
      Code.setTeacher(code);          /* 쓰기 요청에 붙는다 */
      $("gate").hidden = true;
      $("mainWrap").hidden = false;
      afterGate();
    }).catch(function (e) {
      $("btnGate").disabled = false;
      $("btnGate").textContent = "열기";
      $("gateMsg").textContent = "❌ " + (e && e.message ? e.message : "코드가 맞지 않습니다.");
      $("tcode").select();
    });
  }

  var notes = null;   /* 교사 코드로 열린 자료 */

  function afterGate() {
    addPart("hcsr04");              /* 새 문제를 만들 때 쓸 기본값 */
    paintPalette();
    bind();
    paintAll();
    paintNotes();
    showList();

    Code.ping(function (ok) {
      hasServer = ok;
      $("mkCode").hidden = !ok;
      $("noServer").hidden = ok;
      paintCodeBar();
      paintCodeList();          /* 서버가 없으면 왜 없는지 알려 준다 */
    });

    /* 주소에 문제가 담겨 왔으면(미리보기에서 돌아온 경우) 곧바로 편집으로 */
    var got = Code.fromUrl();
    if (got) { prob = got; editing = null; paintAll(); showEdit("주소로 받은 문제"); }
  }

  /* ── 목록 ↔ 편집 ─────────────────────────────────────────
     교사 화면의 **첫 화면은 목록**이다(2026-08-24 사용자 지시).
     문제를 만들거나 고칠 때만 편집 화면으로 들어간다. */
  function showList() {
    $("listWrap").hidden = false;
    $("editWrap").hidden = true;
    if (hasServer) paintCodeList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showEdit(what) {
    $("listWrap").hidden = true;
    $("editWrap").hidden = false;
    $("editWhat").innerHTML = what || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* 교사 코드로 열린 자료를 그린다 — 운영 메모·채점 기준·성취기준 */
  function paintNotes() {
    if (!notes) { $("teacherNote").hidden = true; return; }
    var h = "<h2>" + esc(notes["제목"] || "선생님용 자료") + "</h2>";
    h += "<h3>수업에서 쓰는 방법</h3><ol>" +
      (notes["운영"] || []).map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ol>";
    h += '<h3>채점 기준 <span class="pm">— 학생에게 그대로 알려 주어도 됩니다</span></h3>' +
      '<table class="tb"><tr><th>핀</th><th>정답 기준</th><th>왜</th></tr>' +
      (notes["채점기준"] || []).map(function (r) {
        return "<tr><td class='c'><b>" + esc(r[0]) + "</b></td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>";
      }).join("") + "</table>";
    h += "<h3>많이 나오는 실수</h3><ul>" +
      (notes["실수"] || []).map(function (x) { return "<li>" + rich(x) + "</li>"; }).join("") + "</ul>";
    h += '<h3>관련 성취기준 <span class="pm">(2022 개정 · 중학교 정보)</span></h3>' +
      '<table class="tb"><tr><th class="c" style="width:120px">기준</th><th>내용</th></tr>' +
      (notes["성취기준"] || []).map(function (r) {
        return "<tr><td class='c'><b>" + esc(r[0]) + "</b></td><td>" + esc(r[1]) + "</td></tr>";
      }).join("") + "</table>";
    h += (notes["주의"] || []).map(function (x) { return '<p class="hint">⚠ ' + rich(x) + "</p>"; }).join("");
    $("teacherNote").innerHTML = h;
  }

  /* ── 부품 고르기 판 ────────────────────────────────────
     묶음별로 나눠 놓고 **«자주 쓰는 것» 을 맨 위**에 둔다(2026-08-24 사용자 지시).
     부품이 42개라 한 덩어리로 두면 찾을 수 없다. 순서는 `Parts.GROUPS` 가 정한다. */
  function paintPalette() {
    var h = "";
    Parts.GROUPS.forEach(function (grp) {
      var items = Parts.list.filter(function (p) { return p.group === grp.k; });
      if (!items.length) return;
      h += '<h3 class="gh">' + esc(grp.name) +
           ' <span class="pm">' + items.length + "개" +
           (grp.note ? " · " + esc(grp.note) : "") + "</span></h3>";
      /* 🔴 고르는 화면에는 **그림과 이름만** 둔다(2026-08-24 사용자 지시 — «화면이 너무 복잡해»).
         모델명·전원은 담은 뒤 «핀 설정» 칸에서 자세히 보여 준다.
         (모델명을 이름 옆에 붙였더니 「초음파 센서HC-SR04 · 5V」 처럼 엉켜 보였다) */
      h += '<div class="pgrid">' + items.map(function (p) {
        return '<button type="button" class="pbtn" data-add="' + p.id +
               '" title="' + esc(p.name + (p.model ? " (" + p.model + ")" : "")) + '">' +
               Parts.face(p.face, 46, 30) +
               '<span class="pn">' + esc(p.name) + "</span></button>";
      }).join("") + "</div>";
    });
    $("palette").innerHTML = h;
  }

  /* ── 부품 담기 ───────────────────────────────────────── */
  function usedPins() {
    var u = {};
    prob.parts.forEach(function (e) {
      Object.keys(e.pin || {}).forEach(function (k) {
        if (e.pin[k] !== null && e.pin[k] !== "") u[Number(e.pin[k])] = true;
      });
    });
    return u;
  }
  /* 아직 아무도 쓰지 않는 가장 작은 번호. 19·20 은 I2C 자리로 남겨 둔다 */
  function firstFree(used) {
    for (var i = 0; i < Board.SIG_PINS.length; i++) {
      var n = Board.SIG_PINS[i];
      if (n > 16) continue;
      if (!used[n]) return n;
    }
    return 0;
  }

  function addPart(id, def) {
    var entry = def ? { def: def, pin: {} } : { id: id, pin: {} };
    var part = Code.part(entry);
    var used = usedPins();     /* 이미 쓰는 번호는 피한다 (한 구멍에 두 선은 못 꽂는다) */
    var gotOne = false;

    part.pins.forEach(function (pin) {
      if (pin.role !== "sig") return;
      /* «쓰지 않아도 되는» 핀은 하나라도 정한 뒤부터 비워 둔다.
         (MQ-3 처럼 아날로그·디지털 둘 중 하나만 쓰는 부품이 있다.
          모두 비우면 학생이 이을 신호선이 없어진다) */
      if (pin.opt && gotOne) { entry.pin[pin.n] = ""; return; }
      var n = firstFree(used);
      used[n] = true;
      entry.pin[pin.n] = n;
      gotOne = true;
    });

    prob.parts.push(entry);

    /* 그 부품이 필요한 확장프로그램을 자동으로 켜 준다 */
    if (part.ext && prob.ext.indexOf(part.ext) < 0) prob.ext.push(part.ext);
  }

  function paintChosen() {
    if (!prob.parts.length) {
      $("chosen").innerHTML = '<p class="hint">아래에서 부품을 하나 이상 고르세요.</p>';
      return;
    }
    /* 그림은 **작게**, 핀 설정을 **크게**. 이 화면에서 중요한 것은 그림이 아니라
       «어느 핀을 몇 번에 꽂게 할지» 다(2026-08-24 사용자 지시 — 그림이 너무 컸다). */
    var h = "";
    prob.parts.forEach(function (entry, i) {
      var p = Code.part(entry);
      h += '<div class="crow"><div class="ch">' + Parts.face(p.face, 40, 26) +
           "<b>" + esc(p.name) + "</b><span class=\"pm\">" + esc(p.model || "") + "</span>" +
           '<span class="fix' + (p.power === "5V" ? " five" : "") + '">전원 ' + p.power + "</span>" +
           '<span class="sp"></span>' +
           '<button type="button" data-up="' + i + '" title="위로">▲</button>' +
           '<button type="button" data-down="' + i + '" title="아래로">▼</button>' +
           '<button type="button" data-del="' + i + '" title="빼기">✕</button></div>';

      h += '<div class="pintable">';
      p.pins.forEach(function (pin) {
        var nm = esc(pin.n);
        var isSig = pin.role === "sig";
        h += '<div class="pinrow' + (isSig ? " sig" : "") + '">' +
             '<span class="pinname">' + nm + "</span>" +
             '<span class="pinrole">' + Parts.ROLE_NAME[pin.role] + "</span>";
        if (pin.role === "vcc" || pin.role === "gnd") {
          h += '<span class="free">' + (pin.role === "vcc" ? "빨간 `V` 줄 아무 곳 · " + p.power + " 단자" : "검정 `G` 줄 아무 곳")
                 .replace(/`([^`]+)`/g, "<code>$1</code>") + " — 정할 것이 없습니다</span>";
        } else if (pin.role === "sda" || pin.role === "scl") {
          h += '<span class="free">I2C 라 <b>' + (pin.role === "sda" ? "19" : "20") +
               "번</b>으로 정해져 있습니다 — 바꿀 수 없습니다</span>";
        } else {
          var cur = (entry.pin || {})[pin.n];
          var opts = (pin.opt ? '<option value="">쓰지 않음</option>' : "") +
            Board.SIG_PINS.map(function (n) {
              return '<option value="' + n + '"' + (String(cur) === String(n) ? " selected" : "") + ">" + n + "번</option>";
            }).join("");
          h += '<select data-pi="' + i + '" data-pn="' + nm + '">' + opts + "</select>" +
               (pin.sub ? '<span class="free">' + esc(pin.sub) + "</span>" : "");
        }
        h += "</div>";
      });
      h += "</div>";
      /* 자세한 설명은 **여기**에 온다 — 고르는 화면을 간단하게 둔 대신이다.
         `spec` 는 Keyestudio 공식 문서에서 온 사양, `note` 는 학생에게 하는 설명이다. */
      if (p.spec) h += '<p class="spec">' + rich(p.spec) + "</p>";
      if (p.note) h += '<p class="hint" style="margin:6px 0 0">' + rich(p.note) + "</p>";
      h += "</div>";
    });
    $("chosen").innerHTML = h;
  }

  /* ── 확장프로그램 ────────────────────────────────────── */
  function paintExt() {
    var sug = [];
    prob.parts.forEach(function (e) {
      var x = Code.part(e).ext;
      if (x && sug.indexOf(x) < 0) sug.push(x);
    });
    extra.concat(prob.ext).forEach(function (x) { if (x && sug.indexOf(x) < 0) sug.push(x); });

    $("extchips").innerHTML = sug.length
      ? sug.map(function (x) {
          return '<button type="button" class="chip' + (prob.ext.indexOf(x) >= 0 ? " on" : "") +
                 '" data-ext="' + esc(x) + '">' + esc(x) + "</button>";
        }).join("")
      : '<span class="hint">고른 부품에는 확장프로그램이 필요하지 않습니다. 필요하면 아래에 적어 넣으세요.</span>';
  }

  /* ── 결과 (주소·코드) ───────────────────────────────── */
  function paintOut() {
    if (!prob.parts.length) { $("out").textContent = "부품을 하나 이상 고르세요."; return; }
    $("out").textContent = Code.url(prob, "index.html");
    $("outCode").textContent = Code.TAG + Code.encode(prob);
    var n = 0;
    prob.parts.forEach(function (e) {
      Code.part(e).pins.forEach(function (pin) {
        var want = (e.pin || {})[pin.n];
        if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
        n++;
      });
    });
    $("sum").innerHTML = "부품 <b>" + prob.parts.length + "</b>개 · 학생이 이어야 하는 선 <b>" + n + "</b>개";
  }

  /* ── 전원 자리가 모자라지 않는지 ──────────────────────────
     `5V 단자` 는 **한 곳뿐**이다. 5V 가 필요한 부품이 둘이면 점퍼를 옮기지 않는 한
     둘 다 꽂을 수 없다 — 학생이 풀 수 없는 문제가 만들어진다(실제로 만들었다).
     그래서 문제를 내보내기 전에 여기서 잡는다. */
  function powerShort() {
    var need = { "5V": 0, "3V3": 0 };
    prob.parts.forEach(function (e) {
      var p = Code.part(e);
      if (p.power === "5V" || p.power === "3V3") need[p.power]++;
    });
    /* 꽂을 수 있는 자리 : 단자 1곳 + 그 전압으로 점퍼된 줄 (왼쪽 10 · 오른쪽·IIC·SPI 15) */
    function spots(v) { return 1 + (prob.v1 === v ? 10 : 0) + (prob.v2 === v ? 15 : 0); }
    var out = [];
    ["5V", "3V3"].forEach(function (v) {
      if (need[v] > spots(v)) out.push({ v: v, need: need[v], spot: spots(v) });
    });
    return out;
  }

  function paintWarn() {
    var short = powerShort();
    if (!short.length) { $("warn").innerHTML = ""; return; }
    $("warn").innerHTML = short.map(function (s) {
      var other = s.v === "5V" ? "5V" : "3V3";
      return '<div class="note red"><b>학생이 풀 수 없는 문제입니다.</b><br>' +
        s.v + " 가 필요한 부품이 <b>" + s.need + "개</b>인데, " + s.v +
        " 를 꽂을 수 있는 자리는 <b>" + s.spot + "곳</b>뿐입니다 (<code>" + s.v +
        " 단자</code> 하나). 한 구멍에 두 선을 꽂을 수 없습니다.<br>" +
        "→ 점퍼 <b>V1</b> 을 <b>" + other + "</b> 로 옮기면 왼쪽 핀열 10곳이 모두 " +
        other + " 가 되어 해결됩니다.<br>" +
        '<button type="button" class="pri" style="margin-top:8px" data-fixv1="' + other +
        '">점퍼 V1 을 ' + other + " 로 옮기기</button></div>";
    }).join("");
  }

  /* ── 6자리 코드 ───────────────────────────────────────────
     서버로 열었을 때만 쓸 수 있다. 아니면 카드를 숨기고 왜 안 되는지 알려 준다. */
  var hasServer = false;

  var editing = null;   /* 지금 고치고 있는 코드 (없으면 새 문제) */

  function paintCodeList() {
    if (!hasServer) {
      /* 사이트(GitHub Pages)에서는 목록을 만들 수 없다 — 서버가 없다.
         빈 칸으로 두면 «문제가 하나도 없나» 로 읽히므로 왜 그런지 적어 준다. */
      $("codeList").innerHTML =
        '<p class="hint">문제 목록은 <b>교사 PC 의 서버</b>에서만 보입니다(아래 안내 참고).<br>' +
        "학생에게 이미 알려 준 6자리 번호는 이 사이트에서 그대로 씁니다.</p>";
      $("btnNew").disabled = true;
      $("btnNew").title = "문제를 만들려면 교사 PC 에서 python server.py 로 켜세요";
      return;
    }
    $("btnNew").disabled = false;
    Code.codes(function (list) {
      if (!list.length) {
        $("codeList").innerHTML = '<p class="hint">아직 만든 코드가 없습니다.</p>';
        return;
      }
      $("codeList").innerHTML = '<table class="tb"><tr><th class="c">6자리 코드</th><th>제목</th>' +
        '<th class="c">부품</th><th class="c">만든 때</th><th class="c">하기</th></tr>' +
        list.map(function (x) {
          return '<tr><td class="c"><b class="codeno">' + esc(x.code) + "</b></td>" +
            "<td>" + esc(x.title) + "</td>" +
            '<td class="c">' + x.parts + "개</td>" +
            '<td class="c pm">' + when(x.at) + "</td>" +
            '<td class="c nowrap">' +
              '<button type="button" data-edit6="' + esc(x.code) + '">✏️ 수정</button> ' +
              '<button type="button" data-open6="' + esc(x.code) + '">👁 학생 화면</button> ' +
              '<button type="button" data-del6="' + esc(x.code) + '">🗑 삭제</button>' +
            "</td></tr>";
        }).join("") + "</table>" +
        '<p class="hint">「✏️ 수정」 으로 고치면 <b>같은 6자리 번호</b>가 유지됩니다 — 학생에게 다시 불러 줄 필요가 없습니다.</p>';
    });
  }

  /* 만든 때 — 서버가 준 초 단위 시각을 「8월 24일 14:35」 로 보여 준다 */
  function when(sec) {
    if (!sec) return "";
    var d = new Date(sec * 1000);
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  /* 지난 문제를 편집기로 불러온다 — 고친 뒤 **같은 번호로 저장**할 수 있다 */
  function edit6(code) {
    Code.byCode(code, function (p, err) {
      if (!p) { alert("그 코드를 읽을 수 없습니다.\n" + (err || "")); return; }
      prob = p;
      editing = code;
      extra = [];
      paintAll();
      $("code6out").innerHTML = '<span class="bigcode">' + esc(code) + "</span>" +
        '<span class="hint" style="margin-left:12px">고친 뒤 <b>이 번호로 저장</b>하면 그대로 쓸 수 있습니다</span>';
      showEdit("<b>" + esc(code) + "</b> 문제를 고치고 있습니다");
    });
  }

  function stopEdit() { editing = null; paintCodeBar(); paintCodeList(); }

  /* 코드 단추 줄 — 새 문제인지, 지난 문제를 고치는 중인지에 따라 달라진다 */
  function paintCodeBar() {
    if (editing) {
      $("code6bar").innerHTML =
        '<button type="button" id="btnSave6" class="pri big">💾 ' + esc(editing) + ' 코드로 저장</button>' +
        '<button type="button" id="btnMake6">🔢 새 코드로 따로 만들기</button>' +
        '<button type="button" id="btnStopEdit" class="gh">고치기 그만두기</button>' +
        '<span class="hint">학생이 이미 아는 번호이므로 <b>같은 번호로 저장</b>하면 다시 불러 줄 필요가 없습니다.</span>';
      $("btnSave6").onclick = save6;
      $("btnStopEdit").onclick = stopEdit;
    } else {
      $("code6bar").innerHTML =
        '<button type="button" id="btnMake6" class="pri big">🔢 6자리 코드 만들기</button>' +
        '<span class="hint">숫자만 불러 주면 됩니다.</span>';
    }
    $("btnMake6").onclick = make6;
  }

  function make6() {
    if (!check()) return;
    Code.makeCode(prob, function (code, err) {
      if (!code) { alert("코드를 만들지 못했습니다.\n" + (err || "")); return; }
      editing = code;
      $("code6out").innerHTML = '<span class="bigcode">' + esc(code) + "</span>" +
        '<span class="hint" style="margin-left:12px">학생에게 이 숫자를 불러 주세요</span>';
      paintCodeBar();
      paintCodeList();
      $("editWhat").innerHTML = "<b>" + esc(code) + "</b> 문제를 고치고 있습니다";
    });
  }

  function save6() {
    if (!check() || !editing) return;
    Code.saveCode(editing, prob, function (ok, err) {
      if (!ok) { alert("저장하지 못했습니다.\n" + (err || "")); return; }
      $("code6out").innerHTML = '<span class="bigcode">' + esc(editing) + "</span>" +
        '<span class="hint" style="margin-left:12px">✅ 고친 내용을 <b>같은 번호</b>에 저장했습니다. ' +
        "학생이 새로고침하면 바뀐 문제가 나옵니다.</span>";
      paintCodeList();
    });
  }

  function paintAll() {
    $("t").value = prob.t;
    $("v1").value = prob.v1;
    $("v2").value = prob.v2;
    $("ckUsb").checked = prob.usb !== false;
    paintChosen(); paintExt(); paintWarn(); paintOut();
    if (hasServer) { paintCodeBar(); paintCodeList(); }
  }

  /* ── 이어 붙이기 ─────────────────────────────────────── */
  function bind() {
    $("t").oninput = function () { prob.t = this.value || "마이크로비트 연결 실습"; paintOut(); };
    $("v1").onchange = function () { prob.v1 = this.value; paintChosen(); paintWarn(); paintOut(); };
    $("v2").onchange = function () { prob.v2 = this.value; paintWarn(); paintOut(); };
    $("ckUsb").onchange = function () { prob.usb = this.checked; paintOut(); };
    /* 붉은 안내의 「점퍼 옮기기」 — 고칠 방법을 한 번에 눌러 쓰게 한다 */
    $("warn").addEventListener("click", function (ev) {
      var v = ev.target.dataset && ev.target.dataset.fixv1;
      if (!v) return;
      prob.v1 = v;
      paintAll();
    });

    /* 목록 ↔ 편집 */
    $("btnNew").onclick = function () {
      prob = { v: 1, t: "새 문제", v1: "3V3", v2: "3V3", usb: true, color: true, ext: [], parts: [] };
      editing = null;
      addPart("hcsr04");
      paintAll();
      $("code6out").innerHTML = "";
      showEdit("<b>새 문제</b> 를 만들고 있습니다");
    };
    $("btnBackList").onclick = showList;

    /* 6자리 코드 단추는 paintCodeBar() 가 만들고 이어 준다 */
    $("codeList").addEventListener("click", function (ev) {
      var d = ev.target.dataset || {};
      if (d.edit6) edit6(d.edit6);
      if (d.open6) window.open("index.html#code=" + d.open6, "_blank");
      if (d.del6 && confirm(d.del6 + " 문제를 지울까요? 학생이 그 번호를 넣으면 «없는 번호» 가 됩니다.")) {
        Code.delCode(d.del6, function () {
          if (editing === d.del6) editing = null;
          paintCodeBar(); paintCodeList();
        });
      }
    });

    document.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-add],[data-del],[data-up],[data-down],[data-ext]") : null;
      if (!t) return;
      if (t.dataset.add) { addPart(t.dataset.add); paintAll(); return; }
      if (t.dataset.del !== undefined) { prob.parts.splice(Number(t.dataset.del), 1); paintAll(); return; }
      if (t.dataset.up !== undefined) { move(Number(t.dataset.up), -1); return; }
      if (t.dataset.down !== undefined) { move(Number(t.dataset.down), 1); return; }
      if (t.dataset.ext) {
        var x = t.dataset.ext, i = prob.ext.indexOf(x);
        if (i >= 0) prob.ext.splice(i, 1); else prob.ext.push(x);
        paintExt(); paintOut();
      }
    });

    document.addEventListener("change", function (ev) {
      var s = ev.target;
      if (s.tagName === "SELECT" && s.dataset.pi !== undefined) {
        prob.parts[Number(s.dataset.pi)].pin[s.dataset.pn] = s.value === "" ? "" : Number(s.value);
        paintOut();
      }
    });

    $("btnExtAdd").onclick = function () {
      var v = $("extIn").value.trim();
      if (!v) return;
      if (extra.indexOf(v) < 0) extra.push(v);
      if (prob.ext.indexOf(v) < 0) prob.ext.push(v);
      $("extIn").value = "";
      paintExt(); paintOut();
    };

    /* 직접 만드는 부품 */
    $("btnCustom").onclick = function () { $("customBox").hidden = !$("customBox").hidden; renderCustomPins(); };
    $("btnPinAdd").onclick = function () { cpins.push({ n: "", role: "sig" }); renderCustomPins(); };
    $("btnCustomAdd").onclick = makeCustom;

    /* 내보내기 */
    $("btnPreview").onclick = function () {
      if (!check()) return;
      window.open(Code.url(prob, "index.html"), "_blank");
    };
    $("btnCopyUrl").onclick = function () { copy(Code.url(prob, "index.html"), "학생용 주소"); };
    $("btnCopyCode").onclick = function () { copy(Code.TAG + Code.encode(prob), "문제 코드"); };
    $("btnFile").onclick = function () { if (check()) Code.download(prob); };
    $("fileIn").onchange = function () {
      if (!this.files[0]) return;
      Code.readFile(this.files[0], function (p) {
        if (!p) { alert("문제 파일을 읽을 수 없습니다."); return; }
        prob = p; editing = null; paintAll();
      });
      this.value = "";
    };

    /* 인쇄 */
    $("btnSheet").onclick = function () { if (check()) Print.sheet(Sheet.worksheet(prob)); };
    $("btnKey").onclick = function () { if (check()) Sheet.key(prob); };
  }

  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= prob.parts.length) return;
    var tmp = prob.parts[i]; prob.parts[i] = prob.parts[j]; prob.parts[j] = tmp;
    paintAll();
  }

  function check() {
    if (!prob.parts.length) { alert("부품을 하나 이상 고르세요."); return false; }
    /* 신호핀 번호가 겹치면 실물에서 꽂을 수 없다 — 만들기 전에 막는다 */
    var seen = {}, dup = null;
    prob.parts.forEach(function (e) {
      Object.keys(e.pin || {}).forEach(function (k) {
        var v = e.pin[k];
        if (v === null || v === "") return;
        if (seen[v]) dup = v; else seen[v] = true;
      });
    });
    if (dup !== null) {
      alert(dup + "번 신호핀을 두 곳에서 쓰고 있습니다.\n한 구멍에 두 선을 꽂을 수 없으니 번호를 다르게 정해 주세요.");
      return false;
    }
    /* 전원 자리가 모자라면 학생이 다 이을 수 없다 — 화면의 붉은 안내와 같은 검사 */
    var lack = powerShort();
    if (lack.length) {
      var s = lack[0], other = s.v === "5V" ? "5V" : "3V3";
      alert(s.v + " 가 필요한 부품이 " + s.need + "개인데 꽂을 자리는 " + s.spot + "곳뿐입니다." +
            " 점퍼 V1 을 " + other + " 로 옮겨 주세요." +
            " 그러지 않으면 학생이 선을 다 이을 수 없습니다.");
      return false;
    }
    return true;
  }

  function copy(text, what) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        function () { alert(what + "를 복사했습니다."); },
        function () { prompt(what + " (Ctrl+C 로 복사하세요)", text); });
    } else prompt(what + " (Ctrl+C 로 복사하세요)", text);
  }

  /* ── 직접 만드는 부품 ────────────────────────────────── */
  var cpins = [{ n: "S", role: "sig" }, { n: "+", role: "vcc" }, { n: "−", role: "gnd" }];

  function renderCustomPins() {
    $("cpins").innerHTML = cpins.map(function (p, i) {
      return '<div class="row" style="margin-bottom:6px">' +
        '<input type="text" data-cn="' + i + '" value="' + esc(p.n) + '" placeholder="핀 이름 (예: S)" style="width:150px">' +
        '<select data-cr="' + i + '">' +
          ["sig", "vcc", "gnd", "sda", "scl"].map(function (r) {
            return '<option value="' + r + '"' + (p.role === r ? " selected" : "") + ">" +
                   Parts.ROLE_NAME[r] + "</option>";
          }).join("") +
        "</select>" +
        '<label class="ck"><input type="checkbox" data-co="' + i + '"' + (p.opt ? " checked" : "") +
        "> 쓰지 않아도 됨</label>" +
        '<button type="button" data-cd="' + i + '">✕</button></div>';
    }).join("");

    $("cpins").oninput = $("cpins").onchange = function (ev) {
      var d = ev.target.dataset;
      if (d.cn !== undefined) cpins[d.cn].n = ev.target.value;
      if (d.cr !== undefined) cpins[d.cr].role = ev.target.value;
      if (d.co !== undefined) cpins[d.co].opt = ev.target.checked;
    };
    $("cpins").onclick = function (ev) {
      var d = ev.target.dataset;
      if (d.cd !== undefined) { cpins.splice(Number(d.cd), 1); renderCustomPins(); }
    };
  }

  function makeCustom() {
    var name = $("cname").value.trim();
    if (!name) { alert("부품 이름을 적어 주세요."); return; }
    var pins = cpins.filter(function (p) { return p.n.trim(); })
                    .map(function (p) { return { n: p.n.trim(), role: p.role, opt: !!p.opt }; });
    if (!pins.length) { alert("핀을 하나 이상 적어 주세요."); return; }
    addPart(null, {
      name: name,
      model: $("cmodel").value.trim(),
      power: $("cpower").value,
      ext: $("cext").value.trim(),
      note: $("cnote").value.trim(),
      pins: pins
    });
    $("customBox").hidden = true;
    $("cname").value = ""; $("cmodel").value = ""; $("cext").value = ""; $("cnote").value = "";
    cpins = [{ n: "S", role: "sig" }, { n: "+", role: "vcc" }, { n: "−", role: "gnd" }];
    paintAll();
  }

  g.Teacher = { boot: boot };
})(window);
