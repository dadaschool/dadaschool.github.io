// 대화 듣기 연속 재생기 (설계서 「4-5」 · 「5-1」)
// - <audio> 하나로 문장 파일을 차례로 튼다. 문장 사이 쉼은 타이머가 아니라 무음 파일로 채운다
//   (화면이 꺼지면 브라우저가 타이머를 늦추기 때문).
// - 재생 방식: plain(대화 그대로) · shadow(따라 하기 쉼) · meaning(영어 → 뜻 → 영어) · recall(뜻 → 쉼 → 영어)
// - 잠금 화면 · 이어폰 버튼: 재생 · 일시정지 · 이전/다음 문장 (Media Session API)
import { audioURL, ROOT, audioText } from './content.js';
import { settings } from './settings.js';
import { speak } from './tts.js';

const el = new Audio();
el.preload = 'auto';
const SILENCE = [3, 2, 1, 0.5];
const silenceURL = (s) => new URL(`audio/silence/${s}s.opus`, ROOT).href;

// 쉼 길이(초)를 무음 파일 조각으로 (3 · 2 · 1 · 0.5)
function silences(sec) {
  const out = [];
  let left = Math.round(sec * 2) / 2;
  for (const s of SILENCE) while (left >= s - 0.01) { out.push(s); left -= s; }
  return out;
}

export const state = {
  lines: [],      // [{ d, ln }] — 재생 목록의 문장들
  i: 0,           // 지금 문장
  plan: [],       // 지금 문장에서 남은 조각 [{ kind: 'en'|'ko'|'gap', url, sec? }]
  playing: false,
  opts: { method: 'plain', perLine: 1, loops: 1, rate: 1, roles: 'all', timer: 0 },
  loopsDone: 0,
  stopAt: 0,
  listened: 0,    // 들은 초
  onChange: null,
};

const emit = () => state.onChange?.(state);
const estimate = (text) => Math.min(4, Math.max(1.5, text.length * 0.065));

function planFor({ d, ln }) {
  const en = { kind: 'en', url: audioURL(d, ln.n) };
  const ko = { kind: 'ko', url: audioURL(d, ln.n, true) };
  const gap = (sec) => silences(sec).map((s) => ({ kind: 'gap', url: silenceURL(s), sec: s }));
  const m = state.opts.method;
  const one = m === 'meaning' ? [en, ...gap(0.5), ko, ...gap(0.5), { ...en }]
    : m === 'recall' ? [ko, ...gap(estimate(ln.en) + 0.5), en]
      : m === 'shadow' ? [en, { kind: 'shadow' }]          // shadow: 방금 문장 길이만큼 쉼 (재생 뒤에 길이를 앎)
        : [en];
  const plan = [];
  for (let r = 0; r < state.opts.perLine; r++) plan.push(...one.map((x) => ({ ...x })), ...gap(r < state.opts.perLine - 1 ? 0.5 : 0));
  plan.push(...gap(m === 'plain' ? 0.5 : 1));
  return plan;
}

function filtered(lines) {
  if (state.opts.roles === 'all') return lines;
  return lines.filter(({ d, ln }) => (state.opts.roles === 'me') === !!d.roles[ln.role].learner);
}

export function load(lines, opts = {}) {
  stop();
  state.opts = { ...state.opts, ...opts };
  state.lines = filtered(lines);
  state.i = 0; state.plan = []; state.loopsDone = 0;
  emit();
}

let lastEnDuration = 2;
function next() {
  if (state.stopAt && Date.now() >= state.stopAt) { pause(); state.stopAt = 0; emit(); return; }
  if (!state.plan.length) {
    if (state.i >= state.lines.length) {
      state.loopsDone++;
      if (state.opts.loops === 0 || state.loopsDone < state.opts.loops) state.i = 0;
      else { pause(); state.i = 0; emit(); return; }
    }
    state.plan = planFor(state.lines[state.i]);
    state.current = state.lines[state.i];
    state.i++;
    emit();
    meta();
  }
  let part = state.plan.shift();
  if (part.kind === 'shadow') {
    const parts = silences(lastEnDuration + 0.3).map((s) => ({ kind: 'gap', url: silenceURL(s), sec: s }));
    state.plan.unshift(...parts.slice(1));
    part = parts[0];
  }
  if (settings()?.lightMode) {                     // 가벼운 모드 — 휴대폰 음성 + 타이머 쉼 (화면을 켜 두어야 할 수 있음)
    const t = audioText.get(part.url);
    if (part.kind === 'gap') { setTimeout(() => { state.listened += part.sec; if (state.playing) next(); }, part.sec * 1000); return; }
    if (t) { speak(t.text, t.lang, state.opts.rate).then(() => { state.listened += t.text.length * 0.06; if (state.playing) next(); }); return; }
  }
  if (part.url.startsWith('tts:')) {               // 내가 만든 상황 — 음성 파일이 없어 휴대폰 음성으로
    const t = audioText.get(part.url);
    const go = () => { if (state.playing) next(); };
    if (t) speak(t.text, t.lang, state.opts.rate).then(() => { state.listened += t.text.length * 0.06; go(); }); else go();
    return;
  }
  el.src = part.url;
  el.playbackRate = part.kind === 'gap' ? 1 : state.opts.rate;
  el.preservesPitch = true;
  el.dataset.kind = part.kind;
  el.play().catch(() => { state.playing = false; emit(); });
}

el.addEventListener('ended', () => {
  if (el.dataset.kind === 'en' && el.duration && isFinite(el.duration)) lastEnDuration = el.duration / state.opts.rate;
  state.listened += (el.duration || 0) / (el.dataset.kind === 'gap' ? 1 : state.opts.rate);
  if (state.playing) next();
});
el.addEventListener('error', () => { if (state.playing) setTimeout(next, 300); });

export function play() {
  if (!state.lines.length) return;
  state.playing = true;
  if (state.opts.timer && !state.stopAt) state.stopAt = Date.now() + state.opts.timer * 60000;
  if (el.src && el.paused && el.currentTime > 0 && !el.ended) el.play().catch(() => {});
  else next();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  emit();
}

export function pause() {
  state.playing = false;
  el.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  emit();
}

export function stop() { pause(); el.removeAttribute('src'); state.plan = []; state.stopAt = 0; }

export function jump(delta) {
  // 지금 문장은 state.i - 1. delta -1 = 이전 문장, +1 = 다음 문장
  const cur = Math.max(0, state.i - 1);
  state.i = Math.min(Math.max(0, cur + delta), Math.max(0, state.lines.length - 1));
  state.plan = [];
  el.pause();
  el.removeAttribute('src');                      // 멈춘 채 옮기면 다음 ▶ 때 새 문장부터
  if (state.playing) next(); else { state.current = state.lines[state.i]; emit(); }
}

export function setOpt(key, value) {
  state.opts[key] = value;
  if (key === 'rate' && el.dataset.kind !== 'gap') el.playbackRate = value;
  if (key === 'timer') state.stopAt = value && state.playing ? Date.now() + value * 60000 : 0;
  emit();
}

function meta() {
  if (!('mediaSession' in navigator) || !state.current) return;
  const { d } = state.current;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${d.title.ko} · ${d.title.en}`,
    artist: `Daily Talk · ${state.label || ''}`,
    artwork: [{ src: new URL('icons/icon-512.png', ROOT).href, sizes: '512x512', type: 'image/png' }],
  });
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', play);
  ms.setActionHandler('pause', pause);
  ms.setActionHandler('previoustrack', () => jump(-1));
  ms.setActionHandler('nexttrack', () => jump(1));
}
