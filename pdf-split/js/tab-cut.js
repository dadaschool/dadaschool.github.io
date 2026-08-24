/* ✂️ 자르기 — 쪽을 골라 한 파일로 모으거나, 범위별로 나눈다.
   ⚠ 이 탭의 «단일 진실 원천» 은 쪽 번호 입력칸이다.
     썸네일을 누르면 입력칸을 다시 쓰고, 입력칸을 고치면 썸네일 표시를 다시 그린다.
     양쪽에 따로 상태를 두면 반드시 어긋난다(그래서 한 곳으로 모았다). */

import { $, $$, html, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { parseRanges, pagesToText, rangesToCuts, cutsToRanges, everyN, rangesToText, baseName } from './lib/ranges.js';
import { openDoc, makeThumbLoader } from './lib/render.js';

const { PDFDocument } = PDFLib;

export function makeCutTab(panel) {
  let src = null;     // {buf, name, size, total, doc(pdf.js)}
  let mode = 'pick';  // pick = 골라 한 파일 · split = 범위별로 나누기
  let thumbs = null;

  panel.innerHTML = `
    <div class="intro">
      <h2>✂️ 자르기</h2>
      <p>쪽을 <b>골라 한 파일로</b> 모으거나, <b>범위별로 나눠</b> 여러 파일로 저장합니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li><b>교과서에서 3단원만</b> 뽑아 나눠 줄 때 → 「골라 한 파일로」 · <code>58-72</code></li>
        <li><b>표지를 빼고</b> 줄 때 → <code>2-</code> (2쪽부터 끝까지)</li>
        <li><b>학습지 묶음을 차시별로</b> 나눌 때 → 「범위별로 나누기」 · <code>1-4, 5-8, 9-12</code></li>
        <li><b>양면 스캔에서 뒷면만</b> 필요할 때 → 「짝수 쪽」 단추</li>
        <li>어디를 자를지 헷갈리면 <b>왼쪽 썸네일을 눌러</b> 고르세요. 쪽 번호가 저절로 적힙니다.</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="cut-grid">
        <div class="thumb-col"><div class="thumbs"></div></div>
        <div class="opt-col">
          <div class="field">
            <div class="field-label">방법</div>
            <div class="segmented">
              <button type="button" class="seg on" data-mode="pick">골라 한 파일로</button>
              <button type="button" class="seg" data-mode="split">범위별로 나누기</button>
            </div>
          </div>
          <div class="field">
            <div class="field-label">쪽 번호 <span class="muted">(썸네일을 눌러도 됩니다)</span></div>
            <input type="text" class="ranges" placeholder="예) 1-3, 7, 20-25" autocomplete="off" spellcheck="false">
            <ul class="help">
              <li><code>5</code> 5쪽</li><li><code>5-12</code> 5~12쪽</li>
              <li><code>20-</code> 끝까지</li><li><code>-3</code> 처음부터</li>
            </ul>
          </div>
          <div class="field tools"></div>
          <div class="preview"></div>
          <button type="button" class="btn big run" disabled>PDF 만들기</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elRanges = $('.ranges', panel),
        elPreview = $('.preview', panel), elRun = $('.run', panel),
        elResult = $('.result', panel), elThumbs = $('.thumbs', panel),
        elTools = $('.tools', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });

  /* ---------------- 파일 읽기 ---------------- */
  async function load(file) {
    reset();
    if (!/\.pdf$/i.test(file.name)) { alert('PDF 파일만 넣을 수 있습니다.'); return; }

    overlay.show('PDF 를 읽는 중…');
    try {
      const buf = await file.arrayBuffer();
      const doc = await openDoc(buf);                       // pdf.js (썸네일용)
      src = { buf, name: file.name, size: file.size, total: doc.numPages, doc };
      work.classList.remove('hidden');
      paintFileBar();
      paintThumbs();
      paintTools();
      elRanges.value = '';
      elRanges.focus();
      update();
    } catch (e) {
      console.error(e);
      alert(readErr(e));
      reset();
    } finally { overlay.hide(); }
  }

  function reset() {
    thumbs?.stop(); thumbs = null;
    src?.doc?.destroy?.();
    src = null; mode = 'pick';
    work.classList.add('hidden');
    elThumbs.innerHTML = ''; elResult.innerHTML = ''; elPreview.innerHTML = '';
    elRanges.value = ''; elRun.disabled = true;
    $$('.seg', panel).forEach(b => b.classList.toggle('on', b.dataset.mode === 'pick'));
  }

  function paintFileBar() {
    $('.filebar', panel).innerHTML = `
      <span class="f-name" title="${esc(src.name)}">📄 ${esc(src.name)}</span>
      <span class="badge">${src.total}쪽</span>
      <span class="badge soft">${fmtSize(src.size)}</span>
      <button type="button" class="btn sub small change">다른 파일</button>`;
    $('.change', panel).addEventListener('click', reset);
  }

  /* ---------------- 썸네일 ---------------- */
  function paintThumbs() {
    elThumbs.innerHTML = '';
    // 칸은 남는 자리를 나눠 가져 «적어 둔 최소 너비보다 넓어진다»(css 의 1fr).
    // 그리는 크기를 최소 너비로 잡으면 CSS 가 늘려서 흐려지므로 넉넉하게 그린다.
    const small = window.innerHeight <= 700 && window.innerWidth > 1000;
    thumbs = makeThumbLoader(src.doc, { width: small ? 132 : 168 });
    for (let n = 1; n <= src.total; n++) {
      const card = html(`
        <div class="thumb" data-page="${n}">
          <div class="thumb-box" data-page="${n}"><div class="skel"></div></div>
          <div class="thumb-no">${n}</div>
        </div>`);
      card.addEventListener('click', () => clickPage(n));
      elThumbs.appendChild(card);
      thumbs.watch($('.thumb-box', card));
    }
  }

  /** 썸네일을 눌렀을 때 — 방법에 따라 뜻이 다르다 */
  function clickPage(n) {
    const p = parseRanges(elRanges.value, src.total);
    if (mode === 'pick') {
      const set = new Set(p.pages);
      set.has(n) ? set.delete(n) : set.add(n);
      elRanges.value = pagesToText([...set]);
    } else {
      const cuts = rangesToCuts(p.ok ? p.ranges : []);
      if (n === 1) return;                       // 1쪽 앞에서는 자를 수 없다
      cuts.has(n) ? cuts.delete(n) : cuts.add(n);
      elRanges.value = rangesToText(cutsToRanges(cuts, src.total));
    }
    update();
  }

  /* ---------------- 방법·도우미 단추 ---------------- */
  $$('.seg', panel).forEach(btn => btn.addEventListener('click', () => {
    $$('.seg', panel).forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    mode = btn.dataset.mode;
    paintTools();
    update();
  }));

  function paintTools() {
    if (mode === 'pick') {
      elTools.innerHTML = `
        <button type="button" class="btn sub small" data-act="all">전체 선택</button>
        <button type="button" class="btn sub small" data-act="none">선택 해제</button>
        <button type="button" class="btn sub small" data-act="invert">선택 반전</button>
        <button type="button" class="btn sub small" data-act="odd">홀수 쪽</button>
        <button type="button" class="btn sub small" data-act="even">짝수 쪽</button>`;
    } else {
      elTools.innerHTML = `
        <button type="button" class="btn sub small" data-act="single">모든 쪽 분리</button>
        <button type="button" class="btn sub small" data-act="clear">분할선 지우기</button>
        <span class="every">
          <input type="number" class="num" min="1" max="${src?.total || 999}" value="2"> 쪽마다
          <button type="button" class="btn sub small" data-act="every">적용</button>
        </span>`;
    }
    $$('[data-act]', elTools).forEach(b => b.addEventListener('click', () => doTool(b.dataset.act)));
  }

  function doTool(act) {
    const total = src.total;
    const all = Array.from({ length: total }, (_, i) => i + 1);
    const now = new Set(parseRanges(elRanges.value, total).pages);

    if (act === 'all')    elRanges.value = pagesToText(all);
    if (act === 'none')   elRanges.value = '';
    if (act === 'invert') elRanges.value = pagesToText(all.filter(n => !now.has(n)));
    if (act === 'odd')    elRanges.value = pagesToText(all.filter(n => n % 2 === 1));
    if (act === 'even')   elRanges.value = pagesToText(all.filter(n => n % 2 === 0));
    if (act === 'single') elRanges.value = rangesToText(everyN(1, total));
    if (act === 'clear')  elRanges.value = rangesToText(cutsToRanges(new Set(), total));
    if (act === 'every') {
      const n = Math.max(1, Math.min(total, Number($('.num', elTools).value) || 2));
      elRanges.value = rangesToText(everyN(n, total));
    }
    update();
  }

  /* ---------------- 미리 확인 ---------------- */
  elRanges.addEventListener('input', update);
  elRanges.addEventListener('keydown', e => { if (e.key === 'Enter' && !elRun.disabled) run(); });

  function update() {
    if (!src) return;
    const p = parseRanges(elRanges.value, src.total);
    elRun.disabled = !p.ok;
    paintMarks(p);

    if (!elRanges.value.trim()) { elPreview.innerHTML = '<span class="muted">쪽 번호를 적거나 썸네일을 누르세요.</span>'; return; }
    if (p.errors.length) { elPreview.innerHTML = `<span class="bad">✗ ${p.errors.map(esc).join('<br>✗ ')}</span>`; return; }

    if (mode === 'pick') {
      elPreview.innerHTML = `<span class="good">✓ ${p.pages.length}쪽을 뽑아 파일 1개로 만듭니다.</span>`
        + `<br><span class="muted">${esc(pagesToText(p.pages))}</span>`;
    } else {
      elPreview.innerHTML = `<span class="good">✓ 파일 ${p.ranges.length}개로 나눕니다.</span><ul>`
        + p.ranges.map(r => `<li>${r.text}쪽 <small>(${r.to - r.from + 1}쪽)</small></li>`).join('') + '</ul>';
    }
  }

  /** 썸네일에 «고른 쪽»(pick) 또는 «묶음 번호»(split) 를 표시한다 */
  function paintMarks(p) {
    const picked = new Set(p.pages);
    const groupOf = new Map();
    if (mode === 'split') p.ranges.forEach((r, i) => { for (let n = r.from; n <= r.to; n++) groupOf.set(n, i + 1); });
    const cuts = mode === 'split' ? rangesToCuts(p.ranges) : new Set();   // 고리 안에서 다시 계산하지 않게

    $$('.thumb', elThumbs).forEach(card => {
      const n = Number(card.dataset.page);
      card.classList.toggle('on', mode === 'pick' && picked.has(n));
      card.classList.toggle('cut', cuts.has(n));
      const tag = groupOf.get(n);
      let badge = $('.thumb-tag', card);
      if (mode === 'split' && tag) {
        if (!badge) { badge = html('<div class="thumb-tag"></div>'); card.appendChild(badge); }
        badge.textContent = `묶음 ${tag}`;
      } else badge?.remove();
    });
  }

  /* ---------------- 만들기 ---------------- */
  elRun.addEventListener('click', run);

  async function run() {
    const p = parseRanges(elRanges.value, src.total);
    if (!p.ok) return;
    const b = baseName(src.name);

    const jobs = mode === 'pick'
      ? [{ pages: p.pages, name: p.ranges.length === 1 ? `${b}_${p.ranges[0].text}.pdf` : `${b}_선택${p.pages.length}쪽.pdf`,
           note: `${p.ranges.map(r => r.text).join(', ')}쪽` }]
      : p.ranges.map(r => {
          const pages = []; for (let n = r.from; n <= r.to; n++) pages.push(n);
          return { pages, name: `${b}_${r.text}.pdf`, note: `${r.text}쪽` };
        });

    overlay.show('PDF 를 만드는 중…');
    elResult.innerHTML = '';
    try {
      const srcDoc = await PDFDocument.load(src.buf.slice(0));
      const out = [];
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const doc = await PDFDocument.create();
        const copied = await doc.copyPages(srcDoc, job.pages.map(n => n - 1));
        copied.forEach(pg => doc.addPage(pg));
        try { doc.setTitle(b); } catch {}
        out.push({ name: job.name, note: job.note, bytes: await doc.save() });
        overlay.step(i + 1, jobs.length, `${i + 1} / ${jobs.length} 개`);
        await breathe();
      }
      showResult(elResult, out, { zipName: `${b}_나눔.zip` });
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
