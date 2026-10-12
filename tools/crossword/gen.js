/* Generador de crucigramas: plantillas de casillas negras + relleno por backtracking (CSP)
 * usando solo palabras del banco (que ya tienen pista). Funciona en Node. */
"use strict";

/* ---------- aleatoriedad reproducible ---------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- plantillas ---------- */
// true = casilla negra. Simetría rotacional de 180°.
function runs(g, N, byRow) {
  const out = [];
  for (let a = 0; a < N; a++) {
    let start = -1;
    for (let b = 0; b <= N; b++) {
      const black = b === N || (byRow ? g[a * N + b] : g[b * N + a]);
      if (!black && start < 0) start = b;
      if (black && start >= 0) { out.push({ a, start, len: b - start }); start = -1; }
    }
  }
  return out;
}
function connected(g, N) {
  const w = []; for (let i = 0; i < N * N; i++) if (!g[i]) w.push(i);
  if (!w.length) return false;
  const seen = new Set([w[0]]), st = [w[0]];
  while (st.length) {
    const c = st.pop(), r = (c / N) | 0, k = c % N;
    for (const [dr, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nk = k + dk;
      if (nr < 0 || nk < 0 || nr >= N || nk >= N) continue;
      const n = nr * N + nk; if (!g[n] && !seen.has(n)) { seen.add(n); st.push(n); }
    }
  }
  return seen.size === w.length;
}
function templateOk(g, N, opt) {
  const rr = runs(g, N, true), cr = runs(g, N, false);
  if (rr.some((r) => r.len === 2) || cr.some((r) => r.len === 2)) return false;
  // casillas sin cruce (solo en una palabra): máximo opt.maxUnchecked
  const inRow = new Uint8Array(N * N), inCol = new Uint8Array(N * N);
  for (const r of rr) if (r.len >= 3) for (let k = 0; k < r.len; k++) inRow[r.a * N + r.start + k] = 1;
  for (const r of cr) if (r.len >= 3) for (let k = 0; k < r.len; k++) inCol[(r.start + k) * N + r.a] = 1;
  let unchecked = 0;
  for (let i = 0; i < N * N; i++) if (!g[i]) { if (!inRow[i] && !inCol[i]) return false; if (!(inRow[i] && inCol[i])) unchecked++; }
  if (unchecked > opt.maxUnchecked) return false;
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const i = r * N + c; if (g[i] && g[i + 1] && g[i + N] && g[i + N + 1]) return false; }  // sin bloques 2x2
  return connected(g, N);
}
function penalty(g, N, opt) {
  const rr = runs(g, N, true), cr = runs(g, N, false);
  let pen = 0, blacks = 0;
  for (const r of rr) if (r.len === 2) pen += 3;
  for (const r of cr) if (r.len === 2) pen += 3;
  for (const r of rr.concat(cr)) if (r.len > opt.maxLen) pen += 3 * (r.len - opt.maxLen);
  const threes = rr.concat(cr).filter((r) => r.len === 3).length;
  if (threes > opt.max3) pen += threes - opt.max3;
  const inRow = new Uint8Array(N * N), inCol = new Uint8Array(N * N);
  for (const r of rr) if (r.len >= 3) for (let k = 0; k < r.len; k++) inRow[r.a * N + r.start + k] = 1;
  for (const r of cr) if (r.len >= 3) for (let k = 0; k < r.len; k++) inCol[(r.start + k) * N + r.a] = 1;
  let unchecked = 0;
  for (let i = 0; i < N * N; i++) {
    if (g[i]) { blacks++; continue; }
    if (!inRow[i] && !inCol[i]) pen += 4; else if (!(inRow[i] && inCol[i])) unchecked++;
  }
  if (unchecked > opt.maxUnchecked) pen += unchecked - opt.maxUnchecked;
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const i = r * N + c; if (g[i] && g[i + 1] && g[i + N] && g[i + N + 1]) pen += 4; }
  if (blacks < opt.blacks[0]) pen += opt.blacks[0] - blacks; else if (blacks > opt.blacks[1]) pen += blacks - opt.blacks[1];
  if (!connected(g, N)) pen += 10;
  return pen;
}
function makeTemplate(N, rand, opt = {}) {
  opt = Object.assign({ blacks: N === 9 ? [16, 24] : [30, 40], maxUnchecked: N === 9 ? 6 : 12, maxLen: N === 9 ? 6 : 7, max3: N === 9 ? 5 : 8 }, opt);
  const half = Math.ceil(N * N / 2);
  for (let attempt = 0; attempt < 20; attempt++) {
    const g = new Uint8Array(N * N), mid = opt.blacks[0] + Math.floor(rand() * (opt.blacks[1] - opt.blacks[0] + 1));
    for (let k = 0; k < Math.floor(mid / 2); k++) { const c = Math.floor(rand() * half); g[c] = 1; g[N * N - 1 - c] = 1; }
    let pen = penalty(g, N, opt);
    for (let it = 0; it < 3000 && pen > 0; it++) {
      const c = Math.floor(rand() * half), m = N * N - 1 - c;
      g[c] ^= 1; g[m] = g[c];
      const np = penalty(g, N, opt);
      if (np <= pen || rand() < 0.02) pen = np; else { g[c] ^= 1; g[m] = g[c]; }
    }
    if (pen === 0 && templateOk(g, N, opt)) return g;
  }
  return null;
}
function slotsOf(g, N) {
  const out = [];
  for (const r of runs(g, N, true)) if (r.len >= 3) out.push({ dir: "A", cells: Array.from({ length: r.len }, (_, k) => r.a * N + r.start + k) });
  for (const r of runs(g, N, false)) if (r.len >= 3) out.push({ dir: "D", cells: Array.from({ length: r.len }, (_, k) => (r.start + k) * N + r.a) });
  return out;
}

