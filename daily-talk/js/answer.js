// 연습 화면 공용 조각 — 뜻 보기 · 듣기 단추 · 결과 · 💬 쓰기 입력 · 🎤 말하기 · 🔴 녹음 (설계서 「4-3」 · 「4-4」)
import { h, icon, toast, fill } from './ui.js';
import { koVisible } from './settings.js';
import * as audio from './audio.js';
import * as speech from './speech.js';
import { wordBlocks, firstLetters } from './textmatch.js';

const HANGUL = /[\uac00-\ud7a3\u3131-\u318e]/;
export const VERDICT = { right: ['✅', '맞음'], close: ['✔', '거의 맞음'], retry: ['↻', '다시'] };

export function koLine(d, text) {
  const shown = koVisible(d.level);
  const p = h('p', { class: 'ko', hidden: !shown }, text);
  const btn = shown ? null : h('button', { type: 'button', class: 'linkish', onclick: (e) => { p.hidden = false; e.currentTarget.remove(); } }, '뜻 보기');
  return [p, btn];
}

export function playButton(url, label = '듣기', rate = () => 1) {
  return h('button', { type: 'button', class: 'say-btn', 'aria-label': label, html: icon('play', 18),
    onclick: () => (audio.isPlaying(url) ? audio.stop() : audio.play(url, { rate: rate() }).catch(() => toast('소리를 틀 수 없어요. 인터넷 연결을 확인해 주세요.'))) });
}

export function resultView(r, heard) {
  const [ico, ko] = VERDICT[r.verdict];
  const sentence = h('p', { class: 'target', lang: 'en' },
    r.words.map((w) => h('span', { class: `w-${w.status}`, title: w.got && w.status !== 'ok' ? `입력: ${w.got}` : null }, w.w + ' ')));
  return h('div', { class: `result r-${r.verdict}`, role: 'status' },
    h('b', {}, `${ico} ${ko}`),
    heard ? h('p', { class: 'heard' }, h('span', {}, '들은 말 '), heard) : null,
    r.verdict === 'right' ? null : h('p', { class: 'model', lang: 'en' }, h('span', {}, '정답 '), r.answer),
    r.verdict === 'right' ? null : sentence,
    r.extra.length ? h('p', { class: 'note' }, `덧붙인 말: ${r.extra.join(' ')}`) : null);
}

// 💬 쓰기 입력 — 초급: 단어 블록, 중급: 첫 글자 힌트 + 입력, 고급: 빈 입력 (설계서 「4-4」)
export function answerInput(sentence, level, onSubmit) {
  const wrap = h('div', { class: 'answer' });
  const text = () => h('input', { type: 'text', class: 'answer-text', lang: 'en', inputmode: 'text', autocomplete: 'off',
    autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send', placeholder: '영어로 입력…', 'aria-label': '영어로 입력' });

  function typed(hint) {
    const input = text();
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      if (HANGUL.test(v)) { toast('영어 자판으로 바꿔 주세요.'); return; }
      onSubmit(v);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    fill(wrap, 
      hint ? h('p', { class: 'letters', lang: 'en' }, firstLetters(sentence)) : null,
      h('div', { class: 'answer-row' }, input, h('button', { type: 'button', class: 'btn primary', onclick: submit }, '확인')),
      level === 1 ? h('button', { type: 'button', class: 'linkish', onclick: blocks }, '단어 블록으로') : null);
    setTimeout(() => input.focus(), 50);
  }

  function blocks() {
    const pool = wordBlocks(sentence).map((w, i) => ({ w, i, used: false }));
    const picked = [];
    const line = h('div', { class: 'picked', 'aria-label': '만든 문장' });
    const tray = h('div', { class: 'tray' });
    const draw = () => {
      fill(line, ...(picked.length ? picked.map((b, k) => h('button', { type: 'button', class: 'block on', lang: 'en',
        onclick: () => { b.used = false; picked.splice(k, 1); draw(); } }, b.w)) : [h('span', { class: 'note' }, '아래 단어를 차례로 누르세요')]));
      fill(tray, ...pool.map((b) => h('button', { type: 'button', class: 'block', lang: 'en', disabled: b.used,
        onclick: () => { b.used = true; picked.push(b); draw(); if (picked.length === pool.length) onSubmit(picked.map((x) => x.w).join(' ')); } }, b.w)));
    };
    draw();
    fill(wrap, line, tray,
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { pool.forEach((b) => { b.used = false; }); picked.length = 0; draw(); } }, '지우기'),
        h('button', { type: 'button', class: 'linkish', onclick: () => typed(false) }, '직접 입력')));
  }

  if (level === 1) blocks(); else typed(level === 2);
  return wrap;
}

// 🎤 말하기 단추 — 음성 인식으로 받아써서 onHeard(후보들)
export function micButton(onHeard) {
  const btn = h('button', { type: 'button', class: 'btn primary mic' }, '🎤 말하기');
  const live = h('p', { class: 'note live', 'aria-live': 'polite' });
  btn.addEventListener('click', async () => {
    if (btn.dataset.on) { speech.stopRecognize(); return; }
    audio.stop();
    btn.dataset.on = '1'; btn.textContent = '■ 듣는 중… (누르면 멈춤)'; live.textContent = '';
    try {
      const alts = await speech.recognize({ onInterim: (t) => { live.textContent = t; } });
      live.textContent = '';
      onHeard(alts);
    } catch (e) {
      live.textContent = speech.speechError(e);
    } finally { delete btn.dataset.on; btn.textContent = '🎤 다시 말하기'; }
  });
  return [btn, live];
}

// 🔴 녹음해서 원어민과 비교
export function recordButton(nativeUrl) {
  if (!speech.canRecord()) return null;
  const box = h('div', { class: 'rec' });
  let ctl = null; let mine = null;
  const btn = h('button', { type: 'button', class: 'btn ghost' }, '🔴 녹음해서 비교');
  btn.addEventListener('click', async () => {
    if (ctl) { mine = await ctl.stop(); ctl = null; btn.textContent = '🔴 다시 녹음'; draw(); return; }
    try { audio.stop(); ctl = await speech.startRecording(); btn.textContent = '■ 녹음 멈추기'; } catch { toast('마이크 사용을 허락해 주세요.'); }
  });
  const draw = () => fill(box, btn, mine ? h('span', { class: 'rec-play' },
    h('button', { type: 'button', class: 'btn ghost', onclick: () => audio.play(mine).catch(() => {}) }, '▶ 내 녹음'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => audio.play(nativeUrl).catch(() => {}) }, '▶ 원어민')) : null);
  draw();
  return box;
}

