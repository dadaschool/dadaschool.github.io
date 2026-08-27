/* 라벨 시트의 «치수» — 이 파일이 치수의 단일 출처다.
   화면 미리보기(js/preview.js)와 PDF 만들기(js/pdf.js)가 모두 여기서 값을 가져온다.
   ⚠ 한쪽만 고치면 «미리보기와 인쇄가 다르다» 가 된다. 반드시 이 파일만 고칠 것.

   ── 치수를 어떻게 알아냈나 ────────────────────────────────────────────
   선생님이 스캔해 주신 «빈 라벨 시트» PDF(A4 가로)에서 노란 라벨 30장을
   하나하나 찾아 재었다. 열 3개 × 쌍 5개 × 라벨 2장 = 30장이고,
   30장의 평균으로 아래 값을 정했다(오차 ±0.5mm — 스캐너가 종이를 조금
   비뚤게 먹은 것까지 감안한 값이다).

   ── 라벨 한 장의 모양 ────────────────────────────────────────────────
   ┌──────────────┬───────────────────────────┐
   │              │  꼬리(tail) — 케이블을 감는 띠  │
   │  머리(head)   └───────────────────────────┘
   │  글자를 쓰는 칸  │
   └──────────────┘
   머리 36.8 × 26.1mm · 꼬리 47.0 × 10.0mm.
   꼬리는 머리의 «바깥쪽 가장자리»에서 1.8mm 들어간 자리에 붙어 있다.

   ── 두 장이 서로 맞물려 있다 ──────────────────────────────────────────
   한 쌍의 두 번째 라벨은 첫 번째를 «180° 돌린» 모양이다(머리가 오른쪽,
   꼬리가 아래쪽). 그래서 두 장이 이가 맞물리듯 들어가 종이를 아끼게 되어 있다.
   ⚠ 그래도 «글자는 두 장 모두 똑바로» 쓴다 — 선생님이 손으로 쓴 견본이 그랬다.

   ── 머리 안에 글자가 두 번 들어가는 까닭 ────────────────────────────────
   머리를 가로로 반 접어 케이블에 붙이면 앞면·뒷면이 생긴다. 그래서 위쪽 반과
   아래쪽 반에 «같은 글자»를 한 번씩 넣는다(견본도 그렇게 손으로 썼다).
   글자는 각 반의 «가운데»에 놓는다 — 머리 위에서 h/4 와 3h/4 자리다.            */

window.SHEETS = {
  'cabletie-30': {
    key:  'cabletie-30',
    name: '케이블타이 라벨 · A4 가로 · 30장 (3열 × 5쌍)',
    page: { w: 297, h: 210 },                 // A4 가로 (mm)

    head: { w: 36.8, h: 26.1 },               // 글자를 쓰는 칸
    tail: { w: 47.0, h: 10.0, inset: 1.8 },   // 케이블을 감는 띠

    cols: 3,  colPitch: 98.7,  x0: 6.9,       // 열 3개 · 왼쪽 여백 6.9mm
    pairs: 5, pairPitch: 40.3, y0: 5.1,       // 한 열에 쌍 5개

    // 쌍의 두 번째 라벨(180° 돌린 것)의 머리가 첫 번째 머리에서 얼마나 떨어져 있나
    inner: { dx: 46.9, dy: 13.95 },
  },
};

/** 시트 하나의 라벨 칸 목록을 만든다.
 *  돌려주는 값 : [{ no, col, pair, side, head:{x,y,w,h}, tail:{x,y,w,h}|null }, …]
 *  - no   : 1 부터. 왼쪽 열을 위에서 아래로 다 채운 뒤 다음 열로 간다.
 *  - side : 'L' = 머리가 왼쪽(꼬리는 오른쪽 위) · 'R' = 180° 돌린 것(머리가 오른쪽, 꼬리는 왼쪽 아래)
 *  좌표는 모두 «종이 왼쪽 위를 (0,0) 으로 보는 mm» 다.
 *
 *  ⚠ `spec.inner` 가 없으면 «맞물린 두 번째 라벨이 없는» 보통 격자 시트다(한 칸에 하나).
 *    `spec.tail.w` 가 0 이면 꼬리가 없는 네모난 라벨이다.
 *    둘 다 `js/detect.js` 가 알아낸 다른 시트를 담을 수 있게 열어 둔 것이다.        */
window.slotsOf = function slotsOf(spec) {
  const out = [];
  const hasTail = !!(spec.tail && spec.tail.w > 0 && spec.tail.h > 0);
  let no = 1;
  for (let c = 0; c < spec.cols; c++) {
    for (let p = 0; p < spec.pairs; p++) {
      const bx = spec.x0 + spec.colPitch * c;
      const by = spec.y0 + spec.pairPitch * p;

      // ① 머리가 왼쪽 : 꼬리가 머리 오른쪽에, 머리 위에서 inset 만큼 내려온 자리에 붙는다
      out.push({
        no: no++, col: c, pair: p, side: 'L',
        head: { x: bx, y: by, w: spec.head.w, h: spec.head.h },
        tail: hasTail
          ? { x: bx + spec.head.w, y: by + spec.tail.inset, w: spec.tail.w, h: spec.tail.h }
          : null,
      });

      // ② 180° 돌린 것 : 머리가 오른쪽, 꼬리는 머리 왼쪽 «아래»에 붙는다
      if (!spec.inner) continue;
      const hx = bx + spec.inner.dx, hy = by + spec.inner.dy;
      out.push({
        no: no++, col: c, pair: p, side: 'R',
        head: { x: hx, y: hy, w: spec.head.w, h: spec.head.h },
        tail: hasTail
          ? { x: hx - spec.tail.w, y: hy + spec.head.h - spec.tail.inset - spec.tail.h,
              w: spec.tail.w, h: spec.tail.h }
          : null,
      });
    }
  }
  return out;
};

/** 한 장에 들어가는 라벨 수 */
window.perSheet = function perSheet(spec) {
  return spec.cols * spec.pairs * (spec.inner ? 2 : 1);
};

/* ── 알아낸 규격 보관 ────────────────────────────────────────────
   `js/detect.js` 가 원본 파일에서 알아낸 규격을 이 브라우저에 저장한다.
   ⚠ 저장하는 것은 «치수 숫자» 뿐이다 — 스캔 그림은 저장하지 않는다.        */
window.SheetStore = (() => {
  const KEY = 'cable-label.sheets.v1';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  return {
    /** 기본 규격 + 저장해 둔 규격을 합쳐 돌려준다 */
    all() { return Object.assign({}, window.SHEETS, read()); },
    save(spec) {
      const o = read();
      o[spec.key] = spec;
      write(o);
    },
    remove(key) { const o = read(); delete o[key]; write(o); },
    /** 저장해 둔 «알아낸 규격» 만 (기본 규격은 빼고) — 작업 파일에 담을 때 쓴다 */
    customOnly() { return read(); },
    /** 이름이 겹치지 않는 열쇠를 만든다 */
    freeKey(base) {
      const all = this.all();
      let k = base, n = 2;
      while (all[k]) k = base + '-' + n++;
      return k;
    },
    isCustom(key) { return !window.SHEETS[key]; },
  };
})();
