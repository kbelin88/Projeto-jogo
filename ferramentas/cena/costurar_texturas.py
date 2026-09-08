# costurar_texturas.py — torna uma imagem gerada em textura repetível.
#
#   python ferramentas/cena/costurar_texturas.py
#
# ── PORQUE ISTO É PRECISO ────────────────────────────────────────────────────
# Uma imagem gerada por IA é uma FOTOGRAFIA de um material, não um ladrilho.
# Ao repeti-la lado a lado, a beira esquerda não continua na direita e vê-se
# uma grelha de costuras por toda a peça — o defeito mais denunciador que uma
# textura pode ter.
#
# Medido nas quatro que chegaram (diferença média entre as beiras opostas, em
# níveis de 0 a 255; abaixo de ~12 emenda sem se notar):
#
#     couro        h 11   v 12    ->  já emenda
#     aço          h  9   v 22    ->  emenda ao lado, não em cima
#     linho        h 24   v 20    ->  não emenda
#     cota de malha h 40  v 48    ->  não emenda de todo
#
# ── COMO SE COSTURA ──────────────────────────────────────────────────────────
# Desloca-se a imagem meia largura e meia altura. A costura que estava na beira
# passa a estar no MEIO, onde se pode tratar — e as beiras novas são as antigas
# metades, que continuavam umas nas outras por construção.
#
# Depois mistura-se a imagem original por cima da costura central com uma
# máscara esbatida. É a "cruz" clássica, e funciona bem em materiais
# ESTOCÁSTICOS — malha, tecido, couro, pedra — que é o caso de todos estes.
# Numa textura com desenho regular (tijolos alinhados) far-se-ia outra coisa.
import io
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
DESTINO = os.path.join(RAIZ, "assets", "texturas")

# (ficheiro que o Lucas gerou, pasta destino, lado final)
FONTES = [
    ("cota de malha medieval.png", "malha", 1024),
    ("couro gasto castanho.png", "couro_gasto", 1024),
    ("linho grosseiro tecido.png", "linho", 1024),
    ("aço escovado com marcas de martelo.png", "aco_martelado", 1024),
]


def costura(a):
    """quanto a beira esquerda difere da direita, e a de cima da de baixo"""
    return (float(np.abs(a[:, 0] - a[:, -1]).mean()),
            float(np.abs(a[0, :] - a[-1, :]).mean()))


def esbater(n, largura):
    """uma rampa suave de 0 a 1 ao longo de `largura`, no meio de `n`"""
    x = np.arange(n)
    d = np.minimum(np.abs(x - n / 2), largura) / largura
    return (d * d * (3 - 2 * d))          # suaviza as pontas


def espelhar(a):
    """espelha em cruz: costura ZERO por construção, ao preço da simetria.

    A imagem vira o dobro, com a metade direita a ser o reflexo da esquerda.
    Como as beiras opostas passam a ser a mesma coluna, não há emenda nenhuma.
    O preço é a simetria — que se vê numa parede de tijolo e NÃO se vê num
    tecido ou numa cota de malha vistos a quarenta píxeis de altura.
    """
    d = np.concatenate([a, a[:, ::-1]], axis=1)
    return np.concatenate([d, d[::-1, :]], axis=0)


def tornar_repetivel(a, banda=0.12):
    """a cruz: desloca meia imagem e apaga a costura que fica ao meio"""
    h, w = a.shape[:2]
    des = np.roll(np.roll(a, w // 2, axis=1), h // 2, axis=0)
    # a máscara vale 1 longe da costura e 0 em cima dela: onde vale 0, entra a
    # imagem ORIGINAL, que ali não tinha costura nenhuma
    mx = esbater(w, w * banda)[None, :, None]
    my = esbater(h, h * banda)[:, None, None]
    m = np.minimum(mx, my)
    return des * m + a * (1 - m)


def quadrar(im, lado):
    """recorta ao centro e reduz — as imagens vieram 1408x768"""
    c = min(im.size)
    x = (im.width - c) // 2
    y = (im.height - c) // 2
    return im.crop((x, y, x + c, y + c)).resize((lado, lado), Image.LANCZOS)


if __name__ == "__main__":
    for ficheiro, pasta, lado in FONTES:
        origem = os.path.join(DESTINO, ficheiro)
        if not os.path.exists(origem):
            print("SONDA falta: %s" % ficheiro)
            continue
        im = quadrar(Image.open(origem).convert("RGB"), lado)
        a = np.asarray(im).astype(np.float32)
        h0, v0 = costura(a)
        b = np.clip(tornar_repetivel(a), 0, 255)
        h1, v1 = costura(b)
        modo = "cruz"
        # ── A REGRA E MEDIDA, NAO ESCOLHIDA ──────────────────────────────
        # A cruz e preferivel porque nao introduz simetria. Mas quando a
        # costura teima acima de 12 -- e o linho teimou, 16/17 com todas as
        # bandas que varri -- o espelho e a troca certa: leva simetria, que
        # nao se ve, e tira a emenda, que se ve.
        if max(h1, v1) > 12:
            b = espelhar(a)
            b = np.asarray(Image.fromarray(b.astype(np.uint8))
                           .resize((lado, lado), Image.LANCZOS)).astype(np.float32)
            h1, v1 = costura(b)
            modo = "espelho"
        alvo = os.path.join(DESTINO, pasta)
        os.makedirs(alvo, exist_ok=True)
        Image.fromarray(b.astype(np.uint8)).save(os.path.join(alvo, "cor.jpg"),
                                                 quality=94)
        print("SONDA %-14s %-8s costura  h %2.0f->%2.0f   v %2.0f->%2.0f"
              % (pasta, modo, h0, h1, v0, v1))
