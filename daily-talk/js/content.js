// 콘텐츠 읽기 — content/situations.json · content/dialogues/<id>.json · audio/<id>/<n>.opus
// «내가 만든 상황»(id 가 my- 로 시작)은 IndexedDB customDialogues 에 있고, 음성 파일 없이 휴대폰 음성(tts:)으로 읽는다.
import { get } from './db.js';
export const ROOT = new URL('../', import.meta.url);           // 앱 폴더 (…/daily-talk/)
export const LEVEL_KO = { 1: '초급', 2: '중급', 3: '고급' };

const memo = new Map();
async function json(path) {
  if (!memo.has(path)) {
    memo.set(path, fetch(new URL(path, ROOT)).then((r) => {
      if (!r.ok) throw new Error(`${path} 를 읽지 못했어요 (${r.status})`);
      return r.json();
    }).catch((e) => { memo.delete(path); throw e; }));
  }
  return memo.get(path);
}

export const loadSituations = () => json('content/situations.json');
export const isCustom = (id) => /^my-/.test(id);
export const loadDialogue = (id) => (isCustom(id) ? loadCustom(id) : json(`content/dialogues/${id}.json`));
async function loadCustom(id) {
  const d = await get('customDialogues', id);
  if (!d) throw new Error('내가 만든 상황을 찾지 못했어요. 지웠을 수 있어요.');
  return d;
}

// 영역 — 내가 만든 상황은 «✍️ 내가 만든 상황» 한 영역으로 본다
export const MY_DOMAIN = { id: 'my', ko: '내가 만든 상황', en: 'My situations', emoji: '✍️', code: '나', situations: [] };
export async function domainOf(d) {
  if (d.custom) return { ...MY_DOMAIN, situations: [{ id: d.situation, ko: d.title.ko }] };
  return (await loadSituations()).domains.find((x) => x.id === d.domain);
}

export async function domain(id) {
  return (await loadSituations()).domains.find((d) => d.id === id);
}

// «여행-4» 같은 번호
export function codeOf(dom, sitId) {
  const i = dom.situations.findIndex((s) => s.id === sitId);
  return `${dom.code}-${i + 1}`;
}

export function dialogueId(domId, sitId, level) {
  return `${domId}-${sitId}-${level}`;
}

// 음성 주소 — 가벼운 모드(휴대폰 음성으로 읽기)를 위해 주소마다 읽을 글자도 기억해 둔다
export const audioText = new Map();
export function audioURL(d, n, ko = false) {
  if (d.custom) {                                  // 음성 파일이 없음 → 언제나 휴대폰 음성
    const url = `tts:${d.id}/${ko ? 'ko-' : ''}${n}`;
    const ln = d.lines.find((x) => x.n === n);
    if (ln) audioText.set(url, ko ? { text: ln.ko, lang: 'ko-KR' } : { text: ln.en, lang: 'en-US' });
    return url;
  }
  const url = new URL(`audio/${d.id}/${ko ? 'ko-' : ''}${n}.opus?r=${d.audioRev || 1}`, ROOT).href;
  if (!audioText.has(url)) {
    const ln = d.lines.find((x) => x.n === n);
    if (ln) audioText.set(url, ko ? { text: ln.ko, lang: 'ko-KR' } : { text: ln.en, lang: 'en-US' });
  }
  return url;
}

export function learnerRole(d) {
  return Object.keys(d.roles).find((k) => d.roles[k].learner);
}
