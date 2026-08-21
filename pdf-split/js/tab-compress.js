/* 🗜️ 용량 줄이기 — 두 가지 방법이 있고 성격이 아주 다르다.
   ① 이미지 재압축 : 쪽을 그림으로 다시 그려 넣는다. 스캔·사진 문서에서 효과가 크지만
      **글자가 그림이 되어 검색·복사가 안 된다.**
   ② 구조 최적화 : 문서 구조만 다시 정리한다. 글자가 그대로 남지만 줄어드는 양은 적다.
   ⚠ 줄지 않는 PDF 도 많다(이미 최적화된 파일). 그럴 때는 «원본을 쓰라» 고 솔직히 말한다. */

import { $, $$, esc, fmtSize, overlay, note, readErr, breathe, makeDrop, makeUrl } from './lib/ui.js';
import { openDoc, drawPage, pageToImage } from './lib/render.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument } = PDFLib;

// 압축 세기 미리 정해 둔 값
const PRESETS = {
  strong: { label: '강하게', dpi: 96,  quality: 0.55, desc: '용량 최소 · 화질 보통' },
  normal: { label: '권장',   dpi: 120, quality: 0.70, desc: '균형 (기본값)' },
  high:   { label: '고화질', dpi: 150, quality: 0.82, desc: '화질 우선 · 덜 줄어듦' }
};

export function makeCompressTab(panel) {
  let src = null;             // {buf, name, size, total, doc}
  let method = 'image';
  let dpi = 120, quality = 0.70;

  panel.innerHTML = `
    <div class="intro">
      <h2>🗜️ 용량 줄이기</h2>
      <p><b>이미지 재압축</b>은 스캔·사진 문서에 효과가 크고, <b>구조 최적화</b>는 글자(검색)를 그대로 지킵니다.</p>
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
            <div class="field-label">방법</div>
            <div class="segmented">
              <button type="button" class="seg on" data-method="image">이미지 재압축 (강력)</button>
              <button type="button" class="seg" data-method="lossless">구조 최적화 (글자 유지)</button>
            </div>
          </div>

          <div class="m-image">
            <div class="field">
              <div class="field-label">세기</div>
              <div class="preset-row">
                ${Object.entries(PRESETS).map(([k, v]) => `
                  <button type="button" class="preset${k === 'normal' ? ' on' : ''}" data-preset="${k}">
                    <b>${v.label}</b><span class="muted small">${v.desc}</span></button>`).join('')}
              </div>
            </div>
            <details class="adv">
              <summary>세부 설정</summary>
              <div class="field">
                <div class="field-label">JPEG 화질 : <b class="q-val">70</b>%</div>
                <input type="range" class="q-range" min="30" max="95" step="5" value="70">
              </div>
              <div class="field">
                <div class="field-label">해상도(DPI) : <b class="dpi-val">120</b></div>
                <input type="range" class="dpi-range" min="72" max="200" step="12" value="120">
                <div class="muted small">72 ≈ 화면 · 150 ≈ 인쇄. 높을수록 선명하지만 용량이 커집니다.</div>
              </div>
            </details>
            <p class="warn small">⚠️ 이미지 재압축을 하면 글자가 그림으로 바뀌어 <b>검색·복사가 안 됩니다.</b></p>
          </div>

          <div class="m-lossless hidden">
            <p class="muted small">문서 구조만 다시 정리합니다. 글자·도형이 그대로 남아 검색이 되지만,
              이미 정리된 PDF 라면 거의 줄지 않습니다.</p>
          </div>

          <button type="button" class="btn big run">용량 줄이기 실행</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel), elRun = $('.run', panel);

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
    method = b.dataset.method;
    $('.m-image', panel).classList.toggle('hidden', method !== 'image');
    $('.m-lossless', panel).classList.toggle('hidden', method !== 'lossless');
  }));

  $$('.preset', panel).forEach(b => b.addEventListener('click', () => {
    $$('.preset', panel).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const p = PRESETS[b.dataset.preset];
    dpi = p.dpi; quality = p.quality;
    $('.q-range', panel).value = Math.round(quality * 100);
    $('.dpi-range', panel).value = dpi;
    $('.q-val', panel).textContent = Math.round(quality * 100);
    $('.dpi-val', panel).textContent = dpi;
  }));

  $('.q-range', panel).addEventListener('input', e => {
    quality = Number(e.target.value) / 100;
    $('.q-val', panel).textContent = e.target.value;
    $$('.preset', panel).forEach(x => x.classList.remove('on'));
  });
  $('.dpi-range', panel).addEventListener('input', e => {
    dpi = Number(e.target.value);
    $('.dpi-val', panel).textContent = e.target.value;
    $$('.preset', panel).forEach(x => x.classList.remove('on'));
  });

  /* ---------------- 실행 ---------------- */
  elRun.addEventListener('click', run);

  async function run() {
    if (!src) return;
    elResult.innerHTML = '';
    elRun.disabled = true;
    overlay.show(method === 'image' ? '쪽을 다시 그리는 중…' : '문서 구조를 정리하는 중…');
    try {
      const bytes = method === 'image' ? await byImage() : await byLossless();
      paintResult(bytes);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); elRun.disabled = false; }
  }

  /** ① 쪽을 JPEG 로 다시 그려 새 PDF 에 담는다 */
  async function byImage() {
    const out = await PDFDocument.create();
    for (let n = 1; n <= src.total; n++) {
      const { bytes, ptWidth, ptHeight } = await pageToImage(src.doc, n, { dpi, type: 'image/jpeg', quality });
      const img = await out.embedJpg(bytes);
      const page = out.addPage([ptWidth, ptHeight]);
      page.drawImage(img, { x: 0, y: 0, width: ptWidth, height: ptHeight });
      overlay.step(n, src.total, `${n} / ${src.total}쪽`);
      await breathe();
    }
    try { out.setTitle(baseName(src.name)); } catch {}
    return out.save();
  }

  /** ② 구조만 다시 정리한다 */
  async function byLossless() {
    const doc = await PDFDocument.load(src.buf.slice(0), { updateMetadata: false });
    overlay.step(1, 2, '다시 저장하는 중');
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    overlay.step(2, 2, '완료');
    return bytes;
  }

  function paintResult(bytes) {
    const before = src.size, after = bytes.length;
    const rate = (before - after) / before;
    const same = Math.abs(rate) < 0.005;      // 0.5% 미만이면 «그대로» 라고 말한다
    const good = after < before && !same;
    const name = `${baseName(src.name)}_용량줄임.pdf`;
    const url = makeUrl(bytes);

    elResult.innerHTML = `
      <div class="res-head">${good ? '✅ 완료' : same ? 'ℹ️ 거의 그대로입니다' : '⚠️ 오히려 커졌습니다'}</div>
      <div class="res-sizes">
        <span>원본 <b>${fmtSize(before)}</b></span><span class="arrow">→</span>
        <span>결과 <b>${fmtSize(after)}</b></span>
        <span class="save ${good ? 'good' : 'bad'}">${
          same ? '차이 거의 없음' : good ? (rate * 100).toFixed(1) + '% 줄었습니다' : (Math.abs(rate) * 100).toFixed(1) + '% 늘었습니다'}</span>
      </div>
      ${good ? '' : '<p class="muted small">이 PDF 는 이미 정리되어 있거나 글자 위주라 더 줄지 않습니다. <b>원본을 그대로 쓰는 것이 낫습니다.</b></p>'}
      <div class="res-foot">
        <a class="btn" download="${esc(name)}" href="${url}">결과 내려받기</a>
      </div>`;
  }

  return { reset };
}
