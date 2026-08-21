/* PDF 도구 — 탭을 갈아 끼우는 부분.
   탭은 «처음 열 때» 만들어 둔다(네 탭을 한꺼번에 만들면 첫 화면이 느려진다). */

import { $, $$, html } from './lib/ui.js';
import { makeCutTab } from './tab-cut.js';
import { makeMergeTab } from './tab-merge.js';
import { makeCompressTab } from './tab-compress.js';
import { makeConvertTab } from './tab-convert.js';

const TABS = [
  { id: 'cut',      icon: '✂️',  label: '자르기',      make: makeCutTab },
  { id: 'merge',    icon: '🔗',  label: '붙이기',      make: makeMergeTab },
  { id: 'compress', icon: '🗜️', label: '용량 줄이기', make: makeCompressTab },
  { id: 'convert',  icon: '🔄',  label: '변환',        make: makeConvertTab }
];

const tabBar = $('#tabs'), panels = $('#panels');
const made = {};

TABS.forEach((t, i) => {
  const btn = html(`<button type="button" class="tab${i === 0 ? ' on' : ''}" data-id="${t.id}">
                      <span class="t-ico">${t.icon}</span><span>${t.label}</span></button>`);
  btn.addEventListener('click', () => go(t.id));
  tabBar.appendChild(btn);

  const panel = html(`<section class="panel${i === 0 ? '' : ' hidden'}" data-id="${t.id}"></section>`);
  panels.appendChild(panel);
});

function go(id) {
  $$('.tab', tabBar).forEach(b => b.classList.toggle('on', b.dataset.id === id));
  $$('.panel', panels).forEach(p => p.classList.toggle('hidden', p.dataset.id !== id));
  build(id);
  location.hash = id;
}

function build(id) {
  if (made[id]) return;
  const t = TABS.find(x => x.id === id);
  const panel = $(`.panel[data-id="${id}"]`, panels);
  made[id] = t.make(panel);
}

// 주소 뒤에 #merge 처럼 붙여 바로 그 탭을 열 수 있다
const first = TABS.some(t => '#' + t.id === location.hash) ? location.hash.slice(1) : TABS[0].id;
go(first);

// 「불러오는 중」 안내를 지운다. 여기까지 왔다면 모듈이 제대로 읽힌 것이다
// (file:// 로 열면 모듈이 막혀 이 줄이 실행되지 않고 안내가 그대로 남는다 — 일부러 그렇게 두었다)
$('#boot')?.remove();
document.body.classList.add('ready');
