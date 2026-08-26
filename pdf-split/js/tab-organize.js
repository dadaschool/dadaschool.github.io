/* 🔃 페이지 구성 — 쪽을 끌어 옮겨 순서를 바꾸고, 돌리고, 뺀다.
   iLovePDF 의 「PDF 구성 · PDF 회전 · 페이지 제거」 세 가지를 한 화면으로 합친 것이다.
   ⚠ 여기서 쪽을 «다시 그리지» 않는다. pdf-lib 이 원본 쪽을 그대로 복사하므로 글자가 그대로 남는다. */

import { $, $$, html, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, makeThumbLoader } from './lib/render.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument, degrees } = PDFLib;

export function makeOrganizeTab(panel) {
  let src = null;                 // {buf, name, size, total, doc}
  let items = [];                 // [{page: 원본 쪽번호, rot: 0|90|180|270}] — 순서가 곧 결과 순서
  let thumbs = null;

  panel.innerHTML = `
    <div class="intro">
      <h2>🔃 페이지 구성</h2>
      <p>쪽을 <b>끌어 옮겨</b> 순서를 바꾸고, <b>돌리고</b>, <b>뺍니다</b>. 글자는 그대로 남습니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li><b>거꾸로 스캔된 쪽</b>만 골라 180° 돌릴 때</li>
        <li>자동급지로 스캔해 <b>순서가 섞인</b> 것을 바로잡을 때</li>
        <li>양면 스캔에서 딸려 온 <b>빈 뒷면</b>을 뺄 때</li>
        <li><b>✂️ 자르기와 다른 점</b> : 여기서는 순서·회전·삭제를 <b>한 번에</b> 하고, 글자는 그대로 남습니다.</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="org-tools">
        <button type="button" class="btn sub small" data-act="rot-all">전체 90° 돌리기</button>
        <button type="button" class="btn sub small" data-act="reverse">순서 뒤집기</button>
        <button type="button" class="btn sub small" data-act="restore">처음으로 되돌리기</button>
        <span class="spacer"></span>
        <span class="org-info muted"></span>
        <button type="button" class="btn run">새 PDF 만들기</button>
      </div>
      <div class="thumb-col"><div class="thumbs org"></div></div>
      <div class="result"></div>
    </div>`;

  const work = $('.work', panel), elThumbs = $('.thumbs', panel), elResult = $('.result', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });
  $$('[data-act]', panel).forEach(b => b.addEventListener('click', () => tool(b.dataset.act)));
  $('.run', panel).addEventListener('click', run);

  async function load(file) {
    reset();
    if (!/\.pdf$/i.test(file.name)) { alert('PDF 파일만 넣을 수 있습니다.'); return; }
    overlay.show('PDF 를 읽는 중…');
    try {
      const buf = await file.arrayBuffer();
      const doc = await openDoc(buf);
      src = { buf, name: file.name, size: file.size, total: doc.numPages, doc };
      items = Array.from({ length: doc.numPages }, (_, i) => ({ page: i + 1, rot: 0 }));
      work.classList.remove('hidden');
      $('.filebar', panel).innerHTML = `
        <span class="f-name" title="${esc(src.name)}">📄 ${esc(src.name)}</span>
        <span class="badge">${src.total}쪽</span>
        <span class="badge soft">${fmtSize(src.size)}</span>
        <button type="button" class="btn sub small change">다른 파일</button>`;
      $('.change', panel).addEventListener('click', reset);
      paint();
    } catch (e) {
      console.error(e); alert(readErr(e)); reset();
    } finally { overlay.hide(); }
  }

  function reset() {
    thumbs?.stop(); thumbs = null;
    src?.doc?.destroy?.();
    src = null; items = [];
    work.classList.add('hidden');
    elThumbs.innerHTML = ''; elResult.innerHTML = '';
  }

  function tool(act) {
    if (!src) return;
    if (act === 'rot-all') items.forEach(it => it.rot = (it.rot + 90) % 360);
    if (act === 'reverse') items.reverse();
    if (act === 'restore') items = Array.from({ length: src.total }, (_, i) => ({ page: i + 1, rot: 0 }));
    paint();
  }

  /* ---------------- 그리기 ---------------- */
  function paint() {
    thumbs?.stop();
    // 🔴 회전은 «그릴 때» 반영한다. CSS transform 으로 돌리면 내용만 돌고 칸은 세로 그대로라
    //    가로가 된 쪽이 잘려 보인다(사용자 신고). data-turn 을 읽어 그 각도로 그린다.
    thumbs = makeThumbLoader(src.doc, { width: 168, turnOf: el => Number(el.dataset.turn) || 0 });
    elThumbs.innerHTML = '';

    items.forEach((it, i) => {
      const card = html(`
        <div class="thumb org" draggable="true" data-i="${i}">
          <div class="thumb-box" data-page="${it.page}" data-turn="${it.rot}"><div class="skel"></div></div>
          <div class="thumb-no">원본 ${it.page}쪽${it.rot ? ` · ${it.rot}°` : ''}</div>
          <div class="org-btns">
            <button type="button" class="btn icon" data-left  title="왼쪽으로 돌리기">↺</button>
            <button type="button" class="btn icon" data-right title="오른쪽으로 돌리기">↻</button>
            <button type="button" class="btn icon" data-del   title="이 쪽 빼기">✕</button>
          </div>
        </div>`);

      const bx = $('.thumb-box', card);

      $('[data-left]', card).addEventListener('click', e => { e.stopPropagation(); it.rot = (it.rot + 270) % 360; paint(); });
      $('[data-right]', card).addEventListener('click', e => { e.stopPropagation(); it.rot = (it.rot + 90) % 360; paint(); });
      $('[data-del]', card).addEventListener('click', e => { e.stopPropagation(); items.splice(i, 1); paint(); });

      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('over'); });
      card.addEventListener('dragleave', () => card.classList.remove('over'));
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('over');
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isNaN(from) || from === i) return;
        const [x] = items.splice(from, 1);
        items.splice(i, 0, x);
        paint();
      });

      elThumbs.appendChild(card);
      thumbs.watch(bx);
    });

    const rotated = items.filter(it => it.rot).length;
    const removed = src.total - items.length;
    $('.org-info', panel).textContent =
      `${items.length}쪽` + (removed ? ` · ${removed}쪽 뺌` : '') + (rotated ? ` · ${rotated}쪽 돌림` : '');
    $('.run', panel).disabled = items.length === 0;
    elResult.innerHTML = '';
  }

  /* ---------------- 만들기 ---------------- */
  async function run() {
    if (!src || !items.length) return;
    overlay.show('새 PDF 를 만드는 중…');
    elResult.innerHTML = '';
    try {
      const srcDoc = await PDFDocument.load(src.buf.slice(0));
      const out = await PDFDocument.create();
      const copied = await out.copyPages(srcDoc, items.map(it => it.page - 1));
      copied.forEach((pg, i) => {
        const add = items[i].rot;
        if (add) pg.setRotation(degrees((pg.getRotation().angle + add) % 360));  // 원래 회전에 «더한다»
        out.addPage(pg);
        overlay.step(i + 1, copied.length, `${i + 1} / ${copied.length}쪽`);
      });
      try { out.setTitle(baseName(src.name)); } catch {}
      await breathe();
      showResult(elResult, [{ name: `${baseName(src.name)}_정리.pdf`, note: `${items.length}쪽`, bytes: await out.save() }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
