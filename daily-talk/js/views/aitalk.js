// 🤖 AI 자유대화 + 대화 복습 다섯 단계 (설계서 「4-8」)
//   #/ai            상황 · 수준 · 방식 고르기, 지난 대화
//   #/ai/talk       대화 (AI 가 먼저 말 검 · 대화 중에는 고치지 않음 · 💡 도움 · 대화 끝내기)
//   #/ai/c/<id>     복습 ① 교정본 ② 따라 하기 ③ 다시 대화 ④ 카드 ⑤ 상황별 대화에 추가
//   #/ai/c/<id>/redo  ③ 같은 상황으로 다시 대화
import { h, fill, toast, icon } from '../ui.js';
import { settings } from '../settings.js';
import { loadSituations, loadDialogue, dialogueId, LEVEL_KO, learnerRole } from '../content.js';
import { get, put, del, entries } from '../db.js';
import * as ai from '../ai/providers.js';
import * as P from '../ai/prompts.js';
import * as speech from '../speech.js';
import * as audio from '../audio.js';
import { speak, canSpeak } from '../tts.js';
import { compare, normalize } from '../textmatch.js';
import { answerInput, micButton, resultView } from '../answer.js';
import { addCards, addTime } from '../record.js';

const HANGUL = /[가-힣ㄱ-ㆎ]/;
const METHOD = { voice: '🎤 음성 대화', chat: '💬 채팅 대화' };
const STEPS = ['review', 'follow', 'redo', 'cards', 'custom'];
const key = (text) => normalize(text).join(' ');     // 문장 비교용 (대소문자 · 문장부호 · 줄임말 무시)
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fmtDate = (t) => new Date(t).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const stopSound = () => { audio.stop(); if (canSpeak()) speechSynthesis.cancel(); };
const sayBtn = (text, lang = 'en-US', label = '듣기') => (canSpeak()
  ? h('button', { type: 'button', class: 'say-btn', 'aria-label': label, html: icon('play', 16), onclick: () => speak(text, lang) }) : null);

function seg(name, value, options, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map(([v, label, disabled]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), disabled: !!disabled,
      onclick: (e) => {
        for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', 'false');
        e.currentTarget.setAttribute('aria-checked', 'true');
        onChange(v);
      } }, label)));
}

