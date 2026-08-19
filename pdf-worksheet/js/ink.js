/* =========================================================
   ink.js — 손글씨(획)를 담고, PDF 에 새겨 넣는다
   ---------------------------------------------------------
   이 파일이 하는 일
     ① 학생이 그린 획을 자료구조로 담는다 (되돌리기·다시 하기 포함)
     ② 그 획을 화면 캔버스에 다시 그린다
     ③ 그 획을 원본 PDF 위에 **벡터**로 새겨 새 PDF 를 만든다

   ⚠ 좌표를 무엇으로 저장하는가 — 이 앱에서 가장 중요한 결정
     화면 좌표(픽셀)로 저장하면 확대·기기 해상도가 바뀔 때마다 어긋난다.
     그래서 **PDF 사용자 공간 좌표(포인트, y 는 위로 증가)** 로 저장한다.
       · 그릴 때 : viewport.convertToPdfPoint(화면x, 화면y)      → 저장
       · 볼 때   : viewport.convertToViewportPoint(저장x, 저장y) → 화면
     이렇게 하면 **확대해도, 기기가 달라도 같은 자리**에 남고,
     회전된 페이지(/Rotate 90)와 CropBox 가 어긋난 PDF 도 pdf.js 가 알아서 맞춰 준다.

   ⚠ 화면과 PDF 가 같아 보이려면 **곡선 만드는 방법이 양쪽에서 같아야** 한다.
     그래서 화면(Canvas)과 PDF(SVG path) 모두 아래 smooth() 하나만 쓴다.
     한쪽만 고치면 "화면과 제출물이 다르다" 는 문제가 생긴다.
   ========================================================= */
