/* =========================================================
   ai.js — AI 설정(모달) + 제공자 어댑터 + 프롬프트
   ---------------------------------------------------------
   · 결정(2026-08-29) : 중계 서버·Cloudflare Worker 없음.
     교사가 자기 API 키를 브라우저에 직접 넣는다 → localStorage 에만.
   · 제공자 4종 : Claude(Anthropic) · ChatGPT(OpenAI) · Gemini(Google) · Upstage(Solar)
   · 키가 없으면 앱은 템플릿 모드로 전부 동작한다(3단계).
   · 🔴 배포되는 파일에 키 문자열이 절대 들어가면 안 된다. 기본값은 빈 문자열.
   ========================================================= */
(function (global) {
  "use strict";

  var LS_KEY = "ld.ai.v1";

  var PROVIDERS = {
    claude:  { label: "Claude (Anthropic)", model: "claude-sonnet-5",
               keyHint: "console.anthropic.com 에서 발급 · sk-ant-…" },
    openai:  { label: "ChatGPT (OpenAI)",   model: "gpt-5.2",
               keyHint: "platform.openai.com 에서 발급 · sk-…" },
    gemini:  { label: "Gemini (Google)",    model: "gemini-3.7-flash",
               keyHint: "aistudio.google.com 에서 발급 · 무료 등급 있음" },
    upstage: { label: "Upstage (Solar)",    model: "solar-pro4",
               keyHint: "console.upstage.ai 에서 발급" }
  };
  /* ⚠ 모델명은 자주 바뀐다. 위 값은 2026-08 기준 자리표시자이고
     설정 화면에서 편집할 수 있다. [연결 테스트] 로 확인하면 된다. */

  function load() {
    try {
      var o = JSON.parse(global.localStorage.getItem(LS_KEY) || "{}");
      return {
        provider: o.provider || "claude",
        keys: o.keys || {},
        models: o.models || {}
      };
    } catch (e) { return { provider: "claude", keys: {}, models: {} }; }
  }
  function save(s) {
    try { global.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function clearAll() {
    try { global.localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  function state() {
    var s = load();
    return {
      provider: s.provider,
      key: s.keys[s.provider] || "",
      model: s.models[s.provider] || PROVIDERS[s.provider].model
    };
  }
  function ready() {
    var st = state();
    return !!(st.provider && st.key && st.key.trim());
  }

  /* ---------------------------------------------------------
     제공자별 호출 — 성공 시 생성 텍스트(string), 실패 시 throw
     --------------------------------------------------------- */
  async function rawCall(provider, key, model, system, user) {
    if (provider === "claude") {
      var r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          /* ⚠ 4096 으로 두면 시뮬레이터 설정(5단계)이 중간에 잘린다.
             과정안은 1~2천 토큰이면 되지만 시뮬 설정은 계산식·데이터 카드까지 들어간다. */
          model: model, max_tokens: 16000,
          system: system || undefined,
          messages: [{ role: "user", content: user }]
        })
      });
      if (!r.ok) throw new Error("Claude " + r.status + " — " + short(await r.text()));
      var j = await r.json();
      return (j.content || []).map(function (b) { return b.text || ""; }).join("").trim();
    }

    if (provider === "openai" || provider === "upstage") {
      var base = provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.upstage.ai/v1/chat/completions";
      var r2 = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: JSON.stringify({
          model: model,
          messages: [].concat(
            system ? [{ role: "system", content: system }] : [],
            [{ role: "user", content: user }]
          )
        })
      });
      if (!r2.ok) throw new Error((provider === "openai" ? "OpenAI " : "Upstage ") + r2.status + " — " + short(await r2.text()));
      var j2 = await r2.json();
      return (j2.choices && j2.choices[0] && j2.choices[0].message.content || "").trim();
    }

    if (provider === "gemini") {
      var url = "https://generativelanguage.googleapis.com/v1beta/models/"
        + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      var r3 = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [{ role: "user", parts: [{ text: user }] }]
        })
      });
      if (!r3.ok) throw new Error("Gemini " + r3.status + " — " + short(await r3.text()));
      var j3 = await r3.json();
      var cand = j3.candidates && j3.candidates[0];
      return ((cand && cand.content && cand.content.parts || []).map(function (p) { return p.text || ""; }).join("")).trim();
    }
    throw new Error("알 수 없는 제공자: " + provider);
  }
  function short(t) { t = String(t || ""); return t.length > 300 ? t.slice(0, 300) + "…" : t; }

  /* 현재 설정으로 호출. opts.json 이면 코드펜스 벗기고 JSON.parse (1회 재시도) */
  async function call(system, user, opts) {
    var st = state();
    if (!st.key) throw new Error("AI 설정에서 API 키를 먼저 넣으세요.");
    var out = await rawCall(st.provider, st.key, st.model, system, user);
    if (!opts || !opts.json) return out;
    try { return JSON.parse(stripFence(out)); }
    catch (e) {
      var retry = await rawCall(st.provider, st.key, st.model, system,
        user + "\n\n반드시 유효한 JSON 하나만. 코드펜스(```)·설명 문장을 넣지 마라.");
      return JSON.parse(stripFence(retry));
    }
  }
  function stripFence(t) {
    t = String(t || "").trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    // 앞뒤에 잡소리가 있으면 첫 { 또는 [ 부터 마지막 } 또는 ] 까지
    var a = t.search(/[\[{]/), b = t.replace(/\s+$/, "").length;
    var last = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a > 0 && last > a) t = t.slice(a, last + 1);
    return t;
  }

  /* ---------------------------------------------------------
     프롬프트
     --------------------------------------------------------- */
  var PROMPT = {
    lessonSystem:
      "당신은 대한민국 중학교 「정보」 교과 수석교사다. 2022 개정 정보과 교육과정에 맞춘 " +
      "차시별 수업 과정안을 만든다. 학생 활동 중심, 실습 가능, 학교 현장에서 바로 쓸 수 있게 쓴다.\n" +
      "반드시 아래 키만 가진 JSON 하나로만 답한다(코드펜스 금지):\n" +
      '{"intro":"...","dev":"...","conclusion":"...","prep":"...","ai":"..."}\n' +
      "- intro: 도입(동기유발·학습목표 안내). \"▶ \" 로 시작하는 줄들.\n" +
      "- dev: 전개. \"[활동 1] ...\", \"[활동 2] ...\" 형식. 각 활동에 학생이 실제로 하는 행동을 구체적으로.\n" +
      "- conclusion: 정리·형성평가·차시 예고. \"▶ \" 로 시작하는 줄들.\n" +
      "- prep: 교사 준비물. \"- \" 목록.\n" +
      "- ai: 이 차시에서 생성형 AI/AI 도구를 학습 도구로 쓰는 구체적 방법 1~2가지. \"▶ \" 로 시작.\n" +
      "성취기준 코드·문장은 넣지 마라(따로 관리한다). 한국어로.",
    lessonUser: function (stdText, objective, evalMethods, hour, total) {
      return "성취기준: " + stdText + "\n" +
        "이 차시 학습목표: " + objective + "\n" +
        "전체 " + total + "차시 중 " + hour + "차시.\n" +
        "1단계에서 교사가 고른 평가 방식: " + (evalMethods.join(", ") || "미정") + "\n" +
        "학생 수준: 중학교 1~3학년. 45분 수업.";
    },

    itemsSystem: function (count, level) {
      return "당신은 중학교 「정보」 평가 문항 출제자다. 주어진 차시 학습목표와 평가 방식에 맞는 문항을 만든다.\n" +
        "아래 스키마의 JSON 배열 하나로만 답한다(코드펜스 금지). 각 원소:\n" +
        '{"k":"choice|ox|short|text|perform", "q":"문두",' +
        ' "opts":["...","..."](choice 만), "a": 정답, "why":"간단한 해설"}\n' +
        "- a 규칙: choice=정답 선택지의 번호(1부터), ox=\"O\" 또는 \"X\", short=모범답안 문자열,\n" +
        "  text/perform=채점 포인트 3개 이하의 배열.\n" +
        "- 🔴 opts(선택지) 안에 굵게·별표·\"(정답)\" 같은 정답 힌트를 절대 넣지 마라.\n" +
        "- 정답이 항상 같은 번호에 오지 않게 섞어라. 가장 긴 선택지를 정답으로 만들지 마라.\n" +
        "- 학습목표에 정확히 맞추고, 중학생 어휘로. 한국어로.\n" +
        "개수: " + count + "개. 난이도: " + level + ".";
    },
    itemsUser: function (objective, evalMethods, stdText) {
      return "학습목표: " + objective + "\n" +
        "평가 방식: " + (evalMethods.join(", ") || "지필") + "\n" +
        "성취기준(참고 · 문항에 코드/문장 노출 금지): " + stdText;
    },

    rubricSystem:
      "수행·서술형 평가의 분석적 루브릭을 만든다. 아래 JSON 하나로만 답한다(코드펜스 금지):\n" +
      '{"criteria":[{"name":"평가 요소","상":"...","중":"...","하":"..."}]}\n' +
      "평가 요소 2~4개. 각 수준은 한 문장. 한국어로.",
    rubricUser: function (objective, items) {
      var qs = (items || []).map(function (it, i) { return (i + 1) + ". " + (it.q || ""); }).join("\n");
      return "학습목표: " + objective + "\n문항:\n" + qs;
    },

    levelSystem:
      "같은 학습목표를 난이도 하·중·상 세 벌로 낸다. 아래 JSON 하나로만 답한다(코드펜스 금지):\n" +
      '{"하":[문항...],"중":[문항...],"상":[문항...]}\n' +
      "문항 스키마는 {\"k\":\"choice|ox|short|text\",\"q\":\"...\",\"opts\":[...],\"a\":정답,\"why\":\"...\"}.\n" +
      "각 벌 3문항. opts 에 정답 힌트 금지. 한국어로.",
    levelUser: function (objective, stdText) {
      return "학습목표: " + objective + "\n성취기준(참고, 노출 금지): " + stdText;
    }
  };

  /* ---------------------------------------------------------
     설정 모달
     --------------------------------------------------------- */
  var backEl = null;
  function buildModal() {
    if (backEl) return backEl;
    backEl = document.createElement("div");
    backEl.className = "modal-back";
    backEl.innerHTML =
      '<div class="modal" role="dialog" aria-label="AI 설정">' +
        '<div class="mh"><h3>⚙ AI 설정</h3><button class="x" data-x>&times;</button></div>' +
        '<div class="mb">' +
          '<div><div class="field-label">AI 제공자</div><div class="prov-list" data-provs></div></div>' +
          '<div><div class="field-label">API 키</div>' +
            '<input type="password" class="control" data-key placeholder="여기에 붙여넣기" autocomplete="off">' +
            '<div class="note" data-keyhint></div></div>' +
          '<div><div class="field-label">모델명 <span style="font-weight:400;color:#9ca3af">(편집 가능)</span></div>' +
            '<input type="text" class="control" data-model></div>' +
          '<div class="note warn">이 앱은 서버가 없습니다. 키는 <b>이 브라우저에만</b> 저장됩니다. ' +
            '공용 PC(교무실 공용 등)에서는 쓰고 나서 아래 <b>[키 지우기]</b> 를 누르세요. ' +
            '학생에게 배부하는 인쇄물·파일에는 키가 들어가지 않습니다.</div>' +
          '<div class="note" data-corsnote style="display:none"></div>' +
          '<button class="btn ghost sm" data-test>🔌 연결 테스트</button>' +
          '<div class="test-result" data-testout></div>' +
        '</div>' +
        '<div class="mf">' +
          '<button class="btn ghost" data-clear>키 지우기</button>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn ghost" data-x2>닫기</button>' +
            '<button class="btn primary" data-save>저장</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(backEl);

    var provs = backEl.querySelector("[data-provs]");
    Object.keys(PROVIDERS).forEach(function (p) {
      var l = document.createElement("label");
      l.className = "prov"; l.dataset.p = p;
      l.innerHTML = '<input type="radio" name="ld-prov" value="' + p + '"><span>' + PROVIDERS[p].label + '</span>';
      provs.appendChild(l);
    });

    var $ = function (s) { return backEl.querySelector(s); };
    var keyIn = $("[data-key]"), modelIn = $("[data-model]"),
        keyhint = $("[data-keyhint]"), corsnote = $("[data-corsnote]"),
        testOut = $("[data-testout]");
    var draft = load();

    function paint() {
      backEl.querySelectorAll(".prov").forEach(function (el) {
        var on = el.dataset.p === draft.provider;
        el.classList.toggle("sel", on);
        el.querySelector("input").checked = on;
      });
      keyIn.value = draft.keys[draft.provider] || "";
      modelIn.value = draft.models[draft.provider] || PROVIDERS[draft.provider].model;
      keyhint.textContent = PROVIDERS[draft.provider].keyHint;
      var upstage = draft.provider === "upstage";
      corsnote.style.display = upstage ? "block" : "none";
      corsnote.textContent = upstage
        ? "Upstage 는 브라우저 직접 호출이 막힐 수 있습니다. 막히면 로컬 서버(로컬서버_실행.bat)로 열어 쓰세요."
        : "";
      testOut.className = "test-result";
      testOut.textContent = "";
    }
    paint();

    provs.addEventListener("change", function (e) {
      draft.provider = e.target.value; paint();
    });
    keyIn.addEventListener("input", function () { draft.keys[draft.provider] = keyIn.value; });
    modelIn.addEventListener("input", function () { draft.models[draft.provider] = modelIn.value; });

    $("[data-test]").addEventListener("click", async function () {
      var btn = this;
      testOut.className = "test-result run";
      testOut.innerHTML = '<span class="spinner"></span> 확인 중…';
      btn.disabled = true;
      var t0 = Date.now();
      try {
        var r = await rawCall(draft.provider,
          (draft.keys[draft.provider] || "").trim(),
          (draft.models[draft.provider] || PROVIDERS[draft.provider].model).trim(),
          "", "핑. '퐁' 이라고만 답해.");
        testOut.className = "test-result ok";
        testOut.textContent = "연결 성공 (" + (Date.now() - t0) + "ms) · 응답: " + short(r).slice(0, 60);
      } catch (err) {
        testOut.className = "test-result err";
        testOut.textContent = "실패 — " + err.message;
      } finally { btn.disabled = false; }
    });

    $("[data-save]").addEventListener("click", function () {
      draft.keys[draft.provider] = (keyIn.value || "").trim();
      draft.models[draft.provider] = (modelIn.value || "").trim();
      save(draft);
      close();
      emitChange();
    });
    $("[data-clear]").addEventListener("click", function () {
      if (!confirm("이 브라우저에 저장된 모든 제공자의 API 키·모델 설정을 지웁니다. 계속할까요?")) return;
      clearAll();
      draft = load();
      paint();
      emitChange();
    });
    $("[data-x]").addEventListener("click", close);
    $("[data-x2]").addEventListener("click", close);
    backEl.addEventListener("click", function (e) { if (e.target === backEl) close(); });

    backEl._reset = function () { draft = load(); paint(); };
    return backEl;
  }
  function open() { buildModal(); backEl._reset(); backEl.classList.add("open"); }
  function close() { if (backEl) backEl.classList.remove("open"); }

  var changeListeners = [];
  function onChange(fn) { changeListeners.push(fn); }
  function emitChange() { changeListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  global.AI = {
    open: open, ready: ready, state: state, call: call,
    PROMPT: PROMPT, PROVIDERS: PROVIDERS, onChange: onChange
  };
})(window);
