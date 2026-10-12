/* Banco de palabras con pista: lee clues/*.tsv y añade automáticamente el plural de las palabras con etiqueta «s». */
"use strict";
const { loadBank, norm } = require("./check_bank.cjs");
const path = require("path");

function pluralOf(n) {                    // sobre la forma normalizada (sin tildes)
  if (/[aeiou]$/.test(n)) return n + "s";
  if (/z$/.test(n)) return n.slice(0, -1) + "ces";
  if (/s$/.test(n)) return null;          // lunes, crisis...: invariables, no se pluralizan
  return n + "es";
}
function entries(dir = path.join(__dirname, "clues")) {
  const out = [];
  for (const r of loadBank(dir)) {
    const n = norm(r.word), base = { w: n, shown: r.word, clue: r.clue, tag: r.tag, plural: false };
    out.push(base);
    if (r.tag.includes("s")) {
      const p = pluralOf(n);
      if (p && p.length <= 11) out.push({ w: p, shown: p, clue: r.clue.replace(/\.$/, "") + " (plural)", plural: true, of: n });
    }
  }
  const seen = new Set();
  return out.filter((e) => (seen.has(e.w) ? false : (seen.add(e.w), true)));
}
module.exports = { entries, pluralOf };