// AI 답에서 이름표 · 따옴표 떼기
function tidy(text) {
  let t = String(text).trim().split('\n').filter((x) => x.trim()).join(' ');
  t = t.replace(/^\s*(?:A|AI)\s*:\s*/i, '');
  const q = t.match(/^["“'](.*)["”']$/s);
  return (q ? q[1] : t).trim();
}

let live = null;   // 진행 중인 대화 { sit, level, method, messages, providers:Set, started, redoOf, targets }

async function sitFromList(domId, sitId, level) {
  const data = await loadSituations();
  const dom = data.domains.find((d) => d.id === domId);
  const x = dom.situations.find((s) => s.id === sitId);
  let d = null;
  try { d = await loadDialogue(dialogueId(domId, sitId, level)); } catch { /* 대화가 없으면 역할은 AI 가 정함 */ }
  const me = d ? learnerRole(d) : null;
  const other = d ? Object.keys(d.roles).find((k) => k !== me) : null;
  return {
    kind: 'list', domain: domId, id: sitId, ko: x.ko, en: x.en || d?.title?.en || '', scene: d?.scene?.ko || '',
    ai: d ? { ko: d.roles[other].ko, en: d.roles[other].en } : null,
    me: d ? { ko: d.roles[me].ko, en: d.roles[me].en } : null,
  };
}

// ── #/ai — 고르기 · 지난 대화
export async function aiStart() {
  const s = settings();
  const ok = await ai.hasAI();
  const chats = (await entries('aiChats')).map(([, v]) => v).filter((v) => v?.id).sort((a, b) => b.created - a.created);
  const page = h('div', { class: 'page ai' },
    h('a', { class: 'back', href: '#/home', html: `${icon('back', 18)}<span>홈</span>` }),
    h('h1', {}, '🤖 AI 자유대화'),
    h('p', { class: 'lead' }, 'AI 가 상대 역할을 맡아 먼저 말을 걸어요. 대화 중에는 고치지 않고 이어 가고, 끝난 뒤 다섯 단계로 복습해요.'));

  if (live && !live.redoOf && live.messages.length) {
    page.append(h('section', { class: 'card ai-live' },
      h('p', {}, h('b', {}, '하던 대화가 있어요 — '), live.sit.ko, ` (${live.messages.length}마디)`),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn primary', href: '#/ai/talk' }, '이어서 하기'),
        h('button', { type: 'button', class: 'btn ghost', onclick: (e) => { live = null; e.currentTarget.closest('section').remove(); } }, '버리기'))));
  }

  if (!ok) {
    page.append(h('section', { class: 'card' },
      h('h2', {}, 'AI 키가 필요해요'),
      h('p', {}, '큐웬 · 업스테이지 · 제미나이 · 오픈AI 중 한 곳의 키를 넣으면 시작할 수 있어요. 키는 이 휴대폰 안에만 저장돼요.'),
      h('p', { class: 'note' }, '쓴 만큼 각 회사에서 요금이 나가요. 키를 만든 회사 콘솔에서 «월 사용 한도» 를 꼭 걸어 두세요.'),
      h('a', { class: 'btn primary', href: '#/settings/ai' }, '설정 → 🤖 AI 에서 키 넣기')));
  } else {
    const data = await loadSituations();
    const doms = data.domains.filter((d) => s.domains.includes(d.id));
    const sel = h('select', { id: 'ai-sit', class: 'ai-sit', 'aria-label': '상황' },
      doms.map((d) => h('optgroup', { label: `${d.emoji} ${d.ko}` }, d.situations.map((x) => h('option', { value: `${d.id}~${x.id}` }, x.ko)))));
    const custom = h('textarea', { id: 'ai-custom', class: 'ai-custom', rows: '2', hidden: true, placeholder: '예: 에어비앤비 주인에게 늦은 체크인 부탁하기', 'aria-label': '상황 직접 쓰기' });
    let src = 'list'; let level = s.level || 1; let method = s.mode === 'speak' ? 'voice' : 'chat';
    const pickRandom = h('button', { type: 'button', class: 'linkish', onclick: () => { sel.selectedIndex = Math.floor(Math.random() * sel.options.length); } }, '🎲 아무거나');
    const start = h('button', { type: 'button', class: 'btn primary big' }, '대화 시작');
    start.addEventListener('click', async () => {
      let sit;
      if (src === 'custom') {
        const v = custom.value.trim();
        if (v.length < 4) { toast('어떤 상황인지 조금 더 써 주세요.'); custom.focus(); return; }
        sit = { kind: 'custom', ko: v.slice(0, 200), en: '' };
      } else {
        const [domId, sitId] = sel.value.split('~');
        sit = await sitFromList(domId, sitId, level);
      }
      live = { sit, level, method, messages: [], providers: new Set(), started: Date.now(), redoOf: null };
      location.hash = '#/ai/talk';
    });
    page.append(h('section', { class: 'card ai-form' },
      h('h2', {}, '1. 상황'),
      seg('상황 고르는 법', src, [['list', '목록에서 고르기'], ['custom', '직접 쓰기']], (v) => { src = v; sel.hidden = v !== 'list'; pickRandom.hidden = v !== 'list'; custom.hidden = v !== 'custom'; if (v === 'custom') custom.focus(); }),
      sel, pickRandom, custom,
      h('h2', {}, '2. 수준'),
      seg('수준', level, [[1, LEVEL_KO[1]], [2, LEVEL_KO[2]], [3, LEVEL_KO[3]]], (v) => { level = v; }),
      h('p', { class: 'note' }, 'AI 가 이 수준에 맞춰 문장 길이와 단어를 골라요.'),
      h('h2', {}, '3. 방식'),
      seg('대화 방식', method, [['voice', METHOD.voice, !speech.canRecognize()], ['chat', METHOD.chat]], (v) => { method = v; }),
      s.mode === 'listen' ? h('p', { class: 'note' }, '🎧 듣기 모드예요. 화면을 보기 어려우면 채팅으로 할까요? 소리는 켜고 끌 수 있어요.') : null,
      speech.canRecognize() ? null : h('p', { class: 'note' }, '이 브라우저는 음성 인식이 안 돼서 채팅으로 해요.'),
      start));
  }

  const list = h('ol', { class: 'ai-past' });
  const drawPast = () => fill(list, chats.map((c) => {
    const n = STEPS.filter((k) => c.steps?.[k]).length;
    return h('li', {},
      h('a', { href: `#/ai/c/${c.id}` },
        h('b', {}, c.review?.title || c.sit.ko),
        h('span', { class: 'note' }, `${fmtDate(c.created)} · ${LEVEL_KO[c.level]} · ${METHOD[c.method]} · 복습 ${n}/5`)),
      h('button', { type: 'button', class: 'btn ghost small', 'aria-label': '이 대화 기록 지우기', onclick: async () => {
        if (!window.confirm('이 대화 기록을 지울까요? (상황별 대화에 추가한 것은 남아요)')) return;
        await del('aiChats', c.id); chats.splice(chats.indexOf(c), 1); drawPast();
      } }, '지우기'));
  }));
  drawPast();
  if (chats.length) page.append(h('section', {}, h('h3', { class: 'sec' }, '지난 대화 — 눌러서 복습'), list));
  return page;
}

// ── #/ai/talk — 대화
export function aiTalk() {
  if (!live) { setTimeout(() => location.replace('#/ai'), 0); return h('p', { class: 'loading' }, '…'); }
  const L = live;
  const s = settings();
  const sound = L.method === 'voice' || s.chatSound;
  const log = h('ol', { class: 'chat messenger ai-chat', 'aria-live': 'polite' });
  const who = h('p', { class: 'note ai-who' });
  const tray = h('div', { class: 'ai-tray' });
  let busy = false;
  const sys = P.talkSystem(L.sit, L.level);
  const toAPI = () => [{ role: 'system', content: sys }, { role: 'user', content: P.START },
    ...L.messages.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))];

  const bubble = (m) => {
    const b = h('li', { class: `bubble${m.role === 'me' ? ' mine' : ''}` },
      h('span', { class: 'who-name' }, m.role === 'ai' ? (L.sit.ai?.ko || 'AI') : '나'),
      h('p', { class: 'en', lang: 'en' }, m.text),
      m.role === 'ai' ? sayBtn(m.text, 'en-US', '다시 듣기') : null);
    log.append(b);
    b.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  };

  const aiTurn = async () => {
    busy = true; drawTray();
    const typing = h('li', { class: 'bubble typing', 'aria-label': 'AI 가 쓰는 중' }, h('span', { class: 'dots' }, '• • •'));
    log.append(typing);
    try {
      const r = await ai.ask(toAPI(), { onTry: (p) => { who.textContent = `${p.name} 에게 묻는 중…`; } });
      const m = { role: 'ai', text: tidy(r.text), by: r.provider.name };
      L.messages.push(m); L.providers.add(r.provider.name);
      typing.remove();
      who.textContent = `이번 답: ${r.provider.name}`;
      if (!log.isConnected && /^#\/ai\/(talk|c\/)/.test(location.hash)) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
      bubble(m);
      if (sound) speak(m.text, 'en-US');
    } catch (e) {
      typing.remove();
      who.textContent = '';
      log.append(h('li', { class: 'ai-err' }, h('p', {}, e.message),
        h('button', { type: 'button', class: 'btn small', onclick: (ev) => { ev.currentTarget.parentNode.remove(); aiTurn(); } }, '다시 시도')));
    } finally { busy = false; drawTray(); }
  };

  const input = h('input', { type: 'text', class: 'answer-text', lang: 'en', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'sentences',
    spellcheck: 'false', enterkeyhint: 'send', placeholder: '영어로 답하기…', 'aria-label': '영어로 답하기' });
  const send = () => {
    const v = input.value.trim();
    if (!v || busy) return;
    if (HANGUL.test(v) && !/[a-z]/i.test(v)) { toast('영어로 써 보세요. 막히면 💡 도움을 누르세요.'); return; }
    input.value = '';
    stopSound();
    const m = { role: 'me', text: v };
    L.messages.push(m); bubble(m); help.hidden = true;
    aiTurn();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
  const sendBtn = h('button', { type: 'button', class: 'btn primary', onclick: send }, '보내기');
  const live2 = h('p', { class: 'note live', 'aria-live': 'polite' });
  const mic = speech.canRecognize() ? h('button', { type: 'button', class: `btn mic${L.method === 'voice' ? ' primary big' : ' ghost'}` }, '🎤 말하기') : null;
  mic?.addEventListener('click', async () => {
    if (mic.dataset.on) { speech.stopRecognize(); return; }
    stopSound();
    mic.dataset.on = '1'; mic.textContent = '■ 듣는 중… (누르면 멈춤)'; live2.textContent = '';
    try {
      const alts = await speech.recognize({ onInterim: (t) => { live2.textContent = t; } });
      live2.textContent = '';
      input.value = alts[0] || '';
      if (L.method === 'voice') send(); else input.focus();
    } catch (e) { live2.textContent = speech.speechError(e); } finally { delete mic.dataset.on; mic.textContent = '🎤 말하기'; }
  });

  // 💡 도움 — 한국어로 쓰면 영어 표현 2~3개
  const koIn = h('textarea', { rows: '2', class: 'ai-ko', placeholder: '하고 싶은 말을 한국어로 쓰세요', 'aria-label': '하고 싶은 말 (한국어)' });
  const helpOut = h('ul', { class: 'ai-help-out' });
  const helpGo = h('button', { type: 'button', class: 'btn small' }, '영어 표현 보기');
  helpGo.addEventListener('click', async () => {
    const ko = koIn.value.trim();
    if (!ko) { koIn.focus(); return; }
    helpGo.disabled = true; fill(helpOut, h('li', { class: 'note' }, '찾는 중…'));
    try {
      const lastAI = [...L.messages].reverse().find((m) => m.role === 'ai')?.text || '';
      const r = await ai.ask(P.helpMessages(L.sit, L.level, lastAI, ko), { json: true, check: P.helpOK });
      fill(helpOut, r.data.options.slice(0, 3).map((o) => h('li', {},
        h('div', {}, h('b', { lang: 'en' }, o.en), o.ko ? h('small', {}, o.ko) : null),
        sayBtn(o.en),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { input.value = o.en; input.focus(); } }, '쓰기'))));
    } catch (e) { fill(helpOut, h('li', { class: 'note' }, e.message)); } finally { helpGo.disabled = false; }
  });
  const help = h('div', { class: 'ai-help card', hidden: true },
    h('p', { class: 'note' }, '막힌 말을 한국어로 쓰면 영어 표현을 2~3개 보여 줘요. 고른 표현은 입력 칸에 들어가요.'), koIn, helpGo, helpOut);

  const finish = async () => {
    const mine = L.messages.filter((m) => m.role === 'me');
    stopSound();
    if (!mine.length) {
      if (!L.messages.length || window.confirm('아직 내가 한 말이 없어요. 이 대화를 버리고 나갈까요?')) { live = null; location.hash = L.redoOf ? `#/ai/c/${L.redoOf}` : '#/ai'; }
      return;
    }
    await addTime(L.method === 'voice' ? 'speak' : 'chat', (Date.now() - L.started) / 1000);
    live = null;
    if (L.redoOf) {
      const c = await get('aiChats', L.redoOf);
      if (c) {
        c.redo = { created: L.started, messages: L.messages, check: null };
        c.steps = { ...(c.steps || {}), redo: Date.now() };
        await put('aiChats', c.id, c);
        location.hash = `#/ai/c/${c.id}`;
        return;
      }
    }
    const id = newId('c');
    await put('aiChats', id, { id, created: L.started, ended: Date.now(), sit: L.sit, level: L.level, method: L.method,
      messages: L.messages, providers: [...L.providers], review: null, redo: null, steps: {} });
    location.hash = `#/ai/c/${id}`;
  };

  function drawTray() {
    sendBtn.disabled = busy;
    if (mic) mic.disabled = busy;
    const tools = h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { help.hidden = !help.hidden; if (!help.hidden) koIn.focus(); } }, '💡 도움'),
      h('button', { type: 'button', class: 'btn ghost', onclick: finish }, '대화 끝내기'));
    const typeRow = h('div', { class: 'answer-row' }, input, sendBtn);
    fill(tray, L.method === 'voice' ? [mic, live2, typeRow] : [typeRow, mic, live2], tools, help);
  }

  for (const m of L.messages) bubble(m);
  drawTray();
  if (!L.messages.length || L.messages[L.messages.length - 1].role === 'me') aiTurn();

  return h('div', { class: 'page ai-talk' },
    h('a', { class: 'back', href: L.redoOf ? `#/ai/c/${L.redoOf}` : '#/ai', html: `${icon('back', 18)}<span>${L.redoOf ? '복습으로' : 'AI 자유대화'}</span>` }),
    h('header', { class: 'dlg-head' },
      h('p', { class: 'eyebrow' }, `${L.redoOf ? '③ 다시 대화 · ' : ''}${LEVEL_KO[L.level]} · ${METHOD[L.method]}`),
      h('h1', {}, L.sit.ko),
      L.sit.ai ? h('p', { class: 'roles' }, `AI: ${L.sit.ai.ko} · 나: ${L.sit.me.ko}`) : null),
    L.targets?.length ? h('details', { class: 'card ai-targets' }, h('summary', {}, `써 볼 표현 ${L.targets.length}개 (지난번에 고친 말)`),
      h('ul', {}, L.targets.map((t) => h('li', { lang: 'en' }, t)))) : null,
    h('p', { class: 'note' }, '대화 중에는 고치지 않아요. 틀려도 괜찮으니 이어 가세요.'),
    log, who, tray);
}

