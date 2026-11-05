// Tim "nut chet": nut hien thi, bam duoc, nhung KHONG co handler nao chay.
// Phien ban ASYNC (dung await, khong spin dong bo gay treo CDP).
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = { tested: 0, dead: [], alive: 0, skipped: 0, details: [] };

  function snapshot() {
    let gold = -1, gems = -1;
    try { gold = window.Archero2FusionAPI.SaveState.gold; gems = window.Archero2FusionAPI.SaveState.gems; } catch (e) {}
    return {
      openModals: [...document.querySelectorAll('[id$="Modal"]')]
        .filter((m) => !m.classList.contains("hidden")).map((m) => m.id).join(","),
      toast: (document.getElementById("toast") || {}).textContent || "",
      bodyLen: document.body.innerText.length,
      gold, gems,
    };
  }
  const diff = (a, b) =>
    a.openModals !== b.openModals || a.toast !== b.toast ||
    Math.abs(a.bodyLen - b.bodyLen) > 2 || a.gold !== b.gold || a.gems !== b.gems;

  const root = document.getElementById("gameLobbyView") || document.body;
  const buttons = [...root.querySelectorAll("button")].filter((b) => {
    if (b.disabled) return false;
    if (b.closest(".hidden")) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  results.tested = buttons.length;

  for (const btn of buttons) {
    const label = (btn.textContent || btn.id || "").trim().replace(/\s+/g, " ").slice(0, 46);
    const id = btn.id || "(khong id)";
    if (/close|btnX|btnBack|btnReturn|btnHuy/i.test(id)) { results.skipped++; continue; }
    if (/Reset|Delete|Xoa|Xoá|logout|Logout/i.test(id + label)) { results.skipped++; continue; }

    const before = snapshot();
    try { btn.click(); } catch (e) {
      results.details.push({ id, label, err: String(e.message).slice(0, 90) });
      results.alive++;
      continue;
    }
    await sleep(90);
    const after = snapshot();

    if (diff(before, after)) {
      results.alive++;
      if (after.openModals && after.openModals !== before.openModals) {
        const mid = after.openModals.split(",").pop();
        const m = document.getElementById(mid);
        if (m) m.classList.add("hidden");
        await sleep(30);
      }
    } else {
      results.dead.push({ id, label });
    }
  }
  return results;
})()
