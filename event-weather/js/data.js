/**
 * data.js — 지점 자료를 불러오는 곳
 *
 * 🔴 왜 `.json` + fetch 가 아니라 `.js` + <script> 인가
 *    `file://`(더블클릭)에서는 fetch 가 옆에 있는 파일조차 못 읽는다
 *    (origin 이 null 이라 CORS 로 막힌다). <script> 태그는 된다.
 *    그래서 자료를 `window.ASOS_294 = {…}` 모양으로 두고 태그를 만들어 넣는다.
 *    덕분에 **더블클릭 · 로컬 서버 · 사이트 세 곳에서 같은 코드 한 벌**로 돈다.
 *    school-meal 의 `schools/S10.js` 가 같은 판단을 이미 해 두었다.
 *
 * 🔴 세 곳에서 자료를 찾는다 (앞에서부터)
 *    ① 앱에 함께 담긴 data/<번호>.js        — 경남과 자주 가는 곳
 *    ② 사용자가 넣어 둔 것 (IndexedDB)      — 다른 지역 «자료 꾸러미»
 *    ③ 없으면 «받아서 넣어 주세요» 라고 안내
 *
 * ⚠ IndexedDB 는 지워질 수 있다(브라우저를 바꾸거나 사이트 자료를 지우면).
 *   그때 조용히 «자료 없음» 만 뜨면 쓸 수가 없다 — 화면이 «다시 넣어 주세요» 를
 *   또렷이 말하고 받는 곳을 함께 보여 준다.
 * ⚠ `file://` 에서는 IndexedDB 가 막히거나 이상하게 도는 브라우저가 있다.
 *   그래도 괜찮다 — 더블클릭으로 쓰는 사람은 폴더째 가진 사람이라 ① 이 다 있다.
 */

