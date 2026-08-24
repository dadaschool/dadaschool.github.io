/* 📝 글자 뽑기 — PDF 안의 글자를 TXT·마크다운으로 뽑는다.
   공문에서 문장을 골라 한글(HWP)·메일에 붙일 때 쓴다.
   ⚠ «그림으로 스캔한 PDF» 에는 글자가 아예 없다 — 그럴 때는 아무것도 안 나온다.
     그 사실을 결과에 분명히 알려 준다(빈 화면만 보여 주면 고장인 줄 안다). */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc } from './lib/render.js';
import { parseRanges, baseName } from './lib/ranges.js';

export function makeTextTab(panel) {
  let src = null, out = '';
  let form = 'txt', keepBreaks = true;

  panel.innerHTML = `
    <div class="intro">
      <h2>📝 글자 뽑기</h2>
      <p>PDF 안의 글자를 <b>TXT</b>·<b>마크다운</b>으로 뽑습니다. 스캔한 그림 PDF 에는 글자가 없습니다.</p>
    </div>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col wide-right">
        <div class="opt-col">
          <div class="field">
            <div class="field-label">모양</div>
            <div class="segmented">
              <button type="button" class="seg on" data-form="txt">그냥 글자 (TXT)</button>
              <button type="button" class="seg" data-form="md">마크다운 (쪽 구분)</button>
            </div>
          </div>
          <div class="field">
            <div class="field-label">뽑을 쪽</div>
            <label class="radio"><input type="radio" name="tx" value="all" checked> 전체 <span class="all-n muted"></span></label>
            <label class="radio"><input type="radio" name="tx" value="some"> 골라서</label>
            <input type="text" class="ranges" placeholder="예) 1-5, 8" autocomplete="off" spellcheck="false" disabled>
          </div>
          <label class="radio"><input type="checkbox" class="brk" checked> 줄바꿈 살리기 (끄면 문단으로 이어 붙임)</label>
          <button type="button" class="btn big run">글자 뽑기</button>
          <div class="result"></div>
        </div>
        <div class="prev-col">
          <div class="field-label">뽑은 글자</div>
          <textarea class="txt-out" readonly placeholder="여기에 나옵니다"></textarea>
          <div class="tools">
            <button type="button" class="btn sub small copy" disabled>📋 모두 복사</button>
            <span class="txt-info muted small"></span>
          </div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel),
        elRanges = $('.ranges', panel), area = $('.txt-out', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });
  $$('[data-form]', panel).forEach(b => b.addEventListener('click', () => {
    $$('[data-form]', panel).forEach(x => x.classList.remove('on')); b.classList.add('on'); form = b.dataset.form;
  }));
  $$('input[name="tx"]', panel).forEach(r => r.addEventListener('change', () => {
    elRanges.disabled = $('input[name="tx"]:checked', panel).value === 'all';
    if (!elRanges.disabled) elRanges.focus();
  }));
  $('.brk', panel).addEventListener('change', e => keepBreaks = e.target.checked);
  $('.run', panel).addEventListener('click', run);
  $('.copy', panel).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(out); $('.txt-info', panel).textContent = '복사했습니다'; }
    catch { area.select(); document.execCommand('copy'); $('.txt-info', panel).textContent = '복사했습니다'; }
  });

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
    } catch (e) { console.error(e); alert(readErr(e)); reset(); }
    finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.(); src = null; out = '';
    work.classList.add('hidden');
    area.value = ''; elResult.innerHTML = '';
    $('.copy', panel).disabled = true; $('.txt-info', panel).textContent = '';
  }

  /* ---------------- 실행 ---------------- */
  async function run() {
    if (!src) return;
    const pick = $('input[name="tx"]:checked', panel).value;
    let pages;
    if (pick === 'all') pages = Array.from({ length: src.total }, (_, i) => i + 1);
    else {
      const p = parseRanges(elRanges.value, src.total);
      if (!p.ok) { note(elResult, p.errors[0] || '뽑을 쪽을 적어 주세요.'); return; }
      pages = p.pages;
    }

    overlay.show('글자를 뽑는 중…');
    elResult.innerHTML = '';
    try {
      const chunks = [];
      let letters = 0;
      for (let i = 0; i < pages.length; i++) {
        const n = pages[i];
        const page = await src.doc.getPage(n);
        const tc = await page.getTextContent();
        const body = joinItems(tc.items);
        page.cleanup();
        letters += body.replace(/\s/g, '').length;
        chunks.push(form === 'md' ? `## ${n}쪽\n\n${body}` : body);
        overlay.step(i + 1, pages.length, `${i + 1} / ${pages.length}쪽`);
        if (i % 5 === 4) await breathe();
      }
      out = chunks.join(form === 'md' ? '\n\n' : '\n\n');
      area.value = out;
      $('.copy', panel).disabled = !out;
      $('.txt-info', panel).textContent = `${letters.toLocaleString()}자`;

      if (letters === 0) {
        note(elResult, '글자가 하나도 없습니다. 이 PDF 는 «그림으로 스캔한 것» 이라 글자 정보가 들어 있지 않습니다.');
        return;
      }
      const ext = form === 'md' ? 'md' : 'txt';
      showResult(elResult, [{
        name: `${baseName(src.name)}.${ext}`, type: 'text/plain;charset=utf-8',
        note: `${letters.toLocaleString()}자`,
        bytes: new TextEncoder().encode('﻿' + out)   // BOM — 메모장·엑셀이 한글을 바로 알아본다
      }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  /** pdf.js 가 준 글자 조각을 사람이 읽는 줄로 잇는다 */
  function joinItems(items) {
    let s = '';
    for (const it of items) {
      if (it.str) s += it.str;
      if (it.hasEOL) s += '\n';
    }
    s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!keepBreaks) {
      // 문단(빈 줄)은 살리고, 한 문단 안의 줄바꿈만 없앤다
      s = s.split(/\n\s*\n/).map(par => par.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim()).join('\n\n');
    }
    return s;
  }

  return { reset };
}
