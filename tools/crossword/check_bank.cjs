#!/usr/bin/env node
/* Valida el banco de pistas (tools/crossword/clues/*.tsv): ortografía contra el diccionario, duplicados y calidad de pistas.
 * Uso: node tools/crossword/check_bank.cjs <validas.txt> [carpeta_clues]   (salida != 0 si hay errores) */
"use strict";
const fs = require("fs"), path = require("path");
const norm = (w) => w.toLowerCase().replace(/ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "ñ");
function loadBank(dir) {
  const rows = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsv")).sort())
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").forEach((line, i) => {
      if (!line.trim() || line.startsWith("#")) return;
      const [word, clue, tag = ""] = line.split("\t");
      rows.push({ word: word.trim(), clue: (clue || "").trim(), tag: tag.trim(), where: `${f}:${i + 1}` });
    });
  return rows;
}
if (require.main === module) {
  const dir = process.argv[3] || path.join(__dirname, "clues");
  const valid = new Set(fs.readFileSync(process.argv[2], "utf8").split("\n"));
  // palabras correctas que el diccionario Hunspell no incluye (validadas a mano)
  try { fs.readFileSync(path.join(dir, "allow.txt"), "utf8").split("\n").filter((x) => x.trim() && !x.startsWith("#")).forEach((w) => valid.add(norm(w.trim()))); } catch {}
  const bank = loadBank(dir), errs = [], seen = new Map();
  for (const r of bank) {
    const n = norm(r.word), e = (m) => errs.push(`${r.where} ${r.word}: ${m}`);
    if (!/^[a-zñáéíóúü]+$/.test(r.word)) e("caracteres no válidos");
    if (n.length < 3 || n.length > 11) e("longitud fuera de 3–11");
    if (!valid.has(n)) e("no está en el diccionario");
    if (seen.has(n)) e(`duplicada (también en ${seen.get(n)})`); else seen.set(n, r.where);
    if (r.clue.length < 6 || r.clue.length > 75) e(`pista de ${r.clue.length} caracteres`);
    if (r.tag && !/^[sf]*$/.test(r.tag)) e("etiqueta desconocida: " + r.tag);
    const root = n.slice(0, Math.max(4, Math.min(n.length - 1, 5)));
    for (const w of norm(r.clue).split(/[^a-zñ]+/)) if (w.length >= 4 && (w.startsWith(root) || n.startsWith(w))) { e(`la pista contiene la respuesta o su raíz («${w}»)`); break; }
  }
  const byLen = {}; bank.forEach((r) => (byLen[norm(r.word).length] = (byLen[norm(r.word).length] || 0) + 1));
  console.log(`${bank.length} palabras`, JSON.stringify(byLen));
  if (errs.length) { console.log(errs.join("\n")); console.log(`${errs.length} problemas`); process.exit(1); }
  console.log("banco OK");
}
module.exports = { loadBank, norm };
