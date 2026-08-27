/* PDF 만들기 — pdf-lib 로 «mm 좌표를 그대로» 찍는다.
   브라우저 인쇄(window.print)로 하지 않은 까닭 :
     라벨은 0.5mm 만 밀려도 글자가 칸 밖으로 나간다. 브라우저 인쇄는 여백·배율을
     프린터마다 다르게 손대므로 «화면과 같은 자리» 를 보장할 수 없다.
     PDF 는 mm 를 못 박아 넣으므로 어느 프린터에서 뽑아도 같다
     (인쇄 대화상자에서 배율을 «실제 크기 / 100%» 로 두는 것만 지키면 된다).

   ⚠ PDF 의 좌표는 «왼쪽 아래» 가 (0,0) 이고 y 가 위로 간다.
     이 앱은 전부 «왼쪽 위 기준 mm» 로 셈하므로 찍을 때 y 를 뒤집는다(`toPt`).
   ⚠ 한글은 나눔고딕을 끼워 넣어야 한다 — pdf-lib 기본 글꼴 14종에는 한글이 없다.

   🔴 **`subset: true` 를 쓰면 안 된다** (2026-08-26 · 이 앱을 만들면서 겪음)
     `pdf-split/js/lib/fonts.js` 에 «반드시 subset:true» 라고 적혀 있었지만,
     그렇게 넣으면 **글자 대부분이 빈칸으로 인쇄된다.**
     (👉 그 앱도 **정말 깨져 있었고** 2026-08-26 에 `subset: false` 로 고쳤다.
        이제 두 앱이 같다 — 그 주석을 근거로 이 파일을 «되돌리지» 말 것.)
       `거제중` → `거` 만 · `USB LAN` → `U`·`L` 만 · `전원` → `원` 만
     까닭 : 한글 글자는 글꼴 안에서 «자모를 조합한 글리프(composite)» 다.
     pdf-lib 의 부분집합 만들기는 조합 글리프를 넣을 때 그 «부품» 까지 끌어들이는데,
     그만큼 번호가 밀리는 것을 셈에 넣지 않아 **글자와 그림이 어긋난다.**
     한글이 아닌 글자(U·L)는 조합이 아니어서 몇 개는 살아남는다 — 그래서
     «되는 것처럼 보이는» 것이 더 위험하다.
     ⚠ 대가로 PDF 마다 글꼴이 통째로 붙는다(Bold 라 2.3MB — 라벨 한 판 뽑고 버리는 파일이라 괜찮다).
     ⚠ `tools/검사/verify_ink.py` 가 **실제로 인쇄될 잉크를 세어** 이 사고를 막는다 —
       누가 다시 `subset:true` 로 바꾸면 그 검사가 바로 잡아낸다. */

