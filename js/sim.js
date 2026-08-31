/* =========================================================
   sim.js — 5단계 「학습 도움 자료 제작하기」
   차시 과정안 -> 수업용 시뮬레이터 HTML 파일 하나
   ---------------------------------------------------------
   🔴 설계 원칙 (2026-08-29 사용자 결정 : "유형 고르기 + AI가 내용 채움")

     AI 는 HTML·DOM 코드를 쓰지 않는다.
     화면·손잡이·그래프·채점은 **여기 있는 검증된 뼈대**가 만들고,
     AI 는 「무엇을 조절하고 무엇이 바뀌는가」 라는 **설정값 + 순수 계산식**만 준다.

     그래서 : 주제는 자유로우면서 화면이 깨지지 않는다.
     자유 생성(AI 가 HTML 전체)을 하면 «움직이는 그림» 이나 «하얀 화면» 이 나온다.

   유형 4종
     tradeoff  값을 바꾸면 지표 두 개가 서로 반대로 움직인다  (맞바꿈)
     steps     한 단계씩 진행하며 상태가 어떻게 변하는지 본다   (과정)
     compare   같은 입력을 두 방식에 넣고 나란히 본다          (비교)
     classify  학습 데이터를 넣고 빼면 판정이 바뀐다            (데이터와 편향)

   ⚠ classify 는 AI 에게 계산식을 받지 않는다 — 분류기를 이 파일이 갖고 있다.
     AI 는 «데이터 카드» 만 준다. 가장 안전한 유형이다.

   만들어지는 파일
     자체 완결 HTML 1개 · 외부 CDN 0 · 더블클릭 실행 · 성취기준 없음(루트 규칙)
     requestAnimationFrame 을 쓰지 않는다 — 상태가 바뀔 때마다 곧바로 그린다.
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     유형 정의
     --------------------------------------------------------- */
  var TYPES = {
    tradeoff: {
      name: "값 바꿔 맞바꿈 보기",
      icon: "⚖️",
      desc: "손잡이를 돌리면 지표 두 개가 서로 반대로 움직입니다. \"하나를 얻으면 하나를 잃는다\"를 눈으로 보게 합니다.",
      good: "표본화 간격↔음질 · 해상도↔용량 · 기준값↔헛경보 · 압축률↔화질",
      keys: ["용량", "크기", "해상도", "표본", "압축", "화질", "음질", "비트", "기준",
             "정확", "속도", "효율", "선택", "판단", "설계", "구성요소", "디지털 표현"]
    },
    steps: {
      name: "한 단계씩 실행",
      icon: "▶️",
      desc: "[다음 ▶] 을 누를 때마다 한 칸씩 진행하며 상태가 어떻게 변하는지 보여 줍니다.",
      good: "진수 변환 · 정렬 · 순서도 실행 · 추상화 단계 · 문제 해결 절차",
      keys: ["변환", "과정", "절차", "순서", "단계", "알고리즘", "추상화", "구조화",
             "표현", "설계", "디버", "함수", "실행", "프로그램", "정의"]
    },
    compare: {
      name: "나란히 비교 (A vs B)",
      icon: "⚔️",
      desc: "같은 입력을 두 방식에 동시에 넣어 좌우로 나란히 보여 줍니다.",
      good: "알고리즘 A/B 속도 · 아날로그/디지털 · 압축 전후 · 두 전략 비교",
      keys: ["비교", "분석", "차이", "장단점", "효과", "전략", "방법", "선택", "판단",
             "탐색", "평가"]
    },
    classify: {
      name: "분류·학습 실험",
      icon: "🧠",
      desc: "학습 데이터 카드를 넣고 빼면 인공지능의 판정과 정확도가 바뀝니다. 데이터가 결과를 정한다는 것을 겪게 합니다.",
      good: "이미지·소리 분류 · 학습 데이터 편향 · 인공지능 윤리",
      keys: ["인공지능", "학습", "데이터", "분류", "수집", "편향", "윤리", "모델",
             "시스템", "구별", "판단"]
    }
  };
  var TYPE_ORDER = ["tradeoff", "steps", "compare", "classify"];

  /* 학습목표·성취기준의 낱말로 유형을 추천한다 (AI 를 부르지 않는다) */
  function recommend(plan) {
    var text = String((plan && plan.objective) || "") + " " + String((plan && plan.standard) || "");
    var best = "tradeoff", bestScore = -1;
    TYPE_ORDER.forEach(function (k) {
      var s = 0;
      TYPES[k].keys.forEach(function (w) { if (text.indexOf(w) >= 0) s++; });
      if (k === "classify" && /인공지능|학습 데이터|편향/.test(text)) s += 3;
      if (s > bestScore) { bestScore = s; best = k; }
    });
    return best;
  }

  /* ---------------------------------------------------------
     프롬프트 — AI 는 «설정 + 순수 계산식» 만 만든다
     --------------------------------------------------------- */
  var COMMON_RULES =
    "\n공통 규칙\n" +
    "- 반드시 JSON 하나로만 답한다. 코드펜스(```)·설명 문장 금지.\n" +
    "- 화면을 그리는 코드(HTML/CSS/DOM)를 쓰지 마라. 그 일은 프로그램이 한다.\n" +
    "- 모든 글은 중학생이 읽을 한국어로. 성취기준 코드·문장을 넣지 마라.\n" +
    "- title 은 20자 이내. howto 는 «이렇게 해 보세요» 형태의 한두 문장.\n" +
    "- insight 는 학생이 조작해 본 뒤 깨달아야 할 결론 한 문장.\n" +
    "- quiz 는 2~3개. 시뮬레이터를 만져 봐야 답할 수 있는 것으로.\n" +
    "  각 원소 {\"q\":\"...\",\"opts\":[\"...\",\"...\",\"...\"],\"a\":정답번호(1부터),\"why\":\"이유\"}\n" +
    "  선택지에 굵게·별표·\"(정답)\" 같은 힌트를 절대 넣지 마라. 정답 번호를 섞어라.\n" +
    "- teacherNote 는 교사가 읽을 진행 안내 2~4문장. 학생도 펼쳐 볼 수 있으니 정답을 적지 마라.\n";

  var COMPUTE_RULES =
    "\ncompute 규칙 (매우 중요)\n" +
    "- 자바스크립트 **함수 본문**만 문자열로 준다. function 선언·화살표·중괄호 감싸기 없이 본문만.\n" +
    "- 순수 계산만 한다. document·window·fetch·eval·import·setTimeout 등을 절대 쓰지 마라.\n" +
    "- Math 는 써도 된다. 어떤 입력에서도 NaN·Infinity 가 나오면 안 된다(0으로 나누기 주의).\n" +
    "- 숫자는 중학생이 읽을 크기로 (너무 크면 단위를 KB·초 등으로 바꿔서).\n";

  var PROMPT = {
    tradeoff: {
      system:
        "당신은 중학교 「정보」 수업용 시뮬레이터를 설계하는 교사다.\n" +
        "학생이 손잡이를 돌리면 **지표 두 개가 서로 반대 방향으로** 움직이는 «맞바꿈» 시뮬레이터를 만든다.\n" +
        "아래 JSON 하나로만 답한다:\n" +
        '{"title":"","objective":"","howto":"","insight":"",\n' +
        ' "controls":[{"key":"a","name":"","min":0,"max":0,"step":0,"value":0,"unit":""}],\n' +
        ' "metrics":[{"key":"m1","name":"","unit":"","better":"low"},{"key":"m2","name":"","unit":"","better":"high"}],\n' +
        ' "compute":"return [ 식1, 식2 ];",\n' +
        ' "presets":[{"name":"","values":[0]}],\n' +
        ' "quiz":[],"teacherNote":""}\n' +
        "- controls 는 1~3개. key 는 a,b,c. 정수 눈금이면 step 을 1로.\n" +
        "- metrics 는 **정확히 2개**. better 는 값이 작을수록 좋으면 \"low\", 클수록 좋으면 \"high\".\n" +
        "- compute 의 인자 이름은 controls 의 key 와 같다(a,b,c). metrics 순서대로 숫자 2개를 배열로 반환한다.\n" +
        "- 🔴 첫 번째 control 을 min 에서 max 로 옮길 때 **두 지표가 반드시 반대로** 움직여야 한다.\n" +
        "  (한쪽이 늘면 다른 쪽이 줄어야 한다. 그것이 이 시뮬레이터의 존재 이유다)\n" +
        "- presets 는 2~3개. values 는 controls 순서대로의 값.\n" +
        COMPUTE_RULES + COMMON_RULES
    },
    steps: {
      system:
        "당신은 중학교 「정보」 수업용 시뮬레이터를 설계하는 교사다.\n" +
        "어떤 과정을 **한 단계씩** 진행하며 상태가 어떻게 변하는지 보여 주는 시뮬레이터를 만든다.\n" +
        "아래 JSON 하나로만 답한다:\n" +
        '{"title":"","objective":"","howto":"","insight":"",\n' +
        ' "input":{"name":"","kind":"number","value":0,"min":0,"max":0,"placeholder":""},\n' +
        ' "compute":"return [ {\\"label\\":\\"\\",\\"state\\":\\"\\",\\"note\\":\\"\\"} ];",\n' +
        ' "examples":[0],\n' +
        ' "quiz":[],"teacherNote":""}\n' +
        "- input.kind 는 \"number\" 또는 \"text\". number 면 min·max 를 준다.\n" +
        "- compute 의 인자 이름은 x 하나다. 단계 객체의 **배열**을 반환한다(3~12단계).\n" +
        "  label = 이 단계에서 하는 일(짧게), state = 지금 상태(숫자·문자열·짧은 표),\n" +
        "  note  = 왜 그렇게 되는지 한 줄 설명.\n" +
        "- 마지막 단계의 state 가 최종 결과여야 한다.\n" +
        "- examples 는 학생이 눌러 볼 예시 입력 2~4개.\n" +
        COMPUTE_RULES + COMMON_RULES
    },
    compare: {
      system:
        "당신은 중학교 「정보」 수업용 시뮬레이터를 설계하는 교사다.\n" +
        "같은 입력을 **두 가지 방식**에 넣어 결과를 나란히 비교하는 시뮬레이터를 만든다.\n" +
        "아래 JSON 하나로만 답한다:\n" +
        '{"title":"","objective":"","howto":"","insight":"",\n' +
        ' "input":{"name":"","min":0,"max":0,"step":1,"value":0,"unit":""},\n' +
        ' "sides":[{"name":"","desc":""},{"name":"","desc":""}],\n' +
        ' "metricName":"","metricUnit":"","better":"low",\n' +
        ' "compute":"return [ 식A, 식B ];",\n' +
        ' "quiz":[],"teacherNote":""}\n' +
        "- sides 는 **정확히 2개**. name 은 방법 이름, desc 는 한 줄 설명.\n" +
        "- compute 의 인자 이름은 x 하나다. 두 방식의 결과 숫자를 [A, B] 로 반환한다.\n" +
        "- 🔴 입력을 min 에서 max 로 옮길 때 **두 값의 우열이 뒤집히거나 격차가 크게 벌어져야** 한다.\n" +
        "  (어디서나 A 가 이기면 비교할 것이 없다)\n" +
        "- better 는 값이 작을수록 좋으면 \"low\", 클수록 좋으면 \"high\".\n" +
        COMPUTE_RULES + COMMON_RULES
    },
    classify: {
      system:
        "당신은 중학교 「정보」 수업용 시뮬레이터를 설계하는 교사다.\n" +
        "**학습 데이터를 넣고 빼면 인공지능의 판정이 바뀌는** 시뮬레이터를 만든다.\n" +
        "계산식은 주지 않는다 — 분류는 프로그램이 한다. 당신은 **데이터**만 만든다.\n" +
        "아래 JSON 하나로만 답한다:\n" +
        '{"title":"","objective":"","howto":"","insight":"",\n' +
        ' "featureNames":["특징1","특징2"],\n' +
        ' "labels":["종류A","종류B"],\n' +
        ' "samples":[{"name":"","label":"종류A","features":[0,0]}],\n' +
        ' "tests":[{"name":"","label":"종류A","features":[0,0]}],\n' +
        ' "quiz":[],"teacherNote":""}\n' +
        "- featureNames 는 **정확히 2개**. 0~10 척도로 잴 수 있는 특징으로 (예: \"귀의 뾰족함\", \"소리의 높낮이\").\n" +
        "- labels 는 **정확히 2개**.\n" +
        "- samples 는 학습 데이터 카드 8~12개. 두 label 이 **골고루** 들어가야 한다.\n" +
        "- tests 는 시험 문제 4~6개. label 은 정답이다.\n" +
        "- features 값은 0 이상 10 이하의 숫자 2개.\n" +
        "- 🔴 한쪽 label 의 카드를 모두 빼면 판정이 무너지도록 값을 정해라. 그것이 «편향» 수업의 핵심이다.\n" +
        "- 실생활에서 학생이 아는 소재로 (동물·악기·과일·날씨 등).\n" +
        COMMON_RULES
    }
  };

  function userPrompt(type, plan) {
    return "이 차시의 시뮬레이터를 만들어 주세요.\n\n" +
      "학습 목표 : " + (plan.objective || "") + "\n" +
      "성취기준(참고 · 화면에 넣지 말 것) : " + (plan.standard || "") + "\n" +
      "수업 전개 내용 :\n" + (plan.dev || "").slice(0, 900) + "\n\n" +
      "학생 : 중학교 1~3학년. 45분 수업 중 10~15분 사용.\n" +
      "유형 : " + TYPES[type].name + " — " + TYPES[type].desc;
  }

  /* ---------------------------------------------------------
     검사 — 만들자마자 실제로 돌려 본다
     --------------------------------------------------------- */
  var BAN = /\b(document|window|globalThis|fetch|XMLHttpRequest|eval|Function|import|require|setTimeout|setInterval|localStorage|sessionStorage|navigator|location|alert|process|constructor)\b/;

  function num(v) { return typeof v === "number" && isFinite(v); }

  function makeFn(argNames, body) {
    if (typeof body !== "string" || !body.trim()) throw new Error("compute 가 비어 있습니다.");
    if (BAN.test(body)) throw new Error("compute 에 쓸 수 없는 낱말이 있습니다 (순수 계산만 허용).");
    if (body.length > 4000) throw new Error("compute 가 너무 깁니다.");
    return Function.apply(null, argNames.concat([body]));
  }

  function sampleRange(c, n) {
    var out = [], i;
    var min = Number(c.min), max = Number(c.max);
    if (!num(min) || !num(max) || max <= min) throw new Error("손잡이 '" + c.name + "' 의 min/max 가 이상합니다.");
    for (i = 0; i < n; i++) out.push(min + (max - min) * i / (n - 1));
    return out;
  }

  /* 두 수열이 반대로 움직이는가 (피어슨 상관계수) */
  function corr(a, b) {
    var n = a.length, i, ma = 0, mb = 0;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var sa = 0, sb = 0, sab = 0;
    for (i = 0; i < n; i++) {
      var da = a[i] - ma, db = b[i] - mb;
      sa += da * da; sb += db * db; sab += da * db;
    }
    if (sa === 0 || sb === 0) return 0;
    return sab / Math.sqrt(sa * sb);
  }

  function validate(type, spec) {
    var errors = [], warns = [], trials = 0;
    function need(cond, msg) { if (!cond) errors.push(msg); return cond; }

    if (!spec || typeof spec !== "object") return { ok: false, errors: ["결과가 JSON 이 아닙니다."], warns: [], trials: 0 };
    need(spec.title && String(spec.title).trim(), "title 이 없습니다.");
    need(spec.insight && String(spec.insight).trim(), "insight(결론)가 없습니다.");
    if (spec.quiz && !Array.isArray(spec.quiz)) errors.push("quiz 가 배열이 아닙니다.");
    (spec.quiz || []).forEach(function (q, i) {
      if (!q.q) errors.push("quiz " + (i + 1) + " 에 문두가 없습니다.");
      if (!Array.isArray(q.opts) || q.opts.length < 2) errors.push("quiz " + (i + 1) + " 의 선택지가 모자랍니다.");
      if (!num(Number(q.a)) || Number(q.a) < 1 || Number(q.a) > (q.opts || []).length)
        errors.push("quiz " + (i + 1) + " 의 정답 번호가 범위를 벗어났습니다.");
      (q.opts || []).forEach(function (o) {
        if (/<b>|\*\*|★|✓|✔|\(정답\)/.test(String(o))) errors.push("quiz " + (i + 1) + " 선택지에 정답 힌트가 들어 있습니다.");
      });
    });

    try {
      if (type === "tradeoff") {
        need(Array.isArray(spec.controls) && spec.controls.length >= 1 && spec.controls.length <= 3,
             "controls 는 1~3개여야 합니다.");
        need(Array.isArray(spec.metrics) && spec.metrics.length === 2, "metrics 는 정확히 2개여야 합니다.");
        if (errors.length) return { ok: false, errors: errors, warns: warns, trials: 0 };

        var keys = spec.controls.map(function (c, i) { return c.key || String.fromCharCode(97 + i); });
        spec.controls.forEach(function (c, i) { c.key = keys[i]; });
        var f = makeFn(keys, spec.compute);

        // 격자 시험 : 첫 손잡이 25점 x 나머지 3점
        var grid0 = sampleRange(spec.controls[0], 25);
        var rest = spec.controls.slice(1).map(function (c) { return sampleRange(c, 3); });
        var seqA = [], seqB = [];
        function walk(idx, args) {
          if (idx >= rest.length) {
            grid0.forEach(function (v0) {
              var r = f.apply(null, [v0].concat(args));
              trials++;
              if (!Array.isArray(r) || r.length !== 2) throw new Error("compute 가 숫자 2개 배열을 돌려주지 않았습니다.");
              if (!num(r[0]) || !num(r[1])) throw new Error("compute 결과에 NaN·무한대가 있습니다 (입력 " + v0.toFixed(2) + ").");
              if (idx === rest.length && args.every(function (a, i) { return a === rest[i][1]; }) || rest.length === 0) {
                seqA.push(r[0]); seqB.push(r[1]);
              }
            });
            return;
          }
          rest[idx].forEach(function (v) { walk(idx + 1, args.concat([v])); });
        }
        walk(0, []);
        if (seqA.length < 5) {   // 가운데 조합을 못 모았으면 다시 한 줄만
          seqA = []; seqB = [];
          var mid = spec.controls.slice(1).map(function (c) { return (Number(c.min) + Number(c.max)) / 2; });
          grid0.forEach(function (v0) {
            var r = f.apply(null, [v0].concat(mid));
            seqA.push(r[0]); seqB.push(r[1]);
          });
        }
        /* 🔴 «반대로 움직이는가» 는 값이 아니라 **좋아지는 방향**으로 본다.
           파일 크기는 작을수록 좋고 음질은 클수록 좋으므로, 둘 다 줄어드는 것이
           곧 «하나를 얻고 하나를 잃는» 맞바꿈이다. 값만 보면 이것을 놓친다. */
        var dir0 = (spec.metrics[0].better === "low") ? -1 : 1;
        var dir1 = (spec.metrics[1].better === "low") ? -1 : 1;
        var c = corr(seqA, seqB) * dir0 * dir1;
        if (c > -0.2) {
          warns.push("첫 손잡이를 움직여도 두 지표가 **함께 좋아지거나 함께 나빠집니다** (반대 정도 " +
                     c.toFixed(2) + "). «하나를 얻으면 하나를 잃는다» 가 보이지 않으니 다시 만드는 것을 권합니다.");
        }
        spec._corr = c;

      } else if (type === "steps") {
        need(spec.input && spec.input.name, "input 이 없습니다.");
        if (errors.length) return { ok: false, errors: errors, warns: warns, trials: 0 };
        var fs = makeFn(["x"], spec.compute);
        var kind = spec.input.kind === "text" ? "text" : "number";
        var tries = kind === "text"
          ? [spec.input.value || "가", "정보", "A"]
          : sampleRange({ name: spec.input.name, min: spec.input.min, max: spec.input.max }, 12);
        tries.forEach(function (v) {
          var steps = fs(kind === "number" ? Math.round(v) : v);
          trials++;
          if (!Array.isArray(steps) || !steps.length) throw new Error("compute 가 단계 배열을 돌려주지 않았습니다 (입력 " + v + ").");
          if (steps.length > 40) throw new Error("단계가 너무 많습니다 (" + steps.length + "단계).");
          steps.forEach(function (s, i) {
            if (!s || typeof s !== "object") throw new Error((i + 1) + "번째 단계가 객체가 아닙니다.");
            if (!s.label && !s.state) throw new Error((i + 1) + "번째 단계에 label·state 가 모두 없습니다.");
          });
        });

      } else if (type === "compare") {
        need(Array.isArray(spec.sides) && spec.sides.length === 2, "sides 는 정확히 2개여야 합니다.");
        need(spec.input && num(Number(spec.input.min)) && num(Number(spec.input.max)), "input 의 min/max 가 없습니다.");
        if (errors.length) return { ok: false, errors: errors, warns: warns, trials: 0 };
        var fc = makeFn(["x"], spec.compute);
        var xs = sampleRange(spec.input, 30), A = [], B = [];
        xs.forEach(function (x) {
          var r = fc(x);
          trials++;
          if (!Array.isArray(r) || r.length !== 2) throw new Error("compute 가 숫자 2개 배열을 돌려주지 않았습니다.");
          if (!num(r[0]) || !num(r[1])) throw new Error("compute 결과에 NaN·무한대가 있습니다 (입력 " + x.toFixed(2) + ").");
          A.push(r[0]); B.push(r[1]);
        });
        var gap0 = Math.abs(A[0] - B[0]), gap1 = Math.abs(A[A.length - 1] - B[B.length - 1]);
        var flip = (A[0] - B[0]) * (A[A.length - 1] - B[B.length - 1]) < 0;
        if (!flip && gap1 < gap0 * 1.5 && gap1 < 1e-9 + Math.max.apply(null, A.concat(B)) * 0.05) {
          warns.push("입력을 끝까지 옮겨도 두 방식의 차이가 거의 없습니다. 비교할 것이 잘 안 보입니다.");
        }

      } else if (type === "classify") {
        need(Array.isArray(spec.featureNames) && spec.featureNames.length === 2, "featureNames 는 2개여야 합니다.");
        need(Array.isArray(spec.labels) && spec.labels.length === 2, "labels 는 2개여야 합니다.");
        need(Array.isArray(spec.samples) && spec.samples.length >= 6, "samples 가 6개 이상이어야 합니다.");
        need(Array.isArray(spec.tests) && spec.tests.length >= 3, "tests 가 3개 이상이어야 합니다.");
        if (errors.length) return { ok: false, errors: errors, warns: warns, trials: 0 };
        var L = spec.labels;
        function okRow(r, where) {
          if (!r.name) errors.push(where + " 에 이름이 없습니다.");
          if (L.indexOf(r.label) < 0) errors.push(where + " 의 label '" + r.label + "' 이 labels 에 없습니다.");
          if (!Array.isArray(r.features) || r.features.length !== 2 || !num(Number(r.features[0])) || !num(Number(r.features[1])))
            errors.push(where + " 의 features 가 숫자 2개가 아닙니다.");
          trials++;
        }
        spec.samples.forEach(function (s, i) { okRow(s, "samples " + (i + 1)); });
        spec.tests.forEach(function (t, i) { okRow(t, "tests " + (i + 1)); });
        var cnt = {};
        spec.samples.forEach(function (s) { cnt[s.label] = (cnt[s.label] || 0) + 1; });
        L.forEach(function (l) { if (!cnt[l]) errors.push("'" + l + "' 학습 카드가 하나도 없습니다."); });
        // 전부 켠 상태에서 정확도가 충분한가
        if (!errors.length) {
          var acc = classifyAll(spec, spec.samples.map(function () { return true; }));
          if (acc.rate < 0.75) warns.push("모든 카드를 켠 상태의 정확도가 " + Math.round(acc.rate * 100) + "% 뿐입니다. 데이터를 다시 만드는 것이 좋습니다.");
        }
      } else {
        errors.push("알 수 없는 유형: " + type);
      }
    } catch (e) {
      errors.push(e.message || String(e));
    }

    return { ok: errors.length === 0, errors: errors, warns: warns, trials: trials };
  }

  /* classify 전용 분류기 — 가장 가까운 무게중심 (뼈대가 갖는다) */
  function classifyAll(spec, onFlags) {
    var L = spec.labels, sums = {}, cnts = {};
    L.forEach(function (l) { sums[l] = [0, 0]; cnts[l] = 0; });
    spec.samples.forEach(function (s, i) {
      if (!onFlags[i]) return;
      sums[s.label][0] += Number(s.features[0]);
      sums[s.label][1] += Number(s.features[1]);
      cnts[s.label]++;
    });
    var cent = {}, known = [];
    L.forEach(function (l) {
      if (cnts[l]) { cent[l] = [sums[l][0] / cnts[l], sums[l][1] / cnts[l]]; known.push(l); }
    });
    var results = spec.tests.map(function (t) {
      if (!known.length) return { name: t.name, want: t.label, got: null, ok: false };
      var best = null, bd = Infinity;
      known.forEach(function (l) {
        var dx = Number(t.features[0]) - cent[l][0], dy = Number(t.features[1]) - cent[l][1];
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = l; }
      });
      return { name: t.name, want: t.label, got: best, ok: best === t.label };
    });
    var right = results.filter(function (r) { return r.ok; }).length;
    return { results: results, rate: results.length ? right / results.length : 0, counts: cnts, centroids: cent };
  }

  /* ---------------------------------------------------------
     내려받을 HTML 만들기
     --------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function safeJSON(o) {
    return JSON.stringify(o).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
  }

  var CSS = [
    '*{box-sizing:border-box}',
    'body{margin:0;background:#eef2f7;color:#1f2937;font-size:17px;line-height:1.65;',
    '  font-family:"Pretendard Variable",Pretendard,-apple-system,"Malgun Gothic","맑은 고딕",sans-serif}',
    '.wrap{max-width:1000px;margin:0 auto;padding:22px 18px 70px}',
    'header.top{background:#1e3a5f;color:#fff;padding:20px 18px}',
    'header.top .in{max-width:1000px;margin:0 auto}',
    'header.top h1{margin:0;font-size:27px;font-weight:800;letter-spacing:-.5px}',
    'header.top .obj{margin-top:8px;font-size:16px;color:#cfe0f5}',
    '.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin:16px 0;',
    '  box-shadow:0 1px 3px rgba(0,0,0,.05)}',
    '.howto{background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:12px;',
    '  padding:14px 16px;margin:16px 0;font-size:16px}',
    '.howto b{color:#78350f}',
    'h2.sec{font-size:19px;font-weight:800;margin:0 0 14px;color:#1e3a5f}',
    /* 손잡이 */
    '.ctl{margin:0 0 18px}',
    '.ctl .lab{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;margin-bottom:6px}',
    '.ctl .val{font-size:22px;color:#2563eb;font-weight:800}',
    'input[type=range]{width:100%;height:34px;accent-color:#2563eb;cursor:pointer}',
    'input[type=number],input[type=text]{width:100%;padding:12px 14px;font-size:18px;border:1px solid #d1d5db;',
    '  border-radius:10px;font-family:inherit}',
    /* 지표 */
    '.metrics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:6px 0 18px}',
    '.metric{border-radius:12px;padding:16px;text-align:center;border:2px solid}',
    '.metric.m0{background:#eff6ff;border-color:#bfdbfe}',
    '.metric.m1{background:#fef2f2;border-color:#fecaca}',
    '.metric .n{font-size:14px;font-weight:700;color:#4b5563}',
    '.metric .v{font-size:34px;font-weight:800;margin:4px 0;letter-spacing:-1px}',
    '.metric.m0 .v{color:#1d4ed8}.metric.m1 .v{color:#b91c1c}',
    '.metric .u{font-size:14px;color:#6b7280}',
    '.metric .gd{font-size:12px;font-weight:700;color:#6b7280;margin-top:3px}',
    '.metric .bar{height:10px;background:#fff;border-radius:6px;overflow:hidden;margin-top:10px;border:1px solid #e5e7eb}',
    '.metric .bar i{display:block;height:100%}',
    '.metric.m0 .bar i{background:#3b82f6}.metric.m1 .bar i{background:#ef4444}',
    'canvas{width:100%;height:230px;display:block;background:#fff;border:1px solid #e5e7eb;border-radius:10px}',
    '.legend{display:flex;gap:18px;justify-content:center;margin-top:10px;font-size:14px;font-weight:700}',
    '.legend i{display:inline-block;width:16px;height:4px;border-radius:2px;margin-right:6px;vertical-align:middle}',
    /* 단추 */
    '.btn{padding:12px 20px;border:0;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;',
    '  font-family:inherit;min-height:48px}',
    '.btn.p{background:#2563eb;color:#fff}.btn.p:hover{background:#1d4ed8}',
    '.btn.g{background:#e5e7eb;color:#374151}.btn.g:hover{background:#d1d5db}',
    '.btn:disabled{opacity:.4;cursor:not-allowed}',
    '.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.chip{padding:9px 15px;border:1px solid #cbd5e1;background:#fff;border-radius:999px;font-size:15px;',
    '  font-weight:700;cursor:pointer;font-family:inherit;min-height:44px}',
    '.chip:hover{background:#f1f5f9}',
    /* 단계 */
    '.steps{display:flex;flex-direction:column;gap:8px;margin-top:14px}',
    '.step{display:flex;gap:12px;padding:12px 14px;border-radius:10px;border:1px solid #e5e7eb;background:#fafafa;opacity:.45}',
    '.step.done{opacity:1;background:#fff}',
    '.step.cur{opacity:1;background:#eff6ff;border-color:#93c5fd;box-shadow:0 0 0 3px rgba(59,130,246,.13)}',
    '.step .no{flex:none;width:30px;height:30px;border-radius:50%;background:#1e3a5f;color:#fff;font-weight:800;',
    '  display:flex;align-items:center;justify-content:center;font-size:14px}',
    '.step.cur .no{background:#2563eb}',
    '.step .lb{font-weight:700}',
    '.step .st{font-family:Consolas,monospace;font-size:17px;color:#0f172a;background:#f1f5f9;',
    '  padding:3px 8px;border-radius:6px;display:inline-block;margin-top:4px;word-break:break-all}',
    '.step .nt{font-size:14px;color:#6b7280;margin-top:4px}',
    '.prog{height:8px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin:14px 0}',
    '.prog i{display:block;height:100%;background:#2563eb}',
    /* 비교 */
    '.sides{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0}',
    '.side{border:2px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center;background:#fff}',
    '.side.win{border-color:#22c55e;background:#f0fdf4}',
    '.side h3{margin:0;font-size:17px;font-weight:800}',
    '.side .d{font-size:13px;color:#6b7280;margin:4px 0 10px;min-height:34px}',
    '.side .v{font-size:36px;font-weight:800;letter-spacing:-1px;color:#1e3a5f}',
    '.side .u{font-size:14px;color:#6b7280}',
    '.side .tag{display:inline-block;margin-top:10px;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:800;background:#dcfce7;color:#166534}',
    /* 분류 */
    '.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:12px 0}',
    '.dcard{border:2px solid #e5e7eb;border-radius:10px;padding:11px;cursor:pointer;background:#fff;text-align:left;font-family:inherit}',
    '.dcard.on{border-color:#2563eb;background:#eff6ff}',
    '.dcard.off{opacity:.4;background:#f9fafb}',
    '.dcard .nm{font-weight:700;font-size:15px}',
    '.dcard .lb{font-size:12px;color:#6b7280;margin-top:2px}',
    '.dcard .ft{font-size:12px;color:#9ca3af;font-family:Consolas,monospace;margin-top:3px}',
    '.tests{display:flex;flex-direction:column;gap:8px}',
    '.trow{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;border:1px solid #e5e7eb;background:#fff}',
    '.trow.ok{background:#f0fdf4;border-color:#86efac}',
    '.trow.no{background:#fef2f2;border-color:#fca5a5}',
    '.trow .mark{font-size:20px;flex:none}',
    '.trow .nm{font-weight:700;flex:1}',
    '.trow .pd{font-size:14px;color:#4b5563}',
    '.acc{text-align:center;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;margin:14px 0}',
    '.acc .big{font-size:40px;font-weight:800;color:#1e3a5f;letter-spacing:-1px}',
    '.warn{background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;border-radius:10px;padding:12px 14px;margin-top:12px;font-size:15px;font-weight:600}',
    /* 결론·문제 */
    '.insight{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:18px;margin:18px 0;font-size:18px;font-weight:700;color:#065f46}',
    '.insight .t{font-size:13px;font-weight:800;color:#047857;margin-bottom:6px}',
    '.q{border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px}',
    '.q:first-child{border-top:0;padding-top:0;margin-top:0}',
    '.q .qt{font-weight:700;margin-bottom:10px}',
    '.q .opt{display:block;width:100%;text-align:left;padding:12px 15px;margin-bottom:7px;border:1px solid #d1d5db;',
    '  background:#fff;border-radius:9px;cursor:pointer;font-size:16px;font-family:inherit;min-height:48px}',
    '.q .opt:hover{background:#f8fafc}',
    '.q .opt.right{background:#dcfce7;border-color:#22c55e;font-weight:700}',
    '.q .opt.wrong{background:#fee2e2;border-color:#ef4444}',
    '.q .why{margin-top:8px;padding:11px 14px;background:#f1f5f9;border-radius:9px;font-size:15px;color:#334155;display:none}',
    '.q .why.show{display:block}',
    'details.tn{margin-top:22px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc}',
    'details.tn summary{cursor:pointer;padding:13px 16px;font-weight:700;color:#475569;font-size:15px}',
    'details.tn .in{padding:0 16px 16px;color:#475569;font-size:15px;white-space:pre-wrap}',
    'footer{text-align:center;color:#9ca3af;font-size:13px;margin-top:34px}',
    '@media (max-width:700px){.metrics,.sides{grid-template-columns:1fr}body{font-size:16px}',
    '  header.top h1{font-size:22px}.metric .v{font-size:28px}}'
  ].join("");

  /* 만들어진 파일 안에서 도는 코드 (문자열) */
  var RUNTIME = [
    '(function(){',
    '"use strict";',
    'var S=window.SPEC, T=S.type;',
    'function $(s){return document.querySelector(s);}',
    'function el(t,c,h){var n=document.createElement(t);if(c)n.className=c;if(h!=null)n.innerHTML=h;return n;}',
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}',
    'function fmt(v){if(typeof v!=="number")return String(v);',
    '  var a=Math.abs(v);if(a>=1000)return v.toFixed(0);if(a>=100)return v.toFixed(1);',
    '  if(a>=1)return v.toFixed(2).replace(/\\.?0+$/,"");return v.toFixed(3).replace(/\\.?0+$/,"");}',
    'var host=$("#sim");',
    'var F=null;',
    'try{ if(S.compute){ F=Function.apply(null,(S.argNames||["x"]).concat([S.compute])); } }',
    'catch(e){ host.innerHTML="<div class=\'warn\'>계산식을 읽을 수 없습니다: "+esc(e.message)+"</div>"; }',
    '',
    /* ---- 그래프 ---- */
    'function chart(cv,xs,series,curX,xlab){',
    '  var d=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;',
    '  cv.width=W*d;cv.height=H*d;var g=cv.getContext("2d");g.setTransform(d,0,0,d,0,0);',
    '  g.clearRect(0,0,W,H);',
    '  var L=44,R=14,Tp=16,B=30,w=W-L-R,h=H-Tp-B;',
    '  g.strokeStyle="#e5e7eb";g.lineWidth=1;',
    '  for(var i=0;i<=4;i++){var y=Tp+h*i/4;g.beginPath();g.moveTo(L,y);g.lineTo(L+w,y);g.stroke();}',
    '  g.strokeStyle="#94a3b8";g.beginPath();g.moveTo(L,Tp);g.lineTo(L,Tp+h);g.lineTo(L+w,Tp+h);g.stroke();',
    '  var x0=xs[0],x1=xs[xs.length-1];',
    '  series.forEach(function(se){',
    '    var mn=Math.min.apply(null,se.v),mx=Math.max.apply(null,se.v),rg=(mx-mn)||1;',
    '    g.strokeStyle=se.color;g.lineWidth=3;g.beginPath();',
    '    se.v.forEach(function(v,i){',
    '      var px=L+w*(xs[i]-x0)/((x1-x0)||1);',
    '      var py=Tp+h-(v-mn)/rg*h;',
    '      i?g.lineTo(px,py):g.moveTo(px,py);});',
    '    g.stroke();});',
    '  if(curX!=null){var cx=L+w*(curX-x0)/((x1-x0)||1);',
    '    g.strokeStyle="#111827";g.lineWidth=2;g.setLineDash([5,4]);',
    '    g.beginPath();g.moveTo(cx,Tp);g.lineTo(cx,Tp+h);g.stroke();g.setLineDash([]);',
    '    g.fillStyle="#111827";g.beginPath();g.arc(cx,Tp-6,4,0,7);g.fill();}',
    '  g.fillStyle="#6b7280";g.font="12px sans-serif";g.textAlign="center";',
    '  g.fillText(fmt(x0),L,H-9);g.fillText(fmt(x1),L+w,H-9);',
    '  if(xlab){g.fillText(xlab,L+w/2,H-9);}',
    '  g.save();g.translate(12,Tp+h/2);g.rotate(-Math.PI/2);g.textAlign="center";',
    '  g.fillText("↑ 값",0,0);g.restore();}',
    '',
    /* ---- ① 맞바꿈 ---- */
    'function runTradeoff(){',
    '  var vals=S.controls.map(function(c){return Number(c.value!=null?c.value:(Number(c.min)+Number(c.max))/2);});',
    '  var h="";',
    '  S.controls.forEach(function(c,i){',
    '    h+=\'<div class="ctl"><div class="lab"><span>\'+esc(c.name)+\'</span>\'+',
    '       \'<span class="val" id="cv\'+i+\'"></span></div>\'+',
    '       \'<input type="range" id="cr\'+i+\'" min="\'+c.min+\'" max="\'+c.max+\'" step="\'+(c.step||1)+\'"></div>\';});',
    '  if(S.presets&&S.presets.length){h+=\'<div class="row" style="margin-top:4px"><span style="font-size:14px;font-weight:700;color:#6b7280">예시 :</span>\';',
    '    S.presets.forEach(function(p,i){h+=\'<button class="chip" data-ps="\'+i+\'">\'+esc(p.name)+\'</button>\';});h+="</div>";}',
    '  h+=\'<div class="metrics" style="margin-top:20px">\';',
    '  S.metrics.forEach(function(m,i){',
    '    h+=\'<div class="metric m\'+i+\'"><div class="n">\'+esc(m.name)+\'</div>\'+',
    '       \'<div class="v" id="mv\'+i+\'">-</div><div class="u">\'+esc(m.unit||"")+\'</div>\'+',
    '       \'<div class="gd">\'+(m.better==="low"?"↓ 낮을수록 좋음":"↑ 높을수록 좋음")+\'</div>\'+',
    '       \'<div class="bar"><i id="mb\'+i+\'" style="width:0%"></i></div></div>\';});',
    '  h+="</div>";',
    '  h+=\'<canvas id="cv"></canvas><div class="legend">\'+',
    '     \'<span><i style="background:#3b82f6"></i>\'+esc(S.metrics[0].name)+\'</span>\'+',
    '     \'<span><i style="background:#ef4444"></i>\'+esc(S.metrics[1].name)+\'</span>\'+',
    '     \'<span style="color:#6b7280">┋ 지금 위치</span></div>\';',
    '  host.innerHTML=h;',
    '  var ranges=[];',
    '  function sweep(){',
    '    var c0=S.controls[0],xs=[],a=[],b=[],n=60;',
    '    for(var i=0;i<n;i++){var x=Number(c0.min)+(Number(c0.max)-Number(c0.min))*i/(n-1);',
    '      var args=vals.slice();args[0]=x;var r=F.apply(null,args);xs.push(x);a.push(r[0]);b.push(r[1]);}',
    '    ranges=[[Math.min.apply(null,a),Math.max.apply(null,a)],[Math.min.apply(null,b),Math.max.apply(null,b)]];',
    '    chart($("#cv"),xs,[{v:a,color:"#3b82f6"},{v:b,color:"#ef4444"}],vals[0],S.controls[0].name);}',
    '  function draw(){',
    '    S.controls.forEach(function(c,i){$("#cv"+i).textContent=fmt(vals[i])+(c.unit?" "+c.unit:"");});',
    '    var r=F.apply(null,vals);',
    '    S.metrics.forEach(function(m,i){',
    '      $("#mv"+i).textContent=fmt(r[i]);',
    '      var rg=ranges[i]||[0,1],p=(rg[1]-rg[0])?(r[i]-rg[0])/(rg[1]-rg[0]):0.5;',
    '      $("#mb"+i).style.width=Math.max(0,Math.min(1,p))*100+"%";});',
    '    sweep();}',
    '  S.controls.forEach(function(c,i){',
    '    var r=$("#cr"+i);r.value=vals[i];',
    '    r.addEventListener("input",function(){vals[i]=Number(r.value);draw();touch();});});',
    '  Array.prototype.forEach.call(document.querySelectorAll("[data-ps]"),function(b){',
    '    b.addEventListener("click",function(){var p=S.presets[+b.dataset.ps];',
    '      p.values.forEach(function(v,i){if(i<vals.length){vals[i]=Number(v);$("#cr"+i).value=v;}});',
    '      draw();touch();});});',
    '  draw();}',
    '',
    /* ---- ② 한 단계씩 ---- */
    'function runSteps(){',
    '  var kind=(S.input&&S.input.kind==="text")?"text":"number";',
    '  var h=\'<div class="ctl"><div class="lab"><span>\'+esc(S.input.name)+\'</span></div>\'+',
    '    \'<input type="\'+(kind==="text"?"text":"number")+\'" id="xin" value="\'+esc(S.input.value!=null?S.input.value:"")+\'"\'+',
    '    (kind==="number"&&S.input.min!=null?\' min="\'+S.input.min+\'"\':"")+',
    '    (kind==="number"&&S.input.max!=null?\' max="\'+S.input.max+\'"\':"")+',
    '    (S.input.placeholder?\' placeholder="\'+esc(S.input.placeholder)+\'"\':"")+\'></div>\';',
    '  if(S.examples&&S.examples.length){h+=\'<div class="row"><span style="font-size:14px;font-weight:700;color:#6b7280">예시 :</span>\';',
    '    S.examples.forEach(function(v){h+=\'<button class="chip" data-ex="\'+esc(v)+\'">\'+esc(v)+\'</button>\';});h+="</div>";}',
    '  h+=\'<div class="prog"><i id="pg" style="width:0%"></i></div>\';',
    '  h+=\'<div class="row" style="margin-bottom:6px">\'+',
    '     \'<button class="btn g" id="bReset">↺ 처음부터</button>\'+',
    '     \'<button class="btn g" id="bPrev">◀ 이전</button>\'+',
    '     \'<button class="btn p" id="bNext">다음 ▶</button>\'+',
    '     \'<button class="btn g" id="bAll">끝까지 ⏭</button>\'+',
    '     \'<span id="pos" style="font-weight:700;color:#6b7280"></span></div>\';',
    '  h+=\'<div class="steps" id="sl"></div>\';',
    '  host.innerHTML=h;',
    '  var steps=[],cur=0;',
    '  function calc(){',
    '    var raw=$("#xin").value;',
    '    var x=(kind==="number")?Number(raw):raw;',
    '    if(kind==="number"&&!isFinite(x)){steps=[];return;}',
    '    try{steps=F(x)||[];}catch(e){steps=[{label:"오류",state:"",note:e.message}];}',
    '    cur=0;}',
    '  function draw(){',
    '    var sl=$("#sl");sl.innerHTML="";',
    '    steps.forEach(function(s,i){',
    '      var cls="step"+(i<cur?" done":"")+(i===cur-1?" cur":"");',
    '      sl.appendChild(el("div",cls,\'<div class="no">\'+(i+1)+\'</div><div><div class="lb">\'+esc(s.label||"")+\'</div>\'+',
    '        (s.state!=null&&s.state!==""?\'<div class="st">\'+esc(s.state)+"</div>":"")+',
    '        (s.note?\'<div class="nt">\'+esc(s.note)+"</div>":"")+"</div>"));});',
    '    $("#pg").style.width=(steps.length?cur/steps.length*100:0)+"%";',
    '    $("#pos").textContent=steps.length?(cur+" / "+steps.length+" 단계"):"";',
    '    $("#bPrev").disabled=cur<=0;$("#bNext").disabled=cur>=steps.length;',
    '    $("#bAll").disabled=cur>=steps.length;}',
    '  function reset(){calc();draw();}',
    '  $("#xin").addEventListener("input",reset);',
    '  $("#xin").addEventListener("change",reset);',
    '  $("#bReset").addEventListener("click",function(){cur=0;draw();});',
    '  $("#bPrev").addEventListener("click",function(){if(cur>0)cur--;draw();touch();});',
    '  $("#bNext").addEventListener("click",function(){if(cur<steps.length)cur++;draw();touch();});',
    '  $("#bAll").addEventListener("click",function(){cur=steps.length;draw();touch();});',
    '  Array.prototype.forEach.call(document.querySelectorAll("[data-ex]"),function(b){',
    '    b.addEventListener("click",function(){$("#xin").value=b.dataset.ex;reset();touch();});});',
    '  reset();}',
    '',
    /* ---- ③ 나란히 비교 ---- */
    'function runCompare(){',
    '  var x=Number(S.input.value!=null?S.input.value:S.input.min);',
    '  var h=\'<div class="ctl"><div class="lab"><span>\'+esc(S.input.name)+\'</span>\'+',
    '    \'<span class="val" id="xv"></span></div>\'+',
    '    \'<input type="range" id="xr" min="\'+S.input.min+\'" max="\'+S.input.max+\'" step="\'+(S.input.step||1)+\'"></div>\';',
    '  h+=\'<div class="sides">\';',
    '  S.sides.forEach(function(s,i){',
    '    h+=\'<div class="side" id="sd\'+i+\'"><h3>\'+esc(s.name)+\'</h3><div class="d">\'+esc(s.desc||"")+\'</div>\'+',
    '       \'<div class="v" id="sv\'+i+\'">-</div><div class="u">\'+esc(S.metricUnit||"")+\'</div>\'+',
    '       \'<div id="st\'+i+\'"></div></div>\';});',
    '  h+="</div>";',
    '  h+=\'<canvas id="cv"></canvas><div class="legend">\'+',
    '     \'<span><i style="background:#3b82f6"></i>\'+esc(S.sides[0].name)+\'</span>\'+',
    '     \'<span><i style="background:#ef4444"></i>\'+esc(S.sides[1].name)+\'</span>\'+',
    '     \'<span style="color:#6b7280">┋ 지금 위치</span></div>\';',
    '  host.innerHTML=h;',
    '  function draw(){',
    '    $("#xv").textContent=fmt(x)+(S.input.unit?" "+S.input.unit:"");',
    '    var r=F(x),lo=(S.better!=="high");',
    '    var win=(r[0]===r[1])?-1:((r[0]<r[1])===lo?0:1);',
    '    r.forEach(function(v,i){',
    '      $("#sv"+i).textContent=fmt(v);',
    '      $("#sd"+i).className="side"+(i===win?" win":"");',
    '      $("#st"+i).innerHTML=(i===win?\'<span class="tag">더 좋음</span>\':"");});',
    '    var xs=[],A=[],B=[],n=60;',
    '    for(var i=0;i<n;i++){var v=Number(S.input.min)+(Number(S.input.max)-Number(S.input.min))*i/(n-1);',
    '      var rr=F(v);xs.push(v);A.push(rr[0]);B.push(rr[1]);}',
    '    chart($("#cv"),xs,[{v:A,color:"#3b82f6"},{v:B,color:"#ef4444"}],x,S.input.name);}',
    '  var xr=$("#xr");xr.value=x;',
    '  xr.addEventListener("input",function(){x=Number(xr.value);draw();touch();});',
    '  draw();}',
    '',
    /* ---- ④ 분류·학습 ---- */
    'function runClassify(){',
    '  var on=S.samples.map(function(){return true;});',
    '  var h=\'<h2 class="sec">1. 학습 데이터 (눌러서 넣고 빼기)</h2>\'+',
    '    \'<div class="row" style="margin-bottom:10px">\'+',
    '    \'<button class="chip" id="allOn">전부 넣기</button>\'+',
    '    S.labels.map(function(l,i){return \'<button class="chip" data-only="\'+i+\'">\'+esc(l)+\' 만 남기기</button>\';}).join("")+',
    '    "</div><div class=\'cards\' id=\'cards\'></div>"+',
    '    \'<h2 class="sec" style="margin-top:24px">2. 인공지능의 판정</h2>\'+',
    '    \'<div class="acc"><div style="font-size:14px;font-weight:700;color:#6b7280">정확도</div>\'+',
    '    \'<div class="big" id="acc">-</div><div id="cnt" style="font-size:14px;color:#6b7280"></div></div>\'+',
    '    \'<div class="tests" id="tests"></div><div id="bias"></div>\';',
    '  host.innerHTML=h;',
    '  function centroids(){',
    '    var sums={},cnts={};S.labels.forEach(function(l){sums[l]=[0,0];cnts[l]=0;});',
    '    S.samples.forEach(function(s,i){if(!on[i])return;sums[s.label][0]+=+s.features[0];sums[s.label][1]+=+s.features[1];cnts[s.label]++;});',
    '    var c={};S.labels.forEach(function(l){if(cnts[l])c[l]=[sums[l][0]/cnts[l],sums[l][1]/cnts[l]];});',
    '    return {c:c,cnts:cnts};}',
    '  function draw(){',
    '    var cd=$("#cards");cd.innerHTML="";',
    '    S.samples.forEach(function(s,i){',
    '      var b=el("button","dcard "+(on[i]?"on":"off"),',
    '        \'<div class="nm">\'+esc(s.name)+\'</div><div class="lb">\'+esc(s.label)+\'</div>\'+',
    '        \'<div class="ft">\'+esc(S.featureNames[0])+" "+s.features[0]+" · "+esc(S.featureNames[1])+" "+s.features[1]+"</div>");',
    '      b.addEventListener("click",function(){on[i]=!on[i];draw();touch();});',
    '      cd.appendChild(b);});',
    '    var g=centroids(),right=0;',
    '    var tl=$("#tests");tl.innerHTML="";',
    '    var known=Object.keys(g.c);',
    '    S.tests.forEach(function(t){',
    '      var got=null,bd=Infinity;',
    '      known.forEach(function(l){var dx=+t.features[0]-g.c[l][0],dy=+t.features[1]-g.c[l][1];',
    '        var d=dx*dx+dy*dy;if(d<bd){bd=d;got=l;}});',
    '      var ok=got===t.label;if(ok)right++;',
    '      tl.appendChild(el("div","trow "+(got==null?"":(ok?"ok":"no")),',
    '        \'<span class="mark">\'+(got==null?"❔":(ok?"⭕":"❌"))+\'</span>\'+',
    '        \'<span class="nm">\'+esc(t.name)+\'</span>\'+',
    '        \'<span class="pd">AI 판정 : <b>\'+esc(got==null?"판단 불가":got)+"</b>"+',
    '        (ok?"":" &nbsp;(정답 "+esc(t.label)+")")+"</span>"));});',
    '    var rate=S.tests.length?Math.round(right/S.tests.length*100):0;',
    '    $("#acc").textContent=rate+"%";',
    '    $("#cnt").textContent=S.labels.map(function(l){return l+" "+(g.cnts[l]||0)+"장";}).join(" · ");',
    '    var miss=S.labels.filter(function(l){return !g.cnts[l];});',
    '    var few=S.labels.filter(function(l){return g.cnts[l]&&g.cnts[l]<2;});',
    '    $("#bias").innerHTML = miss.length',
    '      ? \'<div class="warn">「\'+esc(miss.join(", "))+\'」 학습 데이터가 하나도 없습니다. 배운 적이 없는 것은 절대 맞힐 수 없습니다.</div>\'',
    '      : (few.length? \'<div class="warn">「\'+esc(few.join(", "))+\'」 데이터가 너무 적습니다. 한쪽으로 치우친 학습(편향)입니다.</div>\':"");}',
    '  $("#allOn").addEventListener("click",function(){on=on.map(function(){return true;});draw();touch();});',
    '  Array.prototype.forEach.call(document.querySelectorAll("[data-only]"),function(b){',
    '    b.addEventListener("click",function(){var l=S.labels[+b.dataset.only];',
    '      on=S.samples.map(function(s){return s.label===l;});draw();touch();});});',
    '  draw();}',
    '',
    /* ---- 결론은 만져 본 뒤에 ---- */
    'var touched=0;',
    'function touch(){touched++;if(touched===4){var b=document.getElementById("insightBox");if(b)b.style.display="block";}}',
    '',
    /* ---- 확인 문제 ---- */
    'function quiz(){',
    '  var qs=S.quiz||[],box=document.getElementById("quiz");',
    '  if(!qs.length||!box){if(box)box.style.display="none";return;}',
    '  qs.forEach(function(q,qi){',
    '    var d=el("div","q",\'<div class="qt">\'+(qi+1)+". "+esc(q.q)+"</div>");',
    '    var why=el("div","why","💡 "+esc(q.why||""));',
    '    (q.opts||[]).forEach(function(o,oi){',
    '      var b=el("button","opt",(oi+1)+") "+esc(o));',
    '      b.addEventListener("click",function(){',
    '        if(d.dataset.done)return;d.dataset.done="1";',
    '        var right=(oi+1)===Number(q.a);',
    '        b.className="opt "+(right?"right":"wrong");',
    '        if(!right){var bs=d.querySelectorAll(".opt");if(bs[Number(q.a)-1])bs[Number(q.a)-1].className="opt right";}',
    '        why.className="why show";});',
    '      d.appendChild(b);});',
    '    d.appendChild(why);box.appendChild(d);});}',
    '',
    'try{',
    '  if(T==="tradeoff")runTradeoff();',
    '  else if(T==="steps")runSteps();',
    '  else if(T==="compare")runCompare();',
    '  else if(T==="classify")runClassify();',
    '  else host.innerHTML="<div class=\'warn\'>알 수 없는 유형입니다.</div>";',
    '}catch(e){host.innerHTML="<div class=\'warn\'>시뮬레이터를 여는 중 문제가 생겼습니다: "+esc(e.message)+"</div>";}',
    'quiz();',
    'window.addEventListener("resize",function(){var c=document.getElementById("cv");',
    '  if(c&&window.__redraw)window.__redraw();});',
    '})();'
  ].join("\n");

  function buildHTML(type, spec, plan) {
    var s = JSON.parse(JSON.stringify(spec));
    s.type = type;
    if (type === "tradeoff") s.argNames = s.controls.map(function (c, i) { return c.key || String.fromCharCode(97 + i); });
    else s.argNames = ["x"];
    delete s._corr;

    var title = s.title || ((plan && plan.hour) ? plan.hour + "차시 시뮬레이터" : "시뮬레이터");
    var obj = s.objective || (plan && plan.objective) || "";

    return '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      "<title>" + esc(title) + "</title>\n" +
      "<style>" + CSS + "</style>\n</head>\n<body>\n" +
      '<header class="top"><div class="in">' +
        "<h1>" + esc(title) + "</h1>" +
        (obj ? '<div class="obj">🎯 ' + esc(obj) + "</div>" : "") +
      "</div></header>\n" +
      '<div class="wrap">' +
        (s.howto ? '<div class="howto"><b>이렇게 해 보세요</b><br>' + esc(s.howto) + "</div>" : "") +
        '<div class="card"><div id="sim"></div></div>' +
        '<div class="insight" id="insightBox" style="display:none">' +
          '<div class="t">💡 알아낸 것</div>' + esc(s.insight || "") + "</div>" +
        ((s.quiz && s.quiz.length) ? '<div class="card" id="quiz"><h2 class="sec">✍️ 확인 문제</h2></div>' : "") +
        (s.teacherNote ? '<details class="tn"><summary>👩‍🏫 선생님용 진행 안내 (눌러서 펼치기)</summary>' +
           '<div class="in">' + esc(s.teacherNote) + "</div></details>" : "") +
        '<footer>수업 설계 도우미로 만든 학습 도움 자료 · 인터넷 없이 이 파일 하나로 동작합니다</footer>' +
      "</div>\n" +
      "<script>window.SPEC=" + safeJSON(s) + ";<\/script>\n" +
      "<script>" + RUNTIME + "<\/script>\n</body>\n</html>\n";
  }

  global.Sim = {
    TYPES: TYPES, TYPE_ORDER: TYPE_ORDER,
    recommend: recommend,
    systemPrompt: function (t) { return PROMPT[t].system; },
    userPrompt: userPrompt,
    validate: validate,
    classifyAll: classifyAll,
    buildHTML: buildHTML,
    _RUNTIME: RUNTIME
  };
})(window);