/* ---------- banco indexado ---------- */
// entries: [{w: "casa", rank, ...}]  (w normalizada, sin tildes)
function buildIndex(entries) {
  const byLen = new Map();
  entries.forEach((e, id) => {
    if (!byLen.has(e.w.length)) byLen.set(e.w.length, { ids: [], pos: [] });
    const L = byLen.get(e.w.length); L.ids.push(id);
    for (let p = 0; p < e.w.length; p++) { const m = (L.pos[p] ||= new Map()); const k = e.w[p]; if (!m.has(k)) m.set(k, []); m.get(k).push(id); }
  });
  return { entries, byLen };
}

/* ---------- relleno ---------- */
function fill(index, g, N, rand, opt = {}) {
  const { entries, byLen } = index, maxNodes = opt.maxNodes || 20000, usage = opt.usage || null, allowed = opt.allowed || null;
  const slots = slotsOf(g, N), grid = new Array(N * N).fill(null), used = new Set(), stems = new Set();
  const stemOf = (w) => w.slice(0, Math.max(4, Math.min(5, w.length - 1)));   // evita casa/casas/casar, cena/cenar...
  let nodes = 0;
  const cand = (s) => {                    // lista de ids compatibles con las letras ya puestas
    const L = byLen.get(s.cells.length); if (!L) return [];
    let best = null, fixed = [];
    for (let p = 0; p < s.cells.length; p++) {
      const ch = grid[s.cells[p]]; if (!ch) continue;
      fixed.push([p, ch]);
      const lst = L.pos[p].get(ch) || []; if (!best || lst.length < best.length) best = lst;
    }
    const base = best || L.ids, out = [];
    for (const id of base) {
      const w = entries[id].w;
      if (used.has(w) || stems.has(stemOf(w))) continue;
      if (allowed && !allowed(entries[id])) continue;
      let ok = true; for (const [p, ch] of fixed) if (w[p] !== ch) { ok = false; break; }
      if (ok) out.push(id);
    }
    return out;
  };
  const done = new Set();
  function rec() {
    if (++nodes > maxNodes) return false;
    let pick = -1, pc = null;
    for (let i = 0; i < slots.length; i++) {
      if (done.has(i)) continue;
      const c = cand(slots[i]); if (!c.length) return false;
      if (!pc || c.length < pc.length) { pick = i; pc = c; if (c.length === 1) break; }
    }
    if (pick < 0) return true;
    // orden: aleatorio, preferiendo palabras poco usadas en otros crucigramas
    const arr = pc.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    if (usage) arr.sort((a, b) => (usage.get(entries[a].w) || 0) - (usage.get(entries[b].w) || 0) + (rand() - 0.5) * 1.5);
    const s = slots[pick];
    for (const id of arr.slice(0, 40)) {
      const w = entries[id].w, prev = s.cells.map((c) => grid[c]);
      s.cells.forEach((c, p) => (grid[c] = w[p])); used.add(w); stems.add(stemOf(w)); done.add(pick);
      s.word = id;
      if (rec()) return true;
      s.cells.forEach((c, p) => (grid[c] = prev[p])); used.delete(w); stems.delete(stemOf(w)); done.delete(pick); s.word = undefined;
      if (nodes > maxNodes) return false;
    }
    return false;
  }
  const ok = rec();
  return ok ? { grid, slots: slots.map((s) => ({ dir: s.dir, cells: s.cells, id: s.word })), nodes } : { fail: true, nodes };
}

module.exports = { rng, makeTemplate, slotsOf, templateOk, runs, buildIndex, fill };
