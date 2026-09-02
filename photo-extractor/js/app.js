/* 화면 제어 ─ 조각들을 이어 붙이고 검수 화면을 그린다.
 *
 * 🔴 「자동으로 알아낸 것」 을 사람이 확인하기 전에는 저장이 열리지 않는다.
 *    다른 학생 얼굴에 다른 이름이 붙은 파일은 되돌릴 수 없기 때문이다.
 * 🔒 네트워크를 쓰지 않는다 — fetch·XMLHttpRequest·외부 주소가 이 앱에 없다.
 *    (tools/검사/verify_privacy.cjs 가 그것을 기계로 확인한다)
 */
(function (root) {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var S = { files: [], rows: [], 요약: null, urls: [], rs: { 목록: [], 결과: [] } };

  /* ── 도우미 ───────────────────────────────────────────── */
  function 말(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
    el.hidden = !text;
  }
  function 새주소(blob) { var u = URL.createObjectURL(blob); S.urls.push(u); return u; }
  function 주소지우기() { S.urls.forEach(function (u) { URL.revokeObjectURL(u); }); S.urls = []; }
  function 붙임(sid) { return sid ? sid : "학번 모름"; }

  /* ── ① 파일 읽기 ──────────────────────────────────────── */
  function 파일넣기(list) {
    var files = Array.prototype.slice.call(list).filter(function (f) {
      return /\.pdf$/i.test(f.name) || f.type === "application/pdf";
    });
    if (!files.length) { 말($("#readMsg"), "PDF 파일이 아닙니다.", "bad"); return; }

    말($("#readMsg"), "읽는 중… (0 / " + files.length + ")");
    var i = 0;
    (function 다음() {
      if (i >= files.length) {
        말($("#readMsg"), files.length + "개 파일을 읽었습니다.", "ok");
        규격그리기(); 그리기();
        return;
      }
      var f = files[i];
      말($("#readMsg"), "읽는 중… " + f.name + " (" + (i + 1) + " / " + files.length + ")");
      파일하나(f).then(function () {
        i++; 파일목록(); 다음();
      }).catch(function (e) {
        S.files.push({ name: f.name, 오류: e.message || "읽지 못했습니다", rows: [] });
        i++; 파일목록(); 다음();
      });
    })();
  }

  function 파일하나(file) {
    return file.arrayBuffer().then(function (buf) {
      return PdfRead.읽기(buf, { cMapUrl: "js/vendor/cmaps/" });
    }).then(function (읽은것) {
      var F = {
        name: file.name, 읽은것: 읽은것,
        기본: IdParse.파일이름에서(file.name),
        side: "", fmtKey: "", rows: []
      };
      S.files.push(F);
      return 짝짓기(F);
    });
  }

  /* ── ② 짝짓기 ─ 규격을 정하고 줄을 만든 뒤 사진을 꺼낸다 ── */
  function 쪽별(F, side) {
    return F.읽은것.pages.map(function (p) {
      return { page: p, det: Detect.살펴보기(p, side ? { side: side } : null) };
    });
  }

  function 짝짓기(F) {
    // 글자가 어느 쪽에 있는지 — 쪽마다 투표한 것을 파일 하나로 모은다
    var 첫판 = 쪽별(F, "");
    var 표 = {};
    첫판.forEach(function (x) {
      if (!x.det.ok || !x.det.side) return;
      표[x.det.side] = (표[x.det.side] || 0) + x.det.photos.length;
    });
    var 자동 = Object.keys(표).sort(function (a, b) { return 표[b] - 표[a]; })[0] || "";
    F.자동side = 자동;
    F.sides = (첫판[0] && 첫판[0].det.sides) || [];
    var side = F.side || 자동;
    var 판 = side === 자동 ? 첫판 : 쪽별(F, side);
    F.판 = 판;
    F.grid = (판[0] && 판[0].det.grid) || null;
    F.스캔같음 = 판.every(function (x) { return !x.det.ok; });

    // 학번 형식 — 파일 전체를 놓고 투표
    var 사람텍스트 = [];
    판.forEach(function (x) { (x.det.사람들 || []).forEach(function (s) { 사람텍스트.push(s.texts); }); });
    F.형식점수 = IdParse.형식고르기(사람텍스트);
    var pat = null;
    if (F.fmtKey) {
      IdParse.PATTERNS.forEach(function (p) { if (p.key === F.fmtKey) pat = p; });
    }
    F.자동fmt = (F.형식점수[0] && F.형식점수[0].hit) ? F.형식점수[0].key : "";

    var got = Match.줄만들기(판.map(function (x) {
      return { pageNo: x.page.pageNo, 사람들: x.det.사람들 };
    }), { file: F.name, 기본: F.기본, 형식: pat });

    F.rows = got.rows;
    F.rows.forEach(function (r) { r.기본 = F.기본; });

    // 사진 꺼내기 — 한 장씩 (한꺼번에 하면 메모리가 튄다)
    var i = 0;
    function 다음() {
      if (i >= F.rows.length) return Promise.resolve();
      var r = F.rows[i];
      return PdfRead.사진꺼내기(F.읽은것, r.photo).then(function (g) {
        r.그림 = g;
        if (g && g.blob) r.url = 새주소(g.blob);
        i++;
        if (i % 5 === 0) 말($("#readMsg"), "사진 꺼내는 중… " + i + " / " + F.rows.length);
        return 다음();
      }).catch(function () { i++; return 다음(); });
    }
    return 다음().then(function () { 다시살피기(); });
  }

  function 다시살피기() {
    S.rows = [];
    S.files.forEach(function (F) { (F.rows || []).forEach(function (r) { S.rows.push(r); }); });
    var got = Match.살피기(S.rows);
    S.요약 = got.요약;
  }

  /* ── 왼쪽 : 파일 목록 ─────────────────────────────────── */
  function 파일목록() {
    var ul = $("#fileList");
    ul.innerHTML = "";
    S.files.forEach(function (F) {
      var li = document.createElement("li");
      var nm = document.createElement("span");
      nm.className = "nm"; nm.textContent = F.name; li.appendChild(nm);
      var c = document.createElement("span");
      if (F.오류) { c.className = "cnt bad"; c.textContent = "읽기 실패"; }
      else if (!F.rows.length) { c.className = "cnt bad"; c.textContent = "사진 0장"; }
      else { c.className = "cnt"; c.textContent = F.rows.length + "장"; }
      li.appendChild(c);
      ul.appendChild(li);
    });
    var sel = $("#specFile");
    var 이전 = sel.value;
    sel.innerHTML = "";
    S.files.forEach(function (F, i) {
      if (F.오류) return;
      var o = document.createElement("option");
      o.value = String(i); o.textContent = F.name;
      sel.appendChild(o);
    });
    if (이전 && sel.querySelector('option[value="' + 이전 + '"]')) sel.value = 이전;
  }

  /* ── 왼쪽 : ② 알아낸 규격 ────────────────────────────── */
  function 지금파일() {
    var i = +($("#specFile").value || 0);
    return S.files[i] && !S.files[i].오류 ? S.files[i] : null;
  }

  function 규격그리기() {
    var F = 지금파일();
    if (!F) {
      $("#specSum").textContent = "아직 없음";
      $("#specPhotos").textContent = $("#specGrid").textContent = "-";
      $("#sideScore").textContent = "";
      return;
    }
    var side = F.side || F.자동side;
    $("#specPhotos").textContent = F.rows.length + "장" +
      (F.스캔같음 ? " — 격자로 늘어놓은 사진을 못 찾았습니다(스캔한 PDF 일 수 있습니다)" : "");
    $("#specGrid").textContent = F.grid && F.grid.cols
      ? F.grid.cols + "열 × " + F.grid.rows + "행 (한 쪽에 최대 " + (F.grid.cols * F.grid.rows) + "명)"
      : "-";
    $("#specSide").value = F.side || "";
    $("#specGrade").value = F.기본 ? F.기본.grade : "";
    $("#specCls").value = F.기본 ? F.기본.cls : "";

    var fs = $("#specFmt");
    fs.innerHTML = '<option value="">(자동으로 고름' + (F.자동fmt ? " — " + 이름표(F.자동fmt) : "") + ")</option>";
    IdParse.PATTERNS.forEach(function (p) {
      var 점 = (F.형식점수 || []).filter(function (x) { return x.key === p.key; })[0];
      var o = document.createElement("option");
      o.value = p.key;
      o.textContent = p.label + " (" + p.보기 + ")" + (점 ? " — " + 점.hit + "장 맞음" : "");
      fs.appendChild(o);
    });
    fs.value = F.fmtKey || "";

    var 줄 = (F.sides || []).slice(0, 4).map(function (x) {
      var 굵 = x.side === side;
      return (굵 ? "<b>" : "") + x.name + " " + x.hit + "장" +
             (isFinite(x.평균거리) ? " (평균 " + x.평균거리.toFixed(0) + "pt 떨어짐)" : "") + (굵 ? "</b>" : "");
    }).join("<br>");
    $("#sideScore").innerHTML = 줄 ? "글자를 찾은 결과 —<br>" + 줄 : "";
    $("#specSum").textContent = F.rows.length + "장 · " +
      (Detect.옆이름[side] || "글자 못 찾음") + (F.grid && F.grid.cols ? " · " + F.grid.cols + "열" : "");
  }

  function 이름표(key) {
    var p = IdParse.PATTERNS.filter(function (x) { return x.key === key; })[0];
    return p ? p.label : key;
  }

  function 규격다시() {
    var F = 지금파일();
    if (!F) return;
    F.side = $("#specSide").value;
    F.fmtKey = $("#specFmt").value;
    var g = parseInt($("#specGrade").value, 10), c = parseInt($("#specCls").value, 10);
    F.기본 = (isFinite(g) && isFinite(c)) ? { grade: g, cls: c } : F.기본;
    말($("#readMsg"), "다시 짝짓는 중…");
    주소비우기(F);
    짝짓기(F).then(function () {
      말($("#readMsg"), "다시 짝지었습니다.", "ok");
      파일목록(); 규격그리기(); 그리기();
    });
  }

  function 주소비우기(F) {
    (F.rows || []).forEach(function (r) {
      if (r.url) { URL.revokeObjectURL(r.url); S.urls = S.urls.filter(function (u) { return u !== r.url; }); }
    });
  }

  /* ── 오른쪽 : 검수 격자 ──────────────────────────────── */
  function 보이는줄() {
    var q = ($("#find").value || "").trim();
    var bad = $("#onlyBad").checked;
    return S.rows.filter(function (r) {
      if (bad && !(r.문제 && r.문제.length)) return false;
      if (!q) return true;
      return (r.sid || "").indexOf(q) >= 0 || (r.name || "").indexOf(q) >= 0;
    });
  }

  function 줄찾기(id) { return S.rows.filter(function (r) { return r.id === id; })[0]; }
  function 고른줄() { return S.rows.filter(function (r) { return r.고름; }); }

  /* 무엇을 저장할 것인가 —
   *   고른 사진이 있으면 **고른 것만**, 없으면 지금 보이는 것 전부.
   * 🔴 고른 것은 찾기·「문제만」 을 풀어도 그대로 남는다 (여러 번 걸러 가며 고를 수 있게). */
  function 저장대상() {
    var 고른것 = 고른줄();
    return { 고름: 고른것.length > 0, 목록: 고른것.length ? 고른것 : 보이는줄() };
  }

  function 그리기() {
    var grid = $("#grid"), 목록 = 보이는줄();
    grid.innerHTML = "";
    $("#emptyMsg").hidden = S.rows.length > 0;

    목록.forEach(function (r) {
      var d = document.createElement("div");
      d.className = "person" + (r.문제 && r.문제.length ? " bad" : "") +
                    (r.손댐 ? " fixed" : "") + (r.고름 ? " picked" : "");
      d.dataset.id = r.id;

      // 고르기 칸 — 사진 위에 얹는다. 여기를 누르면 고치기 창이 열리지 않는다.
      var pick = document.createElement("label");
      pick.className = "pick";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!r.고름;
      cb.setAttribute("aria-label", 붙임(r.sid) + " 고르기");
      pick.appendChild(cb);
      d.appendChild(pick);

      var img = document.createElement("img");
      img.loading = "lazy";
      img.alt = 붙임(r.sid);
      if (r.url) img.src = r.url;
      d.appendChild(img);

      var who = document.createElement("div");
      who.className = "who";
      who.innerHTML = '<div class="sid">' + esc(붙임(r.sid)) + '</div>' +
                      '<div class="nm">' + esc(r.name || "이름 모름") + "</div>";
      d.appendChild(who);

      if (r.문제 && r.문제.length) {
        var w = document.createElement("div");
        w.className = "why"; w.textContent = r.문제.join(" · ");
        d.appendChild(w);
      } else if (r.그림 && !r.그림.무손실) {
        var m = document.createElement("div");
        m.className = "meta"; m.textContent = "원본을 못 꺼내 쪽을 그려 잘랐습니다";
        d.appendChild(m);
      }
      grid.appendChild(d);
    });

    var 빠진 = (S.요약 && S.요약.빠진번호) || [];
    var mb = $("#missing");
    if (빠진.length) {
      mb.hidden = false;
      mb.textContent = "⚠ 사진이 없는 학번 " + 빠진.length + "명 : " + 빠진.join(", ") +
                       " — 결번일 수도 있고 사진이 빠졌을 수도 있습니다. 확인해 주세요.";
    } else mb.hidden = true;

    고르기갱신();
    $("#nameSample").textContent = S.rows.length
      ? Match.파일이름(S.rows[0], (S.rows[0].그림 && S.rows[0].그림.ext) || "jpg")
      : "10103_홍길동.jpg";
    $("#saveSum").textContent = Save.폴더고르기됨() ? "폴더에 바로 저장" : "ZIP 으로 받기";
  }

  /* 요약 띠 — 카드를 다시 그리지 않고 숫자만 고친다 (142장에서 다시 그리면 느리다) */
  function 요약그리기() {
    var s = S.요약 || { 전체: 0, 완료: 0, 문제: 0, 빠진번호: [] };
    var 보임 = 보이는줄().length, 고른 = 고른줄().length;
    if (!s.전체) { $("#summary").innerHTML = "PDF 를 넣으면 여기에 결과가 나옵니다."; return; }
    $("#summary").innerHTML =
      "사진 <b>" + s.전체 + "</b>장 · <span class='ok'>제대로 " + s.완료 + "</span>" +
      (s.문제 ? " · <span class='bad'>확인 필요 " + s.문제 + "</span>" : "") +
      (보임 !== s.전체 ? " (지금 " + 보임 + "장 보임)" : "") +
      (고른 ? " · <b class='pick-n'>고른 " + 고른 + "장</b>" : "");
  }

  /* 고르기 상태가 바뀔 때마다 — 「모두 고르기」 표시·해제 단추·저장 단추를 맞춘다 */
  function 고르기갱신() {
    var 보임 = 보이는줄(), 고른 = 고른줄().length;
    var 보임중고른 = 보임.filter(function (r) { return r.고름; }).length;
    var all = $("#pickAll");
    all.checked = 보임.length > 0 && 보임중고른 === 보임.length;
    all.indeterminate = 보임중고른 > 0 && 보임중고른 < 보임.length;
    var none = $("#pickNone");
    none.hidden = 고른 === 0;
    none.textContent = "선택 해제 (" + 고른 + ")";
    $("#saveWho").innerHTML = 고른
      ? "<b>고른 " + 고른 + "장</b>만 저장합니다."
      : "사진을 고르지 않으면 <b>지금 보이는 것 전부</b>를 저장합니다.";
    요약그리기();
    저장단추();
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function 저장할줄() {
    var 목록 = 저장대상().목록;
    if ($("#optSkipBad").checked) 목록 = 목록.filter(function (r) { return !(r.문제 && r.문제.length); });
    return 목록.filter(function (r) { return r.그림 && r.그림.blob; });
  }

  /* 🔴 막는 기준은 «저장할 것» 안의 문제 수다 — 앱 전체가 아니다.
   * 예전에는 전체를 봤기 때문에, 멀쩡한 10명만 골라도 다른 반의 문제 때문에 막혔다. */
  function 저장단추() {
    var d = 저장대상();
    var 문제 = d.목록.filter(function (r) { return r.문제 && r.문제.length; }).length;
    var n = 저장할줄().length;
    var 막힘 = 문제 > 0 && !$("#optSkipBad").checked;
    var b = $("#btnSave");
    b.disabled = !n || !$("#agree").checked || 막힘;
    b.textContent = 막힘
      ? "⚠ 확인이 필요한 " + 문제 + "장을 먼저 고치세요"
      : "💾 " + (d.고름 ? "고른 " : "") + n + "장 저장하기";
  }

  /* ── 고치기 창 ───────────────────────────────────────── */
  function 열기고치기(id) {
    var r = S.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    $("#editImg").src = r.url || "";
    $("#editSid").value = r.sid || "";
    $("#editName").value = r.name || "";
    $("#editRaw").textContent = "PDF 에서 읽은 글자 : " + (r.texts.length ? r.texts.join(" / ") : "(없음)") +
                                " — " + r.file + " " + r.page + "쪽";
    $("#editDlg").dataset.id = id;
    $("#editDlg").showModal();
  }

  function 고치기적용() {
    var id = $("#editDlg").dataset.id;
    var r = S.rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    // 🚨 줄 번호는 앱 전체에서 하나뿐이어야 한다(match.js 참고).
    //    겹치면 여기서 **엉뚱한 학생**을 고치게 된다.
    var sid = ($("#editSid").value || "").trim();
    var nm = ($("#editName").value || "").trim();
    r.sid = /^\d{5}$/.test(sid) ? sid : (sid || null);
    r.name = nm || null;
    r.손댐 = true;
    다시살피기(); 그리기();
  }

  function 고치기닫기() { 고치기적용(); $("#editDlg").close(); }

  /* ── ③ 명렬표 ────────────────────────────────────────── */
  function 명렬적용(방법) {
    var F = 지금파일();
    var 기본 = F ? F.기본 : null;
    var 명렬 = Roster.읽기($("#rosterText").value, 기본);
    if (!명렬.length) { 말($("#rosterMsg"), "명렬표를 읽지 못했습니다. 학번과 이름이 든 두 칸을 복사해 붙여 넣으세요.", "bad"); return; }
    /* 🔴 「학번으로 맞추기」 는 **넣은 파일 전부**에 적용한다 — 학번은 앱 전체에서
     *    하나뿐이므로 반을 가릴 이유가 없다. 반 여러 개를 한꺼번에 넣는 것이 이 앱의 쓰임이다.
     *    「차례대로 짝짓기」 만 **한 파일**에 적용한다 — 차례는 그 파일 안에서만 뜻이 있다. */
    var 대상 = 방법 === "차례" ? (F ? F.rows : S.rows) : S.rows;
    var 어디 = 방법 === "차례" ? (F ? "「" + F.name + "」" : "넣은 파일") : "넣은 파일 전부";
    var got = Roster.얹기(대상, 명렬, 방법);
    다시살피기(); 그리기();
    var msg = "명렬표 " + 명렬.length + "줄 중 " + got.채움 + "장에 넣었습니다 — " + 어디 + "." +
              (got.건너뜀 ? " (손으로 고친 " + got.건너뜀 + "장은 그대로 두었습니다)" : "");
    말($("#rosterMsg"), msg + (got.경고.length ? " ⚠ " + got.경고.join(" ") : ""),
       got.경고.length ? "bad" : "ok");
  }

  /* ── ⑤ 저장 ──────────────────────────────────────────── */
  function 저장하기() {
    var 목록 = 저장할줄();
    if (!목록.length) return;
    var opt = {
      한폴더: !$("#optFolder").checked,
      안내문: $("#optNote").checked,
      강제ZIP: $("#optZip").checked,
      zip이름: "사진추출_" + 날짜()
    };
    $("#btnSave").disabled = true;
    말($("#saveMsg"), "저장하는 중… 0 / " + 목록.length);
    Save.저장(목록, S.요약, opt, function (n, all) {
      말($("#saveMsg"), "저장하는 중… " + n + " / " + all);
    }).then(function (r) {
      말($("#saveMsg"), "✅ " + r.저장 + "장을 " + (r.방법 === "폴더" ? "폴더에" : "ZIP 파일로") + " 저장했습니다." +
                       (저장대상().고름 ? " (고른 것만 저장했습니다)" : ""), "ok");
      고르기갱신();
    }).catch(function (e) {
      말($("#saveMsg"), e && e.name === "AbortError" ? "저장을 취소했습니다." : "저장하지 못했습니다 : " + (e.message || e), "bad");
      저장단추();
    });
  }

  function 날짜() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  }

  /* ── 용량 줄이기 탭 ──────────────────────────────────── */
  function 미리목록() {
    var s = $("#rsPreset");
    Resize.미리.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.key; o.textContent = m.이름; s.appendChild(o);
    });
    s.value = "문서";
    미리적용();
  }
  function 미리적용() {
    var m = Resize.미리.filter(function (x) { return x.key === $("#rsPreset").value; })[0];
    if (!m) return;
    $("#rsSide").value = m.maxSide;
    $("#rsQ").value = Math.round(m.quality * 100);
    $("#rsQv").textContent = Math.round(m.quality * 100);
  }

  function 줄일것정하기(목록, 설명) {
    S.rs.목록 = 목록; S.rs.결과 = [];
    $("#btnResize").disabled = !목록.length;
    $("#btnRsSave").disabled = true;
    말($("#rsPick"), 설명, 목록.length ? "ok" : "bad");
    $("#rsSummary").textContent = 목록.length ? 목록.length + "장을 고를 준비가 되었습니다." : "줄일 파일을 고르세요.";
    $("#rsGrid").innerHTML = "";
  }

  function 줄이기실행() {
    var opt = { maxSide: parseInt($("#rsSide").value, 10) || 0, quality: (+$("#rsQ").value || 85) / 100 };
    $("#btnResize").disabled = true;
    말($("#rsMsg"), "줄이는 중… 0 / " + S.rs.목록.length);
    Resize.여럿줄이기(S.rs.목록, opt, function (n, all) {
      말($("#rsMsg"), "줄이는 중… " + n + " / " + all);
    }).then(function (out) {
      S.rs.결과 = out;
      var 앞 = 0, 뒤 = 0;
      out.forEach(function (o) { if (o.결과) { 앞 += o.결과.앞; 뒤 += o.결과.뒤; } });
      말($("#rsMsg"), "✅ " + out.length + "장 완료 — " + Resize.보기좋은크기(앞) + " → " +
                     Resize.보기좋은크기(뒤) + " (" + (앞 ? Math.round((1 - 뒤 / 앞) * 100) : 0) + "% 줄임)", "ok");
      $("#rsSummary").textContent = out.length + "장 · " + Resize.보기좋은크기(앞) + " → " + Resize.보기좋은크기(뒤);
      $("#btnResize").disabled = false;
      $("#btnRsSave").disabled = false;
      줄인것그리기();
    });
  }

  function 줄인것그리기() {
    var g = $("#rsGrid"); g.innerHTML = "";
    S.rs.결과.forEach(function (o) {
      var d = document.createElement("div");
      d.className = "person" + (o.오류 ? " bad" : "");
      var img = document.createElement("img");
      img.loading = "lazy";
      if (o.결과 && o.결과.blob) img.src = 새주소(o.결과.blob);
      d.appendChild(img);
      var w = document.createElement("div");
      w.className = "who";
      w.innerHTML = '<div class="sid">' + esc(o.보임 || o.고정이름 || "") + "</div>" +
        '<div class="nm">' + (o.결과
          ? Resize.보기좋은크기(o.결과.앞) + " → " + Resize.보기좋은크기(o.결과.뒤) +
            "<br>" + o.결과.width + "×" + o.결과.height
          : esc(o.오류 || "실패")) + "</div>";
      d.appendChild(w);
      g.appendChild(d);
    });
  }

  function 줄인것저장() {
    var rows = S.rs.결과.filter(function (o) { return o.결과 && o.결과.blob; }).map(function (o) {
      return o.row
        ? Object.assign({}, o.row, { 그림: { blob: o.결과.blob, ext: "jpg" } })
        : { 고정이름: (o.고정이름 || "사진").replace(/\.[^.]+$/, "") + ".jpg",
            그림: { blob: o.결과.blob, ext: "jpg" }, file: "", 문제: [] };
    });
    if (!rows.length) return;
    var 한폴더 = !rows[0].row && !rows[0].sid;
    $("#btnRsSave").disabled = true;
    Save.저장(rows, { 전체: rows.length, 완료: rows.length, 문제: 0, 빠진번호: [], 겹친학번: [] },
      { 한폴더: 한폴더 || !$("#optFolder").checked, 안내문: false,
        강제ZIP: $("#optZip").checked, zip이름: "사진_용량줄임_" + 날짜() })
      .then(function (r) {
        말($("#rsMsg"), "✅ " + r.저장 + "장을 저장했습니다.", "ok");
        $("#btnRsSave").disabled = false;
      }).catch(function (e) {
        말($("#rsMsg"), e && e.name === "AbortError" ? "저장을 취소했습니다." : "저장하지 못했습니다 : " + (e.message || e), "bad");
        $("#btnRsSave").disabled = false;
      });
  }

  /* ── 새로 시작 ───────────────────────────────────────── */
  function 새로시작() {
    if (S.rows.length && !confirm("넣은 PDF 와 지금까지 고친 것을 모두 지웁니다. 계속할까요?")) return;
    주소지우기();
    S.files = []; S.rows = []; S.요약 = null; S.rs = { 목록: [], 결과: [] };
    $("#fileInput").value = ""; $("#imgInput").value = "";
    $("#rosterText").value = ""; $("#find").value = "";
    $("#onlyBad").checked = false; $("#agree").checked = false;
    ["#readMsg", "#rosterMsg", "#saveMsg", "#rsMsg", "#rsPick"].forEach(function (s) { 말($(s), ""); });
    $("#rsGrid").innerHTML = "";
    $("#btnResize").disabled = true; $("#btnRsSave").disabled = true;
    $("#rsSummary").textContent = "줄일 파일을 고르세요.";
    파일목록(); 규격그리기(); 그리기();
  }

  /* ── 시작 ────────────────────────────────────────────── */
  /* 🚨 오류를 숨기지 않는다.
   * 그리기 도중 예외가 나면 화면이 **반쯤 그리다 멈추는데**, 겉보기엔 낡은 값이
   * 그대로 남아 있어 사람은 알아채지 못한다. 실제로 그렇게 며칠을 지날 뻔했다.
   * 그래서 오류를 붉은 띠로 띄운다 — 「보이는데 안 되는 것」 이 가장 나쁘다. */
  function 오류띄우기(말글) {
    var el = $("#jsError");
    if (!el) return;
    el.hidden = false;
    el.textContent = "⚠ 화면에 문제가 생겼습니다 : " + 말글 +
      " — 새로 고침(F5) 한 뒤 다시 해 보세요. 계속되면 이 문구를 그대로 알려 주세요.";
  }

  function 시작() {
    $("#needServer").hidden = true;      // 여기까지 오면 모듈이 읽힌 것이다
    window.addEventListener("error", function (ev) { 오류띄우기(ev.message || "알 수 없는 오류"); });
    window.addEventListener("unhandledrejection", function (ev) {
      오류띄우기((ev.reason && (ev.reason.message || ev.reason)) || "알 수 없는 오류");
    });

    // 탭
    $$(".tab").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".tab").forEach(function (x) { x.classList.toggle("on", x === b); });
        $("#tabExtract").hidden = b.dataset.tab !== "extract";
        $("#tabResize").hidden = b.dataset.tab !== "resize";
      });
    });

    // 파일 넣기
    $("#fileInput").addEventListener("change", function (e) { 파일넣기(e.target.files); });
    ["dragenter", "dragover"].forEach(function (t) {
      $("#drop").addEventListener(t, function (e) { e.preventDefault(); this.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (t) {
      $("#drop").addEventListener(t, function (e) { e.preventDefault(); this.classList.remove("over"); });
    });
    $("#drop").addEventListener("drop", function (e) { 파일넣기(e.dataTransfer.files); });

    // 규격 ─ 숫자·글 입력칸은 input 과 change 를 둘 다 듣는다 (cable-label 함정 ③)
    ["#specSide", "#specFmt", "#specFile"].forEach(function (s) {
      $(s).addEventListener("change", function () { if (s === "#specFile") 규격그리기(); });
    });
    ["#specGrade", "#specCls"].forEach(function (s) {
      ["input", "change"].forEach(function (t) { $(s).addEventListener(t, function () {}); });
    });
    $("#btnRedo").addEventListener("click", 규격다시);

    // 명렬표
    $("#btnRosterId").addEventListener("click", function () { 명렬적용("학번"); });
    $("#btnRosterOrder").addEventListener("click", function () { 명렬적용("차례"); });

    // 검수
    ["input", "change"].forEach(function (t) {
      $("#find").addEventListener(t, 그리기);
    });
    $("#onlyBad").addEventListener("change", 그리기);
    $("#grid").addEventListener("click", function (e) {
      // 고르기 칸을 누른 것은 「고치기 창 열기」 가 아니다
      if (e.target.closest && e.target.closest(".pick")) return;
      var el = e.target.closest ? e.target.closest(".person") : null;
      if (el) 열기고치기(el.dataset.id);
    });
    $("#grid").addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb.matches || !cb.matches(".pick input")) return;
      var el = cb.closest(".person"), r = 줄찾기(el.dataset.id);
      if (!r) return;
      r.고름 = cb.checked;
      el.classList.toggle("picked", cb.checked);
      고르기갱신();                      // 카드는 다시 그리지 않는다 (142장이면 느리다)
    });
    $("#pickAll").addEventListener("change", function () {
      var on = this.checked;
      보이는줄().forEach(function (r) { r.고름 = on; });
      그리기();
    });
    $("#pickNone").addEventListener("click", function () {
      S.rows.forEach(function (r) { r.고름 = false; });
      그리기();
    });
    // 🚨 `<dialog>` 의 close 이벤트에 기대지 않는다 — 그 이벤트가 오지 않는 환경이 있어
    //    「고치기」 를 눌러도 조용히 아무 일도 일어나지 않았다(오류도 안 난다).
    $("#editOk").addEventListener("click", 고치기닫기);
    $("#editCancel").addEventListener("click", function () { $("#editDlg").close(); });
    // 이름 칸에서 Enter 를 쳐도 바로 고쳐진다 (여러 명을 잇달아 고칠 때 빠르다)
    ["#editSid", "#editName"].forEach(function (s) {
      $(s).addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); 고치기닫기(); }
      });
    });

    // 저장
    // 카드 142장을 다시 그릴 일이 아니다 — 숫자만 고친다
    ["#agree", "#optSkipBad", "#optFolder", "#optZip", "#optNote"].forEach(function (s) {
      $(s).addEventListener("change", 고르기갱신);
    });
    $("#btnSave").addEventListener("click", 저장하기);
    $("#btnReset").addEventListener("click", 새로시작);

    // 용량 줄이기
    미리목록();
    $("#rsPreset").addEventListener("change", 미리적용);
    ["input", "change"].forEach(function (t) {
      $("#rsQ").addEventListener(t, function () { $("#rsQv").textContent = $("#rsQ").value; });
      $("#rsSide").addEventListener(t, function () {});
    });
    $("#imgInput").addEventListener("change", function (e) {
      var fs = Array.prototype.slice.call(e.target.files);
      줄일것정하기(fs.map(function (f) { return { blob: f, 고정이름: f.name, 보임: f.name }; }),
                  fs.length + "개 이미지 파일을 골랐습니다.");
    });
    ["dragenter", "dragover"].forEach(function (t) {
      $("#drop2").addEventListener(t, function (e) { e.preventDefault(); this.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (t) {
      $("#drop2").addEventListener(t, function (e) { e.preventDefault(); this.classList.remove("over"); });
    });
    $("#drop2").addEventListener("drop", function (e) {
      var fs = Array.prototype.slice.call(e.dataTransfer.files).filter(function (f) { return /^image\//.test(f.type); });
      줄일것정하기(fs.map(function (f) { return { blob: f, 고정이름: f.name, 보임: f.name }; }),
                  fs.length + "개 이미지 파일을 골랐습니다.");
    });
    // 고른 사진이 있으면 그것만 가져온다 (「사진 뽑기」 탭의 선택을 그대로 따른다)
    $("#btnUseExtracted").addEventListener("click", function () {
      var d = 저장대상();
      var 목록 = d.목록.filter(function (r) { return r.그림 && r.그림.blob; }).map(function (r) {
        return { blob: r.그림.blob, row: r, 보임: 붙임(r.sid) + " " + (r.name || "") };
      });
      줄일것정하기(목록, 목록.length
        ? (d.고름 ? "고른 사진 " : "뽑아 낸 사진 ") + 목록.length + "장을 가져왔습니다."
        : "먼저 「사진 뽑기」 에서 PDF 를 넣으세요.");
    });
    $("#btnResize").addEventListener("click", 줄이기실행);
    $("#btnRsSave").addEventListener("click", 줄인것저장);

    파일목록(); 규격그리기(); 그리기();
  }

  root.App = { 시작: 시작, _S: S, _그리기: 그리기 };
})(typeof globalThis !== "undefined" ? globalThis : this);
