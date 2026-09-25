# tex_falesia_algarve.py - a rocha das falesias, a lembrar o Algarve, gerada por codigo.
#
#   python ferramentas/cena/tex_falesia_algarve.py
#     -> assets/texturas/falesia_algarve/{cor.jpg,normal.png,rugosidade.png,altura.png}
#
# ── PORQUE (25/09) ──────────────────────────────────────────────────────────
# A falesia usava uma fotografia de rocha escura e cinzenta: de perto, manchas;
# de longe, listas verticais -- nada de costa. O Lucas trouxe a referencia: o
# Algarve, calcario dourado em BANCOS HORIZONTAIS, uns duros que sobressaem e
# outros moles que recuam, com fendas verticais e o pe mais escuro onde o mar
# bate.
#
# Gerada, e nao fotografada, pela mesma razao da areia (`tex_areia.py`): tem de
# ser PERIODICA (repete sem costura ao longo de quilometros de costa), e o tom
# tem de sair JA na imagem -- o glTF nao leva o tingimento do material.
#
# A imagem: `u` (colunas) corre AO LONGO da costa, `v` (linhas) e a ALTURA. Um
# ladrilho cobre `METROS` em cada eixo (ver FICHEIRO["falesia_algarve"]).
import os

import numpy as np
from PIL import Image

RAIZ = os.getcwd()
PARA = os.path.join(RAIZ, "assets", "texturas", "falesia_algarve")
N = 1024
METROS = 24.0                    # tem de bater com FICHEIRO["falesia_algarve"]
PX_M = N / METROS
rng = np.random.default_rng(7)


def ruido(ku, kv, semente, pot=2.0):
    """ruido periodico por espectro: `ku`/`kv` = frequencia de corte em cada eixo"""
    r = np.random.default_rng(semente)
    f = r.normal(size=(N, N)) + 1j * r.normal(size=(N, N))
    fy = np.fft.fftfreq(N)[:, None] * N
    fx = np.fft.fftfreq(N)[None, :] * N
    peso = np.exp(-((fx / ku) ** 2 + (fy / kv) ** 2) ** (pot / 2))
    peso[0, 0] = 0
    z = np.real(np.fft.ifft2(f * peso))
    return (z - z.mean()) / (z.std() + 1e-9)


# ── OS BANCOS ───────────────────────────────────────────────────────────────
# Espessuras entre 0,25 e 1,6 m, somando exatamente o ladrilho (senao a costura
# da altura aparecia). Cada banco: uma cor da paleta e uma DUREZA.
# ── A COR DO ALGARVE (2.a volta) ─────────────────────────────────────────────
# A 1.a paleta, no mapa, saiu palida e acinzentada (o ceu e o tone mapping comem
# saturacao). A referencia do Lucas e OURO: amarelos e ocres carregados.
PALETA = np.array([
    (232, 190, 110),   # dourado
    (218, 160, 78),    # ocre
    (200, 122, 58),    # ferrugem
    (240, 208, 140),   # palha clara
    (222, 176, 102),   # areia dourada
    (190, 110, 52),    # laranja queimado
], dtype=np.float32) / 255.0
bancos, soma = [], 0
while True:
    esp = int(rng.uniform(0.5, 3.5) * PX_M)
    if soma + esp > N - 20:
        bancos.append((soma, N - soma))
        break
    bancos.append((soma, esp))
    soma += esp
# mais creme e ocre, pouca ferrugem: no Algarve o laranja e a excecao
PESOS = np.array([0.32, 0.28, 0.06, 0.18, 0.12, 0.04])
cor_b = PALETA[rng.choice(len(PALETA), len(bancos), p=PESOS)]

duro_b = rng.uniform(0.0, 1.0, len(bancos))

# a fronteira dos bancos ondula AO LONGO da costa (sempre periodica)
ond = ruido(3, 1, 11)[0] * 5.0                       # px, por coluna
linha = np.arange(N)[:, None] + ond[None, :]          # linha "desondulada"
linha = np.mod(linha, N)
idx = np.zeros((N, N), dtype=np.int32)
frac = np.zeros((N, N), dtype=np.float32)             # posicao dentro do banco, 0 topo -> 1 base
for k, (ini, esp) in enumerate(bancos):
    m = (linha >= ini) & (linha < ini + esp)
    idx[m] = k
    frac[m] = (linha[m] - ini) / max(esp, 1)

cor = cor_b[idx]                                      # (N, N, 3)
duro = duro_b[idx]

