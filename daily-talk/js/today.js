// 오늘의 학습 코스 만들기 (설계서 「3-2」) — 1 복습 카드 · 2 새 대화 1개 · 3 퀴즈 5문제 · 4 오답노트 1~3문장
// 코스는 그날 처음 열 때 한 번 정하고 meta/today-<날짜> 에 둔다. 모드에 따라 하는 방법만 달라진다.
import { get, put, entries } from './db.js';
import { settings } from './settings.js';
import { loadSituations, dialogueId } from './content.js';
import { isDue } from './srs.js';
import { dayKey } from './record.js';

export async function todayCourse() {
  const key = `today-${dayKey()}`;
  let course = await get('meta', key);
  if (course) return course;
  const s = settings();
  const data = await loadSituations();
  const progress = new Map(await entries('progress'));
  const level = s.level || 1;
  const doms = data.domains.filter((d) => s.domains.includes(d.id));
  // 새 대화: 말하기 모드면 «듣기 · 채팅으로만 끝낸» 대화를 먼저, 아니면 고른 영역을 돌아가며 아직 안 본 대화
  let next = null;
  if (s.mode === 'speak') {
    for (const [id, p] of progress) if (p?.modes && !p.modes.speak?.finish && (p.modes.chat?.finish || p.modes.listen?.listen)) { next = id; break; }
  }
  const lastDom = (await get('meta', 'lastCourseDomain')) || '';
  const order = [...doms.slice(doms.findIndex((d) => d.id === lastDom) + 1), ...doms];
  for (let i = 0; i < 11 && !next; i++) {
    for (const d of order) {
      const sit = d.situations[i];
      if (sit && !progress.get(dialogueId(d.id, sit.id, level))?.viewed) { next = dialogueId(d.id, sit.id, level); await put('meta', 'lastCourseDomain', d.id); break; }
    }
  }
  const dueCards = (await entries('cards')).filter(([, c]) => isDue(c)).length;
  const mistakes = (await entries('mistakes')).length;
  const items = [];
  if (dueCards) items.push({ kind: 'cards', n: Math.min(dueCards, s.dailyGoal), done: false });
  if (next) items.push({ kind: 'dialogue', id: next, done: false });
  items.push({ kind: 'quiz', n: 5, done: false });
  if (mistakes) items.push({ kind: 'mistakes', n: Math.min(3, mistakes), done: false });
  course = { date: dayKey(), items, completed: false };
  await put('meta', key, course);
  return course;
}

// 각 칸을 지금 모드로 여는 주소
export function hrefFor(it, mode) {
  if (it.kind === 'cards') return '#/cards/review';
  if (it.kind === 'dialogue') return mode === 'listen' ? `#/listen/d/${it.id}` : `#/p/${it.id}/listen`;
  if (it.kind === 'quiz') return '#/quiz';
  return '#/mistakes/practice';
}
