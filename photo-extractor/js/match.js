/* 짝짓기 ─ 「이 사진은 누구인가」 를 정하고, 이상한 것을 찾아낸다.
 *
 * 🔴 이 앱에서 틀리면 가장 나쁜 곳이다. 다른 학생 얼굴에 다른 학생 이름이
 *    붙은 파일은 되돌릴 수 없다. 그래서 여기서는 「모르겠다」 를 숨기지 않고
 *    문제 목록으로 남겨 검수 화면이 붉게 그리게 한다.
 *
 * 🔴 화면(DOM)을 쓰지 않는다 — 브라우저 없이 검사할 수 있어야 한다.
 */
(function (root) {
  "use strict";

  var IdParse = root.IdParse;

  function 가운데(r) { return { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }; }
  function 거리(a, b) {
    var p = 가운데(a), q = 가운데(b);
    return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  }

  /* 같은 글자를 두 사진이 서로 제 것이라고 하면 가까운 쪽에 준다.
   * (사진 사이가 좁은 배치에서 실제로 일어난다) */
  function 겹친글자정리(사람들) {
    var 주인 = {};
    사람들.forEach(function (s, i) {
      (s.textRects || []).forEach(function (r, j) {
        var k = r.x0.toFixed(1) + "," + r.y0.toFixed(1) + "," + r.x1.toFixed(1) + "," + r.y1.toFixed(1);
        var d = 거리(s.photo.rect, r);
        if (!주인[k] || d < 주인[k].d) 주인[k] = { i: i, j: j, d: d };
      });
    });
    return 사람들.map(function (s, i) {
      var texts = [], rects = [];
      (s.textRects || []).forEach(function (r, j) {
        var k = r.x0.toFixed(1) + "," + r.y0.toFixed(1) + "," + r.x1.toFixed(1) + "," + r.y1.toFixed(1);
        if (주인[k] && 주인[k].i === i) { texts.push(s.texts[j]); rects.push(r); }
      });
      return { photo: s.photo, texts: texts, textRects: rects };
    });
  }

  /* 🚨 줄 번호는 **앱 전체에서 하나뿐인 값**이어야 한다.
   * 예전에는 `줄만들기` 안에서 0 부터 셌는데, 이 함수는 **파일마다 한 번씩** 불리므로
   * 사진_1-1.pdf 도 r0…, 사진_1-3.pdf 도 r0… 이 되어 **번호가 겹쳤다.**
   * 고치기 창은 번호로 줄을 찾기 때문에 **언제나 첫 파일의 학생**을 집어 왔고,
   * 그대로 고치면 **엉뚱한 학생의 이름이 바뀐다.**
   * → 파일을 몇 개 넣든 다시 0 으로 돌아가지 않는 셈틀을 바깥에 둔다. */
  var 줄번호 = 0;

  /* 한 파일(=대개 한 반)의 결과를 줄 목록으로 만든다.
   *   pages : [{ pageNo, 사람들:[...] }]
   *   opt   : { file, 기본:{grade,cls}, 형식:패턴객체|null }
   */
  function 줄만들기(pages, opt) {
    opt = opt || {};
    var 기본 = opt.기본 || null;
    var rows = [];

    pages.forEach(function (pg) {
      겹친글자정리(pg.사람들 || []).forEach(function (s) {
        var got = IdParse.한사람(s.texts, opt.형식 || null);
        var part = got && got.part ? got.part : null;
        var sid = IdParse.학번만들기(part, 기본);
        rows.push({
          id: "r" + (줄번호++),
          file: opt.file || "",
          page: pg.pageNo,
          photo: s.photo,
          texts: s.texts.slice(),
          sid: sid,
          name: (got && got.name) || null,
          num: part && part.num != null ? part.num : null,
          형식: got ? got.pattern : null,
          손댐: false,
          문제: []
        });
      });
    });

    return 살피기(rows);
  }

  /* 줄 목록을 훑어 문제를 적는다. 값을 고친 뒤에도 다시 부른다. */
  function 살피기(rows) {
    var 본것 = {};
    rows.forEach(function (r) {
      r.문제 = [];
      if (!r.sid) r.문제.push("학번을 못 읽음");
      // 🚨 「01024」 같은 말이 안 되는 학번을 그냥 두면 「0학년 10반」 폴더가 생긴다
      else if (!IdParse.학번맞나(r.sid)) r.문제.push("학번이 이상함(" + r.sid + ")");
      if (!r.name) r.문제.push("이름을 못 읽음");
      if (r.sid) (본것[r.sid] = 본것[r.sid] || []).push(r);
    });
    Object.keys(본것).forEach(function (sid) {
      if (본것[sid].length > 1) {
        본것[sid].forEach(function (r) { r.문제.push("학번이 겹침(" + 본것[sid].length + "장)"); });
      }
    });

    // 번호가 이어지는지 — 빠진 사람을 찾는다
    var 반별 = {};
    rows.forEach(function (r) {
      if (!r.sid) return;
      var k = r.sid.slice(0, 3);
      (반별[k] = 반별[k] || []).push(+r.sid.slice(3));
    });
    var 빠진 = [];
    Object.keys(반별).sort().forEach(function (k) {
      var ns = 반별[k].slice().sort(function (a, b) { return a - b; });
      for (var n = ns[0]; n <= ns[ns.length - 1]; n++) {
        if (ns.indexOf(n) < 0) 빠진.push(k + (n < 10 ? "0" : "") + n);
      }
    });

    var 완료 = rows.filter(function (r) { return !r.문제.length; }).length;
    return {
      rows: rows,
      요약: {
        전체: rows.length,
        완료: 완료,
        문제: rows.length - 완료,
        빠진번호: 빠진,
        겹친학번: Object.keys(본것).filter(function (s) { return 본것[s].length > 1; })
      }
    };
  }

  /* 파일 이름 만들기 ─ 「10103_홍길동.jpg」
   * 🔴 윈도우에서 못 쓰는 글자를 지운다. 이름이 없으면 학번만 쓴다. */
  function 파일이름(r, ext) {
    var 안전 = function (s) {
      return String(s == null ? "" : s).replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
    };
    var sid = 안전(r.sid), nm = 안전(r.name);
    var base = sid && nm ? sid + "_" + nm : (sid || nm || "이름없음");
    return base + "." + (ext || "jpg");
  }

  root.Match = {
    줄만들기: 줄만들기,
    살피기: 살피기,
    겹친글자정리: 겹친글자정리,
    파일이름: 파일이름
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
