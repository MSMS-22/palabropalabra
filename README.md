# Pasatiempos

Colección de juegos de navegador, sin servidor ni build (HTML, CSS y JS estáticos). Partidas ilimitadas, rachas de victorias y varios niveles.

**Jugar:** https://msms-22.github.io/palabropalabra/ (Settings → Pages → Deploy from a branch → `main` / raíz).

| Juego | Ruta | Resumen |
|---|---|---|
| Home «Pasatiempos» | `/` | Tarjetas de los juegos con tu racha actual |
| Palabra o Palabro | `/palabra/` | Wordle en español e inglés, modo fácil y difícil, 4–8 letras |
| Sudoku | `/sudoku/` | Fácil, medio y difícil; notas que se borran solas; pistas |
| 2048 | `/2048/` | Tres tamaños (5×5, 4×4, 3×3), deslizar con el dedo o las flechas, deshacer y racha |
| Crucigramas | `/crucigrama/` | 400 crucigramas en español (250 de 9×9 y 150 de 11×11), con o sin letras sugeridas |

```
index.html   shared.css   shared.js   sw.js     ← home, tema común, preferencias, caché sin conexión
palabra/     index.html + data/ (diccionarios)
sudoku/      index.html + engine.js (generador y solver)
crucigrama/  index.html + data/ (400 crucigramas en paquetes JSON)
2048/        index.html + engine.js (reglas puras) + engine.test.cjs
tools/build_dict.py                               ← genera palabra/data
tools/crossword/                                  ← banco de pistas, generador, validador y prueba e2e
```
Para añadir un juego: crea una carpeta con su `index.html` (usa `../shared.css` y `../shared.js`), añade una entrada a la lista `GAMES` de `index.html` (la home genera las tarjetas y sus rachas a partir de ella) y su ruta a `SHELL` en `sw.js`.

## Sudoku
- **Tableros:** `sudoku/engine.js` genera una solución completa por backtracking, quita casillas manteniendo la **solución única** y califica el nivel con un solver «humano» por técnicas. Fácil = solo individuales (38–44 pistas); medio = pares, tríos y bloqueos (30–35); difícil = X-Wing, XY-Wing o Swordfish (23–29). Se generan en el momento (≈ 1–150 ms).
- **Notas:** botón ✏️ (o tecla `N`; `Mayús`+número anota directamente). Al colocar un número desaparece de las notas de su fila, columna y bloque. Deshacer restaura también las notas borradas. ✨ Auto-notas rellena todos los candidatos.
- **Pistas:** 3 por partida; explican por qué va ese número. La victoria cuenta, pero el mejor tiempo solo lo marcan las partidas sin pistas.
- **Racha:** victorias seguidas por dificultad; perder o abandonar una partida empezada la reinicia.

## 2048
- Tres tamaños: **Fácil 5×5** y **Clásico 4×4** (meta: ficha 2048) y **Difícil 3×3** (meta: ficha 256). Partidas ilimitadas.
- Se juega deslizando el dedo, arrastrando con el ratón o con las flechas/WASD. Tiene deshacer (última jugada), puntuación y mejor puntuación por tamaño.
- **Racha:** partidas ganadas seguidas por tamaño; perder o abandonar una partida a medias la reinicia. Tras ganar se puede seguir jugando.
- Las reglas viven en `2048/engine.js` y se prueban con `node 2048/engine.test.cjs` (≈ 40 000 jugadas aleatorias comprobando que la suma de fichas y la puntuación son coherentes).

## Crucigramas
- **400 crucigramas** en español: 250 de 9×9 y 150 de 11×11. Se elige libremente cuál jugar (lista con filtros por tamaño y estado, botón «Aleatorio»).
- **Dos modos:** sin letras sugeridas (cuadrícula vacía) y con letras sugeridas (≈28 % de las casillas ya puestas y al menos una por palabra). El progreso se guarda por crucigrama y modo.
- **Ayudas por crucigrama:** hasta **3 letras** sueltas y **1 palabra entera**. «Revisar» (marca errores) es ilimitado y no cuenta como ayuda.
- **Racha:** crucigramas completados seguidos **sin usar letras ni palabras de ayuda** (por modo). Si completas uno con ayuda, la racha vuelve a 0.
- **Cómo se garantiza que todos funcionan:** cada crucigrama se rellena solo con palabras del banco `tools/crossword/clues/*.tsv`, que ya tienen pista; después `validate.cjs` revisa los 400 (estructura, numeración, pistas, palabras repetidas, letras sugeridas) y `e2e.cjs` abre cada uno en el navegador, lo resuelve con el teclado en ambos modos y comprueba los límites de ayuda.

```
node tools/crossword/check_bank.cjs <validas.txt>     # ortografía y calidad del banco (validas.txt: tools/crossword/valid_es.py)
node tools/crossword/build.cjs                          # genera crucigrama/data (en paralelo, determinista con --seed)
node tools/crossword/validate.cjs                       # valida los 400
node tools/crossword/e2e.cjs http://localhost:8000/crucigrama/ 1 400   # prueba en el navegador (requiere Playwright)
```
Cada línea del banco es `palabra<TAB>pista<TAB>s`; la `s` genera automáticamente el plural («…, en plural»). Palabras correctas que falten en el diccionario Hunspell se añaden a `clues/allow.txt`.

## Palabra o Palabro

### Reglas
- 6 intentos en ambos modos; 5 letras por defecto (4–8 en Ajustes). Las tildes no hace falta escribirlas.
- **Fácil:** palabras comunes (lemas, plurales, femeninos) y una pista gratis por partida.
- **Difícil:** palabras raras y formas conjugadas; hay que reutilizar las pistas ya descubiertas.
- **Racha:** victorias seguidas, por idioma y por modo (se guarda en el navegador). Perder, o cambiar de palabra a mitad de partida, la reinicia.

### Rendimiento
- Solo se descarga el diccionario del idioma y largo elegidos (25–220 KB comprimidos, texto plano que GitHub Pages sirve con gzip).
- `sw.js` (en la raíz) los guarda en caché: carga instantánea y funciona sin conexión.
- Las palabras no se repiten hasta agotar la lista; la partida en curso se recupera al recargar.

### Diccionarios
`tools/build_dict.py` genera `palabra/data/` expandiendo los diccionarios Hunspell de LibreOffice (`es_ES`, `en_US`: conjugaciones, plurales, femeninos) y ordenando las soluciones con listas de frecuencia (hermitdave/FrequencyWords). En inglés se aceptan además las palabras de `dwyl/english-words`. Ver la cabecera del script para las fuentes y el comando.
Los diccionarios conservan sus licencias originales (LibreOffice/dictionaries, FrequencyWords CC-BY-SA 4.0, english-words Unlicense).
