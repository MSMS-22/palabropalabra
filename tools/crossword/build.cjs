#!/usr/bin/env node
/* Genera los crucigramas en paralelo:
 *   node tools/crossword/build.cjs [--sizes 9:250,11:150] [--seed 2026] [--out crucigrama/data] [--pack 50] [--workers 4]
 * Cada crucigrama se rellena SOLO con palabras del banco (que ya tienen pista), así que ninguno puede quedar sin definición. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { Worker, isMainThread, parentPort } = require("worker_threads");
const G = require("./gen.js"), B = require("./bank.cjs"), A = require("./alts.cjs");

const CAPSCALE = (() => { const i = process.argv.indexOf("--capscale"); return i > 0 ? +process.argv[i + 1] : 1; })();
const NODES = { 9: 5000, 11: 30000 };   // presupuesto de búsqueda por intento
const HINT_RATIO = 0.28;
// tope duro de usos de una misma palabra en todo el conjunto (según su longitud); la variedad la fomenta el sorteo ponderado de gen.js
const CAP = (e) => (e.w.length === 3 ? 60 : e.w.length === 4 ? (e.plural ? 14 : 30) : e.w.length === 5 ? (e.plural ? 12 : 24) : 14);   // los plurales cortos (osos, alas...) se limitan más

/* ---------- numeración y pistas ---------- */
function assemble(N, tpl, res, entries) {
  const starts = new Map();                         // celda -> {A?, D?}
  for (const s of res.slots) { const c = s.cells[0]; if (!starts.has(c)) starts.set(c, {}); starts.get(c)[s.dir] = s; }
  const clues = { A: [], D: [] };
  [...starts.keys()].sort((a, b) => a - b).forEach((c, i) => {
    for (const dir of ["A", "D"]) { const s = starts.get(c)[dir]; if (!s) continue; const e = entries[s.id]; clues[dir].push([i + 1, s.cells.length, e.clue, e.shown]); }
  });
  return { n: N, g: Array.from({ length: N * N }, (_, c) => (tpl[c] ? "#" : res.grid[c])).join(""), a: clues.A, d: clues.D };
}

/* ---------- letras sugeridas: al menos una por palabra, ~28 % de las casillas, sin completar ninguna palabra ---------- */
function chooseGivens(N, tpl, slots, rand) {
  const white = []; for (let c = 0; c < N * N; c++) if (!tpl[c]) white.push(c);
  const slotsOf = new Map(); slots.forEach((s, i) => s.cells.forEach((c) => (slotsOf.get(c) || slotsOf.set(c, []).get(c)).push(i)));
  const count = new Array(slots.length).fill(0), given = new Set();
  const add = (c) => { given.add(c); for (const i of slotsOf.get(c)) count[i]++; };
  const fits = (c) => !slotsOf.get(c).some((i) => count[i] + 1 > slots[i].cells.length - 2);   // siempre quedan ≥2 casillas por resolver
  while (count.some((x) => x === 0)) {              // cobertura: la casilla que cubre más palabras sin pista
    let best = [], bs = -1;
    for (const c of white) { if (given.has(c) || !fits(c)) continue; const sc = slotsOf.get(c).filter((i) => count[i] === 0).length; if (sc > bs) { bs = sc; best = [c]; } else if (sc === bs) best.push(c); }
    if (!best.length) return null;
    add(best[Math.floor(rand() * best.length)]);
  }
  const target = Math.round(white.length * HINT_RATIO);
  const pool = white.filter((c) => !given.has(c)); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const c of pool) { if (given.size >= target) break; if (fits(c)) add(c); }
  return given;
}

