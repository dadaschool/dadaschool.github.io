// ❓ 퀴즈 — 듣고 대답 고르기 · 빈칸 · 단어 순서 · (듣기 모드) 떠올리기 (설계서 「4-7」)
import { h, icon, toast, fill } from '../ui.js';
import { settings } from '../settings.js';
import { entries } from '../db.js';
import { loadDialogue, loadSituations, audioURL, learnerRole, dialogueId, LEVEL_KO } from '../content.js';
import { compare } from '../textmatch.js';
import { answerInput, resultView, playButton } from '../answer.js';
import { addMistake, rightAgain, addTime, markToday } from '../record.js';
import * as audio from '../audio.js';

const STOP = new Set(['about', 'there', 'their', 'would', 'could', 'should', 'please', 'thank', 'thanks', 'which', 'where', 'what', 'have', 'this', 'that', 'with', 'your', 'from', 'they', 'were', 'been', 'will', 'just', 'really', 'very']);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const bare = (w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');

async function pool(arg) {
  const s = settings();
  let ids;
  if (arg && arg.startsWith('d/')) ids = [arg.slice(2)];
  else {
    ids = (await entries('progress')).filter(([, v]) => v?.lastSeen).sort((a, b) => b[1].lastSeen - a[1].lastSeen).slice(0, 5).map(([k]) => k);
    if (!ids.length) {
      const data = await loadSituations();
      const dom = data.domains.find((d) => s.domains.includes(d.id)) || data.domains[0];
      ids = dom.situations.slice(0, 3).map((x) => dialogueId(dom.id, x.id, s.level || 1));
    }
  }
  const ds = [];
  for (const id of ids) { try { ds.push(await loadDialogue(id)); } catch { /* */ } }
  return ds;
}

function makeQuestions(ds, n = 5) {
  const learnerLines = ds.flatMap((d) => d.lines.filter((l) => l.role === learnerRole(d)).map((ln) => ({ d, ln })));
  const pairs = ds.flatMap((d) => d.lines.map((a, i) => [a, d.lines[i + 1]]).filter(([a, b]) => b && a.role !== learnerRole(d) && b.role === learnerRole(d)).map(([a, b]) => ({ d, a, b })));
  const allWords = learnerLines.flatMap(({ ln }) => ln.en.split(/\s+/).map(bare)).filter((w) => w.length >= 4);
  const qs = [];
  const types = ['reply', 'blank', 'order'];
  for (let k = 0; qs.length < n && k < n * 4; k++) {
    const type = types[qs.length % 3];
    if (type === 'reply' && pairs.length) {
      const p = pick(pairs);
      const wrong = shuffle(learnerLines.filter((x) => x.ln.en !== p.b.en)).slice(0, 2).map((x) => x.ln.en);
      if (wrong.length < 2) continue;
      qs.push({ type, d: p.d, a: p.a, ln: p.b, options: shuffle([p.b.en, ...wrong]) });
    } else if (type === 'blank' && learnerLines.length) {
      const { d, ln } = pick(learnerLines);
      const words = ln.en.split(/\s+/);
      const cands = words.map((w, i) => [bare(w), i]).filter(([w]) => w.length >= 4 && !STOP.has(w.toLowerCase()));
      if (!cands.length) continue;
      const [word, idx] = pick(cands);
      const others = shuffle([...new Set(allWords.filter((w) => w.toLowerCase() !== word.toLowerCase()))]).slice(0, 2);
      if (others.length < 2) continue;
      const shown = words.map((w, i) => (i === idx ? w.replace(word, '_____') : w)).join(' ');
      qs.push({ type, d, ln, word, shown, options: shuffle([word, ...others]) });
    } else if (type === 'order') {
      const short = learnerLines.filter(({ ln }) => ln.en.split(/\s+/).length <= 10 && ln.en.split(/\s+/).length >= 3);
      if (!short.length) continue;
      const { d, ln } = pick(short);
      qs.push({ type, d, ln });
    }
  }
  return qs;
}

export default async function quiz(arg) {
  const s = settings();
  const mode = s.mode;
  const sound = !(mode === 'chat' && !s.chatSound);
  const ds = await pool(arg);
  const root = h('div', { class: 'page quiz' });
  const started = Date.now();
  if (!ds.length) return fill(root, h('p', {}, '퀴즈를 낼 대화가 없어요. 대화를 먼저 살펴보세요.'));

  if (mode === 'listen') {                           // 떠올리기 — 상대 말 → 쉼 → 정답 대사, 채점하지 않음
    const pairs = shuffle(ds.flatMap((d) => d.lines.map((a, i) => [a, d.lines[i + 1]]).filter(([a, b]) => b && a.role !== learnerRole(d) && b.role === learnerRole(d)).map(([a, b]) => ({ d, a, b })))).slice(0, 6);
    let i = 0;
    const card = h('div', { class: 'card flash' });
    const run = () => {
      if (i >= pairs.length) { addTime(mode, (Date.now() - started) / 1000); markToday('quiz'); fill(root, h('div', { class: 'empty' }, h('h2', {}, '떠올리기 끝!'), h('a', { class: 'btn primary', href: '#/home' }, '홈으로'))); return; }
      const { d, a, b } = pairs[i];
      fill(card, h('p', { class: 'eyebrow' }, `떠올리기 ${i + 1} / ${pairs.length}`), h('p', { class: 'en', lang: 'en' }, a.en), h('p', { class: 'note' }, '다음 대사를 떠올려 보세요…'));
      audio.play(audioURL(d, a.n), { onend: () => setTimeout(() => {
        fill(card, h('p', { class: 'eyebrow' }, `떠올리기 ${i + 1} / ${pairs.length}`), h('p', { class: 'en', lang: 'en' }, a.en), h('p', { class: 'en big', lang: 'en' }, b.en), h('p', { class: 'ko' }, b.ko));
        audio.play(audioURL(d, b.n), { onend: () => setTimeout(() => { i++; run(); }, 1500) }).catch(() => setTimeout(() => { i++; run(); }, 2500));
      }, 3000) }).catch(() => setTimeout(() => { i++; run(); }, 2000));
    };
    fill(root, h('h1', {}, '🎧 떠올리기'), h('p', { class: 'note' }, '상대 말을 듣고, 내가 할 대답을 먼저 떠올린 뒤 정답을 들어요. 채점하지 않아요.'), card);
    run();
    return root;
  }

  const qs = makeQuestions(ds);
  let i = 0; let score = 0;
  const next = () => { i++; show(); };
  function show() {
    audio.stop();
    if (i >= qs.length) {
      addTime(mode, (Date.now() - started) / 1000);
      markToday('quiz');
      fill(root, h('div', { class: 'empty' }, h('div', { class: 'empty-art' }, score === qs.length ? '🎉' : '📝'),
        h('h2', {}, `${qs.length}문제 중 ${score}개 맞혔어요`),
        h('p', { class: 'note' }, score < qs.length ? '틀린 문장은 오답노트에 들어갔어요.' : ''),
        h('p', {}, h('a', { class: 'btn primary', href: '#/home' }, '홈으로'), ' ', h('a', { class: 'btn ghost', href: '#/mistakes' }, '오답노트'))));
      return;
    }
    const q = qs[i];
    const out = h('div', { class: 'out' });
    const nextBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: next }, i + 1 < qs.length ? '다음 문제 →' : '결과 보기 →');
    const mark = (right) => {
      if (right) { score++; rightAgain(q.d, q.ln); } else addMistake(q.d, q.ln, 'quiz');
      nextBtn.hidden = false;
    };
    const choices = (opts, answer) => h('div', { class: 'options' }, opts.map((o) => h('button', { type: 'button', class: 'option', lang: 'en', onclick: (e) => {
      const ok = o === answer;
      e.currentTarget.classList.add(ok ? 'right' : 'wrong');
      for (const b of e.currentTarget.parentNode.children) { b.disabled = true; if (b.textContent === answer) b.classList.add('right'); }
      mark(ok);
    } }, o)));
    let body;
    if (q.type === 'reply') {
      const said = h('p', { class: 'en', lang: 'en', hidden: sound }, q.a.en);
      body = [h('h2', {}, sound ? '듣고 알맞은 대답을 고르세요' : '읽고 알맞은 대답을 고르세요'),
        h('div', { class: 'prompt card' }, sound ? playButton(audioURL(q.d, q.a.n), '상대 말 듣기') : null, said,
          sound ? h('button', { type: 'button', class: 'linkish', onclick: (e) => { said.hidden = false; e.currentTarget.remove(); } }, '글 보기') : null),
        choices(q.options, q.ln.en)];
      if (sound) setTimeout(() => audio.play(audioURL(q.d, q.a.n)).catch(() => {}), 300);
    } else if (q.type === 'blank') {
      body = [h('h2', {}, '빈칸에 알맞은 말은?'), h('div', { class: 'card' }, h('p', { class: 'en big', lang: 'en' }, q.shown), h('p', { class: 'ko' }, q.ln.ko)), choices(q.options, q.word)];
    } else {
      body = [h('h2', {}, '단어를 순서대로 눌러 문장을 만드세요'), h('p', { class: 'ko big' }, q.ln.ko),
        answerInput(q.ln.en, 1, (v) => { const r = compare(v, [q.ln.en, ...(q.ln.alt || [])]); fill(out, resultView(r)); mark(r.verdict !== 'retry'); })];
    }
    fill(root, h('p', { class: 'eyebrow' }, `퀴즈 ${i + 1} / ${qs.length} · ${q.d.title.ko} ${LEVEL_KO[q.d.level]}`), ...body, out, nextBtn);
  }
  show();
  return root;
}
