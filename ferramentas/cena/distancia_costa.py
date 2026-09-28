# distancia_costa.py -- a distancia de cada vertice do chao a beira da terra,
# EUCLIDIANA e abaixo da celula, para o forno desenhar as praias.
#
#   python ferramentas/cena/distancia_costa.py
#
# O `exportar_mapa.py` chama-o antes de esculpir a costa (o Python do Blender
# nao traz scipy). Sai `ferramentas/cena/_dm_liso.npy`: (th, tw), em CELULAS do
# chao (o forno multiplica pelo lado da celula), 0 fora da terra.
#
# ── PORQUE (28/09) ───────────────────────────────────────────────────────────
# A praia (o areal que mergulha, a encosta atras) desenhava-se a partir de
# `_dm`, uma distancia contada em CELULAS inteiras de 4,9 m, alternando 4 e 8
# vizinhos. Longe da agua o forno alisava-a; junto a agua ficava crua, para a
# linha de costa nao mudar de sitio -- e o areal saia em degraus desencontrados
# entre colunas vizinhas (medido na enseada de Sevilha: 0,84 -> 0,68 -> 0,32 ->
# -0,26 m, e 0,46 / 0,68 / 0,76 / 0,51 na mesma fila). A beira da fita de
# areia, a areia molhada e a luz seguiam os degraus: DENTES DE SERRA de 5 m
# (marca do Lucas nas fotos da agua).
#
# Aqui a distancia mede-se ao CONTORNO do alfa da arte -- o mesmo a que o forno
# encosta a beira da malha (`encostar`, LIMIAR) --, numa grelha 4x mais fina, e
# le-se em cada vertice. E lisa, e a beira fica onde a malha a poe.
import os

import numpy as np
from scipy import ndimage

CENA = os.path.join(os.getcwd(), "ferramentas", "cena")
LIMIAR = 110 / 255.0          # exportar_mapa.py, `encostar` -- tem de ser o mesmo
SOBE = 4

alfa = np.load(os.path.join(CENA, "_alfa.npy")).astype(np.float32)
terra = np.load(os.path.join(CENA, "_terra_final.npy")).astype(bool)
ori = np.load(os.path.join(CENA, "_terra.npy")).astype(bool)
th, tw = alfa.shape
H, W = (th - 1) * SOBE + 1, (tw - 1) * SOBE + 1
Z = (H / th, W / tw)
# o vertice (i, j) do chao cai no pixel (i*SOBE, j*SOBE) da grelha fina
fina = ndimage.zoom(alfa, Z, order=1) > LIMIAR
# os carimbos das aldeias (terra que o alfa nao conhece), como no mar_costa
fina |= ndimage.zoom((terra & ~ori).astype(np.float32), Z, order=1) > 0.5
d = ndimage.distance_transform_edt(fina) / SOBE   # em celulas do chao, ate a agua
dm = d[::SOBE, ::SOBE].astype(np.float32)          # (th, tw): um valor por vertice
dm = np.where(terra, dm, 0.0).astype(np.float32)
np.save(os.path.join(CENA, "_dm_liso.npy"), dm)
print("SONDA distancia_costa: %dx%d, lida a 1/%d da celula" % (tw, th, SOBE))
