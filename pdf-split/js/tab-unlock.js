/* 🔓 암호 풀기 — 암호가 걸린 PDF 를 «아는 암호로» 열어 잠금 없는 파일로 다시 만든다.
   🚨 암호를 «알아내는» 기능이 아니다. 아는 암호를 넣어야만 열린다.
   🚨 저작권·개인정보 책임 안내를 반드시 먼저 보여 주고 확인을 받는다(사용자 지시).
   ⚠ pdf-lib 에는 복호화가 없어서, 연 뒤에 «다시 그려» 새 PDF 를 만든다 →
     글자가 그림이 되어 검색이 안 된다. 그 사실을 결과에도 적는다. */

import { $, $$, esc, fmtSize, overlay, showResult, note, readErr, breathe, makeDrop } from './lib/ui.js';
import { openDoc, drawPage, canvasToBlob, passwordProblem } from './lib/render.js';
import { baseName } from './lib/ranges.js';

const { PDFDocument } = PDFLib;

export function makeUnlockTab(panel) {
  let buf = null, name = '', size = 0, doc = null;
  let dpi = 150, agreed = false;

  panel.innerHTML = `
    <div class="intro">
      <h2>🔓 암호 풀기</h2>
      <p><b>아는 암호</b>를 넣어 열고, 잠금 없는 PDF 로 다시 만듭니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li>받은 공문에 <b>암호가 걸려</b> 다른 편집 도구에서 열리지 않을 때</li>
        <li><b>내가 예전에 걸어 둔</b> 암호를 풀어 보관용으로 남길 때</li>
        <li>⚠ <b>암호를 아는 문서만</b> 됩니다. 암호를 찾아 주지는 않습니다.</li>
        <li>풀고 나면 글자가 그림이 되므로, <b>글자 검색이 필요하면</b> 원본을 함께 보관하세요.</li>
      </ul>
    </details>

    <div class="agree-card">
      <h3>🚨 쓰기 전에 꼭 확인하세요</h3>
      <ul>
        <li>이 도구는 암호를 <b>알아내지 못합니다.</b> 아는 암호를 넣어야만 열립니다.</li>
        <li>암호는 만든 사람이 <b>함부로 고치거나 퍼뜨리지 말라</b>는 뜻으로 걸어 둔 것입니다.
            <b>남의 저작물</b>의 잠금을 풀어 나누어 주면 저작권법에 걸릴 수 있습니다.</li>
        <li>명단·성적처럼 <b>개인정보가 든 문서</b>의 잠금을 풀면 유출 위험이 커집니다.
            푼 파일을 어디에 두고 언제 지울지는 <b>쓰는 사람 책임</b>입니다.</li>
        <li>파일은 이 브라우저 밖으로 나가지 않지만, <b>만들어진 파일의 관리 책임까지 대신해 주지는 않습니다.</b></li>
      </ul>
      <label class="agree-check">
        <input type="checkbox" class="agree"> 위 내용을 확인했고, <b>내가 열 권한이 있는 문서</b>입니다.
      </label>
    </div>

    <div class="dz-mount locked"></div>

    <div class="work hidden">
      <div class="filebar"></div>
      <div class="two-col">
        <div class="prev-col">
          <div class="prev-frame"><div class="skel"></div></div>
          <div class="muted center small">미리보기 (1쪽)</div>
        </div>
        <div class="opt-col">
          <div class="field pw-field">
            <div class="field-label">이 PDF 의 암호</div>
            <input type="password" class="ranges pw" placeholder="암호를 넣고 Enter" autocomplete="off">
            <div class="pw-msg muted small">암호를 넣으면 열어 봅니다.</div>
          </div>
          <div class="field">
            <div class="field-label">해상도(DPI) : <b class="dpi-val">150</b></div>
            <input type="range" class="dpi-range" min="96" max="300" step="6" value="150">
          </div>
          <p class="warn small">⚠️ 잠금을 풀면 쪽이 <b>그림</b>이 되어 글자 검색·복사가 안 됩니다
             (PDF 규격상 브라우저에서는 이 방법뿐입니다).</p>
          <button type="button" class="btn big run" disabled>잠금 없는 PDF 만들기</button>
          <div class="result"></div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), elResult = $('.result', panel),
        elRun = $('.run', panel), elPw = $('.pw', panel), dz = $('.dz-mount', panel);

  makeDrop(dz, { title: '암호가 걸린 PDF 를 끌어다 놓으세요', onFiles: fs => load(fs[0]) });
  lockDrop();

  $('.agree', panel).addEventListener('change', e => {
    agreed = e.target.checked;
    lockDrop();
  });
  function lockDrop() {
    dz.classList.toggle('locked', !agreed);
    dz.title = agreed ? '' : '위 안내를 확인해야 파일을 넣을 수 있습니다';
  }

  $('.dpi-range', panel).addEventListener('input', e => { dpi = Number(e.target.value); $('.dpi-val', panel).textContent = e.target.value; });
  elPw.addEventListener('keydown', e => { if (e.key === 'Enter') tryOpen(elPw.value); });
  elPw.addEventListener('change', () => tryOpen(elPw.value));
  elRun.addEventListener('click', run);

  /* ---------------- 파일 ---------------- */
  async function load(file) {
    if (!agreed) { alert('위 안내를 먼저 확인해 주세요.'); return; }
    reset();
    if (!/\.pdf$/i.test(file.name)) { alert('PDF 파일만 넣을 수 있습니다.'); return; }
    buf = await file.arrayBuffer(); name = file.name; size = file.size;
    work.classList.remove('hidden');
    $('.filebar', panel).innerHTML = `
      <span class="f-name" title="${esc(name)}">📄 ${esc(name)}</span>
      <span class="badge soft">${fmtSize(size)}</span>
      <button type="button" class="btn sub small change">다른 파일</button>`;
    $('.change', panel).addEventListener('click', reset);
    tryOpen('');                       // 암호 없이 먼저 열어 본다
  }

  function reset() {
    doc?.destroy?.(); doc = null; buf = null;
    work.classList.add('hidden'); elResult.innerHTML = '';
    elPw.value = ''; elRun.disabled = true;
    $('.prev-frame', panel).innerHTML = '<div class="skel"></div>';
  }

  /* ⚠ 열어 보는 일이 «겹칠» 수 있다(파일을 넣자마자 암호를 치는 경우).
     늦게 끝난 예전 시도가 새 결과를 덮어쓰면 «맞는 암호를 넣었는데 틀렸다» 고 나온다.
     그래서 번호표를 달아 «가장 마지막 시도» 만 화면을 고치게 한다. */
  let tryNo = 0;

  async function tryOpen(pw) {
    if (!buf) return;
    const my = ++tryNo;
    doc?.destroy?.(); doc = null;
    elRun.disabled = true;
    const msg = $('.pw-msg', panel);
    overlay.show('열어 보는 중…');
    try {
      const opened = await openDoc(buf, { password: pw || undefined });
      if (my !== tryNo) { opened.destroy(); return; }      // 더 새 시도가 있다 — 조용히 물러난다
      doc = opened;

      // pdf.js 로는 열렸다 — pdf-lib 으로도 열리면 «애초에 잠기지 않은» 파일이다
      let plain = false;
      try { await PDFDocument.load(buf.slice(0)); plain = true; } catch { plain = false; }

      msg.className = 'pw-msg small ' + (plain ? 'muted' : 'good');
      msg.innerHTML = plain
        ? `이 PDF 는 <b>잠겨 있지 않습니다.</b> 다른 탭(자르기·변환 등)에서 그대로 쓸 수 있습니다.`
        : `✓ 열렸습니다 · 전체 <b>${doc.numPages}쪽</b>`;
      $('.pw-field', panel).classList.toggle('hidden', false);
      elRun.disabled = plain;
      preview();
    } catch (e) {
      if (my !== tryNo) return;                            // 지나간 시도의 오류는 무시한다
      const p = passwordProblem(e);
      msg.className = 'pw-msg small bad';
      // ⚠ pdf.js 는 «틀린 암호» 에도 «암호 필요»(code 1) 를 돌려줄 때가 있다.
      //   그래서 코드만 믿지 말고 «사용자가 암호를 넣었는지» 로 문구를 정한다 —
      //   안 그러면 틀린 암호를 넣어도 「암호를 넣어 주세요」 만 되풀이되어 답답하다.
      msg.textContent = !p ? readErr(e)
                      : pw ? '암호가 맞지 않습니다. 다시 넣어 주세요.'
                           : '이 PDF 는 암호가 걸려 있습니다. 아는 암호를 넣어 주세요.';
      if (p) elPw.focus();
    } finally { overlay.hide(); }
  }

  async function preview() {
    try {
      const { canvas } = await drawPage(doc, 1, { width: 300 });
      const frame = $('.prev-frame', panel);
      frame.innerHTML = ''; canvas.classList.add('prev-img'); frame.appendChild(canvas);
    } catch (e) { console.error(e); }
  }

  /* ---------------- 실행 ---------------- */
  async function run() {
    if (!doc) return;
    overlay.show('잠금 없는 PDF 를 만드는 중…');
    elResult.innerHTML = '';
    try {
      const out = await PDFDocument.create();
      for (let n = 1; n <= doc.numPages; n++) {
        const { canvas, ptWidth, ptHeight } = await drawPage(doc, n, { dpi });
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
        canvas.width = canvas.height = 0;
        const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const page = out.addPage([ptWidth, ptHeight]);
        page.drawImage(jpg, { x: 0, y: 0, width: ptWidth, height: ptHeight });
        overlay.step(n, doc.numPages, `${n} / ${doc.numPages}쪽`);
        await breathe();
      }
      showResult(elResult, [{
        name: `${baseName(name)}_잠금해제.pdf`,
        note: `${doc.numPages}쪽 · 글자는 그림이 되었습니다`,
        bytes: await out.save()
      }]);
    } catch (e) {
      console.error(e);
      note(elResult, readErr(e));
    } finally { overlay.hide(); }
  }

  return { reset };
}
