# rios.py -- o tracado dos rios (F4), pelo relevo, da nascente ao mar.
#
#   python ferramentas/cena/rios.py
#
# O `exportar_mapa.py` chama-o a meio do forno, depois de o relevo da costa
# estar esculpido e antes de a grelha do chao ser feita, com os dados em
# `ferramentas/cena/_rios_dados.npz`. Devolve `ferramentas/cena/_rios.json`: as
# polilinhas, e o forno escava o vale, poe a agua e as pontes.
#
# ── PORQUE (26/09) ──────────────────────────────────────────────────────────
# O mapa nao tinha geografia: colinas de ruido, nada que dissesse "Iberia". As
# montanhas nao cabem (a rede de estradas e densa: davam piramides). Os RIOS
# cabem: correm nos vales que ja ha, dao sentido ao relevo e desenham o mapa
# com uma linha viva. Decisao do Lucas: naturais, SEM NOME, sem imitar os reais,
# e a conviver com as rotas de hoje -- o motor nao sabe deles, e onde cruzam uma
# estrada ha ponte.
#
# ── COMO ─────────────────────────────────────────────────────────────────────
# Cada rio desagua numa praia (a foz e dada). A nascente escolhe-se sozinha: o
# ponto mais ALTO do interior a que se chega da foz por um caminho de 700 a
# 1 400 m. O caminho e o de MENOR CUSTO na grelha do chao (Dijkstra, 8
# vizinhos), com um custo que:
#   * sobe com a altitude -- o rio procura o fundo dos vales;
#   * e proibitivo perto das aldeias -- nenhum rio atravessa uma povoacao;
#   * pesa numa faixa ao LADO das estradas -- o rio cruza uma estrada (ponte),
#     mas nao corre ao longo dela.
# Depois alisa-se a linha e da-se-lhe um serpentear lento: um rio de planicie
# nao anda aos degraus da grelha.
import json
import math
import os

import numpy as np
from scipy import ndimage
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
D = np.load(os.path.join(CENA, "_rios_dados.npz"))
relevo, terra = D["relevo"].astype(np.float64), D["terra"].astype(bool)
LX, LY = (float(v) for v in D["lxly"])
th, tw = relevo.shape
px, py = LX / tw, LY / th
FOZES = D["fozes"]                       # (x, y) de cada foz, em metros
ALD = D["aldeias"]                       # (x, y, raio)
EST = D["estradas"]                      # pontos das estradas, (x, y)
DM = D["dm"].astype(np.float64)           # metros ate a agua

gx = np.arange(tw) * px - LX / 2
gy = LY / 2 - np.arange(th) * py
GX, GY = np.meshgrid(gx, gy)
P = np.stack([GX.ravel(), GY.ravel()], 1)

# ── O CUSTO ─────────────────────────────────────────────────────────────────
zt = relevo[terra]
zn = np.clip((relevo - np.percentile(zt, 2)) / (np.percentile(zt, 98) - np.percentile(zt, 2)), 0, 1)
d_ald = np.full(P.shape[0], 1e9)
for x, y, r in ALD:
    d_ald = np.minimum(d_ald, np.hypot(P[:, 0] - x, P[:, 1] - y) - r)
d_ald = d_ald.reshape(th, tw)
d_est = cKDTree(EST).query(P, workers=-1)[0].reshape(th, tw) if len(EST) else np.full((th, tw), 1e9)
custo = 1.0 + 30.0 * zn ** 1.3
custo += np.where(d_ald < 90.0, 400.0, 0.0)                  # nunca pela aldeia
# ao LADO da estrada custa; em cima dela (a cruzar) custa menos que ao lado
lado_est = (d_est > 12.0) & (d_est < 55.0)
custo += np.where(lado_est, 6.0, 0.0)
custo = np.where(terra, custo, 1e6)                          # nao corre no mar

# grafo de 8 vizinhos, com o custo dado (um por rio: a costa pesa diferente)
idx = np.arange(th * tw).reshape(th, tw)


# ── A AGUA NAO SOBE ──────────────────────────────────────────────────────────
# A 1.a versao era um grafo sem sentido: o rio do norte subiu uma lomba de 58
# para 104 m a meio do caminho, e o nivel da agua (que so desce) cavou ali uma
# garganta de 49 m. O Dijkstra corre DA FOZ para a nascente, portanto cada passo
# tem de SUBIR: descer nesse sentido e o rio a subir -- paga 8 por metro.
ZL = ndimage.gaussian_filter(relevo, 2.0)
SUBIDA = 8.0


