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
import sys
import shutil
import time

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree

t0 = time.time()
RAIZ = os.getcwd()
CENA = os.path.join(RAIZ, "ferramentas", "cena")
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mapa_ativo as M                                     # noqa: E402  (QUE mapa: MAPA=usa)
SAIDA = M.SAIDA
TEX = os.path.join(RAIZ, "assets", "texturas")
RES = 1.0                                    # metros por pixel
rng = np.random.default_rng(26)

D = np.load(M.cena("_chao_dados.npz"))
LX, LY = (float(v) for v in D["lxly"])
relevo, terra = D["relevo"], D["terra"].astype(bool)
th, tw = relevo.shape
px, py = LX / tw, LY / th
W, H = int(np.ceil(LX / RES)), int(np.ceil(LY / RES))

# ── POR FAIXAS, NO 2.o MAPA (12/11) ─────────────────────────────────────────
# O mapa dos EUA sao 20 milhoes de pixeis e cada campo de trabalho 75 MB; a
# pintura inteira pedia ~3 GB e a maquina tem 7,7 GB com o resto aberto. Caiu
# sem memoria dentro do forno tres vezes seguidas, e depois fora dele. Agora o
# 2.o mapa pinta-se em faixas horizontais, cada uma num processo seu (com 200
# linhas de margem acima e abaixo: o filtro mais largo, o da concavidade, alcanca
# 180), e no fim cosem-se. A Iberia pinta-se de uma vez, como sempre.
H_TOT, ROW0 = H, 0
_BANDA = os.environ.get("PINTAR_BANDA")           # "r0,r1": so o processo de uma faixa o traz
N_BANDAS = 1 if M.IBERIA else int(os.environ.get("PINTAR_BANDAS", "6"))
MARGEM_B = 200
if _BANDA:
    _r0, _r1 = (int(v) for v in _BANDA.split(","))
    ROW0 = max(_r0 - MARGEM_B, 0)
    H = min(_r1 + MARGEM_B, H_TOT) - ROW0

# coordenadas de cada pixel, no mundo (x para leste, y para norte) e na grelha
xs = (np.arange(W, dtype=np.float32) + 0.5) * RES - LX / 2
ys = LY / 2 - (np.arange(H, dtype=np.float32) + ROW0 + 0.5) * RES
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
    J = ((np.arange(H, dtype=np.float32) + ROW0) * RES) / escala_m
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


