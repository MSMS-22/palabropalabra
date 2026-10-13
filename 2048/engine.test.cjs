/* Pruebas del motor: node 2048/engine.test.cjs */
"use strict";
const assert = require("assert"), E = require("./engine.js");
const row = (v, dir = "left") => { const r = E.move([v], dir); return r; };
const m = (g, d) => E.move(g, d);
// casos clásicos
const L = (a) => m([a, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "left");
assert.deepStrictEqual(L([2, 2, 2, 2]).grid[0], [4, 4, 0, 0]); assert.strictEqual(L([2, 2, 2, 2]).score, 8);
assert.deepStrictEqual(L([2, 2, 4, 0]).grid[0], [4, 4, 0, 0]);
assert.deepStrictEqual(L([4, 2, 2, 0]).grid[0], [4, 4, 0, 0]);
assert.deepStrictEqual(L([2, 2, 2, 0]).grid[0], [4, 2, 0, 0]);          // la fusión empieza por el lado del movimiento
assert.deepStrictEqual(L([4, 4, 8, 0]).grid[0], [8, 8, 0, 0]);          // una ficha no se fusiona dos veces
assert.deepStrictEqual(L([2, 4, 2, 4]).grid[0], [2, 4, 2, 4]); assert.strictEqual(L([2, 4, 2, 4]).moved, false);
assert.deepStrictEqual(m([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "right").grid[0], [0, 0, 0, 4]);
assert.deepStrictEqual(m([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]], "down").grid.map((r) => r[0]), [0, 0, 4, 8]);
assert.deepStrictEqual(m([[2, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]], "up").grid.map((r) => r[0]), [4, 0, 0, 0]);
assert.strictEqual(L([0, 0, 0, 2]).moved, true); assert.strictEqual(L([2, 0, 0, 0]).moved, false);
// fin de partida
assert.strictEqual(E.canMove([[2, 4], [4, 2]]), false); assert.strictEqual(E.canMove([[2, 2], [4, 8]]), true); assert.strictEqual(E.canMove([[2, 4], [4, 0]]), true);
// invariantes con 20 000 jugadas al azar (tableros de 3 a 6)
let seed = 7; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let games = 0, moves = 0;
for (const n of [3, 4, 5, 6]) for (let g = 0; g < 50; g++) {
  let grid = E.newGame(n, rand); games++;
  for (let k = 0; k < 400 && E.canMove(grid); k++) {
    const d = E.DIRS[Math.floor(rand() * 4)], r = E.move(grid, d); if (!r.moved) continue;
    const sum = (x) => x.flat().reduce((a, b) => a + b, 0);
    assert.strictEqual(sum(r.grid), sum(grid), "la suma de fichas no cambia al mover");
    assert.strictEqual(r.score, r.trace.filter((t) => t.merge).reduce((a, t) => a + t.v * 2, 0), "la puntuación son las fusiones");
    assert.strictEqual(r.trace.length, grid.flat().filter(Boolean).length, "cada ficha tiene su traza");
    assert.ok(r.grid.flat().every((v) => v === 0 || (v & (v - 1)) === 0), "solo potencias de 2");
    const s = E.spawn(r.grid, rand); assert.ok(s && [2, 4].includes(s.v) && r.grid[s.r][s.c] === 0); grid = s.grid; moves++;
  }
}
console.log(`motor 2048 OK: ${games} partidas y ${moves} jugadas aleatorias comprobadas`);
