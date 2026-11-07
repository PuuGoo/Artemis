// ==================== BACKEND BỘ NHỚ (CHỈ DÙNG CHO DEV/TEST) ====================
//
// Mục đích: chạy được toàn bộ stack HTTP thật (register → login → save → reload)
// trên máy local mà KHÔNG cần MongoDB Atlas, KHÔNG đọc `.env`, KHÔNG chạm dữ liệu
// thật. Nhờ vậy E2E có thể đi qua đúng route, đúng cookie/JWT và đúng nhánh
// revision CAS thay vì mock ở tầng fetch.
//
// An toàn:
//   • Chỉ bật khi `DB_BACKEND === "memory"` VÀ `NODE_ENV !== "production"`.
//   • Nếu ai đó cố bật trên production, `getMongoDb()` ném lỗi thay vì chạy
//     bằng bộ nhớ (dữ liệu người chơi sẽ "biến mất" giữa các lambda).
//   • Chỉ hỗ trợ đúng các toán tử mà API đang dùng; toán tử khác ném lỗi rõ ràng
//     thay vì lặng lẽ trả sai.

import { ObjectId } from "mongodb";

const COLLECTION_NAMES = ["players", "saves", "login_attempts", "revoked_sessions"];

let store = null;

function freshStore() {
  const collections = {};
  for (const name of COLLECTION_NAMES) collections[name] = [];
  return collections;
}

function ensureStore() {
  if (!store) store = freshStore();
  return store;
}

/** Xoá sạch dữ liệu trong bộ nhớ (test dùng giữa các kịch bản). */
export function resetMemoryDb() {
  store = freshStore();
}

/** Ảnh chụp để test khẳng định trực tiếp trên "DB". */
export function dumpMemoryDb() {
  ensureStore();
  return JSON.parse(JSON.stringify(store));
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof ObjectId);
}

function getPath(doc, path) {
  return String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], doc);
}

/** So khớp một field với giá trị/điều kiện trong query. */
function fieldMatches(actual, expected) {
  if (isPlainObject(expected)) {
    const ops = Object.keys(expected);
    if (ops.length === 0) return true;
    for (const op of ops) {
      const operand = expected[op];
      if (op === "$exists") {
        const exists = actual !== undefined;
        if (Boolean(operand) !== exists) return false;
      } else if (op === "$in") {
        if (!operand.some((x) => eq(actual, x))) return false;
      } else if (op === "$ne") {
        if (eq(actual, operand)) return false;
      } else if (op === "$gte") {
        if (actual === undefined || actual < operand) return false;
      } else if (op === "$regex") {
        if (!new RegExp(operand, expected.$options || "").test(String(actual ?? ""))) return false;
      } else if (op === "$options") {
        continue;
      } else {
        throw new Error(`[mongoMemory] chưa hỗ trợ toán tử ${op}`);
      }
    }
    return true;
  }
  return eq(actual, expected);
}

