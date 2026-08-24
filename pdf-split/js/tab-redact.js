/* ⬛ 검열 — 학생 이름·연락처처럼 남으면 안 되는 것을 «진짜로» 지운다.
   🔴 검은 네모를 얹기만 하면 그 밑의 글자는 그대로 남는다 — 복사·검색하면 다 보인다.
     실제로 관공서 문서에서 여러 번 사고가 났다. 그래서 이 탭은
     **가린 쪽을 통째로 그림으로 다시 그린다** — 밑의 글자가 파일에서 사라진다.
   ⚠ 그 대가로 그 쪽은 글자 검색이 안 된다. 화면에 그대로 적어 두었다. */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage, canvasToBlob } from './lib/render.js';
import { makeBoard } from './lib/pageboard.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument } = PDFLib;

export function makeRedactTab(panel) {
  let src = null, board = null;
  let dpi = 150;

  panel.innerHTML = `
    <div class="intro">
      <h2>⬛ 검열</h2>
      <p>가릴 자리를 끌어서 정하면, <b>그 쪽을 그림으로 다시 그려</b> 밑의 글자까지 없앱니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li>학생 <b>이름·학번이 든 명단</b>을 예시 자료로 쓸 때</li>
        <li>공문에서 <b>개인 연락처</b>만 지우고 동료에게 공유할 때</li>
        <li>성적표 <b>양식만 남기고</b> 점수를 지울 때</li>
        <li>🔴 그림판에서 검은 칠을 하는 것과 다릅니다 — 여기서는 <b>밑의 글자까지 파일에서 사라집니다.</b></li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col wide-right">
        <div class="opt-col">
          <div class="field">
            <div class="field-label">해상도(DPI) : <b class="dpi-val">150</b></div>
            <input type="range" class="dpi-range" min="96" max="300" step="6" value="150">
            <div class="muted small">가린 쪽만 이 해상도의 그림이 됩니다. 나머지 쪽은 원본 그대로입니다.</div>
          </div>
          <p class="warn small">🔴 검은 네모만 얹으면 <b>밑의 글자가 그대로 남아</b> 복사·검색으로 보입니다.
             그래서 이 탭은 가린 쪽을 <b>그림으로 굳힙니다</b> — 그 쪽은 글자 검색이 안 됩니다.</p>
          <p class="muted small">가리지 않은 쪽은 손대지 않으므로 글자가 그대로 살아 있습니다.</p>
          <div class="field"><span class="red-state muted"></span></div>
          <button type="button" class="btn big run" disabled>가리고 저장</button>
          <div class="result"></div>
        </div>
        <div class="prev-col board-col"></div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel), elRun = $('.run', panel);

  makeDrop($('.dz-mount', panel), { title: 'PDF 를 여기로 끌어다 놓으세요', onFiles: fs => load(fs[0]) });
  $('.dpi-range', panel).addEventListener('input', e => { dpi = Number(e.target.value); $('.dpi-val', panel).textContent = e.target.value; });
  elRun.addEventListener('click', run);

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
      board = makeBoard($('.board-col', panel), doc, { onChange: state, color: 'rgba(16,20,30,.85)' });
      state();
    } catch (e) { console.error(e); alert(readErr(e)); reset(); }
    finally { overlay.hide(); }
  }

  function reset() {
    src?.doc?.destroy?.(); src = null; board = null;
    work.classList.add('hidden'); elResult.innerHTML = '';
    $('.board-col', panel).innerHTML = '';
    state();
  }

  function state() {
    const n = board?.count() || 0;
    const pages = board ? board.all().size : 0;
    $('.red-state', panel).textContent = n ? `가릴 자리 ${n}곳 · ${pages}쪽이 그림이 됩니다` : '가릴 자리를 끌어서 정하세요';
    elRun.disabled = !(src && n);
  }

  /* ---------------- 실행 ---------------- */
  async function run() {
    if (!src || !board.count()) return;
    const spots = board.all();
    overlay.show('가리고 다시 그리는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.load(src.buf.slice(0));
      const pages = out.getPages();
      const targets = [...spots.keys()].sort((a, b) => a - b);

      for (let i = 0; i < targets.length; i++) {
        const no = targets[i];
        const boxes = spots.get(no);

        // ① 쪽을 그림으로 그리고 ② 그 위에 검은 칠을 하고 ③ 그 그림으로 쪽을 갈아 끼운다
        const { canvas, ptWidth, ptHeight } = await drawPage(src.doc, no, { dpi });
        const k = canvas.width / ptWidth;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        boxes.forEach(b => ctx.fillRect(b.x * k, b.y * k, b.w * k, b.h * k));

        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
        const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        canvas.width = canvas.height = 0;

        // 원래 쪽을 빼고 «같은 자리»에 그림 쪽을 넣는다(순서가 어긋나면 안 된다)
        const old = pages[no - 1];
        const rot = ((old.getRotation().angle % 360) + 360) % 360;
        const idx = out.getPages().indexOf(old);
        out.removePage(idx);
        const fresh = out.insertPage(idx, [ptWidth, ptHeight]);   // 보이는 크기 그대로
        fresh.drawImage(jpg, { x: 0, y: 0, width: ptWidth, height: ptHeight });
        // 그림은 이미 «보이는 대로» 그려졌으므로 회전은 0 으로 둔다(rot 은 참고용)

        overlay.step(i + 1, targets.length, `${i + 1} / ${targets.length}쪽`);
        await breathe();
      }

      showResult(elResult, [{
        name: `${baseName(src.name)}_검열.pdf`,
        note: `${targets.length}쪽을 그림으로 굳힘 · ${board.count()}곳 가림`,
        bytes: await out.save()
      }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