def grafo(cst, da_foz=True):
    """`da_foz`: o Dijkstra parte da foz (cada passo SOBE). Senao parte da
    nascente, e cada passo DESCE -- o que paga e o contrario."""
    lin, col, pes = [], [], []
    zf = ZL.ravel()
    for dj, di in ((0, 1), (1, 0), (1, 1), (1, -1)):
        i0_, i1_ = max(0, -di), tw - max(0, di)
        a = idx[0:th - dj, i0_:i1_].ravel()
        b = idx[dj:th, i0_ + di:i1_ + di].ravel()
        w = (cst.ravel()[a] + cst.ravel()[b]) * 0.5 * math.hypot(di * px, dj * py)
        # a -> b (afastar-se da foz): paga se desce
        lin += [a, b]
        col += [b, a]
        sg = 1.0 if da_foz else -1.0
        pes += [w + SUBIDA * np.maximum(0.0, sg * (zf[a] - zf[b])),
                w + SUBIDA * np.maximum(0.0, sg * (zf[b] - zf[a]))]
    return csr_matrix((np.concatenate(pes), (np.concatenate(lin), np.concatenate(col))),
                      shape=(th * tw, th * tw))


def celula(x, y):
    i = int(round((x + LX / 2) / px))
    j = int(round((LY / 2 - y) / py))
    return j, i


def alisar(xs, ys, k, foz, nascente):
    """reamostra a cada 4 m, alisa (~40 m) e da o meandro"""
    # ── ALISAR E SERPENTEAR ──────────────────────────────────────────────
    # reamostra a cada 4 m, alisa (~40 m), e da-lhe um meandro que cresce para
    # jusante (um rio novo e direito, um rio velho serpenteia)
    s = np.concatenate([[0], np.cumsum(np.hypot(np.diff(xs), np.diff(ys)))])
    S = np.arange(0, s[-1], 4.0)
    X = np.interp(S, s, xs)
    Y = np.interp(S, s, ys)
    X = ndimage.gaussian_filter1d(X, 7, mode="nearest")
    Y = ndimage.gaussian_filter1d(Y, 7, mode="nearest")
    tx, ty = np.gradient(X), np.gradient(Y)
    tn = np.hypot(tx, ty) + 1e-9
    nx, ny = -ty / tn, tx / tn
    u = S / S[-1]                                           # 0 nascente .. 1 foz
    amp = 4.0 + 10.0 * u                                    # ate 14 m
    fase = 2 * np.pi * S / (70.0 + 40.0 * u) + k * 1.7
    meandro = amp * np.sin(fase) * np.clip(u * 8, 0, 1) * np.clip((1 - u) * 12, 0, 1)
    X, Y = X + nx * meandro, Y + ny * meandro
    # a meia-largura da agua: 1,5 m na nascente, 7 m na foz
    larg = 1.5 + 5.5 * u ** 0.8
    return {"pts": [[round(float(a), 2), round(float(b), 2)] for a, b in zip(X, Y)],
            "larg": [round(float(v), 2) for v in larg],
            "foz": [float(foz[0]), float(foz[1])],
            "nascente": [float(nascente[0]), float(nascente[1])],
            "comprimento": round(float(S[-1]), 1)}


rios = []
ocupado = np.zeros((th, tw), dtype=bool)                  # dois rios nao se colam
for k, (fx, fy) in enumerate(FOZES):
    j0, i0 = celula(fx, fy)
    # a foz: a celula de terra mais perto do ponto dado, a 1-2 m de altitude
    cand = np.argwhere(terra & (relevo < 3.0) & (relevo > -0.5))
    if not len(cand):
        continue
    dd = np.hypot(cand[:, 0] - j0, cand[:, 1] - i0)
    j0, i0 = cand[int(np.argmin(dd))]
    # ── A COSTA NAO E VALE ──────────────────────────────────────────────
    # A 1.a versao deixou dois rios a correr COLADOS a costa (a faixa de praia e
    # o chao mais baixo que ha): um rio desce do interior e so toca o mar na
    # foz. Perto da agua custa caro, menos nos ultimos 200 m antes desta foz.
    perto_foz = np.hypot(GX - gx[i0], GY - gy[j0]) < 200.0
    cst = custo + np.where((DM < 140.0) & ~perto_foz, 60.0 * (1.0 - DM / 140.0), 0.0)
    # e dois rios nao se atravessam: o corredor dos ja tracados fica caro
    cst = cst + np.where(ocupado & ~perto_foz, 300.0, 0.0)
    dist, pred = dijkstra(grafo(cst), indices=int(idx[j0, i0]), return_predecessors=True)
    dist = dist.reshape(th, tw)
    # comprimento geometrico ate cada celula: aproximado pela distancia em linha
    # reta a foz (o caminho e um pouco mais comprido)
    reta = np.hypot(GX - gx[i0], GY - gy[j0])
    ok = terra & (reta > 650.0) & (reta < 1250.0) & (d_ald > 140.0) & ~ocupado \
        & (dist < np.percentile(dist[terra & np.isfinite(dist)], 60))
    if not ok.any():
        continue
    # a nascente: o ponto ALTO, mas que se alcance pelo vale (custo baixo)
    nota = np.where(ok, relevo - 0.002 * dist, -1e9)
    js, is_ = np.unravel_index(int(np.argmax(nota)), nota.shape)
    # o caminho, da nascente para a foz
    cam = []
    n = int(idx[js, is_])
    while n >= 0 and n != idx[j0, i0]:
        cam.append(n)
        n = pred[n]
    cam.append(int(idx[j0, i0]))
    cj, ci = np.unravel_index(np.array(cam), (th, tw))
    xs, ys = gx[ci], gy[cj]
    rios.append(alisar(xs, ys, k, (gx[i0], gy[j0]), (gx[is_], gy[js])))
    # reserva o corredor (140 m) para o proximo rio nao se colar a este
    for a, b in rios[-1]["pts"][::5]:
        j_, i_ = celula(a, b)
        r = int(70 / px)
        ocupado[max(0, j_ - r):j_ + r, max(0, i_ - r):i_ + r] = True

