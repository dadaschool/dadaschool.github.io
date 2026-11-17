/* ============================================================
   캡처 올리기 — 주인만 올리고, 다른 사람은 올린 그림만 본다 (2026-11-11 사용자 지시)

   · 보는 사람: «캡처 넣을 곳» 상자는 보이지 않고, captures/captures.json 에 올라간 그림만 그 자리에 나온다.
   · 주인: 주소 끝에 ?edit 를 붙여 열면 편집 모드가 켜진다. GitHub 토큰(이 저장소 Contents 쓰기 권한)을
     한 번 넣어 두면, 상자의 [캡처 올리기]로 그림을 붙여넣고(Ctrl+V) 빨간 상자·번호를 그린 뒤 올린다.
   · 서버 없음: 그림과 목록을 GitHub 저장소 main 에 «커밋 하나»로 직접 넣는다(Git Data API).
     점검 사이트(geoje)는 Cloudflare 가, 메인(dadaschool.github.io)은 GitHub Pages 가 1~2분 뒤 반영한다.
   · 토큰은 이 브라우저의 localStorage 에만 둔다. 저장소에는 없다. [편집 끝내기]에서 지울 수 있다.
   · 어느 저장소에 올릴지는 주소(호스트)로 고른다 — 메인으로 옮겨도 이 파일을 고칠 필요가 없다.
   ============================================================ */
