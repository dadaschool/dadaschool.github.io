/* =========================================================
   pc.js — 컴퓨터 엔진 (boot-flow)
   ---------------------------------------------------------
   이 파일은 «화면» 을 전혀 모른다. 학생이 한 일(전원 켜기, 키 누르기,
   아이콘 누르기 …)을 받아서, 그때 컴퓨터 안에서 데이터가 어디서 어디로
   움직이는지를 «한 걸음(hop)» 씩 적은 목록으로 돌려준다.
   화면(js/sim.js)은 그 목록을 받아 차례로 움직여 보여 줄 뿐이다.
   → 그래서 브라우저 없이 node 로 검사할 수 있다(tools/검사/verify_pc.cjs).

   한 걸음(hop)에 담기는 것
     path   : 데이터가 지나는 부품 이름 목록. 한 개면 «그 자리에서 일함»
     stage  : 입력 · 처리 · 저장 · 출력   (교과서 19쪽 그림 Ⅰ-5)
     layer  : 지금 일하는 층 — hw(하드웨어) · os(운영체제) · app(응용 소프트웨어)
     os     : 지금 쓰이는 운영체제 기능 — 교과서 28~29쪽의 여섯 가지
     boot   : 부팅 몇 번째 단계인가 (교과서 20쪽 그림 Ⅰ-6 의 ➊~➎)
     shut   : 종료 몇 번째 단계인가 (교과서 22쪽 «종료의 과정» 1~4)
     data   : 움직이는 데이터에 붙일 이름표
     msg    : 학생에게 보여 줄 설명
     fail   : 여기서 막혔다(✗) — 보통 도착한 부품에, failAt 이 있으면 그 부품에 ✗
     view   : 이 걸음이 끝났을 때 화면에 보여 줄 모습(스냅숏)
     ev     : 이 걸음이 끝났을 때 일어난 일(미션 확인용)

   🔴 모니터에 보이는 것은 «모니터로 가는 걸음» 이 도착했을 때만 바뀐다.
      그래야 «출력» 이 무엇인지 화면이 거짓말하지 않는다.
      (hop() 안의 shown 갱신 — 이 규칙을 깨지 말 것)
   ========================================================= */
