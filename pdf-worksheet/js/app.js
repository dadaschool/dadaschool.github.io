/* =========================================================
   app.js — 학생 화면의 흐름  (ES 모듈)
     ① 반 고르기 → ② 활동지 고르기 → ③ 답 쓰기 → ④ 내기
   ---------------------------------------------------------
   ⚠ 개인정보 — 이 파일이 지키는 규칙
     · 학번·이름은 **내기 창에서 그 순간에만** 받아 곧바로 보내고 버린다.
     · 브라우저에 저장하는 것은 **획 좌표뿐**이고, 그것도 sessionStorage 라
       탭을 닫으면 사라진다(공용 크롬북에서 다음 학생에게 남지 않는다).
     · 학번·이름은 sessionStorage 에 넣지 않는다.
   ========================================================= */

import { createViewer } from "./viewer.js";

const $ = (id) => document.getElementById(id);

let klass = null;         // 고른 반  "1-1"
let task = null;          // 고른 활동지 { id, 이름, 마감 }
let srcBytes = null;      // 원본 활동지 PDF
let store = null;         // Ink.Store
let viewer = null;

/* ---------------------------------------------------------
   화면 바꾸기
   --------------------------------------------------------- */
function step(n) {
  [1, 2, 3].forEach((i) => $("p" + i).classList.toggle("on", i === n));
  [1, 2, 3, 4].forEach((i) => {
    const li = $("s" + i);
    li.classList.toggle("on", i === n);
    li.classList.toggle("done", i < n);
  });
  window.scrollTo(0, 0);
}

function badge(text) { $("badge").textContent = text; }

function busy(title, msg, closable) {
  $("busyTitle").textContent = title;
  $("busyMsg").innerHTML = msg || "";
  $("busyClose").style.display = closable ? "" : "none";
  $("busyVeil").classList.add("on");
}
function busyOff() { $("busyVeil").classList.remove("on"); }

function note(el, text, kind) {
  el.className = "hint" + (kind ? " " + kind : "");
  el.innerHTML = text;
  el.style.display = "";
}

/* 시험 모드면 화면 맨 위에 노란 띠를 띄운다.
   ⚠ 이것이 없어서 «노션에 댓글이 안 달린다» 는 혼란이 실제로 있었다. */
function showDemoBar() {
  if (!window.API.demo) return;
  const el = document.getElementById("demobar");
  if (!el) return;
  el.innerHTML =
    "🧪 <strong>시험 모드입니다 — 노션에 연결되지 않았습니다.</strong> " +
    "여기서 낸 것은 <u>노션 댓글로 가지 않고</u> <code>demo/제출/</code> 폴더에만 저장됩니다.<br>" +
    "보이는 활동지도 <code>demo/</code> 폴더의 PDF 입니다 — 실제 활동지 PDF 를 그 폴더에 넣으면 " +
    "그 파일로 시험할 수 있습니다. 노션에 연결하려면 <code>worker/설치안내.md</code> 를 따라 " +
    "<code>js/config.js</code> 의 <code>WORKER</code> 를 채우세요.";
  el.classList.add("on");
}

/* ---------------------------------------------------------
   ① 반 고르기
   --------------------------------------------------------- */
async function start() {
  /* ⚠ 설정 조합이 원리상 불가능한 경우를 먼저 잡는다
     (예 : 활동지는 드라이브에서 가져오는데 제출은 노션으로) */
  const bad = window.API.configError();
  if (bad) {
    $("classLoading").remove();
    note($("setupHint"), "<strong>설정을 확인해 주세요.</strong><br>" + esc(bad), "bad");
    return;
  }
  if (!window.API.ready()) {
    $("classLoading").remove();
    note($("setupHint"),
      "<strong>아직 활동지를 받아올 수 없습니다.</strong><br>" +
      "선생님께 알려 주세요 — <code>js/config.js</code> 의 <code>WORKER</code> 주소가 비어 있습니다. " +
      "설치 방법은 <code>worker/설치안내.md</code> 에 있습니다." +
      "<br><br>👉 <a href=\"try.html\"><strong>손글씨만 먼저 시험해 보기</strong></a> — " +
      "내 PDF 를 골라 펜이 잘 써지는지 확인할 수 있습니다(설정 없이 됩니다).", "warn");
    return;
  }
  try {
    const list = await window.API.classes();
    showDemoBar();
    const box = $("classes");
    box.innerHTML = "";
    if (!list.length) {
      note($("setupHint"),
        "지금 열려 있는 활동지가 없습니다. 선생님이 노션에서 <strong>반을 고르면</strong> 여기에 나타납니다.", "warn");
      return;
    }
    list.forEach((c) => {
      const b = document.createElement("button");
      b.className = "pick";
      b.textContent = c;
      b.onclick = () => pickClass(c);
      box.appendChild(b);
    });
  } catch (e) {
    $("classLoading").remove();
    note($("setupHint"), "반 목록을 받지 못했습니다.<br>" + esc(e.message), "bad");
  }
}

