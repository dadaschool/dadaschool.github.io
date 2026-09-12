/**
 * fcst.js — 기상청 예보를 가져와 «행사 하루» 로 묶는다  (모드 B)
 *
 * 🔴 셈하는 부분은 화면(DOM)을 쓰지 않는다. 브라우저 없이 검사한다
 *    (tools/검사/verify_fcst.cjs). 네트워크를 쓰는 함수만 따로 두었다.
 *
 * ─────────────────────────────────────────────────────────────
 * 🔴 예보가 닿는 곳은 여기까지다
 *      D+0 ~ D+2   단기예보   1시간 단위 · 강수확률/기온/하늘/바람
 *      D+3 ~ D+10  중기예보   오전·오후 하늘상태 + 강수확률 + 최저·최고기온
 *      D+11 ~      **없다.** 기상청도 어떤 앱도 못 한다 → 과거 통계(모드 A)
 *
 * 🔴 이 파일은 «예보가 없는 날» 에 대해 아무 말도 지어내지 않는다.
 *    없으면 없다고 돌려준다. 화면은 그때 과거 통계만 보여 준다.
 *
 * 🔒 인증키는 이 파일에 없다. `server.py` 가 들고 있고, 화면은 서버에게 묻는다.
 *    (브라우저에서 기상청을 직접 못 부르는 까닭도 있다 — CORS)
 * ─────────────────────────────────────────────────────────────
 */

