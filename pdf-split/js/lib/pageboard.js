/* 쪽을 크게 띄워 놓고 «마우스로 사각형을 그리는» 공용 부품.
   ⬛ 검열(가릴 자리)과 ✍️ 서명(서명을 놓을 자리)이 같은 동작을 쓰므로 하나로 만들었다.

   ⚠ 좌표는 «보이는 그대로»(왼쪽 위가 0,0 · 단위 pt)로 돌려준다.
     PDF 안쪽 좌표(왼쪽 아래가 0,0)로 바꾸는 일은 쓰는 쪽에서 한다 —
     쪽마다 회전(/Rotate)이 다를 수 있어서 여기서 섣불리 바꾸면 어긋난다. */

import { $, html } from './ui.js';
import { drawPage } from './render.js';

export function makeBoard(mount, doc, { onChange, color = 'rgba(20,25,40,.75)' } = {}) {
  const boxes = new Map();            // 쪽번호 → [{x,y,w,h} … ] (pt · 왼쪽 위 기준)
  let pageNo = 1, view = null, busy = false;

  mount.innerHTML = '';
  const box = html(`
    <div class="board">
      <div class="board-bar">
        <button type="button" class="btn sub small prev">◀ 앞</button>
        <span class="board-no"></span>
        <button type="button" class="btn sub small next">뒤 ▶</button>
        <span class="spacer"></span>
        <span class="board-hint muted small">쪽 위에서 <b>끌어서</b> 네모를 그리세요</span>
        <button type="button" class="btn sub small undo">되돌리기</button>
        <button type="button" class="btn sub small clear">이 쪽 지우기</button>
      </div>
      <div class="board-stage">
        <div class="board-wrap"><div class="skel"></div></div>
      </div>
    </div>`);
  mount.appendChild(box);

  const wrap = $('.board-wrap', box);
  $('.prev', box).addEventListener('click', () => go(pageNo - 1));
  $('.next', box).addEventListener('click', () => go(pageNo + 1));
  $('.undo', box).addEventListener('click', () => { (boxes.get(pageNo) || []).pop(); paint(); });
  $('.clear', box).addEventListener('click', () => { boxes.delete(pageNo); paint(); });

  async function go(n) {
    if (busy || n < 1 || n > doc.numPages) return;
    busy = true; pageNo = n;
    $('.board-no', box).textContent = `${n} / ${doc.numPages}쪽`;
    try {
      const { canvas, ptWidth, ptHeight } = await drawPage(doc, n, { width: stageWidth() });
      view = { scale: canvas.width / ptWidth, ptWidth, ptHeight };
      wrap.innerHTML = '';
      canvas.className = 'board-page';
      wrap.appendChild(canvas);
      wrap.style.width = canvas.width + 'px';
      wrap.appendChild(layer);
      paint();
    } finally { busy = false; }
  }

  function stageWidth() {
    const w = $('.board-stage', box).clientWidth - 24;
    return Math.max(240, Math.min(760, w || 520));
  }

  /* ---- 네모 그리기 ---- */
  const layer = html('<div class="board-layer"></div>');
  let start = null;

  layer.addEventListener('pointerdown', e => {
    if (!view) return;
    layer.setPointerCapture(e.pointerId);
    const r = layer.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  layer.addEventListener('pointermove', e => {
    if (!start) return;
    const r = layer.getBoundingClientRect();
    drawTemp(start, { x: e.clientX - r.left, y: e.clientY - r.top });
  });
  layer.addEventListener('pointerup', e => {
    if (!start || !view) return;
    const r = layer.getBoundingClientRect();
    const end = { x: e.clientX - r.left, y: e.clientY - r.top };
    const px = norm(start, end);
    start = null;
    if (px.w < 6 || px.h < 6) { paint(); return; }         // 잘못 눌린 것은 버린다
    const list = boxes.get(pageNo) || [];
    list.push({ x: px.x / view.scale, y: px.y / view.scale, w: px.w / view.scale, h: px.h / view.scale });
    boxes.set(pageNo, list);
    paint();
  });

  const norm = (a, b) => ({
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y)
  });

  function drawTemp(a, b) {
    paint();
    const p = norm(a, b);
    const t = html('<div class="board-box temp"></div>');
    Object.assign(t.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px', background: color });
    layer.appendChild(t);
  }

  function paint() {
    layer.innerHTML = '';
    if (!view) return;
    (boxes.get(pageNo) || []).forEach((b, i) => {
      const d = html(`<div class="board-box"><span class="board-x" title="빼기">✕</span></div>`);
      Object.assign(d.style, {
        left: b.x * view.scale + 'px', top: b.y * view.scale + 'px',
        width: b.w * view.scale + 'px', height: b.h * view.scale + 'px', background: color
      });
      $('.board-x', d).addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        const list = boxes.get(pageNo); list.splice(i, 1);
        if (!list.length) boxes.delete(pageNo);
        paint();
      });
      layer.appendChild(d);
    });
    onChange?.(count());
  }

  const count = () => [...boxes.values()].reduce((s, l) => s + l.length, 0);

  go(1);

  return {
    get page() { return pageNo; },
    get total() { return doc.numPages; },
    goTo: go,
    /** 쪽번호 → [{x,y,w,h}] (pt · 왼쪽 위 기준). 없는 쪽은 들어 있지 않다. */
    all: () => new Map([...boxes].map(([k, v]) => [k, v.map(b => ({ ...b }))])),
    count,
    reset() { boxes.clear(); paint(); }
  };
}

/* 「보이는 좌표」 → 「PDF 안쪽 좌표」.
   ⚠ 쪽이 회전(/Rotate)되어 있으면 pdf-lib 이 쓰는 좌표계가 «보이는 것» 과 다르다.
     회전이 0 일 때만 안전하게 바꿀 수 있으므로, 회전이 있으면 null 을 돌려주고
     부르는 쪽이 «그 쪽은 이미지로 굳히는» 다른 길을 가게 한다. */
export function toPdfRect(page, box) {
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  if (angle !== 0) return null;
  const { height } = page.getSize();
  return { x: box.x, y: height - box.y - box.h, width: box.w, height: box.h };
}
