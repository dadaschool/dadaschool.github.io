// AI 연결 (설계서 「5-3」) — 다섯 회사 모두 OpenAI 와 같은 Chat Completions 형식이라 코드 하나로 부른다.
// - 키 · 순서 · 모델 이름은 휴대폰 IndexedDB `secrets/ai` 에만 둔다(백업 · 자동 백업에서 빠짐).
// - 설정에서 정한 순서대로 시도하고, 실패(키 없음 · 401 · 429 · 5xx · 시간 초과 · 형식 깨짐)하면 다음 회사로 넘어간다.
// - 휴대폰 브라우저에서 바로 부를 수 있는지(CORS)는 2026-11-07 확인: 큐웬 · 업스테이지 · 제미나이 · 오픈AI 는 됨,
//   엑사온(FriendliAI)은 막힘 → 도우미 Worker 중계가 생기기 전까지는 «준비 중»으로 건너뛴다(relay).
// - 모델 이름은 자주 바뀌므로 여기 값은 기본값일 뿐, 설정에서 바꿀 수 있다.
// - vision: 사진을 읽을 수 있는 기본 모델(제미나이 · 오픈AI). 큐웬은 VL 모델로 바꿔야 해서 기본으로는 빼 둔다.
import { get, put, del } from '../db.js';

export const PROVIDERS = [
  { id: 'qwen', name: '큐웬', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', json: true,
    where: '알리바바 클라우드 Model Studio (국제 · 싱가포르)', url: 'https://modelstudio.console.alibabacloud.com/' },
  { id: 'exaone', name: '엑사온', base: 'https://api.friendli.ai/serverless/v1', model: 'LGAI-EXAONE/EXAONE-4.0.1-32B', json: false,
    where: 'FriendliAI', url: 'https://friendli.ai/', relay: true },
  { id: 'upstage', name: '업스테이지', base: 'https://api.upstage.ai/v1', model: 'solar-pro4', json: false,
    where: 'Upstage 콘솔', url: 'https://console.upstage.ai/' },
  { id: 'gemini', name: '제미나이', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', json: true, vision: true,
    where: 'Google AI Studio', url: 'https://aistudio.google.com/apikey' },
  { id: 'openai', name: '오픈AI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini', json: true, vision: true,
    where: 'OpenAI 플랫폼', url: 'https://platform.openai.com/api-keys' },
];
export const byId = (id) => PROVIDERS.find((p) => p.id === id);
const TIMEOUT = 45000;

let cfg = null;
// 잠시 쉬게 할 회사 — 키 · 모델 오류는 설정을 바꿀 때까지, 한도 · 서버 · 연결 오류는 2분 동안 건너뛴다(매번 헛걸음하지 않게)
const rest = new Map();
const REST_MS = { limit: 120000, server: 120000, network: 120000, timeout: 120000 };
window.addEventListener('dt:ai', () => rest.clear());
const resting = (id) => { const until = rest.get(id); if (until && until > Date.now()) return true; rest.delete(id); return false; };
export async function loadAI() {
  const saved = (await get('secrets', 'ai')) || {};
  const order = (saved.order || []).filter((id) => byId(id));
  for (const p of PROVIDERS) if (!order.includes(p.id)) order.push(p.id);
  cfg = { order, keys: saved.keys || {}, models: saved.models || {}, off: saved.off || {} };
  return cfg;
}
export async function saveAI(next) {
  cfg = next;
  await put('secrets', 'ai', next);
  window.dispatchEvent(new CustomEvent('dt:ai'));
}
export async function clearKeys() {
  await del('secrets', 'ai');
  await loadAI();
  window.dispatchEvent(new CustomEvent('dt:ai'));
}

export const modelOf = (c, p) => (c.models[p.id] || '').trim() || p.model;
// 지금 쓸 수 있는 회사들 (순서대로)
export function usable(c = cfg) {
  return (c?.order || []).map(byId).filter((p) => p && !p.relay && !c.off[p.id] && (c.keys[p.id] || '').trim());
}
export async function hasAI() { return usable(await loadAI()).length > 0; }

export class AIError extends Error {
  constructor(kind, msg, detail = '') { super(msg); this.kind = kind; this.detail = detail; }
}
const KIND_MSG = {
  network: '연결이 안 됐어요(인터넷 · 회사 서버)',
  key: '키가 맞지 않거나 권한이 없어요',
  model: '모델 이름을 찾지 못했어요 — 설정에서 모델 이름을 확인해 주세요',
  limit: '사용 한도를 넘었어요(429)',
  server: '회사 서버 오류',
  timeout: '시간이 너무 오래 걸렸어요',
  format: '답 형식이 깨졌어요',
  empty: '빈 답이 왔어요',
};
export const kindMsg = (k) => KIND_MSG[k] || k;

