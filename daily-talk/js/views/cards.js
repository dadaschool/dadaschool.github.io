// 🃏 표현 암기 카드 — 목록 · 내 문장 추가 · 복습(모드별) (설계서 「4-6」)
import { h, icon, toast, fill } from '../ui.js';
import { settings } from '../settings.js';
import { entries, put, del } from '../db.js';
import { loadDialogue, audioURL } from '../content.js';
import { review, whenLabel, isDue, today } from '../srs.js';
import { compare } from '../textmatch.js';
import { answerInput, resultView } from '../answer.js';
import { addTime, markToday } from '../record.js';
import * as audio from '../audio.js';
import { speak } from '../tts.js';

const GRADES = [[0, '다시'], [1, '어려움'], [2, '알맞음'], [3, '쉬움']];

async function cardSound(card) {
  if (card.from && card.line) {
    try { const d = await loadDialogue(card.from); return { d, en: audioURL(d, card.line), ko: audioURL(d, card.line, true), line: d.lines.find((x) => x.n === card.line) }; } catch { /* */ }
  }
  return { d: null, en: null, ko: null, line: null };
}
const playEn = (snd, card) => (snd.en ? audio.play(snd.en) : speak(card.en)).catch?.(() => {});

export default async function cards() {
  const all = (await entries('cards')).sort((a, b) => (a[1].srs?.due || '').localeCompare(b[1].srs?.due || ''));
  const due = all.filter(([, c]) => isDue(c));
  const later = all.filter(([, c]) => c.later).length;
  const en = h('input', { type: 'text', id: 'my-en', lang: 'en', placeholder: '영어 문장', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const ko = h('input', { type: 'text', id: 'my-ko', placeholder: '한국어 뜻', autocomplete: 'off' });
  const add = async () => {
    if (!en.value.trim() || !ko.value.trim()) { toast('영어 문장과 뜻을 모두 써 주세요.'); return; }
    await put('cards', `mine#${Date.now()}`, { en: en.value.trim(), ko: ko.value.trim(), note: '', from: null, line: null, mine: true, created: Date.now(),
      srs: { due: today(), interval: 0, ease: 2.5, reps: 0, lapses: 0 } });
    toast('내 문장을 카드에 넣었어요.');
    location.hash = '#/cards'; window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  if (!all.length) {
    return h('div', { class: 'page cards' },
      h('div', { class: 'empty' }, h('div', { class: 'empty-art', 'aria-hidden': 'true' }, '🃏'), h('h2', {}, '아직 카드가 없어요'),
        h('p', {}, '대화 연습을 마무리하면 핵심 표현이 여기 카드로 쌓이고, 잊을 때쯤 다시 나와요.')),
      h('section', { class: 'card add-card' }, h('h2', {}, '내 문장 추가'), en, ko, h('button', { type: 'button', class: 'btn', onclick: add }, '카드에 넣기')));
  }
  return h('div', { class: 'page cards' },
    h('section', { class: 'card due' },
      h('p', { class: 'big-num' }, h('b', {}, `${due.length}`), '장'),
      h('p', {}, '오늘 복습할 카드', later ? h('span', { class: 'note' }, ` · 듣기로만 본 카드 ${later}장 (나중에 확인)`) : null),
      h('a', { class: `btn primary${due.length ? '' : ' disabled'}`, href: due.length ? '#/cards/review' : null, 'aria-disabled': String(!due.length) }, due.length ? '복습 시작' : '오늘은 다 했어요')),
    h('section', { class: 'card add-card' }, h('h2', {}, '내 문장 추가'), en, ko, h('button', { type: 'button', class: 'btn', onclick: add }, '카드에 넣기'),
      h('p', { class: 'note' }, '내 문장은 휴대폰 기본 음성으로 읽어요.')),
    h('section', {}, h('h3', { class: 'sec' }, `전체 카드 ${all.length}장`),
      h('ul', { class: 'card-list' }, all.map(([k, c]) => h('li', {},
        h('div', {}, h('b', { lang: 'en' }, c.en), h('span', {}, c.ko)),
        h('span', { class: 'due-label' }, isDue(c) ? '오늘' : c.srs.due.slice(5).replace('-', '/')),
        h('button', { type: 'button', class: 'x', 'aria-label': `${c.en} 지우기`, onclick: async (e) => {
          if (!window.confirm('이 카드를 지울까요?')) return;
          await del('cards', k); e.currentTarget.closest('li').remove();
        } }, '✕'))))));
}

export async function cardReview() {
  const s = settings();
  const mode = s.mode;
  const queue = (await entries('cards')).filter(([, c]) => isDue(c)).slice(0, Math.max(10, s.dailyGoal * 2));
  const total = queue.length;
  const started = Date.now();
  const root = h('div', { class: 'page review' });
  let doneN = 0;

  const finish = async () => {
    audio.stop();
    await addTime(mode, (Date.now() - started) / 1000);
    if (doneN) await markToday('cards');
    fill(root, h('div', { class: 'empty' }, h('div', { class: 'empty-art' }, '🎉'), h('h2', {}, `카드 ${doneN}장 복습했어요`),
      h('p', {}, h('a', { class: 'btn primary', href: '#/home' }, '홈으로'), ' ', h('a', { class: 'btn ghost', href: '#/cards' }, '카드 목록'))));
  };

  const grade = async (key, card, g) => {
    card.srs = review(card.srs, g);
    card.later = false;
    await put('cards', key, card);
    if (g === 0) queue.push([key, card]); else doneN++;
    show();
  };

  async function show() {
    if (!queue.length) { finish(); return; }
    const [key, card] = queue.shift();
    const snd = await cardSound(card);
    const head = h('p', { class: 'eyebrow' }, `${doneN + 1} / ${total}${snd.d ? ' · ' + snd.d.title.ko : card.mine ? ' · 내 문장' : ''}`);
    const front = h('div', { class: 'flash card' }, h('p', { class: 'ko big' }, card.ko));
    const gradeRow = (pre) => h('div', { class: 'grades' }, GRADES.map(([g, label]) => h('button', { type: 'button', class: `grade g${g}${pre === g ? ' pre' : ''}`,
      onclick: () => grade(key, card, g) }, h('b', {}, label), h('small', {}, whenLabel(card.srs, g)))));
    const back = (pre, extra) => {
      fill(front, h('p', { class: 'ko' }, card.ko), h('p', { class: 'en big', lang: 'en' }, card.en),
        card.note ? h('p', { class: 'note' }, card.note) : null,
        snd.line && card.en.includes('___') ? h('p', { class: 'note', lang: 'en' }, `대화 속 문장: ${snd.line.en}`) : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => playEn(snd, card) }, '▶ 듣기'), extra || null);
      fill(actions, gradeRow(pre));
      playEn(snd, card);
    };
    const actions = h('div', { class: 'actions' });

    if (mode === 'listen') {                         // 듣기: 뜻 → 쉼 → 영어, 복습 일정은 바꾸지 않음
      fill(root, head, front, h('p', { class: 'note' }, '🎧 듣기로 보는 카드는 복습 날짜를 바꾸지 않고 «나중에 확인» 으로 남겨요.'), actions);
      const nextCard = async () => { card.later = true; await put('cards', key, card); doneN++; show(); };
      const after = () => setTimeout(() => {
        fill(front, h('p', { class: 'ko' }, card.ko), h('p', { class: 'en big', lang: 'en' }, card.en));
        const p = snd.en ? audio.play(snd.en, { onend: () => setTimeout(nextCard, 1200) }) : speak(card.en).then(() => setTimeout(nextCard, 1200));
        p?.catch?.(() => setTimeout(nextCard, 1500));
      }, 2500);
      if (snd.ko) audio.play(snd.ko, { onend: after }).catch(after); else speak(card.ko, 'ko-KR').then(after);
      fill(actions, h('button', { type: 'button', class: 'btn ghost', onclick: () => { audio.stop(); finish(); } }, '그만 듣기'));
      return;
    }
    if (mode === 'chat') {                           // 채팅: 입력해서 확인 → 맞은 만큼 평가 단추를 미리 골라 둠
      const answers = card.en.includes('___') && snd.line ? [snd.line.en, ...(snd.line.alt || [])] : [card.en];
      const box = answerInput(answers[0], s.level === 1 ? 2 : s.level, (v) => {
        const r = compare(v, answers);
        back({ right: 2, close: 1, retry: 0 }[r.verdict], resultView(r));
      });
      fill(root, head, front, box, actions);
      fill(actions, h('button', { type: 'button', class: 'linkish', onclick: () => back(null) }, '모르겠어요 — 답 보기'));
      return;
    }
    fill(root, head, front, h('p', { class: 'note' }, '영어로 소리 내어 말해 본 뒤 뒤집으세요.'), actions);   // 말하기
    fill(actions, h('button', { type: 'button', class: 'btn primary wide', onclick: () => back(null) }, '뒤집기'));
  }
  show();
  return root;
}
