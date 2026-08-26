/* pdf.js 로 PDF 쪽을 그림으로 그리는 부분 — 썸네일·미리보기·용량 줄이기·변환이 모두 이것을 쓴다.
   ⚠ pdf.js 4.x 는 ES 모듈이라 file:// (더블클릭)에서 브라우저가 막는다.
     그래서 이 앱은 서버(또는 웹 주소)로 열어야 한다. 자세한 이유는 CLAUDE.md. */

import * as pdfjsLib from '../vendor/pdf.min.mjs';

// 일꾼(worker)과 글꼴 자료의 자리. import.meta.url 을 기준으로 잡아 두면
// 앱을 다른 폴더에 옮겨도 주소가 어긋나지 않는다.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const CMAP  = new URL('../vendor/cmaps/', import.meta.url).href;          // ⚠ 한글 PDF 에 사실상 필수
const FONTS = new URL('../vendor/standard_fonts/', import.meta.url).href;

/** pdf.js 문서 열기.
    ⚠ pdf.js 는 넘겨받은 버퍼를 가져가 버린다(detach). 반드시 복사본을 준다 —
      그러지 않으면 같은 파일을 pdf-lib 이 다시 읽을 때 빈 버퍼가 된다. */
export function openDoc(buf, { password } = {}) {
  return pdfjsLib.getDocument({
    data: buf.slice(0),
    worker: sharedWorker(),
    password,                       // 암호가 걸린 PDF 를 열 때만 쓴다(🔓 암호 풀기 탭)
    cMapUrl: CMAP, cMapPacked: true,
    standardFontDataUrl: FONTS,
    isEvalSupported: false          // 필요 없는 기능은 끈다(안전)
  }).promise;
}

/** 암호 때문에 못 연 것인지 가려낸다. (틀린 암호인지 / 암호가 필요한지) */
export function passwordProblem(err) {
  const name = String(err?.name || '');
  const code = err?.code;                       // 1 = 암호 필요, 2 = 암호 틀림
  if (name !== 'PasswordException') return null;
  return code === 2 ? 'wrong' : 'need';
}

/* 🔴 일꾼(worker)을 «하나만» 만들어 돌려 쓴다.
   그러지 않으면 문서마다 1.4MB 짜리 일꾼이 새로 뜨고 곧 사라진다 —
   붙이기 탭에서 파일 10개를 넣으면 그것만으로 10초가 넘게 걸렸다.
   doc.destroy() 는 문서만 닫고 이 일꾼은 살려 둔다. */
let _worker = null;
function sharedWorker() {
  if (!_worker || _worker.destroyed) _worker = new pdfjsLib.PDFWorker({ name: 'pdf-tool' });
  return _worker;
}

/** 쪽 하나를 캔버스에 그린다.
    width 를 주면 그 너비에 맞추고, dpi 를 주면 그 해상도로 그린다.
    turn 을 주면 원본 회전에 그만큼 **더해서** 그린다(90·180·270 · 🔃 페이지 구성의 미리보기). */
export async function drawPage(doc, pageNo, { width, dpi, turn = 0 } = {}) {
  const page = await doc.getPage(pageNo);

  /* ⚠ rotation 을 «그냥» 넘기지 말 것. 넘긴 값이 원본 쪽의 회전(/Rotate)을 **대신**하므로
       0 을 넘기면 눕혀 스캔한 문서가 옆으로 누운 채 나온다.
     ⚠ 돌려서 보여 줄 때도 CSS transform 으로 돌리면 안 된다 — 그건 «내용만» 돌리고
       칸 모양은 그대로라 가로가 된 쪽이 세로 칸에 잘린다(실제로 그랬다).
       여기서 «돌린 크기 그대로» 그려야 미리보기와 결과가 같아진다. */
  const extra = ((turn % 360) + 360) % 360;
  const spin = extra ? { rotation: (page.rotate + extra) % 360 } : {};

  const base = page.getViewport({ scale: 1, ...spin });
  const scale = width ? width / base.width : (dpi || 96) / 72;
  const viewport = page.getViewport({ scale, ...spin });

  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';                                     // 투명 대신 흰 종이 (JPG 로 저장할 때 검게 되는 것 방지)
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await renderKeepGoing(page, { canvasContext: ctx, viewport });
  page.cleanup();
  return { canvas, ptWidth: base.width, ptHeight: base.height };
}