(function (뿌리) {
  "use strict";

  /* ── 단기예보 발표 시각 ─────────────────────────────────────
     기상청은 하루 여덟 번 낸다. 낸 직후에는 아직 안 올라와 있어서
     조금 지난 뒤라야 받을 수 있다. */
  var 발표시각 = [2, 5, 8, 11, 14, 17, 20, 23];
  var 뜸들이기 = 15;                 // 분. 발표 뒤 이만큼 지나야 부른다

  function 두자리(n) { return String(n).padStart(2, "0"); }
  function 날글(d) {
    return d.getFullYear() + 두자리(d.getMonth() + 1) + 두자리(d.getDate());
  }

  /**
   * 지금 시각에 «부를 수 있는 가장 최근 발표» 를 고른다.
   * @return { base_date: "20260908", base_time: "0800" }
   *
   * ⚠ 새벽 0~2시 15분 사이에는 **어제 23시 발표**를 써야 한다.
   *   그것을 잊으면 «오늘 02시» 를 부르고 빈 답을 받는다(오류는 안 난다).
   */
  function 기준시각(지금) {
    var 이제 = 지금 ? new Date(지금.getTime()) : new Date();
    var 분 = 이제.getHours() * 60 + 이제.getMinutes();

    var 고른 = null;
    for (var i = 발표시각.length - 1; i >= 0; i--) {
      if (분 >= 발표시각[i] * 60 + 뜸들이기) { 고른 = 발표시각[i]; break; }
    }
    if (고른 === null) {
      // 아직 오늘 첫 발표(02:15) 전이다 → 어제 23시
      이제.setDate(이제.getDate() - 1);
      고른 = 23;
    }
    return { base_date: 날글(이제), base_time: 두자리(고른) + "00" };
  }

  /* ── 기상청 코드 풀이 ────────────────────────────────────── */
  var 하늘글 = { "1": "맑음", "3": "구름많음", "4": "흐림" };
  var 강수글 = { "0": "없음", "1": "비", "2": "비/눈", "3": "눈", "4": "소나기",
                 "5": "빗방울", "6": "빗방울눈날림", "7": "눈날림" };

  /** "1mm 미만" · "강수없음" 같은 글을 숫자로. 못 읽으면 null */
  function 강수량숫자(글) {
    var t = String(글 == null ? "" : 글).trim();
    if (!t || t === "강수없음" || t === "적설없음" || t === "-") return 0;
    if (/미만/.test(t)) return 0.5;                       // "1.0mm 미만"
    if (/이상/.test(t)) {
      var 큰 = parseFloat(t);                             // "50.0mm 이상"
      return isFinite(큰) ? 큰 : null;
    }
    var v = parseFloat(t);
    return isFinite(v) ? v : null;
  }

  /**
   * 단기예보 items → 날짜별로 묶는다.
   * @return { "20260908": { 최저, 최고, 강수확률, 총강수, 하늘, 강수형태, 최대풍속, 시각수 } }
   *
   * 🔴 «그날 하루» 로 줄일 때 무엇을 고르나
   *      강수확률 → 하루 중 **가장 높은 값** (행사는 하루 종일이라 최악을 봐야 한다)
   *      기온     → TMN·TMX 가 있으면 그것, 없으면 시간별 기온의 최저·최고
   *      하늘     → 낮(09~18시) 가운데 **가장 나쁜 것** (밤 하늘은 행사와 무관)
   *      바람     → 하루 중 가장 센 값
   */
  function 단기묶기(items) {
    var 날마다 = {};
    (items || []).forEach(function (it) {
      var 날 = it.fcstDate, 때 = it.fcstTime, 갈 = it.category, 값 = it.fcstValue;
      if (!날 || !갈) return;
      if (!날마다[날]) {
        날마다[날] = {
          날: 날, 최저: null, 최고: null, 강수확률: null, 총강수: 0,
          하늘: null, 강수형태: null, 최대풍속: null, 시각수: 0,
          기온들: [], 낮하늘: []
        };
      }
      var 그 = 날마다[날];
      var 시 = 때 ? Number(String(때).slice(0, 2)) : null;
      var 낮인가 = 시 != null && 시 >= 9 && 시 <= 18;
      var 수 = Number(값);

      switch (갈) {
        case "TMN": if (isFinite(수)) 그.최저 = 수; break;
        case "TMX": if (isFinite(수)) 그.최고 = 수; break;
        case "TMP":
          if (isFinite(수)) { 그.기온들.push(수); 그.시각수++; }
          break;
        case "POP":
          if (isFinite(수)) 그.강수확률 = 그.강수확률 == null ? 수 : Math.max(그.강수확률, 수);
          break;
        case "PCP": {
          var mm = 강수량숫자(값);
          if (mm != null) 그.총강수 += mm;
          break;
        }
        case "SKY":
          if (낮인가) 그.낮하늘.push(Number(값));
          break;
        case "PTY":
          // 0(없음)이 아닌 것이 하나라도 있으면 그것을 그날의 강수형태로 본다
          if (값 && 값 !== "0" && !그.강수형태) 그.강수형태 = 강수글[값] || null;
          break;
        case "WSD":
          if (isFinite(수)) 그.최대풍속 = 그.최대풍속 == null ? 수 : Math.max(그.최대풍속, 수);
          break;
      }
    });

    Object.keys(날마다).forEach(function (날) {
      var 그 = 날마다[날];
      // TMN·TMX 가 없는 날(예보 끝자락)은 시간별 기온으로 메운다
      if (그.최저 == null && 그.기온들.length) 그.최저 = Math.min.apply(null, 그.기온들);
      if (그.최고 == null && 그.기온들.length) 그.최고 = Math.max.apply(null, 그.기온들);
      // 낮 하늘 가운데 가장 나쁜 것 (1 맑음 < 3 구름많음 < 4 흐림)
      if (그.낮하늘.length) {
        var 나쁨 = Math.max.apply(null, 그.낮하늘);
        그.하늘 = 하늘글[String(나쁨)] || null;
      }
      그.총강수 = Math.round(그.총강수 * 10) / 10;
      delete 그.기온들; delete 그.낮하늘;
    });
    return 날마다;
  }

  /** "20260908" → "2026-09-08" */
  function 날펴기(글) {
    var t = String(글 || "");
    return t.length === 8 ? t.slice(0, 4) + "-" + t.slice(4, 6) + "-" + t.slice(6, 8) : t;
  }
  /** "2026-09-08" → "20260908" */
  function 날붙이기(글) { return String(글 || "").replace(/-/g, ""); }

  /* ── 서버에게 묻기 ────────────────────────────────────────
     🔴 두 곳 가운데 하나에게 묻는다 :
        ① `window.예보중계` 가 있으면 그 Cloudflare Worker  (사이트에서 쓴다)
        ② 없으면 같은 자리의 server.py                      (교사 PC 에서 쓴다)
        둘 다 없으면 «과거 통계만» 이 된다 — 그것도 정상이다.
     🔒 어느 쪽이든 **인증키는 이 코드에 없다.** 저쪽이 들고 있다. */
  function 중계주소(길) {
    var 밑 = 뿌리.예보중계;
    if (밑) return String(밑).replace(/\/+$/, "") + "/" + 길;
    return 길;                       // 같은 자리의 server.py
  }

  function 물어보기(길) {
    var 주소 = 중계주소(길);
    return fetch(주소, { cache: "no-store" }).then(function (답) {
      return 답.json().then(function (것) {
        return { 됐나: 답.ok, 번호: 답.status, 몸: 것 };
      });
    }).catch(function (e) {
      // 🔴 더블클릭(file://)으로 열면 서버가 없어 여기로 온다.
      //    그건 잘못이 아니라 «예보를 볼 수 없는 상태» 일 뿐이다.
      return { 됐나: false, 번호: 0, 몸: { 잘못: "서버에 닿지 못했습니다", 말: String(e && e.message || e) } };
    });
  }

  /** 인증키가 들어 있는지 (키 자체는 오지 않는다) */
  function 키있나() {
    return 물어보기("api/keys").then(function (r) {
      return r.됐나 ? r.몸 : { 단기예보: false, 중기예보: false, 서버없음: true };
    });
  }

  /**
   * 단기예보 가져오기 (D+0~D+2)
   * @return Promise<{ 됐나, 날마다, 기준, 잘못 }>
   */
  function 단기가져오기(nx, ny, 지금) {
    if (nx == null || ny == null) {
      return Promise.resolve({ 됐나: false, 잘못: "격자를 모릅니다" });
    }
    var 기준 = 기준시각(지금);
    var 주소 = "api/forecast?kind=단기" +
      "&base_date=" + 기준.base_date + "&base_time=" + 기준.base_time +
      "&nx=" + nx + "&ny=" + ny;

    return 물어보기(주소).then(function (r) {
      if (!r.됐나) {
        return { 됐나: false, 기준: 기준, 잘못: (r.몸 && r.몸.잘못) || "예보를 가져오지 못했습니다", 속: r.몸 };
      }
      var 몸 = r.몸 && r.몸.response && r.몸.response.body;
      var 머리 = r.몸 && r.몸.response && r.몸.response.header;
      if (머리 && 머리.resultCode && 머리.resultCode !== "00") {
        return { 됐나: false, 기준: 기준, 잘못: "기상청 : " + (머리.resultMsg || 머리.resultCode) };
      }
      var items = (몸 && 몸.items && 몸.items.item) || [];
      if (!items.length) return { 됐나: false, 기준: 기준, 잘못: "예보가 비어 있습니다" };
      return { 됐나: true, 기준: 기준, 날마다: 단기묶기(items) };
    });
  }

  뿌리.Fcst = {
    기준시각: 기준시각, 단기묶기: 단기묶기, 강수량숫자: 강수량숫자,
    날펴기: 날펴기, 날붙이기: 날붙이기,
    키있나: 키있나, 단기가져오기: 단기가져오기,
    하늘글: 하늘글, 강수글: 강수글, 발표시각: 발표시각
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof globalThis !== "undefined" ? globalThis : this).Fcst;
}