(function (뿌리) {
  "use strict";

  var 담은것 = {};        // 번호 → 원자료 (한 번 부르면 여기 남는다)
  var 부르는중 = {};      // 번호 → Promise
  var 목록 = null;        // data/지점.js 가 담고 있는 것
  var DB이름 = "event-weather", DB판 = 1, 창고 = "지점자료";

  /* ── ① 태그를 만들어 넣기 ─────────────────────────────────
     🔴 주소 끝에 판 번호를 붙인다.
        자료 파일은 이름이 그대로(`data/294.js`)라서, 자료를 새로 만들어
        올려도 브라우저가 **옛 파일을 그대로 쓴다.** 오류는 안 나고 숫자만
        예전 것이다 — 만드는 도중 실제로 겪었다(고친 값이 화면에 안 나왔다).
        `window.앱판` 은 배포 스크립트가 새겨 넣는다(프로젝트의 `?v=날짜시각` 관행).
        개발 중에는 비어 있고, 그때는 server.py 가 no-store 로 막아 준다. */
  function 판붙이기(주소) {
    var 판 = 뿌리.앱판;
    return 판 ? 주소 + (주소.indexOf("?") < 0 ? "?" : "&") + "v=" + encodeURIComponent(판) : 주소;
  }

  function 태그로부르기(주소) {
    return new Promise(function (되면, 안되면) {
      var s = document.createElement("script");
      s.src = 판붙이기(주소);
      s.async = true;
      s.onload = function () { s.remove(); 되면(true); };
      // ⚠ file:// 에서는 없는 파일이어도 onerror 가 안 뜨는 브라우저가 있다.
      //   그래서 부른 쪽에서 «window 에 값이 들어왔는가» 로 한 번 더 본다.
      s.onerror = function () { s.remove(); 되면(false); };
      document.head.appendChild(s);
    });
  }

  /* ── ② 브라우저에 넣어 둔 것 (IndexedDB) ─────────────────── */
  function DB열기() {
    return new Promise(function (되면, 안되면) {
      if (!뿌리.indexedDB) return 되면(null);
      var 요청;
      try { 요청 = 뿌리.indexedDB.open(DB이름, DB판); }
      catch (e) { return 되면(null); }          // file:// 에서 막힐 수 있다
      요청.onupgradeneeded = function () {
        var db = 요청.result;
        if (!db.objectStoreNames.contains(창고)) db.createObjectStore(창고);
      };
      요청.onsuccess = function () { 되면(요청.result); };
      요청.onerror = function () { 되면(null); };
      // 다른 탭이 막고 있으면 하염없이 기다리지 않는다
      setTimeout(function () { 되면(null); }, 3000);
    });
  }

  function DB읽기(열쇠) {
    return DB열기().then(function (db) {
      if (!db) return null;
      return new Promise(function (되면) {
        try {
          var t = db.transaction(창고, "readonly").objectStore(창고).get(열쇠);
          t.onsuccess = function () { 되면(t.result || null); };
          t.onerror = function () { 되면(null); };
        } catch (e) { 되면(null); }
      });
    }).catch(function () { return null; });
  }

  function DB쓰기(열쇠, 값) {
    return DB열기().then(function (db) {
      if (!db) return false;
      return new Promise(function (되면) {
        try {
          var t = db.transaction(창고, "readwrite").objectStore(창고).put(값, 열쇠);
          t.onsuccess = function () { 되면(true); };
          t.onerror = function () { 되면(false); };
        } catch (e) { 되면(false); }
      });
    }).catch(function () { return false; });
  }

  function DB목록() {
    return DB열기().then(function (db) {
      if (!db) return [];
      return new Promise(function (되면) {
        try {
          var t = db.transaction(창고, "readonly").objectStore(창고).getAllKeys();
          t.onsuccess = function () { 되면(t.result || []); };
          t.onerror = function () { 되면([]); };
        } catch (e) { 되면([]); }
      });
    }).catch(function () { return []; });
  }

  function DB지우기(열쇠) {
    return DB열기().then(function (db) {
      if (!db) return false;
      return new Promise(function (되면) {
        try {
          var t = db.transaction(창고, "readwrite").objectStore(창고).delete(열쇠);
          t.onsuccess = function () { 되면(true); };
          t.onerror = function () { 되면(false); };
        } catch (e) { 되면(false); }
      });
    }).catch(function () { return false; });
  }

  /* ── 지점 목록 ──────────────────────────────────────────── */
  function 목록부르기() {
    if (목록) return Promise.resolve(목록);
    if (뿌리.ASOS_지점) { 목록 = 뿌리.ASOS_지점; return Promise.resolve(목록); }
    return 태그로부르기("data/지점.js").then(function () {
      목록 = 뿌리.ASOS_지점 || { 목록: [], 없음: true };
      return 목록;
    });
  }

  /** 목록에 있는 지점 하나 찾기 */
  function 지점찾기(번호) {
    if (!목록 || !목록.목록) return null;
    for (var i = 0; i < 목록.목록.length; i++) {
      if (목록.목록[i].번호 === Number(번호)) return 목록.목록[i];
    }
    return null;
  }

  /* ── 지점 자료 부르기 ───────────────────────────────────── */
  /**
   * @return Promise<{ 있나, 자료, 어디서 }>
   *   어디서 : "앱" | "넣은것" | 없으면 null
   */
  function 자료부르기(번호) {
    번호 = Number(번호);
    if (담은것[번호]) return Promise.resolve(담은것[번호]);
    if (부르는중[번호]) return 부르는중[번호];

    var 열쇠 = "ASOS_" + 번호;

    var 일 = Promise.resolve()
      // ① 앱에 함께 담긴 파일
      .then(function () {
        if (뿌리[열쇠]) return { 있나: true, 자료: 뿌리[열쇠], 어디서: "앱" };
        return 태그로부르기("data/" + 번호 + ".js").then(function () {
          // ⚠ onerror 를 못 믿으므로 «값이 들어왔는가» 로 판단한다
          if (뿌리[열쇠]) return { 있나: true, 자료: 뿌리[열쇠], 어디서: "앱" };
          return null;
        });
      })
      // ② 사용자가 넣어 둔 것
      .then(function (난것) {
        if (난것) return 난것;
        return DB읽기(열쇠).then(function (담긴) {
          if (!담긴) return { 있나: false, 자료: null, 어디서: null };
          뿌리[열쇠] = 담긴;                    // 다음에 바로 쓰게 올려 둔다
          return { 있나: true, 자료: 담긴, 어디서: "넣은것" };
        });
      })
      .then(function (난것) {
        담은것[번호] = 난것;
        delete 부르는중[번호];
        return 난것;
      })
      .catch(function (e) {
        delete 부르는중[번호];
        return { 있나: false, 자료: null, 어디서: null, 잘못: String(e && e.message || e) };
      });

    부르는중[번호] = 일;
    return 일;
  }

  /* ── 자료 꾸러미 넣기 ───────────────────────────────────── */
  /**
   * 사용자가 고른 «시·도 자료 파일(.js)» 을 읽어 브라우저에 담는다.
   * 파일 하나에 그 도의 지점이 여럿 들어 있을 수 있다.
   *
   * 🔴 파일을 통째로 eval 하지 않는다. `new Function` 에 빈 window 를 주어
   *    그 안에서만 돌리고, 나온 `ASOS_*` 값만 꺼낸다. 자료 파일은 값을
   *    적어 두는 것이 전부라 이것으로 충분하다.
   */
  function 꾸러미넣기(글) {
    var 가짜창 = {};
    try {
      new Function("window", "self", "globalThis", 글)(가짜창, 가짜창, 가짜창);
    } catch (e) {
      return Promise.resolve({ 된것: [], 잘못: "자료 파일을 읽지 못했습니다 — " + e.message });
    }

    var 넣을것 = [];
    for (var 열쇠 in 가짜창) {
      if (!/^ASOS_\d+$/.test(열쇠)) continue;
      var 값 = 가짜창[열쇠];
      if (!값 || !값.해 || !값.지점) continue;
      넣을것.push({ 열쇠: 열쇠, 값: 값 });
    }
    if (!넣을것.length) {
      return Promise.resolve({
        된것: [],
        잘못: "이 파일에는 관측지점 자료가 없습니다. 「행사일 날씨 살피기」 자료 꾸러미가 맞는지 확인해 주세요."
      });
    }

    return Promise.all(넣을것.map(function (것) {
      return DB쓰기(것.열쇠, 것.값).then(function (됐나) {
        if (됐나) {
          뿌리[것.열쇠] = 것.값;
          delete 담은것[것.값.지점];       // 다시 부르면 새것을 쓰게
        }
        return { 번호: 것.값.지점, 이름: 것.값.이름, 됐나: 됐나 };
      });
    })).then(function (결과) {
      var 된것 = 결과.filter(function (r) { return r.됐나; });
      return {
        된것: 된것,
        잘못: 된것.length ? null
             : "브라우저에 담지 못했습니다. 비밀 창(시크릿 모드)이거나 저장 공간이 막혀 있을 수 있습니다."
      };
    });
  }

  /** 넣어 둔 것 목록 */
  function 넣은것들() {
    return DB목록().then(function (열쇠들) {
      return 열쇠들.map(function (k) { return Number(String(k).replace("ASOS_", "")); })
                   .filter(function (n) { return isFinite(n); });
    });
  }

  function 넣은것지우기(번호) {
    var 열쇠 = "ASOS_" + Number(번호);
    return DB지우기(열쇠).then(function (됐나) {
      if (됐나) { delete 뿌리[열쇠]; delete 담은것[Number(번호)]; }
      return 됐나;
    });
  }

  /* ── 이 앱이 «가짜» 자료를 들고 있나 ────────────────────── */
  /** 🚨 화면은 이것이 true 면 지울 수 없는 빨간 띠를 띄운다. */
  function 가짜인가() {
    if (목록 && 목록.가짜) return true;
    for (var 번호 in 담은것) {
      var 것 = 담은것[번호];
      if (것 && 것.있나 && 것.자료 && 것.자료.가짜) return true;
    }
    return false;
  }

  뿌리.Data = {
    목록부르기: 목록부르기, 지점찾기: 지점찾기, 자료부르기: 자료부르기,
    꾸러미넣기: 꾸러미넣기, 넣은것들: 넣은것들, 넣은것지우기: 넣은것지우기,
    가짜인가: 가짜인가,
    get 목록() { return 목록; }
  };
})(typeof window !== "undefined" ? window : globalThis);
