#!/usr/bin/env python3
"""Genera la lista de formas válidas del español (3–11 letras, sin tildes) para validar el banco de pistas.

Uso: python3 tools/crossword/valid_es.py <carpeta_fuentes> <salida_validas.txt> <salida_lemas.txt>
(<carpeta_fuentes> contiene es_ES.dic/.aff; ver tools/build_dict.py)
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build_dict as b

src = Path(sys.argv[1])
lemmas, forms = b.expand(src / "es_ES.dic", src / "es_ES.aff", False)
ok = re.compile("^[a-zñ]+$")
norm = lambda ws: sorted({n for n in (b.strip_accents(w) for w in ws if w == w.lower()) if 3 <= len(n) <= 11 and ok.match(n)})
Path(sys.argv[2]).write_text("\n".join(norm(forms)), encoding="utf-8")
Path(sys.argv[3]).write_text("\n".join(norm(lemmas)), encoding="utf-8")
