# tex_estrada.py — trata as texturas de chao que o glTF leva cruas.
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

# ── AS RECEITAS ──────────────────────────────────────────────────────────────
# (pasta de origem, pasta de destino, brilho, dessaturacao, contraste, tom)
#
# O CAMINHO clareia: um caminho de terra e a coisa clara no meio do verde, o
# sitio onde a erva foi gasta ate ao po. Escuro, lia-se como asfalto molhado.
#
# O PENHASCO trocou de fotografia. Estava a sair da pasta `pedra`, que e um
# MURO DE ALVENARIA -- pedras aparelhadas com argamassa entre elas. Tratada,
# clareada ou escurecida, uma parede de 40 m com aquilo em cima nunca ia ser
# uma falesia: era a muralha de um castelo com 2 km de comprimento. O `penedo`
# e rocha a serio, com fracturas verticais e liquen, e as fracturas caem no
# sentido em que a parede cai. So se lhe tira metade do verde e se lhe da um
# fio de contraste -- o contraste e o que faz os estratos.
RECEITAS = [
    ("caminho", "caminho_batido", 1.62, 0.42, 0.68, (1.00, 0.95, 0.84)),
    ("penedo", "falesia", 1.05, 0.48, 1.08, (0.96, 0.97, 1.00)),
]


def tratar(a, BRILHO, DESSATURA, CONTRASTE, TOM):
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
    for de, para, br, ds, ct, tom in RECEITAS:
        origem = os.path.join(RAIZ, "assets", "texturas", de)
        destino = os.path.join(RAIZ, "assets", "texturas", para)
        if not os.path.exists(os.path.join(origem, "cor.jpg")):
            print("SONDA falta %s" % origem)
            continue
        os.makedirs(destino, exist_ok=True)
        a = np.asarray(Image.open(os.path.join(origem, "cor.jpg")).convert("RGB"))
        b = tratar(a, br, ds, ct, tom)
        Image.fromarray(b).save(os.path.join(destino, "cor.jpg"), quality=94)
        # o relevo e a rugosidade nao se tocam: o que estava errado era a LUZ
        for f in ("normal.png", "rugosidade.png"):
            o = os.path.join(origem, f)
            if os.path.exists(o):
                shutil.copy2(o, os.path.join(destino, f))
        print("SONDA %-16s luminancia media %.3f -> %.3f"
              % (para, a.mean() / 255.0, b.mean() / 255.0))
