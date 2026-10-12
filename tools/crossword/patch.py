#!/usr/bin/env python3
"""Aplica correcciones puntuales al banco: python3 tools/crossword/patch.py <carpeta_clues> '{"palabra":"nueva pista"}' 'palabra1,palabra2'   (segundo: JSON de pistas; tercero: palabras a eliminar)"""
import json, sys, unicodedata
from pathlib import Path
d = Path(sys.argv[1]); fix = json.loads(sys.argv[2]); drop = set(sys.argv[3].split(",")) if len(sys.argv) > 3 and sys.argv[3] else set()
used = set()
for f in sorted(d.glob("*.tsv")):
    out = []
    for l in f.read_text(encoding="utf-8").split("\n"):
        if not l.strip(): continue
        p = l.split("\t"); w = unicodedata.normalize("NFC", p[0])
        if w in drop: used.add(w); continue
        if w in fix: p[1] = fix[w]; used.add(w)
        out.append("\t".join(p))
    f.write_text("\n".join(out) + "\n", encoding="utf-8")
missing = (set(fix) | drop) - used
print("sin encontrar:", sorted(missing) if missing else "ninguna")
