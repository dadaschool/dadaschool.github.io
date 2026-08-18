/* =========================================================
   flow.js — 의사코드 블록 → 순서도(SVG) 자동 변환

   학생이 블록을 쌓으면 왼쪽에는 의사코드가, 오른쪽에는 순서도가
   동시에 그려진다. 「자연어 → 의사코드 → 순서도」 순서로 지도하라는
   교과서의 안내를 화면 하나에서 눈으로 잇게 하려는 것이다.

   도형은 교과서와 같은 약속을 따른다.
     타원 = 시작·끝   직사각형 = 처리(순차)   마름모 = 판단(선택·반복)

   외부 라이브러리를 쓰지 않는다. SVG 문자열을 직접 조립한다.
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     블록 사전 — 실험실과 학습지가 같은 것을 쓴다
     --------------------------------------------------------- */
  /* cond  = 순서도 마름모 안에 들어갈 '물음' 형태
     text  = 의사코드 한 줄에 들어갈 '문장' 형태
     둘을 나눠 둔 이유는 “만약 빨간불인가? 이면”처럼 어색한 말이 되지 않게 하려는 것이다. */
  var BLOCKS = {
    confirm:  { kind: "seq",     em: "🏥", text: "병원 위치를 확인한다" },
    move:     { kind: "seq",     em: "🚑", text: "앞으로 한 칸 이동한다" },
    handover: { kind: "seq",     em: "🩺", text: "환자를 병원에 인계한다" },
    loop:     { kind: "loop",    em: "🔁", text: "병원에 도착할 때까지 반복한다", cond: "병원에 도착했는가?" },
    loopEnd:  { kind: "loopEnd", em: "⏹️", text: "반복 끝" },
    siren:    { kind: "if", em: "🚦", cond: "신호등이 빨간불인가?",
                when: "신호등이 빨간불이면", then: "사이렌을 켜고 서행 통과한다" },
    waitRed:  { kind: "if", em: "🛑", cond: "신호등이 빨간불인가?",
                when: "신호등이 빨간불이면", then: "멈춰서 파란불을 기다린다" }
  };

  /* ---------------------------------------------------------
     1. 블록 목록(1차원) → 나무 구조
        반복 블록 다음에 오는 것들은 반복 '안'으로 들어간다.
        반복 끝을 넣지 않으면 열린 채로 두고 open = true 로 알린다.
     --------------------------------------------------------- */
  function parse(list) {
    var root = { body: [] };
    var stack = [root];
    var openLoop = 0;
    var strayEnd = 0;

    list.forEach(function (id) {
      var b = BLOCKS[id];
      if (!b) return;
      var top = stack[stack.length - 1];

      if (b.kind === "loop") {
        var node = { id: id, kind: "loop", body: [] };
        top.body.push(node);
        stack.push(node);
        openLoop++;
      } else if (b.kind === "loopEnd") {
        if (stack.length > 1) { stack.pop(); openLoop--; }
        else strayEnd++;                       /* 열지도 않고 닫은 경우 */
      } else {
        top.body.push({ id: id, kind: b.kind });
      }
    });

    return { tree: root, open: openLoop > 0, stray: strayEnd > 0 };
  }

  /* ---------------------------------------------------------
     2. 의사코드 글자 만들기 (들여쓰기 포함)
     --------------------------------------------------------- */
  function pseudo(list) {
    var out = [];
    var depth = 0;
    list.forEach(function (id) {
      var b = BLOCKS[id];
      if (!b) return;
      if (b.kind === "loopEnd") depth = Math.max(0, depth - 1);
      var pad = "";
      for (var i = 0; i < depth; i++) pad += "　　";
      if (b.kind === "loop") {
        out.push({ pad: pad, text: b.text, kind: b.kind, em: b.em });
        depth++;
      } else if (b.kind === "if") {
        out.push({ pad: pad, text: "만약 " + b.when + ", " + b.then, kind: b.kind, em: b.em });
      } else if (b.kind === "loopEnd") {
        out.push({ pad: pad, text: "반복 끝", kind: b.kind, em: b.em });
      } else {
        out.push({ pad: pad, text: b.text, kind: b.kind, em: b.em });
      }
    });
    return out;
  }

  /* ---------------------------------------------------------
     3. 순서도 그리기
     --------------------------------------------------------- */
  var CX = 300;                 /* 가운데 세로선 */
  var BOX_W = 236, BOX_H = 52;
  var DIA_W = 250, DIA_H = 78;
  var CAP_W = 130, CAP_H = 44;  /* 시작·끝 타원 */
  var VGAP = 30;
  var IF_RAIL = CX + 160;       /* 선택의 '아니오' 가 지나는 세로선 */
  var LOOP_RAIL = CX + 205;     /* 반복의 '예' 가 지나는 세로선 */
  var BACK_RAIL = CX - 185;     /* 반복이 되돌아가는 세로선 */
  var MERGE = 26;

  var COL = {
    seq:  { fill: "#e0e7ff", line: "#4f46e5", text: "#1e1b4b" },
    if:   { fill: "#ffedd5", line: "#ea580c", text: "#431407" },
    loop: { fill: "#f3e8ff", line: "#9333ea", text: "#3b0764" },
    cap:  { fill: "#0f172a", line: "#0f172a", text: "#ffffff" },
    act:  { fill: "#fff7ed", line: "#ea580c", text: "#431407" }
  };

  /* 높이 계산 — 그리기 전에 전체 크기를 알아야 한다 */
  function measure(body) {
    var h = 0;
    body.forEach(function (n) {
      if (n.kind === "loop") h += DIA_H + VGAP + measure(n.body) + 18 + MERGE + VGAP;
      else if (n.kind === "if") h += DIA_H + VGAP + BOX_H + MERGE + VGAP;
      else h += BOX_H + VGAP;
    });
    return h;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 글자가 길면 두 줄로 나눈다 */
  function twoLines(text, max) {
    if (text.length <= max) return [text];
    var cut = text.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    return [text.slice(0, cut), text.slice(cut).trim()];
  }

  function textSvg(x, y, lines, color, size) {
    size = size || 15;
    var lh = 19;
    var top = y - (lines.length - 1) * lh / 2;
    return lines.map(function (ln, i) {
      return '<text x="' + x + '" y="' + (top + i * lh) + '" fill="' + color +
        '" font-size="' + size + '" text-anchor="middle" dominant-baseline="middle" ' +
        'font-family="Malgun Gothic, sans-serif">' + esc(ln) + '</text>';
    }).join("");
  }

  function box(x, y, w, h, c, lines) {
    return '<rect x="' + (x - w / 2) + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="10" fill="' + c.fill + '" stroke="' + c.line + '" stroke-width="2.5"/>' +
      textSvg(x, y + h / 2, lines, c.text);
  }
  function diamond(x, y, w, h, c, lines) {
    var pts = [x + "," + y, (x + w / 2) + "," + (y + h / 2), x + "," + (y + h), (x - w / 2) + "," + (y + h / 2)];
    return '<polygon points="' + pts.join(" ") + '" fill="' + c.fill + '" stroke="' + c.line +
      '" stroke-width="2.5"/>' + textSvg(x, y + h / 2, lines, c.text, 14);
  }
  function cap(x, y, label) {
    return '<rect x="' + (x - CAP_W / 2) + '" y="' + y + '" width="' + CAP_W + '" height="' + CAP_H +
      '" rx="' + (CAP_H / 2) + '" fill="' + COL.cap.fill + '"/>' +
      textSvg(x, y + CAP_H / 2, [label], COL.cap.text, 16);
  }
  function line(pts, dashed) {
    return '<polyline points="' + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
      '" fill="none" stroke="#64748b" stroke-width="2.4"' +
      (dashed ? ' stroke-dasharray="7 5"' : "") + ' marker-end="url(#fa)"/>';
  }
  function plain(pts) {
    return '<polyline points="' + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ") +
      '" fill="none" stroke="#64748b" stroke-width="2.4"/>';
  }
  function tag(x, y, t) {
    return '<rect x="' + (x - 17) + '" y="' + (y - 12) + '" width="34" height="23" rx="7" fill="#fff" stroke="#cbd5e1"/>' +
      '<text x="' + x + '" y="' + (y + 1) + '" fill="#475569" font-size="13" text-anchor="middle" ' +
      'dominant-baseline="middle" font-family="Malgun Gothic, sans-serif">' + t + '</text>';
  }

  /* body 를 y 위치부터 그린다. 그린 뒤의 y 를 돌려준다. */
  function drawBody(body, y, out) {
    body.forEach(function (n) {
      if (n.kind === "loop") {
        var b = BLOCKS[n.id];
        var dy = y;
        out.push(diamond(CX, dy, DIA_W, DIA_H, COL.loop, twoLines(b.cond, 14)));
        var bodyTop = dy + DIA_H + VGAP;
        out.push(line([[CX, dy + DIA_H], [CX, bodyTop]]));
        out.push(tag(CX + 24, dy + DIA_H + 14, "아니오"));

        var bodyEnd = drawBody(n.body, bodyTop, out);
        if (!n.body.length) bodyEnd = bodyTop;

        /* 되돌아가는 선 — 몸통 끝에서 왼쪽으로 빠져 판단 위로 */
        var backY = bodyEnd + 18;
        out.push(plain([[CX, bodyEnd - VGAP], [CX, backY], [BACK_RAIL, backY]]));
        out.push(line([[BACK_RAIL, backY], [BACK_RAIL, dy + DIA_H / 2], [CX - DIA_W / 2, dy + DIA_H / 2]]));

        /* 빠져나가는 선 — 판단 오른쪽에서 반복 아래로 */
        var outY = backY + MERGE;
        out.push(plain([[CX + DIA_W / 2, dy + DIA_H / 2], [LOOP_RAIL, dy + DIA_H / 2], [LOOP_RAIL, outY]]));
        out.push(line([[LOOP_RAIL, outY], [CX, outY], [CX, outY + VGAP]]));
        out.push(tag(CX + DIA_W / 2 + 26, dy + DIA_H / 2 - 13, "예"));

        y = outY + VGAP;

      } else if (n.kind === "if") {
        var ib = BLOCKS[n.id];
        var iy = y;
        out.push(diamond(CX, iy, DIA_W, DIA_H, COL.if, twoLines(ib.cond, 14)));
        var actY = iy + DIA_H + VGAP;
        out.push(line([[CX, iy + DIA_H], [CX, actY]]));
        out.push(tag(CX + 24, iy + DIA_H + 14, "예"));
        out.push(box(CX, actY, BOX_W, BOX_H, COL.act, twoLines(ib.then, 15)));

        var mergeY = actY + BOX_H + MERGE;
        out.push(plain([[CX, actY + BOX_H], [CX, mergeY]]));
        /* 아니오 : 오른쪽으로 돌아 아래에서 합류 */
        out.push(plain([[CX + DIA_W / 2, iy + DIA_H / 2], [IF_RAIL, iy + DIA_H / 2], [IF_RAIL, mergeY], [CX, mergeY]]));
        out.push(tag(IF_RAIL - 44, iy + DIA_H / 2 - 13, "아니오"));
        out.push(line([[CX, mergeY], [CX, mergeY + VGAP]]));

        y = mergeY + VGAP;

      } else {
        var sb = BLOCKS[n.id];
        out.push(box(CX, y, BOX_W, BOX_H, COL.seq, twoLines(sb.text, 15)));
        out.push(line([[CX, y + BOX_H], [CX, y + BOX_H + VGAP]]));
        y += BOX_H + VGAP;
      }
    });
    return y;
  }

  /* 전체 순서도를 SVG 문자열로 만든다 */
  function render(list) {
    var p = parse(list);
    var out = [];
    var y = 0;

    out.push(cap(CX, y, "시작"));
    out.push(line([[CX, y + CAP_H], [CX, y + CAP_H + VGAP]]));
    y += CAP_H + VGAP;

    y = drawBody(p.tree.body, y, out);

    out.push(cap(CX, y, "끝"));
    var total = y + CAP_H + 16;

    var defs = '<defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>';

    return {
      svg: '<svg viewBox="0 ' + (-8) + ' 620 ' + (total + 16) + '" width="100%" ' +
        'style="max-height:none" role="img" aria-label="순서도">' + defs + out.join("") + '</svg>',
      open: p.open,
      stray: p.stray,
      tree: p.tree
    };
  }

  global.Flow = {
    BLOCKS: BLOCKS,
    parse: parse,
    pseudo: pseudo,
    render: render,
    measure: measure
  };
})(window);
