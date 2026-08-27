/* 한글 글꼴(나눔고딕 **Bold**) 준비.
   ① 화면 미리보기 — `@font-face` 로 심어 canvas 로 글자 폭을 잴 수 있게 한다
   ② PDF — 같은 글꼴의 바이트를 pdf-lib 에 끼워 넣는다
   둘이 «같은 파일» 을 쓰기 때문에 미리보기와 인쇄물의 글자 폭이 같아진다.

   ⚠ **굵은 글꼴이다**(2026-08-26 사용자 지시). 라벨은 노란 바탕에 작게 인쇄되어
     가는 글씨가 흐리게 보인다. Regular 로 되돌리지 말 것.
   ⚠ CSS 의 `font-weight:bold` 로 굵게 하지 않는다 — 그것은 브라우저가 «흉내낸» 굵기여서
     글자 폭이 조금 넓어지고, 그러면 **미리보기와 PDF 의 글자 폭이 어긋난다.**
     그래서 글꼴 파일 자체가 Bold 이고 굵기 지정은 하지 않는다(weight 는 normal 로 심는다).
   ⚠ 글꼴 파일은 `js/vendor/nanumgothic-bold.font.js` 안에 base64 로 들어 있다(5.3MB).
     .ttf 를 그대로 두고 fetch 로 읽으면 «더블클릭으로 열었을 때»(file://)
     브라우저가 막아 버린다. 그래서 글자로 적어 두었다.
   ⚠ 이 파일은 화면이 다 그려진 «뒤에» 불러온다 — 처음 화면이 느려지지 않게. */

window.KFont = (() => {
  const SRC = 'js/vendor/nanumgothic-bold.font.js';
  const FAMILY = 'CableLabelKR';
  let promise = null;
  let bytes = null;

  function decode(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** 글꼴을 (처음 한 번만) 불러온다. 끝나면 화면 글꼴로도 심는다. */
  function load() {
    if (promise) return promise;
    promise = new Promise((ok, no) => {
      if (window.NANUM_BOLD_B64) return ok();
      const s = document.createElement('script');
      s.src = SRC;
      s.onload = () => ok();
      s.onerror = () => no(new Error('한글 글꼴을 찾지 못했습니다 (' + SRC + ')'));
      document.head.appendChild(s);
    }).then(async () => {
      bytes = decode(window.NANUM_BOLD_B64);
      // 화면에서도 같은 글꼴로 재려면 브라우저에 심어야 한다.
      // ⚠ weight 를 'normal' 로 심는다 — 'bold' 로 심으면 브라우저가 «이미 굵은 글꼴을
      //   한 번 더» 굵게 흉내내어 글자 폭이 넓어지고 PDF 와 어긋난다.
      if (window.FontFace && document.fonts) {
        const ff = new FontFace(FAMILY, bytes.buffer.slice(0), { weight: 'normal' });
        await ff.load();
        document.fonts.add(ff);
      }
      return bytes;
    });
    return promise;
  }

  return {
    family: FAMILY,
    load,
    /** 이미 준비됐는지 (준비 전에는 미리보기가 시스템 글꼴로 대충 그린다) */
    ready: () => !!bytes,
    bytes: () => bytes,
  };
})();