/* ---------------------------------------------------------
   ② 활동지 고르기
   --------------------------------------------------------- */
async function pickClass(c) {
  klass = c;
  badge(c + "반");
  $("klassName").textContent = c + "반";
  step(2);
  const box = $("tasks");
  box.innerHTML = '<p>불러오는 중 <span class="spin"></span></p>';
  try {
    const list = await window.API.tasks(c);
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<div class="hint warn">지금 <strong>' + esc(c) +
        '반</strong>에 열려 있는 활동지가 없습니다. 선생님께 확인해 주세요.</div>';
      return;
    }
    list.forEach((t) => {
      const b = document.createElement("button");
      b.className = "taskbtn";
      const due = document.createElement("span");
      due.className = "due" + (t.dueMin !== undefined && t.dueMin < 60 ? " soon" : "");
      due.textContent = t.due ? "마감 " + t.due : "마감 시각 없음";
      b.textContent = t.title;
      b.appendChild(due);
      b.onclick = () => openTask(t);
      box.appendChild(b);
    });
  } catch (e) {
    box.innerHTML = '<div class="hint bad">활동지 목록을 받지 못했습니다.<br>' + esc(e.message) + "</div>";
  }
}

/* ---------------------------------------------------------
   ③ 활동지 열기 — PDF 를 받아 화면에 올린다
   --------------------------------------------------------- */
async function openTask(t) {
  task = t;
  busy("활동지를 받는 중…", '<span class="spin"></span>');
  try {
    srcBytes = await window.API.pdf(t.id, klass);
  } catch (e) {
    busy("활동지를 받지 못했습니다", esc(e.message), true);
    return;
  }

  /* 임시 보관 키 — 활동지마다 따로 둔다. 이름·학번은 넣지 않는다. */
  store = new window.Ink.Store("ink:" + t.id);
  const restored = store.load();

  /* ⚠ 쓰기 화면을 **먼저** 켜야 한다.
     숨어 있는 상태에서는 stage.clientWidth 가 0 이라 «화면 폭에 맞추기» 가
     0 으로 계산되고, 쪽이 240px 짜리 우표만큼 작게 나온다(실제로 그랬다). */
  step(3);
  badge(klass + "반 · " + t.title);

  try {
    viewer = await createViewer({
      stage: $("stage"), pageBox: $("pageBox"),
      pdfCanvas: $("pdfCanvas"), inkCanvas: $("inkCanvas"), liveCanvas: $("liveCanvas"),
      store: store,
      onChange: refreshTools
    });
    const pages = await viewer.load(srcBytes);
    busyOff();
    refreshTools();
    if (restored) {
      busy("쓰던 것을 되살렸습니다",
        "아까 쓰던 글씨가 그대로 있습니다. 이어서 쓰세요.<br>" +
        "<small style='color:var(--sub)'>※ 탭을 닫으면 사라집니다. 다 쓰면 꼭 내기를 누르세요.</small>", true);
    } else if (pages > 1) {
      busy("쪽이 " + pages + "쪽입니다",
        "아래 <strong>▶</strong> 로 쪽을 넘기며 답을 쓰세요.<br>" +
        "<small style='color:var(--sub)'>모든 쪽이 한 번에 제출됩니다.</small>", true);
    }
  } catch (e) {
    /* 열지 못했으면 고르기 화면으로 되돌린다 — 빈 쓰기 화면에 갇히지 않게 */
    step(2);
    /* 암호가 걸린 PDF 가 가장 흔한 원인이다 */
    const enc = /password|encrypt/i.test(e.message || "");
    busy("활동지를 열지 못했습니다",
      enc ? "이 PDF 에는 <strong>암호가 걸려 있어</strong> 열 수 없습니다. 선생님께 알려 주세요."
          : esc(e.message || "알 수 없는 오류"), true);
  }
}

