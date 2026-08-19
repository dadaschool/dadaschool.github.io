/* =========================================================
   viewer.js — PDF 를 보여 주고 그 위에 손글씨를 받는다  (ES 모듈)
   ---------------------------------------------------------
   왜 pdf.js 와 pdf-lib 을 둘 다 쓰는가
     · pdf.js  (Mozilla) : PDF 를 **화면에 그린다**. pdf-lib 은 이걸 못 한다.
     · pdf-lib           : 화면에 그린 것을 **PDF 로 저장한다**. pdf.js 는 이걸 못 한다.
     둘 다 폴더 안(js/vendor/)에 넣어 CDN 없이 돌아간다.

   ⚠ 이 파일만 ES 모듈이다(다른 앱들은 클래식 스크립트를 쓴다).
     pdf.js 4.x 가 ESM 으로만 배포되기 때문이다. 그래서 **이 앱은 `file://`
     더블클릭으로 열리지 않는다** — 서버로 열어야 한다(server.py 또는 GitHub Pages).
     어차피 학생에게 주소로 나눠 주는 앱이라 더블클릭이 필요 없다.
     자세한 사정은 CLAUDE.md 의 [규칙 예외] 참고.

   ⚠ 캔버스가 3장이다. 겹쳐 놓고 역할을 나눈다.
       pdfCanvas   원본 PDF (쪽을 넘기거나 확대할 때만 다시 그린다 — 느리다)
       inkCanvas   이미 그린 획
       liveCanvas  지금 그리는 중인 획 하나 (움직일 때마다 지우고 다시 그린다)
     한 장에 다 그리면, 획 하나 그릴 때마다 PDF 를 다시 그려야 해서 버벅인다.
   ========================================================= */

import * as pdfjsLib from "./vendor/pdf.min.mjs";

/* 일꾼(worker) 파일 위치를 알려 준다. 이걸 빠뜨리면 화면이 멈춘 것처럼 보인다. */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;

/* 확대 단계. 1.0 = 화면 폭에 맞춘 크기 */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/* 화면에 그릴 때 쓰는 최대 픽셀 배율.
   태블릿의 dpr 이 3 이면 A4 한 쪽이 3500px 이 넘어 느려진다. 2 로 묶는다. */
const MAX_DPR = 2;

/* 필압을 굵기로 바꾸는 범위(PDF 포인트). 필압이 없는 기기는 가운데 값을 쓴다. */
const PRESSURE = { min: 0.55, max: 1.45 };

