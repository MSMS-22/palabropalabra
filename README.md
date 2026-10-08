# Palabra o Palabro

Juego tipo Wordle en español e inglés. Partidas ilimitadas, racha de victorias y modos fácil/difícil.
Es un `index.html` estático: no necesita servidor ni build.

**Jugar:** https://msms-22.github.io/palabropalabra/ (activar en *Settings → Pages → Deploy from a branch → raíz*).

## Reglas
- 6 intentos en ambos modos; 5 letras por defecto (4–8 en Ajustes). Las tildes no hace falta escribirlas.
- **Fácil:** palabras comunes (lemas, plurales, femeninos) y una pista gratis por partida.
- **Difícil:** palabras raras y formas conjugadas; hay que reutilizar las pistas ya descubiertas.
- **Racha:** victorias seguidas, por idioma y por modo (se guarda en el navegador). Perder, o cambiar de palabra a mitad de partida, la reinicia.

## Rendimiento
- Solo se descarga el diccionario del idioma y largo elegidos (25–220 KB comprimidos, texto plano que GitHub Pages sirve con gzip).
- `sw.js` los guarda en caché: carga instantánea y funciona sin conexión.
- Las palabras no se repiten hasta agotar la lista; la partida en curso se recupera al recargar.

## Diccionarios
`tools/build_dict.py` genera `data/` expandiendo los diccionarios Hunspell de LibreOffice (`es_ES`, `en_US`: conjugaciones, plurales, femeninos) y ordenando las soluciones con listas de frecuencia (hermitdave/FrequencyWords). En inglés se aceptan además las palabras de `dwyl/english-words`. Ver la cabecera del script para las fuentes y el comando.
Los diccionarios conservan sus licencias originales (LibreOffice/dictionaries, FrequencyWords CC-BY-SA 4.0, english-words Unlicense).
