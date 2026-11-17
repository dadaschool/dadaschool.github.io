// ❓ 내용 퀴즈 — 글 학습(자료로 만든 요약)의 O/X · 고르기 · 빈칸 (설계서 「2-4」 questions · 「4-12」) — #/pq/<id>
import { h, fill, icon } from '../ui.js';
import { loadDialogue } from '../content.js';
import { addTime, markToday } from '../record.js';
import { normalize } from '../textmatch.js';

const same = (a, b) => normalize(a).join(' ') === normalize(b).join(' ');

export default async function pquiz(id) {
  const d = await loadDialogue(id);
  const qs = d.questions || [];
  const started = Date.now();
  const box = h('div', { class: 'pq' });
  let k = 0; let right = 0;
  const show = () => {
    if (k >= qs.length) {
      addTime('chat', (Date.now() - started) / 1000);
      markToday('quiz', id);
      fill(box, h('div', { class: 'card' }, h('p', { class: 'lead' }, `끝! ${qs.length}문제 중 ${right}개 맞았어요.`),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: () => { k = 0; right = 0; show(); } }, '다시 풀기'),
          h('a', { class: 'btn ghost', href: `#/d/${id}` }, '글로 돌아가기'))));
      return;
    }
    const q = qs[k];
    const out = h('div', { class: 'out' });
    const next = h('button', { type: 'button', class: 'btn primary', hidden: true, onclick: () => { k++; show(); } }, k + 1 < qs.length ? '다음 →' : '끝내기');
    const judge = (ok, answerText) => {
      if (ok) right++;
      fill(out, h('div', { class: `result r-${ok ? 'right' : 'retry'}`, role: 'status' }, h('b', {}, ok ? '✅ 맞음' : '↻ 틀림'),
        ok ? null : h('p', { class: 'model' }, h('span', {}, '정답 '), answerText)));
      for (const b of box.querySelectorAll('.pq-choices button, .pq-blank button')) b.disabled = true;
      next.hidden = false;
    };
    let control;
    if (q.type === 'ox') {
      control = h('div', { class: 'btn-row pq-choices' }, [[true, '⭕ 맞다'], [false, '❌ 아니다']].map(([v, label]) =>
        h('button', { type: 'button', class: 'btn', onclick: () => judge(v === q.answer, q.answer ? '⭕ 맞다' : '❌ 아니다') }, label)));
    } else if (q.type === 'choice') {
      control = h('div', { class: 'pq-choices' }, q.options.map((o, i) =>
        h('button', { type: 'button', class: 'btn ghost choice', lang: 'en', onclick: () => judge(i === q.answer, q.options[q.answer]) }, o)));
    } else {
      const input = h('input', { type: 'text', class: 'answer-text', lang: 'en', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '빈칸에 들어갈 말', 'aria-label': '빈칸에 들어갈 말' });
      const go = () => { if (input.value.trim()) judge(same(input.value, q.answer), q.answer); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      control = h('div', { class: 'answer-row pq-blank' }, input, h('button', { type: 'button', class: 'btn primary', onclick: go }, '확인'));
    }
    fill(box,
      h('p', { class: 'eyebrow' }, `${k + 1} / ${qs.length} · ${{ ox: 'O/X', choice: '고르기', blank: '빈칸' }[q.type]}`),
      h('div', { class: 'card' }, h('p', { class: 'en', lang: 'en' }, q.q.en), q.q.ko ? h('p', { class: 'ko' }, q.q.ko) : null, control),
      out, next);
  };
  if (qs.length) show(); else fill(box, h('p', { class: 'note' }, '이 글에는 내용 퀴즈가 없어요.'));
  return h('div', { class: 'page quiz' },
    h('a', { class: 'back', href: `#/d/${id}`, html: `${icon('back', 18)}<span>${d.title.ko}</span>` }),
    h('h1', {}, '❓ 내용 퀴즈'),
    box);
}
