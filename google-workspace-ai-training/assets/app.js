/* ============================================================
   구글 워크스페이스 + AI 활용 연수자료 공통 스크립트
   - .prompt 박스마다 '복사' 버튼을 붙이고, 누르면 <pre> 내용을 복사합니다.
   ============================================================ */
(function () {
  function copyText(text, done, fail) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  document.querySelectorAll('.prompt').forEach(function (box) {
    var pre = box.querySelector('pre');
    var bar = box.querySelector('.bar');
    if (!pre || !bar) return;
    var btn = bar.querySelector('button.copy');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy';
      btn.textContent = '복사';
      bar.appendChild(btn);
    }
    var label = bar.querySelector('.label');
    btn.setAttribute('aria-label', (label ? label.textContent.trim() + ' ' : '') + '복사');
    var timer;
    btn.addEventListener('click', function () {
      copyText(pre.innerText.replace(/\n$/, ''), function () {
        btn.textContent = '복사됨 ✓';
        btn.classList.add('done');
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.textContent = '복사';
          btn.classList.remove('done');
        }, 1600);
      }, function () {
        btn.textContent = '복사 실패 — 직접 선택해 복사하세요';
      });
    });
  });
})();
