/* ============================================================
   Worksheet — 학습지 4문항 (개념 정리형 · 자기 확인용)

   제출하면 바로 채점하고 정답·해설을 보여 준 뒤 입력을 잠근다.
   「다시 풀기」로 잠금을 풀 수 있다(자기 확인용이므로 허용).
   교사 정답 코드는 쓰지 않는다.

   문항 모양 — print.js 가 그대로 인쇄할 수 있는 꼴이어야 한다
     { q:"질문", type:"choice", opts:["①감…","②밝…"], a:2, why:"해설" }
       type : "choice"(a=0부터 센 번호) · "ox"(a="O"/"X") · "fill"·"short"(a=문자열 또는 [허용답])
     ⚠ 정답을 `a` 에, 해설을 `why` 에 둔다. print.js 는 `a` 를 지우고 `why` 는 인쇄하지 않는다.
     🚨 선택지(opts)·질문(q)에 정답 표시(<b>·★·(정답))를 넣지 말 것 — 인쇄물에 그대로 나간다.

   Worksheet.mount(hostEl, items) → { submitted(): bool, destroy() }
   ============================================================ */
(function (g) {
  "use strict";

  var NUM = ["①", "②", "③", "④", "⑤", "⑥"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function rich(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }
  function norm(s) { return String(s == null ? "" : s).trim().replace(/\s+/g, "").toLowerCase(); }

  function mount(host, items, opts) {
    opts = opts || {};
    items = items || [];
    host.innerHTML = "";
    host.className = "ws";
    var submitted = false;

    var form = document.createElement("div");
    items.forEach(function (it, i) {
      var q = document.createElement("div");
      q.className = "q";
      q.dataset.i = i;
      var head = '<div class="qt"><b>' + (i + 1) + ".</b> " + rich(it.q) + "</div>";
      var body = "";
      var t = it.type || "choice";
      if (t === "choice") {
        body = '<ul class="opts">' + (it.opts || []).map(function (o, k) {
          return '<li><label><input type="radio" name="w' + i + '" value="' + k + '">' +
                 '<span>' + (NUM[k] || (k + 1)) + " " + rich(o) + "</span></label></li>";
        }).join("") + "</ul>";
      } else if (t === "ox") {
        body = '<ul class="opts">' +
          '<li><label><input type="radio" name="w' + i + '" value="O"><span>O (맞다)</span></label></li>' +
          '<li><label><input type="radio" name="w' + i + '" value="X"><span>X (아니다)</span></label></li>' +
          "</ul>";
      } else {
        body = '<div class="blank"><input type="text" name="w' + i + '" autocomplete="off" ' +
               'placeholder="' + esc(it.ph || "답을 쓰세요") + '"></div>';
      }
      q.innerHTML = head + body + '<div class="fb" hidden></div>';
      form.appendChild(q);
    });
    host.appendChild(form);

    var scoreLine = document.createElement("div");
    scoreLine.className = "score";
    scoreLine.hidden = true;
    host.appendChild(scoreLine);

    var bar = document.createElement("div");
    bar.className = "row";
    bar.style.marginTop = "8px";
    var btnSubmit = document.createElement("button");
    btnSubmit.type = "button";
    btnSubmit.className = "pri big";
    btnSubmit.textContent = "제출하기";
    var btnRetry = document.createElement("button");
    btnRetry.type = "button";
    btnRetry.textContent = "다시 풀기";
    btnRetry.hidden = true;
    bar.appendChild(btnSubmit);
    bar.appendChild(btnRetry);
    host.appendChild(bar);

    function readOne(i) {
      var it = items[i], t = it.type || "choice";
      if (t === "choice" || t === "ox") {
        var sel = host.querySelector('input[name="w' + i + '"]:checked');
        return sel ? sel.value : null;
      }
      var inp = host.querySelector('input[name="w' + i + '"]');
      return inp ? inp.value : "";
    }
    function correct(i) {
      var it = items[i], t = it.type || "choice", v = readOne(i);
      if (v == null || v === "") return false;
      if (t === "choice") return Number(v) === Number(it.a);
      if (t === "ox") return String(v).toUpperCase() === String(it.a).toUpperCase();
      var acc = Array.isArray(it.a) ? it.a : [it.a];
      return acc.some(function (x) { return norm(x) === norm(v); });
    }
    function answerText(i) {
      var it = items[i], t = it.type || "choice";
      if (t === "choice") return (NUM[it.a] || (it.a + 1)) + " " + String(it.opts[it.a] || "");
      if (t === "ox") return String(it.a).toUpperCase();
      return Array.isArray(it.a) ? it.a.join(" / ") : String(it.a);
    }

    function grade() {
      var right = 0;
      items.forEach(function (it, i) {
        var ok = correct(i);
        if (ok) right++;
        var fb = host.querySelector('.q[data-i="' + i + '"] .fb');
        fb.hidden = false;
        fb.className = "fb " + (ok ? "ok" : "no");
        fb.innerHTML = (ok ? "✓ 맞았어요. " : "✗ 정답: <b>" + esc(answerText(i)) + "</b>. ") +
                       (it.why ? rich(it.why) : "");
      });
      scoreLine.hidden = false;
      scoreLine.textContent = "점수 " + right + " / " + items.length;
      host.classList.add("locked");
      submitted = true;
      btnSubmit.hidden = true;
      btnRetry.hidden = false;
      if (opts.onSubmit) opts.onSubmit(right, items.length);
    }
    function retry() {
      host.classList.remove("locked");
      submitted = false;
      scoreLine.hidden = true;
      host.querySelectorAll(".fb").forEach(function (f) { f.hidden = true; f.innerHTML = ""; });
      btnSubmit.hidden = false;
      btnRetry.hidden = true;
    }

    btnSubmit.onclick = function () {
      var answered = items.every(function (it, i) {
        var v = readOne(i);
        return v != null && v !== "";
      });
      if (!answered && !confirm("아직 답하지 않은 문항이 있어요. 그래도 제출할까요?")) return;
      grade();
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    btnRetry.onclick = retry;

    return {
      submitted: function () { return submitted; },
      destroy: function () { host.innerHTML = ""; }
    };
  }

  g.Worksheet = { mount: mount };
})(window);
