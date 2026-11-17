// 휴대폰 기본 음성 — 미리 녹음이 없는 문장(내 문장 · 내가 만든 상황)을 읽는다 (설계서 「5-4」)
export const canSpeak = () => 'speechSynthesis' in window;
export function speak(text, lang = 'en-US', rate = 1) {
  return new Promise((resolve) => {
    if (!canSpeak()) { resolve(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate;
    const v = speechSynthesis.getVoices().find((x) => x.lang.replace('_', '-').startsWith(lang));
    if (v) u.voice = v;
    u.onend = resolve; u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}
