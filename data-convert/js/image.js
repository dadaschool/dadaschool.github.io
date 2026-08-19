/* =========================================================
   image.js — 이미지·동영상의 디지털 표현 계산과 자료

   교과서 근거 : 동아출판 22개정 중등 정보 Ⅱ.데이터 **62~63쪽**
     · 비트맵(bitmap) : "디지털 이미지를 작은 점인 **픽셀**을 이용하여 표현하는 방식.
       자연스럽고 세밀한 묘사가 가능하지만, 확대하면 사각형 모양의 픽셀이 드러나 **계단 현상**이 발생"
     · 벡터(vector)   : "점, 선, 면 등의 **수학적인 정보**를 이용하여 표현하는 방식.
       세밀한 묘사는 어렵지만 확대·축소하더라도 그 값이 새롭게 계산되어 **변형이 일어나지 않는다**"
     · 62쪽 그림 Ⅱ-11 : **1비트로 픽셀을 표현하는 경우**(0/1) · **2비트로 표현하는 경우**(00/01/10/11)
     · 62쪽 그림 Ⅱ-12 : `<rect x="2" y="1" width="5cm" height="2cm" fill="blue">`
       (시작 좌표 · 너비와 높이 · 색상)
     · 63쪽 : **해상도** = 이미지의 픽셀 수, `가로 × 세로`. 픽셀이 많을수록 선명하지만 용량이 커진다.
       HD 1280×720 · Full HD 1920×1080 · Ultra HD 3840×2160
     · 63쪽 : 한 장의 이미지 = **프레임**, 1초당 프레임 수 = **프레임률(fps)**.
       영화·드라마는 24fps 이상, 최근 60fps 이상. 프레임률을 높이면 **용량도 커진다**.
       (단원평가 5번 정답 ② "프레임률이 낮을수록 데이터의 용량도 줄어든다")

   ⚠ ES 모듈(import/export)을 쓰지 않는다. `file://` 더블클릭 실행을 지키기 위해서다.
   ========================================================= */
