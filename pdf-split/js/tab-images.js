/* 🖼 사진 → PDF — JPG·PNG 여러 장을 순서대로 PDF 한 개로 만든다.
   칠판·유인물을 휴대폰으로 찍어 모을 때 쓴다. pdf-lib 만으로 되고 pdf.js 가 필요 없다. */

import { $, html, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument } = PDFLib;

// 용지 크기(pt) — 1인치 = 72pt
const PAPERS = {
  fit:  { label: '사진 크기 그대로', w: 0, h: 0 },
  a4:   { label: 'A4 세로',  w: 595.28, h: 841.89 },
  a4l:  { label: 'A4 가로',  w: 841.89, h: 595.28 },
  letter: { label: '레터',   w: 612, h: 792 }
};

export function makeImagesTab(panel) {
  let items = [];               // {file, url, w, h, type}
  let paper = 'a4', margin = 20;

  panel.innerHTML = `
    <div class="intro">
      <h2>🖼 사진 → PDF</h2>
      <p>JPG·PNG 여러 장을 <b>순서대로</b> PDF 한 개로 만듭니다. 끌어 옮겨 순서를 바꾸세요.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li><b>칠판을 찍은 사진 5장</b> → 수업 정리 PDF 한 개로</li>
        <li>종이 유인물을 휴대폰으로 찍어 <b>A4에 맞춰</b> 배부할 때</li>
        <li>출장 영수증·증빙 사진을 <b>한 파일로 묶어</b> 제출할 때</li>
        <li>사진이 잘리는 게 싫으면 <b>여백</b>을 키우세요. 비율은 늘 그대로 지킵니다.</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="img-opts">
        <span class="field-label">용지</span>
        <select class="sel paper">
          ${Object.entries(PAPERS).map(([k, v]) => `<option value="${k}"${k === 'a4' ? ' selected' : ''}>${v.label}</option>`).join('')}
        </select>
        <span class="field-label">여백</span>
        <input type="number" class="num mg" min="0" max="80" value="20"> pt
        <span class="spacer"></span>
        <span class="img-info muted"></span>
        <button type="button" class="btn sub small clear">모두 지우기</button>
        <button type="button" class="btn run">PDF 만들기</button>
      </div>
      <div class="thumb-col"><div class="img-list"></div></div>
      <div class="result"></div>
    </div>`;

  const work = $('.work', panel), list = $('.img-list', panel), elResult = $('.result', panel);

  makeDrop($('.dz-mount', panel), {
    multiple: true, title: '사진(JPG·PNG)을 여러 장 끌어다 놓으세요', onFiles: add
  });
  // 그림도 고를 수 있게 파일 종류를 바꿔 준다(공용 부품은 PDF 만 받게 되어 있다)
  $('.dz-mount input[type=file]', panel).setAttribute('accept', 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp');

  $('.paper', panel).addEventListener('change', e => { paper = e.target.value; info(); });
  $('.mg', panel).addEventListener('input', e => { margin = Math.max(0, Math.min(80, Number(e.target.value) || 0)); });
  $('.clear', panel).addEventListener('click', () => { items.forEach(i => URL.revokeObjectURL(i.url)); items = []; paint(); });
  $('.run', panel).addEventListener('click', run);

  /* ---------------- 사진 더하기 ---------------- */
  async function add(files) {
    const imgs = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!imgs.length) { alert('JPG·PNG 그림만 넣을 수 있습니다.'); return; }

    overlay.show('사진을 읽는 중…');
    try {
      for (let i = 0; i < imgs.length; i++) {
        const f = imgs[i];
        overlay.step(i, imgs.length, esc(f.name));
        const url = URL.createObjectURL(f);
        const size = await new Promise(res => {
          const im = new Image();
          im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => res(null);
          im.src = url;
        });
        if (!size) { URL.revokeObjectURL(url); alert(`${f.name} : 그림을 읽지 못했습니다.`); continue; }
        items.push({ file: f, url, ...size });
        await breathe();
      }
      paint();
    } finally { overlay.hide(); }
  }

  function paint() {
    work.classList.toggle('hidden', items.length === 0);
    list.innerHTML = '';
    items.forEach((it, i) => {
      const row = html(`
        <div class="m-row" draggable="true">
          <span class="grip" title="끌어서 옮기기">⠿</span>
          <span class="m-no">${i + 1}</span>
          <span class="m-thumb"><img src="${it.url}" alt=""></span>
          <span class="m-name" title="${esc(it.file.name)}">${esc(it.file.name)}</span>
          <span class="badge">${it.w}×${it.h}</span>
          <span class="badge soft">${fmtSize(it.file.size)}</span>
          <span class="m-act">
            <button type="button" class="btn icon" data-up title="위로">▲</button>
            <button type="button" class="btn icon" data-down title="아래로">▼</button>
            <button type="button" class="btn icon" data-del title="빼기">✕</button>
          </span>
        </div>`);
      $('[data-up]', row).addEventListener('click', () => move(i, i - 1));
      $('[data-down]', row).addEventListener('click', () => move(i, i + 1));
      $('[data-del]', row).addEventListener('click', () => { URL.revokeObjectURL(items[i].url); items.splice(i, 1); paint(); });
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('over');
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isNaN(from)) move(from, i);
      });
      list.appendChild(row);
    });
    info();
    elResult.innerHTML = '';
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const [x] = items.splice(from, 1);
    items.splice(to, 0, x);
    paint();
  }

  function info() {
    $('.img-info', panel).textContent = `사진 ${items.length}장 · ${PAPERS[paper].label}`;
    $('.run', panel).disabled = items.length === 0;
  }

  /* ---------------- 만들기 ---------------- */
  async function run() {
    if (!items.length) return;
    overlay.show('PDF 를 만드는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        // webp 는 pdf-lib 이 모른다 → 캔버스로 PNG 로 바꿔 넣는다
        const img = /\.png$/i.test(it.file.name) ? await out.embedPng(bytes)
                  : /\.(jpe?g)$/i.test(it.file.name) ? await out.embedJpg(bytes)
                  : await out.embedPng(await toPng(it));

        let pw, ph;
        if (paper === 'fit') { pw = img.width; ph = img.height; }
        else { pw = PAPERS[paper].w; ph = PAPERS[paper].h; }

        const page = out.addPage([pw, ph]);
        if (paper === 'fit') {
          page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
        } else {
          // 여백 안에 «비율을 지켜» 넣고 가운데 맞춘다
          const bw = pw - margin * 2, bh = ph - margin * 2;
          const k = Math.min(bw / img.width, bh / img.height);
          const w = img.width * k, h = img.height * k;
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
        overlay.step(i + 1, items.length, `${i + 1} / ${items.length}장`);
        await breathe();
      }
      const name = `${baseName(items[0].file.name)}_외${items.length - 1}장.pdf`;
      showResult(elResult, [{
        name: items.length === 1 ? `${baseName(items[0].file.name)}.pdf` : name,
        note: `${items.length}쪽`, bytes: await out.save()
      }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  /** webp 등 pdf-lib 이 모르는 그림을 PNG 바이트로 바꾼다 */
  async function toPng(it) {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = it.url; });
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    c.width = c.height = 0;
    return new Uint8Array(await blob.arrayBuffer());
  }

  return { reset() { items.forEach(i => URL.revokeObjectURL(i.url)); items = []; paint(); } };
}
