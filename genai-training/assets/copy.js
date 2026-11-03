/* 요청 상자(.code)의 [복사] 단추.
   바이브코딩 연수자료는 문서마다 같은 스크립트를 넣었는데, 여기서는 한 파일로 모았다.
   더블클릭(file://)으로 열어도 돌도록 모듈이 아닌 보통 스크립트로 둔다. */
document.querySelectorAll('.code').forEach(function (box) {
  var btn = box.querySelector('button');
  var pre = box.querySelector('pre');
  if (!btn || !pre) return;
  btn.addEventListener('click', function () {
    var text = pre.innerText;
    function ok() {
      btn.textContent = '복사됨 ✓';
      btn.classList.add('done');
      setTimeout(function () { btn.textContent = '복사'; btn.classList.remove('done'); }, 1600);
    }
    // 학교 PC 의 낡은 브라우저나 file:// 에서는 clipboard API 가 막힐 수 있어 예전 방식으로 한 번 더 시도한다
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { btn.textContent = '복사 실패'; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else { fallback(); }
  });
});
