/* =========================================================
   standards.js — 2022 개정 정보과 성취기준 25개 + 교사 편집
   ---------------------------------------------------------
   · 출처 : C:/project_AI/01. 교육과정/중학교교육과정_성취기준.md
     (5개 영역 · 3/5/9/5/3 = 25개, 코드 [9정01-01]~[9정05-03])
   · sentences(문장 분해)는 원본 앱(gnbuilders/lesson-designer)의
     8개를 그대로 물려받고, 나머지 17개는 같은 문체로 새로 썼다.
     「(학생은) ~한다.」 = 학생이 하는 행동,  「~한다.」 = 배경 사실.
     AI 로 분해하지 않는다(사용자 결정 2026-08-29).
   · 교사가 추가·수정·숨김한 내용은 localStorage['ld.standards.v1'] 에만.
     JSON 으로 내보내/가져와 다른 교사·다른 교과와 공유한다.
   ========================================================= */
(function (global) {
  "use strict";

  var LS_KEY = "ld.standards.v1";

  /* ---- 내장 25개 ---- */
  var BUILTIN = {
    /* (1) 컴퓨팅 시스템 */
    "9정01-01": { area: "1. 컴퓨팅 시스템",
      text: "[9정01-01] 컴퓨팅 시스템의 구성요소와 동작 원리를 이해하고, 운영 체제의 기능을 분석한다.",
      sentences: [
        "(학생은) 컴퓨팅 시스템의 구성요소를 이해한다.",
        "(학생은) 컴퓨팅 시스템의 동작 원리를 이해한다.",
        "(학생은) 운영 체제의 기능을 분석한다."
      ] },
    "9정01-02": { area: "1. 컴퓨팅 시스템",
      text: "[9정01-02] 피지컬 컴퓨팅의 개념을 이해하고, 생활 속에서 적용된 사례 조사를 통해 컴퓨팅 시스템의 필요성과 가치를 판단한다.",
      sentences: [
        "(학생은) 피지컬 컴퓨팅의 개념을 이해한다.",
        "(학생은) 생활 속에서 피지컬 컴퓨팅이 적용된 사례를 조사한다.",
        "(학생은) 컴퓨팅 시스템의 필요성을 판단한다.",
        "(학생은) 컴퓨팅 시스템의 가치를 판단한다."
      ] },
    "9정01-03": { area: "1. 컴퓨팅 시스템",
      text: "[9정01-03] 문제 해결 목적에 맞는 피지컬 컴퓨팅 구성요소를 선택하여 시스템을 구상한다.",
      sentences: [
        "(어떤) 문제 해결 목적이 있다.",
        "(학생은) 목적에 맞는 피지컬 컴퓨팅 구성요소를 선택한다.",
        "(학생은) 피지컬 컴퓨팅 시스템을 구상한다."
      ] },

    /* (2) 데이터 */
    "9정02-01": { area: "2. 데이터",
      text: "[9정02-01] 실생활의 데이터가 디지털 형태로 변환되어 활용되는 긍정적 가치를 탐색하고, 다양한 데이터를 디지털 형태로 표현한다.",
      sentences: [
        "실생활의 데이터가 디지털 형태로 변환된다.",
        "(그 데이터가) 활용된다.",
        "(학생은) 디지털 변환의 긍정적 가치를 탐색한다.",
        "(학생은) 다양한 데이터를 디지털 형태로 표현한다."
      ] },
    "9정02-02": { area: "2. 데이터",
      text: "[9정02-02] 문제 해결에 적합한 데이터를 수집하고, 목적에 맞게 구분하여 관리한다.",
      sentences: [
        "(어떤) 문제 해결에 데이터가 필요하다.",
        "(학생은) 적합한 데이터를 수집한다.",
        "(학생은) 데이터를 목적에 맞게 구분한다.",
        "(학생은) 데이터를 관리한다."
      ] },
    "9정02-03": { area: "2. 데이터",
      text: "[9정02-03] 실생활의 데이터를 표, 다이어그램 등 다양한 형태로 구조화한다.",
      sentences: [
        "(학생은) 실생활의 데이터를 표로 구조화한다.",
        "(학생은) 데이터를 다이어그램 등 다양한 형태로 구조화한다."
      ] },
    "9정02-04": { area: "2. 데이터",
      text: "[9정02-04] 사례를 중심으로 데이터 간의 관계를 파악하고, 데이터에 기반하여 의미를 해석한다.",
      sentences: [
        "(학생은) 사례를 중심으로 데이터 간의 관계를 파악한다.",
        "(학생은) 데이터에 기반하여 의미를 해석한다."
      ] },
    "9정02-05": { area: "2. 데이터",
      text: "[9정02-05] 여러 학문 분야의 사례를 중심으로 데이터를 수집·분석하여 융합적으로 문제를 해결한다.",
      sentences: [
        "(학생은) 여러 학문 분야의 사례에서 데이터를 수집한다.",
        "(학생은) 데이터를 분석한다.",
        "(학생은) 융합적으로 문제를 해결한다."
      ] },

    /* (3) 알고리즘과 프로그래밍 */
    "9정03-01": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-01] 문제의 상태를 정의하고 수행 가능한 형태로 구조화한다.",
      sentences: [
        "(학생은) 문제의 초기 상태를 정의한다.",
        "(학생은) 문제의 현재 상태와 목표 상태를 정의한다.",
        "(학생은) 문제를 수행 가능한 형태로 구조화한다."
      ] },
    "9정03-02": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-02] 문제 해결을 위한 추상화의 중요성을 이해하고, 핵심요소를 중심으로 알고리즘을 표현한다.",
      sentences: [
        "(학생은) 문제 해결에서 추상화의 중요성을 이해한다.",
        "(학생은) 문제의 핵심요소를 뽑아낸다.",
        "(학생은) 핵심요소를 중심으로 알고리즘을 표현한다."
      ] },
    "9정03-03": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-03] 알고리즘의 중요성을 이해하고, 문제를 해결하는 다양한 알고리즘을 비교·분석한다.",
      sentences: [
        "(학생은) 알고리즘의 중요성을 이해한다.",
        "(학생은) 하나의 문제를 해결하는 다양한 알고리즘을 비교한다.",
        "(학생은) 알고리즘의 장단점을 분석한다."
      ] },
    "9정03-04": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-04] 사례를 중심으로 문제 해결에 적합한 전략을 선택하여 알고리즘을 설계한다.",
      sentences: [
        "(학생은) 사례를 중심으로 문제를 파악한다.",
        "(학생은) 문제 해결에 적합한 전략을 선택한다.",
        "(학생은) 알고리즘을 설계한다."
      ] },
    "9정03-05": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-05] 데이터를 순차적으로 저장할 수 있는 구조를 활용하여 문제 해결 프로그램을 작성한다.",
      sentences: [
        "(학생은) 데이터를 순차적으로 저장하는 구조를 활용한다.",
        "(학생은) 문제 해결 프로그램을 작성한다."
      ] },
    "9정03-06": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-06] 논리 연산과 중첩 제어 구조를 활용하여 문제를 해결하는 프로그램을 작성한다.",
      sentences: [
        "(학생은) 논리 연산을 활용한다.",
        "(학생은) 중첩 제어 구조를 활용한다.",
        "(학생은) 문제를 해결하는 프로그램을 작성한다."
      ] },
    "9정03-07": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-07] 프로그램 작성에서 함수를 활용하고, 프로그램 수행 결과를 디버거로 분석하여 오류를 수정한다.",
      sentences: [
        "(학생은) 프로그램 작성에서 함수를 활용한다.",
        "(학생은) 프로그램 수행 결과를 디버거로 분석한다.",
        "(학생은) 프로그램의 오류를 수정한다."
      ] },
    "9정03-08": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-08] 실생활의 문제를 탐색하여 발견하고, 프로그래밍을 통해 해결한다.",
      sentences: [
        "(학생은) 실생활의 문제를 탐색한다.",
        "(학생은) 문제를 발견한다.",
        "(학생은) 프로그래밍을 통해 문제를 해결한다."
      ] },
    "9정03-09": { area: "3. 알고리즘과 프로그래밍",
      text: "[9정03-09] 다양한 학문 분야의 문제 해결을 위해 협력하여 소프트웨어를 개발한다.",
      sentences: [
        "(학생들은) 다양한 학문 분야의 문제 해결을 위해 협력한다.",
        "(학생들은) 소프트웨어를 개발한다."
      ] },

    /* (4) 인공지능 — 원본 앱에서 그대로 물려받음 */
    "9정04-01": { area: "4. 인공지능",
      text: "[9정04-01] 인공지능의 개념과 특성을 설명하고 인공지능 소프트웨어를 구별한다.",
      sentences: [
        "(학생은) 인공지능의 개념을 설명한다.",
        "(학생은) 인공지능의 특성을 설명한다.",
        "(학생은) 인공지능 소프트웨어를 구별한다."
      ] },
    "9정04-02": { area: "4. 인공지능",
      text: "[9정04-02] 인공지능 학습에서 데이터의 중요성을 이해하고, 학습에 필요한 데이터를 수집하여 분류한다.",
      sentences: [
        "인공지능이 학습한다.",
        "(그 학습에서) 데이터가 중요하다.",
        "(학생은) 데이터의 중요성을 이해한다.",
        "학습에 데이터가 필요하다.",
        "(학생은) 데이터를 수집한다.",
        "(학생은) 데이터를 분류한다."
      ] },
    "9정04-03": { area: "4. 인공지능",
      text: "[9정04-03] 다양한 데이터를 활용하여 인공지능 시스템을 구성하고 적용한다.",
      sentences: [
        "(학생은) 다양한 데이터를 활용한다.",
        "(학생은) 인공지능 시스템을 구성한다.",
        "(학생은) 인공지능 시스템을 적용한다."
      ] },
    "9정04-04": { area: "4. 인공지능",
      text: "[9정04-04] 인공지능 시스템으로 해결 가능한 문제를 발견하고, 문제 해결에 적합한 인공지능 시스템을 적용한다.",
      sentences: [
        "인공지능 시스템으로 문제를 해결할 수 있다.",
        "(학생은) (그) 문제를 발견한다.",
        "문제 해결에 (어떤) 인공지능 시스템이 적합하다.",
        "(학생은) (그) 인공지능 시스템을 적용한다."
      ] },
    "9정04-05": { area: "4. 인공지능",
      text: "[9정04-05] 인공지능 학습에 필요한 데이터의 수집과 활용에서 발생하는 윤리적인 문제의 해결 방안을 구상한다.",
      sentences: [
        "인공지능 학습에 데이터가 필요하다.",
        "(학생은) (그) 데이터를 수집한다.",
        "(학생은) (그) 데이터를 활용한다.",
        "(데이터의 수집과 활용에서) 윤리적인 문제가 발생한다.",
        "(학생은) (그) 문제의 해결 방안을 구상한다."
      ] },

    /* (5) 디지털 문화 — 원본 앱에서 그대로 물려받음 (영역명은 2022 공식 명칭) */
    "9정05-01": { area: "5. 디지털 문화",
      text: "[9정05-01] 디지털 사회의 특성을 탐구하고, 사회 변화에 따른 직업의 변화를 탐구한다.",
      sentences: [
        "(학생은) 디지털 사회의 특성을 탐구한다.",
        "사회가 변화한다.",
        "(그 사회 변화에 따라) 직업이 변화한다.",
        "(학생은) 직업의 변화를 탐구한다."
      ] },
    "9정05-02": { area: "5. 디지털 문화",
      text: "[9정05-02] 디지털 사회의 구성원으로서 편리하고 안전한 생활을 위한 규칙에 대해 민주적으로 논의하고 실천 방안을 수립한다.",
      sentences: [
        "(학생은) 디지털 사회의 구성원이다.",
        "생활이 편리하다.",
        "생활이 안전하다.",
        "(학생은) 규칙에 대해 민주적으로 논의한다.",
        "(학생은) 실천 방안을 수립한다."
      ] },
    "9정05-03": { area: "5. 디지털 문화",
      text: "[9정05-03] 사례를 중심으로 디지털 공간에서 함께 살아가기 위해 개인 정보 및 권리와 저작권을 보호하는 실천 방법을 탐구한다.",
      sentences: [
        "(학생들은) 디지털 공간에서 함께 살아간다.",
        "(학생은) 개인 정보를 보호한다.",
        "(학생은) 권리를 보호한다.",
        "(학생은) 저작권을 보호한다.",
        "(학생은) 사례를 중심으로 실천 방법을 탐구한다."
      ] }
  };

  var BUILTIN_ORDER = Object.keys(BUILTIN);

  /* ---- 교사 편집본 (localStorage) ----
     { custom:{code:{area,text,sentences}}, hidden:[code], order:[code...] } */
  function loadStore() {
    try {
      var raw = global.localStorage.getItem(LS_KEY);
      if (!raw) return { custom: {}, hidden: [], order: [] };
      var o = JSON.parse(raw);
      return { custom: o.custom || {}, hidden: o.hidden || [], order: o.order || [] };
    } catch (e) { return { custom: {}, hidden: [], order: [] }; }
  }
  function saveStore(s) {
    try { global.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
    emit();
  }

  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ---- 조회 ---- */
  function merged() {
    var s = loadStore();
    var out = {};
    BUILTIN_ORDER.forEach(function (c) {
      if (s.hidden.indexOf(c) >= 0) return;
      out[c] = s.custom[c] ? assign(BUILTIN[c], s.custom[c]) : BUILTIN[c];
    });
    Object.keys(s.custom).forEach(function (c) {
      if (BUILTIN[c]) return;                 // 내장 수정본은 위에서 처리
      if (s.hidden.indexOf(c) >= 0) return;
      out[c] = s.custom[c];
    });
    return out;
  }
  function assign(a, b) {
    return {
      area: b.area || a.area,
      text: b.text != null ? b.text : a.text,
      sentences: b.sentences && b.sentences.length ? b.sentences.slice() : a.sentences.slice(),
      edited: true
    };
  }

  /* 화면용 목록 : [{code, area, text, sentences, isBuiltin, edited}] — 영역 순서 */
  function all() {
    var m = merged();
    var s = loadStore();
    var codes = Object.keys(m).sort(function (x, y) {
      var ax = m[x].area, ay = m[y].area;
      if (ax !== ay) return ax < ay ? -1 : 1;
      return x < y ? -1 : 1;
    });
    return codes.map(function (c) {
      return {
        code: c, area: m[c].area, text: m[c].text, sentences: m[c].sentences.slice(),
        isBuiltin: !!BUILTIN[c], edited: !!(s.custom[c])
      };
    });
  }
  function get(code) {
    var m = merged();
    return m[code] ? { code: code, area: m[code].area, text: m[code].text, sentences: m[code].sentences.slice() } : null;
  }

  /* ---- 편집 ---- */
  function put(code, obj) {
    if (!code) return "코드를 입력하세요.";
    code = code.trim();
    if (!obj.text || !obj.text.trim()) return "성취기준 문장을 입력하세요.";
    var sents = (obj.sentences || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (!sents.length) return "문장 분해를 한 줄 이상 입력하세요.";
    var s = loadStore();
    s.custom[code] = { area: (obj.area || "기타").trim(), text: obj.text.trim(), sentences: sents };
    var h = s.hidden.indexOf(code); if (h >= 0) s.hidden.splice(h, 1);   // 다시 보이게
    saveStore(s);
    return null;
  }
  function remove(code) {
    var s = loadStore();
    if (BUILTIN[code]) { if (s.hidden.indexOf(code) < 0) s.hidden.push(code); }
    else { delete s.custom[code]; }
    saveStore(s);
  }
  function restore(code) {
    var s = loadStore();
    var h = s.hidden.indexOf(code); if (h >= 0) s.hidden.splice(h, 1);
    if (BUILTIN[code]) delete s.custom[code];               // 내장은 원본으로 되돌림
    saveStore(s);
  }
  function isDirty(code) {
    var s = loadStore();
    return !!s.custom[code] || s.hidden.indexOf(code) >= 0;
  }

  /* ---- 문장 단위로 자동 나누기 (규칙 기반 · AI 아님) ---- */
  function autoSplit(text) {
    if (!text) return [];
    var t = text.replace(/^\s*\[[^\]]+\]\s*/, "").trim();     // 앞의 [9정..] 제거
    t = t.replace(/\.\s*$/, "");
    // 연결 어미·쉼표에서 자른다
    var parts = t.split(/\s*,\s*|\s+및\s+|\s+그리고\s+|(?<=하고)\s+|(?<=하며)\s+|(?<=하여)\s+/);
    var out = [];
    parts.forEach(function (p) {
      p = p.trim().replace(/(하고|하며|하여)$/, "");
      if (!p) return;
      // 종결형이 아니면 「~한다.」로 맞춤
      if (!/(다|다\.)$/.test(p)) {
        if (/[를을]$/.test(p) || /[가이]$/.test(p)) p += " 한다";
        else if (/한$/.test(p)) p += "다";
        else p += "한다";
      }
      p = p.replace(/\.?$/, ".");
      out.push("(학생은) " + p);
    });
    return out;
  }

  /* ---- JSON 반출입 ---- */
  function exportJSON() {
    var s = loadStore();
    return JSON.stringify({
      _설명: "수업 설계 도우미 · 성취기준 편집본. custom=추가/수정, hidden=숨김. 가져오기로 다른 PC·다른 교과와 공유.",
      version: 1, custom: s.custom, hidden: s.hidden
    }, null, 2);
  }
  function importJSON(text) {
    var o;
    try { o = JSON.parse(text); }
    catch (e) { return "JSON 형식이 아닙니다: " + e.message; }
    if (typeof o !== "object" || o == null) return "내용이 비어 있습니다.";
    if (!o.custom && !o.hidden) return "custom/hidden 항목이 없습니다. 이 앱이 내보낸 파일이 맞는지 확인하세요.";
    var custom = o.custom || {};
    if (typeof custom !== "object") return "custom 이 목록 형태가 아닙니다.";
    for (var k in custom) {
      if (!custom[k] || !custom[k].text || !Array.isArray(custom[k].sentences))
        return "'" + k + "' 항목에 text 또는 sentences 가 없습니다.";
    }
    var s = loadStore();
    // 병합 : 가져온 것이 이긴다
    for (var c in custom) s.custom[c] = {
      area: custom[c].area || "기타", text: String(custom[c].text),
      sentences: custom[c].sentences.map(String).filter(Boolean)
    };
    (o.hidden || []).forEach(function (h) { if (s.hidden.indexOf(h) < 0) s.hidden.push(h); });
    saveStore(s);
    return null;
  }

  global.Standards = {
    all: all, get: get, put: put, remove: remove, restore: restore,
    isDirty: isDirty, autoSplit: autoSplit,
    exportJSON: exportJSON, importJSON: importJSON, onChange: onChange,
    BUILTIN_CODES: BUILTIN_ORDER.slice()
  };
})(window);