window.LabelPDF = (() => {
  const MM = 72 / 25.4;                       // mm → pt
  const mm = (v) => v * MM;

  /**
   * @param {object} spec    시트 규격
   * @param {Array}  pages   [[칸내용, …], …]  (js/parse.js 의 layout 결과)
   * @param {object} opt     { off:{x,y}, outline, align, both, which, flipSecond, maxMm, bgBytes }
   * @returns {Promise<Uint8Array>}
   */
  async function build(spec, pages, opt) {
    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

    const doc = await PDFDocument.create();
    doc.setTitle('라벨');
    doc.setCreator('라벨 만들기 (cable-label)');

    // 한글 글꼴 끼워 넣기
    const ttf = await KFont.load();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(ttf, { subset: false });   // ⚠ true 로 바꾸지 말 것 (위 주석)

    // pdf-lib 의 글자 폭으로 크기를 정한다(화면과 같은 글꼴이라 결과가 같다)
    const measure = (text, sizeMm) => font.widthOfTextAtSize(text, mm(sizeMm)) / MM;

    /* 배경 그림 — **한 번만** 끼우고 칸마다 그린다(칸마다 끼우면 파일이 칸 수만큼 커진다).
       ⚠ 이미 «칸 비율로 잘라 둔» 그림이라(js/bg.js) 칸 자리에 그리면 끝이다 —
         PDF 에서 오려내기(clip)를 하지 않아도 된다. */
    const bg = opt.bgBytes ? await doc.embedPng(opt.bgBytes) : null;

    const slots = slotsOf(spec);
    const W = mm(spec.page.w), H = mm(spec.page.h);
    const toPt = (yMm) => H - mm(yMm);        // 위 기준 mm → PDF 의 y

    for (const cells of pages) {
      const page = doc.addPage([W, H]);

      slots.forEach((s, i) => {
        const ox = opt.off.x, oy = opt.off.y;

        // ① 테스트 인쇄용 윤곽선 (빈 종이에 뽑아 라벨 시트와 겹쳐 본다)
        if (opt.outline) {
          const line = { borderColor: rgb(0.75, 0.78, 0.85), borderWidth: 0.4 };
          if (s.tail) {
            page.drawRectangle({ x: mm(s.tail.x + ox), y: toPt(s.tail.y + oy + s.tail.h),
                                 width: mm(s.tail.w), height: mm(s.tail.h), ...line });
          }
          page.drawRectangle({ x: mm(s.head.x + ox), y: toPt(s.head.y + oy + s.head.h),
                               width: mm(s.head.w), height: mm(s.head.h), ...line });
          // 반으로 접는 선
          page.drawLine({
            start: { x: mm(s.head.x + ox), y: toPt(s.head.y + s.head.h / 2 + oy) },
            end:   { x: mm(s.head.x + s.head.w + ox), y: toPt(s.head.y + s.head.h / 2 + oy) },
            thickness: 0.3, color: rgb(0.85, 0.87, 0.92), dashArray: [2, 2],
          });
          // 칸 번호 — 어느 칸이 몇 번인지 눈으로 확인할 수 있게
          page.drawText(String(s.no), {
            x: mm(s.head.x + 1.2 + ox), y: toPt(s.head.y + s.head.h - 1.2 + oy),
            size: 5, font, color: rgb(0.72, 0.75, 0.82),
          });
        }

        const t = cells[i];
        if (!t) return;

        // ② 배경 그림 (글자보다 먼저 그린다 — 글자가 그림 위에 온다)
        if (bg) {
          page.drawImage(bg, {
            x: mm(s.head.x + ox), y: toPt(s.head.y + oy + s.head.h),
            width: mm(s.head.w), height: mm(s.head.h),
          });
        }

        // ③ 글자
        const rows = LabelText.place(t, { x: s.head.x + ox, y: s.head.y + oy, w: s.head.w, h: s.head.h }, {
          align: opt.align, both: opt.both, which: opt.which,
          flipSecond: opt.flipSecond, maxMm: opt.maxMm, measure,
        });
        for (const r of rows) {
          // 거꾸로 찍는 줄 : 오른쪽 끝을 시작점으로 잡고 180° 돌리면 칸 [x, x+w] 을 그대로 채운다
          page.drawText(t, {
            x: mm(r.rot === 180 ? r.x + r.w : r.x),
            y: toPt(r.baseline),
            size: mm(r.size), font, color: rgb(0, 0, 0),
            rotate: degrees(r.rot === 180 ? 180 : 0),
          });
        }
      });
    }
    return doc.save();
  }

  /** 만든 PDF 를 내려받기 */
  function download(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /** 만든 PDF 를 새 탭에서 열고 인쇄 창까지 띄운다.
   *  ⚠ 인쇄를 «두 갈래» 로 부른다 — `onload` 와 타이머.
   *    새 탭의 PDF 보기는 브라우저에 따라 `onload` 가 오지 않는 경우가 있어
   *    한쪽만 두면 인쇄 창이 아예 안 뜬다. 문패(`asked`)를 두어 «먼저 도착한 쪽만»
   *    인쇄하게 했다(다른 앱의 js/print.js 에서 인쇄 창이 두 번 뜬 사고와 같은 대비책). */
  function print(bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const w = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); return false; }
    let asked = false;
    const ask = () => { if (asked) return; asked = true; try { w.focus(); w.print(); } catch (e) {} };
    try { w.addEventListener('load', ask); } catch (e) {}
    setTimeout(ask, 1500);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return true;
  }

  return { build, download, print };
})();
