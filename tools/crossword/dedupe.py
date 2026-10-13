#!/usr/bin/env python3
"""Quita de un archivo .tsv las palabras ya presentes en otros archivos del banco.

Uso: dedupe.py <carpeta> <archivo.tsv> [--all]   (sin --all solo compara con archivos anteriores por nombre)"""
import sys, unicodedata
from pathlib import Path
d = Path(sys.argv[1]); target = Path(sys.argv[2])
def norm(w):
    w = unicodedata.normalize("NFC", w).lower().replace("ñ", "\u0001")
    return "".join(c for c in unicodedata.normalize("NFD", w) if not unicodedata.combining(c)).replace("\u0001", "ñ")
seen = set()
for f in sorted(d.glob("*.tsv")):
    if f == target: continue
    if f.name < target.name or "--all" in sys.argv:
        seen |= {norm(l.split("\t")[0]) for l in f.read_text(encoding="utf-8").split("\n") if l.strip()}
out, dropped = [], []
for l in target.read_text(encoding="utf-8").split("\n"):
    if not l.strip(): continue
    w = norm(l.split("\t")[0])
    if w in seen: dropped.append(w); continue
    seen.add(w); out.append(l)
target.write_text("\n".join(out) + "\n", encoding="utf-8")
print("quitadas:", " ".join(dropped))
