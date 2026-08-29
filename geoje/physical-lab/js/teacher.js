/* ============================================================
   teacher.js — 선생님용 화면

   흐름 : 🔒 교사 코드 → 26차시 목록 → 차시를 누르면 ② 연결 문제 편집기 →
          🔢 6자리 코드 만들기 (학생에게 그 숫자만 불러 준다)

   · 26차시 카드 목록 (예전 학생 index.html 에서 옮겨 왔다)
   · ② 연결 문제 편집 — 부품 고르기 + 핀 설정 + 점퍼 + 확장프로그램
   · 🔢 6자리 코드 만들기·고치기·지우기 (Worker ① · server.py ② · 파일 ③)
   · 💾 이 차시에 저장 — lesson.html(차시 페이지) 미리보기용 localStorage override
   · ④ 인쇄용 활동지 (Print.sheet — 정답·해설 없음)
   · ③ 텍스트 코드 등록

   저장 : pl.connect.<n> (그 차시 연결 문제 override) · pl.textcode.<n>.<env>
   부품·핀 규칙은 js/connect/parts.js · board.js 를 그대로 따른다.
   ============================================================ */
(function (g) {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LESSONS = window.LESSONS || {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rich(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }
  /* 부품 항목 → 정의 (connect.js 의 resolvePart 와 같다) */
  function resolvePart(entry) {
    if (entry && entry.def) {
      var d = entry.def;
      return { id: "custom", name: d.name || "부품", model: d.model || "", face: "custom",
        power: d.power === "5V" ? "5V" : "3V3", ext: d.ext || "", note: d.note || "", spec: "", pins: d.pins || [] };
    }
    return window.Parts.byId(entry && entry.id) ||
      { id: entry && entry.id, name: "(모르는 부품)", model: "", face: "custom", power: "3V3", ext: "", note: "", spec: "", pins: [] };
  }

  var TITLES = {};
  Object.keys(LESSONS).forEach(function (k) { TITLES[k] = LESSONS[k].title; });

  var cur = 12;
  var prob = null;
  var preview = null;
  var hasServer = false;
  var editing = null;   /* 지금 고치고 있는 6자리 코드 (없으면 새 문제) */
  var mode = "lesson";  /* "lesson" = 프로젝트 26차시 · "free" = 자유 문제 */
  var tabs = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function baseProb(n) {
    var c = LESSONS[n] && LESSONS[n].connect;
    return c ? clone(c) : { t: n + "차시 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: [], parts: [] };
  }
  function savedProb(n) {
    try { var s = localStorage.getItem("pl.connect." + n); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function normalize(p) {
    p.t = p.t || cur + "차시 연결";
    p.v1 = p.v1 || "3V3"; p.v2 = p.v2 || "3V3";
    p.usb = p.usb === true; p.color = p.color !== false;
    p.ext = p.ext || [];
    p.parts = (p.parts || []).map(function (x) { return { id: x.id, def: x.def, pin: x.pin || {} }; });
    return p;
  }

  /* ── 🔒 교사 코드 ─────────────────────────────────────── */
  function boot() {
    $("btnGate").onclick = openGate;
    $("tcode").onkeydown = function (ev) { if (ev.key === "Enter") openGate(); };
    $("tcode").focus();
  }

  function openGate() {
    var code = ($("tcode").value || "").trim();
    if (!code) { $("gateMsg").textContent = "코드를 넣어 주세요."; return; }
    $("btnGate").disabled = true;
    $("btnGate").textContent = "여는 중…";
    $("gateMsg").textContent = "";
    window.Code.checkTeacher(code, function (ok, note) {
      if (!ok) {
        $("btnGate").disabled = false;
        $("btnGate").textContent = "열기";
        $("gateMsg").textContent = "❌ " + (note || "코드가 맞지 않습니다.");
        $("tcode").select();
        return;
      }
      $("btnGate").disabled = false;
      $("btnGate").textContent = "열기";
      $("gate").hidden = true;
      $("mainWrap").hidden = false;
      start();
      if (note === "nocheck") {
        $("gateMsg").textContent = "";
      }
    });
  }

  /* ── 본 화면 시작 (코드로 연 뒤) ─────────────────────── */
  function start() {
    tabs = window.UI.tabs($("ttabs"), [
      { id: "lessons", k: "📚", label: "프로젝트 26차시" },
      { id: "free", k: "✏️", label: "자유 문제" }
    ], showView);
    tabs.select("lessons", false);

    renderLessonList();
    paintPalette();
    bind();
    load(12);                 /* 편집기 상태만 채워 둔다 (아직 안 보인다) */
    showView("lessons");

    window.Code.ping(function (ok) {
      hasServer = ok;
      $("mkCode").hidden = !ok;
      $("noServer").hidden = ok;
      paintCodeBar();
      paintFreeList();
      paintLessonCodeList();
    });
  }

  /* 탭 전환 — 목록만 보이고 편집기는 숨긴다 */
  function showView(id) {
    $("editorCard").hidden = true;
    $("viewLessons").hidden = id !== "lessons";
    $("viewFree").hidden = id !== "free";
    if (tabs) tabs.select(id, false);
    if (id === "free") paintFreeList();
  }

  /* 편집기 열기 (목록은 숨긴다) */
  function openEditor() {
    $("viewLessons").hidden = true;
    $("viewFree").hidden = true;
    $("editorCard").hidden = false;
    $("lessonExtras").hidden = mode !== "lesson";
    $("freeTitleRow").hidden = mode !== "free";
    /* 「이 문제의 6자리 코드」 칸은 코드가 실제로 만들어졌을 때만 보인다 —
       빈 제목만 남으면 «6자리 코드 만들기 버튼이 없어졌다» 처럼 보인다(사용자 신고).
       서버가 없어 버튼이 안 나올 때는 위쪽 #noServer 안내가 이유를 설명한다. */
    $("freeMade").hidden = !(mode === "free" && ($("freeMadeOut").innerHTML || "").trim());
    var only = $("editorCard").querySelectorAll(".lessononly");
    for (var i = 0; i < only.length; i++) only[i].style.display = mode === "lesson" ? "" : "none";
    $("editorTitle").textContent = mode === "free"
      ? (editing ? "자유 문제 " + editing + " 수정" : "새 자유 문제")
      : "② 연결 문제";
    $("editorCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── 26차시 카드 목록 (예전 index.html) ─────────────── */
  var AREANAME = { A: "A. 내 방·나", B: "B. 우리 집 자동화", C: "C. 안전·방범", D: "D. 바깥·이동·건강", E: "E. 통신·종합" };
  function renderLessonList() {
    var byArea = { A: [], B: [], C: [], D: [], E: [] }, capstone = null;
    for (var n = 1; n <= 26; n++) {
      var L = LESSONS[n];
      if (!L) continue;
      if (L.capstone) { capstone = L; continue; }
      (byArea[L.area] || (byArea[L.area] = [])).push(L);
    }
    var h = "";
    ["A", "B", "C", "D", "E"].forEach(function (a) {
      if (!byArea[a].length) return;
      h += '<div class="blockttl">' + esc(AREANAME[a] || a) + "</div><div class=\"lgrid\">";
      byArea[a].forEach(function (L) { h += lcard(L); });
      h += "</div>";
    });
    if (capstone) h += '<div class="blockttl">마무리</div><div class="lgrid">' + lcard(capstone, true) + "</div>";
    $("lessonList").innerHTML = h;
  }
  function lcard(L, cap) {
    return '<div class="lcard' + (cap ? " cap" : "") + '" data-lesson="' + L.n + '">' +
      '<div class="ln"><span class="no">' + L.n + '</span><span class="tt">' + esc(L.title) + "</span></div>" +
      '<p class="pt">' + esc(L.part || "") + "</p>" +
      '<div class="tags"><span class="tg">' + (savedProb(L.n) ? "편집본 있음" : "기본 문제") + "</span>" +
      '<a class="tg" href="lesson.html?n=' + L.n + '" target="_blank" onclick="event.stopPropagation()">차시 내용 ▸</a></div>' +
      "</div>";
  }
  function markActiveCard() {
    var els = $("lessonList").querySelectorAll(".lcard");
    for (var i = 0; i < els.length; i++) {
      els[i].style.outline = Number(els[i].dataset.lesson) === cur ? "3px solid var(--pri)" : "";
    }
  }

  /* ── 부품 고르기 판 ─────────────────────────────────── */
  function paintPalette() {
    var h = "";
    window.Parts.GROUPS.forEach(function (grp) {
      var items = window.Parts.list.filter(function (p) { return p.group === grp.k; });
      if (!items.length) return;
      h += '<h3 class="gh">' + esc(grp.name) + ' <span class="pm">' + items.length + "개</span></h3>";
      h += '<div class="pgrid">' + items.map(function (p) {
        return '<button type="button" class="pbtn" data-add="' + p.id + '" title="' +
          esc(p.name + (p.model ? " (" + p.model + ")" : "")) + '">' +
          window.Parts.face(p.face, 46, 30) + '<span class="pn">' + esc(p.name) + "</span></button>";
      }).join("") + "</div>";
    });
    $("palette").innerHTML = h;
  }

  /* ── 부품 담기 ─────────────────────────────────────── */
  function usedPins() {
    var u = {};
    prob.parts.forEach(function (e) {
      Object.keys(e.pin || {}).forEach(function (k) {
        if (e.pin[k] !== null && e.pin[k] !== "") u[Number(e.pin[k])] = true;
      });
    });
    return u;
  }
  function firstFree(used) {
    for (var i = 0; i < window.Board.SIG_PINS.length; i++) {
      var n = window.Board.SIG_PINS[i];
      if (n > 16) continue;
      if (!used[n]) return n;
    }
    return 0;
  }
  function addPart(id) {
    var entry = { id: id, pin: {} };
    var part = resolvePart(entry);
    var used = usedPins(), gotOne = false;
    part.pins.forEach(function (pin) {
      if (pin.role !== "sig") return;
      if (pin.opt && gotOne) { entry.pin[pin.n] = ""; return; }
      var n = firstFree(used); used[n] = true; entry.pin[pin.n] = n; gotOne = true;
    });
    prob.parts.push(entry);
    if (part.ext && prob.ext.indexOf(part.ext) < 0) prob.ext.push(part.ext);
  }

  function paintChosen() {
    if (!prob.parts.length) {
      $("chosen").innerHTML = '<p class="hint">오른쪽에서 부품을 하나 이상 고르세요.</p>';
      return;
    }
    var h = "";
    prob.parts.forEach(function (entry, i) {
      var p = resolvePart(entry);
      h += '<div class="crow"><div class="ch">' + window.Parts.face(p.face, 40, 26) +
        "<b>" + esc(p.name) + "</b><span class=\"pm\">" + esc(p.model || "") + "</span>" +
        '<span class="fix' + (p.power === "5V" ? " five" : "") + '">전원 ' + p.power + "</span>" +
        '<span class="sp"></span>' +
        '<button type="button" data-up="' + i + '" title="위로">▲</button>' +
        '<button type="button" data-down="' + i + '" title="아래로">▼</button>' +
        '<button type="button" data-del="' + i + '" title="빼기">✕</button></div>';
      h += '<div class="pintable">';
      p.pins.forEach(function (pin) {
        var nm = esc(pin.n), isSig = pin.role === "sig";
        h += '<div class="pinrow' + (isSig ? " sig" : "") + '">' +
          '<span class="pinname">' + nm + "</span>" +
          '<span class="pinrole">' + window.Parts.ROLE_NAME[pin.role] + "</span>";
        if (pin.role === "vcc" || pin.role === "gnd") {
          h += '<span class="free">' + (pin.role === "vcc"
            ? "빨간 V 줄 아무 곳 · " + p.power + " 단자" : "검정 G 줄 아무 곳") + " — 정할 것 없음</span>";
        } else if (pin.role === "sda" || pin.role === "scl") {
          h += '<span class="free">I2C 라 <b>' + (pin.role === "sda" ? "19" : "20") + "번</b> 고정</span>";
        } else {
          var cur2 = (entry.pin || {})[pin.n];
          var opts = (pin.opt ? '<option value="">쓰지 않음</option>' : "") +
            window.Board.SIG_PINS.map(function (n) {
              return '<option value="' + n + '"' + (String(cur2) === String(n) ? " selected" : "") + ">" + n + "번</option>";
            }).join("");
          h += '<select data-pi="' + i + '" data-pn="' + nm + '">' + opts + "</select>" +
            (pin.sub ? '<span class="free">' + esc(pin.sub) + "</span>" : "");
        }
        h += "</div>";
      });
      h += "</div>";
      if (p.spec) h += '<p class="spec">' + rich(p.spec) + "</p>";
      h += "</div>";
    });
    $("chosen").innerHTML = h;
  }

  function paintExt() {
    var sug = [];
    prob.parts.forEach(function (e) { var x = resolvePart(e).ext; if (x && sug.indexOf(x) < 0) sug.push(x); });
    prob.ext.forEach(function (x) { if (x && sug.indexOf(x) < 0) sug.push(x); });
    $("extchips").innerHTML = sug.length
      ? sug.map(function (x) {
          return '<button type="button" class="chip' + (prob.ext.indexOf(x) >= 0 ? " on" : "") +
            '" data-ext="' + esc(x) + '">' + esc(x) + "</button>";
        }).join("")
      : '<span class="hint">고른 부품에는 확장프로그램이 필요하지 않습니다.</span>';
  }

  function powerShort() {
    var need = { "5V": 0, "3V3": 0 };
    prob.parts.forEach(function (e) {
      var p = resolvePart(e);
      if (p.power === "5V" || p.power === "3V3") need[p.power]++;
    });
    function spots(v) { return 1 + (prob.v1 === v ? 10 : 0) + (prob.v2 === v ? 15 : 0); }
    var out = [];
    ["5V", "3V3"].forEach(function (v) { if (need[v] > spots(v)) out.push({ v: v, need: need[v], spot: spots(v) }); });
    return out;
  }
  function paintWarn() {
    var short = powerShort();
    if (!short.length) { $("warn").innerHTML = ""; return; }
    $("warn").innerHTML = short.map(function (s) {
      var other = s.v === "5V" ? "3V3" : "5V";
      return '<div class="note red"><b>학생이 풀 수 없는 문제입니다.</b><br>' +
        s.v + " 가 필요한 부품이 <b>" + s.need + "개</b>인데 꽂을 자리는 <b>" + s.spot + "곳</b>뿐입니다.<br>" +
        '<button type="button" class="pri" style="margin-top:8px" data-fixv1="' +
        (s.v === "5V" ? "5V" : "3V3") + '">점퍼 V1 을 ' + (s.v === "5V" ? "5V" : "3V3") + " 로 옮기기</button></div>";
    }).join("");
  }

  function paintAll() {
    normalize(prob);
    $("v1").value = prob.v1; $("v2").value = prob.v2; $("ckUsb").checked = prob.usb === true;
    paintChosen(); paintExt(); paintWarn();
    $("probJson").value = JSON.stringify(prob, null, 2);
  }

  function isOverride() { return !!savedProb(cur); }
  function refreshModeLabel() {
    var e = $("probMode");
    if (e) e.textContent = isOverride() ? "— 이 브라우저에 저장된 편집본" : "— 기본 문제";
  }

  /* 프로젝트 26차시 하나를 편집기에 올린다 */
  function load(n) {
    mode = "lesson";
    cur = n;
    editing = null;
    $("pickname").textContent = (n + "차시 · " + (TITLES[n] || ""));
    $("wsN").textContent = n;
    prob = normalize(savedProb(n) || baseProb(n));
    $("probMsg").textContent = "";
    $("code6out").innerHTML = "";
    $("freeMadeOut").innerHTML = "";
    if (preview) { preview.destroy(); preview = null; }
    $("probPrev").innerHTML = "";
    paintAll();
    refreshModeLabel();
    tcRefresh();
    markActiveCard();
    if (hasServer) { paintCodeBar(); paintLessonCodeList(); }
  }

  /* 자유 문제 — 빈 문제로 새로 */
  function newFree() {
    mode = "free";
    editing = null;
    prob = normalize({ t: "자유 문제", v1: "3V3", v2: "3V3", usb: false, color: true, ext: [], parts: [] });
    $("freeTitle").value = "";
    $("probMsg").textContent = "빈 문제입니다. 오른쪽에서 부품을 골라 담으세요.";
    $("code6out").innerHTML = "";
    $("freeMadeOut").innerHTML = "";
    if (preview) { preview.destroy(); preview = null; }
    $("probPrev").innerHTML = "";
    $("pickname").textContent = "";
    paintAll();
    openEditor();
    if (hasServer) paintCodeBar();
  }

  function check() {
    if (!prob.parts.length) { alert("부품을 하나 이상 고르세요."); return false; }
    var seen = {}, dup = null;
    prob.parts.forEach(function (e) {
      Object.keys(e.pin || {}).forEach(function (k) {
        var v = e.pin[k];
        if (v === null || v === "") return;
        if (seen[v]) dup = v; else seen[v] = true;
      });
    });
    if (dup !== null) { alert(dup + "번 신호핀을 두 곳에서 쓰고 있습니다. 번호를 다르게 정해 주세요."); return false; }
    var lack = powerShort();
    if (lack.length) {
      var s = lack[0], other = s.v === "5V" ? "5V" : "3V3";
      alert(s.v + " 자리가 모자랍니다. 점퍼 V1 을 " + other + " 로 옮겨 주세요.");
      return false;
    }
    return true;
  }

  /* 코드에 넣을 문제 —
       프로젝트 26차시 : n 에 차시 번호를 담는다 (목록에서 «몇 차시» 로 보인다)
       자유 문제       : n 은 비우고, 교사가 적은 제목을 쓴다 */
  function probForCode() {
    var o = clone(prob);
    if (mode === "free") {
      o.n = null;
      o.t = (($("freeTitle").value || "").trim()) || "자유 문제";
    } else {
      o.n = cur;
      if (!o.t || o.t === cur + "차시 연결") o.t = cur + "차시 · " + (TITLES[cur] || "연결");
    }
    return o;
  }

  /* ── 6자리 코드 ─────────────────────────────────────── */
  function paintCodeBar() {
    if (!hasServer) return;
    if (editing) {
      $("code6bar").innerHTML =
        '<button type="button" id="btnSave6" class="pri big">💾 ' + esc(editing) + ' 코드로 저장</button>' +
        '<button type="button" id="btnMake6">🔢 새 코드로 따로 만들기</button>' +
        '<button type="button" id="btnStopEdit" class="gh">고치기 그만두기</button>' +
        '<span class="hint">학생이 이미 아는 번호이므로 <b>같은 번호로 저장</b>하면 다시 불러 줄 필요가 없습니다.</span>';
      $("btnSave6").onclick = save6;
      $("btnStopEdit").onclick = function () { editing = null; $("code6out").innerHTML = ""; paintCodeBar(); };
    } else {
      $("code6bar").innerHTML =
        '<button type="button" id="btnMake6" class="pri big">🔢 6자리 코드 만들기</button>' +
        '<span class="hint">이 문제를 학생에게 나눠 줄 숫자를 만듭니다. 숫자만 불러 주면 됩니다.</span>';
    }
    $("btnMake6").onclick = make6;
  }

  function make6() {
    if (!check()) return;
    window.Code.makeCode(probForCode(), function (code, err) {
      if (!code) { alert("코드를 만들지 못했습니다.\n" + (err || "")); return; }
      editing = code;
      showCode(code, "학생에게 이 숫자를 불러 주세요");
      paintCodeBar();
      refreshLists();
    });
  }

  function save6() {
    if (!check() || !editing) return;
    window.Code.saveCode(editing, probForCode(), function (ok, err) {
      if (!ok) { alert("저장하지 못했습니다.\n" + (err || "")); return; }
      showCode(editing, "✅ 같은 번호에 저장했습니다. 학생이 새로고침하면 바뀐 문제가 나옵니다");
      refreshLists();
    });
  }

  function showCode(code, note) {
    var html = '<span class="bigcode">' + esc(code) + "</span>" +
      '<span class="hint" style="margin-left:12px">' + esc(note) + "</span>";
    $("code6out").innerHTML = html;
    if (mode === "free") { $("freeMadeOut").innerHTML = html; $("freeMade").hidden = false; }
  }

  function when(sec) {
    if (!sec) return "";
    var d = new Date(sec * 1000);
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일 " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  function codeRow(x, showLesson) {
    return '<tr' + (String(x.code) === String(editing) ? ' style="background:#fff8e1"' : "") + '>' +
      '<td class="c"><b class="codeno">' + esc(x.code) + "</b></td>" +
      (showLesson ? '<td class="c">' + (x.lesson ? x.lesson + "차시" : "—") + "</td>" : "") +
      "<td>" + esc(x.title) + "</td>" +
      '<td class="c">' + x.parts + "개</td>" +
      '<td class="c pm">' + when(x.at) + "</td>" +
      '<td class="c nowrap">' +
        '<button type="button" data-edit6="' + esc(x.code) + '">✏️ 수정</button> ' +
        '<button type="button" data-open6="' + esc(x.code) + '">👁 학생 화면</button> ' +
        '<button type="button" data-del6="' + esc(x.code) + '">🗑 삭제</button>' +
      "</td></tr>";
  }

  /* 자유 문제 목록 (차시 번호가 없는 코드) */
  function paintFreeList() {
    var box = $("freeList");
    if (!box) return;
    if (!hasServer) {
      box.innerHTML = '<p class="hint">문제를 담을 곳이 아직 정해지지 않았습니다 — 아래 편집기의 안내를 한 번만 따라 주세요.</p>';
      return;
    }
    window.Code.codes(function (list) {
      var rows = list.filter(function (x) { return !x.lesson; });
      if (!rows.length) {
        box.innerHTML = '<p class="hint">아직 만든 자유 문제가 없습니다. 「＋ 새 문제 만들기」 를 눌러 만드세요.</p>';
        return;
      }
      box.innerHTML = '<table class="tb"><tr><th class="c">6자리 코드</th><th>제목</th>' +
        '<th class="c">부품</th><th class="c">만든 때</th><th class="c">하기</th></tr>' +
        rows.map(function (x) { return codeRow(x, false); }).join("") + "</table>" +
        '<p class="hint">「✏️ 수정」 으로 고치면 <b>같은 6자리 번호</b>가 유지됩니다.</p>';
    });
  }

  /* 지금 편집 중인 차시로 만든 코드 */
  function paintLessonCodeList() {
    var box = $("lessonCodeList");
    if (!box) return;
    if (!hasServer) { box.innerHTML = '<p class="hint">문제를 담을 곳이 아직 정해지지 않았습니다.</p>'; return; }
    window.Code.codes(function (list) {
      var rows = list.filter(function (x) { return String(x.lesson) === String(cur); });
      box.innerHTML = rows.length
        ? '<table class="tb"><tr><th class="c">6자리 코드</th><th>제목</th><th class="c">부품</th>' +
            '<th class="c">만든 때</th><th class="c">하기</th></tr>' +
            rows.map(function (x) { return codeRow(x, false); }).join("") + "</table>"
        : '<p class="hint">이 차시로 만든 코드가 아직 없습니다. 위에서 「🔢 6자리 코드 만들기」 를 누르세요.</p>';
    });
  }

  function refreshLists() {
    paintFreeList();
    paintLessonCodeList();
  }

  function edit6(code) {
    window.Code.byCode(code, function (p, err) {
      if (!p) { alert("그 코드를 읽을 수 없습니다.\n" + (err || "")); return; }
      prob = normalize(p);
      editing = code;
      if (p.n) {
        mode = "lesson";
        cur = Number(p.n);
        $("pickname").textContent = (cur + "차시 · " + (TITLES[cur] || "")) + " · " + code + " 수정 중";
        $("wsN").textContent = cur;
        tcRefresh();
        markActiveCard();
      } else {
        mode = "free";
        $("freeTitle").value = p.t || "";
        $("pickname").textContent = code + " 수정 중";
      }
      if (preview) { preview.destroy(); preview = null; }
      $("probPrev").innerHTML = "";
      paintAll();
      refreshModeLabel();
      showCode(code, "고친 뒤 「💾 " + code + " 코드로 저장」 을 누르세요");
      openEditor();
      paintCodeBar();
    });
  }

  /* ── 이벤트 ─────────────────────────────────────────── */
  function bind() {
    $("lessonList").addEventListener("click", function (ev) {
      var c = ev.target.closest ? ev.target.closest(".lcard") : null;
      if (!c) return;
      load(Number(c.dataset.lesson));
      openEditor();
    });
    $("btnNewFree").onclick = newFree;
    $("btnBackList").onclick = function () {
      if (preview) { preview.destroy(); preview = null; }
      showView(mode === "lesson" ? "lessons" : "free");
    };

    /* 두 코드 목록(자유·차시)의 버튼을 한곳에서 받는다 */
    $("mainWrap").addEventListener("click", function (ev) {
      var d = ev.target.dataset || {};
      if (d.edit6) edit6(d.edit6);
      else if (d.open6) window.open("index.html#code=" + d.open6, "_blank");
      else if (d.del6 && confirm(d.del6 + " 문제를 지울까요? 학생이 그 번호를 넣으면 «없는 번호» 가 됩니다.")) {
        window.Code.delCode(d.del6, function () {
          if (editing === d.del6) { editing = null; $("code6out").innerHTML = ""; $("freeMadeOut").innerHTML = ""; }
          paintCodeBar(); refreshLists();
        });
      }
    });

    $("v1").onchange = function () { prob.v1 = this.value; paintChosen(); paintWarn(); };
    $("v2").onchange = function () { prob.v2 = this.value; paintWarn(); };
    $("ckUsb").onchange = function () { prob.usb = this.checked; };

    $("btnNewBlank").onclick = function () {
      if (prob.parts.length && !confirm("담은 부품을 지우고 빈 문제에서 다시 시작할까요?")) return;
      editing = null;
      prob = normalize({ t: mode === "free" ? "자유 문제" : cur + "차시 연결",
        v1: "3V3", v2: "3V3", usb: false, color: true, ext: [], parts: [] });
      paintAll();
      $("code6out").innerHTML = ""; $("freeMadeOut").innerHTML = "";
      if (hasServer) paintCodeBar();
      $("probMsg").textContent = "빈 문제입니다. 오른쪽에서 부품을 골라 담으세요.";
    };
    $("btnResetProb").onclick = function () {
      if (!confirm("고친 내용을 지우고 이 차시의 기본 연결 문제로 되돌릴까요?")) return;
      localStorage.removeItem("pl.connect." + cur);
      load(cur);
      $("probMsg").textContent = "기본 문제로 되돌렸습니다.";
    };
    $("btnPreview").onclick = function () {
      if (!check()) return;
      if (preview) preview.destroy();
      preview = window.Connect.mount($("probPrev"), clone(prob), {});
      $("probMsg").textContent = "미리보기입니다.";
      $("probPrev").scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    $("btnSaveProb").onclick = function () {
      if (!check()) return;
      localStorage.setItem("pl.connect." + cur, JSON.stringify(prob));
      refreshModeLabel();
      renderLessonList(); markActiveCard();
      $("probMsg").textContent = "✅ 이 브라우저의 " + cur + "차시 페이지(lesson.html) ②에 반영됩니다. 학생에게 나눠 주려면 「🔢 6자리 코드 만들기」 를 쓰세요.";
    };
    $("btnDlProb").onclick = function () {
      if (!check()) return;
      var blob = new Blob([JSON.stringify(probForCode(), null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "연결문제_" + cur + "차시.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    $("btnJsonApply").onclick = function () {
      try {
        var o = JSON.parse($("probJson").value);
        if (!o || !Array.isArray(o.parts)) throw new Error("parts 배열이 필요합니다");
        prob = normalize(o);
        paintAll();
        $("probMsg").textContent = "JSON 을 적용했습니다. 미리보기로 확인하세요.";
      } catch (e) { $("probMsg").textContent = "❌ JSON 오류: " + e.message; }
    };
    $("btnExtAdd").onclick = function () {
      var v = $("extIn").value.trim();
      if (!v) return;
      if (prob.ext.indexOf(v) < 0) prob.ext.push(v);
      $("extIn").value = "";
      paintExt();
    };

    $("palette").addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-add]") : null;
      if (b) { addPart(b.dataset.add); paintAll(); }
    });
    $("chosen").addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-del],[data-up],[data-down]") : null;
      if (!t) return;
      if (t.dataset.del !== undefined) prob.parts.splice(Number(t.dataset.del), 1);
      else if (t.dataset.up !== undefined) move(Number(t.dataset.up), -1);
      else if (t.dataset.down !== undefined) move(Number(t.dataset.down), 1);
      paintAll();
    });
    $("chosen").addEventListener("change", function (ev) {
      var s = ev.target;
      if (s.tagName === "SELECT" && s.dataset.pi !== undefined) {
        prob.parts[Number(s.dataset.pi)].pin[s.dataset.pn] = s.value === "" ? "" : Number(s.value);
        paintWarn();
      }
    });
    $("extchips").addEventListener("click", function (ev) {
      var x = ev.target.dataset && ev.target.dataset.ext;
      if (!x) return;
      var i = prob.ext.indexOf(x);
      if (i >= 0) prob.ext.splice(i, 1); else prob.ext.push(x);
      paintExt();
    });
    $("warn").addEventListener("click", function (ev) {
      var v = ev.target.dataset && ev.target.dataset.fixv1;
      if (!v) return;
      prob.v1 = v; paintAll();
    });

    /* (코드 목록의 버튼은 위 $("mainWrap") 위임 핸들러가 받는다) */

    /* ④ 인쇄용 활동지 */
    $("btnPrintWs").onclick = function () {
      var L = LESSONS[cur];
      if (!L || !L.worksheet) { alert("이 차시는 아직 학습지가 없습니다."); return; }
      var items = L.worksheet.map(function (it) {
        var k = it.type === "fill" ? "short" : (it.type || "choice");
        return { q: it.q, kind: k, opts: it.opts, ph: it.ph, lines: 2 };
      });
      window.Print.sheet({
        title: cur + "차시 학습지 — " + (TITLES[cur] || ""),
        subtitle: "센서 공작소 · 개념 정리 4문항",
        footer: "센서 공작소 · " + cur + "차시",
        sections: [{ step: "학습지", items: items }]
      });
    };

    /* ③ 텍스트 코드 등록 */
    $("tcMake").onchange = function () { tcUpload(this, "makecode"); };
    $("tcEntry").onchange = function () { tcUpload(this, "entry"); };
    document.querySelectorAll("[data-clr]").forEach(function (b) {
      b.onclick = function () { localStorage.removeItem("pl.textcode." + cur + "." + b.dataset.clr); tcRefresh(); };
    });
  }
  function move(i, d) {
    var j = i + d;
    if (j < 0 || j >= prob.parts.length) return;
    var t = prob.parts[i]; prob.parts[i] = prob.parts[j]; prob.parts[j] = t;
  }

  /* ── 텍스트 코드 등록 ─────────────────────────────── */
  function tcRefresh() {
    var m = [];
    ["makecode", "entry"].forEach(function (env) {
      if (localStorage.getItem("pl.textcode." + cur + "." + env)) m.push(env === "makecode" ? "메이크코드" : "엔트리");
    });
    $("tcMsg").textContent = m.length ? "등록됨: " + m.join(" · ") : "등록된 텍스트 코드가 없습니다.";
  }
  function tcUpload(input, env) {
    var f = input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { localStorage.setItem("pl.textcode." + cur + "." + env, r.result); tcRefresh(); }
      catch (e) { alert("저장 공간이 부족합니다. 더 작은 이미지를 올려 주세요."); }
    };
    r.readAsDataURL(f);
  }

  g.Teacher = { boot: boot };
})(window);