/* 도구 막대 상태 갱신 */
function refreshTools() {
  if (!viewer) return;
  $("pInfo").textContent = (viewer.page + 1) + " / " + viewer.pageCount + " 쪽";
  $("pPrev").disabled = viewer.page <= 0;
  $("pNext").disabled = viewer.page >= viewer.pageCount - 1;
  $("bUndo").disabled = store.strokes.length === 0;
  $("bRedo").disabled = store.undone.length === 0;
  $("bClear").disabled = store.countOnPage(viewer.page) === 0;
  $("zFit").textContent = viewer.zoomPercent + "%";
}

/* ---------------------------------------------------------
   ④ 내기
   --------------------------------------------------------- */
function openSubmit() {
  if (store.isEmpty()) {
    busy("아직 아무것도 쓰지 않았습니다", "펜으로 답을 쓴 뒤에 내 주세요.", true);
    return;
  }
  $("subKlass").textContent = klass + "반";
  $("subMsg").style.display = "none";
  $("subVeil").classList.add("on");
  $("subNo").focus();
}

async function doSubmit() {
  const no = parseInt($("subNo").value.trim(), 10);
  const name = $("subName").value.trim();

  if (!isFinite(no) || no < 1 || no > window.CONFIG.MAX_NUMBER) {
    note($("subMsg"), "학번을 1~" + window.CONFIG.MAX_NUMBER + " 사이 숫자로 적어 주세요.", "bad");
    return;
  }
  if (name.length < 2) {
    note($("subMsg"), "이름을 적어 주세요.", "bad");
    return;
  }

  /* task = 저장소가 아는 활동지 id (노션 페이지 id 또는 드라이브 파일 id)
     taskTitle = 드라이브가 **폴더 이름**으로 쓴다. 노션 쪽은 쓰지 않는다. */
  const info = { task: task.id, klass: klass, no: no, name: name, taskTitle: task.title };
  $("subVeil").classList.remove("on");

  /* 이미 낸 것이 있는지 먼저 물어본다 */
  busy("확인하는 중…", '<span class="spin"></span>');
  let already = null;
  try {
    const r = await window.API.check(info);
    already = r.found ? (r.round || 1) : null;
  } catch (e) {
    busy("보내지 못했습니다", esc(e.message), true);
    return;
  }
  if (already) {
    busyOff();
    const ok = confirm("이미 " + already + "번 냈습니다.\n다시 내면 새 제출로 추가됩니다.\n\n계속할까요?");
    if (!ok) { $("subVeil").classList.add("on"); return; }
  }

  /* 원본 PDF 에 손글씨를 새긴다 */
  busy("답안을 만드는 중…", '<span class="spin"></span>');
  let outBytes;
  try {
    outBytes = await window.Ink.stamp(srcBytes, store.strokes, window.PDFLib);
  } catch (e) {
    busy("답안을 만들지 못했습니다", esc(e.message), true);
    return;
  }

  /* 노션에 올릴 때 쓰는 파일 이름(날짜·시각 포함).
     ⚠ 드라이브는 **덮어쓰기**라 날짜가 없는 다른 이름을 쓴다 —
       그 이름은 drive/제출저장.gs 의 제출파일이름() 이 만든다. */
  const filename = makeName(task.title, klass, no, name);

  busy("보내는 중…", '<span class="spin"></span> ' + Math.round(outBytes.length / 1024) + " KB");
  try {
    const r = await window.API.submit(info, outBytes, filename, { taskTitle: task.title });
    store.drop();                       /* 낸 뒤에는 임시 보관을 지운다 */
    /* 어디에 들어갔는지 정확히 알려 준다 (설정에 따라 다르다) */
    const 어디 = window.API.target() === "drive" ? "선생님 구글 드라이브에"
               : window.API.target() === "both" ? "선생님 노션과 구글 드라이브에"
               : "선생님 노션에";
    busy("✅ 냈습니다",
      "<strong>" + esc(klass) + "반 " + no + "번 " + esc(name) + "</strong> · " +
      (r.round || 1) + "번째 제출<br>" +
      "<small style='color:var(--sub)'>" + 어디 + " 들어갔습니다. 이 화면을 닫아도 됩니다." +
      (r.driveError ? "<br>⚠ 드라이브 저장만 실패했습니다 — 선생님께 알려 주세요 (" +
        esc(r.driveError) + ")" : "") +
      "</small>", true);
    $("bSubmit").disabled = true;
  } catch (e) {
    /* 실패해도 획은 그대로 남아 있으니 다시 시도할 수 있다 */
    busy("보내지 못했습니다",
      esc(e.message) + "<br><small style='color:var(--sub)'>쓴 글씨는 그대로 있습니다. " +
      "잠시 뒤 다시 «내기» 를 눌러 주세요.</small>", true);
  }
}

