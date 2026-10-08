# Pasatiempos

Colección de juegos de navegador, sin servidor ni build (HTML, CSS y JS estáticos). Partidas ilimitadas, rachas de victorias y varios niveles.

**Jugar:** https://msms-22.github.io/palabropalabra/ (Settings → Pages → Deploy from a branch → `main` / raíz).

| Juego | Ruta | Resumen |
|---|---|---|
| Home «Pasatiempos» | `/` | Tarjetas de los juegos con tu racha actual |
| Palabra o Palabro | `/palabra/` | Wordle en español e inglés, modo fácil y difícil, 4–8 letras |
| Sudoku | `/sudoku/` | Fácil, medio y difícil; notas que se borran solas; pistas |

```
index.html   shared.css   shared.js   sw.js     ← home, tema común, preferencias, caché sin conexión
palabra/     index.html + data/ (diccionarios)
sudoku/      index.html + engine.js (generador y solver)
tools/build_dict.py                               ← genera palabra/data
```
Para añadir un juego: crea una carpeta con su `index.html` (usa `../shared.css` y `../shared.js`), añade su tarjeta en `index.html` y su ruta a `SHELL` en `sw.js`.

## Sudoku
- **Tableros:** `sudoku/engine.js` genera una solución completa por backtracking, quita casillas manteniendo la **solución única** y califica el nivel con un solver «humano» por técnicas. Fácil = solo individuales (38–44 pistas); medio = pares, tríos y bloqueos (30–35); difícil = X-Wing, XY-Wing o Swordfish (23–29). Se generan en el momento (≈ 1–150 ms).
- **Notas:** botón ✏️ (o tecla `N`; `Mayús`+número anota directamente). Al colocar un número desaparece de las notas de su fila, columna y bloque. Deshacer restaura también las notas borradas. ✨ Auto-notas rellena todos los candidatos.
- **Pistas:** 3 por partida; explican por qué va ese número. La victoria cuenta, pero el mejor tiempo solo lo marcan las partidas sin pistas.
- **Racha:** victorias seguidas por dificultad; perder o abandonar una partida empezada la reinicia.

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
