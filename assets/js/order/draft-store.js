// Order draft persistence: text state in localStorage, media blobs in IndexedDB
// so photos survive a refresh, a closed tab or going back between steps.
const STATE_KEY = "lamsa:order-draft:v38";
const DB_NAME = "lamsa-order-draft", STORE = "files";
const DRAFT_MAX_AGE = 14 * 24 * 3600 * 1000;

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (!s || s.v !== 1 || Date.now() - Number(s.savedAt || 0) > DRAFT_MAX_AGE) return null;
    return s;
  } catch { return null; }
}

let timer = 0, locked = false;
export function saveState(state, onSaved) {
  clearTimeout(timer); if (locked) return;
  timer = setTimeout(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); onSaved?.(true); }
    catch { onSaved?.(false); }
  }, 350);
}
export function flushState(state) { clearTimeout(timer); if (locked) return; try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); } catch {} }

let dbp = null;
function db() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE); const req = fn(s); t.oncomplete = () => resolve(req?.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
}
// In-memory mirror keeps the session working even when IndexedDB is blocked
// (private mode); only persistence across reloads is lost in that case.
const mem = new Map();
export async function putFile(id, blob) { mem.set(id, blob); try { await tx("readwrite", s => s.put(blob, id)); return true; } catch { return false; } }
export async function getFile(id) { if (mem.has(id)) return mem.get(id); try { const b = await tx("readonly", s => s.get(id)); if (b) mem.set(id, b); return b || null; } catch { return null; } }
export async function deleteFile(id) { mem.delete(id); try { await tx("readwrite", s => s.delete(id)); } catch {} }
/** Clears the draft. After a successful order the draft stays locked so page-exit handlers cannot re-save it. */
export async function clearDraft({ lock = true } = {}) {
  clearTimeout(timer); mem.clear(); locked = lock;
  try { localStorage.removeItem(STATE_KEY); } catch {}
  try { await tx("readwrite", s => s.clear()); } catch {}
}
