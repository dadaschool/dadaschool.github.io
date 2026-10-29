/* =========================================================
   bm25.js — 교장봇의 «자료 찾기» 엔진
   실습 코드(persona-core/app.py)가 하는 일을 그대로 옮겼다.
     ① tokenize : 글자를 2글자씩 겹쳐 자른다(훈민정음 → 훈민·민정·정음)
     ② BM25     : 질문 조각이 자주·드물게 나오는 정도로 카드마다 점수를 매긴다
     ③ k = 1    : 점수 1등 카드 한 장만 모델에게 건넨다(점수가 0 이면 «자료 없음»)
   화면을 모르므로 node 로도 검사할 수 있다(tools/검사/verify_bm25.cjs).
   ========================================================= */
(function (root) {
  "use strict";

  /* ① 2글자 조각 — 조사가 달라도(«시험을» · «시험이») 같은 조각 «시험» 이 남는다 */
  function tokenize(text) {
    var words = String(text).toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
    var tokens = [];
    words.forEach(function (w) {
      if (w.length === 1) { tokens.push(w); return; }       // 한 글자는 그대로
      for (var i = 0; i < w.length - 1; i++) tokens.push(w.slice(i, i + 2));
    });
    return tokens;
  }

  /* 카드 한 장이 «모델에게 가는 글» 과 «검색에 쓰는 글» — app.py 의 make_retriever() 와 같다 */
  function evidenceOf(card) { return card.id + ". " + card.content; }
  function searchTextOf(card) { return evidenceOf(card) + "\n\n### 검색어\n\n" + card.keywords.join(", "); }

  /* ② 색인 만들기 — rank_bm25 의 BM25Okapi(k1 1.5 · b 0.75 · epsilon 0.25)와 같은 셈 */
  function build(cards) {
    var K1 = 1.5, B = 0.75, EPS = 0.25;
    var docs = cards.map(function (card) {
      var toks = tokenize(searchTextOf(card));
      var tf = Object.create(null);
      toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      return { card: card, len: toks.length, tf: tf };
    });
    var N = docs.length;
    var avgdl = docs.reduce(function (s, d) { return s + d.len; }, 0) / (N || 1);

    // 조각마다 «몇 장의 카드에 들어 있나»
    var nd = Object.create(null);
    docs.forEach(function (d) { Object.keys(d.tf).forEach(function (t) { nd[t] = (nd[t] || 0) + 1; }); });

    // idf : 드문 조각일수록 크다. 절반 넘는 카드에 있는 흔한 조각은 음수가 되므로 작은 값으로 바닥을 깐다
    var idf = Object.create(null), sum = 0, neg = [], words = Object.keys(nd);
    words.forEach(function (t) {
      var v = Math.log(N - nd[t] + 0.5) - Math.log(nd[t] + 0.5);
      idf[t] = v; sum += v;
      if (v < 0) neg.push(t);
    });
    var eps = EPS * (sum / (words.length || 1));
    neg.forEach(function (t) { idf[t] = eps; });

    return { docs: docs, idf: idf, nd: nd, avgdl: avgdl, K1: K1, B: B };
  }

  /* 카드 한 장의 점수 — 질문 조각마다 더한다(같은 조각이 두 번 있으면 두 번 더한다) */
  function scoreDoc(ix, d, qTokens, detail) {
    var s = 0;
    qTokens.forEach(function (q) {
      var f = d.tf[q] || 0;
      if (!f) return;
      var part = (ix.idf[q] || 0) * (f * (ix.K1 + 1) / (f + ix.K1 * (1 - ix.B + ix.B * d.len / ix.avgdl)));
      s += part;
      if (detail) detail[q] = (detail[q] || 0) + part;
    });
    return s;
  }

  function scores(ix, qTokens) {
    return ix.docs.map(function (d) { return scoreDoc(ix, d, qTokens); });
  }

  /* ③ 질문 하나를 찾는다 — app.py 의 chat() 과 같다.
     지금 말을 두 번 넣어 더 반영하고, 바로 앞 질문도 붙여 앞선 주제를 참고한다. */
  function search(ix, user, previous) {
    var query = user + " " + user + " " + (previous || "");
    var qTokens = tokenize(query);
    var sc = scores(ix, qTokens);
    var best = -1, top = 0;
    sc.forEach(function (v, i) { if (v > top) { top = v; best = i; } });   // 같은 점수면 앞 카드
    var detail = {};
    if (best >= 0) scoreDoc(ix, ix.docs[best], qTokens, detail);
    var order = sc.map(function (v, i) { return i; }).sort(function (a, b) { return sc[b] - sc[a] || a - b; });
    return {
      query: query,
      tokens: qTokens,
      scores: sc,
      order: order,                     // 점수 높은 순서의 카드 번호
      best: best,                       // 점수 0 이면 -1
      card: best >= 0 ? ix.docs[best].card : null,
      detail: detail,                   // 1등 카드에서 조각마다 얻은 점수
      evidence: best >= 0 ? evidenceOf(ix.docs[best].card) : "관련 학교 자료가 검색되지 않았다."
    };
  }

  var api = { tokenize: tokenize, build: build, search: search, scores: scores, evidenceOf: evidenceOf, searchTextOf: searchTextOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PBSearch = api;
})(this);
