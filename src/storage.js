// Multiple save slots in localStorage: an index plus one entry per world
const INDEX_KEY = 'blocks-worlds';
const PREFIX = 'blocks-world-';
const LEGACY_KEY = 'blocks-save-v1';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function listWorlds() {
  migrate();
  const list = read(INDEX_KEY) || [];
  return list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

function writeIndex(list) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export function loadWorld(id) { return read(PREFIX + id); }

// Throws if storage is full
export function saveWorld(meta, data) {
  localStorage.setItem(PREFIX + meta.id, JSON.stringify(data));
  const list = read(INDEX_KEY) || [];
  const i = list.findIndex((w) => w.id === meta.id);
  const entry = { ...meta, lastPlayed: Date.now() };
  if (i >= 0) list[i] = entry; else list.push(entry);
  writeIndex(list);
}

export function deleteWorld(id) {
  localStorage.removeItem(PREFIX + id);
  writeIndex((read(INDEX_KEY) || []).filter((w) => w.id !== id));
}

export function newWorldId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function worldSize(id) {
  return (localStorage.getItem(PREFIX + id) || '').length;
}

// v1 had a single save slot
function migrate() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const data = JSON.parse(legacy);
    const id = newWorldId();
    localStorage.setItem(PREFIX + id, legacy);
    const list = read(INDEX_KEY) || [];
    list.push({ id, name: 'My World', seed: data.seed, mode: data.mode || 'creative', lastPlayed: Date.now() });
    writeIndex(list);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}
