/* 가계부 서비스 워커 — «판을 고르는 문지기» (설계서 「6-5」, daily-talk/sw.js 를 이 앱에 맞게 고쳐 씀)
 *
 * - 프로그램 파일은 판마다 캐시 lg-app-<판> 에 따로 저장되어 있다.
 * - 이 문지기는 캐시 lg-meta 의 «지금 판» 을 보고 그 캐시에서만 내준다.
 *   새 판을 받아 두어도(index.html 의 downloadUpdate) «지금 판» 을 바꾸기 전까지 화면은 그대로다.
 * - 처음 설치할 때만 update/latest.json 의 파일 목록을 받아 첫 판을 만든다.
 * - 가계부 데이터(IndexedDB)는 이 파일과 상관없다. 이 파일은 프로그램 파일만 다룬다.
 * - 이 파일은 거의 고치지 않는다. 고치더라도 예전 판 캐시를 그대로 읽을 수 있게 둔다.
 *   브라우저가 새 문지기를 받아도 바로 바꾸지 않는다(skipWaiting 은 첫 설치 때만).
 */
const SCOPE = self.registration.scope;                 // …/ledger/
const SCOPE_PATH = new URL(SCOPE).pathname;
const META = 'lg-meta';
const STATE = SCOPE + '__lg/state';
const appCache = (v) => 'lg-app-' + v;

// Cloudflare 정적 파일은 index.html → ./ 로 돌려보낸다(307). fetch 가 따라가서 받은 «돌려보낸 응답» 을
// 그대로 화면 열기(navigate)에 내주면 크롬이 ERR_FAILED 로 막는다 (daily-talk 에서 겪음, 2026-11-06).
// 그래서 저장할 때도 내줄 때도 새 응답으로 다시 싼다.
const clean = (r) => (r && r.redirected ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r);

async function getState() {
  const r = await (await caches.open(META)).match(STATE);
  return r ? r.json() : { current: null, previous: null, pending: null };
}
async function putState(st) {
  await (await caches.open(META)).put(STATE, new Response(JSON.stringify(st), { headers: { 'content-type': 'application/json' } }));
}

let installing = null;
function firstInstall() {
  if (!installing) installing = doFirstInstall().finally(() => { installing = null; });
  return installing;
}
async function doFirstInstall() {
  const st = await getState();
  if (st.current) return;
  let latest;
  try {
    const r = await fetch(SCOPE + 'update/latest.json?lg-dl=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;                                  // 아직 판이 없으면 그냥 네트워크로 연다
    latest = await r.json();
  } catch (e) { return; }
  const name = appCache(latest.version);
  const cache = await caches.open(name);
  try {
    for (const f of latest.files) {
      const r = await fetch(SCOPE + f.path + '?lg-dl=' + f.sha256.slice(0, 12), { cache: 'no-store' });
      if (!r.ok) throw new Error(f.path + ' ' + r.status);
      await cache.put(SCOPE + f.path, clean(r));
    }
  } catch (e) {
    await caches.delete(name);                          // 다음에 다시 시도
    return;
  }
  st.current = {
    version: latest.version, date: latest.date, notes: latest.notes || [], dataVersion: latest.dataVersion,
    files: Object.fromEntries(latest.files.map((f) => [f.path, f.sha256])),
  };
  await putState(st);
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const before = await getState();
    await firstInstall();
    if (!before.current) self.skipWaiting();           // 첫 설치만 바로 쓴다
  })());
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE)) return;
  if (url.searchParams.has('lg-dl')) return;           // 업그레이드 받기 · 로그인 확인은 언제나 네트워크
  const path = url.pathname.slice(SCOPE_PATH.length);
  if (path.startsWith('update/')) return;               // 새 판 정보
  e.respondWith(appFetch(req, path, e));
});

async function appFetch(req, path, e) {
  const st = await getState();
  if (!st.current) {
    e.waitUntil(firstInstall());
    return fetch(req);
  }
  const cache = await caches.open(appCache(st.current.version));
  const key = SCOPE + (path === '' || path.endsWith('/') ? 'index.html' : path);
  const hit = await cache.match(key, { ignoreSearch: true });
  if (hit) return clean(hit);
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === 'navigate') {
      const index = await cache.match(SCOPE + 'index.html');
      if (index) return clean(index);
    }
    return new Response('오프라인이라 열 수 없어요.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
