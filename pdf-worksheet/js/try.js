/* =========================================================
   try.js — 기기 시험용 화면  (ES 모듈)
   ---------------------------------------------------------
   왜 이 화면이 있는가
     학생 화면(index.html)은 노션에서 활동지를 받아오므로 **Worker 설정이 끝나야**
     쓸 수 있다. 그런데 «펜이 잘 써지는가 · 손바닥 무시가 되는가 · 글씨 굵기가
     알맞은가» 는 **실제 태블릿·크롬북에서** 확인해야 알 수 있다.
     그래서 설정과 무관하게 **내 PDF 를 골라 써 보고 내려받는** 화면을 따로 두었다.

   ⚠ 개인정보 : 이 화면은 이름·학번을 묻지 않고, 파일을 어디에도 보내지 않는다.
     PDF 는 브라우저 안에서만 열리고, 결과도 내 기기로 내려받을 뿐이다.

   viewer.js·ink.js 를 학생 화면과 **똑같이** 쓴다 — 그래야 여기서 확인한 것이
   실제 수업에서도 그대로 나온다.
   ========================================================= */

import { createViewer } from "./viewer.js?v=202608191953";

const $ = (id) => document.getElementById(id);

let srcBytes = null;
let srcName = "활동지.pdf";
let store = null;
let viewer = null;

function busy(title, msg, closable) {
  $("busyTitle").textContent = title;
  $("busyMsg").innerHTML = msg || "";
  $("busyClose").style.display = closable ? "" : "none";
  $("busyVeil").classList.add("on");
}
function busyOff() { $("busyVeil").classList.remove("on"); }

function note(text, kind) {
  const el = $("msg");
  el.className = "hint" + (kind ? " " + kind : "");
  el.innerHTML = text;
  el.style.display = "";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ---------------------------------------------------------
   PDF 고르기
   --------------------------------------------------------- */
$("file").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (f.size > 40 * 1024 * 1024) {
    note("파일이 너무 큽니다 (" + Math.round(f.size / 1024 / 1024) + "MB).", "bad");
    return;
  }
  srcName = f.name || "활동지.pdf";
  busy("활동지를 여는 중…", '<span class="spin"></span>');

  try {
    srcBytes = new Uint8Array(await f.arrayBuffer());
  } catch (err) {
    busy("파일을 읽지 못했습니다", esc(err.message), true);
    return;
  }

  /* 파일마다 따로 보관한다 (새로고침해도 살아남게).
     ⚠ sessionStorage 라 탭을 닫으면 사라진다 — 공용 기기에 남지 않게. */
  store = new window.Ink.Store("try:" + srcName + ":" + f.size);
  const restored = store.load();

  /* ⚠ 쓰기 화면을 **먼저** 켠다. 숨어 있으면 stage.clientWidth 가 0 이라
     «화면 폭에 맞추기» 가 우표만큼 작게 계산된다. */
  $("p1").classList.remove("on");
  $("p3").classList.add("on");
  $("badge").textContent = srcName;

  try {
    viewer = await createViewer({
      stage: $("stage"), pageBox: $("pageBox"),
      pdfCanvas: $("pdfCanvas"), inkCanvas: $("inkCanvas"), liveCanvas: $("liveCanvas"),
      store: store,
      onChange: refresh
    });
    const pages = await viewer.load(srcBytes);
    busyOff();
    refresh();
    if (restored) {
      busy("아까 쓰던 것이 남아 있습니다", "이어서 써 보세요.", true);
    } else if (pages > 1) {
      busy(pages + "쪽입니다", "위쪽 <strong>▶</strong> 로 쪽을 넘길 수 있습니다.", true);
    }
  } catch (err) {
    $("p3").classList.remove("on");
    $("p1").classList.add("on");
    const enc = /password|encrypt/i.test(err.message || "");
    busy("열지 못했습니다",
      enc ? "이 PDF 에는 <strong>암호가 걸려 있습니다.</strong> 암호 없는 PDF 로 다시 해 보세요."
          : esc(err.message || "알 수 없는 오류"), true);
  }
});

function refresh() {
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
   내려받기 — 학생 화면의 «내기» 와 **같은 코드**로 PDF 를 만든다
   --------------------------------------------------------- */
async function save() {
  if (!store || store.isEmpty()) {
    busy("아직 아무것도 쓰지 않았습니다", "펜으로 조금 써 본 뒤에 눌러 주세요.", true);
    return;
  }
  busy("PDF 를 만드는 중…", '<span class="spin"></span>');
  let out;
  try {
    out = await window.Ink.stamp(srcBytes, store.strokes, window.PDFLib);
  } catch (e) {
    busy("만들지 못했습니다", esc(e.message), true);
    return;
  }

  const base = srcName.replace(/\.pdf$/i, "");
  const name = base + "_손글씨시험.pdf";
  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* 곧바로 지우면 아직 내려받는 중일 수 있다 */
  setTimeout(() => URL.revokeObjectURL(url), 60000);

  busy("💾 내려받았습니다",
    "<strong>" + esc(name) + "</strong> · " + Math.round(blob.size / 1024) + " KB<br>" +
    "<small style='color:var(--sub)'>그 파일을 열어 글씨가 제자리에 있는지, " +
    "원본 글자가 선명한지 확인해 주세요.</small>", true);
}

/* ---------------------------------------------------------
   단추 연결 (학생 화면과 같다)
   --------------------------------------------------------- */
function pickOne(list, on) { list.forEach((el) => el.classList.toggle("on", el === on)); }

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
    viewer.setTool("pen"); pickOne(toolBtns, $("tPen"));
  };
});

const wBtns = Array.from(document.querySelectorAll(".wbtn"));
const widths = { "1": 0.9, "2": 1.5, "3": 2.6 };
wBtns.forEach((b) => {
  b.onclick = () => { viewer.setWidth(widths[b.dataset.w]); pickOne(wBtns, b); };
});

$("bUndo").onclick = () => viewer.undo();
$("bRedo").onclick = () => viewer.redo();
$("bClear").onclick = () => { if (confirm("이 쪽에 쓴 것을 전부 지울까요?")) viewer.clearPage(); };
$("zIn").onclick = () => viewer.zoomIn();
$("zOut").onclick = () => viewer.zoomOut();
$("zFit").onclick = () => viewer.fit();
$("bSave").onclick = save;
$("busyClose").onclick = busyOff;

window.addEventListener("keydown", (e) => {
  if (!viewer) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) viewer.redo(); else viewer.undo();
  }
});
