/* ✍️ 서명 · 도장 — 서명을 그리거나 그림으로 올려, 쪽 위 원하는 자리에 놓는다.
   🚨 이것은 «그림을 얹는 것» 이다. 공인인증서로 하는 전자서명(디지털 서명)이 아니다 —
     법적 효력이 필요한 문서라면 그쪽 프로그램을 써야 한다. 화면에 그대로 적어 두었다. */

import { $, $$, html, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc } from './lib/render.js';
import { makeBoard, toPdfRect } from './lib/pageboard.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument, degrees } = PDFLib;

export function makeSignTab(panel) {
  let src = null, board = null;
  let signPng = null;              // 서명 그림(PNG 바이트)

  panel.innerHTML = `
    <div class="intro">
      <h2>✍️ 서명 · 도장</h2>
      <p>서명을 그리거나 그림으로 올린 뒤, 쪽 위에서 <b>끌어서 자리를 정합니다.</b></p>
    </div>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col wide-right">
        <div class="opt-col">
          <div class="field">
            <div class="field-label">서명 만들기</div>
            <div class="sign-pad">
              <canvas class="sign-canvas" width="520" height="220"></canvas>
              <div class="sign-hint muted small">여기에 마우스·펜으로 그리세요</div>
            </div>
            <div class="tools">
              <button type="button" class="btn sub small sign-clear">지우기</button>
              <label class="btn sub small file-lbl">그림 올리기
                <input type="file" class="sign-file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden>
              </label>
              <span class="sign-state muted small">아직 서명이 없습니다</span>
            </div>
          </div>
          <p class="warn small">🚨 이것은 <b>그림을 얹는 것</b>입니다. 공인인증서로 하는
             <b>전자서명이 아닙니다</b> — 법적 효력이 필요한 문서에는 쓰지 마세요.</p>
          <button type="button" class="btn big run" disabled>서명 넣기</button>
          <div class="result"></div>
        </div>
        <div class="prev-col board-col"></div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel), elRun = $('.run', panel);
  const canvas = $('.sign-canvas', panel), ctx = canvas.getContext('2d');
  let drawing = false, hasInk = false;

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });

  /* ---------------- 서명 그리기 ---------------- */
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12203a';
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    drawing = true; hasInk = true;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    $('.sign-hint', panel).style.visibility = 'hidden';
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineWidth = 2 + (e.pressure ? e.pressure * 3 : 1.5);   // 펜이면 필압을 쓴다
    ctx.lineTo(p.x, p.y); ctx.stroke();
  });
  canvas.addEventListener('pointerup', async () => {
    if (!drawing) return;
    drawing = false;
    await takeInk();
  });
  $('.sign-clear', panel).addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false; signPng = null;
    $('.sign-hint', panel).style.visibility = '';
    state();
  });
  $('.sign-file', panel).addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = Math.min(canvas.width / im.naturalWidth, canvas.height / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.drawImage(im, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      URL.revokeObjectURL(url);
      hasInk = true;
      $('.sign-hint', panel).style.visibility = 'hidden';
      await takeInk();
    } catch { alert('그림을 읽지 못했습니다.'); }
    e.target.value = '';
  });

  /** 캔버스에서 «그린 부분만» 잘라 PNG 로 챙긴다(빈 여백이 딸려 가면 자리를 잡기 어렵다) */
  async function takeInk() {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0, found = false;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (img.data[(y * canvas.width + x) * 4 + 3] > 8) {
          found = true;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (!found) { signPng = null; state(); return; }
    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(canvas.width - 1, x1 + pad); y1 = Math.min(canvas.height - 1, y1 + pad);
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
    c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    signPng = { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
    c.width = c.height = 0;
    state();
  }

  function state() {
    const boxes = board?.count() || 0;
    $('.sign-state', panel).textContent = signPng
      ? (boxes ? `서명 준비됨 · 놓을 자리 ${boxes}곳` : '서명 준비됨 · 쪽 위에서 끌어 자리를 정하세요')
      : '아직 서명이 없습니다';
    elRun.disabled = !(src && signPng && boxes);
  }

  /* ---------------- 파일 ---------------- */
  async function load(file) {
    reset();
    if (!/\.pdf$/i.test(file.name)) { alert('PDF 파일만 넣을 수 있습니다.'); return; }
    overlay.show('PDF 를 읽는 중…');
    try {
      const buf = await file.arrayBuffer();
      const doc = await openDoc(buf);
      src = { buf, name: file.name, size: file.size, total: doc.numPages, doc };
      work.classList.remove('hidden');
      $('.filebar', panel).innerHTML = `
        <span class="f-name" title="${esc(src.name)}">📄 ${esc(src.name)}</span>
        <span class="badge">${src.total}쪽</span>
        <span class="badge soft">${fmtSize(src.size)}</span>
        <button type="button" class="btn sub small change">다른 파일</button>`;
      $('.change', panel).addEventListener('click', reset);
      board = makeBoard($('.board-col', panel), doc, { onChange: state, color: 'rgba(47,107,216,.30)' });
      state();
    } catch (e) { console.error(e); alert(readErr(e)); reset(); }
    finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.(); src = null; board = null;
    work.classList.add('hidden'); elResult.innerHTML = '';
    $('.board-col', panel).innerHTML = '';
    state();
  }

  /* ---------------- 실행 ---------------- */
  elRun.addEventListener('click', run);

  async function run() {
    if (!src || !signPng || !board.count()) return;
    overlay.show('서명을 넣는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.load(src.buf.slice(0));
      const img = await out.embedPng(signPng.bytes);
      const pages = out.getPages();
      const spots = board.all();
      let done = 0, skipped = [];

      for (const [pageNo, list] of spots) {
        const page = pages[pageNo - 1];
        if (!page) continue;
        for (const b of list) {
          const rect = toPdfRect(page, b);
          if (!rect) { skipped.push(pageNo); continue; }   // 돌아간 쪽은 좌표가 어긋난다 → 건너뛰고 알린다
          // 상자 안에 «비율을 지켜» 넣는다
          const k = Math.min(rect.width / signPng.w, rect.height / signPng.h);
          const w = signPng.w * k, h = signPng.h * k;
          page.drawImage(img, { x: rect.x + (rect.width - w) / 2, y: rect.y + (rect.height - h) / 2, width: w, height: h });
          done++;
        }
        overlay.step(done, board.count(), `${done} / ${board.count()}곳`);
        await breathe();
      }

      if (skipped.length) {
        note(elResult, `⚠ ${[...new Set(skipped)].join(', ')}쪽은 돌아가 있어(회전) 자리를 정확히 맞출 수 없어 건너뛰었습니다. ` +
                       `「🔃 페이지 구성」에서 똑바로 돌린 뒤 다시 해 주세요.`);
      }
      const box = html('<div></div>');
      elResult.appendChild(box);
      showResult(box, [{ name: `${baseName(src.name)}_서명.pdf`, note: `${done}곳`, bytes: await out.save() }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
