/* 명렬표 붙여넣기 ─ 마지막 보험.
 *
 * PDF 의 글자를 못 읽어도(스캔 시안·글자가 그림인 PDF) 사진만 차례대로
 * 찾아냈다면, 엑셀 명렬표를 복사해 붙이는 것으로 끝난다.
 * OCR 보다 훨씬 정확하다 — 이름 오타가 0 이다.
 *
 * 🔴 화면(DOM)을 쓰지 않는다 — 브라우저 없이 검사할 수 있어야 한다.
 */
(function (root) {
  "use strict";

  var IdParse = root.IdParse;
  var 머리글 = new RegExp("^(\\ud559\\ubc88|\\ubc88\\ud638|\\ubc88|\\uc131\\uba85|\\uc774\\ub984|\\uc21c\\ubc88|\\uc5f0\\ubc88|no|num|name|id)$", "i");

  /* 붙여넣은 글을 줄·칸으로 가른다. 엑셀에서 복사하면 탭으로 갈라진다. */
  function 가르기(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n").split("\n")
      .map(function (ln) {
        var cells = ln.indexOf("\t") >= 0 ? ln.split("\t")
                  : (ln.indexOf(",") >= 0 ? ln.split(",") : ln.split(/ {2,}|\s+/));
        return cells.map(function (c) { return c.trim(); }).filter(function (c) { return c !== ""; });
      })
      .filter(function (c) { return c.length; });
  }

  /* 명렬표 읽기 → [{ sid, num, name }] */
  function 읽기(text, 기본) {
    var 줄 = 가르기(text), out = [];

    줄.forEach(function (cells, i) {
      // 머리글 줄은 건너뛴다
      if (i === 0 && cells.every(function (c) { return 머리글.test(c); })) return;

      var sid = null, num = null, name = null;

      cells.forEach(function (c) {
        if (name == null) {
          var nm = IdParse.이름찾기(c);
          // 숫자가 섞인 칸에서도 이름을 꺼내되, 순수 숫자 칸은 이름이 아니다
          if (nm && !/^\d+$/.test(c)) name = nm;
        }
        if (sid == null) {
          var got = IdParse.한사람([c], null);
          if (got && got.part) {
            var s = IdParse.학번만들기(got.part, 기본);
            if (s) sid = s;
            if (got.part.num != null) num = got.part.num;
          }
        }
      });

      // 「1  홍길동」 처럼 앞이 그냥 번호인 흔한 형태
      if (num == null && cells.length && /^\d{1,3}$/.test(cells[0])) num = +cells[0];
      if (sid == null && num != null && 기본 && 기본.grade != null && 기본.cls != null) {
        sid = IdParse.학번만들기({ grade: 기본.grade, cls: 기본.cls, num: num }, null);
      }

      if (sid || name) out.push({ sid: sid, num: num, name: name });
    });

    return out;
  }

  /* 명렬표를 줄 목록에 얹는다.
   *   방법 "학번" : 학번이 같은 줄에 이름을 채운다 (가장 안전)
   *   방법 "차례" : 사진 차례대로 위에서부터 짝짓는다 (글자를 못 읽었을 때)
   * 🔴 사람이 손으로 고쳐 둔 줄(손댐)은 건드리지 않는다. */
  function 얹기(rows, 명렬, 방법) {
    var 결과 = { 채움: 0, 건너뜀: 0, 남은명렬: 0, 경고: [] };

    if (방법 === "차례") {
      if (명렬.length !== rows.length) {
        결과.경고.push("사진 " + rows.length + "장 · 명렬표 " + 명렬.length + "줄 — 개수가 다릅니다. " +
                      "차례로 짝지으면 뒤가 통째로 밀립니다. 반드시 검수 화면에서 확인하세요.");
      }
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].손댐) { 결과.건너뜀++; continue; }
        var m = 명렬[i];
        if (!m) break;
        if (m.sid) rows[i].sid = m.sid;
        if (m.name) rows[i].name = m.name;
        rows[i].출처 = "명렬표(차례)";
        결과.채움++;
      }
      결과.남은명렬 = Math.max(0, 명렬.length - rows.length);
      return 결과;
    }

    // 학번으로 맞추기
    var 표 = {};
    명렬.forEach(function (m) { if (m.sid) 표[m.sid] = m; });
    rows.forEach(function (r) {
      if (r.손댐) { 결과.건너뜀++; return; }
      var m = r.sid ? 표[r.sid] : null;
      if (!m) return;
      if (m.name) { r.name = m.name; r.출처 = "명렬표(학번)"; 결과.채움++; }
    });
    if (!결과.채움) 결과.경고.push("학번이 같은 줄을 하나도 찾지 못했습니다. 「차례대로 짝짓기」 를 써 보세요.");
    return 결과;
  }

  root.Roster = { 읽기: 읽기, 얹기: 얹기, 가르기: 가르기 };
})(typeof globalThis !== "undefined" ? globalThis : this);
