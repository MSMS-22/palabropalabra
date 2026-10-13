#!/usr/bin/env node
/* Prueba de extremo a extremo: abre CADA crucigrama en el navegador (ambos modos), comprueba la cuadrícula y las pistas,
 * lo resuelve escribiendo con el teclado real y verifica que se detecta como completado; también comprueba los límites de ayuda.
 * Uso: node tools/crossword/e2e.cjs <url_base> [desde] [hasta]    p. ej. http://localhost:8125/crucigrama/ 1 400
 * Requiere Playwright (npm i -g playwright) y Chromium. */
"use strict";
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.argv[2], from = +process.argv[3] || 1, to = +process.argv[4] || 400;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  const errs = [], fails = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(base); await page.waitForSelector("#pz button");
  const t0 = Date.now(); let ok = 0;
  for (let id = from; id <= to; id++) for (const mode of ["sin", "con"]) {
    const fail = (m) => fails.push(`#${id} ${mode}: ${m}`);
    try {
      await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));   // el diálogo de victoria bloquea el teclado
      await page.evaluate(([i, m]) => openPuzzle(i, m), [id, mode]);
      const info = await page.evaluate(() => {
        const whites = [...P.g].filter((c) => c !== "#").length, e = [];
        if (document.querySelectorAll("#board .c:not(.b)").length !== whites) e.push("número de casillas blancas");
        if (SLOTS.length !== P.a.length + P.d.length) e.push("palabras ≠ pistas");
        if (SLOTS.some((s) => !s.clue || !s.num)) e.push("palabra sin pista o número");
        const given = [...Array(P.n * P.n).keys()].filter((i) => isGiven(i));
        if (ST.mode === "sin" && given.length) e.push("hay letras sugeridas en modo sin");
        if (ST.mode === "con") { if (given.length !== [...P.h].filter((c) => c === "1").length) e.push("letras sugeridas distintas de las del puzzle"); if (SLOTS.some((s) => !s.cells.some((c) => isGiven(c)))) e.push("palabra sin letra sugerida"); if (given.some((i) => ST.v[i] !== P.g[i])) e.push("letra sugerida incorrecta"); }
        if (ST.done) e.push("ya aparecía como completado");
        return e;
      });
      info.forEach(fail);
      // resolver escribiendo con el teclado real, palabra a palabra
      for (let guard = 0; guard < 200; guard++) {
        const letters = await page.evaluate(() => { for (const s of SLOTS) { const em = s.cells.filter((c) => ST.v[c] === "."); if (em.length) { sel = em[0]; dir = s.dir; renderAll(); return em.map((c) => P.g[c]).join(""); } } return null; });
        if (letters === null) break;
        await page.keyboard.type(letters);
      }
      await page.waitForTimeout(5);
      const res = await page.evaluate(() => ({ done: ST.done, helped: ST.helped, saved: !!PAS.get(pkey(P.id, ST.mode), null) && PAS.get(pkey(P.id, ST.mode), null).done }));
      if (!res.done) fail("no se detectó como completado"); else if (res.helped || !res.saved) fail("estado final incorrecto"); else ok++;
      await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
      // límites de ayuda en otra copia del mismo crucigrama (se reinicia el progreso de esta prueba)
      await page.evaluate(([i, m]) => { PAS.set(pkey(i, m), null); return openPuzzle(i, m); }, [id, mode]);
      const help = await page.evaluate(() => {
        const e = []; const cand = [...Array(P.n * P.n).keys()].filter((i) => P.g[i] !== "#" && !locked(i));
        for (let k = 0; k < 5; k++) { sel = cand[k * 2]; dir = CELL[sel].A >= 0 ? "A" : "D"; revealLetter(); }
        if (ST.lu !== 3) e.push(`letras de ayuda usadas ${ST.lu} (debían ser 3)`);
        const s = SLOTS.find((x) => x.cells.some((c) => !correct(c))); sel = s.cells[0]; dir = s.dir; revealWord(); revealWord();
        if (ST.wu !== 1) e.push(`palabras de ayuda usadas ${ST.wu} (debía ser 1)`);
        if (!ST.helped) e.push("no se marcó como con ayuda");
        return e;
      });
      help.forEach(fail);
      // letras alternativas válidas en casillas sin cruce: deben aceptarse como solución
      if (mode === "sin") {
        await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
        await page.evaluate(([i, m]) => { PAS.set(pkey(i, m), null); return openPuzzle(i, m); }, [id, mode]);
        const hasAlt = await page.evaluate(() => !!(P.x && Object.keys(P.x).length));
        if (hasAlt) {
          for (let guard = 0; guard < 200; guard++) {
            const letters = await page.evaluate(() => { for (const s of SLOTS) { const em = s.cells.filter((c) => ST.v[c] === "."); if (em.length) { sel = em[0]; dir = s.dir; renderAll(); return em.map((c) => (P.x && P.x[c] ? P.x[c][0] : P.g[c])).join(""); } } return null; });
            if (letters === null) break;
            await page.keyboard.type(letters);
          }
          if (!(await page.evaluate(() => ST.done))) fail("no se aceptó una letra alternativa válida");
        }
      }
    } catch (e) { fail("excepción: " + e.message); }
    if (id % 25 === 0 && mode === "con") console.log(`  hasta #${id}: ${ok} resueltos de ${(id - from + 1) * 2} (${((Date.now() - t0) / 1000) | 0}s)`);
  }
  console.log(`${ok} de ${(to - from + 1) * 2} partidas resueltas correctamente (${(to - from + 1)} crucigramas × 2 modos)`);
  if (errs.length) console.log("errores de JavaScript:", [...new Set(errs)].slice(0, 5));
  if (fails.length) { console.log(fails.slice(0, 40).join("\n")); console.log(`${fails.length} problemas`); process.exitCode = 1; } else if (!errs.length) console.log("e2e OK");
  await browser.close();
})();