function eq(a, b) {
  if (a === b) return true;
  if (a instanceof ObjectId && b instanceof ObjectId) return a.equals(b);
  if (a instanceof ObjectId || b instanceof ObjectId) {
    const left = a instanceof ObjectId ? a.toHexString() : String(a);
    const right = b instanceof ObjectId ? b.toHexString() : String(b);
    return left === right;
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

function matches(doc, query) {
  if (!doc) return false;
  for (const [key, expected] of Object.entries(query || {})) {
    if (key === "$or") {
      if (!Array.isArray(expected) || !expected.some(branch => matches(doc, branch))) return false;
      continue;
    }
    if (!fieldMatches(getPath(doc, key), expected)) return false;
  }
  return true;
}

function project(doc, projection) {
  if (!projection) return structuredCloneDoc(doc);
  const out = {};
  let hasInclude = false;
  for (const [key, flag] of Object.entries(projection)) {
    if (flag) hasInclude = true;
    if (!flag) continue;
    const [root, child] = key.split(".");
    if (!(root in doc)) continue;
    if (child) {
      if (doc[root] && typeof doc[root] === "object" && child in doc[root]) {
        if (!out[root]) out[root] = {};
        out[root][child] = structuredCloneDoc(doc[root][child]);
      }
    } else {
      out[root] = structuredCloneDoc(doc[root]);
    }
  }
  if (!hasInclude) {
    const copy = structuredCloneDoc(doc);
    for (const [key, flag] of Object.entries(projection)) if (!flag) delete copy[key];
    return copy;
  }
  if (Object.hasOwn(doc, "_id") && projection._id !== 0) out._id = doc._id;
  return out;
}

function structuredCloneDoc(v) {
  if (v instanceof ObjectId) return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(structuredCloneDoc);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = structuredCloneDoc(val);
    return out;
  }
  return v;
}

function applyUpdate(doc, update) {
  for (const [op, payload] of Object.entries(update || {})) {
    if (!isPlainObject(payload)) throw new Error(`[mongoMemory] ${op} cần object`);
    if (op === "$set" || op === "$setOnInsert") {
      if (op === "$setOnInsert") continue;
      for (const [k, v] of Object.entries(payload)) {
        if (k.includes(".")) throw new Error(`[mongoMemory] chưa hỗ trợ $set lồng "${k}"`);
        doc[k] = structuredCloneDoc(v);
      }
    } else if (op === "$inc") {
      for (const [k, v] of Object.entries(payload)) {
        doc[k] = (Number(doc[k]) || 0) + Number(v);
      }
    } else {
      throw new Error(`[mongoMemory] chưa hỗ trợ toán tử cập nhật ${op}`);
    }
  }
  return doc;
}

function makeCollection(name, rows) {
  return {
    collectionName: name,

    async createIndex() {
      return `index_${name}`;
    },

    async insertOne(doc) {
      const cloned = structuredCloneDoc(doc);
      if (!cloned._id) cloned._id = new ObjectId();
      if (name === "players") {
        if (rows.some((r) => r.usernameLower === cloned.usernameLower)) {
          throw Object.assign(new Error("E11000 duplicate key usernameLower"), { code: 11000 });
        }
      }
      if (name === "saves") {
        if (rows.some((r) => r.playerId === cloned.playerId)) {
          throw Object.assign(new Error("E11000 duplicate key playerId"), { code: 11000 });
        }
      }
      if (name === "login_attempts") {
        if (rows.some((r) => r.key === cloned.key)) {
          throw Object.assign(new Error("E11000 duplicate key key"), { code: 11000 });
        }
      }
      rows.push(cloned);
      return { acknowledged: true, insertedId: cloned._id };
    },

    async findOne(query = {}, options = {}) {
      const hit = rows.find((r) => matches(r, query));
      return hit ? project(hit, options.projection) : null;
    },

    async countDocuments(query = {}) {
      return rows.filter(row => matches(row, query)).length;
    },

    find(query = {}, options = {}) {
      let found = rows.filter(row => matches(row, query));
      const cursor = {
        sort(spec) {
          const [path, direction] = Object.entries(spec)[0];
          found = [...found].sort((a, b) => {
            const av = getPath(a, path), bv = getPath(b, path);
            return (av > bv ? 1 : av < bv ? -1 : 0) * Math.sign(direction);
          });
          return cursor;
        },
        skip(n) { found = found.slice(n); return cursor; },
        limit(n) { found = found.slice(0, n); return cursor; },
        async toArray() { return found.map(row => project(row, options.projection)); },
      };
      return cursor;
    },

    aggregate(stages) {
      let found = rows.map(structuredCloneDoc);
      for (const stage of stages) {
        if (stage.$sort) {
          const [path, direction] = Object.entries(stage.$sort)[0];
          found.sort((a, b) => (getPath(a, path) > getPath(b, path) ? 1 : getPath(a, path) < getPath(b, path) ? -1 : 0) * Math.sign(direction));
        } else if (stage.$limit) {
          found = found.slice(0, stage.$limit);
        } else if (stage.$project) {
          found = found.map(row => Object.fromEntries(Object.entries(stage.$project)
            .filter(([, expr]) => expr !== 0)
            .map(([key, expr]) => [key, typeof expr === 'string' && expr.startsWith('$') ? getPath(row, expr.slice(1)) : getPath(row, key)])));
        } else if (stage.$group) {
          if (found.length === 0) { found = []; continue; }
          const grouped = { _id: stage.$group._id };
          for (const [key, expr] of Object.entries(stage.$group)) {
            if (key === '_id') continue;
            const op = Object.keys(expr)[0];
            const path = expr[op].slice(1);
            const values = found.map(row => Number(getPath(row, path))).filter(Number.isFinite);
            grouped[key] = op === '$sum' ? values.reduce((sum, n) => sum + n, 0)
              : op === '$avg' ? (values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null)
              : (() => { throw new Error(`[mongoMemory] aggregate ${op} chưa hỗ trợ`); })();
          }
          found = [grouped];
        } else {
          throw new Error(`[mongoMemory] aggregate stage chưa hỗ trợ`);
        }
      }
      return { async toArray() { return found; } };
    },

    async updateOne(query, update, options = {}) {
      const hit = rows.find((r) => matches(r, query));
      if (!hit) {
        if (!options.upsert) return { matchedCount: 0, modifiedCount: 0 };
        const base = {};
        for (const [k, v] of Object.entries(query || {})) {
          if (!isPlainObject(v)) base[k] = structuredCloneDoc(v);
        }
        if (update && update.$setOnInsert) {
          for (const [k, v] of Object.entries(update.$setOnInsert)) base[k] = structuredCloneDoc(v);
        }
        const created = applyUpdate(base, update);
        if (!created._id) created._id = new ObjectId();
        rows.push(created);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: created._id };
      }
      applyUpdate(hit, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async findOneAndUpdate(query, update, options = {}) {
      const hit = rows.find((r) => matches(r, query));
      if (!hit) {
        if (!options.upsert) return { value: null };
        const base = {};
        for (const [k, v] of Object.entries(query || {})) {
          if (!isPlainObject(v)) base[k] = structuredCloneDoc(v);
        }
        if (update && update.$setOnInsert) {
          for (const [k, v] of Object.entries(update.$setOnInsert)) base[k] = structuredCloneDoc(v);
        }
        const created = applyUpdate(base, update);
        if (!created._id) created._id = new ObjectId();
        rows.push(created);
        return { value: structuredCloneDoc(created) };
      }
      applyUpdate(hit, update);
      return { value: structuredCloneDoc(hit) };
    },

    async deleteMany(query = {}) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], query)) rows.splice(i, 1);
      }
      return { deletedCount: before - rows.length };
    },
  };
}

export function createMemoryDb() {
  ensureStore();
  const db = {
    databaseName: "artemis_memory",
    collection(name) {
      if (!COLLECTION_NAMES.includes(name)) {
        throw new Error(`[mongoMemory] collection chưa hỗ trợ: ${name}`);
      }
      return makeCollection(name, store[name]);
    },
    async command() {
      return { ok: 1 };
    },
  };
  return db;
}

/** Bật/tắt backend trong bộ nhớ có kiểm soát môi trường. */
export function memoryBackendAllowed(env = process.env) {
  return env.DB_BACKEND === "memory" && env.NODE_ENV !== "production";
}
