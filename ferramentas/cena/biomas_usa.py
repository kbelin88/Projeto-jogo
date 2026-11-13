# -*- coding: utf-8 -*-
"""Os biomas dos EUA (M3, 12/11): a CHUVA REAL e os pesos de cada bioma.

PORQUE
------
Ate a M2 a secura do 2.o mapa era inventada com tres regras de geografia, e a
passagem do verde para o seco saia uma parede reta no meridiano 98. O Lucas
escolheu a chuva real: a precipitacao anual do WorldClim 2.1 (5', ~9 km; os 12
meses em `dados_usa/worldclim/`, fora do git), somada no ano.

Os biomas sao PESOS SUAVES, nao classes: cada sitio pode ser 70% pradaria e 30%
caduca, e a pintura e as arvores misturam pelos pesos. Todas as fronteiras de
latitude e longitude levam ruido de ~1 grau, para nunca serem retas.

Usa-se do `preparar_usa.py` (que grava `_biomas.npz` e tira a secura da chuva).
So numpy, scipy e PIL; nada aqui corre no Blender.
"""
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados_usa", "worldclim")

# os nomes, por esta ordem, no `_biomas.npz` (o pintar_chao e o forno leem-nos pelo nome)
NOMES = ["pacifico", "california", "coniferas", "sonora", "mojave", "bacia",
         "pradaria", "outono", "caduca", "sudeste", "florida", "alpino"]


def chuva(LON, LAT):
    """precipitacao anual (mm) em cada ponto (LON, LAT); o mar enche-se com a
    costa mais perto, para a beira da terra nao cair a zero"""
    P = None
    for m in range(1, 13):
        a = np.array(Image.open(os.path.join(PASTA, "wc2.1_5m_prec_%02d.tif" % m)), dtype=np.float32)
        if P is None:
            nodata = a < -1000
            P = np.where(nodata, 0, a)
        else:
            P += np.where(a < -1000, 0, a)
    # so a caixa dos EUA (o mundo a 5' tem 4320 x 2160)
    r0, r1 = int((90 - 52) * 12), int((90 - 22) * 12)
    c0, c1 = int((180 - 128) * 12), int((180 - 64) * 12)
    sub = P[r0:r1, c0:c1]
    vazio = nodata[r0:r1, c0:c1]
    ind = ndi.distance_transform_edt(vazio, return_distances=False, return_indices=True)
    sub = sub[tuple(ind)]
    fr = (90.0 - LAT) * 12 - 0.5 - r0
    fc = (LON + 180.0) * 12 - 0.5 - c0
    return ndi.map_coordinates(sub, [fr, fc], order=1, mode="nearest").astype(np.float32)


def secura(P):
    """0 humido (>= 1100 mm) .. 1 deserto (<= 220 mm), em escala de log: a
    diferenca entre 200 e 400 mm ve-se mais do que entre 1200 e 1400"""
    h = (np.log(np.maximum(P, 50.0)) - math.log(220.0)) / (math.log(1100.0) - math.log(220.0))
    return (1.0 - np.clip(h, 0.0, 1.0)).astype(np.float32)


def _s(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _ruido(forma, esc, semente):
    TH, TW = forma
    r = np.random.default_rng(semente).random((TH // esc + 3, TW // esc + 3))
    return ndi.zoom(r, esc, order=3)[:TH, :TW]


def pesos(P, LON, LAT, serra, neve, terra):
    """dict nome -> peso 0..1 (somam 1 em terra; 0 no mar). `serra` e `neve`
    sao os da grelha de desenho (0..1)."""
    forma = P.shape
    NL = (_ruido(forma, 60, 21) - 0.5) * 1.6                 # graus: fronteiras de latitude tortas
    NO = (_ruido(forma, 60, 22) - 0.5) * 1.6
    Pn = P * (1.0 + (_ruido(forma, 40, 7) - 0.5) * 0.25)      # e a chuva nao e uma curva de nivel limpa
    oeste = _s(-100.0, -104.0, LON)
    mt = np.clip(serra, 0, 1) * oeste                        # serra do Oeste
    W = {}
    W["pacifico"] = _s(650, 1000, Pn) * _s(-119.5, -121.0, LON) * _s(38.5, 40.5, LAT)
    W["california"] = _s(-116.5, -118.0, LON) * _s(41.0, 39.0, LAT) * _s(180, 300, Pn) * (1 - W["pacifico"])
    W["coniferas"] = mt * _s(330, 480, Pn) * (1 - W["pacifico"])
    seco = _s(470, 260, Pn) * _s(-101.0, -105.0, LON)
    sonora = _s(35.2, 33.6, LAT + NL) * _s(-116.0, -114.2, LON + NO)
    mojave = _s(33.6, 34.8, LAT + NL) * _s(38.0, 36.6, LAT + NL) * _s(-112.6, -114.2, LON + NO)
    W["sonora"] = seco * sonora
    W["mojave"] = seco * mojave * (1 - sonora)
    W["bacia"] = seco * (1 - sonora) * (1 - mojave) * (1 - W["california"])
    caduca = _s(720, 980, Pn + (LON + 97) * 25) * _s(-103.0, -100.0, LON)
    W["pradaria"] = (1 - caduca) * (1 - mt) * (1 - seco) * (1 - W["pacifico"]) * (1 - W["california"])
    sudeste = _s(36.5, 33.5, LAT + (_ruido(forma, 40, 12) - 0.5) * 1.2) * caduca
    W["outono"] = caduca * (1 - sudeste) * _s(38.6, 41.2, LAT + (LON + 80) * 0.12 + NL * 1.4)
    W["caduca"] = caduca * (1 - sudeste) * (1 - W["outono"])
    palm = _s(31.2, 28.6, LAT + (_ruido(forma, 30, 11) - 0.5) * 0.8) * _s(-91, -86, LON)
    W["florida"] = sudeste * palm
    W["sudeste"] = sudeste * (1 - palm)
    W["alpino"] = mt * np.clip(neve * 2, 0, 1)
    soma = sum(W.values())
    resto = np.clip(1.0 - soma, 0.0, 1.0)
    W["pradaria"] = W["pradaria"] + resto                    # o pouco que sobra e pasto
    soma = np.maximum(sum(W.values()), 1e-4)
    return {k: np.where(terra, W[k] / soma, 0.0).astype(np.float32) for k in NOMES}


# cor de cada bioma na PLANTA do preparador (sRGB 0..255; a do jogo e do pintar_chao)
COR_PLANTA = {"pacifico": (30, 70, 40), "california": (190, 160, 80), "coniferas": (70, 100, 60),
              "sonora": (200, 140, 80), "mojave": (215, 185, 130), "bacia": (160, 160, 120),
              "pradaria": (190, 180, 90), "outono": (200, 90, 40), "caduca": (70, 130, 50),
              "sudeste": (60, 110, 60), "florida": (110, 190, 90), "alpino": (240, 240, 245)}