/* ---------- trabajador: genera un crucigrama por encargo ---------- */
function workerMain() {
  const entries = B.entries(), index = G.buildIndex(entries);
  parentPort.on("message", (job) => {
    const rand = G.rng(job.seed), usage = new Map(job.usage); let attempts = 0;
    for (;;) {
      attempts++;
      const tpl = G.makeTemplate(job.n, rand); if (!tpl) continue;
      const mult = 1 + Math.floor(attempts / 100) * 0.5;      // si cuesta encontrar uno, se relajan los topes poco a poco
      const res = G.fill(index, tpl, job.n, rand, { maxNodes: NODES[job.n] || 20000, usage, allowed: (e) => (usage.get(e.w) || 0) < Math.ceil(CAP(e) * CAPSCALE * mult) });
      if (res.fail) continue;
      const given = chooseGivens(job.n, tpl, res.slots, rand); if (!given) continue;
      const p = assemble(job.n, tpl, res, entries);
      p.h = Array.from({ length: job.n * job.n }, (_, c) => (given.has(c) ? "1" : "0")).join("");
      parentPort.postMessage({ puzzle: p, words: res.slots.map((s) => entries[s.id].w), attempts });
      return;
    }
  });
  parentPort.postMessage({ ready: true });
}

/* ---------- principal ---------- */
function main() {
  const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
  const SIZES = arg("sizes", "9:250,11:150").split(",").map((s) => s.split(":").map(Number));
  const SEED = +arg("seed", 2026), PACK = +arg("pack", 50), W = +arg("workers", Math.min(4, os.cpus().length));
  const OUT = arg("out", path.join(__dirname, "..", "..", "crucigrama", "data"));
  const usage = new Map(), bySize = new Map(SIZES.map(([n]) => [n, []])), seen = new Set();
  let phase = 0, jobs = 0, attempts = 0; const t0 = Date.now(), workers = [];
  const curSize = () => (phase < SIZES.length ? SIZES[phase] : null);
  const finish = () => {
    workers.forEach((w) => w.terminate());
    const puzzles = []; let id = 0;
    const byLen = A.indexBank();
    for (const [n] of SIZES) for (const p of bySize.get(n)) { const q = Object.assign({ id: ++id }, p), x = A.computeAlts(q, byLen); if (Object.keys(x).length) q.x = x; puzzles.push(q); }
    fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) if (/^(pack-\d+|index)\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
    const files = [];
    for (let i = 0; i < puzzles.length; i += PACK) { const name = `pack-${String(i / PACK + 1).padStart(2, "0")}.json`; fs.writeFileSync(path.join(OUT, name), JSON.stringify(puzzles.slice(i, i + PACK))); files.push(name); }
    const sizes = SIZES.map(([n]) => ({ n, from: puzzles.find((p) => p.n === n).id, to: puzzles.filter((p) => p.n === n).pop().id }));
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ total: puzzles.length, pack: PACK, files, sizes }));
    const top = [...usage.entries()].sort((a, b) => b[1] - a[1])[0];
    console.log(`listo: ${puzzles.length} crucigramas en ${OUT} (${((Date.now() - t0) / 1000) | 0}s, ${attempts} intentos); palabras distintas ${usage.size}, la más repetida «${top[0]}» ×${top[1]}`);
    process.exit(0);
  };
  const dispatch = (w) => { const cur = curSize(); if (cur) w.postMessage({ n: cur[0], seed: SEED + 7919 * ++jobs, usage: [...usage.entries()] }); };
  for (let i = 0; i < W; i++) {
    const w = new Worker(__filename); workers.push(w);
    w.on("message", (m) => {
      if (m.ready) return dispatch(w);
      const cur = curSize();
      attempts += m.attempts;
      if (cur && m.puzzle.n === cur[0]) {          // descarta resultados de encargos anteriores de otro tamaño
        const [n, count] = cur, list = bySize.get(n), key = m.puzzle.g;
        if (list.length < count && !seen.has(key)) {
          seen.add(key); list.push(m.puzzle); for (const x of m.words) usage.set(x, (usage.get(x) || 0) + 1);
          if (list.length % 10 === 0 || list.length === count) console.log(`  ${n}×${n}: ${list.length}/${count} (${((Date.now() - t0) / 1000) | 0}s)`);
          if (list.length === count) phase++;
        }
      }
      if (!curSize()) return finish();
      dispatch(w);
    });
    w.on("error", (e) => { console.error("error en un trabajador:", e); process.exit(1); });
  }
}
if (isMainThread) main(); else workerMain();
