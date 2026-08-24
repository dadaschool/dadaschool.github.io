/* ============================================================
   부품 사전 — 이 파일 하나만 고치면 교사 화면·학생 화면·인쇄물이 함께 바뀐다.

   ── 무엇이 들어 있나 ────────────────────────────────────────
   학교가 쓰는 **Keyestudio micro:bit 37-in-1 센서 키트(KS0361)** 의 공식 부품 목록
   (https://docs.keyestudio.com/projects/KS0361-KS0365/en/latest/) 을 그대로 대조해 넣었다.
   여기에 사용자가 «학교에 있다» 고 알려 준 네 개를 더했다 —
   **온습도(DHT11) · IR 수신·송신 · 노크 · 미세먼지 · 블루투스**(키트 밖에서 온 것들).
   🚫 **네오픽셀은 일부러 뺐다**(사용자 지시 — 지금 쓰지 않는다).

   ── 칸 설명 ────────────────────────────────────────────────
   pins 의 role 이 채점 규칙을 정한다 (js/judge.js 가 읽는다)
     vcc  전원(+)  → 빨간 V 줄, 또는 5V·3V3 단자
     gnd  접지(−)  → 검정 G 줄 (어느 번호든 된다)
     sig  신호     → 교사가 정한 번호의 노란 S 구멍만
     sda  I2C 자료 → 19번 S 구멍만 (핀이 고정되어 있다)
     scl  I2C 신호 → 20번 S 구멍만

   power : **'3V3' 또는 '5V' 둘 중 하나뿐이다.** («아무거나» 를 없앴다 — 2026-08-24 사용자 지시)
           마이크로비트 핀은 3.3V 까지만 견디므로 **기본은 3V3**, 5V 없이는 아예 돌지 않는
           부품만 5V 로 둔다.
   group : 교사 화면 판에서 어느 묶음에 들어가나. **`자주` 가 맨 위로 온다**(사용자 지시).
   ext   : MakeCode 에서 추가해야 하는 확장프로그램 (모르면 빈 값 — 교사가 적는다)
   opt   : true 인 핀은 «쓰지 않음(−)» 으로 둘 수 있다 (교사가 정한다)

   ⚠ **전원핀(vcc)이 없는 부품이 둘 있다** — `RGB LED`·`신호등` 은 공통 캐소드라
     신호핀 여러 개로 직접 켠다. 「모든 부품에 전원핀이 하나 있다」고 가정하지 말 것.
   ⚠ **아날로그 출력 부품을 5V 로 바꾸지 말 것** — 출력이 전원 전압까지 올라가므로
     마이크로비트 핀의 한계(3.3V)를 넘긴다. 특히 `가변저항`·`XY 조이스틱`.
   ⚠ **확장프로그램 이름을 추측해 적지 말 것.** 인쇄물에 그대로 찍혀 나간다.
     확실한 것만 넣었다(`SONAR`·`DHT11`·`LCD1602_I2C`).
   ============================================================ */
