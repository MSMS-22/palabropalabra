// Valida impostor/words.js: 8 categorías, >=50 referencias cada una, sin vacías ni duplicadas (ni entre categorías).
const { W } = require("../../impostor/words.js");
const need = ["comida", "animales", "futbolistas", "ciudades", "objetos", "oficios", "pop", "marcas"];
let bad = 0; const seen = new Map();
for (const c of need) {
  const a = W[c] || []; if (a.length < 50) { console.log(`${c}: solo ${a.length} (mínimo 50)`); bad++; }
  for (const w of a) {
    if (typeof w !== "string" || !w.trim() || w !== w.trim()) { console.log(`${c}: valor inválido "${w}"`); bad++; continue; }
    const k = w.toLowerCase(); if (seen.has(k)) { console.log(`repetida: "${w}" en ${seen.get(k)} y ${c}`); bad++; } else seen.set(k, c);
  }
  console.log(c.padEnd(12), a.length);
}
if (Object.keys(W).length !== need.length) { console.log("categorías distintas a las esperadas"); bad++; }
console.log(bad ? bad + " problemas" : "words OK"); process.exit(bad ? 1 : 0);
