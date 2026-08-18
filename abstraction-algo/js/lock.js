/* =========================================================
   lock.js — 코드로 여는 진짜 잠금

   GitHub Pages 는 서버가 없다. 그래서 "코드를 검사만 하는" 방식은
   개발자 도구나 저장소 소스를 보면 그대로 뚫린다.

   여기서는 코드를 **복호화 키**로 쓴다.
     · 정답·해설은 암호문(AES-GCM)으로만 올라간다
     · 코드를 모르면 소스를 아무리 봐도 읽을 수 없다
     · 브라우저에 들어 있는 Web Crypto 만 쓴다 → 외부 라이브러리 0개

   암호문을 만드는 곳은 tools/lock-maker.html (선생님용) 이다.
   ========================================================= */
(function (global) {
  "use strict";

  var ITER = 200000;          // PBKDF2 반복 횟수. 마구 대입해 보는 것을 느리게 만든다
  var LEN = 256;              // AES-256

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    var s = "";
    var a = new Uint8Array(bytes);
    /* 한 번에 넘기면 수십 KB 에서 스택이 터진다. 8KB 씩 끊어 붙인다. */
    for (var i = 0; i < a.length; i += 8192) {
      s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
    }
    return btoa(s);
  }

  function available() {
    return !!(global.crypto && global.crypto.subtle && global.TextEncoder);
  }

  /* 코드(비밀번호) + 소금 → AES 키 */
  function deriveKey(code, salt, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iter || ITER, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: LEN },
          false,
          ["encrypt", "decrypt"]
        );
      });
  }

  /* 잠긴 꾸러미를 연다. 성공하면 원래 값(객체)을, 코드가 틀리면 예외를 돌려준다. */
  function open(box, code) {
    if (!available()) {
      return Promise.reject(new Error("이 브라우저에서는 잠금을 열 수 없습니다. " +
        "https:// 주소나 파일 더블클릭(file://)으로 열어 주세요."));
    }
    if (!box || !box.ct) return Promise.reject(new Error("잠긴 자료가 없습니다."));
    var salt = b64ToBytes(box.salt);
    var iv = b64ToBytes(box.iv);
    var ct = b64ToBytes(box.ct);
    return deriveKey(code, salt, box.iter)
      .then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      })
      .then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf));
      })
      .catch(function () {
        /* AES-GCM 은 코드가 틀리면 무결성 검사에서 실패한다 → 여기로 온다 */
        throw new Error("코드가 맞지 않습니다.");
      });
  }

  /* 잠글 때 쓴다 (선생님용 도구에서만 부른다) */
  function seal(value, code) {
    if (!available()) return Promise.reject(new Error("이 브라우저에서는 잠글 수 없습니다."));
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(JSON.stringify(value));
    return deriveKey(code, salt, ITER)
      .then(function (key) {
        return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);
      })
      .then(function (ct) {
        return {
          v: 1, iter: ITER,
          salt: bytesToB64(salt), iv: bytesToB64(iv), ct: bytesToB64(ct)
        };
      });
  }

  /* ---------------------------------------------------------
     화면 도구 — 코드 입력 상자를 만들어 준다

       Lock.mount(칸, {
         box: LOCKED.answers,      // 잠긴 꾸러미
         title: "정답·해설 열기",
         note: "선생님이 알려 주는 코드를 넣으세요",
         onOpen: function (값) { ... }
       });
     --------------------------------------------------------- */
  function mount(host, opt) {
    if (!host) return;
    host.innerHTML =
      '<div class="lockbox">' +
      '<div class="mbtitle">🔒 ' + (opt.title || "잠긴 자료") + '</div>' +
      '<p class="tinynote">' + (opt.note || "") + '</p>' +
      '<div class="lockrow">' +
      '<input type="text" class="lk-code" placeholder="코드" autocomplete="off" ' +
      'inputmode="text" spellcheck="false">' +
      '<button class="btn primary lk-go">열기</button>' +
      '</div>' +
      '<p class="res no lk-err" hidden></p>' +
      '</div>';

    var input = host.querySelector(".lk-code");
    var btn = host.querySelector(".lk-go");
    var err = host.querySelector(".lk-err");

    function go() {
      var code = (input.value || "").trim();
      if (!code) { show("코드를 입력하세요."); return; }
      btn.disabled = true;
      btn.textContent = "여는 중…";
      open(opt.box, code).then(function (val) {
        host.innerHTML = "";
        if (opt.onOpen) opt.onOpen(val);
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = "열기";
        show(e.message);
        input.select();
      });
    }

    function show(msg) { err.textContent = msg; err.hidden = false; }

    btn.addEventListener("click", go);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); go(); }
    });
  }

  global.Lock = { open: open, seal: seal, mount: mount, available: available, ITER: ITER };
})(window);
