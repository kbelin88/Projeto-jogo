# chao_liso.py — a ilha reduzida a UMA cor, para se poder julgar o resto.
#
#   python ferramentas/cena/chao_liso.py [R G B] [escala]
#
# ── POR QUE UM CHAO LISO ─────────────────────────────────────────────────────
# Com o terreno renderizado por baixo, nao havia como saber se um bosque estava
# mal ou se era o chao que estava a competir com ele. Despir o mapa a uma cor so
# torna cada peca julgavel sozinha: se um bosque parecer errado sobre verde
# chapado, o problema e do bosque.
#
# O QUE NAO MUDA: a SILHUETA. A costa vem do canal alfa do
# `assets/ilha-recortada.png`, portanto o encaixe (escala 1.17613 ancorada no
# topo) e as 24 ancoras continuam exatamente onde estavam. So a tinta e que sai.
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
COR = tuple(int(v) for v in sys.argv[1:4]) if len(sys.argv) > 3 else (112, 130, 78)
ESCALA = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0

base = Image.open(os.path.join(RAIZ, "assets/ilha-recortada.png")).convert("RGBA")
w, h = base.size
alvo = (int(w * ESCALA), int(h * ESCALA))
alfa = base.split()[3].resize(alvo, Image.LANCZOS)

lona = np.zeros((alvo[1], alvo[0], 4), dtype=np.uint8)
lona[..., 0], lona[..., 1], lona[..., 2] = COR
lona[..., 3] = np.asarray(alfa)
cam = os.path.join(RAIZ, "assets", "ilha-chao.png")
Image.fromarray(lona).save(cam)
print("SONDA chao liso %s  RGB %s  %.1f KB"
      % ("x".join(map(str, alvo)), COR, os.path.getsize(cam) / 1024))
