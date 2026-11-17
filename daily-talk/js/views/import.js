// 📥 자료로 학습 만들기 (설계서 「4-12」) — #/import
//   1 자료 넣기(📋 붙여넣기 · 📄 파일 · 📷 사진 · ↗ 공유하기) → 2 AI 검토 → 3 고르기 → 4 만들기 · 내가 검토하기 → 5 묶음으로 저장
//   원문 전체는 저장하지 않는다 — 출처 · 요약 · 만든 학습 내용만(핵심 문장은 원문 문장 최대 10개).
import { h, fill, toast, icon } from '../ui.js';
import { settings } from '../settings.js';
import { LEVEL_KO } from '../content.js';
import { put } from '../db.js';
import * as ai from '../ai/providers.js';
import * as P from '../ai/prompts.js';
import { readFile, tidyText, splitParts, HANGUL_RATIO } from '../extract.js';

const MAX_PART = 20000;
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const fmtN = (n) => n.toLocaleString('ko-KR');
const SRC_KO = { paste: '📋 붙여넣기', file: '📄 파일', photo: '📷 사진', share: '↗ 공유하기' };

let imp = null;   // 진행 중인 작업 { src, text, parts, part, analysis, levels(여러 수준), items, saved }

// 공유하기(Web Share Target, GET)로 들어온 것 — app.js 가 sessionStorage 에 넣어 둔다
function takeShared() {
  try {
    const raw = sessionStorage.getItem('dt-share');
    if (!raw) return null;
    sessionStorage.removeItem('dt-share');
    return JSON.parse(raw);
  } catch { return null; }
}

function seg(name, value, options, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map(([v, label, disabled]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), disabled: !!disabled,
      onclick: (e) => {
        for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', 'false');
        e.currentTarget.setAttribute('aria-checked', 'true');
        onChange(v);
      } }, label)));
}

// ── AI 결과 다듬기 (형식 「2-4」)
function cleanDialogue(j, level) {
  const lines = j.lines.filter((l) => l && (l.role === 'A' || l.role === 'B') && str(l.en)).map((l) => {
    const out = { role: l.role, en: str(l.en), ko: str(l.ko) };
    const alt = Array.isArray(l.alt) ? l.alt.map(str).filter((a) => a && a !== out.en).slice(0, 3) : [];
    if (l.role === 'B' && alt.length) out.alt = alt;
    return out;
  });
  const roles = j.roles || {};
  return {
    kind: 'dialogue', level,
    title: { ko: str(j.title?.ko) || '자료로 만든 대화', en: str(j.title?.en) },
    scene: { ko: str(j.scene?.ko) },
    roles: { A: { ko: str(roles.A?.ko) || '상대', en: str(roles.A?.en) || 'Partner' }, B: { ko: str(roles.B?.ko) || '나', en: str(roles.B?.en) || 'Me', learner: true } },
    lines,
    expressions: (Array.isArray(j.expressions) ? j.expressions : []).filter((x) => x && str(x.en)).slice(0, 8)
      .map((x) => ({ en: str(x.en), ko: str(x.ko), note: str(x.note), fromLine: Number.isInteger(x.fromLine) && x.fromLine >= 1 && x.fromLine <= lines.length ? x.fromLine : null })),
  };
}
function cleanQuestions(qs) {
  return (Array.isArray(qs) ? qs : []).filter((q) => q && q.q && str(q.q.en)).map((q) => {
    const base = { type: q.type, q: { en: str(q.q.en), ko: str(q.q.ko) } };
    if (q.type === 'ox' && typeof q.answer === 'boolean') return { ...base, answer: q.answer };
    if (q.type === 'choice' && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length) {
      return { ...base, options: q.options.map((o) => String(o)), answer: q.answer };
    }
    if (q.type === 'blank' && str(q.answer) && /_{2,}/.test(base.q.en)) return { ...base, answer: str(q.answer) };
    return null;
  }).filter(Boolean).slice(0, 8);
}
function cleanPassage(j, level, prefix) {
  const title = str(j.title?.ko) || `${prefix} — 자료`;
  return {
    kind: 'passage', level,
    title: { ko: title, en: str(j.title?.en) },
    scene: { ko: '' },
    roles: { N: { ko: '읽는 사람', en: 'Reader', learner: true } },
    lines: j.lines.filter((l) => l && str(l.en)).slice(0, 20).map((l) => ({ role: 'N', en: str(l.en), ko: str(l.ko) })),
    expressions: (Array.isArray(j.expressions) ? j.expressions : []).filter((x) => x && str(x.en)).slice(0, 12)
      .map((x) => ({ en: str(x.en), ko: str(x.ko), note: str(x.note), fromLine: null })),
    questions: cleanQuestions(j.questions),
  };
}