(function (g) {
  "use strict";

  /* 선 색 — **앱이 정한다.** 학생이 고르지 않는다(2026-08-24 사용자 지시).
     고르게 했더니 ① 색 고르는 데 시간을 쓰고 ② 한 센서의 선을 같은 색으로 이어
     어느 선이 어느 핀인지 알 수 없었다. 지금은 규칙대로 자동으로 정해진다 —
     전원은 빨강, 접지는 검정, **신호는 한 센서 안에서 서로 다른 색**.
     ⚠ 검정 선도 **흰 피복**(css `path.case`) 덕분에 검은 보드 위에서 잘 보인다
       (사용자 확인 2026-08-24 — 색을 바꾸지 않아도 된다). */
  var COLORS = [
    { k: "red",    name: "빨강", hex: "#e03131", use: "전원(+)" },
    { k: "black",  name: "검정", hex: "#212529", use: "접지(−)" },
    { k: "blue",   name: "남색", hex: "#1c5fb4", use: "신호" },
    { k: "green",  name: "초록", hex: "#2f9e44", use: "신호" },
    { k: "sky",    name: "하늘", hex: "#0ca7c4", use: "신호" },
    { k: "purple", name: "보라", hex: "#8e44ad", use: "신호" },
    { k: "orange", name: "주황", hex: "#f76707", use: "신호" },
    { k: "brown",  name: "갈색", hex: "#8a5a2b", use: "신호" }
  ];

  /* 신호선에 돌려 쓸 색 순서 — 한 센서 안에서 겹치지 않게 차례로 준다 */
  var SIG_COLORS = ["blue", "green", "sky", "purple", "orange", "brown"];

  /* role  : 그 핀이 무슨 핀인가
     idx   : 그 센서 안에서 **몇 번째 신호핀**인가 (0부터) */
  function wireColor(role, idx) {
    if (role === "vcc") return "red";
    if (role === "gnd") return "black";
    return SIG_COLORS[(idx || 0) % SIG_COLORS.length];
  }

  /* 교사 화면 판의 묶음 — 이 순서대로 위에서 아래로 놓인다 */
  var GROUPS = [
    { k: "자주", name: "자주 쓰는 것", note: "중학교 수업에서 가장 많이 쓰는 부품" },
    { k: "감지", name: "그 밖의 감지 센서", note: "" },
    { k: "조작", name: "조작·입력", note: "" },
    { k: "출력", name: "출력·통신", note: "" }
  ];

  /* 3핀 부품이 많아 핀 목록을 만들어 쓴다 (S · + · −) */
  function p3(sub) {
    return [
      { n: "S", role: "sig", sub: sub || "신호" },
      { n: "+", role: "vcc" },
      { n: "−", role: "gnd" }
    ];
  }

  var PARTS = [

    /* ══ 자주 쓰는 것 ═══════════════════════════════════════ */
    {
      id: "hcsr04", group: "자주", name: "초음파 센서", model: "HC-SR04",
      pcb: "#1663c7", face: "sonar", power: "5V", ext: "SONAR",
      note: "소리를 보내고(Trig) 돌아오는 것을 받아(Echo) 거리를 잰다. 신호선이 두 개다.",
      pins: [
        { n: "Vcc",  role: "vcc" },
        { n: "Trig", role: "sig", sub: "보내기" },
        { n: "Echo", role: "sig", sub: "받기" },
        { n: "GND",  role: "gnd" }
      ]
    },
    {
      id: "led", group: "자주", name: "LED 모듈", model: "흰색·빨강",
      pcb: "#1d1f22", face: "led", power: "3V3", ext: "",
      note: "신호를 1 로 하면 켜지고 0 으로 하면 꺼진다.",
      pins: p3("신호")
    },
    {
      id: "buzzer", group: "자주", name: "수동 부저", model: "Passive Buzzer",
      pcb: "#1d1f22", face: "buzzer", power: "3V3", ext: "",
      note: "음의 높이를 정해 소리를 낸다. 노래를 연주할 수 있다.",
      pins: p3("신호")
    },
    {
      id: "button", group: "자주", name: "버튼 모듈", model: "Push Button",
      pcb: "#1d1f22", face: "button", power: "3V3", ext: "",
      note: "누르면 신호가 바뀐다. 눌렀는지 읽는 것이므로 신호선은 하나다.",
      pins: p3("디지털")
    },
    {
      id: "light", group: "자주", name: "조도 센서", model: "Photocell",
      pcb: "#1d1f22", face: "light", power: "3V3", ext: "",
      note: "밝기를 아날로그 값으로 읽는다. 아날로그는 0~2 번 핀이 편하다.",
      pins: p3("아날로그")
    },
    {
      /* 아날로그 출력이 «전원 전압까지» 올라간다 — 5V 로 바꾸지 말 것 */
      id: "pot", group: "자주", name: "가변저항", model: "Potentiometer",
      pcb: "#1d2733", face: "pot", power: "3V3", ext: "",
      note: "손잡이를 돌리면 값이 0 에서 가장 큰 값까지 바뀐다. 밝기·속도를 손으로 맞출 때 쓴다.",
      pins: p3("아날로그")
    },
    {
      id: "pir", group: "자주", name: "인체 감지 센서", model: "HC-SR501",
      pcb: "#1d2229", face: "pir", power: "5V", ext: "",
      note: "사람이 움직이면 1 이 된다. 3V3 으로는 돌지 않으므로 반드시 5V 를 쓴다.",
      pins: [
        { n: "OUT", role: "sig", sub: "디지털" },
        { n: "VCC", role: "vcc" },
        { n: "GND", role: "gnd" }
      ]
    },
    {
      id: "irobs", group: "자주", name: "적외선 장애물 감지 센서", model: "IR Obstacle",
      pcb: "#151a22", face: "irobs", power: "3V3", ext: "",
      note: "적외선을 쏘고 되돌아오는 것으로 앞에 물체가 있는지만 알아낸다(0 또는 1).",
      pins: p3("디지털")
    },
    {
      id: "dht11", group: "자주", name: "온습도 센서", model: "DHT11",
      pcb: "#2b6cb0", face: "dht", power: "3V3", ext: "DHT11",
      note: "온도와 습도를 한 선으로 함께 보내 준다.",
      pins: p3("신호")
    },
    {
      id: "servo", group: "자주", name: "서보모터", model: "SG90",
      pcb: "#2f6ea8", face: "servo", power: "5V", ext: "",
      note: "각도를 정해 돌린다. 전류를 많이 먹으므로 보조배터리를 함께 쓰는 것이 좋다.",
      pins: [
        { n: "주황", role: "sig", sub: "신호" },
        { n: "빨강", role: "vcc" },
        { n: "갈색", role: "gnd" }
      ]
    },
    {
      /* 🔴 **접지핀이 없다.** 공식 문서에 «Common anode configuration» 이라고 적혀 있다 —
         전원(V)을 함께 쓰고 R·G·B 세 핀으로 색을 만든다.
         처음에 공통 캐소드(GND + R·G·B)로 넣었다가 문서를 보고 고쳤다.
         ⚠ 실물의 네 번째 핀 글자가 `V`(또는 `+`)인지 `G`인지 확인해 주면 좋다. */
      id: "rgbled", group: "자주", name: "RGB LED", model: "KY-016",
      pcb: "#1a1c20", face: "rgb", power: "3V3", ext: "",
      note: "빨강·초록·파랑을 따로 조절해 색을 만든다. 공통 애노드라 **접지선이 없고** " +
            "전원선 하나에 신호선 셋을 쓴다.",
      pins: [
        { n: "R", role: "sig", sub: "빨강" },
        { n: "G", role: "sig", sub: "초록" },
        { n: "B", role: "sig", sub: "파랑" },
        { n: "V", role: "vcc" }
      ]
    },
    {
      /* 🔴 **전원핀이 없다.** 공통 캐소드 — 접지를 함께 쓰고 신호 셋으로 켠다.
         ⚠ RGB LED 와 **반대**다(그쪽은 접지가 없고 전원이 있다). 헷갈리지 말 것.
         ⚠ 실물의 네 번째 핀 글자가 `G`(접지)인지 확인해 주면 좋다. */
      id: "traffic", group: "자주", name: "신호등 모듈", model: "Traffic Light",
      pcb: "#14181f", face: "traffic", power: "3V3", ext: "",
      note: "빨강·노랑·초록 LED 가 한 판에 있다. 공통 캐소드라 **전원선이 없고** " +
            "접지선 하나에 신호선 셋을 쓴다.",
      pins: [
        { n: "R",   role: "sig", sub: "빨강" },
        { n: "Y",   role: "sig", sub: "노랑" },
        { n: "G",   role: "sig", sub: "초록" },
        { n: "GND", role: "gnd" }
      ]
    },

    /* ══ 그 밖의 감지 센서 ═══════════════════════════════════ */
    {
      id: "temp", group: "감지", name: "아날로그 온도 센서", model: "Thermistor",
      pcb: "#1d1f22", face: "temp", power: "3V3", ext: "",
      note: "온도에 따라 저항이 바뀌는 것을 아날로그 값으로 읽는다.",
      pins: p3("아날로그")
    },
    {
      id: "lm35", group: "감지", name: "LM35 온도 센서", model: "LM35",
      pcb: "#191c22", face: "lm35", power: "5V", ext: "",
      note: "온도를 곧바로 전압으로 알려 준다. 4V 아래에서는 돌지 않으므로 5V 를 쓴다.",
      pins: p3("아날로그")
    },
    {
      id: "temt6000", group: "감지", name: "주변광 센서", model: "TEMT6000",
      pcb: "#1d1f22", face: "temt", power: "3V3", ext: "",
      note: "사람 눈이 느끼는 밝기에 가깝게 읽는다. 조도 센서보다 정확하다.",
      pins: p3("아날로그")
    },
    {
      id: "uv", group: "감지", name: "자외선 센서", model: "GUVA-S12SD",
      pcb: "#241b33", face: "uv", power: "3V3", ext: "",
      note: "눈에 보이지 않는 자외선의 세기를 읽는다. 자외선 지수 수업에 쓴다.",
      pins: p3("아날로그")
    },
    {
      id: "sound", group: "감지", name: "고감도 소리 감지 센서", model: "KY-038",
      pcb: "#7a1220", face: "sound", power: "3V3", ext: "",
      note: "소리의 크기를 읽는다. 파란 나사를 돌려 «얼마나 큰 소리에 반응할지» 를 맞춘다.",
      pins: p3("아날로그")
    },
    {
      id: "flame", group: "감지", name: "불꽃·화염 감지 센서", model: "Flame Sensor",
      pcb: "#5c1220", face: "flame", power: "3V3", ext: "",
      note: "불꽃에서 나오는 적외선을 읽는다. 촛불을 가까이 대면 값이 크게 바뀐다. " +
            "디지털(DO)과 아날로그(AO) 중에서 쓸 것만 이으면 된다.",
      pins: [
        { n: "VCC", role: "vcc" },
        { n: "GND", role: "gnd" },
        { n: "DO",  role: "sig", sub: "디지털", opt: true },
        { n: "AO",  role: "sig", sub: "아날로그", opt: true }
      ]
    },
    {
      id: "mq2", group: "감지", name: "가스 센서", model: "MQ-2",
      pcb: "#101820", face: "mq2", power: "5V", ext: "",
      note: "탈 수 있는 가스(연기·LPG)의 양을 잰다. 안을 데워야 하므로 5V 를 쓴다.",
      pins: p3("아날로그")
    },
    {
      id: "mq3", group: "감지", name: "알코올 센서", model: "MQ-3",
      pcb: "#111318", face: "gas", power: "5V", ext: "",
      note: "공기 속 알코올의 양을 잰다. 아날로그(AO)와 디지털(DO) 중에서 쓸 것만 이으면 된다.",
      pins: [
        { n: "VCC", role: "vcc" },
        { n: "GND", role: "gnd" },
        { n: "DO",  role: "sig", sub: "디지털", opt: true },
        { n: "AO",  role: "sig", sub: "아날로그", opt: true }
      ]
    },
    {
      id: "soil", group: "감지", name: "토양 수분 센서", model: "Soil Humidity",
      pcb: "#155e3a", face: "soil", power: "3V3", ext: "",
      note: "흙이 얼마나 젖었는지 아날로그 값으로 읽는다.",
      pins: p3("아날로그")
    },
    {
      id: "water", group: "감지", name: "물 감지 센서", model: "Water Sensor",
      pcb: "#12354d", face: "water", power: "3V3", ext: "",
      note: "물이 닿은 높이를 아날로그 값으로 읽는다. 비 감지·물 넘침 알림에 쓴다.",
      pins: p3("아날로그")
    },
    {
      id: "steam", group: "감지", name: "수증기 센서", model: "Steam Sensor",
      pcb: "#123a45", face: "steam", power: "3V3", ext: "",
      note: "공기 속 물기(수증기)를 아날로그 값으로 읽는다.",
      pins: p3("아날로그")
    },
    {
      /* 🔴 통신이 아니라 «보내고 받는» 아날로그다 (2026-08-24 사용자 확인) */
      id: "dust", group: "감지", name: "미세먼지 센서", model: "GP2Y1010AU0F",
      pcb: "#2c3038", face: "dust", power: "5V", ext: "",
      note: "공기 속 먼지에 적외선을 비춰 잰다. `LED` 로 불을 깜박이고 그 순간 `Vo` 값을 읽는다 " +
            "(초음파의 Trig·Echo 처럼 보내고 받는 짝이다). 5V 로 써야 하고, 부품 옆에 " +
            "저항·콘덴서가 함께 붙어 있어야 값이 제대로 나온다.",
      pins: [
        { n: "VCC", role: "vcc" },
        { n: "GND", role: "gnd" },
        { n: "LED", role: "sig", sub: "보내기·디지털" },
        { n: "Vo",  role: "sig", sub: "받기·아날로그" }
      ]
    },
    {
      id: "line", group: "감지", name: "라인 트래킹 센서", model: "Line Tracking",
      pcb: "#151a22", face: "line", power: "3V3", ext: "",
      note: "바닥이 검은지 흰지 알아낸다. 검은 선을 따라가는 자동차에 쓴다.",
      pins: p3("디지털")
    },
    {
      id: "hall", group: "감지", name: "홀 자기 센서", model: "Hall Sensor",
      pcb: "#151a22", face: "hall", power: "3V3", ext: "",
      note: "자석이 가까이 오면 알아낸다. 문이 열렸는지·바퀴가 돌았는지 세는 데 쓴다.",
      pins: p3("디지털")
    },
    {
      id: "reed", group: "감지", name: "리드 스위치", model: "Reed Switch",
      pcb: "#151a22", face: "reed", power: "3V3", ext: "",
      note: "유리관 안의 쇠가 자석에 붙어 스위치가 닫힌다. 홀 센서보다 단순하다.",
      pins: p3("디지털")
    },
    {
      id: "crash", group: "감지", name: "충돌 센서", model: "Crash Sensor",
      pcb: "#151a22", face: "crash", power: "3V3", ext: "",
      note: "긴 쇠막대가 무엇에 부딪히면 눌린다. 벽에 닿았는지 아는 데 쓴다.",
      pins: p3("디지털")
    },
    {
      id: "shock", group: "감지", name: "진동 센서", model: "KY-002",
      pcb: "#151a22", face: "shock", power: "3V3", ext: "",
      note: "흔들리면 잠깐 1 이 된다. 스프링이 닿는 것이라 «계속 1» 이 아니다.",
      pins: p3("디지털")
    },
    {
      id: "knock", group: "감지", name: "노크 센서", model: "KY-031",
      pcb: "#151a22", face: "knock", power: "3V3", ext: "",
      note: "톡톡 두드리면 1 이 된다. 두드린 «횟수» 를 세는 데 쓴다.",
      pins: p3("디지털")
    },
    {
      id: "photointer", group: "감지", name: "포토인터럽터", model: "KY-010",
      pcb: "#151a22", face: "photo", power: "3V3", ext: "",
      note: "ㄷ 자 틈 사이를 무엇이 지나가면 값이 바뀐다. 바퀴가 몇 바퀴 돌았는지 세는 데 쓴다.",
      pins: p3("디지털")
    },
    {
      id: "press", group: "감지", name: "박막 압력 센서", model: "Thin-film Pressure",
      pcb: "#2b2118", face: "press", power: "3V3", ext: "",
      note: "얇은 판을 누르는 힘의 크기를 아날로그 값으로 읽는다.",
      pins: p3("아날로그")
    },

    /* ══ 조작·입력 ═══════════════════════════════════════════ */
    {
      /* 아날로그 출력이 «전원 전압까지» 올라가는 부품이다 — 5V 로 쓰면 마이크로비트 핀이
         견디는 3.3V 를 넘긴다. **이 부품을 절대 5V 로 바꾸지 말 것.** */
      id: "joystick", group: "조작", name: "XY 조이스틱", model: "KY-023",
      pcb: "#14213d", face: "joystick", power: "3V3", ext: "",
      note: "좌우(X)와 위아래(Y)를 아날로그 값으로 읽고, 눌러서 버튼(SW)으로도 쓴다. " +
            "아날로그 값이 전원 전압까지 올라가므로 반드시 3V3 으로 쓴다(5V 면 마이크로비트가 다친다).",
      pins: [
        { n: "GND", role: "gnd" },
        { n: "VCC", role: "vcc" },
        { n: "X",   role: "sig", sub: "아날로그" },
        { n: "Y",   role: "sig", sub: "아날로그" },
        { n: "SW",  role: "sig", sub: "버튼", opt: true }
      ]
    },
    {
      id: "touch", group: "조작", name: "터치 감지 센서", model: "TTP223",
      pcb: "#151a22", face: "touch", power: "3V3", ext: "",
      note: "손가락을 대면 1 이 된다. 누르는 힘이 필요 없어 버튼과 느낌이 다르다.",
      pins: p3("디지털")
    },
    {
      id: "tilt", group: "조작", name: "기울기 센서", model: "Tilt Switch",
      pcb: "#151a22", face: "tilt", power: "3V3", ext: "",
      note: "기울이면 안의 쇠구슬이 굴러 스위치가 닫힌다. 어느 쪽으로 기울었는지는 알 수 없다.",
      pins: p3("디지털")
    },
    {
      id: "irrecv", group: "조작", name: "IR 수신 모듈", model: "KY-022",
      pcb: "#151a22", face: "irrecv", power: "3V3", ext: "",
      note: "리모컨이 보낸 적외선 신호를 받는다. MakeCode 에서 적외선 확장프로그램이 필요할 수 있다.",
      pins: p3("디지털")
    },

    /* ══ 출력·통신 ═══════════════════════════════════════════ */
    {
      id: "led3w", group: "출력", name: "3W LED 모듈", model: "3W LED",
      pcb: "#1d1f22", face: "led3w", power: "5V", ext: "",
      note: "아주 밝은 LED 다. 전류를 많이 먹으므로 5V 로 쓰고 오래 켜 두지 않는다.",
      pins: p3("신호")
    },
    {
      id: "buzzeract", group: "출력", name: "능동 부저", model: "Active Buzzer",
      pcb: "#1a1c20", face: "buzzact", power: "3V3", ext: "",
      note: "1 만 주면 정해진 소리가 난다. 음의 높이는 바꿀 수 없다(수동 부저와 다르다).",
      pins: p3("디지털")
    },
    {
      id: "relay", group: "출력", name: "릴레이 모듈", model: "Single Relay",
      pcb: "#123a6b", face: "relay", power: "5V", ext: "",
      note: "신호로 «큰 전기» 를 켜고 끈다. 딸깍 소리가 난다. 코일에 5V 가 필요하다.",
      pins: p3("디지털")
    },
    {
      id: "irsend", group: "출력", name: "IR 송신 모듈", model: "KY-005",
      pcb: "#151a22", face: "irsend", power: "3V3", ext: "",
      note: "적외선을 내보낸다. 눈에는 보이지 않는다. 수신 모듈과 짝으로 쓴다.",
      pins: p3("신호")
    },
    {
      id: "lcd1602", group: "출력", name: "LCD 1602 화면", model: "LCD1602 I2C",
      pcb: "#1f7a3d", face: "lcd", power: "5V", ext: "LCD1602_I2C",
      note: "글자를 보여 준다. I2C 방식이라 신호선 두 개(SDA·SCL)의 핀 번호가 정해져 있다.",
      pins: [
        { n: "GND", role: "gnd" },
        { n: "VCC", role: "vcc" },
        { n: "SDA", role: "sda", sub: "19번 고정" },
        { n: "SCL", role: "scl", sub: "20번 고정" }
      ]
    },
    {
      id: "hc06", group: "출력", name: "블루투스", model: "HC-06",
      pcb: "#1c2b4a", face: "bt", power: "5V", ext: "",
      note: "휴대전화와 글자를 주고받는다. 센서의 TXD 는 마이크로비트가 «받는» 핀에, " +
            "RXD 는 «보내는» 핀에 꽂는다(엇갈려 연결). MakeCode 에서 serial.redirect 로 핀을 정한다.",
      pins: [
        { n: "VCC", role: "vcc" },
        { n: "GND", role: "gnd" },
        { n: "TXD", role: "sig", sub: "모듈→보드" },
        { n: "RXD", role: "sig", sub: "보드→모듈", opt: true }
      ]
    }
  ];

  /* ── 부품 한 줄 사양 ──────────────────────────────────────
     교사가 **핀을 정하는 화면**에서 읽는 줄이다(2026-08-24 사용자 지시 —
     *"고르는 화면에서는 이미지와 이름만, 선택하고 난 후 핀설정 화면에서 자세한 설명"*).

     🔴 **출처는 Keyestudio 공식 문서다** — 숫자(감지 거리·파장·각도·전압)는 여기서 왔다.
        https://docs.keyestudio.com/projects/KS0361-KS0365/en/latest/
        ⚠ 추측한 숫자를 적지 말 것. 문서에 없는 것은 적지 않았다.
     ⚠ 부품 정의와 따로 두는 까닭 : 42개의 사양을 각 객체 안에 넣으면 핀 목록이 묻힌다.
        `id` 로 붙이므로 부품을 지우면 여기서도 지울 것(검사가 짝을 확인한다). */
  var SPEC = {
    /* 자주 쓰는 것 */
    hcsr04:  "5V · 신호 2핀 — `Trig` 로 소리를 보내고 `Echo` 로 돌아오는 시간을 재어 거리를 구한다",
    led:     "디지털 출력 · 키트에는 흰색·빨강 두 개가 들어 있다",
    buzzer:  "디지털 출력 · **네모파(주파수)를 넣어야** 소리가 난다 — 음의 높이를 정할 수 있어 연주가 된다",
    button:  "디지털 입력 · 누르면 값이 바뀐다",
    light:   "아날로그 입력 · **밝을수록 값이 커진다**",
    pot:     "아날로그 입력 · 돌리면 **0~1023** 으로 바뀐다 · 3V3 필수",
    pir:     "디지털 출력 · 사람이 내는 적외선을 느낀다 · 파란 나사로 민감도 조절 · **5V 필요**",
    irobs:   "디지털 출력 · **2~40cm** · 앞을 막으면 **0(LOW)**",
    dht11:   "디지털 1핀 · 온도와 습도를 한 선으로 함께 보낸다 · 확장프로그램 `DHT11` 필요",
    servo:   "5V · 각도를 정해 돌린다 · 전류를 많이 먹어 보조배터리를 함께 쓰는 것이 좋다",
    rgbled:  "**공통 애노드** — 전원(`V`)을 함께 쓰고 `R`·`G`·`B` 세 핀으로 색을 만든다 (접지선 없음)",
    traffic: "**공통 캐소드** — 접지(`GND`)를 함께 쓰고 신호 셋으로 켠다 (전원선 없음)",

    /* 그 밖의 감지 */
    temp:      "아날로그 입력 · 서미스터 · 대략 **−40℃ ~ 105℃**",
    lm35:      "아날로그 입력 · 온도를 곧바로 전압으로 준다 · **4V 아래에서는 안 돈다**(5V 필요)",
    temt6000:  "아날로그 입력 · **조도 센서보다 정확하다** — 사람 눈이 느끼는 밝기에 가깝게 읽는다",
    uv:        "아날로그 입력 · 눈에 보이지 않는 자외선(UV)의 세기",
    sound:     "아날로그 입력 · 소리가 클수록 값이 커진다 · 파란 나사로 민감도 조절",
    flame:     "**760~1100nm** 적외선 · 감지 각도 약 **60°** · 디지털(`DO`)·아날로그(`AO`) 둘 다 있다",
    mq2:       "아날로그 입력 · 탈 수 있는 가스(연기·LPG) · 안을 데워야 해 **5V 필요** · 나사로 조절",
    mq3:       "아날로그·디지털 · **알코올에 민감하고 벤진에는 덜 민감하다** · 5V 필요",
    soil:      "아날로그 입력 · 흙의 물기가 많을수록 값이 커진다",
    water:     "아날로그 입력 · 물이 닿은 높이를 읽는다",
    steam:     "아날로그 입력 · 공기 속 물기(수증기)를 읽는다",
    dust:      "5V · `LED` 로 불을 깜박이고 **그 순간** `Vo` 를 읽는다 · 저항·콘덴서가 함께 붙어 있어야 한다",
    line:      "디지털 출력 · TCRT5000 · **검은 선에서 1** · 나사로 민감도 조절",
    hall:      "디지털 출력 · 자석이 **약 3cm** 안에 오면 알아낸다",
    reed:      "디지털 출력 · 유리관 속 쇠가 자석에 붙어 닫힌다 — 홀 센서와 하는 일이 같다",
    crash:     "디지털 출력 · 리밋 스위치 · **누르면 0(LOW)** · 벽에 닿았는지 아는 데 쓴다",
    shock:     "디지털 출력 · 흔들리면 **잠깐** 1 이 된다 — 계속 1 이 아니다",
    knock:     "디지털 출력 · 두드리면 1 · 두드린 **횟수**를 센다",
    photointer:"디지털 출력 · ㄷ 자 틈을 무엇이 막으면 값이 바뀐다",
    press:     "아날로그 입력 · 누르는 힘의 크기",

    /* 조작·입력 */
    joystick: "아날로그 2개(`X`·`Y`) + 버튼 1개(`SW`) · **3V3 필수** — 출력이 전원 전압까지 올라간다",
    touch:    "디지털 출력 · 손가락이 닿으면 **전기장이 바뀌는 것**을 느낀다 — 누르는 힘이 필요 없다",
    tilt:     "디지털 출력 · **기울어진 것만** 알 수 있고 각도는 알 수 없다",
    irrecv:   "디지털 출력 · 리모컨이 보낸 적외선 신호를 받는다",

    /* 출력·통신 */
    led3w:     "디지털 출력 · 아주 밝다 · 전류를 많이 먹어 **5V**",
    buzzeract: "디지털 출력 · **1 만 주면** 정해진 소리가 난다 — 음의 높이는 바꿀 수 없다",
    relay:     "디지털 출력 · **1(HIGH)에서 붙는다** · `NO`·`NC` 나사 단자로 큰 전기를 켠다 · 5V",
    irsend:    "디지털 출력 · 적외선을 내보낸다(눈에 보이지 않는다) · 수신 모듈과 짝으로 쓴다",
    lcd1602:   "I2C · `SDA`=19 · `SCL`=20 **고정** · 글자 16칸 2줄 · 5V",
    hc06:      "통신(UART) · `TXD`↔`RXD` **엇갈려** 연결 · `serial.redirect` 로 핀을 정한다 · 5V"
  };
  PARTS.forEach(function (p) { p.spec = SPEC[p.id] || ""; });

  /* ── 부품 그림 ────────────────────────────────────────────
     사진이 아니라 코드로 그린다(교사가 새 부품을 만들 때도 그림이 나오게 하려고).
     ⚠ **작게 쓰는 그림이다.** 중요한 것은 그림이 아니라 «핀 설정» 이라는 사용자 지시에 따라
       교사 화면에서는 40×26 쯤으로 쓴다. 그래서 모양을 두세 개로 단순하게 그렸다. */
  function face(kind, w, h) {
    var W = w || 92, H = h || 56, cx = W / 2, mid = H / 2;
    function wrap(inner) {
      return '<svg class="face" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + inner + "</svg>";
    }
    /* 자주 쓰는 조각들 */
    function circle(x, y, r, fill, stroke, sw) {
      return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' +
             (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 2) + '"' : "") + "/>";
    }
    function rect(x, y, w2, h2, r, fill, stroke, sw) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w2 + '" height="' + h2 + '" rx="' + r +
             '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 2) + '"' : "") + "/>";
    }
    function line(x1, y1, x2, y2, col, sw) {
      return '<path d="M' + x1 + " " + y1 + "L" + x2 + " " + y2 + '" stroke="' + col +
             '" stroke-width="' + (sw || 2) + '" stroke-linecap="round"/>';
    }

    switch (kind) {
      /* ── 자주 쓰는 것 ── */
      case "sonar":
        return wrap(circle(cx - 19, mid, 15, "#374151", "#6b7280", 4) +
                    circle(cx + 19, mid, 15, "#374151", "#6b7280", 4) +
                    rect(cx - 3, mid - 11, 6, 22, 2, "#cbd5e1"));
      case "led":
        return wrap(circle(cx, mid + 3, 12, "#ff8f8f", "#e03131") +
                    line(cx, mid - 14, cx, mid - 22, "#ffd43b", 3) +
                    line(cx - 12, mid - 10, cx - 18, mid - 17, "#ffd43b", 3) +
                    line(cx + 12, mid - 10, cx + 18, mid - 17, "#ffd43b", 3));
      case "buzzer":
        return wrap(circle(cx, mid, 17, "#1a1c20", "#4b5563") + circle(cx, mid, 3.5, "#9ca3af"));
      case "buzzact":
        return wrap(circle(cx, mid, 17, "#1a1c20", "#4b5563") + circle(cx, mid, 3.5, "#9ca3af") +
                    line(cx - 5, mid - 9, cx + 5, mid - 9, "#e03131", 2.6) +
                    line(cx, mid - 14, cx, mid - 4, "#e03131", 2.6));
      case "button":
        return wrap(rect(cx - 16, mid - 16, 32, 32, 4, "#3f4650", "#9ca3af") + circle(cx, mid, 8.5, "#e03131"));
      case "light":
        return wrap(circle(cx, mid, 14, "#f0e6c8", "#a68b4b") +
                    '<path d="M' + (cx - 9) + " " + (mid + 4) + "q4.5 -11 9 0 q4.5 11 9 0\" stroke=\"#8a6d2f\" stroke-width=\"2.4\" fill=\"none\"/>");
      case "pot":
        return wrap(circle(cx, mid, 16, "#2b62b8", "#8fb4e8") + circle(cx, mid, 10, "#e9edf3") +
                    line(cx, mid, cx + 7, mid - 7, "#1c3f6b", 3));
      case "pir":
        return wrap('<path d="M' + (cx - 19) + " " + (mid + 13) + 'a19 17 0 0 1 38 0z" fill="#e9edf3" stroke="#9ca3af" stroke-width="2"/>' +
                    '<path d="M' + (cx - 11) + " " + (mid + 13) + 'a11 10 0 0 1 22 0" stroke="#b6bec9" stroke-width="1.6" fill="none"/>');
      case "irobs":
        return wrap(circle(cx - 10, mid, 8.5, "#2b3038", "#8b95a3") +
                    circle(cx + 10, mid, 8.5, "#4a3a1a", "#c9a227") +
                    line(cx - 10, mid - 12, cx - 10, mid - 19, "#74c0fc", 2.4) +
                    line(cx + 10, mid - 12, cx + 10, mid - 19, "#74c0fc", 2.4));
      case "dht":
        return wrap(rect(cx - 15, mid - 18, 30, 36, 3, "#7fb3ff", "#1c4f96") +
                    circle(cx - 6, mid - 7, 2.4, "#1c4f96") + circle(cx + 4, mid - 7, 2.4, "#1c4f96") +
                    circle(cx - 6, mid + 3, 2.4, "#1c4f96") + circle(cx + 4, mid + 3, 2.4, "#1c4f96"));
      case "servo":
        return wrap(rect(cx - 19, mid - 13, 38, 26, 3, "#3d6fb0", "#1f3f6b") +
                    circle(cx + 6, mid - 13, 5.5, "#d9e2ec") +
                    rect(cx + 4, mid - 25, 24, 6, 3, "#f1f5f9"));
      case "rgb":
        return wrap('<circle cx="' + (cx - 8) + '" cy="' + (mid - 3) + '" r="11" fill="#e03131" opacity=".72"/>' +
                    '<circle cx="' + (cx + 8) + '" cy="' + (mid - 3) + '" r="11" fill="#2f9e44" opacity=".72"/>' +
                    '<circle cx="' + cx + '" cy="' + (mid + 8) + '" r="11" fill="#1c5fb4" opacity=".72"/>');
      case "traffic":
        return wrap(rect(cx - 11, mid - 24, 22, 48, 4, "#22262e", "#5c6675") +
                    circle(cx, mid - 14, 6.5, "#e03131") + circle(cx, mid, 6.5, "#e8a90c") +
                    circle(cx, mid + 14, 6.5, "#2f9e44"));

      /* ── 감지 ── */
      case "temp":
        return wrap(rect(cx - 4, mid - 20, 8, 28, 4, "#e9edf3", "#8b95a3") +
                    circle(cx, mid + 12, 8, "#e03131", "#a02020") +
                    line(cx + 8, mid - 14, cx + 14, mid - 14, "#8b95a3", 2) +
                    line(cx + 8, mid - 6, cx + 14, mid - 6, "#8b95a3", 2));
      case "lm35":
        return wrap('<path d="M' + (cx - 11) + " " + (mid + 8) + "v-8a11 11 0 0 1 22 0v8z\" fill=\"#1b2029\" stroke=\"#8b95a3\" stroke-width=\"2\"/>" +
                    line(cx - 6, mid + 8, cx - 6, mid + 19, "#b9c2cd", 2) +
                    line(cx, mid + 8, cx, mid + 19, "#b9c2cd", 2) +
                    line(cx + 6, mid + 8, cx + 6, mid + 19, "#b9c2cd", 2));
      case "temt":
        return wrap(rect(cx - 9, mid - 7, 18, 14, 2, "#2b3038", "#9ca3af") +
                    line(cx - 16, mid - 14, cx - 10, mid - 9, "#ffd43b", 2.4) +
                    line(cx, mid - 20, cx, mid - 12, "#ffd43b", 2.4) +
                    line(cx + 16, mid - 14, cx + 10, mid - 9, "#ffd43b", 2.4));
      case "uv":
        return wrap(circle(cx, mid, 11, "#c9a7ff", "#7a4fc0") +
                    line(cx - 20, mid, cx - 14, mid, "#8e44ad", 2.4) +
                    line(cx + 14, mid, cx + 20, mid, "#8e44ad", 2.4) +
                    line(cx, mid - 20, cx, mid - 14, "#8e44ad", 2.4) +
                    line(cx, mid + 14, cx, mid + 20, "#8e44ad", 2.4));
      case "sound":
        return wrap(circle(cx + 7, mid, 14, "#2b3038", "#9ca3af") +
                    line(cx - 1, mid - 6, cx + 15, mid - 6, "#6b7280", 1.6) +
                    line(cx - 1, mid, cx + 15, mid, "#6b7280", 1.6) +
                    line(cx - 1, mid + 6, cx + 15, mid + 6, "#6b7280", 1.6) +
                    rect(cx - 26, mid - 8, 16, 16, 2, "#2f6ea8", "#1c4f96", 1.5));
      case "flame":
        return wrap('<path d="M' + cx + " " + (mid - 19) +
                    'c8 8 11 11 11 19a11 11 0 0 1-22 0c0-5 3-7 6-10c1 5 4 6 5 4c-3-4-2-9 0-13z" fill="#ff922b" stroke="#d9480f" stroke-width="1.5"/>');
      case "mq2":
        return wrap(circle(cx, mid, 19, "#3f5d7a", "#74c0fc", 3) +
                    line(cx - 15, mid - 6, cx + 15, mid - 6, "#22384d", 1.6) +
                    line(cx - 15, mid, cx + 15, mid, "#22384d", 1.6) +
                    line(cx - 15, mid + 6, cx + 15, mid + 6, "#22384d", 1.6));
      case "gas":
        return wrap(circle(cx, mid, 19, "#c0563a", "#f0b400", 3) +
                    line(cx - 15, mid - 6, cx + 15, mid - 6, "#7a3b28", 1.6) +
                    line(cx - 15, mid, cx + 15, mid, "#7a3b28", 1.6) +
                    line(cx - 15, mid + 6, cx + 15, mid + 6, "#7a3b28", 1.6));
      case "soil":
        return wrap(rect(cx - 12, mid - 15, 8, 32, 2, "#c9a227", "#7a5f10", 1.5) +
                    rect(cx + 4, mid - 15, 8, 32, 2, "#c9a227", "#7a5f10", 1.5));
      case "water":
        return wrap(rect(cx - 10, mid - 17, 20, 34, 2, "#1b3d55", "#5b8dd6", 1.6) +
                    line(cx - 5, mid - 12, cx - 5, mid + 12, "#c9a227", 2.4) +
                    line(cx + 5, mid - 12, cx + 5, mid + 12, "#c9a227", 2.4) +
                    '<path d="M' + (cx + 17) + " " + (mid - 10) + 'q6 8 0 12q-6-4 0-12z" fill="#74c0fc"/>');
      case "steam":
        return wrap(rect(cx - 14, mid + 6, 28, 10, 2, "#1b3d55", "#5b8dd6", 1.6) +
                    '<g stroke="#a5d8ff" stroke-width="2.4" fill="none" stroke-linecap="round">' +
                    '<path d="M' + (cx - 7) + " " + (mid + 2) + 'q-5 -7 0 -13q5 -6 0 -9"/>' +
                    '<path d="M' + (cx + 7) + " " + (mid + 2) + 'q-5 -7 0 -13q5 -6 0 -9"/></g>');
      case "dust":
        return wrap(rect(cx - 20, mid - 15, 40, 30, 4, "#3a4250", "#8b95a3") +
                    circle(cx + 7, mid, 7.5, "#1b2029", "#9ca3af", 1.5) +
                    line(cx - 28, mid - 6, cx - 20, mid - 6, "#74c0fc", 2) +
                    line(cx - 28, mid, cx - 18, mid, "#74c0fc", 2) +
                    line(cx - 28, mid + 6, cx - 20, mid + 6, "#74c0fc", 2));
      case "line":
        return wrap(rect(cx - 18, mid - 14, 36, 16, 2, "#22262e", "#8b95a3", 1.6) +
                    circle(cx - 7, mid - 6, 4, "#4a3a1a", "#c9a227", 1.4) +
                    circle(cx + 7, mid - 6, 4, "#2b3038", "#8b95a3", 1.4) +
                    rect(cx - 20, mid + 8, 40, 8, 1, "#0b0e13"));
      case "hall":
        return wrap('<path d="M' + (cx - 14) + " " + (mid + 16) + "v-12a14 14 0 0 1 28 0v12h-8v-12a6 6 0 0 0-12 0v12z\" fill=\"#e03131\" stroke=\"#8a1a1a\" stroke-width=\"1.6\"/>" +
                    rect(cx - 14, mid + 12, 8, 6, 1, "#cbd5e1") + rect(cx + 6, mid + 12, 8, 6, 1, "#cbd5e1"));
      case "reed":
        return wrap(rect(cx - 20, mid - 7, 40, 14, 7, "#dbe4ee", "#8b95a3", 1.6) +
                    line(cx - 18, mid, cx - 2, mid - 2, "#4b5563", 2.2) +
                    line(cx + 18, mid, cx + 2, mid + 2, "#4b5563", 2.2));
      case "crash":
        return wrap(rect(cx - 6, mid + 2, 14, 14, 2, "#3a4250", "#8b95a3", 1.6) +
                    '<path d="M' + (cx - 6) + " " + (mid + 2) + "q-14 -14 22 -18\" stroke=\"#cbd5e1\" stroke-width=\"2.4\" fill=\"none\"/>");
      case "shock":
        return wrap(rect(cx - 5, mid + 6, 10, 12, 2, "#3a4250", "#8b95a3", 1.5) +
                    '<path d="M' + cx + " " + (mid + 6) + 'l-8 -5l16 -5l-16 -5l16 -5l-8 -4" fill="none" stroke="#cbd5e1" stroke-width="2.4" stroke-linejoin="round"/>');
      case "knock":
        return wrap(circle(cx - 4, mid, 13, "#c9a227", "#7a5f10") + circle(cx - 4, mid, 6.5, "#e9edf3") +
                    '<g stroke="#74c0fc" stroke-width="2" fill="none" stroke-linecap="round">' +
                    '<path d="M' + (cx + 13) + " " + (mid - 7) + 'q6 7 0 14"/><path d="M' + (cx + 20) + " " + (mid - 12) + 'q10 12 0 24"/></g>');
      case "photo":
        return wrap('<path d="M' + (cx - 15) + " " + (mid - 15) + 'h11v9h-11z" fill="#2b3038" stroke="#8b95a3" stroke-width="2"/>' +
                    '<path d="M' + (cx - 15) + " " + (mid + 6) + 'h11v9h-11z" fill="#2b3038" stroke="#8b95a3" stroke-width="2"/>' +
                    line(cx - 15, mid - 6, cx - 15, mid + 6, "#8b95a3", 2) +
                    '<path d="M' + (cx - 9) + " " + (mid - 4) + 'v8" stroke="#ff6b6b" stroke-width="2.4" stroke-dasharray="2 3"/>' +
                    rect(cx + 4, mid - 11, 8, 22, 2, "#4a5462"));
      case "press":
        return wrap(rect(cx - 20, mid + 2, 40, 8, 4, "#c9a227", "#7a5f10", 1.6) +
                    '<path d="M' + cx + " " + (mid - 16) + 'v10m-5 -5l5 5l5 -5" stroke="#4b5563" stroke-width="2.4" fill="none" stroke-linecap="round"/>');

      /* ── 조작 ── */
      case "joystick":
        return wrap(rect(cx - 19, mid - 3, 38, 19, 3, "#1b2029", "#8b95a3") +
                    rect(cx - 2.5, mid - 15, 5, 13, 0, "#4a5462") +
                    circle(cx, mid - 17, 9.5, "#3a4250", "#9ca3af"));
      case "touch":
        return wrap(rect(cx - 17, mid - 13, 34, 26, 4, "#2b3038", "#8b95a3") +
                    circle(cx, mid, 8.5, "none", "#74c0fc") + circle(cx, mid, 3.5, "#74c0fc"));
      case "tilt":
        return wrap('<g transform="rotate(-22 ' + cx + " " + mid + ')">' +
                    rect(cx - 17, mid - 7, 34, 14, 7, "#dbe4ee", "#8b95a3", 1.6) +
                    circle(cx + 8, mid, 4.5, "#4b5563") + "</g>");
      case "irrecv":
        return wrap('<path d="M' + (cx - 12) + " " + (mid + 11) + 'a12 13 0 0 1 24 0z" fill="#14181f" stroke="#8b95a3" stroke-width="2"/>' +
                    rect(cx - 12, mid + 11, 24, 5, 0, "#2b3038") +
                    line(cx - 22, mid - 9, cx - 16, mid - 5, "#74c0fc", 2) +
                    line(cx + 22, mid - 9, cx + 16, mid - 5, "#74c0fc", 2));

      /* ── 출력·통신 ── */
      case "led3w":
        return wrap(rect(cx - 13, mid - 6, 26, 20, 3, "#8b95a3", "#5c6675", 1.6) +
                    circle(cx, mid - 4, 10, "#fff6d0", "#e8a90c", 2.4) +
                    line(cx, mid - 20, cx, mid - 27, "#e8a90c", 3) +
                    line(cx - 15, mid - 15, cx - 21, mid - 21, "#e8a90c", 3) +
                    line(cx + 15, mid - 15, cx + 21, mid - 21, "#e8a90c", 3));
      case "relay":
        return wrap(rect(cx - 18, mid - 14, 26, 28, 2, "#2b62b8", "#8fb4e8") +
                    rect(cx + 10, mid - 9, 10, 18, 1, "#cbd5e1", "#8b95a3", 1.4) +
                    line(cx - 12, mid - 6, cx - 12, mid + 6, "#dbe4ee", 2) +
                    line(cx - 6, mid - 6, cx - 6, mid + 6, "#dbe4ee", 2) +
                    line(cx, mid - 6, cx, mid + 6, "#dbe4ee", 2));
      case "irsend":
        return wrap('<path d="M' + (cx - 8) + " " + (mid + 11) + 'v-9a8 8 0 0 1 16 0v9z" fill="#cfe3ff" stroke="#5b8dd6" stroke-width="2"/>' +
                    rect(cx - 8, mid + 11, 16, 5, 0, "#8b95a3") +
                    '<g stroke="#8e44ad" stroke-width="2" fill="none" stroke-linecap="round">' +
                    '<path d="M' + (cx - 16) + " " + (mid - 9) + 'q-5 -6 0 -11"/><path d="M' + (cx + 16) + " " + (mid - 9) + 'q5 -6 0 -11"/></g>');
      case "lcd":
        return wrap(rect(6, 6, W - 12, H - 12, 3, "#9fd86a", "#3f6b1f") +
                    '<g fill="#2b4a12"><rect x="' + (W * 0.16) + '" y="' + (H * 0.28) + '" width="' + (W * 0.32) + '" height="' + Math.max(3, H * 0.09) + '" rx="2"/>' +
                    '<rect x="' + (W * 0.53) + '" y="' + (H * 0.28) + '" width="' + (W * 0.24) + '" height="' + Math.max(3, H * 0.09) + '" rx="2"/>' +
                    '<rect x="' + (W * 0.16) + '" y="' + (H * 0.54) + '" width="' + (W * 0.2) + '" height="' + Math.max(3, H * 0.09) + '" rx="2"/>' +
                    '<rect x="' + (W * 0.4) + '" y="' + (H * 0.54) + '" width="' + (W * 0.37) + '" height="' + Math.max(3, H * 0.09) + '" rx="2"/></g>');
      case "bt":
        return wrap(rect(cx - 21, mid - 13, 42, 26, 3, "#1c3d6b", "#5b8dd6") +
                    '<path d="M' + (cx - 7) + " " + (mid - 8) + 'v16l8 -6l-8 -6l8 -6l-8 -4z" fill="#e9edf3"/>' +
                    '<path d="M' + (cx + 11) + " " + (mid - 13) + 'l8 -5l-4 7l6 2l-10 5" fill="none" stroke="#74c0fc" stroke-width="2" stroke-linejoin="round"/>');

      default:  /* 교사가 직접 만든 부품 */
        return wrap(rect(8, 10, W - 16, H - 20, 4, "#39414d", "#8b95a3") + circle(cx, mid, 9, "#5c6675"));
    }
  }

  function byId(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  /* 역할 이름 — 화면·인쇄물에서 같은 말을 쓰도록 한곳에 모았다 */
  var ROLE_NAME = {
    vcc: "전원(+)", gnd: "접지(−)", sig: "신호",
    sda: "I2C 자료(SDA)", scl: "I2C 신호(SCL)"
  };

  /* 조사 붙이기 — 「초음파 센서 은」 같은 말이 학생 화면·인쇄물에 그대로 나갔다.
     부품 이름을 교사가 직접 적을 수 있으니 반드시 계산해서 붙인다.
     받침이 있으면 앞쪽(은·이·을·과), 없으면 뒤쪽(는·가·를·와). */
  /*        영 일 이 삼 사 오 육 칠 팔 구  — 받침이 있으면 1 (영·일·삼·육·칠·팔) */
  var DIGIT_JONG = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
  function josa(word, pair) {
    var s = String(word == null ? "" : word).trim();
    var a = pair.charAt(0), b = pair.charAt(1);
    if (!s) return b;
    var ch = s.charCodeAt(s.length - 1);
    if (ch >= 0xac00 && ch <= 0xd7a3) return ((ch - 0xac00) % 28) ? a : b;   /* 한글 */
    if (ch >= 0x30 && ch <= 0x39) return DIGIT_JONG[ch - 0x30] ? a : b;      /* 숫자 */
    return b;   /* 영문·기호는 «는» 쪽으로 둔다 */
  }

  g.Parts = {
    list: PARTS, byId: byId, face: face, GROUPS: GROUPS,
    COLORS: COLORS, SIG_COLORS: SIG_COLORS, wireColor: wireColor,
    ROLE_NAME: ROLE_NAME, josa: josa
  };
  /* Node 에서도 불러 쓸 수 있게 한다 — tools/검사/verify_parts.cjs 가 사전을 검사한다 */
  if (typeof module === "object" && module.exports) module.exports = g.Parts;
})(typeof window !== "undefined" ? window : globalThis);
