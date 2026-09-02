/* 용량 줄이기 ─ 뽑아 둔 사진(또는 아무 이미지 파일)을 작게 만든다.
 *
 * 🔴 원본은 절대 건드리지 않는다. 언제나 새 파일을 만들어 낸다.
 *    인쇄·NEIS 에는 원본이 필요하고, 작은 것은 명렬표·홈페이지용이다.
 */
(function (root) {
  "use strict";

  /* 미리 갖춰 둔 크기 — 교실에서 자주 쓰는 쓰임에 맞췄다 */
  var 미리 = [
    { key: "인쇄", 이름: "인쇄용 (줄이지 않음)", maxSide: 0, quality: 1 },
    { key: "문서", 이름: "문서 첨부용 (긴 변 1200px · 품질 85%)", maxSide: 1200, quality: 0.85 },
    { key: "명렬", 이름: "명렬표용 (긴 변 600px · 품질 80%)", maxSide: 600, quality: 0.80 },
    { key: "썸네일", 이름: "아주 작게 (긴 변 300px · 품질 75%)", maxSide: 300, quality: 0.75 }
  ];

  function 그림읽기(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(blob);
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("그림을 읽지 못했습니다")); };
      img.src = url;
    });
  }

  /* 한 장 줄이기 */
  function 줄이기(blob, opt) {
    opt = opt || {};
    var 앞 = blob.size;
    return 그림읽기(blob).then(function (img) {
      var W = img.width, H = img.height, s = 1;
      if (opt.maxSide && Math.max(W, H) > opt.maxSide) s = opt.maxSide / Math.max(W, H);
      var w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));

      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      var g = cv.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, w, h);
      if (img.close) img.close();

      return new Promise(function (res) {
        cv.toBlob(function (b) {
          res({
            blob: b || blob, ext: "jpg",
            width: w, height: h, 원본가로: W, 원본세로: H,
            앞: 앞, 뒤: (b || blob).size,
            줄인비율: 앞 ? 1 - (b || blob).size / 앞 : 0
          });
        }, "image/jpeg", opt.quality == null ? 0.85 : opt.quality);
      });
    });
  }

  /* 여러 장 ─ 한 장씩 차례로 (한꺼번에 하면 메모리가 터진다) */
  function 여럿줄이기(목록, opt, 알림) {
    var out = [], i = 0;
    function 다음() {
      if (i >= 목록.length) return Promise.resolve(out);
      var it = 목록[i];
      return 줄이기(it.blob, opt).then(function (r) {
        out.push(Object.assign({}, it, { 결과: r }));
        i++;
        if (알림) 알림(i, 목록.length);
        return 다음();
      }).catch(function (e) {
        out.push(Object.assign({}, it, { 오류: e.message }));
        i++; if (알림) 알림(i, 목록.length);
        return 다음();
      });
    }
    return 다음();
  }

  function 보기좋은크기(n) {
    if (n == null) return "-";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  root.Resize = { 미리: 미리, 줄이기: 줄이기, 여럿줄이기: 여럿줄이기, 보기좋은크기: 보기좋은크기 };
})(typeof globalThis !== "undefined" ? globalThis : this);
