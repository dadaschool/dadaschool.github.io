/* 5차시 · 나만의 게임 컨트롤러 (XY 조이스틱) */
(function () {
  "use strict";
  window.LESSONS = window.LESSONS || {};
  window.LESSONS[5] = {
    n: 5, area: "A", title: "나만의 게임 컨트롤러", part: "XY 조이스틱",
    goal: [
      "조이스틱은 **X(좌우)·Y(위아래)** 두 개의 아날로그 값을 낸다",
      "가운데(중립)는 약 `512`, 밀면 `0` 이나 `1023` 쪽으로 간다",
      "누르면 버튼(SW)으로도 쓴다 — 3V3 필수"
    ],
    life: [
      { ic: "🎮", lt: "게임패드", ld: "왼쪽 스틱으로 이동, 오른쪽으로 시점" },
      { ic: "🚁", lt: "드론 조종기", ld: "두 스틱으로 상하·좌우·회전" },
      { ic: "🚗", lt: "RC카 조종기", ld: "앞뒤·좌우를 스틱으로" }
    ],
    bench: {
      type: "analog-level",
      sensor: { name: "X축(좌우)", min: 0, max: 1023, val: 512, lowLabel: "왼쪽", highLabel: "오른쪽" },
      thresh: { val: 700, label: "이보다 크면 «오른쪽» 으로 인식", dir: "above" },
      output: { name: "캐릭터", onText: "오른쪽으로 이동", offText: "제자리" },
      real: {
        real: "스틱을 밀면 안쪽 두 개의 가변저항 값이 바뀝니다. Y축과 버튼(SW)도 함께 있습니다.",
        sim: "여기서는 X축만 다룹니다. Y축·버튼은 전용 시뮬에서 이어집니다."
      }
    },
    connect: {
      t: "게임 컨트롤러 — XY 조이스틱 연결", v1: "3V3", v2: "3V3", usb: false, color: true, ext: [],
      parts: [{ id: "joystick", pin: { X: 0, Y: 1, SW: 2 } }]
    },
    code: {
      makecode: [
        ["loop", "무한 반복"],
        ["logic", "  만약 <아날로그 입력 P0 > 700> 이면"],
        ["basic", "    화살표 표시 (동쪽)"],
        ["logic", "  아니면 만약 <아날로그 입력 P0 < 300> 이면"],
        ["basic", "    화살표 표시 (서쪽)"],
        ["logic", "  아니면"],
        ["basic", "    아이콘 표시 (점)"]
      ],
      entry: [
        ["loop", "계속 반복하기"],
        ["logic", "  만약 <(P0 아날로그값) > 700> 이라면"],
        ["basic", "    LED 화면에 오른쪽 화살표 나타내기"],
        ["logic", "  아니면 만약 <(P0 아날로그값) < 300> 이라면"],
        ["basic", "    LED 화면에 왼쪽 화살표 나타내기"]
      ]
    },
    start: { makecode: "https://makecode.microbit.org/#editor", entry: "https://playentry.org/ws/new" },
    worksheet: [
      { q: "조이스틱이 내는 아날로그 값은 몇 개인가요?", type: "choice",
        opts: ["1개(X)", "2개(X, Y)", "3개", "0개"], a: 1,
        why: "좌우(X)와 위아래(Y) 두 개입니다. 누름(SW)은 디지털입니다." },
      { q: "스틱을 건드리지 않았을 때 X 값은 대략 얼마인가요?", type: "choice",
        opts: ["0", "255", "512", "1023"], a: 2,
        why: "가운데(중립)는 최대값의 절반, 약 512 입니다." },
      { q: "조이스틱을 반드시 몇 V 로 연결해야 하나요?", type: "fill",
        a: ["3V3", "3.3V", "3v3"], ph: "전압",
        why: "아날로그 출력이 전원 전압까지 올라가므로 3V3 만 씁니다." },
      { q: "스틱을 «눌렀는지» 는 어떤 종류의 신호로 읽나요?", type: "choice",
        opts: ["아날로그(0~1023)", "디지털(0/1)", "온도", "주파수"], a: 1,
        why: "SW 는 버튼이라 디지털 0/1 입니다." }
    ],
    jump: {
      body: "<b>미션.</b> 스틱 방향으로 5×5 화면의 점을 움직이고, 스틱을 누르면(SW) «발사» 소리가 나는 " +
        "간단한 조작기를 만들어 보자.",
      hint: "점의 x·y 좌표를 변수로 두고 방향에 따라 ±1 한다. 화면 밖으로 나가지 않게 0~4 로 제한한다."
    },
    studio: { hint: "예) Y축도 읽어 위아래로 움직이게 했다 / 누르면 색이 바뀌게 했다 / 반응 속도를 조절했다" }
  };
})();
