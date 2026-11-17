// 카드 간격 반복 — SM-2 를 단순하게 바꾼 방식 (설계서 「4-6」)
// grade: 0 다시 · 1 어려움 · 2 알맞음 · 3 쉬움
export const today = () => new Date().toLocaleDateString('sv-SE');
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

export function review(srs, grade) {
  const s = { interval: 0, ease: 2.5, reps: 0, lapses: 0, ...srs };
  if (grade === 0) {
    s.reps = 0; s.lapses += 1; s.interval = 0; s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = today();
  } else {
    s.reps += 1;
    if (s.reps === 1) s.interval = grade === 3 ? 3 : 1;
    else if (s.reps === 2) s.interval = grade === 1 ? 3 : grade === 2 ? 6 : 8;
    else s.interval = Math.max(s.interval + 1, Math.round(s.interval * s.ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1)));
    s.ease = Math.min(3, Math.max(1.3, s.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0)));
    s.due = addDays(s.interval);
  }
  s.last = Date.now();
  return s;
}

// 다음에 언제 나오는지 사람 말로
export function whenLabel(srs, grade) {
  const n = review(srs, grade).interval;
  return n === 0 ? '곧 다시' : n === 1 ? '내일' : `${n}일 뒤`;
}

export const isDue = (card) => (card.srs?.due || today()) <= today();
