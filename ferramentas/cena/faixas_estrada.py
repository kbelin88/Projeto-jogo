# faixas_estrada.py -- a SUPERFICIE de cada tipo de estrada, pintada em faixa.
#
#   python ferramentas/cena/faixas_estrada.py
#
# O `pintar_chao.py` chama-o. Sai, por tipo, `sonda3d/estrada_faixa_<tipo>.png`
# (RGBA) e as medidas em `sonda3d/estrada_faixas.json`.
#
# ── PORQUE (27/09) ──────────────────────────────────────────────────────────
# O Lucas: as estradas "estao se escondendo no mapa", "quase iguais" -- e "sao
# basicamente o jogo, precisam ser a estrela". Trouxe uma folha de referencia
# (estilo AoE4). O que la faz uma estrada ler-se:
#   * cada TIPO e diferente: terra castanho-alaranjada com dois rodados;
#     calcada de pedras irregulares cinzentas; carreiro de dois trilhos com
#     erva ao meio;
#   * a BEIRA e viva: a erva invade aos tufos, ha pedrinhas soltas, a terra
#     acaba de forma irregular -- nao ha linha nem contorno.
# Uma cor no shader nao chega la. Aqui pinta-se cada tipo numa FAIXA: o eixo X
# atravessa a estrada de beira a beira (o `lado` do forno, -1..1) e o eixo Y
# corre ao longo dela, e repete-se sem costura (tudo e periodico em Y). O canal
# alfa e a cobertura: onde e 0 ve-se o chao pintado por baixo (os tufos, a
# beira recortada).
#
# As fotografias sao do Poly Haven (CC0): brown_mud_dry (terra com pedrinhas),
# cobblestone_floor_04 (calcada irregular, erva nas juntas), stone_wall (os
# lancis da calcada).
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.getcwd()
TEX = os.path.join(RAIZ, "assets", "texturas")
SAIDA = os.path.join(RAIZ, "sonda3d")
LARG_PX = 512                      # pixeis de beira a beira


def foto(pasta):
    a = np.asarray(Image.open(os.path.join(TEX, pasta, "cor.jpg")).convert("RGB"), dtype=np.float32) / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)      # luz linear


def lin_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def amostrar(img, xm, ym, metros):
    """a fotografia (que cobre `metros` por lado) lida nas coordenadas em metros"""
    n = img.shape[0]
    u = (xm / metros * n) % n
    v = (ym / metros * n) % n
    out = np.empty(xm.shape + (3,), dtype=np.float32)
    for k in range(3):
        out[..., k] = ndimage.map_coordinates(img[..., k], [v, u], order=1, mode="wrap")
    return out


def ruido(H, W, cel_y, cel_x, semente):
    """ruido liso, PERIODICO em Y (a faixa repete-se ao longo da estrada)"""
    r = np.random.default_rng(semente)
    g = r.random((cel_y, cel_x + 3)).astype(np.float32)
    J = np.arange(H, dtype=np.float32)[:, None] / H * cel_y + np.zeros((1, W), np.float32)
    I = np.arange(W, dtype=np.float32)[None, :] / W * cel_x + np.zeros((H, 1), np.float32)
    return ndimage.map_coordinates(g, [J, I], order=3, mode="grid-wrap").clip(0, 1)


