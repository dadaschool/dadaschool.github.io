/* 🌐 WebP 변환 — 화면(DOM)을 쓰지 않는 순수 계산만 모았다.
   그래서 브라우저 없이 Node 에서 바로 검사할 수 있다(tools/검사/verify_webp.mjs).
   실제 변환(캔버스 → WebP)은 브라우저만 할 수 있어 tab-webp.js 에 있다. */

/** 맞춤 설정 3가지 — 사용자가 고른 추천값(2026-09-21).
    ① 은 mb-bluetooth 슬라이드를 만들 때 쓴 값(가로 1400px · q82)과 같다. */
export const PRESETS = [
  { id: 'site', label: '사이트·수업앱용', maxW: 1400, q: 82, hint: '가로 1400px · 품질 82 — 깃허브·수업앱에 올릴 그림' },
  { id: 'hq',   label: '고화질',          maxW: 1920, q: 90, hint: '가로 1920px · 품질 90 — 전자칠판 전체 화면' },
  { id: 'orig', label: '크기 그대로',      maxW: 0,    q: 82, hint: '크기는 그대로 두고 형식만 WebP 로' }
];

/** 가로 최대 px 에 맞춘 새 크기. maxW 가 0 이면 그대로.
    🔴 늘리지는 않는다 — 작은 그림을 키우면 흐려지고 용량만 커진다. */
export function fitSize(w, h, maxW) {
  if (!maxW || w <= maxW) return { w, h };
  return { w: maxW, h: Math.max(1, Math.round(h * maxW / w)) };
}

/** 원래 이름 → `이름.webp`. 목록 안에서 겹치면 `이름-2.webp`, `이름-3.webp` …
    used 는 이미 쓴 이름(소문자)을 담는 Set 이다 — 윈도우는 대소문자를 가리지 않으므로. */
export function webpName(name, used) {
  const base = String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|]/g, '_').trim() || '그림';
  let out = base + '.webp', n = 2;
  while (used.has(out.toLowerCase())) out = `${base}-${n++}.webp`;
  used.add(out.toLowerCase());
  return out;
}

/** 줄어든 비율(%) — 음수면 커진 것이다 */
export function savedPct(orig, out) {
  if (!orig) return 0;
  return Math.round((1 - out / orig) * 1000) / 10;
}

/** 받을 목록에 기본으로 넣을까? — WebP 가 원본보다 작을 때만.
    이미 많이 압축된 JPG 는 WebP 가 오히려 커지는 일이 있다. 그럴 땐 원본을 쓰는 게 낫다. */
export function keepByDefault(orig, out) {
  return out > 0 && out < orig;
}

/** WebP 바이트의 머리를 읽는다(결과가 정말 WebP 인지 확인하는 데 쓴다).
    구조 : 'RIFF' 크기(4) 'WEBP' + 덩어리(chunk)들. 첫 덩어리가 'VP8 '(손실) · 'VP8L'(무손실) · 'VP8X'(확장).
    돌려주는 것 : { ok, kind, w, h, alpha, exif, anim } */
export function parseWebp(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const tag = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  const u32 = (i) => (b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24) >>> 0;
  const u24 = (i) => b[i] | b[i + 1] << 8 | b[i + 2] << 16;
  if (b.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return { ok: false };

  const res = { ok: true, kind: tag(12), w: 0, h: 0, alpha: false, exif: false, anim: false, lossless: false };
  // 덩어리를 차례로 훑는다 — 알파(ALPH)·EXIF·무손실(VP8L) 덩어리가 있는지 본다
  let p = 12;
  while (p + 8 <= b.length) {
    const t = tag(p), size = u32(p + 4), d = p + 8;
    if (t === 'VP8X') {
      const flags = b[d];
      res.alpha ||= !!(flags & 0x10); res.exif ||= !!(flags & 0x08); res.anim ||= !!(flags & 0x02);
      res.w = u24(d + 4) + 1; res.h = u24(d + 7) + 1;
    } else if (t === 'VP8 ' && !res.w) {
      // 손실 : 프레임 머리 3바이트 + 시작 표시 9d 01 2a 뒤에 가로·세로(14비트)
      res.w = (b[d + 6] | b[d + 7] << 8) & 0x3fff; res.h = (b[d + 8] | b[d + 9] << 8) & 0x3fff;
    } else if (t === 'VP8L') {
      res.lossless = true;
      if (!res.w) {
        // 무손실 : 표시 0x2f 뒤 14비트씩 (가로-1)(세로-1), 그다음 1비트가 알파
        const v = u32(d + 1);
        res.w = (v & 0x3fff) + 1; res.h = ((v >>> 14) & 0x3fff) + 1;
        res.alpha ||= !!((v >>> 28) & 1);
      }
    } else if (t === 'ALPH') res.alpha = true;
    else if (t === 'EXIF') res.exif = true;
    p = d + size + (size & 1);   // 덩어리 크기가 홀수면 1바이트를 채워 둔다
  }
  return res;
}
