/* «작업 파일» — 적어 둔 목록과 설정을 내 컴퓨터에 파일로 저장하고 다시 불러온다.

   왜 필요한가 : 지금까지는 `localStorage`(이 브라우저 안)에만 남았다. 그래서
     ① 브라우저 자료를 지우면 사라지고 ② 다른 PC·다른 브라우저로 옮길 수 없고
     ③ «작년 것» 과 «올해 것» 처럼 여러 벌을 따로 둘 수 없었다.
   파일로 두면 그 세 가지가 모두 해결되고, 선생님이 원하는 곳에 보관할 수 있다.

   ⚠ **이 파일은 화면(DOM)을 쓰지 않는다.** 순수한 계산만 담아서 브라우저 없이도
     검사할 수 있게 했다(`tools/검사/verify_pdf.cjs` 의 [3]).
   ⚠ **쓰던 시트 규격을 통째로 담는다.** 「원본 파일로 알아낸 규격」 으로 작업하다가
     저장했다면, 그 규격까지 파일에 들어 있어야 다른 PC 에서 열어도 그대로 인쇄된다.
   ⚠ **위치 미세조정(offx·offy)도 담는다.** 그것은 «프린터마다 다른 값» 이므로
     다른 PC 에서 열면 다시 맞춰야 할 수 있다 — 불러올 때 화면이 그렇게 알려 준다.
   ⚠ 파일은 **사람이 읽을 수 있는 JSON** 이다(메모장으로 열어 고칠 수도 있다).
     그래서 잘못된 파일을 넣었을 때 «왜 안 되는지» 를 분명히 말해야 한다. */

window.Work = (() => {
  const APP = 'cable-label';
  const VERSION = 1;

  /** 시트 규격이 «쓸 수 있는 모양» 인지 — 깨진 파일로 앱이 망가지지 않게 */
  function validSpec(s) {
    if (!s || typeof s !== 'object') return '시트 규격이 없습니다';
    const num = (v) => typeof v === 'number' && isFinite(v);
    if (!s.page || !num(s.page.w) || !num(s.page.h) || s.page.w < 20 || s.page.h < 20) {
      return '종이 크기가 이상합니다';
    }
    if (!s.head || !num(s.head.w) || !num(s.head.h) || s.head.w <= 0 || s.head.h <= 0) {
      return '글자 칸 크기가 이상합니다';
    }
    if (!Number.isInteger(s.cols) || s.cols < 1 || s.cols > 100) return '열 수가 이상합니다';
    if (!Number.isInteger(s.pairs) || s.pairs < 1 || s.pairs > 200) return '줄 수가 이상합니다';
    for (const k of ['colPitch', 'pairPitch', 'x0', 'y0']) {
      if (!num(s[k])) return `${k} 값이 이상합니다`;
    }
    if (s.tail && (!num(s.tail.w) || !num(s.tail.h) || !num(s.tail.inset))) {
      return '꼬리 값이 이상합니다';
    }
    if (s.inner && (!num(s.inner.dx) || !num(s.inner.dy))) return '맞물린 라벨 값이 이상합니다';
    return null;
  }

  const KEYS = ['star', 'each', 'start', 'size', 'align', 'both', 'which',
                'flip', 'outline', 'offx', 'offy', 'bgFit', 'bgOpacity'];

  /**
   * 저장할 내용을 만든다.
   * @param {object} state { sheet, sheets, texts, options, stamp }
   */
  function make(state) {
    const opt = {};
    for (const k of KEYS) if (state.options && state.options[k] !== undefined) opt[k] = state.options[k];
    return {
      app: APP,
      version: VERSION,
      설명: '라벨 만들기 — 작업 파일입니다. 앱의 「📂 불러오기」 에 이 파일을 넣으면 그대로 이어서 쓸 수 있습니다.',
      저장한때: state.stamp || '',
      sheet: state.sheet,          // 쓰던 시트 규격 (통째로 — 다른 PC 에서도 그대로 인쇄되게)
      sheets: state.sheets || {},  // 저장해 둔 다른 «알아낸 규격» 들도 함께 옮긴다
      texts: String(state.texts == null ? '' : state.texts),
      options: opt,
      /* 배경 그림도 함께 담는다 — 다른 PC 에서 열어도 같은 라벨이 나오게.
         ⚠ 줄여 둔 그림(긴 쪽 1000px)이라 작업 파일이 수백 KB 로 커진다. 그래도 «그림이 빠진
           작업 파일» 은 열었을 때 다른 것이 나오므로 담는 쪽이 맞다. */
      bg: typeof state.bg === 'string' && state.bg.startsWith('data:image/') ? state.bg : null,
    };
  }

  /** 파일에 쓸 글 */
  function toText(obj) { return JSON.stringify(obj, null, 1); }

  /**
   * 파일에서 읽은 글을 확인해서 돌려준다.
   * @returns {{ok:true, data:object} | {ok:false, why:string}}
   */
  function read(text) {
    let d;
    try {
      d = JSON.parse(String(text));
    } catch (e) {
      return { ok: false, why: '이 파일은 작업 파일이 아닙니다(읽을 수 없는 형식). 「💾 저장」 으로 만든 .json 파일을 넣어 주세요.' };
    }
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      return { ok: false, why: '이 파일은 작업 파일이 아닙니다.' };
    }
    if (d.app !== APP) {
      return { ok: false, why: '다른 프로그램의 파일 같습니다. 이 앱의 「💾 저장」 으로 만든 파일을 넣어 주세요.' };
    }
    if (!(d.version >= 1)) {
      return { ok: false, why: '작업 파일의 판을 알 수 없습니다.' };
    }
    if (d.version > VERSION) {
      return { ok: false, why: `더 새 판(${d.version})으로 저장된 파일입니다. 앱을 새로 받아 주세요.` };
    }
    const bad = validSpec(d.sheet);
    if (bad) return { ok: false, why: '작업 파일의 시트 규격이 온전하지 않습니다 — ' + bad + '.' };

    // 함께 담긴 다른 규격들 중 온전한 것만 살린다 (하나가 깨져도 나머지는 쓴다)
    const sheets = {};
    if (d.sheets && typeof d.sheets === 'object') {
      for (const k in d.sheets) if (!validSpec(d.sheets[k])) sheets[k] = d.sheets[k];
    }
    const options = {};
    if (d.options && typeof d.options === 'object') {
      for (const k of KEYS) if (d.options[k] !== undefined) options[k] = d.options[k];
    }
    return {
      ok: true,
      data: {
        sheet: d.sheet,
        sheets,
        texts: typeof d.texts === 'string' ? d.texts : '',
        options,
        // 그림이 아닌 것이 들어 있으면 조용히 버린다(깨진 파일로 화면이 망가지지 않게)
        bg: typeof d.bg === 'string' && d.bg.startsWith('data:image/') ? d.bg : null,
        savedAt: d.저장한때 || '',
      },
    };
  }

  return { APP, VERSION, KEYS, make, toText, read, validSpec };
})();
