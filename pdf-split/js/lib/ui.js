/* 화면 공통 부품 — 파일 넣는 곳, 진행 표시, 내려받기, ZIP 묶기 */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** 사람이 읽는 파일 크기 */
export function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/** HTML 글자 하나로 요소를 만든다 */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

/* ------------------------------------------------------------------
   파일 넣는 곳 (드래그 & 드롭 + 파일 고르기)
------------------------------------------------------------------ */
export function makeDrop(mount, { multiple = false, title = 'PDF 를 여기로 끌어다 놓으세요', onFiles }) {
  mount.innerHTML = '';
  const box = html(`
    <div class="drop">
      <p class="drop-big">${esc(title)}</p>
      <button type="button" class="btn">파일 고르기</button>
      <input type="file" accept="application/pdf,.pdf" hidden ${multiple ? 'multiple' : ''}>
    </div>`);
  const input = $('input', box), btn = $('button', box);

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files?.length) onFiles([...input.files]);
    input.value = '';   // 비워 두어야 같은 파일을 다시 골라도 change 가 일어난다
  });
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', e => {
    e.preventDefault(); box.classList.remove('over');
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onFiles(multiple ? files : [files[0]]);
  });

  mount.appendChild(box);
  return box;
}

// 창 아무 데나 떨어뜨렸을 때 브라우저가 PDF 를 그냥 열어 버리는 것을 막는다
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));

/* ------------------------------------------------------------------
   진행 표시 — 오래 걸리는 일(렌더링·압축·변환)에 쓴다
------------------------------------------------------------------ */
const ov = {
  box: null,
  ensure() {
    if (this.box) return;
    this.box = html(`
      <div class="overlay hidden">
        <div class="overlay-card">
          <div class="spinner"></div>
          <div class="overlay-label"></div>
          <div class="bar"><div class="bar-in"></div></div>
          <div class="overlay-sub"></div>
        </div>
      </div>`);
    document.body.appendChild(this.box);
  },
  show(label) {
    this.ensure();
    $('.overlay-label', this.box).textContent = label;
    $('.overlay-sub', this.box).textContent = '';
    $('.bar-in', this.box).style.width = '0%';
    this.box.classList.remove('hidden');
  },
  step(done, total, sub = '') {
    if (!this.box) return;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('.bar-in', this.box).style.width = pct + '%';
    $('.overlay-sub', this.box).textContent = sub || `${done} / ${total}`;
  },
  hide() { this.box?.classList.add('hidden'); }
};
export const overlay = ov;

/** 화면이 갱신될 틈을 준다(진행 막대가 멈춰 보이지 않게) */
export const breathe = () => new Promise(r => setTimeout(r, 0));

/* ------------------------------------------------------------------
   내려받기
------------------------------------------------------------------ */
const madeUrls = [];
export function makeUrl(bytesOrBlob, type = 'application/pdf') {
  const blob = bytesOrBlob instanceof Blob ? bytesOrBlob : new Blob([bytesOrBlob], { type });
  const url = URL.createObjectURL(blob);
  madeUrls.push(url);
  return url;
}
export function revokeAll() {
  while (madeUrls.length) URL.revokeObjectURL(madeUrls.pop());
}
export function saveAs(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

/** 여러 파일을 ZIP 하나로 묶는다.
    ⚠ 압축하지 않는다(STORE) — PDF·PNG·JPG 는 이미 압축되어 있어 다시 압축하면
    시간만 오래 걸리고 크기는 거의 그대로다. */
export async function makeZip(files, onStep) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.bytes);
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, meta => {
    onStep?.(Math.round(meta.percent), 100, `묶는 중 ${Math.round(meta.percent)}%`);
  });
}

/* ------------------------------------------------------------------
   결과 목록 그리기 (네 탭이 같은 모양을 쓴다)
------------------------------------------------------------------ */
export function showResult(mount, files, { zipName } = {}) {
  mount.innerHTML = '';
  const list = html('<div class="res-list"></div>');

  files.forEach(f => {
    const url = makeUrl(f.bytes, f.type || 'application/pdf');
    const line = html(`
      <div class="line">
        <span class="name">${esc(f.name)}<small>${esc(f.note || '')} · ${fmtSize(f.bytes.length ?? f.bytes.size)}</small></span>
        <a class="btn" download="${esc(f.name)}" href="${url}">내려받기</a>
      </div>`);
    list.appendChild(line);
  });
  mount.appendChild(list);

  if (files.length > 1) {
    const foot = html(`
      <div class="res-foot">
        <button type="button" class="btn zip">📦 ZIP 하나로 받기</button>
        <button type="button" class="btn sub each">하나씩 모두 받기</button>
      </div>`);
    $('.zip', foot).addEventListener('click', async () => {
      overlay.show('ZIP 으로 묶는 중…');
      try {
        const blob = await makeZip(files, (a, b, s) => overlay.step(a, b, s));
        saveAs(makeUrl(blob, 'application/zip'), zipName || '파일묶음.zip');
      } finally { overlay.hide(); }
    });
    $('.each', foot).addEventListener('click', () => {
      // 너무 빨리 부르면 브라우저가 뒤엣것을 무시한다
      $$('a[download]', list).forEach((a, i) => setTimeout(() => a.click(), i * 400));
    });
    mount.appendChild(foot);
  }
}

/** 오류·안내 문구 */
export function note(mount, msg, kind = 'bad') {
  mount.innerHTML = `<p class="msg ${kind}">${esc(msg)}</p>`;
}

/** PDF 를 열다가 난 오류를 사람 말로 바꾼다 */
export function readErr(err) {
  const s = String(err?.name || '') + ' ' + String(err?.message || '');
  if (/Password|Encrypt/i.test(s)) return '🔒 암호가 걸린 PDF 라 열 수 없습니다. 암호를 푼 뒤 다시 넣어 주세요.';
  if (/Invalid PDF|Failed to parse/i.test(s)) return 'PDF 를 읽지 못했습니다. 파일이 손상되었을 수 있습니다.';
  return '처리 중 문제가 생겼습니다 : ' + s;
}
