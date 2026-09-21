/* 🌐 WebP 변환 — 그림(JPG·PNG·GIF·BMP·WebP) 여러 장을 WebP 로 바꾼다.
   깃허브 사이트·수업앱에 올릴 그림을 가볍게 만들 때 쓴다(2026-09-21 사용자 지시).
   ⚠ PDF 가 아닌 첫 도구다. 사용자가 「탭만 추가」 로 정해 앱 이름(PDF 도구)은 그대로 두었다.

   변환은 브라우저에 들어 있는 기능만 쓴다 — 캔버스에 그린 뒤 toBlob('image/webp', 품질).
   외부 라이브러리가 필요 없고 파일은 이 브라우저 밖으로 나가지 않는다.
   덤 : 캔버스를 거치면 EXIF(촬영 위치·기기)가 사라진다. 폰 사진의 방향은 그리기 전에 바로잡는다.

   순수 계산(크기 맞추기·이름 짓기·WebP 머리 읽기)은 lib/webp.js 에 있다 — Node 로 검사한다. */

import { $, $$, html, esc, fmtSize, overlay, makeZip, makeUrl, saveAs, makeDrop } from './lib/ui.js';
import { PRESETS, fitSize, webpName, savedPct, keepByDefault } from './lib/webp.js';

const OK_EXT = /\.(jpe?g|png|gif|bmp|webp)$/i;
const HEIC = /\.(heic|heif)$/i;