(function (global) {
  "use strict";

  /* 색 깊이 — 픽셀 하나를 몇 비트로 적는가. **값마다 어떤 색인지는 약속(색상 코드표)** 이다.
     교과서는 1비트(0/1)와 2비트(00~11)를 보여 준다. 3비트까지 넣어 규칙을 넓혔다.
     ⚠ 1비트는 교과서 그림 Ⅱ-11 과 같게 **흰색·검정**으로 둔다(흑백 이미지).
       2·3비트는 회색 단계가 아니라 **또렷한 색**으로 두었다(2026-08-12 사용자 지시) —
       회색 단계는 전자칠판에서 서로 구별되지 않고, 실제 이미지도 색을 쓴다. */
  var DEPTHS = {
    1: { bits: 1, name: "1비트 (2색)",
         shades: ["#ffffff", "#111827"],
         names: ["흰색", "검정"] },
    2: { bits: 2, name: "2비트 (4색)",
         shades: ["#ffffff", "#ef4444", "#22c55e", "#2563eb"],
         names: ["흰색", "빨강", "초록", "파랑"] },
    3: { bits: 3, name: "3비트 (8색)",
         shades: ["#ffffff", "#ef4444", "#f97316", "#facc15",
                  "#22c55e", "#38bdf8", "#2563eb", "#a855f7"],
         names: ["흰색", "빨강", "주황", "노랑", "초록", "하늘", "파랑", "보라"] }
  };

  function levelsOf(bits) { return Math.pow(2, bits); }
  function maxLevel(bits) { return levelsOf(bits) - 1; }

  /* ---------------------------------------------------------
     빛의 삼원색 (RGB) — 교과서 63쪽 「이미지를 저장하는 방식」 더 알아보기

       교과서는 **GIF 256개 색상 · JPEG 1,600만 개 색상 · PNG 투명도 256단계** 라고만
       적어 두고 그 숫자가 어디서 나왔는지는 말하지 않는다.
         256 = 2⁸        → 8비트
         16,777,216 = 2²⁴ → 빨강·초록·파랑을 **각각 8비트씩** = 24비트
       이 화면이 그 숫자를 잇는다. 62쪽의 1·2비트 팔레트(약속표) 방식과 나란히 두어
       **색을 적는 두 가지 방법**을 구별하게 한다.

       ⚠ 빛은 물감과 반대로 **섞을수록 밝아진다**(가산혼합). 세 색을 다 켜면 흰색이다.
     --------------------------------------------------------- */
  var CH_MAX = 255;                 /* 채널 하나의 최댓값 (8비트) */
  var CH_BITS = [8, 4, 3, 2, 1];    /* 채널당 비트 — 줄이면 색이 끊긴다(포스터화) */

  /* 채널 값 하나를 8자리 이진수로 */
  function chanBin(v) { return padLeft(Math.round(v).toString(2), 8); }

  /* #RRGGBB — 16진수 두 자리씩. 숫자 변환에서 배운 10→16 이 여기 쓰인다. */
  function hexOf(r, g, b) {
    function two(v) { return padLeft(Math.round(v).toString(16).toUpperCase(), 2); }
    return "#" + two(r) + two(g) + two(b);
  }

  function cssRgb(r, g, b) {
    return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
  }

  /* 빛의 삼원색으로 만드는 대표 색 — 섞을수록 밝아지는 것을 단추로 겪게 한다 */
  var RGB_PRESETS = [
    { name: "빨강", r: 255, g: 0,   b: 0   },
    { name: "초록", r: 0,   g: 255, b: 0   },
    { name: "파랑", r: 0,   g: 0,   b: 255 },
    { name: "노랑", r: 255, g: 255, b: 0,   why: "빨강 + 초록" },
    { name: "하늘", r: 0,   g: 255, b: 255, why: "초록 + 파랑" },
    { name: "자홍", r: 255, g: 0,   b: 255, why: "빨강 + 파랑" },
    { name: "흰색", r: 255, g: 255, b: 255, why: "셋 다 켜기" },
    { name: "검정", r: 0,   g: 0,   b: 0,   why: "셋 다 끄기" }
  ];

  /* 채널당 비트를 줄였다가 되돌린 값 — 소리의 **양자화**와 똑같은 계산이다.
     8비트 → 그대로 / 1비트 → 0 아니면 255 (중간이 사라져 색이 계단처럼 끊긴다) */
  function quantChannel(v, bits) {
    if (bits >= 8) return Math.max(0, Math.min(CH_MAX, Math.round(v)));
    var top = maxLevel(bits);                             /* 단계 수 - 1 */
    var step = Math.round(v / CH_MAX * top);              /* 가장 가까운 단계 */
    return Math.round(step * CH_MAX / top);               /* 다시 0~255 로 */
  }

  /* 색의 수를 사람이 읽기 좋게 — 교과서의 「256개」·「1,600만 개」와 잇는다 */
  function countText(n) {
    if (n < 10000) return n.toLocaleString("ko-KR") + "가지";
    return n.toLocaleString("ko-KR") + "가지 (약 " +
           Math.round(n / 10000).toLocaleString("ko-KR") + "만)";
  }

  /* ---------------------------------------------------------
     그림 하나로 모든 실험을 한다 — 노을 풍경 (u, v 는 0~1)

       왜 이 그림인가 : **하늘이 부드러운 그러데이션**이라 채널 비트를 줄이면
       띠(포스터화)가 곧바로 드러나고, **해의 둥근 테두리와 산의 비스듬한 선**이라
       해상도를 낮추면 계단이 곧바로 드러난다.
       사진 파일을 넣지 않고 계산으로만 그려 **외부 의존성 0개**를 지킨다.

       ⚠ 색·좌표를 바꾸면 두 실험의 결론이 흐려질 수 있다.
         하늘 그러데이션은 **화면 높이의 70% 를 지나가는 긴 경사**여야 띠가 보이고,
         산 경사는 **비스듬해야** 계단이 보인다(수평·수직선은 계단이 안 생긴다).
     --------------------------------------------------------- */
  var SKY_TOP    = [ 29,  61, 168];   /* 위쪽 짙은 파랑 */
  var SKY_BOTTOM = [253, 186, 116];   /* 지평선 주황 */
  var SUN        = [254, 243, 128];   /* 해 */
  var HILL_BACK  = [ 91,  33, 182];   /* 뒤 산 */
  var HILL_FRONT = [ 46,  16, 101];   /* 앞 산 */

  function mix(a, b, t) {
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return [a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t];
  }

  /* 산 높이 — 가우스 봉우리 두 개 (작을수록 위) */
  function hillBack(u)  { return 0.70 - 0.19 * Math.exp(-Math.pow((u - 0.28) / 0.22, 2)); }
  function hillFront(u) { return 0.84 - 0.21 * Math.exp(-Math.pow((u - 0.70) / 0.20, 2)); }

  function sceneColor(u, v) {
    if (v >= hillFront(u)) return HILL_FRONT.slice();
    if (v >= hillBack(u))  return HILL_BACK.slice();

    /* 하늘 — 긴 그러데이션 */
    var c = mix(SKY_TOP, SKY_BOTTOM, v / 0.80);

    /* 해 + 번짐 — 또 하나의 부드러운 경사 */
    var dx = (u - 0.63) * 1.6, dy = v - 0.40;     /* 가로가 넓어 보이지 않게 보정 */
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.085) return SUN.slice();
    if (d < 0.30)  return mix(SUN, c, (d - 0.085) / (0.30 - 0.085));
    return c;
  }

  /* 그림을 픽셀 배열로 — 해상도(cols × rows)와 채널당 비트를 함께 적용한다.
     돌려주는 것 : 길이 cols*rows*4 의 Uint8ClampedArray 와 같은 모양의 보통 배열 */
  function scenePixels(cols, rows, chBits) {
    var out = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var rgb = sceneColor((x + 0.5) / cols, (y + 0.5) / rows);
        out.push(quantChannel(rgb[0], chBits),
                 quantChannel(rgb[1], chBits),
                 quantChannel(rgb[2], chBits), 255);
      }
    }
    return out;
  }

  /* 그림에 실제로 나타난 서로 다른 색의 개수 — 포스터화를 숫자로 보여 준다 */
  function usedColors(pix) {
    var seen = {};
    for (var i = 0; i < pix.length; i += 4) {
      seen[pix[i] + "," + pix[i + 1] + "," + pix[i + 2]] = 1;
    }
    return Object.keys(seen).length;
  }

  function padLeft(s, n) {
    s = String(s);
    while (s.length < n) s = "0" + s;
    return s;
  }

  function shadeOf(v, bits) {
    var d = DEPTHS[bits] || DEPTHS[1];
    return d.shades[Math.min(d.shades.length - 1, Math.max(0, v))];
  }

  function colorName(v, bits) {
    var d = DEPTHS[bits] || DEPTHS[1];
    return d.names[Math.min(d.names.length - 1, Math.max(0, v))];
  }

  /* 그 색 위에 글자를 쓸 때 흰색이 나을지 검정이 나을지 — 밝기로 정한다.
     (색이 또렷해지면서 회색 기준으로는 안 맞게 되어 밝기 계산으로 바꿨다) */
  function inkOn(v, bits) {
    var hex = shadeOf(v, bits).replace("#", "");
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#334155" : "#ffffff";
  }

  /* 색상 코드표 자료 — 값 · 이진수 · 색 · 이름.
     이 표가 없으면 학생이 칸 색을 보고 값을 알 수 없다(연습·평가에서 반드시 함께 보여 준다). */
  function paletteRows(bits) {
    var out = [];
    for (var v = 0; v <= maxLevel(bits); v++) {
      out.push({
        v: v,
        bin: padLeft(v.toString(2), bits),
        css: shadeOf(v, bits),
        name: colorName(v, bits),
        ink: inkOn(v, bits)
      });
    }
    return out;
  }

  /* ---------------------------------------------------------
     격자(비트맵) 만들기
       grid[r][c] = 0 ~ maxLevel(bits)
     --------------------------------------------------------- */
  function blankGrid(cols, rows) {
    var g = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(0);
      g.push(row);
    }
    return g;
  }

  function randomGrid(cols, rows, bits) {
    var top = maxLevel(bits);
    var g = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(Math.floor(Math.random() * (top + 1)));
      g.push(row);
    }
    /* 모든 칸이 같은 값이면(0만 있거나 최댓값만 있으면) 문제가 되지 않는다 → 한 칸을 바꾼다 */
    var flat = g.reduce(function (a, r2) { return a.concat(r2); }, []);
    var allSame = flat.every(function (v) { return v === flat[0]; });
    if (allSame) g[0][0] = (flat[0] === 0) ? top : 0;
    return g;
  }

  /* 한 줄을 이진수로 — 칸마다 bits 자리씩, 사이를 띄운다(교과서 그림처럼) */
  function rowBin(row, bits, spaced) {
    var parts = row.map(function (v) { return padLeft(v.toString(2), bits); });
    return spaced ? parts.join(" ") : parts.join("");
  }

  /* 격자 전체를 이진수로 (줄 단위 목록) */
  function gridBins(grid, bits, spaced) {
    return grid.map(function (row) { return rowBin(row, bits, spaced); });
  }

  /* 이진수 한 줄 → 값 목록. 어긋나면 null */
  function parseRow(text, bits, cols) {
    var s = String(text == null ? "" : text).trim().replace(/\s+/g, "");
    if (!/^[01]+$/.test(s)) return null;
    if (s.length !== bits * cols) return null;
    var out = [];
    for (var i = 0; i < cols; i++) out.push(parseInt(s.substr(i * bits, bits), 2));
    return out;
  }

  /* ---------------------------------------------------------
     **이진수 → 그림** (되돌리기)
       줄마다 이진수를 적어 주면 격자를 만들어 준다.
       줄 나눔은 줄바꿈 또는 `/` 로 한다. 한 줄 안의 빈칸은 무시한다.
       돌려주는 것 : { grid, cols, rows, errors }
     --------------------------------------------------------- */
  function parseGrid(text, bits) {
    var raw = String(text == null ? "" : text).trim();
    if (raw === "") return { grid: null, errors: ["이진수를 먼저 넣어 주세요."] };
    if (/[^01\s,\/·|\n]/.test(raw)) {
      return { grid: null, errors: ["0과 1만 넣을 수 있습니다. 다른 글자가 섞여 있습니다."] };
    }
    var lines = raw.split(/[\n\/|]+/)
      .map(function (s) { return s.replace(/[\s,·]+/g, ""); })
      .filter(function (s) { return s !== ""; });
    if (!lines.length) return { grid: null, errors: ["이진수를 먼저 넣어 주세요."] };

    var errors = [];
    var len = lines[0].length;
    lines.forEach(function (l, i) {
      if (l.length !== len) {
        errors.push((i + 1) + "번째 줄이 " + l.length + "자리입니다 — 첫 줄과 같은 " + len +
                    "자리여야 합니다(줄마다 픽셀 수가 같아야 합니다).");
      }
    });
    if (errors.length) return { grid: null, errors: errors };
    if (len % bits !== 0) {
      return { grid: null, errors: ["한 줄이 " + len + "자리인데 픽셀 하나가 " + bits +
               "비트라면 딱 나누어지지 않습니다. " + bits + "의 배수로 넣으세요."] };
    }
    var cols = len / bits;
    if (cols > 16 || lines.length > 16) {
      return { grid: null, errors: ["격자는 16 × 16 까지만 그릴 수 있습니다 (지금 " +
               cols + " × " + lines.length + ")."] };
    }
    var grid = lines.map(function (l) { return parseRow(l, bits, cols); });
    if (grid.some(function (r) { return r === null; })) {
      return { grid: null, errors: ["이진수를 읽지 못했습니다. 0과 1만 넣어 주세요."] };
    }
    return { grid: grid, cols: cols, rows: grid.length, errors: [] };
  }

  /* ---------------------------------------------------------
     해상도와 용량 (교과서 63쪽)
       픽셀 수 = 가로 × 세로
       전체 비트 = 픽셀 수 × 색 깊이
     --------------------------------------------------------- */
  var RESOLUTIONS = [
    { w: 20,   h: 11,   name: "20×11" },
    { w: 80,   h: 45,   name: "80×45" },
    { w: 320,  h: 180,  name: "320×180" },
    { w: 1280, h: 720,  name: "HD 1280×720" },
    { w: 1920, h: 1080, name: "Full HD 1920×1080" },
    { w: 3840, h: 2160, name: "Ultra HD 3840×2160" }
  ];

  function sizeOf(w, h, bits) {
    var px = w * h;
    var bitsTotal = px * bits;
    return {
      w: w, h: h, bits: bits,
      pixels: px,
      bitsTotal: bitsTotal,
      bytes: bitsTotal / 8,
      kb: bitsTotal / 8 / 1024,
      mb: bitsTotal / 8 / 1024 / 1024
    };
  }

  /* 사람이 읽기 좋은 크기 */
  function humanBytes(bytes) {
    if (bytes < 1024) return (Math.round(bytes * 10) / 10) + " B";
    if (bytes < 1024 * 1024) return (Math.round(bytes / 1024 * 10) / 10) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (Math.round(bytes / 1024 / 1024 * 10) / 10) + " MB";
    return (Math.round(bytes / 1024 / 1024 / 1024 * 100) / 100) + " GB";
  }

  /* 동영상 용량 = 한 프레임 용량 × 프레임률 × 초 */
  var FPS_LIST = [6, 12, 24, 60];
  function videoSize(w, h, bits, fps, secs) {
    var one = sizeOf(w, h, bits);
    var frames = fps * secs;
    return {
      frames: frames,
      bitsTotal: one.bitsTotal * frames,
      bytes: one.bytes * frames,
      perFrame: one
    };
  }

  /* ---------------------------------------------------------
     벡터 도형 (교과서 62쪽 그림 Ⅱ-12 · 활동)
       수학적인 정보(좌표·크기·색)만 저장하므로 확대해도 다시 계산되어 깨지지 않는다.
     --------------------------------------------------------- */
  var COLORS = {
    blue:  { name: "파랑", css: "#2563eb" },
    red:   { name: "빨강", css: "#dc2626" },
    green: { name: "초록", css: "#16a34a" },
    black: { name: "검정", css: "#111827" }
  };

  /* 수식 문자열을 만든다 — 화면에 그대로 보여 주고 학생이 읽게 한다 */
  function vectorText(shape) {
    if (shape.kind === "rect") {
      return '<rect x="' + shape.x + '" y="' + shape.y +
             '" width="' + shape.w + '" height="' + shape.h +
             '" fill="' + shape.color + '">';
    }
    return '<circle cx="' + shape.x + '" cy="' + shape.y +
           '" r="' + shape.r + '" fill="' + shape.color + '">';
  }

  /* 교과서 활동의 우리말 수식도 함께 보여 준다 */
  function vectorKorean(shape) {
    if (shape.kind === "rect") {
      return "<직사각형 시작 좌표(x=" + shape.x + ", y=" + shape.y + ") 너비=" + shape.w +
             " 높이=" + shape.h + " 색상=" + (COLORS[shape.color] || {}).name + ">";
    }
    return "<원 중심 좌표(x=" + shape.x + ", y=" + shape.y + ") 반지름=" + shape.r +
           " 색상=" + (COLORS[shape.color] || {}).name + ">";
  }

  global.ImageCode = {
    DEPTHS: DEPTHS,
    RESOLUTIONS: RESOLUTIONS,
    FPS_LIST: FPS_LIST,
    COLORS: COLORS,
    CH_MAX: CH_MAX,
    CH_BITS: CH_BITS,
    RGB_PRESETS: RGB_PRESETS,
    chanBin: chanBin,
    hexOf: hexOf,
    cssRgb: cssRgb,
    quantChannel: quantChannel,
    countText: countText,
    sceneColor: sceneColor,
    scenePixels: scenePixels,
    usedColors: usedColors,
    levelsOf: levelsOf,
    maxLevel: maxLevel,
    padLeft: padLeft,
    shadeOf: shadeOf,
    colorName: colorName,
    inkOn: inkOn,
    paletteRows: paletteRows,
    blankGrid: blankGrid,
    randomGrid: randomGrid,
    rowBin: rowBin,
    gridBins: gridBins,
    parseRow: parseRow,
    parseGrid: parseGrid,
    sizeOf: sizeOf,
    humanBytes: humanBytes,
    videoSize: videoSize,
    vectorText: vectorText,
    vectorKorean: vectorKorean
  };
})(window);
