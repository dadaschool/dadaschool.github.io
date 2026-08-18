/* PDF 쪽 뽑기 — 모든 처리는 브라우저 안에서 끝난다(서버로 파일을 보내지 않는다) */
(function () {
  'use strict';

  var PDFDocument = PDFLib.PDFDocument;

  // 화면 요소 모으기
  var $ = function (id) { return document.getElementById(id); };
  var elDrop = $('drop'), elFile = $('file'), elPick = $('pickBtn'),
      elInfo = $('fileInfo'), elStep2 = $('step2'), elStep3 = $('step3'),
      elStepOut = $('stepOut'), elRanges = $('ranges'), elPreview = $('preview'),
      elRun = $('runBtn'), elResult = $('result');

  // 지금 상태 : 읽어 둔 PDF 와 쪽수
  var state = { doc: null, name: '', total: 0, mode: 'merge' };
  var madeUrls = [];   // 만들어 둔 내려받기 주소(다시 만들 때 정리한다)

  /* ---------------------------------------------------------------
     쪽 번호 해석 : "1-3, 7, 20-" → 범위 목록과 쪽 번호 목록
     total = 원본의 전체 쪽수. 반환값의 쪽 번호는 1부터 센다.
  --------------------------------------------------------------- */
  function parseRanges(text, total) {
    var out = { ok: false, ranges: [], pages: [], errors: [] };
    if (!text || !text.trim()) return out;

    // 범위 기호(-, ~, 각종 대시) 둘레의 공백을 없애 "1 - 3" 도 한 덩어리가 되게 한다
    var tidy = text.replace(/\s*[-~–—∼]\s*/g, '-');
    var parts = tidy.split(/[\s,;]+/).filter(function (s) { return s.length > 0; });

    parts.forEach(function (p) {
      var from, to, m;

      if (/^\d+$/.test(p)) {                       // 5      → 한 쪽
        from = to = parseInt(p, 10);
      } else if ((m = p.match(/^(\d*)-(\d*)$/))) { // 5-12, 20-, -3
        from = m[1] === '' ? 1 : parseInt(m[1], 10);
        to   = m[2] === '' ? total : parseInt(m[2], 10);
      } else {
        out.errors.push('「' + p + '」는 쪽 번호로 읽을 수 없습니다.');
        return;
      }

      if (from > to) { var t = from; from = to; to = t; }   // 거꾸로 적어도 알아서 바로잡는다
      if (from < 1) from = 1;

      if (to > total) {
        out.errors.push('「' + p + '」 — 이 PDF 는 ' + total + '쪽까지입니다.');
        return;
      }
      out.ranges.push({ from: from, to: to, text: from === to ? String(from) : from + '-' + to });
    });

    // 한 파일로 모을 때 쓸 쪽 목록 : 적은 순서 그대로, 겹치는 쪽은 한 번만
    var seen = {};
    out.ranges.forEach(function (r) {
      for (var n = r.from; n <= r.to; n++) {
        if (!seen[n]) { seen[n] = true; out.pages.push(n); }
      }
    });

    out.ok = out.errors.length === 0 && out.ranges.length > 0;
    return out;
  }

  /* 파일 이름 만들기 : 원본이름_5-12.pdf */
  function baseName(name) {
    return name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'pdf';
  }
  function outName(parsed, mode, range) {
    var b = baseName(state.name);
    if (mode === 'split') return b + '_' + range.text + '.pdf';
    if (parsed.ranges.length === 1) return b + '_' + parsed.ranges[0].text + '.pdf';
    return b + '_선택' + parsed.pages.length + '쪽.pdf';
  }

  /* 고른 쪽만 새 PDF 로 복사 */
  function extract(pageNumbers) {
    return PDFDocument.create().then(function (out) {
      var idx = pageNumbers.map(function (n) { return n - 1; });   // pdf-lib 는 0부터 센다
      return out.copyPages(state.doc, idx).then(function (copied) {
        copied.forEach(function (page) { out.addPage(page); });
        try { out.setTitle(baseName(state.name)); } catch (e) { /* 제목은 없어도 그만 */ }
        return out.save();
      });
    });
  }

  /* ------------------------- 1단계 : 파일 넣기 ------------------------- */
  elPick.addEventListener('click', function () { elFile.click(); });
  elFile.addEventListener('change', function () {
    if (elFile.files && elFile.files[0]) readPdf(elFile.files[0]);
    elFile.value = '';   // 비워 두어야 같은 파일을 다시 골라도 change 가 일어난다
  });

  // 창 아무 데나 떨어뜨렸을 때 브라우저가 PDF 를 그냥 열어 버리는 것을 막는다
  ['dragover', 'drop'].forEach(function (ev) {
    window.addEventListener(ev, function (e) { e.preventDefault(); });
  });
  elDrop.addEventListener('dragover', function () { elDrop.classList.add('over'); });
  elDrop.addEventListener('dragleave', function () { elDrop.classList.remove('over'); });
  elDrop.addEventListener('drop', function (e) {
    elDrop.classList.remove('over');
    var f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) readPdf(f);
  });

  /* 파일이 바뀌면 앞 파일에서 고른 방법·쪽 번호·결과를 처음 상태로 되돌린다
     (앞 파일 기준으로 적은 쪽 번호가 새 파일에 그대로 남으면 엉뚱한 쪽이 나온다) */
  function resetChoices() {
    state.mode = 'merge';
    Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
      var on = b.getAttribute('data-mode') === 'merge';
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    elRanges.value = '';
    elPreview.innerHTML = '';
    elResult.innerHTML = '';
    elStepOut.classList.add('hidden');
    madeUrls.forEach(URL.revokeObjectURL); madeUrls = [];
    elRun.disabled = true;
  }

  function readPdf(file) {
    resetChoices();
    state.doc = null; state.total = 0; state.name = '';
    lockSteps(true);

    if (!/\.pdf$/i.test(file.name)) { showInfo('PDF 파일만 넣을 수 있습니다.', true); return; }

    showInfo('읽는 중… (큰 파일은 몇 초 걸립니다)', false);

    file.arrayBuffer().then(function (buf) {
      return PDFDocument.load(buf);
    }).then(function (doc) {
      state.doc = doc;
      state.name = file.name;
      state.total = doc.getPageCount();
      showInfo('<b>' + esc(file.name) + '</b> · 전체 <b>' + state.total + '쪽</b> · ' + size(file.size), false);
      lockSteps(false);
      elRanges.focus();
      update();
    })['catch'](function (err) {
      var msg = String(err && (err.name + ' ' + err.message));
      if (/Encrypt/i.test(msg)) {
        showInfo('🔒 <b>암호가 걸린 PDF</b> 라 열 수 없습니다. 암호를 푼 뒤 다시 넣어 주세요.', true);
      } else {
        showInfo('파일을 읽지 못했습니다. PDF 가 맞는지 확인해 주세요.<br><small>' + esc(msg) + '</small>', true);
      }
      lockSteps(true);
    });
  }

  function showInfo(html, bad) {
    elInfo.innerHTML = html;
    elInfo.className = 'info' + (bad ? ' bad' : '');
    elInfo.classList.remove('hidden');
  }
  function lockSteps(locked) {
    elStep2.setAttribute('aria-disabled', locked ? 'true' : 'false');
    elStep3.setAttribute('aria-disabled', locked ? 'true' : 'false');
    if (locked) { elStepOut.classList.add('hidden'); elRun.disabled = true; }
  }

  /* ------------------------- 2단계 : 방법 고르기 ------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
        b.classList.remove('on'); b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('on'); btn.setAttribute('aria-selected', 'true');
      state.mode = btn.getAttribute('data-mode');
      update();
    });
  });

  /* ------------------------- 3단계 : 쪽 번호 ------------------------- */
  elRanges.addEventListener('input', update);
  elRanges.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !elRun.disabled) run();
  });

  function update() {
    if (!state.doc) return;
    var p = parseRanges(elRanges.value, state.total);
    elRun.disabled = !p.ok;

    if (!elRanges.value.trim()) { elPreview.innerHTML = ''; return; }

    if (p.errors.length) {
      elPreview.innerHTML = '<span class="bad">✗ ' + p.errors.map(esc).join('<br>✗ ') + '</span>';
      return;
    }
    if (state.mode === 'merge') {
      var list = p.pages.slice(0, 30).join(', ') + (p.pages.length > 30 ? ' …' : '');
      elPreview.innerHTML = '<span class="good">✓ ' + p.pages.length + '쪽을 뽑아 파일 1개로 만듭니다.</span>' +
                            '<br>뽑을 쪽 : ' + list;
    } else {
      elPreview.innerHTML = '<span class="good">✓ 파일 ' + p.ranges.length + '개로 나눕니다.</span><ul>' +
        p.ranges.map(function (r) {
          return '<li>' + r.text + '쪽 <small>(' + (r.to - r.from + 1) + '쪽)</small> → ' +
                 esc(outName(p, 'split', r)) + '</li>';
        }).join('') + '</ul>';
    }
  }

  /* ------------------------- 만들기 ------------------------- */
  elRun.addEventListener('click', run);

  function run() {
    var p = parseRanges(elRanges.value, state.total);
    if (!p.ok) return;

    elRun.disabled = true; elRun.textContent = '만드는 중…';
    madeUrls.forEach(URL.revokeObjectURL); madeUrls = [];
    elResult.innerHTML = '';

    var jobs = state.mode === 'merge'
      ? [{ pages: p.pages, name: outName(p, 'merge'),
           label: p.ranges.map(function (r) { return r.text; }).join(', ') + '쪽' }]
      : p.ranges.map(function (r) {
          var pages = [];
          for (var n = r.from; n <= r.to; n++) pages.push(n);
          return { pages: pages, name: outName(p, 'split', r), label: r.text + '쪽' };
        });

    // 한 번에 하나씩 차례로 만든다(큰 파일에서 메모리가 몰리지 않게)
    var done = [];
    jobs.reduce(function (chain, job) {
      return chain.then(function () {
        return extract(job.pages).then(function (bytes) {
          var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          madeUrls.push(url);
          done.push({ url: url, name: job.name, label: job.label,
                      count: job.pages.length, size: bytes.length });
        });
      });
    }, Promise.resolve()).then(function () {
      showResult(done);
    })['catch'](function (err) {
      elResult.innerHTML = '<p class="bad">만들지 못했습니다 : ' + esc(String(err && err.message)) + '</p>';
      elStepOut.classList.remove('hidden');
    }).then(function () {
      elRun.disabled = false; elRun.textContent = 'PDF 만들기';
    });
  }

  function showResult(list) {
    var html = list.map(function (f, i) {
      return '<div class="line">' +
        '<span class="name">' + esc(f.name) +
        '<small>' + f.label + ' · ' + f.count + '쪽 · ' + size(f.size) + '</small></span>' +
        '<a class="btn" download="' + esc(f.name) + '" href="' + f.url + '" data-i="' + i + '">내려받기</a>' +
        '</div>';
    }).join('');

    if (list.length > 1) {
      html += '<div class="all"><button type="button" class="btn sub" id="allBtn">전체 ' +
              list.length + '개 받기</button>' +
              ' <small>브라우저가 「여러 파일 내려받기」를 물으면 허용해 주세요.</small></div>';
    }
    elResult.innerHTML = html;
    elStepOut.classList.remove('hidden');
    elStepOut.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    var all = $('allBtn');
    if (all) all.addEventListener('click', function () {
      var links = elResult.querySelectorAll('a[download]');
      Array.prototype.forEach.call(links, function (a, i) {
        setTimeout(function () { a.click(); }, i * 400);   // 너무 빨리 부르면 브라우저가 뒤엣것을 무시한다
      });
    });
  }

  /* 잔 도구 */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function size(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  // 검사용으로 밖에서 부를 수 있게 열어 둔다
  window.PdfSplit = { parseRanges: parseRanges, state: state };
})();
