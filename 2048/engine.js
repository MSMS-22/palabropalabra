/* Motor del 2048: reglas puras (sin DOM) para poder probarlas en Node y en el navegador. */
(function (root) {
  "use strict";
  const DIRS = ["left", "right", "up", "down"];

  // Casillas de cada fila/columna, ordenadas desde el lado hacia el que se desliza
  function lines(n, dir) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const line = [];
      for (let j = 0; j < n; j++) line.push(dir === "left" ? [i, j] : dir === "right" ? [i, n - 1 - j] : dir === "up" ? [j, i] : [n - 1 - j, i]);
      out.push(line);
    }
    return out;
  }

  /* Mueve el tablero. Devuelve {grid, score, moved, trace}.
   * trace: por cada ficha de origen, a dónde va (tr,tc) y si se fusiona con otra (merge). */
  function move(grid, dir) {
    const n = grid.length, out = Array.from({ length: n }, () => Array(n).fill(0)), trace = [];
    let score = 0, moved = false;
    for (const line of lines(n, dir)) {
      let pos = 0, last = null;
      for (let j = 0; j < n; j++) {
        const [r, c] = line[j], v = grid[r][c];
        if (!v) continue;
        if (last && last.v === v && !last.merged) {          // se funde con la ficha anterior (una sola fusión por ficha)
          const [tr, tc] = line[last.pos];
          out[tr][tc] = v * 2; score += v * 2; last.merged = true; moved = true;
          trace.push({ fr: r, fc: c, tr, tc, v, merge: true });
        } else {
          const [tr, tc] = line[pos];
          out[tr][tc] = v; last = { v, pos, merged: false }; pos++;
          if (tr !== r || tc !== c) moved = true;
          trace.push({ fr: r, fc: c, tr, tc, v, merge: false });
        }
      }
    }
    return { grid: out, score, moved, trace };
  }

  // Añade una ficha (2 con 90 %, 4 con 10 %) en una casilla vacía al azar
  function spawn(grid, rand = Math.random) {
    const empty = [];
    grid.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(rand() * empty.length)], v = rand() < 0.9 ? 2 : 4;
    const g = grid.map((row) => row.slice()); g[r][c] = v;
    return { grid: g, r, c, v };
  }

  const canMove = (grid) => DIRS.some((d) => move(grid, d).moved);
  const maxTile = (grid) => Math.max(0, ...grid.flat());
  const emptyGrid = (n) => Array.from({ length: n }, () => Array(n).fill(0));
  function newGame(n, rand = Math.random) { let g = emptyGrid(n); g = spawn(g, rand).grid; return spawn(g, rand).grid; }

  const api = { DIRS, move, spawn, canMove, maxTile, emptyGrid, newGame };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.G2048 = api;
})(typeof self !== "undefined" ? self : globalThis);
