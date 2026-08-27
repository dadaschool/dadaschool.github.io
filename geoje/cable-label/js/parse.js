/* 입력한 글 → 라벨 목록으로 바꾸기.
   «한 줄 = 라벨 한 장» 이 기본이고, 줄 끝에 `*3` 을 붙이면 그 글자로 3장을 만든다.

   ⚠ `*3` 을 읽는 것은 «켜고 끌 수 있는» 기능이다(`star` 인수).
     라벨 이름에 별표가 실제로 들어갈 수도 있기 때문이다(예 : `*비상*`).
     끄면 줄에 적힌 글자를 그대로 쓴다.

   ⚠ 빈 줄은 «건너뛰기» 가 아니라 «그냥 없는 것» 으로 본다.
     빈 칸을 남기고 싶으면 그 자리를 마침표 하나(`.`)로 두는 것이 아니라
     화면의 「시작 칸」 을 옮긴다 — 그래야 이미 쓴 시트를 다시 쓸 수 있다.          */

/** 줄 끝의 `*3` `x3` `×3` 을 장수로 읽는다. 없으면 1장. */
function readCount(line) {
  const m = line.match(/^(.*?)\s*[*xX×]\s*(\d{1,3})\s*$/);
  if (!m) return { text: line.trim(), n: 1 };
  const n = parseInt(m[2], 10);
  const text = m[1].trim();
  // 글자가 없이 숫자만 남으면(예 : `*3`) 장수 표기로 보지 않는다
  if (!text || n < 1) return { text: line.trim(), n: 1 };
  return { text, n: Math.min(n, 300) };
}

/**
 * @param {string} raw    입력칸의 글 전체
 * @param {object} opt    { star:boolean 장수 표기 읽기, each:number 줄마다 몇 장 }
 * @returns {string[]}    라벨에 찍을 글자 목록 (칸 순서 그대로)
 */
window.parseLines = function parseLines(raw, opt) {
  const star = !!(opt && opt.star);
  const each = Math.max(1, Math.min(300, (opt && opt.each) || 1));
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.trim()) continue;                       // 빈 줄은 없는 것으로
    const { text, n } = star ? readCount(line) : { text: line.trim(), n: 1 };
    for (let i = 0; i < n * each; i++) out.push(text);
  }
  return out;
};

/**
 * 라벨 목록을 «장(page)» 으로 나눈다. 시작 칸 앞은 비워 둔다.
 * @param {string[]} texts
 * @param {number}   per    한 장에 들어가는 칸 수 (보통 30)
 * @param {number}   start  시작 칸 번호 (1 부터)
 * @returns {Array<Array<string|null>>}  장마다 길이 per 인 배열. 빈 칸은 null.
 */
window.layout = function layout(texts, per, start) {
  const s = Math.max(1, Math.min(per, start || 1));
  const cells = new Array(s - 1).fill(null).concat(texts);
  const pages = [];
  for (let i = 0; i < cells.length; i += per) {
    const page = cells.slice(i, i + per);
    while (page.length < per) page.push(null);
    pages.push(page);
  }
  if (!pages.length) pages.push(new Array(per).fill(null));
  return pages;
};
