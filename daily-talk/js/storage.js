// 저장 공간 — 받아 둔 음성 세기 · 한도 넘으면 오래 안 연 대화부터 지우기 (설계서 「5-9」)
import { entries, get } from './db.js';
import { settings } from './settings.js';
import { ROOT } from './content.js';

let sizes = null;
async function manifest() {
  if (!sizes) {
    const r = await fetch(new URL('audio/manifest.json', ROOT));
    sizes = r.ok ? (await r.json()).dialogues : {};
  }
  return sizes;
}

// 받아 둔 음성: { 대화 id: { en: bytes, ko: bytes, urls: [...] } }
export async function audioUsage() {
  if (!('caches' in window)) return { total: 0, en: 0, ko: 0, count: 0, byDialogue: {} };
  const m = await manifest();
  const cache = await caches.open('dt-audio');
  const byDialogue = {};
  let en = 0; let ko = 0; let count = 0;
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    const mm = path.match(/audio\/([^/]+)\/(ko-)?(\d+)\.opus$/);
    if (!mm) continue;
    const [, id, isKo, n] = mm;
    const size = m[id]?.files?.[`${isKo || ''}${n}`]?.[0] || 8000;
    const e = byDialogue[id] || (byDialogue[id] = { en: 0, ko: 0, urls: [] });
    e[isKo ? 'ko' : 'en'] += size; e.urls.push(req.url);
    if (isKo) ko += size; else en += size;
    count++;
  }
  return { total: en + ko, en, ko, count, byDialogue };
}

export async function deleteAudio(filter) {
  const cache = await caches.open('dt-audio');
  let n = 0;
  for (const req of await cache.keys()) if (filter(req.url)) { await cache.delete(req); n++; }
  return n;
}

// 한도를 넘으면 오래 안 연 대화의 음성부터 지운다. 오늘의 학습 대화는 남긴다.
export async function cleanupAudio() {
  const limit = settings().storageLimitMB;
  if (!limit) return 0;
  const use = await audioUsage();
  if (use.total <= limit * 1024 * 1024) return 0;
  const progress = new Map(await entries('progress'));
  const today = await get('meta', `today-${new Date().toLocaleDateString('sv-SE')}`);
  const keep = new Set((today?.items || []).filter((it) => it.id).map((it) => it.id));
  const order = Object.keys(use.byDialogue).filter((id) => !keep.has(id))
    .sort((a, b) => (progress.get(a)?.lastSeen || 0) - (progress.get(b)?.lastSeen || 0));
  let total = use.total; let removed = 0;
  for (const id of order) {
    if (total <= limit * 1024 * 1024 * 0.9) break;
    const e = use.byDialogue[id];
    await deleteAudio((u) => e.urls.includes(u));
    total -= e.en + e.ko; removed++;
  }
  return removed;
}
