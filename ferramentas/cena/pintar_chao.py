# pintar_chao.py -- o chao do mapa inteiro, pintado como um mapa de campanha (F1).
#
#   python ferramentas/cena/pintar_chao.py
#
# O `exportar_mapa.py` chama-o no fim do forno, depois de escrever
# `ferramentas/cena/_chao_dados.npz` (o relevo final, a agua, a areia, a mata,
# as aldeias e as estradas). Tambem corre sozinho, em segundos, sem forno.
#
# ── PORQUE (26/09) ──────────────────────────────────────────────────────────
# Os amigos do Lucas viram os videos 1 e 2 e disseram todos o mesmo: o mapa e
# feio, simples, sem graca. A camara de gravacao ve o chao de 600 a 2 000 m, e
# a essa distancia a textura da relva (grao de metros) desaparece: o que se le
# sao MANCHAS DE COR de dezenas a centenas de metros -- e o chao tinha uma so,
# um verde-azeitona de ponta a ponta. A cor de vertice nao a podia mudar: e um
# byte, so escurece.
#
# O estilo pedido e o do mapa de campanha do Total War: realista-pintado. Aqui
# pinta-se, a 1 m por pixel:
#   * os BIOMAS: o norte humido verde, a meseta dourada, o sul ocre e seco;
#   * o RELEVO: vales mais verdes e escuros (ha agua), lombas mais secas e
#     claras, encostas a pique com terra a vista;
#   * o CHAO DA MATA escuro, para os bosques se lerem como massas;
#   * os CAMPOS a volta das aldeias: um mosaico de searas, restolhos, pousios,
#     lavrados e vinhas, com sebes escuras entre eles (e o que diz "aqui vive
#     gente" visto do ar -- no lugar das "fazendinhas" que sairam);
#   * a terra batida a volta das aldeias e a berma pisada das estradas;
#   * a erva de duna a passar para a areia.
# E um segundo mapa, de TIPOS (RGBA = relva, seco, terra, pedra), diz ao shader
# que fotografia de detalhe usar por baixo da cor.
#
# ── O QUE SAI ────────────────────────────────────────────────────────────────
#   sonda3d/chao_cor.jpg    a cor (sRGB), 1 m por pixel, linha 0 = norte
#   sonda3d/chao_tipo.png   os pesos das quatro fotografias de detalhe
#   sonda3d/chao_det_*.jpg  as fotografias de detalhe (copiadas de assets/)
#   sonda3d/chao.json       tamanho, escalas e a media de cada fotografia
import json
import os
import shutil
import time

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree

t0 = time.time()
RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
SAIDA = os.path.join(RAIZ, "sonda3d")
TEX = os.path.join(RAIZ, "assets", "texturas")
RES = 1.0                                    # metros por pixel
rng = np.random.default_rng(26)

D = np.load(os.path.join(CENA, "_chao_dados.npz"))
LX, LY = (float(v) for v in D["lxly"])
relevo, terra = D["relevo"], D["terra"].astype(bool)
th, tw = relevo.shape
px, py = LX / tw, LY / th
W, H = int(np.ceil(LX / RES)), int(np.ceil(LY / RES))

# coordenadas de cada pixel, no mundo (x para leste, y para norte) e na grelha
xs = (np.arange(W, dtype=np.float32) + 0.5) * RES - LX / 2
ys = LY / 2 - (np.arange(H, dtype=np.float32) + 0.5) * RES
gi = (xs + LX / 2) / px                      # coluna da grelha (fracionaria)
gj = (LY / 2 - ys) / py                      # linha da grelha


def subir(a, ordem=1):
    """um campo da grelha do chao (~4,9 m) levado aos pixeis da imagem"""
    J, I = np.meshgrid(gj, gi, indexing="ij")
    return ndimage.map_coordinates(a.astype(np.float32), [J, I], order=ordem, mode="nearest")


def ruido(escala_m, semente):
    """ruido de valor, liso, com manchas de `escala_m` metros (0..1)"""
    r = np.random.default_rng(semente)
    n = max(2, int(np.ceil(max(LX, LY) / escala_m)) + 3)
    g = r.random((n, n)).astype(np.float32)
    J = (np.arange(H, dtype=np.float32) * RES) / escala_m
    I = (np.arange(W, dtype=np.float32) * RES) / escala_m
    JJ, II = np.meshgrid(J, I, indexing="ij")
    return ndimage.map_coordinates(g, [JJ, II], order=3, mode="wrap").clip(0, 1)


