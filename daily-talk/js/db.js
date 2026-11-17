// IndexedDB — 키-값 저장소 여러 개 (설계서 「5-5」). 값은 구조화 복제가 되는 것이면 무엇이든.
export const DATA_VERSION = 1;          // 기록 형식 판 — 바뀌면 migrate() 에 «더하기만» 하는 옮기기를 넣는다
const DB_NAME = 'daily-talk';
export const STORES = [
  'settings', 'secrets', 'progress', 'cards', 'mistakes', 'sessions',
  'customDialogues', 'aiChats', 'ttsCache', 'meta', 'backups', 'imports', 'submissions',
];
const NO_BACKUP = new Set(['secrets', 'ttsCache', 'backups']);

let dbp = null;
export function openDB() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function run(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const put = (store, key, value) => run(store, 'readwrite', (s) => s.put(value, key));
export const del = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => run(store, 'readwrite', (s) => s.clear());

export async function entries(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out = [];
    const req = db.transaction(store).objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

// 백업용으로 모든 기록을 한 덩어리로 (AI 키 · AI 음성 · 이전 백업은 뺌)
export async function exportAll(appVersion) {
  const stores = {};
  for (const s of STORES) if (!NO_BACKUP.has(s)) stores[s] = await entries(s);
  return { app: 'daily-talk', dataVersion: DATA_VERSION, appVersion, date: new Date().toISOString(), stores };
}

// 백업 파일 불러오기 — 백업에 든 저장소만 통째로 바꾼다 (AI 키 · AI 음성 · 자동 백업은 손대지 않음)
export async function importAll(snap) {
  for (const [store, rows] of Object.entries(snap.stores || {})) {
    if (!STORES.includes(store) || NO_BACKUP.has(store)) continue;
    await clear(store);
    for (const [k, v] of rows) await put(store, k, v);
  }
  await migrate();
}

// 업그레이드 직전 자동 백업 — 최근 3개만 남긴다
export async function autoBackup(appVersion) {
  const snap = await exportAll(appVersion);
  const key = `${snap.date}|${appVersion || '?'}`;
  await put('backups', key, snap);
  const keys = (await entries('backups')).map(([k]) => k).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 3))) await del('backups', k);
  return key;
}

// 기록 형식 옮기기 — 지금은 1판뿐. 앞으로는 칸을 «더하기만» 한다 (설계서 「5-8」)
export async function migrate() {
  const cur = (await get('meta', 'dataVersion')) || 0;
  if (cur < DATA_VERSION) await put('meta', 'dataVersion', DATA_VERSION);
}
