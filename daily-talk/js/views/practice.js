// 상황별 대화 연습 네 단계 (설계서 「4-2」 · 「4-3」 · 「4-4」)
//   1 듣기 → 2 따라 하기(🎤 말하기 · 💬 쓰기) → 3 역할 연습(🎤 · 💬 메신저) → 4 마무리(카드에 넣기)
// 🎧 듣기 모드는 연속 듣기(1차-4)로 연습하므로, 여기서는 말하기 · 채팅으로 바꾸도록 안내한다.
import { h, icon, toast, fill } from '../ui.js';
import { settings, setSetting, koVisible } from '../settings.js';
import { koLine, playButton, resultView, answerInput, micButton, recordButton, VERDICT } from '../answer.js';
import { loadDialogue, domainOf, LEVEL_KO, codeOf, audioURL, learnerRole } from '../content.js';
import * as audio from '../audio.js';
import * as speech from '../speech.js';
import { compare, wordBlocks, firstLetters } from '../textmatch.js';
import { markStep, addMistake, rightAgain, addCards, addTime } from '../record.js';
import { MODES } from '../modes.js';

const STEPS = [['listen', '듣기'], ['repeat', '따라 하기'], ['role', '역할 연습'], ['finish', '마무리']];

// ── 단계별 화면
function stepListen(ctx) {
  const { d, sound } = ctx;
  let slow = false;
  const rate = () => (slow ? 0.75 : 1);
  const items = d.lines.map((ln) => {
    const [ko, kobtn] = koLine(d, ln.ko);
    return h('li', { class: `line${ln.role === ctx.me ? ' me' : ''}`, dataset: { n: ln.n } },
      h('span', { class: `who${ln.role === ctx.me ? ' me' : ''}` }, ln.role),
      h('div', { class: 'say' }, h('p', { class: 'en', lang: 'en' }, ln.en), ko, kobtn),
      sound ? playButton(audioURL(d, ln.n), `${ln.n}번 듣기`, rate) : null);
  });
  const list = h('ol', { class: 'lines' }, items);
  const playAll = (i = 0) => {
    items.forEach((li) => li.classList.toggle('now', li.dataset.n === String(i + 1)));
    if (i >= d.lines.length) { items.forEach((li) => li.classList.remove('now')); return; }
    items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    audio.play(audioURL(d, d.lines[i].n), { rate: rate(), onend: () => setTimeout(() => playAll(i + 1), 450) }).catch(() => toast('소리를 틀 수 없어요.'));
  };
  const controls = sound
    ? h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => playAll(0) }, '▶ 전체 듣기'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'slow', onchange: (e) => { slow = e.target.checked; } }), ' 느리게(0.75배)'))
    : h('p', { class: 'note' }, '소리를 끈 채팅 모드라 대화를 읽어요. 위에서 아래로 천천히 읽어 보세요.');
  return [h('p', { class: 'lead' }, sound ? '대화를 처음부터 들어 보세요. 문장을 누르면 그 문장만 다시 들어요.' : '대화를 읽어 보세요.'),
    controls, list, ctx.nextButton(sound ? '다 들었어요 → 따라 하기' : '다 읽었어요 → 따라 쓰기')];
}

function stepRepeat(ctx) {
  const { d, mode, sound } = ctx;
  const mine = d.lines.filter((ln) => ln.role === ctx.me);
  let i = 0;
  const box = h('div', { class: 'repeat' });
  const show = () => {
    if (i >= mine.length) { fill(box, h('p', { class: 'lead' }, `내 문장 ${mine.length}개를 모두 따라 했어요.`), ctx.nextButton(d.kind === 'passage' ? '마무리 →' : '역할 연습 →')); return; }
    const ln = mine[i];
    const tries = { n: 0 };
    const url = audioURL(d, ln.n);
    const out = h('div', { class: 'out' });
    const nextBtn = h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => { i++; show(); } }, i + 1 < mine.length ? '다음 문장 →' : '끝내기 →');
    const judge = (r, heard) => {
      fill(out, resultView(r, heard));
      if (r.verdict === 'retry') { tries.n++; if (tries.n >= 2) addMistake(d, ln, 'repeat'); }
      else rightAgain(d, ln);
      nextBtn.hidden = false;
    };
    const [ko, kobtn] = koLine(d, ln.ko);
    let input;
    if (mode === 'chat') {
      input = h('div', {},
        h('p', { class: 'ko big' }, ln.ko),
        sound ? h('div', { class: 'btn-row' }, playButton(url, '원어민 듣기'), h('span', { class: 'note' }, '듣고 영어로 써 보세요')) : null,
        answerInput(ln.en, d.level, (v) => judge(compare(v, [ln.en, ...(ln.alt || [])])) ),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'linkish', onclick: () => { fill(out, h('p', { class: 'model', lang: 'en' }, h('span', {}, '정답 '), ln.en)); addMistake(d, ln, 'reveal'); nextBtn.hidden = false; } }, '정답 보기')));
    } else {
      const [mic, live] = speech.canRecognize() ? micButton((alts) => {
        const best = alts.map((a) => ({ a, r: compare(a, [ln.en, ...(ln.alt || [])], { speech: true }) }))
          .sort((x, y) => y.r.score - x.r.score)[0];
        judge(best.r, best.a);
      }) : [null, null];
      input = h('div', {},
        h('p', { class: 'en big', lang: 'en' }, ln.en), ko, kobtn,
        h('div', { class: 'btn-row' }, playButton(url, '원어민 듣기'), mic),
        live,
        speech.canRecognize() ? null : [h('p', { class: 'note' }, '이 브라우저는 음성 인식을 지원하지 않아요. 입력으로 확인해요.'),
          answerInput(ln.en, 3, (v) => judge(compare(v, [ln.en, ...(ln.alt || [])])))],
        recordButton(url));
      setTimeout(() => audio.play(url).catch(() => {}), 300);
    }
    fill(box, h('p', { class: 'eyebrow' }, `내 문장 ${i + 1} / ${mine.length}`), h('div', { class: 'card' }, input), out, nextBtn);
  };
  show();
  return [h('p', { class: 'lead' }, mode === 'chat' ? '내 차례 문장을 영어로 써 보세요.' : '원어민 음성을 듣고 똑같이 말해 보세요.'), box];
}

