// 프로그램 안 업그레이드 (설계서 「4-11」 · 「5-8」) — 코디네이터 프로그램과 같은 흐름
//   🔎 확인(update/latest.json) → ⬆ 받기(자동 백업 · 바뀐 파일만 · sha256 확인) → 🔄 다시 시작 · ↩ 되돌리기
// 서비스 워커(sw.js)는 «지금 판» 캐시의 파일만 내주므로, 받기만 해서는 화면이 바뀌지 않는다.
import { autoBackup, get, put } from './db.js';

const ROOT = new URL('../', import.meta.url);
const META_CACHE = 'dt-meta';
const STATE_URL = new URL('__dt/state', ROOT).href;
const appCache = (v) => `dt-app-${v}`;

export const supported = () => 'serviceWorker' in navigator && 'caches' in window && !!(window.crypto && crypto.subtle);

export async function getState() {
  if (!('caches' in window)) return { current: null, previous: null, pending: null };
  const r = await (await caches.open(META_CACHE)).match(STATE_URL);
  return r ? r.json() : { current: null, previous: null, pending: null };
}

async function setState(st) {
  await (await caches.open(META_CACHE)).put(STATE_URL,
    new Response(JSON.stringify(st), { headers: { 'content-type': 'application/json' } }));
}

export function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number); const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

export async function fetchLatest() {
  const r = await fetch(new URL(`update/latest.json?dt-dl=${Date.now()}`, ROOT), { cache: 'no-store' });
  if (r.status === 401) throw new Error('점검 사이트 로그인이 풀렸어요. 화면 위 [로그인] 을 눌러 다시 로그인하세요.');
  if (!r.ok) throw new Error(`새 판 정보를 읽지 못했어요 (${r.status})`);
  return r.json();
}

// 바뀐 파일과 그 크기
export function diff(st, latest) {
  const cur = st.current?.files || {};
  const changed = latest.files.filter((f) => cur[f.path] !== f.sha256);
  return { changed, bytes: changed.reduce((s, f) => s + f.size, 0) };
}

export async function check() {
  const st = await getState();
  const latest = await fetchLatest();
  await put('meta', 'lastUpdateCheck', Date.now());
  const newer = !st.current || cmpVer(latest.version, st.current.version) > 0;
  const already = st.pending && st.pending.version === latest.version;
  return { st, latest, newer, already, ...diff(st, latest) };
}

// 하루 한 번 조용히 확인 — 새 판이 있으면 true (받지는 않음)
export async function autoCheck() {
  if (!(await getState()).current) return false;      // 아직 설치 전이면 확인하지 않는다
  const last = (await get('meta', 'lastUpdateCheck')) || 0;
  if (Date.now() - last < 20 * 3600 * 1000) return (await get('meta', 'updateAvailable')) || false;
  try {
    const r = await check();
    await put('meta', 'updateAvailable', r.newer && !r.already ? r.latest.version : false);
    return r.newer && !r.already ? r.latest.version : false;
  } catch { return false; }
}