(function (root) {
  "use strict";

  /* ---------------------------------------------------------
     부품 — 이름은 동아출판 교과서 1단원의 용어를 그대로 쓴다
     --------------------------------------------------------- */
  var NODES = {
    PSU:   { name: "전원 공급 장치", kind: "전원" },
    ROM:   { name: "롬(ROM)", kind: "기억 장치" },
    SPK:   { name: "스피커", kind: "출력 장치" },
    KBD:   { name: "키보드", kind: "입력 장치" },
    MOUSE: { name: "마우스", kind: "입력 장치" },
    USB:   { name: "USB 단자", kind: "주변 장치 연결" },
    CPU:   { name: "중앙 처리 장치(CPU)", kind: "처리 장치" },
    RAM:   { name: "주기억 장치(RAM)", kind: "기억 장치" },
    SSD:   { name: "보조 기억 장치", kind: "기억 장치" },
    MON:   { name: "모니터", kind: "출력 장치" }
  };

  /* 응용 소프트웨어 — mem 은 주기억 장치 칸 수(1칸 = 1GB), cpu 는 CPU 이용률(%) */
  var APPS = {
    notepad:  { name: "메모장",      icon: "📝", mem: 1, cpu: 1 },
    game:     { name: "게임",        icon: "🎮", mem: 2, cpu: 35 },
    music:    { name: "음악",        icon: "🎵", mem: 1, cpu: 6 },
    explorer: { name: "파일 탐색기", icon: "📁", mem: 1, cpu: 2 },
    taskmgr:  { name: "작업 관리자", icon: "📊", mem: 1, cpu: 3 }
  };
  var APP_ORDER = ["notepad", "game", "music", "explorer", "taskmgr"];

  /* 주기억 장치 8칸 중 운영체제가 3칸.
     🔴 이 숫자를 바꾸면 «프로그램 다섯 개를 다 열면 메모리 부족» 이 깨진다.
        (3 + 1+2+1+1+1 = 9 > 8 → 다섯 번째에서 부족. 넷까지는 들어간다.)
        학습지 14번(작업 관리자 문항)의 정답도 이 숫자에서 나온다. */
  var RAM_TOTAL = 8, OS_MEM = 3, OS_CPU = 4, OS_PROCS = 46;
  var PASSWORD = "1234";

  var OSFN = {
    ui:   "사용자 인터페이스 제공",
    dev:  "주변 장치 관리",
    sec:  "보안 관리",
    mem:  "메모리 관리",
    file: "파일 관리",
    proc: "프로세스 관리"
  };
  var OSFN_ORDER = ["ui", "dev", "sec", "mem", "file", "proc"];

  /* 교과서 20쪽 «부팅의 과정» 을 거의 그대로 옮겼다 */
  var BOOT_STEPS = [
    "전원 공급이 안정적인지 확인하고 중앙 처리 장치(CPU)가 활성화된다",
    "롬(ROM)에 저장된 바이오스(BIOS)를 실행한다",
    "바이오스가 하드웨어를 점검하고, 부팅 프로그램을 램(RAM)으로 가져온다",
    "부팅 프로그램이 보조 기억 장치의 운영체제를 램으로 가져온다",
    "운영체제가 실행된다"
  ];
  /* 교과서 22쪽 «종료의 과정» */
  var SHUT_STEPS = [
    "사용자가 종료 명령을 실행한다",
    "운영체제가 실행 중인 응용 소프트웨어와 작업을 모두 종료한다",
    "운영체제가 하드웨어 상태를 점검하고 필요한 정보를 보조 기억 장치에 저장한다",
    "주기억 장치에서 운영체제가 사라지면서 컴퓨터가 종료된다"
  ];

  /* 고장 진단 실험실의 고장 다섯 가지 */
  var FAULTS = {
    ram: { name: "주기억 장치(RAM) 빠짐", icon: "🧠", part: "RAM",
           where: "하드웨어 점검(부팅 ➌)",
           why: "전원과 바이오스는 켜졌지만, 하드웨어를 점검하다 주기억 장치가 없어 멈췄습니다. " +
                "부팅 프로그램과 운영체제를 올려 둘 곳이 없으니 더 나아갈 수 없습니다. " +
                "아직 화면을 쓸 수 없어서 바이오스가 <b>삐 소리</b>로 알려 줍니다." },
    ssd: { name: "보조 기억 장치 없음", icon: "💽", part: "SSD",
           where: "부팅 장치 찾기(부팅 ➌)",
           why: "점검은 통과했지만 부팅 프로그램이 들어 있는 <b>보조 기억 장치</b>를 찾지 못했습니다. " +
                "그래서 «부팅 장치를 찾을 수 없습니다» 가 나오고 멈춥니다." },
    os:  { name: "운영체제가 지워짐", icon: "🪟", part: "SSD",
           where: "운영체제 가져오기(부팅 ➍)",
           why: "부팅 프로그램까지는 실행됐지만, 보조 기억 장치에 <b>운영체제가 없어</b> 주기억 장치로 가져올 것이 없습니다. " +
                "운영체제가 없으면 로그인 화면도, 바탕 화면도 없습니다 — 컴퓨터를 쓸 수 없습니다." },
    mon: { name: "모니터 연결 끊김", icon: "🖥", part: "MON",
           where: "출력(모니터로 가는 길)",
           why: "컴퓨터 안에서는 운영체제까지 <b>모두 실행됐습니다</b>(시작 소리가 났죠). " +
                "출력 장치인 <b>모니터로 신호가 가지 못할 뿐</b>입니다. 모니터는 «신호 없음» 만 보여 줍니다." },
    kbd: { name: "키보드 고장", icon: "⌨", part: "KBD",
           where: "입력(키보드에서 CPU 로 가는 길)",
           why: "부팅은 끝까지 되지만 입력 장치인 <b>키보드의 신호가 CPU 까지 오지 않습니다</b>. " +
                "점검 화면에 경고가 뜨고, 로그인에서 비밀번호를 칠 수 없습니다. " +
                "마우스는 멀쩡하니 운영체제가 주는 <b>화상 키보드</b>를 마우스로 눌러 들어갈 수 있습니다." }
  };
  var FAULT_ORDER = ["ram", "ssd", "os", "mon", "kbd"];

  var SYS_FILES = ["부팅 프로그램", "운영체제", "메모장", "게임", "음악", "파일 탐색기", "작업 관리자"];

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  /* =========================================================
     컴퓨터 하나 만들기
     ========================================================= */
  function create(opt) {
    opt = opt || {};
    var s;          // 상태
    var hops;       // 이번 행동이 만든 걸음들

    function fresh(faults) {
      var f = {};
      FAULT_ORDER.forEach(function (k) { f[k] = !!(faults && faults[k]); });
      s = {
        faults: f,
        power: false,
        phase: "off",          // off · post · boot · login · desktop · stuck
        stuck: null,           // 어디서 멈췄나 (고장 키)
        post: [],              // 점검 화면 글줄
        ram: [],               // 주기억 장치 안의 덩어리 {id, name, size}
        files: [               // 보조 기억 장치의 «내 파일»
          { name: "수행평가 계획.txt", text: "정보 수행평가: 생활 속 컴퓨팅 시스템 조사", mine: false },
          { name: "출처 모를 파일.exe", danger: true }
        ],
        trash: [],
        usb: false,
        usbFiles: [{ name: "발표 자료.txt", text: "우리 모둠 발표: 운영체제의 역할" }],
        printer: false,
        apps: [],              // 실행 중인 응용 소프트웨어 (연 순서)
        focus: null,           // 앞에 떠 있는 창
        note: { text: "", saved: "", file: null },
        game: { x: 1, y: 0, star: true, score: 0 },
        pw: "", pwMsg: "", osk: false,
        ui: "gui",             // gui · cui · nui
        dialog: null,          // {then: "close"|"shutdown"}
        notice: null,          // {kind, text}
        search: null,
        memFull: false,
        boots: 0,
        lastPrint: null,
        shown: { phase: "off" }   // 지금 모니터에 보이는 것 — MON 으로 가는 걸음에서만 바뀐다
      };
      return s;
    }

    /* ---------- 계산 ---------- */
    function memUsed() {
      var u = 0;
      s.ram.forEach(function (b) { u += b.size; });
      return u;
    }
    function taskNumbers() {
      var cpu = OS_CPU;
      s.apps.forEach(function (a) { cpu += APPS[a].cpu; });
      var used = memUsed();
      return {
        running: s.apps.map(function (a) { return APPS[a].name; }),
        cpu: cpu,
        procs: OS_PROCS + s.apps.length,
        total: RAM_TOTAL, used: used, free: RAM_TOTAL - used
      };
    }
    function dirty() { return s.apps.indexOf("notepad") >= 0 && s.note.text !== s.note.saved; }
    function osRunning() { return s.power && (s.phase === "login" || s.phase === "desktop"); }

    /* ---------- 모니터와 보드의 모습(스냅숏) ---------- */
    function monitorView() {
      return clone({
        phase: s.phase, stuck: s.stuck, post: s.post,
        pwLen: s.pw.length, pwMsg: s.pwMsg, osk: s.osk, ui: s.ui,
        apps: s.apps, focus: s.focus,
        note: { text: s.note.text, dirty: s.note.text !== s.note.saved, file: s.note.file },
        game: s.game,
        files: s.files.map(function (f) { return { name: f.name, danger: !!f.danger, mine: !!f.mine }; }),
        trash: s.trash.map(function (f) { return f.name; }),
        usb: s.usb, usbFiles: s.usbFiles.map(function (f) { return { name: f.name }; }),
        printer: s.printer, search: s.search, dialog: s.dialog, notice: s.notice,
        tm: taskNumbers()
      });
    }
    function boardView() {
      return clone({
        power: s.power, phase: s.phase,
        ram: s.ram, ramTotal: RAM_TOTAL,
        sys: SYS_FILES.filter(function (n) { return !(n === "운영체제" && s.faults.os); }),
        files: s.files.map(function (f) { return f.name; }),
        usb: s.usb, printer: s.printer,
        apps: s.apps, focus: s.focus, ui: s.ui,
        faults: s.faults
      });
    }
    function snapshot() { return { board: boardView(), mon: clone(s.shown) }; }

    /* ---------- 한 걸음 만들기 ---------- */
    function hop(o) {
      o.path = o.path || (o.to && o.to !== o.from ? [o.from, o.to] : [o.from]);
      delete o.from; delete o.to;
      var end = o.path[o.path.length - 1];
      if (end === "MON" && o.path.length > 1) {
        /* 🔴 모니터에 보이는 것은 여기서만 바뀐다 */
        if (s.faults.mon) o.fail = true;
        else s.shown = monitorView();
      }
      if (o.monOff) s.shown = { phase: "off" };
      o.view = snapshot();
      if (o.sound) o.view.sound = o.sound;
      if (o.printed) o.view.printed = o.printed;
      hops.push(o);
      return o;
    }
    function ev(o, e) { o.ev = (o.ev || []).concat([e]); return o; }
    function lastHop() { return hops[hops.length - 1]; }

    /* =======================================================
       전원 켜기 — 부팅 (교과서 20쪽 그림 Ⅰ-6)
       ======================================================= */
    function boot() {
      s.boots++;
      s.power = true; s.phase = "post"; s.post = []; s.stuck = null;
      s.ram = []; s.apps = []; s.focus = null; s.notice = null; s.dialog = null;
      s.pw = ""; s.pwMsg = ""; s.osk = false; s.search = null; s.memFull = false;
      s.note = { text: "", saved: "", file: null };
      s.game = { x: 1, y: 0, star: true, score: 0 };

      hop({ from: "PSU", stage: "입력", layer: "hw", boot: 1, data: "⚡ 전원 켜짐",
            msg: "전원 버튼을 눌렀습니다. 전원 공급 장치가 모든 부품에 전기를 보내기 시작합니다." });
      hop({ from: "PSU", to: "CPU", stage: "처리", layer: "hw", boot: 1, data: "⚡ 전원 정상",
            msg: "전원 공급이 안정적인지 확인한 뒤, 중앙 처리 장치(CPU)가 깨어나 일할 준비를 합니다." });
      hop({ from: "ROM", to: "CPU", stage: "처리", layer: "hw", boot: 2, data: "바이오스(BIOS)",
            msg: "CPU 는 가장 먼저 롬(ROM)에 저장된 바이오스(BIOS)를 실행합니다. " +
                 "롬은 전원이 꺼져도 내용이 지워지지 않아서, 켤 때마다 늘 같은 곳에서 시작할 수 있습니다." });

      /* --- 하드웨어 점검 --- */
      if (s.faults.ram) {
        s.phase = "stuck"; s.stuck = "ram";
        hop({ from: "CPU", to: "RAM", stage: "처리", layer: "hw", boot: 3, data: "점검 신호", fail: true,
              msg: "바이오스가 하드웨어를 점검합니다. 그런데 주기억 장치(RAM)가 대답하지 않습니다!" });
        return ev(hop({ from: "CPU", to: "SPK", stage: "출력", layer: "hw", boot: 3, data: "삐— 삐— 삐—",
              sound: "삐— 삐— 삐—",
              msg: "주기억 장치가 없으면 화면조차 쓸 수 없습니다. 바이오스는 스피커로 «삐» 소리를 내서 알리고 멈춥니다." }),
              { ev: "stuck", where: "ram" });
      }
      s.post.push("주기억 장치(RAM) 8GB ……… 확인");
      hop({ from: "CPU", to: "RAM", stage: "처리", layer: "hw", boot: 3, data: "점검 신호",
            msg: "바이오스가 하드웨어를 점검합니다. 주기억 장치(RAM) 8GB — 정상입니다." });

      if (s.faults.kbd) {
        s.post.push("⚠ 키보드를 찾을 수 없습니다");
        hop({ from: "CPU", to: "KBD", stage: "처리", layer: "hw", boot: 3, data: "점검 신호", fail: true,
              msg: "키보드가 대답하지 않습니다. 입력 장치에 문제가 있다는 경고를 남기고 점검을 계속합니다." });
      } else {
        s.post.push("키보드 ……… 확인");
        hop({ from: "CPU", to: "KBD", stage: "처리", layer: "hw", boot: 3, data: "점검 신호",
              msg: "키보드(입력 장치) — 정상입니다." });
      }

      if (s.faults.ssd) {
        s.post.push("부팅 장치를 찾을 수 없습니다.");
        s.post.push("보조 기억 장치가 연결되어 있는지 확인하세요.");
        s.phase = "stuck"; s.stuck = "ssd";
        hop({ from: "CPU", to: "SSD", stage: "처리", layer: "hw", boot: 3, data: "부팅 장치 찾기", fail: true,
              msg: "부팅 프로그램이 들어 있는 보조 기억 장치를 찾습니다. 그런데 보조 기억 장치가 없습니다!" });
        return ev(hop({ from: "CPU", path: ["CPU", "MON"], stage: "출력", layer: "hw", boot: 3, data: "오류 글",
              msg: "바이오스는 «부팅 장치를 찾을 수 없다» 는 글을 화면에 띄우고 멈춥니다." }),
              { ev: "stuck", where: "ssd" });
      }
      s.post.push("보조 기억 장치 ……… 확인");
      hop({ from: "CPU", to: "SSD", stage: "처리", layer: "hw", boot: 3, data: "부팅 장치 찾기",
            msg: "보조 기억 장치 — 찾았습니다. 여기에 부팅 프로그램과 운영체제가 들어 있습니다." });

      hop({ from: "CPU", to: "MON", stage: "출력", layer: "hw", boot: 3, data: "점검 결과",
            msg: s.faults.mon
              ? "점검 결과를 모니터로 보내려 했지만 신호가 가지 않습니다."
              : "점검 결과를 화면에 보여 줍니다." });

      /* --- 부팅 프로그램 --- */
      s.ram.push({ id: "boot", name: "부팅 프로그램", size: 1 });
      hop({ from: "SSD", to: "RAM", stage: "저장", layer: "hw", boot: 3, data: "부팅 프로그램",
            msg: "바이오스가 보조 기억 장치에 있는 부팅 프로그램을 주기억 장치(RAM)로 가져옵니다. " +
                 "CPU 는 주기억 장치에 올라온 프로그램만 실행할 수 있기 때문입니다." });
      s.phase = "boot";
      hop({ from: "RAM", to: "CPU", stage: "처리", layer: "hw", boot: 4, data: "부팅 프로그램 실행",
            msg: "CPU 가 부팅 프로그램을 실행합니다. 부팅 프로그램이 할 일은 단 하나 — 운영체제를 불러오는 것입니다." });

      if (s.faults.os) {
        s.phase = "stuck"; s.stuck = "os";
        s.post = ["운영체제를 찾을 수 없습니다.", "보조 기억 장치에 운영체제를 다시 설치해야 합니다."];
        hop({ from: "SSD", to: "RAM", stage: "저장", layer: "hw", boot: 4, data: "운영체제?", fail: true, failAt: "SSD",
              msg: "보조 기억 장치에서 운영체제를 찾았지만 없습니다! 주기억 장치로 가져올 것이 없습니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "hw", boot: 4, data: "오류 글",
              msg: "부팅 프로그램은 «운영체제를 찾을 수 없다» 는 글을 띄우고 멈춥니다. 운영체제가 없으면 컴퓨터를 쓸 수 없습니다." }),
              { ev: "stuck", where: "os" });
      }

      s.ram.push({ id: "os", name: "운영체제", size: OS_MEM });
      hop({ from: "SSD", to: "RAM", stage: "저장", layer: "hw", boot: 4, data: "운영체제",
            msg: "부팅 프로그램이 보조 기억 장치에 있는 운영체제를 주기억 장치(RAM)로 가져옵니다." });

      s.ram = s.ram.filter(function (b) { return b.id !== "boot"; });
      s.phase = "login";
      hop({ from: "RAM", to: "CPU", stage: "처리", layer: "os", boot: 5, data: "운영체제 실행",
            msg: "운영체제가 실행됩니다. 이제부터는 운영체제가 컴퓨터 전체를 관리합니다. " +
                 "할 일을 마친 부팅 프로그램은 주기억 장치에서 빠집니다." });
      hop({ from: "CPU", to: "SPK", stage: "출력", layer: "os", boot: 5, data: "♪ 시작 소리", sound: "♪ 시작 소리",
            msg: "운영체제가 시작 소리를 냅니다." });
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", boot: 5, data: "로그인 화면",
            msg: s.faults.mon
              ? "운영체제가 로그인 화면을 보냈지만 모니터로 가는 길이 끊겨 있습니다."
              : "운영체제가 로그인 화면을 보여 줍니다. 부팅이 끝났습니다!" }),
            { ev: "booted" });
    }

    /* 운영체제가 없는 상태(점검 중 · 멈춤)에서 전원 버튼 → 바로 끈다 */
    function hardOff() {
      s.power = false; s.phase = "off"; s.ram = []; s.apps = []; s.focus = null; s.stuck = null; s.post = [];
      return ev(hop({ from: "PSU", stage: "처리", layer: "hw", data: "전원 끔", monOff: true,
            msg: "운영체제가 실행되지 않은 상태라 종료 과정 없이 전원을 바로 끕니다." }), { ev: "off" });
    }

    /* =======================================================
       종료 (교과서 22쪽 «종료의 과정»)
       ======================================================= */
    function shutdown() {
      s.dialog = null;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", shut: 1, data: "⏻ 종료 명령",
            msg: "사용자가 종료 명령을 실행했습니다." });
      if (!s.apps.length) {
        hop({ from: "CPU", stage: "처리", layer: "os", os: "proc", shut: 2, data: "작업 확인",
              msg: "운영체제가 실행 중인 응용 소프트웨어가 있는지 확인합니다 — 없습니다." });
      }
      s.apps.slice().reverse().forEach(function (a) {
        var lost = a === "notepad" && dirty();
        s.apps = s.apps.filter(function (x) { return x !== a; });
        s.ram = s.ram.filter(function (b) { return b.id !== a; });
        hop({ from: "CPU", to: "RAM", stage: "처리", layer: "os", os: "proc", shut: 2,
              data: APPS[a].name + " 종료",
              msg: "운영체제가 실행 중인 「" + APPS[a].name + "」을(를) 종료합니다. 주기억 장치에서 사라집니다." +
                   (lost ? " 저장하지 않은 글도 함께 사라졌습니다!" : "") });
      });
      s.focus = null;
      s.note = { text: "", saved: "", file: null };
      hop({ from: "CPU", to: "SSD", stage: "저장", layer: "os", os: "file", shut: 3, data: "설정·기록",
            msg: "운영체제가 장치 상태를 점검하고, 다음에 켤 때 필요한 정보를 보조 기억 장치에 저장합니다." });
      s.ram = [];
      hop({ from: "CPU", to: "RAM", stage: "처리", layer: "os", os: "mem", shut: 4, data: "운영체제 내리기",
            msg: "주기억 장치에서 운영체제가 사라집니다." });
      s.power = false; s.phase = "off"; s.post = []; s.pw = ""; s.pwMsg = ""; s.osk = false;
      s.notice = null; s.search = null; s.memFull = false;
      return ev(hop({ from: "PSU", stage: "처리", layer: "hw", shut: 4, data: "전원 끔", monOff: true,
            msg: "전원 공급이 멈춥니다. 주기억 장치(RAM)는 텅 비었지만, 보조 기억 장치의 파일은 그대로 남아 있습니다." }),
            { ev: "shutdown" });
    }

    function power() {
      if (!s.power) return boot();
      if (osRunning()) {
        if (s.phase === "desktop" && dirty()) {
          s.dialog = { then: "shutdown" };
          hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "⏻ 종료 명령",
                msg: "사용자가 종료 명령을 실행했습니다." });
          return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "확인 창",
                msg: "메모장에 저장하지 않은 글이 있어, 운영체제가 끄기 전에 물어봅니다." });
        }
        return shutdown();
      }
      return hardOff();
    }

    /* =======================================================
       키보드 (화상 키보드는 마우스로 누르므로 src = "MOUSE")
       ======================================================= */
    var KEYNAME = { "←": "← 방향키", "→": "→ 방향키", " ": "스페이스 바", "⌫": "지우기", "⏎": "Enter" };
    function keyLabel(ch) { return KEYNAME[ch] || "‘" + ch + "’"; }

    function key(ch, src) {
      src = src || "KBD";
      var lab = keyLabel(ch);
      if (src === "KBD" && s.faults.kbd) {
        return ev(hop({ from: "KBD", stage: "입력", layer: "hw", data: lab + " ✗", fail: true,
              msg: "키를 눌렀지만 키보드가 고장 나서 신호가 나가지 않습니다. CPU 는 아무것도 받지 못했습니다." }),
              { ev: "kbd-dead" });
      }
      if (!s.power) {
        return hop({ from: src, stage: "입력", layer: "hw", data: lab, fail: true,
              msg: "컴퓨터가 꺼져 있어서 키 신호를 받을 곳이 없습니다." });
      }
      var inMsg = src === "MOUSE"
        ? "화상 키보드의 " + lab + " 을(를) 마우스로 눌렀습니다. 마우스 신호가 CPU 로 들어갑니다."
        : "키보드에서 " + lab + " 키를 눌렀습니다. 키 신호가 CPU 로 들어갑니다.";
      var inHop = { from: src, to: "CPU", stage: "입력", layer: "hw", os: "dev", data: lab + " 신호", msg: inMsg };

      if (!osRunning()) {
        hop(inHop);
        return hop({ from: "CPU", stage: "처리", layer: "hw", data: "받을 곳 없음",
              msg: "아직 운영체제가 실행되지 않아서 이 키를 받아 줄 프로그램이 없습니다." });
      }

      if (s.phase === "login") return loginKey(ch, inHop);

      /* 바탕 화면 */
      if (s.dialog) {
        hop(inHop);
        return hop({ from: "CPU", stage: "처리", layer: "os", os: "ui", data: "확인 창 먼저",
              msg: "운영체제가 띄운 확인 창이 먼저입니다. 창의 단추를 눌러 주세요." });
      }
      if (s.focus === "notepad") return noteKey(ch, inHop);
      if (s.focus === "game") return gameKey(ch, inHop);
      hop(inHop);
      return hop({ from: "CPU", stage: "처리", layer: "os", data: "받을 프로그램 없음",
            msg: "운영체제가 이 키를 누구에게 줄지 찾았지만, 앞에 떠 있는 창이 키를 쓰지 않습니다. 메모장이나 게임을 앞에 띄워 보세요." });
    }

    function loginKey(ch, inHop) {
      if (ch === "⏎") {
        hop(inHop);
        hop({ from: "SSD", to: "CPU", stage: "처리", layer: "os", os: "sec", data: "계정 정보",
              msg: "운영체제가 보조 기억 장치에 저장된 계정 정보와 입력한 비밀번호를 비교합니다." });
        if (s.pw === PASSWORD) {
          s.phase = "desktop"; s.pw = ""; s.pwMsg = ""; s.osk = false; s.notice = null;
          return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "바탕 화면",
                msg: "비밀번호가 맞습니다. 운영체제가 바탕 화면을 보여 줍니다." }), { ev: "login-ok" });
        }
        s.pw = ""; s.pwMsg = "비밀번호가 틀렸습니다. 다시 입력하세요.";
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "sec", data: "들어갈 수 없음",
              msg: "비밀번호가 틀려서 들어갈 수 없습니다. 운영체제의 보안 관리 덕분에 다른 사람이 내 컴퓨터를 함부로 쓸 수 없습니다." }),
              { ev: "login-fail" });
      }
      if (ch === "⌫") {
        s.pw = s.pw.slice(0, -1);
      } else if (ch === "←" || ch === "→" || ch === " ") {
        hop(inHop);
        return hop({ from: "CPU", stage: "처리", layer: "os", data: "쓰지 않는 키",
              msg: "비밀번호 칸에서는 이 키를 쓰지 않습니다." });
      } else if (s.pw.length < 8) {
        s.pw += ch;
      }
      s.pwMsg = "";
      hop(inHop);
      hop({ from: "CPU", stage: "처리", layer: "os", os: "sec", data: "● 로 가리기",
            msg: "운영체제가 비밀번호 칸에 글자를 넣습니다. 옆 사람이 보지 못하게 화면에는 ● 로만 보여 줍니다." });
      return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "●",
            msg: "비밀번호 칸을 화면에 다시 그립니다." });
    }

    function noteKey(ch, inHop) {
      var t = s.note.text;
      if (ch === "⌫") t = t.slice(0, -1);
      else if (ch === "⏎") t += "\n";
      else if (ch === "←" || ch === "→") {
        hop(inHop);
        return hop({ from: "CPU", stage: "처리", layer: ["os", "app"], data: "쓰지 않는 키",
              msg: "이 메모장은 방향키로 커서를 옮기지 않습니다(간단하게 만든 메모장)." });
      } else if (t.length < 80) t += ch;
      s.note.text = t;
      hop(inHop);
      hop({ from: "CPU", stage: "처리", layer: ["os", "app"], data: "글자 덧붙이기",
            msg: "운영체제가 키 신호를 앞에 떠 있는 메모장에게 전달하고, 메모장이 글자를 덧붙입니다." });
      hop({ from: "CPU", to: "RAM", stage: "저장", layer: "app", data: "메모장 글",
            msg: "바뀐 글은 주기억 장치(RAM)에 잠시 보관됩니다. 아직 저장하지 않았으니 전원이 꺼지면 사라집니다." });
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "글자 표시",
            msg: "화면에 글자가 나타납니다." }), { ev: "typed" });
    }

    function gameKey(ch, inHop) {
      var g = s.game, what;
      if (ch === "←" || ch === "→") {
        var nx = Math.max(0, Math.min(9, g.x + (ch === "→" ? 1 : -1)));
        what = nx === g.x ? "벽에 막혀 그대로" : "캐릭터를 " + (ch === "→" ? "오른쪽" : "왼쪽") + "으로 한 칸 이동";
        g.x = nx;
      } else if (ch === " ") {
        g.y = 1; what = "캐릭터 점프";
      } else {
        hop(inHop);
        return hop({ from: "CPU", stage: "처리", layer: ["os", "app"], data: "쓰지 않는 키",
              msg: "게임은 방향키와 스페이스 바만 씁니다." });
      }
      var got = false;
      if (g.star && g.x === 7) { g.star = false; g.score++; got = true; }
      hop(inHop);
      hop({ from: "CPU", stage: "처리", layer: ["os", "app"], data: what,
            msg: "운영체제가 키 신호를 게임에게 전달하고, 게임이 계산합니다 — " + what + "." +
                 (got ? " ⭐ 아이템도 얻었습니다!" : "") });
      hop({ from: "CPU", to: "RAM", stage: "저장", layer: "app", data: "캐릭터 위치",
            msg: "캐릭터의 새 위치를 주기억 장치에 기억해 둡니다." });
      var out = ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "새 화면",
            msg: "바뀐 게임 화면이 모니터에 나타납니다." }), { ev: "game-move" });
      if (g.y) {
        g.y = 0;
        hop({ from: "CPU", stage: "처리", layer: "app", data: "착지",
              msg: "게임이 캐릭터를 다시 땅으로 내립니다." });
        out = hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", data: "새 화면",
              msg: "착지한 모습이 화면에 나타납니다." });
      }
      return out;
    }

    /* =======================================================
       응용 소프트웨어 실행 · 종료 (교과서 21~22쪽)
       ======================================================= */
    function inputHop(via, label) {
      if (via === "cui") {
        if (s.faults.kbd) {
          hop({ from: "KBD", stage: "입력", layer: "hw", data: "명령어 ✗", fail: true,
                msg: "키보드가 고장 나서 명령어를 입력할 수 없습니다." });
          return false;
        }
        hop({ from: "KBD", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "⌨ 명령어 「" + label + "」",
              msg: "키보드로 명령어를 입력했습니다. 글자로 명령하는 방식 — 문자 기반 사용자 인터페이스(CUI)입니다." });
      } else if (via === "nui") {
        hop({ from: "MON", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "👆 터치",
              msg: "손가락으로 화면을 터치했습니다. 몸을 쓰는 방식 — 내추럴 기반 사용자 인터페이스(NUI)입니다. " +
                   "이때 모니터(터치스크린)는 입력 장치이기도 합니다." });
      } else {
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "🖱 " + label + " 누름",
              msg: "마우스로 그림(아이콘)을 눌렀습니다. 그림을 누르는 방식 — 그래픽 기반 사용자 인터페이스(GUI)입니다." });
      }
      return true;
    }

    function open(app, via, fromFile) {
      var A = APPS[app];
      if (!A || s.phase !== "desktop" || s.dialog) return hops;
      via = via || "gui";
      if (!fromFile && !inputHop(via, A.name)) return hops;

      if (s.apps.indexOf(app) >= 0) {
        s.focus = app;
        hop({ from: "CPU", stage: "처리", layer: "os", os: "proc", data: "이미 실행 중",
              msg: "「" + A.name + "」은(는) 이미 실행 중입니다. 운영체제가 그 창을 앞으로 가져옵니다." });
        var again = ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: A.name + " 창",
              msg: "앞으로 가져온 창이 화면에 보입니다." }), { ev: "opened", app: app, via: via, again: true });
        if (app === "taskmgr" && s.apps.length >= 3) ev(again, { ev: "multi", n: s.apps.length - 1 });
        return again;
      }

      if (memUsed() + A.mem > RAM_TOTAL) {
        s.memFull = true;
        s.notice = { kind: "warn", text: "메모리가 부족합니다. 쓰지 않는 프로그램을 닫아 주세요." };
        hop({ from: "CPU", to: "RAM", stage: "처리", layer: "os", os: "mem", data: "빈자리 " + A.mem + "칸?", fail: true,
              msg: "운영체제가 주기억 장치에서 「" + A.name + "」이(가) 쓸 빈자리(" + A.mem + "칸)를 찾았지만 " +
                   (RAM_TOTAL - memUsed()) + "칸밖에 없습니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "mem", data: "메모리 부족",
              msg: "주기억 장치는 크기가 한정되어 있습니다. 운영체제가 «메모리 부족» 을 알립니다." }),
              { ev: "mem-full", app: app });
      }

      hop({ from: "CPU", to: "SSD", stage: "처리", layer: "os", os: "file", data: A.name + " 찾기",
            msg: "운영체제가 보조 기억 장치에서 「" + A.name + "」 프로그램 파일을 찾습니다." });
      s.ram.push({ id: app, name: A.name, size: A.mem });
      hop({ from: "SSD", to: "RAM", stage: "저장", layer: "os", os: "mem", data: A.name + " 프로그램",
            msg: "운영체제가 주기억 장치에 " + A.mem + "칸을 나눠 주고(메모리 관리), " +
                 "「" + A.name + "」을(를) 보조 기억 장치에서 주기억 장치로 옮깁니다." });
      s.apps.push(app); s.focus = app;
      if (app === "notepad" && !fromFile) s.note = { text: "", saved: "", file: null };
      if (app === "game") s.game = { x: 1, y: 0, star: true, score: 0 };
      if (app === "explorer") s.search = null;
      hop({ from: "RAM", to: "CPU", stage: "처리", layer: ["os", "app"], os: "proc", data: A.name + " 실행",
            msg: "CPU 가 주기억 장치에 올라온 「" + A.name + "」을(를) 실행합니다. " +
                 "실행 중인 프로그램(프로세스)이 되었고, 운영체제가 CPU 를 나눠 쓰게 관리합니다." });
      if (app === "music") {
        hop({ from: "CPU", to: "SPK", stage: "출력", layer: "app", data: "♪ 음악", sound: "♪ 음악",
              msg: "음악 프로그램이 스피커로 소리를 내보냅니다." });
      }
      var out = hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: A.name + " 창",
            msg: "운영체제가 「" + A.name + "」 창을 화면에 그려 줍니다." });
      ev(out, { ev: "opened", app: app, via: via });
      if (app === "taskmgr" && s.apps.length >= 3) ev(out, { ev: "multi", n: s.apps.length - 1 });
      return out;
    }

    function close(app, force) {
      var A = APPS[app];
      if (!A || s.apps.indexOf(app) < 0 || s.phase !== "desktop") return hops;
      if (app === "notepad" && dirty() && !force) {
        s.dialog = { then: "close" };
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "✕ 닫기",
              msg: "메모장의 ✕ 를 눌렀습니다." });
        return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "확인 창",
              msg: "저장하지 않은 글이 있어서 운영체제가 닫기 전에 물어봅니다." });
      }
      if (!force) {
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "✕ 닫기",
              msg: "「" + A.name + "」의 ✕ 를 눌렀습니다." });
      }
      var lost = app === "notepad" && dirty();
      s.apps = s.apps.filter(function (x) { return x !== app; });
      s.ram = s.ram.filter(function (b) { return b.id !== app; });
      if (s.focus === app) s.focus = s.apps.length ? s.apps[s.apps.length - 1] : null;
      if (app === "notepad") s.note = { text: "", saved: "", file: null };
      var freed = s.memFull;
      s.memFull = false;
      if (s.notice && s.notice.kind === "warn") s.notice = null;
      hop({ from: "CPU", to: "RAM", stage: "처리", layer: "os", os: "mem", data: A.name + " 지우기",
            msg: "응용 소프트웨어를 끝내면 주기억 장치에서 사라집니다. 운영체제가 그 " + A.mem + "칸을 돌려받아 " +
                 "다른 프로그램이 쓸 수 있게 합니다(메모리 관리)." +
                 (lost ? " 저장하지 않은 글도 함께 사라졌습니다!" : "") });
      var out = ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "창 닫힘",
            msg: "화면에서 「" + A.name + "」 창이 사라집니다." }), { ev: "closed", app: app, lost: lost });
      if (freed) ev(out, { ev: "mem-freed" });
      return out;
    }

    function save() {
      if (s.focus !== "notepad" || s.phase !== "desktop") return hops;
      var name = s.note.file || "내 글.txt";
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "💾 저장 누름",
            msg: "메모장의 💾 저장 단추를 눌렀습니다." });
      var f = null;
      s.files.forEach(function (x) { if (x.name === name) f = x; });
      if (!f) { f = { name: name, mine: true }; s.files.push(f); }
      f.text = s.note.text; f.mine = true; f.savedBoot = s.boots;
      s.note.saved = s.note.text; s.note.file = name;
      s.notice = { kind: "ok", text: "「" + name + "」(으)로 저장했습니다." };
      hop({ from: "RAM", to: "SSD", stage: "저장", layer: "os", os: "file", data: "「" + name + "」",
            msg: "주기억 장치에 있던 글을 보조 기억 장치에 파일로 저장합니다(영구 보관). " +
                 "이제 전원을 꺼도 남습니다. 파일의 이름과 위치는 운영체제가 관리합니다(파일 관리)." });
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "저장됨",
            msg: "«저장했습니다» 를 화면에 보여 줍니다." }), { ev: "saved", file: name });
    }

    function dialog(choice) {
      if (!s.dialog) return hops;
      var then = s.dialog.then;
      if (choice === "cancel") {
        s.dialog = null;
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "취소", msg: "«취소» 를 눌렀습니다." });
        return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "창 닫힘",
              msg: "확인 창을 닫고 하던 일로 돌아갑니다." });
      }
      if (choice === "save") {
        s.dialog = null;
        var keepFocus = s.focus;
        s.focus = "notepad";
        save();
        s.focus = keepFocus;
      } else {
        s.dialog = null;
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "저장 안 함",
              msg: "«저장 안 함» 을 눌렀습니다." });
      }
      if (then === "shutdown") return shutdown();
      return close("notepad", true);
    }

    function print() {
      if (s.focus !== "notepad" || s.phase !== "desktop") return hops;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "🖨 인쇄 누름",
            msg: "메모장의 🖨 인쇄 단추를 눌렀습니다." });
      if (!s.printer) {
        s.notice = { kind: "warn", text: "연결된 프린터가 없습니다." };
        hop({ from: "CPU", to: "USB", stage: "처리", layer: "os", os: "dev", data: "프린터?", fail: true,
              msg: "운영체제가 연결된 프린터를 찾았지만 없습니다." });
        return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "dev", data: "프린터 없음",
              msg: "«연결된 프린터가 없습니다» 를 알립니다. 먼저 프린터를 연결해 보세요." });
      }
      var text = s.note.text || "(빈 종이)";
      s.lastPrint = text;
      hop({ from: "RAM", to: "CPU", stage: "처리", layer: "os", os: "dev", data: "인쇄할 글",
            msg: "운영체제가 주기억 장치의 글을 꺼내, 프린터가 알아듣는 신호로 바꿉니다(주변 장치 관리)." });
      var out = ev(hop({ from: "CPU", to: "USB", stage: "출력", layer: "os", os: "dev", data: "🖨 인쇄 신호",
            printed: text, msg: "인쇄 신호가 USB 단자를 지나 프린터로 갑니다. 종이에 글이 찍힙니다." }),
            { ev: "printed" });
      s.notice = { kind: "ok", text: "인쇄했습니다." };
      hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "인쇄 완료",
            msg: "«인쇄했습니다» 를 화면에 알립니다." });
      return out;
    }

    function device(which) {   // which: "usb" | "printer"
      var nm = which === "usb" ? "USB 메모리" : "프린터";
      var on = !s[which];
      s[which] = on;
      if (!osRunning()) {
        return hop({ from: "USB", stage: "입력", layer: "hw", data: (on ? "🔌 " : "⏏ ") + nm,
              msg: nm + "을(를) " + (on ? "연결했습니다" : "뺐습니다") + ". 지금은 운영체제가 실행되지 않아 알아봐 줄 프로그램이 없습니다." });
      }
      if (!on) {
        s.notice = { kind: "info", text: nm + "이(가) 분리되었습니다." };
        hop({ from: "USB", to: "CPU", stage: "입력", layer: "hw", os: "dev", data: "⏏ 장치 빠짐",
              msg: nm + "을(를) 뺐습니다. «장치가 빠졌다» 는 신호가 CPU 로 갑니다." });
        return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "dev", data: "분리 알림",
              msg: "운영체제가 장치 목록에서 " + nm + "을(를) 지우고 알려 줍니다." });
      }
      hop({ from: "USB", to: "CPU", stage: "입력", layer: "hw", os: "dev", data: "🔌 새 장치",
            msg: nm + "을(를) 연결했습니다. «새 장치가 연결되었다» 는 신호가 CPU 로 갑니다." });
      hop({ from: "SSD", to: "RAM", stage: "저장", layer: "os", os: "dev", data: nm + " 드라이버",
            msg: "운영체제가 어떤 장치인지 알아보고, 그 장치를 다루는 작은 프로그램(장치 드라이버)을 준비합니다." });
      s.notice = { kind: "ok", text: nm + "을(를) 사용할 준비가 되었습니다." };
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "dev", data: "준비 완료",
            msg: "운영체제가 «사용할 준비가 되었습니다» 를 알립니다(주변 장치 관리)." }),
            { ev: which + "-ready" });
    }

    /* =======================================================
       파일 탐색기 (파일 관리 · 보안 관리)
       ======================================================= */
    function findFile(name, onUsb) {
      var list = onUsb ? s.usbFiles : s.files, f = null;
      list.forEach(function (x) { if (x.name === name) f = x; });
      return f;
    }

    function file(op, name, onUsb) {
      if (s.phase !== "desktop" || s.dialog) return hops;
      var store = onUsb ? "USB" : "SSD", where = onUsb ? "USB 메모리" : "보조 기억 장치";

      if (op === "search") {
        hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "🔍 검색",
              msg: "파일 탐색기에서 🔍 «글 파일 찾기» 를 눌렀습니다." });
        s.search = s.files.filter(function (f) { return /\.txt$/.test(f.name); }).map(function (f) { return f.name; });
        hop({ from: "CPU", to: "SSD", stage: "처리", layer: "os", os: "file", data: "*.txt 찾기",
              msg: "운영체제가 보조 기억 장치의 파일 목록을 훑어 글 파일(.txt)만 골라냅니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "찾은 파일 " + s.search.length + "개",
              msg: "찾은 파일을 화면에 표시합니다." }), { ev: "search" });
      }

      var f = findFile(name, onUsb);
      if (!f) return hops;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui",
            data: { open: "📂 열기", copy: "📄 복사", "delete": "🗑 삭제" }[op] || op,
            msg: "파일 탐색기에서 「" + name + "」의 " + ({ open: "열기", copy: "복사", "delete": "삭제" }[op]) + " 를 눌렀습니다." });

      if (op === "copy") {
        var nn = name.replace(/(\.[a-z]+)$/, " - 복사본$1");
        while (findFile(nn, onUsb)) nn = nn.replace(/(\.[a-z]+)$/, " 2$1");
        (onUsb ? s.usbFiles : s.files).push({ name: nn, text: f.text, mine: f.mine, savedBoot: f.savedBoot });
        hop({ from: store, stage: "저장", layer: "os", os: "file", data: "「" + nn + "」",
              msg: "운영체제가 " + where + "에 같은 내용을 가진 파일을 하나 더 만듭니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "목록 새로 고침",
              msg: "파일 목록을 다시 그립니다." }), { ev: "copy" });
      }

      if (op === "delete") {
        if (onUsb) s.usbFiles = s.usbFiles.filter(function (x) { return x !== f; });
        else { s.files = s.files.filter(function (x) { return x !== f; }); s.trash.push(f); }
        if (s.search) s.search = s.search.filter(function (n) { return n !== name; });
        hop({ from: "CPU", to: store, stage: "처리", layer: "os", os: "file", data: "🗑 「" + name + "」",
              msg: onUsb ? "운영체제가 USB 메모리에서 파일을 지웁니다."
                         : "운영체제가 파일을 휴지통으로 옮깁니다. 휴지통을 비우기 전까지는 되살릴 수 있습니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "목록 새로 고침",
              msg: "파일 목록을 다시 그립니다." }), { ev: "delete" });
      }

      /* 열기 */
      if (f.danger) {
        hop({ from: store, to: "CPU", stage: "처리", layer: "os", os: "sec", data: "검사 중…",
              msg: "운영체제의 보안 기능(백신)이 파일을 실행하기 전에 먼저 검사합니다." });
        s.files = s.files.filter(function (x) { return x !== f; });
        s.notice = { kind: "danger", text: "🛡 악성 소프트웨어로 의심되는 파일을 차단하고 격리했습니다." };
        hop({ from: "CPU", stage: "처리", layer: "os", os: "sec", data: "🛡 차단", fail: true,
              msg: "악성 소프트웨어로 의심되어 실행을 막았습니다. 출처를 알 수 없는 파일은 열지 않는 것이 안전합니다." });
        return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "sec", data: "차단 알림",
              msg: "운영체제가 «차단했습니다» 를 알립니다(보안 관리)." }), { ev: "blocked" });
      }

      /* 글 파일 → 메모장으로 연다 */
      if (s.apps.indexOf("notepad") >= 0) {
        if (dirty()) {
          s.notice = { kind: "warn", text: "메모장에 저장하지 않은 글이 있습니다. 먼저 저장하거나 메모장을 닫으세요." };
          hop({ from: "CPU", stage: "처리", layer: "os", os: "proc", data: "메모장 사용 중",
                msg: "메모장이 이미 다른 글을 들고 있습니다." });
          return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "알림",
                msg: "운영체제가 먼저 저장하거나 닫으라고 알립니다." });
        }
        s.focus = "notepad";
      } else {
        s.note = { text: f.text || "", saved: f.text || "", file: onUsb ? null : name };
        var o = open("notepad", "gui", true);
        if (s.apps.indexOf("notepad") < 0) return o;   // 메모리 부족
      }
      s.note = { text: f.text || "", saved: f.text || "", file: onUsb ? null : name };
      hop({ from: store, to: "RAM", stage: "저장", layer: "os", os: "file", data: "「" + name + "」 내용",
            msg: "운영체제가 " + where + "에서 「" + name + "」을(를) 찾아 그 내용을 주기억 장치로 가져옵니다." });
      var out = hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "글 표시",
            msg: "메모장에 파일 내용이 나타납니다." });
      ev(out, { ev: "opened-file", file: name });
      if (f.mine && f.savedBoot < s.boots) ev(out, { ev: "persist", file: name });
      return out;
    }

    function focus(app) {
      if (s.phase !== "desktop" || s.apps.indexOf(app) < 0 || s.dialog) return hops;
      s.focus = app;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "🖱 " + APPS[app].name,
            msg: "아래 작업 표시줄에서 「" + APPS[app].name + "」을(를) 눌렀습니다." });
      var out = hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: APPS[app].name + " 창",
            msg: "운영체제가 그 창을 앞으로 가져옵니다. 다른 프로그램도 닫히지 않고 계속 실행 중입니다." });
      if (app === "taskmgr" && s.apps.length >= 3) ev(out, { ev: "multi", n: s.apps.length - 1 });
      return out;
    }

    function lock() {
      if (s.phase !== "desktop" || s.dialog) return hops;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "🔒 잠금", msg: "🔒 잠금 단추를 눌렀습니다." });
      s.phase = "login"; s.pw = ""; s.pwMsg = ""; s.notice = null;
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "sec", data: "잠금 화면",
            msg: "화면을 잠갔습니다. 실행 중인 프로그램은 주기억 장치에 그대로 있고, 비밀번호를 넣어야 다시 볼 수 있습니다(보안 관리)." }),
            { ev: "lock" });
    }

    function osk() {
      if (s.phase !== "login") return hops;
      s.osk = !s.osk;
      hop({ from: "MOUSE", to: "CPU", stage: "입력", layer: "hw", os: "ui", data: "⌨ 화상 키보드",
            msg: "마우스로 «화상 키보드» 단추를 눌렀습니다." });
      return ev(hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: "화상 키보드",
            msg: s.osk ? "운영체제가 화면에 키보드를 그려 줍니다. 마우스로 누르면 키보드 대신 쓸 수 있습니다."
                       : "화상 키보드를 닫았습니다." }), { ev: "osk" });
    }

    function mode(m) {
      if (["gui", "cui", "nui"].indexOf(m) < 0 || !osRunning()) { if (m) s.ui = m; return hops; }
      s.ui = m;
      return hop({ from: "CPU", to: "MON", stage: "출력", layer: "os", os: "ui", data: m.toUpperCase() + " 화면",
            msg: { gui: "그림(아이콘)과 마우스로 쓰는 화면(GUI)으로 바꿨습니다.",
                   cui: "명령어를 글자로 입력하는 화면(CUI)으로 바꿨습니다.",
                   nui: "손가락으로 터치하는 화면(NUI)으로 바꿨습니다." }[m] });
    }

    /* 부팅을 건너뛰고 바로 바탕 화면 — 운영체제 미션용. 걸음을 만들지 않는다 */
    function quickBoot() {
      var f = s.faults;
      fresh(f);
      if (f.ram || f.ssd || f.os) return snapshot();
      s.boots = 1; s.power = true; s.phase = "desktop";
      s.ram = [{ id: "os", name: "운영체제", size: OS_MEM }];
      if (f.kbd) s.post = ["⚠ 키보드를 찾을 수 없습니다"];
      if (!f.mon) s.shown = monitorView();
      return snapshot();
    }

    /* ---------- 바깥으로 내보내는 손잡이 ---------- */
    function run(fn) {
      return function () {
        hops = [];
        s.notice = null;          // 알림은 다음 행동을 하면 사라진다
        fn.apply(null, arguments);
        return hops;
      };
    }

    fresh(opt.faults);

    return {
      power: run(power),
      key: run(key),
      open: run(open),
      close: run(function (a) { close(a, false); }),
      save: run(save),
      dialog: run(dialog),
      print: run(print),
      device: run(device),
      file: run(file),
      focus: run(focus),
      lock: run(lock),
      osk: run(osk),
      mode: run(mode),
      quickBoot: function () { hops = []; return quickBoot(); },
      reset: function (faults) { fresh(faults); return snapshot(); },
      snapshot: snapshot,
      state: function () { return s; },
      numbers: taskNumbers
    };
  }

  var PC = {
    create: create,
    NODES: NODES, APPS: APPS, APP_ORDER: APP_ORDER,
    OSFN: OSFN, OSFN_ORDER: OSFN_ORDER,
    BOOT_STEPS: BOOT_STEPS, SHUT_STEPS: SHUT_STEPS,
    FAULTS: FAULTS, FAULT_ORDER: FAULT_ORDER,
    RAM_TOTAL: RAM_TOTAL, OS_MEM: OS_MEM, PASSWORD: PASSWORD
  };

  if (typeof module !== "undefined" && module.exports) module.exports = PC;
  else root.PC = PC;
})(this);
