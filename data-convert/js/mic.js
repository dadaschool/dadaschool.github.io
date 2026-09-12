/* =========================================================
   js/mic.js — 🎤 내 목소리를 디지털로 (소리 변환 ① 아날로그 → 디지털)

   2026-09-09 사용자 요청 : *"자기 목소리를 녹음해서 디지털로 변환하는 기능"*

   ── 왜 «두 화면» 인가 ──────────────────────────────────────
   실제 목소리는 **1초에 44,100번** 읽는다. 그런데 이 앱의 표본화 화면은
   **8초에 5~17개**다. 목소리를 그대로 «0.5초마다 한 번» 읽으면 소리가 전혀 아니다.
   그래서 두 걸음으로 나눈다 —
     ① 큰 그림 : 녹음 전체의 **소리 크기(음량)** 를 그린다 → 내 목소리를 알아본다
     ② 확대    : 그중 한 순간(**10ms**)을 확대한다 → 거기서 **진짜 파형**을 표본화한다
   ②가 교과서 그림 Ⅱ-9 와 같은 일이다. ①은 «어디를 확대할지 고르는 지도» 다.
   🚨 ①을 «파형의 표본화» 라고 말하지 말 것 — 그건 «음량의 표본화» 다. 화면이 그렇게 적는다.

   ── 개인정보 ───────────────────────────────────────────────
   🔒 **녹음은 브라우저 밖으로 나가지 않는다.** 파일로 만들지도, 저장하지도 않는다
      (`localStorage`·`sessionStorage`·`indexedDB`·네트워크 **0**). 새로고침하면 사라진다.
      `photo-extractor` 가 얼굴 사진을 다루는 원칙과 같다.

   ── 🚨 마이크는 HTTPS 에서만 열린다 ─────────────────────────
   `getUserMedia` 는 **보안 맥락**(https 또는 localhost)에서만 된다.
     ✅ https://dadaschool.github.io/…  ·  https://geoje.edudadat.workers.dev/…  ·  http://localhost:8500
     ❌ http://192.168.x.x:8500 (교실에서 선생님 PC 로컬서버로 접속)  ·  file:// 더블클릭
   그래서 **마이크가 없어도 앱이 그대로 돌아가야 한다** — 파형 A·B·C 가 늘 살아 있고,
   막히면 이유를 사람 말로 알려 준다(`reasonText`).

   ── 이 파일의 구조 ─────────────────────────────────────────
   윗부분은 **브라우저 없이 도는 순수 계산**이라 Node 검사(`verify_mic.cjs`)가 확인한다.
   아랫부분(`record`·`play`)만 브라우저 전용이다.
   ========================================================= */
