/* 🔢 페이지 번호 — 쪽 아래(또는 위)에 번호를 찍는다.
   ⚠ 숫자만 쓰면 pdf-lib 기본 글꼴로 충분하다. 「- 3 -」·「3 / 12」 처럼 기호만 섞어도 마찬가지다.
     한글을 넣고 싶을 때만(예 「3쪽」) 한글 글꼴을 끼운다 — 그때만 2MB 를 읽는다. */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage } from './lib/render.js';
import { parseRanges, baseName } from './lib/ranges.js';
import { embedKorean, needsKorean } from './lib/fonts.js';

const { PDFDocument, StandardFonts, rgb } = PDFLib;

const SPOTS = {
  'bc': '아래 가운데', 'br': '아래 오른쪽', 'bl': '아래 왼쪽',
  'tc': '위 가운데',  'tr': '위 오른쪽',  'tl': '위 왼쪽'
};

export function makeNumberTab(panel) {
  let src = null;
  let spot = 'bc', size = 11, start = 1, from = 1, form = 'n', margin = 28;

  panel.innerHTML = `
    <div class="intro">
      <h2>🔢 페이지 번호</h2>
      <p>유인물 묶음에 쪽 번호를 찍습니다. 위치·모양·시작 번호를 고를 수 있습니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li>학습지 여러 장을 붙인 뒤 번호를 넣어 <b>「3쪽 펴세요」</b> 라고 말할 수 있게</li>
        <li><b>표지에는 번호를 빼고</b> 싶을 때 → 「몇 쪽부터」 를 <code>2</code> 로</li>
        <li>결재 서류에는 <b><code>3 / 12</code></b> 모양이 깔끔합니다</li>
        <li>양면 인쇄할 거면 위치를 <b>아래 가운데</b> 로 두는 것이 무난합니다</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col">
        <div class="prev-col">
          <div class="prev-frame"><div class="skel"></div></div>
          <div class="muted center small">미리보기 (1쪽 · 번호 자리는 아래 설정대로)</div>
        </div>
        <div class="opt-col">
          <div class="field">
            <div class="field-label">위치</div>
            <div class="segmented wrap">
              ${Object.entries(SPOTS).map(([k, v]) => `<button type="button" class="seg${k === 'bc' ? ' on' : ''}" data-spot="${k}">${v}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <div class="field-label">모양</div>
            <div class="segmented">
              <button type="button" class="seg on" data-form="n">3</button>
              <button type="button" class="seg" data-form="dash">- 3 -</button>
              <button type="button" class="seg" data-form="of">3 / 12</button>
              <button type="button" class="seg" data-form="ko">3쪽</button>
            </div>
          </div>
          <div class="field row2">
            <label>글자 크기 <input type="number" class="num" id="n-size" min="6" max="30" value="11"></label>
            <label>여백(pt) <input type="number" class="num" id="n-mg" min="8" max="80" value="28"></label>
          </div>
          <div class="field row2">
            <label>시작 번호 <input type="number" class="num" id="n-start" min="0" max="9999" value="1"></label>
            <label>몇 쪽부터 <input type="number" class="num" id="n-from" min="1" value="1"></label>
          </div>
          <p class="muted small">「몇 쪽부터」를 2로 두면 표지에는 번호가 찍히지 않습니다.</p>
          <button type="button" class="btn big run">번호 넣기</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });
  $$('[data-spot]', panel).forEach(b => b.addEventListener('click', () => {
    $$('[data-spot]', panel).forEach(x => x.classList.remove('on')); b.classList.add('on'); spot = b.dataset.spot; preview();
  }));
  $$('[data-form]', panel).forEach(b => b.addEventListener('click', () => {
    $$('[data-form]', panel).forEach(x => x.classList.remove('on')); b.classList.add('on'); form = b.dataset.form; preview();
  }));
  $('#n-size', panel).addEventListener('input', e => { size = clamp(e.target.value, 6, 30, 11); preview(); });
  $('#n-mg', panel).addEventListener('input', e => { margin = clamp(e.target.value, 8, 80, 28); preview(); });
  $('#n-start', panel).addEventListener('input', e => { start = clamp(e.target.value, 0, 9999, 1); preview(); });
  $('#n-from', panel).addEventListener('input', e => { from = clamp(e.target.value, 1, 9999, 1); preview(); });
  $('.run', panel).addEventListener('click', run);

  const clamp = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number(v) || d));

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
      $('#n-from', panel).max = src.total;
      preview();
    } catch (e) { console.error(e); alert(readErr(e)); reset(); }
    finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.(); src = null;
    work.classList.add('hidden');
    elResult.innerHTML = '';
    $('.prev-frame', panel).innerHTML = '<div class="skel"></div>';
  }

  /** 1쪽을 그리고 그 위에 번호가 갈 자리를 «빨간 글씨»로 얹어 보여 준다 */
  async function preview() {
    if (!src) return;
    try {
      const { canvas, ptWidth, ptHeight } = await drawPage(src.doc, 1, { width: 300 });
      const k = canvas.width / ptWidth;
      const ctx = canvas.getContext('2d');
      const label = text(1);
      ctx.font = `${Math.max(7, size * k)}px "맑은 고딕", sans-serif`;
      ctx.fillStyle = '#c0392b';
      const tw = ctx.measureText(label).width;
      const bottom = spot[0] === 'b';
      const x = spot[1] === 'c' ? (canvas.width - tw) / 2 : spot[1] === 'r' ? canvas.width - margin * k - tw : margin * k;
      const y = bottom ? canvas.height - margin * k : margin * k + size * k;
      ctx.fillText(label, x, y);
      const frame = $('.prev-frame', panel);
      frame.innerHTML = ''; canvas.classList.add('prev-img'); frame.appendChild(canvas);
    } catch (e) { console.error(e); }
  }

  function text(n) {
    const shown = start + (n - from);
    const total = src ? src.total - from + start : 0;
    return form === 'dash' ? `- ${shown} -` : form === 'of' ? `${shown} / ${total}` : form === 'ko' ? `${shown}쪽` : `${shown}`;
  }

  /* ---------------- 실행 ---------------- */
  async function run() {
    if (!src) return;
    overlay.show('번호를 넣는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.load(src.buf.slice(0));
      const korean = form === 'ko' || needsKorean(text(1));
      const font = korean ? await embedKorean(out, m => overlay.show(m)) : await out.embedFont(StandardFonts.Helvetica);
      overlay.show('번호를 넣는 중…');

      const pages = out.getPages();
      for (let i = 0; i < pages.length; i++) {
        const n = i + 1;
        if (n < from) continue;
        const page = pages[i];
        const label = text(n);
        const tw = font.widthOfTextAtSize(label, size);
        const { width, height } = page.getSize();
        const bottom = spot[0] === 'b';
        const x = spot[1] === 'c' ? (width - tw) / 2 : spot[1] === 'r' ? width - margin - tw : margin;
        const y = bottom ? margin : height - margin - size;
        page.drawText(label, { x, y, size, font, color: rgb(0.15, 0.18, 0.25) });
        overlay.step(n, pages.length, `${n} / ${pages.length}쪽`);
        if (n % 10 === 0) await breathe();
      }
      showResult(elResult, [{ name: `${baseName(src.name)}_번호.pdf`, note: `${pages.length}쪽`, bytes: await out.save() }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
