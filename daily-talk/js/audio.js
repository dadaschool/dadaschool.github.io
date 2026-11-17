// 소리 재생 — <audio> 하나로 문장 파일을 튼다 (연속 재생 · 잠금 화면 조작은 1차-4 player.js)
import { settings } from './settings.js';
import { audioText } from './content.js';
import { speak } from './tts.js';

const el = new Audio();
el.preload = 'auto';
let current = null;

export function play(url, { rate = 1, onend } = {}) {
  stop();
  current = { url, onend };
  const tts = url.startsWith('tts:');               // 내가 만든 상황 — 음성 파일 없음
  const t = (settings()?.lightMode || tts) && audioText.get(url);
  if (tts && !t) { current = null; return Promise.reject(new Error('읽을 글자가 없어요')); }
  if (t) {                                          // 가벼운 모드 — 미리 녹음 대신 휴대폰 음성
    return speak(t.text, t.lang, rate).then(() => { const c = current; current = null; c?.onend?.(); });
  }
  el.src = url;
  el.playbackRate = rate;
  el.onended = () => { const c = current; current = null; c?.onend?.(); };
  return el.play().catch((e) => { current = null; throw e; });
}

export function stop() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (!el.paused) el.pause();
  el.onended = null;
  current = null;
}

export const isPlaying = (url) => current && current.url === url && !el.paused;