def fbm(escalas, semente):
    tot, s = 0.0, 0.0
    for k, (e, peso) in enumerate(escalas):
        tot = tot + ruido(e, semente + k * 17) * peso
        s += peso
    return tot / s


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def cor(*rgb):
    return np.array(rgb, dtype=np.float32) / 255.0


def misturar(base, alvo, peso):
    """base (H,W,3) para alvo (3,) ou (H,W,3), por peso (H,W)"""
    p = peso[..., None]
    return base * (1 - p) + alvo * p


# ── OS CAMPOS DE BASE ────────────────────────────────────────────────────────
Z = subir(relevo)
TERRA = subir(terra.astype(np.float32)) > 0.5
DM = subir(D["dm"])
AREIA = subir(D["areia"])
HUM = subir(ndimage.gaussian_filter(D["prado"], 3.0))          # 0 seco .. 1 humido
gy_, gx_ = np.gradient(Z, RES)
DECL = np.degrees(np.arctan(np.hypot(gx_, gy_)))
# concavidade: o fundo de vale fica ABAIXO da vizinhanca (positivo), a lomba acima
CONC = ndimage.gaussian_filter(Z, 45.0 / RES) - Z
CONC_FINA = ndimage.gaussian_filter(Z, 6.0 / RES) - Z

# ── A PALETA (sRGB): a Iberia de fim de verao, vista do alto ────────────────
VERDE_HUMIDO = cor(62, 86, 36)
VERDE_OLIVA = cor(98, 104, 46)
DOURADO = cor(158, 128, 62)
PALHA = cor(176, 150, 88)
OCRE = cor(150, 104, 58)
TERRA_VIVA = cor(128, 88, 56)
TERRA_ESCURA = cor(92, 66, 44)
MATA_CHAO = cor(48, 58, 30)
SEBE = cor(58, 66, 34)
DUNA = cor(196, 178, 128)
PEDRA = cor(150, 138, 118)

# 1. o bioma: a humidade da ilha, esticada (o campo cru e estreito a volta
#    de 0,5), com manchas grandes a partir-lhe a regularidade
m_grande = fbm([(700, 0.6), (260, 0.4)], 1)
h = np.clip((HUM - 0.5) * 2.2 + 0.5 + (m_grande - 0.5) * 0.55, 0, 1)
base = np.where((h < 0.5)[..., None],
                misturar(np.broadcast_to(PALHA, (H, W, 3)).copy(), DOURADO, smooth(0.0, 0.5, h)),
                misturar(np.broadcast_to(VERDE_OLIVA, (H, W, 3)).copy(), VERDE_HUMIDO, smooth(0.5, 1.0, h)))
base = np.where((h >= 0.3)[..., None] & (h < 0.7)[..., None],
                misturar(base, VERDE_OLIVA, 0.55 * (1 - np.abs(h - 0.5) / 0.2).clip(0, 1)), base)
# o sul ocre: onde e muito seco, a terra vermelha aparece pelas manchas
m_ocre = fbm([(180, 0.6), (60, 0.4)], 5)
base = misturar(base, OCRE, 0.55 * smooth(0.35, 0.0, h) * smooth(0.45, 0.75, m_ocre))
# mato mais escuro e erva mais seca em manchas medias (centenas de metros)
m_media = fbm([(140, 0.5), (55, 0.3), (20, 0.2)], 9)
base = misturar(base, VERDE_OLIVA * 0.82, 0.35 * smooth(0.55, 0.85, m_media))
base = misturar(base, PALHA, 0.30 * smooth(0.45, 0.15, m_media))

# 2. o relevo pinta
vale = smooth(0.5, 6.0, CONC)
lomba = smooth(-0.5, -6.0, CONC)
base = misturar(base, VERDE_HUMIDO * 0.9, 0.55 * vale)
base = misturar(base, PALHA * 1.02, 0.30 * lomba)
ingreme = smooth(20.0, 38.0, DECL)
base = misturar(base, TERRA_VIVA, 0.55 * ingreme)
base = misturar(base, PEDRA, 0.45 * smooth(34.0, 55.0, DECL))
# oclusao das dobras finas: escurece so o fundo das pregas
base = base * (1.0 - 0.18 * smooth(0.3, 2.5, CONC_FINA))[..., None]

