/* =========================================================
   map2.js — 응급차 지도 데이터와 알고리즘 (2차시 공용)

   실험실(lesson2.html)과 학습지(worksheet2.html)가 같은 값을 써야
   학생이 화면에서 본 숫자와 학습지의 숫자가 어긋나지 않는다.
   그래서 지도와 계산을 이 파일 하나에 모아 두었다.

   지도는 동아출판 정보 교과서 108쪽 「배달 로봇」 문제의 구조를 빌려
   응급차 상황으로 바꾼 것이다.
     · 도로 색이 곧 걸리는 시간이다 — 초록 2분 · 주황 4분 · 빨강 6분
     · 거리(m)는 색과 상관없다. 짧지만 느린 길, 길지만 빠른 길이 함께 있다.

   ⚠ 이 지도의 숫자는 다음 네 가지가 모두 성립하도록 고른 것이다. 바꾸면 수업이 무너진다.
     ① 알고리즘 A(거리 기준)와 B(시간 기준)가 서로 다른 길을 고른다
     ② A 는 짧고 느리다(500m·12분) / B 는 길고 빠르다(950m·8분)  ← 교과서의 결론
     ③ A 가 고른 길은 사실 최단 거리가 아니다 (진짜 최단 450m)   ← 탐욕의 한계
     ④ B 가 고른 길도 사실 최단 시간이 아니다 (진짜 최단 6분)     ← 탐욕의 한계
   ========================================================= */
