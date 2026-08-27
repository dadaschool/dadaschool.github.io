/* 원본 파일(스캔) 읽기 — 그림(PNG·JPG)과 스캔 PDF 를 픽셀로 바꿔 준다.

   🔴 **PDF 를 읽는데 pdf.js 를 쓰지 않는다.**
     복사기가 만든 스캔 PDF 는 «JPEG 사진 한 장» 을 그대로 품고 있다. 그래서 파일 안에서
     JPEG 를 찾아 꺼내 브라우저에게 맡기면 끝이다(브라우저는 JPEG 를 스스로 안다).
     pdf.js 를 넣으면 400KB + 워커 1.4MB 가 붙고, 4.x 는 ES 모듈이라
     **`index.html` 더블클릭 실행이 깨진다**(`pdf-split`·`pdf-worksheet` 가 그래서 서버가 필요하다).
     이 앱은 더블클릭으로 열리는 것을 지킨다.
   ⚠ 그 대신 **JPEG 가 아닌 PDF 는 못 읽는다**(글자로 그린 PDF·Flate 로 눌린 그림).
     그때는 «그림으로 주세요» 라고 분명히 말한다 — 엉뚱한 것을 읽는 것보다 낫다.
   ⚠ JPEG 안에는 «작은 미리보기 그림» 이 또 들어 있을 수 있다. 그래서 찾은 것 중
     **가장 큰 것부터** 열어 본다.

   ── 종이 크기를 어떻게 아나 ────────────────────────────────────────
   스캔 그림에는 «몇 mm 인가» 가 적혀 있지 않다(PDF 안에는 있지만 그것을 읽으려면
   PDF 를 제대로 파싱해야 한다). 그래서 **가로세로 비율로 A4 방향을 짐작하고**
   화면에서 고칠 수 있게 했다. 라벨 시트는 거의 언제나 A4 다.                     */

window.Source = (() => {
  const A4 = { long: 297, short: 210 };

  /** PDF 바이트에서 JPEG 를 꺼낸다 (큰 것부터) */
  function jpegsIn(buf) {
    const b = new Uint8Array(buf);
    const spans = [];
    for (let i = 0; i < b.length - 3; i++) {
      if (b[i] !== 0xFF || b[i + 1] !== 0xD8 || b[i + 2] !== 0xFF) continue;
      // 이 자리에서 시작하는 JPEG 의 끝(FFD9)을 찾는다
      for (let j = i + 3; j < b.length - 1; j++) {
        if (b[j] === 0xFF && b[j + 1] === 0xD9) { spans.push([i, j + 2]); i = j + 1; break; }
      }
    }
    return spans
      .map(([a, z]) => b.subarray(a, z))
      .sort((p, q) => q.length - p.length);
  }

  /**
   * 파일 하나를 그림으로 읽는다.
   * @returns {Promise<{bitmap:ImageBitmap, kind:'image'|'pdf'}>}
   */
  async function load(file) {
    const name = (file.name || '').toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';

    if (!isPdf) {
      try {
        return { bitmap: await createImageBitmap(file), kind: 'image' };
      } catch (e) {
        throw new Error('그림을 열지 못했습니다. PNG·JPG 파일인지 확인해 주세요.');
      }
    }

    const list = jpegsIn(await file.arrayBuffer());
    if (!list.length) {
      throw new Error('이 PDF 안에서 스캔 사진을 찾지 못했습니다. 스캔을 그림(PNG·JPG)으로 저장해서 넣어 주세요.');
    }
    for (const bytes of list) {
      try {
        // subarray 는 원본 버퍼를 함께 들고 있으므로 잘라서 넘긴다
        const copy = bytes.slice();
        return { bitmap: await createImageBitmap(new Blob([copy], { type: 'image/jpeg' })), kind: 'pdf' };
      } catch (e) { /* 다음 것 */ }
    }
    throw new Error('PDF 안의 사진을 열지 못했습니다. 스캔을 그림(PNG·JPG)으로 저장해서 넣어 주세요.');
  }

  /** 그림 비율로 A4 방향을 짐작한다 */
  function guessPaper(bitmap, deg) {
    const w = (deg % 180 === 0) ? bitmap.width : bitmap.height;
    const h = (deg % 180 === 0) ? bitmap.height : bitmap.width;
    return w >= h ? { w: A4.long, h: A4.short } : { w: A4.short, h: A4.long };
  }

  /**
   * 그림을 «종이 좌표» 로 펴서 픽셀을 꺼낸다.
   * @param {ImageBitmap} bitmap
   * @param {number} deg      0·90·180·270 — 그림을 돌릴 각도
   * @param {{w:number,h:number}} paper  종이 크기 (mm)
   * @param {number} mmPerPx  픽셀 하나를 몇 mm 로 볼지 (0.25 면 A4 가로가 1188×840)
   * @returns {{imageData:ImageData, canvas:HTMLCanvasElement}}
   */
  function rasterize(bitmap, deg, paper, mmPerPx) {
    const cw = Math.max(1, Math.round(paper.w / mmPerPx));
    const ch = Math.max(1, Math.round(paper.h / mmPerPx));
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cw, ch);
    g.save();
    g.translate(cw / 2, ch / 2);
    g.rotate((deg * Math.PI) / 180);
    // 돌린 뒤의 «그리는 칸» — 90·270 도면 가로세로가 바뀐다
    const bw = (deg % 180 === 0) ? cw : ch;
    const bh = (deg % 180 === 0) ? ch : cw;
    g.drawImage(bitmap, -bw / 2, -bh / 2, bw, bh);
    g.restore();
    return { imageData: g.getImageData(0, 0, cw, ch), canvas: cv };
  }

  return { load, guessPaper, rasterize, jpegsIn, A4 };
})();
