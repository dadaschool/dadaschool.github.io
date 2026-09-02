/* 배치 알아내기 ─ 「어느 그림이 인물 사진이고, 글자는 사진의 어느 쪽에 있나」
 *
 * 🚨 이 파일이 이 앱에서 가장 위험한 곳이다.
 *    `cable-label` 의 규격 자동 감지는 세 번 무너졌고 세 번 다 **오류 없이**
 *    「그럴싸한 오답」 을 내놓았다. 그래서 여기서는 —
 *      ① 고른 근거(점수)를 함께 돌려주어 화면이 사람에게 보여 줄 수 있게 하고
 *      ② 사람이 손으로 덮어쓸 수 있게 모든 판단을 값으로만 남긴다.
 *
 * 🔴 화면(DOM)을 쓰지 않는다 — 브라우저 없이 검사할 수 있어야 한다.
 * 🔴 좌표는 모두 「회전을 보정한 뒤의 화면 좌표」 다 (y 는 아래로 증가).
 *    회전 보정은 pdfread.js 가 끝내 놓고 넘긴다.
 */
(function (root) {
  "use strict";

  var 옆 = ["below", "above", "right", "left", "over"];
  var 옆이름 = { below: "사진 아래", above: "사진 위", right: "사진 오른쪽", left: "사진 왼쪽", over: "사진 위에 겹침" };

  function w(r) { return r.x1 - r.x0; }
  function h(r) { return r.y1 - r.y0; }

  /* 값 목록을 「가까운 것끼리」 묶는다 (격자의 열·행을 찾을 때 쓴다) */
  function 묶기(vals, tol) {
    var s = vals.slice().sort(function (a, b) { return a - b; });
    var out = [], cur = [s[0]];
    for (var i = 1; i < s.length; i++) {
      if (s[i] - cur[cur.length - 1] <= tol) cur.push(s[i]);
      else { out.push(cur); cur = [s[i]]; }
    }
    out.push(cur);
    return out.map(function (g) {
      return g.reduce(function (a, b) { return a + b; }, 0) / g.length;
    });
  }

  /* ── ① 어느 그림이 인물 사진인가 ─────────────────────────────
   * 인물 사진은 「크기가 서로 비슷한 것이 여러 장 되풀이된다」 는 성질이 있다.
   * 로고·장식·머리글 그림은 그 성질이 없어 저절로 걸러진다. */
  function 사진고르기(images, page) {
    var 후보 = images.filter(function (im) {
      var W = w(im.rect), H = h(im.rect);
      if (W < 8 || H < 8) return false;                       // 너무 작은 것은 장식
      if (W > page.w * 0.85 && H > page.h * 0.85) return false; // 쪽 전체 = 스캔 바탕
      return true;
    });
    if (!후보.length) return { photos: [], groups: [] };

    // 크기가 6% 안쪽이면 같은 무리로 본다
    var 무리 = [];
    후보.forEach(function (im) {
      var W = w(im.rect), H = h(im.rect);
      for (var i = 0; i < 무리.length; i++) {
        var g = 무리[i];
        if (Math.abs(g.w - W) / Math.max(g.w, W) <= 0.06 &&
            Math.abs(g.h - H) / Math.max(g.h, H) <= 0.06) {
          g.items.push(im);
          g.w = (g.w * (g.items.length - 1) + W) / g.items.length;
          g.h = (g.h * (g.items.length - 1) + H) / g.items.length;
          return;
        }
      }
      무리.push({ w: W, h: H, items: [im] });
    });

    // 많이 되풀이된 무리 우선, 같으면 큰 것 우선
    무리.sort(function (a, b) {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return (b.w * b.h) - (a.w * a.h);
    });

    var best = 무리[0];
    // 되풀이가 3장도 안 되면 「격자로 늘어놓은 사진」 이라고 볼 수 없다
    if (best.items.length < 3) return { photos: [], groups: 무리 };
    return { photos: best.items.slice(), groups: 무리 };
  }

  /* ── ② 몇 열 몇 행인가 ─────────────────────────────────────── */
  function 격자(photos) {
    if (!photos.length) return { cols: 0, rows: 0, colX: [], rowY: [] };
    var pw = photos.reduce(function (a, p) { return a + w(p.rect); }, 0) / photos.length;
    var ph = photos.reduce(function (a, p) { return a + h(p.rect); }, 0) / photos.length;
    var colX = 묶기(photos.map(function (p) { return p.rect.x0; }), pw * 0.5);
    var rowY = 묶기(photos.map(function (p) { return p.rect.y0; }), ph * 0.5);
    return { cols: colX.length, rows: rowY.length, colX: colX, rowY: rowY, pw: pw, ph: ph };
  }

  /* 사진 사이의 빈틈 ─ 글자를 찾을 범위를 정하는 데 쓴다.
   * 이 값을 너무 크게 잡으면 「옆 사진의 글자」 를 끌어온다. */
  function 빈틈(g) {
    var 세로 = g.ph, 가로 = g.pw;
    if (g.rowY.length > 1) 세로 = Math.max(6, (g.rowY[1] - g.rowY[0]) - g.ph);
    if (g.colX.length > 1) 가로 = Math.max(6, (g.colX[1] - g.colX[0]) - g.pw);
    return { 세로: 세로, 가로: 가로 };
  }

  /* 사진 하나의 한쪽 옆에 있는 글자들을 모은다 */
  function 옆글자(p, texts, side, gap) {
    var r = p.rect, eps = 1.5, out = [];
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i], q = t.rect, ok = false, d = 0;
      var 가로겹침 = Math.min(q.x1, r.x1) - Math.max(q.x0, r.x0);
      var 세로겹침 = Math.min(q.y1, r.y1) - Math.max(q.y0, r.y0);

      if (side === "below") {
        ok = q.y0 >= r.y1 - eps && q.y0 < r.y1 + gap.세로 && 가로겹침 > Math.min(w(q), w(r)) * 0.3;
        d = q.y0 - r.y1;
      } else if (side === "above") {
        ok = q.y1 <= r.y0 + eps && q.y1 > r.y0 - gap.세로 && 가로겹침 > Math.min(w(q), w(r)) * 0.3;
        d = r.y0 - q.y1;
      } else if (side === "right") {
        ok = q.x0 >= r.x1 - eps && q.x0 < r.x1 + gap.가로 && 세로겹침 > Math.min(h(q), h(r)) * 0.3;
        d = q.x0 - r.x1;
      } else if (side === "left") {
        ok = q.x1 <= r.x0 + eps && q.x1 > r.x0 - gap.가로 && 세로겹침 > Math.min(h(q), h(r)) * 0.3;
        d = r.x0 - q.x1;
      } else if (side === "over") {
        var cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2;
        ok = cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1;
        d = 0;
      }
      if (ok) out.push({ t: t, d: Math.max(0, d) });
    }
    // 읽는 차례대로 (위→아래, 왼→오른쪽)
    out.sort(function (a, b) {
      var dy = a.t.rect.y0 - b.t.rect.y0;
      if (Math.abs(dy) > 2) return dy;
      return a.t.rect.x0 - b.t.rect.x0;
    });
    return out;
  }

  /* ── ③ 글자는 사진의 어느 쪽에 있나 ─ 전체 투표로 정한다 ──────
   * 🚨 이 자리가 조용히 틀리기 쉽다. NEIS 형식은 「아래」 가 맞는데,
   *    둘째 줄 사진에서 보면 「첫째 줄의 글자」 가 바로 위에 있어
   *    「위」 도 그럴싸한 점수를 얻는다.
   *    그래서 ① 몇 장이 글자를 찾았나 를 먼저 보고
   *          ② 같으면 「더 가까운 쪽」 을 고른다.
   *    (첫 줄에는 위쪽 글자가 없으므로 「아래」 가 개수에서 이긴다) */
  function 글자쪽(photos, texts, g) {
    var gap = 빈틈(g), 점수 = [];
    옆.forEach(function (side) {
      var hit = 0, 거리합 = 0, 글자수 = 0;
      photos.forEach(function (p) {
        var got = 옆글자(p, texts, side, gap);
        if (got.length) {
          hit++;
          글자수 += got.length;
          거리합 += got[0].d;
        }
      });
      점수.push({
        side: side, name: 옆이름[side], hit: hit,
        비율: photos.length ? hit / photos.length : 0,
        평균거리: hit ? 거리합 / hit : Infinity,
        글자수: 글자수
      });
    });
    점수.sort(function (a, b) {
      if (b.hit !== a.hit) return b.hit - a.hit;     // 많이 찾은 쪽이 먼저
      return a.평균거리 - b.평균거리;                  // 같으면 가까운 쪽
    });
    return 점수;
  }

  /* ── 전부 묶어서 한 번에 ────────────────────────────────────
   * opt.side 를 주면 투표를 건너뛰고 그 쪽으로 못 박는다 (사람이 고친 경우). */
  function 살펴보기(page, opt) {
    opt = opt || {};
    var 고른 = 사진고르기(page.images, page);
    var photos = 고른.photos;

    if (!photos.length) {
      return {
        ok: false,
        이유: page.texts.length ? "격자로 늘어놓은 사진을 찾지 못했습니다"
                                : "글자도 사진도 찾지 못했습니다 (스캔한 그림일 수 있습니다)",
        스캔같음: page.images.length <= 2 && page.texts.length < 3,
        photos: [], grid: 격자([]), sides: [], side: null, 사람들: []
      };
    }

    // 늘 같은 차례로 (위→아래, 왼→오른쪽) — 명렬표 붙여넣기가 이 차례에 기댄다
    photos.sort(function (a, b) {
      var dy = a.rect.y0 - b.rect.y0;
      if (Math.abs(dy) > h(a.rect) * 0.5) return dy;
      return a.rect.x0 - b.rect.x0;
    });

    var g = 격자(photos);
    var sides = 글자쪽(photos, page.texts, g);

    /* 🚨 「몇 장이라도 찾았으면 그 쪽」 으로 두면 안 된다.
     * 글자가 아예 없는 PDF(스캔 시안)에서 **쪽 제목** 하나가 맨 윗줄 사진 옆에 걸려
     * 그것을 이름으로 삼는 일이 실제로 있었다(「학생사진」 이 이름이 되었다).
     * 그래서 절반 넘게 찾은 쪽만 받아들이고, 아니면 「글자를 못 찾았다」 로 둔다.
     * (사람이 손으로 고르면 opt.side 로 그대로 따른다) */
    var 뽑힘 = sides[0] && sides[0].비율 >= 0.5 ? sides[0].side : null;
    var side = opt.side || 뽑힘;
    var gap = 빈틈(g);

    var 사람들 = photos.map(function (p) {
      var got = side ? 옆글자(p, page.texts, side, gap) : [];
      return {
        photo: p,
        texts: got.map(function (x) { return x.t.str; }),
        textRects: got.map(function (x) { return x.t.rect; })
      };
    });

    return {
      ok: true,
      photos: photos, grid: g, sides: sides, side: side,
      사람들: 사람들,
      무리수: 고른.groups.length,
      버린그림: page.images.length - photos.length
    };
  }

  root.Detect = {
    살펴보기: 살펴보기,
    사진고르기: 사진고르기,
    격자: 격자,
    글자쪽: 글자쪽,
    옆글자: 옆글자,
    빈틈: 빈틈,
    묶기: 묶기,
    옆이름: 옆이름
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
