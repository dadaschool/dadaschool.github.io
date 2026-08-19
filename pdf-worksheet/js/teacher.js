/* =========================================================
   teacher.js — 선생님용 제출 현황
   ---------------------------------------------------------
   ⚠ 개인정보
     이 화면은 학생 이름·학번을 **화면에만** 보여 준다. 브라우저에 저장하지 않는다.
     선생님 코드도 저장하지 않는다 — 탭을 닫으면 다시 넣어야 한다(공용 PC 대비).

   ⚠ 「누가 안 냈는지」를 어떻게 아는가
     학생 명단을 앱이 갖고 있지 않다(개인정보를 두지 않으려고).
     대신 교사가 **시작 학번 · 마지막 학번 · 결번**을 적어 «있는 학번 목록»을 만들고,
     그중 제출하지 않은 번호를 찾는다.
       예) 1 ~ 30, 결번 7·19  →  28명이 명단, 그중 안 낸 번호를 보여 준다
     ⚠ **결번**(전출·미배정)을 뺄 수 있어야 한다. 처음에는 「그 반 인원」 숫자 하나만
       받아 1~N 을 전부 있다고 가정했는데, 그러면 전출한 학생 번호가 **매번**
       미제출자로 떠서 교사가 머리로 걸러 내야 했다(사용자 지적으로 고침).
     ⚠ 반대로 **명단에 없는 학번으로 낸 제출**도 따로 알려 준다. 학생이 학번을
       잘못 적으면 그 학생은 «냈는데 안 냈다» 로 처리되기 때문이다.
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var key = "";          // 선생님 코드 (메모리에만 둔다)
  var tasks = [];
  var current = null;
  var rows = [];

  /* 제출물이 어디에 쌓이나 — js/config.js 의 TARGET */
  function 드라이브인가() { return window.API.target() === "drive"; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function note(el, text, kind) {
    el.className = "hint" + (kind ? " " + kind : "");
    el.innerHTML = text;
    el.style.display = "";
  }

  /* 시험 모드면 화면 맨 위에 노란 띠를 띄운다.
     ⚠ 이것이 없어서 «노션에 댓글이 안 달린다» 는 혼란이 실제로 있었다. */
  function showDemoBar() {
    if (!window.API.demo) return;
    var el = document.getElementById("demobar");
    if (!el) return;
    el.innerHTML =
      "🧪 <strong>시험 모드입니다 — 노션에 연결되지 않았습니다.</strong> " +
      "여기 보이는 제출물은 <code>demo/제출/</code> 폴더의 파일이고, 노션과는 관계가 없습니다.<br>" +
      "노션에 연결하려면 <code>worker/설치안내.md</code> 를 따라 " +
      "<code>js/config.js</code> 의 <code>WORKER</code> 를 채우세요.";
    el.classList.add("on");
  }

  /* ---------------------------------------------------------
     들어가기
     --------------------------------------------------------- */
  function enter() {
    var v = $("key").value.trim();
    if (!v) { note($("gateMsg"), "코드를 넣어 주세요.", "bad"); return; }
    if (!window.API.ready()) {
      note($("gateMsg"), "설정이 끝나지 않았습니다 — <code>js/config.js</code> 의 " +
        "<code>WORKER</code> 주소가 비어 있습니다.", "bad");
      return;
    }
    key = v;
    $("gateMsg").style.display = "none";
    $("enter").disabled = true;
    $("enter").textContent = "확인 중…";

    window.API.report(key, "").then(function (d) {
      tasks = d.tasks || [];
      showDemoBar();
      $("gate").style.display = "none";
      $("main").style.display = "";
      $("badge").textContent = "활동지 " + tasks.length + "개";
      보는곳단추();
      저장소에맞추기();
      drawTasks();
    }).catch(function (e) {
      key = "";
      $("enter").disabled = false;
      $("enter").textContent = "확인";
      note($("gateMsg"), esc(e.message), "bad");
    });
  }

  /* 제출물을 어디서 볼지 고르는 줄.
     ⚠ 학생이 고를 수 있게 두면 제출물이 두 곳에 흩어진다. 그래서 교사도
       **번갈아 볼 수 있어야** 한다. 이 줄이 없으면 한쪽만 보이고
       «안 냈다» 고 잘못 판단하게 된다. */
  function 보는곳단추() {
    var 둘다 = window.API.canNotion() && window.API.canDrive();
    var vp = $("viewPick");
    vp.style.display = 둘다 ? "" : "none";
    if (!둘다) return;
    var 지금 = 드라이브인가() ? "drive" : "notion";
    Array.prototype.forEach.call(vp.querySelectorAll("[data-view]"), function (b) {
      b.classList.toggle("on", b.dataset.view === 지금);
      b.onclick = function () {
        window.API.setTarget(b.dataset.view);
        보는곳단추();
        저장소에맞추기();
        /* 활동지 목록부터 다시 받는다 — 저장소가 바뀌면 목록도 달라질 수 있다 */
        $("detail").style.display = "none";
        window.API.report(key, "").then(function (d) {
          tasks = d.tasks || [];
          $("badge").textContent = "활동지 " + tasks.length + "개";
          drawTasks();
        }).catch(function (e) {
          $("tasks").innerHTML = '<div class="hint bad">' + esc(e.message) + "</div>";
        });
      };
    });
  }

  /* 노션이냐 드라이브냐에 따라 안 쓰는 부분을 감춘다.
     ⚠ 「제출」 표 만들기는 노션에만 있는 기능이고,
       「반 폴더 미리 만들기」는 드라이브에만 있는 기능이다. */
  function 저장소에맞추기() {
    var d = 드라이브인가();
    /* 「제출」 표 만들기는 **노션에만** 있는 기능이라 드라이브일 때는 감춘다.
       ⚠ previousElementSibling 로 구분선을 찾지 말 것 — HTML 구조를 고치면 깨진다.
         그래서 id(setupLine)를 붙여 두었다. */
    ["setup", "setupHead", "setupLine", "setupWhy"].forEach(function (id) {
      var el = $(id);
      if (el) el.style.display = d ? "none" : "";
    });
    if (d) {
      var w = $("whereNote");
      if (w) {
        w.innerHTML =
          "⚠ 제출한 <strong>PDF 파일</strong>은 <strong>구글 드라이브</strong>에 있습니다 — " +
          "<code>과제제출 / 반 / 과제 / 파일.pdf</code><br>" +
          "아래 표의 <strong>«열기»</strong> 를 누르면 그 파일이 바로 열립니다. " +
          "같은 학생이 다시 내면 <u>덮어써지고</u>, 이전 것은 드라이브의 «버전 기록» 에 남습니다.";
      }
    }
  }

  /* ---------------------------------------------------------
     활동지 목록
     --------------------------------------------------------- */
  function drawTasks() {
    var box = $("tasks");
    box.innerHTML = "";
    if (!tasks.length) {
      box.innerHTML = '<div class="hint warn">노션 「과제제출」 표에 글이 없습니다.</div>';
      return;
    }
    tasks.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "taskbtn";
      b.textContent = t.title;
      var sub = document.createElement("span");
      sub.className = "due";
      var bits = [];
      bits.push(t.classes && t.classes.length ? t.classes.join(" · ") + "반" : "반 미지정 (학생에게 안 보임)");
      bits.push(t.hasFile ? "파일 있음" : "파일 없음 (학생에게 안 보임)");
      bits.push(t.closed ? "마감됨" : (t.due ? "마감 " + t.due : "마감 없음"));
      sub.textContent = bits.join("  ·  ");
      b.appendChild(sub);
      b.onclick = function () { openTask(t); };
      box.appendChild(b);
    });
  }

  /* ---------------------------------------------------------
     제출 현황
     --------------------------------------------------------- */
  function openTask(t) {
    current = t;
    $("detail").style.display = "";
    $("detailTitle").textContent = "📋 " + t.title;
    var sel = $("classPick");
    sel.innerHTML = "";
    var all = document.createElement("option");
    all.value = ""; all.textContent = "전체";
    sel.appendChild(all);
    (t.classes || []).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c + "반";
      sel.appendChild(o);
    });
    if ((t.classes || []).length === 1) sel.value = t.classes[0];
    $("drivePrep").style.display = 드라이브인가() ? "" : "none";
    $("prepMsg").style.display = "none";
    load();
  }

  function load() {
    if (!current) return;
    note($("summary"), '불러오는 중 <span class="spin"></span>', "");
    $("rows").innerHTML = "";
    $("missing").style.display = "none";
    window.API.report(key, current.id, current.title).then(function (d) {
      rows = d.rows || [];
      draw();
    }).catch(function (e) {
      note($("summary"), "제출 현황을 받지 못했습니다 — " + esc(e.message), "bad");
    });
  }

  /* ---------------------------------------------------------
     그 반에 «있는 학번» 목록 만들기

     시작 ~ 마지막 사이의 번호에서 **결번**(전출·미배정)을 뺀다.
     ⚠ 이것을 안 하면 전출한 학생의 번호가 **매번 미제출자로** 뜬다.
       처음에는 「그 반 인원」 숫자 하나만 받아 1~N 을 전부 있다고 가정했는데,
       그러면 선생님이 매 시간 머리로 걸러 내야 했다(사용자 지적으로 고침).
     --------------------------------------------------------- */
  function parseSkip(text) {
    /* "7, 19" · "7 19" · "7·19" 를 모두 받는다 */
    var out = {};
    String(text || "").split(/[^0-9]+/).forEach(function (t) {
      var n = parseInt(t, 10);
      if (isFinite(n) && n > 0) out[n] = true;
    });
    return out;
  }

  function roster() {
    var from = parseInt($("noFrom").value, 10);
    var to = parseInt($("noTo").value, 10);
    if (!isFinite(from) || from < 1) from = 1;
    if (!isFinite(to) || to < from) return { list: [], skip: {}, from: from, to: from - 1 };
    var skip = parseSkip($("noSkip").value);
    var list = [];
    for (var i = from; i <= to; i++) if (!skip[i]) list.push(i);
    return { list: list, skip: skip, from: from, to: to };
  }

  function draw() {
    var klass = $("classPick").value;
    var r0 = roster();
    var head = r0.list.length;

    var skipCount = Object.keys(r0.skip).filter(function (n) {
      return +n >= r0.from && +n <= r0.to;
    }).length;
    $("rosterInfo").textContent = head
      ? "→ " + head + "명" + (skipCount ? " (결번 " + skipCount + "명 뺐음)" : "")
      : "→ 학번 범위를 확인해 주세요";

    var list = klass ? rows.filter(function (r) { return r.klass === klass; }) : rows.slice();

    /* 같은 학생이 여러 번 냈으면 **마지막 회차만** 센다 */
    var byStudent = {};
    list.forEach(function (r) {
      var k = r.klass + "/" + r.no;
      if (!byStudent[k] || (r.round || 0) > (byStudent[k].round || 0)) byStudent[k] = r;
    });
    var uniq = Object.keys(byStudent).map(function (k) { return byStudent[k]; });
    uniq.sort(function (a, b) {
      if (a.klass !== b.klass) return String(a.klass).localeCompare(String(b.klass), "ko", { numeric: true });
      return (a.no || 0) - (b.no || 0);
    });

    var again = list.length - uniq.length;
    note($("summary"),
      "<strong>" + (klass ? klass + "반" : "전체") + "</strong> · 제출 <strong>" + uniq.length + "명</strong>" +
      (klass && head ? " / " + head + "명" : "") +
      (again ? " · 다시 낸 것 " + again + "건" : ""), "good");

    /* 빠진 학번 — 반을 하나 고른 경우에만 뜻이 있다 */
    $("missing").style.display = "none";
    $("stray").style.display = "none";
    if (klass && head) {
      var got = {};
      uniq.forEach(function (r) { if (r.no) got[r.no] = 1; });

      var miss = r0.list.filter(function (n) { return !got[n]; });
      if (miss.length) {
        note($("missing"), "<strong>안 낸 학번 " + miss.length + "명</strong> — " + miss.join(" · ") +
          "<br><small>※ 결석한 학생도 여기에 들어갑니다. 결번은 빠져 있습니다.</small>", "warn");
      } else {
        note($("missing"), "✅ <strong>" + klass + "반 " + head + "명 전원 제출</strong>", "good");
      }

      /* ⚠ 명단에 없는 학번으로 낸 제출 — 학생이 학번을 잘못 적었을 가능성이 크다.
         이것을 안 알려 주면 그 학생은 «냈는데 안 냈다» 고 처리된다. */
      var inRoster = {};
      r0.list.forEach(function (n) { inRoster[n] = true; });
      var stray = uniq.filter(function (r) { return r.no && !inRoster[r.no]; });
      if (stray.length) {
        note($("stray"),
          "⚠ <strong>명단에 없는 학번으로 낸 제출 " + stray.length + "건</strong> — " +
          stray.map(function (r) { return esc(r.who) + "(" + r.no + "번)"; }).join(", ") +
          "<br><small>학번을 잘못 적었거나, 학번 범위·결번 설정이 실제와 다를 수 있습니다.</small>", "bad");
      }
    }

    var t = $("rows");
    if (!uniq.length) {
      t.innerHTML = '<tr><td class="miss">아직 제출이 없습니다.</td></tr>';
      return;
    }
    var html = "<tr><th>반</th><th>학번</th><th>제출자</th><th>회차</th><th>제출 시각</th><th>확인</th><th>노션</th></tr>";
    uniq.forEach(function (r) {
      html += "<tr>" +
        "<td>" + esc(r.klass) + "</td>" +
        "<td>" + esc(r.no) + "</td>" +
        "<td>" + esc(r.who) + "</td>" +
        "<td>" + (r.round > 1 ? "<strong>" + r.round + "회</strong>" : "1회") + "</td>" +
        "<td>" + esc(fmt(r.at)) + "</td>" +
        "<td>" + (r.checked ? "✅" : "") + "</td>" +
        "<td>" + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">열기</a>' : "") + "</td>" +
        "</tr>";
    });
    t.innerHTML = html;
  }

  /* 노션이 준 UTC 시각을 한국 시간으로 */
  function fmt(iso) {
    if (!iso) return "";
    var ms = Date.parse(iso);
    if (!isFinite(ms)) return "";
    var d = new Date(ms + 9 * 3600 * 1000);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getUTCMonth() + 1) + "/" + p(d.getUTCDate()) + " " +
           p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  }

  /* ---------------------------------------------------------
     「제출」 표 만들기 (한 번만)
     --------------------------------------------------------- */
  function setup() {
    if (!key) return;
    $("setup").disabled = true;
    note($("setupMsg"), '만드는 중 <span class="spin"></span>', "");
    window.API.setup(key).then(function (d) {
      note($("setupMsg"),
        (d.created ? "✅ " : "ℹ️ ") + esc(d.message || "끝났습니다.") +
        (d.databaseId ? "<br><small>표 id : <code>" + esc(d.databaseId) + "</code></small>" : ""),
        d.created ? "good" : "");
      $("setup").disabled = false;
    }).catch(function (e) {
      note($("setupMsg"), esc(e.message), "bad");
      $("setup").disabled = false;
    });
  }

  /* 반 폴더 미리 만들기 (드라이브) */
  function prepare() {
    if (!current) return;
    var 반들 = current.classes || [];
    if (!반들.length) { note($("prepMsg"), "이 활동지에 반이 지정되지 않았습니다.", "warn"); return; }
    $("prepare").disabled = true;
    note($("prepMsg"), '만드는 중 <span class="spin"></span>', "");
    window.API.prepare(key, current.title, 반들).then(function (d) {
      note($("prepMsg"), "✅ " + esc(d.message || "준비했습니다."), "good");
      $("prepare").disabled = false;
    }).catch(function (e) {
      note($("prepMsg"), esc(e.message), "bad");
      $("prepare").disabled = false;
    });
  }

  /* ---------------------------------------------------------
     🖨 인쇄용 활동지 내려받기

     이 앱은 교사가 올린 **원본 활동지 PDF 자체가 인쇄용 활동지**다.
     그래서 새로 만들 것이 없고, 학생이 받는 것과 **똑같은 파일**을 내려받는다
     — 화면에서 푸는 것과 종이가 다를 수 없다는 뜻이라 오히려 안전하다.

     ⚠ 답이 든 제출물이 아니라 **원본**이다. 정답은 어디에도 넣지 않는다
       (루트 CLAUDE.md 의 [인쇄용 활동지 규칙]).
     --------------------------------------------------------- */
  function 인쇄용받기() {
    if (!current) { note($("printMsg"), "먼저 활동지를 고르세요.", "warn"); return; }
    /* 활동지를 받으려면 반이 필요하다(그 반에 열려 있는지 확인하기 때문).
       고른 반이 없으면 그 활동지의 첫 반을 쓴다. */
    var 반 = $("classPick").value || (current.classes || [])[0] || "";
    if (!반) { note($("printMsg"), "이 활동지에 반이 지정되지 않았습니다.", "warn"); return; }

    $("printPdf").disabled = true;
    note($("printMsg"), '활동지를 받는 중 <span class="spin"></span>', "");
    window.API.pdf(current.id, 반).then(function (bytes) {
      var 이름 = current.title.replace(/[\\\/:*?"<>|]+/g, "") + "_인쇄용.pdf";
      var size = window.Ink.download(bytes, 이름);
      note($("printMsg"),
        "🖨 <strong>" + esc(이름) + "</strong> · " + Math.round(size / 1024) + " KB 내려받았습니다.<br>" +
        "<small>그 파일을 열어 인쇄하세요. 학생 이름·학번 칸은 활동지 안에 있는 그대로입니다.</small>", "good");
      $("printPdf").disabled = false;
    }).catch(function (e) {
      note($("printMsg"), esc(e.message), "bad");
      $("printPdf").disabled = false;
    });
  }

  /* ---------------------------------------------------------
     연결
     --------------------------------------------------------- */
  $("enter").onclick = enter;
  $("key").addEventListener("keydown", function (e) { if (e.key === "Enter") enter(); });
  $("classPick").onchange = draw;
  $("noFrom").oninput = draw;
  $("noTo").oninput = draw;
  $("noSkip").oninput = draw;
  $("refresh").onclick = load;
  $("setup").onclick = setup;
  $("prepare").onclick = prepare;
  $("printPdf").onclick = 인쇄용받기;
})();
