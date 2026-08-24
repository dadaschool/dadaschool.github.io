/* PDF 도구 — 큰 묶음 4개 아래에 작은 탭을 둔다.
   도구가 12개라 한 줄에 다 늘어놓으면 세로 자리를 먹는다(사용자 지시로 «둘로 묶기»).
   탭 화면은 «처음 열 때» 만든다(12개를 한꺼번에 만들면 첫 화면이 느려진다). */

import { $, $$, html } from './lib/ui.js';
import { makeCutTab }      from './tab-cut.js';
import { makeMergeTab }    from './tab-merge.js';
import { makeOrganizeTab } from './tab-organize.js';
import { makeImagesTab }   from './tab-images.js';
import { makeConvertTab }  from './tab-convert.js';
import { makeTextTab }     from './tab-text.js';
import { makeNumberTab }   from './tab-number.js';
import { makeWatermarkTab } from './tab-watermark.js';
import { makeSignTab }     from './tab-sign.js';
import { makeCompressTab } from './tab-compress.js';
import { makeRedactTab }   from './tab-redact.js';
import { makeUnlockTab }   from './tab-unlock.js';

const GROUPS = [
  { id: 'org', icon: '📑', label: '구성', tabs: [
    { id: 'cut',      icon: '✂️',  label: '자르기',      make: makeCutTab },
    { id: 'merge',    icon: '🔗',  label: '붙이기',      make: makeMergeTab },
    { id: 'organize', icon: '🔃',  label: '페이지 구성', make: makeOrganizeTab },
    { id: 'images',   icon: '🖼',  label: '사진 → PDF',  make: makeImagesTab }
  ]},
  { id: 'conv', icon: '🔄', label: '변환', tabs: [
    { id: 'convert',  icon: '🖨',  label: '그림 · PPT',  make: makeConvertTab },
    { id: 'text',     icon: '📝',  label: '글자 뽑기',   make: makeTextTab }
  ]},
  { id: 'edit', icon: '✏️', label: '편집', tabs: [
    { id: 'number',    icon: '🔢', label: '페이지 번호', make: makeNumberTab },
    { id: 'watermark', icon: '💧', label: '워터마크',    make: makeWatermarkTab },
    { id: 'sign',      icon: '✍️', label: '서명 · 도장', make: makeSignTab }
  ]},
  { id: 'sec', icon: '🔒', label: '보안 · 용량', tabs: [
    { id: 'compress', icon: '🗜️', label: '용량 줄이기', make: makeCompressTab },
    { id: 'redact',   icon: '⬛',  label: '검열',        make: makeRedactTab },
    { id: 'unlock',   icon: '🔓',  label: '암호 풀기',   make: makeUnlockTab }
  ]}
];

const ALL = GROUPS.flatMap(g => g.tabs.map(t => ({ ...t, group: g.id })));
const groupBar = $('#groups'), tabBar = $('#tabs'), panels = $('#panels');
const made = {};

// 큰 묶음 단추
GROUPS.forEach(g => {
  const btn = html(`<button type="button" class="group" data-group="${g.id}">
                      <span class="g-ico">${g.icon}</span><span>${g.label}</span></button>`);
  btn.addEventListener('click', () => go(g.tabs[0].id));
  groupBar.appendChild(btn);
});

// 작은 탭 단추와 화면(모든 도구의 자리를 미리 만들어 둔다 — 안은 처음 열 때 채운다)
ALL.forEach(t => {
  const btn = html(`<button type="button" class="tab hidden" data-id="${t.id}" data-group="${t.group}">
                      <span class="t-ico">${t.icon}</span><span>${t.label}</span></button>`);
  btn.addEventListener('click', () => go(t.id));
  tabBar.appendChild(btn);
  panels.appendChild(html(`<section class="panel hidden" data-id="${t.id}"></section>`));
});

function go(id) {
  const tab = ALL.find(t => t.id === id);
  if (!tab) return;

  $$('.group', groupBar).forEach(b => b.classList.toggle('on', b.dataset.group === tab.group));
  $$('.tab', tabBar).forEach(b => {
    b.classList.toggle('hidden', b.dataset.group !== tab.group);   // 고른 묶음의 탭만 보인다
    b.classList.toggle('on', b.dataset.id === id);
  });
  $$('.panel', panels).forEach(p => p.classList.toggle('hidden', p.dataset.id !== id));

  if (!made[id]) made[id] = tab.make($(`.panel[data-id="${id}"]`, panels));
  location.hash = id;
}

// 주소 뒤에 #merge 처럼 붙여 바로 그 도구를 열 수 있다
go(ALL.some(t => '#' + t.id === location.hash) ? location.hash.slice(1) : ALL[0].id);

// 「불러오는 중」 안내를 지운다. 여기까지 왔다면 모듈이 제대로 읽힌 것이다
// (file:// 로 열면 모듈이 막혀 이 줄이 실행되지 않고 안내가 그대로 남는다 — 일부러 그렇게 두었다)
$('#boot')?.remove();
document.body.classList.add('ready');
