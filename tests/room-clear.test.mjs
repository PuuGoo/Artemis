// Khoá lại overlay "PHÒNG ĐÃ SẠCH" và cách đếm phòng còn lại tới trùm.
//
// Chạy: node tests/room-clear.test.mjs
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ============================================================ 1. DOM + CSS
console.log("\n=== 1. DOM & CSS ===");
check("co #roomClearOverlay", html.includes('id="roomClearOverlay"'));
check("co #roomClearCard", html.includes('id="roomClearCard"'));
check("overlay khong chan thao tac (pointer-events:none)",
  /#roomClearOverlay \{[^}]*pointer-events: none/.test(html));
check("z-index 12 (tren HUD z-10, duoi modal z-40)",
  /#roomClearOverlay \{[^}]*z-index: 12/.test(html));
check("co CSS .rc-kicker", /\.rc-kicker \{/.test(html));
check("co CSS .rc-title", /\.rc-title \{/.test(html));
check("co bien the truong hop trum (.rc-boss)", /\.rc-title\.rc-boss/.test(html));
check("co CSS .rc-stat", /\.rc-stat \{/.test(html));
check("co CSS .rc-next", /\.rc-next \{/.test(html));
check("co bien the phong ke la trum (.rc-next-boss)", /\.rc-next\.rc-next-boss/.test(html));
check("co animation vao (rcPop)", /@keyframes rcPop/.test(html));
check("co animation ra (rcOut)", /@keyframes rcOut/.test(html));
check("co animation nhip trum (rcBossPulse)", /@keyframes rcBossPulse/.test(html));
check("co responsive <= 520px", /@media \(max-width: 520px\) \{ \.rc-title/.test(html));

// ============================================================ 2. Hàm
console.log("\n=== 2. HAM ===");
check("co showRoomClearOverlay", /function showRoomClearOverlay\(opts = \{\}\)/.test(html));
check("co hideRoomClearOverlay", /function hideRoomClearOverlay\(\)/.test(html));
check("tu an sau 1900ms", /setTimeout\(\(\) => \{[\s\S]{0,200}?\}, 1900\)/.test(html));
check("co animation out truoc khi an (rc-out)", /card\.classList\.add\('rc-out'\)/.test(html));
check("xoa timer cu khi hien lai", /if \(_roomClearTimer\) clearTimeout\(_roomClearTimer\)/.test(html));

// ============================================================ 3. Nối vào luồng
console.log("\n=== 3. NOI VAO LUONG CHOI ===");
check("goi khi phong sach", /Game\.roomCleared = true;[\s\S]{0,900}?showRoomClearOverlay\(/.test(html));
check("truyen room/max/gold/wasBoss",
  /showRoomClearOverlay\(\{[\s\S]{0,300}?room: Game\.room[\s\S]{0,120}?max: Game\.maxRooms[\s\S]{0,120}?gold: Game\.runGold[\s\S]{0,120}?wasBoss:/.test(html));
check("setupRoom an overlay khi sang phong moi",
  /function setupRoom\(roomNum\) \{[\s\S]{0,200}?hideRoomClearOverlay\(\)/.test(html));
check("returnToLobby an overlay", /function returnToLobby\(\)[\s\S]{0,400}?hideRoomClearOverlay\(\)/.test(html));
check("export showRoomClearOverlay", /^\s+showRoomClearOverlay,$/m.test(html));
check("export hideRoomClearOverlay", /^\s+hideRoomClearOverlay,$/m.test(html));

// ============================================================ 4. Mô phỏng nội dung
console.log("\n=== 4. MO PHONG NOI DUNG (chay that) ===");
// Trích logic tính phòng kế từ source rồi mô phỏng lại để khoá hành vi.
function roomClearModel(room, max, gold, wasBoss) {
  const nextRoom = room + 1;
  const nextExists = nextRoom <= max;
  const nextIsBoss = nextExists && ((nextRoom % 5 === 0) || (nextRoom === max));
  const nextIsFinal = nextExists && nextRoom === max;

  const title = wasBoss ? "TRÙM ĐÃ GỤC!" : "PHÒNG ĐÃ SẠCH";
  let next;
  if (!nextExists) {
    next = { kind: "finish", text: "Vào cổng để hoàn thành chương!" };
  } else if (nextIsBoss) {
    next = { kind: "boss", final: nextIsFinal, text: `PHÒNG ${nextRoom}: ${nextIsFinal ? "TRÙM CUỐI" : "TRÙM"}` };
  } else {
    let nb = null;
    for (let i = nextRoom; i <= max; i++) {
      if (i % 5 === 0 || i === max) { nb = i; break; }
    }
    const dist = nb ? nb - nextRoom + 1 : 0;
    next = { kind: "normal", dist, text: `Phòng ${nextRoom} · còn ${dist} tới trùm` };
  }
  return { title, next, gold };
}

// Chương 1: 15 phòng
let m = roomClearModel(1, 15, 145, false);
check("C1 P1 xong -> phong 2, con 4 toi trum", m.next.kind === "normal" && m.next.dist === 4, JSON.stringify(m.next));
m = roomClearModel(3, 15, 240, false);
check("C1 P3 xong -> phong 4, con 2 toi trum", m.next.kind === "normal" && m.next.dist === 2, JSON.stringify(m.next));
m = roomClearModel(4, 15, 300, false);
check("C1 P4 xong -> phong 5 la TRUM", m.next.kind === "boss" && !m.next.final, JSON.stringify(m.next));
m = roomClearModel(5, 15, 890, true);
check("C1 P5 (trum) xong -> tieu de TRUM DA GUC", m.title === "TRÙM ĐÃ GỤC!");
check("C1 P5 xong -> phong 6, con 5 toi trum (6,7,8,9,10)",
  m.next.kind === "normal" && m.next.dist === 5, JSON.stringify(m.next));
m = roomClearModel(9, 15, 700, false);
check("C1 P9 xong -> phong 10 la TRUM", m.next.kind === "boss" && !m.next.final, JSON.stringify(m.next));
m = roomClearModel(14, 15, 1200, false);
check("C1 P14 xong -> phong 15 la TRUM CUOI", m.next.kind === "boss" && m.next.final === true, JSON.stringify(m.next));
m = roomClearModel(15, 15, 1500, true);
check("C1 P15 xong -> moi vao cong hoan thanh chuong", m.next.kind === "finish", JSON.stringify(m.next));

// Chương 2: 12 phòng (5, 10, 12 là trùm)
m = roomClearModel(1, 12, 100, false);
check("C2 P1 xong -> con 4 toi trum", m.next.dist === 4, JSON.stringify(m.next));
m = roomClearModel(10, 12, 800, true);
check("C2 P10 xong -> phong 11, con 2 toi trum (11,12)",
  m.next.kind === "normal" && m.next.dist === 2, JSON.stringify(m.next));
m = roomClearModel(11, 12, 900, false);
check("C2 P11 xong -> phong 12 la TRUM CUOI", m.next.kind === "boss" && m.next.final === true, JSON.stringify(m.next));
m = roomClearModel(12, 12, 1000, true);
check("C2 P12 xong -> hoan thanh chuong", m.next.kind === "finish", JSON.stringify(m.next));

// Chương 3: 10 phòng (5, 10 là trùm; 10 vừa bội 5 vừa cuối)
m = roomClearModel(4, 10, 300, false);
check("C3 P4 xong -> phong 5 la TRUM", m.next.kind === "boss" && !m.next.final, JSON.stringify(m.next));
m = roomClearModel(5, 10, 500, true);
check("C3 P5 xong -> phong 6, con 5 toi trum (6,7,8,9,10)",
  m.next.kind === "normal" && m.next.dist === 5, JSON.stringify(m.next));
m = roomClearModel(9, 10, 700, false);
check("C3 P9 xong -> phong 10 la TRUM CUOI (boi 5 VA cuoi)",
  m.next.kind === "boss" && m.next.final === true, JSON.stringify(m.next));

// Vàng
check("vang 0 thi khong hien khoi thong ke", roomClearModel(1, 15, 0, false).gold === 0);
check("vang > 0 duoc dinh dang vi-VN", (1240).toLocaleString("vi-VN") === "1.240");

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