# 3. o chao da mata: os bosques leem-se como MASSAS escuras
mata = np.zeros((H, W), dtype=np.float32)
if len(D["mata"]):
    im = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(im)
    for linha in D["mata"]:
        x, y, r = linha[:3]
        # a densidade do bioma (F2): o montado e pasto com arvores soltas -- o
        # chao por baixo nao escurece como numa mata cerrada
        dens = float(linha[3]) if len(linha) > 3 else 1.0
        u, v = (x + LX / 2) / RES, (LY / 2 - y) / RES
        rr = (r * 1.05 + 4.0) / RES
        dr.ellipse([u - rr, v - rr, u + rr, v + rr], fill=int(255 * dens))
    mata = ndimage.gaussian_filter(np.asarray(im, dtype=np.float32) / 255.0, 7.0 / RES)
    mata = mata * (0.75 + 0.5 * ruido(25, 31))
base = misturar(base, MATA_CHAO, 0.78 * np.clip(mata, 0, 1))

# 3b. as margens dos RIOS (F4): lodo humido rente a agua, e uma faixa verde
#     de margem (ha agua o ano inteiro: e o que desenha o rio visto do ar)
margem = np.zeros((H, W), dtype=np.float32)
lodo = np.zeros((H, W), dtype=np.float32)
_fr = os.path.join(CENA, "_rios.json")
if os.path.exists(_fr):
    rios = json.load(open(_fr, encoding="utf-8"))
    im_m = Image.new("L", (W, H), 0)
    im_l = Image.new("L", (W, H), 0)
    dm_, dl_ = ImageDraw.Draw(im_m), ImageDraw.Draw(im_l)
    for r in rios:
        pts = [((x + LX / 2) / RES, (LY / 2 - y) / RES) for x, y in r["pts"]]
        for (p0, p1), w in zip(zip(pts[:-1], pts[1:]), r["larg"][:-1]):
            dm_.line([p0, p1], fill=255, width=int(2 * (w + 26) / RES))
            dl_.line([p0, p1], fill=255, width=int(2 * (w + 3.5) / RES))
    margem = ndimage.gaussian_filter(np.asarray(im_m, dtype=np.float32) / 255.0, 9.0 / RES)
    margem *= 0.7 + 0.3 * ruido(20, 81)
    lodo = ndimage.gaussian_filter(np.asarray(im_l, dtype=np.float32) / 255.0, 1.5 / RES)
    base = misturar(base, VERDE_HUMIDO * 0.95, 0.65 * margem)
    base = misturar(base, cor(96, 84, 60), 0.8 * lodo)

# 4. os CAMPOS: mosaico de parcelas a volta das aldeias
ald = D["aldeias"]
dist_ald = np.full((H, W), 1e9, dtype=np.float32)
XX, YY = np.meshgrid(xs, ys)
for x, y, r in ald:
    dist_ald = np.minimum(dist_ald, np.hypot(XX - x, YY - y) - r)
