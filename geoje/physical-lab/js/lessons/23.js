/* 23차시 · 멀리서 알림 받기 (micro:bit radio + 블루투스 HC-06) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[23] = {
    n: 23, area: "E", title: "멀리서 알림 받기", part: "micro:bit 무선(radio) + 블루투스(HC-06)",
    goal: [
      "**radio** 는 마이크로비트끼리 «그룹 번호» 를 맞추면 서로 메시지를 주고받는다 (배선 없음)",
      "**블루투스(HC-06)** 는 휴대전화로 값을 보낸다 — `TXD`↔`RXD` 를 **엇갈려** 연결",
      "센서에서 읽은 값을 멀리 있는 사람에게 전달한다"
    ],
    life: [
      { ic: "📻", lt: "무전기", ld: "같은 채널이면 서로 통신" },
      { ic: "🔔", lt: "무선 초인종", ld: "현관 버튼 → 방 안 수신기" },
      { ic: "⌚", lt: "스마트워치 → 폰", ld: "블루투스로 걸음·심박 전송" }
    ],
    bench: {
      type: "digital-presence",
      hold: { min: 0, max: 5, val: 1, step: 0.5, unit: "초", label: "알림을 띄울 시간" },
      outputs: [{ k: "voice", name: "수신 알림" }, { k: "led", name: "알림 LED" }],
      real: {
        real: "radio 는 그룹 번호가 같아야 서로 들립니다(옆 모둠과 섞이면 그룹을 바꿉니다). HC-06 은 폰과 «페어링» 후 앱으로 값을 봅니다.",
        sim: "«구역 안» = 다른 마이크로비트가 메시지를 보냄, «구역 밖» = 조용 으로 생각합니다."
      }
    },
    connect: {
      t: "멀리서 알림 받기 — 블루투스(HC-06) 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: [],
      parts: [{ id: "hc06", pin: { TXD: 0, RXD: 1 } }]
    },
    code: {
      makecode: [
        ["note", "두 대 모두 «무선 그룹 설정 (1)». 아래는 «보내는 쪽»."],
        ["input", "버튼 A 눌렸을 때"],
        ["radio", "  무선 전송 문자열 (\"HELP\")"],
        ["radio", "무선 받았을 때 (문자열)"],
        ["logic", "  만약 <받은 문자열 = \"HELP\"> 이면"],
        ["basic", "    아이콘 표시 (놀람)  ·  음 재생 (높은 도)"]
      ],
      entry: [
        ["input", "만약 <A 버튼을 눌렀는가> 라면"],
        ["radio", "  무선으로 (\"HELP\") 보내기"],
        ["radio", "무선으로 신호를 받았을 때"],
        ["logic", "  만약 <받은 값 = \"HELP\"> 이라면"],
        ["basic", "    LED 화면에 놀람 얼굴 나타내기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "두 마이크로비트가 radio 로 통신하려면 무엇을 맞춰야 하나요?", type: "choice",
        opts: ["그룹 번호", "전압", "색깔", "밝기"], a: 0,
        why: "같은 그룹 번호끼리만 메시지가 들립니다." },
      { q: "옆 모둠 신호가 섞이면 어떻게 하나요?", type: "choice",
        opts: ["그룹 번호를 다르게 바꾼다", "전원을 끈다", "5V 로 바꾼다", "참는다"], a: 0,
        why: "그룹을 바꾸면 다른 모둠과 분리됩니다." },
      { q: "블루투스 모듈 HC-06 의 TXD·RXD 는 어떻게 연결하나요?", type: "fill",
        a: ["엇갈려", "엇갈리게", "교차", "반대로"], ph: "어떻게",
        why: "모듈의 TXD 는 보드가 받는 핀에, RXD 는 보드가 보내는 핀에 — 엇갈려 연결합니다." },
      { q: "radio 를 쓰려면 확장보드에 배선이 필요한가요?", type: "choice",
        opts: ["3개 필요", "1개 필요", "필요 없다 — 무선이 내장", "USB 필요"], a: 2,
        why: "radio 는 마이크로비트에 내장된 무선 기능이라 배선이 없습니다." }
    ],
    jump: {
      body: "<b>미션.</b> 한 대에 15차시의 «물 감지» 를 붙여 침수되면 <b>무선으로 «FLOOD»</b> 를 보내고, " +
        "다른 대(수신기)가 경보를 울리는 «무선 침수 경보» 를 만들어 보자.",
      hint: "보내는 쪽은 조건이 참일 때 `radio.send`, 받는 쪽은 `on radio received` 에서 경보."
    },
    studio: { hint: "예) 보내는 메시지를 바꿨다 / 수신 확인을 되보냈다(양방향) / 어떤 센서 값을 함께 보냈다" }
  };
})();
