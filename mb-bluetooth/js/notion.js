/* =========================================================
   notion.js — 「노션에 보내기」

   토큰은 여기에 없다. 이 파일이 아는 것은 중계 서버 주소뿐이다.
   중계 서버(Cloudflare Worker)가 토큰을 들고 노션에 대신 넣어 준다.
   설치 방법은 worker/설치안내.md 를 볼 것.
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     ⬇⬇⬇  선생님이 고치는 곳은 여기 두 줄뿐입니다  ⬇⬇⬇

     workerUrl : Cloudflare 에서 Worker 를 배포하면 나오는 주소.
                 비워 두면 「노션에 보내기」 단추가 아예 나타나지 않고,
                 지금처럼 복사·CSV 만 쓰게 됩니다.
     submitKey : Worker 에 SUBMIT_KEY 를 정해 두었을 때만 적습니다.
                 정하지 않았다면 빈 칸으로 두세요.
     --------------------------------------------------------- */
  var CONFIG = {
    workerUrl: "https://sensor-notion.edudadat.workers.dev",
    submitKey: ""
  };
  /* ⬆⬆⬆  여기까지  ⬆⬆⬆ */

  /* https 만 받는다. 학생이 쓴 내용이 평문으로 흘러가지 않게 하기 위해서다.
     (workers.dev 주소는 원래 https 다)
     시험용으로 자기 컴퓨터에 중계 서버를 띄웠을 때만 http://localhost 를 허용한다. */
  function enabled() {
    var u = CONFIG.workerUrl.trim();
    return /^https:\/\/\S+/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);
  }

  /* ---------------------------------------------------------
     보내기

       Notion.send(줄목록, 진행알림)  →  Promise<{created, failed}>

     줄목록은 [{모둠, 센서명, 설명, 활용분야, 예시}, …] 꼴이다.
     --------------------------------------------------------- */
  function send(rows, onProgress) {
    if (!enabled()) {
      return Promise.reject(new Error("노션 연결이 설정되지 않았습니다."));
    }
    if (!rows || !rows.length) {
      return Promise.reject(new Error("보낼 내용이 없습니다."));
    }

    var headers = { "Content-Type": "application/json" };
    if (CONFIG.submitKey) headers["X-Submit-Key"] = CONFIG.submitKey;

    if (onProgress) onProgress("노션에 보내는 중…");

    return fetch(CONFIG.workerUrl.trim(), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ rows: rows })
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error("중계 서버가 이상한 답을 보냈습니다 (" + res.status + ")");
      }).then(function (data) {
        if (!res.ok && !data.error) {
          throw new Error("중계 서버 오류 (" + res.status + ")");
        }
        if (data.error) throw new Error(data.error);
        return data;      // { ok, created, failed[] }
      });
    }).catch(function (e) {
      /* fetch 자체가 실패하면 대개 주소가 틀렸거나 허용 주소 설정이 빠진 것이다 */
      if (e instanceof TypeError) {
        throw new Error("중계 서버에 연결하지 못했습니다. 주소와 허용 주소 설정을 확인해 주세요.");
      }
      throw e;
    });
  }

  global.Notion = { enabled: enabled, send: send, config: CONFIG };
})(window);
