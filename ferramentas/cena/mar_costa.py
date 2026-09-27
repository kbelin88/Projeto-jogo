# mar_costa.py — o que o mar precisa de saber: onde e a costa, e quao fundo e.
#
#   python ferramentas/cena/mar_costa.py
#
# O `exportar_mapa.py` chama-o no fim (o Python do Blender nao traz scipy).
# Tambem corre sozinho, em segundos, sem forno.
#
# ── O QUE SAI (versao 2, 28/09) ──────────────────────────────────────────────
#   sonda3d/mar_costa.png        o retangulo do mapa, ~1,2 m por pixel, RGB:
#       R  distancia a linha de agua, 0-63,75 m em quartos de metro (a espuma)
#       G  profundidade do fundo, 0-64 m, raiz: G = 255*sqrt(p/64) (a cor)
#       B  fundo escuro (rocha, algas), 0-1
#   sonda3d/mar_costa_longe.png  o MESMO, a 6 m por pixel, no plano do mar
#                                inteiro (4x o mapa). O jogo passa de uma a
#                                outra nos ultimos 60 m do retangulo.
#   sonda3d/mar_costa.json       onde fica o pixel (0,0) de cada uma, e o passo
#
# ── PORQUE MUDOU (plano da agua, 27/09) ──────────────────────────────────────
# A versao 1 gravava metros inteiros ate 255, so no retangulo: o degrade fazia-se
# em degraus de 1 m, acabava a seco aos 255 m, e fora do retangulo o shader
# assumia "alto mar" -- onde a costa ficava a menos de 255 m da borda, a cor
# SALTAVA numa linha reta (foto 92101). Agora a distancia vem em quartos de
# metro ate onde a espuma a le, a profundidade nao tem teto a vista (64 m, e a
# cor satura muito antes), e fora do retangulo ha a imagem de longe, feita com
# as MESMAS contas nas coordenadas do mundo -- as duas coincidem na costura.
#
# ── O FUNDO NAO EXISTIA ──────────────────────────────────────────────────────
# A malha do chao acaba poucos metros depois da linha de agua (a praia mergulha
# ate -3,5 m, a margem desce a -18 m) e por baixo do mar nao ha nada. A cor da
# agua vem da PROFUNDIDADE, e nao da distancia: uma falesia tem agua funda a
# 10 m da rocha, uma praia tem agua rasa a 100 m. O fundo inventa-se aqui, a
# partir da costa que o forno fez:
#   * a altura da terra junto a agua diz se a costa e praia ou falesia;
#   * praia: plataforma larga e rasa (a largura varia ao longo da costa);
#   * falesia: uma faixa turquesa estreita, e depois o fundo, com rocha no pe;
#   * manchas escuras: rocha junto as falesias, algas no raso das praias.
#
# ── A MESMA LINHA DE AGUA DA MALHA ───────────────────────────────────────────
# A beira do chao e empurrada para onde o alfa da arte vale LIMIAR (ver
# `encostar` no exportar_mapa.py). Se o mar lesse outra fronteira, a espuma
# ficava a metros da rocha. Por isso: o MESMO alfa, o MESMO limiar, a mascara
# FINAL do forno (com as aldeias carimbadas), e terra so o que fica acima de 0.
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
SAIDA = os.path.join(RAIZ, "sonda3d")

LIMIAR = 110 / 255.0          # exportar_mapa.py, `encostar` -- tem de ser o mesmo
SOBE = 4                      # 4x a grelha do chao: ~1,2 m por pixel
LONGE_M = 6.0                 # passo da imagem de longe
NIVEL_MAR = 0.0               # mapa3d.js: mar.position.y
D_MAX = 63.75                 # R: a distancia so interessa a espuma
P_MAX = 64.0                  # G: profundidade maxima gravada
LX, LY = json.load(open(os.path.join(SAIDA, "mapa3d.json"), encoding="utf-8"))["mapa_m"]

