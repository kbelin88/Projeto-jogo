# ler_marcas.py - le o caderno de marcas mais recente e diz o que arrumar.
#
#   python ferramentas/cena/ler_marcas.py [ficheiro.json]
#
# Sem argumento, le o mais recente de `marcas/`.
#
# ── O QUE ESTE RELATORIO TENTA SER ─────────────────────────────────────────
# Um bilhete de trabalho, nao um despejo de coordenadas. Por isso:
#   * agrupa por NOTA (marcas com a mesma frase sao o mesmo defeito, e
#     corrigem-se de uma vez) e nao por cor;
#   * diz o que esta DENTRO do circulo, nao a peca mais proxima do centro -
#     quase todo o defeito que ele aponta e um ENCONTRO de duas pecas;
#   * aponta o recorte de cada marca, que e a vista que ELE escolheu.
# Le tambem os cadernos antigos, para nao os deixar ilegiveis.
import glob
import json
import os
import sys

RAIZ = os.getcwd()
PASTA = os.path.join(RAIZ, "marcas")
arg = sys.argv[1] if len(sys.argv) > 1 else None
TODOS = sorted(glob.glob(os.path.join(PASTA, "marcas-*.json")))

# `todos` LE A PASTA INTEIRA. Existe por causa de uma armadilha real: gravar
# fecha o lote, entao gravar tres vezes faz tres cadernos — e ler so o mais
# recente perde os dois primeiros em silencio, que e o pior tipo de perda.
if arg in ("todos", "--todos", "-t"):
    if not TODOS:
        print("SONDA nao ha marcas ainda. No jogo: tecla M, riscar, e 'guardar'.")
        raise SystemExit(0)
    import subprocess
    for i, f in enumerate(TODOS):
        if i:
            print("\n" + "-" * 66 + "\n")
        subprocess.call([sys.executable, os.path.abspath(__file__), f])
    raise SystemExit(0)

alvo = arg
if not alvo:
    if not TODOS:
        print("SONDA nao ha marcas ainda. No jogo: tecla M, riscar, e 'guardar'.")
        raise SystemExit(0)
    alvo = TODOS[-1]
    if len(TODOS) > 1:
        print("SONDA ATENCAO: ha %d cadernos por ler em marcas/ e este e so o "
              "ultimo.\nSONDA          para ver todos: "
              "python ferramentas/cena/ler_marcas.py todos\n" % len(TODOS))

d = json.load(open(alvo, encoding="utf-8"))
marcas = d.get("marcas", [])
print("SONDA %s   %s" % (os.path.basename(alvo), d.get("quando", "")))
print("SONDA %d marca(s)" % len(marcas))
if d.get("nota"):
    print("SONDA nota do caderno: " + d["nota"])
print("")


def centro_de(m):
    if m.get("centro"):
        return m["centro"]
    pts = m.get("pts") or [[0, 0]]
    return [sum(q[0] for q in pts) // len(pts), sum(q[1] for q in pts) // len(pts)]


# agrupar por nota: a mesma frase e o mesmo defeito
grupos = []
for i, m in enumerate(marcas):
    chave = (m.get("nota") or "").strip().lower()
    if not chave:
        chave = "(sem nota) gaveta: " + (m.get("gaveta") or m.get("o_que") or "?")
    for g in grupos:
        if g[0] == chave:
            g[1].append((i, m))
            break
    else:
        grupos.append([chave, [(i, m)]])

for chave, lista in grupos:
    titulo = (lista[0][1].get("nota") or "").strip() or chave
    print("== %s   (%d marca%s)" % (titulo, len(lista), "" if len(lista) == 1 else "s"))
    for i, m in lista:
        n = m.get("n", i + 1)
        c = centro_de(m)
        raio = m.get("raio")
        print("   [%d] em %s%s" % (n, c, "  raio %d" % raio if raio else ""))

        aqui = m.get("aqui")
        if aqui:                                            # formato novo
            for rot, lst, uni in (("aldeia", aqui.get("aldeias"), "aldeia"),
                                  ("estrada", aqui.get("estradas"), "estrada"),
                                  ("moita", aqui.get("moitas"), "moita")):
                lst = lst or []
                for x in lst[:3]:
                    if rot == "moita":
                        print("        moita   #%-4d mata_%d   a %4d px  "
                              "(linha %d de assets/sprites/mata.json)"
                              % (x["i"], x.get("sprite", 0) + 1, x["dist"], x["i"]))
                    else:
                        print("        %-7s %-24s a %4d px" % (rot, x["id"], x["dist"]))
                if len(lst) > 3:
                    print("        %-7s (+%d dentro do circulo)" % ("", len(lst) - 3))
            if not any((aqui.get(k) or []) for k in ("aldeias", "estradas", "moitas")):
                print("        (o circulo nao apanhou nenhuma peca)")
        else:                                               # cadernos antigos
            p = m.get("perto") or {}
            if "aldeia" in p or "estrada" in p:
                for rot in ("aldeia", "estrada"):
                    x = p.get(rot) or {}
                    if x:
                        print("        %-7s %-24s a %4s px" % (rot, x.get("id"), x.get("dist")))
            else:
                print("        %s %s a %s px"
                      % (p.get("tipo", "?"), p.get("id", "?"), p.get("dist", "?")))

        rec = m.get("recorte")
        if rec and os.path.exists(os.path.join(PASTA, rec)):
            print("        ver: marcas/%s" % rec)
    print("")

vista = os.path.splitext(alvo)[0] + ".png"
if os.path.exists(vista):
    print("SONDA a vista geral do momento da gravacao: %s" % os.path.relpath(vista, RAIZ))
