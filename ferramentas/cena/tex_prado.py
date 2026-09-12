# tex_prado.py — a relva do CHAO, tratada fora do Blender.
#
#   python ferramentas/cena/tex_prado.py
#
# ── PORQUE EXISTE ────────────────────────────────────────────────────────────
# A fotografia de relva que temos e palha seca: media RGB 74/54/10, castanho
# azeitona. No Blender isso nao se via, porque o material tinge a fotografia
# com a nossa cor (mistura COLOR) -- mas o glTF NAO leva grafos de nos, e ao
# jogo chegava a fotografia crua. O mapa inteiro saiu castanho.
#
# E a mesma armadilha do `tex_estrada.py`, e a mesma resposta: o que tem de
# mudar, muda na IMAGEM.
#
# Aqui a luminancia da fotografia (o grao, as folhas, as falhas) e mantida, e
# so o MATIZ passa a verde de prado. Sai `assets/texturas/prado/`, e o
# rugosidade/normal sao os mesmos da relva.
import os
import shutil

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
DE = os.path.join(RAIZ, "assets", "texturas", "relva")
PARA = os.path.join(RAIZ, "assets", "texturas", "prado")
ALVO = np.array([0.30, 0.44, 0.16])      # o verde de prado, em sRGB 0..1
CLARO = 1.55                              # a foto e escura; o jogo nao a clareia


def srgb_para_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_para_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


os.makedirs(PARA, exist_ok=True)
im = np.asarray(Image.open(os.path.join(DE, "cor.jpg")).convert("RGB"), np.float32) / 255.0
lin = srgb_para_linear(im)
# a LUMINANCIA e o que guarda o desenho da fotografia
lum = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
alvo = srgb_para_linear(ALVO)
alvo = alvo / max(float(alvo @ np.array([0.2126, 0.7152, 0.0722])), 1e-6)
saida = lum[..., None] * alvo[None, None, :] * CLARO
# 12% da fotografia original de volta: sem isto o verde fica de plastico, sem
# as folhas secas que uma relva de verdade tem
saida = saida * 0.88 + lin * 0.12

# ── E O BRILHO E EQUALIZADO ─────────────────────────────────────────────────
# Visto de cima, o chao fazia XADREZ: o ladrilho de 10 m repete, e o que
# denuncia a emenda nao e o grao fino -- e a mancha CLARA/ESCURA da propria
# fotografia, que a 2,8 km vira um quadriculado. Tirando as frequencias baixas
# (divide-se pela propria imagem borrada) fica so o grao, e a emenda desaparece
# sem a textura perder o detalhe de perto.
raio = max(saida.shape[0] // 16, 1)
k = np.ones(2 * raio + 1, np.float32) / (2 * raio + 1)
baixa = saida.copy()
for eixo in (0, 1):
    # (raio + 1, raio) e nao (raio, raio): com as duas iguais a soma acumulada
    # devolve N-1 linhas, e o borrao encolhe a imagem um pixel por passagem
    pad = np.pad(baixa, [(raio + 1, raio) if e == eixo else (0, 0) for e in (0, 1)]
                 + [(0, 0)], mode="wrap")
    acum = np.cumsum(pad, axis=eixo)
    fatia = [slice(None)] * 3
    fatia[eixo] = slice(2 * raio + 1, None)
    a = acum[tuple(fatia)]
    fatia[eixo] = slice(None, -(2 * raio + 1))
    baixa = (a - acum[tuple(fatia)]) / (2 * raio + 1)
saida = saida * (saida.mean(axis=(0, 1)) / np.maximum(baixa, 1e-4))
Image.fromarray((linear_para_srgb(saida) * 255).astype(np.uint8)).save(
    os.path.join(PARA, "cor.jpg"), quality=92)
for f in ("rugosidade.png", "normal.png", "altura.png"):
    if os.path.exists(os.path.join(DE, f)):
        shutil.copy2(os.path.join(DE, f), os.path.join(PARA, f))
saiu = np.asarray(Image.open(os.path.join(PARA, "cor.jpg")).convert("RGB"), float)
print("SONDA tex_prado: media RGB %s -> %s" % (
    (im * 255).reshape(-1, 3).mean(0).round(1), saiu.reshape(-1, 3).mean(0).round(1)))