// ── #/ai/c/<id>/redo — ③ 같은 상황으로 다시
export async function aiRedo(id) {
  const c = await get('aiChats', id);
  if (!c) throw new Error('대화 기록을 찾지 못했어요.');
  if (!(await ai.hasAI())) { location.replace('#/ai'); return h('p'); }
  if (!live || live.redoOf !== id) {
    live = { sit: c.sit, level: c.level, method: c.method, messages: [], providers: new Set(), started: Date.now(), redoOf: id,
      targets: targetsOf(c) };
  }
  return aiTalk();
}

const targetsOf = (c) => {
  if (!c.review) return [];
  const fixed = c.review.lines.filter((l) => l.changed).map((l) => l.en);
  return (fixed.length ? fixed : c.review.expressions.map((x) => x.en)).slice(0, 8);
};

// 교정본 정리 — 내 원래 문장은 실제 기록으로 채운다
function normalizeReview(data, c, by) {
  const mineMsgs = c.messages.filter((m) => m.role === 'me').map((m) => m.text);
  const bCount = data.lines.filter((l) => l.role === 'B').length;
  let b = 0;
  const lines = data.lines.map((l) => {
    const out = { role: l.role, en: String(l.en).trim(), ko: String(l.ko || '').trim() };
    if (l.role === 'B') {
      out.mine = bCount === mineMsgs.length ? mineMsgs[b] : String(l.mine || mineMsgs[b] || '').trim();
      b++;
      out.why = String(l.why || '').trim();
      out.changed = !!out.mine && key(out.mine) !== key(out.en);
      if (!out.changed) out.why = '';
    }
    return out;
  });
  const roles = data.roles || {};
  return {
    by, created: Date.now(),
    title: String(data.title || c.sit.ko).trim().slice(0, 40),
    scene: String(data.scene || '').trim(),
    roles: {
      A: { ko: roles.A?.ko || c.sit.ai?.ko || '상대', en: roles.A?.en || c.sit.ai?.en || 'Partner' },
      B: { ko: roles.B?.ko || c.sit.me?.ko || '나', en: roles.B?.en || c.sit.me?.en || 'Me' },
    },
    lines,
    expressions: (Array.isArray(data.expressions) ? data.expressions : []).filter((x) => x && typeof x.en === 'string' && x.en.trim())
      .slice(0, 8).map((x) => ({ en: x.en.trim(), ko: String(x.ko || '').trim(), note: String(x.note || '').trim() })),
  };
}

