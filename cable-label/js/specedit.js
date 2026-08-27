/* 시트 규격을 «손으로 고치는» 칸.  (2026-08-26 사용자 지시 —
   *"뭔가 자리가 안맞을때 수동조절하게 할수는 없나?"*)

   두 곳에서 같은 부품을 쓴다 :
     ① 「🔍 규격 알아내기」 결과 — 빨간 네모가 스캔과 어긋나면 그 자리에서 숫자를 고친다
     ② 「⓿ 라벨 시트」의 「✏️ 이 시트 규격 고치기」 — 인쇄해 보니 안 맞을 때 고친다
   숫자를 고치면 **곧바로 겹쳐 보기와 미리보기가 다시 그려진다** — 눈으로 맞추게 하는 것이 요령이다.

   ⚠ 「④ 인쇄 위치 맞추기」와 하는 일이 다르다.
     ④ 는 «종이 전체를 통째로 밀기»(프린터가 종이를 밀어 넣는 것을 메운다),
     여기는 «라벨 하나의 크기와 라벨끼리의 간격»(라벨지 자체의 치수)이다.
     둘을 합치지 말 것 — 원인이 다르고, ④ 는 라벨지를 바꿔도 그대로 쓴다.

   ⚠ 이 파일은 **화면을 그리기만** 한다. 값의 옳고 그름은 `Work.validSpec` 하나가 판정한다
     (작업 파일을 읽을 때와 같은 자를 쓰려는 것이다). */

window.SpecEdit = (() => {

  /** 고칠 수 있는 칸들 — `k` 는 점으로 이은 경로 */
  const FIELDS = [
    { k: 'cols',        label: '열 수 (가로로 몇 개)',  step: 1,    int: true },
    { k: 'pairs',       label: '줄 수 (세로로 몇 줄)',  step: 1,    int: true },
    { k: 'head.w',      label: '글자 칸 폭',            step: 0.05, unit: 'mm' },
    { k: 'head.h',      label: '글자 칸 높이',          step: 0.05, unit: 'mm' },
    { k: 'colPitch',    label: '열 간격 (칸 왼쪽끼리)', step: 0.05, unit: 'mm' },
    { k: 'x0',          label: '첫 열 왼쪽 여백',       step: 0.05, unit: 'mm' },
    { k: 'pairPitch',   label: '줄 간격 (칸 위끼리)',   step: 0.05, unit: 'mm' },
    { k: 'y0',          label: '첫 줄 위 여백',         step: 0.05, unit: 'mm' },
    { k: 'tail.w',      label: '꼬리 폭 (0 이면 없음)', step: 0.05, unit: 'mm' },
    { k: 'tail.h',      label: '꼬리 높이',             step: 0.05, unit: 'mm' },
    { k: 'tail.inset',  label: '꼬리가 들어간 깊이',    step: 0.05, unit: 'mm' },
    { k: 'inner.dx',    label: '맞물린 라벨 — 오른쪽으로', step: 0.05, unit: 'mm', inner: true },
    { k: 'inner.dy',    label: '맞물린 라벨 — 아래로',     step: 0.05, unit: 'mm', inner: true },
  ];

  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function set(o, path, v) {
    const ks = path.split('.');
    let cur = o;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!cur[ks[i]] || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    cur[ks[ks.length - 1]] = v;
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));

  /**
   * 화면에 고치는 칸들을 그린다.
   * @param {HTMLElement} host
   * @param {object} spec            지금 값
   * @param {function} onChange      (새 규격) => void   — 값이 바뀔 때마다 부른다
   * @returns {{ reset:function }}   「↺ 되돌리기」 를 밖에서도 부를 수 있게
   */
  function render(host, spec, onChange) {
    const first = clone(spec);
    let cur = clone(spec);
    host.textContent = '';

    const wrap = document.createElement('div');
    wrap.className = 'specedit';

    // 맞물린 두 번째 라벨이 있나 (없으면 그 두 칸을 숨긴다)
    const hasInner = !!cur.inner;
    const innerRow = document.createElement('label');
    innerRow.className = 'chk';
    const innerBox = document.createElement('input');
    innerBox.type = 'checkbox';
    innerBox.checked = hasInner;
    innerRow.appendChild(innerBox);
    innerRow.appendChild(document.createTextNode(' 라벨 두 장이 맞물려 있다 (깃발 라벨처럼)'));
    wrap.appendChild(innerRow);

    const grid = document.createElement('div');
    grid.className = 'specgrid';
    wrap.appendChild(grid);

    const inputs = [];
    for (const f of FIELDS) {
      const row = document.createElement('label');
      row.className = 'specrow' + (f.inner ? ' innerOnly' : '');
      const name = document.createElement('span');
      name.textContent = f.label;
      const box = document.createElement('input');
      box.type = 'number';
      box.step = f.step;
      const v = get(cur, f.k);
      box.value = v == null ? 0 : v;
      const unit = document.createElement('i');
      unit.textContent = f.unit || '';
      row.appendChild(name); row.appendChild(box); row.appendChild(unit);
      grid.appendChild(row);
      inputs.push({ f, box, row });
    }

    const bar = document.createElement('div');
    bar.className = 'row';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn ghost sm';
    reset.textContent = '↺ 처음 값으로';
    const note = document.createElement('span');
    note.className = 'specnote';
    bar.appendChild(reset); bar.appendChild(note);
    wrap.appendChild(bar);
    host.appendChild(wrap);

    function showInner() {
      for (const it of inputs) if (it.f.inner) it.row.hidden = !innerBox.checked;
    }

    function collect() {
      const next = clone(cur);
      next.inner = innerBox.checked ? (next.inner || { dx: 0, dy: 0 }) : null;
      for (const it of inputs) {
        if (it.f.inner && !innerBox.checked) continue;
        let v = parseFloat(it.box.value);
        if (!isFinite(v)) v = 0;
        if (it.f.int) v = Math.round(v);
        set(next, it.f.k, v);
      }
      if (!next.tail || !(next.tail.w > 0)) next.tail = { w: 0, h: 0, inset: 0 };
      return next;
    }

    function push() {
      const next = collect();
      const bad = window.Work ? window.Work.validSpec(next) : null;
      if (bad) {
        note.textContent = '⚠ ' + bad;
        note.className = 'specnote err';
        return;
      }
      const n = window.perSheet(next);
      note.textContent = `한 장에 ${n}칸`;
      note.className = 'specnote';
      cur = next;
      onChange(clone(next));
    }

    for (const it of inputs) it.box.addEventListener('input', push);
    innerBox.addEventListener('change', () => { showInner(); push(); });
    reset.addEventListener('click', () => {
      cur = clone(first);
      innerBox.checked = !!cur.inner;
      for (const it of inputs) {
        const v = get(cur, it.f.k);
        it.box.value = v == null ? 0 : v;
      }
      showInner();
      push();
    });

    showInner();
    note.textContent = `한 장에 ${window.perSheet(cur)}칸`;
    return { reset: () => reset.click() };
  }

  return { FIELDS, render, get, set };
})();
