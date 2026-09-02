/* PDF 읽기 ─ 「사진의 원본 바이트」 와 「글자의 화면 좌표」 를 꺼낸다.
 *
 * 왜 두 가지 라이브러리를 함께 쓰나 :
 *   · pdf.js  는 글자를 좌표와 함께 잘 꺼내 주지만, 그림은 **화면에 그릴 픽셀**로
 *     풀어서 준다. 그것을 다시 JPEG 로 만들면 재압축이 한 번 더 일어나 화질이 떨어진다.
 *   · pdf-lib 은 PDF 안의 **원본 바이트를 그대로** 꺼낼 수 있다. 사진이 JPEG 로
 *     들어 있으면(대부분 그렇다) 그 바이트가 곧 완성된 .jpg 파일이다 — 재압축 0회.
 * 그래서 사진은 pdf-lib, 글자는 pdf.js 로 읽고 좌표계를 하나로 맞춘다.
 *
 * 🚨 회전(/Rotate) ─ 이 앱의 첫 번째 함정.
 *    NEIS 사진 출력물은 A4 를 90° 돌려 쓴다. PDF 안의 원래 좌표로 보면 글자가
 *    사진의 **오른쪽**에 있고, 화면에 보이는 「아래」 는 돌린 뒤의 모습이다.
 *    보정하지 않으면 「사진 아래 글자」 를 한 개도 못 찾고 **오류도 안 난다.**
 *    → 이 파일이 모든 좌표를 「화면 좌표」(y 는 아래로 증가)로 바꿔 넘긴다.
 */