// 한 회사에 한 번 묻기 → 글자
async function callOne(p, key, model, messages, { json }) {
  const body = { model, messages };
  if (json && p.json) body.response_format = { type: 'json_object' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT);
  let r;
  try {
    r = await fetch(`${p.base}/chat/completions`, {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AIError(e.name === 'AbortError' ? 'timeout' : 'network', kindMsg(e.name === 'AbortError' ? 'timeout' : 'network'), e.message);
  } finally { clearTimeout(timer); }
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j.error?.message || j.message || j.detail || JSON.stringify(j).slice(0, 200); } catch { /* 글자가 아님 */ }
    const kind = r.status === 401 || r.status === 403 ? 'key'
      : r.status === 429 ? 'limit'
        : r.status >= 500 ? 'server'
          : r.status === 404 || /model/i.test(detail) ? 'model' : 'server';
    throw new AIError(kind, `${kindMsg(kind)} (${r.status})`, detail);
  }
  const j = await r.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new AIError('empty', kindMsg('empty'));
  return String(text).trim();
}

// 글자에서 JSON 꺼내기 — ```json … ``` 이나 앞뒤 말이 붙어 와도 읽는다
export function parseJSON(text) {
  const t = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(t); } catch { /* 아래에서 다시 */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* 깨짐 */ } }
  return null;
}

/**
 * 순서대로 묻기.
 * @param {Array} messages  [{role:'system'|'user'|'assistant', content}]
 * @param {Object} o  json: JSON 으로 받기(형식이 깨지면 같은 회사에 한 번 더, 그래도 안 되면 다음 회사)
 *                    check: JSON 을 받은 뒤 쓸 수 있는지 확인하는 함수(false 면 깨진 것으로 봄)
 * @returns {{text, data, provider}}  provider = { id, name }
 */
export async function ask(messages, { json = false, check = null, onTry = null, need = null } = {}) {
  const c = await loadAI();
  const keyed = usable(c);
  if (!keyed.length) throw new AIError('nokey', 'AI 키가 없어요. 설정 → 🤖 AI 에서 키를 넣어 주세요.');
  const all = need === 'vision' ? keyed.filter((p) => p.vision) : keyed;
  if (!all.length) throw new AIError('novision', '사진을 읽으려면 제미나이나 오픈AI 키가 있어야 해요. 사진 속 글자를 직접 붙여넣어도 돼요.');
  const fresh = all.filter((p) => !resting(p.id));
  const list = fresh.length ? fresh : all;          // 모두 쉬는 중이면 그래도 다시 해 본다
  const fails = [];
  for (const p of list) {
    onTry?.(p);
    for (let attempt = 0; attempt < (json ? 2 : 1); attempt++) {
      try {
        const msgs = attempt ? [...messages, { role: 'user', content: 'Your last reply was not valid JSON in the required shape. Reply again with ONLY the JSON object.' }] : messages;
        const text = await callOne(p, c.keys[p.id], modelOf(c, p), msgs, { json });
        rest.delete(p.id);
        if (!json) return { text, provider: { id: p.id, name: p.name } };
        const data = parseJSON(text);
        if (data && (!check || check(data))) return { text, data, provider: { id: p.id, name: p.name } };
        if (attempt) fails.push({ p, e: new AIError('format', kindMsg('format')) });
      } catch (e) {
        fails.push({ p, e });
        if (e.kind === 'key' || e.kind === 'model') rest.set(p.id, Infinity);
        else if (REST_MS[e.kind]) rest.set(p.id, Date.now() + REST_MS[e.kind]);
        break;                                         // 형식 말고 다른 실패는 바로 다음 회사로
      }
    }
  }
  const why = fails.map(({ p, e }) => `${p.name}: ${e.message}`).join(' · ');
  throw new AIError('all', `모든 AI 가 답하지 못했어요. ${why}`, fails.map(({ e }) => e.detail).filter(Boolean).join(' | '));
}

// 설정의 «연결 시험» — 한 회사만, 아주 짧게
export async function testOne(id, key, model) {
  const p = byId(id);
  const t0 = Date.now();
  const text = await callOne(p, key, model || p.model, [{ role: 'user', content: 'Reply with just: OK' }], { json: false });
  return { text: text.slice(0, 40), ms: Date.now() - t0 };
}
