/* ============================================================
   Studio — 제출 (차시별 «응용» / 26차시 «캡스톤»)

   기본(mode 없음) : 이번 차시 기본 코드에서 «바꾸거나 더한 것» + 코드 캡처 → PDF (가볍게)
   mode:"capstone"  : 문제·설계·동작·배운 점까지 담은 작품 제출 → PDF

   · 개인정보(학년·반·번호·이름)는 PDF 만드는 순간에만 받는다.  · 저장하지 않는다.
   · 제출은 submit() 하나 — 지금은 내려받기. 교내 서버가 생기면 여기만 바꾼다.

   Studio.mount(hostEl, cfg)   cfg = { n, title, hint, mode }
   ============================================================ */
(function (g) {
  "use strict";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fileToCanvas(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1400 / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        var x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        done(c);
      };
      img.onerror = function () { done(null); };
      img.src = r.result;
    };
    r.onerror = function () { done(null); };
    r.readAsDataURL(file);
  }

  function mount(host, cfg) {
    cfg = cfg || {};
    var cap = cfg.mode === "capstone";
    host.innerHTML = "";
    host.className = "studio";

    host.appendChild(el("div", "ex", cap
      ? "내 <b>작품</b>을 설명서와 함께 제출합니다. 무엇을 왜 만들었고, 어떻게 동작하는지 적어요."
      : "이번 차시 <b>기본 코드에서 내가 바꾸거나 더한 것</b>만 올리면 됩니다. 처음부터 설계하는 작품은 <b>26차시</b>에서 해요."));

    function fld(labelHtml, inner) {
      var d = el("div", "fld");
      d.appendChild(el("label", null, labelHtml));
      d.appendChild(inner);
      return d;
    }
    function ta(ph) { var t = el("textarea"); t.placeholder = ph || ""; return t; }
    function line(ph) { var i = el("input"); i.type = "text"; i.className = "wide"; i.placeholder = ph || ""; return i; }
    function picker(accept, multi) {
      var i = el("input"); i.type = "file"; i.accept = accept || "image/*"; if (multi) i.multiple = true;
      var thumbs = el("div", "thumbs");
      var store = { list: [], one: null };
      i.onchange = function () {
        store.list = []; store.one = null; thumbs.innerHTML = "";
        Array.prototype.forEach.call(i.files, function (f) {
          fileToCanvas(f, function (c) {
            if (!c) return;
            if (multi) store.list.push(c); else store.one = c;
            var im = new Image(); im.src = c.toDataURL("image/png"); thumbs.appendChild(im);
          });
        });
      };
      return { input: i, thumbs: thumbs, store: store };
    }

    /* ── 입력칸 ─────────────────────────────────────────── */
    var f = {};
    if (cap) {
      f.name = line("예) 계단 조명 도우미");
      f.problem = ta("예) 밤에 계단이 어두워 넘어질 뻔한 적이 있다. 스위치가 멀다.");
      f.parts = line("예) PIR 인체감지, 조도 센서, LED 모듈");
      f.how = ta("입력 → 판단 → 출력 순서로.\n예) 어둡고(조도<300) 사람이 있으면(PIR=1) LED 를 5초 켠다.");
      f.learn = ta("예) 두 조건을 and 로 묶는 법을 알았다. 기준값을 우리 집에 맞게 여러 번 고쳤다.");
    } else {
      f.change = ta(cfg.hint || "예) 유지시간을 5초로 늘렸다 / 부저로 딩동 소리를 더했다 / 인사말을 바꿨다");
      f.why = line("예) 사람이 지나가고 나서도 잠깐 켜져 있게 하고 싶어서");
    }
    var code = picker("image/*", true);
    var photo = picker("image/*", false);

    if (cap) {
      host.appendChild(fld("작품 이름", f.name));
      host.appendChild(fld("어떤 문제(불편)를 풀었나요", f.problem));
      host.appendChild(fld("사용한 센서·출력", f.parts));
      host.appendChild(fld("어떻게 동작하나요 (입력 → 판단 → 출력)", f.how));
      host.appendChild(fld("이 프로젝트에서 배운 점 · 아쉬운 점", f.learn));
    } else {
      host.appendChild(fld("내가 바꾸거나 더한 것", f.change));
      host.appendChild(fld("왜 그렇게 했나요 <span class=\"pm\">(선택)</span>", f.why));
    }
    var cf = el("div", "fld");
    cf.appendChild(el("label", null, "코드 캡처 <span class=\"pm\">— 메이크코드·엔트리 화면을 캡처해 올려요 (여러 장 가능)</span>"));
    cf.appendChild(code.input); cf.appendChild(code.thumbs);
    host.appendChild(cf);
    var pf = el("div", "fld");
    pf.appendChild(el("label", null, (cap ? "회로·시연 사진" : "실행 모습·회로 사진") + " <span class=\"pm\">(선택)</span>"));
    pf.appendChild(photo.input); pf.appendChild(photo.thumbs);
    host.appendChild(pf);

    var bar = el("div", "row"); bar.style.marginTop = "6px";
    var btn = el("button", "pri big", cap ? "📄 작품 PDF 내려받기" : "📄 제출용 PDF 내려받기");
    btn.type = "button";
    bar.appendChild(btn);
    bar.appendChild(el("span", "pm", "PDF 를 만들 때만 학년·반·번호·이름을 물어봅니다. 저장하지 않아요."));
    host.appendChild(bar);

    /* ── 제출 ───────────────────────────────────────────── */
    function submit(info) {
      var K = window.PdfKit;
      var doc = K.createDoc({
        title: (cfg.n ? cfg.n + "차시 · " : "") + (cap ? "나만의 작품" : "나만의 응용"),
        subtitle: cfg.title || "",
        meta: { grade: info.grade, cls: info.cls, num: info.num, name: info.name, when: info.when },
        footer: "센서 공작소"
      });
      if (cap) {
        doc.h1("작품 이름").box(null, f.name.value.trim() || "(제목 없음)");
        doc.h1("어떤 문제를 풀었나").box(null, f.problem.value.trim());
        doc.h1("사용한 센서·출력").box(null, f.parts.value.trim());
        doc.h1("어떻게 동작하나 (입력 → 판단 → 출력)").box(null, f.how.value.trim());
        doc.h1("배운 점 · 아쉬운 점").box(null, f.learn.value.trim());
      } else {
        doc.h1("내가 바꾸거나 더한 것").box(null, f.change.value.trim());
        if (f.why.value.trim()) doc.h1("왜 그렇게 했나").box(null, f.why.value.trim());
      }
      doc.h1("코드");
      if (code.store.list.length) code.store.list.forEach(function (c) { doc.img(c, { maxH: 780 }); });
      else doc.p("(코드 캡처를 올리지 않았습니다)", { color: K.COLORS.faint });
      if (photo.store.one) { doc.h1(cap ? "회로·시연 사진" : "실행 모습·회로 사진"); doc.img(photo.store.one, { maxH: 780 }); }

      var pages = doc.finish();
      var prefix = (cap ? "작품" : "응용") + (cfg.n || "");
      K.downloadBlob(K.buildPdf(pages), K.makeFileName(prefix, info));
      K.toast((cap ? "작품" : "제출용") + " PDF 를 내려받았습니다. 선생님께 제출하세요.");
    }

    btn.onclick = function () {
      var need = cap ? (f.name.value.trim() && f.problem.value.trim() && f.how.value.trim())
                     : f.change.value.trim();
      if (!need) {
        window.PdfKit.toast(cap ? "작품 이름·문제·동작 설명을 적어 주세요." : "바꾸거나 더한 것을 한 줄이라도 적어 주세요.", "no");
        return;
      }
      window.PdfKit.askStudentInfo({ okText: "PDF 만들기" }, submit);
    };

    return { destroy: function () { host.innerHTML = ""; } };
  }

  g.Studio = { mount: mount };
})(window);
