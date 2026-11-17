// 내가 만든 학습 나누기 (설계서 「4-13」) — 🔒 비밀 · 📨 개발자에게 전달 · 🌐 모두에게 반영 제안
// 도우미 서버(Worker)가 생기기 전에는 «제안 파일»(.txt 안에 JSON)을 만들어 휴대폰 공유하기로 보낸다.
// 받은 사람(개발자)은 tools/제안_받기.py 로 tools/inbox/ 에 넣는다. 서버가 생기면 같은 확인 화면에서 서버로 보낸다.
import { get, put, entries } from './db.js';
import { VERSION } from './version.js';

export const VIS = { secret: '🔒 비밀', dev: '📨 개발자에게 전달됨', all: '📤 반영 제안 보냄' };
export const USE_KO = { dev: '📨 나만 쓰기 — 개발자 참고용', all: '🌐 모두에게 반영 제안' };

// 원문 문장을 그대로 담은 글(핵심 문장 따라 읽기) — 저작권 때문에 보내지 않는다
export const isVerbatim = (d) => !!d.verbatim || (d.kind === 'passage' && /^핵심 문장/.test(d.title?.ko || '') && !(d.questions?.length));

// 보낼 대상 읽기 — kind 'd'(내가 만든 상황 하나) · 'b'(자료 묶음)
export async function loadTarget(kind, id) {
  if (kind === 'b') {
    const bundle = await get('imports', id);
    if (!bundle) throw new Error('자료 묶음을 찾지 못했어요. 지웠을 수 있어요.');
    const all = (await Promise.all(bundle.items.map((x) => get('customDialogues', x)))).filter(Boolean);
    return { kind, id, title: bundle.title, bundle, all, items: all.filter((d) => !isVerbatim(d)), skipped: all.filter(isVerbatim), visibility: bundle.visibility || 'secret', submission: bundle.submission };
  }
  const d = await get('customDialogues', id);
  if (!d) throw new Error('내가 만든 상황을 찾지 못했어요. 지웠을 수 있어요.');
  return { kind, id, title: d.title.ko, all: [d], items: isVerbatim(d) ? [] : [d], skipped: isVerbatim(d) ? [d] : [], visibility: d.visibility || 'secret', submission: d.submission };
}

// 개인정보 모양 찾기 — 마지막 확인은 사용자와 개발자가 한다
const PRIV = [
  ['📞 전화번호', /(?:\+?82[-.\s]?)?\b0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}\b|\(\d{3}\)\s?\d{3}[-.\s]\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g],
  ['✉️ 이메일', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['🆔 주민등록번호', /\b\d{6}[-\s]?[1-4]\d{6}\b/g],
  ['🏦 계좌 · 카드 번호', /\b\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}(?:[-\s]\d{1,6})?\b/g],
];
export function findPrivate(text) {
  const out = []; const seen = new Set();
  for (const [label, re] of PRIV) {
    for (const m of String(text || '').matchAll(re)) {
      const v = m[0].trim();
      if (seen.has(v)) continue;
      if (label.startsWith('🏦') && v.replace(/\D/g, '').length < 10) continue;   // 날짜 · 시각 같은 짧은 숫자는 빼기
      seen.add(v); out.push({ label, value: v });
    }
  }
  return out;
}
// 학습 전체에서 찾기 → [{ d, where, n?, field, label, value }]
export function scanItems(items) {
  const hits = [];
  for (const d of items) {
    const add = (text, where, extra = {}) => findPrivate(text).forEach((f) => hits.push({ d, where, ...extra, ...f }));
    add(d.title?.ko, '제목'); add(d.title?.en, '제목'); add(d.scene?.ko, '장면');
    for (const l of d.lines) { add(l.en, `${l.n}번 문장`, { n: l.n }); add(l.ko, `${l.n}번 뜻`, { n: l.n }); (l.alt || []).forEach((a) => add(a, `${l.n}번 허용 답안`, { n: l.n })); }
    for (const x of d.expressions || []) { add(x.en, '표현'); add(x.ko, '표현'); add(x.note, '표현 설명'); }
    for (const q of d.questions || []) { add(q.q?.en, '퀴즈'); add(q.q?.ko, '퀴즈'); }
  }
  return hits;
}