def cauda(est):
    """o que nao depende dos pixeis: as fotografias de detalhe, o `chao.json` e o relato"""
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
        # ── SO O GRAO, SEM AS MANCHAS (27/09) ──────────────────────────────────
        # As texturas pintadas (gen_*) tem tufos e manchas de 1/4 do ladrilho; ao
        # repetir, formam uma GRELHA que se ve ao longe ("quadrados colados", marca
        # do Lucas no sul arido). Passa-alto: divide-se pela versao borrada (1/20
        # do lado) -- ficam as folhas e o grao; a variacao grande e da pintura do
        # mapa, que nao se repete.
        if pasta.startswith("gen_"):
            a_ = np.asarray(Image.open(os.path.join(TEX, pasta, "cor.jpg")).convert("RGB"), dtype=np.float32) / 255.0
            lin = np.where(a_ <= 0.04045, a_ / 12.92, ((a_ + 0.055) / 1.055) ** 2.4)
            sig = lin.shape[0] / 20.0
            borr = np.stack([ndimage.gaussian_filter(lin[..., k], sig, mode="wrap") for k in range(3)], -1)
            hp = lin / np.maximum(borr, 1e-4) * lin.reshape(-1, 3).mean(0)
            hp = np.clip(hp, 0, 1)
            srgb = np.where(hp <= 0.0031308, hp * 12.92, 1.055 * np.power(hp, 1 / 2.4) - 0.055)
            Image.fromarray((srgb * 255).round().astype(np.uint8)).save(
                os.path.join(SAIDA, "chao_det_%s_cor.jpg" % nome), quality=92)
        a_ = np.asarray(Image.open(os.path.join(SAIDA, "chao_det_%s_cor.jpg" % nome)).convert("RGB"),
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
    _meta = {"W": W, "H": H_TOT, "res": RES, "LX": LX, "LY": LY,
             "detalhe": [{"nome": n, "metros": m, "media": medias[n]} for n, _p, m in DETALHE],
             "estrada": {"terra": medias["estrada_terra"], "calcada": medias["estrada_calcada"]}}
    if SERRAS:
        # o `mapa3d.js` le isto: pedra pelos tres eixos e neve sem grao (a Iberia nao leva a chave)
        _meta["serras"] = True
    json.dump(_meta, open(os.path.join(SAIDA, "chao.json"), "w", encoding="utf-8"), indent=1)
    if SERRAS:
        print("SONDA serras: rocha %.1f%% da terra, cascalho %.1f%%, neve %.2f%% (linha a %.2f do cume aos 33 N)"
              % (est["rocha"], est["cascalho"], est["neve"], float(os.environ.get("LINHA_NEVE", "0.44"))))
    print("SONDA chao pintado: %dx%d px (%.1f m/px), %.0f%% da terra em campos, "
          "%.0f%% em chao de mata, em %.1f s"
          % (W, H_TOT, RES, est["campo"], est["mata"], time.time() - t0))


def guardar(nome, arr8, modo, ficheiro, **kw):
    """grava a imagem -- ou, numa faixa, so as linhas dela, para o processo-pai coser"""
    if _BANDA:
        np.save(os.environ["PINTAR_PARTE"] + "_" + nome + ".npy", arr8[_r0 - ROW0:_r1 - ROW0])
    else:
        Image.fromarray(arr8, modo).save(os.path.join(SAIDA, ficheiro), **kw)


SERRAS = (not M.IBERIA) and os.path.exists(M.cena("_serra.npy"))
if not _BANDA and N_BANDAS > 1:
    import subprocess as _spb                                    # noqa: E402
    _pasta = M.cena("_bandas")
    os.makedirs(_pasta, exist_ok=True)
    _cortes = [int(round(H_TOT * k / N_BANDAS)) for k in range(N_BANDAS + 1)]
    _tot = {}
    for k in range(N_BANDAS):
        _amb = dict(os.environ, PINTAR_BANDA="%d,%d" % (_cortes[k], _cortes[k + 1]),
                    PINTAR_PARTE=os.path.join(_pasta, "b%d" % k))
        _r = _spb.run([sys.executable, os.path.abspath(__file__)], env=_amb, capture_output=True, text=True)
        _linha = [l for l in (_r.stdout or "").splitlines() if l.startswith("BANDA ")]
        if _r.returncode != 0 or not _linha:
            sys.exit("pintar_chao: a faixa %d falhou: %s" % (k, (_r.stderr or "")[-700:]))
        for _n, _v in json.loads(_linha[-1][6:]).items():
            _tot[_n] = _tot.get(_n, 0) + _v
    for _nome, _modo, _fich, _kw in (("cor", "RGB", "chao_cor.jpg", {"quality": 92}),
                                     ("tipo", "RGBA", "chao_tipo.png", {}),
                                     ("campo", "RGB", "chao_campo.png", {})):
        _partes = [os.path.join(_pasta, "b%d_%s.npy" % (k, _nome)) for k in range(N_BANDAS)]
        _img = np.concatenate([np.load(f_) for f_ in _partes], axis=0)
        assert _img.shape[:2] == (H_TOT, W), _img.shape
        Image.fromarray(_img, _modo).save(os.path.join(SAIDA, _fich), **_kw)
        del _img
        for f_ in _partes:
            os.remove(f_)
    _t = max(_tot.get("terra", 0), 1)
    cauda({n_: 100.0 * _tot.get(n_, 0) / _t for n_ in ("campo", "mata", "rocha", "cascalho", "neve")})
    sys.exit(0)


# ── OS CAMPOS DE BASE ────────────────────────────────────────────────────────
Z = subir(relevo)
TERRA = subir(terra.astype(np.float32)) > 0.5
DM = subir(D["dm"])
AREIA = subir(D["areia"])
HUM = subir(ndimage.gaussian_filter(D["prado"], 3.0))          # 0 seco .. 1 humido
gy_, gx_ = np.gradient(Z, RES)
DECL = np.degrees(np.arctan(np.hypot(gx_, gy_)))
del gy_, gx_          # (12/11) 150 MB no 2.o mapa, e a pintura ja caiu sem memoria: larga-se o que nao volta a ser lido
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
del m_grande, m_ocre, m_media

# 1b. OS BIOMAS DO 2.o MAPA (M3, 12/11) -------------------------------------------
# A paleta de cima e a Iberia de fim de verao. Nos EUA o chao e de doze biomas
# com pesos suaves (`biomas_usa.py`, da chuva real), e cada um traz as suas duas
# ou tres cores, misturadas por manchas de centenas de metros. O outono do
# Nordeste pinta-se ja no chao como copa (vermelho, laranja, amarelo): de longe
# e o que se le, e as arvores (fase 3 da M3) assentam por cima da mesma cor.
# Um bioma de cada vez: doze pesos a 20 M de pixeis eram 1 GB.
BIOMAS_USA = (not M.IBERIA) and os.path.exists(M.cena("_biomas.npz"))
if BIOMAS_USA:
    PALETA_BIOMA = {
        "pacifico":   [cor(36, 54, 30), cor(52, 70, 38), cor(70, 82, 46)],
        "california": [cor(184, 152, 84), cor(160, 128, 68), cor(92, 94, 50)],
        "coniferas":  [cor(60, 72, 40), cor(84, 84, 52), cor(110, 100, 70)],
        "sonora":     [cor(176, 122, 76), cor(150, 98, 62), cor(128, 112, 70)],
        "mojave":     [cor(208, 184, 142), cor(188, 162, 120), cor(150, 140, 100)],
        "bacia":      [cor(150, 148, 112), cor(128, 126, 96), cor(170, 158, 120)],
        "pradaria":   [cor(172, 156, 82), cor(128, 134, 64), cor(196, 172, 96)],
        "outono":     [cor(112, 74, 42), cor(138, 92, 46), cor(150, 118, 56)],   # chao de folhas: a cor viva e das copas (fase 3)
        "caduca":     [cor(60, 94, 38), cor(80, 110, 46), cor(98, 118, 56)],
        "sudeste":    [cor(66, 92, 42), cor(84, 104, 48), cor(120, 98, 62)],
        "florida":    [cor(96, 140, 60), cor(122, 150, 70), cor(190, 180, 130)],
        "alpino":     [cor(122, 120, 92), cor(140, 132, 100), cor(104, 104, 84)],
    }
    _bz = np.load(M.cena("_biomas.npz"))
    m1 = fbm([(320, 0.5), (110, 0.3), (40, 0.2)], 141)        # a mistura das duas primeiras
    m2 = smooth(0.58, 0.80, fbm([(200, 0.6), (70, 0.4)], 157))  # manchas da terceira
    nova = np.zeros((H, W, 3), dtype=np.float32)
    tot_b = np.zeros((H, W), dtype=np.float32)
    for _nome, (_a, _b, _c) in PALETA_BIOMA.items():
        _w = np.clip(subir(_bz[_nome].astype(np.float32)), 0, 1)
        if float(_w.max()) < 1e-3:
            continue
        for k_ in range(3):
            _cc = _a[k_] + (_b[k_] - _a[k_]) * m1
            _cc = _cc + (_c[k_] - _cc) * m2
            nova[..., k_] += _w * _cc
        tot_b += _w
        del _w
    # onde nao ha peso (o mar, a beira) fica a paleta de cima
    for k_ in range(3):
        base[..., k_] = base[..., k_] + (nova[..., k_] - base[..., k_]) * np.clip(tot_b, 0, 1)
    del nova, tot_b, m1, m2, _bz

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

# 2b. AS SERRAS do 2.o mapa (M2, 11/11): rocha, cascalho, tundra e mata de encosta
# ── PORQUE ──────────────────────────────────────────────────────────────────
# Na Iberia nao ha montanha: o passo 2 poe um pouco de terra e de pedra nas
# encostas e chega. Nos EUA as serras tem 200-300 m e eram cones de relva. Uma
# serra le-se por ANDARES, de baixo para cima: mata escura na encosta humida
# (ou mato seco no Oeste), a linha das arvores, erva rala de altitude, cascalho,
# rocha nas paredes, neve. E a rocha nao e de uma cor so no pais inteiro:
# granito cinzento nas Rochosas e na Sierra, arenito vermelho no sudoeste seco,
# xisto escuro nos Apalaches.
# Tudo decidido AO PIXEL (1 m), com ruido nos limiares: nenhuma fronteira tem a
# forma da grelha de 4,9 m nem de uma curva de nivel limpa.
SERRAS = (not M.IBERIA) and os.path.exists(M.cena("_serra.npy"))
neve = np.zeros((H, W), dtype=np.float32)
rocha_w = np.zeros((H, W), dtype=np.float32)
cascalho = np.zeros((H, W), dtype=np.float32)
floresta = np.zeros((H, W), dtype=np.float32)
if SERRAS:
    def misturar_ja(alvo_, peso_):
        """como `misturar`, mas NO SITIO e canal a canal: a 20 milhoes de pixeis cada
        copia de (H, W, 3) sao 225 MB, e a maquina tem 7,7 GB (a pintura ja caiu aqui)"""
        for k_ in range(3):
            a_k = alvo_[..., k_] if getattr(alvo_, "ndim", 1) == 3 else float(alvo_[k_])
            base[..., k_] += (a_k - base[..., k_]) * peso_

    _g = json.load(open(M.cena("_grelha.json"), encoding="utf-8"))
    SERRA = np.clip(subir(np.load(M.cena("_serra.npy"))), 0, 1)
    _lat = 49.5 - (_g["y0"] + (gj + 0.5) * _g["cel"]) / 64.0
    _lon = (_g["x0"] + (gi + 0.5) * _g["cel"]) / (np.cos(np.radians(38.0)) * 64.0) - 125.0
    LAT2 = np.broadcast_to(_lat[:, None].astype(np.float32), (H, W))
    LON2 = np.broadcast_to(_lon[None, :].astype(np.float32), (H, W))
    ZN = Z / float(M.ALTURA_MAX)
    # ⚠ a neve NAO e pela cota so (1.a cozedura): o planalto de Denver esta a 40%
    # do cume mais alto, e a cota pintou-o de branco ate a estrada. Conta metade
    # da cota e metade da altura ACIMA DO CHAO DO VALE: neve e no cume, nao no
    # planalto alto.
    ZN = ZN - 0.5 * np.clip(subir(np.load(M.cena("_vale.npy"))), 0, 1)
    # ── OS APALACHES NAO SAO AS ROCHOSAS (2.a cozedura) ─────────────────────
    # Sairam cinzentos e com neve, iguais as serras do Oeste. Sao velhos, baixos
    # e cobertos de mata: a leste do meridiano 96 a neve sobe para fora do
    # alcance, a rocha so aparece nas paredes mesmo a pique, e a encosta e verde.
    w_leste = smooth(-99.0, -93.0, LON2)
    # a linha de neve desce para norte
    LINHA = (float(os.environ.get("LINHA_NEVE", "0.44")) - (LAT2 - 33.0) * 0.008 + 0.45 * w_leste).astype(np.float32)
    n_larga = fbm([(90, 0.5), (30, 0.3), (11, 0.2)], 91) - 0.5
    n_rocha = fbm([(60, 0.6), (18, 0.4)], 77) - 0.5

    # a rocha: paredes acima de ~38 graus (o limiar anda +-5 com o ruido)
    rocha_w = smooth(35.0, 45.0, DECL + n_rocha * 10.0 - 13.0 * w_leste) * SERRA
    # mais rocha no alto: acima da linha das arvores a encosta de 30 graus ja e pedra
    acima = smooth(-0.24, -0.06, ZN - LINHA)                    # 0 na mata, 1 no andar alpino
    rocha_w = np.maximum(rocha_w, smooth(27.0, 37.0, DECL + n_rocha * 10.0) * SERRA * acima)
    cascalho = smooth(24.0, 34.0, DECL + n_larga * 8.0) * SERRA * (1.0 - rocha_w) * (1.0 - 0.85 * w_leste)

    # a cor da pedra, por regiao
    GRANITO, ARENITO, XISTO = cor(134, 130, 126), cor(166, 104, 70), cor(100, 96, 88)
    seco_px = 1.0 - HUM
    w_rubro = smooth(0.55, 0.85, seco_px) * smooth(40.5, 37.0, LAT2)
    pedra = np.broadcast_to(GRANITO, (H, W, 3)).copy()
    for k_ in range(3):
        pedra[..., k_] += (float(ARENITO[k_]) - pedra[..., k_]) * w_rubro
        pedra[..., k_] += (float(XISTO[k_]) - pedra[..., k_]) * w_leste
    del w_rubro, seco_px
    # os ESTRATOS: bancos horizontais (a cor depende da cota, com a cota torcida
    # por ruido para o banco nao ser uma curva de nivel). Tabela ao acaso, sem senos.
    _tab = np.random.default_rng(303).random(512).astype(np.float32)
    _zq = (Z + n_larga * 60.0) / 13.0
    _i0 = np.floor(_zq).astype(np.int32)
    _f = (_zq - _i0).astype(np.float32)
    _f = _f * _f * (3 - 2 * _f)
    estrato = _tab[_i0 % 512] * (1 - _f) + _tab[(_i0 + 1) % 512] * _f
    del _zq, _i0, _f
    # (com 0,30 e bancos de 7 m lia-se como CURVAS DE NIVEL de cima: 0,12 e 13 m, mais torcidos)
    pedra *= (0.86 + 0.12 * estrato + 0.26 * n_rocha + 0.12 * np.clip(ZN, 0, 1))[..., None]
    del estrato
    # a mata de encosta (so a COR do chao: as arvores entram na M3) e o mato seco
    m_mata = fbm([(70, 0.6), (22, 0.4)], 93)
    encosta = SERRA * smooth(8.0, 16.0, DECL) * (1.0 - acima)
    misturar_ja(cor(46, 64, 40), (0.62 + 0.22 * w_leste) * encosta * smooth(0.42, 0.72, h)
                * smooth(0.25 - 0.2 * w_leste, 0.6 - 0.2 * w_leste, m_mata))
    misturar_ja(cor(118, 110, 70), 0.40 * encosta * smooth(0.45, 0.15, h) * smooth(0.3, 0.7, m_mata))
    del encosta, m_mata
    # o andar alpino: erva rala, amarelada, e a terra a aparecer
    misturar_ja(cor(132, 124, 86), 0.70 * SERRA * acima)
    # o cascalho ao pe das paredes: a mesma pedra, mais clara e mais terrosa
    _pc = 0.85 * cascalho
    for k_ in range(3):
        base[..., k_] += (pedra[..., k_] * 0.55 + float(cor(150, 132, 104)[k_]) * 0.45 - base[..., k_]) * _pc
    del _pc
    misturar_ja(pedra, 0.95 * rocha_w)
    del pedra
    # ── E A LESTE, FLORESTA POR CIMA DE TUDO (3.a cozedura) ─────────────────
    # Sem neve, os Apalaches continuavam CINZENTOS: o cinzento vinha da terra e
    # da pedra por declive do passo 2 (as da Iberia), que nao sabem do leste.
    # Os Apalaches sao uma serra de mata ate ao cume: a leste a encosta inteira
    # fica floresta escura (manchas de dois tons, para nao ser um tapete), e so a
    # parede mesmo a pique mostra o xisto.
    m_flo = fbm([(80, 0.5), (26, 0.3), (9, 0.2)], 97)
    floresta = (w_leste * SERRA * (1.0 - rocha_w))
    # (presa a declive > 4 graus, saltava os topos planos: manchas claras de beira
    # direita no meio da mata, a 220 m).astype(np.float32)
    _fc = (cor(40, 58, 32), cor(62, 76, 40))
    _mix = smooth(0.35, 0.7, m_flo)
    for k_ in range(3):
        _alvo = (float(_fc[0][k_]) * (1 - _mix) + float(_fc[1][k_]) * _mix) * (0.9 + 0.2 * m_flo)
        base[..., k_] += (_alvo - base[..., k_]) * (0.88 * floresta)
    del m_flo, _mix, _alvo
    # a neve: acima da linha, com a beira roida pelo ruido; desce pelos barrancos
    # (ficam linguas brancas nos corredores) e nao agarra nas paredes a pique
    corredor = np.clip(CONC_FINA / 3.0, -1.0, 1.0)
    neve = smooth(0.0, 1.0, (ZN - LINHA) / 0.07 + n_larga * 3.2 + corredor * 0.9)
    neve = neve * (1.0 - 0.75 * smooth(56.0, 70.0, DECL + n_rocha * 8.0)) * SERRA
    del LAT2, LON2, n_larga, n_rocha, corredor, w_leste
    # (o forno do 2.o mapa ja ficou sem memoria aqui, com o Blender por cima: 7,7 GB)
    del SERRA, ZN, LINHA, acima

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
        u, v = (x + LX / 2) / RES, (LY / 2 - y) / RES - ROW0
        rr = (r * 1.05 + 4.0) / RES
        dr.ellipse([u - rr, v - rr, u + rr, v + rr], fill=int(255 * dens))
    mata = ndimage.gaussian_filter(np.asarray(im, dtype=np.float32) / 255.0, 7.0 / RES)
    mata = mata * (0.75 + 0.5 * ruido(25, 31))
base = misturar(base, MATA_CHAO, 0.78 * np.clip(mata, 0, 1))

# 3b. as margens dos RIOS (F4): lodo humido rente a agua, e uma faixa verde
#     de margem (ha agua o ano inteiro: e o que desenha o rio visto do ar)
margem = np.zeros((H, W), dtype=np.float32)
lodo = np.zeros((H, W), dtype=np.float32)
_fr = M.cena("_rios.json")
if os.path.exists(_fr):
    rios = json.load(open(_fr, encoding="utf-8"))
    im_m = Image.new("L", (W, H), 0)
    im_l = Image.new("L", (W, H), 0)
    dm_, dl_ = ImageDraw.Draw(im_m), ImageDraw.Draw(im_l)
    for r in rios:
        pts = [((x + LX / 2) / RES, (LY / 2 - y) / RES - ROW0) for x, y in r["pts"]]
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
if not PARCELAS:
    del XX, YY
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
    uv = [((x + LX / 2) / RES, (LY / 2 - y) / RES - ROW0) for x, y in pts]
    if len(uv) > 1:
        dr.line(uv, fill=255, width=int(20 / RES))
berma = ndimage.gaussian_filter(np.asarray(im, dtype=np.float32) / 255.0, 4.0 / RES)
berma = berma * (0.6 + 0.4 * ruido(15, 61))
base = misturar(base, cor(168, 146, 98), 0.45 * berma)

# 6. a duna: a erva seca e clara a passar para a areia
duna = np.clip(AREIA * 1.6, 0, 1) * smooth(90.0, 20.0, DM) * smooth(16.0, 3.0, Z)
base = misturar(base, DUNA, 0.8 * duna)

# 6b. a neve vai por cima de tudo (so nas serras do 2.o mapa)
if SERRAS:
    misturar_ja(cor(238, 242, 248), 0.97 * neve)

# 7. o grao fino: nenhum pixel e igual ao vizinho (de perto a relva respira)
grao = fbm([(6, 0.5), (2.5, 0.5)], 71)
if SERRAS:
    base = base * (0.94 + 0.12 * grao * (1.0 - 0.8 * neve))[..., None]
else:
    base = base * (0.94 + 0.12 * grao)[..., None]
base = np.clip(base, 0, 1)
# a cor esta pronta: grava-se JA e larga-se, com tudo o que so servia para a pintar
# (12/11: no 2.o mapa sao 20 milhoes de pixeis e os pesos abaixo nao cabiam ao lado dela)
guardar("cor", (base * 255).round().astype(np.uint8), "RGB", "chao_cor.jpg", quality=92)
del base, CONC, CONC_FINA, DM, AREIA, Z, duna, grao, dist_ald, lodo

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
if SERRAS:
    # na rocha manda a fotografia da pedra; no cascalho, a da terra
    # (a leste a floresta tapa a terra e a pedra por declive do passo 2)
    w_pedra = w_pedra * (1.0 - floresta) + 3.0 * rocha_w + 0.6 * cascalho
    w_terra = w_terra * (1.0 - floresta) + 1.2 * cascalho
    w_relva = w_relva + 1.2 * floresta
    w_relva = w_relva * (1.0 - rocha_w)
    w_seco = w_seco * (1.0 - rocha_w)
soma = w_relva + w_seco + w_terra + w_pedra + 1e-4
TIPO = np.stack([w_relva, w_seco, w_terra, w_pedra], -1) / soma[..., None]
if SERRAS:
    # a neve nao tem grao de relva nem de pedra: os pesos somam MENOS de 1 e o
    # shader (`chSerras`) apaga o detalhe na mesma medida
    TIPO = TIPO * (1.0 - 0.92 * neve)[..., None]

# os tipos estao prontos: gravam-se JA e largam-se (12/11, a memoria do 2.o mapa)
guardar("tipo", (TIPO * 255).round().astype(np.uint8), "RGBA", "chao_tipo.png")
del TIPO, soma, w_relva, w_seco, w_terra, w_pedra

# ── OS SULCOS (para o shader) ────────────────────────────────────────────────
# canal a canal, ja em bytes: empilhados em float64 eram 450 MB no 2.o mapa
em_campo = p_campo > 0.5
periodo = np.where(tipo_cel[cel] == 4, 4.0, 2.6)
CAMPO = np.empty((H, W, 3), dtype=np.uint8)
CAMPO[..., 0] = (np.mod(ang_cel[cel], np.pi) / np.pi * 255.0).clip(0, 255).round().astype(np.uint8)   # o rumo
CAMPO[..., 1] = np.where(em_campo, forca_risca / 0.25 * 255.0, 0.0).clip(0, 255).round().astype(np.uint8)  # a forca
CAMPO[..., 2] = (periodo * 40.0).clip(0, 255).round().astype(np.uint8)
del periodo, em_campo

# ── GRAVAR ──────────────────────────────────────────────────────────────────
guardar("campo", CAMPO, "RGB", "chao_campo.png")
del CAMPO

_sl = slice(_r0 - ROW0, _r1 - ROW0) if _BANDA else slice(None)
_T = TERRA[_sl]
_cont = {"terra": int(_T.sum())}
for _n, _a in (("campo", p_campo), ("mata", mata), ("rocha", rocha_w), ("cascalho", cascalho), ("neve", neve)):
    _cont[_n] = int(((_a[_sl] > 0.5) & _T).sum())
if _BANDA:
    print("BANDA " + json.dumps(_cont))
else:
    cauda({n_: 100.0 * _cont[n_] / max(_cont["terra"], 1) for n_ in ("campo", "mata", "rocha", "cascalho", "neve")})
