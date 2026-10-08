/* Motor del Sudoku: generador de tableros con solución única, calificador de dificultad
 * (solver "humano" por técnicas) y ayudas. Sin dependencias; funciona en navegador, Worker y Node. */
(function (root) {
  "use strict";
  const ALL = 511;
  const BIT = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
  const POP = new Uint8Array(512);
  for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
  const digitOf = (m) => 32 - Math.clz32(m & -m);          // dígito 1..9 del bit más bajo
  const ROW = [], COL = [], BOX = [];
  for (let i = 0; i < 81; i++) { ROW[i] = (i / 9) | 0; COL[i] = i % 9; BOX[i] = (((i / 27) | 0) * 3) + (((i % 9) / 3) | 0); }
  const UNITS = [];                                          // 9 filas, 9 columnas, 9 bloques
  for (let r = 0; r < 9; r++) UNITS.push([...Array(9).keys()].map((c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push([...Array(9).keys()].map((r) => r * 9 + c));
  for (let b = 0; b < 9; b++) UNITS.push([...Array(9).keys()].map((k) => ((b / 3) | 0) * 27 + (b % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3)));
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const s = new Set();
    for (let j = 0; j < 81; j++) if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) s.add(j);
    PEERS.push([...s]);
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const toGrid = (s) => Int8Array.from(typeof s === "string" ? s.split("").map(Number) : s);
  const toStr = (g) => Array.from(g).join("");

  /* ---------- búsqueda por backtracking con MRV (cuenta soluciones / genera una al azar) ---------- */
  function search(grid, limit, randomize) {
    const g = Int8Array.from(grid), rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
    for (let i = 0; i < 81; i++) if (g[i]) {
      const b = BIT[g[i]];
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return { count: 0, first: null };   // conflicto
      rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
    }
    let count = 0, first = null;
    (function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) {
        const m = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]), n = POP[m];
        if (n === 0) return;
        if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 1) break; }
      }
      if (best < 0) { count++; if (!first) first = Int8Array.from(g); return; }
      const ds = []; for (let d = 1; d <= 9; d++) if (bestMask & BIT[d]) ds.push(d);
      if (randomize) shuffle(ds);
      for (const d of ds) {
        const b = BIT[d], r = ROW[best], c = COL[best], x = BOX[best];
        g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
        rec();
        g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
        if (count >= limit) return;
      }
    })();
    return { count, first };
  }
  const countSolutions = (grid, limit = 2) => search(grid, limit, false).count;

  /* ---------- candidatos y solver por técnicas ---------- */
  function candidatesOf(g) {
    const cand = new Int16Array(81), rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
    for (let i = 0; i < 81; i++) if (g[i]) { const b = BIT[g[i]]; rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b; }
    for (let i = 0; i < 81; i++) if (!g[i]) cand[i] = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
    return cand;
  }
  function combos(arr, k, fn) {
    const idx = [];
    (function go(s) { if (idx.length === k) return fn(idx.map((i) => arr[i])); for (let i = s; i < arr.length; i++) { idx.push(i); if (go(i + 1)) return true; idx.pop(); } return false; })(0);
  }

  // Cada técnica devuelve null (sin progreso) o {place:[i,d]} / {elim:true}
  function makeSolver(g, cand) {
    const place = (i, d) => { g[i] = d; cand[i] = 0; for (const p of PEERS[i]) cand[p] &= ~BIT[d]; };
    const elim = (i, mask) => { if (cand[i] & mask) { cand[i] &= ~mask; return true; } return false; };
    const T = {};
    T.nakedSingle = () => { for (let i = 0; i < 81; i++) if (!g[i] && POP[cand[i]] === 1) { place(i, digitOf(cand[i])); return true; } return false; };
    T.hiddenSingle = () => {
      for (const u of UNITS) for (let d = 1; d <= 9; d++) {
        let c = -1, n = 0;
        for (const i of u) { if (g[i] === d) { n = 9; break; } if (cand[i] & BIT[d]) { c = i; n++; } }
        if (n === 1) { place(c, d); return true; }
      }
      return false;
    };
    T.locked = () => {
      let ch = false;
      for (let b = 0; b < 9; b++) for (let d = 1; d <= 9; d++) {         // pointing: bloque -> fila/columna
        const cells = UNITS[18 + b].filter((i) => cand[i] & BIT[d]);
        if (cells.length < 2) continue;
        if (cells.every((i) => ROW[i] === ROW[cells[0]])) for (const i of UNITS[ROW[cells[0]]]) if (BOX[i] !== b) ch = elim(i, BIT[d]) || ch;
        if (cells.every((i) => COL[i] === COL[cells[0]])) for (const i of UNITS[9 + COL[cells[0]]]) if (BOX[i] !== b) ch = elim(i, BIT[d]) || ch;
      }
      for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {         // claiming: fila/columna -> bloque
        const cells = UNITS[u].filter((i) => cand[i] & BIT[d]);
        if (cells.length < 2 || !cells.every((i) => BOX[i] === BOX[cells[0]])) continue;
        for (const i of UNITS[18 + BOX[cells[0]]]) if (!cells.includes(i)) ch = elim(i, BIT[d]) || ch;
      }
      return ch;
    };
    T.nakedSubset = (k) => () => {
      let ch = false;
      for (const u of UNITS) {
        const cells = u.filter((i) => !g[i] && POP[cand[i]] >= 2 && POP[cand[i]] <= k);
        combos(cells, k, (cs) => {
          const m = cs.reduce((a, i) => a | cand[i], 0);
          if (POP[m] !== k) return false;
          let did = false; for (const i of u) if (!cs.includes(i) && !g[i]) did = elim(i, m) || did;
          if (did) ch = true; return false;
        });
        if (ch) return true;
      }
      return false;
    };
    T.hiddenSubset = (k) => () => {
      for (const u of UNITS) {
        const ds = []; for (let d = 1; d <= 9; d++) { const n = u.filter((i) => cand[i] & BIT[d]).length; if (n >= 2 && n <= k) ds.push(d); }
        let ch = false;
        combos(ds, k, (dd) => {
          const cells = u.filter((i) => dd.some((d) => cand[i] & BIT[d]));
          if (cells.length !== k) return false;
          const m = dd.reduce((a, d) => a | BIT[d], 0);
          for (const i of cells) if (cand[i] & ~m) { cand[i] &= m; ch = true; }
          return ch;
        });
        if (ch) return true;
      }
      return false;
    };
    T.fish = (size) => () => {
      for (let d = 1; d <= 9; d++) for (const byRow of [true, false]) {
        const lines = [];
        for (let l = 0; l < 9; l++) {
          const pos = []; for (let k = 0; k < 9; k++) { const i = byRow ? l * 9 + k : k * 9 + l; if (cand[i] & BIT[d]) pos.push(k); }
          if (pos.length >= 2 && pos.length <= size) lines.push({ l, pos });
        }
        let ch = false;
        combos(lines, size, (ls) => {
          const cover = new Set(ls.flatMap((x) => x.pos));
          if (cover.size !== size) return false;
          const base = new Set(ls.map((x) => x.l));
          for (const k of cover) for (let l = 0; l < 9; l++) if (!base.has(l)) ch = elim(byRow ? l * 9 + k : k * 9 + l, BIT[d]) || ch;
          return ch;
        });
        if (ch) return true;
      }
      return false;
    };
    T.xyWing = () => {
      const bi = []; for (let i = 0; i < 81; i++) if (!g[i] && POP[cand[i]] === 2) bi.push(i);
      for (const p of bi) {
        const pm = cand[p], ps = PEERS[p].filter((i) => !g[i] && POP[cand[i]] === 2);
        for (const a of ps) for (const b of ps) {
          if (a >= b) continue;
          const ma = cand[a], mb = cand[b];
          if (ma === pm || mb === pm || ma === mb) continue;
          const common = ma & mb;
          if (POP[common] !== 1 || POP[ma | mb | pm] !== 3 || POP[ma & pm] !== 1 || POP[mb & pm] !== 1 || (common & pm)) continue;
          let ch = false;
          for (const i of PEERS[a]) if (!g[i] && i !== b && PEERS[b].includes(i)) ch = elim(i, common) || ch;
          if (ch) return true;
        }
      }
      return false;
    };
    return { T, place };
  }

  // Orden de técnicas y nivel: 1 = individuales, 2 = básicas (pares, tríos, bloqueos), 3 = avanzadas
  function techniques(T) {
    return [
      [1, "single", T.nakedSingle], [1, "single", T.hiddenSingle],
      [2, "locked", T.locked], [2, "nakedPair", T.nakedSubset(2)], [2, "hiddenPair", T.hiddenSubset(2)],
      [2, "nakedTriple", T.nakedSubset(3)], [2, "hiddenTriple", T.hiddenSubset(3)],
      [3, "xwing", T.fish(2)], [3, "xywing", T.xyWing], [3, "swordfish", T.fish(3)],
    ];
  }

  /* Califica un tablero: {solved, level, counts}. level = técnica más difícil que hizo falta. */
  function rate(puzzle) {
    const g = toGrid(puzzle), cand = candidatesOf(g), { T } = makeSolver(g, cand), list = techniques(T);
    let level = 0, steps = 0; const counts = {};
    while (g.includes(0)) {
      for (let i = 0; i < 81; i++) if (!g[i] && !cand[i]) return { solved: false, level: 9, counts, steps };
      let moved = false;
      for (const [lv, name, fn] of list) if (fn()) { level = Math.max(level, lv); counts[name] = (counts[name] || 0) + 1; moved = true; break; }
      if (!moved) return { solved: false, level: 9, counts, steps };
      steps++;
    }
    return { solved: true, level, counts, steps };
  }

  /* ---------- generación ---------- */
  const SPEC = {   // pistas objetivo y nivel exigido
    easy:   { clues: [38, 44], level: 1 },
    medium: { clues: [30, 35], level: 2 },
    hard:   { clues: [22, 29], level: 3 },
  };
  function dig(solution, targetClues) {
    const g = Int8Array.from(solution), order = shuffle([...Array(81).keys()]);
    let clues = 81;
    for (const i of order) {
      if (clues <= targetClues) break;
      const v = g[i]; g[i] = 0;
      if (countSolutions(g, 2) !== 1) g[i] = v; else clues--;
    }
    return { g, clues };
  }
  function generate(difficulty, maxMs = 1500) {
    const spec = SPEC[difficulty] || SPEC.easy, t0 = Date.now();
    let best = null;
    while (true) {
      const sol = search(new Int8Array(81), 1, true).first;
      const target = spec.clues[0] + ((Math.random() * (spec.clues[1] - spec.clues[0] + 1)) | 0);
      const { g, clues } = dig(sol, target);
      const r = rate(g);
      if (r.solved) {
        const score = Math.abs(r.level - spec.level) * 100 + (r.level > spec.level ? 1000 : 0) + Math.abs(clues - target);
        if (!best || score < best.score) best = { score, puzzle: toStr(g), solution: toStr(sol), level: r.level, clues };
        if (r.level === spec.level) break;
      }
      if (Date.now() - t0 > maxMs && best) break;
    }
    return { puzzle: best.puzzle, solution: best.solution, level: best.level, clues: best.clues, difficulty };
  }

  /* ---------- ayudas ---------- */
  // vals: dígitos actuales (0 = vacío); solution: cadena/array. Solo se tienen en cuenta las casillas correctas.
  function hint(vals, solution) {
    const sol = toGrid(solution), g = new Int8Array(81);
    for (let i = 0; i < 81; i++) g[i] = vals[i] && vals[i] === sol[i] ? vals[i] : 0;
    const cand = candidatesOf(g);
    for (let i = 0; i < 81; i++) if (!g[i] && POP[cand[i]] === 1) return { cell: i, digit: digitOf(cand[i]), kind: "naked" };
    const names = ["row", "col", "box"];
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
      const cells = UNITS[u].filter((i) => !g[i] && cand[i] & BIT[d]);
      if (cells.length === 1 && !UNITS[u].some((i) => g[i] === d)) return { cell: cells[0], digit: d, kind: "hidden", unit: names[(u / 9) | 0] };
    }
    let best = -1; for (let i = 0; i < 81; i++) if (!g[i] && (best < 0 || POP[cand[i]] < POP[cand[best]])) best = i;
    return best < 0 ? null : { cell: best, digit: sol[best], kind: "reveal" };
  }

  const api = { generate, rate, countSolutions, hint, candidatesOf, search, SPEC, PEERS, UNITS, ROW, COL, BOX, BIT, POP };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SudokuEngine = api;
})(typeof self !== "undefined" ? self : globalThis);
