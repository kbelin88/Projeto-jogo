# cor_prado.py — a cor de cada pedaco de campo, por REGIAO.
#
#   python ferramentas/cena/cor_prado.py
#
# O `exportar_mapa.py` chama-o antes de construir o chao (o Python do Blender
# nao traz PIL nem scipy). Sai `ferramentas/cena/_prado.npy`: um numero por
# celula da grelha do chao, 0 = seco, 1 = humido.
#
# ── DE ONDE VEM ──────────────────────────────────────────────────────────────
# Do `d_mata.png` que o gerador da ilha escreve -- o MESMO campo que decide
# onde ha bosques. E humidade, com o limite das arvores ja dentro: por isso o
# verde escuro cai onde a ilha ja e escura, e o palha onde ela e clara. Usar a
# altitude em vez disto seria pintar serra com serra e planicie com planicie,
# que nao e como a Peninsula se ve.
#
# ── E LEVA UM BORRAO GRANDE ─────────────────────────────────────────────────
# O campo cru tem os BOSQUES la dentro (manchas de dezenas de metros). Sem
# borrao, o prado ficava as nodoas por baixo das arvores que ja estao no mapa,
# duas vezes a mesma coisa. Com 150 m de borrao fica so a TENDENCIA da regiao,
# que e o que se quer.
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
ESC, OX, OY = 1.17613, 130.0, 144.0          # pixel da ilha -> viewBox (espalhar_mata.py)
IB_OX, IB_OY, IB_LARG = 130.0, 144.0, 1429.0   # iguais aos do exportar_mapa.py
IB_ALT = 864.0 * ESC                         # a altura da ARTE, nao da caixa
BORRAO_M = 150.0

terra = np.load(os.path.join(CENA, "_terra.npy")).astype(bool)
th, tw = terra.shape
LX, LY = json.load(open(os.path.join(RAIZ, "sonda3d", "mapa3d.json"),
                       encoding="utf-8"))["mapa_m"]
px, py = LX / tw, LY / th
M_POR_VB = LX / IB_LARG

dens = np.asarray(Image.open(os.path.join(
    RAIZ, "ferramentas/ilha3d/_saida/d_mata.png")).convert("L"), dtype=np.float32) / 255.0
H, W = dens.shape

# grelha do chao -> metros -> viewBox -> pixel da ilha
gx = np.arange(tw, dtype=np.float32)[None, :] * px - LX / 2
gy = LY / 2 - np.arange(th, dtype=np.float32)[:, None] * py
vx = gx / M_POR_VB + IB_OX + IB_LARG / 2
vy = -gy / M_POR_VB + IB_OY + IB_ALT / 2
pi = np.clip((vx - OX) / ESC, 0, W - 1) + np.zeros_like(gy)
pj = np.clip((vy - OY) / ESC, 0, H - 1) + np.zeros_like(gx)
h = ndimage.map_coordinates(dens, [pj.ravel(), pi.ravel()], order=1,
                            mode="nearest").reshape(th, tw)

# ── O BORRAO NAO PODE BEBER DA AGUA ─────────────────────────────────────────
# Fora da ilha o campo e zero, e um borrao de 150 m puxava toda a costa para
# seco -- uma orla amarela a toda a volta, que ninguem pediu. Borra-se a
# densidade e a MASCARA, e divide-se uma pela outra: so a terra conta.
sig = BORRAO_M / px
m = terra.astype(np.float32)
h = ndimage.gaussian_filter(h * m, sig) / np.maximum(ndimage.gaussian_filter(m, sig), 1e-4)

v = h[terra]
lo, hi = np.percentile(v, 4), np.percentile(v, 96)
h = np.clip((h - lo) / max(hi - lo, 1e-6), 0.0, 1.0).astype(np.float32)
np.save(os.path.join(CENA, "_prado.npy"), h)
print("SONDA cor do prado: %dx%d, humido %.0f%% da terra, seco %.0f%%"
      % (th, tw, 100 * (h[terra] > 0.66).mean(), 100 * (h[terra] < 0.33).mean()))
