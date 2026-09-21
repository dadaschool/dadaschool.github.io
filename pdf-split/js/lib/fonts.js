/* 한글 글자를 PDF 에 «써 넣을» 때 쓰는 글꼴.
   ⚠ pdf-lib 이 기본으로 아는 글꼴 14종에는 한글이 없다. 그대로 쓰면 «WinAnsi cannot encode» 오류가 난다.
     그래서 나눔고딕(SIL OFL 1.1)을 폴더에 넣고 fontkit 으로 끼워 넣는다.

   🔴 **`subset: true` 를 쓰지 말 것** (2026-08-26 고침 · 그 전까지 여기에는
      «반드시 subset:true 로 넣을 것» 이라고 **거꾸로** 적혀 있었다)
     그렇게 넣으면 **한글 글자 대부분이 빈칸으로 인쇄된다.** 이 글꼴로 실제로 재어 본 것 :
       `거제중` → `거` 만 · `USB LAN` → `U`·`L` 만 · `전원` → `원` 만 (`3쪽` 은 멀쩡)
     까닭 : 한글 글자는 글꼴 안에서 «자모를 조합한 글리프(composite)» 다.
     pdf-lib 의 부분집합 만들기는 조합 글리프를 넣을 때 그 «부품» 까지 끌어들이는데,
     그만큼 번호가 밀리는 것을 셈에 넣지 않아 **글자와 그림이 어긋난다.**
     조합이 아닌 라틴 글자(U·L)와 운 좋은 몇 글자는 살아남는다 — 그래서
     «되는 것처럼 보이는» 것이 더 위험하다.
     🚨 **PDF 에서 글자를 «뽑아 보는» 검사로는 절대 잡히지 않는다** — 글자는 파일 안에
       멀쩡히 들어 있고 좌표도 맞다. 안 보이는 것은 **그림**뿐이다.
       그래서 `tools/검사/verify_ink.py` 가 **300dpi 로 그려 글자마다 검은 점을 센다.**
       그 검사는 이 파일에서 subset 값을 읽어 쓰므로, 누가 다시 `true` 로 바꾸면 바로 잡아낸다.
     ⚠ 대가로 결과 PDF 에 글꼴이 **한 번** 들어간다(실측 **+732KB** · 압축되어 2MB 가 아니다).
       쪽수·원본 크기와 무관하게 고정이고, 글꼴은 문서에 하나만 들어간다.
       **글자가 안 보이는 파일은 아무리 작아도 쓸 데가 없다** — 그래서 크기를 내주었다.
     ⚠ 같은 사고를 겪은 `cable-label/js/pdf.js` 도 `subset: false` 다. */

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
  return pdfDoc.embedFont(ttf, { subset: false });  // ⚠ true 로 바꾸지 말 것 — 위 주석을 볼 것
}

/** 글자에 한글(또는 아스키 밖의 글자)이 섞였는지 — 섞이지 않았으면 기본 글꼴로 충분하다 */
export function needsKorean(text) {
  return /[^\x00-\x7F]/.test(String(text || ''));
}
