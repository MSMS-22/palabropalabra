#!/usr/bin/env python3
"""Lista de palabras candidatas para el banco de pistas del crucigrama.

Uso: python3 tools/crossword/candidates.py <carpeta_fuentes> <salida.tsv>
Toma los lemas del diccionario Hunspell es_ES que aparecen en la lista de frecuencia
(hermitdave/FrequencyWords) y escribe: normalizada \t lema \t rango_frecuencia.
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build_dict as b

src, out = Path(sys.argv[1]), Path(sys.argv[2])
lemmas, forms = b.expand(src / "es_ES.dic", src / "es_ES.aff", False)
ok = re.compile("^[a-zñ]+$")
rank = {}
for i, line in enumerate((src / "es_50k.txt").read_text(encoding="utf-8").splitlines()):
    w = line.split(" ")[0].lower()
    rank.setdefault(w, i + 1)
rows = []
for w in lemmas:
    n = b.strip_accents(w)
    if not (3 <= len(n) <= 11) or not ok.match(n) or w != w.lower(): continue
    r = rank.get(w)
    if r and r <= 40000: rows.append((r, n, w))
rows.sort()
out.write_text("\n".join(f"{n}\t{w}\t{r}" for r, n, w in rows) + "\n", encoding="utf-8")
from collections import Counter
print(len(rows), sorted(Counter(len(n) for _, n, _ in rows).items()))
