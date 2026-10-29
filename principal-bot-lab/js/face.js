/* =========================================================
   face.js — 가상 교장선생님 그림(SVG · 사진 아님 · 실존 인물 아님)
   체육 선생님 출신이라 트레이닝복에 호루라기. 표정 6가지 :
   normal · smile · proud · think · serious · panic(당황 — 땀, 큰 입)
   ========================================================= */
(function (root) {
  "use strict";
  var SKIN = "#f1c6a0", LINE = "#5b3a26", HAIR = "#9ca3af";

  function brows(face) {
    if (face === "panic") return '<path d="M62 70 L84 62" /><path d="M138 70 L116 62" />';
    if (face === "serious") return '<path d="M62 64 L86 70" /><path d="M138 64 L114 70" />';
    if (face === "think") return '<path d="M62 66 Q73 60 86 66" /><path d="M116 62 L138 60" />';
    return '<path d="M62 66 Q74 58 86 64" /><path d="M114 64 Q126 58 138 66" />';
  }
  function eyes(face) {
    if (face === "smile" || face === "proud") return '<path d="M66 86 Q74 79 82 86" /><path d="M118 86 Q126 79 134 86" />';
    if (face === "panic") return '<circle cx="74" cy="85" r="5.5" fill="#fff"/><circle cx="74" cy="85" r="2.5" fill="' + LINE + '"/>' +
                                 '<circle cx="126" cy="85" r="5.5" fill="#fff"/><circle cx="126" cy="85" r="2.5" fill="' + LINE + '"/>';
    if (face === "think") return '<circle cx="76" cy="84" r="3.5" fill="' + LINE + '"/><circle cx="128" cy="82" r="3.5" fill="' + LINE + '"/>';
    return '<circle cx="74" cy="85" r="3.5" fill="' + LINE + '"/><circle cx="126" cy="85" r="3.5" fill="' + LINE + '"/>';
  }
  function mouth(face) {
    switch (face) {
      case "smile": return '<path d="M82 124 Q100 140 118 124" fill="#b4473c" />';
      case "proud": return '<path d="M80 122 Q100 144 120 122 Z" fill="#b4473c" /><path d="M86 124 L114 124" stroke="#fff" stroke-width="3"/>';
      case "panic": return '<ellipse cx="100" cy="130" rx="13" ry="11" fill="#7f1d1d" />';
      case "serious": return '<path d="M86 128 L114 128" />';
      case "think": return '<path d="M86 130 Q96 124 112 128" />';
      default: return '<path d="M86 126 Q100 134 114 126" />';
    }
  }

  function svg(face) {
    face = face || "normal";
    var blush = (face === "smile" || face === "proud") ? '<ellipse cx="62" cy="108" rx="9" ry="5" fill="#f87171" opacity=".45"/><ellipse cx="138" cy="108" rx="9" ry="5" fill="#f87171" opacity=".45"/>' : "";
    var sweat = face === "panic" ? '<path d="M150 52 Q158 66 150 72 Q142 66 150 52 Z" fill="#7dd3fc" stroke="#0284c7" stroke-width="1.5"/>' +
                                   '<path d="M44 60 Q50 71 44 76 Q38 71 44 60 Z" fill="#7dd3fc" stroke="#0284c7" stroke-width="1.5"/>' : "";
    var bubble = face === "think" ? '<circle cx="168" cy="34" r="6" fill="#e5e7eb"/><circle cx="182" cy="18" r="9" fill="#e5e7eb"/>' : "";
    return '<svg class="pb-face" viewBox="0 0 200 220" role="img" aria-label="가상 교장선생님 캐릭터">' +
      /* 트레이닝복과 호루라기 */
      '<path d="M18 220 Q22 168 64 158 L136 158 Q178 168 182 220 Z" fill="#1e3a8a"/>' +
      '<path d="M40 220 L52 166" stroke="#fff" stroke-width="5"/><path d="M160 220 L148 166" stroke="#fff" stroke-width="5"/>' +
      '<path d="M78 158 L100 186 L122 158" fill="#fff"/>' +
      '<path d="M84 160 Q100 200 116 160" fill="none" stroke="#f59e0b" stroke-width="2.5"/>' +
      '<rect x="92" y="190" width="18" height="11" rx="4" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>' +
      /* 목·귀·얼굴 */
      '<rect x="84" y="140" width="32" height="24" fill="' + SKIN + '"/>' +
      '<ellipse cx="36" cy="94" rx="9" ry="14" fill="' + SKIN + '" stroke="' + LINE + '" stroke-width="2"/>' +
      '<ellipse cx="164" cy="94" rx="9" ry="14" fill="' + SKIN + '" stroke="' + LINE + '" stroke-width="2"/>' +
      '<ellipse cx="100" cy="92" rx="64" ry="66" fill="' + SKIN + '" stroke="' + LINE + '" stroke-width="2.5"/>' +
      /* 옆머리(희끗) · 반짝이는 정수리 */
      '<path d="M38 96 Q34 54 58 40 Q48 64 50 96 Z" fill="' + HAIR + '"/>' +
      '<path d="M162 96 Q166 54 142 40 Q152 64 150 96 Z" fill="' + HAIR + '"/>' +
      '<ellipse cx="86" cy="40" rx="16" ry="7" fill="#fff" opacity=".55" transform="rotate(-18 86 40)"/>' +
      /* 안경 */
      '<g fill="none" stroke="#1f2937" stroke-width="3">' +
        '<rect x="56" y="72" width="38" height="28" rx="9"/><rect x="106" y="72" width="38" height="28" rx="9"/>' +
        '<path d="M94 84 L106 84"/></g>' +
      '<g fill="none" stroke="' + LINE + '" stroke-width="3.5" stroke-linecap="round">' + brows(face) + eyes(face) + '</g>' +
      '<path d="M100 92 Q94 108 102 112" fill="none" stroke="' + LINE + '" stroke-width="2.5" stroke-linecap="round"/>' +
      blush +
      '<g fill="none" stroke="' + LINE + '" stroke-width="3.5" stroke-linecap="round">' + mouth(face) + '</g>' +
      sweat + bubble + '</svg>';
  }

  var api = { svg: svg, FACES: ["normal", "smile", "proud", "think", "serious", "panic"] };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PBFace = api;
})(typeof window !== "undefined" ? window : this);
