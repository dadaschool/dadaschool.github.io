/* =========================================================
   teacher.js — 선생님용 제출 현황
   ---------------------------------------------------------
   ⚠ 개인정보
     이 화면은 학생 이름·학번을 **화면에만** 보여 준다. 브라우저에 저장하지 않는다.
     선생님 코드도 저장하지 않는다 — 탭을 닫으면 다시 넣어야 한다(공용 PC 대비).

   ⚠ 「누가 안 냈는지」를 어떻게 아는가
     학생 명단을 앱이 갖고 있지 않다(개인정보를 두지 않으려고).
     대신 **학번을 정렬해 빈 번호**를 찾는다. 그 반 인원만 알려 주면
     「24명 중 18명 제출 · 빠진 학번 3·7·11·19」 처럼 나온다.
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var key = "";          // 선생님 코드 (메모리에만 둔다)
  var tasks = [];
  var current = null;
  var rows = [];

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
      drawTasks();
    }).catch(function (e) {
      key = "";
      $("enter").disabled = false;
      $("enter").textContent = "확인";
      note($("gateMsg"), esc(e.message), "bad");
    });
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
    load();
  }

  function load() {
    if (!current) return;
    note($("summary"), '불러오는 중 <span class="spin"></span>', "");
    $("rows").innerHTML = "";
    $("missing").style.display = "none";
    window.API.report(key, current.id).then(function (d) {
      rows = d.rows || [];
      draw();
    }).catch(function (e) {
      note($("summary"), "제출 현황을 받지 못했습니다 — " + esc(e.message), "bad");
    });
  }

  function draw() {
    var klass = $("classPick").value;
    var head = parseInt($("headcount").value, 10) || 0;

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
      (head ? " / " + head + "명" : "") +
      (again ? " · 다시 낸 것 " + again + "건" : ""), "good");

    /* 빠진 학번 — 반을 하나 고른 경우에만 뜻이 있다 */
    if (klass && head) {
      var got = {};
      uniq.forEach(function (r) { if (r.no) got[r.no] = 1; });
      var miss = [];
      for (var i = 1; i <= head; i++) if (!got[i]) miss.push(i);
      if (miss.length) {
        note($("missing"), "<strong>빠진 학번 " + miss.length + "명</strong> — " + miss.join(" · ") +
          "<br><small>※ 결석·전학 등으로 없는 번호도 함께 나옵니다.</small>", "warn");
      } else {
        note($("missing"), "✅ <strong>" + klass + "반 전원 제출</strong>", "good");
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

  /* ---------------------------------------------------------
     연결
     --------------------------------------------------------- */
  $("enter").onclick = enter;
  $("key").addEventListener("keydown", function (e) { if (e.key === "Enter") enter(); });
  $("classPick").onchange = draw;
  $("headcount").oninput = draw;
  $("refresh").onclick = load;
  $("setup").onclick = setup;
})();