// 만들 것 하나 → AI
async function makeItem(item) {
  const text = imp.parts[imp.part];
  const korean = imp.analysis.type === 'korean' || HANGUL_RATIO(text) > 0.5;
  item.status = 'making'; item.error = '';
  try {
    if (item.kind === 'dialogue') {
      const r = await ai.ask(P.importDialogueMessages(text, item.idea, item.level, korean), { json: true, check: P.importDialogueOK });
      item.data = cleanDialogue(r.data, item.level); item.by = r.provider.name;
    } else if (item.kind === 'summary') {
      const r = await ai.ask(P.summaryMessages(text, item.level, korean), { json: true, check: P.passageOK });
      item.data = cleanPassage(r.data, item.level, '요약'); item.by = r.provider.name;
    } else {
      const r = await ai.ask(P.keySentenceMessages(text, item.level), { json: true, check: P.passageOK });
      item.data = cleanPassage(r.data, item.level, '핵심 문장'); item.data.lines = item.data.lines.slice(0, 10); item.data.questions = [];
      item.data.verbatim = true;                       // 원문 문장 그대로 — 개발자에게 보낼 때 자동으로 뺀다(「4-13」)
      item.by = r.provider.name;
    }
    item.status = 'done';
  } catch (e) { item.status = 'error'; item.error = e.message; }
}

