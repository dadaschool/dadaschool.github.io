// 🎧 대화 듣기 — 재생 목록 고르기 · 재생 방식 · 반복 · 속도 · 역할 · 멈춤 타이머 · 지금 문장 (설계서 「4-5」)
import { h, icon, toast, fill } from '../ui.js';
import { settings, setSetting, koVisible } from '../settings.js';
import { loadSituations, loadDialogue, domainOf, LEVEL_KO, codeOf, dialogueId } from '../content.js';
import { entries } from '../db.js';
import { markStep, addTime } from '../record.js';
import * as P from '../player.js';
import * as audio from '../audio.js';

const METHODS = [['plain', '대화 그대로'], ['shadow', '따라 하기 쉼'], ['meaning', '뜻 함께'], ['recall', '떠올리기']];
const METHOD_NOTE = {
  plain: '처음 들을 때 · 귀에 익히기', shadow: '문장 뒤에 그 길이만큼 쉬어요 — 마음속으로 · 작게 따라 하기',
  meaning: '영어 → 한국어 뜻 → 영어', recall: '한국어 뜻 → 쉼(영어를 떠올려 보기) → 영어',
};

// 들은 시간 기록 · 다 들은 대화 표시 (재생기는 화면을 옮겨도 계속 돈다)
let lastListened = 0; let lastDialogue = null;
setInterval(() => {
  const delta = P.state.listened - lastListened;
  if (delta >= 20) { lastListened = P.state.listened; addTime('listen', delta); }
}, 15000);

async function source(kind, arg) {
  const s = settings();
  const data = await loadSituations();
  const lv = s.level || 1;
  const linesOf = async (ids) => {
    const out = [];
    for (const id of ids) { try { const d = await loadDialogue(id); for (const ln of d.lines) out.push({ d, ln }); } catch { /* 없는 대화 건너뜀 */ } }
    return out;
  };
  if (kind === 'd') { const d = await loadDialogue(arg); const dom = await domainOf(d); return { label: `${codeOf(dom, d.situation)} ${d.title.ko} · ${LEVEL_KO[d.level]}`, lines: await linesOf([arg]) }; }
  if (kind === 's') {
    const [domId, sitId] = arg.split('~'); const dom = data.domains.find((x) => x.id === domId);
    return { label: `${codeOf(dom, sitId)} ${dom.situations.find((x) => x.id === sitId).ko} · 초 · 중 · 고급`, lines: await linesOf([1, 2, 3].map((l) => dialogueId(domId, sitId, l))) };
  }
  if (kind === 'dom') { const dom = data.domains.find((x) => x.id === arg); return { label: `${dom.ko} 전체 · ${LEVEL_KO[lv]}`, lines: await linesOf(dom.situations.map((x) => dialogueId(dom.id, x.id, lv))) }; }
  if (kind === 'recent') {
    const ids = (await entries('progress')).filter(([, v]) => v?.lastSeen).sort((a, b) => b[1].lastSeen - a[1].lastSeen).slice(0, 10).map(([k]) => k);
    return { label: '최근 본 대화', lines: await linesOf(ids) };
  }
  if (kind === 'mistakes') {
    const ms = (await entries('mistakes')).map(([, v]) => v);
    const out = [];
    for (const m of ms) { try { const d = await loadDialogue(m.id); const ln = d.lines.find((x) => x.n === m.n); if (ln) out.push({ d, ln }); } catch { /* */ } }
    return { label: '오답노트 문장', lines: out };
  }
  const doms = data.domains.filter((x) => s.domains.includes(x.id));
  return { label: `내 수준 전체 · ${LEVEL_KO[lv]}`, lines: await linesOf(doms.flatMap((dom) => dom.situations.map((x) => dialogueId(dom.id, x.id, lv)))) };
}