// 보내는 것만 담기 — 학습 기록 · 자유대화 원래 기록 · 자료 원문 · 출처는 넣지 않는다
function itemPayload(d) {
  return {
    kind: d.kind || 'dialogue', source: d.source, level: d.level, title: d.title, scene: d.scene, roles: d.roles,
    lines: d.lines.map((l) => ({ n: l.n, role: l.role, en: l.en, ko: l.ko, ...(l.alt?.length ? { alt: l.alt } : {}) })),
    expressions: (d.expressions || []).map((x) => ({ en: x.en, ko: x.ko, note: x.note || '', fromLine: x.fromLine ?? null })),
    ...(d.questions?.length ? { questions: d.questions } : {}),
  };
}

export function buildSubmission(target, { use, note, nickname }) {
  const id = `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    app: 'daily-talk', type: 'submission', format: 1, id, created: new Date().toISOString(), appVersion: VERSION,
    use, note: note || '', nickname: use === 'all' ? (nickname || '') : '', consent: true,
    target: { kind: target.kind === 'b' ? 'bundle' : 'dialogue', title: target.title },
    items: target.items.map(itemPayload),
  };
}

// 파일 이름은 영문만 — 한글 이름은 브라우저에 따라 «download» 로 바뀐다(제목은 파일 안에 있음)
export const fileNameOf = (sub) => `dailytalk-suggestion-${sub.created.slice(0, 10).replace(/-/g, '')}-${sub.id.slice(2, 8)}.txt`;

// 휴대폰 공유하기로 보내기 (안 되면 파일로 받기) → 'shared' · 'downloaded' · 'cancel'
export async function deliver(sub) {
  const text = JSON.stringify(sub, null, 1);
  const file = new File([text], fileNameOf(sub), { type: 'text/plain' });   // 크롬 공유하기는 .json 을 받지 않아 .txt 로
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Daily Talk 학습 제안', text: `Daily Talk 학습 제안 — ${sub.target.title} (${sub.use === 'all' ? '모두에게 반영 제안' : '개발자 참고'})` });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancel';
    }
  }
  downloadFile(file);
  return 'downloaded';
}
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// 보냈다고 적기 — 대상의 공개 범위 · 제안 번호 + submissions 저장소
export async function markSent(target, sub, how) {
  await put('submissions', sub.id, { id: sub.id, target: { kind: target.kind, id: target.id, title: target.title }, use: sub.use, created: Date.now(),
    via: 'file', how, status: 'sent', items: target.items.map((d) => d.id), size: JSON.stringify(sub).length, file: sub });
  for (const d of target.items) await put('customDialogues', d.id, { ...d, visibility: sub.use, submission: sub.id });
  if (target.bundle) await put('imports', target.bundle.id, { ...target.bundle, visibility: sub.use, submission: sub.id });
}

// 🔒 비밀로 되돌리기 — 파일로 보낸 것은 앱이 지울 수 없으니 개발자에게 알리라고 안내한다
export async function withdraw(target) {
  if (target.submission) {
    const s = await get('submissions', target.submission);
    if (s) await put('submissions', s.id, { ...s, status: 'withdrawn', withdrawn: Date.now() });
  }
  for (const d of target.all) await put('customDialogues', d.id, { ...d, visibility: 'secret', submission: null });
  if (target.bundle) await put('imports', target.bundle.id, { ...target.bundle, visibility: 'secret', submission: null });
}

export async function lastSubmission(id) { return id ? get('submissions', id) : null; }
export async function allSubmissions() { return (await entries('submissions')).map(([, v]) => v); }
