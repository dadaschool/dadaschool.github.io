/* 🔗 붙이기 — 여러 PDF 를 순서대로 하나로 합친다. */

import { $, $$, html, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage, canvasToBlob } from './lib/render.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument } = PDFLib;

export function makeMergeTab(panel) {
  let items = [];   // {buf, name, size, total, thumb}

  panel.innerHTML = `
    <div class="intro">
      <h2>🔗 붙이기</h2>
      <p>PDF 를 여러 개 넣고 <b>순서를 바꾼 뒤</b> 하나로 합칩니다. 끌어 옮기거나 ▲▼ 를 누르세요.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li><b>표지 + 본문 + 붙임 서류</b>를 한 파일로 묶어 결재 올릴 때</li>
        <li><b>여러 번 나눠 스캔한</b> 문서를 순서대로 이어 붙일 때</li>
        <li>학년별 가정통신문 3개를 <b>한 파일로</b> 모아 홈페이지에 올릴 때</li>
        <li>순서가 헷갈리면 목록에서 <b>끌어 옮기거나 ▲▼</b> 를 누르세요. 왼쪽 작은 그림이 1쪽입니다.</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="merge-wrap hidden">
      <div class="merge-list"></div>
      <div class="merge-foot">
        <span class="total-info muted"></span>
        <span class="spacer"></span>
        <button type="button" class="btn sub clear">모두 지우기</button>
        <button type="button" class="btn run">합치기</button>
      </div>
      <div class="result"></div>
    </div>`;

  const wrap = $('.merge-wrap', panel), list = $('.merge-list', panel),
        elResult = $('.result', panel);

  makeDrop($('.dz-mount', panel), {
    multiple: true,
    title: 'PDF 를 여러 개 끌어다 놓으세요',
    onFiles: add
  });

  $('.clear', panel).addEventListener('click', () => { items = []; paint(); });
  $('.run', panel).addEventListener('click', merge);

  /* ---------------- 파일 더하기 ---------------- */
  async function add(files) {
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
    if (!pdfs.length) { alert('PDF 파일만 넣을 수 있습니다.'); return; }

    overlay.show('파일을 읽는 중…');
    try {
      for (let i = 0; i < pdfs.length; i++) {
        const f = pdfs[i];
        overlay.step(i, pdfs.length, esc(f.name));
        try {
          const buf = await f.arrayBuffer();
          const doc = await openDoc(buf);
          const total = doc.numPages;                  // ⚠ destroy() 뒤에는 못 읽는다. 먼저 챙긴다
          const { canvas } = await drawPage(doc, 1, { width: 54 });
          const blob = await canvasToBlob(canvas, 'image/png');
          canvas.width = canvas.height = 0;
          doc.destroy();
          items.push({ buf, name: f.name, size: f.size, total, thumb: URL.createObjectURL(blob) });
        } catch (e) {
          console.error(e);
          alert(`${f.name} : ${readErr(e)}`);
        }
        await breathe();
      }
      paint();
    } finally { overlay.hide(); }
  }

  /* ---------------- 목록 그리기 ---------------- */
  function paint() {
    wrap.classList.toggle('hidden', items.length === 0);
    list.innerHTML = '';

    items.forEach((it, i) => {
      const row = html(`
        <div class="m-row" draggable="true" data-i="${i}">
          <span class="grip" title="끌어서 옮기기">⠿</span>
          <span class="m-no">${i + 1}</span>
          <span class="m-thumb"><img src="${it.thumb}" alt=""></span>
          <span class="m-name" title="${esc(it.name)}">${esc(it.name)}</span>
          <span class="badge">${it.total}쪽</span>
          <span class="badge soft">${fmtSize(it.size)}</span>
          <span class="m-act">
            <button type="button" class="btn icon" data-up  title="위로">▲</button>
            <button type="button" class="btn icon" data-down title="아래로">▼</button>
            <button type="button" class="btn icon" data-del title="빼기">✕</button>
          </span>
        </div>`);

      $('[data-up]', row).addEventListener('click', () => move(i, i - 1));
      $('[data-down]', row).addEventListener('click', () => move(i, i + 1));
      $('[data-del]', row).addEventListener('click', () => { URL.revokeObjectURL(items[i].thumb); items.splice(i, 1); paint(); });

      // 끌어서 순서 바꾸기
      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', String(i));
        row.classList.add('dragging');
      });
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

    const pages = items.reduce((s, x) => s + x.total, 0);
    const bytes = items.reduce((s, x) => s + x.size, 0);
    $('.total-info', panel).textContent = `파일 ${items.length}개 · 모두 ${pages}쪽 · ${fmtSize(bytes)}`;
    $('.run', panel).disabled = items.length < 2;
    $('.run', panel).textContent = items.length < 2 ? '합치려면 2개 이상 필요' : `${items.length}개 합치기`;
    elResult.innerHTML = '';
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const [x] = items.splice(from, 1);
    items.splice(to, 0, x);
    paint();
  }

  /* ---------------- 합치기 ---------------- */
  async function merge() {
    if (items.length < 2) return;
    overlay.show('합치는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        overlay.step(i, items.length, esc(items[i].name));
        const doc = await PDFDocument.load(items[i].buf.slice(0));
        const copied = await out.copyPages(doc, doc.getPageIndices());
        copied.forEach(p => out.addPage(p));
        await breathe();
      }
      const name = `${baseName(items[0].name)}_외${items.length - 1}개_합침.pdf`;
      try { out.setTitle(baseName(name)); } catch {}
      showResult(elResult, [{ name, note: `${out.getPageCount()}쪽`, bytes: await out.save() }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset() { items.forEach(i => URL.revokeObjectURL(i.thumb)); items = []; paint(); } };
}
