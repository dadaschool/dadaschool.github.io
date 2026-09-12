/**
 * grid.js — 위도·경도 ↔ 기상청 동네예보 격자(nx, ny)
 *
 * 🔴 이 파일은 화면(DOM)을 쓰지 않는다. 순수 계산이라
 *    브라우저 없이 node 로 검사한다 (tools/검사/verify_grid.cjs).
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 필요한가
 *   기상청 단기예보 API 는 「거제」 같은 이름이 아니라 **격자 번호**로 묻는다.
 *     .../getVilageFcst?nx=102&ny=68&...
 *   그래서 «어디» 를 격자로 옮겨야 한다.
 *
 * 어떤 셈인가
 *   기상청 동네예보는 **람베르트 정형 원추 투영법(Lambert Conformal Conic)** 위에
 *   5km 격자를 얹은 것이다. 격자는 가로 149 · 세로 253 개.
 *   아래 기준값은 기상청이 공개한 것 그대로다 — **바꾸지 말 것.**
 *     표준위도 30°N · 60°N   기준점 126°E · 38°N
 *     기준점의 격자 자리 (43, 136)   격자 간격 5km   지구 반경 6371.00877km
 *
 * ⚠ 이 셈은 «어느 5km 칸인가» 를 주는 것이지 정확한 지점을 주지 않는다.
 *   그래서 격자 → 위경도로 되돌리면 **그 칸의 기준점**이 나오고, 원래 위경도와
 *   최대 몇 km 어긋난다. 그건 틀린 것이 아니라 격자의 성질이다.
 * ─────────────────────────────────────────────────────────────
 */

(function (뿌리) {
  "use strict";

  // 🔴 기상청이 정한 값이다. 하나라도 바꾸면 예보를 엉뚱한 곳에서 가져온다.
  var 지구반경 = 6371.00877;   // km
  var 격자간격 = 5.0;          // km
  var 표준위도1 = 30.0;        // °N
  var 표준위도2 = 60.0;        // °N
  var 기준경도 = 126.0;        // °E
  var 기준위도 = 38.0;         // °N
  var 기준X = 43;              // 기준점의 격자 자리
  var 기준Y = 136;

  // 격자 크기 — 이 밖은 예보가 없는 자리다
  var 가로 = 149, 세로 = 253;

  var 라디안 = Math.PI / 180.0;

  /* 한 번만 셈해 두는 값들 */
  var re = 지구반경 / 격자간격;
  var slat1 = 표준위도1 * 라디안;
  var slat2 = 표준위도2 * 라디안;
  var olon = 기준경도 * 라디안;
  var olat = 기준위도 * 라디안;

  var sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  var sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;

  var ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);

  /**
   * 위경도 → 격자
   * @return { nx, ny, 안에있나 }
   *   안에있나 : 149×253 격자 안인가. 밖이면 예보를 못 가져온다.
   */
  function 격자로(위도, 경도) {
    // 🚨 `isFinite(null)` 은 **true** 다 (Number(null) 이 0 이라서).
    //    그래서 위경도가 없는 지점에 격자를 물으면 (0,0) 을 넣고 셈해
    //    **엉뚱한 격자를 조용히 돌려준다.** 지금 지점 목록의 위경도가
    //    죄다 null 이므로 이 자리가 실제로 밟힌다. 먼저 걸러야 한다.
    if (위도 == null || 경도 == null) return null;
    if (typeof 위도 !== "number" || typeof 경도 !== "number") return null;
    if (!isFinite(위도) || !isFinite(경도)) return null;

    var ra = Math.tan(Math.PI * 0.25 + 위도 * 라디안 * 0.5);
    ra = re * sf / Math.pow(ra, sn);

    var theta = 경도 * 라디안 - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    var nx = Math.floor(ra * Math.sin(theta) + 기준X + 0.5);
    var ny = Math.floor(ro - ra * Math.cos(theta) + 기준Y + 0.5);

    return {
      nx: nx, ny: ny,
      안에있나: nx >= 1 && nx <= 가로 && ny >= 1 && ny <= 세로
    };
  }

  /**
   * 격자 → 위경도 (그 칸의 기준점)
   * ⚠ 원래 위경도가 그대로 나오지 않는다 — 5km 칸의 기준점이 나온다.
   */
  function 위경도로(nx, ny) {
    // 위와 같은 까닭으로 null 을 먼저 거른다 (isFinite(null) 은 true 다)
    if (nx == null || ny == null) return null;
    if (typeof nx !== "number" || typeof ny !== "number") return null;
    if (!isFinite(nx) || !isFinite(ny)) return null;

    var xn = nx - 기준X;
    var yn = ro - ny + 기준Y;
    var ra = Math.sqrt(xn * xn + yn * yn);
    if (sn < 0.0) ra = -ra;

    var alat = Math.pow((re * sf / ra), (1.0 / sn));
    alat = 2.0 * Math.atan(alat) - Math.PI * 0.5;

    var theta;
    if (Math.abs(xn) <= 0.0) {
      theta = 0.0;
    } else if (Math.abs(yn) <= 0.0) {
      theta = Math.PI * 0.5;
      if (xn < 0.0) theta = -theta;
    } else {
      theta = Math.atan2(xn, yn);
    }
    var alon = theta / sn + olon;

    return { 위도: alat / 라디안, 경도: alon / 라디안 };
  }

  /** 두 곳 사이 거리(km) — 지구를 공으로 보고 잰다 */
  function 거리(위1, 경1, 위2, 경2) {
    var 값들 = [위1, 경1, 위2, 경2];
    for (var i = 0; i < 4; i++) {
      if (값들[i] == null || typeof 값들[i] !== "number" || !isFinite(값들[i])) return null;
    }
    var d위 = (위2 - 위1) * 라디안, d경 = (경2 - 경1) * 라디안;
    var a = Math.sin(d위 / 2) * Math.sin(d위 / 2) +
            Math.cos(위1 * 라디안) * Math.cos(위2 * 라디안) *
            Math.sin(d경 / 2) * Math.sin(d경 / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  뿌리.Grid = {
    격자로: 격자로, 위경도로: 위경도로, 거리: 거리,
    크기: { 가로: 가로, 세로: 세로 },
    기준값: {
      지구반경: 지구반경, 격자간격: 격자간격,
      표준위도1: 표준위도1, 표준위도2: 표준위도2,
      기준경도: 기준경도, 기준위도: 기준위도,
      기준X: 기준X, 기준Y: 기준Y
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof globalThis !== "undefined" ? globalThis : this).Grid;
}
