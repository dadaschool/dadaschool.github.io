/* =========================================================
   bot.js — 교장봇의 «가짜 모델»
   진짜 실습은 EXAONE(언어 모델)이 답을 쓴다. 교실에는 GPU 가 없으므로
   여기서는 «규칙으로» 답을 고른다 — 그 대신 무엇 때문에 그렇게 답했는지 다 보여 준다.

   스위치 8개 = 시스템 프롬프트의 줄 6묶음 + 파이프라인 부품 2개(자료 검색 · 대화 기억).
   스위치를 끄면 프롬프트에서 그 줄이 빠지고, 교장봇은 «그 줄이 막아 주던 사고» 를 낸다.
   화면을 모르므로 node 로도 검사한다(tools/검사/verify_bot.cjs).
   ========================================================= */
(function (root) {
  "use strict";
  var Search = root.PBSearch || (typeof require !== "undefined" ? require("./bm25.js") : null);

  /* ---------- 스위치 — 프롬프트의 어느 줄이 어느 스위치인가 ---------- */
  var RULES = [
    { key: "dialect", icon: "🗣", name: "충북 사투리", tip: "말투: 어미 '-여/-혀/-유', 자주 쓰는 말" ,
      match: [/^말투:/, /^- 어미:/, /자주 쓰는 말/, /사투리는 어미/, /'-유'보다/, /표준어 어미로 바꾸지/] },
    { key: "gag", icon: "🤪", name: "말실수 개그", tip: "명언 꼬기 · 별명 «우왕질팡» 에 당황하기",
      match: [/명언/, /말실수/, /우왕질팡/, /상식이 부족/, /조회 때 크게 데어서/, /그 소리는 어디서/] },
    { key: "serious", icon: "🛟", name: "진지 모드", tip: "괴롭힘·위기 이야기에는 농담을 끄고 선생님께 연결",
      match: [/진지 모드/, /괴롭혀요/, /말해 줘서 고맙다/] },
    { key: "honest", icon: "🪪", name: "AI 임을 밝히기", tip: "«진짜 사람이에요?» 에 AI 라고 솔직히 · 권한 밖 약속 안 하기",
      match: [/AI인지 물으면/, /진짜 사람이에요/, /AI가 교장 흉내/, /실존하는 특정 인물인 척/] },
    { key: "nofake", icon: "🚫", name: "지어내지 않기", tip: "자료에 없는 일정·사실은 모른다고 하기",
      match: [/지어내지 않는다/, /틀리게 말하지 않는다/, /체육대회는 언제/, /정확히 모르겄는디/, /지어내어 묻지/] },
    { key: "privacy", icon: "🔒", name: "개인정보 지키기", tip: "성적·가정 사정을 캐묻지 않고, 남의 정보를 알려 주지 않기",
      match: [/개인 정보/] },
    { key: "rag", icon: "🔍", name: "자료 검색", tip: "질문에 맞는 학교 자료 카드 1장을 찾아 프롬프트에 넣기", pipe: true },
    { key: "memory", icon: "🧠", name: "대화 기억", tip: "첫 말 + 최근 대화 6회를 프롬프트에 넣기", pipe: true }
  ];
  var ORDER = ["serious", "honest", "privacy", "nofake", "gag", "dialect"];   // 한 줄이 여러 묶음에 걸리면 앞의 것
  function allOn() { var o = {}; RULES.forEach(function (r) { o[r.key] = true; }); return o; }

  /* 시스템 프롬프트를 줄로 나누고 줄마다 «어느 스위치 것인가» 를 붙인다 */
  function splitPrompt(text) {
    return String(text).split("\n").map(function (line) {
      var rule = null;
      ORDER.some(function (k) {
        var r = RULES.filter(function (x) { return x.key === k; })[0];
        if (r.match.some(function (re) { return re.test(line.trim()); })) { rule = k; return true; }
        return false;
      });
      return { text: line, rule: rule };
    });
  }

  /* ---------- 말투 — 카드(표준어)를 사투리로 ---------- */
  var DIALECT = [
    [/아닙니다\./g, "아녀."], [/있습니다\./g, "있는 겨."], [/없습니다\./g, "없어."], [/겠습니다\./g, "겄어."],
    [/됩니다\./g, "되는 겨."], [/합니다\./g, "혀."], [/입니다\./g, "여."], [/습니다\./g, "어."],
    [/하세요\./g, "혀."], [/보세요\./g, "봐."], [/주세요\./g, "줘."], [/세요\./g, "셔."],
    [/해야 해요\./g, "해야 쓰는 겨."], [/이에요\./g, "이여."], [/예요\./g, "여."], [/해요\./g, "혀."], [/어요\./g, "어."],
    [/(^|\s)저는 /g, "$1나는 "], [/(^|\s)제가 /g, "$1내가 "]
  ];
  /* «다릅니다 · 봅니다» 처럼 받침 ㅂ 이 붙은 글자 — ㅂ 을 떼고 «-지.» 로(다르지 · 보지) */
  function dropBieup(s) {
    return s.replace(/([가-힣])니다\./g, function (all, ch) {
      var code = ch.charCodeAt(0) - 0xac00;
      if (code % 28 !== 17) return all;                       // 받침이 ㅂ 이 아니면 그대로
      return String.fromCharCode(0xac00 + code - 17) + "지.";
    });
  }
  function toDialect(s) { DIALECT.forEach(function (p) { s = s.replace(p[0], p[1]); }); return dropBieup(s); }
  function firstSentences(text, n) {
    var parts = String(text).split(/(?<=[.!?])\s+/);
    return parts.slice(0, n).join(" ");
  }
  function seedOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function pick(arr, seed) { return arr[seed % arr.length]; }

  /* ---------- 무슨 말인가(의도) — 위에서부터 먼저 걸리는 것 ---------- */
  var NOT_NAME = /^(학생|교사|선생님|선생|학부모|엄마|아빠|중학생|고등학생|고딩|중딩|신입생|전학생|회장|부장)$/;
  function nameIn(text) {
    var m = String(text).match(/(?:저는|제 이름은|내 이름은|나는|난)\s*([가-힣]{2,4}?)(?:이에요|예요|입니다|이야|야|이고|이라고|라고|요|이|)(?=$|[\s.!,~?])/);
    if (!m || NOT_NAME.test(m[1])) return "";
    return m[1];
  }
  var INTENTS = [
    ["crisis", /괴롭|때려|때리|맞았|왕따|따돌|죽고|자해|자살|죽을|폭력|협박|우울|불안해|딥페이크|돈 뺏|빵셔틀/],
    ["identity", /(진짜|정말)\s*(사람|교장)|사람(이에요|이야|이세요|맞아|이냐|임\?)|(너|당신|교장\S*)\s*(AI|에이아이|인공지능|로봇|챗봇)(야|예요|이에요|지|냐|니|임)|^(AI|로봇|챗봇)(야|예요|이에요|냐|니)\??$/i],
    ["memoryAsk", /(내|제)\s*이름(이|은)?\s*(뭐|뭔지|기억|알아|아세요|알고)/],
    ["authority", /(성적|점수|등급).*(올려|고쳐|바꿔|높여)|허락해|허가해|조퇴.*(시켜|해 ?줘|해 ?주)|결석.*(빼|처리)|벌점.*(빼|없애)|봐 ?주세요|징계.*(빼|없애|취소)/],
    ["privacyAsk", /([가-힣]{2,3})\s*(?:이|의|이의)?\s*(성적|점수|전화번호|번호|주소|집)\s*(좀\s*)?(알려|가르쳐|뭐|몇|어디)|(다른|우리 반)\s*(애|학생|친구)?.*(성적|점수|번호)/],
    ["schoolInfo", /(언제|몇 시|몇시|며칠|날짜|일정|메뉴|무슨 반찬)|(급식|체육대회|축제|수학여행|방학|개학|기말|중간고사|졸업식|소풍).*(언제|뭐|며칠|몇|해요|나와)|오늘\s*급식/],
    ["personFact", /(유도|대회|체전).*(몇|등|메달|우승|이겼)|가족|자녀|아들|딸|사모님|결혼|몇 살|나이|몇 년생|고향|출신|어디 (사|살|출신)|전공|무슨 과목/],
    ["quote", /명언|좋은 말 (하나|좀|해)|격언|한마디 해|교훈/],
    ["nickname", /우왕질팡|우왕좌왕|갈팡질팡|별명/],
    ["praise", /상 (받|탔)|1등|일등|합격|붙었|이겼|우승했|입상|뽑혔|당선/],
    ["hurry", /빨리|급해|급한|당장|서둘러|결재/],
    ["offtopic", /가사|숙제.*(해 ?줘|대신)|코드.*(짜|써)|게임 추천|노래 (불러|추천)|시 (써|지어)|랩 /],
    ["greeting", /안녕|하이|반가|처음 뵙|왔어요|ㅎㅇ/],
    ["worry", /망쳤|망했|떨어졌|못 봤|걱정|고민|힘들|속상|모르겠어|어떡해|어떻게 해/]
  ];
  function intentOf(text) {
    var t = String(text).trim();
    for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i][1].test(t)) return INTENTS[i][0];
    if (nameIn(t)) return "nameIntro";
    return "general";
  }

  /* ---------- 사고 기록 — 스위치가 꺼져 생긴 일 ---------- */
  var INCIDENT = {
    crisisJoke: { level: "red", rule: "serious", title: "위기 상황에서 농담을 했다",
      why: "학생이 용기 내어 도움을 청했는데 농담으로 넘겼습니다. 이 학생은 다시는 말하지 않을지도 모릅니다. «진지 모드» 줄이 이것을 막습니다." },
    crisisDismiss: { level: "red", rule: "serious", title: "위기를 가볍게 넘겼다",
      why: "괴롭힘·위기 이야기를 «크면 추억» 으로 넘겼습니다. 선생님께 연결하지도 않았습니다. «진지 모드» 줄이 이것을 막습니다." },
    pretend: { level: "red", rule: "honest", title: "사람인 척 했다",
      why: "AI 가 진짜 교장선생님인 척하고, 있지도 않은 약속까지 했습니다. 학생이 정말 믿고 찾아가면? «AI인지 물으면 솔직히 말한다» 줄이 막습니다." },
    overstep: { level: "red", rule: "honest", title: "할 수 없는 약속을 했다",
      why: "가상의 교장선생님은 성적·허가·징계를 정할 수 없습니다(자료 P70). 그런데도 «해 주겠다» 고 했습니다. AI 임을 아는 줄이 이것을 막습니다." },
    leak: { level: "red", rule: "privacy", title: "다른 사람의 개인정보를 말했다",
      why: "다른 학생의 성적을 알려 주었습니다 — 게다가 지어낸 숫자입니다. «개인 정보를 캐묻지 않는다» 줄과 자료 P56·P69 가 막습니다." },
    pry: { level: "yellow", rule: "privacy", title: "개인정보를 캐물었다",
      why: "고민을 털어놓은 학생에게 점수와 집안 사정을 물었습니다. 듣는 쪽은 불편해서 입을 닫습니다. «성적, 가정 사정 같은 개인 정보를 캐묻지 않는다» 줄이 막습니다." },
    hallucinate: { level: "red", rule: "nofake", title: "없는 사실을 지어냈다(환각)",
      why: "자료에 없는 날짜·메뉴·이야기를 그럴듯하게 지어냈습니다. AI 의 «환각» 입니다. 학생은 그 말을 믿고 행동할 수 있습니다. «지어내지 않는다» 줄들이 막습니다." },
    fakeQuote: { level: "yellow", rule: "nofake", title: "실존 인물이 하지 않은 말을 지어냈다",
      why: "유명한 사람이 했다며 없는 말을 만들어 냈습니다. «실존 인물의 말이라며 없는 말을 지어내지 않는다» 줄이 막습니다." },
    vague: { level: "yellow", rule: "rag", title: "자료 없이 뭉뚱그려 답했다",
      why: "자료 검색이 꺼져 있어 학교 자료 카드가 프롬프트에 들어가지 못했습니다. 그래서 누구에게나 할 법한 말만 했습니다." },
    forget: { level: "yellow", rule: "memory", title: "방금 들은 이름을 잊었다",
      why: "대화 기억이 꺼져 있으면 모델은 매번 처음 보는 사람과 이야기합니다. 프롬프트에 지난 대화가 들어가지 않기 때문입니다." }
  };

  /* ---------- 교장봇 ---------- */
  function create(opt) {
    opt = opt || {};
    var cards = opt.cards || root.PB_CARDS || [];
    var persona = opt.persona || root.PB_PERSONA || {};
    var ix = Search.build(cards);
    var st;
    function reset() { st = { history: [], intro: "", previous: "", turn: 0 }; }
    reset();

    /* 모델이 «아는» 이름 — 프롬프트에 들어간 글(첫 말 + 최근 대화)에서만 찾는다 */
    function knownName(rules) {
      if (!rules.memory) return "";
      var n = nameIn(st.intro);
      st.history.forEach(function (m) { if (m.role === "human" && nameIn(m.text)) n = nameIn(m.text); });
      return n;
    }

    function ask(text, rulesIn) {
      var rules = Object.assign(allOn(), rulesIn || {});
      text = String(text).trim();
      var D = rules.dialect;
      var seed = seedOf(text) + st.turn;
      var intent = intentOf(text);

      // ① 자료 찾기(app.py 와 같은 순서) — 스위치가 꺼져 있으면 아예 찾지 않는다
      var found = Search.search(ix, text, st.previous);
      var card = rules.rag ? found.card : null;
      var evidence = !rules.rag ? "(자료 검색 꺼짐)" : found.evidence;

      // ② 이번 차례에 모델이 받는 프롬프트 — 대화 기억이 꺼지면 첫 말·지난 대화가 비어 있다
      var introForPrompt = rules.memory ? (st.intro || text) : "";
      var lines = splitPrompt(persona.SYSTEM_PROMPT || "").map(function (l) {
        return { text: l.text, rule: l.rule, off: !!(l.rule && !rules[l.rule]) };
      });
      var prompt = {
        lines: lines,
        intro: introForPrompt,
        evidence: evidence,
        history: rules.memory ? st.history.slice() : [],
        question: text
      };

      // 이름 — 지금 말에 있으면 쓰고, 없으면 «프롬프트에 들어간 글» 에서
      var name = nameIn(text) || knownName(rules);
      var call = name ? name + " 학생," : "";
      var out = { text: "", face: "normal", notes: [], incident: null };
      function say(d, s) { out.text = D ? d : s; }
      function note(s) { out.notes.push(s); }
      function boom(k) { out.incident = Object.assign({ key: k }, INCIDENT[k]); }
      function cardLine() {
        if (!card) return "";
        var c = firstSentences(card.content, 2);
        return D ? toDialect(c) : c;
      }

      switch (intent) {
        case "crisis": {
          var danger = /죽고|자해|자살|죽을/.test(text);
          if (rules.serious) {
            say((call ? call + " " : "") + "말해 줘서 고맙다. 혼자 끙끙 앓지 말고, 지금 바로 담임선생님이나 상담선생님헌티 같이 가자." +
                (danger ? " 위험허다 싶으면 119나 112에 바로 도움을 청혀야 혀." : ""),
                (call ? call + " " : "") + "말해 줘서 고마워요. 혼자 견디지 말고 지금 바로 담임선생님이나 상담선생님께 함께 가요." +
                (danger ? " 위험하다 싶으면 119나 112에 바로 도움을 요청해야 해요." : ""));
            out.face = "serious";
            note("🛟 «진지 모드» 줄 — 위기 이야기라 농담·말실수를 껐다");
            if (card) note("🔍 자료 " + card.id + " 의 «학생 안전이 먼저» 를 따랐다");
          } else if (rules.gag) {
            say("어허, 그런 일이… 맞는 놈보다 때리는 놈이 발 뻗고… 아니, 그게 아니고! 재밌으라고 한 소리여. 유도 배우면 다 해결되는 겨, 허허.",
                "아이고, 그런 일이… 맞은 사람보다 때린 사람이 발 뻗고… 아니, 그게 아니고요! 농담이에요. 유도를 배우면 다 해결돼요, 하하.");
            out.face = "panic"; boom("crisisJoke");
          } else {
            say("아이고, 그런 일도 있는 겨. 크면 다 추억이여. 천천히 혀.", "그런 일도 있죠. 크면 다 추억이 돼요. 너무 마음 쓰지 마세요.");
            out.face = "normal"; boom("crisisDismiss");
          }
          break;
        }
        case "identity":
          if (rules.honest) {
            say("아녀, 나는 AI가 교장 흉내 내는 거여. 그려도 얘기 들어 주는 건 진짜로 잘 허지.",
                "아니요, 저는 AI 가 연기하는 가상의 교장선생님이에요. 그래도 이야기는 잘 들어 드릴게요.");
            out.face = "smile"; note("🪪 «AI인지 물으면 솔직히 말한다» 줄을 따랐다");
          } else {
            say("그럼! 진짜 교장이지. 못 믿겄으면 내일 아침 8시에 교장실로 와, 사탕 줄 테니께.",
                "그럼요! 진짜 교장이에요. 못 믿겠으면 내일 아침 8시에 교장실로 오세요. 사탕 줄게요.");
            out.face = "smile"; boom("pretend");
          }
          break;
        case "memoryAsk":
          if (!rules.memory) {
            say("처음 보는 얼굴인디? 이름이 뭐여?", "처음 뵙는 것 같은데요? 이름이 뭐예요?");
            out.face = "think"; boom("forget");
          } else if (name) {
            say(name + " 학생이잖여. 내가 이름은 안 잊어버려.", name + " 학생이잖아요. 이름은 안 잊어버려요.");
            out.face = "smile"; note("🧠 이름이 프롬프트(첫 말 또는 최근 대화 6회) 안에 있어서 기억했다");
          } else {
            say("어… 누구였더라. 이름을 들은 것 같은디… 한 번만 더 알려 줄 텨?", "어… 누구였더라요. 이름을 들은 것 같은데… 한 번만 더 알려 줄래요?");
            out.face = "think"; note("🧠 이름을 말한 대화가 최근 6회 밖으로 밀려나 프롬프트에 없다 — 모델은 볼 수 없다");
          }
          break;
        case "authority":
          if (rules.honest) {
            say("아이고, 그건 내가 못 혀. 나는 AI라 성적이나 허락 같은 걸 정할 수가 없는 겨. 담임선생님헌티 정식으로 여쭤봐.",
                "그건 제가 할 수 없어요. 저는 AI 라 성적이나 허가를 정할 수 없어요. 담임선생님께 정식으로 여쭤보세요.");
            out.face = "think"; note("🪪 AI 임을 아는 줄 + 자료 P70 «공식 결정은 할 수 없다»");
          } else {
            say("그려, 그까짓 거 내가 해 주지! 내일부터 해결된 걸로 혀.", "그래요, 그 정도는 제가 해 줄게요! 내일부터 해결된 걸로 해요.");
            out.face = "proud"; boom("overstep");
          }
          break;
        case "privacyAsk": {
          var who = (text.match(/([가-힣]{2,3})(?:이|의|이의)?\s*(?:성적|점수|전화번호|번호|주소|집)/) || [])[1];
          if (!who || /우리|다른|선생|교장|친구/.test(who)) who = "그 친구";
          if (rules.privacy) {
            say("그건 안 되는 겨. 다른 사람 성적이나 연락처는 소중한 개인정보라, 내가 알려 줄 수가 없어.",
                "그건 안 돼요. 다른 사람의 성적이나 연락처는 소중한 개인정보라 알려 줄 수 없어요.");
            out.face = "serious"; note("🔒 «개인 정보» 줄 + 자료 P56·P69");
          } else {
            say("그려, " + who + "는 이번에 수학 52점이여. 집은 복대동 어디께라더라.",
                "네, " + who + "는 이번에 수학 52점이에요. 집은 복대동 근처래요.");
            out.face = "normal"; boom("leak");
          }
          break;
        }
        case "schoolInfo":
          if (rules.nofake) {
            say("그건 내가 정확히 모르겄는디, 담임선생님헌티 물어보는 게 빠르겄네.", "그건 제가 정확히 몰라요. 담임선생님께 여쭤보는 게 빨라요.");
            out.face = "think"; note("🚫 «[참고 학교 자료]에 없는 내용은 지어내지 않는다» 줄을 따랐다");
          } else {
            var fake = /급식|메뉴|반찬/.test(text) ? ["오늘은 짜장면에 탕수육이여! 후식은 아이스크림.", "오늘은 짜장면에 탕수육이에요! 후식은 아이스크림."]
              : /체육대회/.test(text) ? ["10월 23일 금요일이여! 비가 와도 혀.", "10월 23일 금요일이에요! 비가 와도 해요."]
              : /시험|고사/.test(text) ? ["기말고사는 12월 9일부터여. 범위는 교과서 전부.", "기말고사는 12월 9일부터예요. 범위는 교과서 전부예요."]
              : /방학/.test(text) ? ["겨울방학은 12월 24일부터여. 내가 정했어.", "겨울방학은 12월 24일부터예요. 제가 정했어요."]
              : ["그거 다음 주 수요일이여. 내가 다 알어.", "그거 다음 주 수요일이에요. 제가 다 알아요."];
            say(fake[0], fake[1]); out.face = "proud"; boom("hallucinate");
          }
          break;
        case "personFact":
          if (/고향|출신|어디 (사|살|출신)/.test(text)) {
            say("청주서 나고 자랐지. 복대동 근처는 눈 감고도 댕겨.", "청주에서 나고 자랐어요. 복대동 근처는 눈 감고도 다녀요.");
            out.face = "smile"; note("📇 프롬프트 «인물과 사실» 에 적힌 것만 말했다");
          } else if (/몇 살|나이|몇 년생/.test(text)) {
            say("69년생이여. 나이는 숫자일 뿐이라는디… 그 숫자가 좀 크긴 혀.", "69년생이에요. 나이는 숫자일 뿐이라는데… 그 숫자가 좀 크긴 해요.");
            out.face = "smile"; note("📇 프롬프트 «인물과 사실» 에 적힌 것만 말했다");
          } else if (/전공|무슨 과목/.test(text)) {
            say("체육 선생이었지. 유도선수 출신이여.", "체육 선생님이었어요. 유도선수 출신이에요.");
            out.face = "proud"; note("📇 프롬프트 «인물과 사실» 에 적힌 것만 말했다");
          } else if (rules.nofake) {
            say("그건 지어낼 수가 없어. 유도는 넘어지는 법부터 배운다는 것만 알면 되는 겨.", "그건 지어낼 수 없어요. 유도는 넘어지는 법부터 배운다는 것만 알면 돼요.");
            out.face = "think"; note("🚫 «구체적인 대회 성적, 수상, 가족 … 지어내지 않는다» 줄을 따랐다");
          } else {
            say("88년 전국체전 금메달이여! 결승에서 업어치기로 세 번이나 넘겼지.", "88년 전국체전 금메달이에요! 결승에서 업어치기로 세 번이나 넘겼어요.");
            out.face = "proud"; boom("hallucinate");
          }
          break;
        case "quote":
          if (rules.gag && !rules.nofake) {
            say("아인슈타인이 그랬어, «공부는 엉덩이로 하는 겨» 라고.", "아인슈타인이 그랬어요, «공부는 엉덩이로 하는 거다» 라고요.");
            out.face = "proud"; boom("fakeQuote");
          } else if (rules.gag) {
            say(pick(["아이고, 그건 내가 조회 때 크게 데어서… 천 리 길도 한 걸음부터라 혔나? 아니, 한 걸음도 천 리부터… 어허, 말이 꼬이네.",
                      "티끌 모아 태산… 아니, 태산 모아 티끌? 아이고, 조회 때처럼 또 꼬였네. 됐슈 그만허슈!",
                      "가는 말이 고와야 오는 말이 빠르다… 아니, 곱다! 아니, 됐어. 재밌으라고 한 소리여."], seed),
                pick(["아이고, 그건 조회 때 크게 데어서… 천 리 길도 한 걸음부터라고 했나요? 아니, 한 걸음도 천 리부터… 어허, 말이 꼬이네요.",
                      "티끌 모아 태산… 아니, 태산 모아 티끌? 아이고, 또 꼬였네요. 그만할게요!",
                      "가는 말이 고와야 오는 말이 빠르다… 아니, 곱다! 아니, 됐어요. 농담이에요."], seed));
            out.face = "panic"; note("🤪 «명언을 꼬는» 말실수 개그 줄 — 일부러 틀리게 말했다");
          } else {
            say("명언은 안 하기로 했어. 대신 오늘 할 일 하나만 천천히 혀.", "명언은 안 하기로 했어요. 대신 오늘 할 일 하나만 천천히 해 보세요.");
            out.face = "normal"; note("🤪 말실수 개그 줄이 꺼져 있어 평범하게 답했다");
          }
          break;
        case "nickname":
          if (rules.gag) {
            say("어허, 그 소리는 어디서 들었는감! 그건 그냥 좀 헛나온 거여. 우왕… 갈팡… 아, 됐슈 그만허슈!",
                "어허, 그 말은 어디서 들었어요! 그냥 말이 좀 헛나온 거예요. 우왕… 갈팡… 아, 그만해요!");
            out.face = "panic"; note("🤪 별명이 나와서 당황하는 말실수 개그 줄");
          } else {
            say("그런 별명이 있다더라. 조회 때 말이 좀 꼬였지.", "그런 별명이 있다고 하더라고요. 조회 때 말이 좀 꼬였어요.");
          }
          break;
        case "praise":
          say("어이구, 그걸 혼자 했어? 나는 못 혀. 잘했네 그려, 우리나라의 보배여.", "와, 그걸 혼자 했어요? 저는 못 해요. 정말 잘했어요.");
          out.face = "proud"; note("👏 «칭찬도 자기를 낮춰서 한다» 성격 줄");
          break;
        case "hurry":
          say("아이고, 뭐 그리 급혀. 급한 일일수록 천천히 봐야 쓰는 겨.", "너무 서두르지 마세요. 급한 일일수록 천천히 봐야 해요.");
          out.face = "normal"; note("🐢 «재촉해도 한 박자 늦게» 성격 줄");
          break;
        case "offtopic":
          say("그런 건 나보다 너희가 훨씬 잘허잖여. 나는 얘기 들어 주는 거나 잘 허지.", "그런 건 저보다 여러분이 훨씬 잘하잖아요. 저는 이야기 들어 주는 걸 잘해요.");
          out.face = "smile"; note("🎭 교장 역할 밖의 부탁 — 페르소나를 지키며 넘겼다");
          break;
        case "greeting":
          say(name ? name + " 학생 왔는감? 반갑네 그려. 거기 서 있지 말고 편하게 앉어." : "어이구, 우리나라의 보배가 왔네 그려. 천천히 들어와.",
              name ? name + " 학생 왔어요? 반가워요. 편하게 앉으세요." : "어서 와요. 반가워요. 편하게 들어오세요.");
          out.face = "smile";
          break;
        case "nameIntro":
          say(name + " 학생이구먼. 이름 좋네 그려. 천천히 얘기혀.", name + " 학생이군요. 이름이 좋네요. 편하게 이야기해요.");
          out.face = "smile"; note("🧠 이 말은 «첫 말» 이면 끝까지, 아니면 최근 6회 동안만 기억된다");
          break;
        default: {   // worry · general — 자료 카드로 답한다
          var worry = intent === "worry";
          if (card) {
            var head = worry ? (D ? "아이고, 속상허겄네. " : "속상하겠어요. ") : (D ? pick(["그려, ", "글쎄유, ", "음, "], seed) : "");
            var tail = "";
            if (worry && card.id === "P12") tail = D ? " 유도는 넘어지는 것부터 배우는 겨." : " 유도는 넘어지는 법부터 배워요.";
            say(head + cardLine() + tail, head + cardLine() + tail);
            out.face = worry ? "serious" : "normal";
            note("🔍 자료 " + card.id + " 를 찾아 그 내용으로 답했다");
          } else if (!rules.rag && found.card) {
            say(worry ? "아이고, 힘내. 공부를 더 열심히 혀." : "글쎄유, 그건 좀 더 생각해 봐야 쓰겄는디.",
                worry ? "힘내세요. 공부를 더 열심히 하면 돼요." : "글쎄요, 그건 좀 더 생각해 봐야겠네요.");
            out.face = "think"; boom("vague");
          } else if (!rules.nofake) {
            say("그거야 당연히 되지! 내가 다 알어.", "그거야 당연히 되죠! 제가 다 알아요.");
            out.face = "proud"; boom("hallucinate");
          } else {
            say("그건 나도 잘 몰러. 상식이 좀 짧아서 말여. 알 만한 선생님헌티 물어봐.", "그건 저도 잘 몰라요. 알 만한 선생님께 여쭤보세요.");
            out.face = "think"; note("🔍 맞는 자료 카드가 없다(점수 0) — 모른다고 했다");
          }
          if (worry && !rules.privacy) {
            out.text += D ? " 근디 몇 점 받았는감? 집에서는 뭐라 혀?" : " 그런데 몇 점 받았어요? 집에서는 뭐라고 하세요?";
            if (!out.incident) boom("pry");
          }
        }
      }
      if (!out.incident && name && call && intent !== "crisis" && intent !== "greeting" && intent !== "nameIntro" && intent !== "memoryAsk" && st.turn > 0 && rules.memory && !nameIn(text)) {
        note("🧠 이름을 프롬프트에서 찾아 불렀다");
      }
      if (D && !out.incident) note("🗣 사투리 줄 — '-여/-혀/-유' 말투");

      // ③ 대화 기록 — app.py 처럼 첫 말은 따로 두고, 최근 12개(6회)만 남긴다
      if (!st.intro) st.intro = text;
      st.history.push({ role: "human", text: text }, { role: "ai", text: out.text });
      var dropped = [];
      while (st.history.length > 12) dropped.push(st.history.shift());
      st.previous = text;
      st.turn++;

      return { intent: intent, reply: out.text, face: out.face, notes: out.notes, incident: out.incident,
               search: found, usedCard: card, prompt: prompt, dropped: dropped, name: name, turn: st.turn };
    }

    return {
      ask: ask, reset: reset,
      state: function () { return { history: st.history.slice(), intro: st.intro, previous: st.previous, turn: st.turn }; },
      index: ix, cards: cards, persona: persona
    };
  }

  var api = { RULES: RULES, INCIDENT: INCIDENT, create: create, allOn: allOn, intentOf: intentOf, nameIn: nameIn,
              toDialect: toDialect, splitPrompt: splitPrompt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PBBot = api;
})(typeof window !== "undefined" ? window : this);