(function (global) {
  "use strict";

  var REC_SECS = 3;          /* 녹음 길이(초) — 2026-09-12 사용자 지시로 5 → 3.
     8초는 교실에서 너무 길고, 5초도 «말할 거리를 찾느라» 뒤가 빈다.
     ⚠ 화면 글자는 이 값을 읽어 쓴다(단추 이름도 micWire 가 넣는다) — 숫자를 직접 적지 말 것. */
  var ZOOM_MS = 10;          /* 확대해서 볼 구간(ms) — 목소리 한두 마루가 들어온다 */
  var ENV_BUCKETS = 240;     /* 큰 그림(음량)을 몇 칸으로 나눠 그릴까 */

  /* =========================================================
     순수 계산 — 브라우저가 없어도 돈다
     ========================================================= */

  /* 음량(RMS) 엔벨로프 — 구간마다 «소리가 얼마나 컸나» 를 재서 0~1 로 돌려준다.
     ⚠ 평균이 아니라 **제곱평균제곱근(RMS)** 을 쓴다. 소리는 +/− 로 진동해서
        그냥 평균을 내면 0 에 가까워진다(조용한 것과 구별되지 않는다). */
  function envelope(data, buckets) {
    var n = data && data.length ? data.length : 0;
    var b = Math.max(2, buckets || ENV_BUCKETS);
    var out = [];
    if (!n) { for (var z = 0; z < b; z++) out.push(0); return out; }
    for (var i = 0; i < b; i++) {
      var s = Math.floor(n * i / b), e = Math.floor(n * (i + 1) / b);
      if (e <= s) e = s + 1;
      if (e > n) e = n;
      var sum = 0, cnt = 0;
      for (var k = s; k < e; k++) { var v = data[k]; sum += v * v; cnt++; }
      out.push(cnt ? Math.sqrt(sum / cnt) : 0);
    }
    return out;
  }

  /* 0~1 로 맞추기 — 가장 큰 값이 1 이 되게. 조용히 말한 학생도 그래프가 보인다.
     ⚠ 아주 조용하면(최댓값이 거의 0) 잡음만 커지므로 **바닥값**을 둔다. */
  function normalize(arr, floor) {
    var f = (floor == null) ? 0.02 : floor;
    var max = 0, i;
    for (i = 0; i < arr.length; i++) if (Math.abs(arr[i]) > max) max = Math.abs(arr[i]);
    var out = [];
    if (max < f) { for (i = 0; i < arr.length; i++) out.push(0); return out; }
    for (i = 0; i < arr.length; i++) out.push(arr[i] / max);
    return out;
  }

  /* 그래프에 올릴 «0~1» 파형 — −1~+1 인 소리를 가운데 0.5 에 놓고 편다.
     이렇게 두면 js/sound.js 의 waveAt 이 그대로 0 ~ maxLevel 로 늘려 준다. */
  function toBand(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = 0.5 + arr[i] * 0.47;               /* 0.47 : 위아래가 잘리지 않게 여유 */
      out.push(v < 0 ? 0 : (v > 1 ? 1 : v));
    }
    return out;
  }

  /* 한 지점(초)에서 구간 잘라내기 — 확대해서 볼 «진짜 파형» */
  function sliceAt(data, rate, tSec, lenSec) {
    var n = data.length;
    var len = Math.max(2, Math.round(rate * lenSec));
    var start = Math.round(rate * tSec) - Math.floor(len / 2);
    if (start < 0) start = 0;
    if (start + len > n) start = Math.max(0, n - len);
    var out = [];
    for (var i = 0; i < len && start + i < n; i++) out.push(data[start + i]);
    return out;
  }

  /* 가장 소리가 컸던 자리(초) — 확대할 곳을 자동으로 고를 때 쓴다.
     ⚠ 맨 앞뒤는 피한다(단추 누르는 소리·말 끊김이 잡힌다). */
  function loudestAt(data, rate) {
    var env = envelope(data, ENV_BUCKETS);
    var lo = Math.floor(env.length * 0.1), hi = Math.ceil(env.length * 0.9);
    var best = lo, bv = -1;
    for (var i = lo; i < hi; i++) if (env[i] > bv) { bv = env[i]; best = i; }
    var secs = data.length / rate;
    return secs * (best + 0.5) / env.length;
  }

  /* 재생용 양자화 — 소리를 bits 단계로 «계단» 으로 만든다.
     이것이 「비트를 줄이면 소리가 거칠어진다」 를 **귀로** 들려주는 계산이다.
     ⚠ 반올림한 뒤 **다시 −1~+1 로 되돌린다** — 안 그러면 소리가 한쪽으로 쏠려(DC) 툭 하고 튄다. */
  function quantize(data, bits) {
    var steps = Math.pow(2, bits) - 1;
    var out = new Array(data.length);
    for (var i = 0; i < data.length; i++) {
      var v = data[i];
      if (v < -1) v = -1;
      if (v > 1) v = 1;
      var lv = Math.round((v + 1) / 2 * steps);          /* 0 ~ steps */
      out[i] = lv / steps * 2 - 1;                        /* 다시 −1 ~ +1 */
    }
    return out;
  }

  /* 양자화로 얼마나 달라졌나 — 귀로 듣기 전에 숫자로도 보여 준다 */
  function quantDiff(data, bits) {
    var q = quantize(data, bits);
    var sum = 0, max = 0;
    for (var i = 0; i < data.length; i++) {
      var e = Math.abs(data[i] - q[i]);
      sum += e;
      if (e > max) max = e;
    }
    return {
      mean: Math.round(sum / Math.max(1, data.length) * 10000) / 10000,
      max: Math.round(max * 10000) / 10000
    };
  }

  /* =========================================================
     브라우저 전용 — 마이크와 소리 내기
     ========================================================= */

  /* 마이크를 쓸 수 있나. 못 쓰면 **왜 못 쓰는지** 를 함께 돌려준다. */
  function reason() {
    if (typeof navigator === "undefined" || typeof window === "undefined") return "no-browser";
    if (!window.isSecureContext) return "insecure";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "no-api";
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return "no-audio";
    return "ok";
  }
  function supported() { return reason() === "ok"; }

  /* 왜 안 되는지를 **사람 말로** — 화면에 그대로 띄운다 */
  function reasonText(code) {
    var host = (typeof location !== "undefined") ? location.protocol + "//" + location.host : "";
    if (code === "insecure") {
      return "이 주소에서는 마이크를 열 수 없습니다 (" + host + "). " +
             "브라우저는 <b>https 주소</b>나 <b>localhost</b> 에서만 마이크를 허용합니다. " +
             "<b>사이트 주소로 접속</b>하면 됩니다. 그동안은 아래 <b>파형 A · B · C</b> 로 학습할 수 있습니다.";
    }
    if (code === "no-api" || code === "no-audio") {
      return "이 브라우저는 마이크 기능을 지원하지 않습니다. " +
             "<b>파형 A · B · C</b> 로 학습할 수 있습니다.";
    }
    return "";
  }

  /* 마이크가 거절됐을 때의 말 */
  function errorText(err) {
    var name = (err && err.name) || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "마이크 사용이 <b>거부</b>되었습니다. 주소창 왼쪽의 <b>🔒 자물쇠</b> 를 눌러 " +
             "마이크를 <b>허용</b>으로 바꾼 뒤 다시 눌러 주세요.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "마이크를 찾지 못했습니다. 마이크가 연결되어 있는지 확인해 주세요.";
    }
    if (name === "NotReadableError") {
      return "다른 프로그램이 마이크를 쓰고 있습니다. 그 프로그램을 닫고 다시 눌러 주세요.";
    }
    return "마이크를 열지 못했습니다" + (name ? " (" + name + ")" : "") + ".";
  }

  var ctx = null;
  function audioCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    return ctx;
  }

  /* 녹음 — secs 초 동안 마이크를 읽어 −1~+1 배열로 돌려준다.
     onTick(남은초) 로 카운트다운을 화면에 보여 준다.
     ⚠ MediaRecorder 를 쓰지 않는다 — 그건 **압축된 파일**을 만든다.
        우리는 «표본 하나하나» 가 필요하므로 AudioContext 로 **날값(PCM)** 을 받는다. */
  function record(secs, onTick) {
    var want = secs || REC_SECS;
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (stream) {
      return new Promise(function (resolve, reject) {
        var ac, src, node, chunks = [], total = 0, stopped = false, timer = null;
        function cleanup() {
          if (timer) clearInterval(timer);
          try { if (node) node.disconnect(); } catch (e) {}
          try { if (src) src.disconnect(); } catch (e) {}
          stream.getTracks().forEach(function (t) { t.stop(); });   /* 🔒 마이크를 반드시 끈다 */
        }
        try {
          ac = audioCtx();
          src = ac.createMediaStreamSource(stream);
          /* ⚠ ScriptProcessor 는 «구식» 이지만 AudioWorklet 은 별도 파일이 필요해
             file:// · 오프라인 배포와 어울리지 않는다. 몇 초짜리 녹음에는 이것으로 충분하다. */
          node = ac.createScriptProcessor(4096, 1, 1);
          var need = Math.round(ac.sampleRate * want);
          node.onaudioprocess = function (ev) {
            if (stopped) return;
            var buf = ev.inputBuffer.getChannelData(0);
            var copy = new Float32Array(buf.length);
            copy.set(buf);
            chunks.push(copy);
            total += copy.length;
            if (total >= need) finish();
          };
          src.connect(node);
          node.connect(ac.destination);        /* 크롬은 목적지에 이어야 흐른다 */
          /* 되울림 방지 — 소리는 내지 않는다 */
          var mute = ac.createGain(); mute.gain.value = 0;
          try { node.disconnect(); node.connect(mute); mute.connect(ac.destination); } catch (e) {}

          var left = want;
          if (onTick) onTick(left);
          timer = setInterval(function () {
            left -= 0.1;
            if (onTick) onTick(Math.max(0, Math.round(left * 10) / 10));
          }, 100);

          function finish() {
            if (stopped) return;
            stopped = true;
            cleanup();
            var out = new Float32Array(total), at = 0;
            chunks.forEach(function (c) { out.set(c, at); at += c.length; });
            resolve({ data: out, rate: ac.sampleRate, secs: out.length / ac.sampleRate });
          }
          /* 안전장치 — 콜백이 안 오는 기기가 있다(권한은 됐는데 소리가 안 흐름) */
          setTimeout(function () {
            if (!stopped) {
              if (total > ac.sampleRate * 0.3) finish();
              else { stopped = true; cleanup(); reject(new Error("no-input")); }
            }
          }, (want + 2) * 1000);
        } catch (e) { cleanup(); reject(e); }
      });
    });
  }

  /* 소리 내기 — 배열을 그대로 재생한다. 멈추는 함수를 돌려준다. */
  var playing = null;
  function stop() {
    if (playing) { try { playing.stop(); } catch (e) {} playing = null; }
  }
  function play(data, rate, onEnd) {
    stop();
    var ac = audioCtx();
    var buf = ac.createBuffer(1, data.length, rate);
    var ch = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) ch[i] = data[i];
    var s = ac.createBufferSource();
    s.buffer = buf;
    s.connect(ac.destination);
    s.onended = function () { playing = null; if (onEnd) onEnd(); };
    s.start();
    playing = s;
    return s;
  }

  global.Mic = {
    REC_SECS: REC_SECS,
    ZOOM_MS: ZOOM_MS,
    ENV_BUCKETS: ENV_BUCKETS,
    envelope: envelope,
    normalize: normalize,
    toBand: toBand,
    sliceAt: sliceAt,
    loudestAt: loudestAt,
    quantize: quantize,
    quantDiff: quantDiff,
    supported: supported,
    reason: reason,
    reasonText: reasonText,
    errorText: errorText,
    record: record,
    play: play,
    stop: stop
  };
})(typeof window !== "undefined" ? window : globalThis);
