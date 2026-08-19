/* =========================================================
   sheet.js — 학습지 공용 엔진

   두 차시의 학습지(worksheet1.html · worksheet2.html)가 같은 규칙으로
   움직이도록 만든 것이다. 각 학습지 파일은 '무엇을 물을지'만 적고,
   화면 만들기 · PDF 저장 · 잠금 · 채점 · 정답 공개는 이 파일이 맡는다.

   ⚠ 흐름이 다른 앱들과 하나 다르다 — **제출 시점에는 채점이 되지 않는다.**

     1  학생이 문항을 작성한다
     2  「PDF로 저장」 → 답이 잠기고 PDF 가 떨어진다 (점수 없음)
     3  수업 끝에 선생님이 **정답 코드**를 칠판에 적어 준다
     4  코드를 넣으면 채점 결과와 문항별 해설이 열리고, 「채점본 PDF」를 받을 수 있다

   왜 이렇게 하나
     GitHub Pages 에는 서버가 없다. 정답을 평문으로 두면 제출 전에 소스에서 다 보인다.
     정답을 **복호화 키로만 열리는 암호문**(js/locked.js)으로 두면 진짜로 못 본다.
     그 대신 채점도 코드가 있어야 된다. 반 전체가 동시에 확인하게 되어 오히려 낫다.
     (mb-bluetooth 와 같은 방식이다)

   개인정보
     학년·반·학번·이름은 PDF 를 만드는 순간에만 물어보고 PDF 안(과 파일 이름)에만 들어간다.
     화면에 쓴 '답안 글'만 sessionStorage 에 임시 보관한다(새로고침 대비).
     탭을 닫으면 사라지며, 이름·학번은 이 보관에서 제외한다.

   문항 종류
     choice  보기 중 하나           정답 : a (번호)
     multi   보기 중 여러 개         정답 : a (번호 배열)
     order   순서대로 배열           정답 : a (보기번호 배열 — 필요한 것만 골라 순서까지)
     short   짧게 쓰기              정답 : accept (인정하는 답 목록)
     text    서술형 (채점 없음)
     draw    손으로 그리기 (채점 없음)
     info    안내 상자 (문항 아님)
   ========================================================= */
