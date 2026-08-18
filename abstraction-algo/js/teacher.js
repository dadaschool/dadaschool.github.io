/* =========================================================
   teacher.js — 선생님용 화면

     ① 정답·해설표  : js/spec1.js · js/spec2.js 를 그대로 읽어 만든다.
                     학생 학습지와 같은 파일을 보므로 정답이 어긋날 수 없다.
     ② 제출물 정리  : 학생이 낸 PDF 의 **파일 이름만** 읽어 표로 만든다.
                     파일 내용을 열지 않고, 어디에도 보내지 않는다.
                     읽은 목록은 화면에만 있으며 새로고침하면 사라진다.
     ③ 평가 루브릭  : 화면과 인쇄용.

   외부 라이브러리 없이 동작하며, teacher.html 을 더블클릭해도 그대로 쓸 수 있다.
   ========================================================= */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------------------------------------------------------
     화면 바꾸기
     --------------------------------------------------------- */
  var TABS = ["t1", "t2", "t3", "t4"];
  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      TABS.forEach(function (t) { $(t).classList.toggle("hidden", t !== b.dataset.tab); });
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.toggle("on", x === b); });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ---------------------------------------------------------
     ① 정답·해설표 — 학습지 문항 데이터로 만든다
     --------------------------------------------------------- */
  function answerOf(item, ans) {
    ans = ans || {};
    if (item.k === "choice") return (ans.a + 1) + "번 — " + item.opts[ans.a];
    if (item.k === "multi") {
      return ans.a.map(function (i) { return (i + 1) + "번 " + item.opts[i]; }).join(" · ");
    }
    if (item.k === "order") {
      return ans.a.map(function (i, n) { return (n + 1) + ") " + item.opts[i]; }).join("  →  ");
    }
    if (item.k === "short") {
      return ans.accept[0] + (ans.accept.length > 1 ? "  (인정 : " + ans.accept.slice(1).join(", ") + ")" : "");
    }
    if (item.k === "text") return "서술형 — 자동 채점하지 않습니다";
    if (item.k === "draw") return "그리기 — 자동 채점하지 않습니다";
    return "";
  }
  function kindName(k) {
    return { choice: "객관식", multi: "복수 선택", order: "순서 배열", short: "단답", text: "서술형", draw: "그리기" }[k] || k;
  }

  /* 정답은 js/locked.js 안에 암호문으로만 있다.
     교사 코드로 열면 { w1:{문항번호:{a,accept,sol}}, w2:{…} } 가 들어온다. */
  var KEY = null;

  function renderKey(spec, answers) {
    var host = $("answerKey");
    host.innerHTML = "";
    host.appendChild(el("h3", "keyhead",
      esc(spec.title) + ' <span>' + esc(spec.standard) + '</span>'));

    var n = 0;
    spec.activities.forEach(function (act) {
      host.appendChild(el("h4", "keyact", esc(act.step) + " · " + esc(act.title)));
      act.items.forEach(function (item) {
        if (item.k === "info") return;
        n++;
        var ans = answers[String(n)] || {};
        var auto = item.k !== "text" && item.k !== "draw";
        var box = el("div", "keyq" + (auto ? "" : " open"));
        box.innerHTML =
          '<div class="kq"><span class="kno">' + n + '</span>' +
            '<span class="ktype">' + kindName(item.k) + '</span>' +
            '<span class="ktx">' + esc(item.q) + '</span></div>' +
          '<div class="ka"><b>' + (auto ? "정답" : "예시 답") + '</b>' + esc(answerOf(item, ans)) + '</div>' +
          (ans.sol ? '<div class="ks"><b>해설</b>' + ans.sol + '</div>' : "");
        host.appendChild(box);
      });
    });
  }

  function showKey(which) {
    renderKey(which === 2 ? window.SPEC2 : window.SPEC1, which === 2 ? KEY.w2 : KEY.w1);
    $("keyBtn1").classList.toggle("on", which !== 2);
    $("keyBtn2").classList.toggle("on", which === 2);
  }

  Lock.mount($("keyLock"), {
    box: (window.LOCKED || {}).teacher,
    title: "선생님용 정답 · 해설 열기",
    note: "교사 코드를 넣으세요. 학생에게 알려 주는 정답 코드와는 다른 코드입니다.",
    onOpen: function (val) {
      KEY = val;
      $("keyBody").classList.remove("hidden");
      showKey(1);
      $("keyBtn1").addEventListener("click", function () { showKey(1); });
      $("keyBtn2").addEventListener("click", function () { showKey(2); });
      PdfKit.toast("정답표를 열었습니다.", "ok");
    }
  });

  /* ---------------------------------------------------------
     ② 제출물 정리 — 파일 '이름'만 읽는다
        추상화알고리즘_1차시_1-3-07_홍길동_20260811_1420.pdf
        ⚠ 앞머리(학습지 이름)에 밑줄이 들어 있어도 읽히도록 (.+) 로 두었다.
          브라우저가 중복 내려받기에 붙이는 " (1)" 도 받아들인다.
     --------------------------------------------------------- */
  var NAME_RE = /^(.+)_(\d+)-(\d+)-(\d+)_([^_]+)_(\d{8})_(\d{4})(?:\s*\(\d+\))?\.pdf$/i;

  var rows = [], bad = [];
  var sortKey = "when", sortAsc = true;

  function parseName(f) {
    var m = NAME_RE.exec(f);
    if (!m) return null;
    var d = m[6], t = m[7];
    return {
      kind: m[1].replace(/^추상화알고리즘_/, ""),
      grade: +m[2], cls: +m[3], num: +m[4], name: m[5],
      when: d + t,
      whenText: d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8) +
                " " + t.slice(0, 2) + ":" + t.slice(2, 4),
      file: f
    };
  }
  /* 같은 학생·같은 학습지·같은 시각이면 복사본이므로 한 건으로 본다 */
  function sigOf(r) { return r.kind + "|" + r.grade + "-" + r.cls + "-" + r.num + "|" + r.name + "|" + r.when; }

  function addFiles(list) {
    var added = 0, skipped = 0;
    Array.prototype.forEach.call(list, function (f) {
      var nm = f.name;
      if (!/\.pdf$/i.test(nm)) { skipped++; return; }
      var r = parseName(nm);
      if (!r) { if (bad.indexOf(nm) < 0) bad.push(nm); return; }
      if (rows.some(function (x) { return sigOf(x) === sigOf(r); })) return;
      rows.push(r);
      added++;
    });
    paintRows();
    if (added) PdfKit.toast(added + "건을 읽었습니다." + (skipped ? " (PDF가 아닌 파일 " + skipped + "개는 건너뜀)" : ""), "ok");
    else if (bad.length) PdfKit.toast("이름 형식이 다른 파일이 있습니다. 아래 목록을 확인하세요.", "warn");
  }

  function paintRows() {
    $("rowsInfo").classList.toggle("hidden", rows.length === 0 && bad.length === 0);

    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      var r = (typeof x === "number") ? x - y : String(x).localeCompare(String(y), "ko");
      return sortAsc ? r : -r;
    });

    var tb = $("rowsTable").querySelector("tbody");
    tb.innerHTML = "";
    rows.forEach(function (r) {
      var tr = el("tr");
      tr.innerHTML = '<td class="left">' + esc(r.kind) + '</td><td>' + r.grade + '</td><td>' + r.cls +
        '</td><td>' + r.num + '</td><td class="left">' + esc(r.name) + '</td><td>' + r.whenText + '</td>';
      tb.appendChild(tr);
    });

    var byKind = {};
    rows.forEach(function (r) { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });
    $("countMsg").innerHTML = "<b>" + rows.length + "건</b> — " +
      (Object.keys(byKind).map(function (k) { return esc(k) + " " + byKind[k] + "건"; }).join(" · ") || "없음");

    $("badList").innerHTML = bad.length
      ? '<div class="warnbox"><b>이름 형식이 달라 읽지 못한 파일 ' + bad.length + '개</b><br>' +
        bad.map(esc).join("<br>") + '<br><br>학생이 파일 이름을 바꿨을 수 있습니다. ' +
        '올바른 형식 : <b>추상화알고리즘_1차시_1-3-07_홍길동_20260811_1420.pdf</b></div>'
      : "";
  }

  document.querySelectorAll("#rowsTable th[data-sort]").forEach(function (th) {
    th.style.cursor = "pointer";
    th.addEventListener("click", function () {
      if (sortKey === th.dataset.sort) sortAsc = !sortAsc;
      else { sortKey = th.dataset.sort; sortAsc = true; }
      paintRows();
    });
  });

  $("pickFiles").addEventListener("click", function () { $("fileInput").click(); });
  $("pickDir").addEventListener("click", function () { $("dirInput").click(); });
  $("fileInput").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
  $("dirInput").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
  $("clearRows").addEventListener("click", function () {
    rows = []; bad = []; paintRows();
    PdfKit.toast("목록을 비웠습니다.", "warn");
  });

  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  $("copyBtn").addEventListener("click", function () {
    var text = ["학습지\t학년\t반\t번호\t이름\t제출 시각"]
      .concat(rows.map(function (r) {
        return [r.kind, r.grade, r.cls, r.num, r.name, r.whenText].join("\t");
      })).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { PdfKit.toast("표를 복사했습니다. 엑셀에 붙여넣으세요.", "ok"); },
        function () { PdfKit.toast("복사하지 못했습니다.", "no"); }
      );
    } else {
      PdfKit.toast("이 브라우저에서는 복사를 지원하지 않습니다.", "no");
    }
  });
})();
