import { CREATIVE_BLOCKS } from './blocks.js';
import { CREATIVE_ITEMS, ITEMS, itemName, getDef } from './items.js';
import { RECIPES, canCraft } from './inventory.js';

export const $ = (id) => document.getElementById(id);

// ---------- Pixel HUD icons ----------
function pixelIcon(rows, palette) {
  const c = document.createElement('canvas');
  c.width = c.height = 9;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (palette[ch]) { ctx.fillStyle = palette[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}
const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrrrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
const HALF = ['.kk...kk.', 'krrk.kddk', 'krwrkdddk', 'krrrkdddk', 'krrrkdddk', '.krrkddk.', '..krkdk..', '...kdk...', '....k....'];
const FOOD = ['.....kk..', '....kbbk.', '...kbbbbk', '..kbbbbbk', '..kbbbbk.', '.kwkbbk..', 'kwk.kk...', 'kk.......', '.........'];
const FOOD_HALF = ['.....kk..', '....kbbk.', '...kbbbbk', '..kdddbbk', '..kdddbk.', '.kdkddk..', 'kdk.kk...', 'kk.......', '.........'];
const BUBBLE = ['.........', '...kkk...', '..kwbbk..', '.kwbbbbk.', '.kbbbbbk.', '.kbbbbbk.', '..kbbbk..', '...kkk...', '.........'];
export const ICONS = {
  heart: pixelIcon(HEART, { k: '#000', r: '#e02020', w: '#fff' }),
  heartHalf: pixelIcon(HALF, { k: '#000', r: '#e02020', w: '#fff', d: '#3b0d0d' }),
  heartEmpty: pixelIcon(HEART, { k: '#000', r: '#3b0d0d', w: '#3b0d0d' }),
  food: pixelIcon(FOOD, { k: '#000', b: '#b8743a', w: '#eee' }),
  foodHalf: pixelIcon(FOOD_HALF, { k: '#000', b: '#b8743a', d: '#3a2410' }),
  foodEmpty: pixelIcon(FOOD, { k: '#000', b: '#3a2410', w: '#3a2410' }),
  bubble: pixelIcon(BUBBLE, { k: '#1b4a80', b: '#5ab4ff', w: '#fff' }),
};

export function renderStats(g) {
  const survival = g.mode === 'survival';
  $('stats').classList.toggle('hidden', !survival);
  if (!survival) return;
  const bar = (v, full, half, empty) => {
    let s = '';
    for (let i = 0; i < 10; i++) {
      const x = v - i * 2;
      s += `<img src="${x >= 2 ? full : x === 1 ? half : empty}" alt="">`;
    }
    return s;
  };
  const key = `${Math.ceil(g.health)}|${g.hunger}|${g.player.headInWater ? Math.ceil(g.air) : -1}`;
  if (key === renderStats.last) return;
  renderStats.last = key;
  $('hearts').innerHTML = bar(Math.ceil(g.health), ICONS.heart, ICONS.heartHalf, ICONS.heartEmpty);
  $('hunger').innerHTML = bar(g.hunger, ICONS.food, ICONS.foodHalf, ICONS.foodEmpty);
  let b = '';
  if (g.player.headInWater) for (let i = 0; i < Math.ceil(g.air); i++) b += `<img src="${ICONS.bubble}" alt="">`;
  $('bubbles').innerHTML = b;
}

// ---------- Hotbar ----------
function slotHTML() { return '<img alt=""><span class="count"></span><span class="dura hidden"><i></i></span>'; }

function fillSlot(s, g, id, selected) {
  const img = s.querySelector('img'), cnt = s.querySelector('.count'), dura = s.querySelector('.dura');
  s.classList.toggle('sel', selected);
  if (id) { img.src = g.icon(id); img.style.visibility = 'visible'; } else img.style.visibility = 'hidden';
  const survival = g.mode === 'survival';
  const n = survival && id ? g.inv.count(id) : 0;
  cnt.textContent = survival && n > 1 ? n : '';
  s.classList.toggle('empty', survival && !!id && n <= 0);
  const tool = ITEMS[id]?.tool;
  if (survival && tool && n > 0) {
    const d = g.inv.durability(id);
    dura.classList.toggle('hidden', d >= 1);
    dura.firstChild.style.width = `${Math.max(0, d) * 100}%`;
    dura.firstChild.style.background = `hsl(${d * 120}, 90%, 45%)`;
  } else dura.classList.add('hidden');
}

export function renderHotbar(g, el, onPick) {
  if (el.children.length !== 9) {
    el.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = slotHTML();
      const pick = (e) => { e.preventDefault(); e.stopPropagation(); onPick(i); };
      s.addEventListener('touchstart', pick, { passive: false });
      s.addEventListener('mousedown', pick);
      el.appendChild(s);
    }
  }
  [...el.children].forEach((s, i) => fillSlot(s, g, g.inv.hotbar[i], i === g.inv.sel));
}

// ---------- Inventory / crafting ----------
export function buildInventory(g, { tab, stations, onAssign, onCraft, onTab }) {
  const survival = g.mode === 'survival';
  const tabs = $('inv-tabs');
  const tabList = survival ? [['inv', 'Inventory & Crafting']] : [['blocks', 'Blocks'], ['items', 'Items']];
  tabs.innerHTML = '';
  for (const [key, label] of tabList) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', key === tab);
    b.addEventListener('click', () => onTab(key));
    tabs.appendChild(b);
  }

  const grid = $('inv-grid');
  grid.innerHTML = '';
  let ids;
  if (survival) ids = Object.keys(g.inv.counts).map(Number).filter((id) => g.inv.count(id) > 0).sort((a, b) => a - b);
  else ids = tab === 'items' ? CREATIVE_ITEMS : CREATIVE_BLOCKS;
  for (const id of ids) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.title = itemName(id);
    s.innerHTML = slotHTML();
    fillSlot(s, g, id, false);
    s.addEventListener('click', () => onAssign(id));
    grid.appendChild(s);
  }
  if (survival && !ids.length) grid.insertAdjacentHTML('beforeend', '<p class="hint" style="grid-column:1/-1">Empty. Hold on blocks to mine them, or punch a tree to get started.</p>');

  const craftPanel = $('craft-panel');
  craftPanel.classList.toggle('hidden', !survival);
  if (survival) {
    const list = $('craft-list');
    list.innerHTML = '';
    $('craft-hint').textContent = `Crafting${stations.table ? ' · Table ✓' : ''}${stations.furnace ? ' · Furnace ✓' : ''}`;
    const sorted = RECIPES.map((r) => ({ r, ok: canCraft(g.inv, r, stations) }))
      .sort((a, b) => (b.ok - a.ok));
    for (const { r, ok } of sorted) {
      // Only show recipes that are possible now, or where the player has at least one ingredient
      if (!ok && !r.in.some(([id]) => g.inv.count(id) > 0)) continue;
      const b = document.createElement('button');
      b.className = 'recipe' + (ok ? '' : ' no');
      const station = r.station === 'table' ? 'Crafting Table' : r.station === 'furnace' ? 'Furnace + fuel' : '';
      b.innerHTML = r.in.map(([id, n]) => `${n}×<img src="${g.icon(id)}" alt="">`).join(' ') +
        (station ? ` <span class="station">${station}</span>` : '') +
        `<span class="out">→ ${r.out[1] > 1 ? r.out[1] + '×' : ''}<img src="${g.icon(r.out[0])}" alt="">${getDef(r.out[0]).name}</span>`;
      b.addEventListener('click', () => onCraft(r));
      list.appendChild(b);
    }
    if (!list.children.length) list.innerHTML = '<p class="hint">Collect wood to start crafting.</p>';
  }
}

// ---------- World list ----------
export function renderWorldList(worlds, { onPlay, onDelete }) {
  const el = $('world-list');
  el.innerHTML = '';
  if (!worlds.length) { el.innerHTML = '<div class="world-empty">No worlds yet. Create one!</div>'; return; }
  for (const w of worlds) {
    const row = document.createElement('div');
    row.className = 'world';
    const date = w.lastPlayed ? new Date(w.lastPlayed).toLocaleDateString() : '';
    row.innerHTML = `<div class="meta"><div class="name"></div><div class="desc">${w.mode === 'creative' ? 'Creative' : 'Survival'} · ${date}</div></div><button class="del">Delete</button>`;
    row.querySelector('.name').textContent = w.name || 'World';
    row.addEventListener('click', () => onPlay(w));
    const del = row.querySelector('.del');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (del.classList.contains('confirm')) onDelete(w);
      else { del.classList.add('confirm'); del.textContent = 'Sure?'; setTimeout(() => { del.classList.remove('confirm'); del.textContent = 'Delete'; }, 2500); }
    });
    el.appendChild(row);
  }
}
