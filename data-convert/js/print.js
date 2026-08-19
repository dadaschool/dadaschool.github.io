/* =========================================================
   print.js — 인쇄용 활동지 만들기 (공용 부품)
   ---------------------------------------------------------
   루트 CLAUDE.md 의 [인쇄용 활동지 규칙] 을 실행하는 파일이다.

   왜 필요한가
     · 태블릿이 모자란 반이 있다.
     · 교실 인터넷이 막히는 날이 있다.
     · 결석생 보충, 수업 공개 참관용 배부 자료가 필요하다.
     그래서 **화면에서 푸는 것과 같은 문항**을 종이로도 낼 수 있어야 한다.

   🚫 정답을 절대 넣지 않는다.
     이 파일은 문항의 `q`(질문) · `opts`(선택지) · 답 칸 크기만 읽는다.
     `a` · `answer` · `accept` · `why` · `sol` 같은 칸은 **읽지도 않는다.**
     실수로 넘겨받아도 인쇄되지 않는다 — 아래 `answerKeys` 검사가 지운다.

   어떻게 쓰나
     Print.sheet({
       title: "1차시 학습지",  subtitle: "...",  standard: "[9정03-01]",
       sections: [ { step: "활동 1", lead: "...", items: [ ... ] } ]
     });
     → 새 창에 A4 문서를 만들고 브라우저 인쇄 대화상자를 띄운다.
       그 대화상자에서 「대상」을 «PDF로 저장» 으로 바꾸면 파일로 받는다.

   왜 window.print() 인가 (js/pdf.js 를 쓰지 않는 까닭)
     이 프로젝트의 `js/pdf.js` 는 한글을 **캔버스에 그림으로 그려** PDF 에 넣는다.
     화면 제출물에는 문제없지만, 인쇄하면 글자가 흐릿하고 용량이 커진다.
     브라우저 인쇄는 글자를 **벡터**로 내보내 훨씬 선명하고 가볍다.
     (실측 : 같은 학습지가 그림 PDF 292KB → 인쇄 PDF 60KB 수준)

   ⚠ 이 파일은 여러 앱이 **같은 내용으로** 들고 있다. 고칠 때 전부 반영할 것.
   ========================================================= */