# ── AS PARCELAS SAIRAM (26/09) ─────────────────────────────────────────────
# O Lucas gostou das cores e nao dos campos: "nao gosto dessas fazendas, desses
# quadrados todos". O mosaico fica GUARDADO atras de `PARCELAS=1`; sem ele o
# chao e so bioma, relevo e mata -- e o shader nao desenha sulcos (forca 0).
PARCELAS = os.environ.get("PARCELAS") == "1"
if PARCELAS:
    # ── AS PARCELAS SAO FAIXAS RETANGULARES, EM BLOCOS ─────────────────────────
    # A 1.a versao (Voronoi de 68 m) lia-se como um vitral; a 2.a (Voronoi
    # esticado) dava losangos. O campo antigo da Peninsula e de FOLHAS: faixas
    # retangulares, compridas e estreitas, com o mesmo rumo dentro de um bloco e as
    # pontas desencontradas de faixa para faixa. Aqui e uma grelha RODADA por bloco
    # (rumo, largura e comprimento do bloco), com cada faixa deslocada ao acaso.
    BLOCO = 300.0
    bx = np.arange(-LX / 2, LX / 2 + BLOCO, BLOCO)
    by = np.arange(-LY / 2, LY / 2 + BLOCO, BLOCO)
    BX, BY = np.meshgrid(bx, by)
    sem_b = np.stack([BX.ravel() + (rng.random(BX.size) - 0.5) * BLOCO * 0.8,
                      BY.ravel() + (rng.random(BX.size) - 0.5) * BLOCO * 0.8], 1)
    nb = len(sem_b)
    ang_b = rng.random(nb) * np.pi
    larg_b = 18.0 + rng.random(nb) * 16.0               # 18-34 m de largura
    comp_b = 55.0 + rng.random(nb) * 70.0               # 55-125 m de comprido
    PXY = np.stack([XX.ravel(), YY.ravel()], 1)
    db, ib = cKDTree(sem_b).query(PXY, k=2, workers=-1)
    bloco = ib[:, 0]
    borda_bloco = (db[:, 1] - db[:, 0]) * 0.5            # metros ate a fronteira
    a_ = ang_b[bloco]
    U = PXY[:, 0] * np.cos(a_) + PXY[:, 1] * np.sin(a_)
    V = -PXY[:, 0] * np.sin(a_) + PXY[:, 1] * np.cos(a_)
    iv = np.floor(V / larg_b[bloco]).astype(np.int64)
    # cada faixa desloca o seu corte transversal (as pontas nao alinham)
    desl = ((iv * 7919 + bloco * 104729) % 1000) / 1000.0 * comp_b[bloco]
    uu = (U + desl) / comp_b[bloco]
    iu = np.floor(uu).astype(np.int64)
    fv = V / larg_b[bloco] - iv
    fu = uu - iu
    borda = np.minimum(np.minimum(fv, 1 - fv) * larg_b[bloco],
                       np.minimum(fu, 1 - fu) * comp_b[bloco])
    borda = np.minimum(borda, borda_bloco).astype(np.float32).reshape(H, W)
    # identificador da parcela e a sua "semente" (o centro), para as escolhas
    chave = (bloco * 1000003 + iv * 7727 + iu) & 0x7FFFFFFF
    cel_u, cel = np.unique(chave, return_inverse=True)
    cel = cel.reshape(H, W)
    ns = len(cel_u)
    cnt = np.bincount(cel.ravel(), minlength=ns).astype(np.float64)
    sem = np.stack([np.bincount(cel.ravel(), weights=PXY[:, 0], minlength=ns) / np.maximum(cnt, 1),
                    np.bincount(cel.ravel(), weights=PXY[:, 1], minlength=ns) / np.maximum(cnt, 1)], 1)
    ang_sem = np.bincount(cel.ravel(), weights=a_, minlength=ns) / np.maximum(cnt, 1)
    del U, V, iv, iu, fv, fu, uu, desl, chave, a_
    tipo_cel = rng.integers(0, 6, ns)                       # a cultura de cada parcela
    ang_cel = ang_sem
    luz_cel = 0.90 + rng.random(ns) * 0.18
    sorte_cel = rng.random(ns)
    # e campo onde: perto de aldeia (probabilidade a cair ate ~420 m), chao manso,
    # fora da mata, da areia e das margens da agua
    sj = np.clip(((LY / 2 - sem[:, 1]) / RES).astype(int), 0, H - 1)
    si = np.clip(((sem[:, 0] + LX / 2) / RES).astype(int), 0, W - 1)
    prob = smooth(430.0, 40.0, dist_ald[sj, si]) * 0.92
    eh_campo_cel = (sorte_cel < prob) & (DECL[sj, si] < 13.0) & (mata[sj, si] < 0.2) \
        & (AREIA[sj, si] < 0.1) & (DM[sj, si] > 25.0) & TERRA[sj, si]
    campo = eh_campo_cel[cel] & (mata < 0.35) & (DECL < 17.0) & (AREIA < 0.2)
    CULTURAS = np.stack([cor(186, 150, 70),     # 0 seara madura
                         cor(192, 166, 104),    # 1 restolho
                         cor(104, 116, 50),     # 2 pousio verde
                         cor(108, 76, 50),      # 3 lavrado
                         cor(86, 88, 44),       # 4 vinha
                         cor(146, 134, 68)])    # 5 prado de feno
    cc = CULTURAS[tipo_cel[cel]] * luz_cel[cel][..., None]
    # os sulcos: riscas de 2,5 a 4 m, na direcao de cada parcela (fortes no lavrado
    # e na vinha, subtis na seara)
    a = ang_cel[cel]
    forca_risca = np.choose(tipo_cel[cel], [0.06, 0.05, 0.02, 0.16, 0.22, 0.03]).astype(np.float32)
    # ⚠ os sulcos NAO se cozem: a 1 m por pixel, riscas de 2,6 m saiam em escada
    # e desfocadas de perto (visto a 26/09). Vai o rumo, a forca e o passo para o
    # `chao_campo.png`, e o shader desenha-os nitidos a qualquer distancia.
    # o campo desvanece na orla (nao ha parcela a meio de um vale ingreme)
    p_campo = campo.astype(np.float32) * smooth(17.0, 9.0, DECL)
    p_campo = ndimage.gaussian_filter(p_campo, 1.2)
    base = misturar(base, cc, 0.88 * p_campo)
    # as sebes: linhas escuras entre parcelas, so onde ha campo de um dos lados
    sebe = smooth(2.2, 0.4, borda) * np.clip(ndimage.maximum_filter(p_campo, 5), 0, 1)
    sebe = sebe * smooth(0.35, 0.65, ruido(40, 41)) * (0.6 + 0.4 * ruido(9, 43))
    base = misturar(base, SEBE, 0.55 * sebe)

