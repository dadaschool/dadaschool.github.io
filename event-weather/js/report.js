/**
 * report.js — 「행사일 검토 자료」 를 A4 로 인쇄한다 (기안·협의에 붙이는 용도)
 *
 * ⚠ 이 파일은 여러 앱이 함께 쓰는 `js/print.js`(10곳)와 **다른 파일**이다.
 *   그쪽은 학습지 문항을 찍는 것이고 이 앱에는 학습지가 없다.
 *   헷갈리지 않게 이름을 일부러 다르게 두었다
 *   (cable-label 의 `js/pdf.js` 가 공용이 아닌데 이름이 같아 헷갈렸던 일을
 *    되풀이하지 않으려는 것이다).
 *
 * 🔴 인쇄물에 반드시 들어가야 하는 것 넷 — 빼면 «근거 자료» 가 되지 못한다
 *   ① 예보가 아니라는 말
 *   ② 어느 관측소의 몇 년치인가
 *   ③ 항목마다 표본 수 (「27%」 가 아니라 「30년 중 8번」)
 *   ④ 어떤 기준으로 셌는가 (비 1mm? 더위 33℃?)
 *
 * 🔴 인쇄 창이 두 번 뜨던 버그 대비 — js/print.js 가 겪은 것과 같다.
 *   `document.write` 로 만든 창은 브라우저에 따라 `onload` 가 아예 안 뜨므로
 *   타이머를 함께 둔다. 대신 문패(`찍었나`)를 두어 **먼저 온 쪽만** 인쇄하고
 *   늦게 오는 쪽은 조용히 돌아선다. 둘 중 하나를 지우면 안 된다.
 */