function stepRole(ctx) {
  const { d, mode, sound } = ctx;
  const box = h('div', { class: 'role' });
  const pick = (me) => {
    const chat = h('ol', { class: `chat${mode === 'chat' ? ' messenger' : ''}` });
    const tray = h('div', { class: 'turn' });
    let k = 0; let score = { right: 0, close: 0, retry: 0 };
    const bubble = (ln, mine, text, verdict) => {
      const b = h('li', { class: `bubble${mine ? ' mine' : ''}` },
        h('span', { class: 'who-name' }, d.roles[ln.role].ko),
        h('p', { class: 'en', lang: 'en' }, text || ln.en),
        verdict ? h('span', { class: `vmark r-${verdict}` }, VERDICT[verdict][0]) : null,
        mine && verdict && verdict !== 'right' ? h('p', { class: 'model', lang: 'en' }, h('span', {}, '정답 '), ln.en) : null,
        !mine && sound ? playButton(audioURL(d, ln.n)) : null);
      chat.append(b);
      b.scrollIntoView({ block: 'end', behavior: 'smooth' });
    };
    const step = () => {
      if (k >= d.lines.length) {
        fill(tray, h('p', { class: 'lead' }, `끝! 맞음 ${score.right} · 거의 맞음 ${score.close} · 다시 ${score.retry}`), ctx.nextButton('마무리 →'));
        return;
      }
      const ln = d.lines[k];
      if (ln.role !== me) {
        bubble(ln, false);
        fill(tray, h('p', { class: 'note' }, '…'));
        const go = () => { k++; step(); };
        if (sound) audio.play(audioURL(d, ln.n), { onend: () => setTimeout(go, 350) }).catch(() => setTimeout(go, 1200));
        else setTimeout(go, Math.min(2500, 700 + ln.en.length * 25));
        return;
      }
      // 내 차례 — 문장을 가리고 힌트를 단계별로
      let hint = 0;
      const hintBox = h('p', { class: 'hint-box' });
      const showHint = () => {
        hint++;
        const words = ln.en.split(' ');
        fill(hintBox, ...[
          hint >= 1 ? h('span', { class: 'ko' }, ln.ko) : null,
          hint >= 2 ? h('span', { lang: 'en' }, ` · ${words.slice(0, 1).join(' ')} …`) : null,
          hint >= 3 ? h('span', { lang: 'en', class: 'full' }, ` · ${ln.en}`) : null,
        ]);
        if (hint >= 3) hintBtn.disabled = true;
      };
      const hintBtn = h('button', { type: 'button', class: 'btn ghost', onclick: showHint }, '힌트');
      const done = (r, text) => {
        score[r.verdict]++;
        if (r.verdict === 'retry') addMistake(d, ln, 'role'); else rightAgain(d, ln);
        bubble(ln, true, text, r.verdict);
        k++; setTimeout(step, 600);
      };
      const answers = [ln.en, ...(ln.alt || [])];
      let control;
      if (mode === 'chat') control = answerInput(ln.en, d.level, (v) => done(compare(v, answers), v));
      else if (speech.canRecognize()) {
        const [mic, live] = micButton((alts) => {
          const best = alts.map((a) => ({ a, r: compare(a, answers, { speech: true }) })).sort((x, y) => y.r.score - x.r.score)[0];
          done(best.r, best.a);
        });
        control = h('div', {}, mic, live);
      } else control = answerInput(ln.en, 3, (v) => done(compare(v, answers), v));
      fill(tray, h('p', { class: 'eyebrow' }, `내 차례 — ${d.roles[me].ko}`), hintBox, h('div', { class: 'btn-row' }, hintBtn), control);
      if (d.level === 1) showHint();                   // 초급은 뜻을 먼저 보여 준다
    };
    fill(box, chat, tray);
    step();
  };
  const choose = h('div', { class: 'btn-row' }, Object.entries(d.roles).map(([k, v]) =>
    h('button', { type: 'button', class: `btn${k === ctx.me ? ' primary' : ''}`, onclick: () => pick(k) }, `${k} ${v.ko} 역할`)));
  fill(box, h('p', { class: 'lead' }, '내가 맡을 역할을 고르세요. 상대 대사는 ' + (sound ? '음성으로 나오고' : '글로 나오고') + ', 내 차례에는 문장이 가려져요.'), choose);
  return [box];
}