else:
    p_campo = np.zeros((H, W), dtype=np.float32)
    cel = np.zeros((H, W), dtype=np.int64)
    tipo_cel = np.zeros(1, dtype=np.int64)
    ang_cel = np.zeros(1)
    forca_risca = np.zeros((H, W), dtype=np.float32)

# 5. terra batida a volta das aldeias, e a berma pisada das estradas
eira = smooth(28.0, 4.0, dist_ald) * (0.7 + 0.3 * ruido(9, 51))
base = misturar(base, cor(156, 124, 84), 0.75 * eira)
est = D["estradas"]
im = Image.new("L", (W, H), 0)
dr = ImageDraw.Draw(im)
for k in np.unique(est[:, 0]):
    pts = est[est[:, 0] == k][:, 1:3]
    uv = [((x + LX / 2) / RES, (LY / 2 - y) / RES) for x, y in pts]
    if len(uv) > 1:
        dr.line(uv, fill=255, width=int(20 / RES))
berma = ndimage.gaussian_filter(np.asarray(im, dtype=np.float32) / 255.0, 4.0 / RES)
berma = berma * (0.6 + 0.4 * ruido(15, 61))
base = misturar(base, cor(168, 146, 98), 0.45 * berma)

# 6. a duna: a erva seca e clara a passar para a areia
duna = np.clip(AREIA * 1.6, 0, 1) * smooth(90.0, 20.0, DM) * smooth(16.0, 3.0, Z)
base = misturar(base, DUNA, 0.8 * duna)

# 7. o grao fino: nenhum pixel e igual ao vizinho (de perto a relva respira)
grao = fbm([(6, 0.5), (2.5, 0.5)], 71)
base = base * (0.94 + 0.12 * grao)[..., None]
base = np.clip(base, 0, 1)

# ── O MAPA DE TIPOS: que fotografia de detalhe vai por baixo ────────────────
w_relva = np.clip(h * 0.9 + vale * 0.5 + mata * 0.6 + margem, 0, None)
w_seco = np.clip((1 - h) * 0.9 + lomba * 0.4, 0, None)
w_terra = np.clip(ingreme * 0.8 + eira + berma * 0.5 + mata * 0.3, 0, None)
w_pedra = np.clip(smooth(30.0, 50.0, DECL) * 1.2, 0, None)
# nos campos, a fotografia e a da cultura
t = tipo_cel[cel]
w_relva = np.where(p_campo > 0.5, np.isin(t, [2, 4]).astype(np.float32) * 0.8 + 0.2, w_relva)
w_seco = np.where(p_campo > 0.5, np.isin(t, [0, 1, 5]).astype(np.float32), w_seco)
w_terra = np.where(p_campo > 0.5, np.isin(t, [3, 4]).astype(np.float32), w_terra)
soma = w_relva + w_seco + w_terra + w_pedra + 1e-4
TIPO = np.stack([w_relva, w_seco, w_terra, w_pedra], -1) / soma[..., None]