/* 🔴 pdf.js 는 한 쪽을 여러 토막으로 나눠 그리고 다음 토막을 requestAnimationFrame 으로 예약한다.
   그런데 브라우저는 «보이지 않는 탭» 에서 rAF 를 아예 멈춘다 —
   그러면 변환·썸네일이 «영원히 끝나지 않는다»(오류도 안 난다).
   교사가 100쪽을 변환하는 동안 다른 탭을 보는 일은 흔하므로,
   그리는 동안만 rAF 를 setTimeout 으로 바꿔 둔다. 겹쳐 부를 수 있어 «몇 겹인지» 센다. */
let rafDepth = 0, realRaf = null;
async function renderKeepGoing(page, params) {
  if (rafDepth++ === 0) {
    realRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  }
  try {
    await page.render(params).promise;
  } finally {
    if (--rafDepth === 0) { window.requestAnimationFrame = realRaf; realRaf = null; }
  }
}

/** 캔버스를 그림 파일로 */
export function canvasToBlob(canvas, type = 'image/png', quality = 0.85) {
  return new Promise(res => canvas.toBlob(res, type, quality));
}

/** 쪽 하나를 그림 파일로 (변환·용량 줄이기에서 쓴다) */
export async function pageToImage(doc, pageNo, { dpi = 150, type = 'image/png', quality = 0.85 } = {}) {
  const { canvas, ptWidth, ptHeight } = await drawPage(doc, pageNo, { dpi });
  const blob = await canvasToBlob(canvas, type, quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pxWidth = canvas.width, pxHeight = canvas.height;
  canvas.width = canvas.height = 0;        // 큰 캔버스를 바로 놓아 준다(메모리)
  return { bytes, blob, ptWidth, ptHeight, pxWidth, pxHeight, type };
}

/* ------------------------------------------------------------------
   썸네일 — 쪽이 많은 교과서에서도 빠르도록 «보이는 것만» 그린다
------------------------------------------------------------------ */
export function makeThumbLoader(doc, { width = 132, turnOf = null } = {}) {
  const queue = [];
  let running = false;

  async function pump() {
    if (running) return;
    running = true;
    while (queue.length) {
      const job = queue.shift();
      if (job.canceled || !job.el.isConnected) continue;
      try {
        // turnOf 를 주면 그 쪽을 돌린 채로 그린다(🔃 페이지 구성)
        const { canvas } = await drawPage(doc, job.pageNo, { width, turn: turnOf ? turnOf(job.el) : 0 });
        if (job.canceled || !job.el.isConnected) { canvas.width = canvas.height = 0; continue; }
        job.el.innerHTML = '';
        canvas.classList.add('thumb-img');
        job.el.appendChild(canvas);
      } catch (e) {
        job.el.innerHTML = '<span class="thumb-fail">?</span>';
      }
    }
    running = false;
  }

  let heard = false;                       // 감시자가 한 번이라도 알려 주었나
  const watching = [];

  const io = new IntersectionObserver(entries => {
    heard = true;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const box = e.target;
      io.unobserve(box);
      queue.push({ el: box, pageNo: Number(box.dataset.page) });
    }
    pump();
  }, { rootMargin: '300px' });

  /* ⚠ 대비책 : IntersectionObserver 는 «화면을 그리는 중» 일 때만 알려 준다.
     탭이 뒤에 있거나 창이 숨어 있으면 아무 소식이 없어 썸네일 자리가 영원히 빈칸으로 남는다.
     0.6초 안에 소식이 없으면 앞쪽 한 화면 분량은 그냥 그린다(빈 화면보다 낫다). */
  setTimeout(() => {
    if (heard || !watching.length) return;
    watching.slice(0, 24).forEach(box => { io.unobserve(box); queue.push({ el: box, pageNo: Number(box.dataset.page) }); });
    pump();
  }, 600);

  return {
    watch(box) { watching.push(box); io.observe(box); },
    stop() { io.disconnect(); queue.forEach(j => j.canceled = true); queue.length = 0; watching.length = 0; }
  };
}