(function (뿌리) {
  "use strict";

  function 옮김(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** 「27% (30일 중 8번)」 — ③ 표본 수를 늘 함께 */
  function 셈글(것, 뒷말) {
    if (!것 || !것.표본) return "자료 없음";
    return Math.round(것.비율 * 100) + "% " +
           "<span class=\"작게\">(자료 있는 " + 것.표본 + (뒷말 || "일") + " 중 " + 것.셈 + "번)</span>";
  }
  function 값글(것, 단위) {
    if (!것 || !것.표본 || 것.평균 == null) return "자료 없음";
    return 것.평균.toFixed(1) + 단위 +
           " <span class=\"작게\">(" + 것.최소.toFixed(0) + "~" + 것.최대.toFixed(0) + 단위 + ")</span>";
  }

  function 칸글(열쇠, c, 뜻) {
    var 요 = c.요약, 구 = c.구간;
    switch (열쇠) {
      case "비":   return 셈글(요.비);
      case "큰비": return 구 ? 셈글(구.큰비, "해") : 셈글(요.큰비);
      case "더위": return 셈글(요.더위);
      case "강풍": return 셈글(요.강풍);
      case "최고": return 값글(요.최고, "℃");
      case "최저": return 값글(요.최저, "℃");
      case "내내맑음":   return 셈글(구.내내맑음, "해");
      case "하루라도비": return 셈글(구.하루라도비, "해");
      case "이틀이상비": return 셈글(구.이틀이상비, "해");
      case "밤최저": return 구.평균최저 == null ? "자료 없음"
        : 구.평균최저.toFixed(1) + "℃ <span class=\"작게\">(자료 있는 " + 구.표본 + "해 평균)</span>";
      case "낮최고": return 구.평균최고 == null ? "자료 없음"
        : 구.평균최고.toFixed(1) + "℃ <span class=\"작게\">(자료 있는 " + 구.표본 + "해 평균)</span>";
    }
    return "";
  }

  function 만들기(뜻) {
    var 표 = 뜻.표, 후보들 = 뜻.후보들 || [];
    var 해수 = Object.keys(표.해).length;

    var 머리칸 = 후보들.map(function (c) {
      return "<th>" + 옮김(뜻.날꾸미기(c.날, 뜻.기간 ? 뜻.일수 : 0)) + "</th>";
    }).join("");

    var 신호칸 = 후보들.map(function (c) {
      return "<td><b class=\"신호 " + c.신호.빛 + "\">" + 옮김(c.신호.글) + "</b></td>";
    }).join("");

    var 몸 = 뜻.줄.map(function (열쇠) {
      return "<tr><th class=\"항목\">" + 옮김(뜻.줄이름[열쇠] || 열쇠) + "</th>" +
        후보들.map(function (c) { return "<td>" + 칸글(열쇠, c, 뜻) + "</td>"; }).join("") +
        "</tr>";
    }).join("");

    // ④ 어떤 기준으로 셌는가
    var 기준글 = [
      "비 " + 뜻.기준.비 + "mm 이상",
      "큰비 " + 뜻.기준.큰비 + "mm 이상",
      "더위 " + 뜻.기준.더위 + "℃ 이상",
      "강풍 " + 뜻.기준.강풍 + "m/s 이상",
      뜻.기간 ? (뜻.일수 + "일 이어서 봄") : ("앞뒤 " + 뜻.폭 + "일까지 함께 봄")
    ].join(" · ");

    var 가짜띠 = 뜻.가짜
      ? "<div class=\"가짜\">🚨 이 문서의 숫자는 «가짜» 입니다 — 실제 관측값이 아닙니다. " +
        "화면을 만들고 검사하려고 지어낸 자료이므로 <b>결재·협의 자료로 쓰지 마세요.</b></div>"
      : "";

    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      "<title>행사일 검토 자료 — " + 옮김(표.이름) + "</title><style>" +
      "@page{size:A4;margin:14mm 13mm}" +
      "*{box-sizing:border-box}" +
      "body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;color:#111;margin:0;font-size:11.5pt;line-height:1.55}" +
      "h1{font-size:17pt;margin:0 0 2mm}" +
      ".부제{color:#555;font-size:10pt;margin:0 0 4mm}" +
      ".가짜{border:2.5pt solid #000;padding:3mm;margin:0 0 4mm;font-size:11pt}" +
      // ① 예보가 아니라는 말 — 맨 위, 테두리를 둘러 눈에 띄게
      ".예보아님{border:1pt solid #888;background:#f4f4f4;padding:3mm;margin:0 0 4mm;font-size:10.5pt}" +
      "table{border-collapse:collapse;width:100%;margin:0 0 4mm}" +
      "th,td{border:0.7pt solid #999;padding:2mm 2.5mm;text-align:center;vertical-align:middle}" +
      "thead th{background:#eee;font-size:11pt}" +
      "th.항목{background:#f6f6f6;text-align:left;width:30mm;font-size:10.5pt}" +
      ".작게{font-size:8.8pt;color:#555;display:block}" +
      // 🔴 인쇄는 흑백일 수 있다. 색만으로 구분되지 않게 테두리와 굵기도 함께 바꾼다.
      ".신호{padding:1mm 3mm;border:1.2pt solid #333;border-radius:3mm;font-size:11pt}" +
      ".신호.초록{background:#fff}" +
      ".신호.노랑{background:#eee;border-width:1.8pt}" +
      ".신호.빨강{background:#ccc;border-width:2.5pt}" +
      ".밑{font-size:9.5pt;color:#444;border-top:0.7pt solid #bbb;padding-top:2.5mm;margin-top:3mm}" +
      ".밑 b{color:#111}" +
      ".적는칸{margin-top:5mm;border:0.7pt solid #999;padding:3mm;min-height:26mm}" +
      ".적는칸 .머리{font-size:10pt;color:#555;margin-bottom:2mm}" +
      "</style></head><body>" +

      "<h1>행사일 검토 자료 — " + 옮김({ 운동회: "운동회", 소풍: "소풍·현장체험학습", 야영: "수련활동·야영" }[뜻.행사] || 뜻.행사) + "</h1>" +
      "<p class=\"부제\">" + 옮김(표.이름) + " 관측소(" + 표.지점 + ") · " +
        표.시작 + "~" + 표.끝 + "년 " + 해수 + "해 자료</p>" +

      가짜띠 +

      "<div class=\"예보아님\"><b>이 문서는 예보가 아닙니다.</b> " +
      "과거 " + 해수 + "해 동안 그 무렵의 날씨가 어땠는지 세어 본 것입니다. " +
      "열흘 뒤까지는 기상청 예보가 있지만, <b>그보다 먼 날은 어떤 방법으로도 예보할 수 없습니다.</b> " +
      "행사가 가까워지면 예보를 다시 확인해 주세요.</div>" +

      "<table><thead><tr><th class=\"항목\">" + (뜻.기간 ? "기간" : "후보 날짜") + "</th>" + 머리칸 + "</tr></thead>" +
      "<tbody><tr><th class=\"항목\">한눈에</th>" + 신호칸 + "</tr>" + 몸 + "</tbody></table>" +

      "<div class=\"밑\">" +
      "<b>센 기준</b> : " + 옮김(기준글) + "<br>" +
      "<b>자료</b> : 기상청 종관기상관측(ASOS) 일자료 · " + 옮김(표.이름) + "(" + 표.지점 + ") · " +
        표.시작 + "~" + 표.끝 + "년<br>" +
      "<b>읽는 법</b> : 괄호 안이 표본 수입니다. 잰 적이 없는 날(결측)은 셈에서 빼기 때문에 " +
      "항목마다 표본 수가 다를 수 있습니다. " +
      (뜻.기간
        ? "여러 날에 걸친 확률은 하루 확률을 곱한 것이 아니라 <b>해마다 그 기간을 실제로 들여다본 것</b>입니다."
        : "앞뒤 " + 뜻.폭 + "일을 함께 세었으므로 <b>«그 무렵 하루»의 확률</b>이지 «바로 그 날짜»의 것이 아닙니다.") +
      "<br><b>정하는 것은 사람입니다</b> — 이 자료는 판단의 근거일 뿐이며 날짜를 정해 주지 않습니다." +
      "</div>" +

      "<div class=\"적는칸\"><div class=\"머리\">협의 내용 · 정한 날짜와 그 까닭</div></div>" +

      "</body></html>";
  }

  function 인쇄(뜻) {
    var 창 = window.open("", "_blank");
    if (!창) {
      alert("인쇄 창이 열리지 않았습니다. 브라우저의 팝업 차단을 풀어 주세요.");
      return;
    }
    창.document.open();
    창.document.write(만들기(뜻));
    창.document.close();

    // 🔴 두 갈래로 부르되 «먼저 온 쪽만» 인쇄한다.
    //    onload 만 두면 안 뜨는 브라우저가 있고, 타이머만 두면 늦은 창에서 빈 종이가 나온다.
    //    둘 다 두고 문패로 막는 것이 답이다 (js/print.js 가 겪은 그대로).
    var 찍었나 = false;
    function 물어보기() {
      if (찍었나) return;
      찍었나 = true;
      try { 창.focus(); 창.print(); } catch (e) {}
    }
    창.onload = 물어보기;
    setTimeout(물어보기, 700);
  }

  뿌리.Report = { 인쇄: 인쇄, 만들기: 만들기 };
})(typeof window !== "undefined" ? window : globalThis);
