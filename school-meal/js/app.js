/**
 * 학교 급식 알리미 — 화면
 *
 * 하는 일 :
 *   ① 기억해 둔 학교(또는 주소의 ?school=…)를 찾아 연다
 *   ② 그 주(월~금) 중식을 NEIS 에서 받아 다섯 칸으로 그린다
 *   ③ 컴퓨터 날짜로 «오늘» 칸을 굵게 강조한다
 *   ④ 주 단위로 앞뒤로 옮기고, 달력으로 아무 날이나 간다
 */

(function () {
  "use strict";

  var D = window.DateUtil;
  var A = window.Allergy;

  var 설정열쇠 = "school-meal.설정";

  var 상태 = {
    학교: null,
    주: null,               // 그 주 월요일
    알레르기: true,
    크게: false,
    간단: false,            // ?embed=1 — 학교 홈페이지에 끼워 넣기
    차례: 0,                // 늦게 도착한 응답을 버리려는 번호
  };

  // ── 자잘한 도구 ────────────────────────────────────────────────

  function ㄱ(id) { return document.getElementById(id); }

  function 비우기(칸) { while (칸.firstChild) 칸.removeChild(칸.firstChild); }

  function 만들기(태그, 클래스, 글) {
    var e = document.createElement(태그);
    if (클래스) e.className = 클래스;
    if (글 != null) e.textContent = 글;
    return e;
  }

  var 쪽지시계 = null;
  function 쪽지(글) {
    var 칸 = ㄱ("쪽지");
    칸.textContent = 글;
    칸.hidden = false;
    clearTimeout(쪽지시계);
    쪽지시계 = setTimeout(function () { 칸.hidden = true; }, 2600);
  }

  function 설정읽기() {
    try {
      var 것 = JSON.parse(localStorage.getItem(설정열쇠) || "{}");
      if (typeof 것.알레르기 === "boolean") 상태.알레르기 = 것.알레르기;
      if (typeof 것.크게 === "boolean") 상태.크게 = 것.크게;
    } catch (e) { /* 기본값으로 */ }
  }

  function 설정쓰기() {
    try {
      localStorage.setItem(설정열쇠, JSON.stringify({
        알레르기: 상태.알레르기, 크게: 상태.크게,
      }));
    } catch (e) { /* 저장 못 해도 그만 */ }
  }

  // ── 급식 다섯 칸 그리기 ────────────────────────────────────────

  /** 한 날의 칸 하나 */
  function 날칸(날, 한끼, 오늘인가) {
    var 칸 = 만들기("article", "날" + (오늘인가 ? " 오늘" : ""));

    var 머리 = 만들기("div", "날머리");
    머리.appendChild(만들기("span", "요일 요일" + D.요일(날), D.요일(날)));
    머리.appendChild(만들기("span", "일자", (날.getMonth() + 1) + "/" + 날.getDate()));
    if (오늘인가) 머리.appendChild(만들기("span", "오늘배지", "오늘"));
    칸.appendChild(머리);

    if (!한끼 || !한끼.메뉴 || !한끼.메뉴.length) {
      칸.appendChild(만들기("p", "없는날", "급식이 없는 날입니다"));
      return 칸;
    }

    var 목록 = 만들기("ul", "메뉴");
    한끼.메뉴.forEach(function (m) {
      var 줄 = 만들기("li");
      줄.appendChild(만들기("span", "메뉴이름", m.이름));
      if (m.번호 && m.번호.length) {
        // 🔴 알레르기는 «숨김» 이지 «없앰» 이 아니다.
        //    토글을 꺼도 자료는 그대로 두고 보이기만 감춘다.
        var 알 = 만들기("span", "알레르기", A.이름들(m.번호));
        알.hidden = !상태.알레르기;
        줄.appendChild(알);
      }
      목록.appendChild(줄);
    });
    칸.appendChild(목록);

    var 아래 = 만들기("div", "날아래");

    if (한끼.칼로리) 아래.appendChild(만들기("span", "칼로리", 한끼.칼로리));

    if (한끼.영양 && 한끼.영양.length) {
      var 접기 = 만들기("details", "영양");
      접기.appendChild(만들기("summary", null, "영양정보"));
      var 표 = 만들기("dl", "영양표");
      한끼.영양.forEach(function (n) {
        표.appendChild(만들기("dt", null, n.이름));
        표.appendChild(만들기("dd", null, n.값));
      });
      접기.appendChild(표);
      아래.appendChild(접기);
    }

    if (아래.childNodes.length) 칸.appendChild(아래);
    return 칸;
  }

  /** 다섯 칸을 다시 그린다 */
  function 식단그리기(끼니) {
    var 칸들 = ㄱ("칸들");
    비우기(칸들);

    var 오늘 = D.오늘();
    var 오늘보임 = D.주안에(상태.주, 오늘);
    var 있는날 = 0;

    D.평일들(상태.주).forEach(function (날) {
      var ymd = D.ymd(날);
      var 한끼 = 끼니 && 끼니[ymd];
      if (한끼 && 한끼.메뉴 && 한끼.메뉴.length) 있는날++;
      칸들.appendChild(날칸(날, 한끼, 오늘보임 && D.같은날(날, 오늘)));
    });

    칸들.hidden = false;

    // 다섯 칸이 세로로 쌓이는 좁은 화면(휴대폰)에서는 «오늘» 이 화면 밖에 있기 쉽다.
    // 열자마자 오늘 칸이 보이도록 옮겨 준다 — 이 앱을 여는 가장 흔한 까닭이
    // «오늘 뭐 먹지» 이기 때문이다.
    오늘칸보이기();
    // 🔴 글꼴이 뒤늦게 바뀌면 칸 높이가 몇 픽셀 늘어나 첫 셈이 모자란다
    //    (실제로 18px 모자라 오늘 칸 아래가 잘렸다).
    //    자리가 굳은 뒤 한 번 더 맞춘다. 이미 보이면 아무 일도 하지 않으므로
    //    여러 번 불러도 해롭지 않다.
    //    ⚠ requestAnimationFrame 을 쓰지 않는다 — 이 프로젝트의 미리보기 창은
    //      프레임을 그리지 않아 rAF 가 한 번도 돌지 않는다.
    setTimeout(오늘칸보이기, 0);
    setTimeout(오늘칸보이기, 250);

    return 있는날;
  }

  /** 오늘 칸이 식단 칸 밖에 있으면 그 자리로 옮긴다 */
  function 오늘칸보이기() {
    var 식단 = ㄱ("식단");
    var 오늘칸 = document.querySelector(".날.오늘");
    if (!오늘칸) { 식단.scrollTop = 0; return; }

    var 칸자리 = 오늘칸.getBoundingClientRect();
    var 통자리 = 식단.getBoundingClientRect();
    if (칸자리.top >= 통자리.top - 1 && 칸자리.bottom <= 통자리.bottom + 1) return; // 이미 보인다

    // 위에 약간 여유를 두어 «잘린 것처럼» 보이지 않게 한다.
    // 넘치면 브라우저가 알아서 끝까지만 움직인다.
    식단.scrollTop += 칸자리.top - 통자리.top - 8;
  }

  // ── 불러오기 ───────────────────────────────────────────────────

  function 알림보이기(글, 갈래) {
    var 칸 = ㄱ("알림");
    칸.textContent = 글;
    칸.className = "알림" + (갈래 ? " " + 갈래 : "");
    칸.hidden = false;
  }

  function 알림감추기() { ㄱ("알림").hidden = true; }

  /**
   * 인쇄물 머리·꼬리를 채운다.
   * 종이는 교실 벽에 «일주일 내내» 붙어 있으므로 어느 학교의 어느 주인지가
   * 멀리서도 읽혀야 한다. 화면 머리말은 인쇄에서 숨기고 이것이 대신 나온다.
   */
  function 인쇄머리채우기() {
    var 월 = 상태.주;
    var 금 = D.날더하기(월, 4);
    ㄱ("인쇄학교").textContent = 상태.학교 ? 상태.학교.이름 : "";
    ㄱ("인쇄주").textContent = D.짧게(월) + " ~ " + D.짧게(금);
    var 오 = D.오늘();
    ㄱ("인쇄날짜").textContent =
      " · " + 오.getFullYear() + ". " + (오.getMonth() + 1) + ". " + 오.getDate() + " 뽑음";
  }

  function 급식불러오기() {
    if (!상태.학교 || !상태.주) return;

    var 내차례 = ++상태.차례;
    ㄱ("주이름").textContent = D.주이름(상태.주);
    인쇄머리채우기();
    ㄱ("이번주").hidden = D.같은날(상태.주, D.처음볼주());
    ㄱ("날짜고르기").value = D.입력값(상태.주);

    ㄱ("칸들").hidden = true;
    알림보이기("급식을 불러오는 중입니다…", "기다림");

    window.Neis.주간급식(상태.학교.시도, 상태.학교.코드, 상태.주)
      .then(function (답) {
        if (내차례 !== 상태.차례) return;   // 그 사이 다른 주로 옮겼다

        var 있는날 = 식단그리기(답.끼니);

        if (!답.ok) {
          // 🔴 실패해도 저장해 둔 것이 있으면 그것을 보여 준다.
          //    급식실 앞에서 «오류» 만 보는 것보다 낫다.
          알림보이기(답.안내 + (있는날 ? " (저장해 둔 자료를 보여 드립니다)" : ""), "탈남");
          if (!있는날) ㄱ("칸들").hidden = true;
        } else if (!있는날) {
          알림보이기(
            "이 주에는 등록된 급식이 없습니다. 방학·휴업일이거나 아직 올라오지 않았을 수 있습니다.",
            "빔"
          );
        } else {
          알림감추기();
        }

        ㄱ("꼬리오른쪽").textContent =
          답.출처 === "캐시" ? "저장해 둔 자료" : "방금 불러옴";
      });
  }

  // ── 주 옮기기 ──────────────────────────────────────────────────

  function 주옮기기(새주) {
    상태.주 = 새주;
    급식불러오기();
  }

  // ── 학교 ───────────────────────────────────────────────────────

  function 학교정하기(학교, 기억할까) {
    상태.학교 = 학교;
    ㄱ("학교이름").textContent = 학교.이름;
    document.title = 학교.이름 + " 급식 — 학교 급식 알리미";
    if (기억할까 !== false) window.School.기억하기(학교);
    if (!상태.주) 상태.주 = D.처음볼주();
    급식불러오기();
  }

  // ── 학교 고르기 화면 ───────────────────────────────────────────

  var 고르기 = {
    전국받는중: false,

    열기: function (닫을수있나) {
      ㄱ("고르기덮개").hidden = false;
      ㄱ("고르기닫기").hidden = !닫을수있나;
      ㄱ("주소복사").hidden = !상태.학교;
      // 지금 학교의 지역을 미리 골라 둔다 — 대개 같은 지역을 다시 고른다.
      if (상태.학교 && !ㄱ("시도고르기").value) {
        ㄱ("시도고르기").value = 상태.학교.시도;
        고르기.시도바뀜();
      }
      setTimeout(function () {
        var 칸 = ㄱ("이름찾기");
        if (!칸.disabled) 칸.focus();
        else ㄱ("시도고르기").focus();
      }, 30);
    },

    닫기: function () { ㄱ("고르기덮개").hidden = true; },

    안내: function (글) { ㄱ("고르기안내").textContent = 글; },

    시도바뀜: function () {
      var 시도 = ㄱ("시도고르기").value;
      var 찾기칸 = ㄱ("이름찾기");
      if (!시도) {
        찾기칸.disabled = true;
        고르기.안내("먼저 지역을 골라 주세요.");
        비우기(ㄱ("찾은것"));
        return;
      }
      고르기.안내("학교 목록을 불러오는 중입니다…");
      찾기칸.disabled = true;
      window.School.불러오기(시도).then(function (목록) {
        찾기칸.disabled = false;
        찾기칸.focus();
        고르기.안내(window.School.교육청이름[시도] + " 학교 " +
                    목록.length.toLocaleString("ko") + "곳. 학교 이름을 쳐 보세요.");
        고르기.찾기();
      })["catch"](function (e) {
        // 더블클릭(file://)으로 열었을 때 브라우저가 이웃 파일을 막는 경우가 있다.
        // 그때는 «왜 안 되는지» 를 몰라 헤매므로 길을 함께 알려 준다.
        var 덧말 = (location.protocol === "file:")
          ? " 더블클릭으로 여신 경우 브라우저가 막았을 수 있습니다. 「로컬서버_실행.bat」 으로 열어 보세요."
          : "";
        고르기.안내("학교 목록을 불러오지 못했습니다. " + e.message + 덧말);
        비우기(ㄱ("찾은것"));
      });
    },

    전국: function () {
      if (고르기.전국받는중) return;
      고르기.전국받는중 = true;
      고르기.안내("전국 학교 목록을 불러오는 중입니다… (조금 걸립니다)");
      window.School.전국불러오기().then(function () {
        고르기.전국받는중 = false;
        ㄱ("시도고르기").value = "";
        ㄱ("이름찾기").disabled = false;
        ㄱ("이름찾기").focus();
        고르기.안내("전국에서 찾습니다. 학교 이름을 쳐 보세요.");
        고르기.찾기();
      })["catch"](function (e) {
        고르기.전국받는중 = false;
        고르기.안내("전국 목록을 불러오지 못했습니다. " + e.message);
      });
    },

    찾기: function () {
      var 말 = ㄱ("이름찾기").value;
      var 시도 = ㄱ("시도고르기").value || null;
      var 통 = ㄱ("찾은것");
      비우기(통);

      // 지역 전체(수천 곳)를 다 늘어놓으면 아무 도움이 안 된다.
      if (!말.trim() && !시도) return;

      var 것들 = window.School.찾기(말, 시도, 60);
      if (!것들.length) {
        통.appendChild(만들기("li", "찾은것없음", "찾는 학교가 없습니다. 이름을 조금 다르게 쳐 보세요."));
        return;
      }

      것들.forEach(function (s) {
        var 줄 = 만들기("li");
        var 단추 = 만들기("button", "학교줄");
        단추.type = "button";
        단추.appendChild(만들기("span", "찾은이름", s.이름));
        단추.appendChild(만들기("span", "찾은곳", [s.시도이름, s.지역].filter(Boolean).join(" ")));
        단추.addEventListener("click", function () {
          학교정하기(s);
          고르기.닫기();
          쪽지(s.이름 + " 급식을 보여 드립니다. 다음부터 저절로 열립니다.");
        });
        줄.appendChild(단추);
        통.appendChild(줄);
      });
    },
  };

  // ── 켜기 ───────────────────────────────────────────────────────

  function 단추들붙이기() {
    ㄱ("지난주").addEventListener("click", function () {
      주옮기기(D.주더하기(상태.주, -1));
    });
    ㄱ("다음주").addEventListener("click", function () {
      주옮기기(D.주더하기(상태.주, 1));
    });
    ㄱ("이번주").addEventListener("click", function () {
      주옮기기(D.처음볼주());
    });

    // 🔴 날짜·글 입력칸은 input 과 change 를 둘 다 듣는다.
    //    change 만 들으면 «쳤는데 안 바뀐다»(다른 곳을 눌러야 바뀐다)가 된다.
    var 날짜칸 = ㄱ("날짜고르기");
    function 날짜바뀜() {
      var 날 = D.입력값읽기(날짜칸.value);
      if (!날) return;
      var 새주 = D.주시작(날);
      if (!D.같은날(새주, 상태.주)) 주옮기기(새주);
    }
    날짜칸.addEventListener("input", 날짜바뀜);
    날짜칸.addEventListener("change", 날짜바뀜);

    ㄱ("학교단추").addEventListener("click", function () { 고르기.열기(true); });
    ㄱ("고르기닫기").addEventListener("click", 고르기.닫기);
    ㄱ("전국찾기").addEventListener("click", 고르기.전국);

    ㄱ("시도고르기").addEventListener("change", 고르기.시도바뀜);

    var 찾기칸 = ㄱ("이름찾기");
    찾기칸.addEventListener("input", 고르기.찾기);
    찾기칸.addEventListener("change", 고르기.찾기);

    ㄱ("주소복사").addEventListener("click", function () {
      var 주소 = window.School.주소만들기(상태.학교);
      function 알림() { 쪽지("주소를 복사했습니다. 이 주소로 열면 학교를 고르지 않아도 됩니다."); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(주소).then(알림, function () { window.prompt("이 주소를 복사하세요", 주소); });
      } else {
        window.prompt("이 주소를 복사하세요", 주소);
      }
    });

    ㄱ("알레르기토글").addEventListener("click", function () {
      상태.알레르기 = !상태.알레르기;
      this.setAttribute("aria-pressed", String(상태.알레르기));
      Array.prototype.forEach.call(
        document.querySelectorAll(".알레르기"),
        function (e) { e.hidden = !상태.알레르기; }
      );
      설정쓰기();
    });

    ㄱ("크게토글").addEventListener("click", function () {
      상태.크게 = !상태.크게;
      this.setAttribute("aria-pressed", String(상태.크게));
      document.body.classList.toggle("크게", 상태.크게);
      설정쓰기();
    });

    ㄱ("인쇄단추").addEventListener("click", function () { window.print(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !ㄱ("고르기덮개").hidden && !ㄱ("고르기닫기").hidden) {
        고르기.닫기();
      }
    });
  }

  function 시도채우기() {
    var 고름 = ㄱ("시도고르기");
    window.School.교육청.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p[0];
      o.textContent = p[1];
      고름.appendChild(o);
    });
  }

  function 시작() {
    설정읽기();
    if (상태.크게) document.body.classList.add("크게");
    ㄱ("알레르기토글").setAttribute("aria-pressed", String(상태.알레르기));
    ㄱ("크게토글").setAttribute("aria-pressed", String(상태.크게));

    상태.간단 = window.School.간단보기();
    if (상태.간단) document.body.classList.add("간단");

    시도채우기();
    단추들붙이기();
    상태.주 = D.처음볼주();

    // ① 주소에 학교가 적혀 있으면 그것이 먼저다(영양사님이 보낸 링크).
    //    이때는 기억하지 않는다 — 남의 학교 링크를 한 번 열었다고
    //    그 사람의 «내 학교» 가 바뀌면 안 된다.
    var 주소학교 = window.School.주소읽기();
    if (주소학교) {
      window.School.불러오기(주소학교.시도).then(function () {
        var 찾은것 = window.School.하나찾기(주소학교.시도, 주소학교.코드);
        if (찾은것) {
          학교정하기(찾은것, false);
        } else {
          // 목록에 없는 학교라도 코드가 있으니 급식은 부를 수 있다.
          학교정하기({
            시도: 주소학교.시도, 코드: 주소학교.코드,
            이름: "학교 " + 주소학교.코드, 지역: "", 종류: "",
          }, false);
        }
      })["catch"](function () {
        학교정하기({
          시도: 주소학교.시도, 코드: 주소학교.코드,
          이름: "학교 " + 주소학교.코드, 지역: "", 종류: "",
        }, false);
      });
      return;
    }

    // ② 기억해 둔 학교
    var 기억한것 = window.School.기억();
    if (기억한것) {
      학교정하기({
        시도: 기억한것.시도, 코드: 기억한것.코드, 이름: 기억한것.이름,
        지역: 기억한것.지역 || "", 종류: 기억한것.종류 || "",
      }, false);
      return;
    }

    // ③ 처음 오는 사람 — 학교를 고르게 한다
    알림보이기("학교를 골라 주세요.", "빔");
    ㄱ("주이름").textContent = D.주이름(상태.주);
    고르기.열기(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", 시작);
  } else {
    시작();
  }
})();