(function (root) {
  "use strict";

  var pdfjs = null;

  function 준비(lib) { pdfjs = lib; }

  /* ── 행렬 ─ PDF 는 [a b c d e f] 여섯 숫자로 좌표를 옮긴다 ───────── */
  function 곱(m1, m2) {           // m1 을 먼저 적용한 뒤 m2
    return [
      m1[0] * m2[0] + m1[1] * m2[2],
      m1[0] * m2[1] + m1[1] * m2[3],
      m1[2] * m2[0] + m1[3] * m2[2],
      m1[2] * m2[1] + m1[3] * m2[3],
      m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
      m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
    ];
  }
  function 점(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /* 그림은 언제나 「한 변이 1인 네모」 에 그려지고 행렬이 그것을 늘이고 돌린다.
   * 네 귀퉁이를 옮겨 실제 자리를 잰다. */
  function 네모(m) {
    var p = [점(m, 0, 0), 점(m, 1, 0), 점(m, 0, 1), 점(m, 1, 1)];
    var xs = p.map(function (q) { return q[0]; }), ys = p.map(function (q) { return q[1]; });
    return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys),
             x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
  }

  /* ── 내용 흐름(content stream) 훑기 ────────────────────────────
   * 「어느 그림이 어디에 그려지나」 는 이 안에만 적혀 있다.
   * 우리가 볼 것은 q · Q · cm · Do 넷뿐이고 나머지는 건너뛴다. */
  var 공백 = "\x00\t\n\f\r ";
  var 구분 = "()<>[]{}/%";

  function 토큰들(s) {
    var i = 0, n = s.length, out = [];
    while (i < n) {
      var c = s[i];
      if (공백.indexOf(c) >= 0) { i++; continue; }
      if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
      if (c === "/") {
        var j = ++i;
        while (i < n && 공백.indexOf(s[i]) < 0 && 구분.indexOf(s[i]) < 0) i++;
        out.push({ t: "name", v: s.slice(j, i).replace(/#([0-9a-fA-F]{2})/g, function (_, h) {
          return String.fromCharCode(parseInt(h, 16)); }) });
        continue;
      }
      if (c === "(") {                       // 글자열 — 값은 안 쓰고 건너뛰기만 한다
        var d = 1; i++;
        while (i < n && d > 0) {
          if (s[i] === "\\") i += 2;
          else { if (s[i] === "(") d++; else if (s[i] === ")") d--; i++; }
        }
        out.push({ t: "str" }); continue;
      }
      if (c === "<") {
        if (s[i + 1] === "<") { i += 2; out.push({ t: "op", v: "<<" }); continue; }
        while (i < n && s[i] !== ">") i++; i++;
        out.push({ t: "str" }); continue;
      }
      if (c === ">") { i += (s[i + 1] === ">" ? 2 : 1); out.push({ t: "op", v: ">>" }); continue; }
      if (c === "[" || c === "]" || c === "{" || c === "}") { i++; out.push({ t: "op", v: c }); continue; }
      if ((c >= "0" && c <= "9") || c === "+" || c === "-" || c === ".") {
        var k = i++;
        while (i < n && "0123456789.+-eE".indexOf(s[i]) >= 0) i++;
        var num = parseFloat(s.slice(k, i));
        out.push(isNaN(num) ? { t: "op", v: s.slice(k, i) } : { t: "num", v: num });
        continue;
      }
      var q = i;
      while (i < n && 공백.indexOf(s[i]) < 0 && 구분.indexOf(s[i]) < 0) i++;
      if (i === q) i++;
      out.push({ t: "op", v: s.slice(q, i) });
    }
    return out;
  }

  function 바이트를글자로(u8) {
    var s = "", CH = 8192;
    for (var i = 0; i < u8.length; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    }
    return s;
  }

  /* 쪽 하나의 내용을 훑어 그림이 놓인 자리를 모은다 */
  function 그림자리(L, ctx, res, bytes, ctm, out, depth) {
    if (depth > 8) return;
    var toks = 토큰들(바이트를글자로(bytes));
    var stack = [], ops = [], cur = ctm.slice();

    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk.t === "num" || tk.t === "name") { ops.push(tk); continue; }
      if (tk.t === "str") { ops.push(tk); continue; }
      var v = tk.v;

      if (v === "q") { stack.push(cur.slice()); }
      else if (v === "Q") { cur = stack.pop() || cur; }
      else if (v === "cm" && ops.length >= 6) {
        var m = ops.slice(-6).map(function (o) { return o.v; });
        if (m.every(function (x) { return typeof x === "number"; })) cur = 곱(m, cur);
      }
      else if (v === "Do" && ops.length) {
        var nm = ops[ops.length - 1];
        if (nm.t === "name") 그리기(L, ctx, res, nm.v, cur, out, depth);
      }
      else if (v === "BI") {                 // 줄 안에 박힌 그림 — 건너뛴다
        while (i < toks.length && toks[i].v !== "EI") i++;
      }
      ops = [];
    }
  }

  function 딕(L, ctx, d, key) {
    if (!d || !d.get) return null;
    var v = d.get(L.PDFName.of(key));
    return v ? ctx.lookup(v) : null;
  }

  function 그리기(L, ctx, res, name, ctm, out, depth) {
    var xod = 딕(L, ctx, res, "XObject");
    if (!xod) return;
    var ref = xod.get(L.PDFName.of(name));
    if (!ref) return;
    var obj = ctx.lookup(ref);
    if (!obj || !obj.dict) return;
    var sub = 딕(L, ctx, obj.dict, "Subtype");
    var subName = sub && sub.asString ? sub.asString() : (sub && sub.encodedName) || "";

    if (subName === "/Image") {
      out.push({ ref: ref, stream: obj, ctm: ctm.slice() });
      return;
    }
    if (subName === "/Form") {
      var mtx = 딕(L, ctx, obj.dict, "Matrix");
      var m2 = ctm;
      if (mtx && mtx.asArray) {
        var a = mtx.asArray().map(function (x) { return x.asNumber ? x.asNumber() : 0; });
        if (a.length === 6) m2 = 곱(a, ctm);
      }
      var r2 = 딕(L, ctx, obj.dict, "Resources") || res;
      try { 그림자리(L, ctx, r2, L.decodePDFRawStream(obj).decode(), m2, out, depth + 1); } catch (e) {}
    }
  }

  /* ── 그림 스트림 → 저장할 수 있는 파일 ────────────────────────
   * DCTDecode(JPEG) 이면 바이트가 곧 .jpg 다 — 이때만 재압축 0회(무손실).
   * 그 밖에는 픽셀을 풀어 캔버스에 올린 뒤 PNG 로 낸다(PNG 도 무손실). */
  function 필터목록(L, ctx, dict) {
    var f = 딕(L, ctx, dict, "Filter");
    if (!f) return [];
    if (f.asString) return [f.asString()];
    if (f.asArray) return f.asArray().map(function (x) {
      var o = ctx.lookup(x); return o && o.asString ? o.asString() : "";
    });
    return [];
  }

  function 수(L, ctx, dict, key, 기본) {
    var v = 딕(L, ctx, dict, key);
    return v && v.asNumber ? v.asNumber() : 기본;
  }

  function 색이름(L, ctx, dict) {
    var cs = 딕(L, ctx, dict, "ColorSpace");
    if (!cs) return { 이름: "", 성분: 0, 팔레트: null };
    if (cs.asString) {
      var s = cs.asString();
      return { 이름: s, 성분: s === "/DeviceRGB" ? 3 : s === "/DeviceCMYK" ? 4 : 1, 팔레트: null };
    }
    if (cs.asArray) {
      var a = cs.asArray().map(function (x) { return ctx.lookup(x); });
      var head = a[0] && a[0].asString ? a[0].asString() : "";
      if (head === "/ICCBased") {
        var st = a[1];
        var n = st && st.dict ? 수(L, ctx, st.dict, "N", 3) : 3;
        return { 이름: "/ICCBased", 성분: n, 팔레트: null };
      }
      if (head === "/Indexed") {
        var base = a[1] && a[1].asString ? a[1].asString() : "/DeviceRGB";
        var pal = a[3];
        var bytes = null;
        try {
          if (pal && pal.asBytes) bytes = pal.asBytes();
          else if (pal && pal.dict) bytes = L.decodePDFRawStream(pal).decode();
        } catch (e) {}
        return { 이름: "/Indexed", 성분: 1, 팔레트: bytes,
                 바탕성분: base === "/DeviceCMYK" ? 4 : base === "/DeviceGray" ? 1 : 3 };
      }
      if (head === "/DeviceN" || head === "/Separation") return { 이름: head, 성분: 1, 팔레트: null };
    }
    return { 이름: "", 성분: 0, 팔레트: null };
  }

  /* 픽셀 표본 → RGBA (캔버스에 올릴 수 있는 모양) */
  function RGBA만들기(raw, W, H, cs, bpc) {
    var px = new Uint8ClampedArray(W * H * 4);
    var n = cs.성분;
    if (bpc !== 8) {
      if (bpc !== 1 || n !== 1) return null;         // 1비트 흑백만 더 받아 준다
      var 줄 = Math.ceil(W / 8);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var b = raw[y * 줄 + (x >> 3)];
        var on = (b >> (7 - (x & 7))) & 1;
        var o = (y * W + x) * 4, g = on ? 255 : 0;
        px[o] = px[o + 1] = px[o + 2] = g; px[o + 3] = 255;
      }
      return px;
    }
    for (var i = 0, p = 0; i < W * H; i++, p += 4) {
      var s = i * n, r, gg, bb;
      if (cs.이름 === "/Indexed" && cs.팔레트) {
        var k = raw[i] * (cs.바탕성분 || 3);
        if (cs.바탕성분 === 4) {
          r = 255 - Math.min(255, cs.팔레트[k] + cs.팔레트[k + 3]);
          gg = 255 - Math.min(255, cs.팔레트[k + 1] + cs.팔레트[k + 3]);
          bb = 255 - Math.min(255, cs.팔레트[k + 2] + cs.팔레트[k + 3]);
        } else if (cs.바탕성분 === 1) { r = gg = bb = cs.팔레트[k]; }
        else { r = cs.팔레트[k]; gg = cs.팔레트[k + 1]; bb = cs.팔레트[k + 2]; }
      } else if (n === 1) { r = gg = bb = raw[s]; }
      else if (n === 3) { r = raw[s]; gg = raw[s + 1]; bb = raw[s + 2]; }
      else if (n === 4) {                              // CMYK → RGB (어림셈)
        var K = raw[s + 3];
        r = 255 - Math.min(255, raw[s] + K);
        gg = 255 - Math.min(255, raw[s + 1] + K);
        bb = 255 - Math.min(255, raw[s + 2] + K);
      } else return null;
      px[p] = r; px[p + 1] = gg; px[p + 2] = bb; px[p + 3] = 255;
    }
    return px;
  }

  function 캔버스PNG(px, W, H) {
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.getContext("2d").putImageData(new ImageData(px, W, H), 0, 0);
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, "image/png"); });
  }

  /* 그림 하나를 파일로 만든다. 실패하면 null 을 돌려주고 부르는 쪽이 「쪽을 그려
   * 잘라내기」 로 물러선다. */
  function 그림파일(L, ctx, st) {
    var d = st.dict;
    var W = 수(L, ctx, d, "Width", 0), H = 수(L, ctx, d, "Height", 0);
    var bpc = 수(L, ctx, d, "BitsPerComponent", 8);
    var fs = 필터목록(L, ctx, d);
    var 끝필터 = fs.length ? fs[fs.length - 1] : "";
    var cs = 색이름(L, ctx, d);
    var smask = 딕(L, ctx, d, "SMask");
    var 공통 = { width: W, height: H, bpc: bpc, filter: 끝필터, cs: cs.이름, smask: !!smask };

    // ✅ 가장 흔하고 가장 좋은 길 — 원본 JPEG 를 그대로
    if (끝필터 === "/DCTDecode") {
      try {
        var b = st.getContents ? st.getContents() : st.contents;
        return Promise.resolve(Object.assign({}, 공통, {
          blob: new Blob([b], { type: "image/jpeg" }), ext: "jpg", 무손실: true, 방법: "원본 JPEG 그대로"
        }));
      } catch (e) { return Promise.resolve(null); }
    }
    if (끝필터 === "/JPXDecode") return Promise.resolve(null);   // JPEG2000 — 브라우저가 못 푼다

    // 픽셀을 풀어 PNG 로
    try {
      var raw = L.decodePDFRawStream(st).decode();
      var px = RGBA만들기(raw, W, H, cs, bpc);
      if (!px) return Promise.resolve(null);
      return 캔버스PNG(px, W, H).then(function (blob) {
        return blob ? Object.assign({}, 공통, {
          blob: blob, ext: "png", 무손실: true, 방법: "픽셀 → PNG(무손실)"
        }) : null;
      });
    } catch (e) { return Promise.resolve(null); }
  }

  /* ── 쪽을 그려서 잘라내기 ─ 물러설 자리 ────────────────────────
   * 스캔한 PDF, 또는 위에서 못 꺼낸 형식일 때 쓴다. dpi 를 높게 준다. */
  function 쪽그리기(doc, pageNo, dpi) {
    return doc.getPage(pageNo).then(function (pg) {
      var vp = pg.getViewport({ scale: (dpi || 300) / 72 });
      var cv = document.createElement("canvas");
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      return pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise
        .then(function () { return { canvas: cv, scale: vp.scale }; });
    });
  }

  function 잘라내기(그린것, rect) {
    var s = 그린것.scale, cv = document.createElement("canvas");
    var x = Math.round(rect.x0 * s), y = Math.round(rect.y0 * s);
    var w = Math.max(1, Math.round((rect.x1 - rect.x0) * s));
    var h = Math.max(1, Math.round((rect.y1 - rect.y0) * s));
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(그린것.canvas, x, y, w, h, 0, 0, w, h);
    return new Promise(function (res) {
      cv.toBlob(function (b) {
        res({ blob: b, ext: "png", width: w, height: h, 무손실: false, 방법: "쪽을 그려 잘라냄" });
      }, "image/png");
    });
  }

  /* ── 파일 하나를 다 읽는다 ─────────────────────────────────── */
  function 읽기(arrayBuffer, opt) {
    opt = opt || {};
    var L = root.PDFLib;
    var u8 = new Uint8Array(arrayBuffer);

    return Promise.all([
      pdfjs.getDocument({ data: u8.slice(), cMapUrl: opt.cMapUrl, cMapPacked: true }).promise,
      L.PDFDocument.load(u8.slice(), { ignoreEncryption: true, throwOnInvalidObject: false })
    ]).then(function (두개) {
      var jsDoc = 두개[0], libDoc = 두개[1];
      var ctx = libDoc.context, libPages = libDoc.getPages();
      var pages = [], 차례 = Promise.resolve();

      for (var i = 1; i <= jsDoc.numPages; i++) {
        (function (no) {
          차례 = 차례.then(function () { return 한쪽(jsDoc, libDoc, libPages, ctx, L, no); })
                     .then(function (p) { pages.push(p); });
        })(i);
      }
      return 차례.then(function () {
        return { doc: jsDoc, libDoc: libDoc, ctx: ctx, L: L, pages: pages, 쪽수: jsDoc.numPages };
      });
    });
  }

  /* 그림 하나를 파일로 ─ 원본 바이트가 안 되면 「쪽을 그려 잘라내기」 로 물러선다.
   * 물러선 경우 무손실이 아니므로 그 사실을 함께 돌려준다(화면이 알려 준다). */
  function 사진꺼내기(읽은것, image, opt) {
    opt = opt || {};
    return 그림파일(읽은것.L, 읽은것.ctx, image.stream).then(function (got) {
      if (got) return got;
      return 쪽그리기(읽은것.doc, image.pageNo, opt.dpi || 300).then(function (그린것) {
        return 잘라내기(그린것, image.rect);
      });
    });
  }

  function 한쪽(jsDoc, libDoc, libPages, ctx, L, no) {
    return jsDoc.getPage(no).then(function (pg) {
      var vp = pg.getViewport({ scale: 1 });      // 회전이 여기에 들어 있다
      var V = vp.transform;

      // 글자 — pdf.js
      return pg.getTextContent().then(function (tc) {
        var texts = [];
        tc.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var t = pdfjs.Util.transform(V, it.transform);
          var ang = Math.atan2(t[1], t[0]);
          var fh = Math.hypot(t[2], t[3]) || 10;
          var len = (it.width || 0) * vp.scale;
          var dx = Math.cos(ang), dy = Math.sin(ang);
          var ux = Math.sin(ang), uy = -Math.cos(ang);      // 글자 위쪽(화면에서 y 는 아래로)
          var pts = [[t[4], t[5]], [t[4] + dx * len, t[5] + dy * len],
                     [t[4] + ux * fh, t[5] + uy * fh],
                     [t[4] + dx * len + ux * fh, t[5] + dy * len + uy * fh]];
          var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
          texts.push({
            str: it.str.trim(),
            rect: { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys),
                    x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) }
          });
        });

        // 그림 — pdf-lib (원본 바이트를 꺼낼 수 있어야 하므로)
        var images = [], 자리 = [];
        try {
          var node = libPages[no - 1].node;
          var res = node.Resources();
          var c = node.Contents();
          var 조각 = [];
          if (c) {
            if (c instanceof L.PDFArray) {
              for (var k = 0; k < c.size(); k++) {
                var s1 = ctx.lookup(c.get(k));
                if (s1) 조각.push(L.decodePDFRawStream(s1).decode());
              }
            } else {
              조각.push(L.decodePDFRawStream(c).decode());
            }
          }
          var 합 = 합치기(조각);
          그림자리(L, ctx, res, 합, [1, 0, 0, 1, 0, 0], 자리, 0);
        } catch (e) { /* 내용을 못 읽으면 그림 0장으로 두고 「쪽 그리기」 로 물러선다 */ }

        자리.forEach(function (it, idx) {
          var m = 곱(it.ctm, V);
          images.push({
            id: "p" + no + "i" + idx,
            ref: it.ref, stream: it.stream,
            rect: 네모(m),
            pageNo: no
          });
        });

        return {
          pageNo: no,
          w: vp.width, h: vp.height,
          rotation: pg.rotate,
          images: images,
          texts: texts
        };
      });
    });
  }

  function 합치기(arr) {
    var n = arr.reduce(function (a, b) { return a + b.length + 1; }, 0);
    var out = new Uint8Array(n), o = 0;
    arr.forEach(function (a) { out.set(a, o); o += a.length; out[o++] = 10; });
    return out;
  }

  root.PdfRead = {
    준비: 준비,
    읽기: 읽기,
    사진꺼내기: 사진꺼내기,
    그림파일로: 그림파일,
    쪽그리기: 쪽그리기,
    잘라내기: 잘라내기,
    곱: 곱, 점: 점, 네모: 네모, 토큰들: 토큰들,
    // 검사에서 쓰는 속살 (브라우저 없이 확인할 수 있어야 한다)
    _그림자리: 그림자리, _합치기: 합치기, _필터목록: 필터목록, _수: 수, _색이름: 색이름
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