(function (global) {
  "use strict";

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function norm(s) {
    return String(s || "").replace(/\s+/g, "").replace(/[.,]/g, "").toLowerCase();
  }

  function build(spec) {
    var host = spec.host;
    var ctrls = [];              /* 문항마다 하나 */
    var submitted = false;       /* PDF 를 냈는가 */
    var answers = null;          /* 잠금이 열리면 여기에 정답이 들어온다 */
    var lastPdf = null, lastName = "";
    var qno = 0;

    var SAVE_KEY = "aa-sheet-" + spec.key;
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(SAVE_KEY) || "{}"); } catch (e) { saved = {}; }
    function store(id, v) {
      saved[id] = v;
      try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) {}
    }

    /* ---------------------------------------------------------
       화면 만들기
       --------------------------------------------------------- */
    spec.activities.forEach(function (act, ai) {
      var card = el("section", "card");
      card.appendChild(el("h2", null, '<span class="step">' + act.step + '</span>' + act.title));
      if (act.intro) card.appendChild(el("p", "lead", act.intro));

      act.items.forEach(function (item, ii) {
        if (item.k === "info") {
          card.appendChild(el("div", item.tone === "warn" ? "warnbox" : "hint", item.q));
          return;
        }

        qno++;
        var id = "a" + ai + "q" + ii;
        var box = el("div", "q");
        box.appendChild(el("h3", null, '<span class="qno">' + qno + '</span><span>' + item.q + '</span>'));
        if (item.why) box.appendChild(el("p", "why", item.why));

        var ctrl = { id: id, item: item, no: qno };
        makeControl(ctrl, box, id, item);
        ctrls.push(ctrl);

        ctrl.note = el("div", "answer-note hidden");
        box.appendChild(ctrl.note);
        card.appendChild(box);
      });

      host.appendChild(card);
    });

    /* ---------------------------------------------------------
       문항 종류별 화면
         ctrl.value()      학생이 고른 값 (채점에 쓴다)
         ctrl.answerText() PDF 에 넣을 글
         ctrl.gradable     자동 채점 대상인가
         ctrl.paint(ans)   정답이 열린 뒤 ○/× 를 칠한다
       --------------------------------------------------------- */
    function makeControl(ctrl, box, id, item) {

      if (item.k === "choice" || item.k === "multi") {
        var chosen = saved[id] != null ? saved[id] : (item.k === "multi" ? [] : null);
        var wrap = el("div", "opts");
        item.opts.forEach(function (o, oi) {
          var b = el("button", "opt");
          b.type = "button";
          b.innerHTML = '<span class="tag">' + (oi + 1) + '</span><span>' + o + '</span>';
          b.addEventListener("click", function () {
            if (submitted) return;
            if (item.k === "multi") {
              var i = chosen.indexOf(oi);
              if (i >= 0) chosen.splice(i, 1); else chosen.push(oi);
            } else {
              chosen = oi;
            }
            store(id, chosen);
            paintChoice();
          });
          wrap.appendChild(b);
        });
        box.appendChild(wrap);

        function paintChoice() {
          wrap.querySelectorAll(".opt").forEach(function (b, oi) {
            var on = item.k === "multi" ? chosen.indexOf(oi) >= 0 : chosen === oi;
            b.classList.toggle("on", on);
          });
        }
        paintChoice();

        ctrl.gradable = true;
        ctrl.value = function () { return chosen; };
        ctrl.answerText = function () {
          if (item.k === "multi") {
            return chosen.length
              ? chosen.slice().sort(function (a, b) { return a - b; })
                  .map(function (i) { return (i + 1) + "번 " + item.opts[i]; }).join(" / ")
              : "";
          }
          return chosen == null ? "" : (chosen + 1) + "번 " + item.opts[chosen];
        };
        ctrl.paint = function (ans) {
          wrap.querySelectorAll(".opt").forEach(function (b, oi) {
            var right = item.k === "multi" ? ans.a.indexOf(oi) >= 0 : ans.a === oi;
            var mine = item.k === "multi" ? chosen.indexOf(oi) >= 0 : chosen === oi;
            b.classList.remove("on");
            if (right) b.classList.add("right");
            else if (mine) b.classList.add("wrong");
          });
        };

      } else if (item.k === "order") {
        var plan = saved[id] ? saved[id].slice() : [];
        box.appendChild(el("p", "minihead", "고를 수 있는 것 — 필요한 것만 골라 순서까지 맞추세요"));
        var pool = el("div", "taskpool");
        box.appendChild(pool);
        box.appendChild(el("p", "minihead", "내가 정한 순서"));
        var list = el("ol", "plan");
        box.appendChild(list);

        function paintOrder() {
          pool.innerHTML = "";
          item.opts.forEach(function (o, oi) {
            var used = plan.indexOf(oi) >= 0;
            var b = el("button", "taskcard" + (used ? " used" : ""), '<span>' + o + '</span>');
            b.type = "button";
            b.disabled = used || submitted;
            b.addEventListener("click", function () { plan.push(oi); store(id, plan); paintOrder(); });
            pool.appendChild(b);
          });

          list.innerHTML = "";
          if (!plan.length) {
            list.appendChild(el("li", "empty", "위에서 눌러 담으세요."));
            return;
          }
          plan.forEach(function (oi, i) {
            var li = el("li", "planitem",
              '<span class="pno">' + (i + 1) + '</span><span class="ptxt">' + item.opts[oi] + '</span>');
            if (!submitted) {
              var tools = el("span", "ptools");
              [["▲", -1], ["▼", 1]].forEach(function (m) {
                var b = el("button", "tinybtn", m[0]);
                b.type = "button";
                b.disabled = (m[1] < 0 && i === 0) || (m[1] > 0 && i === plan.length - 1);
                b.addEventListener("click", function () {
                  var j = i + m[1], t = plan[i]; plan[i] = plan[j]; plan[j] = t;
                  store(id, plan); paintOrder();
                });
                tools.appendChild(b);
              });
              var x = el("button", "tinybtn del", "✕");
              x.type = "button";
              x.addEventListener("click", function () { plan.splice(i, 1); store(id, plan); paintOrder(); });
              tools.appendChild(x);
              li.appendChild(tools);
            }
            list.appendChild(li);
          });
        }
        paintOrder();

        ctrl.gradable = true;
        ctrl.value = function () { return plan; };
        ctrl.answerText = function () {
          return plan.map(function (oi, i) { return (i + 1) + ") " + item.opts[oi]; }).join("  ");
        };
        ctrl.paint = function () { paintOrder(); };

      } else if (item.k === "short") {
        var inp = el("input");
        inp.type = "text";
        inp.placeholder = item.ph || "여기에 답을 쓰세요";
        inp.value = saved[id] || "";
        inp.addEventListener("input", function () { store(id, inp.value); });
        box.appendChild(inp);
        ctrl.gradable = true;
        ctrl.value = function () { return inp.value; };
        ctrl.answerText = function () { return inp.value; };

      } else if (item.k === "text") {
        var ta = el("textarea");
        ta.placeholder = item.ph || "생각을 자유롭게 적어 보세요";
        ta.rows = item.lines || 4;
        ta.value = saved[id] || "";
        ta.addEventListener("input", function () { store(id, ta.value); });
        box.appendChild(ta);
        ctrl.gradable = false;
        ctrl.answerText = function () { return ta.value; };

      } else if (item.k === "draw") {
        var wrap2 = el("div", "padwrap");
        box.appendChild(wrap2);
        /* 손글씨는 용량이 커서 임시 보관하지 않는다(다른 앱과 같은 판단) */
        var padW = item.width || 1400;
        var padH = item.height || 460;
        var pad = PdfKit.createPad(wrap2, { width: padW, height: padH, label: item.q });

        /* ⚠ css/app.css 의 `canvas.pad { aspect-ratio: 1400/420 }` 가 화면 높이를 **고정**한다.
           그래서 height 를 올려도 그리는 칸은 그대로 납작했다(순서도를 그릴 수 없었다).
           여기서 캔버스 실제 크기로 비율을 덮어써서 height 가 진짜로 먹게 한다. */
        pad.canvas.style.aspectRatio = padW + " / " + padH;
        if (item.maxWidth) {
          pad.canvas.style.maxWidth = item.maxWidth + "px";
          pad.canvas.style.margin = "0 auto";
        }

        ctrl.pad = pad;
        ctrl.gradable = false;
        ctrl.answerText = function () { return pad.isEmpty() ? "" : "(그림)"; };
      }
    }

    /* ---------------------------------------------------------
       채점 — 정답이 열린 뒤에만 할 수 있다
       --------------------------------------------------------- */
    function gradeOne(ctrl) {
      if (!ctrl.gradable || !answers) return null;
      var ans = answers[String(ctrl.no)];
      if (!ans) return null;
      var k = ctrl.item.k, v = ctrl.value();

      if (k === "choice") return v === ans.a;
      if (k === "multi") {
        return (ans.a || []).slice().sort().join(",") === (v || []).slice().sort().join(",");
      }
      if (k === "order") return (v || []).join(",") === (ans.a || []).join(",");
      if (k === "short") {
        return (ans.accept || []).some(function (a) { return norm(a) === norm(v); });
      }
      return null;
    }

    function score() {
      var ok = 0, all = 0;
      ctrls.forEach(function (c) {
        if (!c.gradable) return;
        all++;
        if (gradeOne(c)) ok++;
      });
      return { ok: ok, all: all };
    }
    function gradableCount() {
      return ctrls.filter(function (c) { return c.gradable; }).length;
    }

    function answerOf(item, ans) {
      if (!ans) return "";
      if (item.k === "choice") return "정답 " + (ans.a + 1) + "번";
      if (item.k === "multi") return "정답 " + ans.a.map(function (i) { return i + 1; }).join("·") + "번";
      if (item.k === "order") return "정답 " + ans.a.map(function (i) { return item.opts[i]; }).join(" → ");
      if (item.k === "short") return "정답 " + ans.accept[0];
      return "";
    }

    /* 정답이 열린 뒤 각 문항 아래에 ○/× · 정답 · 해설을 편다 */
    function reveal() {
      ctrls.forEach(function (c) {
        var it = c.item;
        var ans = answers[String(c.no)] || {};
        var right = gradeOne(c);
        if (c.paint && right !== null) c.paint(ans);

        var body = "";
        if (right === null) {
          body += "<b>이렇게 볼 수 있습니다</b>";
        } else {
          body += "<b>" + (right ? "○ 맞았습니다" : "× 다시 볼까요") + "</b>";
          if (!right) {
            if (it.k === "choice") body += "정답 : " + (ans.a + 1) + "번 " + it.opts[ans.a] + "<br>";
            else if (it.k === "multi") body += "정답 : " + ans.a.map(function (i) { return (i + 1) + "번 " + it.opts[i]; }).join(", ") + "<br>";
            else if (it.k === "order") body += "정답 순서 : " + ans.a.map(function (i, n) { return (n + 1) + ") " + it.opts[i]; }).join("  ") + "<br>";
            else if (it.k === "short") body += "정답 : " + ans.accept[0] + "<br>";
          }
        }
        body += ans.sol || "";
        c.note.innerHTML = body;
        c.note.className = "answer-note" + (right === false ? " wrong" : "");
      });
    }

    function lock() {
      host.querySelectorAll("input, textarea").forEach(function (n) { n.disabled = true; });
      host.querySelectorAll(".opt, .taskcard, .tinybtn, .pad-btn, .pad-color").forEach(function (n) {
        n.disabled = true;
        n.classList.add("locked-el");
      });
      host.querySelectorAll("canvas.pad").forEach(function (n) { n.style.pointerEvents = "none"; });
    }

    /* ---------------------------------------------------------
       PDF 만들기
         graded = false : 제출본 (점수 없음)
         graded = true  : 채점본 (○/× · 정답 · 해설 표시)
       --------------------------------------------------------- */
    function makeDoc(info, graded) {
      var s = graded ? score() : null;
      var doc = PdfKit.createDoc({
        title: spec.title + (graded ? "  (채점본)" : ""),
        /* 성취기준은 학생 화면·학생이 받는 PDF 에 넣지 않는다 (루트 규칙) */
        subtitle: spec.subtitle,
        meta: {
          grade: info.grade, cls: info.cls, num: info.num, name: info.name, when: info.when,
          right: graded ? ("자동 채점 " + s.ok + " / " + s.all) : "제출본 (채점 전)"
        },
        footer: spec.footer
      });

      var n = 0;
      spec.activities.forEach(function (act) {
        doc.h1(act.title);
        act.items.forEach(function (item) {
          if (item.k === "info") return;
          n++;
          var c = ctrls.filter(function (x) { return x.no === n; })[0];
          doc.h2(n + ". " + item.q);
          if (c.pad) {
            /* 세로로 긴 그림(순서도)은 420 으로 자르면 절반 크기로 줄어든다 */
            doc.img(c.pad.canvas, { maxH: item.pdfMaxH || 420 });
          } else {
            doc.box("내 답", c.answerText(), { minLines: c.gradable ? 1 : 3 });
            if (graded && c.gradable) {
              var right = gradeOne(c);
              var ans = answers[String(c.no)] || {};
              doc.mark(right ? "정답입니다" : "다시 확인해 보세요", right, right ? "" : answerOf(item, ans));
            }
          }
          doc.gap(6);
        });
        doc.gap(10);
      });

      if (!graded) {
        doc.rule();
        doc.p("※ 이 학습지는 제출본입니다. 채점 결과와 해설은 선생님이 알려 주시는 " +
              "정답 코드를 넣으면 화면에서 열리고, 그때 채점본 PDF 를 따로 받을 수 있습니다.",
              { size: 21 });
      }
      return doc;
    }

    /* ---------------------------------------------------------
       제출 = PDF 저장
       --------------------------------------------------------- */
    function savePdf() {
      if (submitted) {
        if (lastPdf) {
          PdfKit.downloadBlob(lastPdf, lastName);
          PdfKit.toast("같은 PDF를 다시 저장했습니다 — " + lastName, "ok");
        }
        return;
      }

      var empty = ctrls.filter(function (c) { return !c.answerText(); }).length;
      if (empty > 0) {
        if (!confirm("아직 " + empty + "문항이 비어 있습니다.\n그대로 PDF를 만들까요?\n\n(PDF를 만들면 답을 고칠 수 없습니다.)")) return;
      }

      PdfKit.askStudentInfo({}, function (info) {
        var doc = makeDoc(info, false);
        var pages = doc.finish();
        lastPdf = PdfKit.buildPdf(pages);
        lastName = PdfKit.makeFileName(spec.filePrefix, info);
        PdfKit.downloadBlob(lastPdf, lastName);
        studentInfo = info;

        submitted = true;
        lock();
        document.body.classList.add("submitted");
        showAfterSubmit();
        PdfKit.toast(pages.length + "쪽 PDF를 저장했습니다 — " + lastName, "ok");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    var studentInfo = null;

    /* 제출한 뒤 위쪽에 뜨는 안내 + 정답 코드 입력칸 */
    function showAfterSubmit() {
      var bar = document.getElementById("scoreBar");
      if (bar) {
        bar.classList.remove("hidden");
        bar.classList.add("waiting");
        bar.innerHTML =
          '<h3>✅ 제출했습니다 — ' + lastName + '</h3>' +
          '<p>답이 잠겼습니다. <b>채점과 해설은 아직 열리지 않았습니다.</b><br>' +
          '수업 끝에 선생님이 알려 주시는 <b>정답 코드</b>를 아래에 넣으면 ' +
          '채점 결과와 문항별 해설이 한꺼번에 열립니다.</p>';
      }
      var lockHost = document.getElementById("lockHost");
      if (!lockHost) return;
      lockHost.classList.remove("hidden");
      Lock.mount(lockHost, {
        box: (global.LOCKED || {})[spec.key],
        title: "정답 · 해설 열기",
        note: "선생님이 칠판에 적어 주시는 코드를 넣으세요.",
        onOpen: onUnlock
      });
    }

    /* 코드가 맞았을 때 — 채점하고 해설을 편다 */
    function onUnlock(unlocked) {
      answers = unlocked;
      reveal();
      var s = score();

      var bar = document.getElementById("scoreBar");
      if (bar) {
        bar.classList.remove("waiting");
        bar.innerHTML =
          '<div class="score-big"><span>자동 채점</span><strong>' + s.ok +
          '</strong><span>/ ' + s.all + ' 문항</span></div>' +
          '<p>각 문항 아래에 <b>정답과 해설</b>이 열렸습니다. 서술형과 그리기는 자동 채점하지 않습니다.<br>' +
          '제출본은 이미 냈고, 아래 단추로 <b>점수가 찍힌 채점본</b>을 따로 받을 수 있습니다.</p>';
      }

      var btn = document.getElementById("gradedPdfBtn");
      if (btn) {
        btn.classList.remove("hidden");
        btn.addEventListener("click", saveGradedPdf);
      }
      var pdfBtn = document.getElementById("pdfBtn");
      if (pdfBtn) pdfBtn.textContent = "📄 제출본 다시 받기";

      PdfKit.toast("정답이 열렸습니다 — 자동 채점 " + s.ok + " / " + s.all, "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function saveGradedPdf() {
      if (!answers) return;
      function go(info) {
        var doc = makeDoc(info, true);
        var pages = doc.finish();
        var blob = PdfKit.buildPdf(pages);
        var name = PdfKit.makeFileName(spec.filePrefix + "채점", info);
        PdfKit.downloadBlob(blob, name);
        PdfKit.toast(pages.length + "쪽 채점본을 저장했습니다 — " + name, "ok");
      }
      /* 제출할 때 적은 정보를 그대로 쓴다. 없으면(새로고침 뒤) 다시 묻는다. */
      if (studentInfo) go(studentInfo);
      else PdfKit.askStudentInfo({ okText: "채점본 만들기" }, go);
    }

    return {
      savePdf: savePdf,
      isSubmitted: function () { return submitted; },
      gradableCount: gradableCount
    };
  }

  global.Sheet = { build: build };
})(window);
