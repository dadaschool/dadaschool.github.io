/* 글자를 라벨 칸에 «어떻게 앉힐지» 정하는 규칙 — 미리보기와 PDF 가 같은 그림이 되도록
   이 규칙을 한곳에 모아 두었다.

   ⚠ 미리보기(화면)와 PDF 는 글자 폭을 재는 방법이 서로 다르다
     (화면은 canvas 의 measureText, PDF 는 pdf-lib 의 widthOfTextAtSize).
     그래서 «재는 일» 만 밖에서 받아 오고(`measure`), 크기를 정하는 셈은 여기서 한다.
     두 곳이 같은 글꼴(나눔고딕)을 쓰므로 결과도 같아진다.

   ⚠ `BASE` 는 «글자의 가운데가 기준선에서 얼마나 위인가» 다.
     한글 글자는 기준선 아래로도 조금 내려오므로(받침) 기준선을 칸 가운데에 두면
     글자가 위로 떠 보인다. 실제로 PDF 를 만들어 잉크 위치를 재어 맞춘 값이다.
     이 값을 바꾸면 «미리보기와 인쇄가 어긋난다» 가 아니라 «둘 다 함께» 움직인다. */

window.LabelText = {
  pad:  { x: 2.0, y: 1.4 },   // 칸 안쪽 여백 (mm)
  BASE: 0.32,                 // 기준선 위치 계산용 — 글자 가운데는 기준선보다 0.32em 위
  GLYPH: 0.88,                // 글자 한 줄이 차지하는 높이 (em)

  /** 이 칸에 들어갈 수 있는 가장 큰 글자 크기(mm)를 찾는다.
   * @param {string}   text     찍을 글자
   * @param {number}   boxW     쓸 수 있는 폭 (mm)
   * @param {number}   boxH     쓸 수 있는 높이 (mm · 머리의 «반» 칸)
   * @param {number}   maxMm    선생님이 정한 최대 크기 (mm)
   * @param {function} measure  (글자, 크기mm) → 폭mm
   */
  fitSize(text, boxW, boxH, maxMm, measure) {
    const usableW = boxW - this.pad.x * 2;
    const usableH = boxH - this.pad.y * 2;
    // 높이로 먼저 자르고(글자 한 줄이 0.88em 이므로), 그 크기에서 폭을 맞춰 줄여 간다
    let size = Math.min(maxMm, usableH / this.GLYPH);
    if (!text) return size;
    for (let i = 0; i < 60; i++) {
      const w = measure(text, size);
      if (w <= usableW || size <= 1.2) break;
      size = Math.max(1.2, size * Math.min(0.96, (usableW / w) * 0.995));
    }
    return size;
  },

  /** 머리 칸 하나에 글자를 «두 번»(위·아래 반칸) 넣을 자리를 계산한다.
   *  돌려주는 값 : [{ x, w, baseline, size, rot }, …]  (mm · 종이 왼쪽 위 기준)
   *  - x        : 글자가 «차지하는 칸» 의 왼쪽 끝 (거꾸로 찍는 줄도 마찬가지)
   *  - w        : 글자 폭
   *  - baseline : 글자 기준선의 y
   *  - rot      : 180 이면 그 줄만 거꾸로 찍는다
   *
   *  ⚠ 돌려 찍는 줄도 «차지하는 칸» 을 [x, x+w] 로 맞춰 두었다.
   *    그래야 그리는 쪽(SVG · PDF)이 돌리는 중심을 서로 달리 잡아도 결과가 같다
   *    (SVG 는 칸의 가운데를 중심으로, PDF 는 오른쪽 끝을 시작점으로 돌린다).
   *
   * @param {object} head  { x, y, w, h }
   * @param {object} opt   { align:'center'|'left', both:boolean,
   *                         which:'top'|'bottom'|'middle', flipSecond:boolean, maxMm, measure }
   *
   *  ⚠ `both` 이 거짓일 때 `which` :
   *    `top`·`bottom` = 반 칸의 가운데 (접는 깃발 라벨에서 한쪽만 쓸 때)
   *    `middle`       = **칸 전체의 가운데** — 접지 않는 보통 네모 라벨(주소 라벨 등)용.
   *    `middle` 은 글자를 반 칸이 아니라 칸 전체 높이에 맞추므로 더 크게 쓸 수 있다.
   */
  place(text, head, opt) {
    const halfH = head.h / 2;
    const whole = !opt.both && opt.which === 'middle';
    // 접지 않는 라벨은 칸 전체 높이를 쓴다
    const boxH = whole ? head.h : halfH;
    const size = this.fitSize(text, head.w, boxH, opt.maxMm, opt.measure);
    const w = opt.measure(text, size);
    const x = opt.align === 'left'
      ? head.x + this.pad.x
      : head.x + (head.w - w) / 2;

    if (whole) {
      const center = head.y + head.h / 2;
      return [{ size, w, x, rot: 0, baseline: center + this.BASE * size }];
    }

    const rows = opt.both ? [0, 1] : [opt.which === 'bottom' ? 1 : 0];
    return rows.map((r) => {
      const center = head.y + halfH * r + halfH / 2;      // 그 반칸의 가운데
      const flip = !!opt.flipSecond && r === 1;
      return {
        size, w, x, rot: flip ? 180 : 0,
        // 거꾸로 찍는 줄은 기준선도 반대쪽으로 옮겨야 글자가 칸 가운데에 온다
        baseline: flip ? center - this.BASE * size : center + this.BASE * size,
      };
    });
  },
};
