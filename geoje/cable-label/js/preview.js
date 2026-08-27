/* 화면 미리보기 — 종이 한 장을 SVG 로 그린다.
   viewBox 를 «mm 그대로»(0 0 297 210) 두었으므로 코드 안의 숫자는 전부 mm 다.
   그래서 PDF 만들기(js/pdf.js)와 같은 숫자를 쓰고, 어긋날 곳이 없다.

   ⚠ 글자 폭은 canvas 로 잰다. 글꼴이 아직 안 왔으면 시스템 글꼴로 재므로
     크기가 조금 다를 수 있다 — 글꼴이 오면 app.js 가 다시 그린다.
   ⚠ 칸을 누르면 「시작 칸」 이 그 번호로 바뀐다(onPick). */

window.Preview = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');

  /** 화면에서 글자 폭 재기 (mm) — 1mm 를 10px 로 보고 재서 10 으로 나눈다 */
  function measure(text, sizeMm) {
    const fam = window.KFont && KFont.ready() ? KFont.family : 'Malgun Gothic';
    ctx.font = `${sizeMm * 10}px "${fam}", "맑은 고딕", sans-serif`;
    return ctx.measureText(text).width / 10;
  }
  window.previewMeasure = measure;

  function el(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * @param {HTMLElement} host   그릴 자리
   * @param {object} spec        시트 규격 (window.SHEETS 의 하나)
   * @param {Array}  cells       이 장의 칸 내용 (길이 = 칸 수 · 빈 칸은 null)
   * @param {object} opt         { off:{x,y}, outline, align, both, which, flipSecond, maxMm, onPick, startNo }
   */
  function draw(host, spec, cells, opt) {
    host.textContent = '';
    const svg = el('svg', {
      viewBox: `0 0 ${spec.page.w} ${spec.page.h}`,
      class: 'sheet', role: 'img',
      'aria-label': `라벨 시트 미리보기 (${cells.filter(Boolean).length}장 채움)`,
    });
    // 종이
    svg.appendChild(el('rect', { x: 0, y: 0, width: spec.page.w, height: spec.page.h, fill: '#fff' }));

    const slots = slotsOf(spec);
    slots.forEach((s, i) => {
      const t = cells[i];
      const g = el('g', { class: 'slot' + (t ? ' filled' : '') + (opt.startNo === s.no ? ' start' : '') });

      // 라벨 모양 — 머리와 꼬리 (꼬리가 없는 네모난 라벨도 있다)
      const ox = opt.off.x, oy = opt.off.y;
      if (s.tail) {
        g.appendChild(el('rect', { x: s.tail.x + ox, y: s.tail.y + oy, width: s.tail.w, height: s.tail.h,
                                   rx: 0.8, class: 'tail' }));
      }
      g.appendChild(el('rect', { x: s.head.x + ox, y: s.head.y + oy, width: s.head.w, height: s.head.h,
                                 rx: 0.8, class: 'head' }));
      // 배경 그림 — 이미 «칸 비율로 잘라 둔» 그림이라 그냥 칸 자리에 붙인다(js/bg.js)
      if (t && opt.bgUrl) {
        const im = el('image', {
          x: s.head.x + ox, y: s.head.y + oy, width: s.head.w, height: s.head.h,
          preserveAspectRatio: 'none',
        });
        im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', opt.bgUrl);
        im.setAttribute('href', opt.bgUrl);
        g.appendChild(im);
      }
      // 반으로 접는 선
      g.appendChild(el('line', { x1: s.head.x + ox, y1: s.head.y + s.head.h / 2 + oy,
                                 x2: s.head.x + s.head.w + ox, y2: s.head.y + s.head.h / 2 + oy,
                                 class: 'fold' }));
      // 칸 번호
      g.appendChild(el('text', { x: s.head.x + 1.4 + ox, y: s.head.y + s.head.h - 1.4 + oy,
                                 class: 'no' }, String(s.no)));

      // 글자
      if (t) {
        const fam = window.KFont && KFont.ready() ? KFont.family : 'Malgun Gothic';
        const rows = LabelText.place(t, { x: s.head.x + ox, y: s.head.y + oy, w: s.head.w, h: s.head.h }, {
          align: opt.align, both: opt.both, which: opt.which,
          flipSecond: opt.flipSecond, maxMm: opt.maxMm, measure,
        });
        for (const r of rows) {
          const tx = el('text', {
            x: r.x, y: r.baseline, class: 'ink',
            'font-size': r.size,
            'font-family': `"${fam}", "맑은 고딕", sans-serif`,
            'text-anchor': 'start',
          }, t);
          // 거꾸로 찍는 줄 : 글자가 차지하는 칸의 «가운데» 를 중심으로 돌린다
          if (r.rot === 180) tx.setAttribute('transform', `rotate(180 ${r.x + r.w / 2} ${r.baseline})`);
          g.appendChild(tx);
        }
      }

      // 누르면 시작 칸이 된다
      const hit = el('rect', { x: s.head.x + ox, y: s.head.y + oy, width: s.head.w, height: s.head.h,
                               class: 'hit' });
      hit.appendChild(el('title', {}, `${s.no}번 칸 — 눌러서 여기부터 채우기`));
      hit.addEventListener('click', () => opt.onPick && opt.onPick(s.no));
      g.appendChild(hit);

      svg.appendChild(g);
    });

    // 윤곽선 인쇄 안내(테스트 인쇄를 켰을 때)
    if (opt.outline) {
      svg.appendChild(el('text', { x: spec.page.w / 2, y: spec.page.h - 1.5, class: 'memo',
                                   'text-anchor': 'middle', 'font-size': 3 },
        '윤곽선 함께 인쇄 — 빈 종이에 뽑아 라벨 시트와 겹쳐 보고 아래 「위치 미세조정」 으로 맞춥니다'));
    }
    host.appendChild(svg);
  }

  return { draw, measure };
})();
