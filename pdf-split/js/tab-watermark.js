/* 💧 워터마크 — 모든 쪽에 글자나 그림을 비스듬히 얹는다.
   ⚠ 워터마크는 «위에 얹는 것» 이라 지우려면 지울 수 있다. 정말 못 보게 하려면 ⬛ 검열을 쓸 것.
     그 사실을 화면에 적어 두었다 — 안 적으면 «가렸으니 안전하다» 고 오해한다. */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage } from './lib/render.js';
import { baseName } from './lib/ranges.js';
import { embedKorean, needsKorean } from './lib/fonts.js';

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

export function makeWatermarkTab(panel) {
  let src = null, mark = null;          // mark = {bytes, type, w, h, url} 그림 워터마크
  let mode = 'text';
  let word = '교사용', size = 48, opacity = 0.18, angle = 45, tile = false;
  let color = { r: 0.15, g: 0.28, b: 0.6 };

  panel.innerHTML = `
    <div class="intro">
      <h2>💧 워터마크</h2>
      <p>모든 쪽에 글자나 그림을 얹습니다. <b>한글도 됩니다.</b></p>
    </div>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col">
        <div class="prev-col">
          <div class="prev-frame"><div class="skel"></div></div>
          <div class="muted center small">미리보기 (1쪽)</div>
        </div>
        <div class="opt-col">
          <div class="field">
            <div class="field-label">무엇을</div>
            <div class="segmented">
              <button type="button" class="seg on" data-mode="text">글자</button>
              <button type="button" class="seg" data-mode="image">그림(도장·로고)</button>
            </div>
          </div>

          <div class="m-text">
            <div class="field">
              <div class="field-label">글자</div>
              <input type="text" class="ranges wm-word" value="교사용" maxlength="40">
            </div>
            <div class="field row2">
              <label>크기 <input type="number" class="num" id="w-size" min="10" max="150" value="48"></label>
              <label>색 <input type="color" class="col" id="w-color" value="#264799"></label>
            </div>
          </div>

          <div class="m-image hidden">
            <div class="field">
              <div class="field-label">그림 고르기</div>
              <input type="file" class="wm-file" accept="image/png,image/jpeg,.png,.jpg,.jpeg">
              <div class="muted small">배경이 비치는 <b>PNG</b> 가 예쁩니다.</div>
            </div>
            <div class="field">
              <label>너비(쪽 대비 %) <input type="number" class="num" id="w-iw" min="5" max="100" value="40"></label>
            </div>
          </div>

          <div class="field">
            <div class="field-label">진하기 : <b class="op-val">18</b>%</div>
            <input type="range" class="op-range" min="5" max="100" step="1" value="18">
          </div>
          <div class="field">
            <div class="field-label">기울기 : <b class="an-val">45</b>°</div>
            <input type="range" class="an-range" min="0" max="90" step="5" value="45">
          </div>
          <label class="radio"><input type="checkbox" class="tile"> 바둑판처럼 여러 번 깔기</label>

          <p class="warn small">⚠️ 워터마크는 <b>위에 얹는 것</b>이라 지울 수 있습니다.
             정말 안 보이게 지우려면 <b>⬛ 검열</b>을 쓰세요.</p>
          <button type="button" class="btn big run">워터마크 넣기</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel);
  let iw = 40;

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });

  $$('[data-mode]', panel).forEach(b => b.addEventListener('click', () => {
    $$('[data-mode]', panel).forEach(x => x.classList.remove('on')); b.classList.add('on');
    mode = b.dataset.mode;
    $('.m-text', panel).classList.toggle('hidden', mode !== 'text');
    $('.m-image', panel).classList.toggle('hidden', mode !== 'image');
    preview();
  }));
  $('.wm-word', panel).addEventListener('input', e => { word = e.target.value; preview(); });
  $('#w-size', panel).addEventListener('input', e => { size = num(e.target.value, 10, 150, 48); preview(); });
  $('#w-color', panel).addEventListener('input', e => { color = hex(e.target.value); preview(); });
  $('#w-iw', panel).addEventListener('input', e => { iw = num(e.target.value, 5, 100, 40); preview(); });
  $('.op-range', panel).addEventListener('input', e => { opacity = Number(e.target.value) / 100; $('.op-val', panel).textContent = e.target.value; preview(); });
  $('.an-range', panel).addEventListener('input', e => { angle = Number(e.target.value); $('.an-val', panel).textContent = e.target.value; preview(); });
  $('.tile', panel).addEventListener('change', e => { tile = e.target.checked; preview(); });
  $('.wm-file', panel).addEventListener('change', async e => {
    const f = e.target.files?.[0]; if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const url = URL.createObjectURL(f);
    const sz = await new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });
    if (!sz) { alert('그림을 읽지 못했습니다.'); URL.revokeObjectURL(url); return; }
    mark = { bytes, png: /\.png$/i.test(f.name), url, ...sz };
    preview();
  });
  $('.run', panel).addEventListener('click', run);

  const num = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number(v) || d));
  const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });

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
      preview();
    } catch (e) { console.error(e); alert(readErr(e)); reset(); }
    finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.(); src = null;
    if (mark?.url) URL.revokeObjectURL(mark.url);
    mark = null;
    work.classList.add('hidden'); elResult.innerHTML = '';
    $('.prev-frame', panel).innerHTML = '<div class="skel"></div>';
  }

  /** 캔버스 위에 워터마크를 흉내 내어 보여 준다(결과와 같은 자리·같은 진하기) */
  async function preview() {
    if (!src) return;
    try {
      const { canvas, ptWidth } = await drawPage(src.doc, 1, { width: 300 });
      const k = canvas.width / ptWidth;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalAlpha = opacity;
      const spots = tile ? tileSpots(canvas.width, canvas.height) : [{ x: canvas.width / 2, y: canvas.height / 2 }];

      for (const s of spots) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-angle * Math.PI / 180);
        if (mode === 'text') {
          ctx.font = `bold ${size * k}px "맑은 고딕", sans-serif`;
          ctx.fillStyle = `rgb(${color.r * 255},${color.g * 255},${color.b * 255})`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(word || ' ', 0, 0);
        } else if (mark) {
          const w = canvas.width * (iw / 100), h = w * mark.h / mark.w;
          const im = await imgOf(mark.url);
          ctx.drawImage(im, -w / 2, -h / 2, w, h);
        }
        ctx.restore();
      }
      ctx.restore();
      const frame = $('.prev-frame', panel);
      frame.innerHTML = ''; canvas.classList.add('prev-img'); frame.appendChild(canvas);
    } catch (e) { console.error(e); }
  }

  const imgCache = new Map();
  function imgOf(url) {
    if (imgCache.has(url)) return imgCache.get(url);
    const p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    imgCache.set(url, p);
    return p;
  }

  const tileSpots = (w, h) => {
    const out = [];
    for (let gy = 1; gy <= 3; gy++) for (let gx = 1; gx <= 3; gx++) out.push({ x: w * gx / 4, y: h * gy / 4 });
    return out;
  };

  /* ---------------- 실행 ---------------- */
  async function run() {
    if (!src) return;
    if (mode === 'image' && !mark) { note(elResult, '워터마크로 쓸 그림을 먼저 고르세요.'); return; }
    overlay.show('워터마크를 넣는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.load(src.buf.slice(0));
      let font = null, img = null;
      if (mode === 'text') {
        font = needsKorean(word) ? await embedKorean(out, m => overlay.show(m))
                                 : await out.embedFont(StandardFonts.HelveticaBold);
      } else {
        img = mark.png ? await out.embedPng(mark.bytes) : await out.embedJpg(mark.bytes);
      }
      overlay.show('워터마크를 넣는 중…');

      const pages = out.getPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const spots = tile
          ? [1, 2, 3].flatMap(gy => [1, 2, 3].map(gx => ({ x: width * gx / 4, y: height * gy / 4 })))
          : [{ x: width / 2, y: height / 2 }];

        for (const s of spots) {
          if (mode === 'text') {
            const tw = font.widthOfTextAtSize(word || ' ', size);
            const rad = angle * Math.PI / 180;
            // 글자의 «가운데»가 s 에 오도록 시작점을 뒤로 물린다(기울기까지 셈에 넣는다)
            page.drawText(word || ' ', {
              x: s.x - Math.cos(rad) * tw / 2 + Math.sin(rad) * size * 0.35,
              y: s.y - Math.sin(rad) * tw / 2 - Math.cos(rad) * size * 0.35,
              size, font, color: rgb(color.r, color.g, color.b),
              opacity, rotate: degrees(angle)
            });
          } else {
            const w = width * (iw / 100), h = w * img.height / img.width;
            const rad = angle * Math.PI / 180;
            page.drawImage(img, {
              x: s.x - Math.cos(rad) * w / 2 + Math.sin(rad) * h / 2,
              y: s.y - Math.sin(rad) * w / 2 - Math.cos(rad) * h / 2,
              width: w, height: h, opacity, rotate: degrees(angle)
            });
          }
        }
        overlay.step(i + 1, pages.length, `${i + 1} / ${pages.length}쪽`);
        if (i % 10 === 9) await breathe();
      }
      showResult(elResult, [{ name: `${baseName(src.name)}_워터마크.pdf`, note: `${pages.length}쪽`, bytes: await out.save() }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
