/* 저장 ─ 반별 폴더로 나눠 담는다.
 *
 * 두 가지 길이 있다 :
 *   ① 폴더 고르기 (Chrome·Edge) — 고른 폴더 아래에 반별 폴더를 만들어 그대로 넣는다.
 *   ② ZIP 내려받기 (그 밖의 브라우저) — 같은 폴더 구조를 ZIP 한 개에 담는다.
 *
 * 🔒 어느 쪽이든 파일은 이 컴퓨터를 벗어나지 않는다. 네트워크를 쓰지 않는다.
 */
(function (root) {
  "use strict";

  var Match = root.Match, IdParse = root.IdParse;

  function 폴더고르기됨() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  }

  /* 폴더 이름으로 못 쓰는 글자를 지운다 */
  function 안전이름(s) {
    return String(s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "분류없음";
  }

  /* 줄들을 「반 → 파일 목록」 으로 나눈다 */
  function 반별로(rows, opt) {
    opt = opt || {};
    var 통 = {}, 쓴이름 = {};
    rows.forEach(function (r) {
      var 반 = opt.한폴더 ? "" : 안전이름(IdParse.반이름(r.sid, r.기본) || r.반이름 || 폴더에서(r.file));
      // 용량 줄이기 탭에서 고른 이미지 파일처럼 「원래 이름을 그대로 써야 하는」 경우
      var name = r.고정이름 ? 안전이름(r.고정이름) : Match.파일이름(r, (r.그림 && r.그림.ext) || "jpg");
      var k = 반 + "/" + name;
      if (쓴이름[k]) {                       // 이름이 겹치면 뒤에 번호를 붙인다
        var n = ++쓴이름[k];
        name = name.replace(/(\.[^.]+)$/, "_" + n + "$1");
      } else 쓴이름[k] = 1;
      (통[반] = 통[반] || []).push({ name: name, blob: r.그림 && r.그림.blob, row: r });
    });
    return 통;
  }

  function 폴더에서(file) {
    var g = IdParse.파일이름에서(file);
    return g ? g.grade + "학년 " + g.cls + "반" : "분류없음";
  }

  /* 못 찾은 것을 적은 안내문 ─ 🔴 학생 이름을 넣지 않는다(학번과 쪽 번호만). */
  function 안내문(요약, rows) {
    var L = [];
    L.push("사진 추출 결과");
    L.push("만든 때 : " + new Date().toLocaleString("ko-KR"));
    L.push("");
    L.push("전체 사진 : " + 요약.전체 + "장");
    L.push("제대로 된 것 : " + 요약.완료 + "장");
    L.push("문제 있는 것 : " + 요약.문제 + "장");
    if (요약.빠진번호.length) L.push("사진이 없는 학번 : " + 요약.빠진번호.join(", "));
    if (요약.겹친학번.length) L.push("학번이 겹친 것 : " + 요약.겹친학번.join(", "));
    var 문제 = rows.filter(function (r) { return r.문제 && r.문제.length; });
    if (문제.length) {
      L.push("");
      L.push("― 문제가 있어 확인이 필요한 사진 ―");
      문제.forEach(function (r) {
        L.push("  " + (r.sid || "학번모름") + " · " + r.file + " " + r.page + "쪽 : " + r.문제.join(" / "));
      });
    }
    L.push("");
    L.push("※ 이 파일과 사진에는 학생 개인정보가 들어 있습니다. 다 쓰고 나면 지워 주세요.");
    return L.join("\r\n");
  }

  /* ① 폴더에 바로 저장 */
  function 폴더에저장(rows, 요약, opt, 알림) {
    opt = opt || {};
    var 통 = 반별로(rows, opt), 센것 = 0, 전체 = rows.length;
    return window.showDirectoryPicker({ mode: "readwrite", id: "photo-extractor" }).then(function (root상위) {
      var 차례 = Promise.resolve();
      Object.keys(통).forEach(function (반) {
        차례 = 차례.then(function () {
          return 반 ? root상위.getDirectoryHandle(반, { create: true }) : root상위;
        }).then(function (dir) {
          var p = Promise.resolve();
          통[반].forEach(function (f) {
            p = p.then(function () {
              if (!f.blob) return;
              return dir.getFileHandle(f.name, { create: true })
                .then(function (fh) { return fh.createWritable(); })
                .then(function (w) { return w.write(f.blob).then(function () { return w.close(); }); })
                .then(function () { 센것++; if (알림) 알림(센것, 전체); });
            });
          });
          return p;
        });
      });
      return 차례.then(function () {
        if (opt.안내문 === false) return;
        return root상위.getFileHandle("_추출결과_안내.txt", { create: true })
          .then(function (fh) { return fh.createWritable(); })
          .then(function (w) {
            return w.write(new Blob(["﻿" + 안내문(요약, rows)], { type: "text/plain;charset=utf-8" }))
              .then(function () { return w.close(); });
          });
      }).then(function () { return { 방법: "폴더", 저장: 센것 }; });
    });
  }

  /* ② ZIP 으로 내려받기 */
  function ZIP으로저장(rows, 요약, opt, 알림) {
    opt = opt || {};
    var zip = new root.JSZip(), 통 = 반별로(rows, opt), 센것 = 0, 전체 = rows.length;
    Object.keys(통).forEach(function (반) {
      통[반].forEach(function (f) {
        if (!f.blob) return;
        zip.file((반 ? 반 + "/" : "") + f.name, f.blob);
        센것++; if (알림) 알림(센것, 전체);
      });
    });
    if (opt.안내문 !== false) zip.file("_추출결과_안내.txt", "﻿" + 안내문(요약, rows));
    return zip.generateAsync({ type: "blob" }).then(function (blob) {
      내려받기(blob, (opt.zip이름 || "사진추출") + ".zip");
      return { 방법: "ZIP", 저장: 센것 };
    });
  }

  function 내려받기(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function 저장(rows, 요약, opt, 알림) {
    if (opt && opt.강제ZIP) return ZIP으로저장(rows, 요약, opt, 알림);
    if (폴더고르기됨()) return 폴더에저장(rows, 요약, opt, 알림);
    return ZIP으로저장(rows, 요약, opt, 알림);
  }

  root.Save = {
    저장: 저장,
    폴더에저장: 폴더에저장,
    ZIP으로저장: ZIP으로저장,
    폴더고르기됨: 폴더고르기됨,
    반별로: 반별로,
    안내문: 안내문,
    안전이름: 안전이름,
    내려받기: 내려받기
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