(function (global) {
  "use strict";

  /* 정답이 들어 있을 수 있는 칸 이름 — 인쇄 문서에는 절대 나오지 않게 한다.
     문항 데이터를 그대로 넘겨도 안전하도록 하는 안전장치다. */
  var answerKeys = ["a", "ans", "answer", "answers", "accept", "sol",
                    "tol", "correct", "key", "aid"];

  /* ⚠ `why` 는 앱마다 뜻이 다르다 — 이것 때문에 한 번 헷갈렸다.
       · abstraction-algo : **풀기 전에 보여 주는 힌트** (화면에도 문항 아래 늘 보인다)
       · ai-class         : **정답 해설** (채점 뒤에만 보인다)
     그래서 기본은 «인쇄하지 않음» 이고, 힌트인 앱만 `hints: true` 를 준다.
     기본값을 반대로 두면 어느 앱에서 정답이 새는지 알아채기 어렵다. */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 문항 글에는 <b> <code> <br> <sub> <sup> 정도만 허용한다.
     앱의 문항 글에 이미 그 태그들이 쓰여 있어서 그대로 살려야 읽힌다.
     그 밖의 태그·속성은 지운다(문항 데이터가 화면 코드에서 오므로 과하게 믿지 않는다). */
  var ALLOW = /^(b|strong|i|em|code|br|sub|sup|u|small)$/i;
  function rich(s) {
    return String(s == null ? "" : s).replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g,
      function (all, tag) {
        return ALLOW.test(tag) ? "<" + (all.charAt(1) === "/" ? "/" : "") + tag.toLowerCase() + ">" : "";
      });
  }

  /* ---------------------------------------------------------
     답 칸 만들기 — 문항 종류마다 «학생이 손으로 쓸 자리» 를 만든다
     --------------------------------------------------------- */

  /* 줄 노트 — 텍스트 답. n 줄. */
  function lines(n) {
    var out = "";
    for (var i = 0; i < (n || 3); i++) out += '<div class="ln"></div>';
    return '<div class="lines">' + out + "</div>";
  }

  /* 짧은 답 칸 (숫자·단답) */
  function shortBox(unit, ph) {
    return '<div class="short">' +
           '<span class="sbox"></span>' +
           (unit ? '<span class="unit">' + esc(unit) + "</span>" : "") +
           (ph ? '<span class="ph">' + esc(ph) + "</span>" : "") +
           "</div>";
  }

  /* 선택지 — 번호를 붙여 세로로 늘어놓는다. 답은 옆의 ( ) 에 쓴다. */
  function options(opts, mark) {
    var num = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
    var out = (opts || []).map(function (o, i) {
      return '<li>' + (mark ? '<span class="box">☐</span>' : '<span class="on">' + (num[i] || (i + 1)) + "</span>") +
             '<span class="ot">' + rich(o) + "</span></li>";
    }).join("");
    return '<ul class="opts' + (mark ? " chk" : "") + '">' + out + "</ul>";
  }

  /* 표
       cols(또는 head) : 열 제목
       rows            : 빈 줄 수
       fixed           : 첫 열에 미리 적혀 있는 값들 (있으면 줄 수도 이것이 정한다)
     ⚠ 앱마다 칸 이름이 다르다 — mb-bluetooth·EnergyKeeper 는 `cols`,
       ai-class 는 `head` + `fixed` 를 쓴다. 둘 다 받는다. */
  function table(cols, rows, widths, fixed) {
    var n = fixed && fixed.length ? fixed.length : (rows || 3);
    var head = (cols || []).map(function (c, i) {
      var w = widths && widths[i] ? ' style="width:' + (widths[i] * 100 / sum(widths)).toFixed(1) + '%"' : "";
      return "<th" + w + ">" + rich(c) + "</th>";
    }).join("");
    var body = "";
    for (var r = 0; r < n; r++) {
      body += "<tr>" + (cols || []).map(function (c, ci) {
        if (ci === 0 && fixed && fixed[r] != null) return '<td class="fx">' + rich(fixed[r]) + "</td>";
        return "<td></td>";
      }).join("") + "</tr>";
    }
    return '<table class="tb"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }
  function sum(a) { var s = 0; (a || []).forEach(function (v) { s += v; }); return s || 1; }

  /* 빈칸 채우기 — 라벨 + 밑줄 */
  function blanks(list) {
    return '<div class="blanks">' + (list || []).map(function (b) {
      var label = typeof b === "string" ? b : (b.label || "");
      return '<div class="bl"><span class="blab">' + rich(label) + '</span><span class="bline"></span></div>';
    }).join("") + "</div>";
  }

  /* 그림 칸 */
  function drawBox(h) {
    var px = Math.max(90, Math.min(520, h || 220));
    return '<div class="draw" style="height:' + px + 'px"><span>이 칸에 그리세요</span></div>';
  }

  /* ---------------------------------------------------------
     문항 하나 그리기
     --------------------------------------------------------- */
  function item(it, no, hints) {
    var k = String(it.kind || it.k || it.type || "text").toLowerCase();

    /* 안내·경고는 문제가 아니다 — 번호를 주지 않고 회색 글로만 넣는다 */
    if (k === "info" || k === "hint" || k === "warn" || k === "note") {
      return '<div class="info">' + rich(it.q || it.text || it.body || "") + "</div>";
    }

    var body = "";
    var tag = "";

    if (k === "choice") {
      tag = "하나 고르기";
      body = options(it.opts || it.options) + shortBox(null, "번호를 쓰세요");
    } else if (k === "multi" || k === "check" || k === "chk") {
      tag = k === "multi" ? "모두 고르기" : "표시하기";
      body = options(it.opts || it.options, true);
    } else if (k === "order") {
      tag = "골라서 순서대로";
      body = options(it.opts || it.options) +
             '<div class="order"><span>순서 →</span>' +
             '<span class="obox"></span><span class="arw">▸</span>' +
             '<span class="obox"></span><span class="arw">▸</span>' +
             '<span class="obox"></span><span class="arw">▸</span>' +
             '<span class="obox"></span></div>';
    } else if (k === "ox") {
      tag = "O · X";
      body = '<div class="ox">( &nbsp; O &nbsp; / &nbsp; X &nbsp; )</div>';
    } else if (k === "num" || k === "short") {
      tag = "짧은 답";
      body = shortBox(it.unit, it.ph);
    } else if (k === "tbl" || k === "table") {
      body = table(it.cols || it.head, it.rows, it.widths, it.fixed);
    } else if (k === "fill") {
      tag = "빈칸 채우기";
      body = (it.sub ? '<div class="sub">' + rich(it.sub) + "</div>" : "") + blanks(it.blanks);
    } else if (k === "draw") {
      tag = "그리기";
      body = drawBox(it.height);
    } else {
      /* text — 기본값. lines·rows 로 줄 수를 정한다 */
      body = lines(it.lines || it.rows || 3);
    }

    /* it.ref — 문제를 풀려면 **함께 줘야 하는 자료** (코드표 · 색 견본 · 격자 …).
       앱이 직접 만든 HTML 을 그대로 넣는다. 화면에서 학생에게 주는 것과 같은 자료다.
       ⚠ 여기에 정답을 넣지 말 것 — print.js 가 걸러 줄 수 없는 유일한 칸이다.
         (`rich()` 를 거치지 않는다. 표를 살려야 해서 그렇다) */
    var ref = it.ref ? '<div class="ref">' + it.ref + "</div>" : "";

    return '<div class="it">' +
             '<div class="q"><span class="no">' + no + "</span>" +
               '<span class="qt">' + rich(it.q || it.text || "") +
               (tag ? ' <span class="tag">' + tag + "</span>" : "") + "</span></div>" +
             (it.ph && k !== "num" && k !== "short" ? '<div class="sub">' + esc(it.ph) + "</div>" : "") +
             (hints && it.why ? '<div class="tip">💡 ' + rich(it.why) + "</div>" : "") +
             ref +
             '<div class="ab">' + body + "</div>" +
           "</div>";
  }

  /* ---------------------------------------------------------
     문서 전체
     --------------------------------------------------------- */
  function build(opt) {
    var no = 0;
    var secs = (opt.sections || []).map(function (sec) {
      var items = (sec.items || []).map(function (it) {
        var k = String(it.kind || it.k || it.type || "").toLowerCase();
        var counted = !(k === "info" || k === "hint" || k === "warn" || k === "note");
        if (counted) no++;
        return item(it, counted ? no : "", opt.hints);
      }).join("");
      /* 앱마다 «단계 이름» 을 담는 칸이 다르고, 둘 다 있는 앱도 있다
         (abstraction-algo : step="활동 1" + title="쓰레기 분리배출 …").
         하나만 쓰면 제목의 절반이 사라진다 — 둘 다 있으면 이어 붙인다. */
      var head = sec.step && sec.title && sec.step !== sec.title
        ? rich(sec.step) + ' <span class="h2s">' + rich(sec.title) + "</span>"
        : rich(sec.step || sec.title || "");
      /* brk: true — 이 단계를 **새 쪽에서** 시작한다.
         여러 차시를 한 문서로 묶을 때 차시가 쪽 중간에서 시작하지 않게 한다. */
      return '<section class="sec' + (sec.brk ? " brk" : "") + '">' +
               "<h2>" + head + "</h2>" +
               (sec.lead || sec.intro ? '<p class="lead">' + rich(sec.lead || sec.intro) + "</p>" : "") +
               items +
             "</section>";
    }).join("");

    var fields = opt.head || ["학년", "반", "번호", "이름"];
    var nameRow = fields.map(function (f) {
      var wide = /이름|성명/.test(f);
      return '<span class="nf' + (wide ? " w" : "") + '"><b>' + esc(f) + "</b><i></i></span>";
    }).join("");

    return '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
      "<title>" + esc(opt.title || "인쇄용 활동지") + "</title>" +
      "<style>" + CSS + "</style></head><body>" +
      /* 화면에만 보이는 안내 막대 (인쇄되지 않는다) */
      '<div class="bar">' +
        '<button onclick="window.print()">🖨 인쇄하기</button>' +
        '<span>인쇄 대화상자에서 <b>「대상」</b>을 <b>「PDF로 저장」</b> 으로 바꾸면 ' +
        '파일로 내려받습니다. (양면 인쇄를 켜면 종이가 절반으로 줄어듭니다)</span>' +
      "</div>" +
      '<div class="page">' +
        '<header>' +
          "<h1>" + esc(opt.title || "활동지") + "</h1>" +
          (opt.subtitle ? '<p class="st">' + esc(opt.subtitle) + "</p>" : "") +
          '<div class="who">' + nameRow + "</div>" +
          (opt.standard ? '<p class="std">' + esc(opt.standard) + "</p>" : "") +
          (opt.note ? '<p class="nt">' + rich(opt.note) + "</p>" : "") +
        "</header>" +
        secs +
        '<footer>' + esc(opt.footer || opt.title || "") + "</footer>" +
      "</div></body></html>";
  }

  /* ---------------------------------------------------------
     A4 인쇄 CSS — 화면 앱의 css/app.css 에 의존하지 않는다(자기 완결)
     --------------------------------------------------------- */
  var CSS = [
    '*{box-sizing:border-box}',
    'body{margin:0;background:#eef1f5;color:#111;',
    '  font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;',
    '  font-size:11pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}',

    /* 화면 안내 막대 */
    '.bar{position:sticky;top:0;z-index:9;display:flex;gap:14px;align-items:center;flex-wrap:wrap;',
    '  padding:12px 18px;background:#103b6f;color:#fff;font-size:13px}',
    '.bar button{font-size:15px;font-weight:700;padding:9px 18px;border:0;border-radius:9px;',
    '  background:#ffd166;color:#20344f;cursor:pointer}',
    '.bar b{color:#ffd166}',

    /* A4 한 장 */
    '.page{width:210mm;min-height:297mm;margin:18px auto;padding:16mm 15mm 14mm;background:#fff;',
    '  box-shadow:0 2px 10px rgba(0,0,0,.16)}',

    /* 머리말 */
    'header{border-bottom:2.4pt solid #103b6f;padding-bottom:8pt;margin-bottom:12pt}',
    'h1{margin:0 0 3pt;font-size:19pt;letter-spacing:-.6pt;color:#0e2f59}',
    '.st{margin:0 0 7pt;font-size:11pt;color:#44546a}',
    '.who{display:flex;gap:9pt;flex-wrap:wrap;margin:8pt 0 6pt}',
    '.nf{display:flex;align-items:flex-end;gap:5pt;font-size:11pt}',
    '.nf b{font-weight:700;color:#333}',
    '.nf i{display:inline-block;width:52pt;border-bottom:1pt solid #333;height:15pt}',
    '.nf.w i{width:96pt}',
    '.std{margin:5pt 0 0;font-size:8.6pt;color:#7a8798}',
    '.nt{margin:6pt 0 0;padding:6pt 9pt;background:#f3f7fc;border-left:3pt solid #4d84c9;',
    '  font-size:9.6pt;color:#33465e}',

    /* 활동(단계) */
    '.sec{margin:0 0 13pt;break-inside:auto}',
    '.sec.brk{break-before:page;page-break-before:always}',
    '.sec h2{margin:12pt 0 4pt;padding:4pt 9pt;background:#e8eff8;border-radius:4pt;',
    '  font-size:12.4pt;color:#0e2f59;break-after:avoid}',
    '.sec h2 .h2s{font-weight:400;color:#3c5878}',
    '.lead{margin:0 0 8pt;padding:0 2pt;font-size:9.8pt;color:#5a6b80;break-after:avoid}',

    /* 문항 — 한 문항이 쪽 사이에서 끊기지 않게 한다 */
    '.it{margin:0 0 10pt;break-inside:avoid;page-break-inside:avoid}',
    '.q{display:flex;gap:6pt;align-items:flex-start}',
    '.no{flex:none;min-width:17pt;height:17pt;display:inline-flex;align-items:center;justify-content:center;',
    '  border-radius:50%;background:#103b6f;color:#fff;font-size:9pt;font-weight:700}',
    '.qt{font-size:11pt;font-weight:600;color:#16202c}',
    '.qt code{padding:0 3pt;background:#f0f2f5;border-radius:3pt;font-family:Consolas,monospace;font-size:10pt}',
    '.tag{display:inline-block;margin-left:4pt;padding:1pt 5pt;border:.8pt solid #9fb3cd;border-radius:8pt;',
    '  font-size:8pt;font-weight:600;color:#5a7086}',
    '.sub{margin:3pt 0 0 23pt;font-size:9.4pt;color:#67788d}',
    '.tip{margin:3pt 0 0 23pt;font-size:9.2pt;color:#5b7a4e}',
    '.ab{margin:5pt 0 0 23pt}',
    '.info{margin:6pt 0 8pt;padding:6pt 9pt;background:#fbf6e6;border-left:3pt solid #d9a72c;',
    '  font-size:9.8pt;color:#4a3d1c}',

    /* 문제에 함께 주는 자료 (코드표 · 색 견본 · 격자) */
    '.ref{margin:5pt 0 0 23pt;padding:6pt 8pt;background:#f6f9fd;border:.7pt solid #cfdcec;',
    '  border-radius:4pt;font-size:9.4pt}',
    '.ref b{color:#0e2f59}',
    '.ref table{border-collapse:collapse;margin:3pt 0}',
    '.ref th,.ref td{border:.7pt solid #8fa3bb;padding:2pt 7pt;font-size:9.4pt;text-align:center}',
    '.ref th{background:#e6eef8;color:#0e2f59}',
    '.ref .rt{margin:0 0 3pt;font-weight:700;color:#0e2f59;font-size:9.6pt}',
    '.ref .mono{font-family:Consolas,monospace;letter-spacing:.5pt}',
    /* 색 견본 줄 */
    '.ref .pal{display:flex;gap:5pt;flex-wrap:wrap;margin:3pt 0}',
    '.ref .pc{display:flex;align-items:center;gap:3pt;font-size:8.8pt}',
    '.ref .sw{display:inline-block;width:26pt;height:14pt;border:.7pt solid #55627a;border-radius:2pt;',
    '  text-align:center;line-height:14pt;font-family:Consolas,monospace;font-size:7.6pt}',
    /* 그림 격자 */
    '.ref .pix{border-collapse:collapse}',
    '.ref .pix td{width:15pt;height:15pt;border:.5pt solid #b7c4d4;padding:0}',

    /* 선택지 */
    '.opts{list-style:none;margin:0;padding:0}',
    '.opts li{display:flex;gap:5pt;align-items:flex-start;margin:0 0 2.5pt;font-size:10.4pt}',
    '.on{flex:none;color:#103b6f;font-weight:700}',
    '.box{flex:none;font-size:12pt;line-height:1;color:#44546a}',
    '.opts.chk li{margin-bottom:4pt}',

    /* 답 칸 */
    '.short{display:flex;align-items:flex-end;gap:6pt;margin-top:5pt}',
    '.sbox{display:inline-block;width:86pt;height:17pt;border:1pt solid #333;border-radius:3pt}',
    '.unit{font-size:10pt;font-weight:600}',
    '.ph{font-size:8.6pt;color:#8b9aab}',
    '.lines{margin-top:2pt}',
    '.ln{height:19pt;border-bottom:.7pt dotted #9aa7b5}',
    '.ox{font-size:12pt;font-weight:700;letter-spacing:1pt}',
    '.order{display:flex;align-items:center;gap:4pt;margin-top:6pt;font-size:9.6pt;color:#5a6b80}',
    '.obox{display:inline-block;width:34pt;height:19pt;border:1pt solid #333;border-radius:3pt}',
    '.arw{color:#9aa7b5}',
    '.draw{border:1pt dashed #98a6b6;border-radius:5pt;background:#fcfdfe;',
    '  display:flex;align-items:flex-end;justify-content:flex-end;padding:4pt 7pt}',
    '.draw span{font-size:8.4pt;color:#a9b6c4}',
    '.blanks{margin-top:3pt}',
    '.bl{display:flex;align-items:flex-end;gap:6pt;margin:0 0 5pt}',
    '.blab{font-size:10pt;color:#33465e}',
    '.bline{flex:1;min-width:70pt;border-bottom:1pt solid #333;height:16pt}',

    /* 표 */
    '.tb{width:100%;border-collapse:collapse;margin-top:4pt}',
    '.tb th,.tb td{border:.8pt solid #6f8199;padding:4pt 5pt;font-size:9.6pt}',
    '.tb th{background:#eaf0f7;color:#0e2f59;font-size:9.4pt}',
    '.tb td{height:22pt}',
    '.tb td.fx{background:#f7f9fc;font-weight:600;color:#2c3e55;height:auto}',

    'footer{margin-top:14pt;padding-top:6pt;border-top:.8pt solid #c8d2df;',
    '  font-size:8.4pt;color:#98a6b6;text-align:center}',

    /* ===== 인쇄할 때 ===== */
    '@page{size:A4;margin:14mm 13mm}',
    '@media print{',
    '  body{background:#fff}',
    '  .bar{display:none}',
    '  .page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}',
    '}'
  ].join("");

  /* ---------------------------------------------------------
     새 창에 띄우기
     --------------------------------------------------------- */
  function sheet(opt) {
    /* 넘겨받은 데이터에서 정답 칸을 미리 지운다(위 안전장치) */
    var safe = strip(opt);
    var html = build(safe);
    var w = global.open("", "_blank");
    if (!w) {
      alert("팝업이 막혀 있습니다.\n주소창 오른쪽의 팝업 차단 표시를 눌러 허용해 주세요.");
      return null;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    /* 글꼴·레이아웃이 잡힌 뒤에 인쇄 대화상자를 띄운다 */
    w.onload = function () { try { w.focus(); w.print(); } catch (e) {} };
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 700);
    return w;
  }

  /* 정답이 될 수 있는 칸을 모두 지운 사본을 만든다 */
  function strip(v) {
    if (v == null || typeof v !== "object") return v;
    if (Object.prototype.toString.call(v) === "[object Array]") return v.map(strip);
    var out = {};
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (answerKeys.indexOf(k) >= 0) continue;      /* 정답·해설 칸은 버린다 */
      out[k] = strip(v[k]);
    }
    return out;
  }

  global.Print = { sheet: sheet, build: build, strip: strip };
})(window);