def fbm(H, W, oitavas, semente):
    tot, s = 0.0, 0.0
    for k, (cy, cx, p) in enumerate(oitavas):
        tot = tot + ruido(H, W, cy, cx, semente + 7 * k) * p
        s += p
    return tot / s


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def pedrinhas(H, W, densidade, raio_px, semente):
    """pedras soltas: (luz, sombra, cobertura) -- um disco claro com a sombra
    deslocada para baixo-direita (o sol do mapa)"""
    r = np.random.default_rng(semente)
    n = int(H * W * densidade)
    luz = np.zeros((H, W), np.float32)
    sombra = np.zeros((H, W), np.float32)
    ys = r.integers(0, H, n)
    xs = r.integers(0, W, n)
    rs = r.uniform(0.6, 1.4, n) * raio_px
    for y, x, rr in zip(ys, xs, rs):
        R = int(rr) + 3
        yy, xx = np.mgrid[-R:R + 1, -R:R + 1]
        d = np.hypot(yy / 0.85, xx) / rr
        m = np.clip(1.2 - d, 0, 1)
        s = np.clip(1.2 - np.hypot((yy - rr * 0.35) / 0.85, xx - rr * 0.3) / rr, 0, 1)
        Y = (y + yy) % H
        X = np.clip(x + xx, 0, W - 1)
        np.maximum.at(sombra, (Y, X), s)
        np.maximum.at(luz, (Y, X), m)
    return luz, sombra


def faixa(tipo, meia_m, comprido_m, semente):
    """devolve RGBA (H, W, 4) em sRGB, 0..1"""
    W = LARG_PX
    H = int(round(W * comprido_m / (2 * meia_m)))
    x = np.linspace(-1, 1, W, dtype=np.float32)[None, :] + np.zeros((H, 1), np.float32)
    xm = x * meia_m
    ym = np.arange(H, dtype=np.float32)[:, None] / H * comprido_m + np.zeros((1, W), np.float32)
    a = np.abs(x)
    # (27/09) a terra e PINTADA (SDXL no ComfyUI, `gen_terra`): a cor e o grao
    # sao dela; so se puxa um pouco ao tom da referencia
    lodo = foto("gen_terra")
    t = amostrar(lodo, xm, ym, 4.5)
    lum = t @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum = lum / lum.mean()
    TERRA = np.array([0.36, 0.20, 0.085], np.float32)
    terra = t * 0.75 + TERRA * (0.6 + 0.4 * lum)[..., None] * 0.25
    manchas = fbm(H, W, [(3, 4, 0.6), (9, 10, 0.4)], semente)
    terra *= (0.86 + 0.28 * manchas)[..., None]
    borda = fbm(H, W, [(6, 2, 0.55), (24, 4, 0.30), (70, 8, 0.15)], semente + 1)
    tufos = fbm(H, W, [(40, 30, 0.6), (110, 70, 0.4)], semente + 2)

    if tipo == "real":
        # ── a calcada: pedras irregulares, lancis de pedra maior, e uma berma
        # de terra batida que se desfaz na erva
        # (27/09) calcada PINTADA (SDXL, `gen_calcada`), um pouco aquecida
        pedra = amostrar(foto("gen_calcada"), xm, ym, 4.4)
        calc = pedra * np.array([1.08, 1.02, 0.92], np.float32)
        calc *= (0.9 + 0.2 * fbm(H, W, [(4, 3, 1.0)], semente + 9))[..., None]
        lanc = amostrar(foto("gen_pedra_ponte"), xm * 2.0, ym, 2.6) * 0.85
        c = np.where((a < 0.60)[..., None], calc, terra)
        c = np.where(((a >= 0.58) & (a < 0.68))[..., None], lanc, c)
        # a calcada gasta ao meio (mais lisa, mais clara) e suja nas beiras
        c *= (1.0 + 0.08 * smooth(0.45, 0.0, a))[..., None]
        fim = 0.80 + (borda - 0.5) * 0.22
    elif tipo == "carreiro":
        # ── dois trilhos de terra, erva ao meio e dos lados
        c = terra * 0.95
        trilho = np.maximum(smooth(0.26, 0.12, np.abs(a - 0.36)), 0)
        cobre = trilho * smooth(0.25, 0.55, borda + 0.25)
        fim = 0.62 + (borda - 0.5) * 0.18
    else:
        # ── o caminho: terra batida, dois rodados escuros e lisos, uma lomba
        # ao meio mais clara com uma erva rala
        c = terra.copy()
        onda = 0.025 * np.sin(ym / comprido_m * 2 * np.pi * 2 + 1.3)
        rod = np.exp(-((a - 0.30 - onda) / 0.07) ** 2)
        c = c * (1.0 - 0.30 * rod)[..., None]
        # o sulco e mais liso: menos grao da fotografia
        c = c * (1.0 - rod[..., None] * 0.15) + (TERRA * 0.7) * rod[..., None] * 0.15
        c *= (1.0 + 0.10 * smooth(0.20, 0.0, a))[..., None]
        fim = 0.72 + (borda - 0.5) * 0.24

    # ── A BEIRA ─────────────────────────────────────────────────────────────
    # a terra acaba em `fim`, recortada; tufos de erva mordem-na por dentro
    # (buracos no alfa) e salpicos de terra escapam para fora
    cob = smooth(fim + 0.06, fim - 0.04, a)
    morde = smooth(0.62, 0.78, tufos) * smooth(fim - 0.30, fim, a)
    cob = cob * (1.0 - morde)
    escapa = smooth(0.70, 0.85, 1.0 - tufos) * smooth(fim + 0.22, fim, a) * 0.8
    cob = np.maximum(cob, escapa)
    if tipo == "carreiro":
        cob = np.minimum(cob, 0.25 + 0.75 * cobre)
    # a beira da terra e mais escura: a erva pisada e a sombra do rebordo
    c *= (1.0 - 0.18 * smooth(fim - 0.14, fim, a))[..., None]
    # pedrinhas soltas, mais para as beiras
    luz, sombra = pedrinhas(H, W, 0.0009 if tipo != "real" else 0.0004, 2.2, semente + 3)
    peso_p = smooth(0.2, 0.7, a) * 0.9 + 0.1
    PEDRA = np.array([0.30, 0.27, 0.23], np.float32)
    c = c * (1.0 - 0.45 * (sombra * peso_p))[..., None]
    c = c * (1.0 - luz * peso_p)[..., None] + PEDRA * (luz * peso_p)[..., None]
    cob = np.maximum(cob, luz * peso_p * smooth(fim + 0.25, fim, a))
    rgba = np.concatenate([lin_srgb(c), cob[..., None]], -1)
    return rgba, H