# ── OS SULCOS (para o shader) ────────────────────────────────────────────────
em_campo = p_campo > 0.5
periodo = np.where(tipo_cel[cel] == 4, 4.0, 2.6)
CAMPO = np.stack([
    (np.mod(ang_cel[cel], np.pi) / np.pi * 255.0),                 # o rumo
    np.where(em_campo, forca_risca / 0.25 * 255.0, 0.0),            # a forca
    periodo * 40.0], -1).clip(0, 255)

# ── GRAVAR ──────────────────────────────────────────────────────────────────
Image.fromarray(CAMPO.round().astype(np.uint8), "RGB").save(os.path.join(SAIDA, "chao_campo.png"))
Image.fromarray((base * 255).round().astype(np.uint8), "RGB").save(
    os.path.join(SAIDA, "chao_cor.jpg"), quality=92)
Image.fromarray((TIPO * 255).round().astype(np.uint8), "RGBA").save(
    os.path.join(SAIDA, "chao_tipo.png"))

# as fotografias de detalhe: (nome, pasta, metros por ladrilho)
# (27/09) as tres primeiras sao do Poly Haven (CC0, 2K): leafy_grass,
# dry_ground_rocks e rocky_trail_02 -- mais grao e mais relevo do que as antigas
# ⚠ a 3-4 m por ladrilho via-se uma quadricula fina na relva de perto: 6-8 m
# (27/09, 2.a) relva e erva seca PINTADAS (SDXL no ComfyUI): gen_relva, gen_seco
DETALHE = [("relva", "gen_relva", 11.0), ("seco", "gen_seco", 15.0),
           ("terra", "ph_rocky_trail_02", 6.0), ("pedra", "penedo", 8.0)]
medias = {}
for nome, pasta, _m in DETALHE:
    for tipo_f in ("cor.jpg", "normal.png"):
        o = os.path.join(TEX, pasta, tipo_f)
        if os.path.exists(o):
            shutil.copyfile(o, os.path.join(SAIDA, "chao_det_%s_%s" % (nome, tipo_f)))
    a_ = np.asarray(Image.open(os.path.join(TEX, pasta, "cor.jpg")).convert("RGB"),
                    dtype=np.float32) / 255.0
    lin = np.where(a_ <= 0.04045, a_ / 12.92, ((a_ + 0.055) / 1.055) ** 2.4)
    medias[nome] = [round(float(v), 5) for v in lin.reshape(-1, 3).mean(0)]
# as fotografias das estradas (F3): a terra batida e a calcada da estrada real
# (27/09, 3.a) as faixas de superficie de cada tipo de estrada
import subprocess as _sp                                        # noqa: E402
_fx = _sp.run(["python", os.path.join("ferramentas", "cena", "faixas_estrada.py")],
              capture_output=True, text=True)
print((_fx.stdout or "").strip() if _fx.returncode == 0
      else "SONDA AVISO faixas_estrada falhou: " + (_fx.stderr or "")[-400:])
# (27/09) Poly Haven: dirt_aerial_02 (terra com rodados, vista do ar) e
# cobblestone_large_01 (a calcada)
for nome, pasta in (("terra", "ph_dirt_aerial_02"), ("calcada", "ph_cobblestone_large_01")):
    shutil.copyfile(os.path.join(TEX, pasta, "cor.jpg"), os.path.join(SAIDA, "estrada_%s.jpg" % nome))
    a_ = np.asarray(Image.open(os.path.join(TEX, pasta, "cor.jpg")).convert("RGB"),
                    dtype=np.float32) / 255.0
    lin = np.where(a_ <= 0.04045, a_ / 12.92, ((a_ + 0.055) / 1.055) ** 2.4)
    medias["estrada_" + nome] = [round(float(v), 5) for v in lin.reshape(-1, 3).mean(0)]
json.dump({"W": W, "H": H, "res": RES, "LX": LX, "LY": LY,
           "detalhe": [{"nome": n, "metros": m, "media": medias[n]} for n, _p, m in DETALHE],
           "estrada": {"terra": medias["estrada_terra"], "calcada": medias["estrada_calcada"]}},
          open(os.path.join(SAIDA, "chao.json"), "w", encoding="utf-8"), indent=1)
print("SONDA chao pintado: %dx%d px (%.1f m/px), %.0f%% da terra em campos, "
      "%.0f%% em chao de mata, em %.1f s"
      % (W, H, RES, 100 * float((p_campo > 0.5)[TERRA].mean()),
         100 * float((mata > 0.5)[TERRA].mean()), time.time() - t0))
