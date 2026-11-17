// Daily Talk — 앱 틀: 머리줄(판 번호 · 연속 학습일 · 모드 전환 · 설정) · 화면 전환 · 아래 탭 4개
import { migrate, get, put, del } from './db.js';
import { streak } from './record.js';
import { cleanupAudio } from './storage.js';
import { loadSettings, settings, setSetting } from './settings.js';
import * as up from './upgrade.js';
import { VERSION } from './version.js';
import { h, icon, toast } from './ui.js';
import { MODES } from './modes.js';
import home from './views/home.js';
import situations from './views/situations.js';
import dialogue from './views/dialogue.js';
import cards, { cardReview } from './views/cards.js';
import quiz from './views/quiz.js';
import mistakes from './views/mistakes.js';
import stats from './views/stats.js';
import settingsView from './views/settings.js';
import onboarding from './views/onboarding.js';
import practice from './views/practice.js';
import listen from './views/listen.js';
import { aiStart, aiTalk, aiReview, aiRedo } from './views/aitalk.js';
import { importView } from './views/import.js';
import pquiz from './views/pquiz.js';
import sendView from './views/send.js';

const view = document.getElementById('view');


const ROUTES = [
  [/^#\/?(home)?$/, () => home(), 'home'],
  [/^#\/sit(?:\/([a-z]+))?$/, (m) => situations(m[1]), 'sit'],
  [/^#\/d\/([a-z0-9-]+)$/, (m) => dialogue(m[1]), 'sit'],
  [/^#\/p\/([a-z0-9-]+)\/([a-z]+)$/, (m) => practice(m[1], m[2]), 'sit'],
  [/^#\/listen(?:\/(.+))?$/, (m) => listen(m[1]), 'home'],
  [/^#\/cards$/, () => cards(), 'cards'],
  [/^#\/cards\/review$/, () => cardReview(), 'cards'],
  [/^#\/quiz(?:\/(.+))?$/, (m) => quiz(m[1]), 'home'],
  [/^#\/mistakes(?:\/(practice))?$/, (m) => mistakes(m[1]), 'stats'],
  [/^#\/stats$/, () => stats(), 'stats'],
  [/^#\/settings(?:\/(ai))?$/, (m) => settingsView(m[1]), 'settings'],
  [/^#\/ai$/, () => aiStart(), 'home'],
  [/^#\/import$/, () => importView(), 'home'],
  [/^#\/pq\/([a-z0-9-]+)$/, (m) => pquiz(m[1]), 'sit'],
  [/^#\/send\/(d|b)\/([a-z0-9-]+)(?:\/(dev|all))?$/, (m) => sendView(m[1], m[2], m[3]), 'sit'],
  [/^#\/ai\/talk$/, () => aiTalk(), 'home'],
  [/^#\/ai\/c\/([a-z0-9]+)$/, (m) => aiReview(m[1]), 'home'],
  [/^#\/ai\/c\/([a-z0-9]+)\/redo$/, (m) => aiRedo(m[1]), 'home'],
  [/^#\/start$/, () => onboarding(), 'start'],
];

let renderSeq = 0;
async function render() {
  const hash = location.hash || '#/home';
  const shortcut = hash.match(/^#(listen|chat|speak)$/);   // 홈 화면 바로가기 · 알림 링크
  if (shortcut) { await setMode(shortcut[1], true); location.replace(shortcut[1] === 'listen' ? '#/listen' : '#/home'); return; }
  if (!settings().onboarded && hash !== '#/start') { location.replace('#/start'); return; }
  const seq = ++renderSeq;
  const route = ROUTES.find(([re]) => re.test(hash)) || ROUTES[0];
  document.body.dataset.tab = route[2];
  for (const t of document.querySelectorAll('.tabs a')) t.setAttribute('aria-current', t.dataset.tab === route[2] ? 'page' : 'false');
  try {
    const node = await route[1](hash.match(route[0]));
    if (seq !== renderSeq) return;
    view.replaceChildren(node);
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, '화면을 열지 못했어요'), h('p', {}, e.message),
      h('p', {}, h('a', { href: '#/home', class: 'btn' }, '홈으로'))));
  }
  window.scrollTo(0, 0);
}
export const rerender = render;

async function setMode(m, quiet) {
  await setSetting('mode', m);
  document.body.dataset.mode = m;
  for (const b of document.querySelectorAll('.modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  if (!quiet) toast(MODES[m].tip);
}

function buildModes() {
  const box = document.querySelector('.modes');
  for (const [m, info] of Object.entries(MODES)) {
    box.append(h('button', { type: 'button', 'data-mode': m, 'aria-pressed': 'false', title: info.tip, 'aria-label': `${info.ko} 모드`,
      onclick: async () => { await setMode(m); render(); } }, info.ico));
  }
}

async function showVersion() {
  const st = await up.getState().catch(() => ({}));
  const el = document.getElementById('ver');
  el.textContent = st.current ? st.current.version : (VERSION === '0.0.0' ? '개발판' : `${VERSION} (설치 전)`);
  const just = await get('meta', 'justUpgraded');
  if (just) {
    await del('meta', 'justUpgraded');
    const msg = just.rollback ? `${just.to} 판으로 되돌렸어요.` : `${just.to} 판으로 바뀌었어요.${just.notes?.length ? ' ' + just.notes.join(' ') : ''}`;
    toast(msg, 6000);
  }
}

async function showStreak() {
  const el = document.getElementById('streak');
  const st = await streak();
  el.hidden = st.n === 0;
  el.textContent = `🔥 ${st.n}`;
  el.classList.toggle('today', st.today);
}

async function updateBadge() {
  if (!settings().autoUpdateCheck || !up.supported()) return;
  const v = await up.autoCheck();
  document.querySelector('.gear').classList.toggle('has-dot', !!v);
}

// 점검 사이트(geoje — 비밀번호 문)에서만 생기는 일: 크롬을 다시 켜면 브라우저가 로그인을 잊는다.
// 화면은 캐시로 열리지만 음성 · 새 판은 401 로 못 받으므로, 알아보고 [로그인] 을 보여 준다.
// [로그인] 은 끝 빗금 없는 주소(/daily-talk?login)로 간다 — 서비스 워커 범위(/daily-talk/) 밖이라 브라우저 로그인 창이 뜨고,
// 로그인하면 Cloudflare 가 /daily-talk/ 로 돌려보내 «지금 판» 화면이 열린다. 메인 사이트에서는 아무 일도 없다.
async function checkLogin() {
  let r;
  try { r = await fetch('update/latest.json?dt-dl=login-check', { method: 'HEAD', cache: 'no-store' }); } catch { return; }
  if (r.status !== 401 || document.querySelector('.login-bar')) return;
  view.before(h('div', { class: 'login-bar', role: 'alert' },
    h('span', {}, '점검 사이트 로그인이 풀렸어요. 음성 · 새 판을 받으려면 다시 로그인하세요.'),
    h('a', { class: 'btn small', href: `${location.pathname.replace(/\/+$/, '')}?login` }, '로그인')));
}

async function boot() {
  const qs = new URLSearchParams(location.search);
  if (qs.has('login')) history.replaceState(null, '', location.pathname + location.hash);
  // 다른 앱의 [공유] → Daily Talk (Web Share Target, GET: ./?title=&text=&url=) → 📥 자료로 학습 만들기
  if (qs.has('text') || qs.has('url') || qs.has('title')) {
    try { sessionStorage.setItem('dt-share', JSON.stringify({ title: qs.get('title') || '', text: qs.get('text') || '', url: qs.get('url') || '' })); } catch { /* 저장 못 하면 그냥 연다 */ }
    history.replaceState(null, '', `${location.pathname}#/import`);
  }
  document.querySelector('.gear').innerHTML = icon('gear', 22);
  for (const t of document.querySelectorAll('.tabs a')) t.querySelector('span.i').innerHTML = icon(t.dataset.icon, 24);
  await migrate();
  await loadSettings();
  buildModes();
  await setMode(settings().mode, true);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).catch((e) => console.warn('서비스 워커 등록 실패', e));
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', render);
  await render();
  showVersion();
  updateBadge();
  checkLogin();
  showStreak();
  window.addEventListener('dt:streak', showStreak);
  setTimeout(() => cleanupAudio().catch(() => {}), 4000);
}

boot();
