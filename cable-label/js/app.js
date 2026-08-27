/* 화면 묶기 — 입력을 읽어 미리보기를 다시 그리고, 단추를 PDF 만들기에 잇는다.

   ⚠ 설정(위치 미세조정·글자 크기 …)과 «적어 둔 목록» 은 이 브라우저에 저장한다
     (`localStorage`). 학생 정보가 아니라 케이블 이름이므로 개인정보가 아니고,
     선생님이 애써 적은 목록이 새로고침 한 번에 사라지지 않게 하려는 것이다.
   ⚠ 위치 미세조정은 «프린터마다 다른 값» 이다 — 저장해 두어야 다음에 또 맞추지 않는다.
   ⚠ 「원본 파일로 규격 알아내기」 는 스캔 **그림을 저장하지 않는다** — 알아낸 치수 숫자만
     저장한다(`SheetStore`). 그림까지 담으면 브라우저 저장칸이 금방 찬다. */

(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'cable-label.v1';

  const ui = {
    sheet: $('sheet'), sheetInfo: $('sheetInfo'),
    // 접힌 카드의 «한 줄 요약» — 접혀 있어도 지금 값이 보여야 한다
    sheetCard: $('sheetCard'), sheetPick: $('sheetPick'),
    calibCard: $('calibCard'), calibPick: $('calibPick'), legend: $('legend'),
    texts: $('texts'), star: $('star'), each: $('each'), start: $('start'),
    size: $('size'), sizeR: $('sizeR'), align: $('align'),
    both: $('both'), which: $('which'), whichWrap: $('whichWrap'), whichLb: $('whichLb'),
    flip: $('flip'),
    outline: $('outline'), offx: $('offx'), offy: $('offy'),
    // ⚠ `paper` 는 «종이 크기 고르는 칸», `paperView` 는 «미리보기를 그리는 자리» 다.
    //   예전에 둘 다 id="paper" 였다가 서로를 가로챘다 — 이름을 겹치게 두지 말 것.
    paper: $('paper'), paperView: $('paperView'), count: $('count'), msg: $('msg'),
    pgNow: $('pgNow'), pgPrev: $('pgPrev'), pgNext: $('pgNext'), specName: $('specName'),
    btnPdf: $('btnPdf'), btnPrint: $('btnPrint'),
    // 규격 알아내기
    srcFile: $('srcFile'), srcTools: $('srcTools'), srcGo: $('srcGo'),
    paperCustom: $('paperCustom'), paperW: $('paperW'), paperH: $('paperH'),
    btnRot: $('btnRot'), btnDetect: $('btnDetect'), detMsg: $('detMsg'),
    detOut: $('detOut'), detCanvas: $('detCanvas'), detSvg: $('detSvg'),
    detTable: $('detTable'), detName: $('detName'), btnUseSpec: $('btnUseSpec'),
    detectFold: $('detectFold'),
    // 규격 손으로 고치기
    editFold: $('editFold'), editHost: $('editHost'),
    detEditFold: $('detEditFold'), detEditHost: $('detEditHost'),
    // 배경 그림
    bgFold: $('bgFold'), bgFile: $('bgFile'), bgTools: $('bgTools'), bgThumb: $('bgThumb'),
    btnBgClear: $('btnBgClear'), bgFit: $('bgFit'),
    bgOpacity: $('bgOpacity'), bgOpacityR: $('bgOpacityR'),
    // 작업 저장·불러오기
    btnSaveWork: $('btnSaveWork'), workFile: $('workFile'), workMsg: $('workMsg'),
  };

  let SPEC = SHEETS['cabletie-30'];
  let PER = perSheet(SPEC);
  let page = 0;
  let pages = [];

  /* ── 설정 저장·복원 ─────────────────────────────── */
  const FIELDS = ['texts', 'each', 'start', 'size', 'align', 'which', 'offx', 'offy',
                  'bgFit', 'bgOpacity'];
  const FLAGS = ['star', 'both', 'flip', 'outline'];

  /* 🔴 배경 그림은 **다른 열쇠에 따로** 저장한다(`cable-label.bg.v1`).
       그림은 수백 KB 라 브라우저 저장칸이 찰 수 있는데, 같은 열쇠에 넣으면 그때
       `setItem` 이 실패해 **적어 둔 목록과 설정까지 통째로 못 저장한다.** 따로 두면
       그림만 저장에 실패하고 나머지는 지켜진다. */
  const BG_KEY = 'cable-label.bg.v1';

  function save() {
    const o = { sheetKey: SPEC.key };
    for (const k of FIELDS) o[k] = ui[k].value;
    for (const k of FLAGS) o[k] = ui[k].checked;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    try {
      const s = Bg.source();
      if (s) localStorage.setItem(BG_KEY, s.url);
      else localStorage.removeItem(BG_KEY);
    } catch (e) { /* 저장칸이 차면 그림만 못 남는다 — 설정은 위에서 이미 저장됐다 */ }
  }
  function restore() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!o) return null;
    for (const k of FIELDS) if (o[k] != null) ui[k].value = o[k];
    for (const k of FLAGS) if (o[k] != null) ui[k].checked = !!o[k];
    ui.sizeR.value = ui.size.value;
    return o.sheetKey || null;
  }

  /* ── 시트 고르기 ─────────────────────────────────── */

  /** 이 규격이 «어디서 왔나» — 목록과 안내에 같은 말을 쓰려고 한곳에 모았다.
   *  ⚠ 예전에는 사람이 만든 규격까지 «(알아낸 규격)» 이라고 했고, 이름에 붙는 «(고친 것)» 과
   *    겹쳐 「… (고친 것) (알아낸 규격)」 이 되었다. 출처는 한 가지만 말한다. */
  function tag(spec, key) {
    if (!SheetStore.isCustom(key)) return '';
    if (spec.edited && spec.detected) return ' (알아낸 뒤 고침)';
    if (spec.edited) return '';                 // 이름에 이미 «(고친 것)» 이 붙어 있다
    if (spec.detected) return ' (알아낸 규격)';
    return ' (내 규격)';
  }

  function fillSheetList(selectKey, setDefaults) {
    const all = SheetStore.all();
    ui.sheet.textContent = '';
    for (const k in all) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = all[k].name + tag(all[k], k);
      ui.sheet.appendChild(o);
    }
    ui.sheet.value = all[selectKey] ? selectKey : 'cabletie-30';
    useSheet(ui.sheet.value, setDefaults);
  }

  /** @param {boolean} setDefaults  사람이 시트를 «바꿨을» 때만 참 — 처음 켤 때는 저장된 설정을 지킨다 */
  function useSheet(key, setDefaults) {
    const all = SheetStore.all();
    SPEC = all[key] || SHEETS['cabletie-30'];
    PER = perSheet(SPEC);
    ui.start.max = PER;
    if (+ui.start.value > PER) ui.start.value = 1;
    ui.specName.textContent = SPEC.name;
    const t = SPEC.tail && SPEC.tail.w > 0;

    // 꼬리가 없는 시트(주소 라벨처럼)는 «접지 않는» 라벨이다 —
    // 위·아래 두 번 찍기는 접어서 양면에 보이게 하려는 것이므로 끄고, 글자를 칸 가운데에 둔다.
    if (setDefaults) {
      ui.both.checked = t;
      if (!t) ui.which.value = 'middle';
    }
    const from = !SheetStore.isCustom(key) ? ''
      : SPEC.edited && SPEC.detected ? ' · 원본 파일로 알아낸 뒤 손으로 고친 규격입니다'
      : SPEC.edited ? ' · 손으로 고친 규격입니다'
      : SPEC.detected ? ' · 원본 파일에서 알아낸 규격입니다'
      : ' · 내가 만든 규격입니다';
    ui.sheetInfo.textContent =
      `한 장에 ${PER}칸 · 글자 칸 ${SPEC.head.w} × ${SPEC.head.h}mm`
      + (t ? ` · 꼬리 ${SPEC.tail.w} × ${SPEC.tail.h}mm` : ' · 꼬리 없음')
      + from;
    // 카드가 접혀 있어도 «무엇을 쓰는 중인지» 는 보여야 한다
    ui.sheetPick.textContent = `${SPEC.name} · ${PER}칸`;

    /* 미리보기 아래 설명 — **시트에 맞는 말만** 한다.
       ⚠ «점선은 반으로 접는 자리 · 오른쪽 띠는 케이블을 감는 꼬리» 는 **깃발 라벨에만**
         해당한다(사용자 지적). 주소 라벨에서는 접지도 않고 꼬리도 없어서 헷갈린다. */
    ui.legend.innerHTML = t
      ? '회색 칸이 라벨 한 장입니다. 점선은 <b>반으로 접는 자리</b>이고, 접었을 때 양면에 글자가 '
        + '보이도록 위·아래에 같은 글자를 넣습니다. 오른쪽으로 뻗은 띠는 <b>케이블을 감는 꼬리</b>입니다.'
      : '회색 칸이 라벨 한 장입니다. 글자를 적은 칸만 노랗게 표시됩니다 — '
        + '<b>칸을 누르면</b> 「시작 칸」 이 그 자리로 바뀝니다.';
    page = 0;

    /* 🔴 ✏️ 편집 칸이 열려 있으면 **새 시트 숫자로 다시 그린다.**
       이것이 없으면 편집 칸이 «예전 시트» 를 들고 있다가, 다음에 숫자 하나를 고치는 순간
       그 예전 값 전체로 새 시트를 덮어쓴다(주소 라벨을 고쳤더니 케이블타이 숫자가 들어갔다).
       ⚠ 단, «편집 칸에서 고치는 중» 에는 다시 그리지 않는다 — 그러면 타이핑하던 칸이
         사라져 글자를 이어 칠 수 없다. 그래서 `editingNow` 문패를 둔다. */
    if (ui.editFold.open && !editingNow) openEditor();
  }

  /* ── 지금 화면의 설정 모으기 ──────────────────────── */
  function options() {
    return {
      off: { x: +ui.offx.value || 0, y: +ui.offy.value || 0 },
      outline: ui.outline.checked,
      align: ui.align.value,
      both: ui.both.checked,
      which: ui.which.value,
      flipSecond: ui.flip.checked,
      maxMm: Math.min(12, Math.max(3, +ui.size.value || 8.5)),
      startNo: Math.max(1, Math.min(PER, +ui.start.value || 1)),
    };
  }

  /** ③ 인쇄 위치 카드의 «한 줄 요약» — 접혀 있어도 지금 값이 보이게 */
  function showCalib() {
    const x = +ui.offx.value || 0, y = +ui.offy.value || 0;
    ui.calibPick.textContent =
      (x || y ? `가로 ${x} · 세로 ${y} mm` : '맞춘 값 없음')
      + (ui.outline.checked ? ' · 윤곽선 함께 인쇄' : '');
  }

  /* ── 다시 그리기 ──────────────────────────────── */
  function redraw() {
    showCalib();
    const opt = options();
    const texts = parseLines(ui.texts.value, { star: ui.star.checked, each: +ui.each.value || 1 });
    pages = layout(texts, PER, opt.startNo);
    if (page >= pages.length) page = pages.length - 1;
    if (page < 0) page = 0;

    ui.count.textContent = texts.length + '장'
      + (pages.length > 1 ? ` · 종이 ${pages.length}장` : '');
    ui.pgNow.textContent = `${page + 1} / ${pages.length}`;
    ui.pgPrev.disabled = page === 0;
    ui.pgNext.disabled = page >= pages.length - 1;
    // «이름 | 조작» 두 칸 표라서 이름 칸도 함께 여닫아야 줄이 어긋나지 않는다
    ui.whichWrap.hidden = ui.whichLb.hidden = ui.both.checked;

    Preview.draw(ui.paperView, SPEC, pages[page], Object.assign({}, opt, {
      bgUrl: bgFitted ? bgFitted.url : null,
      onPick: (no) => { ui.start.value = no; save(); redraw(); },
    }));

    /* 시트를 바꾸면 칸 크기가 달라지므로 배경 그림을 **그 칸에 맞게 다시** 만들어야 한다.
       ⚠ 다시 만든 뒤 한 번 더 그린다 — 그때는 `bgFor` 가 맞아떨어져 되풀이되지 않는다. */
    if (bgStale()) refitBg().then(redraw);
  }

  /* ── 배경 그림 ────────────────────────────────────
     ⚠ 칸 크기에 맞춘 그림을 «미리 만들어» 두고 미리보기와 PDF 가 그것을 함께 쓴다
       (js/bg.js 의 주석 참고). 칸 크기·맞춤·진하기가 바뀔 때마다 다시 만든다. */
  let bgFitted = null;
  let bgFor = '';          // 어떤 «칸 크기 · 맞춤 · 진하기» 로 맞춰 둔 그림인가

  function bgWant() {
    return `${SPEC.head.w}x${SPEC.head.h}|${ui.bgFit.value}|${ui.bgOpacity.value}`;
  }

  /** 지금 칸 크기에 맞는 그림이 아니면 참 — 시트를 바꾸면 다시 맞춰야 한다 */
  function bgStale() { return Bg.has() && bgFor !== bgWant(); }

  async function refitBg() {
    if (!Bg.has()) { bgFitted = null; bgFor = ''; return; }
    try {
      bgFitted = await Bg.fitted(SPEC.head, {
        fit: ui.bgFit.value,
        opacity: +ui.bgOpacity.value || 100,
      });
      bgFor = bgWant();
    } catch (e) {
      bgFitted = null;
      bgFor = '';
      console.error(e);
    }
  }

  function showBg() {
    const on = Bg.has();
    ui.bgTools.hidden = !on;
    if (on) ui.bgThumb.src = Bg.source().url;
    else ui.bgThumb.removeAttribute('src');
  }

  async function bgChanged() {
    await refitBg();
    showBg();
    save(); redraw();
  }

  ui.bgFile.addEventListener('change', async () => {
    const f = ui.bgFile.files && ui.bgFile.files[0];
    ui.bgFile.value = '';
    if (!f) return;
    try {
      await Bg.load(f);
      ui.bgFold.open = true;
      await bgChanged();
      say('배경 그림을 넣었습니다. 칸 크기에 맞춰 저절로 맞췄습니다.', 'ok');
    } catch (e) {
      say(e.message || '그림을 열지 못했습니다.', 'err');
    }
  });

  ui.btnBgClear.addEventListener('click', async () => {
    Bg.clear();
    await bgChanged();
    say('배경 그림을 없앴습니다.', 'ok');
  });

  ui.bgFit.addEventListener('change', bgChanged);
  ui.bgOpacityR.addEventListener('input', () => {
    ui.bgOpacity.value = ui.bgOpacityR.value; bgChanged();
  });
  ui.bgOpacity.addEventListener('input', () => {
    ui.bgOpacityR.value = ui.bgOpacity.value; bgChanged();
  });

  /* ── PDF ─────────────────────────────────────── */
  function say(text, cls) {
    ui.msg.textContent = text || '';
    ui.msg.className = 'msg' + (cls ? ' ' + cls : '');
  }

  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  async function makePdf(then) {
    const opt = options();
    const texts = parseLines(ui.texts.value, { star: ui.star.checked, each: +ui.each.value || 1 });
    if (!texts.length && !opt.outline) {
      say('라벨에 넣을 글자를 한 줄에 하나씩 적어 주세요.', 'err');
      ui.texts.focus();
      return;
    }
    ui.btnPdf.disabled = ui.btnPrint.disabled = true;
    say('PDF 를 만드는 중…');
    try {
      await refitBg();                       // 칸 크기가 바뀌었을 수도 있다
      const bytes = await LabelPDF.build(SPEC, layout(texts, PER, opt.startNo),
        Object.assign({}, opt, { bgBytes: bgFitted ? bgFitted.bytes : null }));
      then(bytes, texts.length);
    } catch (e) {
      console.error(e);
      say('PDF 를 만들지 못했습니다 — ' + (e && e.message ? e.message : e), 'err');
    } finally {
      ui.btnPdf.disabled = ui.btnPrint.disabled = false;
    }
  }

  ui.btnPdf.addEventListener('click', () => makePdf((bytes, n) => {
    LabelPDF.download(bytes, `라벨_${n}장_${stamp()}.pdf`);
    say(`${n}장을 담은 PDF 를 내려받았습니다. 인쇄할 때 배율을 「실제 크기」로 두세요.`, 'ok');
  }));

  ui.btnPrint.addEventListener('click', () => makePdf((bytes, n) => {
    const ok = LabelPDF.print(bytes);
    say(ok
      ? '새 탭에서 인쇄 창을 엽니다. 배율은 「실제 크기 · 100%」, 여백은 「없음」 으로 두세요.'
      : '팝업이 막혀 새 탭을 열지 못했습니다 — 「⬇ PDF 내려받기」 로 받아서 인쇄해 주세요.',
      ok ? 'ok' : 'err');
  }));

  /* ── 원본 파일로 규격 알아내기 ────────────────────── */
  const MM_PER_PX = 0.25;          // 알아낼 때 쓰는 눈금 (A4 가로면 1188 × 840)
  let src = null;                  // { bitmap, deg, kind }
  let found = null;                // 알아낸 규격

  function detSay(text, cls) {
    ui.detMsg.textContent = text || '';
    ui.detMsg.className = 'msg' + (cls ? ' ' + cls : '');
  }

  function paperNow() {
    if (ui.paper.value === 'custom') {
      return { w: +ui.paperW.value || 297, h: +ui.paperH.value || 210 };
    }
    const [w, h] = ui.paper.value.split('x').map(Number);
    return { w, h };
  }

  function setPaperSelect(p) {
    const key = `${p.w}x${p.h}`;
    ui.paper.value = [...ui.paper.options].some((o) => o.value === key) ? key : 'custom';
    ui.paperW.value = p.w; ui.paperH.value = p.h;
    ui.paperCustom.hidden = ui.paper.value !== 'custom';
  }

  ui.srcFile.addEventListener('change', async () => {
    const f = ui.srcFile.files && ui.srcFile.files[0];
    ui.detOut.hidden = true; found = null;
    if (!f) { src = null; ui.srcTools.hidden = ui.srcGo.hidden = true; return; }
    detSay('파일을 읽는 중…');
    try {
      const got = await Source.load(f);
      src = { bitmap: got.bitmap, deg: 0, kind: got.kind };
      setPaperSelect(Source.guessPaper(src.bitmap, 0));
      ui.srcTools.hidden = ui.srcGo.hidden = false;
      detSay(`${got.kind === 'pdf' ? 'PDF 안의 스캔 사진' : '그림'} ${src.bitmap.width}×${src.bitmap.height} 을 읽었습니다. 「🔍 규격 알아내기」 를 눌러 주세요.`, 'ok');
    } catch (e) {
      src = null;
      ui.srcTools.hidden = ui.srcGo.hidden = true;
      detSay(e.message || String(e), 'err');
    }
  });

  ui.paper.addEventListener('change', () => {
    ui.paperCustom.hidden = ui.paper.value !== 'custom';
  });

  ui.btnRot.addEventListener('click', () => {
    if (!src) return;
    src.deg = (src.deg + 90) % 360;
    setPaperSelect(Source.guessPaper(src.bitmap, src.deg));
    detSay(`그림을 ${src.deg}° 돌렸습니다. 다시 「🔍 규격 알아내기」 를 눌러 주세요.`);
    ui.detOut.hidden = true;
  });

  /** 한 번 알아내 본다 (돌아간 그림을 스스로 바로잡는 것은 detect() 가 한다) */
  function tryDetect() {
    const paper = paperNow();
    const { imageData } = Source.rasterize(src.bitmap, src.deg, paper, MM_PER_PX);
    return { res: Detect.run(imageData, paper), paper };
  }

  ui.btnDetect.addEventListener('click', () => {
    if (!src) return;
    detSay('알아내는 중…');
    // 브라우저가 화면을 한 번 그리도록 잠깐 미룬다(그러지 않으면 «알아내는 중» 이 안 보인다)
    setTimeout(() => {
      let { res, paper } = tryDetect();

      // 꼬리가 «세로로 서 있으면» 그림이 90° 돌아간 것이다 — 한 번 스스로 돌려 본다
      if (res.ok && res.info.tailUpright) {
        src.deg = (src.deg + 90) % 360;
        setPaperSelect(Source.guessPaper(src.bitmap, src.deg));
        const again = tryDetect();
        if (again.res.ok) {
          res = again.res; paper = again.paper;
          detSay('그림이 90° 돌아가 있어 바로 세운 뒤 알아냈습니다.', 'ok');
        } else {
          src.deg = (src.deg + 270) % 360;      // 되돌린다
          setPaperSelect(Source.guessPaper(src.bitmap, src.deg));
        }
      }

      if (!res.ok) { ui.detOut.hidden = true; found = null; detSay(res.why, 'err'); return; }
      found = res.spec;
      showResult(res, paper);
    }, 30);
  });

  /** 알아낸(또는 손으로 고친) 격자를 스캔 그림 위에 겹쳐 그린다 — 겹쳐 보이면 맞다.
   *  ⚠ 숫자를 고칠 때마다 이것만 다시 부른다(그림은 그대로 두고 빨간 네모만 움직인다). */
  function drawOverlay(spec, paper) {
    const svg = ui.detSvg;
    svg.setAttribute('viewBox', `0 0 ${paper.w} ${paper.h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.textContent = '';
    const NS = 'http://www.w3.org/2000/svg';
    for (const s of slotsOf(spec)) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', s.head.x); r.setAttribute('y', s.head.y);
      r.setAttribute('width', s.head.w); r.setAttribute('height', s.head.h);
      svg.appendChild(r);
      if (!s.tail) continue;
      const t2 = document.createElementNS(NS, 'rect');
      t2.setAttribute('class', 't');
      t2.setAttribute('x', s.tail.x); t2.setAttribute('y', s.tail.y);
      t2.setAttribute('width', s.tail.w); t2.setAttribute('height', s.tail.h);
      svg.appendChild(t2);
    }
  }

  function showResult(res, paper) {
    const spec = res.spec;
    // ① 스캔 그림을 그대로 보여 준다
    const { canvas } = Source.rasterize(src.bitmap, src.deg, paper, MM_PER_PX * 2);
    ui.detCanvas.width = canvas.width; ui.detCanvas.height = canvas.height;
    ui.detCanvas.getContext('2d').drawImage(canvas, 0, 0);

    // ② 알아낸 격자를 겹쳐 그린다
    drawOverlay(spec, paper);

    // ②' 숫자를 손으로 고칠 수 있게 — 고치면 위 그림의 빨간 네모가 곧바로 움직인다
    SpecEdit.render(ui.detEditHost, spec, (next) => {
      found = next;                     // 「이 규격으로 쓰기」 는 고친 값을 쓴다
      drawOverlay(next, paper);
    });

    // ③ 숫자 표
    const t = spec.tail && spec.tail.w > 0;
    const rows = [
      ['찾은 라벨', `${perSheet(spec)}장 — ${spec.cols}열 × ${spec.pairs}${spec.inner ? '쌍 × 2장' : '줄'}`],
      ['찾은 방법', res.info.mode === 'outline'
        ? '라벨의 <b>윤곽선(칼선)</b>으로 — 흰 라벨지'
        : '라벨의 <b>색</b>으로 — 바탕과 색이 다른 라벨'],
      ['글자 칸(머리)', `${spec.head.w} × ${spec.head.h} mm`],
      ['꼬리', t ? `${spec.tail.w} × ${spec.tail.h} mm (안쪽으로 ${spec.tail.inset})` : '없음 (네모난 라벨)'],
      ['열 간격 · 첫 열', `${spec.colPitch} mm · 왼쪽에서 ${spec.x0} mm`],
      [spec.inner ? '쌍 간격 · 첫 쌍' : '줄 간격 · 첫 줄', `${spec.pairPitch} mm · 위에서 ${spec.y0} mm`],
      ['맞물린 두 번째 라벨', spec.inner ? `오른쪽 ${spec.inner.dx} mm · 아래 ${spec.inner.dy} mm` : '없음'],
      ['격자가 맞는 정도', `어긋남 최대 ${res.info.gridErr.toFixed(2)} mm`],
      ['스캔이 비뚤어진 정도', `${res.info.skew.toFixed(2)}°`],
    ];
    ui.detTable.innerHTML = rows
      .map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');

    ui.detName.value = `라벨 ${perSheet(spec)}장 (${spec.cols}열)`;
    ui.detOut.hidden = false;

    const warn = [];
    if (res.info.gridErr > 1.0) warn.push(`라벨이 고르지 않습니다(어긋남 ${res.info.gridErr.toFixed(1)}mm)`);
    if (res.info.skew > 0.6) warn.push(`스캔이 ${res.info.skew.toFixed(1)}° 비뚤어졌습니다`);
    if (res.info.mode === 'outline') {
      // 윤곽선으로 찾으면 칸이 선 두께만큼 작게 잡힌다 — 자리는 정확하다
      warn.push('윤곽선으로 찾았으므로 칸 크기가 실제보다 0.5mm쯤 작게 잡혔습니다(자리는 정확합니다)');
    }
    detSay(
      `${perSheet(spec)}장을 찾았습니다` +
      (res.info.mode === 'outline' ? '(윤곽선으로).' : '(라벨 색으로).') +
      (warn.length ? ' ⚠ ' + warn.join(' · ') + '.' : '') +
      ' 아래 그림에서 빨간 네모가 라벨과 겹쳐 보이는지 꼭 확인해 주세요.',
      res.info.gridErr > 1.0 || res.info.skew > 0.6 ? 'err' : 'ok');
  }

  ui.btnUseSpec.addEventListener('click', () => {
    if (!found) return;
    const spec = JSON.parse(JSON.stringify(found));
    const name = (ui.detName.value || '').trim();
    if (name) spec.name = name;
    spec.key = SheetStore.freeKey('custom-' + perSheet(spec));
    SheetStore.save(spec);
    fillSheetList(spec.key, true);
    save(); redraw();
    ui.detectFold.open = false;
    say(`「${spec.name}」 규격으로 바꿨습니다. 처음 한 번은 「④ 인쇄 위치 맞추기」 로 확인해 주세요.`, 'ok');
  });

  ui.sheet.addEventListener('change', () => { useSheet(ui.sheet.value, true); save(); redraw(); });

  /* ── ✏️ 쓰는 시트 규격을 손으로 고치기 ──────────────────
     🔴 **기본 규격을 고치면 «고친 것» 을 새로 만들어 그것을 쓴다.**
       기본 규격을 그 자리에서 바꾸면 새로고침하면 사라져 «고쳤는데 되돌아갔다» 가 되고,
       원래 값으로 돌아갈 길도 없어진다. 사본을 만들면 둘 다 남는다. */
  let editingNow = false;            // 편집 칸에서 고치는 중인가 (위 useSheet 의 주석 참고)

  function openEditor() {
    SpecEdit.render(ui.editHost, SPEC, (next) => {
      editingNow = true;
      let key = SPEC.key;
      if (!SheetStore.isCustom(key)) {                 // 기본 규격 → 사본을 만든다
        key = SheetStore.freeKey('custom-' + perSheet(next));
        next.name = SPEC.name.replace(/\s*\(고친 것\)$/, '') + ' (고친 것)';
        delete next.detected;                          // 사람이 만든 것이다
      } else {
        next.name = SPEC.name;
      }
      next.edited = true;
      next.key = key;
      SheetStore.save(next);
      const open = ui.editFold.open;
      fillSheetList(key, false);
      ui.editFold.open = open;
      save(); redraw();
      editingNow = false;
    });
  }
  ui.editFold.addEventListener('toggle', () => { if (ui.editFold.open) openEditor(); });

  /* ⓿ 「라벨 시트」 칸을 «지금 상태» 로 되돌린다.
     🔴 불러오기·새로 시작 뒤에 반드시 부른다. 그러지 않으면 예전에 「규격 알아내기」 로 띄운
       스캔 그림·빨간 네모·붉은 안내가 그대로 남아 **«시트가 반영되지 않은» 것처럼 보인다**
       (사용자 신고 — *"불러오기를 했더니 라벨시트 부분은 반영이 안되어 있어"*).
       시트는 실제로 바뀌었는데 그 옆의 낡은 화면이 그렇게 보이게 한 것이다. */
  function resetSheetPanels() {
    src = null; found = null;
    ui.srcFile.value = '';
    ui.srcTools.hidden = true;
    ui.srcGo.hidden = true;
    ui.detOut.hidden = true;
    ui.detEditHost.textContent = '';
    ui.detEditFold.open = false;
    detSay('');
    ui.detectFold.open = false;
    if (ui.editFold.open) openEditor();          // 열려 있으면 새 시트 숫자로 다시 그린다
  }

  /* ── 작업 저장·불러오기 (내 컴퓨터의 파일로) ──────────
     ⚠ `localStorage` 는 이 브라우저 안에만 남는다. 파일로 두면 브라우저를 지워도,
       다른 PC 로 옮겨도, 여러 벌을 따로 보관해도 된다.
     ⚠ 쓰던 시트 규격을 **통째로** 담는다 — 「알아낸 규격」 으로 작업했다면 그것까지 함께
       옮겨져야 다른 PC 에서 열어도 같은 자리에 인쇄된다(js/work.js 의 주석 참고). */
  function workSay(text, cls) {
    ui.workMsg.textContent = text || '';
    ui.workMsg.className = 'workbar' + (cls ? ' ' + cls : '');
    ui.workMsg.hidden = !text;
  }

  /* 🆕 새로 시작 — 적어 둔 목록과 «글자 설정» 만 처음 값으로 되돌린다.
     🔴 **쓰는 시트와 「인쇄 위치 미세조정」 은 그대로 둔다.**
       미세조정은 «이 프린터에 맞춘 값» 이라, 새 작업마다 다시 맞추게 하면 안 된다.
       시트도 «지금 쓰는 라벨지» 라서 새 작업에서도 거의 같은 것을 쓴다. */
  $('btnNewWork').addEventListener('click', () => {
    const n = parseLines(ui.texts.value, { star: ui.star.checked, each: +ui.each.value || 1 }).length;
    if (n && !window.confirm(
      `적어 둔 ${n}장을 지우고 새로 시작할까요?\n\n`
      + '· 쓰는 시트와 「인쇄 위치 미세조정」 은 그대로 둡니다.\n'
      + '· 지우기 전에 「💾 저장」 을 눌러 두면 나중에 다시 불러올 수 있습니다.')) return;

    const flag = !!(SPEC.tail && SPEC.tail.w > 0);      // 깃발(접는) 라벨인가
    ui.texts.value = '';
    ui.each.value = 1;
    ui.start.value = 1;
    ui.size.value = 8.5; ui.sizeR.value = 8.5;
    ui.align.value = 'center';
    ui.star.checked = true;
    ui.both.checked = flag;
    ui.which.value = flag ? 'top' : 'middle';
    ui.flip.checked = false;
    ui.outline.checked = false;
    page = 0;
    resetSheetPanels();
    say('');
    save(); redraw();
    ui.texts.focus();
    workSay('새로 시작합니다. 쓰는 시트와 인쇄 위치 미세조정은 그대로 두었습니다.', 'ok');
  });

  ui.btnSaveWork.addEventListener('click', () => {
    const opt = {};
    for (const k of Work.KEYS) {
      const el = ui[k];
      if (!el) continue;
      opt[k] = el.type === 'checkbox' ? el.checked : el.value;
    }
    const data = Work.make({
      sheet: SPEC,
      sheets: SheetStore.customOnly(),
      texts: ui.texts.value,
      options: opt,
      bg: Bg.has() ? Bg.source().url : null,
      stamp: new Date().toLocaleString('ko-KR'),
    });
    const n = parseLines(ui.texts.value, { star: ui.star.checked, each: +ui.each.value || 1 }).length;
    const url = URL.createObjectURL(new Blob([Work.toText(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `라벨작업_${n}장_${stamp()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    workSay(`💾 저장했습니다 — ${n}장 · ${a.download}. 다음에 「📂 불러오기」 로 넣으면 그대로 이어집니다.`, 'ok');
  });

  $('btnLoadWork').addEventListener('click', () => ui.workFile.click());

  ui.workFile.addEventListener('change', async () => {
    const f = ui.workFile.files && ui.workFile.files[0];
    ui.workFile.value = '';                        // 같은 파일을 다시 고를 수 있게
    if (!f) return;
    let text;
    try {
      text = await f.text();
    } catch (e) {
      workSay('파일을 읽지 못했습니다.', 'err');
      return;
    }
    const got = Work.read(text);
    if (!got.ok) { workSay(got.why, 'err'); return; }

    const d = got.data;
    // ① 함께 담겨 온 «알아낸 규격» 들을 이 브라우저에도 등록한다(있는 것은 덮어쓴다)
    for (const k in d.sheets) SheetStore.save(Object.assign({}, d.sheets[k], { key: k }));
    // ② 쓰던 시트를 등록하고 고른다 (기본 규격이면 그대로 고르기만)
    let key = d.sheet.key;
    if (!key || SheetStore.isCustom(key)) {
      key = key || 'custom-' + perSheet(d.sheet);
      SheetStore.save(Object.assign({}, d.sheet, { key }));
    }
    // ③ 목록과 설정을 화면에 넣는다
    ui.texts.value = d.texts;
    for (const k of Work.KEYS) {
      const el = ui[k];
      if (!el || d.options[k] === undefined) continue;
      if (el.type === 'checkbox') el.checked = !!d.options[k];
      else el.value = d.options[k];
    }
    ui.sizeR.value = ui.size.value;
    ui.bgOpacityR.value = ui.bgOpacity.value;
    // 배경 그림 — 파일에 있으면 되살리고, 없으면 없앤다(불러온 그대로가 되게)
    if (d.bg) { try { await Bg.load(d.bg); } catch (e) { Bg.clear(); } } else Bg.clear();
    await refitBg();
    showBg();
    fillSheetList(key, false);                     // ⚠ 저장해 둔 설정을 지킨다(기본값으로 덮지 않는다)
    page = 0;
    resetSheetPanels();                            // ⓿ 칸에 남은 낡은 화면을 치운다
    say('');                                       // 아래쪽 안내도 지운다(예전 것이 남으면 어긋나 보인다)
    save(); redraw();

    const n = parseLines(ui.texts.value, { star: ui.star.checked, each: +ui.each.value || 1 }).length;
    workSay(`📂 불러왔습니다 — ${n}장 · 시트 「${SPEC.name}」`
      + (d.savedAt ? ` (저장한 때 : ${d.savedAt})` : '')
      + '. ⚠ 프린터가 다르면 「④ 인쇄 위치 맞추기」 를 다시 확인해 주세요.', 'ok');
  });

  /* ── 잔 단추들 ───────────────────────────────── */
  $('btnSample').addEventListener('click', () => {
    ui.texts.value = ['거제중', '무궁화', 'USB LAN', '전원 *4', '스위치1 ↔ 1-1반', 'AP-2층복도'].join('\n');
    save(); redraw();
  });
  $('btnClear').addEventListener('click', () => { ui.texts.value = ''; save(); redraw(); ui.texts.focus(); });
  $('btnOff0').addEventListener('click', () => { ui.offx.value = 0; ui.offy.value = 0; save(); redraw(); });
  ui.pgPrev.addEventListener('click', () => { page--; redraw(); });
  ui.pgNext.addEventListener('click', () => { page++; redraw(); });

  // 크기 손잡이와 숫자칸을 서로 맞춘다
  ui.sizeR.addEventListener('input', () => { ui.size.value = ui.sizeR.value; save(); redraw(); });
  ui.size.addEventListener('input', () => { ui.sizeR.value = ui.size.value; save(); redraw(); });

  // 무엇을 고쳐도 다시 그린다 (글자는 조금 늦춰서 — 타이핑마다 그리지 않게)
  let t = null;
  ui.texts.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { save(); redraw(); }, 180);
  });
  /* 🔴 `change` 만 듣지 말 것. 숫자 칸(`each`·`start`·`offx`·`offy`)의 `change` 는
       **다른 곳을 누르거나 Enter 를 칠 때** 온다 — 그래서 「각 줄 3장」 을 타이핑해도
       미리보기가 그대로여서 «안 된다» 로 보였다. `input` 도 함께 듣는다.
     ⚠ 확인칸·고르기는 둘 다 오지만 다시 그리는 값이 같으므로 해가 없다. */
  for (const k of ['star', 'each', 'start', 'align', 'both', 'which', 'flip', 'outline', 'offx', 'offy']) {
    const go = () => { save(); redraw(); };
    ui[k].addEventListener('change', go);
    ui[k].addEventListener('input', go);
  }

  /* ── 시작 ────────────────────────────────────── */
  fillSheetList(restore() || 'cabletie-30');
  ui.bgOpacityR.value = ui.bgOpacity.value;
  redraw();

  // 지난번에 넣어 둔 배경 그림을 되살린다 (따로 저장해 둔 열쇠 — 위 BG_KEY 주석 참고)
  (async () => {
    let url = null;
    try { url = localStorage.getItem(BG_KEY); } catch (e) {}
    if (!url) return;
    try { await Bg.load(url); await refitBg(); showBg(); redraw(); } catch (e) { Bg.clear(); }
  })();

  // 글꼴은 화면이 다 그려진 «뒤에» 불러온다 — 그러면 글자 폭이 인쇄물과 정확히 같아진다
  setTimeout(() => {
    KFont.load().then(redraw).catch((e) => {
      say('한글 글꼴을 찾지 못했습니다 — js/vendor/nanumgothic-bold.font.js 가 있는지 확인해 주세요.', 'err');
      console.error(e);
    });
  }, 60);
})();
