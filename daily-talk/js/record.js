// 학습 기록 — 진행 · 오답노트 · 카드 · 학습 시간 (설계서 「4-6」 · 「4-7」 · 「4-9」)
import { get, put } from './db.js';

export async function markStep(id, mode, step) {
  const p = (await get('progress', id)) || {};
  p.viewed = true;
  p.modes = p.modes || {};
  p.modes[mode] = { ...(p.modes[mode] || {}), [step]: Date.now() };
  await put('progress', id, p);
  if (step === 'finish' || (mode === 'listen' && step === 'listen')) await markToday('dialogue', id);
}

export async function addMistake(d, ln, reason) {
  const key = `${d.id}#${ln.n}`;
  const m = (await get('mistakes', key)) || { id: d.id, n: ln.n, en: ln.en, ko: ln.ko, count: 0, streak: 0 };
  m.count += 1; m.streak = 0; m.last = Date.now(); m.reason = reason;
  await put('mistakes', key, m);
}

// 오답노트에서 연속으로 두 번 맞히면 빠진다
export async function rightAgain(d, ln) {
  const key = `${d.id}#${ln.n}`;
  const m = await get('mistakes', key);
  if (!m) return;
  m.streak = (m.streak || 0) + 1;
  if (m.streak >= 2) { const { del } = await import('./db.js'); await del('mistakes', key); } else await put('mistakes', key, m);
}

export async function addCards(d, exprs) {
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const [i, x] of exprs) {
    const key = `${d.id}#${i}`;
    if (await get('cards', key)) continue;
    await put('cards', key, { en: x.en, ko: x.ko, note: x.note || '', from: d.id, line: x.fromLine || null, created: Date.now(),
      srs: { due: today, interval: 0, ease: 2.5, reps: 0, lapses: 0 } });
    n++;
  }
  return n;
}

// 학습 시간 — 날짜별 · 모드별 초 (한 번에 최대 15분까지만 셈)
export async function addTime(mode, seconds) {
  const s = Math.min(Math.round(seconds), 900);
  if (s < 5) return;
  const day = new Date().toLocaleDateString('sv-SE');
  const rec = (await get('sessions', day)) || {};
  rec[mode] = (rec[mode] || 0) + s;
  await put('sessions', day, rec);
  const goal = ((await get('settings', 'main')) || {}).dailyGoal || 10;
  if (Object.values(rec).reduce((a, b) => a + b, 0) >= goal * 60) await markDayDone();
}

// ── 오늘의 학습 · 연속 학습일 (설계서 「3-2」 · 「4-9」)
export const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE');

export async function todayMinutes() {
  const rec = (await get('sessions', dayKey())) || {};
  return Math.floor(Object.values(rec).reduce((a, b) => a + b, 0) / 60);
}

// 오늘의 학습 코스에서 한 칸을 마쳤다고 표시 — 다 마치면 그날을 완료로
export async function markToday(kind, id) {
  const key = `today-${dayKey()}`;
  const course = await get('meta', key);
  if (!course) return;
  let changed = false;
  for (const it of course.items) if (!it.done && it.kind === kind && (!it.id || !id || it.id === id)) { it.done = true; changed = true; break; }
  if (!changed) return;
  if (course.items.every((it) => it.done)) { course.completed = true; await markDayDone(); }
  await put('meta', key, course);
}

export async function markDayDone() {
  const days = (await get('meta', 'doneDays')) || {};
  if (!days[dayKey()]) { days[dayKey()] = true; await put('meta', 'doneDays', days); window.dispatchEvent(new CustomEvent('dt:streak')); }
}

export async function streak() {
  const days = (await get('meta', 'doneDays')) || {};
  const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);   // 오늘은 아직이면 어제부터 센다
  let n = 0;
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return { n, today: !!days[dayKey()] };
}
