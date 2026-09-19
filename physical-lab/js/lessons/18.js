/* 18차시 · 자전거 속도계 (홀 자기 센서 + 자석) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[18] = {
    n: 18, area: "D", title: "자전거 속도계", part: "홀 자기 센서 + 자석",
    goal: [
      "바퀴에 자석을 붙이면 한 바퀴 돌 때마다 홀 센서가 `1` 을 낸다",
      "**1분 동안의 회전 수(RPM)** 를 세면 속도를 계산할 수 있다",
      "속도 = 바퀴 둘레 × 회전 수 — 센서 값을 «뜻 있는 수» 로 바꾸는 것"
    ],
    life: [
      { ic: "🚲", lt: "자전거 속도계", ld: "바퀴의 자석을 홀 센서로 센다" },
      { ic: "🌀", lt: "선풍기 회전수(RPM)", ld: "모터가 얼마나 빨리 도는지" },
      { ic: "🚗", lt: "자동차 속도계", ld: "바퀴 회전을 재서 km/h 로" }
    ],
    bench: {
      type: "analog-level",
      sensor: { name: "1분당 회전수", min: 0, max: 300, val: 60, lowLabel: "정지", highLabel: "빠름" },
      thresh: { val: 200, label: "이보다 빠르면 «과속» 경고", dir: "above" },
      output: { name: "속도 표시", onText: "과속! (천천히)", offText: "정상" },
      real: {
        real: "자석이 센서 앞을 지날 때만 순간적으로 반응합니다. 자석 방향(N/S)이 맞아야 잘 잡힙니다.",
        sim: "손잡이로 회전수를 바꿔 보며 속도 계산과 «과속» 판단을 확인합니다."
      }
    },
    connect: {
      t: "자전거 속도계 — 홀 자기 센서 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: [],
      parts: [{ id: "hall", pin: { S: 0 } }]
    },
    code: {
      makecode: [
        ["input", "핀 P0 이 눌림(자석 지나감) 이벤트일 때"],
        ["var", "  회전수 를 1 만큼 증가"],
        ["loop", "매 (1) 초마다"],
        ["var", "  RPM 을 (회전수 × 60) 으로 정하기  ·  회전수 를 0 으로"],
        ["basic", "  수 표시 ( RPM )"]
      ],
      entry: [
        ["input", "만약 <디지털 P0 번 센서값 = 1> 이라면"],
        ["var", "  회전수 에 1 더하기"],
        ["loop", "  (1) 초 기다리기"],
        ["var", "  RPM 을 (회전수 × 60) 으로 정하기"],
        ["basic", "  LED 화면에 (RPM) 나타내기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "홀 센서가 «1» 을 내는 때는?", type: "choice",
        opts: ["자석이 앞을 지날 때", "빛이 밝을 때", "소리가 클 때", "온도가 높을 때"], a: 0,
        why: "자기장을 감지하는 센서입니다." },
      { q: "1분당 회전수를 무엇이라고 하나요? (영어 약자)", type: "fill",
        a: ["RPM", "rpm", "r.p.m"], ph: "약자",
        why: "Revolutions Per Minute — 분당 회전수." },
      { q: "10초 동안 20바퀴 돌았다면 RPM 은?", type: "choice",
        opts: ["20", "60", "120", "200"], a: 2,
        why: "10초에 20바퀴면 1분(60초)에는 120바퀴입니다." },
      { q: "센서 값을 «속도» 로 바꾸려면 무엇을 더 알아야 하나요?", type: "choice",
        opts: ["바퀴의 둘레(길이)", "센서 색깔", "전압", "밝기"], a: 0,
        why: "한 바퀴 = 바퀴 둘레만큼 이동. 둘레 × 회전수 = 이동 거리." }
    ],
    jump: {
      body: "<b>미션.</b> RPM 과 바퀴 둘레를 입력해 <b>km/h</b> 로 표시하고, 최고 속도를 기억했다가 " +
        "멈추면 보여 주는 «내 라이딩 기록계» 를 만들어 보자.",
      hint: "속도 = 둘레(m) × RPM × 60 ÷ 1000 (km/h). 최고값은 `if 속도 > 최고 then 최고 = 속도`."
    },
    studio: { hint: "예) km/h 로 바꿨다 / 최고 속도를 기록했다 / 과속 기준을 바꿨다" }
  };
})();
