/* ==================== ARTEMIS CLOUD: AUTH GATE + CLOUD SAVE ====================
   MONGODB LA NGUON DU LIEU DUY NHAT.

   Module nay chay TRUOC game script. No:
   1. Hien man hinh dang nhap / dang ky neu chua co phien.
   2. Tai save tu MongoDB va dat vao window.__ARTEMIS_SAVE_BUFFER truoc khi
      SaveState.load() chay.
   3. Nghe su kien 'artemis:save' do SaveState.save() phat ra, roi day len server.

   KHONG dung localStorage o bat ky dau. Ly do: tren mot trinh duyet da tung
   choi, du lieu con lai cua tai khoan cu lam tai khoan MOI hien sai chi so
   (bug that: nick moi tao hien 840K ATK / 2.85M HP / 10.0GM vang cua nick cu).
   ================================================================= */
(function () {
  "use strict";

  var SAVE_KEY = "archero2_web_save_v2"; // chi dung de DON DEP du lieu cu
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
    lastErrorCode: "",
    lastErrorDetail: "",
    lastErrorStatus: 0,
    lastErrorRetryable: false,
    booted: false,
    saveHookInstalled: false,
    saving: false,
  };
  var lastPushedPayload = null;
  var savePromise = null;
  var saveEpoch = 0;
  var checkpoints = [];
  var checkpointWorker = null;
  var checkpointBlocked = false;
  var checkpointOverflow = false;

  function settleCheckpoint(entry, ok) {
    entry.waiters.splice(0).forEach(function (resolve) { resolve(ok); });
  }
  function invalidateCheckpoints() {
    saveEpoch++;
    checkpoints.forEach(function (entry) { settleCheckpoint(entry, false); });
    checkpoints = [];
    checkpointBlocked = false;
    checkpointOverflow = false;
    if (state.saveTimer) clearTimeout(state.saveTimer);
  }

  // Immutable strings, not references to the gameplay buffer. A failed head
  // stays a barrier: dependent claims cannot replace an unacknowledged offer.
  function enqueueCheckpoint() {
    var payload = window.__ARTEMIS_SAVE_BUFFER;
    if (!state.authenticated || window.__ARTEMIS_SAVE_READY !== true || !payload) return Promise.resolve(false);
    try { JSON.parse(payload); } catch (e) { return Promise.resolve(false); }
    var tail = checkpoints[checkpoints.length - 1];
    if (!tail || tail.payload !== payload) {
      if (checkpoints.length >= 64 || checkpointOverflow) {
        checkpointOverflow = checkpointBlocked = true;
        state.dirty = true;
        state.lastError = "Có quá nhiều tiến trình chưa đồng bộ. Hãy tải lại để khôi phục dữ liệu máy chủ.";
        state.lastErrorCode = "CHECKPOINT_QUEUE_FULL";
        state.lastErrorRetryable = false;
        checkpoints.forEach(function (pending) { settleCheckpoint(pending, false); });
        updateIndicator("error");
        toast(state.lastError, "err");
        return Promise.resolve(false);
      }
      tail = { payload: payload, epoch: saveEpoch, playerId: state.player.id, waiters: [] };
      checkpoints.push(tail);
    }
    state.dirty = true;
    var result = new Promise(function (resolve) { tail.waiters.push(resolve); });
    if (checkpointOverflow || (checkpointBlocked && !state.lastErrorRetryable)) {
      settleCheckpoint(tail, false);
      return result;
    }
    checkpointBlocked = false;
    drainCheckpoints();
    return result;
  }

  function drainCheckpoints() {
    if (checkpointWorker || checkpointBlocked || !checkpoints.length) return checkpointWorker;
    var epoch = saveEpoch;
    checkpointWorker = Promise.resolve().then(async function () {
      if (state.saving) await savePromise;
      while (checkpoints.length && !checkpointBlocked && epoch === saveEpoch) {
        var entry = checkpoints[0];
        if (!state.authenticated || window.__ARTEMIS_SAVE_READY !== true
            || entry.playerId !== state.player.id) { invalidateCheckpoints(); break; }
        var acknowledged = entry.payload === lastPushedPayload;
        for (var attempt = 0; !acknowledged && attempt < 3; attempt++) {
          if (state.lastError && !state.lastErrorRetryable) break;
          if (attempt) await new Promise(function (resolve) { setTimeout(resolve, attempt === 1 ? 500 : 1500); });
          if (epoch !== saveEpoch || checkpointBlocked || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) break;
          await sendCloudPayload(entry.payload);
          if (epoch !== saveEpoch) break;
          acknowledged = entry.payload === lastPushedPayload && !state.lastError;
          if (!acknowledged && !state.lastErrorRetryable) break;
        }
        if (epoch !== saveEpoch || checkpointOverflow) break;
        if (!acknowledged) {
          checkpointBlocked = true;
          state.dirty = true;
          checkpoints.forEach(function (pending) { settleCheckpoint(pending, false); });
          updateIndicator("error");
          if (state.lastErrorRetryable) toast("Chưa lưu được lựa chọn. Tiến trình đang chờ; hãy kiểm tra mạng và thử lưu lại trước khi tải lại trang.", "warn");
          break;
        }
        checkpoints.shift();
        settleCheckpoint(entry, true);
      }
    }).finally(function () {
      checkpointWorker = null;
      if (checkpoints.length && !checkpointBlocked) drainCheckpoints();
      else if (!checkpoints.length && state.dirty && !state.lastError) scheduleSave();
    });
    return checkpointWorker;
  }
  var shopBusy = false;
  var pendingShopRequest = null;

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

  /** Xoa sach moi dau vet save cua nguoi dung truoc tren trinh duyet nay. */
  function purgeLegacyLocalSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
      var stale = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("archero2") === 0) stale.push(k);
      }
      for (var j = 0; j < stale.length; j++) localStorage.removeItem(stale[j]);
    } catch (e) { /* localStorage bi chan / khong co */ }
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
      "padding:9px 15px;border-radius:11px;box-shadow:0 10px 26px rgba(0,0,0,.45);" +
      "font-family:Inter,system-ui,sans-serif;pointer-events:auto;max-width:90vw;text-align:center;" +
      "animation:cloudToastIn .22s ease both;";
    toastRoot().appendChild(n);
    setTimeout(function () {
      n.style.transition = "opacity .3s";
      n.style.opacity = "0";
      setTimeout(function () { n.remove(); }, 320);
    }, 2600);
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET",
      headers: Object.assign({ "Content-Type": "application/json" }, opts.headers || {}),
      credentials: "same-origin",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, ok: res.ok, data: data };
      });
    });
  }

  // ---------- Cong dang nhap ----------
  var gateEl = null;
  var styleInjected = false;
  var pendingRegister = false;
  var loadingRetryBound = false;

  function loadingElement() { return document.getElementById("cloudLoading"); }
  function loadingStage(step, message) {
    var root = loadingElement();
    if (!root) return;
    root.hidden = false;
    root.classList.remove("is-error", "is-leaving");
    var label = root.querySelector(".cloud-loading-message");
    if (label) label.textContent = message;
    var bar = root.querySelector(".cloud-loading-fill");
    if (bar) bar.style.transform = "scaleX(" + [0.12, 0.55, 0.86, 1][step] + ")";
    var steps = root.querySelectorAll ? root.querySelectorAll(".cloud-loading-steps span") : [];
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle("is-current", i === step);
      steps[i].classList.toggle("is-done", i < step);
    }
  }
  function hideLoading() {
    var root = loadingElement();
    if (root) root.hidden = true;
  }
  function showLoadError(error) {
    var root = loadingElement();
    if (!root) return;
    loadingStage(1, (error && error.message) || "Không tải được dữ liệu. Vui lòng thử lại.");
    root.classList.add("is-error");
    var retry = root.querySelector(".cloud-loading-retry");
    if (retry && !loadingRetryBound) {
      loadingRetryBound = true;
      retry.addEventListener("click", function () {
        loadingStage(1, "Đang tải lại tiến trình từ máy chủ…");
        loadCloudSave().then(finishEnter).catch(showLoadError);
      });
    }
  }
  function finishEnter() {
    loadingStage(2, "Đang dựng nhân vật và trang bị…");
    enterGame();
    if (pendingRegister && window.Archero2FusionAPI
        && typeof window.Archero2FusionAPI.activateBeginnerJourney === "function") {
      var activated = window.Archero2FusionAPI.activateBeginnerJourney();
      if (activated && typeof window.Archero2FusionAPI.renderBeginnerJourneyUI === "function") {
        window.Archero2FusionAPI.renderBeginnerJourneyUI();
      }
    }
    pendingRegister = false;
    loadingStage(3, "Sẵn sàng lên đường!");
    document.documentElement.classList.add("artemis-ready");
    closeGate();
    var root = loadingElement();
    if (root) {
      root.classList.add("is-leaving");
      setTimeout(hideLoading, 320);
    }
  }

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = document.createElement("style");
    css.textContent =
      "html.cloud-locked body{overflow:hidden!important}" +
      "#cloudGate input{font-size:16px!important;user-select:text!important;-webkit-user-select:text!important;" +
      "-webkit-touch-callout:default!important;touch-action:auto!important}" +
      "@keyframes cloudToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
      "@keyframes cloudCardIn{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}";
    document.head.appendChild(css);
  }

  function buildGate(mode) {
    injectStyle();
    if (gateEl) gateEl.remove();
    document.documentElement.classList.add("cloud-locked");

    var wrap = el("div", "");
    wrap.id = "cloudGate";
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "padding:18px;background:radial-gradient(ellipse at 50% 0%, #1e293b 0%, #020617 62%, #000 100%);" +
      "font-family:Inter,system-ui,sans-serif;overflow:auto;";

    var card = el("div", "");
    card.style.cssText =
      "width:100%;max-width:390px;background:linear-gradient(165deg,rgba(15,23,42,.98),rgba(2,6,23,.99));" +
      "border:1.5px solid rgba(148,163,184,.28);border-radius:22px;padding:26px 22px;" +
      "box-shadow:0 24px 60px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.12);" +
      "animation:cloudCardIn .3s cubic-bezier(.2,.9,.3,1) both;";

    var h = el("div", "");
    h.style.cssText = "text-align:center;margin-bottom:18px;";
    h.innerHTML =
      '<div style="font-size:44px;line-height:1;filter:drop-shadow(0 0 14px rgba(245,158,11,.6))">🐴</div>' +
      '<div style="font-size:19px;font-weight:900;color:#fff;margin-top:8px;letter-spacing:.3px">Archero 2</div>' +
      '<div style="font-size:11px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:1.6px;margin-top:3px">Kỷ Nguyên Cung Thủ</div>' +
      '<div style="font-size:11.5px;color:#94a3b8;margin-top:10px;line-height:1.5">' +
      (mode === "login" ? "Đăng nhập để tiếp tục hành trình của bạn" : "Tạo tài khoản để bắt đầu hành trình") +
      "</div>";
    card.appendChild(h);

    var form = el("form", "");
    form.style.cssText = "display:flex;flex-direction:column;gap:11px;";

    function field(labelText, inputEl, hint) {
      var box = el("div", "");
      var lb = el("label", "", labelText);
      lb.style.cssText = "display:block;font-size:11px;font-weight:800;color:#cbd5e1;margin-bottom:5px;letter-spacing:.4px;";
      inputEl.style.cssText =
        "width:100%;box-sizing:border-box;background:#020617;border:1.5px solid #334155;border-radius:12px;" +
        "padding:11px 13px;color:#f8fafc;font-size:16px;font-weight:600;outline:none;font-family:inherit;" +
        "user-select:text;-webkit-user-select:text;-webkit-touch-callout:default;touch-action:auto;";
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
    userInput.autocapitalize = "none";
    if (userInput.setAttribute) userInput.setAttribute("autocorrect", "off");
    userInput.spellcheck = false;
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

    function resetSubmit() {
      submit.disabled = false;
      submit.style.opacity = "";
      submit.innerHTML = mode === "login" ? "🔓 Đăng Nhập" : "✨ Tạo Tài Khoản";
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (submit.disabled) return;
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
      loadingStage(0, "Đang xác thực tài khoản…");

      api(mode === "login" ? API.login : API.register, {
        method: "POST",
        body: { username: username, password: password },
      }).then(function (r) {
        if (!r.data || !r.data.ok) {
          hideLoading();
          errBox.textContent = (r.data && r.data.error) || "Không kết nối được máy chủ. Thử lại.";
          errBox.style.display = "block";
          resetSubmit();
          return;
        }
        state.authenticated = true;
        state.player = r.data.player;
        pendingRegister = mode === "register";
        loadingStage(1, "Đang tải tiến trình thật từ máy chủ…");
        // Tai khoan vua dang ky: server tra ve hasSave=false -> loadCloudSave()
        // dat buffer = null -> SaveState.load() ve dung tan thu.
        return loadCloudSave().then(function () {
          finishEnter();
          toast(mode === "login" ? "Chào mừng trở lại, " + (state.player.username || "") + "!" : "Tạo tài khoản thành công! Chúc may mắn!", "ok");
        }).catch(function (error) {
          resetSubmit();
          showLoadError(error);
        });
      }).catch(function () {
        hideLoading();
        errBox.textContent = "Lỗi mạng. Kiểm tra kết nối và thử lại.";
        errBox.style.display = "block";
        resetSubmit();
      });
    });

    card.appendChild(form);
    var foot = el("div", "", "🔒 Tiến trình lưu trên MongoDB Atlas — không dùng bộ nhớ trình duyệt");
    foot.style.cssText = "text-align:center;font-size:10px;color:#475569;margin-top:14px;font-weight:700;";
    card.appendChild(foot);

    wrap.appendChild(card);
    document.body.appendChild(wrap);
    gateEl = wrap;
    hideLoading();
    // iOS can dismiss the keyboard if a delayed scripted focus races the first tap.
    // Desktop keeps the convenience focus; touch users choose the field themselves.
    if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
      setTimeout(function () {
        if (gateEl === wrap && (!document.activeElement || document.activeElement === document.body)) userInput.focus();
      }, 60);
    }
  }

  function closeGate() {
    if (gateEl) { gateEl.remove(); gateEl = null; }
    document.documentElement.classList.remove("cloud-locked");
  }

  // ---------- Cloud save ----------
  /**
   * Tai save tu MongoDB va dat vao buffer trong bo nho.
   *
   * Tra ve true neu co save, false neu la tai khoan moi.
   * LUON xoa sach localStorage truoc va sau khi nap — khong de du lieu cua
   * tai khoan khac tren cung trinh duyet lot vao.
   */
  function loadCloudSave() {
    invalidateCheckpoints();
    purgeLegacyLocalSave();
    // Khoa ghi: SaveState.save() khong lam gi cho den khi co save that tu server.
    window.__ARTEMIS_SAVE_READY = false;
    state.ready = false;
    return api(API.save).then(function (r) {
      if (!r.ok || !r.data || r.data.ok !== true
          || (r.data.playerId !== undefined && (!state.player || r.data.playerId !== state.player.id))
          || typeof r.data.hasSave !== "boolean"
          || !Number.isSafeInteger(r.data.revision) || r.data.revision < 0
          || (r.data.hasSave && (r.data.revision === 0 || !r.data.data || typeof r.data.data !== "object"
              || Array.isArray(r.data.data) || Object.keys(r.data.data).length === 0))
          || (!r.data.hasSave && (r.data.data !== null || r.data.revision !== 0))) {
        throw new Error("Không tải được tiến trình. Hãy thử lại; dữ liệu chưa bị thay đổi.");
      }
      state.revision = r.data.revision;
      if (r.data.hasSave && r.data.data) {
        var payload = JSON.stringify(r.data.data);
        window.__ARTEMIS_SAVE_BUFFER = payload;
        state.lastPushedHash = hashStr(payload);
        lastPushedPayload = payload;
        return true;
      }
      // Tai khoan moi: buffer = null => SaveState.load() ve dung tan thu.
      window.__ARTEMIS_SAVE_BUFFER = null;
      state.lastPushedHash = "";
      lastPushedPayload = null;
      return false;
    }).catch(function (error) {
      state.lastError = error.message || "Không tải được tiến trình";
      throw error;
    }).then(function (hadSave) {
      // Mo khoa ghi SAU khi buffer da dung (du la null cho tai khoan moi).
      window.__ARTEMIS_SAVE_READY = true;
      return hadSave;
    });
  }

  /** Day buffer hien tai len MongoDB. */
  function pushCloudSave() {
    if (checkpoints.length) return checkpointBlocked ? Promise.resolve(false) : drainCheckpoints();
    if (state.saving) return savePromise;
    if (!state.authenticated || window.__ARTEMIS_SAVE_READY !== true) return;
    var payload = window.__ARTEMIS_SAVE_BUFFER;
    return sendCloudPayload(payload);
  }

  function sendCloudPayload(payload) {
    if (!state.authenticated || window.__ARTEMIS_SAVE_READY !== true) return;
    if (!payload) return;

    var h = hashStr(payload);
    if (payload === lastPushedPayload) { state.dirty = false; return; }

    var data;
    try { data = JSON.parse(payload); } catch (e) { return; }

    state.saving = true;
    var nextRevision = state.revision + 1;
    var epoch = saveEpoch;
    savePromise = api(API.save, { method: "PUT", body: { data: data, revision: state.revision, playerId: state.player.id } })
      .then(function (r) {
        if (epoch !== saveEpoch || !state.authenticated || checkpointOverflow) return;
        state.lastErrorCode = (r.data && r.data.code) || "";
        state.lastErrorDetail = (r.data && r.data.detail) || "";
        state.lastErrorStatus = r.status;
        state.lastErrorRetryable = r.status === 429 || r.status >= 500;
        if (r.ok && r.data && r.data.ok === true && r.data.revision === nextRevision) {
          state.lastErrorCode = "";
          state.lastErrorDetail = "";
          state.lastErrorStatus = 0;
          state.lastErrorRetryable = false;
          state.revision = r.data.revision;
          state.lastPushedHash = h;
          lastPushedPayload = payload;
          state.dirty = window.__ARTEMIS_SAVE_BUFFER !== payload;
          state.lastError = "";
          pulseSavedIndicator();
        } else if (r.data && r.data.code && String(r.data.code).indexOf("ECONOMY_") === 0) {
          // Server chan vi vang/da quy tang bat thuong. Khoi phuc ban ghi server.
          state.lastError = r.data.code;
          if (r.data.serverData) {
            var serverPayload = JSON.stringify(r.data.serverData);
            window.__ARTEMIS_SAVE_BUFFER = serverPayload;
            state.revision = Number(r.data.serverRevision) || 0;
            state.lastPushedHash = hashStr(serverPayload);
            lastPushedPayload = serverPayload;
            toast("Dữ liệu tài nguyên không hợp lệ đã bị từ chối. Đang tải lại tiến trình từ máy chủ…", "err");
            setTimeout(function () { location.reload(); }, 1600);
            return;
          }
          toast((r.data && r.data.error) || "Tiến trình không hợp lệ, chưa được lưu.", "err");
        } else if (r.data && r.data.code === "SAVE_MISSING") {
          // Tài khoản có seed chuẩn nhưng client không thấy save: tải lại để
          // GET khôi phục đúng snapshot máy chủ. Không ghi đè bằng state hiện tại.
          state.lastError = "save-missing";
          toast("Không tìm thấy tiến trình trên máy chủ. Đang tải lại để khôi phục…", "err");
          setTimeout(function () { location.reload(); }, 1400);
          return;
        } else if (r.status === 422) {
          // Transition rejection is not a revision conflict, even if the API sets conflict:true.
          state.lastError = ((r.data && r.data.error) || "Tiến trình không hợp lệ, chưa được lưu.")
            + (state.lastErrorDetail ? " (" + state.lastErrorDetail + ")" : "");
          toast(state.lastError + " Yêu cầu bị từ chối; bấm lại cùng dữ liệu sẽ không khắc phục. Dữ liệu máy chủ chưa bị ghi đè.", "err");
        } else if (r.status === 409 && r.data && r.data.conflict) {
          toast("Tiến trình đã đổi từ thiết bị khác. Tải lại trang để đồng bộ.", "warn");
          state.lastError = "conflict";
        } else {
          state.lastError = (r.data && r.data.error) || "Lưu thất bại";
        }
      })
      .catch(function () {
        if (epoch !== saveEpoch || !state.authenticated || checkpointOverflow) return;
        state.lastError = "Lỗi mạng. Kiểm tra kết nối rồi thử lưu lại.";
        state.lastErrorCode = "NETWORK_ERROR";
        state.lastErrorDetail = "";
        state.lastErrorStatus = 0;
        state.lastErrorRetryable = true;
      })
      .then(function () {
        state.saving = false;
        if (epoch === saveEpoch && !checkpoints.length && state.dirty && !state.lastError) scheduleSave();
      });
    return savePromise;
  }

  /** Flush trước giao dịch; khóa ghi đến khi tải lại snapshot server.
   * Mất phản hồi giữ nguyên requestId + revision để thử lại không bị trừ hai lần.
   */
  async function purchaseShopOffer(offerId, expectedBalance) {
    if (shopBusy) throw new Error("Đang xử lý giao dịch. Vui lòng chờ.");
    if (!state.authenticated) throw new Error("Bạn cần đăng nhập để mua bằng xu VIP.");
    if (pendingShopRequest && pendingShopRequest.offerId !== offerId) {
      throw new Error("Giao dịch trước chưa được xác nhận. Hãy bấm lại đúng gói đó để kiểm tra.");
    }
    shopBusy = true;
    try {
      if (!pendingShopRequest) {
        if (window.__ARTEMIS_SAVE_READY !== true) throw new Error("Tiến trình chưa đồng bộ. Hãy tải lại trang.");
        for (var attempt = 0; attempt < 3; attempt++) {
          await pushCloudSave();
          if (state.lastError) throw new Error("Chưa lưu được tiến trình: " + state.lastError);
          if (window.__ARTEMIS_SAVE_BUFFER === lastPushedPayload) break;
        }
        if (state.dirty || window.__ARTEMIS_SAVE_BUFFER !== lastPushedPayload || state.revision < 1) {
          throw new Error("Tiến trình đang thay đổi. Hãy thử mua lại sau khi lưu xong.");
        }
        pendingShopRequest = { offerId: offerId, playerId: state.player.id,
          revision: state.revision, requestId: window.crypto.randomUUID() };
        if (expectedBalance !== undefined) pendingShopRequest.expectedBalance = expectedBalance;
      }
      if (state.saveTimer) clearTimeout(state.saveTimer);
      state.saving = true;
      window.__ARTEMIS_SAVE_READY = false;
      var response = await api("/api/shop", { method: "POST", body: pendingShopRequest });
      if (!response.ok || response.data.ok !== true) {
        if (response.status < 500) {
          pendingShopRequest = null;
          if (response.status === 409) await refreshAfterShopPurchase();
          else window.__ARTEMIS_SAVE_READY = true;
        }
        throw new Error(response.data.error || "Chưa xác nhận được giao dịch. Hãy bấm lại đúng gói để kiểm tra.");
      }
      if (response.data.offerId !== offerId || !Number.isSafeInteger(response.data.revision)
          || response.data.revision <= pendingShopRequest.revision) {
        throw new Error("Phản hồi giao dịch không hợp lệ. Hãy bấm lại đúng gói để kiểm tra.");
      }
      await refreshAfterShopPurchase();
      pendingShopRequest = null;
      return response.data;
    } catch (error) {
      if (pendingShopRequest) window.__ARTEMIS_SAVE_READY = false;
      throw error;
    } finally {
      state.saving = false;
      shopBusy = false;
      if (!pendingShopRequest && window.__ARTEMIS_SAVE_READY === true && state.dirty) scheduleSave();
    }
  }

  async function refreshAfterShopPurchase() {
    try {
      await loadCloudSave();
      if (!window.Archero2FusionAPI || window.Archero2FusionAPI.reloadSaveFromStorage() === false) {
        throw new Error("Chưa dựng lại được tiến trình. Hãy tải lại trang để đồng bộ giao dịch.");
      }
      state.ready = true;
      state.lastError = "";
      state.dirty = window.__ARTEMIS_SAVE_BUFFER !== lastPushedPayload;
    } catch (error) {
      window.__ARTEMIS_SAVE_READY = false;
      throw error;
    }
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
      var who = (state.player && state.player.username) || "";
      if (!confirm("Đăng xuất khỏi tài khoản " + who + "?")) return;
      state.authenticated = false;
      window.__ARTEMIS_SAVE_READY = false;
      invalidateCheckpoints();
      api(API.logout, { method: "POST" }).then(function () {
        state.authenticated = false;
        window.__ARTEMIS_SAVE_BUFFER = null;
        purgeLegacyLocalSave();
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

  // ---------- Nghe SaveState.save() ----------
  /**
   * SaveState.save() phat su kien 'artemis:save' sau khi cap nhat buffer.
   * Khong con hook Storage.prototype nua: khong co localStorage thi khong co
   * gi de hook, va hook do truoc day bat MOI lan ghi cua ca trang.
   */
  function hookSaveEvents() {
    if (state.saveHookInstalled) return;
    state.saveHookInstalled = true;
    window.addEventListener("artemis:save", function () {
      if (!state.authenticated) return;
      updateIndicator("saving");
      scheduleSave();
    });
    // Truong hop dong tab / tai lai: day not thay doi con treo.
    window.addEventListener("beforeunload", function () {
      if (state.dirty && state.authenticated) pushCloudSave();
    });
  }

  // ---------- Khoi dong ----------
  function enterGame() {
    makeIndicator();
    hookSaveEvents();
    startGame();
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    // Xoa du lieu client cu NGAY khi trang tai, truoc ca khi biet phien nao.
    purgeLegacyLocalSave();
    document.documentElement.classList.add("cloud-locked");
    loadingStage(0, "Đang kiểm tra phiên đăng nhập…");
    api(API.me).then(function (r) {
      if (r.data && r.data.ok && r.data.authenticated) {
        state.authenticated = true;
        state.player = r.data.player;
        loadingStage(1, "Đang tải tiến trình thật từ máy chủ…");
        return loadCloudSave().then(function () {
          finishEnter();
        });
      }
      buildGate("login");
      return null;
    }).catch(function (error) {
      if (state.authenticated) { showLoadError(error); return; }
      buildGate("login");
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
    if (window.Archero2FusionAPI && typeof window.Archero2FusionAPI.reloadSaveFromStorage === "function") {
      if (window.Archero2FusionAPI.reloadSaveFromStorage() === false) {
        throw new Error("Không thể dựng tiến trình nhân vật. Vui lòng thử lại.");
      }
    }
    if (typeof window.__artemisStartGame !== "function") {
      throw new Error("Game chưa tải xong. Vui lòng thử lại.");
    }
    window.__artemisStartGame();
    state.ready = true;
  }

  // Game goi ham nay khi DOM xong; ta giu no lai cho den khi xac thuc xong.
  window.__artemisBootstrap = function (startFn) {
    window.__artemisStartGame = startFn;
    if (state.ready) startFn();
  };

  // Cong khai de debug/kiem thu.
  window.ArtemisCloud = {
    getState: function () { return Object.assign({}, state, {
      checkpointQueueDepth: checkpoints.length, checkpointBlocked: checkpointBlocked,
    }); },
    pushNow: function () { pushCloudSave(); return state.revision; },
    enqueueCheckpoint: enqueueCheckpoint,
    flushCheckpoint: async function () {
      if (checkpoints.length) return enqueueCheckpoint();
      for (var attempt = 0; attempt < 3; attempt++) {
        await pushCloudSave();
        if (state.lastError) return false;
        if (window.__ARTEMIS_SAVE_BUFFER === lastPushedPayload) return true;
      }
      return false;
    },
    patrolPreview: async function () {
      if (shopBusy || state.saving || pendingShopRequest) throw new Error("Đang đồng bộ tiến trình. Hãy thử lại.");
      shopBusy = true;
      try {
        await pushCloudSave();
        if (state.lastError || state.dirty || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) throw new Error("Chưa đồng bộ tiến trình.");
        var response = await api("/api/patrol");
        if (!response.ok || response.data.ok !== true) throw new Error(response.data.error || "Không tải được tuần tra.");
        // First preview initializes the server clock and may increment revision.
        if (response.data.revision !== state.revision) {
          state.saving = true;
          window.__ARTEMIS_SAVE_READY = false;
          await refreshAfterShopPurchase();
        }
        return response.data;
      } finally { state.saving = false; shopBusy = false; }
    },
    patrolRequest: async function (action, requestId) {
      if (shopBusy || state.saving || pendingShopRequest) throw new Error("Đang đồng bộ tiến trình. Hãy thử lại.");
      shopBusy = true;
      try {
        await pushCloudSave();
        if (state.lastError || state.dirty || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) throw new Error("Chưa đồng bộ tiến trình.");
        if (state.saveTimer) clearTimeout(state.saveTimer);
        state.saving = true;
        window.__ARTEMIS_SAVE_READY = false;
        var response;
        try {
          response = await api("/api/patrol", { method: "POST", body: { action: action, requestId: requestId, revision: state.revision } });
        } finally {
          // Even a lost response may have committed. Reload authoritative state before unlocking writes.
          await refreshAfterShopPurchase();
        }
        if (!response.ok || response.data.ok !== true) {
          var patrolError = new Error(response.data.error || "Không nhận được thưởng tuần tra.");
          patrolError.definitive = response.status >= 400 && response.status < 500;
          throw patrolError;
        }
        return response.data;
      } finally { state.saving = false; shopBusy = false; }
    },
    purchaseShopOffer: purchaseShopOffer,
    exploreRunes: async function (details) {
      if (shopBusy || state.saving || pendingShopRequest) throw new Error("Đang đồng bộ tiến trình. Hãy thử lại.");
      shopBusy = true;
      try {
        await pushCloudSave();
        if (state.lastError || state.dirty || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) throw new Error("Chưa đồng bộ tiến trình.");
        if (state.saveTimer) clearTimeout(state.saveTimer);
        state.saving = true;
        window.__ARTEMIS_SAVE_READY = false;
        var response;
        try {
          response = await api("/api/runes", { method: "POST", body: Object.assign({}, details, { action: "explore", revision: state.revision }) });
        } finally {
          // Resolve any committed grant before allowing ordinary client saves again.
          await refreshAfterShopPurchase();
        }
        if (!response.ok || response.data.ok !== true) throw new Error(response.data.error || "Không khám phá được cổ ngữ.");
        return response.data;
      } finally { state.saving = false; shopBusy = false; }
    },
    enchantRune: async function (runeId) {
      if (shopBusy || state.saving || pendingShopRequest) throw new Error("Đang đồng bộ tiến trình. Hãy thử lại.");
      shopBusy = true;
      try {
        await pushCloudSave();
        if (state.lastError || state.dirty || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) throw new Error("Chưa đồng bộ tiến trình.");
        if (state.saveTimer) clearTimeout(state.saveTimer);
        state.saving = true; window.__ARTEMIS_SAVE_READY = false;
        var response = await api("/api/runes", { method:"POST", body:{action:"enchant",runeId:runeId,revision:state.revision} });
        await refreshAfterShopPurchase();
        if (!response.ok || response.data.ok !== true) throw new Error(response.data.error || "Không phù phép được ngọc.");
        return response.data;
      } finally { state.saving = false; shopBusy = false; }
    },
    mergeRune: async function (runeId, tier) {
      if (shopBusy || state.saving || pendingShopRequest) throw new Error("Đang đồng bộ tiến trình. Hãy thử lại.");
      shopBusy = true;
      try {
        await pushCloudSave();
        if (state.lastError || state.dirty || !state.authenticated || window.__ARTEMIS_SAVE_READY !== true) {
          throw new Error("Chưa đồng bộ tiến trình. Hãy thử lại sau khi lưu xong.");
        }
        if (state.saveTimer) clearTimeout(state.saveTimer);
        state.saving = true;
        window.__ARTEMIS_SAVE_READY = false;
        var response = await api("/api/runes", { method: "POST", body: { action: "merge", runeId: runeId, tier: tier, revision: state.revision } });
        await refreshAfterShopPurchase();
        if (!response.ok || response.data.ok !== true) throw new Error(response.data.error || "Không ghép được ngọc.");
        return response.data;
      } finally {
        state.saving = false;
        shopBusy = false;
      }
    },
    getPendingShopOffer: function () { return pendingShopRequest ? pendingShopRequest.offerId : null; },
    loadCloudSave: loadCloudSave,
    toast: toast,
    purgeLegacyLocalSave: purgeLegacyLocalSave,
    SAVE_KEY: SAVE_KEY,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