export async function importView() {
  const shared = takeShared();
  const hasKey = await ai.hasAI();
  const s = settings();
  if (shared) imp = null;
  if (!imp) imp = { src: null, text: '', parts: [], part: 0, analysis: null, levels: new Set([s.level || 1]), items: [], saved: null };
  const I = imp;

  const page = h('div', { class: 'page imp' });
  const box1 = h('div', { class: 'step-body' });
  const box2 = h('div', { class: 'step-body' });
  const box3 = h('div', { class: 'step-body' });
  const box4 = h('div', { class: 'step-body' });
  const box5 = h('div', { class: 'step-body' });
  const sec = (n, title, body) => h('section', { class: 'card ai-step' }, h('h2', {}, h('span', { class: 'n' }, n), ` ${title}`), body);
  const draw = () => { draw1(); draw2(); draw3(); draw4(); draw5(); };

  // 1. 자료 넣기
  let how = 'paste';
  let sharedLeft = shared;                           // 공유로 들어온 글은 처음 한 번만 채운다
  const setText = (text, src) => {
    const t = tidyText(text);
    if (t.length < 80) { toast('글이 너무 짧아요. 몇 문장 이상 넣어 주세요.'); return false; }
    sharedLeft = null;
    Object.assign(I, { src, text: t, parts: splitParts(t, MAX_PART), part: 0, analysis: null, items: [], saved: null });
    draw();
    return true;
  };
  const draw1 = () => {
    if (I.text) {
      const partSel = I.parts.length > 1 ? h('select', { class: 'ai-sit', 'aria-label': '쓸 부분', onchange: (e) => { I.part = Number(e.target.value); I.analysis = null; I.items = []; draw(); } },
        I.parts.map((p, i) => h('option', { value: String(i), selected: i === I.part }, `${i + 1}부 — ${fmtN(p.length)}자 · «${p.slice(0, 18).replace(/\s+/g, ' ')}…»`))) : null;
      fill(box1,
        h('p', {}, h('b', {}, `글자 ${fmtN(I.text.length)}자`), ` · ${SRC_KO[I.src.type]}${I.src.name ? ` «${I.src.name}»` : ''}`),
        partSel ? [h('p', { class: 'note' }, `한 번에 ${fmtN(MAX_PART)}자까지 보내요. 이 자료는 ${I.parts.length}부분으로 나눴어요 — 공부할 부분을 고르세요.`), partSel] : null,
        h('details', {}, h('summary', {}, '넣은 글 미리 보기'), h('p', { class: 'imp-preview' }, I.parts[I.part].slice(0, 1200), I.parts[I.part].length > 1200 ? ' …' : '')),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { Object.assign(I, { src: null, text: '', parts: [], analysis: null, items: [], saved: null }); draw(); } }, '다른 자료 넣기'));
      return;
    }
    const area = h('textarea', { class: 'ai-custom imp-paste', id: 'imp-paste', rows: '8', placeholder: '공부하고 싶은 글을 붙여넣으세요 — 안내문 · 메뉴 · 이메일 · 기사 · 논문 초록 · 책 한 쪽…', 'aria-label': '붙여넣을 글' });
    if (sharedLeft) area.value = [sharedLeft.title, sharedLeft.text].filter(Boolean).join('\n\n');
    const sharedUrl = sharedLeft?.url || (sharedLeft?.text || '').match(/https?:\/\/\S+/)?.[0];
    const out = h('p', { class: 'note', 'aria-live': 'polite' });
    const file = h('input', { type: 'file', id: 'imp-file', accept: '.txt,.md,.docx,.hwpx,text/plain', hidden: true });
    const photo = h('input', { type: 'file', id: 'imp-photo', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      out.textContent = '글자를 읽는 중…';
      try { const r = await readFile(f); if (r.text != null) { if (!setText(r.text, { type: 'file', name: f.name })) out.textContent = ''; } else out.textContent = '사진은 «📷 사진» 으로 넣어 주세요.'; } catch (e) { out.textContent = e.message; } finally { file.value = ''; }
    });
    photo.addEventListener('change', async () => {
      const f = photo.files[0]; if (!f) return;
      out.textContent = '사진을 줄이는 중…';
      try {
        const r = await readFile(f);
        if (!r.image) throw new Error('사진 파일이 아니에요.');
        out.textContent = 'AI 가 사진 속 글자를 읽는 중… (10~30초)';
        const res = await ai.ask(P.ocrMessages(r.image), { need: 'vision', onTry: (p) => { out.textContent = `${p.name} 이(가) 사진 속 글자를 읽는 중… (10~30초)`; } });
        if (/^\(no text\)$/i.test(res.text.trim())) throw new Error('사진에서 글자를 찾지 못했어요. 글자가 잘 보이게 다시 찍어 주세요.');
        if (!setText(res.text, { type: 'photo', name: f.name })) out.textContent = '';
      } catch (e) { out.textContent = e.message; } finally { photo.value = ''; }
    });
    const body = h('div', { class: 'imp-how' });
    const drawHow = () => fill(body, {
      paste: [area, sharedUrl ? h('p', { class: 'note' }, `공유한 주소: ${sharedUrl} — 주소만으로 페이지를 읽는 기능은 도우미 서버가 생기면 열려요. 지금은 그 페이지의 본문을 복사해 붙여넣어 주세요.`) : null,
        h('button', { type: 'button', class: 'btn primary', onclick: () => { const sh = sharedLeft; if (setText(area.value, { type: sh ? 'share' : 'paste', name: sh?.title || '' })) out.textContent = ''; } }, '이 글로 하기')],
      file: [h('button', { type: 'button', class: 'btn primary', onclick: () => file.click() }, '📄 파일 고르기'), file,
        h('p', { class: 'note' }, 'TXT · MD · 워드(DOCX) · 한글(HWPX) 은 휴대폰에서 바로 읽어요. PDF · 예전 한글(HWP) · 파워포인트는 아직 안 돼요 — 글자를 복사해 붙여넣거나 한글은 HWPX 로, 워드는 DOCX 로 저장해 주세요.')],
      photo: [h('button', { type: 'button', class: 'btn primary', onclick: () => photo.click() }, '📷 사진 고르기 · 찍기'), photo,
        h('p', { class: 'note' }, '메뉴판 · 안내문 · 책 한 쪽을 찍어 넣으면 AI 가 글자를 읽어요. 제미나이나 오픈AI 키가 있어야 해요.')],
      url: [h('p', {}, '🔗 사이트 주소를 넣으면 본문을 읽어 오는 기능은 도우미 서버가 생기면 열려요(휴대폰 브라우저는 다른 사이트를 직접 읽을 수 없어요).'),
        h('p', { class: 'note' }, '지금은 그 페이지의 본문을 길게 눌러 복사한 뒤 «📋 붙여넣기» 로 넣어 주세요.')],
    }[how]);
    drawHow();
    fill(box1,
      seg('넣는 방법', how, [['paste', '📋 붙여넣기'], ['file', '📄 파일'], ['photo', '📷 사진'], ['url', '🔗 주소']], (v) => { how = v; drawHow(); }),
      body, out,
      h('p', { class: 'note' }, '다른 앱에서 [공유] → Daily Talk 를 골라도 글이 여기로 들어와요(앱으로 설치했을 때).'));
  };

  // 2. AI 검토
  const draw2 = () => {
    if (!I.text) { fill(box2, h('p', { class: 'note' }, '자료를 넣으면 AI 가 어떤 자료인지 보고, 만들 수 있는 학습을 제안해요.')); return; }
    if (!I.analysis) {
      const out = h('p', { class: 'note', 'aria-live': 'polite' });
      const go = h('button', { type: 'button', class: 'btn primary', disabled: !hasKey }, '🔎 AI 검토');
      go.addEventListener('click', async () => {
        go.disabled = true; out.textContent = 'AI 가 자료를 읽는 중… (10~30초)';
        try {
          const r = await ai.ask(P.analyzeMessages(I.parts[I.part], Math.min(...I.levels)), { json: true, check: P.analyzeOK,
            onTry: (p) => { out.textContent = `${p.name} 이(가) 자료를 읽는 중… (10~30초)`; } });
          const a = r.data;
          I.analysis = {
            type: str(a.type) || 'other', typeKo: str(a.typeKo) || '자료', by: r.provider.name,
            summary: a.summary.map(str).filter(Boolean).slice(0, 3),
            suitable: a.suitable !== false, reason: str(a.reason),
            ideas: a.dialogues.filter((x) => x && str(x.title)).slice(0, 5).map((x) => ({ title: str(x.title), titleEn: str(x.titleEn), desc: str(x.desc) })),
            passage: !!a.passage,
            terms: (Array.isArray(a.terms) ? a.terms : []).filter((x) => x && str(x.en)).slice(0, 10).map((x) => ({ en: str(x.en), ko: str(x.ko) })),
          };
          I.picks = new Set([...I.analysis.ideas.slice(0, 2).map((_, i) => `d${i}`), ...(I.analysis.passage ? ['summary'] : [])]);
          draw();
        } catch (e) { out.textContent = e.message; go.disabled = false; }
      });
      fill(box2, hasKey ? null : h('p', { class: 'note' }, 'AI 키가 있어야 해요 — ', h('a', { href: '#/settings/ai' }, '설정 → 🤖 AI')),
        h('p', { class: 'note' }, `AI 에 자료를 한 번 보내요(${fmtN(I.parts[I.part].length)}자).`), go, out);
      return;
    }
    const A = I.analysis;
    fill(box2,
      h('p', {}, h('span', { class: 'ai-st on' }, A.typeKo), ` · 검토한 AI: ${A.by}`),
      h('ul', { class: 'imp-sum' }, A.summary.map((x) => h('li', {}, x))),
      A.suitable ? null : h('p', { class: 'note warn' }, `⚠ 연습에 잘 맞지 않는 자료예요: ${A.reason || '이유를 알 수 없어요'}. 그래도 만들 수는 있어요.`),
      A.terms.length ? h('div', {}, h('h4', {}, '쓸 만한 표현 · 용어'), h('p', { class: 'imp-terms' }, A.terms.map((t) => h('span', { class: 'chip' }, h('b', { lang: 'en' }, t.en), ` ${t.ko}`)))) : null);
  };

  // 3. 고르기
  const draw3 = () => {
    if (!I.analysis) { fill(box3, h('p', { class: 'note' }, 'AI 검토가 끝나면 만들 것을 고르세요.')); return; }
    const A = I.analysis;
    const korean = A.type === 'korean' || HANGUL_RATIO(I.parts[I.part]) > 0.5;
    const opts = [
      ...A.ideas.map((x, i) => [`d${i}`, `💬 대화 — ${x.title}`, x.desc]),
      ...(A.passage ? [['summary', korean ? '📝 영어로 설명하기 — 요약문 · 용어 카드 · 내용 퀴즈' : '📝 쉬운 영어 요약 — 용어 카드 · 내용 퀴즈 포함', '글 학습: 문장마다 듣고 따라 읽기 · 받아쓰기 · 낭독 듣기']] : []),
      ...(A.passage && !korean ? [['key', '📌 핵심 문장 따라 읽기 (원문 문장 5~10개)', '원문에서 중요한 문장을 그대로 골라요']] : []),
    ];
    const count = h('p', { class: 'note' });
    const upd = () => {
      const n = I.picks.size * I.levels.size;
      count.textContent = I.levels.size > 1 ? `만들 것 ${I.picks.size}개 × 수준 ${I.levels.size}개 = ${n}개 → AI 에 ${n}번 더 물어요.` : `고른 것 ${n}개 → AI 에 ${n}번 더 물어요.`;
      go.disabled = !n || !hasKey;
    };
    const go = h('button', { type: 'button', class: 'btn primary' }, '✨ 만들기');
    go.addEventListener('click', async () => {
      const levels = [1, 2, 3].filter((lv) => I.levels.has(lv));
      I.items = opts.filter(([k]) => I.picks.has(k)).flatMap(([k]) => levels.map((level) => (k.startsWith('d')
        ? { key: `${k}-${level}`, kind: 'dialogue', idea: A.ideas[Number(k.slice(1))], level, status: 'wait', include: true }
        : { key: `${k}-${level}`, kind: k, level, status: 'wait', include: true })));
      I.saved = null;
      draw();
      for (const item of I.items) { item.status = 'making'; draw4(); await makeItem(item); draw4(); }
      draw();
      document.getElementById('imp-review')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    fill(box3,
      h('h4', {}, '수준 (여러 개 고를 수 있어요)'),
      h('div', { class: 'checks' }, [1, 2, 3].map((lv) => h('label', { class: 'check chip' },
        h('input', { type: 'checkbox', id: `imp-lv-${lv}`, checked: I.levels.has(lv), onchange: (e) => {
          if (e.target.checked) I.levels.add(lv); else if (I.levels.size > 1) I.levels.delete(lv); else { e.target.checked = true; toast('수준을 하나 이상 골라 주세요.'); }
          upd();
        } }), ` ${LEVEL_KO[lv]}`))),
      h('p', { class: 'note' }, '원문이 어려워도 만든 내용은 고른 수준에 맞춰요. 수준을 여러 개 고르면 수준마다 따로 만들어요.'),
      h('h4', {}, '만들 것'),
      h('ul', { class: 'finish-list' }, opts.map(([k, label, note]) => h('li', {}, h('label', { class: 'check', for: `imp-${k}` },
        h('input', { type: 'checkbox', id: `imp-${k}`, checked: I.picks.has(k), onchange: (e) => { if (e.target.checked) I.picks.add(k); else I.picks.delete(k); upd(); } }),
        h('span', {}, label, note ? h('small', {}, note) : null))))),
      count, go);
    upd();
  };

  // 4. 만들기 · 내가 검토하기
  const lineView = (item, l, idx) => {
    const li = h('li', { class: 'imp-line' });
    const show = () => fill(li,
      h('span', { class: `who${l.role === 'B' || l.role === 'N' ? ' me' : ''}` }, l.role),
      h('div', {}, h('p', { class: 'en', lang: 'en' }, l.en), l.ko ? h('p', { class: 'ko' }, l.ko) : null,
        l.alt?.length ? h('p', { class: 'alt' }, h('span', {}, '이렇게 말해도 정답 '), l.alt.join(' · ')) : null),
      h('div', { class: 'imp-tools' },
        h('button', { type: 'button', class: 'btn ghost small', 'aria-label': `${idx + 1}번 문장 고치기`, onclick: edit }, '✏️'),
        h('button', { type: 'button', class: 'btn ghost small', 'aria-label': `${idx + 1}번 문장 지우기`, onclick: () => {
          if (item.data.lines.length <= 2) { toast('문장이 너무 적어져요.'); return; }
          item.data.lines.splice(item.data.lines.indexOf(l), 1); draw4();
        } }, '🗑')));
    const edit = () => {
      const en = h('input', { type: 'text', class: 'answer-text', lang: 'en', value: l.en, 'aria-label': '영어 문장' });
      const ko = h('input', { type: 'text', class: 'answer-text', value: l.ko, 'aria-label': '한국어 뜻' });
      fill(li, h('span', { class: 'who' }, l.role), h('div', { class: 'imp-edit' }, en, ko,
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn small', onclick: () => {
          if (!en.value.trim()) { toast('영어 문장을 비울 수 없어요.'); return; }
          l.en = en.value.trim(); l.ko = ko.value.trim(); show();
        } }, '확인'), h('button', { type: 'button', class: 'btn ghost small', onclick: show }, '취소'))));
      en.focus();
    };
    show();
    return li;
  };
  const draw4 = () => {
    if (!I.items.length) { fill(box4, h('p', { class: 'note' }, '만든 내용을 저장하기 전에 여기서 보고 고치거나 지울 수 있어요.')); return; }
    fill(box4,
      h('p', { class: 'note' }, '🤖 AI 가 만든 내용이에요. 틀린 곳은 ✏️ 로 고치고, 필요 없는 문장은 🗑 로 지우세요.'),
      I.items.map((item, k) => {
        const label = `${item.kind === 'dialogue' ? '💬 대화' : item.kind === 'summary' ? '📝 요약' : '📌 핵심 문장'} · ${LEVEL_KO[item.level]}`;
        if (item.status !== 'done') {
          return h('div', { class: 'imp-item card' }, h('p', {}, h('b', {}, label), ' ', item.idea?.title || ''),
            item.status === 'error' ? [h('p', { class: 'note warn' }, item.error),
              h('button', { type: 'button', class: 'btn small', onclick: async () => { item.status = 'making'; draw4(); await makeItem(item); draw(); } }, '다시 만들기')]
              : h('p', { class: 'note' }, item.status === 'making' ? `만드는 중… (${k + 1} / ${I.items.length})` : '기다리는 중'));
        }
        const d = item.data;
        const title = h('input', { type: 'text', class: 'answer-text imp-title', value: d.title.ko, 'aria-label': '제목', onchange: (e) => { d.title.ko = e.target.value.trim() || d.title.ko; } });
        return h('div', { class: `imp-item card${item.include ? '' : ' off'}` },
          h('div', { class: 'imp-head' }, h('b', {}, label), h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: item.include, onchange: (e) => { item.include = e.target.checked; draw4(); draw5(); } }), ' 저장')),
          title,
          d.scene?.ko ? h('p', { class: 'note' }, d.scene.ko) : null,
          d.kind === 'dialogue' ? h('p', { class: 'note' }, `A ${d.roles.A.ko} · B ${d.roles.B.ko}(나)`) : null,
          h('ol', { class: 'imp-lines' }, d.lines.map((l, i) => lineView(item, l, i))),
          d.expressions.length ? h('p', { class: 'imp-terms' }, d.expressions.map((x) => h('span', { class: 'chip' }, h('b', { lang: 'en' }, x.en), ` ${x.ko}`))) : null,
          d.questions?.length ? h('p', { class: 'note' }, `내용 퀴즈 ${d.questions.length}문제`) : null,
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn ghost small', onclick: async () => { item.status = 'making'; draw4(); await makeItem(item); draw(); } }, '🔁 다시 만들기'),
            h('span', { class: 'note' }, `만든 AI: ${item.by}`)));
      }));
  };

  // 5. 저장
  const draw5 = () => {
    if (I.saved) {
      fill(box5, h('p', {}, `✓ «✍️ 내가 만든 상황» 에 묶음 «${I.saved.title}» 으로 저장했어요.`),
        h('div', { class: 'btn-row' },
          h('a', { class: 'btn primary', href: '#/sit/my' }, '내가 만든 상황 보기'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { imp = null; window.dispatchEvent(new HashChangeEvent('hashchange')); } }, '새 자료 넣기')));
      return;
    }
    const ready = I.items.filter((x) => x.status === 'done' && x.include);
    if (!ready.length) { fill(box5, h('p', { class: 'note' }, '만든 것을 «내가 만든 상황» 에 자료 묶음으로 저장해요.')); return; }
    const def = I.src.name ? I.src.name.replace(/\.[a-z0-9]+$/i, '') : (I.analysis?.ideas[0]?.title || I.analysis?.typeKo || '자료');
    const name = h('input', { type: 'text', class: 'answer-text', id: 'imp-name', value: def.slice(0, 40), 'aria-label': '묶음 이름' });
    let vis = settings().shareDefault || 'secret';
    const go = h('button', { type: 'button', class: 'btn primary' }, `💾 저장 (${ready.length}개)`);
    go.addEventListener('click', async () => {
      go.disabled = true;
      const bid = newId('i'); const now = Date.now(); const ids = [];
      for (const item of ready) {
        const d = item.data; const id = newId('my-');
        await put('customDialogues', id, {
          ...d, id, custom: true, source: 'import', importId: bid, domain: 'my', situation: id,
          lines: d.lines.map((l, i) => ({ ...l, n: i + 1 })),
          expressions: d.expressions.map((x) => ({ ...x, fromLine: x.fromLine && x.fromLine <= d.lines.length ? x.fromLine : null })),
          visibility: 'secret', created: now, by: item.by,
        });
        ids.push(id);
      }
      const title = name.value.trim() || def;
      await put('imports', bid, { id: bid, title, type: I.analysis.type, typeKo: I.analysis.typeKo, source: { type: I.src.type, name: I.src.name || '', part: I.parts.length > 1 ? I.part + 1 : null },
        summary: I.analysis.summary, levels: [...new Set(ready.map((x) => x.level))].sort(), items: ids, visibility: 'secret', created: now });
      I.saved = { id: bid, title };
      toast('저장했어요.');
      if (vis !== 'secret') { location.hash = `#/send/b/${bid}/${vis}`; return; }   // 보내기는 확인 화면에서(「4-13」)
      draw5();
    });
    fill(box5,
      h('label', { for: 'imp-name', class: 'note' }, '묶음 이름'), name,
      h('h4', {}, '공개 범위'),
      seg('공개 범위', vis, [['secret', '🔒 비밀 (나만)'], ['dev', '📨 개발자에게 전달'], ['all', '🌐 모두에게 반영 제안']], (v) => { vis = v; }),
      h('p', { class: 'note' }, '📨 · 🌐 을 고르면 저장한 뒤 «보내기 확인» 화면으로 가요. 나중에 «✍️ 내가 만든 상황» 에서 보내도 돼요. 원문 전체는 저장하지 않아요(출처 · 요약 · 만든 내용만).'),
      go);
  };

  draw();
  page.append(...[
    h('a', { class: 'back', href: '#/home', html: `${icon('back', 18)}<span>홈</span>` }),
    h('h1', {}, '📥 자료로 학습 만들기'),
    h('p', { class: 'lead' }, '공부하고 싶은 글 · 파일 · 사진을 넣으면 AI 가 대화 · 카드 · 퀴즈로 바꿔 «✍️ 내가 만든 상황» 에 넣어요.'),
    h('p', { class: 'note warn' }, '⚠ 자료 내용은 AI 회사로 보내져요. 개인정보나 회사 기밀이 담긴 자료는 넣지 마세요.'),
    hasKey ? null : h('section', { class: 'card' }, h('p', {}, 'AI 키가 있어야 만들 수 있어요. 큐웬 · 업스테이지 · 제미나이 · 오픈AI 중 한 곳의 키를 넣어 주세요(사진은 제미나이 · 오픈AI).'),
      h('a', { class: 'btn primary', href: '#/settings/ai' }, '설정 → 🤖 AI 에서 키 넣기')),
    sec('1', '자료 넣기', box1),
    sec('2', 'AI 검토', box2),
    sec('3', '고르기', box3),
    h('div', { id: 'imp-review' }, sec('4', '만들기 · 내가 검토하기', box4)),
    sec('5', '저장', box5)].filter(Boolean));       // append 는 null 을 «null» 글자로 넣는다
  return page;
}