# ── DENTRO DE CADA BANCO ────────────────────────────────────────────────────
# riscas HORIZONTAIS finas (a laminacao): alta frequencia na ALTURA (v),
# baixa ao longo da costa (u) -- ruido(ku, kv) com kv grande
risca = ruido(3, 60, 21) * 0.5 + ruido(8, 140, 22) * 0.3
grao = ruido(320, 320, 23)
mancha = ruido(5, 5, 24)
desgaste = ruido(14, 10, 25)
escorre = ruido(50, 3, 26)            # manchas de escorrencia, verticais e SUAVES
cor = cor * (1.0 + 0.06 * risca[..., None] + 0.08 * grao[..., None])
cor = cor * (1.0 + 0.12 * mancha[..., None] * np.array([1.0, 0.93, 0.82]))
cor = cor * (1.0 - 0.10 * np.clip(desgaste, 0, None)[..., None] * np.array([0.9, 1.0, 1.05]))
cor = cor * (1.0 - 0.035 * escorre[..., None])
# ── AS CAVIDADES DE EROSAO ──────────────────────────────────────────────────
# o calcario do Algarve e esburacado: alveolos escuros, mais nos bancos moles
# alongados na HORIZONTAL (seguem os bancos), poucos, e de borda macia
alv = ruido(18, 55, 27)
cav = np.clip((alv - 1.9 + 0.4 * (1.0 - duro)) / 0.9, 0, 1) ** 1.5
cor = cor * (1.0 - 0.32 * cav[..., None])

# o banco duro sobressai: a aresta de cima apanha luz, a de baixo faz sombra
# (a pala); o banco mole recua e e mais escuro e mais liso
luz = np.where(frac < 0.08, 1.0 + 0.10 * duro, 1.0)
sombra = np.where(frac > 0.85, 1.0 - 0.22 * duro * (frac - 0.85) / 0.15, 1.0)
cor = cor * (luz * sombra * (0.90 + 0.10 * duro))[..., None]

# ── AS FENDAS ───────────────────────────────────────────────────────────────
# verticais, poucas, atravessam alguns bancos; escuras e com orla clara
fendas = np.zeros((N, N), dtype=np.float32)
for _ in range(9):
    x0 = rng.integers(0, N)
    k0 = rng.integers(0, len(bancos))
    nb = rng.integers(1, 5)
    y0 = bancos[k0][0]
    y1 = min(N, y0 + sum(e for _i, e in bancos[k0:k0 + nb]))
    torto = np.cumsum(rng.normal(0, 0.9, y1 - y0))
    for yy, dx in zip(range(y0, y1), torto):
        xc = int(x0 + dx) % N
        for w, a in ((0, 1.0), (1, 0.6), (-1, 0.6), (2, 0.25), (-2, 0.25)):
            fendas[yy, (xc + w) % N] = max(fendas[yy, (xc + w) % N], a)
cor = cor * (1.0 - 0.55 * fendas[..., None])

# ── O RELEVO ────────────────────────────────────────────────────────────────
alt = (0.55 + 0.45 * duro) - 0.25 * np.clip((frac - 0.8) / 0.2, 0, 1) * duro
alt = alt + 0.06 * grao + 0.04 * risca - 0.5 * fendas - 0.35 * cav - 0.05 * np.clip(desgaste, 0, None)
alt = (alt - alt.min()) / (alt.max() - alt.min())
gy, gx = np.gradient(np.pad(alt, 1, mode="wrap"))
gy, gx = gy[1:-1, 1:-1], gx[1:-1, 1:-1]
forca = 6.0
nx, ny, nz = -gx * forca, gy * forca, np.ones_like(alt)     # convencao OpenGL (verde para cima)
n = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx / n, ny / n, nz / n], -1) * 0.5 + 0.5
rug = 0.80 + 0.15 * (1.0 - duro) + 0.05 * grao

os.makedirs(PARA, exist_ok=True)
Image.fromarray((np.clip(cor, 0, 1) * 255).astype(np.uint8)).save(os.path.join(PARA, "cor.jpg"), quality=92)
Image.fromarray((normal * 255).astype(np.uint8)).save(os.path.join(PARA, "normal.png"))
Image.fromarray((np.clip(rug, 0, 1) * 255).astype(np.uint8)).save(os.path.join(PARA, "rugosidade.png"))
Image.fromarray((alt * 255).astype(np.uint8)).save(os.path.join(PARA, "altura.png"))
print("falesia_algarve: %d bancos num ladrilho de %.0f m -> %s" % (len(bancos), METROS, PARA))
