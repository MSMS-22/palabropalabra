#!/usr/bin/env node
/* Palabras alternativas válidas en casillas «sin cruce».
 * Una casilla que solo pertenece a una palabra no queda confirmada por otra, así que a veces otra palabra del banco encaja igual
 * (amigos/amigas, zumo/humo). Para que ninguna solución razonable se marque como incorrecta, cada crucigrama guarda en `x`
 * las letras alternativas aceptadas en esas casillas: { "casilla": "letras" }.
 * Uso: node tools/crossword/alts.cjs [crucigrama/data]   (reescribe los paquetes añadiendo `x`; es idempotente) */
"use strict";
const fs = require("fs"), path = require("path");
const B = require("./bank.cjs");

function slotsOf(p) {
  const N = p.n, g = p.g, black = (c) => g[c] === "#", out = [];
  for (let r = 0; r < N; r++) { let cur = []; for (let c = 0; c <= N; c++) { if (c < N && !black(r * N + c)) cur.push(r * N + c); else { if (cur.length >= 3) out.push(cur); cur = []; } } }
  for (let c = 0; c < N; c++) { let cur = []; for (let r = 0; r <= N; r++) { if (r < N && !black(r * N + c)) cur.push(r * N + c); else { if (cur.length >= 3) out.push(cur); cur = []; } } }
  return out;
}
function computeAlts(p, byLen) {
  const slots = slotsOf(p), cnt = new Uint8Array(p.n * p.n); slots.forEach((s) => s.forEach((c) => cnt[c]++));
  const x = {};
  for (const cells of slots) {
    if (!cells.some((c) => cnt[c] === 1)) continue;
    const ans = cells.map((c) => p.g[c]).join("");
    for (const w of byLen.get(ans.length) || []) {
      if (w === ans || !cells.every((c, i) => cnt[c] === 1 || w[i] === p.g[c])) continue;   // igual en las casillas con cruce
      cells.forEach((c, i) => { if (w[i] !== p.g[c]) { if (!x[c]) x[c] = ""; if (!x[c].includes(w[i])) x[c] += w[i]; } });
    }
  }
  return x;
}
function indexBank() { const m = new Map(); for (const e of B.entries()) { if (!m.has(e.w.length)) m.set(e.w.length, []); m.get(e.w.length).push(e.w); } return m; }

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, "..", "..", "crucigrama", "data"), meta = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")), byLen = indexBank();
  let withAlt = 0, total = 0, cells = 0;
  for (const f of meta.files) {
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const p of list) { const x = computeAlts(p, byLen); total++; if (Object.keys(x).length) { p.x = x; withAlt++; cells += Object.keys(x).length; } else delete p.x; }
    fs.writeFileSync(path.join(dir, f), JSON.stringify(list));
  }
  console.log(`${withAlt} de ${total} crucigramas tienen letras alternativas aceptadas (${cells} casillas)`);
}
module.exports = { computeAlts, indexBank, slotsOf };
