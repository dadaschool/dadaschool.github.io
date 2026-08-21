/* 쪽 번호 해석과 표기 — 화면과 상관없는 순수 계산만 둔다(그래야 콘솔에서 바로 검사할 수 있다).
   ⚠ 이 파일의 쪽 번호는 모두 사람이 세는 방식(1부터)이다. pdf-lib 에 넘길 때만 1을 뺀다. */

/**
 * "1-3, 7, 20-" 같은 글을 범위 목록과 쪽 번호 목록으로 바꾼다.
 * @param {string} text  사용자가 적은 글
 * @param {number} total 원본의 전체 쪽수
 */
export function parseRanges(text, total) {
  const out = { ok: false, ranges: [], pages: [], errors: [] };
  if (!text || !text.trim()) return out;

  // 범위 기호(-, ~, 각종 대시) 둘레의 공백을 없애 "1 - 3" 도 한 덩어리가 되게 한다
  const tidy = text.replace(/\s*[-~–—∼]\s*/g, '-');
  const parts = tidy.split(/[\s,;]+/).filter(s => s.length > 0);

  for (const p of parts) {
    let from, to, m;

    if (/^\d+$/.test(p)) {                        // 5      → 한 쪽
      from = to = parseInt(p, 10);
    } else if ((m = p.match(/^(\d*)-(\d*)$/))) {  // 5-12, 20-, -3
      from = m[1] === '' ? 1 : parseInt(m[1], 10);
      to   = m[2] === '' ? total : parseInt(m[2], 10);
    } else {
      out.errors.push(`「${p}」는 쪽 번호로 읽을 수 없습니다.`);
      continue;
    }

    if (from > to) [from, to] = [to, from];       // 거꾸로 적어도 알아서 바로잡는다
    if (from < 1) from = 1;

    if (to > total) {
      out.errors.push(`「${p}」 — 이 PDF 는 ${total}쪽까지입니다.`);
      continue;
    }
    out.ranges.push(makeRange(from, to));
  }

  // 한 파일로 모을 때 쓸 쪽 목록 : 적은 순서 그대로, 겹치는 쪽은 한 번만
  const seen = new Set();
  for (const r of out.ranges) {
    for (let n = r.from; n <= r.to; n++) {
      if (!seen.has(n)) { seen.add(n); out.pages.push(n); }
    }
  }

  out.ok = out.errors.length === 0 && out.ranges.length > 0;
  return out;
}

export function makeRange(from, to) {
  return { from, to, text: from === to ? String(from) : `${from}-${to}` };
}

/** 쪽 번호 목록을 사람이 읽는 글로 줄인다. [1,2,3,7] → "1-3, 7" */
export function pagesToText(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(sorted[i] === sorted[j] ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return out.join(', ');
}

/** 범위 목록 → 자르는 자리. {5} 는 "5쪽 앞에서 자른다"는 뜻이다. */
export function rangesToCuts(ranges) {
  const cuts = new Set();
  for (const r of ranges) if (r.from > 1) cuts.add(r.from);
  return cuts;
}

/** 자르는 자리 → 범위 목록 (앞에서부터 빈틈없이 나눈다) */
export function cutsToRanges(cuts, total) {
  const points = [...cuts].filter(n => n > 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let start = 1;
  for (const p of points) { out.push(makeRange(start, p - 1)); start = p; }
  out.push(makeRange(start, total));
  return out;
}

/** n쪽마다 나눈 범위 목록. 2, 7 → 1-2, 3-4, 5-6, 7 */
export function everyN(n, total) {
  const out = [];
  for (let s = 1; s <= total; s += n) out.push(makeRange(s, Math.min(s + n - 1, total)));
  return out;
}

/** 범위 목록을 입력칸에 넣을 글로 바꾼다 */
export function rangesToText(ranges) {
  return ranges.map(r => r.text).join(', ');
}

/** 파일 이름에 쓸 수 없는 글자를 없애고 .pdf 를 뗀다 */
export function baseName(name) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'pdf';
}
