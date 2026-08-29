/* 17차시 · 후방 주차 센서 (초음파 센서) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[17] = {
    n: 17, area: "D", title: "후방 주차 센서", part: "초음파 센서(HC-SR04)",
    goal: [
      "초음파 센서는 소리를 **보내고(Trig) 돌아온 시간(Echo)** 을 재어 거리를 구한다",
      "거리에 따라 «안전 / 주의 / 위험» 을 나누고, 가까울수록 경고음을 빠르게 한다",
      "신호선이 **두 개**(Trig·Echo)이고 5V·확장프로그램 `SONAR` 가 필요하다"
    ],
    life: [
      { ic: "🚗", lt: "자동차 후방센서", ld: "가까울수록 «삐-삐-삐» 가 빨라진다" },
      { ic: "🤖", lt: "로봇청소기", ld: "벽·가구를 만나면 방향을 바꾼다" },
      { ic: "📏", lt: "비접촉 거리·키 재기", ld: "닿지 않고 거리를 잰다" }
    ],
    bench: {
      type: "analog-level",
      sensor: { name: "거리(cm)", min: 2, max: 200, val: 120, lowLabel: "코앞", highLabel: "멀다" },
      thresh: { val: 30, label: "이보다 가까우면 경고", dir: "below" },
      output: { name: "경고음", onText: "삐-삐-삐 (가까울수록 빠름)", offText: "조용" },
      real: {
        real: "소리가 왕복하는 데 걸린 시간으로 거리를 계산합니다. 부드러운 물체·비스듬한 면은 잘 안 잡힙니다.",
        sim: "손잡이로 거리를 바꿔 보며, 어느 거리부터 경고할지 정합니다."
      }
    },
    connect: {
      t: "후방 주차 센서 — 초음파 연결", v1: "3V3", v2: "3V3", usb: true, color: true, ext: ["SONAR"],
      parts: [{ id: "hcsr04", pin: { Trig: 1, Echo: 2 } }]
    },
    code: {
      makecode: [
        ["note", "확장프로그램 «SONAR» 추가 · 전원은 5V 단자"],
        ["loop", "무한 반복"],
        ["var", "  거리 를 ( 초음파 거리 cm (Trig P1, Echo P2) ) 로 정하기"],
        ["logic", "  만약 <거리 < 30> 이면"],
        ["music", "    음 재생 (도)  ·  일시정지 ( map(거리, 0,30, 100,600) ) ms"],
        ["logic", "  아니면"],
        ["basic", "    화면 지우기"]
      ],
      entry: [
        ["loop", "계속 반복하기"],
        ["var", "  거리 를 (P1 Trig, P2 Echo 초음파 거리) 로 정하기"],
        ["logic", "  만약 <거리 < 30> 이라면"],
        ["music", "    비프음 재생하기"],
        ["loop", "    (거리 / 100) 초 기다리기"],
        ["logic", "  아니면"],
        ["basic", "    LED 화면 모두 지우기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "초음파 센서가 거리를 재는 원리는?", type: "choice",
        opts: ["빛의 밝기로", "소리를 보내고 돌아온 시간을 재서", "온도로", "무게로"], a: 1,
        why: "Trig 로 소리를 보내고 Echo 로 돌아온 시간을 재어 거리로 바꿉니다." },
      { q: "초음파 센서의 신호선은 몇 개인가요?", type: "choice",
        opts: ["1개", "2개(Trig, Echo)", "3개", "0개"], a: 1,
        why: "보내는 Trig, 받는 Echo 두 개입니다." },
      { q: "메이크코드에서 필요한 확장프로그램 이름은?", type: "fill",
        a: ["SONAR", "sonar", "Sonar"], ph: "이름",
        why: "«SONAR» 를 추가해야 초음파 거리 블록이 나옵니다." },
      { q: "가까울수록 경고음을 빠르게 하려면 무엇을 짧게 하나요?", type: "choice",
        opts: ["일시정지(기다리는 시간)", "핀 번호", "전압", "화면 밝기"], a: 0,
        why: "소리 사이의 일시정지를 짧게 하면 «삐삐삐» 가 빨라집니다. map 으로 거리에 비례시킵니다." }
    ],
    jump: {
      body: "<b>미션.</b> 거리를 3구간(멀다·가깝다·위험)으로 나눠 <b>RGB LED 색</b>(초록·노랑·빨강)으로도 보여 주고, " +
        "10cm 안이면 서보로 «정지 표지판» 을 세우는 주차 보조 장치를 만들어 보자.",
      hint: "거리 구간마다 다른 색·다른 경고음 간격. 위험 구간에서만 서보를 움직인다."
    },
    studio: { hint: "예) 경고 거리를 20cm 로 바꿨다 / RGB 색으로도 표시했다 / 위험 시 서보를 움직였다" }
  };
})();