# ── OS RIOS PROCURADOS ──────────────────────────────────────────────────────
# Dar a nascente e a foz a mao falhou duas vezes: o interior norte esta cercado
# de costa alta, e qualquer rio de la tinha de subir uma lomba (cortes de 38 e
# 49 m -- gargantas). Aqui PROCURA-SE: parte-se de todas as praias ao mesmo
# tempo (Dijkstra de varias origens, a subir), e para cada nascente candidata
# (pontos do interior -- `DM` > 250 m: o campo satura em ~295 m --, de 120 em 120 m) segue-se o caminho ate ao mar e
# MEDE-SE quanto ele teria de subir. Fica o melhor que suba menos de 5 m, tenha
# 600-1 300 m e esteja longe dos rios ja tracados.
N_PROCURADOS = int(D["n_procurados"]) if "n_procurados" in D.files else 0
alvo_foz = terra & (relevo < 2.5) & (DM <= 12.0) & (d_ald > 120.0)
for _ in range(N_PROCURADOS):
    alvos = np.flatnonzero((alvo_foz & ~ocupado).ravel())
    if not len(alvos):
        break
    cst = custo + np.where(ocupado, 300.0, 0.0) + np.where((DM > 20.0) & (DM < 110.0), 8.0, 0.0)
    dist, pred, fonte = dijkstra(grafo(cst), indices=alvos, return_predecessors=True,
                                 min_only=True)
    dist = dist.reshape(th, tw)
    melhor = None
    passo = max(1, int(120.0 / px))
    for jj in range(0, th, passo):
        for ii in range(0, tw, passo):
            if not (terra[jj, ii] and DM[jj, ii] > 250.0 and d_ald[jj, ii] > 140.0
                    and not ocupado[jj, ii] and np.isfinite(dist[jj, ii])):
                continue
            cam = []
            n = int(idx[jj, ii])
            while n >= 0 and len(cam) < 5000:
                cam.append(n)
                n = pred[n]
            cj, ci = np.unravel_index(np.array(cam), (th, tw))
            zz = ZL[cj, ci]
            L = float(np.hypot(np.diff(gx[ci]), np.diff(gy[cj])).sum())
            if not (600.0 < L < 1300.0):
                continue
            sub = float(np.max(np.maximum.accumulate(zz[::-1])[::-1] - zz))   # o maior "dique"
            sobe = float(np.max(zz - np.minimum.accumulate(zz)))
            nota = sobe + 0.02 * (1300.0 - L) - 0.05 * float(zz[0])
            if sobe < 5.0 and (melhor is None or nota < melhor[0]):
                melhor = (nota, cj, ci, sobe, L)
    if melhor is None:
        print("SONDA rios: nenhuma nascente procurada sobe menos de 5 m")
        break
    _, cj, ci = melhor[:3]
    rios.append(alisar(gx[ci], gy[cj], len(rios), (gx[ci[-1]], gy[cj[-1]]), (gx[ci[0]], gy[cj[0]])))
    print("SONDA rios: procurado -- %.0f m, sobe %.1f m" % (melhor[4], melhor[3]))
    for a, b in rios[-1]["pts"][::5]:
        j_, i_ = celula(a, b)
        r = int(70 / px)
        ocupado[max(0, j_ - r):j_ + r, max(0, i_ - r):i_ + r] = True

json.dump(rios, open(os.path.join(CENA, "_rios.json"), "w", encoding="utf-8"))
print("SONDA rios: %d tracados (%s m)" % (len(rios), ", ".join("%.0f" % r["comprimento"] for r in rios)))
