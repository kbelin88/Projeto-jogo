# mapa_ativo.py — QUE MAPA o forno esta a cozer (11/11/2026).
#
#   MAPA=usa  blender -b ... -P ferramentas/cena/exportar_mapa.py
#
# Ate hoje havia um mapa so, e a Iberia estava escrita dentro do forno: o
# retangulo da arte, os nomes dos ficheiros, a pasta de saida. Este modulo e o
# UNICO sitio que sabe qual e o mapa. O forno e os ajudantes (distancia_costa,
# rios, pintar_chao, mar_costa) perguntam-lhe:
#   * onde estao as grelhas de entrada e os ficheiros de trabalho  -> cena(nome)
#   * para onde vai o que o navegador le                            -> SAIDA
#   * como se passa do sistema do mapa (x, y do world-*.js) a metros -> OX, OY, LARG, ALT
#   * que ficheiro de mundo traz a rede                             -> MUNDO
#
# ── A REGRA ────────────────────────────────────────────────────────────────
# Sem MAPA (ou MAPA=iberia) TUDO e como era: os mesmos caminhos, os mesmos
# numeros. O forno da Iberia tem de cozer o mesmo mapa, e isso confere-se
# comparando o `mapa3d.json` antes e depois de cada mexida.
#
# Os ficheiros do segundo mapa tem os MESMOS nomes, noutra pasta
# (ferramentas/cena/usa/ e sonda3d/usa/): assim nenhum ajudante precisa de
# saber nomes novos, so a pasta.
#
# Sem bpy e sem scipy: importa-se do Blender e do Python do sistema.
import json
import math
import os

NOME = (os.environ.get("MAPA") or "iberia").strip().lower()
IBERIA = NOME == "iberia"
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_CENA = os.path.join(RAIZ, "ferramentas", "cena")

if IBERIA:
    TRAB = _CENA
    SAIDA = os.path.join(RAIZ, "sonda3d")
    MUNDO = "world-iberia.js"
    # o retangulo da ARTE da ilha no viewBox do jogo (ver o exportar_mapa.py)
    OX, OY, LARG, ALT = 130.0, 144.0, 1429.0, 864.0 * 1.17613
    ALTURA_MAX, RAIO_BORRAO = 150.0, 18
    CFG = {}
elif NOME == "usa":
    TRAB = os.path.join(_CENA, "usa")
    SAIDA = os.path.join(RAIZ, "sonda3d", "usa")
    MUNDO = "world-usa.js"
    _g = json.load(open(os.path.join(TRAB, "_grelha.json"), encoding="utf-8"))
    OX, OY = _g["x0"], _g["y0"]
    LARG, ALT = _g["tw"] * _g["cel"], _g["th"] * _g["cel"]
    # o relevo ja vem desenhado pelo preparar_usa.py (vales nas estradas, serras
    # alisadas a medida): o forno nao o borra outra vez
    # o cume a 220 m: escolha do Lucas a 12/11, vendo 220 e 300 cozidos lado a lado
    # (pesquisa/2026-11-11/m2/comparar_220_300.jpg). ALTURA_MAX=300 para comparar.
    ALTURA_MAX = float(os.environ.get("ALTURA_MAX", "220"))
    RAIO_BORRAO = 0
    CFG = {"enseadas": [], "aterros": [], "relva_forcada": []}
else:
    raise SystemExit("MAPA=%s: nao conheco esse mapa (iberia, usa)" % NOME)

os.makedirs(SAIDA, exist_ok=True)


def cena(nome):
    """um ficheiro de entrada ou de trabalho do mapa ativo (grelhas .npy, .npz, .json)"""
    return os.path.join(TRAB, nome)


def saida(nome):
    """um ficheiro que o navegador le"""
    return os.path.join(SAIDA, nome)


def curva_por(pontos, n):
    """n+1 pontos ao longo de uma curva que PASSA por todos os `pontos` (Catmull-Rom
    centripeta, amostrada por comprimento de corda).

    A Iberia dobra cada estrada por UM ponto de controlo (Bezier: a curva vai
    para o lado dele, nao passa nele). No mapa dos EUA uma estrada contorna um
    lago ou um golfo por varios pontos, e tem de passar NELES: sao esses pontos
    que o `preparar_usa.py` mediu como estando em terra seca.
    """
    P = [tuple(p) for p in pontos]
    if len(P) == 2:
        return [(P[0][0] + (P[1][0] - P[0][0]) * k / n, P[0][1] + (P[1][1] - P[0][1]) * k / n)
                for k in range(n + 1)]
    Q = [(2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1])] + P + \
        [(2 * P[-1][0] - P[-2][0], 2 * P[-1][1] - P[-2][1])]
    fina = []
    for s in range(len(P) - 1):
        p0, p1, p2, p3 = Q[s], Q[s + 1], Q[s + 2], Q[s + 3]
        for k in range(24):
            t = k / 24.0
            fina.append(tuple(
                0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t
                       + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t * t
                       + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t ** 3) for d in (0, 1)))
    fina.append(P[-1])
    acum = [0.0]
    for k in range(1, len(fina)):
        acum.append(acum[-1] + math.hypot(fina[k][0] - fina[k - 1][0], fina[k][1] - fina[k - 1][1]))
    tot, out, j = acum[-1], [], 0
    for k in range(n + 1):
        alvo = tot * k / n
        while j < len(acum) - 2 and acum[j + 1] < alvo:
            j += 1
        seg = acum[j + 1] - acum[j]
        u = (alvo - acum[j]) / seg if seg > 0 else 0.0
        out.append((fina[j][0] + (fina[j + 1][0] - fina[j][0]) * u,
                    fina[j][1] + (fina[j + 1][1] - fina[j][1]) * u))
    return out