export async function createViewer(opts) {
  const stage = opts.stage;             // 스크롤되는 바깥 상자
  const pageBox = opts.pageBox;         // 쪽 하나 크기의 상자 (캔버스 3장을 담는다)
  const pdfCanvas = opts.pdfCanvas;
  const inkCanvas = opts.inkCanvas;
  const liveCanvas = opts.liveCanvas;
  const store = opts.store;             // Ink.Store
  const onChange = opts.onChange || function () {};

  const pdfCtx = pdfCanvas.getContext("2d");
  const inkCtx = inkCanvas.getContext("2d");
  const liveCtx = liveCanvas.getContext("2d");

  let doc = null;
  let pageNo = 0;                       // 0부터
  let pageObj = null;
  let viewport = null;                  // 지금 화면의 viewport (좌표 변환의 기준)
  let dpr = 1;
  let zoomIdx = 2;                      // ZOOMS 의 위치 (1.0)
  let fitScale = 1;                     // 화면 폭에 맞추는 배율
  let renderTask = null;

  let tool = "pen";                     // pen | eraser | pan
  let color = "#111827";
  let widthBase = 1.5;                  // PDF 포인트
  let penSeen = false;                  // 펜이 한 번이라도 왔는지 (손바닥 무시용)

  /* 지금 그리는 중인 획 */
  let cur = null;
  const pointers = new Map();           // 눌려 있는 손가락·펜 목록
  let gesture = null;                   // 두 손가락 확대·이동 중인 상태

  /* ---------------------------------------------------------
     PDF 열기
     --------------------------------------------------------- */
  async function load(bytes) {
    /* pdf.js 가 바이트 배열을 가져가 버리므로(transfer) 복사해서 준다.
       원본은 제출할 때 pdf-lib 이 다시 써야 한다. */
    doc = await pdfjsLib.getDocument({
      data: bytes.slice(0),
      isEvalSupported: false,           /* 폰트 취약점(CVE-2024-4367) 대비 — 꺼 둔다 */
      disableAutoFetch: true,

      /* ⚠ 이 두 줄을 빠뜨리면 **render() 가 영원히 멈춘다.**
         화면이 하얗게 비어 있고 오류도 안 나서 원인을 찾기 어렵다(실제로 겪었다).
           standardFontDataUrl : Helvetica 같은 기본 14글꼴을 PDF 에 안 넣은 경우 필요
           cMapUrl / cMapPacked : **한글·한자 PDF** 에서 글자표를 찾는 데 필요
         둘 다 js/vendor/ 안에 넣어 두었다 — 인터넷 없이도 된다. */
      standardFontDataUrl: new URL("./vendor/standard_fonts/", import.meta.url).href,
      cMapUrl: new URL("./vendor/cmaps/", import.meta.url).href,
      cMapPacked: true
    }).promise;
    pageNo = 0;
    await showPage(0, true);
    return doc.numPages;
  }

  async function showPage(n, refit) {
    if (!doc) return;
    pageNo = Math.max(0, Math.min(doc.numPages - 1, n));
    pageObj = await doc.getPage(pageNo + 1);
    if (refit) computeFit();
    await render();
    onChange();
  }

  /* 화면 폭에 쪽을 맞추는 배율을 구한다 */
  function computeFit() {
    if (!pageObj) return;
    const base = pageObj.getViewport({ scale: 1 });
    const avail = Math.max(240, stage.clientWidth - 24);
    fitScale = avail / base.width;
  }

  async function render() {
    if (!pageObj) return;
    if (renderTask) { try { renderTask.cancel(); } catch (e) {} renderTask = null; }

    const scale = fitScale * ZOOMS[zoomIdx];
    viewport = pageObj.getViewport({ scale });      /* 페이지 자체 회전(/Rotate)도 포함된다 */
    dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

    const cssW = Math.round(viewport.width);
    const cssH = Math.round(viewport.height);
    const pxW = Math.round(viewport.width * dpr);
    const pxH = Math.round(viewport.height * dpr);

    [pdfCanvas, inkCanvas, liveCanvas].forEach((c) => {
      c.width = pxW; c.height = pxH;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
    });
    pageBox.style.width = cssW + "px";
    pageBox.style.height = cssH + "px";

    pdfCtx.save();
    pdfCtx.fillStyle = "#ffffff";                   /* 투명 PDF 가 회색으로 보이지 않게 */
    pdfCtx.fillRect(0, 0, pxW, pxH);
    pdfCtx.restore();

    renderTask = pageObj.render({
      canvasContext: pdfCtx,
      viewport: viewport,
      transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0]
    });
    try { await renderTask.promise; } catch (e) { /* 취소된 렌더 — 넘긴다 */ }
    renderTask = null;
    redraw();
  }

  /* 이미 그린 획을 전부 다시 그린다 (확대·쪽넘김·되돌리기 뒤) */
  function redraw() {
    if (!viewport) return;
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    window.Ink.drawOn(inkCtx, store.strokes, pageNo, viewport, dpr);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
  }

  /* ---------------------------------------------------------
     입력 — 펜 · 손가락 · 마우스

     ⚠ 손바닥 무시(palm rejection)
       태블릿에 손을 얹고 펜으로 쓰면 손바닥이 touch 로 들어와 줄이 그어진다.
       그래서 **펜이 한 번 감지되면 그 뒤로는 touch 로 그리지 않는다.**
       (손가락만 쓰는 크롬북에서는 펜이 없으니 그대로 그려진다)

     ⚠ 두 손가락은 확대·이동이다. 그리는 중이었다면 그 획을 취소한다 —
       확대하려고 두 번째 손가락을 얹었을 때 첫 손가락의 선이 남으면 안 된다.
     --------------------------------------------------------- */
  function canDrawWith(e) {
    if (tool === "pan") return false;
    if (e.pointerType === "touch" && penSeen) return false;   /* 손바닥 무시 */
    return true;
  }

  function localPoint(e) {
    const r = liveCanvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  /* 굵기 — 펜은 필압으로, 나머지는 가운데 값으로 */
  function widthOf(e) {
    let k = 1;
    if (e.pointerType === "pen" && typeof e.pressure === "number" && e.pressure > 0) {
      k = PRESSURE.min + (PRESSURE.max - PRESSURE.min) * Math.min(1, e.pressure);
    }
    return Math.round(widthBase * k * 100) / 100;
  }

  function onDown(e) {
    if (e.pointerType === "pen") penSeen = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    /* 손가락 두 개 → 확대·이동으로 넘어간다 */
    if (countTouch() >= 2) { cancelStroke(); startGesture(); return; }

    if (tool === "pan") return;                    /* 이동 도구는 브라우저 스크롤에 맡긴다 */
    if (!canDrawWith(e)) return;

    /* 손가락·펜이 캔버스 밖으로 나가도 계속 그려지게 붙잡는다.
       ⚠ try 로 감싼다 — 이미 사라진 포인터면 브라우저가 오류를 던지고,
         그러면 그 획이 통째로 사라진다(학생에게 가장 나쁜 결과다). */
    try { liveCanvas.setPointerCapture(e.pointerId); } catch (err) { /* 그냥 진행한다 */ }
    e.preventDefault();

    const [lx, ly] = localPoint(e);

    if (tool === "eraser") {
      eraseAt(lx, ly);
      cur = { erasing: true };
      return;
    }

    const p = viewport.convertToPdfPoint(lx, ly);
    cur = {
      id: e.pointerId,
      stroke: { p: pageNo, c: color, x: [round2(p[0])], y: [round2(p[1])], w: [widthOf(e)] }
    };
    drawLive();
  }

  function onMove(e) {
    if (pointers.has(e.pointerId)) {
      const rec = pointers.get(e.pointerId);
      rec.x = e.clientX; rec.y = e.clientY;
    }
    if (gesture) { moveGesture(); return; }
    if (!cur) return;
    if (cur.erasing) {
      const [ex, ey] = localPoint(e);
      eraseAt(ex, ey);
      return;
    }
    if (cur.id !== e.pointerId) return;
    e.preventDefault();

    /* 태블릿은 한 번에 여러 점을 모아 보낸다. 다 쓰면 선이 훨씬 매끄럽다. */
    const events = (e.getCoalescedEvents && e.getCoalescedEvents().length)
      ? e.getCoalescedEvents() : [e];

    for (const ev of events) {
      const [lx, ly] = localPoint(ev);
      const p = viewport.convertToPdfPoint(lx, ly);
      const s = cur.stroke;
      const n = s.x.length;
      /* 너무 촘촘한 점은 버린다(0.4pt 미만) — 용량만 늘고 모양은 같다 */
      if (n && Math.abs(p[0] - s.x[n - 1]) < 0.4 && Math.abs(p[1] - s.y[n - 1]) < 0.4) continue;
      s.x.push(round2(p[0]));
      s.y.push(round2(p[1]));
      s.w.push(widthOf(ev.pressure !== undefined ? ev : e));
    }
    drawLive();
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (gesture && countTouch() < 2) endGesture();
    if (!cur) return;
    if (cur.erasing) { cur = null; return; }
    if (cur.id !== e.pointerId) return;

    const s = cur.stroke;
    cur = null;
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    if (s.x.length) {
      store.add(s);
      window.Ink.drawOn(inkCtx, [s], pageNo, viewport, dpr);   /* 전체가 아니라 이 획만 */
      onChange();
    }
  }

  function cancelStroke() {
    cur = null;
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
  }

  function drawLive() {
    if (!cur || !cur.stroke) return;
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    window.Ink.drawOn(liveCtx, [cur.stroke], pageNo, viewport, dpr);
  }

  function eraseAt(lx, ly) {
    const p = viewport.convertToPdfPoint(lx, ly);
    /* 지우개 크기는 화면에서 늘 같아 보이게 — 확대하면 PDF 기준으로는 작아진다 */
    const radius = 9 / (viewport.scale || 1);
    if (store.eraseAt(pageNo, p[0], p[1], radius)) { redraw(); onChange(); }
  }

  function countTouch() {
    let n = 0;
    pointers.forEach((v) => { if (v.type === "touch") n++; });
    return n;
  }

  /* ---- 두 손가락 확대·이동 ---- */
  function twoTouches() {
    const arr = [];
    pointers.forEach((v) => { if (v.type === "touch") arr.push(v); });
    return arr.slice(0, 2);
  }

  function startGesture() {
    const t = twoTouches();
    if (t.length < 2) return;
    gesture = {
      dist: Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y),
      idx: zoomIdx
    };
  }

  function moveGesture() {
    const t = twoTouches();
    if (t.length < 2 || !gesture) return;
    const d = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
    if (!gesture.dist) return;
    const ratio = d / gesture.dist;
    /* 1.25배 벌리면 한 단계 확대, 0.8배로 좁히면 한 단계 축소 */
    if (ratio > 1.25) { gesture.dist = d; zoom(1); }
    else if (ratio < 0.8) { gesture.dist = d; zoom(-1); }
  }

  function endGesture() { gesture = null; }

  function round2(v) { return Math.round(v * 100) / 100; }

  /* ---------------------------------------------------------
     확대 · 축소
     --------------------------------------------------------- */
  function zoom(step) {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, zoomIdx + step));
    if (next === zoomIdx) return;
    /* 확대 전에 보고 있던 가운데를 기억해 두었다가 그 자리로 되돌린다 */
    const cx = (stage.scrollLeft + stage.clientWidth / 2) / Math.max(1, pageBox.offsetWidth);
    const cy = (stage.scrollTop + stage.clientHeight / 2) / Math.max(1, pageBox.offsetHeight);
    zoomIdx = next;
    render().then(() => {
      stage.scrollLeft = cx * pageBox.offsetWidth - stage.clientWidth / 2;
      stage.scrollTop = cy * pageBox.offsetHeight - stage.clientHeight / 2;
      onChange();
    });
  }

  function fit() {
    zoomIdx = 2;
    computeFit();
    render().then(onChange);
  }

  /* 창 크기가 바뀌면 맞춤 배율을 다시 잰다 (기기를 돌렸을 때) */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { computeFit(); render(); }, 200);
  });

  liveCanvas.addEventListener("pointerdown", onDown);
  liveCanvas.addEventListener("pointermove", onMove);
  liveCanvas.addEventListener("pointerup", onUp);
  liveCanvas.addEventListener("pointercancel", onUp);
  liveCanvas.addEventListener("pointerleave", (e) => { if (cur && cur.erasing) cur = null; });
  /* 손가락으로 그릴 때 화면이 함께 스크롤되지 않게 */
  liveCanvas.addEventListener("touchstart", (e) => {
    if (tool !== "pan" && e.touches.length < 2) e.preventDefault();
  }, { passive: false });

  return {
    load,
    redraw,
    get pageCount() { return doc ? doc.numPages : 0; },
    get page() { return pageNo; },
    get zoomPercent() { return Math.round(ZOOMS[zoomIdx] * 100); },
    get penDetected() { return penSeen; },
    gotoPage: (n) => showPage(n, false),
    next: () => showPage(pageNo + 1, false),
    prev: () => showPage(pageNo - 1, false),
    setTool: (t) => { tool = t; cancelStroke(); liveCanvas.style.touchAction = (t === "pan" ? "auto" : "none"); },
    setColor: (c) => { color = c; },
    setWidth: (w) => { widthBase = w; },
    zoomIn: () => zoom(1),
    zoomOut: () => zoom(-1),
    fit,
    undo: () => { if (store.undo()) { redraw(); onChange(); } },
    redo: () => { if (store.redo()) { redraw(); onChange(); } },
    clearPage: () => { if (store.clearPage(pageNo)) { redraw(); onChange(); } }
  };
}