async function sha256(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json',
  webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml', opus: 'audio/ogg' };
const typeOf = (p) => TYPES[p.split('.').pop()] || 'application/octet-stream';

// ⬆ 받기 — onProgress(done, total, path)
export async function download(latest, onProgress = () => {}) {
  const st = await getState();
  await autoBackup(st.current?.version);
  const name = appCache(latest.version);
  await caches.delete(name);
  const next = await caches.open(name);
  const cur = st.current ? await caches.open(appCache(st.current.version)) : null;
  const curFiles = st.current?.files || {};
  try {
    let done = 0;
    for (const f of latest.files) {
      const url = new URL(f.path, ROOT).href;
      // 안 바뀐 파일은 지금 판에서 옮긴다 — 돌려보낸(redirected) 응답이 따라오지 않게 새로 싼다
      const same = cur && curFiles[f.path] === f.sha256 ? await cur.match(url) : null;
      let resp = same ? new Response(await same.arrayBuffer(), { headers: { 'content-type': typeOf(f.path) } }) : null;
      if (!resp) {
        const r = await fetch(`${url}?dt-dl=${f.sha256.slice(0, 12)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`${f.path} 를 받지 못했어요 (${r.status})`);
        const buf = await r.arrayBuffer();
        if ((await sha256(buf)) !== f.sha256) throw new Error(`${f.path} 확인에 실패했어요. 받다가 끊겼을 수 있어요.`);
        resp = new Response(buf, { headers: { 'content-type': typeOf(f.path) } });
      }
      await next.put(url, resp);
      onProgress(++done, latest.files.length, f.path);
    }
  } catch (e) {
    await caches.delete(name);                // 지금 판은 그대로 둔다
    throw e;
  }
  st.pending = {
    version: latest.version, date: latest.date, notes: latest.notes || [], dataVersion: latest.dataVersion,
    files: Object.fromEntries(latest.files.map((f) => [f.path, f.sha256])),
  };
  await setState(st);
  await put('meta', 'updateAvailable', false);
}

// 📁 파일로 업그레이드 — 안내 페이지에서 받은 dailytalk-<판>.zip 을 풀어 판 번호 · sha256 을 확인하고 받아 둔다
export function loadFflate() {
  if (window.fflate) return Promise.resolve(window.fflate);
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = new URL('js/vendor/fflate.min.js', ROOT).href;
    sc.onload = () => resolve(window.fflate);
    sc.onerror = () => reject(new Error('zip 풀기 도구를 불러오지 못했어요.'));
    document.head.append(sc);
  });
}

export async function fromZip(file, onProgress = () => {}) {
  const fflate = await loadFflate();
  let entries;
  try { entries = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new Error('zip 파일을 풀 수 없어요.'); }
  if (!entries['dailytalk.json']) throw new Error('Daily Talk 업그레이드 꾸러미가 아니에요.');
  const info = JSON.parse(new TextDecoder().decode(entries['dailytalk.json']));
  const st = await getState();
  if (st.current && cmpVer(info.version, st.current.version) <= 0 && !window.confirm(`꾸러미 판(${info.version})이 지금 판(${st.current.version})보다 높지 않아요. 그래도 설치할까요?`)) throw new Error('취소했어요.');
  await autoBackup(st.current?.version);
  const name = appCache(info.version);
  await caches.delete(name);
  const next = await caches.open(name);
  try {
    let done = 0;
    for (const f of info.files) {
      const data = entries[f.path];
      if (!data) throw new Error(`꾸러미에 ${f.path} 가 없어요.`);
      if ((await sha256(data)) !== f.sha256) throw new Error(`${f.path} 확인에 실패했어요. 꾸러미가 망가졌을 수 있어요.`);
      await next.put(new URL(f.path, ROOT).href, new Response(data, { headers: { 'content-type': typeOf(f.path) } }));
      onProgress(++done, info.files.length, f.path);
    }
  } catch (e) { await caches.delete(name); throw e; }
  st.pending = { version: info.version, date: info.date, notes: info.notes || [], dataVersion: info.dataVersion,
    files: Object.fromEntries(info.files.map((f) => [f.path, f.sha256])) };
  await setState(st);
  return info;
}

async function keepOnly(st) {
  const keep = new Set([st.current, st.previous, st.pending].filter(Boolean).map((v) => appCache(v.version)));
  for (const k of await caches.keys()) if (k.startsWith('dt-app-') && !keep.has(k)) await caches.delete(k);
}

// 🔄 새 판으로 다시 시작
export async function activate() {
  const st = await getState();
  if (!st.pending) return;
  st.previous = st.current;
  st.current = st.pending;
  st.pending = null;
  await setState(st);
  await keepOnly(st);
  await put('meta', 'justUpgraded', { from: st.previous?.version, to: st.current.version, notes: st.current.notes });
  location.reload();
}

// ↩ 이전 판으로 되돌리기 (기록은 그대로 — 옮기기는 «더하기만» 하므로 이전 판도 읽을 수 있음)
export async function rollback() {
  const st = await getState();
  if (!st.previous) return;
  [st.current, st.previous] = [st.previous, st.current];
  st.pending = null;
  await setState(st);
  await keepOnly(st);
  await put('meta', 'justUpgraded', { from: st.previous?.version, to: st.current.version, rollback: true });
  location.reload();
}
