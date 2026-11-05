/* ==================== ARTEMIS CLOUD: AUTH GATE + CLOUD SAVE ====================
   Module nay chay TRUOC game script. No:
   1. Hien man hinh dang nhap / dang ky neu chua co phien.
   2. Tai save tu MongoDB va bom vao localStorage truoc khi SaveState.load() chay.
   3. Bat SaveState.save() de day len server (debounce).
   Game goc khong bi sua: moi thu di qua localStorage nhu cu.
   ================================================================= */
(function () {
  "use strict";

  var SAVE_KEY = "archero2_web_save_v2";
  var API = {
    me: "/api/auth/me",
    login: "/api/auth/login",
    register: "/api/auth/register",
    logout: "/api/auth/logout",
    save: "/api/save",
  };

  var state = {
    ready: false,        // da xong buoc xac thuc + tai save
    authenticated: false,
    player: null,
    revision: 0,
    saveTimer: null,
    lastPushedHash: "",
    dirty: false,
    lastError: "",
  };

  // ---------- Tien ich ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0);
  }

  function toastRoot() {
    var r = document.getElementById("cloudToastRoot");
    if (!r) {
      r = el("div", "");
      r.id = "cloudToastRoot";
      r.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:92vw;";
      document.body.appendChild(r);
    }
    return r;
  }

  function toast(msg, kind) {
    var colors = { ok: "#16a34a", err: "#dc2626", info: "#2563eb", warn: "#d97706" };
    var n = el("div", "", msg);
    n.style.cssText =
      "background:" + (colors[kind] || colors.info) + ";color:#fff;font-weight:800;font-size:13px;" +
      "padding:10px 16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);" +
      "font-family:Inter,system-ui,sans-serif;opacity:0;transition:opacity .2s,transform .2s;transform:translateY(6px);";
    toastRoot().appendChild(n);
    requestAnimationFrame(function () { n.style.opacity = "1"; n.style.transform = "translateY(0)"; });
    setTimeout(function () { n.style.opacity = "0"; setTimeout(function () { n.remove(); }, 250); }, 2600);
  }

  // ---------- Goi API ----------
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: Object.assign({ "content-type": "application/json" }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  // ---------- Man hinh dang nhap ----------
  var gateEl = null;

  function buildGate(mode) {
    if (gateEl) gateEl.remove();
    var wrap = el("div", "");
    wrap.id = "cloudGate";
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;" +
      "background:radial-gradient(circle at 50% 0%,#1e1b4b 0%,#090d16 70%);" +
      "font-family:Inter,system-ui,sans-serif;padding:16px;overflow:auto;";

    var card = el("div", "");
    card.style.cssText =
      "width:100%;max-width:390px;background:linear-gradient(165deg,rgba(15,23,42,.97),rgba(9,13,22,.99));" +
      "border:2px solid rgba(245,158,11,.55);border-radius:24px;padding:24px 20px;" +
      "box-shadow:0 24px 60px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.12);";

    card.appendChild((function () {
      var h = el("div", "");
      h.style.cssText = "text-align:center;margin-bottom:18px;";
      h.innerHTML =
        '<div style="font-size:44px;line-height:1;filter:drop-shadow(0 0 14px rgba(245,158,11,.6))">🐴</div>' +
        '<div style="font-size:19px;font-weight:900;color:#fff;margin-top:8px;letter-spacing:.3px">Archero 2</div>' +
        '<div style="font-size:11px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:1.6px;margin-top:3px">Kỷ Nguyên Cung Thủ</div>' +
        '<div style="font-size:11.5px;color:#94a3b8;margin-top:10px;line-height:1.5">' +
        (mode === "login" ? "Đăng nhập để tiếp tục hành trình của bạn" : "Tạo tài khoản để bắt đầu hành trình") +
        "</div>";
      return h;
    })());

    var form = el("form", "");
    form.style.cssText = "display:flex;flex-direction:column;gap:11px;";

    function field(labelText, inputEl, hint) {
      var box = el("div", "");
      var lb = el("label", "", labelText);
      lb.style.cssText = "display:block;font-size:11px;font-weight:800;color:#cbd5e1;margin-bottom:5px;letter-spacing:.4px;";
      inputEl.style.cssText =
        "width:100%;box-sizing:border-box;background:#020617;border:1.5px solid #334155;border-radius:12px;" +
        "padding:11px 13px;color:#f8fafc;font-size:14px;font-weight:600;outline:none;font-family:inherit;";
      inputEl.addEventListener("focus", function () { inputEl.style.borderColor = "#f59e0b"; });
      inputEl.addEventListener("blur", function () { inputEl.style.borderColor = "#334155"; });
      box.appendChild(lb);
      box.appendChild(inputEl);
      if (hint) {
        var hn = el("div", "", hint);
        hn.style.cssText = "font-size:10.5px;color:#64748b;margin-top:4px;line-height:1.4;";
        box.appendChild(hn);
      }
      return box;
    }

    var userInput = el("input", "");
    userInput.type = "text";
    userInput.name = "username";
    userInput.autocomplete = "username";
    userInput.maxLength = 20;
    userInput.placeholder = "3-20 ký tự: chữ, số, gạch dưới";

    var passInput = el("input", "");
    passInput.type = "password";
    passInput.name = "password";
    passInput.autocomplete = mode === "login" ? "current-password" : "new-password";
    passInput.maxLength = 128;
    passInput.placeholder = "Tối thiểu 8 ký tự";

    form.appendChild(field("TÊN ĐĂNG NHẬP", userInput));
    form.appendChild(field("MẬT KHẨU", passInput));

    var errBox = el("div", "");
    errBox.style.cssText =
      "display:none;background:rgba(220,38,38,.16);border:1.5px solid rgba(248,113,113,.5);" +
      "color:#fca5a5;font-size:12px;font-weight:700;padding:9px 12px;border-radius:10px;line-height:1.45;";
    form.appendChild(errBox);

    var submit = el("button", "");
    submit.type = "submit";
    submit.innerHTML = mode === "login" ? "🔓 Đăng Nhập" : "✨ Tạo Tài Khoản";
    submit.style.cssText =
      "width:100%;padding:12px;border:none;border-radius:12px;cursor:pointer;" +
      "background:linear-gradient(135deg,#fde047,#f59e0b 50%,#d97706);color:#1c1917;" +
      "font-weight:900;font-size:14px;letter-spacing:.3px;font-family:inherit;" +
      "box-shadow:0 6px 18px rgba(245,158,11,.35);transition:filter .15s,transform .1s;";
    submit.addEventListener("mouseenter", function () { submit.style.filter = "brightness(1.1)"; });
    submit.addEventListener("mouseleave", function () { submit.style.filter = ""; });
    form.appendChild(submit);

    var switchRow = el("div", "");
    switchRow.style.cssText = "text-align:center;font-size:12px;color:#94a3b8;margin-top:4px;";
    var switchBtn = el("button", "", mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập");
    switchBtn.type = "button";
    switchBtn.style.cssText =
      "background:none;border:none;color:#fbbf24;font-weight:900;cursor:pointer;font-size:12px;" +
      "text-decoration:underline;font-family:inherit;padding:4px;";
    switchBtn.addEventListener("click", function () { buildGate(mode === "login" ? "register" : "login"); });
    switchRow.appendChild(switchBtn);
    form.appendChild(switchRow);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var username = userInput.value.trim();
      var password = passInput.value;
      errBox.style.display = "none";

      if (username.length < 3) {
        errBox.textContent = "Tên đăng nhập phải có ít nhất 3 ký tự.";
        errBox.style.display = "block";
        return;
      }
      if (password.length < 8) {
        errBox.textContent = "Mật khẩu phải có ít nhất 8 ký tự.";
        errBox.style.display = "block";
        return;
      }

      submit.disabled = true;
      submit.style.opacity = ".65";
      submit.textContent = "⏳ Đang xử lý...";

      api(mode === "login" ? API.login : API.register, {
        method: "POST",
        body: { username: username, password: password },
      }).then(function (r) {
        if (!r.data || !r.data.ok) {
          errBox.textContent = (r.data && r.data.error) || "Không kết nối được máy chủ. Thử lại.";
          errBox.style.display = "block";
          submit.disabled = false;
          submit.style.opacity = "";
          submit.innerHTML = mode === "login" ? "🔓 Đăng Nhập" : "✨ Tạo Tài Khoản";
          return;
        }
        state.authenticated = true;
        state.player = r.data.player;
        // Sau khi dang nhap/ky: tai save, roi MOI vao game.
        loadCloudSave().then(function () {
          closeGate();
          enterGame();
          // ===== Beginner Journey =====
          // CHI tai khoan vua dang ky (mode === "register") moi duoc kich hoat.
          // Tai khoan cu dang nhap (mode === "login") khong bao gio di qua day,
          // nen tutorial khong bao gio tu bat tren du lieu da co.
          if (mode === "register" && window.Archero2FusionAPI
              && typeof window.Archero2FusionAPI.activateBeginnerJourney === "function") {
            var activated = window.Archero2FusionAPI.activateBeginnerJourney();
            if (activated && typeof window.Archero2FusionAPI.renderBeginnerJourneyUI === "function") {
              window.Archero2FusionAPI.renderBeginnerJourneyUI();
            }
          }
          toast(mode === "login" ? "Chào mừng trở lại, " + (state.player.username || "") + "!" : "Tạo tài khoản thành công! Chúc may mắn!", "ok");
        });
      }).catch(function () {
        errBox.textContent = "Lỗi mạng. Kiểm tra kết nối và thử lại.";
        errBox.style.display = "block";
        submit.disabled = false;
        submit.style.opacity = "";
        submit.innerHTML = mode === "login" ? "🔓 Đăng Nhập" : "✨ Tạo Tài Khoản";
      });
    });

    card.appendChild(form);
    var foot = el("div", "", "🔒 Tiến trình lưu an toàn trên MongoDB Atlas");
    foot.style.cssText = "text-align:center;font-size:10px;color:#475569;margin-top:14px;font-weight:700;";
    card.appendChild(foot);

    wrap.appendChild(card);
    document.body.appendChild(wrap);
    gateEl = wrap;
    setTimeout(function () { userInput.focus(); }, 60);
  }

  function closeGate() {
    if (gateEl) { gateEl.remove(); gateEl = null; }
    document.documentElement.classList.remove("cloud-locked");
  }

  // ---------- Cloud save ----------
  function loadCloudSave() {
    return api(API.save).then(function (r) {
      if (!r.data || !r.data.ok) return false;
      state.revision = Number(r.data.revision) || 0;
      if (r.data.hasSave && r.data.data) {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(r.data.data));
          state.lastPushedHash = hashStr(JSON.stringify(r.data.data));
        } catch (e) {
          toast("Không ghi được vào bộ nhớ tạm của trình duyệt.", "err");
        }
        return true;
      }
      // Tai khoan moi: XOA save cua nguoi dung truoc do tren cung trinh duyet,
      // neu khong se bi ro ri tien trinh giua cac tai khoan.
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      state.lastPushedHash = "";
      return false;
    }).catch(function () { return false; });
  }

  function pushCloudSave() {
    if (!state.authenticated) return;
    var raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (!raw) return;

    var h = hashStr(raw);
    if (h === state.lastPushedHash) return; // khong co gi thay doi

    var payload;
    try { payload = JSON.parse(raw); } catch (e) { return; }

    api(API.save, { method: "PUT", body: { data: payload, revision: state.revision } })
      .then(function (r) {
        if (r.data && r.data.ok) {
          state.revision = Number(r.data.revision) || state.revision + 1;
          state.lastPushedHash = h;
          state.dirty = false;
          state.lastError = "";
          pulseSavedIndicator();
        } else if (r.data && r.data.code && String(r.data.code).indexOf("ECONOMY_") === 0) {
          // Server chặn vì số vàng/đá quý tăng bất thường. Khôi phục bản ghi server
          // để người chơi không tiếp tục chơi trên dữ liệu sai, rồi báo rõ.
          state.lastError = r.data.code;
          if (r.data.serverData) {
            try {
              localStorage.setItem(SAVE_KEY, JSON.stringify(r.data.serverData));
              state.revision = Number(r.data.serverRevision) || 0;
              toast("Dữ liệu tài nguyên không hợp lệ đã bị từ chối. Đang tải lại tiến trình từ máy chủ…", "err");
              setTimeout(function () { location.reload(); }, 1600);
              return;
            } catch (e) {}
          }
          toast((r.data && r.data.error) || "Tiến trình không hợp lệ, chưa được lưu.", "err");
        } else if (r.data && r.data.conflict) {
          toast("Tiến trình đã đổi từ thiết bị khác. Tải lại trang để đồng bộ.", "warn");
          state.lastError = "conflict";
        } else {
          state.lastError = (r.data && r.data.error) || "Lưu thất bại";
        }
      })
      .catch(function () { state.lastError = "Lỗi mạng"; });
  }

  function scheduleSave() {
    state.dirty = true;
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(pushCloudSave, 1200); // debounce: game goi save() rat nhieu
  }

  // ---------- Chi bao trang thai luu ----------
  var indicator = null;

  function makeIndicator() {
    if (indicator) return;
    indicator = el("div", "");
    indicator.id = "cloudSaveIndicator";
    indicator.style.cssText =
      "position:fixed;top:6px;right:8px;z-index:9990;display:flex;align-items:center;gap:5px;" +
      "background:rgba(2,6,23,.82);border:1px solid rgba(148,163,184,.35);border-radius:999px;" +
      "padding:3px 9px;font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:800;" +
      "color:#94a3b8;cursor:pointer;backdrop-filter:blur(6px);transition:border-color .2s,color .2s;";
    indicator.title = "Nhấn để đăng xuất";
    indicator.addEventListener("click", function () {
      if (!confirm("Đăng xuất khỏi tài khoản " + (state.player?.username || "") + "?")) return;
      api(API.logout, { method: "POST" }).then(function () {
        state.authenticated = false;
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        location.reload();
      });
    });
    document.body.appendChild(indicator);
    updateIndicator("idle");
  }

  var indicatorTimer = null;
  function updateIndicator(mode) {
    if (!indicator) return;
    var maps = {
      idle: ["☁️", "#94a3b8", "rgba(148,163,184,.35)"],
      saving: ["⏳", "#fbbf24", "rgba(251,191,36,.6)"],
      saved: ["✅", "#22c55e", "rgba(34,197,94,.6)"],
      error: ["⚠️", "#f87171", "rgba(248,113,113,.6)"],
    };
    var m = maps[mode] || maps.idle;
    indicator.textContent = m[0] + " " + (state.player ? state.player.username : "cloud");
    indicator.style.color = m[1];
    indicator.style.borderColor = m[2];
  }

  function pulseSavedIndicator() {
    updateIndicator("saved");
    if (indicatorTimer) clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(function () { updateIndicator("idle"); }, 1800);
  }

  // ---------- Bat localStorage.setItem de tu dong day len server ----------
  function hookLocalStorage() {
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      original.call(this, key, value);
      if (key === SAVE_KEY && state.authenticated) {
        updateIndicator("saving");
        scheduleSave();
      }
    };
  }

  // ---------- Khoi dong ----------
  /** Dung chung cho ca 2 duong: co phien san (boot) va dang nhap/ky moi thanh cong. */
  function enterGame() {
    makeIndicator();
    hookLocalStorage();
    startGame();
  }

  function boot() {
    document.documentElement.classList.add("cloud-locked");
    api(API.me).then(function (r) {
      if (r.data && r.data.ok && r.data.authenticated) {
        state.authenticated = true;
        state.player = r.data.player;
        return loadCloudSave().then(function () {
          closeGate();
          enterGame();
        });
      }
      buildGate("login");
      // Chua dang nhap -> khong chay game. Man hinh gate da phu toan bo.
      return null;
    }).catch(function () {
      buildGate("login");
      // Cho phep thu lai khi mang co lai.
      var box = gateEl && gateEl.querySelector("form");
      if (box) {
        var warn = el("div", "", "⚠️ Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
        warn.style.cssText = "background:rgba(217,119,6,.18);border:1.5px solid rgba(251,191,36,.5);color:#fcd34d;font-size:11.5px;font-weight:700;padding:8px 10px;border-radius:10px;margin-bottom:8px;";
        box.insertBefore(warn, box.firstChild);
      }
    });
  }

  /** Game script da tai xong -> cho no chay. */
  function startGame() {
    state.ready = true;
    // SaveState.load() da chay luc parse (co the chua co du lieu cloud).
    // Nap lai de chac chan game dung du lieu tu MongoDB.
    if (window.Archero2FusionAPI && typeof window.Archero2FusionAPI.reloadSaveFromStorage === "function") {
      window.Archero2FusionAPI.reloadSaveFromStorage();
    }
    if (typeof window.__artemisStartGame === "function") window.__artemisStartGame();
  }

  // Game goi ham nay khi DOM xong; ta giu no lai cho den khi xac thuc xong.
  window.__artemisBootstrap = function (startFn) {
    window.__artemisStartGame = startFn;
    if (state.ready) startFn();
  };

  // Cong khai de debug/kiem thu.
  window.ArtemisCloud = {
    getState: function () { return Object.assign({}, state); },
    pushNow: function () { pushCloudSave(); return state.revision; },
    loadCloudSave: loadCloudSave,
    toast: toast,
    SAVE_KEY: SAVE_KEY,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