(function () {
  'use strict';

  var HOSTS = {
    'geoje.edudadat.workers.dev': { owner: 'dadaschool', repo: 'geoje', branch: 'main', dir: 'claude-intermediate/captures' },
    'dadaschool.github.io':       { owner: 'dadaschool', repo: 'dadaschool.github.io', branch: 'main', dir: 'claude-intermediate/captures' }
  };
  var CFG = HOSTS[location.hostname] || null;
  var LS_TOKEN = 'ci-gh-token', LS_EDIT = 'ci-edit';
  var API = 'https://api.github.com';

  function ls(k, v) {            // localStorage 가 막힌 브라우저에서도 페이지는 그대로 동작
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  var q = new URLSearchParams(location.search);
  if (q.has('edit')) ls(LS_EDIT, q.get('edit') === 'off' ? null : '1');
  var editMode = ls(LS_EDIT) === '1';

  var boxes = Array.prototype.slice.call(document.querySelectorAll('.capture[data-cap]'));
  var manifest = {};

  /* ---------- 보는 쪽: 목록을 읽어 그림을 넣는다 ---------- */
  function render() {
    boxes.forEach(function (box) {
      var id = box.getAttribute('data-cap'), e = manifest[id];
      var fig = document.querySelector('figure.capfig[data-cap="' + id + '"]');
      if (e) {
        if (!fig) { fig = document.createElement('figure'); fig.className = 'shot capfig'; fig.setAttribute('data-cap', id); box.parentNode.insertBefore(fig, box); }
        fig.textContent = '';
        var img = document.createElement('img');
        img.src = e.local || ('captures/' + e.file);
        img.alt = e.caption || '';
        img.loading = 'lazy';
        if (e.w && e.h) { img.width = e.w; img.height = e.h; }
        fig.appendChild(img);
        if (e.caption) { var fc = document.createElement('figcaption'); fc.textContent = e.caption; fig.appendChild(fc); }
      } else if (fig) { fig.parentNode.removeChild(fig); }
      box.classList.toggle('has-shot', !!e);
      if (editMode) drawActions(box, id, !!e);
    });
    if (editMode) updateBar();
  }

  function loadManifest() {
    return fetch('captures/captures.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (m) { manifest = m || {}; render(); });
  }

  /* ---------- 편집 모드 ---------- */
  var bar, barMsg, tokenOk = false;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function drawActions(box, id, has) {
    var act = box.querySelector('.capact');
    if (!act) { act = el('div', { 'class': 'capact' }); box.querySelector('.what').appendChild(act); }
    act.textContent = '';
    var up = el('button', { type: 'button', 'class': 'pri' }, has ? '그림 바꾸기' : '캡처 올리기');
    up.addEventListener('click', function () { openDialog(box, id); });
    act.appendChild(up);
    if (has) {
      var del = el('button', { type: 'button' }, '그림 지우기');
      del.addEventListener('click', function () {
        if (!confirm(id + ' 그림을 지울까요? 저장소에서도 지워집니다.')) return;
        busy(true, id + ' 지우는 중…');
        commit(id, null).then(function (m) { manifest = m; render(); busy(false, id + ' 지웠습니다. 1~2분 뒤 모두에게 반영됩니다.'); })
          .catch(function (e) { busy(false, '지우지 못했습니다: ' + explain(e)); });
      });
      act.appendChild(del);
    }
  }

  function buildBar() {
    document.body.classList.add('cap-edit');
    bar = el('div', { 'class': 'capbar', role: 'region', 'aria-label': '캡처 편집' });
    var t = el('b', null, '캡처 편집 모드');
    barMsg = el('span', { 'class': 'msg', 'aria-live': 'polite' });
    var tokWrap = el('span', { 'class': 'tok' });
    var inp = el('input', { type: 'password', placeholder: 'GitHub 토큰 붙여넣기', 'aria-label': 'GitHub 토큰', autocomplete: 'off' });
    var save = el('button', { type: 'button' }, '토큰 저장');
    save.addEventListener('click', function () { if (inp.value.trim()) { ls(LS_TOKEN, inp.value.trim()); inp.value = ''; checkToken(); } });
    tokWrap.appendChild(inp); tokWrap.appendChild(save);
    var help = el('a', { href: 'captures.html' }, '도움말');
    var off = el('button', { type: 'button' }, '편집 끝내기');
    off.addEventListener('click', function () {
      var forget = confirm('편집 모드를 끕니다.\n이 브라우저에 저장한 GitHub 토큰도 지울까요?\n(확인 = 토큰도 지움, 취소 = 토큰은 남김)');
      if (forget) ls(LS_TOKEN, null);
      ls(LS_EDIT, null); location.href = location.pathname;
    });
    [t, barMsg, tokWrap, help, off].forEach(function (n) { bar.appendChild(n); });
    document.body.appendChild(bar);
    bar._tok = tokWrap;
  }

  function updateBar(extra) {
    if (!bar) return;
    var done = boxes.filter(function (b) { return manifest[b.getAttribute('data-cap')]; }).length;
    var where = CFG ? CFG.repo : '이 주소에서는 올릴 수 없음';
    barMsg.textContent = (extra ? extra + ' · ' : '') + '이 쪽 캡처 ' + boxes.length + '개 중 ' + done + '개 · 저장소 ' + where + ' · ' + (tokenOk ? '토큰 연결됨 ✓' : '토큰 없음');
    bar._tok.style.display = tokenOk ? 'none' : '';
  }

  var busyNow = false;
  function busy(on, msg) { busyNow = on; bar.classList.toggle('busy', on); updateBar(msg); }

  function token() { return ls(LS_TOKEN); }

  function gh(path, opts) {
    opts = opts || {};
    var h = { 'Authorization': 'Bearer ' + token(), 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: h, body: opts.body, cache: 'no-store' }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        if (!r.ok) { var e = new Error(t.slice(0, 300)); e.status = r.status; throw e; }
        return t ? JSON.parse(t) : null;
      });
    });
  }

  function explain(e) {
    if (e.status === 401) return '토큰이 틀렸거나 만료됐습니다.';
    if (e.status === 403 || e.status === 404) return '토큰에 이 저장소의 Contents 쓰기 권한이 없습니다.';
    if (e.status === 409 || e.status === 422) return '저장소가 동시에 바뀌었습니다. 다시 시도하세요.';
    return (e.status ? e.status + ' ' : '') + (e.message || e);
  }

  function checkToken() {
    tokenOk = false;
    if (!CFG || !token()) { updateBar(); return; }
    updateBar('토큰 확인 중…');
    gh('/repos/' + CFG.owner + '/' + CFG.repo).then(function (r) {
      tokenOk = !!(r && r.permissions && r.permissions.push);
      updateBar(tokenOk ? '' : '토큰에 쓰기 권한이 없습니다');
    }).catch(function (e) { updateBar(explain(e)); });
  }

  /* UTF-8 ↔ base64 */
  function b64utf8(s) { var b = new TextEncoder().encode(s), out = ''; for (var i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(out); }
  function unb64utf8(s) { var bin = atob(s.replace(/\s/g, '')), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
  function blobB64(blob) { return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1]); }; fr.onerror = no; fr.readAsDataURL(blob); }); }

  /* 그림 하나(또는 지우기)를 목록과 함께 «커밋 하나»로 넣는다. 다른 창이 먼저 바꾸면 처음부터 다시 */
  function commit(id, shot, attempt) {
    attempt = attempt || 0;
    var R = '/repos/' + CFG.owner + '/' + CFG.repo, headSha, baseTree, cur, newFile;
    return gh(R + '/git/ref/heads/' + CFG.branch).then(function (ref) {
      headSha = ref.object.sha;
      return gh(R + '/git/commits/' + headSha);
    }).then(function (c) {
      baseTree = c.tree.sha;
      return gh(R + '/contents/' + CFG.dir + '/captures.json?ref=' + headSha).then(function (j) { return JSON.parse(unb64utf8(j.content)); },
        function (e) { if (e.status === 404) return {}; throw e; });
    }).then(function (m) {
      cur = m || {};
      if (!shot) return null;
      newFile = id + '-' + Date.now().toString(36) + '.' + shot.ext;
      return gh(R + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: shot.b64, encoding: 'base64' }) });
    }).then(function (imgBlob) {
      var old = cur[id], tree = [];
      if (shot) {
        tree.push({ path: CFG.dir + '/' + newFile, mode: '100644', type: 'blob', sha: imgBlob.sha });
        cur[id] = { file: newFile, caption: shot.caption, w: shot.w, h: shot.h, updated: new Date().toISOString() };
      } else { delete cur[id]; }
      var sorted = {}; Object.keys(cur).sort().forEach(function (k) { sorted[k] = cur[k]; });
      cur = sorted;
      return gh(R + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64utf8(JSON.stringify(cur, null, 1) + '\n'), encoding: 'base64' }) })
        .then(function (mb) {
          tree.push({ path: CFG.dir + '/captures.json', mode: '100644', type: 'blob', sha: mb.sha });
          var withDel = old && old.file ? tree.concat([{ path: CFG.dir + '/' + old.file, mode: '100644', type: 'blob', sha: null }]) : tree;
          // 옛 그림 지우기는 덤 — 파일이 이미 없어서 실패하면 지우지 않고 다시 만든다
          return gh(R + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree: withDel }) })
            .catch(function (e) { if (withDel !== tree && e.status === 422) return gh(R + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree: tree }) }); throw e; });
        });
    }).then(function (t) {
      return gh(R + '/git/commits', { method: 'POST', body: JSON.stringify({ message: 'claude-intermediate: 캡처 ' + id + (shot ? ' 올림' : ' 지움'), tree: t.sha, parents: [headSha] }) });
    }).then(function (c) {
      return gh(R + '/git/refs/heads/' + CFG.branch, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) });
    }).then(function () {
      if (shot && cur[id]) cur[id].local = shot.localUrl;   // 반영되기 전까지 내 화면에는 방금 그림을 보여 준다
      return cur;
    }).catch(function (e) {
      if ((e.status === 409 || e.status === 422) && attempt < 2) return commit(id, shot, attempt + 1);
      throw e;
    });
  }

  /* ---------- 올리기 창: 붙여넣기 · 끌어다 놓기 · 빨간 상자 · 번호 ---------- */
  var dlg, D = {};
  function buildDialog() {
    dlg = el('div', { 'class': 'capmodal', hidden: '' });
    dlg.innerHTML =
      '<div class="capdlg" role="dialog" aria-modal="true" aria-labelledby="capdlg-t">' +
      '<h3 id="capdlg-t">캡처 올리기</h3>' +
      '<p class="hint">화면을 캡처한 뒤(윈도우 <kbd>⊞ Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>, 맥 <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd>) 이 창에서 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 붙여넣거나, 파일을 끌어다 놓거나 고릅니다.</p>' +
      '<div class="caprow"><label class="filebtn">파일 고르기<input type="file" accept="image/*" hidden></label></div>' +
      '<div class="capstage" tabindex="0" aria-label="그림 넣는 곳"><span class="ph">여기에 붙여넣기 · 끌어다 놓기</span><canvas hidden></canvas></div>' +
      '<div class="captools" role="toolbar" aria-label="표시 도구">' +
      '<button type="button" data-tool="rect" aria-pressed="true">□ 빨간 상자</button>' +
      '<button type="button" data-tool="num" aria-pressed="false">① 번호</button>' +
      '<button type="button" data-act="undo">되돌리기</button>' +
      '<button type="button" data-act="clear">표시 모두 지우기</button></div>' +
      '<label class="capcap">그림 아래 설명 (그림을 못 보는 사람에게 읽어 주는 글로도 쓰입니다)<textarea rows="3"></textarea></label>' +
      '<div class="caprow end"><span class="dmsg" aria-live="polite"></span><button type="button" data-act="cancel">취소</button><button type="button" class="pri" data-act="upload" disabled>올리기</button></div>' +
      '</div>';
    document.body.appendChild(dlg);
    D.title = dlg.querySelector('#capdlg-t'); D.file = dlg.querySelector('input[type=file]'); D.stage = dlg.querySelector('.capstage');
    D.ph = dlg.querySelector('.ph'); D.cv = dlg.querySelector('canvas'); D.cap = dlg.querySelector('textarea'); D.msg = dlg.querySelector('.dmsg');
    D.up = dlg.querySelector('[data-act=upload]');
    D.file.addEventListener('change', function () { if (D.file.files[0]) loadImage(D.file.files[0]); });
    dlg.addEventListener('paste', function (ev) {
      var it = Array.prototype.slice.call((ev.clipboardData || {}).items || []).filter(function (i) { return i.type.indexOf('image/') === 0; })[0];
      if (it) { ev.preventDefault(); loadImage(it.getAsFile()); }
    });
    D.stage.addEventListener('dragover', function (ev) { ev.preventDefault(); D.stage.classList.add('over'); });
    D.stage.addEventListener('dragleave', function () { D.stage.classList.remove('over'); });
    D.stage.addEventListener('drop', function (ev) {
      ev.preventDefault(); D.stage.classList.remove('over');
      var f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f && f.type.indexOf('image/') === 0) loadImage(f);
    });
    dlg.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () { D.tool = b.getAttribute('data-tool'); dlg.querySelectorAll('[data-tool]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
    });
    dlg.querySelector('[data-act=undo]').addEventListener('click', function () { D.shapes.pop(); paint(); });
    dlg.querySelector('[data-act=clear]').addEventListener('click', function () { D.shapes = []; paint(); });
    dlg.querySelector('[data-act=cancel]').addEventListener('click', closeDialog);
    dlg.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeDialog(); });
    D.up.addEventListener('click', upload);
    // 그리기 — 좌표는 원본 그림 기준으로 저장한다
    var start = null;
    function pt(ev) { var r = D.cv.getBoundingClientRect(), s = D.img.naturalWidth / r.width; return { x: (ev.clientX - r.left) * s, y: (ev.clientY - r.top) * s }; }
    D.cv.addEventListener('pointerdown', function (ev) {
      if (!D.img) return; var p = pt(ev);
      if (D.tool === 'num') { D.shapes.push({ t: 'num', x: p.x, y: p.y, n: D.shapes.filter(function (s) { return s.t === 'num'; }).length + 1 }); paint(); return; }
      start = p; D.cv.setPointerCapture(ev.pointerId);
    });
    D.cv.addEventListener('pointermove', function (ev) { if (start) { var p = pt(ev); paint({ t: 'rect', x: start.x, y: start.y, w: p.x - start.x, h: p.y - start.y }); } });
    D.cv.addEventListener('pointerup', function (ev) {
      if (!start) return; var p = pt(ev), r = { t: 'rect', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      start = null; if (r.w > 6 && r.h > 6) D.shapes.push(r); paint();
    });
  }

  function openDialog(box, id) {
    if (busyNow) return;
    if (!CFG) { alert('이 주소에서는 올릴 수 없습니다. 점검 사이트나 메인 사이트 주소에서 여세요.'); return; }
    if (!tokenOk) { alert('먼저 아래 막대에 GitHub 토큰을 넣고 [토큰 저장]을 누르세요. 만드는 법은 «도움말»에 있습니다.'); return; }
    if (!dlg) buildDialog();
    D.id = id; D.img = null; D.shapes = []; D.tool = 'rect'; D.file.value = '';
    D.title.textContent = '캡처 올리기 · ' + id;
    D.cap.value = (manifest[id] && manifest[id].caption) || box.getAttribute('data-caption') || '';
    D.cv.hidden = true; D.ph.hidden = false; D.up.disabled = true; D.msg.textContent = '';
    dlg.querySelectorAll('[data-tool]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-tool') === 'rect')); });
    D.opener = document.activeElement;
    dlg.hidden = false; D.stage.focus();
  }
  function closeDialog() { if (!dlg || D.sending) return; dlg.hidden = true; if (D.opener) D.opener.focus(); }

  function loadImage(file) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () { D.img = img; D.shapes = []; D.ph.hidden = true; D.cv.hidden = false; D.up.disabled = false; paint(); };
    img.onerror = function () { D.msg.textContent = '그림을 열 수 없습니다.'; };
    img.src = url;
  }

  function drawShapes(ctx, scale, shapes, W) {
    var lw = Math.max(3, W * 0.004), rad = Math.max(13, W * 0.015);
    shapes.forEach(function (s) {
      if (s.t === 'rect') {
        ctx.strokeStyle = '#E53935'; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.strokeRect(s.x * scale, s.y * scale, s.w * scale, s.h * scale);
      } else {
        var x = s.x * scale, y = s.y * scale;
        ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.fill();
        ctx.lineWidth = Math.max(2, rad * 0.16); ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(rad * 1.15) + 'px Pretendard, "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(s.n), x, y + rad * 0.05);
      }
    });
  }

  function paint(preview) {
    if (!D.img) return;
    // 세로로 긴 캡처도 [올리기] 단추가 화면 안에 남도록 높이를 창의 55% 안으로
    var maxW = Math.min(D.stage.clientWidth - 4, 1200, window.innerHeight * 0.55 * D.img.naturalWidth / D.img.naturalHeight);
    var W = Math.min(maxW, D.img.naturalWidth), s = W / D.img.naturalWidth;
    D.cv.width = Math.round(W); D.cv.height = Math.round(D.img.naturalHeight * s);
    var ctx = D.cv.getContext('2d');
    ctx.drawImage(D.img, 0, 0, D.cv.width, D.cv.height);
    // 화면에서도 내보낼 그림과 같은 굵기로 보이게, 내보낼 폭(최대 1600) 기준 굵기를 화면 배율로 줄인다
    var outW = Math.min(1600, D.img.naturalWidth);
    ctx.save(); ctx.scale(W / outW, W / outW);
    drawShapes(ctx, outW / D.img.naturalWidth, D.shapes.concat(preview ? [preview] : []), outW);
    ctx.restore();
  }

  function exportImage() {
    var W = Math.min(1600, D.img.naturalWidth), s = W / D.img.naturalWidth, H = Math.round(D.img.naturalHeight * s);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(D.img, 0, 0, W, H); drawShapes(ctx, s, D.shapes, W);
    return new Promise(function (ok) {
      c.toBlob(function (b) {
        if (b && b.type === 'image/webp') return ok({ blob: b, ext: 'webp', w: W, h: H });
        c.toBlob(function (j) { ok({ blob: j, ext: 'jpg', w: W, h: H }); }, 'image/jpeg', 0.9);   // webp 를 못 만드는 브라우저
      }, 'image/webp', 0.86);
    });
  }

  function upload() {
    if (!D.img || D.sending) return;
    D.sending = true; D.up.disabled = true; D.msg.textContent = '올리는 중…';
    var id = D.id, caption = D.cap.value.trim();
    exportImage().then(function (o) {
      return blobB64(o.blob).then(function (b64) {
        busy(true, id + ' 올리는 중…');
        return commit(id, { b64: b64, ext: o.ext, w: o.w, h: o.h, caption: caption, localUrl: URL.createObjectURL(o.blob) });
      });
    }).then(function (m) {
      manifest = m; D.sending = false; dlg.hidden = true; render();
      busy(false, id + ' 올렸습니다. 1~2분 뒤 모두에게 보입니다.');
      var fig = document.querySelector('figure.capfig[data-cap="' + id + '"]'); if (fig) fig.scrollIntoView({ block: 'center' });
    }).catch(function (e) {
      D.sending = false; D.up.disabled = false; D.msg.textContent = '올리지 못했습니다: ' + explain(e); busy(false, '');
    });
  }

  /* ---------- 시작 ---------- */
  if (editMode) { buildBar(); checkToken(); }
  if (boxes.length || editMode) loadManifest();
})();
