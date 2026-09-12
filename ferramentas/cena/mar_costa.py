# mar_costa.py — a distancia a costa, para o mar saber onde e raso.
#
#   python ferramentas/cena/mar_costa.py
#
# O `exportar_mapa.py` chama-o no fim (o Python do Blender nao traz scipy).
# Tambem corre sozinho, em segundos, sem forno.
#
# ── O QUE SAI ────────────────────────────────────────────────────────────────
#   sonda3d/mar_costa.png   cada pixel = metros ate a terra mais proxima (0-255)
#   sonda3d/mar_costa.json  onde fica o pixel (0,0) no mundo e quanto mede cada um
#
# O mapa3d.js le as duas e pinta o mar: turquesa e transparente junto a costa,
# escuro ao largo, e espuma na linha de agua. Sem estes ficheiros o mar volta a
# cor chapada de antes -- nao parte nada.
#
# ── A MESMA LINHA DE AGUA DA MALHA ───────────────────────────────────────────
# A beira do chao e empurrada para onde o alfa da arte vale LIMIAR (ver
# `encostar` no exportar_mapa.py). Se o mar lesse outra fronteira, a espuma
# ficava a metros da rocha. Por isso: o MESMO alfa, o MESMO limiar, e a mascara
# FINAL do forno (com as aldeias carimbadas) quando ela existe.
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
SAIDA = os.path.join(RAIZ, "sonda3d")

LIMIAR = 110 / 255.0          # exportar_mapa.py, `encostar` -- tem de ser o mesmo
SOBE = 4                      # 4x a grelha do chao: ~1,2 m por pixel
LX, LY = json.load(open(os.path.join(SAIDA, "mapa3d.json"), encoding="utf-8"))["mapa_m"]

alfa = np.load(os.path.join(CENA, "_alfa.npy")).astype(np.float32)
fin = os.path.join(CENA, "_terra_final.npy")
terra = np.load(fin if os.path.exists(fin) else os.path.join(CENA, "_terra.npy")).astype(bool)
th, tw = alfa.shape
px, py = LX / tw, LY / th     # exportar_mapa.py: px, py = LX / tw, LY / th

# o vertice (i, j) do chao esta em (i*px - LX/2, LY/2 - j*py). `zoom` com
# order=1 alinha as pontas: o pixel I do grande cai no vertice I*(tw-1)/(W-1).
W, H = (tw - 1) * SOBE + 1, (th - 1) * SOBE + 1
alfa_g = ndimage.zoom(alfa, (H / th, W / tw), order=1)
terra_g = ndimage.zoom(terra.astype(np.uint8), (H / th, W / tw), order=0).astype(bool)
dx, dy = px * (tw - 1) / (W - 1), py * (th - 1) / (H - 1)
terra_g = (alfa_g > LIMIAR) | terra_g

# ── A LINHA DE AGUA E ONDE O CHAO CRUZA O MAR, NAO A BORDA DA MASCARA ────────
# Numa praia a terra mergulha: a malha continua uns metros depois de a areia ja
# estar debaixo de agua. Medir a distancia a borda da mascara punha a espuma
# em cima de areia submersa, a metros da linha de agua de verdade. Com o
# relevo FINAL (o que saiu do forno), terra e so o que esta acima do mar.
NIVEL_MAR = 0.0               # mapa3d.js: mar.position.y
rel = os.path.join(CENA, "_relevo_final.npy")
if os.path.exists(rel):
    relevo_g = ndimage.zoom(np.load(rel).astype(np.float32), (H / th, W / tw), order=1)
    terra_g &= relevo_g > NIVEL_MAR

# distancia EUCLIDIANA de cada pixel de agua a terra, em metros
dist = ndimage.distance_transform_edt(~terra_g, sampling=(dy, dx))
Image.fromarray(np.clip(np.round(dist), 0, 255).astype(np.uint8), "L").save(
    os.path.join(SAIDA, "mar_costa.png"), optimize=True)

# mundo do three: x = x do forno, z = -y do forno. O pixel (I, J) fica em
# x = -LX/2 + I*dx, z = -(LY/2 - J*dy) = -LY/2 + J*dy.
meta = {"W": W, "H": H, "x0": round(-LX / 2, 4), "z0": round(-LY / 2, 4),
        "dx": round(dx, 6), "dz": round(dy, 6), "max_m": 255,
        "mascara": "_terra_final.npy" if os.path.exists(fin) else "_terra.npy"}
with open(os.path.join(SAIDA, "mar_costa.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f)
print("SONDA mar_costa: %dx%d, %.2f m/px, agua a >100 m da costa: %.0f%% (mascara %s)"
      % (W, H, dx, 100 * (dist > 100).mean(), meta["mascara"]))
