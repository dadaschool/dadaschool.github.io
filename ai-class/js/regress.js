/* =========================================================
   회귀 실험실 화면 (7차시) — regression.html 전용

   ⚠ 계산은 여기에 적지 않는다. js/regress-model.js 에만 있다.
      그 파일은 Node 에서도 돌아가서 tools/검사/verify_regress.cjs 가
      «화면에 나오는 숫자» 를 그대로 검사할 수 있다.
      여기서 다시 계산하면 검사를 통과한 값과 화면이 어긋난다.

   ⚠ 모듈(import)·fetch 를 쓰지 않는다 — index.html 더블클릭(file://) 실행을 지키려는 것이다.
   ========================================================= */
"use strict";

(function () {
  var M = window.RegModel;
  if (!M) { console.error("js/regress-model.js 를 먼저 불러야 합니다."); return; }

  /* 이 실험실이 쓰는 데이터는 «한 번만» 만든다 (씨앗 고정) */
  var 표 = M.데이터만들기();
  var 여름 = M.여름수업표(표);                 /* 탭 ②③ — 여름철 수업 시간 68건쯤 */
  var 여름점 = 여름.map(function (r) { return { x: r.기온, y: r.전력 }; });

  /* 세 가지 AI 를 나란히 시험한다.
     ⚠ «기온만» 은 학생이 탭 ② 에서 직접 맞춘 직선(0.1×기온+1.0)을 24시간·1년에
        그대로 쓴 것이다. PPT 의 시험 결과가 바로 이것이다 — 자세한 까닭은
        js/regress-model.js 의 `기온모델` 주석을 볼 것. */
  var 모델1 = M.기온모델(표);                          /* 단서 1개 — 기온만 */
  var 모델2 = M.학습(표, ["시각", "기온"]);            /* 단서 2개 */
  var 모델4 = M.학습(표, ["시각", "기온", "냉난방", "운영중"]); /* 단서 4개 */
  var 평균쟁이 = M.평균모델(표);

  var 색 = {
    점: "#0d9488", 점옅: "rgba(13,148,136,.55)",
    선: "#4f46e5", 오차: "#dc2626", 읽기: "#d97706",
    운영: "#4f46e5", 휴식: "#9ca3af",
    실제: "#1e1b4b", 한개: "#dc2626", 두개: "#f97316", 네개: "#14b8a6",
    격자: "#e5e7eb", 축: "#6b7280", 글: "#374151"
  };

  function 소수(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }
  function $(id) { return document.getElementById(id); }

  /* =========================================================
     캔버스 그림판 — 축·격자·점·선을 그리는 작은 도구
     ---------------------------------------------------------
     화면 크기가 바뀌어도 선명하게 나오도록 그릴 때마다
     실제 픽셀 수(devicePixelRatio)를 다시 맞춘다.
     ========================================================= */
  function 판(cv, o) {
    var 여백 = { 왼: 62, 오: 16, 위: 16, 아래: 46 };
    var 배율 = window.devicePixelRatio || 1;
    var 폭 = cv.clientWidth || cv.width;
    var 높이 = Math.round(폭 * (o.비 || 0.68));
    /* 좁은 화면(휴대전화)에서 그래프가 납작해져 글자가 겹치는 것을 막는다 */
    if (o.최소높이 && 높이 < o.최소높이) 높이 = o.최소높이;
    cv.width = Math.round(폭 * 배율);
    cv.height = Math.round(높이 * 배율);
    cv.style.height = 높이 + "px";

    var g = cv.getContext("2d");
    g.setTransform(배율, 0, 0, 배율, 0, 0);
    g.clearRect(0, 0, 폭, 높이);

    var 그림 = {
      g: g, 폭: 폭, 높이: 높이, 여백: 여백,
      X: function (v) { return 여백.왼 + (v - o.x0) / (o.x1 - o.x0) * (폭 - 여백.왼 - 여백.오); },
      Y: function (v) { return 높이 - 여백.아래 - (v - o.y0) / (o.y1 - o.y0) * (높이 - 여백.위 - 여백.아래); }
    };

    /* 격자 + 눈금 */
    g.font = "14px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "top";
    g.strokeStyle = 색.격자; g.lineWidth = 1;
    var i, v;
    for (i = 0; ; i++) {
      v = o.x0 + i * o.xt; if (v > o.x1 + 1e-9) break;
      g.beginPath(); g.moveTo(그림.X(v), 여백.위); g.lineTo(그림.X(v), 높이 - 여백.아래); g.stroke();
      g.fillStyle = 색.축;
      g.fillText(o.x나눔 ? o.x나눔(v) : String(Math.round(v * 100) / 100), 그림.X(v), 높이 - 여백.아래 + 8);
    }
    g.textAlign = "right"; g.textBaseline = "middle";
    for (i = 0; ; i++) {
      v = o.y0 + i * o.yt; if (v > o.y1 + 1e-9) break;
      g.beginPath(); g.moveTo(여백.왼, 그림.Y(v)); g.lineTo(폭 - 여백.오, 그림.Y(v)); g.stroke();
      g.fillStyle = 색.축;
      g.fillText(o.y나눔 ? o.y나눔(v) : String(Math.round(v * 100) / 100), 여백.왼 - 8, 그림.Y(v));
    }
    /* 축선 */
    g.strokeStyle = 색.축; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(여백.왼, 여백.위); g.lineTo(여백.왼, 높이 - 여백.아래); g.lineTo(폭 - 여백.오, 높이 - 여백.아래);
    g.stroke();

    /* 축 이름 */
    g.fillStyle = 색.글; g.font = "bold 15px system-ui, sans-serif";
    g.textAlign = "right"; g.textBaseline = "bottom";
    if (o.x이름) g.fillText(o.x이름, 폭 - 여백.오, 높이 - 6);
    if (o.y이름) {
      g.save(); g.translate(14, 여백.위); g.rotate(-Math.PI / 2);
      g.textAlign = "right"; g.textBaseline = "top";
      g.fillText(o.y이름, 0, 0); g.restore();
    }

    /* 그리기 도구 */
    그림.점 = function (x, y, c, r) {
      g.fillStyle = c || 색.점; g.beginPath();
      g.arc(그림.X(x), 그림.Y(y), r || 4.5, 0, Math.PI * 2); g.fill();
    };
    그림.선 = function (x1, y1, x2, y2, c, w, 점선) {
      g.strokeStyle = c || 색.선; g.lineWidth = w || 3;
      g.setLineDash(점선 || []);
      g.beginPath(); g.moveTo(그림.X(x1), 그림.Y(y1)); g.lineTo(그림.X(x2), 그림.Y(y2)); g.stroke();
      g.setLineDash([]);
    };
    그림.글 = function (x, y, t, c, 정렬, 굵기) {
      g.fillStyle = c || 색.글; g.font = (굵기 || "bold ") + "16px system-ui, sans-serif";
      g.textAlign = 정렬 || "left"; g.textBaseline = "bottom";
      g.fillText(t, 그림.X(x), 그림.Y(y));
    };
    /* 화면 좌표로 바로 쓰는 글 (막대그래프 등에서) */
    그림.픽셀글 = function (px, py, t, c, 정렬, 크기) {
      g.fillStyle = c || 색.글; g.font = "bold " + (크기 || 16) + "px system-ui, sans-serif";
      g.textAlign = 정렬 || "center"; g.textBaseline = "bottom";
      g.fillText(t, px, py);
    };
    return 그림;
  }

  /* =========================================================
     하위 탭 — 한 번에 하나만 보인다
     ========================================================= */
  var 탭들 = [
    { 키: "game",  이름: "① 분류인가 회귀인가" },
    { 키: "line",  이름: "② 직선 긋기 놀이터" },
    { 키: "read",  이름: "③ 직선으로 읽기" },
    { 키: "find",  이름: "④ 산점도 3개" },
    { 키: "fix",   이름: "⑤ 단서 바꾸기" },
    { 키: "table",이름: "⑥ 점수 계산표" }
  ];
  var 지금탭 = null;

  function 탭열기(키) {
    지금탭 = 키;
    탭들.forEach(function (t) {
      $("p-" + t.키).hidden = (t.키 !== 키);
      var b = document.querySelector('.subtabs button[data-k="' + t.키 + '"]');
      if (b) b.classList.toggle("on", t.키 === 키);
    });
    /* 캔버스는 «보이는 상태» 에서만 크기를 알 수 있다 — 탭을 열고 나서 그린다 */
    if (키 === "line") { 선그리기(); 손실그리기(); }
    if (키 === "read") 읽기그리기();
    if (키 === "find") 찾기그리기();
    if (키 === "fix") 고치기그리기();
    if (키 === "table") { 계산표새로(); 시나리오그리기(); }
    /* 주소에 남겨 둔다 — 교사가 특정 탭 링크를 나눠 줄 수 있다 */
    if (history.replaceState) history.replaceState(null, "", "#" + 키);
  }

  (function 탭만들기() {
    var box = $("subtabs");
    탭들.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = t.이름; b.setAttribute("data-k", t.키);
      b.addEventListener("click", function () { 탭열기(t.키); });
      box.appendChild(b);
    });
  })();

  $("rowCount").textContent = String(표.length);
  $("findN").textContent = String(표.length);

  /* =========================================================
     ① 분류인가 회귀인가
     ========================================================= */
  var 문제들 = [
    { q: "오늘 급식은 스파게티일까, 제육볶음일까?", a: "분류", tag: "게임 A" },
    { q: "오늘 매점에서 초코우유가 몇 개 팔릴까?", a: "회귀", tag: "게임 B" },
    { q: "이 사진은 고양이일까, 강아지일까?", a: "분류", tag: "" },
    { q: "내일 낮 최고 기온은 몇 도일까?", a: "회귀", tag: "" },
    { q: "이 메일은 스팸일까, 아닐까?", a: "분류", tag: "" },
    { q: "이 중고 자전거는 얼마에 팔릴까?", a: "회귀", tag: "" },
    { q: "손으로 쓴 이 글씨는 0~9 중 무엇일까?", a: "분류", tag: "" },
    { q: "이 영화는 별점 몇 점을 받을까?", a: "회귀", tag: "" },
    { q: "상대가 가위·바위·보 중 무엇을 냈을까?", a: "분류", tag: "2차시에 만든 것" },
    { q: "지금 우리 학교는 전기를 몇 kWh 쓸까?", a: "회귀", tag: "오늘 만들 것" }
  ];
  var 고른답 = [];

  function 게임그리기() {
    var box = $("qcards"); box.innerHTML = "";
    문제들.forEach(function (m, i) {
      var d = document.createElement("div");
      d.className = "qcard";
      var 답 = 고른답[i];
      if (답) d.className += (답 === m.a) ? " ok" : " no";
      var 왼 = '<div><div class="q">' + m.q + '</div>' +
               (m.tag ? '<div class="tag">' + m.tag + '</div>' : '') + '</div>';
      if (답) {
        d.innerHTML = 왼 +
          '<div class="mk ' + (답 === m.a ? 'mark-ok' : 'mark-no') + '">' +
            (답 === m.a ? "○" : "×") + '</div>' +
          '<div class="tag">내 답 : ' + 답 + (답 === m.a ? "" : " · 정답 : " + m.a) + '</div>';
      } else {
        d.innerHTML = 왼 +
          '<button type="button" data-i="' + i + '" data-a="분류">🏷 분류</button>' +
          '<button type="button" data-i="' + i + '" data-a="회귀">🔢 회귀</button>';
      }
      box.appendChild(d);
    });
    Array.prototype.forEach.call(box.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        고른답[+b.getAttribute("data-i")] = b.getAttribute("data-a");
        게임그리기();
      });
    });

    var 푼것 = 고른답.filter(Boolean).length;
    var 맞힌것 = 문제들.filter(function (m, i) { return 고른답[i] === m.a; }).length;
    $("gmDone").textContent = 푼것 + " / " + 문제들.length;
    $("gmOk").textContent = String(맞힌것);
    var res = $("gmRes");
    if (푼것 < 문제들.length) { res.hidden = true; return; }
    res.hidden = false;
    res.className = "res " + (맞힌것 >= 8 ? "ok" : "no");
    res.innerHTML = "<b>" + 문제들.length + "문제 중 " + 맞힌것 + "개 정답.</b> " +
      (맞힌것 >= 8
        ? "잘 구분했습니다. <b>답이 이름표면 분류, 숫자면 회귀</b>입니다."
        : "다시 봅시다. <b>답을 «몇 개·몇 도·몇 원» 처럼 숫자로 말해야 하면 회귀</b>입니다.");
  }
  $("gmReset").addEventListener("click", function () { 고른답 = []; 게임그리기(); });
  게임그리기();

  /* =========================================================
     ② 직선 긋기 놀이터
     ========================================================= */
  var 내기울기 = 0.02, 내높이 = 3.5;
  var 내최고 = null;
  var 학습중 = false;      /* 🤖 AI 가 학습 애니메이션을 돌리는 중인지 */
  var 오차선보임 = true;
  var 손실기록 = [];
  var AI최적 = M.직선맞추기(여름점);
  var AI오차 = M.직선오차합(여름점, AI최적.기울기, AI최적.절편);

  function 선그리기() {
    var p = 판($("cvLine"), {
      x0: 17, x1: 38, xt: 3, y0: 2, y1: 6, yt: 0.5, 비: 0.7,
      x이름: "기온 (℃)", y이름: "소비전력량 (kWh)"
    });
    /* 오차선을 점보다 먼저 그려 점이 위에 오게 한다 */
    if (오차선보임) {
      여름점.forEach(function (d) {
        var 예 = 내기울기 * d.x + 내높이;
        p.선(d.x, d.y, d.x, 예, 색.오차, 1.6);
      });
    }
    여름점.forEach(function (d) { p.점(d.x, d.y, 색.점, 4.5); });
    p.선(17, 내기울기 * 17 + 내높이, 38, 내기울기 * 38 + 내높이, 색.선, 3.5);

    var 오차 = M.직선오차합(여름점, 내기울기, 내높이);
    $("lnNow").textContent = 소수(오차, 1);
    /* ⚠ AI 가 학습하는 동안에는 «내 최고 기록» 을 건드리지 않는다.
       그러지 않으면 AI 의 성적이 학생 기록으로 들어가 늘 «AI와 같다» 가 나온다. */
    if (!학습중 && (내최고 == null || 오차 < 내최고)) 내최고 = 오차;
    $("lnBest").textContent = (내최고 == null) ? "–" : 소수(내최고, 1);
  }

  function 손실그리기() {
    var p = 판($("cvLoss"), {
      x0: 0, x1: Math.max(60, 손실기록.length - 1 || 60), xt: Math.max(10, Math.round(Math.max(60, 손실기록.length) / 6)),
      y0: 0, y1: 40, yt: 10, 비: 0.26, 최소높이: 190,
      x이름: "학습 횟수", y이름: "오차 합"
    });
    if (!손실기록.length) {
      p.픽셀글(p.폭 / 2, p.높이 / 2 + 8, "🤖 「AI에게 맡기기」 를 누르면 여기에 그려집니다", 색.축, "center", 17);
      return;
    }
    var g = p.g;
    g.strokeStyle = 색.오차; g.lineWidth = 3; g.beginPath();
    손실기록.forEach(function (v, i) {
      var X = p.X(i), Y = p.Y(Math.min(v, 40));
      if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
    });
    g.stroke();
    /* 도착점 표시 */
    var 끝 = 손실기록[손실기록.length - 1];
    p.점(손실기록.length - 1, Math.min(끝, 40), 색.네개, 6);
    p.글(손실기록.length - 1, Math.min(끝, 40) + 2.5, "오차 합 " + 소수(끝, 1), 색.글, "right");
  }

  $("lnSlope").addEventListener("input", function () {
    내기울기 = +this.value; $("lnSlopeV").textContent = 소수(내기울기, 3); 선그리기();
  });
  $("lnBias").addEventListener("input", function () {
    내높이 = +this.value; $("lnBiasV").textContent = 소수(내높이, 2); 선그리기();
  });
  $("lnShowErr").addEventListener("click", function () {
    오차선보임 = !오차선보임;
    this.classList.toggle("on", 오차선보임);
    this.textContent = 오차선보임 ? "오차선 보이기" : "오차선 숨기기";
    선그리기();
  });

  /* 🤖 AI에게 맡기기 — «오차가 줄어드는 쪽으로 조금씩» 을 눈으로 보여 준다.
     경사하강법이고, 도착점은 M.직선맞추기 가 한 번에 구한 답과 같다. */
  $("lnAi").addEventListener("click", function () {
    if (학습중) return;
    var 내값 = 내최고;                 /* 학습 시작 «전» 의 학생 기록을 붙잡아 둔다 */
    학습중 = true; 손실기록 = [];
    var 단추 = this; 단추.textContent = "🤖 학습 중…";
    var a = 내기울기, b = 내높이, 걸음 = 0, 총 = 120;
    var xs = 여름점.map(function (d) { return d.x; }), ys = 여름점.map(function (d) { return d.y; });
    var n = xs.length;
    /* 기온은 20~37 이라 그대로 쓰면 기울기 쪽이 훨씬 크게 흔들린다.
       그래서 기울기 쪽 걸음을 작게 잡았다(학습률 두 개). */
    /* ⚠ 브라우저는 «보이지 않는 탭» 에서 requestAnimationFrame 을 아예 부르지 않는다.
       학생이 도중에 다른 탭으로 가면 단추가 「학습 중…」 에 멈춘 것처럼 보인다.
       그래서 8초 감시 타이머를 둔다 — 애니메이션이 멈춰 있어도 답까지는 반드시 간다.
       (setTimeout 은 숨은 탭에서도 늦게라도 불린다. pdf-split 에서 겪은 것과 같은 문제다) */
    var 감시 = setTimeout(function () { if (학습중) 마무리(); }, 8000);

    /* 마무리 — 눈으로 본 도착점과 계산값을 «정확히» 같게 맞춘다 */
    function 마무리() {
      clearTimeout(감시);
      a = AI최적.기울기; b = AI최적.절편;
      내기울기 = a; 내높이 = b;
      $("lnSlope").value = String(a); $("lnSlopeV").textContent = 소수(a, 3);
      $("lnBias").value = String(b); $("lnBiasV").textContent = 소수(b, 2);
      손실기록.push(AI오차); 선그리기(); 손실그리기();
      학습중 = false; 단추.textContent = "🤖 다시 맡기기";
      var res = $("lnRes"); res.hidden = false;
      var 비겼다 = (내값 != null && 내값 <= AI오차 + 0.5);
      res.className = "res " + (비겼다 ? "ok" : "no");
      res.innerHTML =
        "AI가 찾은 직선 : <b>전력 = " + 소수(a, 3) + " × 기온 + " + 소수(b, 2) + "</b><br>" +
        "오차 합 — 내 최고 기록 <b>" + (내값 == null ? "아직 없음" : 소수(내값, 1)) +
        "</b> · AI <b>" + 소수(AI오차, 1) + "</b><br>" +
        (비겼다
          ? "AI와 거의 같은 직선을 찾았습니다! AI가 하는 일도 <b>이 손잡이를 수천 번 돌려 보는 것</b>뿐입니다."
          : "AI가 더 작은 오차를 찾았습니다. AI는 <b>오차가 줄어드는 쪽으로만</b> 조금씩 움직입니다. " +
            "손잡이를 직접 돌려 <b>AI 기록을 따라잡아</b> 보세요.");
    }

    function 한걸음() {
      if (!학습중) return;              /* 감시 타이머가 먼저 마무리했다면 조용히 물러난다 */
      var da = 0, db = 0, i, 오;
      for (i = 0; i < n; i++) { 오 = (a * xs[i] + b) - ys[i]; da += 오 * xs[i]; db += 오; }
      a -= (0.00022 / n) * da * 2;
      b -= (0.16 / n) * db * 2;
      내기울기 = a; 내높이 = b;
      $("lnSlope").value = String(a); $("lnSlopeV").textContent = 소수(a, 3);
      $("lnBias").value = String(b); $("lnBiasV").textContent = 소수(b, 2);
      손실기록.push(M.직선오차합(여름점, a, b));
      선그리기(); 손실그리기();
      걸음++;
      if (걸음 < 총) { requestAnimationFrame(한걸음); return; }
      마무리();
    }
    requestAnimationFrame(한걸음);
  });

  /* =========================================================
     ③ 직선으로 읽기
     ========================================================= */
  function 읽기그리기() {
    var 기온 = +$("rdTemp").value;
    var 예측 = AI최적.기울기 * 기온 + AI최적.절편;
    var p = 판($("cvRead"), {
      x0: 17, x1: 38, xt: 3, y0: 2, y1: 6, yt: 0.5, 비: 0.7,
      x이름: "기온 (℃)", y이름: "소비전력량 (kWh)"
    });
    여름점.forEach(function (d) { p.점(d.x, d.y, 색.점옅, 4); });
    p.선(17, AI최적.기울기 * 17 + AI최적.절편, 38, AI최적.기울기 * 38 + AI최적.절편, 색.선, 3.5);

    /* 읽는 길 : 아래 → 위 → 왼쪽 */
    p.선(기온, 2, 기온, 예측, 색.읽기, 3, [7, 5]);
    p.선(17, 예측, 기온, 예측, 색.읽기, 3, [7, 5]);
    p.점(기온, 예측, 색.읽기, 8);
    p.글(기온, 예측 + 0.18, 소수(예측, 1) + " kWh", 색.읽기, "center");

    $("rdTempV").textContent = 기온 + "도";
    $("rdS1").textContent = 기온 + "도";
    $("rdS4").textContent = 소수(예측, 1) + " kWh";
    $("rdOut").textContent = 소수(예측, 1) + " kWh";

    /* 그 기온의 «실제 기록» 이 데이터에 있는지 — 없어도 읽힌다는 것을 보여 준다 */
    var 근처 = 여름.filter(function (r) { return Math.abs(r.기온 - 기온) < 0.3; });
    var res = $("rdRes");
    res.className = "res " + (근처.length ? "ok" : "no");
    res.innerHTML = 근처.length
      ? "이 기온의 실제 기록이 <b>" + 근처.length + "건</b> 있습니다 — 직선이 그 점들 가까이 지나갑니다."
      : "이 기온의 실제 기록은 데이터에 <b>한 건도 없습니다.</b> " +
        "그래도 <b>직선이 있으니 읽을 수 있습니다</b> — 이것이 예측입니다.";
  }
  $("rdTemp").addEventListener("input", 읽기그리기);

  /* =========================================================
     ④ 산점도 3개에서 비밀 찾기
     ========================================================= */
  var 찾기들 = [
    { 키: "temp", 이름: "기온 ↔ 전력", x이름: "기온 (℃)", x: function (r) { return r.기온; },
      x0: -8, x1: 38, xt: 10, 묶음: 4,
      말: "<b>U자 계곡!</b> 18도쯤에서 가장 적고 <b>더울 때도 추울 때도</b> 올라간다." },
    { 키: "hour", 이름: "시각 ↔ 전력", x이름: "시각 (시)", x: function (r) { return r.시각; },
      x0: 0, x1: 23, xt: 4, 묶음: 2,
      말: "<b>거꾸로 된 U자.</b> 8~17시에 높고 밤에는 뚝 떨어진다 — 사람이 있는 시간이다." },
    { 키: "hum", 이름: "습도 ↔ 전력", x이름: "습도 (%)", x: function (r) { return r.습도; },
      x0: 35, x1: 95, xt: 10, 묶음: 8,
      말: "<b>아무 모양도 없다.</b> 구간 평균이 평평하다 — <b>단서가 아니다.</b>" }
  ];
  var 찾기상태 = { 직선: false, 평균: false };

  (function 찾기틀() {
    var box = $("fdBox");
    찾기들.forEach(function (f) {
      var d = document.createElement("div");
      d.innerHTML =
        '<div style="font-weight:bold;font-size:19px;margin-bottom:6px">' + f.이름 + '</div>' +
        '<canvas class="chart" id="cv-' + f.키 + '" width="300" height="300"></canvas>' +
        '<div class="score" style="margin-top:8px"><div class="lb">평균 오차 (kWh)</div>' +
        '<div class="nb" id="er-' + f.키 + '">–</div></div>';
      box.appendChild(d);
    });
  })();

  function 찾기그리기() {
    찾기들.forEach(function (f) {
      var 점들 = 표.map(function (r) { return { x: f.x(r), y: r.전력 }; });
      var p = 판($("cv-" + f.키), {
        x0: f.x0, x1: f.x1, xt: f.xt, y0: 0, y1: 6, yt: 1, 비: 0.95,
        x이름: f.x이름, y이름: "전력 (kWh)"
      });
      점들.forEach(function (d) { p.점(d.x, d.y, 색.점옅, 3.4); });

      /* 구간 평균 — U자·역U자가 눈에 보이게 하는 열쇠 */
      if (찾기상태.평균) {
        var 통 = {}, k;
        점들.forEach(function (d) {
          k = Math.floor((d.x - f.x0) / f.묶음);
          (통[k] = 통[k] || []).push(d.y);
        });
        var 앞 = null;
        Object.keys(통).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k2) {
          var 목 = 통[k2]; if (목.length < 3) return;
          var mx = f.x0 + (k2 + 0.5) * f.묶음;
          var my = 목.reduce(function (a, b) { return a + b; }, 0) / 목.length;
          if (앞) p.선(앞[0], 앞[1], mx, my, "#0f172a", 2.6);
          p.점(mx, my, "#0f172a", 6);
          앞 = [mx, my];
        });
      }

      /* 평평한 직선(평균만 말하는 AI) vs 맞춘 직선 */
      var 평균y = 점들.reduce(function (a, d) { return a + d.y; }, 0) / 점들.length;
      var 오차;
      if (찾기상태.직선) {
        var L = M.직선맞추기(점들);
        p.선(f.x0, L.기울기 * f.x0 + L.절편, f.x1, L.기울기 * f.x1 + L.절편, 색.오차, 3);
        오차 = M.직선오차합(점들, L.기울기, L.절편) / 점들.length;
      } else {
        p.선(f.x0, 평균y, f.x1, 평균y, 색.축, 2.4, [7, 5]);
        오차 = M.직선오차합(점들, 0, 평균y) / 점들.length;
      }
      /* ⚠ 소수 1자리로 보여 준다. 2자리로 두면 «직선을 맞췄는데 0.01 늘었다» 가 보인다 —
         AI 가 속으로 줄이는 것은 제곱 오차인데 화면은 절댓값 오차를 보여 주기 때문이다.
         이 탭의 결론은 «거의 안 줄어든다» 이므로 1자리가 오히려 정확하다. */
      $("er-" + f.키).textContent = 소수(오차, 1);
    });

    var res = $("fdRes");
    if (!찾기상태.직선) { res.hidden = true; return; }
    res.hidden = false; res.className = "res no";
    res.innerHTML =
      "<b>직선을 맞췄는데도 평균 오차가 거의 그대로입니다.</b> 셋 다 그렇습니다.<br>" +
      찾기들.map(function (f) { return "• <b>" + f.이름 + "</b> — " + f.말; }).join("<br>") +
      "<br><br><b>여기서 갈립니다.</b> 습도는 <b>구간 평균이 평평해</b> 앞으로도 쓸 데가 없습니다. " +
      "하지만 기온과 시각은 <b>모양이 뚜렷이 보입니다</b> — 직선이 못 그리는 모양일 뿐입니다. " +
      "단서를 바꿔 주면 살아납니다(⑤번 탭).";
  }
  $("fdFit").addEventListener("click", function () { 찾기상태.직선 = true; this.classList.add("on"); 찾기그리기(); });
  $("fdMean").addEventListener("click", function () { 찾기상태.평균 = !찾기상태.평균; this.classList.toggle("on", 찾기상태.평균); 찾기그리기(); });
  $("fdReset").addEventListener("click", function () {
    찾기상태 = { 직선: false, 평균: false };
    $("fdFit").classList.remove("on"); $("fdMean").classList.remove("on");
    찾기그리기();
  });

  /* =========================================================
     ⑤ 단서 바꾸기 — U자를 접어서 직선으로
     ========================================================= */
  var 고치기단계 = 0;      /* 0 원래 · 1 접기 · 2 직선 하나 · 3 두 줄로 나누기 */
  var 접힘 = 0;            /* 0 → 1 애니메이션 진행률 */

  function 고치기그리기() {
    /* x 좌표를 «기온» 에서 «|기온−18|» 로 조금씩 옮긴다.
       접히는 동안 축 이름과 눈금도 함께 바뀌어야 어색하지 않다. */
    var t = 접힘;
    var x0 = -8 * (1 - t) + 0 * t, x1 = 38 * (1 - t) + 26 * t;
    var p = 판($("cvFix"), {
      x0: x0, x1: x1, xt: t < 0.5 ? 10 : 5, y0: 0, y1: 6, yt: 1, 비: 0.5, 최소높이: 330,
      x이름: t < 0.5 ? "기온 (℃)" : "냉난방 필요도 = |기온 − 18|",
      y이름: "전력 (kWh)"
    });

    function 엑스(r) {
      return r.기온 * (1 - t) + M.냉난방필요도(r.기온) * t;
    }
    /* 접히는 중에는 색을 나누지 않는다 — 마지막 단계에서만 두 줄을 보여 준다 */
    var 색나눔 = (고치기단계 >= 3);
    표.forEach(function (r) {
      var op = M.학교운영중(r.시각);
      p.점(엑스(r), r.전력, 색나눔 ? (op ? 색.운영 : 색.휴식) : 색.점옅, 3.6);
    });

    var 점들 = 표.map(function (r) { return { x: 엑스(r), y: r.전력 }; });
    var 평균y = 점들.reduce(function (a, d) { return a + d.y; }, 0) / 점들.length;
    var 오차;

    if (고치기단계 <= 1) {
      p.선(x0, 평균y, x1, 평균y, 색.축, 2.4, [7, 5]);
      오차 = M.직선오차합(점들, 0, 평균y) / 점들.length;
    } else if (고치기단계 === 2) {
      var L = M.직선맞추기(점들);
      p.선(x0, L.기울기 * x0 + L.절편, x1, L.기울기 * x1 + L.절편, 색.오차, 3.4);
      오차 = M.직선오차합(점들, L.기울기, L.절편) / 점들.length;
    } else {
      /* 학교 운영중 = 1 / 0 으로 나눠 각각 직선을 그린다.
         이것이 «단서 4개 모델» 이 하고 있는 일과 같다. */
      [1, 0].forEach(function (op) {
        var 부분 = 표.filter(function (r) { return M.학교운영중(r.시각) === op; })
                     .map(function (r) { return { x: 엑스(r), y: r.전력 }; });
        var L2 = M.직선맞추기(부분);
        p.선(x0, L2.기울기 * x0 + L2.절편, x1, L2.기울기 * x1 + L2.절편,
             op ? 색.운영 : 색.휴식, 3.4);
        p.글(x1, L2.기울기 * x1 + L2.절편 + 0.15,
             op ? "학교 운영중" : "학교가 빈 시간", op ? 색.운영 : 색.휴식, "right");
      });
      오차 = 모델4.평균오차;
    }

    var 말 = [
      { lb: "① 원래 기온", nb: "U자 계곡", cls: "bad",
        res: "no", txt: "직선(점선)은 <b>평균</b>밖에 말하지 못합니다. 자를 아무리 돌려도 계곡 모양은 안 됩니다." },
      { lb: "② 접었다", nb: "|기온 − 18|", cls: "brand",
        res: "ok", txt: "<b>U자가 펴졌습니다!</b> 왼쪽(추운 날)이 오른쪽으로 접혀 왔습니다. " +
             "이제 «멀어질수록 전기를 많이 쓴다» 는 <b>오른쪽으로 오르는 모양</b>이 되었습니다. " +
             "아직 직선은 안 그었으니 오차는 그대로입니다 — ③을 눌러 보세요." },
      { lb: "③ 직선 하나", nb: "기울기가 생겼다", cls: "brand",
        res: "no", txt: "직선이 드디어 <b>기울어졌습니다.</b> 그런데 <b>평균 오차는 1.2 그대로입니다!</b><br>" +
             "그림을 보세요 — 점들이 <b>위아래 두 덩어리</b>로 갈려 있고, " +
             "직선 하나는 그 <b>가운데를 지날 수밖에</b> 없습니다. " +
             "오차를 만들고 있는 것은 기온이 아니라 <b>그 두 덩어리의 간격</b>입니다. " +
             "무엇이 이 간격을 만들까요?" },
      { lb: "④ 두 줄로 갈렸다", nb: "학교 운영중 0 / 1", cls: "good",
        res: "ok", txt: "답은 <b>「학교에 사람이 있는지」</b> 였습니다. " +
             "위 줄은 <b>수업 시간(8~17시)</b>, 아래 줄은 <b>학교가 빈 시간</b>이고 " +
             "두 줄의 <b>간격 ≈ 2.6kWh</b> 가 그 단서의 힘입니다.<br>" +
             "평균 오차가 <b>1.2 → 0.2</b> 로 <b>6분의 1</b> 이 되었습니다. " +
             "단서 <b>둘을 함께</b> 줘야 이렇게 됩니다 — 이것이 <b>단서 4개 AI</b> 가 하고 있는 일입니다." }
    ][고치기단계];

    $("fxLb").textContent = 말.lb;
    $("fxNb").textContent = 말.nb;
    $("fxCard").className = "score " + 말.cls;
    /* ⚠ 소수 1자리로 보여 준다 — 탭 ④ 와 같은 이유다.
       ③단계(접은 뒤 직선 하나)의 절댓값 오차는 1.2243 로 ①②(1.2045)보다 «조금 크다».
       AI 가 속으로 줄이는 것은 제곱 오차인데 화면은 절댓값 오차라서 그렇다.
       2자리로 두면 «직선을 맞췄는데 나빠졌다» 로 보이므로 1자리로 둔다.
       (③단계 설명 글도 «아직 줄지 않는다» 로 정직하게 적어 두었다.) */
    $("fxErr").textContent = 소수(오차, 1);
    var res = $("fxRes");
    res.className = "res " + 말.res;
    res.innerHTML = 말.txt;
  }

  /* 단추를 빠르게 여러 번 눌러도 «마지막에 누른 것» 이 이긴다.
     ⚠ 예전에는 «접히는 중» 이면 클릭을 무시했는데, 학생이 두 번 빨리 누르면
        아무 일도 안 일어나 고장으로 보였다. 그래서 표(token)를 두어
        새 클릭이 앞의 애니메이션을 «가로채게» 했다. */
  var 접기표 = 0;
  Array.prototype.forEach.call(document.querySelectorAll("[data-fix]"), function (b) {
    b.addEventListener("click", function () {
      고치기단계 = +b.getAttribute("data-fix");
      Array.prototype.forEach.call(document.querySelectorAll("[data-fix]"), function (o) {
        o.classList.toggle("on", o === b);
      });
      var 목표 = (고치기단계 === 0) ? 0 : 1;
      var 내표 = ++접기표;
      if (Math.abs(접힘 - 목표) < 1e-6) { 접힘 = 목표; 고치기그리기(); return; }

      /* 접히는 모습을 애니메이션으로 — 이 장면이 이 수업의 결론이다 */
      var 시작 = 접힘, 프레임 = 0, 총 = 45;
      (function 한칸() {
        if (내표 !== 접기표) return;          /* 더 최근 클릭이 있었다 → 조용히 물러난다 */
        프레임++;
        var u = 프레임 / 총;
        접힘 = 시작 + (목표 - 시작) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
        고치기그리기();
        if (프레임 < 총) { requestAnimationFrame(한칸); return; }
        접힘 = 목표; 고치기그리기();
      })();
    });
  });

  /* =========================================================
     ⑥ 점수 계산표 예측기
     ========================================================= */
  function 계산표새로() {
    var 시각 = +$("tbHour").value, 기온 = +$("tbTemp").value;
    $("tbHourV").textContent = 시각 + "시";
    $("tbTempV").textContent = 기온 + "도";

    var 필요도 = M.냉난방필요도(기온), 운영 = M.학교운영중(시각);
    /* 계수 순서 = 학습할 때 준 단서 순서 : 시각 · 기온 · 냉난방 · 운영중 */
    var c = 모델4.계수;
    var 단서줄 = [
      { 이름: "시각", 값: 시각, 계: c[0] },
      { 이름: "기온", 값: 기온, 계: c[1] },
      { 이름: "냉난방 필요도 = |" + 기온 + " − 18|", 값: 필요도, 계: c[2] },
      { 이름: "학교 운영중 (8~17시면 1)", 값: 운영, 계: c[3] }
    ];
    $("tbRows").innerHTML = 단서줄.map(function (d) {
      return "<tr><td class='left'>" + d.이름 + "</td><td><b>" + d.값 + "</b></td><td>" +
             소수(d.계, 2) + "</td><td><b>" + 소수(d.값 * d.계, 2) + "</b></td></tr>";
    }).join("") +
      "<tr><td class='left'>기본값 (아무 단서도 없을 때)</td><td>–</td><td>" +
      소수(모델4.기본값, 2) + "</td><td><b>" + 소수(모델4.기본값, 2) + "</b></td></tr>";

    /* PPT 의 계산표는 «계수가 0 에 가까운 시각·기온을 지운» 모습이다 */
    $("tbFormula").innerHTML =
      '<span class="t">예측 전력량</span> = (학교 운영중 × <span class="n">' + 소수(c[3], 2) + '</span>)' +
      ' + (냉난방 필요도 × <span class="n">' + 소수(c[2], 2) + '</span>)' +
      ' + <span class="n">' + 소수(모델4.기본값, 2) + '</span>' +
      '<small>시각 계수 ' + 소수(c[0], 3) + ' · 기온 계수 ' + 소수(c[1], 3) +
      ' — <b>거의 0</b> 이라 계산표에서 빠졌습니다. ' +
      '두 단서가 하던 일을 «냉난방 필요도» 와 «학교 운영중» 이 대신하고 있습니다.</small>';

    var r = { 시각: 시각, 기온: 기온 };
    var p4 = 모델4.예측(r), p1 = 모델1.예측(r), 참 = M.실제값(시각, 기온);
    $("tbP4").textContent = 소수(p4, 1) + " kWh";
    $("tbP1").textContent = 소수(p1, 1) + " kWh";
    $("tbTrue").textContent = 소수(참, 1) + " kWh";

    var res = $("tbRes");
    var 차1 = Math.abs(p1 - 참), 차4 = Math.abs(p4 - 참);
    res.className = "res " + (차4 < 0.4 ? "ok" : "no");
    res.innerHTML =
      "단서 4개 AI는 <b>" + 소수(차4, 1) + "kWh</b> 차이, " +
      "기온만 아는 AI는 <b>" + 소수(차1, 1) + "kWh</b> 차이로 맞혔습니다." +
      (차1 > 차4 + 0.5
        ? " 기온만 아는 AI는 <b>시간을 보지 않고, 기온이 U자인 것도 모릅니다.</b>"
        : " 이 상황은 우연히 둘 다 비슷합니다. " +
          "위의 <b>시나리오 단추 ③·④</b>를 눌러 시험해 보세요.");
  }
  $("tbHour").addEventListener("input", 계산표새로);
  $("tbTemp").addEventListener("input", 계산표새로);

  (function 시나리오단추() {
    var box = $("tbScBtns");
    M.시나리오.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn";
      b.textContent = ["①", "②", "③", "④"][i] + " " + s.이름 + " (" + s.시각 + "시, " + s.기온 + "도)";
      b.addEventListener("click", function () {
        $("tbHour").value = String(s.시각);
        $("tbTemp").value = String(s.기온);
        계산표새로();
        Array.prototype.forEach.call(box.children, function (o) { o.classList.toggle("on", o === b); });
      });
      box.appendChild(b);
    });
  })();

  /* 네 시나리오 막대그래프 — 실제 / 단서 2개 / 단서 4개 를 나란히 */
  function 시나리오그리기() {
    var p = 판($("cvScen"), {
      x0: 0, x1: 1, xt: 1, y0: 0, y1: 6, yt: 1, 비: 0.4, 최소높이: 300,
      x나눔: function () { return ""; }, y이름: "전력 (kWh)"
    });
    var 바닥 = p.높이 - p.여백.아래;
    var 칸 = (p.폭 - p.여백.왼 - p.여백.오) / M.시나리오.length;

    M.시나리오.forEach(function (s, i) {
      var r = { 시각: s.시각, 기온: s.기온 };
      var 값들 = [
        { v: M.실제값(s.시각, s.기온), c: 색.실제 },
        { v: 모델1.예측(r), c: 색.한개 },
        { v: 모델4.예측(r), c: 색.네개 }
      ];
      var 폭막 = 칸 * 0.22;
      var 왼 = p.여백.왼 + 칸 * i + (칸 - 폭막 * 3) / 2;

      값들.forEach(function (d, j) {
        var 위 = p.Y(Math.max(0, Math.min(d.v, 6)));
        p.g.fillStyle = d.c;
        p.g.fillRect(왼 + 폭막 * j, 위, 폭막 - 4, 바닥 - 위);
        p.픽셀글(왼 + 폭막 * j + (폭막 - 4) / 2, 위 - 5, 소수(d.v, 1), d.c, "center", 15);
      });
      p.픽셀글(p.여백.왼 + 칸 * (i + 0.5), 바닥 + 20,
        ["①", "②", "③", "④"][i] + " " + s.이름, 색.글, "center", 15);
      p.픽셀글(p.여백.왼 + 칸 * (i + 0.5), 바닥 + 38,
        "(" + s.시각 + "시, " + s.기온 + "도)", 색.축, "center", 14);
    });

    /* 같은 값을 표로도 준다 — 학습지에 적을 때 눈으로 읽기 쉽게 */
    var 줄 = M.시나리오.map(function (s, i) {
      var r = { 시각: s.시각, 기온: s.기온 };
      var 참 = M.실제값(s.시각, s.기온);
      function 판정(v) {
        var ok = Math.abs(v - 참) < 0.5;
        return "<b class='" + (ok ? "mark-ok" : "mark-no") + "'>" + 소수(v, 1) + " " + (ok ? "○" : "×") + "</b>";
      }
      return "<tr><td class='left'>" + ["①", "②", "③", "④"][i] + " " + s.이름 +
             "</td><td>" + s.시각 + "시</td><td>" + s.기온 + "도</td>" +
             "<td><b>" + 소수(참, 1) + "</b></td>" +
             "<td>" + 판정(모델1.예측(r)) + "</td>" +
             "<td>" + 판정(모델2.예측(r)) + "</td>" +
             "<td>" + 판정(모델4.예측(r)) + "</td>" +
             "<td class='left'>" + s.설명 + "</td></tr>";
    }).join("");

    $("tbScTable").innerHTML =
      "<thead><tr><th class='left'>시나리오</th><th>시각</th><th>기온</th><th>실제</th>" +
      "<th>기온만<br>아는 AI</th><th>시각+기온<br>AI</th><th>단서 4개<br>AI</th>" +
      "<th class='left'>실제로는</th></tr></thead>" +
      "<tbody>" + 줄 + "</tbody>" +
      "<tfoot><tr><td class='left' colspan='3'><b>300개 기록 전체의 평균 오차 (kWh)</b></td>" +
      "<td>–</td>" +
      "<td><b class='mark-no'>" + 소수(모델1.평균오차, 1) + "</b></td>" +
      "<td><b class='mark-no'>" + 소수(모델2.평균오차, 1) + "</b></td>" +
      "<td><b class='mark-ok'>" + 소수(모델4.평균오차, 1) + "</b></td>" +
      "<td class='left'>아무것도 안 배운 AI(평균만 말하기)는 " +
      소수(평균쟁이.오차합 / 표.length, 1) + "</td></tr></tfoot>";
  }

  /* =========================================================
     시작 — 주소에 #탭이름 이 있으면 그 탭을 연다
     ========================================================= */
  (function 시작() {
    /* 손잡이 표시값을 처음 한 번 맞춰 둔다 */
    $("lnSlopeV").textContent = 소수(내기울기, 3);
    $("lnBiasV").textContent = 소수(내높이, 2);

    var 키 = (location.hash || "").replace("#", "");
    var 있음 = 탭들.some(function (t) { return t.키 === 키; });
    탭열기(있음 ? 키 : "game");
  })();

  /* 창 크기가 바뀌면 지금 보이는 탭만 다시 그린다
     (캔버스는 보이지 않는 동안 크기를 알 수 없다) */
  var 그리기타이머 = null;
  window.addEventListener("resize", function () {
    clearTimeout(그리기타이머);
    그리기타이머 = setTimeout(function () { if (지금탭) 탭열기(지금탭); }, 180);
  });
})();
