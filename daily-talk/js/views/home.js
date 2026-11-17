// 홈 — 위: 오늘의 학습 코스(복습 카드 · 새 대화 · 퀴즈 · 오답노트), 아래: 영역 · 다른 연습 바로가기 (설계서 「3-1」 · 「3-2」)
import { h } from '../ui.js';
import { settings } from '../settings.js';
import { loadSituations, LEVEL_KO, codeOf, dialogueId } from '../content.js';
import { entries } from '../db.js';
import { MODES } from '../modes.js';
import { todayCourse, hrefFor } from '../today.js';
import { todayMinutes, streak } from '../record.js';

const MODE_NOTE = {
  speak: '🎤 말하기 — 카드는 말해 보고, 새 대화는 듣기 → 따라 말하기 → 역할 연습',
  chat: '💬 채팅 — 카드는 입력해서, 새 대화는 따라 쓰기 · 메신저 역할 연습',
  listen: '🎧 듣기 — 카드는 듣기로, 새 대화는 연속 듣기로, 퀴즈는 떠올리기로',
};

export default async function home() {
  const s = settings();
  const data = await loadSituations();
  const seen = new Set((await entries('progress')).filter(([, v]) => v?.viewed).map(([k]) => k));
  const level = s.level || 1;

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const course = await todayCourse();
  const mins = await todayMinutes();
  const st = await streak();
  const titleOf = (id) => {
    const parts = id.split('-'); const lv = Number(parts.pop()); const domId = parts.shift(); const sitId = parts.join('-');
    const d = data.domains.find((x) => x.id === domId); const sit = d?.situations.find((x) => x.id === sitId);
    return d && sit ? `${codeOf(d, sitId)} ${sit.ko} · ${LEVEL_KO[lv]}` : id;
  };
  const itemLabel = (it) => ({ cards: `복습 카드 ${it.n}장`, dialogue: `새 대화 — ${titleOf(it.id || '')}`, quiz: `퀴즈 ${it.n}문제`, mistakes: `오답노트 ${it.n}문장` })[it.kind];
  const mode = MODES[s.mode];
  return h('div', { class: 'page home' },
    h('p', { class: 'eyebrow' }, today),
    h('section', { class: 'today card' },
      h('div', { class: 'today-head' },
        h('h2', {}, '오늘의 학습'),
        h('span', { class: 'goal' }, `${mins} / ${s.dailyGoal}분`)),
      h('ol', { class: 'course' }, course.items.map((it) => h('li', { class: it.done ? 'done' : '' },
        h('a', { href: hrefFor(it, s.mode) }, h('span', { class: 'mark' }, it.done ? '✓' : ''), h('span', {}, itemLabel(it)))))),
      course.completed
        ? h('p', { class: 'done-msg' }, `🎉 오늘의 학습을 마쳤어요! 연속 ${st.n}일째예요.`)
        : h('a', { class: 'btn primary', href: hrefFor(course.items.find((it) => !it.done) || course.items[0], s.mode) }, course.items.some((it) => it.done) ? '이어서 하기' : '시작하기'),
      h('p', { class: 'note' }, MODE_NOTE[s.mode])),
    h('section', {},
      h('h3', { class: 'sec' }, '상황별 대화'),
      h('div', { class: 'domains' },
        data.domains.map((d) => {
          const on = s.domains.includes(d.id);
          const total = d.situations.length * 3;
          const done = d.situations.reduce((n, x) => n + [1, 2, 3].filter((lv) => seen.has(dialogueId(d.id, x.id, lv))).length, 0);
          return h('a', { class: `domain${on ? '' : ' off'}`, href: `#/sit/${d.id}` },
            h('span', { class: 'emoji' }, d.emoji),
            h('span', { class: 'dname' }, d.ko),
            h('span', { class: 'dcount' }, on ? `${done}/${total}` : '안 고름'));
        }))),
    h('section', {},
      h('h3', { class: 'sec' }, '다른 연습'),
      h('div', { class: 'more' },
        h('a', { class: 'more-item go', href: '#/listen' }, h('b', {}, '🎧 대화 듣기'), h('span', { class: 'note' }, '화면 끄고 이어폰으로')),
        h('a', { class: 'more-item go', href: '#/cards' }, h('b', {}, '🃏 카드 복습'), h('span', { class: 'note' }, '잊을 때쯤 다시')),
        h('a', { class: 'more-item go', href: '#/quiz' }, h('b', {}, '❓ 퀴즈'), h('span', { class: 'note' }, '최근 본 대화로 5문제')),
        h('a', { class: 'more-item go', href: '#/ai' }, h('b', {}, '🤖 AI 자유대화'), h('span', { class: 'note' }, 'AI 와 대화하고 다섯 단계 복습')),
        h('a', { class: 'more-item go', href: '#/import' }, h('b', {}, '📥 자료로 학습 만들기'), h('span', { class: 'note' }, '글 · 파일 · 사진을 대화 · 카드로')))),
  );
}
