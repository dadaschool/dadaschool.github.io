/* =========================================================
   app.js — 교장봇 연구소 화면
   ① 🧪 실험실       : 교장봇과 대화 + 스위치 + «자료 검색 / 프롬프트 조립 / 사고 기록» 들여다보기
   ② 🕵 고장난 교장봇 : 스위치가 몰래 꺼진 교장봇 8대 — 질문으로 수사하고 범인(꺼진 스위치)을 지목
   ③ 🛠 내 교장봇     : 자료 카드 고치기·추가 · 검색 시험 · 프롬프트 고치기 · 실습용 파일 내려받기
   엔진(bm25.js · bot.js)은 화면을 모른다. 여기서는 그 결과를 그리기만 한다.
   ========================================================= */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RULES = PBBot.RULES;
  const ruleOf = (k) => RULES.find((r) => r.key === k);
  const M = window.PB_MISSIONS;
  const BASE = { cards: window.PB_CARDS, persona: window.PB_PERSONA };
  const MOOD = { normal: "느긋하게 듣는 중", smile: "기분 좋음", proud: "으쓱으쓱", think: "곰곰이 생각 중…", serious: "진지하게 듣는 중", panic: "당황! 땀이 삐질" };

  /* ---------- 저장 — 이 브라우저에만(학생 정보 없음 · 자료 카드와 프롬프트뿐) ---------- */
  const STORE = "principal-bot-lab.mine.v1", SCORE = "principal-bot-lab.score.v1";
  function fresh() {
    return { cards: BASE.cards.map((c) => ({ id: c.id, content: c.content, keywords: c.keywords.slice() })),
             opening: BASE.persona.OPENING, prompt: BASE.persona.SYSTEM_PROMPT, edited: {} };
  }
  function loadMine() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && Array.isArray(s.cards) && typeof s.prompt === "string") return s; } catch (e) { /* 막힌 브라우저 */ }
    return fresh();
  }
  let mine = loadMine();
  function saveMine() {
    try { localStorage.setItem(STORE, JSON.stringify(mine)); $("mkSaved").textContent = "✓ 이 브라우저에 저장됨"; }
    catch (e) { $("mkSaved").textContent = "⚠ 저장이 막혀 있다 — 내려받아 두세요"; }
  }
  const myPersona = () => ({ WELCOME: BASE.persona.WELCOME, OPENING: mine.opening, SYSTEM_PROMPT: mine.prompt });

  /* ---------- 알림 ---------- */
  let toastTimer = 0;
  function toast(msg, kind) {
    const t = $("toast");
    t.textContent = msg; t.className = "toast" + (kind === "info" ? " info" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* =========================================================
     대화창 부품 — 실험실과 사건 수사가 함께 쓴다
     ========================================================= */
  function makeChat(el, opt) {
    el.innerHTML =
      '<div class="chat-head"><div class="facebox"></div><div class="grow"><div class="who">가상 교장선생님 <span class="ai">AI</span></div>' +
      '<div class="mood"></div></div><button type="button" class="btn sm again" title="방금 한 말을 한 번 더 보낸다(스위치를 바꾼 뒤 비교할 때)">↻ 다시 묻기</button>' +
      '<button type="button" class="btn sm reset">↺ 새 대화</button></div>' +
      '<div class="msgs" aria-live="polite"></div><div class="chips"></div>' +
      '<form class="ask"><input maxlength="120" autocomplete="off" placeholder="교장선생님께 말 걸기…" aria-label="교장선생님께 할 말"><button type="submit">보내기</button></form>';
    const msgs = el.querySelector(".msgs"), input = el.querySelector("input"), chips = el.querySelector(".chips");
    let lastQ = "";
    chips.innerHTML = M.deck.map((d) => `<button type="button" data-q="${esc(d.q)}" data-k="${d.key}" title="${esc(d.q)}">${esc(d.label)}</button>`).join("");
    function send(q) {
      q = String(q || "").trim();
      if (!q) return;
      lastQ = q;
      opt.ask(q);
    }
    el.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); send(input.value); input.value = ""; input.focus(); });
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      b.classList.add("used"); send(b.dataset.q);
    });
    el.querySelector(".again").addEventListener("click", () => send(lastQ));
    el.querySelector(".reset").addEventListener("click", () => opt.reset());

    return {
      el,
      add(role, text, extra) {
        extra = extra || {};
        const d = document.createElement("div");
        const inc = extra.incident;
        d.className = "msg " + role + (inc ? (inc.level === "red" ? " bad" : " warn") : "");
        d.textContent = text;
        if (extra.notes && extra.notes.length) {
          const w = document.createElement("div"); w.className = "why";
          w.innerHTML = extra.notes.map((n) => `<span>${esc(n)}</span>`).join("");
          d.appendChild(w);
        }
        if (inc) {
          const b = document.createElement("div"); b.className = "boom";
          b.textContent = "🚨 사고 — " + inc.title + " · 꺼진 스위치 : " + ruleOf(inc.rule).icon + " " + ruleOf(inc.rule).name;
          d.appendChild(b);
        }
        msgs.appendChild(d);
        msgs.scrollTop = msgs.scrollHeight;
        return d;
      },
      face(f) {
        el.querySelector(".facebox").innerHTML = PBFace.svg(f);
        el.querySelector(".mood").textContent = MOOD[f] || "";
      },
      clear() { msgs.innerHTML = ""; lastQ = ""; chips.querySelectorAll(".used").forEach((b) => b.classList.remove("used")); },
      lastQ: () => lastQ
    };
  }

  /* 스위치 그리기 — 실험실(켜고 끄기)과 지목(고르기)이 함께 쓴다 */
  function drawSwitches(box, isOn, label) {
    box.innerHTML = RULES.map((r) => {
      const on = isOn(r.key);
      return `<button type="button" class="sw${r.pipe ? " pipe" : ""}" data-k="${r.key}" aria-pressed="${on}" title="${esc(r.tip)}">` +
        `<span class="ic">${r.icon}</span><span><span class="nm">${esc(r.name)}</span><br><span class="st">${label(r.key, on)}</span></span></button>`;
    }).join("");
  }

  /* 점수 순위 그리기 — 실험실 «자료 검색» 과 «검색 시험» 이 함께 쓴다 */
  function rankHtml(s, n) {
    const top = s.order.slice(0, n).filter((i) => s.scores[i] > 0);
    if (!top.length) return '<div class="note red">모든 카드의 점수가 0 — 질문의 조각이 어느 카드에도 없다.</div>';
    const max = s.scores[top[0]];
    return top.map((i, k) => {
      const c = s.cardsRef[i];
      const w = Math.max(4, Math.round(s.scores[i] / max * 100));
      return `<div class="rank${k === 0 ? " win" : ""}${mine.edited[c.id] ? " mine" : ""}"><span class="no">${k + 1}</span><span class="id">${esc(c.id)}</span>` +
        `<span class="bar"><i style="width:${w}%"></i><span>${esc(c.keywords.slice(0, 3).join(" · "))}</span></span><span class="sc">${s.scores[i].toFixed(2)}</span></div>`;
    }).join("");
  }

  /* =========================================================
     ① 실험실
     ========================================================= */
  const lab = { rules: PBBot.allOn(), bot: null, last: null, incidents: [], tab: "search", dirty: false };
  const labChat = makeChat($("labChat"), { ask: labAsk, reset: labReset });

  function labReset() {
    lab.bot = PBBot.create({ cards: mine.cards, persona: myPersona() });
    lab.last = null; lab.dirty = false;
    labChat.clear();
    labChat.add("sys", "[교장실 문 앞] 문이 반쯤 열려 있다. 아래 단추를 누르거나 직접 말을 걸어 보자.");
    labChat.add("bot", mine.opening);
    labChat.face("smile");
    renderInsp();
  }
  function labAsk(q) {
    const r = lab.bot.ask(q, lab.rules);
    lab.last = r;
    labChat.add("me", q);
    labChat.add("bot", r.reply, { notes: r.notes, incident: r.incident });
    labChat.face(r.face);
    if (r.dropped.length) labChat.add("sys", `🧠 가장 오래된 대화 ${r.dropped.length / 2}회가 기억(최근 6회) 밖으로 밀려났다`);
    if (r.incident) {
      lab.incidents.unshift(Object.assign({ q, turn: r.turn }, r.incident));
      toast("🚨 사고 발생! " + r.incident.title);
    }
    renderInsp();
  }
  function drawLabSwitches() {
    drawSwitches($("labSwitches"), (k) => lab.rules[k], (k, on) => (on ? "켜짐" : "꺼짐 — 프롬프트에서 빠짐"));
  }
  $("labSwitches").addEventListener("click", (e) => {
    const b = e.target.closest(".sw"); if (!b) return;
    const k = b.dataset.k;
    lab.rules[k] = !lab.rules[k];
    drawLabSwitches();
    labChat.add("sys", `${ruleOf(k).icon} «${ruleOf(k).name}» 스위치를 ${lab.rules[k] ? "켰다" : "껐다"} — 다음 질문부터 적용`);
    if (lab.tab === "prompt") renderInsp();
  });
  $("allOn").addEventListener("click", () => { lab.rules = PBBot.allOn(); drawLabSwitches(); labChat.add("sys", "모든 스위치를 켰다"); });

  document.querySelector(".tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-itab]"); if (!b) return;
    lab.tab = b.dataset.itab;
    document.querySelectorAll(".tabbar [data-itab]").forEach((x) => x.classList.toggle("on", x === b));
    renderInsp();
  });

  function renderInsp() {
    $("logCount").textContent = lab.incidents.length;
    const body = $("inspBody");
    if (lab.tab === "log") { body.innerHTML = logHtml(); return; }
    const r = lab.last;
    if (!r) {
      body.innerHTML = '<div class="empty">교장선생님께 말을 걸면 여기에서 챗봇 속을 들여다볼 수 있다.<br><br>' +
        '🔍 <b>자료 검색</b> — 질문을 2글자 조각으로 잘라 자료 카드 ' + mine.cards.length + '장에 점수를 매기고 1등 한 장을 고른다.<br>' +
        '🧩 <b>프롬프트 조립</b> — 성격·말투 + 고른 자료 + 최근 대화가 한 덩어리가 되어 모델에게 간다.<br>' +
        '🚨 <b>사고 기록</b> — 스위치를 끈 탓에 생긴 일이 쌓인다.</div>';
      return;
    }
    body.innerHTML = lab.tab === "search" ? searchHtml(r) : promptHtml(r);
    body.scrollTop = 0;
  }

  function searchHtml(r) {
    const s = Object.assign({ cardsRef: lab.bot.cards }, r.search);
    const ragOff = r.prompt.evidence === "(자료 검색 꺼짐)";
    const cnt = {};
    s.tokens.forEach((t) => { cnt[t] = (cnt[t] || 0) + 1; });
    const toks = Object.keys(cnt).map((t) => `<span class="tok${s.detail[t] ? " hit" : ""}" title="${s.detail[t] ? "1등 카드에서 +" + s.detail[t].toFixed(2) : "1등 카드에는 없음"}">${esc(t)}${cnt[t] > 1 ? " ×" + cnt[t] : ""}</span>`).join("");
    let chosen;
    if (s.best < 0) chosen = '<div class="chosen off"><div class="lab">모델에게 가는 자료</div>«관련 학교 자료가 검색되지 않았다.» — 점수가 모두 0 이라 카드를 하나도 고르지 못했다.</div>';
    else chosen = (ragOff ? '<div class="note red">🔍 «자료 검색» 스위치가 꺼져 있다 — 이 1등 카드도 모델에게 <b>가지 않았다.</b></div>' : "") +
      `<div class="chosen${ragOff ? " off" : ""}"><div class="lab">${ragOff ? "버려진 1등 카드" : "→ 모델에게 가는 자료(1등 카드)"}</div>${esc(PBSearch.evidenceOf(s.card))}</div>`;
    return `<div class="hint">① 검색어 = <b>지금 말 × 2 + 바로 앞 말</b> (지금 말을 더 중요하게)</div><div class="q-line">${esc(s.query)}</div>` +
      `<div class="hint">② 2글자 조각 ${s.tokens.length}개 — <span class="tok hit">노란 조각</span> = 1등 카드에서 점수를 얻은 조각</div><div class="toks">${toks || '<span class="hint">(조각 없음)</span>'}</div>` +
      `<div class="hint">③ 카드 ${s.scores.length}장의 BM25 점수 — 드문 조각이 많이 겹칠수록 높다 · <b>1등 한 장만</b> 모델에게 간다</div>${rankHtml(s, 5)}${chosen}`;
  }

  function promptHtml(r) {
    const p = r.prompt;
    const offN = p.lines.filter((l) => l.off).length;
    let chars = p.question.length;
    const lines = p.lines.map((l) => {
      const rule = l.rule ? ruleOf(l.rule) : null;
      let t = esc(l.text)
        .replace("{intro}", `<span class="fill">${esc(p.intro || "(비어 있음 — 대화 기억 꺼짐)")}</span>`)
        .replace("{evidence}", `<span class="fill ev">${esc(p.evidence)}</span>`);
      if (!l.off) chars += l.text.length + 1;
      return `<div class="pl${rule ? " tagged" : ""}${l.off ? " off" : ""}">${t}${rule ? `<span class="rt">${rule.icon} ${esc(rule.name)}${l.off ? " — 꺼짐" : ""}</span>` : ""}</div>`;
    }).join("");
    chars += p.intro.length + p.evidence.length;
    p.history.forEach((m) => { chars += m.text.length; });
    const hist = !lab.rules.memory && !p.history.length && r.turn > 1
      ? '<div class="note red">🧠 «대화 기억» 꺼짐 — 지난 대화가 하나도 들어가지 않는다. 모델에게 이 학생은 늘 처음 보는 사람이다.</div>'
      : (p.history.length ? '<div class="hist">' + p.history.map((m) => `<div class="${m.role === "human" ? "h" : "a"}">${m.role === "human" ? "🙋 학생" : "🧑‍🏫 교장"} : ${esc(m.text)}</div>`).join("") + "</div>"
                          : '<div class="hint">(아직 지난 대화가 없다)</div>');
    const gone = r.dropped.length ? '<div class="hint" style="margin-top:6px">이번 차례가 끝나며 밀려난 대화(다음 차례부터 모델이 못 본다) :</div><div class="hist">' +
      r.dropped.map((m) => `<div class="gone">${m.role === "human" ? "🙋" : "🧑‍🏫"} ${esc(m.text)}</div>`).join("") + "</div>" : "";
    return `<div class="pstat"><span>시스템 프롬프트 ${p.lines.length}줄</span><span class="${offN ? "bad" : ""}">꺼진 줄 ${offN}</span>` +
      `<span>최근 대화 ${p.history.length}/12</span><span>모델이 읽는 글 약 ${chars.toLocaleString()}자</span>` +
      (offN ? '<button type="button" class="btn sm" id="toOff">꺼진 줄로 ↓</button>' : "") + "</div>" +
      `<div class="psec">📜 시스템 프롬프트 <span class="hint">(색 띠 = 스위치가 켜고 끄는 줄 · <span class="fill">첫 말</span> · <span class="fill ev">찾은 자료</span>)</span></div>` +
      `<div class="ptext">${lines}</div><div class="psec">💬 최근 대화 (메시지 12개 = 6회까지)</div>${hist}${gone}` +
      `<div class="psec">❓ 지금 질문</div><div class="q-line">${esc(p.question)}</div>`;
  }
  $("inspBody").addEventListener("click", (e) => {
    if (e.target.id === "toOff") { const o = $("inspBody").querySelector(".pl.off"); if (o) o.scrollIntoView({ block: "center" }); }
  });

  function logHtml() {
    if (!lab.incidents.length) return '<div class="empty">아직 사고가 없다. 스위치를 하나 끄고 그 스위치와 관계있는 질문을 던져 보자.<br>예) 🛟 진지 모드를 끄고 «🆘 위기» · 🚫 지어내지 않기를 끄고 «📅 학교 일정»</div>';
    return lab.incidents.map((x) => `<div class="inc ${x.level === "red" ? "" : "yellow"}"><h4>${x.level === "red" ? "🚨" : "⚠"} ${esc(x.title)}</h4>` +
      `<div class="q">${x.turn}번째 말 · «${esc(x.q)}» · 꺼진 스위치 ${ruleOf(x.rule).icon} ${esc(ruleOf(x.rule).name)}</div><p>${esc(x.why)}</p></div>`).join("");
  }

  /* =========================================================
     ② 고장난 교장봇
     ========================================================= */
  const HOW = { serious: "🆘 위기", nofake: "📅 학교 일정 · 🥋 없는 사실", honest: "🤖 정체 · 🎓 권한 밖", privacy: "🔒 남의 정보 · 😢 고민",
                rag: "📱 학교 규칙 · 😢 고민", memory: "🙋 자기소개 뒤 🧠 기억", dialect: "아무 질문(말투)", gag: "📜 명언" };
  const cs = { idx: 0, bot: null, qn: 0, picks: {}, log: [], team: 0, scores: [0, 0, 0, 0, 0, 0], done: {} };
  try { const s = JSON.parse(localStorage.getItem(SCORE)); if (s && Array.isArray(s.scores) && s.scores.length === 6) { cs.scores = s.scores; cs.done = s.done || {}; } } catch (e) { /* 없음 */ }
  const saveScore = () => { try { localStorage.setItem(SCORE, JSON.stringify({ scores: cs.scores, done: cs.done })); } catch (e) { /* 막힘 */ } };
  const caseChat = makeChat($("caseChat"), { ask: caseAsk, reset: () => openCase(cs.idx) });
  const curCase = () => M.cases[cs.idx];
  const caseRules = (c) => { const r = PBBot.allOn(); c.off.forEach((k) => { r[k] = false; }); return r; };
  const doneKey = (no) => cs.team + "-" + no;

  function openCase(i) {
    cs.idx = i; cs.qn = 0; cs.picks = {}; cs.log = [];
    cs.bot = PBBot.create({ cards: BASE.cards, persona: BASE.persona });
    caseChat.clear();
    caseChat.add("sys", `사건 #${curCase().no} 교장봇이 켜졌다. 질문 카드를 골라 수사를 시작하자.`);
    caseChat.add("bot", BASE.persona.OPENING);
    caseChat.face("smile");
    drawCaseList(); drawMemo(); drawAccuse();
    const d = cs.done[doneKey(curCase().no)];
    $("verdict").innerHTML = d ? `<div class="verdict ${d.ok ? "good" : "bad"}"><h3>${d.ok ? "✅" : "❌"} 이미 지목한 사건</h3>이 모둠은 이 사건에서 ${d.pts}점을 받았다. 다른 사건으로 가 보자.</div>` : "";
    $("accuseBtn").disabled = !!d;
  }
  function caseAsk(q) {
    const r = cs.bot.ask(q, caseRules(curCase()));
    cs.qn++; cs.log.push({ q, r });
    caseChat.add("me", q);
    caseChat.add("bot", r.reply);                 // 수사 중에는 «왜?» 와 사고 표시를 숨긴다
    caseChat.face(r.face);
    drawMemo();
  }
  function drawCaseList() {
    $("caseList").innerHTML = M.cases.map((c, i) => {
      const d = cs.done[doneKey(c.no)];
      return `<button type="button" class="cs${i === cs.idx ? " on" : ""}" data-i="${i}"><span class="n">#${c.no}</span><span class="t">${esc(c.title)}</span><span class="r">${d ? (d.ok ? "✅" : "❌") : ""}</span></button>`;
    }).join("");
    $("teams").innerHTML = cs.scores.map((s, t) => `<button type="button" class="team${t === cs.team ? " on" : ""}" data-t="${t}">${t + 1}모둠 <b>${s}</b></button>`).join("") +
      '<button type="button" class="btn sm" id="scoreReset" style="grid-column:1/-1">↺ 점수판 비우기</button>';
  }
  function drawMemo() {
    const c = curCase();
    $("caseMemo").innerHTML = `<div class="head"><h2>📨 사건 #${c.no} · ${esc(c.title)}</h2><span class="qn">던진 질문 <b>${cs.qn}</b>개 · 지금 <b>${cs.team + 1}</b>모둠</span></div><p>«${esc(c.memo)}»</p>`;
  }
  function drawAccuse() {
    drawSwitches($("accuseSw"), (k) => !cs.picks[k], (k, on) => (on ? "괜찮아 보임" : "꺼졌다!"));
    $("accuseSw").querySelectorAll(".sw").forEach((b) => b.classList.toggle("pick", !!cs.picks[b.dataset.k]));
  }
  $("caseList").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) openCase(+b.dataset.i); });
  $("teams").addEventListener("click", (e) => {
    if (e.target.id === "scoreReset") {
      if (!confirm("모든 모둠의 점수와 지목 기록을 지울까요?")) return;
      cs.scores = [0, 0, 0, 0, 0, 0]; cs.done = {}; saveScore(); openCase(cs.idx); return;
    }
    const b = e.target.closest("[data-t]"); if (!b) return;
    cs.team = +b.dataset.t; openCase(cs.idx);
  });
  $("accuseSw").addEventListener("click", (e) => {
    const b = e.target.closest(".sw"); if (!b) return;
    cs.picks[b.dataset.k] = !cs.picks[b.dataset.k]; drawAccuse();
  });
  function accuse() {
    const c = curCase(), key = doneKey(c.no);
    if (cs.done[key]) return null;
    const picked = RULES.map((r) => r.key).filter((k) => cs.picks[k]);
    if (!picked.length) { toast("꺼졌다고 생각하는 스위치를 먼저 고르세요", "info"); return null; }
    const ok = picked.length === c.off.length && c.off.every((k) => cs.picks[k]);
    const pts = ok ? Math.max(4, 10 - Math.max(0, cs.qn - 3)) : 0;
    cs.done[key] = { ok, pts }; cs.scores[cs.team] += pts; saveScore();
    const seen = cs.log.filter((x) => x.r.incident && c.off.includes(x.r.incident.rule));
    $("verdict").innerHTML = `<div class="verdict ${ok ? "good" : "bad"}"><h3>${ok ? "✅ 정답! +" + pts + "점" : "❌ 아쉽다! 0점"}</h3>` +
      `꺼진 스위치 : <b>${c.off.map((k) => ruleOf(k).icon + " " + ruleOf(k).name).join(" · ")}</b>` +
      (seen.length ? "<ul>" + seen.map((x) => `<li>«${esc(x.q)}» → ${esc(x.r.incident.title)}</li>`).join("") + "</ul>" : "") +
      `<div class="hint" style="margin-top:6px">이 스위치를 드러내는 질문 : ${c.off.map((k) => HOW[k]).join(" / ")}</div></div>`;
    $("accuseBtn").disabled = true;
    drawCaseList(); drawMemo();
    toast(ok ? `✅ ${cs.team + 1}모둠 정답! +${pts}점` : "❌ 범인은 따로 있었다!", ok ? "info" : "");
    return { ok, pts };
  }
  $("accuseBtn").addEventListener("click", accuse);

  /* =========================================================
     ③ 내 교장봇
     ========================================================= */
  let selId = null;
  function nextId() { let n = 1; while (mine.cards.some((c) => c.id === "M" + String(n).padStart(2, "0"))) n++; return "M" + String(n).padStart(2, "0"); }
  function drawList() {
    const f = $("mkFilter").value.trim();
    const list = mine.cards.filter((c) => !f || c.content.includes(f) || c.keywords.join(",").includes(f) || c.id.includes(f.toUpperCase()));
    $("mkList").innerHTML = list.map((c) => `<button type="button" class="ci${mine.edited[c.id] ? " mine" : ""}${c.id === selId ? " sel" : ""}" data-id="${esc(c.id)}">` +
      `<b>${esc(c.id)}${mine.edited[c.id] ? " ★" : ""}</b>${esc(c.content.length > 70 ? c.content.slice(0, 70) + "…" : c.content)}<span class="kw">🔑 ${esc(c.keywords.join(", "))}</span></button>`).join("");
    $("mkCount").textContent = `${mine.cards.length}장 · 우리가 만들거나 고친 것 ${Object.keys(mine.edited).length}장`;
    $("mkShown").textContent = f ? `${list.length}장` : "";
  }
  function selectCard(id) {
    selId = id;
    const c = mine.cards.find((x) => x.id === id);
    $("mkContent").value = c ? c.content : ""; $("mkKeys").value = c ? c.keywords.join(", ") : "";
    $("mkSave").textContent = c ? "💾 " + id + " 고친 내용 저장" : "＋ 카드 추가";
    $("mkNew").hidden = $("mkDel").hidden = !c;
    drawList();
  }
  function changed() { saveMine(); drawList(); lab.dirty = true; }
  function saveCard() {
    const content = $("mkContent").value.trim();
    const keywords = $("mkKeys").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (content.length < 5) { toast("내용을 한 문장 이상 적어 주세요", "info"); return null; }
    if (!keywords.length) { toast("검색어를 하나 이상 적어 주세요(쉼표로 나눔)", "info"); return null; }
    let c = mine.cards.find((x) => x.id === selId);
    if (c) { c.content = content; c.keywords = keywords; }
    else { c = { id: nextId(), content, keywords }; mine.cards.push(c); }
    mine.edited[c.id] = true;
    changed(); selectCard(c.id);
    toast(`💾 ${c.id} 저장 — 실험실에서도 이 카드를 찾는다`, "info");
    if ($("mkQ").value.trim()) tryQ();
    return c.id;
  }
  function tryQ() {
    const q = $("mkQ").value.trim();
    if (!q) { $("mkRank").innerHTML = ""; return; }
    const s = PBSearch.search(PBSearch.build(mine.cards), q, "");
    s.cardsRef = mine.cards;
    const win = s.card;
    $("mkRank").innerHTML = rankHtml(s, 5) + (win ? `<div class="chosen"><div class="lab">1등 → ${esc(win.id)}${mine.edited[win.id] ? " ★ 우리 카드!" : ""}</div>${esc(win.content)}</div>` : "");
  }
  $("mkList").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) selectCard(b.dataset.id); });
  $("mkSave").addEventListener("click", saveCard);
  $("mkNew").addEventListener("click", () => selectCard(null));
  $("mkDel").addEventListener("click", () => {
    if (!selId || !confirm(selId + " 카드를 뺄까요?")) return;
    mine.cards = mine.cards.filter((c) => c.id !== selId); delete mine.edited[selId];
    changed(); selectCard(null);
  });
  $("mkFilter").addEventListener("input", drawList);
  $("mkTry").addEventListener("click", tryQ);
  $("mkQ").addEventListener("keydown", (e) => { if (e.key === "Enter") tryQ(); });
  $("mkOpening").addEventListener("input", (e) => { mine.opening = e.target.value; saveMine(); lab.dirty = true; });
  $("mkPrompt").addEventListener("input", (e) => { mine.prompt = e.target.value; saveMine(); lab.dirty = true; });
  $("mkReset").addEventListener("click", () => {
    if (!confirm("우리가 만든 카드와 고친 프롬프트를 모두 지우고 처음 자료로 되돌릴까요?\n(먼저 내려받아 두면 안전합니다)")) return;
    mine = fresh(); saveMine(); fillMake(); lab.dirty = true;
  });

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  /* 실습(persona-core)이 읽는 모양 그대로 — {"documents":[{id, content, keywords}]} */
  const dataJson = () => JSON.stringify({ documents: mine.cards.map((c) => ({ id: c.id, content: c.content, keywords: c.keywords })) }, null, 2);
  const pyStr = (s) => '"""\n' + String(s).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"') + '\n"""';
  const promptPy = () => "# 교장봇 연구소에서 내려받은 프롬프트\n# persona-core/app.py 의 같은 이름 변수 세 개를 이 내용으로 바꾸세요.\n\n" +
    "WELCOME = " + pyStr(BASE.persona.WELCOME) + "\n\nOPENING = " + JSON.stringify(mine.opening) + "\n\nSYSTEM_PROMPT = " + pyStr(mine.prompt) + "\n";
  $("dlData").addEventListener("click", () => download("data.json", dataJson(), "application/json"));
  $("dlPrompt").addEventListener("click", () => download("교장봇_프롬프트.py", promptPy(), "text/x-python"));

  function fillMake() {
    $("mkOpening").value = mine.opening; $("mkPrompt").value = mine.prompt;
    selectCard(null); tryQ();
  }

  /* =========================================================
     화면 고르기
     ========================================================= */
  function go(name) {
    if (!["lab", "case", "make"].includes(name)) name = "lab";
    ["lab", "case", "make"].forEach((s) => { $(s).hidden = s !== name; });
    document.querySelectorAll(".nav [data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
    if (name === "lab" && lab.dirty) { labReset(); toast("내 교장봇 자료로 대화를 새로 시작합니다", "info"); }
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }
  document.querySelector(".nav").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });

  drawLabSwitches(); labReset();
  openCase(0); fillMake();
  go(location.hash.slice(1));

  /* 검사용 손잡이(tools/검사/verify_file.cjs) — 학생 화면에는 영향 없음 */
  window.PBApp = { lab, cs, labAsk, caseAsk, openCase, accuse, go, saveCard, tryQ, dataJson, promptPy, mine: () => mine, labChat, caseChat };
})();
