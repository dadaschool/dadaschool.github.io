/* 7차시 · 방 쾌적도 알리미 (DHT11 온습도 센서) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[7] = {
    n: 7, area: "B", title: "방 쾌적도 알리미", part: "온습도 센서(DHT11)",
    goal: [
      "DHT11 은 **온도와 습도** 두 값을 한 선으로 보내 준다",
      "메이크코드에서 `DHT11` **확장프로그램**을 추가해야 블록이 나온다",
      "«쾌적 범위» 를 정해 벗어나면 알린다"
    ],
    life: [
      { ic: "❄️", lt: "에어컨·가습기 자동 운전", ld: "설정 온습도에 맞춰 켜고 끔" },
      { ic: "🌡️", lt: "날씨 앱의 체감온도", ld: "온도+습도로 계산" },
      { ic: "🍄", lt: "곰팡이·불쾌지수 경보", ld: "습도가 높으면 알림" }
    ],
    bench: {
      type: "analog-level",
      sensor: { name: "습도(%)", min: 0, max: 100, val: 45, lowLabel: "건조", highLabel: "눅눅함" },
      thresh: { val: 60, label: "이보다 습하면 «제습» 알림", dir: "above" },
      output: { name: "제습 알림", onText: "켜기(창문 여세요)", offText: "쾌적" },
      real: {
        real: "DHT11 은 온도 0~50℃, 습도 20~90% 를 약 1초에 한 번 알려 줍니다. 값이 자주 바뀌지 않습니다.",
        sim: "여기서는 습도만 다룹니다. 실물에서는 온도도 함께 읽어 표시해 보세요."
      }
    },
    connect: {
      t: "방 쾌적도 알리미 — DHT11 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: ["DHT11"],
      parts: [{ id: "dht11", pin: { S: 0 } }]
    },
    code: {
      makecode: [
        ["note", "먼저 톱니바퀴 → 확장프로그램 → «DHT11» 추가"],
        ["loop", "무한 반복"],
        ["input", "  DHT11 읽기 (핀 P0)"],
        ["basic", "  수 표시 ( 습도 )"],
        ["logic", "  만약 <습도 > 60> 이면"],
        ["basic", "    문자열 출력 (\"창문 여세요\")"],
        ["loop", "  일시정지 (2000) ms"]
      ],
      entry: [
        ["loop", "계속 반복하기"],
        ["input", "  P0 번의 온습도 센서 습도 값"],
        ["basic", "  LED 화면에 (습도) 나타내기"],
        ["logic", "  만약 <습도 > 60> 이라면"],
        ["basic", "    LED 화면에 (\"창문\") 나타내기"],
        ["loop", "  (2) 초 기다리기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "DHT11 이 한 선으로 함께 보내 주는 값은?", type: "choice",
        opts: ["온도와 습도", "온도와 밝기", "습도와 소리", "온도만"], a: 0,
        why: "온도와 습도를 함께 보냅니다." },
      { q: "메이크코드에서 DHT11 블록을 쓰려면 먼저 무엇을 해야 하나요?", type: "choice",
        opts: ["아무것도", "«DHT11» 확장프로그램 추가", "5V 로 연결", "USB 연결"], a: 1,
        why: "확장프로그램을 추가해야 관련 블록이 생깁니다." },
      { q: "DHT11 의 값은 얼마나 자주 바뀌나요?", type: "choice",
        opts: ["1초에 100번", "약 1초에 한 번", "바뀌지 않는다", "버튼 누를 때만"], a: 1,
        why: "느린 센서라 약 1초에 한 번 갱신됩니다. 너무 자주 읽지 마세요." },
      { q: "«쾌적 범위» 처럼 위·아래 두 기준을 다 볼 때 필요한 논리 연산은?", type: "fill",
        a: ["and", "그리고", "AND"], ph: "영어로",
        why: "«20%보다 크다» 그리고 «60%보다 작다» 를 and 로 묶습니다." }
    ],
    jump: {
      body: "<b>미션.</b> 온도와 습도를 <b>둘 다</b> 읽어, «덥고 습함 / 춥고 건조함 / 쾌적» 세 가지를 " +
        "5×5 아이콘으로 다르게 보여 주자.",
      hint: "온도 기준·습도 기준을 각각 정하고, 조건을 중첩(만약 안에 만약)해서 네 경우를 나눈다."
    },
    studio: { hint: "예) 쾌적 범위를 우리 반 기준으로 바꿨다 / 습할 때 부저로도 알렸다 / 온도만 쓰도록 줄였다" }
  };
})();