// ── #/ai/c/<id> — 복습 다섯 단계
export async function aiReview(id) {
  const c = await get('aiChats', id);
  if (!c) throw new Error('대화 기록을 찾지 못했어요.');
  const s = settings();
  c.steps = c.steps || {};
  const save = () => put('aiChats', c.id, c);
  const mark = async (k) => { c.steps[k] = c.steps[k] || Date.now(); await save(); };
  const hasKey = await ai.hasAI();
  const boxes = Object.fromEntries(STEPS.map((k) => [k, h('div', { class: 'step-body' })]));
  const drawAll = () => { draw1(); draw2(); draw3(); draw4(); draw5(); drawHead(); };
  const head = h('header', { class: 'dlg-head' });
  const secs = {};
  const drawHead = () => {
    for (const [k, sec] of Object.entries(secs)) {
      sec.classList.toggle('done', !!c.steps[k]);
      sec.querySelector('.n').textContent = c.steps[k] ? '✓' : sec.dataset.n;
    }
    fill(head,
    h('p', { class: 'eyebrow' }, `${fmtDate(c.created)} · ${LEVEL_KO[c.level]} · ${METHOD[c.method]}${c.providers?.length ? ` · ${c.providers.join(' · ')}` : ''}`),
    h('h1', {}, c.review?.title || c.sit.ko),
    c.review?.title ? h('p', { class: 'scene' }, c.sit.ko) : null,
    h('p', { class: 'note' }, `복습 ${STEPS.filter((k) => c.steps[k]).length} / 5`));
  };

  // ① 교정본
  const draw1 = () => {
    const box = boxes.review;
    if (!c.review) {
      const out = h('p', { class: 'note', 'aria-live': 'polite' });
      const go = h('button', { type: 'button', class: 'btn primary', disabled: !hasKey }, '✍️ 교정본 만들기');
      go.addEventListener('click', async () => {
        go.disabled = true; out.textContent = 'AI 가 고치는 중… (10~30초)';
        try {
          const r = await ai.ask(P.reviewMessages(c.sit, c.level, c.messages), { json: true, check: P.reviewOK,
            onTry: (p) => { out.textContent = `${p.name} 이(가) 고치는 중… (10~30초)`; } });
          c.review = normalizeReview(r.data, c, r.provider.name);
          await mark('review');
          drawAll();
        } catch (e) { out.textContent = e.message; go.disabled = false; }
      });
      fill(box, h('p', {}, '내가 한 말을 자연스러운 영어로 고친 대화문을 만들어요. 문장마다 «내 말 → 고친 말 → 왜» 를 보여 줘요.'),
        hasKey ? null : h('p', { class: 'note' }, 'AI 키가 있어야 해요 — 설정 → 🤖 AI'), go, out);
      return;
    }
    const R = c.review;
    const bs = R.lines.filter((l) => l.role === 'B');
    fill(box,
      h('p', { class: 'note' }, `내 문장 ${bs.length}개 중 고친 문장 ${bs.filter((l) => l.changed).length}개 · 고친 AI: ${R.by}`),
      h('ol', { class: 'fix-list' }, R.lines.map((l) => (l.role === 'A'
        ? h('li', { class: 'fx a' }, h('span', { class: 'who' }, 'A'),
          h('div', {}, h('p', { class: 'en', lang: 'en' }, l.en), l.ko ? h('p', { class: 'ko' }, l.ko) : null), sayBtn(l.en))
        : h('li', { class: `fx b${l.changed ? ' changed' : ''}` }, h('span', { class: 'who me' }, 'B'),
          h('div', {},
            l.changed ? h('p', { class: 'mine', lang: 'en' }, h('span', {}, '내 말 '), h('s', {}, l.mine)) : null,
            h('p', { class: 'en', lang: 'en' }, h('span', { class: l.changed ? 'tag-fix' : 'tag-ok' }, l.changed ? '고친 말 ' : '✓ 자연스러워요 '), l.en),
            l.why ? h('p', { class: 'why' }, `💡 ${l.why}`) : null,
            l.ko ? h('p', { class: 'ko' }, l.ko) : null),
          sayBtn(l.en))))),
      R.expressions.length ? h('div', { class: 'exprs' }, h('h4', {}, '배울 표현'),
        h('ul', {}, R.expressions.map((x) => h('li', {}, h('b', { lang: 'en' }, x.en), ' ', x.ko, x.note ? h('small', {}, x.note) : null)))) : null);
  };

  // ② 교정본으로 따라 하기
  const draw2 = () => {
    const box = boxes.follow;
    if (!c.review) { fill(box, h('p', { class: 'note' }, '① 교정본을 먼저 만드세요.')); return; }
    const bLines = c.review.lines.map((l, i) => ({ ...l, i })).filter((l) => l.role === 'B');
    if (s.mode === 'listen') {
      let stop = false;
      const play = h('button', { type: 'button', class: 'btn primary' }, '🎧 교정본 «뜻 함께» 듣기');
      play.addEventListener('click', async () => {
        if (play.dataset.on) { stop = true; stopSound(); return; }
        stop = false; play.dataset.on = '1'; play.textContent = '■ 멈추기';
        for (const l of c.review.lines) {
          if (stop) break;
          await speak(l.en, 'en-US');
          if (stop) break;
          if (l.ko) await speak(l.ko, 'ko-KR');
        }
        delete play.dataset.on; play.textContent = '🎧 교정본 «뜻 함께» 듣기';
        if (!stop) { await mark('follow'); drawHead(); }
      });
      fill(box, h('p', {}, '고친 대화를 영어 → 한국어 뜻 순서로 들려줘요(휴대폰 음성).'), play);
      return;
    }
    const run = () => {
      let k = 0; const score = { right: 0, close: 0, retry: 0 };
      const show = () => {
        if (k >= bLines.length) {
          fill(box, h('p', { class: 'lead' }, `끝! 맞음 ${score.right} · 거의 맞음 ${score.close} · 다시 ${score.retry}`),
            h('button', { type: 'button', class: 'btn ghost', onclick: run }, '한 번 더'));
          mark('follow').then(drawHead);
          return;
        }
        const ln = bLines[k];
        const prev = c.review.lines[ln.i - 1];
        const out = h('div', { class: 'out' });
        const next = h('button', { type: 'button', class: 'btn primary', hidden: true, onclick: () => { k++; show(); } }, k + 1 < bLines.length ? '다음 →' : '끝내기');
        const judge = (r, heard) => { score[r.verdict]++; fill(out, resultView(r, heard)); next.hidden = false; };
        const answers = [ln.en];
        let control;
        if (s.mode === 'speak' && speech.canRecognize()) {
          const [mb, lv] = micButton((alts) => {
            const best = alts.map((a) => ({ a, r: compare(a, answers, { speech: true }) })).sort((x, y) => y.r.score - x.r.score)[0];
            judge(best.r, best.a);
          });
          control = h('div', {}, h('div', { class: 'btn-row' }, mb, sayBtn(ln.en, 'en-US', '고친 문장 듣기')), lv);
        } else control = answerInput(ln.en, c.level, (v) => judge(compare(v, answers), v));
        fill(box,
          h('p', { class: 'eyebrow' }, `내 문장 ${k + 1} / ${bLines.length}`),
          prev && prev.role === 'A' ? h('p', { class: 'ai-prev' }, h('span', { class: 'who' }, 'A'), ' ', h('span', { lang: 'en' }, prev.en), sayBtn(prev.en)) : null,
          h('div', { class: 'card' }, h('p', { class: 'ko' }, ln.ko || '(뜻 없음)'), control),
          out, next);
      };
      show();
    };
    fill(box, h('p', {}, s.mode === 'speak' ? '고친 대화문에서 내 차례 문장을 뜻을 보고 말해 봐요.' : '고친 대화문에서 내 차례 문장을 뜻을 보고 써 봐요.'),
      h('button', { type: 'button', class: 'btn primary', onclick: run }, `시작 (${bLines.length}문장)`));
  };

  // ③ 같은 상황 다시 대화
  const checkUsed = async (out) => {
    const targets = targetsOf(c);
    const mineLines = c.redo.messages.filter((m) => m.role === 'me').map((m) => m.text);
    if (!targets.length || !mineLines.length) return;
    out.textContent = '고친 표현을 썼는지 보는 중…';
    try {
      const r = await ai.ask(P.usedMessages(targets, mineLines), { json: true, check: P.usedOK });
      c.redo.check = { targets, results: r.data.results, by: r.provider.name };
      await save(); draw3();
    } catch (e) { out.textContent = e.message; }
  };
  const draw3 = () => {
    const box = boxes.redo;
    const go = hasKey ? h('a', { class: 'btn primary', href: `#/ai/c/${c.id}/redo` }, c.redo ? '🔁 한 번 더 다시 대화하기' : '🔁 같은 상황으로 다시 대화하기') : h('p', { class: 'note' }, 'AI 키가 있어야 해요 — 설정 → 🤖 AI');
    if (!c.redo) {
      fill(box, h('p', {}, c.review ? '고친 표현을 떠올리며 같은 상황으로 다시 대화해요. 끝나면 고친 표현을 실제로 썼는지 보여 줘요.' : '같은 상황으로 다시 대화해요. ① 을 먼저 하면 고친 표현을 썼는지도 볼 수 있어요.'), go);
      return;
    }
    const out = h('p', { class: 'note', 'aria-live': 'polite' });
    const ck = c.redo.check;
    fill(box,
      h('p', { class: 'note' }, `다시 한 대화: ${fmtDate(c.redo.created)} · 내가 한 말 ${c.redo.messages.filter((m) => m.role === 'me').length}마디`),
      ck ? h('ul', { class: 'used-list' }, ck.targets.map((t, i) => {
        const r = ck.results.find((x) => x.i === i + 1) || { used: false };
        return h('li', { class: r.used ? 'used' : '' }, h('span', { class: 'mark' }, r.used ? '✅' : '—'), h('span', { lang: 'en' }, t), r.note ? h('small', {}, r.note) : null);
      })) : null,
      ck ? h('p', { class: 'lead' }, `고친 표현 ${ck.targets.length}개 중 ${ck.results.filter((r) => r.used).length}개를 썼어요.`) : out,
      h('details', {}, h('summary', {}, '다시 한 대화 보기'), h('ol', { class: 'ai-script' }, c.redo.messages.map((m) => h('li', { class: m.role }, h('b', {}, m.role === 'ai' ? 'A ' : 'B '), h('span', { lang: 'en' }, m.text))))),
      go);
    if (!ck && c.review && hasKey) checkUsed(out);
  };

  // ④ 카드
  const draw4 = () => {
    const box = boxes.cards;
    if (!c.review) { fill(box, h('p', { class: 'note' }, '① 교정본을 먼저 만드세요.')); return; }
    const seen = new Set();
    const items = [...c.review.expressions.map((x) => ({ ...x })), ...c.review.lines.filter((l) => l.changed).map((l) => ({ en: l.en, ko: l.ko, note: l.why }))]
      .filter((x) => { const k = key(x.en); if (seen.has(k)) return false; seen.add(k); return true; });
    const checks = items.map((x, i) => [i, x, h('input', { type: 'checkbox', id: `aix-${i}`, checked: true })]);
    const go = h('button', { type: 'button', class: 'btn primary' }, '카드에 넣기');
    go.addEventListener('click', async () => {
      const picked = checks.filter(([, , cb]) => cb.checked).map(([i, x]) => [i, x]);
      if (!picked.length) { toast('넣을 표현을 골라 주세요.'); return; }
      const n = await addCards({ id: `ai-${c.id}` }, picked);
      await mark('cards'); drawHead();
      toast(n ? `${n}개를 카드에 넣었어요. 잊을 때쯤 다시 보여 줘요.` : '이미 넣은 표현이에요.');
    });
    fill(box, h('p', {}, '배운 표현과 고친 문장을 골라 암기 카드에 넣어요.'),
      h('ul', { class: 'finish-list' }, checks.map(([i, x, cb]) => h('li', {}, h('label', { class: 'check', for: `aix-${i}` }, cb,
        h('span', {}, h('b', { lang: 'en' }, x.en), ' ', x.ko, x.note ? h('small', {}, x.note) : null))))),
      go, c.steps.cards ? h('p', { class: 'note' }, '✓ 카드에 넣었어요.') : null);
  };

  // ⑤ 상황별 대화에 추가 (내가 만든 상황)
  const draw5 = async () => {
    const box = boxes.custom;
    if (!c.review) { fill(box, h('p', { class: 'note' }, '① 교정본을 먼저 만드세요.')); return; }
    if (c.custom && await get('customDialogues', c.custom)) {
      fill(box, h('p', {}, '✓ «✍️ 내가 만든 상황» 에 저장했어요. 기본 대화처럼 세 모드로 연습할 수 있어요.'),
        h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: `#/d/${c.custom}` }, '열기'), h('a', { class: 'btn ghost', href: '#/sit/my' }, '내가 만든 상황 목록')));
      return;
    }
    const changed = c.review.lines.map((l, i) => ({ ...l, i })).filter((l) => l.changed);
    const altChecks = changed.map((l) => [l.i, h('input', { type: 'checkbox', id: `alt-${l.i}` })]);
    let vis = settings().shareDefault || 'secret';
    const go = h('button', { type: 'button', class: 'btn primary' }, '상황별 대화에 추가');
    go.addEventListener('click', async () => {
      const R = c.review;
      const alts = new Set(altChecks.filter(([, cb]) => cb.checked).map(([i]) => i));
      const did = newId('my-');
      const lines = R.lines.map((l, i) => ({ n: i + 1, role: l.role, en: l.en, ko: l.ko || '', ...(alts.has(i) && l.mine ? { alt: [l.mine] } : {}) }));
      const lineOf = (en) => { const k = key(en); return (lines.find((l) => key(l.en).includes(k)) || {}).n || null; };
      const d = {
        id: did, kind: 'dialogue', custom: true, source: 'ai-chat', fromChat: c.id, domain: 'my', situation: did, level: c.level,
        title: { ko: R.title, en: c.sit.en || '' }, scene: { ko: R.scene || c.sit.ko },
        roles: { A: { ...R.roles.A }, B: { ...R.roles.B, learner: true } },
        lines, expressions: R.expressions.map((x) => ({ ...x, fromLine: lineOf(x.en) })),
        visibility: 'secret', created: Date.now(),
      };
      await put('customDialogues', did, d);
      c.custom = did; await mark('custom');
      toast('«✍️ 내가 만든 상황» 에 저장했어요.');
      if (vis !== 'secret') { location.hash = `#/send/d/${did}/${vis}`; return; }   // 보내기는 확인 화면에서(「4-13」)
      draw5(); drawHead();
    });
    fill(box,
      h('p', {}, '고친 대화를 «✍️ 내가 만든 상황» 으로 저장해요. 기본 대화처럼 🎤 · 💬 · 🎧 세 모드로 연습할 수 있어요(음성은 휴대폰 음성).'),
      changed.length ? h('div', {}, h('h4', {}, '내 원래 문장도 정답으로 인정할까요?'),
        h('p', { class: 'note' }, '틀린 말이 아니라 다르게 말한 것뿐이면 체크하세요. 연습할 때 정답으로 쳐 줘요.'),
        h('ul', { class: 'finish-list' }, altChecks.map(([i, cb]) => {
          const l = c.review.lines[i];
          return h('li', {}, h('label', { class: 'check', for: `alt-${i}` }, cb, h('span', {}, h('span', { lang: 'en' }, l.mine), h('small', {}, `고친 말: ${l.en}`))));
        }))) : null,
      h('h4', {}, '공개 범위'),
      seg('공개 범위', vis, [['secret', '🔒 비밀 (나만)'], ['dev', '📨 개발자에게 전달'], ['all', '🌐 모두에게 반영 제안']], (v) => { vis = v; }),
      h('p', { class: 'note' }, '📨 · 🌐 을 고르면 저장한 뒤 «보내기 확인» 화면으로 가요. 나중에 «✍️ 내가 만든 상황» 에서 보내도 돼요.'),
      go);
  };

  const step = (k, n, title) => (secs[k] = h('section', { class: 'card ai-step', id: `step-${k}`, dataset: { n } },
    h('h2', {}, h('span', { class: 'n' }, n), ` ${title}`), boxes[k]));
  const page = h('div', { class: 'page ai-review' },
    h('a', { class: 'back', href: '#/ai', html: `${icon('back', 18)}<span>AI 자유대화</span>` }),
    head,
    h('details', { class: 'card ai-script-box' }, h('summary', {}, `처음 대화 보기 (${c.messages.length}마디)`),
      h('ol', { class: 'ai-script' }, c.messages.map((m) => h('li', { class: m.role }, h('b', {}, m.role === 'ai' ? 'A ' : 'B '), h('span', { lang: 'en' }, m.text))))),
    step('review', '①', '교정본 대화 만들기'),
    step('follow', '②', s.mode === 'listen' ? '교정본 듣기' : s.mode === 'speak' ? '교정본으로 따라 말하기' : '교정본으로 따라 쓰기'),
    step('redo', '③', '같은 상황 다시 대화하기'),
    step('cards', '④', '새 표현 카드에 저장'),
    step('custom', '⑤', '상황별 대화에 추가'));
  drawAll();
  return page;
}
