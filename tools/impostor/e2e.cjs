// Prueba en navegador: flujo completo + aleatoriedad. Uso: node e2e.cjs http://localhost:8000/impostor/
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const url = process.argv[2] || "http://localhost:8000/impostor/";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FALLO:", m); } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const p = await (await b.newContext({ ...devices["iPhone 13"], locale: "es-ES" })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url);
  // 1) categorías: todas marcadas; quitar todas desactiva "Siguiente"; elegir solo 2
  ok((await p.$$('.cat[aria-pressed="true"]')).length === 8, "8 categorías marcadas por defecto");
  await p.click("text=Ninguna"); ok(await p.$eval(".big", (e) => e.disabled), "sin categorías no se avanza");
  const cats = await p.$$(".cat"); await cats[1].click(); await p.click(".cat >> nth=3"); await p.click(".big");
  // 2) ajustes: 4 jugadores, 2 impostores
  await p.click(".step >> nth=1 >> button >> nth=1"); // impostores +1 -> 2
  ok((await p.$$eval("output", (o) => o.map((x) => x.textContent))).join() === "4,2", "4 jugadores / 2 impostores");
  await p.click(".big"); await p.waitForSelector("input.nm");
  // 3) nombres: validar vacíos y repetidos
  await p.click(".big"); ok(/nombre/i.test(await p.textContent(".err")), "error por nombre vacío");
  const ins = await p.$$("input.nm"); const nm = ["Ana", "Luis", "ana", "Eva"]; for (let i = 0; i < 4; i++) await ins[i].fill(nm[i]);
  await p.click(".big"); ok(/repetidos/i.test(await p.textContent(".err")), "error por repetidos"); await ins[2].fill("Pedro"); await p.click(".big");
  // 4) cartas
  await p.waitForSelector(".pbtn"); let impostors = 0, word = null, cat = null;
  for (let i = 0; i < 4; i++) {
    await (await p.$$(".pbtn"))[i].click(); await p.waitForSelector("#secret");
    const blur0 = await p.$eval("#secret span", (e) => getComputedStyle(e).filter); ok(/blur/.test(blur0), "palabra difuminada al inicio");
    await p.click("#secret"); await p.waitForTimeout(250); const blur1 = await p.$eval("#secret span", (e) => getComputedStyle(e).filter); ok(blur1 === "none", "palabra visible tras tocar");
    const txt = (await p.textContent("#secret span")).trim(); const c = (await p.textContent(".cat2")).split(": ")[1];
    if (/IMPOSTOR/.test(txt)) impostors++; else { if (word && word !== txt) ok(false, "palabras distintas"); word = txt; }
    cat = c; await p.click("text=Listo");
  }
  ok(impostors === 2, "2 impostores repartidos, hay " + impostors); ok(["Animales", "Ciudades y países"].includes(cat), "categoría elegida: " + cat);
  ok(!(await p.$eval(".big", (e) => e.disabled)), "empezar habilitado cuando todos vieron");
  await p.click(".big");
  // 5) revelar impostores uno a uno
  await p.click("text=Revelar impostor 1"); ok((await p.$$(".rev.done")).length === 1, "1 impostor revelado"); ok(!(await p.$("text=Revelar la palabra")), "palabra no se ofrece aún");
  await p.click("text=Revelar impostor 2"); ok((await p.$$(".rev.done")).length === 2, "2 revelados"); await p.click("text=Revelar la palabra"); ok((await p.textContent(".word")).includes(word), "palabra revelada correcta");
  await p.click("text=Contar puntos");
  // 6) puntos +/-
  await p.click(".srow >> nth=0 >> button.p"); await p.click(".srow >> nth=0 >> button.p"); await p.click(".srow >> nth=1 >> button.m");
  ok((await p.$$eval(".srow output", (o) => o.map((x) => x.textContent))).join() === "2,-1,0,0", "puntos +2 / -1");
  await p.reload(); await p.waitForSelector(".srow"); ok((await p.$$eval(".srow output", (o) => o.map((x) => x.textContent))).join() === "2,-1,0,0", "puntos persisten tras recargar");
  await p.click("text=Siguiente palabra"); await p.waitForSelector(".pbtn");
  ok((await p.$$(".pbtn.seen")).length === 0, "nueva ronda sin cartas vistas");
  // 7) aleatoriedad: 6000 rondas con 5 jugadores/1 impostor; chi-cuadrado y sin repetir palabra seguida
  const r = await p.evaluate(() => { S.names = ["a", "b", "c", "d", "e"]; S.n = 5; S.k = 1; S.cats = CATS.slice(); const cnt = [0, 0, 0, 0, 0], pair = {}; let prev = -1, rep = 0, prevW = ""; const N = 6000;
    for (let i = 0; i < N; i++) { newRound(); const im = S.round.imps[0]; cnt[im]++; if (im === prev) rep++; prev = im; if (S.round.word === prevW) rep += 1000; prevW = S.round.word; }
    const e = N / 5, chi = cnt.reduce((s, x) => s + (x - e) ** 2 / e, 0); return { cnt, chi, rep }; });
  console.log("reparto de impostor:", r.cnt.join(" "), "chi2 =", r.chi.toFixed(2), "(crítico 4 gl, p=0,001: 18,47)");
  ok(r.chi < 18.47, "reparto de impostor no uniforme"); ok(r.rep < 1500 && r.rep > 900, "repetición consecutiva anómala: " + r.rep);   // esperado ~1200 (1/5 de 6000) y ninguna palabra seguida repetida
  // sin repetir hasta agotar: con 1 categoría de N palabras, las N primeras rondas son todas distintas
  const u = await p.evaluate(() => { S.used = {}; S.cats = ["marcas"]; const n = window.IMPOSTOR_WORDS.marcas.length, s = new Set(); for (let i = 0; i < n; i++) { newRound(); s.add(S.round.word); } return [s.size, n]; });
  ok(u[0] === u[1], "palabras repetidas antes de agotar la categoría: " + u.join("/"));
  ok(!errs.length, "errores JS: " + errs.join("; "));
  await b.close(); console.log(fails ? fails + " fallos" : "e2e OK"); process.exit(fails ? 1 : 0);
})();
