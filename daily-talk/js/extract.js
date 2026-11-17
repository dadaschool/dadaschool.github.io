// 자료에서 글자 뽑기 (설계서 「4-12」 넣는 방법)
//   TXT · MD — 그대로 / DOCX(워드) · HWPX(새 한글) — zip 을 풀어 본문 XML 에서 글자만 / 사진 — 줄여서 AI 에게 보낼 그림 주소로
//   PDF · HWP(예전 한글) · PPTX 등은 업스테이지 Document Parse 가 생기면 연다 — 지금은 «글자를 복사해 붙여넣어 주세요».
import { loadFflate } from './upgrade.js';

export const MAX_FILE = 15 * 1024 * 1024;

const ext = (name) => (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

function decodeXmlText(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

// <w:p> … <w:t>글자</w:t> … </w:p> 처럼 문단 · 글자 태그로 된 XML 에서 글자만
function xmlParagraphs(xml, para, run, extra = []) {
  const out = [];
  const pRe = new RegExp(`<${para}[\\s>][\\s\\S]*?</${para}>`, 'g');
  const tRe = new RegExp(`<${run}(?:\\s[^>]*)?>([\\s\\S]*?)</${run}>|<(${extra.join('|') || 'x-none'})\\b[^>]*/>`, 'g');
  for (const p of xml.match(pRe) || []) {
    let line = '';
    for (const m of p.matchAll(tRe)) line += m[1] != null ? decodeXmlText(m[1].replace(/<[^>]+>/g, '')) : m[2] ? (/tab/i.test(m[2]) ? '\t' : '\n') : '';
    out.push(line.trim());
  }
  return out;
}

async function unzip(file) {
  const fflate = await loadFflate();
  try { return fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new Error('파일을 풀 수 없어요. 망가졌거나 다른 형식일 수 있어요.'); }
}
const utf8 = (u8) => new TextDecoder('utf-8').decode(u8);

async function fromDocx(file) {
  const z = await unzip(file);
  const doc = z['word/document.xml'];
  if (!doc) throw new Error('워드 문서(docx) 안에서 본문을 찾지 못했어요.');
  return xmlParagraphs(utf8(doc), 'w:p', 'w:t', ['w:tab', 'w:br']);
}

async function fromHwpx(file) {
  const z = await unzip(file);
  const names = Object.keys(z).filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/i)[1]) - Number(b.match(/(\d+)\.xml$/i)[1]));
  if (!names.length) throw new Error('한글 문서(hwpx) 안에서 본문을 찾지 못했어요.');
  return names.flatMap((n) => xmlParagraphs(utf8(z[n]), 'hp:p', 'hp:t', ['hp:tab', 'hp:lineBreak']));
}

// 빈 줄 정리 — 문단 사이는 빈 줄 하나
export function tidyText(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/[ \t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 파일 → { text, name, kind } 또는 사진이면 { image(데이터 주소), name, kind:'image' } */
export async function readFile(file) {
  if (file.size > MAX_FILE) throw new Error(`파일이 너무 커요 (${Math.round(file.size / 1024 / 1024)}MB). 15MB 아래로 나눠서 넣어 주세요.`);
  const e = ext(file.name);
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(e)) {
    return { image: await shrinkImage(file), name: file.name, kind: 'image' };
  }
  if (['txt', 'md', 'markdown', 'csv', 'srt', 'vtt'].includes(e) || file.type.startsWith('text/')) {
    return { text: tidyText(await file.text()), name: file.name, kind: 'text' };
  }
  if (e === 'docx') return { text: tidyText((await fromDocx(file)).join('\n')), name: file.name, kind: 'docx' };
  if (e === 'hwpx') return { text: tidyText((await fromHwpx(file)).join('\n')), name: file.name, kind: 'hwpx' };
  if (['pdf', 'hwp', 'ppt', 'pptx', 'xls', 'xlsx', 'doc'].includes(e)) {
    throw new Error(`${e.toUpperCase()} 파일은 아직 휴대폰에서 바로 못 읽어요(업스테이지 Document Parse 연결 뒤 열려요). 파일을 열어 글자를 복사해 «붙여넣기» 로 넣어 주세요. 한글 파일은 «HWPX» 로, 워드는 «DOCX» 로 저장하면 바로 읽어요.`);
  }
  throw new Error('읽을 수 없는 파일이에요. TXT · MD · DOCX · HWPX 또는 사진을 넣어 주세요.');
}

// 사진 줄이기 — 긴 쪽 1600px · JPEG 로 (보내는 양 · 요금 줄이기)
export async function shrinkImage(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('사진을 열 수 없어요. JPG · PNG 로 다시 찍거나 저장해 주세요.'));
      im.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

// 긴 글 나누기 — 문단 경계에서 max 글자씩
export function splitParts(text, max = 20000) {
  if (text.length <= max) return [text];
  const parts = []; let cur = '';
  for (const para of text.split(/\n\n+/)) {
    if (cur && cur.length + para.length + 2 > max) { parts.push(cur); cur = ''; }
    if (para.length > max) { for (let i = 0; i < para.length; i += max) parts.push(para.slice(i, i + max)); continue; }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur) parts.push(cur);
  return parts;
}

export const HANGUL_RATIO = (text) => {
  const ko = (text.match(/[가-힣]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  return ko / Math.max(1, ko + en);
};
