// 말하기 — 브라우저 음성 인식(Web Speech API)과 녹음(MediaRecorder) (설계서 「4-3」)
// 안드로이드 크롬은 음성 인식이 마이크를 쓰는 동안 녹음을 같이 못 할 수 있어서, 둘을 따로 쓴다:
//   🎤 말하기 = 음성 인식으로 글자로 바꿔 확인 · 🔴 녹음 = 내 목소리를 녹음해 원어민과 번갈아 듣기
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecognize = () => !!SR;
export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

const MSG = {
  'not-allowed': '마이크 사용을 허락해 주세요 (주소창 왼쪽 자물쇠 → 마이크).',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. 채팅 모드로 해 보세요.',
  'no-speech': '말소리가 들리지 않았어요. 다시 눌러 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요.',
  network: '음성 인식은 인터넷이 필요해요.',
  aborted: '멈췄어요.',
};
export const speechError = (e) => MSG[e?.message] || `음성 인식이 안 됐어요 (${e?.message || e}).`;

let active = null;
// 결과: 받아쓴 후보 문장 배열 (가장 그럴듯한 것부터)
export function recognize({ lang = 'en-US', onInterim } = {}) {
  stopRecognize();
  return new Promise((resolve, reject) => {
    const r = new SR();
    active = r;
    r.lang = lang; r.continuous = false; r.interimResults = !!onInterim; r.maxAlternatives = 3;
    let final = null;
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      if (res.isFinal) final = Array.from(res).map((a) => a.transcript.trim()).filter(Boolean);
      else onInterim?.(res[0].transcript);
    };
    r.onerror = (e) => { active = null; reject(new Error(e.error)); };
    r.onend = () => { active = null; final?.length ? resolve(final) : reject(new Error('no-speech')); };
    r.start();
  });
}
export function stopRecognize() { try { active?.stop(); } catch { /* 이미 끝남 */ } active = null; }

// 녹음 — start() 하면 { stop(): Promise<blob URL> }
export async function startRecording(maxMs = 10000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
  return { stop: () => { clearTimeout(timer); if (rec.state === 'recording') rec.stop(); return done; } };
}
