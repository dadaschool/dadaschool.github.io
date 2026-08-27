/* ============================================================
   인쇄용 활동지 · 교사용 정답표 — 문항을 만드는 곳은 여기 하나뿐이다.

   ⚠ 활동지에는 **정답도 성취기준도 넣지 않는다** (루트 CLAUDE.md 의 인쇄용 활동지 규칙).
     정답이 필요하면 아래 `key()` 로 «교사용 정답표» 를 따로 뽑는다.
   ⚠ 활동지 문항은 학생이 화면에서 하는 것과 **같은 일**이어야 한다 —
     화면에서는 선을 잇고, 종이에서는 «어디에 꽂나» 를 적는다.
   ============================================================ */
(function (g) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* 모든 부품의 핀을 한 줄씩 펼친다 (쓰지 않는 핀은 뺀다) */
  function rows(prob) {
    var out = [];
    prob.parts.forEach(function (entry) {
      var part = Code.part(entry);
      part.pins.forEach(function (pin) {
        var want = (entry.pin || {})[pin.n];
        if (pin.role === "sig" && (want === null || want === undefined || want === "")) return;
        out.push({ part: part, pin: pin, want: want });
      });
    });
    return out;
  }

  /* 정답 문구 — 정답이 여러 곳인 핀은 «규칙» 으로 적는다 */
  function answerOf(part, pin, want, prob) {
    if (pin.role === "sda") return "19번 S (IIC 자리도 같음)";
    if (pin.role === "scl") return "20번 S (IIC 자리도 같음)";
    if (pin.role === "sig") return want + "번 S";
    if (pin.role === "gnd") return "G 줄 (번호는 아무 곳이나)";
    var need = part.power || "any";
    if (need === "any") return "V 줄 (아무 곳이나) 또는 5V·3V3 단자";
    var rail = prob.v1 === need ? "V1 줄" : (prob.v2 === need ? "V2 줄" : null);
    return need + " 단자" + (rail ? " 또는 " + rail : "") +
           (rail ? "" : " (V 줄은 지금 " + prob.v1 + " 이라 쓸 수 없다)");
  }

  /* ── 학생용 인쇄 활동지 ────────────────────────────────── */
  function worksheet(prob) {
    var rs = rows(prob);
    var fixed = rs.map(function (r) {
      return "**" + r.part.name + "** · `" + r.pin.n + "` (" + Parts.ROLE_NAME[r.pin.role] + ")";
    });

    var names = prob.parts.map(function (e) { return Code.part(e).name; }).join(" · ");
    var items1 = [
      { k: "info", q: "**준비물** — 마이크로비트 · Keyestudio 확장보드 · " + names +
                      (prob.usb ? " · 보조배터리" : "") + " · 점퍼선" },
      { k: "info", q: "확장보드의 점퍼는 **V1 = " + prob.v1 + " · V2 = " + prob.v2 + "** 로 꽂혀 있습니다." },
      { k: "tbl",
        q: "부품의 핀을 확장보드의 **어디**에 꽂아야 할까요? 표를 채우세요.",
        /* ⚠ 보기(예시)에 **실제 정답이 될 수 있는 값**을 적지 말 것.
           처음에 `2번 S`·`5V 단자` 라고 적었더니 그것이 그 문제의 정답이었다. */
        ph: "적는 방법 — 번호와 줄을 함께 (예 : `○번 S` · `G 줄` · `○○ 단자`)",
        cols: ["부품 · 핀", "보드의 어디에 꽂나요", "선 색"],
        widths: [5, 3, 2],
        fixed: fixed }
    ];

    var items2 = [
      { k: "fill", q: "확장보드 핀열의 세 줄은 각각 무엇을 꽂는 자리인가요?",
        blanks: ["`S` 줄", "`V` 줄", "`G` 줄"] },
      { k: "short", q: "접지(−)는 핀 번호를 골라야 할까요? 그렇게 생각한 이유를 쓰세요.", lines: 2 },
      { k: "short", q: "신호선은 왜 **정해진 번호**에 꽂아야 하나요?", lines: 2 }
    ];

    /* 5V 가 필요한 부품이 있으면 — 회로도에서 빨간 선이 5V 단자로 간 이유를 묻는다 */
    var five = prob.parts.map(function (e) { return Code.part(e); })
      .filter(function (p) { return p.power === "5V"; });
    if (five.length && prob.v1 !== "5V") {
      items2.push({
        k: "short",
        q: "**" + five[0].name + "**" + Parts.josa(five[0].name, "은는") + " " + five[0].power +
           " 가 필요합니다. 그런데 `V1` 줄의 점퍼는 " + prob.v1 +
           " 으로 꽂혀 있습니다. 전원(+)선을 어디에 꽂아야 할까요?",
        lines: 2
      });
    }

    /* I2C 부품이 있으면 — 핀이 고정이라는 것을 묻는다 */
    var hasI2c = rs.some(function (r) { return r.pin.role === "sda" || r.pin.role === "scl"; });
    if (hasI2c) {
      items2.push({ k: "fill", q: "I2C 부품의 신호선은 꽂을 자리가 정해져 있습니다. 몇 번인가요?",
        blanks: ["`SDA`", "`SCL`"] });
    }

    if ((prob.ext || []).length) {
      items2.push({ k: "short",
        q: "선을 다 이어도 MakeCode 에 **확장프로그램**을 추가하지 않으면 블록이 나오지 않습니다. " +
           "이 실습에서 추가해야 하는 확장프로그램의 이름을 쓰세요.",
        lines: 1 });
    }

    items2.push({ k: "draw",
      q: "표를 보고 **회로도를 직접 그려** 보세요. 부품·확장보드를 그리고 선을 색으로 이으세요.",
      height: 340 });

    return {
      title: prob.t,
      subtitle: "확장보드에 센서 연결하기",
      note: "선 색은 약속입니다 — **빨강 = 전원(+) · 검정 = 접지(−)**, 신호선은 다른 색으로 씁니다.",
      head: ["학년", "반", "번호", "이름"],
      footer: prob.t + " · 마이크로비트 연결 실습",
      sections: [
        { title: "연결표 채우기", items: items1 },
        { title: "생각해 보기", items: items2 }
      ]
    };
  }

  /* ── 교사용 정답표 — 별도 창에 직접 그린다 ────────────────
     `Print.sheet` 은 정답 칸을 일부러 지우므로 여기서는 쓰지 않는다. */
  function key(prob) {
    var rs = rows(prob);
    var body = rs.map(function (r) {
      return "<tr><td>" + esc(r.part.name) + "</td><td class='c'><b>" + esc(r.pin.n) + "</b></td>" +
             "<td class='c'>" + esc(Parts.ROLE_NAME[r.pin.role]) + "</td>" +
             "<td class='c'><b>" + esc(answerOf(r.part, r.pin, r.want, prob)) + "</b></td>" +
             "<td class='c'>" + esc(colorRule(r.pin.role)) + "</td></tr>";
    }).join("");

    var ext = (prob.ext || []).length ? prob.ext.join(" · ") : "없음";
    var html =
      '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      "<title>" + esc(prob.t) + " — 교사용 정답표</title><style>" +
      "body{font-family:'Malgun Gothic',sans-serif;margin:18mm 14mm;color:#111;font-size:12pt}" +
      "h1{font-size:17pt;margin:0 0 4px}.st{color:#555;margin:0 0 14px;font-size:11pt}" +
      "table{border-collapse:collapse;width:100%;font-size:11pt}" +
      "th,td{border:1px solid #999;padding:5px 7px}th{background:#eef2ff}td.c,th.c{text-align:center}" +
      ".bx{border:1px solid #999;border-left:5px solid #333;padding:8px 12px;margin:14px 0;font-size:11pt}" +
      "@page{size:A4;margin:14mm}</style></head><body>" +
      "<h1>" + esc(prob.t) + " — 교사용 정답표</h1>" +
      '<p class="st">점퍼 V1 = ' + esc(prob.v1) + " · V2 = " + esc(prob.v2) +
      " &nbsp;|&nbsp; 확장프로그램 : " + esc(ext) + "</p>" +
      "<table><tr><th>부품</th><th class='c'>핀</th><th class='c'>무슨 핀</th>" +
      "<th class='c'>꽂을 자리</th><th class='c'>선 색</th></tr>" + body + "</table>" +
      '<div class="bx"><b>채점 기준</b><br>' +
      "· 전원(+)·접지(−)는 <b>줄만 맞으면</b> 번호는 상관없다.<br>" +
      "· 신호선은 <b>번호까지</b> 맞아야 한다(코드의 핀 번호와 같아야 하므로).<br>" +
      "· I2C 의 SDA·SCL 은 <b>19·20번 고정</b>이다.<br>" +
      "· 선 색은 약속이므로 <b>감점하지 않고 지도</b>한다." +
      "</div><div class='bx'><b>많이 나오는 실수</b><br>" +
      "① 접지를 `V` 줄에 꽂는다 &nbsp; ② 5V 가 필요한 센서를 3V3 점퍼의 `V` 줄에 꽂는다<br>" +
      "③ 신호를 `S` 가 아닌 `V`·`G` 에 꽂는다 &nbsp; ④ I2C 를 아무 번호에나 꽂는다<br>" +
      "⑤ `NC` 자리에 꽂는다 &nbsp; ⑥ 초음파의 Trig·Echo 를 서로 바꿔 꽂는다" +
      "</div></body></html>";

    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 막혀 있습니다.\n주소창 오른쪽의 팝업 차단 표시를 눌러 허용해 주세요."); return; }
    w.document.open(); w.document.write(html); w.document.close();
    /* 인쇄 창이 두 번 뜨지 않게 문패를 둔다 (js/print.js 와 같은 이유 — 지우지 말 것) */
    var printed = false;
    function askPrint() { if (printed) return; printed = true; try { w.focus(); w.print(); } catch (e) {} }
    w.onload = askPrint;
    setTimeout(askPrint, 700);
  }

  function colorRule(role) {
    if (role === "vcc") return "빨강";
    if (role === "gnd") return "검정·갈색";
    return "그 밖의 색";
  }

  g.Sheet = { worksheet: worksheet, key: key, rows: rows, answerOf: answerOf };
})(window);
