/* 🔄 변환 — 쪽을 PNG·JPG 그림이나 PPT 슬라이드로 바꾼다.
   ⚠ PPT 는 «그림을 붙인 슬라이드» 다. 글자를 고칠 수 있는 PPT 가 아니다(그건 다른 문제다).
     화면과 문서에 그 사실을 분명히 적어 둔다. */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage, pageToImage } from './lib/render.js';
import { parseRanges, baseName } from './lib/ranges.js';

export function makeConvertTab(panel) {
  let src = null;        // {buf, name, size, total, doc}
  let fmt = 'png';
  let dpi = 150, quality = 0.85;

  panel.innerHTML = `
    <div class="intro">
      <h2>🔄 변환</h2>
      <p>쪽마다 <b>PNG</b>·<b>JPG</b> 그림 또는 <b>PPT 슬라이드</b>로 바꿉니다.</p>
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
            <div class="field-label">형식</div>
            <div class="segmented">
              <button type="button" class="seg on" data-fmt="png">PNG 그림</button>
              <button type="button" class="seg" data-fmt="jpg">JPG 그림</button>
              <button type="button" class="seg" data-fmt="pptx">PPT 슬라이드</button>
            </div>
          </div>

          <div class="field">
            <div class="field-label">바꿀 쪽</div>
            <label class="radio"><input type="radio" name="cv" value="all" checked> 전체 <span class="all-n muted"></span></label>
            <label class="radio"><input type="radio" name="cv" value="some"> 골라서</label>
            <input type="text" class="ranges" placeholder="예) 1-5, 8, 10-12" autocomplete="off" spellcheck="false" disabled>
          </div>

          <div class="field">
            <div class="field-label">해상도(DPI) : <b class="dpi-val">150</b></div>
            <input type="range" class="dpi-range" min="72" max="300" step="6" value="150">
            <div class="muted small">높을수록 선명하지만 파일이 커집니다.</div>
          </div>

          <div class="field q-field hidden">
            <div class="field-label">JPG 화질 : <b class="q-val">85</b>%</div>
            <input type="range" class="q-range" min="40" max="95" step="5" value="85">
          </div>

          <p class="fmt-note muted small"></p>
          <button type="button" class="btn big run">변환 실행</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel),
        elRanges = $('.ranges', panel), elRun = $('.run', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });

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
      $('.all-n', panel).textContent = `(${src.total}쪽)`;
      elRanges.placeholder = `예) 1-5, 8, 10-${Math.min(12, src.total)}`;
      paintNote();
      drawPreview();
    } catch (e) {
      console.error(e); alert(readErr(e)); reset();
    } finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.();
    src = null;
    work.classList.add('hidden');
    elResult.innerHTML = '';
    $('.prev-frame', panel).innerHTML = '<div class="skel"></div>';
  }

  async function drawPreview() {
    try {
      const { canvas } = await drawPage(src.doc, 1, { width: 300 });
      const frame = $('.prev-frame', panel);
      frame.innerHTML = ''; canvas.classList.add('prev-img'); frame.appendChild(canvas);
    } catch (e) { console.error(e); }
  }

  /* ---------------- 설정 ---------------- */
  $$('.seg', panel).forEach(b => b.addEventListener('click', () => {
    $$('.seg', panel).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    fmt = b.dataset.fmt;
    $('.q-field', panel).classList.toggle('hidden', fmt === 'png');
    paintNote();
  }));

  $$('input[name="cv"]', panel).forEach(r => r.addEventListener('change', () => {
    elRanges.disabled = $('input[name="cv"]:checked', panel).value === 'all';
    if (!elRanges.disabled) elRanges.focus();
  }));

  $('.dpi-range', panel).addEventListener('input', e => {
    dpi = Number(e.target.value); $('.dpi-val', panel).textContent = e.target.value; paintNote();
  });
  $('.q-range', panel).addEventListener('input', e => {
    quality = Number(e.target.value) / 100; $('.q-val', panel).textContent = e.target.value;
  });

  function paintNote() {
    const n = { png: 'PNG 는 글자·선이 깔끔합니다. 파일이 JPG 보다 큽니다.',
                jpg: 'JPG 는 사진·스캔에 알맞고 파일이 작습니다.',
                pptx: '⚠️ PPT 는 쪽을 <b>그림으로 붙인</b> 슬라이드입니다. 슬라이드 안의 글자를 고칠 수는 없습니다.' }[fmt];
    $('.fmt-note', panel).innerHTML = `${n} 지금 해상도 ${dpi} DPI.`;
  }

  /* ---------------- 실행 ---------------- */
  elRun.addEventListener('click', run);

  function targetPages() {
    if ($('input[name="cv"]:checked', panel).value === 'all')
      return { pages: Array.from({ length: src.total }, (_, i) => i + 1), errors: [] };
    const p = parseRanges(elRanges.value, src.total);
    if (!p.ok) return { pages: [], errors: p.errors.length ? p.errors : ['바꿀 쪽을 적어 주세요.'] };
    return { pages: p.pages, errors: [] };
  }

  async function run() {
    if (!src) return;
    const { pages, errors } = targetPages();
    if (errors.length) { note(elResult, errors.join(' ')); return; }

    elResult.innerHTML = ''; elRun.disabled = true;
    overlay.show(fmt === 'pptx' ? 'PPT 를 만드는 중…' : '그림으로 바꾸는 중…');
    try {
      if (fmt === 'pptx') await toPptx(pages);
      else await toImages(pages);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); elRun.disabled = false; }
  }

  /** PNG·JPG — 쪽마다 파일 하나 */
  async function toImages(pages) {
    const b = baseName(src.name);
    const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const ext  = fmt === 'png' ? 'png' : 'jpg';
    const pad  = String(src.total).length;
    const out = [];

    for (let i = 0; i < pages.length; i++) {
      const n = pages[i];
      const { bytes, pxWidth, pxHeight } = await pageToImage(src.doc, n, { dpi, type, quality });
      out.push({ name: `${b}_p${String(n).padStart(pad, '0')}.${ext}`, type,
                 note: `${n}쪽 · ${pxWidth}×${pxHeight}px`, bytes });
      overlay.step(i + 1, pages.length, `${i + 1} / ${pages.length}쪽`);
      await breathe();
    }
    showResult(elResult, out, { zipName: `${b}_${ext}.zip` });
  }

  /** PPT — 쪽을 슬라이드 크기에 꽉 채운다 */
  async function toPptx(pages) {
    const first = await drawPage(src.doc, pages[0], { dpi: 72 });
    const wIn = first.ptWidth / 72, hIn = first.ptHeight / 72;   // 1인치 = 72pt
    first.canvas.width = first.canvas.height = 0;

    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'PDF', width: wIn, height: hIn });
    pptx.layout = 'PDF';
    pptx.title = baseName(src.name);

    // ⚠ PPT 는 «슬라이드 크기가 문서 전체에 하나» 다. 쪽 크기가 섞인 PDF(가로쪽이 낀 교과서 등)를
    //   슬라이드에 꽉 채우면 찌그러진다. 그래서 비율을 지켜 «맞춰 넣고» 남는 자리는 비워 둔다.
    const 크기들 = new Set();
    for (let i = 0; i < pages.length; i++) {
      const n = pages[i];
      // PPT 안에서는 JPEG 로 넣는다(슬라이드가 100장이 되어도 파일이 감당할 만하게)
      const { bytes, ptWidth, ptHeight } = await pageToImage(src.doc, n, { dpi, type: 'image/jpeg', quality: 0.82 });
      크기들.add(Math.round(ptWidth) + '×' + Math.round(ptHeight));

      const pw = ptWidth / 72, ph = ptHeight / 72;
      const k = Math.min(wIn / pw, hIn / ph);          // 넘치지 않게 줄이는 비율
      const w = pw * k, h = ph * k;
      const slide = pptx.addSlide();
      slide.addImage({ data: 'image/jpeg;base64,' + toBase64(bytes),
                       x: (wIn - w) / 2, y: (hIn - h) / 2, w, h });
      overlay.step(i + 1, pages.length, `${i + 1} / ${pages.length}쪽`);
      await breathe();
    }

    overlay.show('PPT 파일로 묶는 중…');
    const blob = await pptx.write({ outputType: 'blob' });
    const name = `${baseName(src.name)}.pptx`;
    elResult.innerHTML = '';
    const 섞임 = 크기들.size > 1 ? ` · 쪽 크기가 ${크기들.size}가지라 첫 쪽 크기에 맞춰 넣었습니다` : '';
    showResult(elResult, [{ name, note: `슬라이드 ${pages.length}장${섞임}`, bytes: blob,
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }]);
  }

  return { reset };
}

/** 바이트를 base64 로 (한 번에 넘기면 큰 파일에서 스택이 넘친다 → 나눠서 붙인다) */
function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
