/* ============================================================
   lesson.js — 차시 페이지를 조립한다 (탭 방식)

   ?n=12 → window.LESSONS[12] 를 읽어 6단계를 만든다.
   탭을 누르면 그 단계 «하나»만 보인다. 화면을 짧고 깔끔하게 유지한다.

     ① 개념   생활 속 활용 + 배울 것 + 개념 시뮬
     ② 연결   내장 Connect (mb-connect 복제)
     ③ 코딩   메이크코드·엔트리 블록 이미지 + 시작 프로젝트 링크
     ④ 학습지 4문항 (제출 후 잠금 → 정답 공개)
     ⑤ 점프   확장 미션 (선택)
     ⑥ 응용   기본 코드에서 바꾸거나 더한 것 → PDF

   무거운 부품(Bench·Connect)은 그 탭을 처음 열 때 만든다(숨은 상태로 만들면
   선 좌표가 어긋난다). 교사가 고친 연결 문제 : localStorage["pl.connect.<n>"].
   ============================================================ */
(function () {
  "use strict";
  var esc = UI.esc, rich = UI.rich, el = UI.el;

  var n = parseInt((location.search.match(/[?&]n=(\d+)/) || [])[1], 10) || 0;
  var L = (window.LESSONS || {})[n];

  var wrap = document.getElementById("wrap");
  var stepHost = document.getElementById("steps");
  document.getElementById("crumbTitle").textContent = L ? (n + "차시 · " + L.title) : (n ? n + "차시" : "차시");
  document.title = (L ? n + "차시 · " + L.title : "차시") + " — 센서 공작소";

  if (!L) {
    stepHost.style.display = "none";
    wrap.appendChild(el("div", "card", "<h2>이 차시는 준비 중입니다</h2>" +
      "<p class=\"hint\">계획은 잡혀 있고, 아직 만드는 중이에요. <a href=\"index.html\">← 차시 목록으로</a></p>"));
    return;
  }

  var DEF_TTL = {
    s1: "개념 이해", s2: "회로 연결", s3: "코딩", s4: "학습지 (개념 정리 4문항)",
    s5: "점프과제 (선택)", s6: "나만의 응용"
  };
  var DEFS = ["s1", "s2", "s3", "s4", "s5", "s6"].map(function (id, i) {
    var full = (L.tabTitles && L.tabTitles[id]) || null;
    var label = full ? full.replace(/^[①-⑥]\s*/, "") : ["개념", "연결", "코딩", "학습지", "점프", "응용"][i];
    return { id: id, k: "①②③④⑤⑥".charAt(i), label: label, ttl: full ? label : DEF_TTL[id] };
  });

  /* 패널 만들기 (기본은 숨김) */
  var panels = {};
  DEFS.forEach(function (d, i) {
    var p = el("section", "panel card");
    p.id = d.id;
    p.hidden = true;
    p.appendChild(el("h2", "panelttl", '<span class="k">' + d.k + "</span>" + esc(d.ttl)));
    var body = el("div", "panelbody");
    p.appendChild(body);
    var foot = el("div", "panelnav");
    if (i > 0) { var pb = el("button", "gh", "◀ " + DEFS[i - 1].label); pb.type = "button"; pb.onclick = function () { nav.select(DEFS[i - 1].id, true); }; foot.appendChild(pb); }
    foot.appendChild(el("span", null, "")).style.flex = "1";
    if (i < DEFS.length - 1) { var nb = el("button", "pri", DEFS[i + 1].label + " ▶"); nb.type = "button"; nb.onclick = function () { nav.select(DEFS[i + 1].id, true); }; foot.appendChild(nb); }
    p.appendChild(foot);
    wrap.appendChild(p);
    panels[d.id] = { el: p, body: body, made: false };
  });

  var nav = UI.tabs(stepHost, DEFS, show);

  function show(id) {
    DEFS.forEach(function (d) { panels[d.id].el.hidden = d.id !== id; });
    build(id);
    if (id === "s2" && connectInst) connectInst.redraw();
  }

  /* ── 탭별 내용 (처음 열 때 한 번) ─────────────────── */
  var connectInst = null;

  function build(id) {
    var P = panels[id];
    if (P.made) return;
    P.made = true;
    var b = P.body;

    if (id === "s1") {
      if (L.life && L.life.length) {
        var cards = el("div", "lifecards");
        L.life.forEach(function (x) {
          cards.appendChild(el("div", "lifecard",
            '<span class="ic">' + esc(x.ic || "🔧") + "</span><div><div class=\"lt\">" +
            esc(x.lt) + '</div><div class="ld">' + esc(x.ld || "") + "</div></div>"));
        });
        b.appendChild(el("h3", null, "생활 속에서는"));
        b.appendChild(cards);
      }
      if (L.goal && L.goal.length) {
        b.appendChild(el("h3", null, "이 차시에 배울 것"));
        var ul = el("ul", "goal");
        L.goal.forEach(function (t) { ul.appendChild(el("li", null, rich(t))); });
        b.appendChild(ul);
      }
      if (L.bench && window.Bench) {
        var benchHost = el("div");
        b.appendChild(benchHost);
        window.Bench.mount(benchHost, L.bench);
      } else if (L.capstone) {
        b.appendChild(el("div", "note", "이 단계는 시뮬레이터가 없습니다. 위의 <b>생활 속에서는</b> 를 " +
          "참고해 <b>내가 풀 문제</b> 를 한 문장으로 정하고, 어떤 센서·출력이 필요할지 적어 봅니다."));
      }

    } else if (id === "s2") {
      var prob = L.connect;
      try {
        var saved = localStorage.getItem("pl.connect." + n);
        if (saved) { var o = JSON.parse(saved); if (o && Array.isArray(o.parts) && o.parts.length) prob = o; }
      } catch (e) {}
      if (!prob || !prob.parts || !prob.parts.length) {
        b.appendChild(el("div", "note", "이 차시는 정해진 회로가 없습니다. " +
          (L.capstone ? "내가 고른 부품으로 회로를 직접 설계하고, 다른 차시의 연결 시뮬로 확인해 보세요."
                      : "실물 회로를 자유롭게 구성해 보세요.")));
      } else {
        b.appendChild(el("p", "hint",
          (L.capstone ? "아래는 <b>예시 회로</b> 입니다. 내가 고른 부품에 맞게 바꿔 연습하세요. "
                      : "") + "부품의 핀 → 확장보드의 구멍을 눌러 선을 잇고, <b>확인하기</b> 를 누르세요."));
        var host = el("div");
        b.appendChild(host);
        if (window.Connect) connectInst = window.Connect.mount(host, prob, { onSolved: function () { nav.mark("s2", true); } });
      }

    } else if (id === "s3") {
      if (L.capstone) {
        b.appendChild(el("p", "hint",
          "<b>② 설계·회로</b> 에서 정한 흐름(입력 → 판단 → 출력)을 메이크코드나 엔트리에서 " +
          "<b>직접</b> 코딩합니다. 완성한 코드는 <b>⑥ 작품 제출</b> 에서 캡처해 냅니다."));
        var lkrow = el("div");
        lkrow.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;margin-top:6px";
        [
          { url: L.start && L.start.makecode, lk: "메이크코드 열기 ▸" },
          { url: L.start && L.start.entry, lk: "엔트리 열기 ▸" }
        ].forEach(function (d) {
          if (!d.url) return;
          var a = el("a", null, esc(d.lk));
          a.href = d.url; a.target = "_blank"; a.rel = "noopener";
          a.style.cssText = "display:inline-block;background:var(--pri);color:#fff;font-weight:700;" +
            "padding:12px 22px;border-radius:10px;text-decoration:none;font-size:16px";
          lkrow.appendChild(a);
        });
        b.appendChild(lkrow);
        return;
      }
      b.appendChild(el("p", "hint", "아래 블록을 보고 메이크코드나 엔트리에서 똑같이 만들어 보세요. " +
        "완성한 코드는 <b>⑥ 응용</b> 에서 캡처해 냅니다."));
      var grid = el("div", "codeblk");
      [
        { env: "makecode", name: "메이크코드", lines: L.code && L.code.makecode, url: L.start && L.start.makecode, lk: "메이크코드 열기 ▸" },
        { env: "entry", name: "엔트리", lines: L.code && L.code.entry, url: L.start && L.start.entry, lk: "엔트리 열기 ▸" }
      ].forEach(function (d) {
        var one = el("div", "codeone");
        one.appendChild(el("h3", null, esc(d.name)));
        var bh = el("div");
        one.appendChild(bh);
        if (d.lines && window.Blocks) window.Blocks.render(bh, d.lines, d.env);
        else bh.innerHTML = '<p class="hint">(코드 준비 중)</p>';
        try {
          var tc = localStorage.getItem("pl.textcode." + n + "." + d.env);
          if (tc) { var ti = el("img"); ti.src = tc; ti.alt = d.name + " 코드"; ti.style.marginTop = "10px"; ti.style.width = "100%"; one.appendChild(ti); }
        } catch (e) {}
        if (d.url) {
          var lk = el("div", "lk");
          var a = el("a", null, esc(d.lk)); a.href = d.url; a.target = "_blank"; a.rel = "noopener";
          lk.appendChild(a); one.appendChild(lk);
        }
        grid.appendChild(one);
      });
      b.appendChild(grid);

    } else if (id === "s4") {
      b.appendChild(el("p", "hint", L.capstone
        ? "준비가 됐는지 스스로 확인해 보세요. 모두 «O» 가 되면 발표·제출로 넘어갑니다."
        : "풀고 <b>제출</b> 하면 바로 채점돼요."));
      var wh = el("div");
      b.appendChild(wh);
      if (window.Worksheet) window.Worksheet.mount(wh, L.worksheet || [], { onSubmit: function () { nav.mark("s4", true); } });

    } else if (id === "s5") {
      var box = el("div", "jump");
      box.appendChild(el("div", null, rich((L.jump && L.jump.body) || "확장 미션이 곧 추가됩니다.")));
      if (L.jump && L.jump.hint) {
        var det = el("details");
        det.appendChild(el("summary", null, "힌트 보기"));
        det.appendChild(el("div", null, rich(L.jump.hint)));
        box.appendChild(det);
      }
      box.appendChild(el("p", "opt", "점프과제는 선택이에요. 다 못 해도 괜찮아요."));
      b.appendChild(box);

    } else if (id === "s6") {
      var sh = el("div");
      b.appendChild(sh);
      if (window.Studio) window.Studio.mount(sh, {
        n: n, title: L.title,
        hint: L.studio && L.studio.hint,
        mode: L.studio && L.studio.mode
      });
    }
  }

  nav.select("s1", true);
})();