(function (global) {
  "use strict";

  /* 굵기를 이 단위로 뭉친다(PDF 포인트).
     필압 때문에 점마다 굵기가 다른데, 그대로 두면 획 하나가 선 수백 개로 쪼개진다.
     0.25pt 씩 묶으면 눈에는 같아 보이고 파일은 작게 유지된다. */
  var WIDTH_STEP = 0.25;

  /* 좌표를 소수점 두 자리로 줄인다. 0.01pt = 약 0.0035mm — 눈에 보이지 않는다.
     이것만으로 저장 용량이 절반 아래로 준다. */
  function r2(v) { return Math.round(v * 100) / 100; }

  /* ---------------------------------------------------------
     획 하나의 모양
       { p: 쪽번호(0부터), c: "#111827", x:[...], y:[...], w:[...] }
     x·y 는 PDF 포인트, w 는 그 점에서의 굵기(PDF 포인트)
     --------------------------------------------------------- */

  function Store(key) {
    this.key = key || null;       // sessionStorage 키 (없으면 저장하지 않는다)
    this.strokes = [];
    this.undone = [];             // 되돌린 획 (다시 하기용)
  }

  Store.prototype.add = function (stroke) {
    if (!stroke || !stroke.x || stroke.x.length < 1) return;
    this.strokes.push(stroke);
    this.undone.length = 0;       // 새로 그리면 '다시 하기' 는 사라진다
    this.save();
  };

  /* 지우개 — 획 단위로 지운다.
     점 단위로 쪼개 지우는 방식은 구현이 복잡한데, 학생이 실제로 원하는 것은
     "이 글자 지우기" 라서 획 단위가 오히려 빠르고 결과가 예측된다. */
  Store.prototype.eraseAt = function (page, px, py, radius) {
    var hit = [];
    for (var i = this.strokes.length - 1; i >= 0; i--) {
      var s = this.strokes[i];
      if (s.p !== page) continue;
      if (nearStroke(s, px, py, radius)) hit.push(i);
    }
    if (!hit.length) return false;
    for (var k = 0; k < hit.length; k++) this.strokes.splice(hit[k], 1);
    this.undone.length = 0;
    this.save();
    return true;
  };

  Store.prototype.undo = function () {
    if (!this.strokes.length) return false;
    this.undone.push(this.strokes.pop());
    this.save();
    return true;
  };

  Store.prototype.redo = function () {
    if (!this.undone.length) return false;
    this.strokes.push(this.undone.pop());
    this.save();
    return true;
  };

  Store.prototype.clearPage = function (page) {
    var before = this.strokes.length;
    this.strokes = this.strokes.filter(function (s) { return s.p !== page; });
    if (this.strokes.length === before) return false;
    this.undone.length = 0;
    this.save();
    return true;
  };

  Store.prototype.countOnPage = function (page) {
    var n = 0;
    for (var i = 0; i < this.strokes.length; i++) if (this.strokes[i].p === page) n++;
    return n;
  };

  Store.prototype.isEmpty = function () { return this.strokes.length === 0; };

  /* ---- 임시 보관 ----
     ⚠ sessionStorage 만 쓴다(localStorage 아님).
        탭을 닫으면 저절로 사라져서 **공용 크롬북에서 다음 학생에게 남지 않는다.**
        획 좌표는 개인정보가 아니고, 이름·학번은 여기에 절대 넣지 않는다. */
  Store.prototype.save = function () {
    if (!this.key) return;
    try {
      sessionStorage.setItem(this.key, JSON.stringify(this.strokes));
    } catch (e) {
      /* 용량이 찼을 때(보통 5MB). 그림이 사라지는 것보다 저장을 포기하는 편이 낫다. */
      this.key = null;
    }
  };

  Store.prototype.load = function () {
    if (!this.key) return false;
    try {
      var raw = sessionStorage.getItem(this.key);
      if (!raw) return false;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return false;
      this.strokes = arr.filter(function (s) {
        return s && typeof s.p === "number" && Array.isArray(s.x) && Array.isArray(s.y);
      });
      return this.strokes.length > 0;
    } catch (e) { return false; }
  };

  Store.prototype.drop = function () {
    this.strokes = [];
    this.undone = [];
    if (this.key) { try { sessionStorage.removeItem(this.key); } catch (e) {} }
  };

  /* 점 하나가 획 근처에 있는지 — 선분마다 거리를 재 본다 */
  function nearStroke(s, px, py, radius) {
    var n = s.x.length;
    if (n === 1) return dist2(px, py, s.x[0], s.y[0]) <= radius * radius;
    for (var i = 0; i < n - 1; i++) {
      if (segDist2(px, py, s.x[i], s.y[i], s.x[i + 1], s.y[i + 1]) <= radius * radius) return true;
    }
    return false;
  }

  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  /* 점에서 선분까지 거리의 제곱 (제곱근을 뽑지 않아 빠르다) */
  function segDist2(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return dist2(px, py, x1, y1);
    var t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return dist2(px, py, x1 + t * dx, y1 + t * dy);
  }

  /* ---------------------------------------------------------
     곡선 만들기 (화면과 PDF 가 함께 쓴다)

     점을 직선으로 이으면 글씨가 각져 보인다. 이웃한 두 점의 중간점을 지나는
     2차 베지에로 이으면 부드러워진다 — 손글씨 앱들이 쓰는 표준 방법이다.

     emit 은 그리는 도구가 준다. 그래서 이 함수 하나로
     Canvas(quadraticCurveTo)와 SVG path(Q) 를 **똑같이** 그릴 수 있다.
     --------------------------------------------------------- */
  function smooth(xs, ys, from, to, emit) {
    var n = to - from + 1;
    if (n <= 0) return;
    emit.move(xs[from], ys[from]);
    if (n === 1) { emit.dot(xs[from], ys[from]); return; }
    if (n === 2) { emit.line(xs[to], ys[to]); return; }
    for (var i = from + 1; i < to; i++) {
      var mx = (xs[i] + xs[i + 1]) / 2;
      var my = (ys[i] + ys[i + 1]) / 2;
      emit.quad(xs[i], ys[i], mx, my);
    }
    emit.line(xs[to], ys[to]);
  }

  /* 굵기가 비슷한 구간끼리 잘라 준다 — 필압을 살리면서 선 개수를 줄인다.
     구간을 겹쳐 이어 붙여야(from = 끊긴 자리) 이음매에 빈틈이 생기지 않는다. */
  function runs(stroke) {
    var w = stroke.w, n = stroke.x.length, out = [], start = 0;
    var cur = bucket(w && w.length ? w[0] : 1.5);
    for (var i = 1; i < n; i++) {
      var b = bucket(w && w.length > i ? w[i] : cur);
      if (b !== cur) {
        out.push({ from: start, to: i, width: cur });
        start = i;
        cur = b;
      }
    }
    out.push({ from: start, to: n - 1, width: cur });
    return out;
  }

  function bucket(w) {
    var b = Math.round(w / WIDTH_STEP) * WIDTH_STEP;
    return b < WIDTH_STEP ? WIDTH_STEP : Math.round(b * 100) / 100;
  }

  /* ---------------------------------------------------------
     ② 화면에 다시 그리기

     좌표는 PDF 포인트로 저장돼 있으니 viewport 로 화면 좌표로 바꿔 그린다.
     dpr 은 고해상도 화면 보정값(캔버스가 실제로는 더 크다).
     --------------------------------------------------------- */
  function drawOn(ctx, strokes, page, viewport, dpr) {
    var d = dpr || 1;
    var scale = viewport.scale * d;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      if (s.p !== page) continue;
      var vx = [], vy = [];
      for (var j = 0; j < s.x.length; j++) {
        var pt = viewport.convertToViewportPoint(s.x[j], s.y[j]);
        vx.push(pt[0] * d);
        vy.push(pt[1] * d);
      }
      var rs = runs(s);
      for (var k = 0; k < rs.length; k++) {
        var run = rs[k];
        var lw = Math.max(0.6, run.width * scale);
        ctx.beginPath();
        ctx.strokeStyle = s.c;
        ctx.fillStyle = s.c;
        ctx.lineWidth = lw;
        smooth(vx, vy, run.from, run.to, canvasEmit(ctx, lw));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function canvasEmit(ctx, w) {
    return {
      move: function (x, y) { ctx.moveTo(x, y); },
      line: function (x, y) { ctx.lineTo(x, y); },
      quad: function (cx, cy, x, y) { ctx.quadraticCurveTo(cx, cy, x, y); },
      /* 점 하나만 찍은 경우 — 아주 짧은 선으로 만든다.
         둥근 끝(lineCap round) 때문에 동그라미로 보인다. */
      dot: function (x, y) { ctx.lineTo(x + 0.01, y); }
    };
  }

  /* ---------------------------------------------------------
     ③ PDF 에 새겨 넣기  (pdf-lib)

     ⚠ 좌표계가 뒤집힌다. 여기가 이 앱에서 제일 틀리기 쉬운 곳이다.
       · 우리가 저장한 값 : PDF 사용자 공간, y 는 **위로** 증가
       · drawSvgPath      : SVG 규칙이라 y 가 **아래로** 증가
       그래서 페이지 위쪽 변(top)을 기준점으로 주고 y 를 (top - y) 로 바꿔 넣는다.
         drawSvgPath(d, { x: 0, y: top })  →  점 (px, py) 는 (px, top - py) 에 찍힌다

       기준을 MediaBox 가 아니라 **CropBox** 로 잡는다 — pdf.js 가 화면에 보여 준 것도
       CropBox 라서, 둘이 다른 PDF 에서 MediaBox 로 잡으면 글씨가 밀린다.

       회전(/Rotate)은 여기서 따로 계산하지 않는다. 저장할 때 이미
       viewport.convertToPdfPoint 가 회전을 풀어 놓았기 때문이다.
     --------------------------------------------------------- */
  function svgEmit(parts) {
    return {
      move: function (x, y) { parts.push("M" + r2(x) + " " + r2(y)); },
      line: function (x, y) { parts.push("L" + r2(x) + " " + r2(y)); },
      quad: function (cx, cy, x, y) {
        parts.push("Q" + r2(cx) + " " + r2(cy) + " " + r2(x) + " " + r2(y));
      },
      dot: function (x, y) { parts.push("L" + r2(x + 0.01) + " " + r2(y)); }
    };
  }

  function hexToRgb(hex, PDFLib) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
    if (!m) return PDFLib.rgb(0.07, 0.09, 0.15);
    return PDFLib.rgb(
      parseInt(m[1], 16) / 255,
      parseInt(m[2], 16) / 255,
      parseInt(m[3], 16) / 255
    );
  }

  /* 원본 PDF(바이트) + 획 → 새 PDF(바이트).
     원본을 그대로 두고 그 위에 선만 얹으므로 글자가 흐려지지 않고 용량도 거의 안 는다. */
  async function stamp(srcBytes, strokes, PDFLib) {
    var doc = await PDFLib.PDFDocument.load(srcBytes);
    var pages = doc.getPages();

    /* 쪽별로 모아서 한 번에 그린다 */
    var byPage = {};
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      var key = String(s.p);
      if (!byPage[key]) byPage[key] = [];
      byPage[key].push(s);
    }

    Object.keys(byPage).forEach(function (key) {
      var page = pages[parseInt(key, 10)];
      if (!page) return;                     /* 쪽이 사라진 PDF — 조용히 넘긴다 */

      var box = page.getCropBox ? page.getCropBox() : page.getMediaBox();
      var top = box.y + box.height;          /* 페이지 위쪽 변의 y (사용자 공간) */

      var list = byPage[key];
      for (var j = 0; j < list.length; j++) {
        var st = list[j];
        var ys = [];
        for (var t = 0; t < st.y.length; t++) ys.push(top - st.y[t]);  /* y 뒤집기 */
        var color = hexToRgb(st.c, PDFLib);
        var rs = runs(st);
        for (var k = 0; k < rs.length; k++) {
          var run = rs[k];
          var parts = [];
          smooth(st.x, ys, run.from, run.to, svgEmit(parts));
          if (!parts.length) continue;
          page.drawSvgPath(parts.join(" "), {
            x: 0, y: top,                    /* 위 주석의 기준점 */
            borderColor: color,
            borderWidth: run.width,
            borderLineCap: PDFLib.LineCapStyle.Round,
            borderOpacity: 1
          });
        }
      }
    });

    return await doc.save({ useObjectStreams: true });
  }

  global.Ink = {
    Store: Store,
    drawOn: drawOn,
    stamp: stamp,
    smooth: smooth,
    runs: runs,
    r2: r2
  };
})(window);