function stepFinish(ctx) {
  const { d } = ctx;
  const checks = d.expressions.map((x, i) => [i, x, h('input', { type: 'checkbox', id: `x-${i}`, checked: true })]);
  const save = h('button', { type: 'button', class: 'btn primary' }, '카드에 넣고 마치기');
  save.addEventListener('click', async () => {
    const n = await addCards(d, checks.filter(([, , c]) => c.checked).map(([i, x]) => [i, x]));
    await ctx.complete('finish');
    toast(n ? `핵심 표현 ${n}개를 카드에 넣었어요.` : '마쳤어요.');
    location.hash = `#/d/${d.id}`;
  });
  return [h('p', { class: 'lead' }, '이 대화의 핵심 표현이에요. 카드에 넣으면 잊을 때쯤 다시 보여 줘요(카드 복습은 1차-5).'),
    h('ul', { class: 'finish-list' }, checks.map(([i, x, c]) => h('li', {}, h('label', { class: 'check', for: `x-${i}` }, c,
      h('span', {}, h('b', { lang: 'en' }, x.en), ' ', x.ko, x.note ? h('small', {}, x.note) : null))))),
    save];
}

export default async function practice(id, step) {
  const d = await loadDialogue(id);
  const dom = await domainOf(d);
  const s = settings();
  const mode = s.mode;
  const steps = d.kind === 'passage' ? STEPS.filter(([k]) => k !== 'role') : STEPS;   // 글 학습은 역할 연습이 없다
  const idx = Math.max(0, steps.findIndex(([k]) => k === step));
  const started = Date.now();
  const ctx = {
    d, mode, me: learnerRole(d), sound: !(mode === 'chat' && !s.chatSound),
    async complete(k) { await markStep(d.id, mode, k); await addTime(mode, (Date.now() - started) / 1000); },
    nextButton(label) {
      const next = steps[idx + 1];
      return h('button', { type: 'button', class: 'btn primary next-step', onclick: async () => {
        audio.stop(); await ctx.complete(steps[idx][0]); location.hash = `#/p/${d.id}/${next[0]}`;
      } }, label);
    },
  };
  audio.stop();
  const head = h('header', { class: 'p-head' },
    h('a', { class: 'back', href: `#/d/${d.id}`, html: `${icon('back', 18)}<span>${codeOf(dom, d.situation)} ${d.title.ko} · ${LEVEL_KO[d.level]}</span>` }),
    h('ol', { class: 'stepper' }, steps.map(([k, label], i) => h('li', { class: i === idx ? 'on' : i < idx ? 'done' : '' },
      h('a', { href: `#/p/${d.id}/${k}` }, `${i + 1} ${k === 'repeat' && mode === 'chat' ? '따라 쓰기' : k === 'repeat' ? (d.kind === 'passage' ? '따라 읽기' : '따라 말하기') : label}`)))));

  if (mode === 'listen' && steps[idx][0] !== 'finish' && steps[idx][0] !== 'listen') {
    return h('div', { class: 'page practice' }, head,
      h('div', { class: 'card' }, h('p', { class: 'lead' }, '🎧 듣기 모드에서는 화면을 보지 않고 듣기만 해요. 따라 하기 · 역할 연습은 말하기나 채팅 모드로 해 주세요.'),
        h('p', {}, h('a', { class: 'btn primary', href: `#/listen/d/${d.id}` }, '🎧 이 대화 연속 듣기')),
        h('div', { class: 'btn-row' }, ['speak', 'chat'].map((m) => h('button', { type: 'button', class: 'btn', onclick: async () => {
          await setSetting('mode', m); document.body.dataset.mode = m;
          for (const b of document.querySelectorAll('.modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } }, `${MODES[m].ico} ${MODES[m].ko} 모드로`)))));
  }
  const body = { listen: stepListen, repeat: stepRepeat, role: stepRole, finish: stepFinish }[steps[idx][0]](ctx);
  return h('div', { class: 'page practice' }, head, ...body);
}
