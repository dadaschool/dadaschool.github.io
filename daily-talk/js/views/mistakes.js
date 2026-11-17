// 📝 오답노트 — 모아 보기 · 지금 모드로 다시 연습 (연속 두 번 맞히면 빠짐) (설계서 「4-7」 · 「4-9」)
import { h, fill, toast } from '../ui.js';
import { settings } from '../settings.js';
import { entries } from '../db.js';
import { loadDialogue, audioURL } from '../content.js';
import { compare } from '../textmatch.js';
import { answerInput, resultView, micButton, playButton } from '../answer.js';
import { rightAgain, addMistake, addTime, markToday } from '../record.js';
import * as speech from '../speech.js';
import * as audio from '../audio.js';

export default async function mistakes(arg) {
  let list = (await entries('mistakes')).map(([, v]) => v).sort((a, b) => b.count - a.count);
  if (!list.length) {
    return h('div', { class: 'page empty' }, h('div', { class: 'empty-art' }, '📝'), h('h2', {}, '오답노트가 비어 있어요'),
      h('p', {}, '따라 하기 · 역할 연습 · 퀴즈에서 틀린 문장이 여기 모여요. 두 번 연속 맞히면 빠져요.'));
  }
  if (arg !== 'practice') {
    return h('div', { class: 'page mistakes' },
      h('h1', {}, `📝 오답노트 ${list.length}문장`),
      h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: '#/mistakes/practice' }, '모아서 연습하기'), h('a', { class: 'btn ghost', href: '#/listen/mistakes' }, '🎧 듣기')),
      h('ul', { class: 'card-list' }, list.map((m) => h('li', {},
        h('div', {}, h('b', { lang: 'en' }, m.en), h('span', {}, m.ko)),
        h('span', { class: 'due-label' }, `${m.count}번`)))));
  }
  const s = settings();
  list = list.slice(0, 10);                          // 한 번에 10문장까지
  const mode = s.mode === 'listen' ? 'speak' : s.mode;
  const started = Date.now();
  const root = h('div', { class: 'page mistakes' });
  let i = 0;
  const show = async () => {
    if (i >= list.length) { addTime(mode, (Date.now() - started) / 1000); markToday('mistakes'); fill(root, h('div', { class: 'empty' }, h('h2', {}, '오답노트 연습 끝!'), h('a', { class: 'btn primary', href: '#/mistakes' }, '오답노트로'))); return; }
    const m = list[i];
    const d = await loadDialogue(m.id);
    const ln = d.lines.find((x) => x.n === m.n);
    const answers = [ln.en, ...(ln.alt || [])];
    const out = h('div', { class: 'out' });
    const nextBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => { i++; show(); } }, '다음 →');
    const judge = (r, heard) => {
      fill(out, resultView(r, heard));
      if (r.verdict === 'retry') addMistake(d, ln, 'mistakes'); else rightAgain(d, ln);
      nextBtn.hidden = false;
    };
    let control;
    if (mode === 'chat') control = answerInput(ln.en, d.level, (v) => judge(compare(v, answers)));
    else if (speech.canRecognize()) {
      const [mic, live] = micButton((alts) => { const best = alts.map((a) => ({ a, r: compare(a, answers, { speech: true }) })).sort((x, y) => y.r.score - x.r.score)[0]; judge(best.r, best.a); });
      control = h('div', {}, h('div', { class: 'btn-row' }, playButton(audioURL(d, ln.n), '원어민 듣기'), mic), live);
    } else control = answerInput(ln.en, 3, (v) => judge(compare(v, answers)));
    fill(root, h('p', { class: 'eyebrow' }, `오답노트 ${i + 1} / ${list.length} · ${d.title.ko}`),
      h('div', { class: 'card' }, h('p', { class: 'ko big' }, ln.ko), mode === 'speak' ? h('p', { class: 'note' }, '영어로 말해 보세요. 막히면 원어민 음성을 들어요.') : null),
      control, out, nextBtn);
  };
  show();
  return root;
}
