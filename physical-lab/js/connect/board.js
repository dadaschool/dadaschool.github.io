/* ============================================================
   Keyestudio 확장보드 그리기 — 선생님이 주신 회로도의 배치를 그대로 옮겼다.

   ⚠ 구멍 하나 = 버튼 하나(DOM). 그래서 태블릿에서 손가락으로 누를 수 있고
     읽어 주는 프로그램도 «2번 S 구멍» 이라고 읽을 수 있다.
     사진 위에 좌표를 찍는 방식이면 둘 다 안 되고, 교사가 부품을 추가할 수도 없다.

   ⚠ 핀열의 세 줄 순서(G · V · S)는 사진에서 읽은 것이다. 실물과 다르면
     아래 COL_L · COL_R 한 줄만 고치면 그림 전체가 따라 바뀐다.
     전원·접지는 «그 줄의 어느 구멍이든» 정답이므로 채점에는 영향이 없다.
   ============================================================ */
(function (g) {
  "use strict";

  var LEFT  = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];              /* 왼쪽 핀열 */
  var RIGHT = ["NC", 20, 19, 16, 15, 14, 13, 12, 11, 10];  /* 오른쪽 핀열 (사진의 인쇄 순서) */
  var IIC   = [20, 19];                                    /* I2C 전용 자리 — SCL 20 · SDA 19 */
  var SPI   = [16, 15, 14, 13];

  var COL_L = ["G", "V", "S"];   /* 왼쪽 : 바깥쪽부터 G → V1 → S (번호 옆이 S) */
  var COL_R = ["S", "V", "G"];   /* 오른쪽 : 번호 옆이 S → V2 → G */

  /* 구멍 이름 만들기 / 읽기 ------------------------------------ */
  function hid(block, pin, col) { return block + "-" + pin + "-" + col; }

  function parse(id) {
    if (id === "PWR-5V")  return { block: "PWR", pad: "5V",  col: "PAD" };
    if (id === "PWR-3V3") return { block: "PWR", pad: "3V3", col: "PAD" };
    if (id === "USB")     return { block: "USB", col: "USB" };
    var p = String(id).split("-");
    var pin = p[1] === "NC" ? "NC" : Number(p[1]);
    return {
      block: p[0], pin: pin, col: p[2],
      /* 왼쪽 핀열은 V1 줄, 오른쪽·IIC·SPI 는 V2 줄을 쓴다 (점퍼가 따로 있다) */
      rail: p[0] === "L" ? "V1" : "V2"
    };
  }

  /* 사람이 읽는 이름 — 채점 설명·연결표·인쇄물이 같은 말을 쓰게 한다 */
  function label(id) {
    var h = parse(id);
    if (h.block === "PWR") return h.pad + " 단자";
    if (h.block === "USB") return "micro USB";
    var where = h.block === "IIC" ? "IIC " : (h.block === "SPI" ? "SPI " : "");
    var col = h.col === "V" ? (h.rail) : h.col;
    return where + h.pin + "번 " + col;
  }

  /* 핀열 하나 그리기 --------------------------------------------- */
  function header(block, pins, cols, railName) {
    var out = '<div class="hdr ' + block.toLowerCase() + '">';
    /* 줄 이름 (S · V1 · G) */
    out += '<div class="hrow hlab">';
    if (cols[0] === "S") out += '<span class="num"></span>';
    cols.forEach(function (c) {
      out += '<span class="cl ' + c.toLowerCase() + '">' + (c === "V" ? railName : c) + "</span>";
    });
    if (cols[cols.length - 1] === "S") out += '<span class="num"></span>';
    out += "</div>";

    pins.forEach(function (p) {
      var nc = p === "NC";
      out += '<div class="hrow">';
      if (cols[0] === "S") out += '<span class="num">' + p + "</span>";
      cols.forEach(function (c) {
        out += nc
          ? '<span class="ho nc" title="NC — 이어지지 않은 자리"></span>'
          : '<button type="button" class="ho ' + c.toLowerCase() + '" data-h="' + hid(block, p, c) +
            '" aria-label="' + label(hid(block, p, c)) + ' 구멍"></button>';
      });
      if (cols[cols.length - 1] === "S") out += '<span class="num">' + p + "</span>";
      out += "</div>";
    });
    return out + "</div>";
  }

  /* 보드 전체 --------------------------------------------------- */
  function render(prob) {
    var v1 = (prob && prob.v1) || "3V3";
    var v2 = (prob && prob.v2) || "3V3";
    var usb = !prob || prob.usb !== false;

    var h = "";
    h += '<div class="edge"><span>micro:bit 꽂는 자리</span></div>';
    h += '<div class="silk">Keyestudio</div>';

    h += '<div class="blk pos-l">' + header("L", LEFT, COL_L, "V1") + "</div>";
    h += '<div class="blk pos-r">' + header("R", RIGHT, COL_R, "V2") + "</div>";
    h += '<div class="blk pos-iic"><div class="bname">IIC</div>' + header("IIC", IIC, COL_R, "V2") + "</div>";
    h += '<div class="blk pos-spi"><div class="bname">SPI</div>' + header("SPI", SPI, COL_R, "V2") + "</div>";

    /* 전원 단자와 점퍼 — 사진에서 초음파 Vcc 가 여기로 온 이유를 보여 주는 자리 */
    h += '<div class="blk pos-pwr"><div class="bname">전원 단자</div>' +
         '<div class="pads">' +
           '<div class="pad"><button type="button" class="ho pad5" data-h="PWR-5V" aria-label="5V 단자"></button><span>5V</span></div>' +
           '<div class="jmp"><span class="jt">V1</span><span class="jv ' + (v1 === "5V" ? "hi" : "") + '">' + v1 + "</span></div>" +
           '<div class="jmp"><span class="jt">V2</span><span class="jv ' + (v2 === "5V" ? "hi" : "") + '">' + v2 + "</span></div>" +
           '<div class="pad"><button type="button" class="ho pad3" data-h="PWR-3V3" aria-label="3V3 단자"></button><span>3V3</span></div>' +
         "</div>" +
         '<p class="jnote">점퍼가 <b>V1 = ' + v1 + "</b> · <b>V2 = " + v2 + "</b> 로 꽂혀 있습니다</p></div>";

    h += '<div class="blk pos-usb">' +
           (usb ? '<button type="button" class="ho usb" data-h="USB" aria-label="micro USB 자리"></button>' : '<span class="ho usb off"></span>') +
           "<span>micro USB</span></div>";
    h += '<div class="blk pos-dc"><span class="dcjack"></span><span>7~9V</span></div>';

    return '<div class="board" id="board">' + h + "</div>";
  }

  g.Board = {
    render: render, parse: parse, label: label, hid: hid,
    LEFT: LEFT, RIGHT: RIGHT, IIC: IIC, SPI: SPI,
    /* 신호핀으로 고를 수 있는 번호 (교사 화면의 선택 목록) */
    SIG_PINS: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20]
  };
})(window);
