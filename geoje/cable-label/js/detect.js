/* 라벨 시트 «원본 파일»(스캔 그림)에서 라벨의 자리를 스스로 찾아낸다.
   이 파일이 하는 일은 2026-08-26 에 사람이 손으로 한 것과 똑같다 —
   빈 라벨 시트를 스캔해서 노란 라벨 30장을 하나하나 재어 js/sheet.js 의 숫자를 정했다.
   그것을 앱이 하게 만든 것이 이 파일이다(다른 라벨 시트를 사도 손으로 재지 않게).

   ── 하는 순서 ────────────────────────────────────────────────────
   ① 바탕색을 알아낸다      — 종이 네 변의 색 중앙값
   ② 바탕과 다른 점을 칠한다  — 임계값은 오츠 방법으로 저절로
   ③ 라벨을 찾는다          — **두 가지 길이 있다**(아래)
   ④ 덩어리를 머리·꼬리로 나눈다 — 얇은 띠가 «꼬리», 넓은 쪽이 «글자를 쓰는 머리»
   ⑤ 격자를 맞춘다          — 열 수·쌍 수·피치를 최소제곱으로 구한다

   ── 라벨을 찾는 두 가지 길 ────────────────────────────────────────
   **`solid`  — 색으로** : 칠해진 덩어리 하나가 라벨 한 장 (노란 깃발 라벨처럼)
   **`outline` — 윤곽선으로** : 칠해진 것이 «선» 이고, 그 선이 **둘러싼 안쪽**이 라벨
     (흰 주소 라벨지처럼 색 차이가 없고 칼선만 찍히는 시트)
   어느 길로 갈지는 «칠해진 넓이» 로 정한다 — 색 라벨은 종이의 30~90% 를 덮고,
   윤곽선만 있는 시트는 몇 % 뿐이다. 한쪽이 실패하면 다른 쪽도 해 본다.

   🔴 «못 찾았다» 라고 말하는 것이 «엉뚱한 숫자를 내놓는 것» 보다 훨씬 낫다.
     그래서 자잘한 검사를 여러 겹 두었다 — 라벨이 4장 이상인가 · 크기가 서로 비슷한가 ·
     열×줄 수를 곱한 값이 찾은 장수와 같은가. 하나라도 어긋나면 «못 찾았다» 로 끝낸다.
     (검사 목록은 tools/검사/verify_detect.cjs 의 [6] 에 있다.)

   ⚠ **머리·꼬리를 «가로·세로 두 방향으로 모두» 갈라 본다.** 처음에는 세로로만 갈랐는데,
     스캔이 90° 돌아가 있으면 꼬리가 머리보다 «길어» 져서 갈라지지 않았다
     (`tailUpright` 가 늘 거짓이 되어 앱이 그림을 스스로 바로 세우지 못했다).
   ⚠ 라벨 사이 틈이 좁은 시트(주소 라벨 등)는 스캔이 번져 두 장이 한 덩어리로 붙는다.
     그래서 격자가 안 맞으면 마스크를 **한 겹 깎아(erode)** 다시 해 본다.
   ⚠ 스캔은 늘 조금 비뚤다. 그래서 «라벨 하나하나» 를 쓰지 않고 **격자를 맞춘다**(최소제곱).
     비뚤어진 정도는 `skew` 로 알려 주고, 심하면 화면이 다시 스캔하라고 말한다.
   ⚠ 스캐너가 종이를 조금 늘여 먹었는지는 **아무도 알 수 없다.** 그래서 알아낸 숫자를
     그대로 믿지 않고, 앱의 「위치 미세조정」 을 그대로 남겨 둔다.
   ⚠ **윤곽선으로 찾으면 칸이 선 두께만큼 작게** 잡힌다. 그래도 «자리» 와 «글자의 가운데» 는
     정확하다(크기와 시작점이 같은 만큼 서로 상쇄된다). 크기가 작게 잡히는 쪽이 안전하므로
     굳이 늘려 맞추지 않는다 — 글자가 칸을 넘지 않는다.
   ⚠ 그래도 못 찾는 것이 있다 — **윤곽선조차 안 찍힌 시트**(너무 밝게 스캔한 경우)와
     **선이 끊겨 안쪽이 바깥과 이어진 시트.** 그때는 실패라고 말한다. */

