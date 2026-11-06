// ==================== ARTEMIS JS ORACLE (headless) ====================
// Nạp NGUYÊN script trong public/index.html vào một DOM giả rồi lấy
// window.Archero2FusionAPI ra. Nhờ vậy test parity C# so sánh với CHÍNH code
// đang chạy production, không phải bản chép lại công thức.
//
// Dùng:
//   import { loadOracle } from "./oracle.mjs";
//   const oracle = await loadOracle();
//   oracle.getComputedStats();
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..");
export const INDEX_HTML = path.join(REPO_ROOT, "public", "index.html");

/** Trích mọi khối <script> không có src. */
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/** Một phần tử giả: mọi thuộc tính là object/function tuỳ biến, không ném lỗi. */
function makeEl(tag = "div") {
  const store = {
    tagName: String(tag).toUpperCase(),
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [],
    textContent: "",
    innerHTML: "",
    innerText: "",
    value: "",
    checked: false,
    disabled: false,
    width: 1280,
    height: 720,
  };
  const el = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === "symbol") return undefined;
      if (k === "appendChild" || k === "insertBefore" || k === "removeChild") {
        return (c) => { t.children.push(c); return c; };
      }
      if (k === "remove") return () => {};
      if (k === "addEventListener" || k === "removeEventListener") return () => {};
      if (k === "append" || k === "prepend") return () => {};
      if (k === "querySelector" || k === "querySelectorAll") {
        return k === "querySelectorAll" ? () => [] : () => makeEl();
      }
      if (k === "getBoundingClientRect") {
        return () => ({ x: 0, y: 0, top: 0, left: 0, right: 1280, bottom: 720, width: 1280, height: 720 });
      }
      if (k === "getContext") return () => makeCtx();
      if (k === "focus" || k === "blur" || k === "click" || k === "setAttribute" ||
          k === "removeAttribute" || k === "scrollIntoView" || k === "submit") {
        return () => {};
      }
      if (k === "toDataURL") return () => "data:image/png;base64,";
      if (k === "offsetWidth" || k === "offsetHeight" || k === "clientWidth" || k === "clientHeight") return 1280;
      // Bất kỳ thuộc tính lạ: trả về một giá trị vô hại.
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return el;
}

/** Canvas 2D context giả: mọi hàm vẽ là no-op, gradient trả về chính nó. */
function makeCtx() {
  const gradient = { addColorStop() {} };
  const base = {
    canvas: { width: 1280, height: 720 },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    isPointInPath: () => false,
  };
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === "symbol") return undefined;
      if (k === "globalAlpha" || k === "lineWidth" || k === "font") return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: (k) => m.delete(String(k)),
    clear: () => m.clear(),
  };
}

/**
 * Chạy script game trong sandbox và trả về:
 *   { api, window, sandbox } — api === window.Archero2FusionAPI
 * Không chạy boot (không gọi load event) nên không cần mạng, không cần canvas thật.
 */
export function loadOracle({ htmlPath = INDEX_HTML } = {}) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = inlineScripts(html);
  if (!scripts.length) throw new Error("Không tìm thấy <script> inline trong index.html");

  const elements = new Map();
  const document = {
    readyState: "loading",
    documentElement: makeEl("html"),
    head: makeEl("head"),
    body: makeEl("body"),
    title: "Artemis",
    createElement: (tag) => makeEl(tag),
    createElementNS: (_ns, tag) => makeEl(tag),
    createTextNode: (t) => ({ textContent: t }),
    createDocumentFragment: () => makeEl("fragment"),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, makeEl("div"));
      return elements.get(id);
    },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    addEventListener() {},
    removeEventListener() {},
    cookie: "",
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  };

  const win = {
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    navigator: { userAgent: "node-oracle", language: "vi-VN", languages: ["vi-VN"], platform: "node" },
    location: { href: "http://localhost/", reload() {}, pathname: "/", search: "", hash: "" },
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    outerWidth: 1280,
    outerHeight: 720,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout: (fn) => { void fn; return 0; },
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    fetch: () => Promise.reject(new Error("oracle: không có mạng")),
    AudioContext: function () {
      return {
        state: "running",
        currentTime: 0,
        createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} }, type: "" }),
        createGain: () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }),
        destination: {},
        resume() {},
      };
    },
    console,
    JSON,
    Math,
    Date,
    performance: { now: () => 0 },
    WebSocket: undefined,
  };
  win.window = win;
  win.globalThis = win;
  win.self = win;

  // Shim các lớp DOM canvas mà script game đọc trực tiếp trên prototype.
  function CanvasRenderingContext2D() {}
  CanvasRenderingContext2D.prototype.shadowBlur = 0;
  CanvasRenderingContext2D.prototype.shadowColor = "transparent";
  CanvasRenderingContext2D.prototype.shadowOffsetX = 0;
  CanvasRenderingContext2D.prototype.shadowOffsetY = 0;
  win.CanvasRenderingContext2D = CanvasRenderingContext2D;
  win.Path2D = function Path2D() {
    return { addPath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {}, closePath() {}, ellipse() {}, bezierCurveTo() {}, quadraticCurveTo() {} };
  };
  win.Image = function Image() {
    return { addEventListener() {}, removeEventListener() {}, src: "", width: 0, height: 0, complete: true };
  };
  win.HTMLCanvasElement = function HTMLCanvasElement() {};
  win.OffscreenCanvas = function OffscreenCanvas() {
    return { getContext: () => makeCtx(), width: 1280, height: 720 };
  };
  win.DOMParser = function DOMParser() {
    return { parseFromString: () => ({ querySelector: () => null, querySelectorAll: () => [] }) };
  };
  win.XMLHttpRequest = function XMLHttpRequest() {
    return { open() {}, send() {}, addEventListener() {}, setRequestHeader() {}, status: 0, responseText: "{}" };
  };
  win.alert = () => {};
  win.confirm = () => false;
  win.prompt = () => null;

  const sandbox = vm.createContext(win);
  for (const src of scripts) {
    try {
      new vm.Script(src, { filename: "index.html:inline-script" }).runInContext(sandbox, { timeout: 60_000 });
    } catch (e) {
      // Script vẽ/UI có thể chạm API trình duyệt không giả lập được. Chỉ coi là
      // lỗi nếu API lõi không xuất hiện — kiểm tra ở dưới.
      win.__oracleScriptError = e;
    }
  }

  const api = sandbox.Archero2FusionAPI;
  if (!api) {
    const err = win.__oracleScriptError;
    throw new Error("Không lấy được window.Archero2FusionAPI" + (err ? ": " + err.message : ""));
  }
  return { api, window: win, sandbox, document };
}

export default loadOracle;