function seg(options, value, on) {
  return h('div', { class: 'seg' }, options.map(([v, label]) => h('button', { type: 'button', 'aria-checked': String(v === value), role: 'radio',
    onclick: (e) => { for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', 'false'); e.currentTarget.setAttribute('aria-checked', 'true'); on(v); } }, label)));
}

export default async function listen(arg) {
  audio.stop();
  const s = settings();
  const saved = s.listenOpts || {};
  const [kind, rest] = arg ? [arg.split('/')[0], arg.split('/').slice(1).join('/')] : ['level', ''];
  const src = await source(kind, rest);
  const sameList = P.state.label === src.label && P.state.lines.length;
  if (!sameList) { P.load(src.lines, saved); P.state.label = src.label; }

  const saveOpt = (k, v) => { P.setOpt(k, v); setSetting('listenOpts', { ...P.state.opts }); };
  const now = h('div', { class: 'now card', 'aria-live': 'polite' });
  const btnPlay = h('button', { type: 'button', class: 'big-play', 'aria-label': '재생' });
  const prev = h('button', { type: 'button', class: 'say-btn', 'aria-label': '이전 문장', onclick: () => P.jump(-1) }, '⏮');
  const nxt = h('button', { type: 'button', class: 'say-btn', 'aria-label': '다음 문장', onclick: () => P.jump(1) }, '⏭');
  btnPlay.addEventListener('click', () => {
    if (!P.state.lines.length) { toast('들을 문장이 없어요.'); return; }
    P.state.playing ? P.pause() : P.play();
  });

  const draw = () => {
    btnPlay.innerHTML = P.state.playing ? '<span aria-hidden="true">⏸</span>' : icon('play', 30);
    btnPlay.setAttribute('aria-label', P.state.playing ? '일시정지' : '재생');
    const cur = P.state.current || P.state.lines[0];
    if (!cur) { fill(now, h('p', { class: 'note' }, '들을 문장이 없어요. 다른 목록을 골라 보세요.')); return; }
    const { d, ln } = cur;
    if (lastDialogue && lastDialogue !== d.id) markStep(lastDialogue, 'listen', 'listen');
    lastDialogue = d.id;
    const idx = P.state.lines.indexOf(cur) + 1;
    fill(now,
      h('p', { class: 'eyebrow' }, `${d.title.ko} · ${LEVEL_KO[d.level]} · ${idx} / ${P.state.lines.length}`),
      h('p', { class: 'now-who' }, h('span', { class: `who${d.roles[ln.role].learner ? ' me' : ''}` }, ln.role), ' ', d.roles[ln.role].ko),
      h('p', { class: 'en big', lang: 'en', hidden: P.state.opts.method === 'recall' && P.state.playing && P.state.plan.some((x) => x.kind === 'en') }, ln.en),
      h('p', { class: 'ko', hidden: !koVisible(d.level) && P.state.opts.method !== 'recall' && P.state.opts.method !== 'meaning' }, ln.ko));
  };
  P.state.onChange = draw;
  draw();

  const o = P.state.opts;
  const note = h('p', { class: 'note' }, METHOD_NOTE[o.method]);
  const sources = h('div', { class: 'chips wrap' }, [
    ['level', '', '내 수준 전체'], ['recent', '', '최근 본 대화'], ['mistakes', '', '오답노트'],
    ...(await loadSituations()).domains.filter((x) => s.domains.includes(x.id)).map((x) => ['dom', x.id, `${x.emoji} ${x.ko}`]),
  ].map(([k, a, label]) => h('a', { class: `chip${kind === k && (rest || '') === a ? ' on' : ''}`, href: `#/listen/${k}${a ? '/' + a : ''}` }, label)));

  return h('div', { class: 'page listen' },
    h('h1', {}, '🎧 대화 듣기'),
    h('p', { class: 'note' }, `${src.label} · 문장 ${P.state.lines.length}개. 화면을 꺼도 계속 재생되고, 잠금 화면 · 이어폰 버튼으로 멈추거나 넘길 수 있어요.`),
    now,
    h('div', { class: 'controls' }, prev, btnPlay, nxt),
    h('section', { class: 'card opts' },
      h('h2', {}, '어떻게 들을까요'),
      h('div', { class: 'set-row' }, h('b', {}, '재생 방식'), seg(METHODS, o.method, (v) => { saveOpt('method', v); note.textContent = METHOD_NOTE[v]; })),
      note,
      h('div', { class: 'set-row' }, h('b', {}, '문장마다'), seg([[1, '1번'], [2, '2번'], [3, '3번']], o.perLine, (v) => saveOpt('perLine', v))),
      h('div', { class: 'set-row' }, h('b', {}, '목록 전체'), seg([[1, '1번'], [2, '2번'], [3, '3번'], [0, '끝없이']], o.loops, (v) => saveOpt('loops', v))),
      h('div', { class: 'set-row' }, h('b', {}, '속도'), seg([[0.75, '0.75배'], [1, '1배'], [1.25, '1.25배']], o.rate, (v) => saveOpt('rate', v))),
      h('div', { class: 'set-row' }, h('b', {}, '들을 역할'), seg([['all', '모두'], ['me', '내 역할만'], ['other', '상대만']], o.roles, (v) => {
        saveOpt('roles', v); P.load(src.lines, P.state.opts); P.state.label = src.label; draw();
      })),
      h('div', { class: 'set-row' }, h('b', {}, '멈춤 타이머'), seg([[0, '끔'], [10, '10분'], [20, '20분'], [30, '30분']], o.timer, (v) => saveOpt('timer', v)))),
    h('section', {}, h('h3', { class: 'sec' }, '다른 목록'), sources),
  );
}
