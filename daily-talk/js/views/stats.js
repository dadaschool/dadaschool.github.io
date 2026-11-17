// 📊 기록 — 연속 학습일 · 오늘 · 이번 주(모드별 막대) · 이번 달 · 카드 단계 · 영역별 진도 · 오답노트 (설계서 「4-9」)
import { h } from '../ui.js';
import { settings } from '../settings.js';
import { entries } from '../db.js';
import { loadSituations, dialogueId, LEVEL_KO } from '../content.js';
import { streak, dayKey } from '../record.js';
import { MODES } from '../modes.js';

const mins = (rec) => Math.round(Object.values(rec || {}).reduce((a, b) => a + b, 0) / 60);

export default async function stats() {
  const s = settings();
  const sess = new Map(await entries('sessions'));
  const st = await streak();
  const progress = new Map(await entries('progress'));
  const cards = (await entries('cards')).map(([, c]) => c);
  const mistakes = (await entries('mistakes')).length;
  const data = await loadSituations();

  // 이번 주 (오늘 포함 7일)
  const days = [];
  for (let k = 6; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); days.push(d); }
  const week = days.map((d) => ({ d, rec: sess.get(dayKey(d)) || {} }));
  const maxMin = Math.max(s.dailyGoal, ...week.map((w) => mins(w.rec)));
  const monthPrefix = dayKey().slice(0, 7);
  const monthMin = [...sess].filter(([k]) => k.startsWith(monthPrefix)).reduce((a, [, r]) => a + mins(r), 0);
  const weekMin = week.reduce((a, w) => a + mins(w.rec), 0);

  const plot = h('div', { class: 'wplot', role: 'img', 'aria-label': `이번 주 학습 ${weekMin}분, 목표 하루 ${s.dailyGoal}분` },
    week.map(({ rec }) => h('div', { class: 'wbar', style: `height:${Math.round((mins(rec) / maxMin) * 100)}%` },
      ['listen', 'chat', 'speak'].map((m) => (rec[m] ? h('span', { class: `seg-${m}`, style: `flex:${rec[m]}` }) : null)))),
    h('div', { class: 'wgoal', style: `bottom:${Math.round((s.dailyGoal / maxMin) * 100)}%` }, h('span', {}, `목표 ${s.dailyGoal}분`)));
  const labels = h('div', { class: 'wlabels' }, week.map(({ d, rec }) => h('span', {}, h('b', {}, mins(rec) ? `${mins(rec)}` : ''), d.toLocaleDateString('ko-KR', { weekday: 'narrow' }))));
  const bars = h('div', { class: 'week' }, plot, labels);

  const stage = { new: 0, learning: 0, mature: 0 };
  for (const c of cards) stage[!c.srs?.reps ? 'new' : (c.srs.interval || 0) >= 21 ? 'mature' : 'learning']++;

  const domRows = data.domains.map((d) => {
    const cells = [1, 2, 3].map((lv) => {
      const ids = d.situations.map((x) => dialogueId(d.id, x.id, lv));
      const fin = ids.filter((id) => { const m = progress.get(id)?.modes || {}; return m.speak?.finish || m.chat?.finish || m.listen?.listen; }).length;
      return h('td', {}, h('div', { class: 'pbar' }, h('span', { style: `width:${Math.round((fin / ids.length) * 100)}%` })), h('small', {}, `${fin}/${ids.length}`));
    });
    return h('tr', { class: s.domains.includes(d.id) ? '' : 'off' }, h('th', {}, `${d.emoji} ${d.ko}`), cells);
  });

  return h('div', { class: 'page stats' },
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat card' }, h('b', { class: st.today ? 'warm' : '' }, `🔥 ${st.n}일`), h('span', {}, '연속 학습')),
      h('div', { class: 'stat card' }, h('b', {}, `${mins(sess.get(dayKey()))}분`), h('span', {}, `오늘 · 목표 ${s.dailyGoal}분`)),
      h('div', { class: 'stat card' }, h('b', {}, `${monthMin}분`), h('span', {}, '이번 달'))),
    h('section', { class: 'card' },
      h('h2', {}, `이번 주 ${weekMin}분`),
      bars,
      h('p', { class: 'legend' }, ['speak', 'chat', 'listen'].map((m) => h('span', {}, h('i', { class: `seg-${m}` }), ` ${MODES[m].ico} ${MODES[m].ko}`)))),
    h('section', { class: 'card' },
      h('h2', {}, `카드 ${cards.length}장`),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('b', {}, `${stage.new}`), h('span', {}, '새 카드')),
        h('div', { class: 'stat' }, h('b', {}, `${stage.learning}`), h('span', {}, '익히는 중')),
        h('div', { class: 'stat' }, h('b', {}, `${stage.mature}`), h('span', {}, '외운 카드 (3주 이상)')))),
    h('section', { class: 'card' },
      h('h2', {}, '영역별 진도'),
      h('p', { class: 'note' }, '마무리까지 한 대화(듣기 모드는 끝까지 들은 대화) 수예요.'),
      h('div', { class: 'tbl' }, h('table', { class: 'prog' },
        h('tr', {}, h('th', {}, ''), [1, 2, 3].map((lv) => h('th', {}, LEVEL_KO[lv]))), domRows))),
    h('div', { class: 'more' },
      h('a', { class: 'more-item go', href: '#/mistakes' }, h('b', {}, `📝 오답노트 ${mistakes}문장`), h('span', { class: 'note' }, '모아서 다시 연습')),
      h('a', { class: 'more-item go', href: '#/quiz' }, h('b', {}, '❓ 퀴즈'), h('span', { class: 'note' }, '최근 본 대화로 5문제'))));
}
