/* ============================================================
   채점 — 이 파일 하나가 «어디에 꽂아야 맞는가» 를 정한다.

   설계 원칙 : 정답을 «구멍 하나» 로 정하지 않는다.
     접지는 G 줄의 어느 구멍이든, 전원은 V 줄이나 단자면 맞다.
     신호핀만 교사가 정한 번호를 본다 (코드의 핀 번호와 같아야 하므로).
   그러면 학생이 외우는 것이 «2번 구멍» 이 아니라 규칙이 된다.

   ⚠ 브라우저와 Node 양쪽에서 돌아간다 — tools/검사/verify_judge.cjs 가 이 파일을
     그대로 불러 채점 규칙을 검사한다. 화면을 만지는 코드를 넣지 말 것.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Judge = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function parse(id) {
    if (id === "PWR-5V")  return { block: "PWR", pad: "5V",  col: "PAD" };
    if (id === "PWR-3V3") return { block: "PWR", pad: "3V3", col: "PAD" };
    if (id === "USB")     return { block: "USB", col: "USB" };
    var p = String(id).split("-");
    return {
      block: p[0],
      pin: p[1] === "NC" ? "NC" : Number(p[1]),
      col: p[2],
      rail: p[0] === "L" ? "V1" : "V2"
    };
  }

  function where(id) {
    var h = parse(id);
    if (h.block === "PWR") return h.pad + " 단자";
    if (h.block === "USB") return "micro USB 자리";
    var pre = h.block === "IIC" ? "IIC " : (h.block === "SPI" ? "SPI " : "");
    return pre + h.pin + "번 " + (h.col === "V" ? h.rail : h.col);
  }

  var COL_NAME = { S: "노란 S", V: "빨간 V", G: "검정 G" };

  /* 선 하나 채점 -------------------------------------------------
     part  : 부품 정의 (power 를 본다)
     pin   : 핀 정의 ({n, role})
     want  : 그 핀에 정해진 번호 (sig 만 쓴다. 없으면 null)
     holeId: 학생이 꽂은 구멍
     prob  : 문제 (점퍼 v1·v2 를 본다)
     ---------------------------------------------------------- */
  function one(part, pin, want, holeId, prob) {
    var h = parse(holeId);
    var v = { V1: (prob && prob.v1) || "3V3", V2: (prob && prob.v2) || "3V3" };
    var need = part.power || "any";

    if (h.block === "USB")
      return no("micro USB 자리는 보조배터리·컴퓨터를 잇는 곳입니다. 센서 핀을 꽂는 자리가 아닙니다.");
    if (h.pin === "NC")
      return no("`NC` 는 아무것도 이어지지 않은 빈 자리입니다. 여기에 꽂으면 신호가 가지 않습니다.");

    /* 접지 --------------------------------------------------- */
    if (pin.role === "gnd") {
      if (h.col === "G") return ok();
      if (h.col === "PAD")
        return no("접지(−)는 `" + h.pad + " 단자` 가 아니라 검정 `G` 줄에 꽂습니다. `G` 는 어느 번호든 됩니다.");
      return no("접지(−)는 검정 `G` 줄에 꽂습니다. 지금은 " + COL_NAME[h.col] + " 줄에 꽂혀 있어요.");
    }

    /* 전원 --------------------------------------------------- */
    if (pin.role === "vcc") {
      if (h.col === "PAD") {
        if (need === "any" || need === h.pad) return ok();
        return no("이 부품은 " + need + " 가 필요합니다. `" + h.pad + " 단자` 에서는 힘이 모자랍니다.");
      }
      if (h.col === "V") {
        if (need === "any" || need === v[h.rail]) return ok();
        return no("이 부품은 " + need + " 가 필요합니다. `" + h.rail + "` 줄은 지금 점퍼가 " + v[h.rail] +
                  " 으로 꽂혀 있어요 — 오른쪽 아래 `" + need + " 단자` 에 꽂거나 점퍼를 " + need + " 로 옮기세요.");
      }
      return no("전원(+)은 빨간 `V` 줄이나 `5V`·`3V3` 단자에 꽂습니다. 지금은 " + COL_NAME[h.col] + " 줄이에요.");
    }

    /* I2C — 핀이 고정되어 있다 ------------------------------- */
    if (pin.role === "sda" || pin.role === "scl") {
      var fix = pin.role === "sda" ? 19 : 20;
      var nm  = pin.role === "sda" ? "SDA" : "SCL";
      if (h.col === "S" && h.pin === fix) return ok();
      if (h.col !== "S")
        return no("`" + nm + "` 는 신호선입니다. 노란 `S` 줄에 꽂아야 합니다.");
      return no("I2C 는 핀이 정해져 있습니다 — `" + nm + "` 는 **" + fix + "번 `S`** 에만 꽂힙니다" +
                (h.block === "R" || h.block === "IIC" ? " (오른쪽 `IIC` 자리에도 같은 번호가 있습니다)." : "."));
    }

    /* 신호 --------------------------------------------------- */
    if (h.col !== "S")
      return no("신호선은 노란 `S` 줄에 꽂습니다. 지금은 " + COL_NAME[h.col] + " 줄이에요.");
    if (want === null || want === undefined || want === "")
      return no("이 핀은 «쓰지 않음» 으로 정해져 있습니다. 선을 이을 필요가 없어요.");
    if (h.pin !== Number(want))
      return no("`" + pin.n + "` 는 **" + want + "번 `S`** 에 꽂아야 합니다. 지금은 " + h.pin +
                "번이에요 — 코드에서 정한 핀 번호와 같아야 신호가 갑니다.");
    return ok();

    function ok()  { return { ok: true,  msg: "" }; }
    function no(m) { return { ok: false, msg: m }; }
  }

  /* 색 약속 — 틀린 것이 아니라 «주의» 로만 알려 준다 -------------- */
  function colorWarn(pin, colorKey) {
    if (!colorKey) return "";
    var isPower = pin.role === "vcc", isGnd = pin.role === "gnd";
    if (isPower && colorKey !== "red")
      return "전원(+)은 **빨강**으로 하는 것이 약속입니다.";
    if (isGnd && colorKey !== "black" && colorKey !== "brown")
      return "접지(−)는 **검정**(또는 갈색)으로 하는 것이 약속입니다.";
    if (!isPower && !isGnd && (colorKey === "red" || colorKey === "black"))
      return "빨강·검정은 전원·접지에 쓰는 색입니다. 신호선은 다른 색으로 하세요.";
    return "";
  }

  /* 문제 전체 채점 -----------------------------------------------
     wires : [{ pi:부품순번, pn:핀이름, h:구멍, c:색키 }]
     getPart(entry) : 문제의 부품 항목에서 부품 정의를 꺼내는 함수
     ---------------------------------------------------------- */
  function all(prob, wires, getPart) {
    var rows = [], missing = [], used = {};
    var checkColor = prob.color !== false;

    (wires || []).forEach(function (w) {
      var entry = prob.parts[w.pi];
      if (!entry) return;
      var part = getPart(entry), pin = null;
      for (var i = 0; i < part.pins.length; i++) if (part.pins[i].n === w.pn) pin = part.pins[i];
      if (!pin) return;
      var want = (entry.pin || {})[w.pn];
      var r = one(part, pin, want, w.h, prob);
      var warn = r.ok && checkColor ? colorWarn(pin, w.c) : "";
      rows.push({
        pi: w.pi, pn: w.pn, part: part.name, role: pin.role, hole: w.h,
        ok: r.ok, msg: r.msg, warn: warn, color: w.c
      });
      if (!used[w.pi]) used[w.pi] = {};
      used[w.pi][w.pn] = true;
    });

    /* 빠진 선 찾기 — «쓰지 않음(−)» 으로 정한 핀은 세지 않는다 */
    prob.parts.forEach(function (entry, pi) {
      var part = getPart(entry);
      part.pins.forEach(function (pin) {
        var want = (entry.pin || {})[pin.n];
        var skip = pin.role === "sig" && (want === null || want === undefined || want === "");
        if (skip) return;
        if (!used[pi] || !used[pi][pin.n]) missing.push({ pi: pi, pn: pin.n, part: part.name, role: pin.role });
      });
    });

    var bad = rows.filter(function (r) { return !r.ok; }).length;
    return {
      rows: rows, missing: missing,
      good: rows.length - bad, bad: bad,
      warns: rows.filter(function (r) { return r.warn; }).length,
      done: bad === 0 && missing.length === 0 && rows.length > 0
    };
  }

  return { one: one, all: all, colorWarn: colorWarn, parse: parse, where: where };
});
