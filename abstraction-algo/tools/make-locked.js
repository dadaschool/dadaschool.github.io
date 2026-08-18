/* =========================================================
   make-locked.js — 학습지 원문에서 «공개용 문항»과 «잠긴 정답»을 만든다

   사용법 (앱 폴더에서) :
     node tools/make-locked.js <1차시 정답코드> <2차시 정답코드> <교사코드>
     node tools/make-locked.js algo2026 golden2026 gje-algo-2026-teacher

   무엇이 만들어지나

     tools/spec1.src.js  ─┐                    ┌─→ js/spec1.js   (문항만 · 공개)
     tools/spec2.src.js  ─┤ 이 파일이 읽어서   ├─→ js/spec2.js   (문항만 · 공개)
                          └                    └─→ js/locked.js  (정답·해설 암호문)

   ⚠ 원문(tools/ 폴더 전체)은 저장소에 올리지 않는다. `.gitignore` 가 걸러 준다.
      올려 두면 암호화가 아무 의미가 없다.
      (한 번이라도 커밋하면 나중에 지워도 커밋 기록에 영원히 남는다)

   ⚠ 문항을 고칠 때는 **tools/spec*.src.js 만** 고치고 이 스크립트를 다시 돌린다.
      js/spec*.js 를 직접 고치면 다음 실행 때 덮어써진다.

   js/lock.js 와 셈법이 같아야 한다 — PBKDF2-SHA256 20만 회 → AES-GCM 256.
   ========================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");
const subtle = webcrypto.subtle;

const ITER = 200000;
const ROOT = path.join(__dirname, "..");

/* ---------------------------------------------------------
   원문 spec 파일을 읽어 온다 (window.SPEC1 = {...} 형태)
   --------------------------------------------------------- */
function loadSpec(file, name) {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const spec = sandbox.window[name];
  if (!spec) throw new Error(file + " 에서 window." + name + " 을 찾지 못했습니다.");
  return spec;
}

/* ---------------------------------------------------------
   문항을 «공개용»과 «정답»으로 가른다

   공개용 : 화면에 문제를 그리는 데 꼭 필요한 것만
   정답   : a(정답 번호) · accept(인정 답) · sol(해설)
            → 문항 번호를 열쇠로 삼는다(학생이 보는 번호와 같다)
   --------------------------------------------------------- */
const PUBLIC_ITEM_KEYS = ["k", "q", "why", "opts", "ph", "lines", "height", "tone"];

function split(spec) {
  const pub = {
    title: spec.title, subtitle: spec.subtitle, standard: spec.standard,
    filePrefix: spec.filePrefix, footer: spec.footer,
    activities: []
  };
  const answers = {};
  let no = 0;

  spec.activities.forEach(function (act) {
    const pubAct = { step: act.step, title: act.title, intro: act.intro, items: [] };
    act.items.forEach(function (item) {
      const pubItem = {};
      PUBLIC_ITEM_KEYS.forEach(function (k) {
        if (item[k] !== undefined) pubItem[k] = item[k];
      });
      pubAct.items.push(pubItem);

      if (item.k === "info") return;          // 안내 상자는 문항이 아니다
      no++;
      const ans = {};
      if (item.a !== undefined) ans.a = item.a;
      if (item.accept !== undefined) ans.accept = item.accept;
      if (item.sol !== undefined) ans.sol = item.sol;
      answers[String(no)] = ans;
    });
    pub.activities.push(pubAct);
  });

  return { pub, answers, count: no };
}

/* ---------------------------------------------------------
   잠그기 — js/lock.js 의 open() 이 그대로 열 수 있는 모양으로
   --------------------------------------------------------- */
async function seal(value, code) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const base = await subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const b64 = (b) => Buffer.from(b).toString("base64");
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

function indent(obj) {
  return JSON.stringify(obj, null, 2).replace(/\n/g, "\n  ");
}

