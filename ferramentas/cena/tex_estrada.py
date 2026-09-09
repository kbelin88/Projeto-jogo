# tex_estrada.py — faz a textura da estrada a partir da que veio da Internet.
#
#   python ferramentas/cena/tex_estrada.py
#
# ── PORQUE ISTO TEM DE EXISTIR ───────────────────────────────────────────────
# O material do Blender sabe tingir e clarear uma fotografia com nós. O glTF
# não leva nós: conferido no ficheiro cozido, o material da estrada chegou ao
# jogo com `baseColorFactor` a [1,1,1,1] e a fotografia crua. Tudo o que o
# material fazia — o tom da paleta, o brilho — foi deitado fora na porta.
#
# Portanto o que tem de mudar é a IMAGEM. É o mesmo caminho do
# `costurar_texturas.py`: trata-se a fotografia uma vez, em Python, e o que
# viaja já é o resultado.
#
# ── E O QUE SE MUDA, E PORQUÊ ────────────────────────────────────────────────
# A queixa do Lucas foi "não me lembra uma estrada medieval". Três coisas na
# imagem contribuem, e são todas de LUZ, não de forma:
#
#   * está escura. Um caminho de terra é a coisa CLARA no meio do verde — é o
#     sítio onde a erva foi gasta até ao pó. Escuro, lê-se como asfalto molhado.
#   * está saturada de vermelho. Barro cozido, não terra pisada.
#   * e tem contraste a mais: o cascalho salta como se fosse brita de estrada
#     moderna. Um caminho batido por carroças é mais liso e mais poeirento.
import os
import shutil

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
ORIGEM = os.path.join(RAIZ, "assets", "texturas", "caminho")
DESTINO = os.path.join(RAIZ, "assets", "texturas", "caminho_batido")

BRILHO = 1.62          # o caminho passa a ser mais claro do que a relva
DESSATURA = 0.42       # quanto se puxa ao cinzento (0 = fica como está)
CONTRASTE = 0.68       # < 1 acalma o cascalho
TOM = (1.00, 0.95, 0.84)   # um toque de poeira quente, sem ir ao tijolo


def tratar(a):
    x = a.astype(np.float32) / 255.0
    # trabalha-se em LINEAR: clarear em sRGB queima os claros e deixa os
    # escuros para trás, e o resultado é uma imagem lavada em vez de clara
    lin = np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    cinza = lin.mean(axis=2, keepdims=True)
    lin = cinza + (lin - cinza) * (1.0 - DESSATURA)          # menos vermelho
    lin = cinza.mean() + (lin - cinza.mean()) * CONTRASTE     # menos cascalho
    lin = lin * BRILHO * np.array(TOM, dtype=np.float32)
    lin = np.clip(lin, 0.0, 1.0)
    out = np.where(lin <= 0.0031308, lin * 12.92,
                   1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return (np.clip(out, 0, 1) * 255).astype(np.uint8)


if __name__ == "__main__":
    os.makedirs(DESTINO, exist_ok=True)
    im = Image.open(os.path.join(ORIGEM, "cor.jpg")).convert("RGB")
    a = np.asarray(im)
    b = tratar(a)
    Image.fromarray(b).save(os.path.join(DESTINO, "cor.jpg"), quality=94)
    # o relevo e a rugosidade não se tocam: o que estava errado era a LUZ
    for f in ("normal.png", "rugosidade.png"):
        o = os.path.join(ORIGEM, f)
        if os.path.exists(o):
            shutil.copy2(o, os.path.join(DESTINO, f))
    print("SONDA %s: luminancia media %.3f -> %.3f (em sRGB, 0 a 1)"
          % (os.path.basename(DESTINO), a.mean() / 255.0, b.mean() / 255.0))
    print("SONDA gravado em %s" % DESTINO)