/* 파일 이름 — 다른 앱들과 같은 방식(사람이 읽을 수 있고, 정렬하면 반·학번 순) */
function makeName(taskName, klass, no, name) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  const safe = (s) => String(s).replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 20);
  return safe(taskName) + "_" + klass + "-" + p(no) + "_" + safe(name) + "_" + stamp + ".pdf";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ---------------------------------------------------------
   단추 연결
   --------------------------------------------------------- */
function pickOne(list, on) {
  list.forEach((el) => el.classList.toggle("on", el === on));
}

$("backTo1").onclick = () => { step(1); badge("반을 고르세요"); };
$("restart").onclick = (e) => {
  e.preventDefault();
  if (store && !store.isEmpty() && !confirm("쓰던 글씨가 사라집니다. 처음으로 돌아갈까요?")) return;
  location.reload();
};

$("pPrev").onclick = () => viewer.prev();
$("pNext").onclick = () => viewer.next();

const toolBtns = [$("tPen"), $("tEraser"), $("tPan")];
$("tPen").onclick = () => { viewer.setTool("pen"); pickOne(toolBtns, $("tPen")); };
$("tEraser").onclick = () => { viewer.setTool("eraser"); pickOne(toolBtns, $("tEraser")); };
$("tPan").onclick = () => { viewer.setTool("pan"); pickOne(toolBtns, $("tPan")); };

const colorBtns = [$("cBlack"), $("cRed"), $("cBlue")];
const colors = { cBlack: "#111827", cRed: "#dc2626", cBlue: "#2563eb" };
colorBtns.forEach((b) => {
  b.onclick = () => {
    viewer.setColor(colors[b.id]);
    pickOne(colorBtns, b);
    /* 색을 고르면 펜으로 돌아온다 — 지우개를 켜 둔 채 색만 바꾸는 실수를 막는다 */
    viewer.setTool("pen"); pickOne(toolBtns, $("tPen"));
  };
});

const wBtns = Array.from(document.querySelectorAll(".wbtn"));
const widths = { "1": 0.9, "2": 1.5, "3": 2.6 };   /* PDF 포인트 */
wBtns.forEach((b) => {
  b.onclick = () => { viewer.setWidth(widths[b.dataset.w]); pickOne(wBtns, b); };
});

$("bUndo").onclick = () => viewer.undo();
$("bRedo").onclick = () => viewer.redo();
$("bClear").onclick = () => {
  if (confirm("이 쪽에 쓴 것을 전부 지울까요?")) viewer.clearPage();
};
$("zIn").onclick = () => viewer.zoomIn();
$("zOut").onclick = () => viewer.zoomOut();
$("zFit").onclick = () => viewer.fit();

$("bSubmit").onclick = openSubmit;
$("subCancel").onclick = () => $("subVeil").classList.remove("on");
$("subOk").onclick = doSubmit;
$("subName").addEventListener("keydown", (e) => { if (e.key === "Enter") doSubmit(); });
$("busyClose").onclick = busyOff;

/* 키보드 단축키 (마우스·키보드로 쓰는 경우) */
window.addEventListener("keydown", (e) => {
  if (!viewer || $("subVeil").classList.contains("on")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) viewer.redo(); else viewer.undo();
  }
});

/* 실수로 창을 닫는 것을 막는다 — 안 낸 글씨가 있을 때만 */
window.addEventListener("beforeunload", (e) => {
  if (store && !store.isEmpty() && !$("bSubmit").disabled) {
    e.preventDefault();
    e.returnValue = "";
  }
});

start();