export function makeWebpTab(panel) {
  let items = [];          // { file, url, ow, oh, w, h, blob, outUrl, key, status, err, pick, name, el }
  let sel = null;          // 미리보기로 보고 있는 것
  let q = PRESETS[0].q, maxW = PRESETS[0].maxW;
  let split = 50, zoom = false;
  let gen = 0, timer = 0;  // 설정이 바뀌면 gen 을 올려 «낡은 변환» 을 버린다

  panel.innerHTML = `
    <div class="intro">
      <h2>🌐 WebP 변환</h2>
      <p>그림을 가벼운 <b>WebP</b> 로 바꿉니다. 품질을 움직이면 오른쪽 미리보기와 크기가 곧바로 바뀝니다.</p>
    </div>
    <details class="tip">
      <summary>❓ 이럴 때 씁니다 · 예시 보기</summary>
      <ul>
        <li><b>수업앱에 넣을 슬라이드 16장</b>을 가볍게 → 「사이트·수업앱용」 그대로 넣고 📦 받기</li>
        <li>깃허브 사이트에 올릴 <b>폰 사진</b>(3~5MB) → 보통 <b>200KB 안팎</b>으로 줄고 촬영 위치 정보도 지워집니다</li>
        <li>전자칠판에 <b>전체 화면</b>으로 띄울 그림 → 「고화질」(가로 1920px)</li>
        <li>투명 배경 <b>PNG 아이콘·로고</b> → 투명한 부분이 그대로 남습니다</li>
        <li>WebP 가 <b>원본보다 커지면</b> 빨갛게 표시하고 받을 목록에서 뺍니다 — 그 그림은 원본을 쓰세요</li>
      </ul>
    </details>
    <div class="dz-mount"></div>
    <p class="msg hidden wp-nosupport"></p>
    <div class="work hidden">
      <div class="wp-grid">
        <!-- 왼쪽 : 설정 -->
        <div class="opt-col wp-opts">
          <div class="field">
            <div class="field-label">맞춤 설정</div>
            <div class="preset-row">
              ${PRESETS.map(p => `<button type="button" class="preset" data-p="${p.id}" title="${esc(p.hint)}">
                 <b>${esc(p.label)}</b><span>${p.maxW ? p.maxW + 'px' : '원래 크기'} · ${p.q}</span></button>`).join('')}
            </div>
          </div>
          <div class="field">
            <div class="field-label">품질 <b class="wp-qv">${q}</b> <span class="muted small">(낮을수록 가볍고 흐려짐)</span></div>
            <input type="range" class="wp-q" min="1" max="100" value="${q}">
          </div>
          <div class="field">
            <div class="field-label">가로 최대</div>
            <input type="number" class="num wp-w" min="0" max="10000" step="10" value="${maxW}"> px
            <div class="muted small">0 = 크기 그대로 · 작은 그림을 늘리지는 않습니다</div>
          </div>
        </div>

        <!-- 가운데 : 목록 + 받기 -->
        <div class="wp-listcol">
          <div class="wp-listbar">
            <b class="wp-count"></b>
            <span class="spacer"></span>
            <button type="button" class="btn sub small wp-all" title="변환된 것을 모두 받을 목록에 넣습니다">모두 받기</button>
            <button type="button" class="btn sub small wp-clear">모두 지우기</button>
          </div>
          <div class="wp-list"></div>
          <!-- 받기 : 목록 바로 아래 — 「받을 것 N장」 을 보면서 누른다 -->
          <div class="wp-foot">
            <div class="wp-sum"></div>
            <div class="wp-save">
              <button type="button" class="btn wp-zip">📦 ZIP으로 받기</button>
              <button type="button" class="btn sub wp-dir" title="고른 폴더에 파일을 바로 씁니다 (크롬·엣지)">📁 폴더에 바로 저장</button>
            </div>
            <div class="wp-msg"></div>
          </div>
        </div>

        <!-- 오른쪽 : 원본과 비교 -->
        <div class="wp-prevcol">
          <div class="wp-previnfo muted small">목록에서 그림을 누르면 여기서 원본과 견줍니다.</div>
          <div class="wp-stage"><div class="wp-pair">
            <img class="wp-a" alt="원본">
            <img class="wp-b" alt="WebP">
            <div class="wp-line"></div>
            <span class="wp-lab l">원본</span><span class="wp-lab r">WebP</span>
          </div></div>
          <div class="wp-prevbar">
            <input type="range" class="wp-split" min="0" max="100" value="50" title="가운데 막대 옮기기 — 그림 위를 끌어도 됩니다">
            <button type="button" class="btn sub small wp-zoom" title="WebP 의 실제 픽셀 크기로 봅니다">🔍 1:1 크게</button>
          </div>
        </div>
      </div>
    </div>`;

  const work = $('.work', panel), list = $('.wp-list', panel), msg = $('.wp-msg', panel);
  const stage = $('.wp-stage', panel), pair = $('.wp-pair', panel);
  const imgA = $('.wp-a', panel), imgB = $('.wp-b', panel);

  const dz = makeDrop($('.dz-mount', panel), {
    multiple: true, title: '그림(JPG·PNG·GIF·BMP·WebP)을 여러 장 끌어다 놓으세요', onFiles: add
  });
  // 공용 부품은 PDF 만 받게 되어 있어 파일 종류를 바꿔 준다
  $('input[type=file]', dz).setAttribute('accept', 'image/jpeg,image/png,image/gif,image/bmp,image/webp,.jpg,.jpeg,.png,.gif,.bmp,.webp');

  // 폴더에 바로 저장은 크롬·엣지(보안 주소 : localhost·https)에서만 된다 → 안 되면 단추를 숨긴다
  if (!window.showDirectoryPicker) $('.wp-dir', panel).classList.add('hidden');

  // 이 브라우저가 WebP 를 «만들 수» 있는지 미리 본다(사파리 옛 판은 PNG 로 몰래 바꿔 준다)
  (async () => {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
    if (!b || b.type !== 'image/webp') {
      const m = $('.wp-nosupport', panel);
      m.textContent = '⚠ 이 브라우저는 WebP 를 만들지 못합니다. 크롬이나 엣지로 열어 주세요.';
      m.classList.remove('hidden');
    }
  })();

  /* ---------------- 설정 ---------------- */
  $$('.preset', panel).forEach(b => b.addEventListener('click', () => {
    const p = PRESETS.find(x => x.id === b.dataset.p);
    q = p.q; maxW = p.maxW;
    $('.wp-q', panel).value = q; $('.wp-w', panel).value = maxW;
    paintSettings(); schedule(0);
  }));
  $('.wp-q', panel).addEventListener('input', e => { q = Number(e.target.value); paintSettings(); schedule(); });
  // 숫자 칸은 input 과 change 둘 다 듣는다(루트 규칙 — change 만 들으면 다른 곳을 눌러야 바뀐다)
  ['input', 'change'].forEach(ev => $('.wp-w', panel).addEventListener(ev, e => {
    const v = Math.round(Number(e.target.value));
    maxW = Number.isFinite(v) && v > 0 ? Math.min(10000, v) : 0;
    paintSettings(); schedule(400);
  }));

  function paintSettings() {
    // 크롬·엣지는 품질 100 을 «무손실» 로 만든다(재어 확인함 — 파일이 커질 수 있다)
    $('.wp-qv', panel).textContent = q === 100 ? '100 · 무손실' : q;
    $$('.preset', panel).forEach(b => {
      const p = PRESETS.find(x => x.id === b.dataset.p);
      b.classList.toggle('on', p.q === q && p.maxW === maxW);
    });
  }
  paintSettings();

  /* ---------------- 그림 더하기 ---------------- */
  function add(files) {
    const heic = files.filter(f => HEIC.test(f.name));
    const ok = files.filter(f => OK_EXT.test(f.name) || (/^image\//.test(f.type) && !HEIC.test(f.name)));
    if (heic.length) alert(`아이폰 HEIC 사진 ${heic.length}장은 브라우저가 읽지 못합니다.\nJPG 로 바꿔 넣어 주세요.\n(아이폰 설정 → 카메라 → 포맷 → 「높은 호환성」 으로 찍으면 처음부터 JPG 입니다)`);
    if (!ok.length) { if (!heic.length) alert('JPG·PNG·GIF·BMP·WebP 그림만 넣을 수 있습니다.'); return; }
    ok.forEach(f => items.push({ file: f, url: URL.createObjectURL(f), status: 'wait', pick: null }));
    if (!sel) sel = items[0];
    paintList(); showPreview(); schedule(0);
  }

  $('.wp-clear', panel).addEventListener('click', () => {
    gen++;
    items.forEach(it => { URL.revokeObjectURL(it.url); if (it.outUrl) URL.revokeObjectURL(it.outUrl); });
    items = []; sel = null; msg.innerHTML = '';
    paintList(); showPreview();
  });
  $('.wp-all', panel).addEventListener('click', () => {
    items.forEach(it => { if (it.status === 'done') it.pick = true; });
    items.forEach(paintRow); paintSummary();
  });

  /* ---------------- 변환 ---------------- */
  const keyNow = () => `${q}|${maxW}`;

  /** 설정이 바뀌면 조금 기다렸다가 한 번만 변환한다(손잡이를 끄는 동안 수십 번 돌지 않게) */
  function schedule(delay = 150) {
    clearTimeout(timer);
    timer = setTimeout(convertAll, delay);
  }

  async function convertAll() {
    const my = ++gen, key = keyNow();
    // 보고 있는 그림을 먼저 — 손잡이를 움직인 결과가 가장 빨리 보이게
    const order = sel ? [sel, ...items.filter(it => it !== sel)] : [...items];
    for (const it of order) {
      if (my !== gen) return;                     // 그새 설정이 또 바뀌었다 → 이 차례는 버린다
      if (it.key === key && it.status !== 'wait') continue;
      it.status = 'busy'; paintRow(it);
      try {
        const r = await encode(it.file, q, maxW);
        if (my !== gen) return;
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
        Object.assign(it, r, { outUrl: URL.createObjectURL(r.blob), status: 'done', key, err: '' });
      } catch (e) {
        if (my !== gen) return;
        console.error(e);
        Object.assign(it, { status: 'fail', key, blob: null,
          err: e?.message === 'NO_WEBP' ? '이 브라우저는 WebP 를 만들지 못합니다(크롬·엣지로 여세요)'
                                         : '그림을 읽지 못했습니다(파일이 손상되었을 수 있습니다)' });
      }
      if (!items.includes(it)) continue;          // 변환하는 사이에 목록에서 뺐다
      paintRow(it);
      if (it === sel) showPreview();
      paintSummary();
    }
  }

  /** 그림 한 장 → WebP.
      ① 원본을 «방향을 바로잡아» 읽는다(폰 사진은 EXIF 에 «90° 돌려 보라» 가 적혀 있다)
      ② 가로 최대에 맞춰 줄인다(크게 줄일 때도 매끈하게 — resizeQuality:'high')
      ③ 캔버스에 그려 WebP 로 저장한다. 투명한 부분은 그대로 투명하다. */
  async function encode(file, quality, maxWidth) {
    let full;
    try { full = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { full = await createImageBitmap(file); }   // 옛 브라우저는 이 옵션을 모른다
    const ow = full.width, oh = full.height;
    const { w, h } = fitSize(ow, oh, maxWidth);

    let src = full;
    if (w !== ow) {
      try { src = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }); }
      catch { src = full; }                            // 안 되면 캔버스가 줄인다
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    if (src !== full) src.close();
    full.close();

    const blob = await new Promise(r => c.toBlob(r, 'image/webp', quality / 100));
    c.width = c.height = 0;                            // 캔버스 메모리를 바로 돌려준다
    // 🔴 WebP 를 못 만드는 브라우저는 오류 없이 PNG 를 준다 → 형식을 꼭 확인한다
    if (!blob || blob.type !== 'image/webp') throw new Error('NO_WEBP');
    return { blob, w, h, ow, oh };
  }

  /* ---------------- 목록 ---------------- */
  const picked = it => it.status === 'done' && (it.pick ?? keepByDefault(it.file.size, it.blob.size));

  function paintList() {
    work.classList.toggle('hidden', items.length === 0);
    $('.dz-mount', panel).classList.toggle('slim', items.length > 0);
    list.innerHTML = '';
    const used = new Set();
    items.forEach(it => {
      it.name = webpName(it.file.name, used);          // 목록 순서대로 이름을 정한다(겹치면 -2)
      it.el = html(`
        <div class="wp-row">
          <label class="wp-pick" title="받을 목록에 넣기"><input type="checkbox"></label>
          <span class="m-thumb"><img alt=""></span>
          <span class="wp-mid"><span class="wp-name"></span><small class="wp-dim muted"></small></span>
          <span class="wp-size"></span>
          <button type="button" class="btn icon" title="목록에서 빼기">✕</button>
        </div>`);
      $('input', it.el).addEventListener('change', e => { it.pick = e.target.checked; paintRow(it); paintSummary(); });
      $('button', it.el).addEventListener('click', e => {
        e.stopPropagation();
        URL.revokeObjectURL(it.url); if (it.outUrl) URL.revokeObjectURL(it.outUrl);
        items = items.filter(x => x !== it);
        if (sel === it) sel = items[0] || null;
        paintList(); showPreview();
      });
      it.el.addEventListener('click', e => {
        if (e.target.closest('.wp-pick')) return;
        sel = it; items.forEach(x => x.el.classList.toggle('on', x === sel)); showPreview();
      });
      list.appendChild(it.el);
      paintRow(it);
    });
    $('.wp-count', panel).textContent = `목록 ${items.length}장`;
    paintSummary();
  }

  function paintRow(it) {
    const el = it.el;
    if (!el) return;
    const done = it.status === 'done';
    const bigger = done && it.blob.size >= it.file.size;
    el.classList.toggle('on', it === sel);
    el.classList.toggle('bigger', bigger);
    el.classList.toggle('fail', it.status === 'fail');
    $('.wp-name', el).textContent = it.name;
    $('.wp-name', el).title = `원래 이름 : ${it.file.name}`;
    const img = $('img', el);
    const want = it.outUrl || it.url;                  // 변환이 끝나면 가벼운 WebP 로 작은 그림을 그린다
    if (img.getAttribute('src') !== want) img.src = want;

    const box = $('input', el);
    box.disabled = !done; box.checked = done && picked(it);

    const gif = /\.gif$/i.test(it.file.name) ? ' · 첫 장면만' : '';
    $('.wp-dim', el).textContent =
      it.status === 'fail' ? it.err
      : done ? (it.w === it.ow ? `${it.w}×${it.h} 그대로` : `${it.ow}×${it.oh} → ${it.w}×${it.h}`) + gif
      : '바꾸는 중…' + gif;

    const size = $('.wp-size', el);
    if (!done) { size.innerHTML = `<small>${fmtSize(it.file.size)}</small>`; return; }
    const pct = savedPct(it.file.size, it.blob.size);
    size.innerHTML = `<small>${fmtSize(it.file.size)} →</small> <b>${fmtSize(it.blob.size)}</b>
      <span class="save ${bigger ? 'bad' : 'good'}">${bigger ? '+' + Math.abs(pct) + '% 커짐' : '−' + pct + '%'}</span>`;
  }

  function paintSummary() {
    const done = items.filter(it => it.status === 'done');
    const busy = items.some(it => it.status !== 'done' && it.status !== 'fail');
    const pk = items.filter(picked);
    const o = pk.reduce((s, it) => s + it.file.size, 0), n = pk.reduce((s, it) => s + it.blob.size, 0);
    const bigger = done.filter(it => it.blob.size >= it.file.size && !picked(it)).length;
    const fail = items.filter(it => it.status === 'fail').length;

    $('.wp-sum', panel).innerHTML = `
      <div class="wp-sumbig">받을 것 <b>${pk.length}</b>장${busy ? ' <span class="muted">(바꾸는 중…)</span>' : ''}</div>
      ${pk.length ? `<div>${fmtSize(o)} → <b>${fmtSize(n)}</b> <span class="save good">−${savedPct(o, n)}%</span></div>` : ''}
      ${bigger ? `<div class="warn small">⚠ 오히려 커진 ${bigger}장은 뺐습니다 — 그 그림은 원본을 쓰세요</div>` : ''}
      ${fail ? `<div class="warn small">⚠ 읽지 못한 ${fail}장이 있습니다</div>` : ''}`;
    $('.wp-zip', panel).disabled = !pk.length || busy;
    $('.wp-dir', panel).disabled = !pk.length || busy;
    $('.wp-zip', panel).textContent = pk.length === 1 ? '⬇ WebP 받기' : '📦 ZIP으로 받기';
  }

  /* ---------------- 원본과 비교 ---------------- */
  function showPreview() {
    const it = sel;
    const info = $('.wp-previnfo', panel);
    if (!it) { imgA.removeAttribute('src'); imgB.removeAttribute('src'); info.textContent = ''; return; }
    if (imgA.getAttribute('src') !== it.url) imgA.src = it.url;
    if (it.status === 'done') {
      if (imgB.getAttribute('src') !== it.outUrl) imgB.src = it.outUrl;
      const pct = savedPct(it.file.size, it.blob.size);
      info.innerHTML = `<b>${esc(it.name)}</b> · 원본 ${it.ow}×${it.oh} · ${fmtSize(it.file.size)}
        → WebP ${it.w}×${it.h} · <b>${fmtSize(it.blob.size)}</b> (${pct >= 0 ? '−' + pct : '+' + Math.abs(pct)}%)`;
    } else {
      imgB.removeAttribute('src');
      info.textContent = it.status === 'fail' ? it.err : '바꾸는 중…';
    }
    paintZoom();
    paintSplit();
  }

  // 가운데 막대 : 왼쪽은 원본, 오른쪽은 WebP
  function paintSplit() {
    imgB.style.clipPath = `inset(0 0 0 ${split}%)`;
    $('.wp-line', panel).style.left = split + '%';
    $('.wp-split', panel).value = split;
  }
  $('.wp-split', panel).addEventListener('input', e => { split = Number(e.target.value); paintSplit(); });
  // 그림 위를 끌어도 막대가 따라온다(전자칠판에서는 손가락으로)
  let dragging = false;
  const follow = e => {
    const r = pair.getBoundingClientRect();
    if (!r.width) return;
    split = Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100)));
    paintSplit();
  };
  pair.addEventListener('pointerdown', e => { dragging = true; pair.setPointerCapture(e.pointerId); follow(e); });
  pair.addEventListener('pointermove', e => { if (dragging) follow(e); });
  pair.addEventListener('pointerup', () => { dragging = false; });
  pair.addEventListener('pointercancel', () => { dragging = false; });

  // 1:1 크게 : WebP 의 실제 픽셀 크기로 두 그림을 겹쳐 본다(원본도 같은 크기로 줄여 보인다)
  $('.wp-zoom', panel).addEventListener('click', () => { zoom = !zoom; paintZoom(); });
  function paintZoom() {
    const it = sel, on = zoom && it?.status === 'done';
    stage.classList.toggle('zoom', on);
    pair.style.width = on ? it.w + 'px' : '';
    pair.style.height = on ? it.h + 'px' : '';
    $('.wp-zoom', panel).textContent = zoom ? '↙ 화면에 맞춤' : '🔍 1:1 크게';
  }

  /* ---------------- 받기 ---------------- */
  $('.wp-zip', panel).addEventListener('click', async () => {
    const pk = items.filter(picked);
    if (!pk.length) return;
    if (pk.length === 1) { saveAs(makeUrl(pk[0].blob, 'image/webp'), pk[0].name); return; }
    overlay.show('ZIP 으로 묶는 중…');
    try {
      const blob = await makeZip(pk.map(it => ({ name: it.name, bytes: it.blob })), (a, b, s) => overlay.step(a, b, s));
      saveAs(makeUrl(blob, 'application/zip'), `WebP_${pk.length}장.zip`);
      say(`📦 ${pk.length}장을 ZIP 으로 묶었습니다.`, 'ok');
    } finally { overlay.hide(); }
  });

  $('.wp-dir', panel).addEventListener('click', async () => {
    const pk = items.filter(picked);
    if (!pk.length) return;
    let dir;
    try { dir = await window.showDirectoryPicker({ id: 'webp-out', mode: 'readwrite' }); }
    catch (e) { if (e?.name !== 'AbortError') say('폴더를 열지 못했습니다 : ' + (e?.message || e)); return; }

    overlay.show('폴더에 저장하는 중…');
    let renamed = 0;
    try {
      for (let i = 0; i < pk.length; i++) {
        const it = pk[i];
        // 🔴 폴더에 같은 이름이 이미 있으면 덮어쓰지 않고 -2, -3 을 붙인다
        const name = await freeName(dir, it.name);
        if (name !== it.name) renamed++;
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(it.blob); await w.close();
        overlay.step(i + 1, pk.length, name);
      }
      say(`📁 「${dir.name}」 폴더에 ${pk.length}장을 저장했습니다.` +
          (renamed ? ` 이미 같은 이름이 있던 ${renamed}장은 이름 뒤에 -2 처럼 번호를 붙였습니다.` : ''), 'ok');
    } catch (e) {
      console.error(e);
      say('저장하다 멈췄습니다 : ' + (e?.message || e));
    } finally { overlay.hide(); }
  });

  async function freeName(dir, name) {
    const base = name.replace(/\.webp$/i, '');
    let out = name, n = 2;
    for (;;) {
      try { await dir.getFileHandle(out); } catch { return out; }   // 없으면 오류 → 그 이름을 쓴다
      out = `${base}-${n++}.webp`;
    }
  }

  function say(text, kind = 'bad') { msg.innerHTML = `<p class="msg ${kind}">${esc(text)}</p>`; }

  return { reset() { $('.wp-clear', panel).click(); } };
}
