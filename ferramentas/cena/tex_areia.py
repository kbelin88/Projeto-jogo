# tex_areia.py - a textura da AREIA das praias, gerada por codigo.
#
#   python ferramentas/cena/tex_areia.py      -> assets/texturas/areia/{cor.jpg,normal.png,rugosidade.png,altura.png}
#
# ── PORQUE E GERADA E NAO FOTOGRAFADA ───────────────────────────────────────
# A pasta estava vazia desde 11/09 e a praia saia com a cor chapada da paleta.
# O ComfyUI desta maquina so tem o modelo de imagem->3D (TRELLIS), nao gera
# imagens de texto; e o `gravel_4k` que ha em disco e cascalho -- num ladrilho
# de 3 m daria seixos do tamanho de melancias.
#
# Areia vista a 3 m de ladrilho e pouca coisa: GRAO fino, algumas manchas mais
# escuras (areia humida, conchas moidas) e as ONDULAS que o vento risca. Tudo
# isso sai de ruido, e ruido pode ser feito PERIODICO -- o ladrilho repete sem
# costura, que e o que uma fotografia nunca da de graca.
#
# ⚠ O glTF nao leva o tingimento do material (ver CLAUDE.md 8.3): o tom tem de
# sair JA na imagem. A cor aqui e a final.
import os

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
PARA = os.path.join(RAIZ, "assets", "texturas", "areia")
N = 1024
rng = np.random.default_rng(42)


def ruido_periodico(celulas, semente):
    """ruido de valor com `celulas` por lado, que fecha sobre si proprio"""
    r = np.random.default_rng(semente).random((celulas, celulas)).astype(np.float32)
    t = np.arange(N, dtype=np.float32) * celulas / N
    i0 = np.floor(t).astype(int)
    f = t - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % celulas
    a = r[i0][:, i0]
    b = r[i0][:, i1]
    c = r[i1][:, i0]
    d = r[i1][:, i1]
    fx, fy = f[None, :], f[:, None]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm_periodico(base, oitavas, semente):
    soma, amp, tot = 0.0, 1.0, 0.0
    for k in range(oitavas):
        soma = soma + amp * ruido_periodico(base * 2 ** k, semente + k)
        tot += amp
        amp *= 0.5
    return soma / tot


y, x = np.mgrid[0:N, 0:N].astype(np.float32)
# ── AS ONDULAS ──────────────────────────────────────────────────────────────
# frequencias INTEIRAS no ladrilho, para fecharem na beira; a torcao tambem e
# periodica. 11 ondulas por 3 m = uma a cada 27 cm, que e o que o vento faz.
torce = (fbm_periodico(4, 3, 11) - 0.5) * 7.0
fase = 2 * np.pi * (11 * x + 3 * y) / N + torce
ondula = 0.5 + 0.5 * np.sin(fase)
ondula = ondula ** 1.6                                  # crista estreita, vale largo
apaga = np.clip((fbm_periodico(3, 3, 21) - 0.35) / 0.4, 0.0, 1.0)   # onde o pe pisou
ondula = ondula * apaga

grao = fbm_periodico(64, 3, 31)                         # grao medio
fino = rng.random((N, N)).astype(np.float32)            # grao a pixel
fino = (fino + np.roll(fino, 1, 0) + np.roll(fino, 1, 1)) / 3.0
mancha = fbm_periodico(5, 4, 41)                        # humido / seco

altura = 0.55 * ondula + 0.30 * grao + 0.15 * fino
altura = (altura - altura.min()) / (altura.max() - altura.min())

# ── A COR ───────────────────────────────────────────────────────────────────
# sRGB. Areia clara de praia atlantica, a puxar ao dourado, com o humido mais
# escuro e mais frio. As cristas das ondulas apanham luz; os vales, sombra.
SECA = np.array([0.86, 0.76, 0.58], np.float32)
HUMIDA = np.array([0.66, 0.58, 0.45], np.float32)
m = np.clip((mancha - 0.38) / 0.35, 0.0, 1.0)[..., None]
cor = SECA * (1 - m * 0.55) + HUMIDA * (m * 0.55)
luz = 0.86 + 0.12 * ondula + 0.10 * (grao - 0.5) + 0.12 * (fino - 0.5)
cor = cor * luz[..., None]
# pintas escuras raras (grao de mineral, concha moida)
pinta = (rng.random((N, N)) > 0.9965).astype(np.float32)
pinta = np.maximum(pinta, np.roll(pinta, 1, 1) * 0.6)
cor = cor * (1 - 0.45 * pinta[..., None])
cor = np.clip(cor, 0, 1)

# ── NORMAL E RUGOSIDADE ─────────────────────────────────────────────────────
gx = (np.roll(altura, -1, 1) - np.roll(altura, 1, 1)) * 2.2
gy = (np.roll(altura, -1, 0) - np.roll(altura, 1, 0)) * 2.2
nz = np.ones_like(gx)
nl = np.sqrt(gx * gx + gy * gy + nz * nz)
normal = np.stack([-gx / nl, gy / nl, nz / nl], -1) * 0.5 + 0.5    # OpenGL (y para cima)
rug = np.clip(0.88 + 0.08 * (grao - 0.5) - 0.10 * m[..., 0], 0, 1)

os.makedirs(PARA, exist_ok=True)
Image.fromarray((cor * 255).astype(np.uint8)).save(os.path.join(PARA, "cor.jpg"), quality=92)
Image.fromarray((normal * 255).astype(np.uint8)).save(os.path.join(PARA, "normal.png"))
Image.fromarray((rug * 255).astype(np.uint8)).save(os.path.join(PARA, "rugosidade.png"))
Image.fromarray((altura * 255).astype(np.uint8)).save(os.path.join(PARA, "altura.png"))
# a prova de costura: o ladrilho 2x2, onde uma emenda se ve logo
prova = np.tile((cor * 255).astype(np.uint8), (2, 2, 1))
Image.fromarray(prova).resize((1024, 1024)).save(
    os.path.join(RAIZ, "ferramentas", "cena", "_saida", "areia_2x2.jpg"), quality=90)
print("SONDA areia: media sRGB %s, ondulas 11 por ladrilho -> %s"
      % (np.round(cor.reshape(-1, 3).mean(0) * 255).astype(int).tolist(), PARA))
