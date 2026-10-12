#!/usr/bin/env node
/* Valida TODOS los crucigramas publicados, de forma independiente del generador.
 * Uso: node tools/crossword/validate.cjs [crucigrama/data]   (salida != 0 si algo falla) */
"use strict";
const fs = require("fs"), path = require("path");
const B = require("./bank.cjs"), { norm } = require("./check_bank.cjs");
const dir = process.argv[2] || path.join(__dirname, "..", "..", "crucigrama", "data");
const meta = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
const bank = new Map(B.entries().map((e) => [e.w, e]));
const errs = []; let n = 0, slotsTotal = 0, hintsTotal = 0, whiteTotal = 0;
const allPuzzles = meta.files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const seenGrids = new Set();

for (const p of allPuzzles) {
  n++; const e = (m) => errs.push(`#${p.id} (${p.n}×${p.n}): ${m}`);
  const N = p.n, g = p.g;
  if (g.length !== N * N) { e("tamaño de la cuadrícula incorrecto"); continue; }
  if (!/^[a-zñ#]+$/.test(g)) e("caracteres no válidos");
  if (seenGrids.has(g)) e("cuadrícula repetida"); seenGrids.add(g);
  const black = (c) => g[c] === "#";
  // palabras reales de la cuadrícula
  const slots = [];
  const run = (cells, dir) => { if (cells.length >= 3) slots.push({ dir, cells }); };
  for (let r = 0; r < N; r++) { let cur = []; for (let c = 0; c <= N; c++) { if (c < N && !black(r * N + c)) cur.push(r * N + c); else { run(cur, "A"); cur = []; } } }
  for (let c = 0; c < N; c++) { let cur = []; for (let r = 0; r <= N; r++) { if (r < N && !black(r * N + c)) cur.push(r * N + c); else { run(cur, "D"); cur = []; } } }
  // ninguna casilla blanca sin palabra; sin tramos de 2; sin bloques 2x2; conectividad
  const inSlot = new Uint8Array(N * N); slots.forEach((s) => s.cells.forEach((c) => inSlot[c]++));
  let whites = 0;
  for (let c = 0; c < N * N; c++) if (!black(c)) { whites++; if (!inSlot[c]) e(`casilla ${c} sin palabra`); }
  for (let r = 0; r < N; r++) { let k = 0; for (let c = 0; c <= N; c++) { if (c < N && !black(r * N + c)) k++; else { if (k === 2) e(`tramo de 2 casillas en fila ${r}`); k = 0; } } }
  for (let c = 0; c < N; c++) { let k = 0; for (let r = 0; r <= N; r++) { if (r < N && !black(r * N + c)) k++; else { if (k === 2) e(`tramo de 2 casillas en columna ${c}`); k = 0; } } }
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const i = r * N + c; if (black(i) && black(i + 1) && black(i + N) && black(i + N + 1)) e("bloque negro 2×2"); }
  const w0 = [...Array(N * N).keys()].find((c) => !black(c)), seen = new Set([w0]), st = [w0];
  while (st.length) { const c = st.pop(), r = (c / N) | 0, k = c % N; for (const [dr, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = r + dr, nk = k + dk; if (nr < 0 || nk < 0 || nr >= N || nk >= N) continue; const m = nr * N + nk; if (!black(m) && !seen.has(m)) { seen.add(m); st.push(m); } } }
  if (seen.size !== whites) e("la cuadrícula no es conexa");
  // numeración y pistas coinciden con la cuadrícula
  const startOf = (s) => s.cells[0], starts = [...new Set(slots.map(startOf))].sort((a, b) => a - b), numOf = new Map(starts.map((c, i) => [c, i + 1]));
  const answers = new Set();
  for (const dir of ["A", "D"]) {
    const mine = slots.filter((s) => s.dir === dir).sort((a, b) => numOf.get(startOf(a)) - numOf.get(startOf(b))), list = dir === "A" ? p.a : p.d;
    if (list.length !== mine.length) { e(`${dir}: ${list.length} pistas para ${mine.length} palabras`); continue; }
    mine.forEach((s, i) => {
      const [num, len, clue] = list[i], word = s.cells.map((c) => g[c]).join("");
      if (num !== numOf.get(startOf(s))) e(`${dir}${num}: numeración incorrecta`);
      if (len !== s.cells.length) e(`${dir}${num}: longitud ${len} ≠ ${s.cells.length}`);
      const entry = bank.get(word);
      if (!entry) e(`${dir}${num} «${word}»: no está en el banco`); else if (entry.clue !== clue) e(`${dir}${num} «${word}»: la pista no coincide con el banco`);
      if (!clue || clue.length < 6) e(`${dir}${num} «${word}»: pista vacía o muy corta`);
      const root = word.slice(0, Math.max(4, Math.min(word.length - 1, 5)));
      for (const t of norm(clue).split(/[^a-zñ]+/)) if (t.length >= 4 && (t.startsWith(root) || word.startsWith(t))) { e(`${dir}${num} «${word}»: la pista contiene la respuesta («${t}»)`); break; }
      if (answers.has(word)) e(`respuesta repetida «${word}»`); answers.add(word);
      const stem = word.slice(0, Math.max(4, Math.min(5, word.length - 1))); if (answers.has("~" + stem)) e(`palabras de la misma familia en el mismo crucigrama («${word}»)`); answers.add("~" + stem);
    });
  }
  slotsTotal += slots.length; whiteTotal += whites;
  // letras sugeridas
  if (!/^[01]+$/.test(p.h) || p.h.length !== N * N) { e("letras sugeridas mal formadas"); continue; }
  let hints = 0;
  for (let c = 0; c < N * N; c++) if (p.h[c] === "1") { hints++; if (black(c)) e(`letra sugerida en casilla negra ${c}`); }
  hintsTotal += hints;
  for (const s of slots) {
    const k = s.cells.filter((c) => p.h[c] === "1").length;
    if (k === 0) e(`palabra sin ninguna letra sugerida (${s.dir}${numOf.get(startOf(s))})`);
    if (k > s.cells.length - 2) e(`palabra casi completada por las sugeridas (${s.dir}${numOf.get(startOf(s))})`);
  }
}
const expected = meta.sizes.reduce((a, s) => a + (s.to - s.from + 1), 0);
if (expected !== allPuzzles.length || meta.total !== allPuzzles.length) errs.push(`el índice anuncia ${meta.total} y hay ${allPuzzles.length}`);
console.log(`${n} crucigramas · ${slotsTotal} palabras · letras sugeridas ${(100 * hintsTotal / whiteTotal).toFixed(1)} %`);
if (errs.length) { console.log(errs.slice(0, 60).join("\n")); console.log(`${errs.length} problemas`); process.exit(1); }
console.log("todos los crucigramas son válidos");
