// 처음 안내 — 영역 고르기 → 수준 고르기(예문 듣기 또는 짧은 테스트) (설계서 「2-1」 · 「2-2」)
import { h, icon, toast, fill } from '../ui.js';
import { settings, setSetting } from '../settings.js';
import { loadSituations, loadDialogue, LEVEL_KO, audioURL, learnerRole } from '../content.js';
import * as audio from '../audio.js';

const LEVEL_DESC = {
  1: '짧고 자주 쓰는 문장을 입에 붙여요. 한국어 뜻이 늘 보여요.',
  2: '기본 대화를 더 자연스럽고 다양하게 해요.',
  3: '돌발 상황 · 정중한 표현 · 뉘앙스까지 다뤄요.',
};

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// 짧은 테스트 8문항 — 상대 말을 듣고 알맞은 다음 대답 고르기 (초급 3 · 중급 3 · 고급 2)
async function makeTest() {
  const data = await loadSituations();
  const doms = data.domains.filter((d) => ['travel', 'daily', 'social'].includes(d.id));
  const qs = [];
  for (const [level, count] of [[1, 3], [2, 3], [3, 2]]) {
    const ids = shuffle(doms.flatMap((d) => d.situations.map((s) => `${d.id}-${s.id}-${level}`)));
    for (let i = 0; qs.filter((q) => q.level === level).length < count && i < ids.length; i++) {
      const d = await loadDialogue(ids[i]);
      const me = learnerRole(d);
      const pairs = d.lines.map((ln, k) => [ln, d.lines[k + 1]]).filter(([a, b]) => b && a.role !== me && b.role === me);
      if (!pairs.length) continue;
      const [a, b] = pick(pairs);
      const wrong = [];
      for (const other of ids.slice(i + 1)) {
        if (wrong.length === 2) break;
        const o = await loadDialogue(other);
        const ol = o.lines.filter((x) => x.role === learnerRole(o));
        if (ol.length) wrong.push(pick(ol).en);
      }
      if (wrong.length < 2) continue;
      qs.push({ level, d, prompt: a, answer: b.en, options: shuffle([b.en, ...wrong]) });
    }
  }
  return qs;
}

export default async function onboarding() {
  const s = settings();
  const data = await loadSituations();
  const root = h('div', { class: 'page start' });
  let domains = [...s.domains];

  function step1() {
    fill(root, 
      h('p', { class: 'eyebrow' }, '1 / 2'),
      h('h1', {}, 'Daily Talk 에 오신 걸 환영해요'),
      h('p', { class: 'lead' }, '여행 · 일상 · 직장 · 학교 · 문화생활에서 바로 쓰는 영어를 듣고, 따라 말하고, 글로도 연습해요. 먼저 공부할 영역을 골라 주세요. 나중에 설정에서 바꿀 수 있어요.'),
      h('div', { class: 'pick-domains' }, data.domains.map((d) => h('label', { class: 'pick' },
        h('input', { type: 'checkbox', id: `s-${d.id}`, checked: domains.includes(d.id),
          onchange: (e) => { domains = e.target.checked ? [...new Set([...domains, d.id])] : domains.filter((x) => x !== d.id); } }),
        h('span', { class: 'emoji' }, d.emoji), h('b', {}, d.ko), h('small', {}, `${d.situations.length}개 상황`)))),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        if (!domains.length) { toast('영역을 하나 이상 골라 주세요.'); return; }
        await setSetting('domains', data.domains.map((d) => d.id).filter((id) => domains.includes(id)));
        step2();
      } }, '다음')));
  }

  async function step2() {
    fill(root, h('p', {}, '예문을 준비하는 중…'));
    const cards = [];
    for (const lv of [1, 2, 3]) {
      const d = await loadDialogue(`travel-hotel-checkin-${lv}`);
      const me = learnerRole(d);
      const ln = d.lines.find((x) => x.role === me);
      cards.push(h('div', { class: 'level-card card' },
        h('div', { class: 'lc-head' }, h('b', {}, LEVEL_KO[lv]),
          h('button', { type: 'button', class: 'say-btn', 'aria-label': `${LEVEL_KO[lv]} 예문 듣기`, html: icon('play', 18),
            onclick: () => audio.play(audioURL(d, ln.n)).catch(() => toast('소리를 틀 수 없어요.')) })),
        h('p', { class: 'en', lang: 'en' }, ln.en),
        h('p', { class: 'ko' }, ln.ko),
        h('p', { class: 'note' }, LEVEL_DESC[lv]),
        h('button', { type: 'button', class: 'btn', onclick: () => finish(lv) }, `${LEVEL_KO[lv]}으로 시작`)));
    }
    fill(root, 
      h('p', { class: 'eyebrow' }, '2 / 2'),
      h('h1', {}, '수준을 골라 주세요'),
      h('p', { class: 'lead' }, '호텔 체크인 대화의 세 수준 예문이에요. 들어 보고 고르거나, 짧은 테스트(8문제)로 추천받으세요.'),
      h('div', { class: 'level-cards' }, cards),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn ghost', onclick: test }, '짧은 테스트로 정하기')));
  }

  async function test() {
    fill(root, h('p', {}, '문제를 만드는 중…'));
    const qs = await makeTest();
    let i = 0; let score = 0;
    const show = () => {
      if (i >= qs.length) {
        const lv = score <= 3 ? 1 : score <= 6 ? 2 : 3;
        fill(root, h('h1', {}, `${qs.length}문제 중 ${score}개 맞혔어요`),
          h('p', { class: 'lead' }, `${LEVEL_KO[lv]}을 추천해요. ${LEVEL_DESC[lv]}`),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn primary', onclick: () => finish(lv) }, `${LEVEL_KO[lv]}으로 시작`),
            h('button', { type: 'button', class: 'btn ghost', onclick: step2 }, '직접 고르기')));
        return;
      }
      const q = qs[i];
      fill(root, 
        h('p', { class: 'eyebrow' }, `테스트 ${i + 1} / ${qs.length}`),
        h('h2', {}, '상대가 이렇게 말해요. 알맞은 대답은?'),
        h('div', { class: 'prompt card' },
          h('button', { type: 'button', class: 'say-btn', 'aria-label': '듣기', html: icon('play', 18),
            onclick: () => audio.play(audioURL(q.d, q.prompt.n)).catch(() => {}) }),
          h('p', { class: 'en', lang: 'en' }, q.prompt.en)),
        h('div', { class: 'options' }, q.options.map((o) => h('button', { type: 'button', class: 'option', lang: 'en', onclick: (e) => {
          const right = o === q.answer;
          if (right) score++;
          e.currentTarget.classList.add(right ? 'right' : 'wrong');
          for (const b of e.currentTarget.parentNode.children) { b.disabled = true; if (b.textContent === q.answer) b.classList.add('right'); }
          setTimeout(() => { i++; show(); }, 900);
        } }, o))));
    };
    show();
  }

  async function finish(lv) {
    audio.stop();
    await setSetting('level', lv);
    await setSetting('onboarded', true);
    toast(`${LEVEL_KO[lv]}으로 시작해요. 설정에서 언제든 바꿀 수 있어요.`);
    location.hash = '#/home';
  }

  step1();
  return root;
}