# ── O FUNDO (metros) ─────────────────────────────────────────────────────────
PRAIA_PLAT = (220.0, 520.0)   # largura da plataforma das praias (varia ao longo)
PRAIA_FUNDO = 38.0            # onde a plataforma acaba por chegar
# A falesia do Algarve nao cai logo no azul: ha uma faixa turquesa estreita,
# de areia e rocha, no pe dela. Mais funda e mais curta que a das praias.
FAL_QUEDA = 150.0             # a falesia: ~1/3 do fundo aos 60 m
FAL_PE = 1.5                  # agua ja funda no pe da rocha
FAL_FUNDO = 40.0
FAL_ALTURA = (3.0, 12.0)      # terra a menos disto junto a agua e praia; acima, falesia
FAL_OLHA = 12.0               # quanto para dentro se le a altura da costa


# ── RUIDO NAS COORDENADAS DO MUNDO ───────────────────────────────────────────
# As duas imagens (perto e longe) tem de dar o mesmo fundo no mesmo sitio: o
# ruido e uma funcao do ponto do mundo, nao da grelha.
def _hash(ix, iy, semente):
    h = (ix * 374761393 + iy * 668265263 + semente * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def ruido(x, z, escala, semente, oitavas=3):
    tot, amp, soma = 0.0, 1.0, 0.0
    for o in range(oitavas):
        u, v = x / escala + 17.3 * o, z / escala - 9.1 * o
        iu, iv = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
        fu, fv = u - iu, v - iv
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        s = semente + 101 * o
        a, b = _hash(iu, iv, s), _hash(iu + 1, iv, s)
        c, d = _hash(iu, iv + 1, s), _hash(iu + 1, iv + 1, s)
        tot = tot + amp * ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv)
        soma += amp
        amp *= 0.5
        escala *= 0.5
    return tot / soma


