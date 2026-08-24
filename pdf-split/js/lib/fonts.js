/* 한글 글자를 PDF 에 «써 넣을» 때 쓰는 글꼴.
   ⚠ pdf-lib 이 기본으로 아는 글꼴 14종에는 한글이 없다. 그대로 쓰면 «WinAnsi cannot encode» 오류가 난다.
     그래서 나눔고딕(SIL OFL 1.1)을 폴더에 넣고 fontkit 으로 끼워 넣는다.
   ⚠ 반드시 subset:true 로 넣을 것 — 쓴 글자만 담긴다. 안 그러면 결과 PDF 마다 2MB 가 붙는다. */

const URL_TTF = new URL('../vendor/NanumGothic-Regular.ttf', import.meta.url).href;
let bytes = null;      // 한 번 받아 두고 계속 쓴다

/** 글꼴 파일을 (처음 한 번만) 내려받는다 */
export async function loadKorean(onProgress) {
  if (bytes) return bytes;
  onProgress?.('한글 글꼴을 준비하는 중…');
  const res = await fetch(URL_TTF);
  if (!res.ok) throw new Error('한글 글꼴을 찾지 못했습니다 (js/vendor/NanumGothic-Regular.ttf)');
  bytes = new Uint8Array(await res.arrayBuffer());
  return bytes;
}

/** pdf-lib 문서에 한글 글꼴을 끼워 넣고 돌려준다 */
export async function embedKorean(pdfDoc, onProgress) {
  const ttf = await loadKorean(onProgress);
  pdfDoc.registerFontkit(fontkit);                 // 전역 fontkit (js/vendor/fontkit.umd.min.js)
  return pdfDoc.embedFont(ttf, { subset: true });
}

/** 글자에 한글(또는 아스키 밖의 글자)이 섞였는지 — 섞이지 않았으면 기본 글꼴로 충분하다 */
export function needsKorean(text) {
  return /[^\x00-\x7F]/.test(String(text || ''));
}