if __name__ == "__main__":
    # (tipo, meia-largura da FITA em metros, comprimento da repeticao) -- a
    # repeticao e multiplo do ladrilho da fotografia, para nao ter costura
    TIPOS = [("real", 7.2, 2.2 * 8), ("caminho", 5.6, 2.2 * 8), ("carreiro", 3.6, 2.2 * 6)]
    # ⚠ UMA imagem com as tres, lado a lado: o shader da estrada ja le o chao
    # pintado e passava das 16 unidades de textura do WebGL (nao compilava e as
    # estradas sumiam -- 27/09). Cada faixa e reamostrada para a mesma altura;
    # o comprimento da repeticao vai no json.
    meta, tiras = {}, []
    ALT = 1024
    for k, (tipo, meia, comp) in enumerate(TIPOS):
        rgba, H = faixa(tipo, meia, comp, 11 + k * 13)
        im = Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA").resize((LARG_PX, ALT), Image.LANCZOS)
        tiras.append(im)
        meta[tipo] = {"meia": meia, "comprido": comp, "coluna": k}
    atlas = Image.new("RGBA", (LARG_PX * len(tiras), ALT))
    for k, im in enumerate(tiras):
        atlas.paste(im, (k * LARG_PX, 0))
    atlas.save(os.path.join(SAIDA, "estrada_faixas.png"))
    json.dump(meta, open(os.path.join(SAIDA, "estrada_faixas.json"), "w", encoding="utf-8"), indent=1)
    print("SONDA faixas de estrada: %d tipos numa imagem %dx%d" % (len(tiras), atlas.size[0], atlas.size[1]))
