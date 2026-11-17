// 설정 — IndexedDB settings/main 한 칸에 모아 둔다
import { get, put } from './db.js';

export const ALL_DOMAINS = ['travel', 'daily', 'social', 'work', 'school', 'culture'];
export const DEFAULTS = {
  onboarded: false,
  level: null,               // 1 초급 · 2 중급 · 3 고급
  domains: ALL_DOMAINS,      // 공부할 영역
  dailyGoal: 10,             // 분
  mode: 'speak',             // speak 🎤 · chat 💬 · listen 🎧
  koDisplay: 'auto',         // auto(수준에 따라) · always · tap
  chatSound: true,
  autoUpdateCheck: true,     // 하루 한 번 새 판 확인 (받지는 않음)
  storageLimitMB: 30,
  lightMode: false,          // 가벼운 모드 — 미리 녹음 음성 대신 휴대폰 음성
  shareDefault: 'secret',    // 내가 만든 학습을 저장할 때 처음 골라져 있는 공개 범위 — secret 🔒 · dev 📨 · all 🌐 (「4-13」)
};

let cache = null;
export async function loadSettings() {
  cache = { ...DEFAULTS, ...((await get('settings', 'main')) || {}) };
  return cache;
}
export const settings = () => cache;
export async function setSetting(key, value) {
  cache = { ...cache, [key]: value };
  await put('settings', 'main', cache);
  window.dispatchEvent(new CustomEvent('dt:settings', { detail: { key, value } }));
}

// 한국어 뜻을 처음부터 보일지 (설계서 「2-1」)
export function koVisible(level) {
  if (cache.koDisplay === 'always') return true;
  if (cache.koDisplay === 'tap') return false;
  return level === 1;
}