window.Detect = (() => {

  /** 오츠 방법 — 값 히스토그램을 두 덩어리로 가장 잘 가르는 임계값 */
  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, bestVar = -1;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > bestVar) { bestVar = v; best = t; }
    }
    return best;
  }

  /** 바탕색 = 종이 네 변(바깥 2%) 픽셀의 중앙값 */
  function background(px, w, h) {
    const ring = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    const r = [], g = [], b = [];
    const take = (x, y) => { const i = (y * w + x) * 4; r.push(px[i]); g.push(px[i + 1]); b.push(px[i + 2]); };
    for (let y = 0; y < h; y += 2) for (let x = 0; x < ring; x++) { take(x, y); take(w - 1 - x, y); }
    for (let x = 0; x < w; x += 2) for (let y = 0; y < ring; y++) { take(x, y); take(x, h - 1 - y); }
    const mid = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    return [mid(r), mid(g), mid(b)];
  }

  /** 라벨 자리를 칠한다 (1 = 라벨, 0 = 종이)
   *  @param {number} [cut]  임계값을 밖에서 정할 때 (없으면 오츠로 저절로) */
  function mask(px, w, h, cut) {
    const bg = background(px, w, h);
    const dist = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      // 색 «거리» — 채널마다 얼마나 다른지 중 가장 큰 값. 노란 라벨은 파랑이 크게 다르다.
      const d = Math.max(Math.abs(px[p] - bg[0]), Math.abs(px[p + 1] - bg[1]), Math.abs(px[p + 2] - bg[2]));
      dist[i] = d; hist[d]++;
    }
    // 임계값 : 오츠로 고르되 너무 낮으면 종이의 얼룩까지 잡으므로 24 아래로는 내리지 않는다
    const auto = Math.max(24, otsu(hist, w * h));
    const th = cut == null ? auto : Math.max(auto, cut);
    const m = new Uint8Array(w * h);
    let on = 0;
    for (let i = 0; i < w * h; i++) if (dist[i] > th) { m[i] = 1; on++; }
    return { m, on, th, bg };
  }

  /** 마스크를 한 겹 깎는다 — 좁은 틈으로 붙어 버린 라벨을 떼어 놓기 위해 */
  function erode(m, w, h) {
    const o = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w]) o[i] = 1;
      }
    }
    return o;
  }

  /** 마스크를 한 겹 불린다 — 스캔에서 끊어진 얇은 선을 이어 붙이기 위해 */
  function dilate(m, w, h, times) {
    let cur = m;
    for (let t = 0; t < (times || 1); t++) {
      const o = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (cur[i]
              || (x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1])
              || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) o[i] = 1;
        }
      }
      cur = o;
    }
    return cur;
  }

  /** 잇닿은 덩어리 찾기 (4방향) */
  function blobs(m, w, h, minPx) {
    const seen = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    const out = [];
    for (let s = 0; s < w * h; s++) {
      if (!m[s] || seen[s]) continue;
      let top = 0; stack[top++] = s; seen[s] = 1;
      const pts = [];
      while (top) {
        const i = stack[--top];
        pts.push(i);
        const x = i % w;
        const y = (i - x) / w;
        if (x > 0     && m[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
        if (x < w - 1 && m[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
        if (y > 0     && m[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
        if (y < h - 1 && m[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
      }
      if (pts.length >= minPx) out.push(pts);
    }
    return out;
  }

  /** «선으로 둘러싸인 빈 칸» 을 찾는다 — 흰 라벨지를 위한 길.
   *
   *  🔴 흰 라벨을 흰 종이에 붙인 시트는 «색» 으로는 찾을 수 없다. 하지만 라벨을 떼어 내는
   *    **칼선(윤곽선)이 스캔에 얇은 선으로 찍힌다.** 그래서 색이 아니라 «선» 을 찾고,
   *    그 선이 **둘러싼 안쪽**을 라벨로 본다(표에서 칸을 찾는 것과 같은 방법).
   *
   *  ⚠ 그림 가장자리에 닿은 덩어리는 «종이의 바깥» 이므로 버린다.
   *  ⚠ 선이 한 곳이라도 끊기면 그 라벨의 안쪽이 바깥과 이어져 사라진다. 그래서 부르는 쪽이
   *    선 마스크를 **한 겹 불려서(dilate)** 넘긴다 — 끊긴 자리를 메우려는 것이다.
   *  ⚠ 이렇게 재면 라벨이 «선 두께 + 불린 만큼» 작게 나온다. 그래도 **간격(피치)은 정확하고
   *    글자의 가운데도 정확하다**(자리와 크기가 같은 만큼 서로 상쇄된다). 크기만 조금
   *    작게 잡히는 쪽이 안전하다 — 글자가 칸을 넘지 않는다.                            */
  function holes(m, w, h, minPx) {
    const inv = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) inv[i] = m[i] ? 0 : 1;
    return blobs(inv, w, h, minPx).filter((pts) => {
      // 그림 가장자리에 닿았으면 종이 바깥이다
      for (const i of pts) {
        const x = i % w, y = (i - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return false;
      }
      return true;
    });
  }

  /* ── 덩어리 하나를 머리·꼬리로 나누기 ──────────────────────────
     `byRow` 가 거짓이면 «세로줄마다» 재어 옆에 붙은 꼬리를 찾고,
     참이면 «가로줄마다» 재어 위·아래에 붙은 꼬리를 찾는다.
     스캔이 90° 돌아가 있어도 알아보게 하려고 둘 다 해 본다.            */

  function profile(pts, w, byRow) {
    const lo = new Map(), hi = new Map();
    for (const i of pts) {
      const x = i % w;
      const y = (i - x) / w;
      const k = byRow ? y : x;
      const v = byRow ? x : y;
      const a = lo.get(k), b = hi.get(k);
      if (a === undefined || v < a) lo.set(k, v);
      if (b === undefined || v > b) hi.set(k, v);
    }
    return { lo, hi };
  }

  /** 잇닿은 칸 묶음 중 «가장 긴 것» 만 남긴다.
   *  ⚠ 이것이 없으면 비뚤어진 스캔에서 무너진다 — 머리의 양쪽 끝 칸이 살짝 얇아져
   *    «얇은 쪽» 에 끼면, 꼬리 네모가 라벨 전체 폭으로 벌어져 가름이 깨진다
   *    (0.5° 비뚤어진 그림에서 실제로 그랬다). 잇닿은 것만 보면 그 일이 없다.        */
  function longestRun(keys) {
    if (!keys.length) return [];
    const s = keys.slice().sort((a, b) => a - b);
    let best = [s[0]], cur = [s[0]];
    for (let i = 1; i < s.length; i++) {
      if (s[i] === s[i - 1] + 1) cur.push(s[i]);
      else { if (cur.length > best.length) best = cur; cur = [s[i]]; }
    }
    return cur.length > best.length ? cur : best;
  }

  /** 프로파일을 «두꺼운 쪽(머리)» 과 «얇은 쪽(꼬리)» 으로 가른다 */
  function split(p, byRow) {
    let maxLen = 0;
    for (const k of p.lo.keys()) maxLen = Math.max(maxLen, p.hi.get(k) - p.lo.get(k) + 1);
    const bigAll = [], smallAll = [];
    for (const k of p.lo.keys()) {
      ((p.hi.get(k) - p.lo.get(k) + 1) >= maxLen * 0.7 ? bigAll : smallAll).push(k);
    }
    const big = longestRun(bigAll), small = longestRun(smallAll);
    const box = (ks) => {
      if (!ks.length) return null;
      let k0 = Infinity, k1 = -Infinity, v0 = Infinity, v1 = -Infinity, fill = 0;
      for (const k of ks) {
        k0 = Math.min(k0, k); k1 = Math.max(k1, k);
        v0 = Math.min(v0, p.lo.get(k)); v1 = Math.max(v1, p.hi.get(k));
        fill += p.hi.get(k) - p.lo.get(k) + 1;
      }
      const b = byRow
        ? { x: v0, y: k0, w: v1 - v0 + 1, h: k1 - k0 + 1 }
        : { x: k0, y: v0, w: k1 - k0 + 1, h: v1 - v0 + 1 };
      b.fill = fill / (b.w * b.h);            // 이 네모가 «꽉 찼는가» (1 이면 완전한 네모)
      return b;
    };
    return { head: box(big), tail: box(small) };
  }

  /** 꼬리로 인정할 만한 모양인가 — 머리에 붙은 «얇고 긴 띠» 여야 한다
   *  ⚠ byRow 에 따라 «두께» 와 «길이» 가 어느 변인지 바뀐다. 한 번 거꾸로 썼다가
   *    비뚤어진 스캔에서 꼬리를 못 알아보고 라벨 전체를 머리로 잡았다.               */
  function tailOk(head, tail, byRow) {
    if (!head || !tail) return false;
    const thick     = byRow ? tail.w : tail.h;      // 띠의 두께 (머리와 맞닿은 변을 가로지르는 쪽)
    const long      = byRow ? tail.h : tail.w;      // 띠의 길이 (머리에서 뻗어 나가는 쪽)
    const headThick = byRow ? head.w : head.h;
    // 꼬리는 ① 머리보다 얇고 ② 두께보다 길어야 한다(케이블을 감는 «긴 띠» 이므로).
    // ②가 없으면 «머리+꼬리 띠» 를 머리로, «머리만 있는 띠» 를 꼬리로 보는
    //   엉뚱한 가름이 통과해 버린다(비뚤어진 스캔에서 실제로 그랬다).
    return thick > headThick * 0.08 && thick < headThick * 0.9
        && long > thick * 1.2;
  }
  /** 꼬리가 얼마나 «길고 얇은가» — 두 가름 중 어느 쪽이 맞는지 고르는 잣대 */
  function elong(head, tail, byRow) {
    if (!head || !tail) return 0;
    const thick = byRow ? tail.w : tail.h;
    const long  = byRow ? tail.h : tail.w;
    return thick > 0 ? long / thick : 0;
  }

  function shape(pts, w) {
    const byCol = split(profile(pts, w, false), false);
    const byRow = split(profile(pts, w, true), true);
    const colOk = tailOk(byCol.head, byCol.tail, false);
    const rowOk = tailOk(byRow.head, byRow.tail, true);

    // 어느 쪽으로 가른 것이 맞나 — «꼬리가 더 길고 얇게 나오는» 쪽이 맞다.
    // ⚠ «네모가 꽉 찼는가»(fill)로 견주면 안 된다. 깔끔한 그림에서는 두 쪽이 똑같이 1.0 이라
    //   비기고, 스캔이 조금만 비뚤어지면 순서가 뒤집혀 «그림이 90° 돌아갔다» 고 거짓으로
    //   알려 준다(0.5° 비뚤어진 그림에서 30장 중 18장이 그렇게 뒤집혔다).
    const score = (s, byRow) => elong(s.head, s.tail, byRow);

    let pick = null, upright = false;
    if (colOk && rowOk) {
      if (score(byCol, false) >= score(byRow, true)) pick = byCol;
      else { pick = byRow; upright = true; }
    } else if (colOk) pick = byCol;
    else if (rowOk) { pick = byRow; upright = true; }

    if (!pick) {
      // 꼬리가 없는 네모난 라벨 — 덩어리 전체가 머리다
      const p = profile(pts, w, false);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of p.lo.keys()) {
        x0 = Math.min(x0, k); x1 = Math.max(x1, k);
        y0 = Math.min(y0, p.lo.get(k)); y1 = Math.max(y1, p.hi.get(k));
      }
      return { head: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, tail: null, side: 'L',
               upright: false, area: pts.length };
    }

    const head = pick.head, tail = pick.tail;
    // 꼬리가 머리의 어느 쪽에 붙었나 (돌아간 그림이면 위·아래로 붙는다)
    const side = upright
      ? (tail.y > head.y ? 'L' : 'R')
      : (tail.x > head.x ? 'L' : 'R');
    return { head, tail, side, upright, area: pts.length };
  }

  /* ── 격자 맞추기 ───────────────────────────────────────────── */

  /** 값들을 «가까운 것끼리» 묶는다 (gap 보다 벌어지면 다른 묶음) */
  function cluster(vals, gap) {
    const s = vals.slice().sort((a, b) => a.v - b.v);
    const groups = [];
    for (const it of s) {
      const g = groups[groups.length - 1];
      if (g && it.v - g.last <= gap) { g.items.push(it); g.last = it.v; }
      else groups.push({ items: [it], last: it.v });
    }
    return groups.map((g) => ({
      mean: g.items.reduce((a, b) => a + b.v, 0) / g.items.length,
      items: g.items,
    }));
  }

  /** (번호, 값) 들에 직선을 맞춘다 → { start, pitch, maxErr, avgErr } */
  function fitLine(points) {
    const n = points.length;
    if (n === 1) return { start: points[0].v, pitch: 0, maxErr: 0, avgErr: 0 };
    let si = 0, sv = 0, sii = 0, siv = 0;
    for (const p of points) { si += p.i; sv += p.v; sii += p.i * p.i; siv += p.i * p.v; }
    const den = n * sii - si * si;
    const pitch = den === 0 ? 0 : (n * siv - si * sv) / den;
    const start = (sv - pitch * si) / n;
    let maxErr = 0, sum = 0;
    for (const p of points) {
      const e = Math.abs(p.v - (start + pitch * p.i));
      sum += e;
      if (e > maxErr) maxErr = e;
    }
    return { start, pitch, maxErr, avgErr: sum / n };
  }

  /** **가장 고르게** 나누는 격자를 찾는다 — 오차가 더 줄지 않을 때까지 되풀이한다.
   *
   *  왜 필요한가 (2026-08-26 사용자 지시 — *"라벨이 고르지 않는 경우 스스로 최대한 오차가
   *  작게 균일하게 나눠서 라벨위치를 잡아봐"*) : 처음에는 «가까운 것끼리 묶기(cluster)» 로
   *  칸 번호를 정하고 그 **묶음의 평균**에 직선을 맞췄다. 스캔이 비뚤거나 라벨 하나가
   *  조금 밀려 있으면 **묶기가 어긋나** 오차가 커졌다(실제로 3.7mm 가 나왔다).
   *
   *  고친 방법 — 라플로이드(Lloyd) 되풀이 :
   *    ① 지금 직선으로 각 라벨의 «칸 번호» 를 다시 정한다(가장 가까운 번호로)
   *    ② 그 번호로 **라벨 하나하나에** 직선을 다시 맞춘다(묶음 평균이 아니라)
   *    ③ 값이 움직이지 않을 때까지 되풀이한다
   *  이렇게 하면 «가장 고르게 나눈 격자» 로 수렴한다.
   *
   *  ⚠ 되풀이하다 **빈 번호가 생기면(어떤 줄에 라벨이 하나도 없으면) 실패로 돌린다.**
   *    그러면 칸 수가 틀린 것이고, 억지로 맞추면 «그럴싸한 오답» 이 된다.
   *
   *  @returns {{start,pitch,maxErr,avgErr,idx:number[]}|null}
   */
  function refine(values, count, start, pitch) {
    let s = start, p = pitch;
    if (count === 1) return { start: s, pitch: 0, maxErr: 0, avgErr: 0, idx: values.map(() => 0) };
    let idx = null;
    for (let it = 0; it < 40; it++) {
      const step = p || 1;
      const pts = values.map((v) => ({
        i: Math.max(0, Math.min(count - 1, Math.round((v - s) / step))), v,
      }));
      const used = new Set(pts.map((q) => q.i));
      if (used.size !== count) return null;          // 빈 줄이 생겼다 → 칸 수가 틀렸다
      const f = fitLine(pts);
      const moved = Math.abs(f.start - s) + Math.abs(f.pitch - p);
      s = f.start; p = f.pitch;
      idx = pts.map((q) => q.i);
      if (moved < 1e-7) break;
    }
    const f = fitLine(values.map((v, k) => ({ i: idx[k], v })));
    return { start: f.start, pitch: f.pitch, maxErr: f.maxErr, avgErr: f.avgErr, idx };
  }

  /** 마스크를 임의 각도로 돌린다 — 비뚤어진 스캔을 바로 세워 다시 재기 위해 */
  function rotateMask(m, w, h, deg) {
    const o = new Uint8Array(w * h);
    const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const sx = Math.round(cx + dx * c + dy * sn);
        const sy = Math.round(cy - dx * sn + dy * c);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h && m[sy * w + sx]) o[y * w + x] = 1;
      }
    }
    return o;
  }

  const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
  const r2 = (v) => Math.round(v * 20) / 20;      // 0.05mm 로 맞춘다

  /** 마스크 하나로 규격을 알아내 본다
   * @param {'solid'|'outline'} mode  'solid' = 색이 다른 덩어리가 라벨 ·
   *                                  'outline' = 선으로 둘러싸인 안쪽이 라벨
   * @param {number} grow  잰 네모를 사방으로 몇 픽셀 늘려 되돌릴지
   */
  function attempt(m, W, H, paper, grow, mode) {
    const mmx = paper.w / W, mmy = paper.h / H;
    const info = { grow: grow || 0, mode: mode || 'solid' };

    const raw = mode === 'outline' ? holes(m, W, H, 40) : blobs(m, W, H, 40);
    let found = raw.map((p) => shape(p, W));
    if (!found.length) return { ok: false, why: '라벨 모양을 찾지 못했습니다.', info };
    const big = Math.max(...found.map((f) => f.area));
    found = found.filter((f) => f.area >= big / 8);
    found = found.filter((f) => f.head.w < W * 0.9 || f.head.h < H * 0.9);
    info.count = found.length;

    if (found.length < 4) {
      return { ok: false, why: `라벨을 ${found.length}장만 찾았습니다. 라벨 시트라면 적어도 네 장은 보여야 합니다 — 아무것도 쓰지 않은 빈 시트를 종이 전체가 나오게 스캔한 그림이어야 합니다.`, info };
    }

    // 깎거나(erode) 선을 불려서(dilate) 쟀으면 그만큼 사방으로 되돌린다
    const g = grow || 0;
    const toMm = (b) => b && {
      x: (b.x - g) * mmx, y: (b.y - g) * mmy,
      w: (b.w + g * 2) * mmx, h: (b.h + g * 2) * mmy,
    };
    const items = found.map((f) => ({ head: toMm(f.head), tail: toMm(f.tail), side: f.side, upright: f.upright }));

    const headW = med(items.map((i) => i.head.w));
    const headH = med(items.map((i) => i.head.h));

    /* 🔴 «라벨일 수 없는 크기» 는 거절한다.
         종이 높이의 98% 나 되는 칸을 «라벨 4장» 이라고 내놓은 일이 있다(사용자 화면 —
         라벨 시트가 아닌 그림을 넣었을 때). 라벨은 한 장에 여러 개 붙어 있는 것이므로
         한 칸이 종이의 한 변을 거의 다 차지할 수는 없다. */
    if (headW > paper.w * 0.85 || headH > paper.h * 0.85) {
      return { ok: false, why: `찾은 칸(${headW.toFixed(0)} × ${headH.toFixed(0)}mm)이 종이(${paper.w} × ${paper.h}mm)에 비해 너무 큽니다 — 라벨 시트가 아닌 그림일 수 있습니다. 아무것도 쓰지 않은 빈 라벨 시트를 종이 전체가 나오게 스캔한 그림을 넣어 주세요.`, info };
    }

    // 라벨 크기가 서로 많이 다르면 «두 장이 붙었거나» 엉뚱한 것을 잡은 것이다
    const odd = items.filter((i) => Math.abs(i.head.w - headW) > headW * 0.2
                                 || Math.abs(i.head.h - headH) > headH * 0.2);
    if (odd.length) {
      return { ok: false, why: `라벨 ${odd.length}장의 크기가 나머지와 많이 다릅니다(가운뎃값 ${headW.toFixed(1)} × ${headH.toFixed(1)}mm). 라벨끼리 붙어 보이거나 접힘·그림자·워터마크가 칸을 끊었을 수 있습니다 — 빈 시트를 평평하게 놓고 다시 스캔해 보세요. 그래도 안 되면 「✏️ 이 시트 규격 고치기」 에서 자를 대고 잰 숫자를 직접 넣어도 됩니다.`, info };
    }

    const L = items.filter((i) => i.side === 'L');
    const R = items.filter((i) => i.side === 'R');
    if (!L.length) return { ok: false, why: '라벨의 방향을 알아내지 못했습니다.', info };

    const colsL = cluster(L.map((i) => ({ v: i.head.x, i })), headW * 0.5);
    const rowsL = cluster(L.map((i) => ({ v: i.head.y, i })), headH * 0.5);
    info.cols = colsL.length;
    info.pairs = rowsL.length;

    if (L.length !== colsL.length * rowsL.length) {
      return { ok: false, why: `라벨이 고르게 놓이지 않았습니다 (${colsL.length}열 × ${rowsL.length}줄 이면 ${colsL.length * rowsL.length}장이어야 하는데 ${L.length}장을 찾았습니다). 스캔에 접힘·그림자·글씨가 있으면 이렇게 됩니다 — 아무것도 쓰지 않은 시트를 평평하게 놓고 다시 스캔해 보세요. 그래도 안 되면 「✏️ 이 시트 규격 고치기」 에서 자를 대고 잰 숫자를 직접 넣어도 됩니다.`, info };
    }

    // «가장 고르게» 나누는 격자로 다듬는다 (묶음 평균이 아니라 라벨 하나하나로 · 위 refine 주석)
    const seedX = fitLine(colsL.map((g2, k) => ({ i: k, v: g2.mean })));
    const seedY = fitLine(rowsL.map((g2, k) => ({ i: k, v: g2.mean })));
    const fx = refine(L.map((i) => i.head.x), colsL.length, seedX.start, seedX.pitch) || seedX;
    const fy = refine(L.map((i) => i.head.y), rowsL.length, seedY.start, seedY.pitch) || seedY;
    info.gridErr = Math.max(fx.maxErr, fy.maxErr);
    info.avgErr = Math.max(fx.avgErr || 0, fy.avgErr || 0);

    /* 🔴 **격자가 정말 맞는지 확인한다.** 이 관문이 없어서 «18장 3열×6줄 · 어긋남 17.46mm» 를
         정답으로 받아들인 일이 있다(칸을 끊는 접힘선 때문에 한 줄이 사라졌는데, 남은 6줄이
         3×6=18 로 «수가 맞아» 통과했다). 고르게 다듬은 뒤에도 이만큼 어긋난다면 그것은
         라벨지의 격자가 아니다 — «못 찾았다» 로 끝내고 다음 방법을 해 보게 한다.
       ⚠ 실제 스캔은 0.4mm, 1° 비뚤어진 그림도 0.23mm 였다. 2mm 는 넉넉한 문턱이다. */
    if (info.gridErr > 2.0) {
      return { ok: false, why: `라벨이 고른 격자를 이루지 않습니다(어긋남 ${info.gridErr.toFixed(1)}mm). 접힘·워터마크가 칸을 끊었거나 라벨 시트가 아닌 그림일 수 있습니다 — 빈 시트를 평평하게 놓고 다시 스캔해 보세요. 그래도 안 되면 「✏️ 이 시트 규격 고치기」 에서 자를 대고 잰 숫자를 직접 넣어도 됩니다.`, info };
    }

    let inner = null;
    if (R.length) {
      const colsR = cluster(R.map((i) => ({ v: i.head.x, i })), headW * 0.5);
      const rowsR = cluster(R.map((i) => ({ v: i.head.y, i })), headH * 0.5);
      if (colsR.length !== colsL.length || rowsR.length !== rowsL.length
          || R.length !== L.length) {
        return { ok: false, why: '맞물린 두 번째 라벨의 수가 첫 번째와 다릅니다. 시트 전체가 나오게 다시 스캔해 주세요.', info };
      }
      // ⚠ 맞물린 라벨의 «떨어진 거리» 는 다듬어 놓은 격자에서 잰다.
      //   묶음 평균끼리 견주면 그 묶음의 어긋남이 그대로 섞여 들어간다.
      const near = (v, f, n) => f.start + f.pitch * Math.max(0, Math.min(n - 1,
        Math.round((v - f.start) / (f.pitch || 1))));
      inner = {
        dx: med(R.map((i) => i.head.x - near(i.head.x, fx, colsL.length))),
        dy: med(R.map((i) => i.head.y - near(i.head.y, fy, rowsL.length))),
      };
    }

    const tails = items.filter((i) => i.tail);
    let tail = null;
    if (tails.length >= items.length / 2) {
      tail = {
        w: med(tails.map((i) => i.tail.w)),
        h: med(tails.map((i) => i.tail.h)),
        inset: med(tails.map((i) => (i.side === 'L'
          ? i.tail.y - i.head.y
          : (i.head.y + i.head.h) - (i.tail.y + i.tail.h)))),
      };
    }
    // 꼬리가 위·아래로 붙어 있으면 그림이 90° 돌아간 것이다 — 부르는 쪽이 돌려 다시 부른다
    info.tailUpright = tails.length > 0 && tails.filter((i) => i.upright).length > tails.length / 2;

    // 비뚤어진 정도 — 같은 열에서 아래로 내려갈 때 x 가 얼마나 밀리는가
    let skew = 0;
    for (const g2 of colsL) {
      const arr = g2.items.map((it) => it.i.head).sort((a, b) => a.y - b.y);
      if (arr.length < 2) continue;
      const dy = arr[arr.length - 1].y - arr[0].y;
      if (dy > 1) skew = Math.max(skew, Math.abs(Math.atan2(arr[arr.length - 1].x - arr[0].x, dy) * 180 / Math.PI));
    }
    info.skew = skew;

    info.found = items.length;
    const spec = {
      key: 'custom-' + items.length,
      name: `알아낸 규격 · ${paper.w > paper.h ? 'A4 가로' : 'A4 세로'} · ${items.length}장 (${colsL.length}열 × ${rowsL.length}${inner ? '쌍' : '줄'})`,
      page: { w: paper.w, h: paper.h },
      head: { w: r2(headW), h: r2(headH) },
      tail: tail ? { w: r2(tail.w), h: r2(tail.h), inset: r2(Math.max(0, tail.inset)) }
                 : { w: 0, h: 0, inset: 0 },
      cols: colsL.length, colPitch: r2(fx.pitch || paper.w), x0: r2(fx.start),
      pairs: rowsL.length, pairPitch: r2(fy.pitch || paper.h), y0: r2(fy.start),
      inner: inner ? { dx: r2(inner.dx), dy: r2(inner.dy) } : null,
      detected: true,
    };
    return { ok: true, spec, found: items, info };
  }

  /**
   * 그림에서 라벨 시트 규격을 알아낸다.
   * @param {{width:number,height:number,data:Uint8ClampedArray}} img  종이 전체를 담은 그림
   * @param {{w:number,h:number}} paper  종이 크기 (mm)
   * @returns {{ok:boolean, why?:string, spec?:object, found?:Array, info?:object}}
   */
  function run(img, paper) {
    const W = img.width, H = img.height;
    const { m, on, th, bg } = mask(img.data, W, H);
    const base = { threshold: th, background: bg, coverage: on / (W * H) };

    if (base.coverage < 0.002) {
      return { ok: false, info: base,
        why: '그림에서 라벨도 윤곽선도 찾지 못했습니다. 종이 전체가 나오게 스캔한 그림인지, 너무 밝게 스캔되지 않았는지 확인해 주세요.' };
    }
    if (base.coverage > 0.95) {
      return { ok: false, info: base,
        why: '그림 거의 전체가 라벨로 보입니다. 종이 바깥까지 스캔되었거나 바탕이 어두운 그림일 수 있습니다 — 종이만 나오게 다시 스캔해 주세요.' };
    }

    /* 세 가지 길을 차례로 해 본다. 먼저 되는 것을 쓴다.
       ① solid   — 색이 다른 «덩어리» 가 라벨 (노란 깃발 라벨처럼)
       ② outline — «선으로 둘러싸인 안쪽» 이 라벨 (흰 라벨지처럼 · 칼선만 찍힌다)
       ③ erode   — 라벨끼리 좁은 틈으로 붙어 버린 경우 (주소 라벨처럼 틈이 1mm)
       ⚠ 순서는 «칠해진 넓이» 로 정한다. 색 라벨은 종이의 30~90% 를 덮고,
         윤곽선만 있는 시트는 몇 % 뿐이다. 순서를 뒤집으면 색 라벨 시트에서
         «라벨 사이의 빈 자리» 를 라벨로 잡는 엉뚱한 답이 먼저 나올 수 있다.        */
    const line = dilate(m, W, H, 2);
    /* «진한 잉크만» 보는 마스크 — 마지막 대비책.
       옅은 접힘 자국·워터마크가 라벨 칸을 끊어 놓았을 때, 임계값을 올리면 그것만 떨어져 나가고
       인쇄된 칼선은 남는다. 진한 자국이면 이것도 실패하는데, 그때는 «못 찾았다» 가 맞다. */
    const strongCut = Math.min(200, th + Math.round((255 - th) * 0.45));
    const strong = mask(img.data, W, H, strongCut);
    /* ⚠ 강한 마스크는 **세 겹** 불린다(보통은 두 겹). 임계값을 올리면 인쇄된 칼선도 함께
         얇아져 군데군데 끊기고, 그러면 그 칸의 안쪽이 바깥과 이어져 사라진다.
         실제로 재어 보니 두 겹으로는 21칸 중 18칸만 찾았고, 세 겹으로는 21칸을 모두 찾았다. */
    const strongLine = dilate(strong.m, W, H, 3);

    const ways = base.coverage < 0.15
      ? [['outline', line, 3], ['solid', m, 0], ['solid', erode(m, W, H), 1],
         ['outline', strongLine, 4], ['solid', strong.m, 0]]
      : [['solid', m, 0], ['solid', erode(m, W, H), 1], ['outline', line, 3],
         ['solid', strong.m, 0], ['outline', strongLine, 4]];

    let res = null, used = null;
    const tried = [];
    for (const [mode, mm2, grow] of ways) {
      const r = attempt(mm2, W, H, paper, grow, mode);
      if (r.ok) { res = r; used = { mode, m: mm2, grow }; break; }
      tried.push(mode + (grow ? '+' + grow : '') + ': ' + (r.why || '').slice(0, 40));
      if (!res) res = r;                       // 다 안 되면 첫 번째 이유를 보여 준다
    }

    /* 비뚤어진 스캔은 **바로 세워 다시 재면** 훨씬 고르게 나온다.
       (스캔이 θ 만큼 돌아가 있으면 곧은 격자로는 종이 높이 × tanθ 만큼 어긋날 수밖에 없다.
        실제 시트는 곧으므로, 마스크를 되돌려 재는 것이 «참값» 에 가깝다.)
       ⚠ 어느 쪽으로 돌려야 하는지는 부호가 헷갈리기 쉬워 **양쪽 다 해 보고 더 고른 쪽**을 쓴다.
       ⚠ 성공한 뒤에만 한다(마스크·방식이 정해진 뒤라 두 번만 더 재면 된다). */
    if (res && res.ok && res.info.skew > 0.12) {
      const found = res.info.skew;              // 스캔이 비뚤어진 정도 (사람에게 알려 줄 값)
      let best = res;
      for (const sign of [-1, 1]) {
        const r2 = attempt(rotateMask(used.m, W, H, sign * found),
                           W, H, paper, used.grow, used.mode);
        if (r2.ok && r2.info.gridErr < best.info.gridErr - 0.02) {
          r2.info.deskew = sign * found;
          best = r2;
        }
      }
      // ⚠ `skew` 는 늘 «스캔이 얼마나 비뚤었나» 로 둔다. 바로 세운 뒤의 «남은 비뚤어짐» 을
      //   그 자리에 넣으면, 화면이 «비뚤지 않다» 고 말해 버려 사람이 다시 스캔할 판단을 못 한다.
      if (best !== res) {
        best.info.skewLeft = best.info.skew;
        best.info.skew = found;
      }
      res = best;
    }

    res.info = Object.assign({}, base, res.info, { tried });
    return res;
  }

  return { run, mask, erode, dilate, holes, blobs, shape, cluster, fitLine, refine, rotateMask,
           otsu, attempt, longestRun };
})();