(async () => {
  const [code1, code2, codeT] = process.argv.slice(2);
  if (!code1 || !code2 || !codeT) {
    console.error("사용법: node tools/make-locked.js <1차시 정답코드> <2차시 정답코드> <교사코드>");
    process.exit(1);
  }
  if (code1 === codeT || code2 === codeT) {
    console.error("[오류] 정답 코드와 교사 코드가 같으면 안 됩니다. 학생이 교사용 자료까지 열게 됩니다.");
    process.exit(1);
  }

  const s1 = split(loadSpec("spec1.src.js", "SPEC1"));
  const s2 = split(loadSpec("spec2.src.js", "SPEC2"));

  /* ① 공개용 문항 파일 두 개 */
  [[1, s1], [2, s2]].forEach(function (pair) {
    const n = pair[0], s = pair[1];
    const out =
`/* =========================================================
   spec${n}.js — ${n}차시 학습지 «문항만» (자동 생성 파일 · 손으로 고치지 말 것)

   정답(a · accept)과 해설(sol)은 여기에 없다.
   js/locked.js 안에 **암호문**으로만 들어 있고, 선생님이 알려 주는
   정답 코드를 넣어야 열린다. 소스를 아무리 봐도 정답을 읽을 수 없다.

   고칠 때는 tools/spec${n}.src.js 를 고치고 다시 만든다 :
     node tools/make-locked.js <1차시코드> <2차시코드> <교사코드>
   ========================================================= */
window.SPEC${n} = ${indent(s.pub)};
`;
    fs.writeFileSync(path.join(ROOT, "js", "spec" + n + ".js"), out, "utf8");
  });

  /* ② 잠긴 정답 파일
        w1 · w2 는 차시별 정답 코드로,
        teacher 는 교사 코드로 두 차시를 한꺼번에 연다. */
  const lockedW1 = await seal(s1.answers, code1);
  const lockedW2 = await seal(s2.answers, code2);
  const lockedT = await seal({ w1: s1.answers, w2: s2.answers }, codeT);

  const out =
`/* =========================================================
   locked.js — 잠긴 정답·해설 (자동 생성 파일 · 손으로 고치지 말 것)

   여기 들어 있는 것은 전부 **암호문**이다.
   코드를 모르면 이 파일을 아무리 들여다봐도 정답을 읽을 수 없다.

     w1      1차시 학습지 정답·해설  — 1차시 정답 코드로 열린다
     w2      2차시 학습지 정답·해설  — 2차시 정답 코드로 열린다
     teacher 두 차시 전부           — 교사 코드로 열린다

   ⚠ fetch 로 읽지 않고 전역 변수로 넣어 둔다.
     그래야 index.html 을 더블클릭(file://)해도 잠금이 동작한다.

   다시 만들려면 : node tools/make-locked.js <1차시코드> <2차시코드> <교사코드>
   코드만 바꾸려면 : tools/lock-maker.html 을 브라우저로 열어도 된다.
   ========================================================= */
window.LOCKED = {
  w1: ${indent(lockedW1)},
  w2: ${indent(lockedW2)},
  teacher: ${indent(lockedT)}
};
`;
  fs.writeFileSync(path.join(ROOT, "js", "locked.js"), out, "utf8");

  console.log("만들었습니다.");
  console.log("  js/spec1.js   1차시 문항 " + s1.count + "개 (정답 없음)");
  console.log("  js/spec2.js   2차시 문항 " + s2.count + "개 (정답 없음)");
  console.log("  js/locked.js  정답 암호문 3덩이");
  console.log("");
  console.log("  1차시 정답 코드 :", code1);
  console.log("  2차시 정답 코드 :", code2);
  console.log("  교사 코드       :", codeT);
  console.log("");
  console.log("  ⚠ tools/ 폴더는 저장소에 올리지 마세요(.gitignore 가 막고 있습니다).");
})();