(function (global) {
  "use strict";

  var NODES = [
    { id: "home",   name: "집",     em: "🏠", x: 110, y: 285 },
    { id: "park",   name: "공원",   em: "🌳", x: 330, y: 95 },
    { id: "school", name: "학교",   em: "🏫", x: 655, y: 130 },
    { id: "museum", name: "박물관", em: "🏛️", x: 385, y: 440 },
    { id: "hosp",   name: "병원",   em: "🏥", x: 800, y: 335 }
  ];

  /* m = 거리(미터), min = 걸리는 시간(분) */
  var EDGES = [
    { a: "home",   b: "museum", m: 100, min: 6 },
    { a: "home",   b: "park",   m: 150, min: 2 },
    { a: "home",   b: "school", m: 500, min: 4 },
    { a: "park",   b: "school", m: 400, min: 4 },
    { a: "park",   b: "hosp",   m: 300, min: 6 },
    { a: "school", b: "hosp",   m: 400, min: 2 },
    { a: "museum", b: "hosp",   m: 400, min: 6 }
  ];

  var START = "home", GOAL = "hosp";
  var GOLDEN = 10;                 /* 골든타임(분) — 이 안에 도착해야 한다 */

  /* 도로 색 — 시간이 곧 색이다 */
  function colorOf(min) {
    if (min <= 2) return { key: "green",  css: "#22c55e", name: "초록" };
    if (min <= 4) return { key: "orange", css: "#f59e0b", name: "주황" };
    return { key: "red", css: "#ef4444", name: "빨강" };
  }

  function nodeOf(id) {
    for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i];
    return null;
  }
  function nameOf(id) { var n = nodeOf(id); return n ? n.name : id; }

  /* 어떤 지역에서 갈 수 있는 이웃들 — weights 를 주면 그 값으로 바꿔 계산한다 */
  function neighbors(id, edges) {
    edges = edges || EDGES;
    var out = [];
    edges.forEach(function (e) {
      if (e.blocked) return;
      if (e.a === id) out.push({ to: e.b, m: e.m, min: e.min, edge: e });
      else if (e.b === id) out.push({ to: e.a, m: e.m, min: e.min, edge: e });
    });
    return out;
  }

  /* ---------------------------------------------------------
     탐욕 알고리즘 — 교과서 알고리즘 1·2 와 같은 방식
       ① 집에서 출발한다
       ② 현재 위치에서 (거리 | 시간) 이 가장 작은 곳으로 이동한다.
          한 번 지난 곳은 다시 가지 않는다.
       ③ 병원에 도착했으면 종료, 아니면 ②를 반복한다
     같은 값이면 이름 순서가 아니라 '먼저 적힌 도로'를 고른다(교과서와 같게).
     --------------------------------------------------------- */
  function greedy(basis, edges) {
    edges = edges || EDGES;
    var cur = START;
    var visited = [START];
    var steps = [];
    var guard = 0;

    while (cur !== GOAL && guard++ < 20) {
      var cand = neighbors(cur, edges).filter(function (n) { return visited.indexOf(n.to) < 0; });
      if (!cand.length) {
        return { path: visited, steps: steps, stuck: true, totalM: sum(steps, "m"), totalMin: sum(steps, "min") };
      }
      var best = cand[0];
      cand.forEach(function (n) { if (n[basis] < best[basis]) best = n; });
      steps.push({ from: cur, to: best.to, m: best.m, min: best.min });
      visited.push(best.to);
      cur = best.to;
    }
    return { path: visited, steps: steps, stuck: false, totalM: sum(steps, "m"), totalMin: sum(steps, "min") };
  }
  function sum(steps, key) {
    return steps.reduce(function (a, s) { return a + s[key]; }, 0);
  }

  /* ---------------------------------------------------------
     집에서 병원까지 가는 모든 길 (같은 곳을 두 번 지나지 않는 길)
     --------------------------------------------------------- */
  function allPaths(edges) {
    edges = edges || EDGES;
    var found = [];
    (function walk(cur, visited, steps) {
      if (cur === GOAL) {
        found.push({
          path: visited.slice(),
          steps: steps.slice(),
          totalM: sum(steps, "m"),
          totalMin: sum(steps, "min")
        });
        return;
      }
      neighbors(cur, edges).forEach(function (n) {
        if (visited.indexOf(n.to) >= 0) return;
        visited.push(n.to);
        steps.push({ from: cur, to: n.to, m: n.m, min: n.min });
        walk(n.to, visited, steps);
        visited.pop();
        steps.pop();
      });
    })(START, [START], []);

    found.sort(function (p, q) { return p.totalMin - q.totalMin || p.totalM - q.totalM; });
    return found;
  }

  function pathText(path) {
    return path.map(nameOf).join(" ▶ ");
  }

  /* 상황 카드 — 지도의 값을 바꾼다. 원본은 건드리지 않고 복사본을 돌려준다. */
  var CARDS = [
    {
      id: "jam", em: "🚗", title: "출근 시간 정체",
      desc: "큰길(집–학교, 학교–병원)에 차가 몰렸습니다. 그 두 길은 시간이 두 배로 걸립니다.",
      apply: function (edges) {
        edges.forEach(function (e) {
          var k = e.a + "-" + e.b;
          if (k === "home-school" || k === "school-hosp") e.min *= 2;
        });
      },
      ask: "차가 막혀도 응급차입니다. 무엇을 기준으로 삼을까요?",
      want: "min"
    },
    {
      id: "work", em: "🚧", title: "도로 공사",
      desc: "집–공원 길이 공사로 막혔습니다. 그 길은 아예 지날 수 없습니다.",
      apply: function (edges) {
        edges.forEach(function (e) { if (e.a === "home" && e.b === "park") e.blocked = true; });
      },
      ask: "길 하나가 사라졌습니다. 무엇을 기준으로 삼을까요?",
      want: "min"
    },
    {
      /* ⚠ 여기서 '+4분'처럼 모든 길에 같은 값을 더하면, 길을 적게 갈아타는 쪽이 무조건 유리해져서
         거리 기준과 시간 기준의 결과가 같아진다(실제로 둘 다 20분이 되어 비교가 무의미했다).
         눈은 도로를 '비례해서' 느리게 만드는 것이 실제에도 가까우므로 곱셈으로 둔다. */
      id: "snow", em: "❄️", title: "폭설",
      desc: "눈이 쌓여 모든 길이 두 배로 오래 걸립니다. 거리는 그대로입니다.",
      apply: function (edges) { edges.forEach(function (e) { e.min *= 2; }); },
      ask: "모든 길이 똑같은 비율로 느려졌습니다. 무엇을 기준으로 삼을까요?",
      want: "min"
    },
    {
      id: "fuel", em: "⛽", title: "연료 경고등",
      desc: "환자는 안정된 상태이고, 연료가 거의 없습니다. 기름을 아껴야 합니다.",
      apply: function () {},
      ask: "이번에는 급하지 않습니다. 무엇을 기준으로 삼을까요?",
      want: "m"
    }
  ];

  function cloneEdges() {
    return EDGES.map(function (e) { return { a: e.a, b: e.b, m: e.m, min: e.min, blocked: false }; });
  }
  function edgesWithCard(cardId) {
    var edges = cloneEdges();
    if (!cardId) return edges;
    CARDS.forEach(function (c) { if (c.id === cardId) c.apply(edges); });
    return edges;
  }

  global.Map2 = {
    NODES: NODES, EDGES: EDGES, START: START, GOAL: GOAL, GOLDEN: GOLDEN, CARDS: CARDS,
    colorOf: colorOf, nodeOf: nodeOf, nameOf: nameOf, neighbors: neighbors,
    greedy: greedy, allPaths: allPaths, pathText: pathText,
    cloneEdges: cloneEdges, edgesWithCard: edgesWithCard
  };
})(window);
