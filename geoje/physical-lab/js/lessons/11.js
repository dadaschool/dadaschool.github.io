/* 11차시 · 디지털 알림판 (LCD1602) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[11] = {
    n: 11, area: "B", title: "디지털 알림판", part: "LCD 1602 화면",
    goal: [
      "LCD1602 는 **글자 16칸 × 2줄** 을 보여 준다",
      "I2C 방식이라 신호선이 **`SDA`=19 · `SCL`=20 으로 고정**돼 있다",
      "메이크코드에서 `LCD1602_I2C` **확장프로그램**이 필요하다"
    ],
    life: [
      { ic: "🕐", lt: "전자시계", ld: "시각을 숫자로 표시" },
      { ic: "🚌", lt: "버스 도착 안내판", ld: "몇 분 뒤 도착인지" },
      { ic: "🛗", lt: "엘리베이터 층 표시", ld: "현재 층·이동 방향" }
    ],
    bench: {
      type: "analog-level",
      sensor: { name: "표시할 온도(℃)", min: 0, max: 40, val: 24, lowLabel: "0", highLabel: "40" },
      thresh: { val: 28, label: "이보다 더우면 «더워요» 도 표시", dir: "above" },
      output: { name: "LCD", onText: "\"24C  더워요\"", offText: "\"24C  쾌적\"" },
      real: {
        real: "LCD 는 커서 위치(줄·칸)를 정하고 글자를 씁니다. 뒤쪽 파란 나사로 밝기(대비)를 맞춥니다.",
        sim: "손잡이로 온도를 바꾸면 화면에 어떤 글자가 나올지 미리 보여 줍니다."
      }
    },
    connect: {
      t: "디지털 알림판 — LCD1602 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: ["LCD1602_I2C"],
      parts: [{ id: "lcd1602", pin: {} }]
    },
    code: {
      makecode: [
        ["note", "확장프로그램 «LCD1602_I2C» 추가 · SDA·SCL 은 19·20 고정"],
        ["basic", "시작하면 : LCD 켜기 (주소 39)"],
        ["loop", "무한 반복"],
        ["basic", "  LCD 지우기"],
        ["basic", "  LCD 1줄 0칸에 (\"Temp: \") 쓰기"],
        ["basic", "  LCD 1줄 6칸에 ( 온도 ) 쓰기"],
        ["loop", "  일시정지 (1000) ms"]
      ],
      entry: [
        ["basic", "시작하면 LCD 초기화하기"],
        ["loop", "계속 반복하기"],
        ["basic", "  LCD 화면 지우기"],
        ["basic", "  LCD (0) 줄 (0) 칸에 (\"Temp:\") 쓰기"],
        ["basic", "  LCD (0) 줄 (6) 칸에 (온도) 쓰기"],
        ["loop", "  (1) 초 기다리기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "LCD1602 는 글자를 몇 칸 × 몇 줄 보여 주나요?", type: "choice",
        opts: ["8 × 1", "16 × 2", "20 × 4", "5 × 5"], a: 1,
        why: "이름 1602 = 16칸 2줄입니다." },
      { q: "LCD 의 두 신호선(SDA·SCL)은 몇 번 핀에 연결되나요?", type: "choice",
        opts: ["0 과 1", "8 과 9", "19 와 20 (고정)", "아무 데나"], a: 2,
        why: "I2C 는 보드에 SDA=19, SCL=20 으로 배선돼 있어 바꿀 수 없습니다." },
      { q: "메이크코드에서 LCD 블록을 쓰려면 추가할 확장프로그램 이름은?", type: "fill",
        a: ["LCD1602_I2C", "LCD1602", "lcd1602_i2c"], ph: "이름",
        why: "«LCD1602_I2C» 를 검색해 추가합니다." },
      { q: "글자가 잘 안 보일 때 조절하는 부분은?", type: "choice",
        opts: ["뒤쪽 파란 나사(대비)", "신호선", "USB", "전원선"], a: 0,
        why: "뒤판의 파란 가변저항으로 화면 대비(밝기)를 맞춥니다." }
    ],
    jump: {
      body: "<b>미션.</b> 7차시의 온습도 센서를 붙여 <b>온도·습도·시각</b> 을 두 줄에 나눠 보여 주는 " +
        "«우리 집 상황판» 을 만들어 보자. 값이 바뀔 때만 화면을 다시 쓰면 깜빡임이 줄어든다.",
      hint: "1줄에는 온습도, 2줄에는 경과 시간. `이전 값` 과 다를 때만 `LCD 쓰기` 를 호출한다."
    },
    studio: { hint: "예) 표시 내용을 시각으로 바꿨다 / 2줄을 다 썼다 / 경고일 때 글자를 깜박이게 했다" }
  };
})();
