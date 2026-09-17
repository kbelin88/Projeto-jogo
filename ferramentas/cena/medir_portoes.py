# medir_portoes.py - confere, em TODAS as aldeias, portoes contra estradas e
# torres contra torres e portoes. Le o que o forno escreveu (mapa3d.json).
#
#   python ferramentas/cena/medir_portoes.py [sonda3d/mapa3d.json]
#
# Nasceu das duas primeiras marcas do caderno no 3D (17/09): em Lisboa o portao
# principal nao dava para estrada nenhuma e duas torres estavam coladas. Os
# numeros que interessam:
#   * cada ponta de estrada: a quantos graus fica do portao mais proximo;
#   * cada portao: quantas estradas o usam (0 = portao para lado nenhum);
#   * cada torre: a quantos metros fica da peca mais proxima na muralha.
import json
import math
import sys

ARQ = sys.argv[1] if len(sys.argv) > 1 else "sonda3d/mapa3d.json"
m = json.load(open(ARQ, encoding="utf-8"))
FOLGA_GRAUS = 25.0          # estrada a mais do que isto do portao = entra pelo muro
TORRE_PERTO_M = 16.0        # torre a menos disto de outra peca = colada

maus = 0
for cid, a in m["aldeias"].items():
    cx, cy = a["p"]
    portoes, torres = [], []
    for c in m["copias"]:
        if c["_cid"] != cid:
            continue
        ang = math.degrees(math.atan2(c["p"][1] - cy, c["p"][0] - cx))
        r = math.hypot(c["p"][0] - cx, c["p"][1] - cy)
        if c["peca"].startswith(("casa_portao", "portao_simples")):
            portoes.append({"ang": ang, "r": r, "peca": c["peca"].split("_")[0], "usos": 0})
        elif c["peca"].startswith("torre_muro"):
            torres.append({"ang": ang, "r": r})
    linhas = []
    for e in m["estradas"]:
        if cid not in (e["de"], e["para"]):
            continue
        p = e["pts"][0] if e["de"] == cid else e["pts"][-1]
        q = e["pts"][6] if e["de"] == cid else e["pts"][-7]
        rumo = math.degrees(math.atan2(q[1] - cy, q[0] - cx))
        dif = lambda g: abs((g["ang"] - rumo + 540) % 360 - 180)
        g = min(portoes, key=dif) if portoes else None
        d = dif(g) if g else 999
        if g and d <= FOLGA_GRAUS:
            g["usos"] += 1
        ruim = d > FOLGA_GRAUS
        maus += ruim
        linhas.append("   %s estrada p/ %-11s sai a %4.0f graus; portao mais perto a %3.0f graus"
                      % ("XX" if ruim else "ok", e["para"] if e["de"] == cid else e["de"], rumo, d))
    for g in portoes:
        if g["usos"] == 0:
            maus += 1
            linhas.append("   XX portao %s a %4.0f graus sem estrada" % (g["peca"], g["ang"]))
    for t in torres:
        outros = [o for o in torres if o is not t] + portoes
        if not outros:
            continue
        perto = min(abs((o["ang"] - t["ang"] + 540) % 360 - 180) for o in outros)
        metros = math.radians(perto) * t["r"]
        if metros < TORRE_PERTO_M:
            maus += 1
            linhas.append("   XX torre a %4.0f graus colada (%.1f m da peca mais perto)"
                          % (t["ang"], metros))
    ruins = [x for x in linhas if x.startswith("   XX")]
    print("%-11s %-8s %d portao(oes), %d torre(s)%s"
          % (cid, a["t"], len(portoes), len(torres), "" if not ruins else "  <-- %d" % len(ruins)))
    for x in ruins:
        print(x)
print("\nSONDA %d defeito(s) de portao/torre em %d aldeias" % (maus, len(m["aldeias"])))
