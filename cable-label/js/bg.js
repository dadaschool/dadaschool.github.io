/* 라벨 «배경 그림» — 칸 크기에 저절로 맞춰 넣는다. (2026-08-26 사용자 지시 —
   *"라벨 배경으로 이미지를 넣을수는 없나? 이미지 사이즈는 자동맞춤으로"*)

   ── 어떻게 «자동 맞춤» 하나 ────────────────────────────────────────
   그림을 그대로 늘이면 찌그러진다. 그래서 **비율을 지키면서** 두 가지 중 하나로 맞춘다 :
     `cover`   — 칸을 꽉 채운다(넘치는 부분은 잘린다). 배경이니 보통 이쪽이 좋다.
     `contain` — 칸 안에 다 보이게 넣는다(남는 곳은 흰 여백). 로고·도장에 좋다.

   🔴 **칸 크기에 맞춘 그림을 «미리 만들어» 둔다**(`fitted`). 그래야 두 가지가 해결된다 :
     ① PDF 에서 잘라 넣을 방법이 없다 — pdf-lib 은 «오려내기(clip)» 를 쉽게 못 한다.
        칸 비율에 맞게 미리 잘라 두면 그냥 칸 자리에 그리면 끝이다.
     ② 미리보기와 PDF 가 **같은 그림**을 쓰게 된다(어긋날 자리가 없다).
   ⚠ 그래서 «칸 크기 · 맞춤 방식 · 흐리기» 가 바뀌면 다시 만든다(그때만 · 캐시를 둔다).

   ⚠ 원본은 **긴 쪽 1000px 로 줄여** 들고 있는다. 라벨 한 칸은 300dpi 로도 400~500px 이라
     그보다 큰 원본은 쓸 데가 없고, 작업 파일과 브라우저 저장칸만 무겁게 한다.
   ⚠ 흐리기(투명도)는 **흰 바탕에 겹쳐** 만든다 — 라벨지가 흰색이므로 인쇄 결과와 같아진다.
     PDF 에 투명도를 넣는 것보다 확실하다(프린터마다 투명도 처리가 다르다).                */

window.Bg = (() => {
  const MAX_SRC = 1000;                 // 원본을 줄일 긴 쪽 길이
  const DPI = 300;                      // 칸에 맞춰 만들 때의 눈금
  let src = null;                       // { url, w, h }  — 줄여 둔 원본 (dataURL)
  let cache = null;                     // { key, url, bytes }

  function has() { return !!src; }
  function source() { return src; }
  function clear() { src = null; cache = null; }

  /** dataURL 을 그림으로 되돌린다 */
  function toImage(url) {
    return new Promise((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => no(new Error('그림을 열지 못했습니다.'));
      im.src = url;
    });
  }

  /** 파일(또는 dataURL)을 배경 그림으로 삼는다 — 긴 쪽 1000px 로 줄여 둔다 */
  async function load(fileOrUrl) {
    let im;
    if (typeof fileOrUrl === 'string') {
      im = await toImage(fileOrUrl);
    } else {
      const bm = await createImageBitmap(fileOrUrl).catch(() => null);
      if (!bm) throw new Error('그림을 열지 못했습니다. PNG·JPG 파일인지 확인해 주세요.');
      im = bm;
    }
    const long = Math.max(im.width, im.height);
    const k = long > MAX_SRC ? MAX_SRC / long : 1;
    const w = Math.max(1, Math.round(im.width * k));
    const h = Math.max(1, Math.round(im.height * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(im, 0, 0, w, h);
    src = { url: cv.toDataURL('image/png'), w, h };
    cache = null;
    return src;
  }

  /** dataURL → 바이트 (pdf-lib 에 넣으려면 바이트가 필요하다) */
  function bytesOf(url) {
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /**
   * 칸 크기에 맞춘 그림을 만든다(같은 조건이면 다시 만들지 않는다).
   * @param {{w:number,h:number}} head  칸 크기 (mm)
   * @param {{fit:'cover'|'contain', opacity:number}} opt   opacity 는 0~100
   * @returns {Promise<{url:string, bytes:Uint8Array}|null>}
   */
  async function fitted(head, opt) {
    if (!src) return null;
    const fit = opt.fit === 'contain' ? 'contain' : 'cover';
    const op = Math.max(5, Math.min(100, +opt.opacity || 100));
    const key = `${head.w}x${head.h}|${fit}|${op}|${src.w}x${src.h}|${src.url.length}`;
    if (cache && cache.key === key) return cache;

    const cw = Math.max(8, Math.round((head.w / 25.4) * DPI));
    const ch = Math.max(8, Math.round((head.h / 25.4) * DPI));
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cw, ch);           // 라벨지는 흰색이다 — 그 위에 겹쳐 만든다

    const im = await toImage(src.url);
    const s = fit === 'cover'
      ? Math.max(cw / im.width, ch / im.height)     // 꽉 채우기 (넘치면 잘린다)
      : Math.min(cw / im.width, ch / im.height);    // 다 보이게 (여백이 생긴다)
    const dw = im.width * s, dh = im.height * s;
    g.globalAlpha = op / 100;
    g.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    g.globalAlpha = 1;

    const url = cv.toDataURL('image/png');
    cache = { key, url, bytes: bytesOf(url) };
    return cache;
  }

  return { load, clear, has, source, fitted, bytesOf, MAX_SRC };
})();
