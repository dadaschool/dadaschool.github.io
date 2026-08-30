/* =========================================================
   lesson.js — 4단계 흐름 (원본 gnbuilders/lesson-designer 의 <script> 를
   의미 클래스로 다시 쓰고 AI 를 얹은 것)
   1·2단계 = 규칙 기반(원본 그대로).  3단계 = AI 과정안.  4단계 = AI 문항/루브릭.
   ========================================================= */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------- 상태 ---------------- */
  var currentStandardId = "";
  var currentStandardText = "";
  var evalMethods = [];          // ['지필','수행','관찰'] 의 부분집합
  var generatedPlans = [];       // [{hour, standard, objective, intro, dev, conclusion, prep, ai, items?, rubric?, levels?}]

  /* AI 로 무언가를 만드는 중인가 (0 이면 한가하다).
     생성 중에 화면을 다시 그리면 진행 표시·미리보기가 붙어 있던 자리가 날아간다. */
  var aiBusy = 0;
  function busy(fn) {            // async 함수를 감싸 «만드는 중» 을 세어 준다
    return async function () {
      aiBusy++;
      try { return await fn.apply(null, arguments); }
      finally { aiBusy--; }
    };
  }

  /* ---------------- 화면 전환 ---------------- */
  function switchView(n) {
    $$(".step-view").forEach(function (v) { v.classList.toggle("active", v.id === "step-" + n); });
    $$(".side .navitem").forEach(function (b) { b.classList.toggle("on", b.dataset.step === String(n)); });
    var main = $("main"); if (main) main.scrollTop = 0;
  }

  /* ============================================================
     1단계 — 성취기준 분해
     ============================================================ */
  var selectEl, cardContainer;

  function renderStandardSelect() {
    var list = window.Standards.all();
    var prev = selectEl.value;
    var byArea = {};
    list.forEach(function (s) { (byArea[s.area] = byArea[s.area] || []).push(s); });
    var html = '<option value="" disabled' + (prev ? "" : " selected") + '>성취기준을 선택해주세요.</option>';
    Object.keys(byArea).forEach(function (area) {
      html += '<optgroup label="' + esc(area) + '">';
      byArea[area].forEach(function (s) {
        html += '<option value="' + esc(s.code) + '">' + esc(s.text) +
                (s.edited ? "  (수정됨)" : "") + '</option>';
      });
      html += '</optgroup>';
    });
    selectEl.innerHTML = html;
    if (prev && window.Standards.get(prev)) selectEl.value = prev;
  }

  function createCard(text) {
    var card = el("div", "card sent-card");
    card.innerHTML =
      '<div class="grip" draggable="true" title="드래그하여 순서 바꾸기">≡</div>' +
      '<div class="body">' +
        '<div class="text" contenteditable="true" spellcheck="false" ' +
             'data-ph="문장을 입력하세요 (예: (학생은) …한다.)"></div>' +
        '<div class="evals">' +
          evalChk("지필") + evalChk("수행") + evalChk("관찰") +
        '</div>' +
      '</div>' +
      '<button class="sent-del" title="이 문장 삭제" aria-label="삭제">✕</button>';

    var textEl = $(".text", card);
    textEl.textContent = text || "";

    /* 순서 바꾸기 — 손잡이(≡)를 잡아서만 움직인다.
       글자칸이 contenteditable 이라 카드 전체를 draggable 로 두면 편집이 안 된다. */
    var grip = $(".grip", card);
    grip.addEventListener("dragstart", function (e) {
      card.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "");
        e.dataTransfer.setDragImage(card, 20, 20);
      } catch (err) {}
    });
    grip.addEventListener("dragend", function () { card.classList.remove("dragging"); });

    /* 붙여넣기는 글자만 (서식 제거) */
    textEl.addEventListener("paste", function (e) {
      e.preventDefault();
      var t = ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\s+/g, " ").trim();
      document.execCommand("insertText", false, t);
    });
    /* Enter = 아래에 새 문장, Backspace(빈 칸) = 이 문장 삭제 */
    textEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var nc = createCard("");
        card.after(nc);
        $(".text", nc).focus();
      } else if (e.key === "Backspace" && textEl.textContent.trim() === "" && cardContainer.querySelectorAll(".sent-card").length > 1) {
        e.preventDefault();
        var prev = card.previousElementSibling;
        card.remove();
        if (prev && $(".text", prev)) placeCaretEnd($(".text", prev));
        updateNext1();
      }
    });

    $(".sent-del", card).addEventListener("click", function () {
      card.remove();
      updateNext1();
    });
    return card;
  }

  function placeCaretEnd(node) {
    node.focus();
    try {
      var r = document.createRange(); r.selectNodeContents(node); r.collapse(false);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) {}
  }

  /* 카드가 하나라도 «내용이 있는 것» 이 있으면 [다음 단계로] 를 보인다 */
  function updateNext1() {
    var any = $$(".sent-card", cardContainer).some(function (c) {
      return $(".text", c).textContent.trim() !== "";
    });
    $("#btn-next-1").classList.toggle("hidden", !(currentStandardId && any));
  }
  function evalChk(label) {
    return '<label class="chk"><input type="checkbox" class="eval-checkbox" value="' + label + '">' +
           '<span>' + label + '</span></label>';
  }

  function getDragAfter(container, y) {
    var els = $$(".sent-card:not(.dragging)", container);
    return els.reduce(function (closest, child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
      return closest;
    }, { offset: -Infinity }).element;
  }

  function onStandardChange() {
    currentStandardId = selectEl.value;
    var std = window.Standards.get(currentStandardId);
    if (!std) {
      cardContainer.innerHTML = "";
      cardContainer.appendChild(emptyState());
      $("#card-tools").hidden = true;
      $("#card-edit-hint").hidden = true;
      $("#btn-next-1").classList.add("hidden");
      return;
    }
    currentStandardText = std.text;
    fillCards(std.sentences);
  }

  /* 카드를 다시 그린다 (성취기준 선택 · 되돌리기가 부른다) */
  function fillCards(sentences) {
    cardContainer.innerHTML = "";
    (sentences && sentences.length ? sentences : [""]).forEach(function (s, i) {
      var c = createCard(s);
      c.style.opacity = "0";
      cardContainer.appendChild(c);
      setTimeout(function () { c.style.transition = "opacity .25s"; c.style.opacity = "1"; }, 10 + i * 55);
    });
    $("#card-tools").hidden = false;
    $("#card-edit-hint").hidden = false;
    updateNext1();
  }

  /* 지금 카드에 적힌 문장들 (빈 것 제외) */
  function currentSentences() {
    return $$(".sent-card", cardContainer)
      .map(function (c) { return $(".text", c).textContent.replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
  }
  function emptyState() {
    return el("div", "empty", '<div style="font-size:34px">🗂️</div><p>위에서 성취기준을 선택해주세요.</p>');
  }

  /* ---- 성취기준 편집 패널 ---- */
  function toggleStdEditor() {
    var box = $("#std-editor");
    box.hidden = !box.hidden;
    if (!box.hidden) renderStdEditor();
  }
  function renderStdEditor() {
    var box = $("#std-editor");
    var list = window.Standards.all();
    box.innerHTML =
      '<div class="card"><h3 style="font-weight:800;margin-bottom:10px">성취기준 추가·편집</h3>' +
      '<p class="note" style="color:#6b7280;font-size:13px;margin-bottom:12px">' +
        '내장 25개는 삭제 대신 숨김됩니다. 편집하면 <b>(수정됨)</b> 으로 표시되고 [되돌리기] 로 원본 복구. ' +
        '다른 PC·교과와 공유하려면 [JSON 내보내기].</p>' +
      '<div class="plan-grid">' +
        '<div class="plan-field"><label>영역 이름</label>' +
          '<input class="control" id="se-area" placeholder="예: 3. 알고리즘과 프로그래밍"></div>' +
        '<div class="plan-field"><label>성취기준 코드</label>' +
          '<input class="control" id="se-code" placeholder="예: 9정03-10 또는 임의 코드"></div>' +
      '</div>' +
      '<div class="plan-field" style="margin-top:12px"><label>성취기준 문장</label>' +
        '<textarea class="control" id="se-text" rows="2" placeholder="[코드] 로 시작하지 않아도 됩니다."></textarea></div>' +
      '<div class="plan-field" style="margin-top:12px"><label>문장 분해 (한 줄에 하나)</label>' +
        '<textarea class="control" id="se-sents" rows="5"></textarea>' +
        '<button class="link-btn" id="se-split">↳ 위 성취기준 문장에서 자동으로 나누기</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
        '<button class="btn primary sm" id="se-save">저장 / 추가</button>' +
        '<button class="btn ghost sm" id="se-new">입력칸 비우기</button>' +
        '<button class="btn ghost sm" id="se-export">JSON 내보내기</button>' +
        '<button class="btn ghost sm" id="se-import">JSON 가져오기</button>' +
        '<input type="file" id="se-file" accept="application/json,.json" hidden>' +
      '</div>' +
      '<div id="se-msg" class="note" style="margin-top:10px;color:#dc2626"></div>' +
      '</div>' +
      '<div class="card"><h3 style="font-weight:800;margin-bottom:10px">목록 (' + list.length + '개)</h3>' +
        '<div id="se-list"></div></div>';

    var listBox = $("#se-list", box);
    list.forEach(function (s) {
      var row = el("div", "obj-row");
      row.style.alignItems = "center";
      row.innerHTML =
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:700;color:#374151">' + esc(s.text) +
            (s.edited ? ' <span style="color:#7c3aed">(수정됨)</span>' : '') + '</div>' +
          '<div style="font-size:12px;color:#9ca3af">' + esc(s.area) + ' · 문장 ' + s.sentences.length + '개</div>' +
        '</div>' +
        '<button class="btn ghost sm" data-edit>편집</button>' +
        (s.isBuiltin
          ? (s.edited ? '<button class="btn ghost sm" data-restore>되돌리기</button>' : '<button class="btn ghost sm" data-hide>숨김</button>')
          : '<button class="btn ghost sm" data-del>삭제</button>');
      $("[data-edit]", row).addEventListener("click", function () { fillEditor(s); });
      var b;
      if ((b = $("[data-hide]", row))) b.addEventListener("click", function () { window.Standards.remove(s.code); });
      if ((b = $("[data-restore]", row))) b.addEventListener("click", function () { window.Standards.restore(s.code); });
      if ((b = $("[data-del]", row))) b.addEventListener("click", function () {
        if (confirm("'" + s.code + "' 을 삭제할까요?")) window.Standards.remove(s.code);
      });
      listBox.appendChild(row);
    });

    function fillEditor(s) {
      $("#se-area", box).value = s.area; $("#se-code", box).value = s.code;
      $("#se-text", box).value = s.text; $("#se-sents", box).value = s.sentences.join("\n");
      $("#se-msg", box).textContent = "";
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    $("#se-split", box).addEventListener("click", function () {
      var out = window.Standards.autoSplit($("#se-text", box).value);
      if (out.length) $("#se-sents", box).value = out.join("\n");
      else $("#se-msg", box).textContent = "나눌 문장을 찾지 못했습니다. 직접 입력해 주세요.";
    });
    $("#se-new", box).addEventListener("click", function () {
      ["se-area", "se-code", "se-text", "se-sents"].forEach(function (id) { $("#" + id, box).value = ""; });
      $("#se-msg", box).textContent = "";
    });
    $("#se-save", box).addEventListener("click", function () {
      var err = window.Standards.put($("#se-code", box).value, {
        area: $("#se-area", box).value,
        text: $("#se-text", box).value,
        sentences: $("#se-sents", box).value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean)
      });
      $("#se-msg", box).textContent = err || "";
      if (!err) $("#se-msg", box).style.color = "#065f46", $("#se-msg", box).textContent = "저장했습니다.";
      else $("#se-msg", box).style.color = "#dc2626";
    });
    $("#se-export", box).addEventListener("click", function () {
      dl(window.Standards.exportJSON(), "성취기준_편집본.json", "application/json");
    });
    $("#se-import", box).addEventListener("click", function () { $("#se-file", box).click(); });
    $("#se-file", box).addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var err = window.Standards.importJSON(rd.result);
        $("#se-msg", box).style.color = err ? "#dc2626" : "#065f46";
        $("#se-msg", box).textContent = err || "가져왔습니다.";
      };
      rd.readAsText(f);
      e.target.value = "";
    });
  }

  /* ============================================================
     1 → 2단계
     ============================================================ */
  function goStep2() {
    var cards = $$(".sent-card", cardContainer).filter(function (c) {
      return $(".text", c).textContent.trim() !== "";
    });
    if (!cards.length) { alert("문장을 하나 이상 입력해 주세요."); return; }
    var grouped = { "지필": [], "수행": [], "관찰": [] };
    cards.forEach(function (card) {
      var text = $(".text", card).textContent.replace(/\s+/g, " ").trim();
      $$(".eval-checkbox", card).forEach(function (cb) {
        if (cb.checked && grouped[cb.value]) grouped[cb.value].push(text);
      });
    });
    evalMethods = Object.keys(grouped).filter(function (k) { return grouped[k].length; });

    var g = $("#grouped");
    g.innerHTML = [
      { k: "지필", cls: "jipil" }, { k: "수행", cls: "suhaeng" }, { k: "관찰", cls: "gwanchal" }
    ].map(function (col) {
      var items = grouped[col.k];
      var li = items.length
        ? items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("")
        : '<li class="none">선택 없음</li>';
      return '<div class="gcol ' + col.cls + '">' +
        '<div class="gh"><span>' + col.k + ' 평가 대상</span><span class="cnt">' + items.length + '개</span></div>' +
        '<ul>' + li + '</ul></div>';
    }).join("");

    if (!$("#obj-inputs").children.length) { $("#hours").value = 1; genHours(); }
    switchView(2);
  }

  function genHours() {
    var n = parseInt($("#hours").value, 10) || 1;
    if (n > 20) n = 20; if (n < 1) n = 1;
    $("#hours").value = n;
    var box = $("#obj-inputs");
    var existing = $$(".objective-input", box).map(function (i) { return i.value; });
    box.innerHTML = "";
    for (var i = 1; i <= n; i++) {
      var row = el("div", "obj-row");
      row.innerHTML =
        '<div class="tag">' + i + '<small>차시</small></div>' +
        '<input type="text" class="objective-input control" placeholder="' + i +
          '차시 학습 목표 (예: 인공지능의 개념을 진술할 수 있다.)">';
      if (existing[i - 1]) $(".objective-input", row).value = existing[i - 1];
      box.appendChild(row);
    }
    $("#step2-foot").classList.remove("hidden");
  }

  /* ============================================================
     3단계 — 수업 설계
     ============================================================ */
  function goStep3() {
    var inputs = $$(".objective-input");
    generatedPlans = inputs.map(function (inp, i) {
      var obj = inp.value.trim() || "(미입력) " + (i + 1) + "차시 학습 목표";
      var p = generateDefaultLessonPlan(currentStandardId, obj);
      p.hour = i + 1;
      p._src = "template";
      return p;
    });
    renderStep3();
    switchView(3);
  }

  function renderStep3() {
    var host = $("#plan-editors");
    var aiReady = window.AI.ready();
    host.innerHTML =
      '<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<div style="font-size:14px;color:#374151">' +
          (aiReady
            ? 'AI 설정됨 (' + esc(window.AI.state().provider) + '). <b>[✨ AI로 과정안 생성]</b> 을 누르면 차시 ' +
              generatedPlans.length + '개 → 호출 ' + generatedPlans.length + '회.'
            : 'AI 키가 없어 <b>템플릿</b> 으로 채워졌습니다. 실제 생성을 하려면 좌측 <b>[⚙ AI 설정]</b>.') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn purple" id="btn-ai-all"' + (aiReady ? "" : " disabled") + '>✨ AI로 과정안 생성</button>' +
          '<button class="btn ghost" id="btn-md-all">⬇ 전체 Markdown</button>' +
        '</div>' +
      '</div>';

    generatedPlans.forEach(function (plan, index) {
      var card = el("div", "plan-card");
      card.innerHTML =
        '<div class="ph">' +
          '<h3>' + plan.hour + '차시 수업 과정안</h3>' +
          '<div class="acts">' +
            (plan._src === "ai" ? '<span class="gen-status done">AI 생성됨</span>'
             : plan._src === "fail" ? '<span class="gen-status fail">AI 실패 → 템플릿</span>' : '') +
            '<button class="btn outline sm" data-ai>✨ 이 차시만 AI로</button>' +
            '<button class="btn outline sm" data-md>⬇ Markdown</button>' +
          '</div>' +
        '</div>' +
        '<div class="pb">' +
          '<div class="plan-grid">' +
            fld(index, "objective", "1. 학습 목표", plan.objective, 2) +
            '<div class="plan-field"><label>2. 성취 기준</label>' +
              '<textarea rows="2" readonly>' + esc(plan.standard) + '</textarea></div>' +
          '</div>' +
          fld(index, "intro", "3. 도입 (동기유발 등)", plan.intro, 4) +
          fld(index, "dev", "4. 전개 (학생 활동)", plan.dev, 7) +
          fld(index, "conclusion", "5. 마무리 (정리·평가)", plan.conclusion, 4) +
          '<div class="plan-grid">' +
            fld(index, "prep", "6. 교사 준비물", plan.prep, 4) +
            fld(index, "ai", "7. AI 활용 포인트", plan.ai, 4, true) +
          '</div>' +
        '</div>';
      $("[data-ai]", card).addEventListener("click", function () { regenOne(index, card); });
      $("[data-md]", card).addEventListener("click", function () { downloadMd(index); });
      $$("textarea[data-field]", card).forEach(function (ta) {
        ta.addEventListener("input", function () {
          generatedPlans[index][ta.dataset.field] = ta.value;
        });
      });
      host.appendChild(card);
    });

    $("#btn-ai-all").addEventListener("click", regenAll);
    $("#btn-md-all").addEventListener("click", downloadAllMd);
  }
  function fld(i, field, label, val, rows, isAi) {
    return '<div class="plan-field' + (isAi ? " ai" : "") + '"><label>' + label + '</label>' +
      '<textarea data-field="' + field + '" rows="' + (rows || 3) + '">' + esc(val || "") + '</textarea></div>';
  }

  var regenOne = busy(async function (index, card) {
    var plan = generatedPlans[index];
    var badge = $(".acts", card);
    var btn = $("[data-ai]", card);
    btn.disabled = true;
    var mark = el("span", "gen-status wait", '<span class="spinner"></span> 생성 중…');
    badge.insertBefore(mark, badge.firstChild);
    try {
      var out = await window.AI.call(
        window.AI.PROMPT.lessonSystem,
        window.AI.PROMPT.lessonUser(plan.standard, plan.objective, evalMethods, plan.hour, generatedPlans.length),
        { json: true });
      ["intro", "dev", "conclusion", "prep", "ai"].forEach(function (k) {
        if (out[k]) plan[k] = String(out[k]);
      });
      plan._src = "ai";
    } catch (e) {
      plan._src = "fail";
      alert(plan.hour + "차시 AI 생성 실패:\n" + e.message);
    } finally {
      btn.disabled = false;
      renderStep3();
    }
  });
  var regenAll = busy(async function () {
    var btn = $("#btn-ai-all");
    btn.disabled = true;
    for (var i = 0; i < generatedPlans.length; i++) {
      var plan = generatedPlans[i];
      btn.textContent = "생성 중… (" + (i + 1) + "/" + generatedPlans.length + ")";
      try {
        var out = await window.AI.call(
          window.AI.PROMPT.lessonSystem,
          window.AI.PROMPT.lessonUser(plan.standard, plan.objective, evalMethods, plan.hour, generatedPlans.length),
          { json: true });
        ["intro", "dev", "conclusion", "prep", "ai"].forEach(function (k) {
          if (out[k]) plan[k] = String(out[k]);
        });
        plan._src = "ai";
      } catch (e) { plan._src = "fail"; }
    }
    renderStep3();
  });

  /* ---- 템플릿 (원본 generateDefaultLessonPlan 이식 · 키 없을 때 폴백) ---- */
  function generateDefaultLessonPlan(standardId, objectiveText) {
    var T = TEMPLATES[standardId] || TEMPLATES._generic;
    return {
      standard: currentStandardText,
      objective: objectiveText,
      intro: T.intro, dev: T.dev, conclusion: T.conclusion, prep: T.prep, ai: T.ai
    };
  }
  var TEMPLATES = {
    "9정04-01": {
      intro: "▶ 동기유발: 일상 속 인공지능 활용 사례(예: 스마트폰 비서, 추천 알고리즘) 찾기\n▶ 학습목표 제시 및 본 차시 학습 필요성 안내",
      dev: "[활동 1] 지능형 기계와 일반 기계 구분하기\n- 세탁기, 자율주행차, 계산기 등을 비교하며 인공지능의 개념 및 특성(인식, 학습, 추론) 추출\n\n[활동 2] 인공지능 소프트웨어 분류 체험\n- 엔트리 AI 또는 구글 티처블 머신을 실행하여 텍스트/이미지/오디오 처리 소프트웨어의 특징 구별하기",
      conclusion: "▶ 활동 결과 정리 및 인공지능 소프트웨어의 개념 정의\n▶ 핵심 개념 퀴즈 진행 및 피드백",
      prep: "- 학생용 크롬북 또는 태블릿\n- 엔트리(Entry) 블록 코딩 플랫폼 계정",
      ai: "▶ 티처블 머신을 활용해 인공지능이 이미지를 인지·분류하는 특성을 직관적으로 탐구"
    },
    "9정04-02": {
      intro: "▶ 동기유발: 잘못된 인공지능 학습 사례(예: 늑대와 허스키 오인) 보여주기\n▶ 인공지능 학습에서 데이터의 중요성 공감",
      dev: "[활동 1] 목적에 맞는 학습 데이터 수집하기\n- 주제(예: 가위/바위/보 인식)를 선정하고 웹캠이나 이미지 검색을 통해 학습용 이미지 수집\n\n[활동 2] 데이터 레이블링 및 분류\n- 수집한 데이터를 모둠별로 클래스를 나누어 레이블링하고 데이터 불균형 문제 논의하기",
      conclusion: "▶ 양질의 데이터와 편향되지 않은 데이터 수집의 중요성 요약\n▶ 형성평가 작성 및 차시 예고",
      prep: "- 웹캠 장착 스마트 기기\n- 이미지 데이터 수집 가이드라인지",
      ai: "▶ 데이터 분류 플랫폼으로 수집 이미지를 라벨링·검수하며 AI 데이터 가공 과정 이해"
    },
    "9정04-03": {
      intro: "▶ 동기유발: 실시간 날씨 데이터나 헬스케어 데이터가 활용되는 인공지능 시스템 소개\n▶ 학습목표 확인",
      dev: "[활동 1] 인공지능 모델 학습 및 시스템 빌드\n- 다양한 유형의 데이터(수치, 텍스트)로 엔트리 AI 모델을 학습시킴\n\n[활동 2] 실생활 적용 시뮬레이션\n- 구축한 시스템이 입력값에 맞게 예측/판단하는지 학교 내 문제 상황에 적용 테스트",
      conclusion: "▶ 시스템 구성의 한계점과 고도화 방안 토의\n▶ 차시 예고 및 실습실 정리",
      prep: "- 엔트리 블록 코딩 환경\n- 실습용 오픈 데이터셋(공공데이터 포털 등)",
      ai: "▶ 공공 데이터를 받아 모델에 매핑하고 동작을 제어하는 인공지능 시스템 파이프라인 경험"
    },
    "9정04-04": {
      intro: "▶ 동기유발: 교내 불편 사항(예: 급식 잔반, 도서 정돈) 브레인스토밍\n▶ 인공지능으로 해결할 수 있는 문제 환경 인식",
      dev: "[활동 1] 인공지능 해결 문제 발견 및 정의\n- 학교 생활에서 인공지능 도입 효과가 클 문제를 디자인 씽킹으로 정의\n\n[활동 2] 적합한 AI 모델 선정 및 적용\n- 문제 특성(시각 인지/예측 여부)을 분석해 지도학습/비지도학습 중 선택하고 가상 솔루션 구축",
      conclusion: "▶ 모둠별 문제 해결 방안 발표\n▶ 동료 평가 피드백 및 교사 총평",
      prep: "- 문제 정의용 전지 및 포스트잇\n- 가상 인공지능 솔루션 기획서 양식",
      ai: "▶ 프로토타이핑 도구로 아이디어를 구체화하고, AI 챗봇에게 알고리즘 적합성을 검증받기"
    },
    "9정04-05": {
      intro: "▶ 동기유발: AI 편향성으로 인한 사례 또는 딥페이크 뉴스 시청\n▶ 인공지능 윤리의 대두 배경 이해",
      dev: "[활동 1] 데이터 수집·활용의 저작권 및 윤리 이슈 탐색\n- 타인의 글·사진 데이터 수집 시 저작권·개인정보 침해 사례 모둠 토의\n\n[활동 2] AI 윤리 가이드라인 구상\n- '우리들만의 AI 개발 윤리 5대 원칙' 초안 작성",
      conclusion: "▶ 작성한 윤리 선언문 공유 및 공동 서명\n▶ 책임감 있는 디지털 시민성 강조 및 정리",
      prep: "- 인공지능 윤리 딜레마 토의 카드\n- 모둠별 공유 게시판",
      ai: "▶ AI 윤리 진단 도구로 자신들이 만든 데이터셋의 편향성을 시각적으로 점검"
    },
    "9정05-01": {
      intro: "▶ 동기유발: 디지털 기술이 가져온 실생활 변화(자율주행, 무인 점포) 영상 시청\n▶ 학습목표 제시 및 필요성 안내",
      dev: "[활동 1] 아날로그 시대와 디지털 시대의 삶 비교하기\n- 모둠별로 과거·현재·미래의 사회 모습 조사\n\n[활동 2] 직업의 변화 탐색 및 마인드맵\n- 사라질 직업과 새로 등장할 유망 직업 예측, 협업 도구로 공유·피드백",
      conclusion: "▶ 모둠 결과 발표 및 요약\n▶ 디지털 시대에 필요한 역량의 중요성 강조\n▶ 형성평가 및 차시 예고",
      prep: "- 학생용 스마트 기기\n- 협업 도구 링크\n- 미래 직업 영상 자료",
      ai: "▶ 생성형 AI에게 '10년 후 유망 직업'을 물어 답변을 비판적으로 분석하고 내 생각과 비교"
    },
    "9정05-02": {
      intro: "▶ 동기유발: 사이버 폭력·디지털 과몰입 관련 최신 뉴스 함께 읽기\n▶ 디지털 시민으로서 규칙의 필요성 공감",
      dev: "[활동 1] 디지털 역기능 사례 분석 (PBL)\n- 제시된 디지털 딜레마 상황에서 문제점 도출\n\n[활동 2] 우리 반 디지털 윤리 10계명 제정\n- 모둠별 규칙 제안 → 학급 토의·투표로 민주적 확정",
      conclusion: "▶ 확정된 10계명 낭독\n▶ 디지털 시민성 실천 서약\n▶ 학습 내용 정리 및 차시 예고",
      prep: "- 스마트 기기 및 학급 투표 도구\n- 실천 서약서 양식\n- 디지털 역기능 뉴스 자료",
      ai: "▶ AI 챗봇을 가상 토론 상대로 삼아 윤리적 딜레마의 찬반 논거를 수집하고 비판적으로 검토"
    },
    "9정05-03": {
      intro: "▶ 동기유발: '디지털 발자국'이 개인정보 유출로 이어진 사례 영상 시청\n▶ 정보 보호와 저작권의 중요성 인식",
      dev: "[활동 1] 개인정보·저작권 침해 사례 탐구\n- CCL(크리에이티브 커먼즈 라이선스)의 개념·종류 이해\n\n[활동 2] 정보 보호 실천 가이드 제작\n- 2인 1조로 '청소년 개인정보·저작권 보호 가이드'를 인포그래픽/포스터로 제작·전시",
      conclusion: "▶ 제작 포스터 상호 감상 및 동료 평가\n▶ 정보 권리·저작권 존중 태도 함양\n▶ 핵심 내용 퀴즈 및 수업 종료",
      prep: "- 디자인 제작 도구\n- CCL 마크 설명 자료\n- 작품 공유용 온라인 갤러리",
      ai: "▶ AI 생성 도구 사용 시의 저작권 분쟁 사례를 탐색하고 데이터 문해력에 관한 짧은 글쓰기"
    },
    "_generic": {
      intro: "▶ 동기유발: 학습 주제와 연결된 실생활 사례 제시\n▶ 학습목표 확인",
      dev: "[활동 1] 주제 탐구 활동\n- 모둠별 자료 조사 및 협업\n\n[활동 2] 문제 해결 및 실천 방안 수립\n- 학생 주도적인 문제 해결 과정 경험",
      conclusion: "▶ 학습 내용 요약 및 정리\n▶ 형성평가 실시\n▶ 다음 차시 예고",
      prep: "- 스마트 기기, 수업용 프레젠테이션 자료",
      ai: "▶ AI 도구를 활용한 자료 수집·정리 또는 아이디어 확장 경험 제공"
    }
  };

  /* ---- Markdown ---- */
  function planToMd(plan) {
    return "# " + plan.hour + "차시 수업 과정안\n\n" +
      "## 1. 학습 목표\n" + (plan.objective || "") + "\n\n" +
      "## 2. 성취 기준\n" + (plan.standard || "") + "\n\n" +
      "## 3. 도입\n" + (plan.intro || "") + "\n\n" +
      "## 4. 전개 (학생 활동)\n" + (plan.dev || "") + "\n\n" +
      "## 5. 마무리\n" + (plan.conclusion || "") + "\n\n" +
      "## 6. 교사 준비물\n" + (plan.prep || "") + "\n\n" +
      "## 7. AI 활용 포인트\n" + (plan.ai || "") + "\n";
  }
  function downloadMd(i) {
    dl(planToMd(generatedPlans[i]), "정보과_수업과정안_" + generatedPlans[i].hour + "차시.md", "text/markdown");
  }
  function downloadAllMd() {
    var all = generatedPlans.map(planToMd).join("\n\n---\n\n");
    dl(all, "정보과_수업과정안_전체.md", "text/markdown");
  }

  /* ============================================================
     4단계 — 학습 활동지
     ============================================================ */
  function goStep4() { renderStep4(); switchView(4); }

  function renderStep4() {
    var host = $("#final-plans");
    host.innerHTML = "";
    var aiReady = window.AI.ready();
    if (!aiReady) {
      host.appendChild(el("div", "card",
        'AI 키가 없어 문항·루브릭 자동 생성을 쓸 수 없습니다. 좌측 <b>[⚙ AI 설정]</b> 에서 키를 넣으면 ' +
        '차시마다 <b>[AI로 문항 생성]</b> 버튼이 켜집니다. 그래도 아래에서 활동지를 인쇄할 수 있습니다.'));
    }
    generatedPlans.forEach(function (plan, index) {
      if (!plan.items) plan.items = [];
      var card = el("div", "ws-card");
      card.innerHTML =
        '<div class="wh"><span>' + plan.hour + '차시 학습 활동지</span></div>' +
        '<div class="wbody">' +
          '<div class="ws-summary">' +
            '<div class="box"><h4>학습 목표</h4><p>' + esc(plan.objective) + '</p></div>' +
            '<div class="box teacher-only"><h4>성취 기준 (교사용 · 학생 배부본 제외)</h4><p>' + esc(plan.standard) + '</p></div>' +
          '</div>' +
          '<div class="ws-tools">' +
            /* ⚠ 이 칸의 이름은 「학습 활동지 문항 수」다. 예전에 «AI» 라고만 적어 두었더니
               무엇을 넣는 칸인지 아무도 몰랐다(사용자 신고 2026-08-30). 다시 줄이지 말 것. */
            '<div class="grp"><span class="lbl">학습 활동지 문항 수</span>' +
              '<input type="number" class="control count-in" data-count value="5" min="1" max="15"' + (aiReady ? "" : " disabled") + '>' +
              '<span class="lbl">난이도</span>' +
              '<select class="control level-sel" data-level' + (aiReady ? "" : " disabled") + '>' +
                '<option value="혼합">혼합</option><option value="하">하</option><option value="중">중</option><option value="상">상</option></select>' +
              '<button class="btn purple sm" data-genitems' + (aiReady ? "" : " disabled") + '>✨ 문항 생성</button>' +
              '<button class="btn outline sm" data-genrubric' + (aiReady ? "" : " disabled") + '>채점 루브릭</button>' +
              '<button class="btn outline sm" data-genlevels' + (aiReady ? "" : " disabled") + '>수준별 하·중·상</button>' +
            '</div>' +
            '<div class="grp" style="margin-left:auto">' +
              '<button class="btn ghost sm" data-add>+ 빈 문항</button>' +
              '<button class="btn dark sm" data-pstudent>🖨 학생 배부용</button>' +
              '<button class="btn ghost sm" data-pteacher>🖨 교사용(정답)</button>' +
              '<button class="btn ghost sm" data-hwp>⬇ .hwp</button>' +
            '</div>' +
          '</div>' +
          '<div class="item-list" data-items></div>' +
          '<div data-rubric></div>' +
          '<div data-levels></div>' +
        '</div>';

      var itemsBox = $("[data-items]", card);
      function drawItems() {
        itemsBox.innerHTML = "";
        plan.items.forEach(function (it, qi) { itemsBox.appendChild(itemRow(plan, qi)); });
        if (!plan.items.length) itemsBox.innerHTML = '<div class="note" style="color:#9ca3af;padding:8px">아직 문항이 없습니다. [✨ 문항 생성] 또는 [+ 빈 문항].</div>';
      }
      drawItems();
      card._draw = drawItems;

      $("[data-add]", card).addEventListener("click", function () {
        plan.items.push({ k: "text", q: "", a: [] }); drawItems();
      });
      $("[data-genitems]", card).addEventListener("click", function () {
        genItems(plan, $("[data-count]", card).value, $("[data-level]", card).value, this, drawItems);
      });
      $("[data-genrubric]", card).addEventListener("click", function () {
        genRubric(plan, this, $("[data-rubric]", card));
      });
      $("[data-genlevels]", card).addEventListener("click", function () {
        genLevels(plan, this, $("[data-levels]", card));
      });
      $("[data-pstudent]", card).addEventListener("click", function () { printStudent(plan); });
      $("[data-pteacher]", card).addEventListener("click", function () { printTeacher(plan); });
      $("[data-hwp]", card).addEventListener("click", function () { downloadHwp(plan); });

      if (plan.rubric) drawRubric(plan, $("[data-rubric]", card));
      if (plan.levels) drawLevels(plan, $("[data-levels]", card));
      host.appendChild(card);
    });
  }

  var KIND_LABEL = { choice: "선택형", ox: "O·X", short: "단답형", text: "서술형", perform: "수행 과제" };
  function itemRow(plan, qi) {
    var it = plan.items[qi];
    var row = el("div", "q-item");
    var kinds = Object.keys(KIND_LABEL).map(function (k) {
      return '<option value="' + k + '"' + (it.k === k ? " selected" : "") + '>' + KIND_LABEL[k] + '</option>';
    }).join("");
    row.innerHTML =
      '<div class="qhead"><span class="qno">' + (qi + 1) + '</span>' +
        '<select class="qkind-sel" style="font-size:12px;padding:2px 6px;border-radius:6px;border:1px solid #cbd5e1">' + kinds + '</select>' +
        '<button class="del" title="삭제">&times;</button></div>' +
      '<textarea data-q rows="2" placeholder="문두">' + esc(it.q || "") + '</textarea>' +
      (it.k === "choice" ? '<div class="opts" data-opts></div><button class="link-btn" data-addopt>+ 선택지</button>' : '') +
      ansLine(it);
    var sel = $(".qkind-sel", row);
    sel.addEventListener("change", function () {
      it.k = sel.value;
      if (it.k === "choice" && !it.opts) it.opts = ["", "", "", ""];
      plan._card && plan._card._draw();
      redrawParent(row, plan);
    });
    $("[data-q]", row).addEventListener("input", function () { it.q = this.value; });
    $(".del", row).addEventListener("click", function () {
      plan.items.splice(qi, 1); redrawParent(row, plan);
    });
    if (it.k === "choice") {
      var ob = $("[data-opts]", row);
      (it.opts || (it.opts = ["", "", "", ""])).forEach(function (o, oi) {
        var inp = el("input");
        inp.value = o; inp.placeholder = (oi + 1) + "번 선택지";
        inp.addEventListener("input", function () { it.opts[oi] = inp.value; });
        ob.appendChild(inp);
      });
      $("[data-addopt]", row).addEventListener("click", function () {
        it.opts.push(""); redrawParent(row, plan);
      });
    }
    return row;
  }
  function ansLine(it) {
    if (it.a == null || it.a === "" || (Array.isArray(it.a) && !it.a.length)) return "";
    var v = Array.isArray(it.a) ? it.a.join(" · ") : String(it.a);
    return '<div class="ansline"><b>정답/채점(교사용):</b> ' + esc(v) +
           (it.why ? ' &nbsp;<span style="opacity:.8">— ' + esc(it.why) + '</span>' : '') + '</div>';
  }
  function redrawParent(row, plan) {
    var host = row.closest(".item-list");
    host.innerHTML = "";
    plan.items.forEach(function (_, qi) { host.appendChild(itemRow(plan, qi)); });
    if (!plan.items.length) host.innerHTML = '<div class="note" style="color:#9ca3af;padding:8px">문항이 없습니다.</div>';
  }

  var genItems = busy(async function (plan, count, level, btn, done) {
    count = Math.max(1, Math.min(15, parseInt(count, 10) || 5));
    btn.disabled = true; var old = btn.textContent; btn.innerHTML = '<span class="spinner"></span> 생성 중…';
    try {
      var arr = await window.AI.call(
        window.AI.PROMPT.itemsSystem(count, level),
        window.AI.PROMPT.itemsUser(plan.objective, evalMethods, plan.standard),
        { json: true });
      if (!Array.isArray(arr)) arr = arr.items || [];
      plan.items = arr.map(normItem);
      done();
    } catch (e) { alert("문항 생성 실패:\n" + e.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  });
  function normItem(x) {
    var k = String(x.k || x.kind || "text").toLowerCase();
    if (!KIND_LABEL[k]) k = (k === "multi" ? "choice" : "text");
    var it = { k: k, q: String(x.q || x.question || ""), why: x.why ? String(x.why) : "" };
    if (k === "choice") it.opts = (x.opts || x.options || []).map(String);
    it.a = x.a != null ? x.a : (x.answer != null ? x.answer : "");
    if (Array.isArray(it.a)) it.a = it.a.map(String);
    return it;
  }

  var genRubric = busy(async function (plan, btn, host) {
    if (!plan.items.length) { alert("먼저 문항을 만들어 주세요."); return; }
    btn.disabled = true; var old = btn.textContent; btn.innerHTML = '<span class="spinner"></span>…';
    try {
      var r = await window.AI.call(window.AI.PROMPT.rubricSystem,
        window.AI.PROMPT.rubricUser(plan.objective, plan.items), { json: true });
      plan.rubric = r; drawRubric(plan, host);
    } catch (e) { alert("루브릭 생성 실패:\n" + e.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  });
  function drawRubric(plan, host) {
    var cr = (plan.rubric && plan.rubric.criteria) || [];
    if (!cr.length) { host.innerHTML = ""; return; }
    host.innerHTML =
      '<div class="rubric-box"><h4>채점 루브릭 (교사용)</h4>' +
      '<table><thead><tr><th>평가 요소</th><th>상</th><th>중</th><th>하</th></tr></thead><tbody>' +
      cr.map(function (c) {
        return "<tr><td><b>" + esc(c.name || "") + "</b></td><td>" + esc(c["상"] || c.high || "") +
          "</td><td>" + esc(c["중"] || c.mid || "") + "</td><td>" + esc(c["하"] || c.low || "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  var genLevels = busy(async function (plan, btn, host) {
    btn.disabled = true; var old = btn.textContent; btn.innerHTML = '<span class="spinner"></span>…';
    try {
      var r = await window.AI.call(window.AI.PROMPT.levelSystem,
        window.AI.PROMPT.levelUser(plan.objective, plan.standard), { json: true });
      plan.levels = { "하": (r["하"] || []).map(normItem), "중": (r["중"] || []).map(normItem), "상": (r["상"] || []).map(normItem) };
      drawLevels(plan, host);
    } catch (e) { alert("수준별 생성 실패:\n" + e.message); }
    finally { btn.disabled = false; btn.textContent = old; }
  });
  function drawLevels(plan, host) {
    if (!plan.levels) { host.innerHTML = ""; return; }
    host.innerHTML = '<div class="level-block"><h4>수준별 문항 (교사용 · 인쇄는 아래 버튼)</h4>' +
      ["하", "중", "상"].map(function (lv) {
        var arr = plan.levels[lv] || [];
        return '<div style="margin:6px 0"><b>[' + lv + ']</b> ' +
          arr.map(function (it, i) { return (i + 1) + ") " + esc(it.q); }).join("  ") +
          ' <button class="link-btn" data-plv="' + lv + '">🖨 이 수준 인쇄</button></div>';
      }).join("") + '</div>';
    $$("[data-plv]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        printItems((plan.levels[b.dataset.plv] || []), plan.hour + "차시 활동지 (" + b.dataset.plv + ")", plan.objective);
      });
    });
  }

  /* ---- 인쇄 ---- */
  function toPrintItems(items) {
    // js/print.js 스키마로 변환. 정답·해설은 빼고 넘긴다(이중 안전장치).
    return (items || []).map(function (it) {
      if (it.k === "choice") return { k: "choice", q: it.q, opts: (it.opts || []).filter(function (o) { return o !== ""; }) };
      if (it.k === "ox") return { k: "ox", q: it.q };
      if (it.k === "short") return { k: "short", q: it.q, ph: "답을 쓰세요" };
      return { k: "text", q: it.q, lines: it.k === "perform" ? 6 : 4 };
    });
  }
  function printStudent(plan) {
    if (!plan.items.length) { alert("문항이 없습니다."); return; }
    printItems(plan.items, plan.hour + "차시 학습 활동지", plan.objective);
  }
  function printItems(items, title, objective) {
    window.Print.sheet({
      title: title,
      subtitle: objective ? "학습 목표 : " + objective : "",
      head: ["학년", "반", "번호", "이름"],
      sections: [{ step: "활동", lead: "다음 물음에 답하세요.", items: toPrintItems(items) }]
    });
  }

  function printTeacher(plan) {
    var rows = plan.items.map(function (it, i) {
      var opts = it.k === "choice"
        ? '<ol class="op">' + (it.opts || []).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ol>" : "";
      var ans = "";
      if (it.a != null && it.a !== "" && !(Array.isArray(it.a) && !it.a.length))
        ans = '<div class="ans"><b>정답/채점 :</b> ' + esc(Array.isArray(it.a) ? it.a.join(" · ") : it.a) + "</div>";
      var why = it.why ? '<div class="why"><b>해설 :</b> ' + esc(it.why) + "</div>" : "";
      return '<div class="q"><div class="qt"><span>' + (i + 1) + ".</span> " + esc(it.q) +
        ' <em>[' + (KIND_LABEL[it.k] || it.k) + ']</em></div>' + opts + ans + why + "</div>";
    }).join("");
    var rubric = "";
    if (plan.rubric && plan.rubric.criteria && plan.rubric.criteria.length) {
      rubric = '<h2>채점 루브릭</h2><table class="rb"><tr><th>평가 요소</th><th>상</th><th>중</th><th>하</th></tr>' +
        plan.rubric.criteria.map(function (c) {
          return "<tr><td><b>" + esc(c.name || "") + "</b></td><td>" + esc(c["상"] || "") + "</td><td>" +
            esc(c["중"] || "") + "</td><td>" + esc(c["하"] || "") + "</td></tr>";
        }).join("") + "</table>";
    }
    var html =
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(plan.hour) + '차시 교사용</title><style>' +
      'body{font-family:"Malgun Gothic","맑은 고딕",sans-serif;color:#111;margin:0;background:#eef1f5}' +
      '.bar{position:sticky;top:0;background:#103b6f;color:#fff;padding:10px 16px;font-size:13px}' +
      '.bar button{font-weight:700;padding:8px 16px;border:0;border-radius:8px;background:#ffd166;cursor:pointer}' +
      '.page{max-width:210mm;margin:16px auto;background:#fff;padding:18mm 16mm;box-shadow:0 2px 10px rgba(0,0,0,.15)}' +
      'h1{font-size:19pt;color:#0e2f59;border-bottom:2pt solid #103b6f;padding-bottom:6pt;margin:0 0 10pt}' +
      'h2{font-size:13pt;color:#0e2f59;margin:16pt 0 6pt;border-left:4pt solid #2563eb;padding-left:8pt}' +
      '.meta{font-size:10pt;color:#44546a;margin-bottom:4pt}' +
      '.q{margin:0 0 12pt;break-inside:avoid}.qt{font-size:11pt;font-weight:600}.qt em{color:#5a7086;font-style:normal;font-size:9pt}' +
      '.op{margin:4pt 0 4pt 18pt}.op li{font-size:10.5pt;margin:2pt 0}' +
      '.ans{margin:4pt 0;padding:5pt 8pt;background:#fff7ed;border-left:3pt solid #f59e0b;font-size:10pt}' +
      '.why{margin:3pt 0;font-size:9.6pt;color:#475569}' +
      'table.rb{border-collapse:collapse;width:100%;font-size:9.6pt}table.rb th,table.rb td{border:.8pt solid #94a3b8;padding:4pt 6pt;text-align:left;vertical-align:top}table.rb th{background:#e8eef8}' +
      '@media print{.bar{display:none}.page{margin:0;box-shadow:none;max-width:none}}' +
      '</style></head><body>' +
      '<div class="bar"><button onclick="window.print()">🖨 인쇄 / PDF 저장</button> &nbsp; 교사용 — 정답·루브릭·성취기준 포함</div>' +
      '<div class="page"><h1>' + esc(plan.hour) + '차시 교사용 (문항·정답·루브릭)</h1>' +
      '<div class="meta">성취기준 : ' + esc(plan.standard) + '</div>' +
      '<div class="meta">학습목표 : ' + esc(plan.objective) + '</div>' +
      '<h2>문항 및 정답</h2>' + (rows || "<p>문항 없음</p>") + rubric + '</div></body></html>';
    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 막혀 있습니다. 팝업을 허용해 주세요."); return; }
    w.document.open(); w.document.write(html); w.document.close();
    var printed = false;
    function go() { if (printed) return; printed = true; try { w.focus(); w.print(); } catch (e) {} }
    w.onload = go; setTimeout(go, 700);
  }

  function downloadHwp(plan) {
    var body = plan.items.map(function (it, i) {
      var opts = it.k === "choice"
        ? "<ol>" + (it.opts || []).filter(Boolean).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ol>" : "";
      var space = it.k === "ox" ? '<p>( &nbsp; O &nbsp; / &nbsp; X &nbsp; )</p>'
        : it.k === "short" ? '<div class="sbox"></div>'
        : it.k === "choice" ? '<p>답 : ______</p>'
        : '<div class="lbox"></div>';
      return "<div class='q'><p class='qt'>" + (i + 1) + ". " + esc(it.q) + "</p>" + opts + space + "</div>";
    }).join("");
    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8">' +
      '<title>' + esc(plan.hour) + '차시 학습 활동지</title><style>' +
      "body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;line-height:1.7;color:#000;padding:24px}" +
      "h1{text-align:center;font-size:22pt;border-bottom:2px solid #000;padding-bottom:8px}" +
      ".info{text-align:right;font-size:12pt;margin:12px 0 24px}" +
      "h2{font-size:14pt;border-left:5px solid #2563eb;padding-left:8px;margin-top:20px}" +
      ".q{margin:14px 0}.qt{font-weight:bold}" +
      ".sbox{border:1px solid #000;height:34px;margin-top:6px}" +
      ".lbox{border:1px solid #000;height:120px;margin-top:6px}" +
      "ol{margin:6px 0 6px 22px}" +
      "</style></head><body>" +
      "<h1>" + esc(plan.hour) + "차시 학습 활동지</h1>" +
      "<div class='info'>____학년 ____반 ____번 &nbsp;&nbsp; 이름 : ________________</div>" +
      "<h2>오늘의 학습 목표</h2><p>" + esc(plan.objective) + "</p>" +
      "<h2>문제</h2>" + (body || "<p>(문항을 먼저 생성하세요)</p>") +
      "</body></html>";
    var blob = new Blob(["﻿" + html], { type: "application/vnd.hancom.hwp;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "학생활동지_" + plan.hour + "차시.hwp";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ============================================================
     5단계 — 학습 도움 자료 제작하기 (시뮬레이터)
     ============================================================ */
  function goStep5() { renderStep5(); switchView(5); }

  function renderStep5() {
    var host = $("#sim-plans");
    host.innerHTML = "";
    var aiReady = window.AI.ready();

    if (!generatedPlans.length) {
      host.appendChild(el("div", "card", "먼저 <b>2단계</b>에서 차시와 학습 목표를 정하고 <b>3단계</b>로 넘어오세요."));
      return;
    }
    if (!aiReady) {
      host.appendChild(el("div", "card",
        '시뮬레이터는 <b>AI 로만</b> 만듭니다. 좌측 <b>[⚙ AI 설정]</b> 에서 키를 넣어 주세요. ' +
        '<br><span style="color:#6b7280;font-size:14px">차시 하나에 호출 1회입니다.</span>'));
    }

    generatedPlans.forEach(function (plan, index) {
      if (!plan.simType) plan.simType = window.Sim.recommend(plan);
      var card = el("div", "ws-card");
      var T = window.Sim.TYPES;
      card.innerHTML =
        '<div class="wh"><span>' + plan.hour + '차시 · 학습 도움 자료</span>' +
          '<span style="font-size:13px;font-weight:600;opacity:.9">' + esc(plan.objective) + '</span></div>' +
        '<div class="wbody">' +
          '<div class="sim-types" data-types></div>' +
          '<div class="sim-note" data-typedesc></div>' +
          '<div class="ws-tools" style="margin-top:14px">' +
            '<button class="btn purple" data-gen' + (aiReady ? "" : " disabled") + '>✨ 시뮬레이터 만들기</button>' +
            '<span data-status></span>' +
            '<div class="grp" style="margin-left:auto">' +
              '<button class="btn ghost sm" data-open disabled>새 창에서 크게 보기</button>' +
              '<button class="btn dark sm" data-dl disabled>⬇ HTML 내려받기</button>' +
            '</div>' +
          '</div>' +
          '<div data-report></div>' +
          '<div data-preview></div>' +
        '</div>';

      var typesBox = $("[data-types]", card);
      var descBox = $("[data-typedesc]", card);
      function paintTypes() {
        typesBox.innerHTML = window.Sim.TYPE_ORDER.map(function (k) {
          var on = plan.simType === k;
          return '<button class="sim-type' + (on ? " on" : "") + '" data-t="' + k + '">' +
            '<span class="ic">' + T[k].icon + '</span>' +
            '<span class="nm">' + esc(T[k].name) + '</span>' +
            (window.Sim.recommend(plan) === k ? '<span class="rec">추천</span>' : '') +
            '</button>';
        }).join("");
        var t = T[plan.simType];
        descBox.innerHTML = '<b>' + esc(t.name) + '</b> — ' + esc(t.desc) +
          '<br><span class="ex">이런 주제에 잘 맞습니다 : ' + esc(t.good) + '</span>';
        $$("[data-t]", typesBox).forEach(function (b) {
          b.addEventListener("click", function () {
            plan.simType = b.dataset.t;
            paintTypes();
          });
        });
      }
      paintTypes();

      $("[data-gen]", card).addEventListener("click", function () { genSim(plan, card); });
      $("[data-dl]", card).addEventListener("click", function () { dlSim(plan); });
      $("[data-open]", card).addEventListener("click", function () { openSim(plan); });

      host.appendChild(card);
      if (plan.simHTML) showSim(plan, card);
    });
  }

  var genSim = busy(async function (plan, card) {
    var btn = $("[data-gen]", card), st = $("[data-status]", card);
    var type = plan.simType;
    btn.disabled = true;
    var old = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> 만드는 중…';
    st.innerHTML = '<span class="gen-status wait">AI 가 설정을 만들고 있습니다 (20~60초)</span>';
    $("[data-report]", card).innerHTML = "";

    var lastErr = null;
    try {
      for (var attempt = 1; attempt <= 2; attempt++) {
        st.innerHTML = '<span class="gen-status wait">' +
          (attempt === 1 ? "AI 가 설정을 만드는 중…" : "결과에 문제가 있어 다시 만드는 중…") + '</span>';
        var extra = lastErr ? "\n\n앞서 만든 것이 이런 문제로 거부되었습니다. 고쳐서 다시 만들어 주세요:\n- " +
                              lastErr.join("\n- ") : "";
        var spec;
        try {
          spec = await window.AI.call(window.Sim.systemPrompt(type),
                                      window.Sim.userPrompt(type, plan) + extra, { json: true });
        } catch (e) {
          lastErr = [e.message]; continue;
        }
        var v = window.Sim.validate(type, spec);
        if (!v.ok) { lastErr = v.errors; continue; }
        plan.simSpec = spec;
        plan.simHTML = window.Sim.buildHTML(type, spec, plan);
        plan.simCheck = v;
        showSim(plan, card);
        st.innerHTML = '<span class="gen-status done">완성 · 계산 ' + v.trials + '번 시험 통과</span>';
        return;
      }
      st.innerHTML = '<span class="gen-status fail">만들지 못했습니다</span>';
      $("[data-report]", card).innerHTML =
        '<div class="sim-report bad"><b>두 번 시도했지만 쓸 수 있는 결과가 나오지 않았습니다.</b><ul>' +
        (lastErr || []).map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") +
        '</ul><span class="ex">다른 유형을 골라 보거나, 3단계에서 학습 목표를 더 구체적으로 적어 보세요.</span></div>';
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  });

  function showSim(plan, card) {
    var v = plan.simCheck || { warns: [], trials: 0 };
    var rep = $("[data-report]", card);
    rep.innerHTML =
      '<div class="sim-report ok">✅ 자동 검사 통과 — 계산식을 <b>' + v.trials + '번</b> 시험해 오류·NaN 이 없었습니다.' +
      (plan.simSpec && plan.simSpec._corr != null
        ? ' 두 지표의 반대 정도 <b>' + plan.simSpec._corr.toFixed(2) + '</b> (−1 에 가까울수록 좋음).' : '') +
      '</div>' +
      (v.warns && v.warns.length
        ? '<div class="sim-report warn"><b>확인해 보세요</b><ul>' +
          v.warns.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>"
        : "");

    var pv = $("[data-preview]", card);
    pv.innerHTML = '<div class="sim-preview-head">미리보기 — <b>여기서 직접 만져 보세요.</b> ' +
      '수업 전에 반드시 한 번 확인하시기 바랍니다.</div>' +
      '<iframe class="sim-frame" sandbox="allow-scripts" title="시뮬레이터 미리보기"></iframe>';
    var f = $(".sim-frame", pv);
    f.srcdoc = plan.simHTML;

    $("[data-dl]", card).disabled = false;
    $("[data-open]", card).disabled = false;
  }

  function simFileName(plan) {
    var t = (plan.simSpec && plan.simSpec.title) || (plan.hour + "차시");
    return "학습도움자료_" + plan.hour + "차시_" + String(t).replace(/[\\/:*?"<>|]/g, "").slice(0, 24) + ".html";
  }
  function dlSim(plan) {
    if (!plan.simHTML) return;
    dl(plan.simHTML, simFileName(plan), "text/html");
  }
  function openSim(plan) {
    if (!plan.simHTML) return;
    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 막혀 있습니다. 팝업을 허용해 주세요."); return; }
    w.document.open(); w.document.write(plan.simHTML); w.document.close();
  }

  /* ---- 공통 다운로드 ---- */
  function dl(text, name, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ============================================================
     초기화
     ============================================================ */
  function init() {
    selectEl = $("#standard-select");
    cardContainer = $("#card-container");

    renderStandardSelect();
    window.Standards.onChange(function () {
      renderStandardSelect();
      if (!$("#std-editor").hidden) renderStdEditor();
    });

    selectEl.addEventListener("change", onStandardChange);
    $("#btn-std-editor").addEventListener("click", toggleStdEditor);

    /* 1단계 카드 편집 도구 */
    cardContainer.addEventListener("input", function (e) {
      if (e.target && e.target.classList.contains("text")) updateNext1();
    });
    $("#btn-add-sent").addEventListener("click", function () {
      var c = createCard("");
      cardContainer.appendChild(c);
      $(".text", c).focus();
      updateNext1();
    });
    $("#btn-reset-sents").addEventListener("click", function () {
      if (!currentStandardId) return;
      var dirty = window.Standards.isDirty(currentStandardId);
      if ((currentSentences().length || dirty) &&
          !confirm("지금 카드의 문장" + (dirty ? "과 저장해 둔 편집본" : "") +
                   "을 버리고, 프로그램 기본 분해로 되돌릴까요?")) return;
      if (dirty) window.Standards.restore(currentStandardId);   // 저장본도 지운다
      fillCards(window.Standards.get(currentStandardId).sentences);
    });
    $("#btn-save-sents").addEventListener("click", function () {
      if (!currentStandardId) return;
      var sents = currentSentences();
      if (!sents.length) { toast("저장할 문장이 없습니다."); return; }
      var std = window.Standards.get(currentStandardId);
      var err = window.Standards.put(currentStandardId, { area: std.area, text: std.text, sentences: sents });
      toast(err ? esc(err) : "이 분해를 성취기준에 <b>저장</b>했습니다. 다음에도 이대로 나옵니다.");
    });

    cardContainer.addEventListener("dragover", function (e) {
      e.preventDefault();
      var after = getDragAfter(cardContainer, e.clientY);
      var dragging = $(".dragging", cardContainer);
      if (!dragging) return;
      if (after == null) cardContainer.appendChild(dragging);
      else cardContainer.insertBefore(dragging, after);
    });

    $("#btn-next-1").addEventListener("click", goStep2);
    $("#btn-prev-2").addEventListener("click", function () { switchView(1); });
    $("#btn-gen-hours").addEventListener("click", genHours);
    $("#btn-next-2").addEventListener("click", goStep3);
    $("#btn-prev-3").addEventListener("click", function () { switchView(2); });
    $("#btn-next-3").addEventListener("click", goStep4);
    $("#btn-prev-4").addEventListener("click", function () { switchView(3); });
    $("#btn-next-4").addEventListener("click", goStep5);
    $("#btn-prev-5").addEventListener("click", function () { switchView(4); });

    $("#btn-ai-settings").addEventListener("click", window.AI.open);
    window.AI.onChange(refreshAiState);
    lastReady = window.AI.ready();      // 처음 상태를 기억해 두어야 «바뀌었다» 를 알 수 있다
    refreshAiBadge();

    $$(".side .navitem").forEach(function (b) {
      b.addEventListener("click", function () {
        var n = +b.dataset.step;
        if (n >= 2 && !currentStandardId) return;      // 성취기준 먼저
        if (n >= 3 && !generatedPlans.length) return;  // 2단계에서 [다음]을 눌러야 생김
        /* 들어갈 때마다 다시 그린다 — 다른 단계에서 AI 설정을 바꿨을 수 있다.
           ⚠ 3단계는 renderStep3() 만 부른다. goStep3() 은 학습목표 칸에서 과정안을
             새로 만들어 버려서 AI 로 생성한 내용이 지워진다. */
        if (n === 3) renderStep3();
        if (n === 4) renderStep4();
        if (n === 5) renderStep5();
        switchView(n);
      });
    });
  }
  function refreshAiBadge() {
    var b = $("#ai-badge");
    if (!b) return;
    if (window.AI.ready()) { b.className = "badge on"; b.textContent = window.AI.state().provider + " 연결됨"; }
    else { b.className = "badge off"; b.textContent = "키 없음"; }
  }

  /* 🔴 AI 설정이 바뀌면 «이미 그려 둔» 단계까지 모두 다시 그린다.
     이것이 없으면 : 3단계까지 와서 키를 넣어도 그 화면은 계속 «키 없음» 상태로 남아
     [✨ AI로 생성] 이 잠긴 채였다(사용자 신고 2026-08-29).
     화면에 들어 있던 값(과정안 글·문항·시뮬)은 모두 generatedPlans 에 적혀 있으므로
     다시 그려도 잃는 것이 없다. */
  var lastReady = null;
  function refreshAiState() {
    refreshAiBadge();
    if (aiBusy) return;                 // 만드는 중에는 건드리지 않는다
    var wasReady = lastReady;
    var now = window.AI.ready();
    lastReady = now;

    if ($("#plan-editors").children.length) renderStep3();
    if ($("#final-plans").children.length) renderStep4();
    if ($("#sim-plans").children.length) renderStep5();

    if (now && wasReady === false) {
      toast("AI 설정이 <b>모든 단계</b>에 적용되었습니다. (" + esc(window.AI.state().provider) + ")");
    } else if (!now && wasReady === true) {
      toast("AI 키를 지웠습니다. 3단계는 템플릿으로 돌아갑니다.");
    }
  }

  /* 잠깐 떴다 사라지는 알림 */
  var toastTimer = null;
  function toast(html) {
    var t = $("#ld-toast");
    if (!t) { t = el("div", "toast"); t.id = "ld-toast"; document.body.appendChild(t); }
    t.innerHTML = html;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