def liso(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def campos(terra, alt, x0, z0, dx, dz):
    """terra (bool), alt (altura da terra, m) numa grelha cujo pixel (I, J) fica
    em x = x0 + I*dx, z = z0 + J*dz. Devolve distancia, profundidade, escuro."""
    dist, (ji, ii) = ndimage.distance_transform_edt(~terra, sampling=(dz, dx),
                                                    return_indices=True)
    # a feicao da costa: a altura da terra nos primeiros FAL_OLHA m, lida no
    # pixel de terra mais perto de cada pixel de agua
    k = max(3, int(round(FAL_OLHA / dx)) | 1)
    alto = ndimage.maximum_filter(np.where(terra, alt, -1e3), size=k)
    fal = liso(*FAL_ALTURA, alto[ji, ii]).astype(np.float32)
    # O vizinho mais perto parte a agua em celulas (Voronoi): onde a praia passa
    # a falesia, a fronteira e uma reta que corre mar fora, e ao largo ficava um
    # raio de cor (medido 28/09). O borrao cresce com a distancia -- 30 m na
    # beira, 400 m ao largo -- e so conta agua (em terra a "altura da costa" e
    # o interior, que e alto em todo o lado).
    agua = (~terra).astype(np.float32)

    def borrao(s):
        s = s / dx
        return (ndimage.gaussian_filter(fal * agua, s)
                / np.maximum(ndimage.gaussian_filter(agua, s), 1e-4))
    f30, f120, f400 = borrao(30.0), borrao(120.0), borrao(400.0)
    fal = np.where(dist < 150, f30 + (f120 - f30) * liso(20.0, 150.0, dist),
                   f120 + (f400 - f120) * liso(150.0, 600.0, dist)).astype(np.float32)
    H, W = terra.shape
    x = (x0 + np.arange(W, dtype=np.float64) * dx)[None, :].repeat(H, 0)
    z = (z0 + np.arange(H, dtype=np.float64) * dz)[:, None].repeat(W, 1)
    n1 = ruido(x, z, 700.0, 1)          # largura da plataforma, ao longo da costa
    n2 = ruido(x, z, 160.0, 2)          # manchas
    n3 = ruido(x, z, 45.0, 3, 2)        # o recorte das manchas
    plat = PRAIA_PLAT[0] + (PRAIA_PLAT[1] - PRAIA_PLAT[0]) * n1
    p_praia = PRAIA_FUNDO * (1 - np.exp(-dist / plat))
    p_fal = FAL_PE * liso(0.0, 6.0, dist) + FAL_FUNDO * (1 - np.exp(-dist / FAL_QUEDA))
    prof = p_praia * (1 - fal) + p_fal * fal
    # ondulacao larga do fundo (bancos de areia, covas): so fora da beira
    prof *= 1.0 + 0.25 * (n2 - 0.5) * liso(15.0, 80.0, dist)
    mancha = liso(0.52, 0.66, n2 * 0.75 + n3 * 0.25)
    rocha = fal * mancha * (1 - liso(60.0, 160.0, dist))
    algas = (1 - fal) * mancha * liso(1.5, 4.0, prof) * (1 - liso(8.0, 14.0, prof))
    escuro = np.clip(np.maximum(rocha, 0.7 * algas), 0, 1) * (~terra)
    prof = np.where(terra, 0.0, prof)
    return dist.astype(np.float32), prof.astype(np.float32), escuro.astype(np.float32)


def gravar(nome, dist, prof, escuro):
    rgb = np.stack([np.clip(np.round(dist / 0.25), 0, 255),
                    np.clip(np.round(255 * np.sqrt(np.clip(prof, 0, P_MAX) / P_MAX)), 0, 255),
                    np.clip(np.round(escuro * 255), 0, 255)], -1).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(os.path.join(SAIDA, nome), optimize=True)


# ── PERTO: o retangulo do mapa ───────────────────────────────────────────────
alfa = np.load(os.path.join(CENA, "_alfa.npy")).astype(np.float32)
fin = os.path.join(CENA, "_terra_final.npy")
terra = np.load(fin if os.path.exists(fin) else os.path.join(CENA, "_terra.npy")).astype(bool)
th, tw = alfa.shape
px, py = LX / tw, LY / th     # exportar_mapa.py: px, py = LX / tw, LY / th

# o vertice (i, j) do chao esta em (i*px - LX/2, LY/2 - j*py). `zoom` com
# order=1 alinha as pontas: o pixel I do grande cai no vertice I*(tw-1)/(W-1).
W, H = (tw - 1) * SOBE + 1, (th - 1) * SOBE + 1
Z = (H / th, W / tw)
dx, dy = px * (tw - 1) / (W - 1), py * (th - 1) / (H - 1)
# ── SEM DEGRAUS (28/09) ──────────────────────────────────────────────────────
# A v1 juntava a mascara ampliada por VIZINHO (celulas de 4,9 m): a costa
# saia em escada, e a espuma com ela. No jogo a beira da malha e empurrada ate
# ao contorno do alfa (`encostar`); aqui le-se o mesmo contorno, liso. Da
# mascara so entram os carimbos das aldeias, que o alfa nao conhece.
terra_g = ndimage.zoom(alfa, Z, order=1) > LIMIAR
ori = os.path.join(CENA, "_terra.npy")
if os.path.exists(fin) and os.path.exists(ori):
    carimbo = terra & ~np.load(ori).astype(bool)
    terra_g |= ndimage.zoom(carimbo.astype(np.float32), Z, order=1) > 0.5

# ── A LINHA DE AGUA E ONDE O CHAO CRUZA O MAR, NAO A BORDA DA MASCARA ────────
# Numa praia a terra mergulha: a malha continua uns metros depois de a areia ja
# estar debaixo de agua. Com o relevo FINAL (o que saiu do forno), terra e so o
# que esta acima do mar. Fora da mascara o relevo nao e chao (ha la valores
# ate 90 m): conta como fundo, para a passagem por zero ficar do lado de dentro.
rel = os.path.join(CENA, "_relevo_final.npy")
if os.path.exists(rel):
    relevo = np.where(terra, np.load(rel).astype(np.float32), -3.0)
    relevo_g = ndimage.zoom(relevo, Z, order=1)
    terra_g &= relevo_g > NIVEL_MAR
else:
    relevo_g = np.where(terra_g, 20.0, 0.0).astype(np.float32)

# mundo do three: x = x do forno, z = -y do forno. O pixel (I, J) fica em
# x = -LX/2 + I*dx, z = -(LY/2 - J*dy) = -LY/2 + J*dy.
x0, z0 = -LX / 2, -LY / 2
dist, prof, escuro = campos(terra_g, relevo_g, x0, z0, dx, dy)
gravar("mar_costa.png", dist, prof, escuro)

# ── LONGE: o plano do mar inteiro (4x o mapa, centrado) ─────────────────────
# A terra so existe dentro do retangulo; a de longe le-a reduzida (um pixel
# grosso e terra se tiver alguma terra), e a altura pelo maximo do bloco.
LW, LH = int(np.ceil(4 * LX / LONGE_M)) + 1, int(np.ceil(4 * LY / LONGE_M)) + 1
lx0, lz0 = -2 * LX, -2 * LY
terra_l = np.zeros((LH, LW), bool)
alt_l = np.zeros((LH, LW), np.float32)
jj, ii = np.nonzero(terra_g)
I = np.round((x0 + ii * dx - lx0) / LONGE_M).astype(int)
J = np.round((z0 + jj * dy - lz0) / LONGE_M).astype(int)
terra_l[J, I] = True
np.maximum.at(alt_l, (J, I), relevo_g[jj, ii])
dist_l, prof_l, escuro_l = campos(terra_l, alt_l, lx0, lz0, LONGE_M, LONGE_M)
gravar("mar_costa_longe.png", dist_l, prof_l, escuro_l)

meta = {"versao": 2,
        "perto": {"W": W, "H": H, "x0": round(x0, 4), "z0": round(z0, 4),
                  "dx": round(dx, 6), "dz": round(dy, 6)},
        "longe": {"W": LW, "H": LH, "x0": round(lx0, 4), "z0": round(lz0, 4),
                  "dx": LONGE_M, "dz": LONGE_M},
        "d_passo": 0.25, "p_max": P_MAX,
        "mascara": "_terra_final.npy" if os.path.exists(fin) else "_terra.npy"}
with open(os.path.join(SAIDA, "mar_costa.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f)

# a costura: nos 60 m de dentro da borda, perto e longe tem de dizer o mesmo
Il = np.clip(np.round((x0 + np.arange(W) * dx - lx0) / LONGE_M).astype(int), 0, LW - 1)
Jl = np.clip(np.round((z0 + np.arange(H) * dy - lz0) / LONGE_M).astype(int), 0, LH - 1)
borda = np.zeros((H, W), bool)
m = int(60 / dx)
borda[:m] = borda[-m:] = True
borda[:, :m] = borda[:, -m:] = True
borda &= ~terra_g & (dist > 30)
dp = np.abs(prof - prof_l[Jl[:, None], Il[None, :]])[borda]
agua = ~terra_g
print("SONDA mar_costa v2: %dx%d a %.2f m/px + longe %dx%d a %.0f m/px; profundidade "
      "mediana %.1f m, rasa (<5 m) %.0f%% da agua, falesia %s; costura perto/longe: "
      "mediana %.2f m, p99 %.2f m (mascara %s)"
      % (W, H, dx, LW, LH, LONGE_M, np.median(prof[agua]), 100 * (prof[agua] < 5).mean(),
         "ok", np.median(dp), np.percentile(dp, 99), meta["mascara"]))
