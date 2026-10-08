#!/usr/bin/env python3
"""Genera data/<idioma>/<largo>.txt a partir de diccionarios Hunspell + listas de frecuencia.

Uso: python3 tools/build_dict.py <carpeta_fuentes> [carpeta_salida]

Fuentes esperadas en <carpeta_fuentes>:
  es_ES.dic/.aff, en_US.dic/.aff   (LibreOffice/dictionaries)
  es_50k.txt, en_50k.txt           (hermitdave/FrequencyWords, 2018)
  words_alpha.txt                  (dwyl/english-words, solo para aceptar intentos en inglés)

Formato de cada archivo de salida (texto plano, el hosting lo comprime con gzip):
  línea 1:  N_validas N_faciles N_dificiles
  luego N_validas palabras (sin tildes, ordenadas)  -> lo que se puede escribir
  luego N_faciles palabras (con tildes)             -> soluciones del modo fácil
  luego N_dificiles palabras (con tildes)           -> soluciones del modo difícil
"""
import re, sys, unicodedata, zlib
from pathlib import Path

LENGTHS = range(4, 9)
EASY_MAX, HARD_MAX = 4000, 8000          # tope de soluciones por largo
LANGS = {
    "es": dict(dic="es_ES", freq="es_50k.txt", letters="abcdefghijklmnñopqrstuvwxyz", prefixes=False, extra=None),
    "en": dict(dic="en_US", freq="en_50k.txt", letters="abcdefghijklmnopqrstuvwxyz", prefixes=True, extra="words_alpha.txt"),
}

def strip_accents(w):
    out = []
    for ch in unicodedata.normalize("NFD", w):
        if unicodedata.combining(ch) and out and out[-1] != "n":
            continue                       # quita tilde/diéresis...
        if unicodedata.combining(ch):      # ...pero conserva la ñ
            if ch == "̃":
                out.append(ch)
            continue
        out.append(ch)
    return unicodedata.normalize("NFC", "".join(out))

def load_aff(path):
    rules = {}                              # (kind, flag) -> (cross, [(strip, add, cond_re, cont)])
    cur = None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        p = line.split()
        if len(p) >= 4 and p[0] in ("PFX", "SFX") and p[3].isdigit():
            cur = (p[0], p[1]); rules[cur] = (p[2] == "Y", [])
        elif len(p) >= 4 and p[0] in ("PFX", "SFX") and cur and (p[0], p[1]) == cur:
            strip = "" if p[2] == "0" else p[2]
            add, _, cont = p[3].partition("/")
            add = "" if add == "0" else add
            cond = p[4] if len(p) > 4 else "."
            rx = re.compile(("^" + cond) if p[0] == "PFX" else (cond + "$")) if cond != "." else None
            rules[cur][1].append((strip, add, rx, cont))
    return rules

def apply(word, kind, flag, rules):
    r = rules.get((kind, flag))
    if not r: return
    for strip, add, rx, cont in r[1]:
        if rx and not rx.search(word): continue
        if kind == "SFX":
            if strip and not word.endswith(strip): continue
            yield (word[:len(word) - len(strip)] if strip else word) + add, cont
        else:
            if strip and not word.startswith(strip): continue
            yield add + word[len(strip):], cont

def expand(dic, aff, prefixes):
    rules = load_aff(aff)
    lemmas, forms = set(), set()
    for line in Path(dic).read_text(encoding="utf-8").splitlines()[1:]:
        entry = line.split("\t")[0].split(" ")[0]
        word, _, flags = entry.partition("/")
        if not word or not word[0].islower(): continue
        lemmas.add(word); forms.add(word)
        sfx = []
        for f in flags:
            for w, cont in apply(word, "SFX", f, rules):
                forms.add(w); sfx.append(w)
                for c in cont: forms.update(x for x, _ in apply(w, "SFX", c, rules))
        if prefixes:
            for f in flags:
                if ("PFX", f) in rules and rules[("PFX", f)][0]:
                    for w in [word] + sfx:
                        forms.update(x for x, _ in apply(w, "PFX", f, rules))
                else:
                    forms.update(x for x, _ in apply(word, "PFX", f, rules))
    return lemmas, forms

def build(lang, cfg, src, out):
    ok = re.compile("^[" + cfg["letters"] + "]+$")
    lemmas, forms = expand(src / (cfg["dic"] + ".dic"), src / (cfg["dic"] + ".aff"), cfg["prefixes"])
    forms = {w for w in forms if ok.match(strip_accents(w)) and w == w.lower()}
    lem = {strip_accents(w) for w in lemmas}
    extra = set()
    if cfg["extra"]:                        # palabras válidas extra (solo para aceptar intentos)
        extra = {w for w in (src / cfg["extra"]).read_text().split() if ok.match(w)}
    by_norm = {}
    for w in forms: by_norm.setdefault(strip_accents(w), []).append(w)

    def is_easy(n):                         # lema, plural o femenino de un lema
        if n in lem: return True
        if n.endswith("s") and n[:-1] in lem: return True
        if n.endswith("es") and n[:-2] in lem: return True
        if n.endswith("ies") and n[:-3] + "y" in lem: return True
        if lang == "es" and n.endswith("a") and n[:-1] + "o" in lem: return True
        return False

    ranked = []                             # (normalizada, forma con tildes) por frecuencia
    seen = set()
    for line in (src / cfg["freq"]).read_text(encoding="utf-8").splitlines():
        w = line.split(" ")[0].lower()
        n = strip_accents(w)
        if w in forms and n not in seen and ok.match(n):
            seen.add(n); ranked.append((n, w))

    (out / lang).mkdir(parents=True, exist_ok=True)
    for L in LENGTHS:
        valid = sorted(n for n in set(by_norm) | extra if len(n) == L)
        easy = [w for n, w in ranked if len(n) == L and is_easy(n)][:EASY_MAX]
        easy_n = {strip_accents(w) for w in easy}
        hard = [w for n, w in ranked if len(n) == L and n not in easy_n]
        used = easy_n | {strip_accents(w) for w in hard}      # el resto: formas válidas poco usadas
        rest = sorted((w for n, ws in by_norm.items() if len(n) == L and n not in used for w in ws[:1]),
                      key=lambda w: zlib.crc32(w.encode()))   # orden estable pero sin sesgo alfabético
        hard = (hard + rest)[:HARD_MAX]
        body = [f"{len(valid)} {len(easy)} {len(hard)}"] + valid + easy + hard
        (out / lang / f"{L}.txt").write_text("\n".join(body) + "\n", encoding="utf-8")
        print(f"{lang} {L}: válidas={len(valid):6d} fácil={len(easy):5d} difícil={len(hard):5d}")

if __name__ == "__main__":
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "data"
    for lang, cfg in LANGS.items(): build(lang, cfg, src, out)
