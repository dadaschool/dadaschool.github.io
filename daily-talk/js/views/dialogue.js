// 대화 보기 — 1차-1 미리 보기: 문장 · 뜻 · 음성. 연습 네 단계(듣기 · 따라 하기 · 역할 연습 · 마무리)는 1차-3.
import { h, icon, toast } from '../ui.js';
import { settings, koVisible } from '../settings.js';
import { loadDialogue, domainOf, LEVEL_KO, codeOf, audioURL, learnerRole } from '../content.js';
import { get, put } from '../db.js';
import * as audio from '../audio.js';
import { MODES } from '../modes.js';
import { VIS, isVerbatim } from '../share.js';

export default async function dialogue(id) {
  const d = await loadDialogue(id);
  const dom = await domainOf(d);
  const s = settings();
  const me = learnerRole(d);
  const showKo = koVisible(d.level);
  const sound = !(s.mode === 'chat' && !s.chatSound);
  const prev = (await get('progress', id)) || {};
  await put('progress', id, { ...prev, viewed: true, lastSeen: Date.now() });

  const playBtn = (n, ko, label) => h('button', { type: 'button', class: `say-btn${ko ? ' ko' : ''}`, 'aria-label': label, html: icon(ko ? 'speaker' : 'play', 18),
    onclick: (e) => {
      e.stopPropagation();
      const url = audioURL(d, n, ko);
      if (audio.isPlaying(url)) { audio.stop(); return; }
      audio.play(url).catch(() => toast('소리를 틀 수 없어요. 인터넷 연결을 확인해 주세요.'));
    } });

  const lines = d.lines.map((ln) => {
    const mine = ln.role === me;
    const ko = h('p', { class: 'ko', hidden: !showKo }, ln.ko);
    return h('li', { class: `line${mine ? ' me' : ''}`,
      onclick: () => { if (ko.hidden) ko.hidden = false; else if (sound) audio.play(audioURL(d, ln.n)).catch(() => {}); } },
      h('span', { class: `who${mine ? ' me' : ''}`, title: d.roles[ln.role].ko }, ln.role),
      h('div', { class: 'say' },
        h('p', { class: 'en', lang: 'en' }, ln.en),
        ko,
        mine && ln.alt ? h('p', { class: 'alt' }, h('span', {}, '이렇게 말해도 정답 '), ln.alt.join(' · ')) : null),
      h('div', { class: 'say-btns' }, sound ? playBtn(ln.n, false, `${ln.n}번 듣기`) : null, sound ? playBtn(ln.n, true, `${ln.n}번 뜻 듣기`) : null));
  });

  const mode = MODES[s.mode];
  return h('div', { class: 'page dlg' },
    h('a', { class: 'back', href: `#/sit/${d.domain}`, html: `${icon('back', 18)}<span>${dom.ko}</span>` }),
    h('header', { class: 'dlg-head' },
      h('p', { class: 'eyebrow' }, `${codeOf(dom, d.situation)} · ${LEVEL_KO[d.level]}`),
      h('h1', {}, d.title.ko),
      d.source === 'import' || d.source === 'ai-chat' ? h('p', { class: 'ai-made' }, d.source === 'import' ? '🤖 AI 가 자료로 만든 내용' : '🤖 AI 자유대화로 만든 내용',
        d.custom && !isVerbatim(d) ? [' · ', h('a', { href: `#/send/d/${d.id}` }, d.visibility && d.visibility !== 'secret' ? VIS[d.visibility] : '📨 개발자에게 보내기')] : null) : null,
      d.scene?.ko ? h('p', { class: 'scene' }, d.scene.ko) : null,
      h('p', { class: 'roles' }, Object.entries(d.roles).map(([k, v]) => h('span', { class: `who${v.learner ? ' me' : ''}` }, k)), ' ',
        Object.entries(d.roles).map(([k, v]) => `${k} ${v.ko}`).join(' · '))),
    h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: `#/listen/d/${d.id}` }, '🎧 연속 듣기'), d.custom ? null : h('a', { class: 'btn ghost', href: `#/listen/s/${d.domain}~${d.situation}` }, '🎧 초 · 중 · 고급'), d.kind === 'passage' ? (d.questions?.length ? h('a', { class: 'btn ghost', href: `#/pq/${d.id}` }, `❓ 내용 퀴즈 ${d.questions.length}문제`) : null) : h('a', { class: 'btn ghost', href: `#/quiz/d/${d.id}` }, '❓ 퀴즈')),
    h('p', { class: 'hint' }, showKo ? '문장을 누르면 영어 음성이 나와요.' : '문장을 누르면 한국어 뜻이 보이고, 한 번 더 누르면 영어 음성이 나와요.',
      sound ? '' : ' (채팅 모드 · 소리 끔)'),
    h('ol', { class: 'lines' }, lines),
    h('section', { class: 'exprs card' },
      h('h3', {}, '핵심 표현'),
      h('ul', {}, d.expressions.map((x) => h('li', {},
        h('b', { lang: 'en' }, x.en), h('span', {}, x.ko), x.note ? h('small', {}, x.note) : null)))),
    h('section', { class: 'practice card' },
      h('h3', {}, `${mode.ico} ${mode.ko} 모드로 연습하기`),
      h('div', { class: 'steps' }, [['listen', '듣기'], ['repeat', s.mode === 'chat' ? '따라 쓰기' : d.kind === 'passage' ? '따라 읽기' : '따라 말하기'], ['role', '역할 연습'], ['finish', '마무리']].filter(([k]) => !(k === 'role' && d.kind === 'passage')).map(([k, t], i) => {
        const done = prev.modes?.[s.mode]?.[k];
        return h('a', { class: `step${done ? ' done' : ''}`, href: `#/p/${d.id}/${k}` }, `${i + 1}. ${t}${done ? ' ✓' : ''}`);
      })),
      h('p', { class: 'note' }, s.mode === 'listen' ? '🎧 듣기 모드는 1 듣기만 할 수 있어요. 따라 하기 · 역할 연습은 말하기 · 채팅 모드로.' : '단계를 차례로 하거나, 원하는 단계부터 시작해도 돼요.')),
  );
}
