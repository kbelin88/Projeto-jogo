# sudoeste.py -- o Grand Canyon e Monument Valley do mapa dos EUA (fase M2, 12/11/2026).
#
#   python ferramentas/cena/sudoeste.py    -> mede (declive, folgas, alturas) sobre as
#                                             grelhas que o preparador ja deixou
#
# Usado pelo `preparar_usa.py` (o planalto, o vale e os taludes no relevo, e a
# bancada) e pelo forno (`exportar_mapa.py`, MAPA=usa: as duas malhas e o rio).
# Uma conta so para os dois: a bancada mostra a mesma geometria que o forno coze.
#
# ── O QUE O LUCAS PEDIU (12/11) ─────────────────────────────────────────────
#   * o canyon a NORTE da estrada Las Vegas-Albuquerque, com a estrada a passar
#     na borda sul (como o South Rim): o canyon real fica EM CIMA dessa estrada
#     (34 m livres), e a regra e nao tocar em estradas nem aldeias;
#   * fundo e em degraus: ~70 m de fundo, 50-70 m de borda a borda, paredes em
#     degraus com faixas de cor, garganta estreita no fundo;
#   * o rio ja agora, so no canyon (a M4 liga-o ao resto);
#   * Monument Valley: 6-8 pecas modeladas (as duas "luvas", a Merrick, mesas e
#     agulhas), paredes a pique, topo plano, saia de cascalho.
#
# ── PORQUE NAO E O RELEVO ───────────────────────────────────────────────────
# A grelha do chao tem 4,9 m. Um degrau do canyon tem 2 a 8 m de largo e uma
# parede de 14 m cabe em 2 m: na grelha saia uma rampa mole aos dentes. Por isso:
#   * o CANYON e uma malha propria "costurada ao longo do eixo": cada fila
#     atravessa o canyon e tem um vertice EXATAMENTE em cada beira de degrau
#     (a crista do penhasco nao cai entre vertices). O chao da grelha desce por
#     baixo dela, e uma aba de 13 m pousada no planalto cobre a costura;
#   * as MESAS sao prismas (aneis de vertices a varias alturas, tampa por cima),
#     enterrados 6 m num talude que o preparador levanta na grelha.
# A cor nao vem da fotografia de cima (uma parede de 14 m em 2 m eram 2 pixeis):
# os ESTRATOS leem-se pela altura do mundo, no navegador (`mapa3d.js`,
# `pintarEstratos`), com a tabela que este modulo da (`estratos`). As camadas
# sao horizontais e as mesmas em todas as mesas -- que e como o vale e.
#
# Sem bpy e sem scipy no que o forno chama (o Python do Blender nao tem scipy).
import math

import numpy as np

H_REF = 220.0          # todas as alturas daqui sao metros com o cume a 220 m; o resto escala
PLANO = 85.0           # o planalto do canyon E o chao do vale das mesas (a estrada ali anda nos 75-91 m)
M_CEL = 4.914          # metros por celula (o mesmo do cristas.py)

# ── O CANYON ────────────────────────────────────────────────────────────────
# O eixo, em celulas (j, i) da grelha: de oeste (perto de Las Vegas) para este
# (Lees Ferry). Escolhido sobre a folga as estradas (pesquisa/2026-11-12/m2b/).
# (a 1.a cozedura parou: a ponta este, em (333.5, 304), entrava no pe da luva oeste)
EIXO = [(331.0, 257.0), (335.0, 267.0), (338.5, 278.0), (340.0, 288.0), (338.0, 296.0), (335.0, 300.5)]
FUNDO = 70.0           # m do planalto ao rio
# a seccao, de dentro para fora: (desvio ao eixo em m, profundidade abaixo do
# PLANO em m, quanto a erosao a mexe em m, quanto o anfiteatro a recua (0..1),
# a camada que acaba aqui). Profundidade None = a borda (o chao do planalto).
SECCAO = [
    (0.0, 70.0, 0.0, 0.00, "rio"),
    (3.6, 70.0, 0.3, 0.00, "rio"),          # a margem do rio
    (5.0, 60.0, 0.5, 0.00, "vishnu"),       # a garganta (xisto escuro)
    (6.6, 51.0, 0.6, 0.05, "tapeats"),      # o labio da garganta
    (14.8, 48.0, 1.6, 0.40, "tonto"),       # a plataforma de Tonto, larga e verde-cinza
    (15.8, 39.0, 0.5, 0.58, "redwall"),
    (16.9, 30.0, 0.6, 0.62, "redwall"),     # a grande parede vermelha
    (17.8, 29.0, 0.5, 0.70, "supai"),       # uma lasca
    (19.9, 20.0, 0.7, 0.78, "supai"),       # os degraus vermelhos
    (23.4, 15.5, 1.4, 0.90, "hermit"),      # a encosta de xisto vermelho
    (26.4, 12.0, 0.6, 0.97, "coconino"),    # o pe do penhasco claro
    (28.4, None, 0.5, 1.00, "kaibab"),      # a borda
]
# ── O LADO NORTE, LARGO (1.a prova, 12/11) ──────────────────────────────────
# Com 70 m de fundo e 28 m de cada lado o canyon lia-se como uma TRINCHEIRA e
# os degraus quase nao se viam: o Grand Canyon real e muito mais largo do que
# fundo. A sul a estrada nao deixa crescer; a norte ha 170-245 m livres. E o
# canyon real tambem e assim: o rio passa mais perto do South Rim, e o lado
# norte desce em plataformas largas, com anfiteatros e "templos" (buttes
# isolados) la dentro. `SW_NORTE=estreita` volta ao lado norte igual ao sul.
import os as _os                                                     # noqa: E402
NORTE_LARGO = _os.environ.get("SW_NORTE", "larga") != "estreita"
SECCAO_NORTE = [
    (0.0, 70.0, 0.0, 0.00, "rio"),
    (3.6, 70.0, 0.3, 0.00, "rio"),
    (5.0, 60.0, 0.5, 0.00, "vishnu"),
    (6.6, 51.0, 0.6, 0.05, "tapeats"),
    (24.0, 47.5, 2.5, 0.35, "tonto"),       # a plataforma de Tonto: 17 m, onde assentam os templos
    (25.0, 39.0, 0.6, 0.50, "redwall"),
    (26.1, 30.0, 0.6, 0.50, "redwall"),
    (31.0, 28.0, 1.2, 0.60, "supai_a"),     # uma plataforma no Supai
    (32.0, 24.0, 0.6, 0.62, "supai_b"),
    (36.0, 23.0, 1.0, 0.66, "supai_c"),     # e outra
    (37.0, 20.0, 0.6, 0.70, "supai_d"),
    (43.0, 15.5, 1.6, 0.82, "hermit"),      # a encosta vermelha, larga
    (46.5, 12.0, 1.0, 0.95, "coconino"),
    (47.6, 4.5, 0.6, 0.97, "coconino"),     # o penhasco claro
    (49.0, None, 0.5, 1.00, "kaibab"),
] if NORTE_LARGO else SECCAO
# os templos: pecas como as mesas, pousadas na plataforma de Tonto do lado norte
# (fracao do comprimento, meio-eixos a e b em m, rumo), em bolo de noiva: a
# parede vermelha, os degraus do Supai, a encosta e uma tampa clara, as mesmas
# alturas das camadas das paredes
TEMPLOS = [(0.30, 10.5, 7.0, 12.0), (0.53, 11.5, 7.5, -15.0), (0.75, 9.5, 6.6, 25.0)] if NORTE_LARGO else []
ABA = (5.0, 18.0)      # a aba pousada no planalto, alem da borda (m): meio e fora
PASSO_S = 1.2          # m entre filas ao longo do eixo
PONTAS = (26.0, 58.0)  # m em que o canyon nasce a oeste e morre a este (fica raso)

# ── MONUMENT VALLEY ─────────────────────────────────────────────────────────
# (j, i) em celulas, meio-eixos a, b em m, rumo em graus, altura da parede
# (do talude ao topo), tipo. As alturas do topo sao as MESMAS (as camadas sao
# horizontais); as agulhas e os restos baixos acabam mais abaixo, sem tampa.
TALUDE = 10.0          # m: o talude de xisto (Organ Rock) acima do vale
CORRIDA = 19.0         # m: quanto o talude se estende para fora da parede (~28 graus)
ENTERRA = 6.0          # m: a parede desce abaixo do talude
TOPO = 37.5            # m acima do vale: o topo das mesas com tampa
# (1.a prova, 12/11: com 58 m de altura e 12-24 m de largo sairam SILOS. As de
# Monument Valley sao mais largas do que altas; aqui ficam ~1,3 a 2 vezes.)
MESAS = [
    # as duas luvas: corpo comprido + polegar (uma agulha ao lado, com folga)
    dict(nome="luva_oeste", j=333.2, i=309.0, a=20.0, b=8.5, rumo=22.0, tipo="mesa", sem=11),
    dict(nome="polegar_oeste", j=330.0, i=311.6, a=3.2, b=2.6, rumo=22.0, tipo="agulha", alto=33.0, sem=12),
    dict(nome="luva_este", j=341.8, i=318.6, a=19.0, b=8.5, rumo=26.0, tipo="mesa", sem=13),
    dict(nome="polegar_este", j=345.2, i=316.2, a=3.0, b=2.5, rumo=26.0, tipo="agulha", alto=32.0, sem=14),
    dict(nome="merrick", j=348.0, i=307.8, a=13.0, b=8.5, rumo=-12.0, tipo="mesa", sem=15),
    dict(nome="elefante", j=350.2, i=321.0, a=9.0, b=5.5, rumo=58.0, tipo="baixa", alto=24.0, sem=16),
    dict(nome="totem", j=344.6, i=327.6, a=1.9, b=1.6, rumo=0.0, tipo="agulha", alto=34.0, sem=17),
    dict(nome="irmas_1", j=329.6, i=319.2, a=2.4, b=1.9, rumo=0.0, tipo="agulha", alto=30.0, sem=18),
    dict(nome="irmas_2", j=330.5, i=320.5, a=2.1, b=1.8, rumo=0.0, tipo="agulha", alto=26.0, sem=19),
    dict(nome="irmas_3", j=331.4, i=321.8, a=2.0, b=1.7, rumo=0.0, tipo="agulha", alto=22.0, sem=20),
    dict(nome="mitchell", j=318.6, i=297.0, a=34.0, b=12.0, rumo=-28.0, tipo="mesa", sem=21),
    dict(nome="sentinela", j=323.2, i=309.8, a=21.0, b=11.0, rumo=8.0, tipo="mesa", sem=22),
]

# ── OS ESTRATOS: a cor pela altura (m acima do PLANO; sRGB 0..1) ───────────────
# Do fundo para cima. O canyon vive abaixo do PLANO, as mesas acima: uma tabela so.
ESTRATOS = [
    (-72.0, (0.23, 0.21, 0.21)),   # Vishnu: xisto quase negro
    (-55.0, (0.26, 0.23, 0.22)),
    (-53.0, (0.47, 0.36, 0.27)),   # Tapeats: arenito castanho
    (-50.5, (0.55, 0.55, 0.44)),   # Tonto (Bright Angel): xisto verde-cinza
    (-47.5, (0.58, 0.55, 0.45)),
    (-46.5, (0.69, 0.42, 0.30)),   # Redwall: calcario manchado de vermelho
    (-38.0, (0.74, 0.46, 0.33)),
    (-31.0, (0.70, 0.42, 0.30)),
    (-29.5, (0.66, 0.36, 0.24)),   # Supai: degraus vermelhos, em bandas
    (-25.0, (0.73, 0.43, 0.29)),
    (-22.5, (0.64, 0.35, 0.23)),
    (-20.0, (0.60, 0.30, 0.20)),   # Hermit: xisto vermelho-escuro
    (-12.5, (0.62, 0.32, 0.22)),
    (-11.5, (0.88, 0.82, 0.68)),   # Coconino: o arenito claro
    (-6.0, (0.86, 0.79, 0.64)),
    (-5.0, (0.78, 0.67, 0.52)),    # Toroweap
    (-2.0, (0.80, 0.74, 0.62)),    # Kaibab: calcario cinza-creme (a borda)
    (0.0, (0.66, 0.42, 0.28)),     # o vale: areia vermelha
    (2.5, (0.56, 0.29, 0.19)),     # Organ Rock: xisto vermelho em bandas
    (8.0, (0.60, 0.31, 0.20)),
    (9.5, (0.79, 0.42, 0.25)),     # De Chelly: o arenito laranja das paredes
    (24.0, (0.81, 0.45, 0.27)),
    (32.5, (0.75, 0.40, 0.24)),
    (33.4, (0.50, 0.31, 0.22)),    # Moenkopi: encosta castanha
    (35.4, (0.47, 0.41, 0.35)),    # Shinarump: a tampa cinza-castanha
    (38.5, (0.45, 0.40, 0.34)),
]


def _suave(a, b, x):
    t = np.clip((np.asarray(x, np.float64) - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _ruido1(s, semente, comprimentos, amplitudes):
    """ruido liso ao longo de s (m): soma de senos com fases ao acaso"""
    rng = np.random.default_rng(semente)
    out = np.zeros_like(np.asarray(s, np.float64))
    for L, A in zip(comprimentos, amplitudes):
        f1, f2 = rng.uniform(0, 2 * math.pi, 2)
        out += A * (0.62 * np.sin(2 * math.pi * s / L + f1) + 0.38 * np.sin(2 * math.pi * s / (L * 0.57) + f2))
    return out


def _catmull(P, passo_cel):
    """curva que passa pelos pontos (em celulas), amostrada a `passo_cel`"""
    P = [np.array(p, np.float64) for p in P]
    Q = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    fina = []
    for k in range(len(P) - 1):
        p0, p1, p2, p3 = Q[k], Q[k + 1], Q[k + 2], Q[k + 3]
        for t in np.linspace(0, 1, 40, endpoint=False):
            fina.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                               + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    fina.append(P[-1])
    fina = np.array(fina)
    d = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(fina, axis=0).T))])
    n = max(2, int(d[-1] / passo_cel) + 1)
    alvo = np.linspace(0, d[-1], n)
    return np.stack([np.interp(alvo, d, fina[:, 0]), np.interp(alvo, d, fina[:, 1])], axis=1)


def superficie(R, fi, fj, diagonal="principal"):
    """a altura do chao COMO A MALHA O DESENHA, em (fi, fj) celulas (vertice (i, j)
    no canto). `principal`: o forno parte cada quadrado de (i,j) a (i+1,j+1);
    `anti`: o PlaneGeometry da bancada parte de (i,j+1) a (i+1,j)."""
    th, tw = R.shape
    fi = np.asarray(fi, np.float64)
    fj = np.asarray(fj, np.float64)
    i0 = np.clip(np.floor(fi).astype(int), 0, tw - 2)
    j0 = np.clip(np.floor(fj).astype(int), 0, th - 2)
    u = np.clip(fi - i0, 0, 1)
    v = np.clip(fj - j0, 0, 1)
    h00, h10, h01, h11 = R[j0, i0], R[j0, i0 + 1], R[j0 + 1, i0], R[j0 + 1, i0 + 1]
    if diagonal == "principal":
        a = h00 + u * (h10 - h00) + v * (h11 - h10)
        b = h00 + v * (h01 - h00) + u * (h11 - h01)
        return np.where(u >= v, a, b)
    a = h00 + u * (h10 - h00) + v * (h01 - h00)
    b = h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11)
    return np.where(u + v <= 1, a, b)


def metros(V):
    """(fi, fj, z) -> (x, y, z) em metros, com o y a subir para norte (o sistema do forno)"""
    return np.stack([V[:, 0] * M_CEL, -V[:, 1] * M_CEL, V[:, 2]], axis=1)


def _orientar(V, F, para, centro=None):
    """as faces viradas para fora, no sistema do forno (y para norte). A grelha tem o j
    a descer, e por isso a ordem dos vertices nao diz nada sozinha: decide-se pela
    maioria (o canyon e um campo de alturas -> normais para cima; uma mesa e um
    prisma -> normais a fugir do `centro`). As que ficam ao contrario da maioria
    sao DOBRAS e contam-se (`_orientar.dobras`)."""
    P = metros(V)[F]
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    if para == "cima":
        sinal = n[:, 2]
        util = np.abs(n[:, 2]) > 1e-6 * np.linalg.norm(n, axis=1)
    else:
        c = P.mean(axis=1)
        sinal = (n[:, :2] * (c[:, :2] - np.asarray(centro)[None, :])).sum(axis=1)
        util = np.linalg.norm(n[:, :2], axis=1) > 0.2 * np.linalg.norm(n, axis=1)
    if (sinal[util] < 0).sum() > (sinal[util] > 0).sum():
        F = F[:, [0, 2, 1]]
        sinal = -sinal
    _orientar.dobras = int((sinal[util] < 0).sum())
    return F


# ── o canyon ────────────────────────────────────────────────────────────────
def canyon(R, k_h=1.0, diagonal="principal"):
    """a malha do canyon sobre o chao R (metros, vertices da grelha).
    Devolve dict: v (N x 3: fi, fj, z), f (M x 3), chao (N: 1 = aba, cor do chao),
    camada (N: indice em SECCAO, -1 na aba), rio (pontos fi,fj; meia-largura m; nivel m),
    eixo (pontos fi,fj), borda_m (desvio da borda por fila e lado)."""
    eixo = _catmull(EIXO, PASSO_S / M_CEL)
    n = len(eixo)
    s = np.arange(n) * PASSO_S
    L = s[-1]
    # as normais vem de um eixo ALISADO (~25 m): o canyon tem 70 m de largo e
    # nas curvas as filas do lado de dentro cruzavam-se
    k = np.exp(-0.5 * (np.arange(-60, 61) * PASSO_S / 25.0) ** 2)
    k /= k.sum()
    pad = np.pad(eixo, ((60, 60), (0, 0)), mode="edge")
    lisa = np.stack([np.convolve(pad[:, 0], k, "valid"), np.convolve(pad[:, 1], k, "valid")], axis=1)
    t = np.gradient(lisa, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    # t vem em (dj, di); a normal, em (di, dj): perpendicular ao rumo (di, dj) = (t1, t0)
    nrm = np.stack([-t[:, 0], t[:, 1]], axis=1)
    # as pontas: a oeste o canyon acaba em anfiteatro; a este fica raso devagar
    ponta = _suave(0, PONTAS[0], s) * _suave(0, PONTAS[1], L - s)
    f_d = ponta ** 0.55                                         # a profundidade
    f_w = 0.38 + 0.62 * ponta ** 0.45                           # a largura
    z_plano = PLANO * k_h
    z_rio = z_plano - FUNDO * k_h * f_d                         # o fundo sobe nas pontas

    linhas = []          # por lado: lista de (desvio m [n], z [n] ou None, camada)
    borda = {}
    templos = []
    for lado, sem in ((1.0, 100), (-1.0, 200)):
        # lado +1 e o SUL (o j da grelha cresce para sul), o da estrada
        seccao = SECCAO if lado > 0 else SECCAO_NORTE
        largo = lado < 0 and NORTE_LARGO
        # os anfiteatros: as camadas de cima recuam muito mais do que as de baixo
        anf = (12.0 if largo else 7.5) * np.clip(_ruido1(s, sem, (70.0, 31.0), (0.75, 0.45)), 0, None) ** 1.3
        rng = np.random.default_rng(sem + 7)
        for _ in range(5 if largo else 4):                       # canyons laterais
            c = rng.uniform(0.12, 0.88) * L
            anf += rng.uniform(14.0, 24.0) * np.exp(-0.5 * ((s - c) / rng.uniform(6.0, 11.0)) ** 2)                 if largo else rng.uniform(9.0, 15.0) * np.exp(-0.5 * ((s - c) / rng.uniform(5.0, 9.0)) ** 2)
        des_ant = None
        cols = []
        nomes = sorted({q[4] for q in seccao})
        for kk, (des, prof, ero, p_anf, nome) in enumerate(seccao):
            # a erosao e da CAMADA: o pe e o alto do mesmo penhasco andam juntos, e a
            # parede fica direita em vez de torcida
            d = des * f_w + ero * _ruido1(s, sem + 11 * nomes.index(nome), (9.0, 4.3), (0.7, 0.5)) + p_anf * anf * f_w
            if kk == 0:
                d = np.zeros(n)
            elif des_ant is not None:
                d = np.maximum(d, des_ant + 0.45)                   # cada beira fora da de dentro
            des_ant = d
            cols.append((d, prof, kk))
        borda[lado] = cols[-1][0].copy()
        if largo:
            # os templos, a meio da plataforma de Tonto da fila em que caem
            k_t = [q[4] for q in seccao].index("tonto")
            for (fr, a_, b_, rumo) in TEMPLOS:
                r = int(fr * (n - 1))
                meio = 0.5 * (cols[k_t - 1][0][r] + cols[k_t][0][r])
                # o rumo e relativo ao do canyon (o comprido do templo ao longo da plataforma)
                rumo_c = math.degrees(math.atan2(-t[r, 0], t[r, 1]))
                templos.append(dict(nome="templo_%d" % (len(templos) + 1), tipo="templo",
                                    i=float(eixo[r, 1] + nrm[r, 0] * lado * meio / M_CEL),
                                    j=float(eixo[r, 0] + nrm[r, 1] * lado * meio / M_CEL),
                                    a=a_, b=b_, rumo=rumo_c + rumo, sem=300 + len(templos),
                                    folga=float(cols[k_t][0][r] - cols[k_t - 1][0][r])))
        # a aba corre por fora do MAIOR recuo da borda a volta (+-22 m): ao lado de um
        # canyon lateral a borda da fila vizinha fica 15 m mais para dentro, e a aba
        # dela caia em cima do chao que o lateral fez descer (10 de 412 pontos, medido)
        jan = int(22.0 / PASSO_S)
        pad_b = np.pad(borda[lado], jan, mode="edge")
        larga = np.lib.stride_tricks.sliding_window_view(pad_b, 2 * jan + 1).max(axis=1)
        k_l = np.exp(-0.5 * (np.arange(-jan, jan + 1) / (jan / 2.0)) ** 2)
        larga = np.convolve(np.pad(larga, jan, mode="edge"), k_l / k_l.sum(), "valid")
        larga = np.maximum(larga, borda[lado])
        for kk, a in enumerate(ABA):
            cols.append((larga + a, None, -1 - kk))
        linhas.append((lado, cols))

    # os vertices: fila a fila, do lado direito (-) ao esquerdo (+), sem repetir o eixo
    seq = []
    for lado, cols in linhas:
        part = [(lado, c) for c in cols]
        if lado < 0:
            part = part[1:]                                      # o eixo ja vem do lado +
        seq.append(part)
    ordem = list(reversed(seq[1])) + seq[0]                      # de fora(-) ... eixo ... fora(+)
    ncol = len(ordem)
    V = np.zeros((n, ncol, 3))
    chao = np.zeros((n, ncol))
    camada = np.zeros((n, ncol), int)
    for c, (lado, (d, prof, kk)) in enumerate(ordem):
        fi = eixo[:, 1] + nrm[:, 0] * lado * d / M_CEL
        fj = eixo[:, 0] + nrm[:, 1] * lado * d / M_CEL
        g = superficie(R, fi, fj, diagonal)
        if kk == -1:
            z = g + 0.06
            chao[:, c] = 0.55
        elif kk == -2:
            z = g + 0.02
            chao[:, c] = 1.0
        elif prof is None:
            z = g + 0.05                                         # a borda: o planalto
        else:
            z = np.maximum(z_plano - prof * k_h, z_rio)
            z = np.minimum(z, g + 0.05)                          # nunca acima do planalto
        V[:, c] = np.stack([fi, fj, z], axis=1)
        camada[:, c] = kk
    # um pouco de rocha a sair e a entrar nas paredes (a parede nao e um plano)
    # (1.a prova: com um tremor por beira, as faces torciam-se e a parede saia as riscas)
    jit = (_ruido1(s, 999, (7.0, 3.1), (0.45, 0.22))[:, None]
           + _ruido1(s[:, None] + np.arange(ncol)[None, :] * 13.7, 998, (9.0, 4.0), (0.08, 0.05)))
    parede = np.zeros((n, ncol), bool)
    for c, (lado, (d, prof, kk)) in enumerate(ordem):
        parede[:, c] = prof is not None and kk >= 2
    for c in range(ncol):
        m = parede[:, c]
        jit[:, c] *= ordem[c][0]
        V[m, c, 0] += nrm[m, 0] * jit[m, c] / M_CEL
        V[m, c, 1] += nrm[m, 1] * jit[m, c] / M_CEL
    # as faces: dois triangulos por quadrado, pela diagonal mais curta em 3D
    idx = np.arange(n * ncol).reshape(n, ncol)
    Vm = V.reshape(-1, 3) * np.array([M_CEL, M_CEL, 1.0])
    F = []
    for r in range(n - 1):
        for c in range(ncol - 1):
            a, b, cc, d = idx[r, c], idx[r, c + 1], idx[r + 1, c + 1], idx[r + 1, c]
            if np.linalg.norm(Vm[a] - Vm[cc]) <= np.linalg.norm(Vm[b] - Vm[d]):
                F += [(a, b, cc), (a, cc, d)]
            else:
                F += [(a, b, d), (b, cc, d)]
    F = _orientar(V.reshape(-1, 3), np.array(F, np.int64), "cima")
    # o rio: so onde o fundo e plano
    fundo_plano = f_d > 0.96
    rio = None
    if fundo_plano.any():
        sel = np.nonzero(fundo_plano)[0]
        w = 3.0 * np.minimum(1.0, np.minimum(sel - sel[0], sel[-1] - sel) * PASSO_S / 12.0)
        rio = (eixo[sel][:, ::-1].copy(), np.maximum(w, 0.3), z_rio[sel] + 0.35)    # (fi, fj)
    return dict(v=V.reshape(-1, 3), f=F, chao=chao.reshape(-1), camada=camada.reshape(-1),
                rio=rio, eixo=eixo[:, ::-1].copy(), n=n, ncol=ncol, f_d=f_d, templos=templos)


def normais_por_angulo(V, F, limite=32.0):
    """(a bancada) a normal de cada CANTO de triangulo: a media das faces vizinhas que
    fazem menos de `limite` graus com a dele. Liso ao longo de uma parede, vivo na
    beira de um degrau -- o que o forno da com as arestas vivas acima de 32 graus.
    Devolve (F.size x 3) normais, pela ordem de F.ravel()."""
    P = metros(V)[F]
    fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    fu = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    viz = [[] for _ in range(len(V))]
    for f, tri in enumerate(F):
        for v in tri:
            viz[v].append(f)
    c = math.cos(math.radians(limite))
    out = np.zeros((F.size, 3))
    for f, tri in enumerate(F):
        for k, v in enumerate(tri):
            fs = np.array(viz[v])
            ok = fs[(fu[fs] @ fu[f]) > c]
            n = fn[ok].sum(axis=0)
            out[3 * f + k] = n / max(np.linalg.norm(n), 1e-12)
    return out


def baixar_chao(R, cy, diagonal="principal", folga=1.0):
    """O chao da grelha desce por baixo do canyon. Para cada quadrado da grelha
    que um triangulo de DENTRO do canyon toca, os quatro cantos ficam abaixo do
    ponto mais baixo desse triangulo (menos `folga`): por construcao a grelha
    nao fura a malha. Devolve (R novo, quantos vertices desceram)."""
    R2 = R.copy()
    V, F = cy["v"], cy["f"]
    dentro = cy["camada"] >= 0
    alvo = np.full(R.shape, np.inf)
    for tri in F:
        if not dentro[tri].all():
            continue
        p = V[tri]
        zmin = p[:, 2].min() - folga
        i0, i1 = int(math.floor(p[:, 0].min())), int(math.floor(p[:, 0].max()))
        j0, j1 = int(math.floor(p[:, 1].min())), int(math.floor(p[:, 1].max()))
        blk = alvo[j0:j1 + 2, i0:i1 + 2]
        np.minimum(blk, zmin, out=blk)
    m = np.isfinite(alvo) & (alvo < R2)
    R2[m] = alvo[m]
    return R2.astype(R.dtype), int(m.sum())


def provar_pes(R_baixo, ms, diagonal="principal"):
    """o anel enterrado de cada mesa (o de baixo) tem de ficar debaixo do chao: devolve
    {nome: quantos pontos ficam a vista} so das que falham"""
    out = {}
    for p in ms["pecas"]:
        if p["tipo"] == "templo":
            continue
        pe = ms["v"][p["v0"]:p["v0"] + 96]
        n = int((superficie(R_baixo, pe[:, 0], pe[:, 1], diagonal) < pe[:, 2] + 0.3).sum())
        if n:
            out[p["nome"]] = n
    return out


def provar_costura(R_baixo, R_alto, cy, diagonal="principal"):
    """As duas provas da costura, em numeros:
    furos = pontos de DENTRO do canyon onde o chao (ja baixado) passa acima da malha;
    abas  = pontos da beira de fora da aba onde o chao baixou (a aba ficava no ar)."""
    V, F = cy["v"], cy["f"]
    dentro = cy["camada"] >= 0
    furos = tot = 0
    rng = np.random.default_rng(5)
    for tri in F[::3]:
        if not dentro[tri].all():
            continue
        w = rng.dirichlet((1, 1, 1), 6)
        p = w @ V[tri]
        g = superficie(R_baixo, p[:, 0], p[:, 1], diagonal)
        furos += int((g > p[:, 2] - 0.05).sum())
        tot += len(p)
    fora = cy["camada"] == -2
    pts = V[fora]
    d = superficie(R_alto, pts[:, 0], pts[:, 1], diagonal) - superficie(R_baixo, pts[:, 0], pts[:, 1], diagonal)
    return dict(furos=furos, amostras=tot, abas_no_ar=int((d > 0.01).sum()), abas=len(pts))


# ── as mesas ────────────────────────────────────────────────────────────────
def _contorno(m, nang=96):
    """o contorno de uma mesa: (nang x 2) em m, relativo ao centro, ja rodado"""
    rng = np.random.default_rng(m["sem"])
    th = np.linspace(0, 2 * math.pi, nang, endpoint=False)
    a, b = m["a"], m["b"]
    # (1.a prova: em elipse as mesas liam-se como LATAS.) Superelipse: lados mais
    # direitos e cantos, como um bloco de arenito partido pelas juntas
    ex = 2.0 if m["tipo"] == "agulha" else (2.6 if m["tipo"] == "templo" else 3.4)
    r = (np.abs(np.cos(th) / a) ** ex + np.abs(np.sin(th) / b) ** ex) ** (-1.0 / ex)
    ond = np.zeros(nang)
    for k, A in ((2, 0.07), (3, 0.06), (5, 0.04), (9, 0.025)):
        ond += A * np.sin(k * th + rng.uniform(0, 2 * math.pi))
    r = r * (1 + ond)
    # as ravinas: entradas estreitas na parede (a parede de arenito parte por juntas)
    if m["tipo"] != "agulha":
        for _ in range(int(2 + a / 5)):
            c = rng.uniform(0, 2 * math.pi)
            dd = np.angle(np.exp(1j * (th - c)))
            r -= rng.uniform(0.8, 2.4) * np.exp(-0.5 * (dd / (1.0 / max(a, 3.0))) ** 2)
    # as nervuras: o arenito parte em colunas verticais (iguais em todos os aneis -> riscas
    # de cima a baixo, que e o que a luz rasante apanha nas paredes de De Chelly)
    if m["tipo"] != "agulha":
        r = r + 0.35 * np.sin(23 * th + rng.uniform(0, 6.3)) + 0.22 * np.sin(41 * th + rng.uniform(0, 6.3))               + 0.15 * np.sin(67 * th + rng.uniform(0, 6.3))
    ang = math.radians(m["rumo"])
    x, y = r * np.cos(th), r * np.sin(th)
    return np.stack([x * math.cos(ang) - y * math.sin(ang), x * math.sin(ang) + y * math.cos(ang)], axis=1)


def _aneis(m, k_h):
    """[(z acima do vale em m, recuo em m)] de baixo para cima, e se leva tampa"""
    if m["tipo"] == "mesa":
        topo_dc = 33.0
        # o pe ALARGA para dentro do talude (o escombro encosta-se a parede) e a parede
        # inclina um palmo para dentro ate ao alto (1.a prova: a direito, liam-se latas)
        return [(TALUDE - ENTERRA, -3.2), (TALUDE - 1.0, -2.0), (TALUDE + 1.5, -0.7), (TALUDE + 4, -0.1),
                (TALUDE + 9, 0.25), (TALUDE + 15, 0.4), (TALUDE + 19, 0.75), (topo_dc, 0.95),
                (topo_dc + 0.3, 1.5), (35.2, 2.4),           # a Moenkopi: uma encosta curta
                (35.4, 1.95), (TOPO, 2.05)], True            # a tampa sobressai um palmo
    if m["tipo"] == "templo":
        # o bolo de noiva, nas MESMAS alturas das camadas da parede: o pe enterrado
        # abaixo do labio da plataforma (que desce para o rio), a parede vermelha,
        # dois degraus do Supai, a encosta do Hermit e a tampa clara do Coconino
        return [(-53.0, 0.0), (-40.0, 0.2), (-30.5, 0.35), (-30.2, 0.9), (-26.0, 1.1),
                (-25.8, 1.7), (-22.0, 1.9), (-21.8, 2.4), (-15.5, 3.3), (-15.3, 3.4),
                (-11.5, 3.5)], True
    alto = m["alto"]
    if m["tipo"] == "baixa":
        return [(TALUDE - ENTERRA, -2.6), (TALUDE - 1.0, -1.6), (TALUDE + 2, -0.3), (TALUDE + 9, 0.3),
                (alto - 4, 0.7), (alto, 1.2)], True
    # a agulha: afina para cima e acaba em ponta romba
    a = min(m["a"], m["b"])
    zs = np.linspace(TALUDE, alto, 7)
    return [(TALUDE - ENTERRA, -0.1)] + [(float(z), float(a * 0.42 * ((z - TALUDE) / (alto - TALUDE)) ** 1.6))
                                         for z in zs], False


def mesas(k_h=1.0, templos=()):
    """as pecas: dict v (N x 3: fi, fj, z), f (M x 3), por peca o contorno (para o
    talude do preparador) e a altura do pe. `templos`: os do canyon (`canyon()["templos"]`)."""
    V, F, pecas = [], [], []
    z_vale = PLANO * k_h
    for m in list(MESAS) + list(templos):
        cont = _contorno(m)
        nang = len(cont)
        aneis, tampa = _aneis(m, k_h)
        f0 = len(F)
        r0 = np.hypot(cont[:, 0], cont[:, 1])
        u = cont / r0[:, None]
        rng = np.random.default_rng(m["sem"] + 500)
        base = len(V)
        for k, (z, recuo) in enumerate(aneis):
            # cada anel mexe-se um pouco (a parede nao e um cilindro perfeito)
            jit = 0.0 if k == 0 else 0.22 * np.sin(np.arange(nang) * 2 * math.pi / nang * rng.integers(3, 9)
                                                    + rng.uniform(0, 6.3))
            rr = np.maximum(r0 - recuo + jit, 0.25)
            for q in range(nang):
                V.append((m["i"] + u[q, 0] * rr[q] / M_CEL, m["j"] - u[q, 1] * rr[q] / M_CEL,
                          z_vale + z * k_h))
            if k:
                a0, b0 = base + (k - 1) * nang, base + k * nang
                for q in range(nang):
                    q2 = (q + 1) % nang
                    F += [(a0 + q, a0 + q2, b0 + q2), (a0 + q, b0 + q2, b0 + q)]
        # a tampa: um leque do centro (o contorno e estrelado a volta do centro)
        topo = aneis[-1][0]
        c = len(V)
        V.append((m["i"], m["j"], z_vale + (topo + (0.25 if tampa else 1.2)) * k_h))
        a0 = base + (len(aneis) - 1) * nang
        for q in range(nang):
            F.append((a0 + q, a0 + (q + 1) % nang, c))
        pecas.append(dict(nome=m["nome"], contorno=cont, j=m["j"], i=m["i"], f0=f0, v0=base, tipo=m["tipo"]))
    V = np.array(V)
    F = np.array(F, np.int64)
    # cada peca virada para fora a volta do SEU centro (com o polegar ao lado da luva,
    # o centro "mais proximo" enganava-se)
    dobras = 0
    for k, p in enumerate(pecas):
        f1 = pecas[k + 1]["f0"] if k + 1 < len(pecas) else len(F)
        F[p["f0"]:f1] = _orientar(V, F[p["f0"]:f1], "fora", (p["i"] * M_CEL, -p["j"] * M_CEL))
        dobras += _orientar.dobras
    _orientar.dobras = dobras
    return dict(v=V, f=F, pecas=pecas)


# ── o relevo (so o preparador: usa scipy) ──────────────────────────────────────
def no_relevo(alt01, terra, d_estr, relato=None):
    """O planalto, o vale das mesas e os taludes, na grelha 0..1 (cume = 1, a 220 m).
    Devolve (alt01 novo, peso 0..1 do sudoeste, mascara das mesas)."""
    from PIL import Image, ImageDraw
    from scipy import ndimage as ndi
    th, tw = alt01.shape
    jj, ii = np.mgrid[0:th, 0:tw].astype(np.float32)
    eixo = _catmull(EIXO, 0.5)
    # distancia (m) ao eixo do canyon
    im = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(im).line([(float(p[1]), float(p[0])) for p in eixo], fill=255, width=1)
    d_eixo = ndi.distance_transform_edt(np.asarray(im) == 0) * M_CEL
    # as mesas: contorno rasterizado a 4x, e a distancia (m) a parede de fora
    SS = 4
    im = Image.new("L", (tw * SS, th * SS), 0)
    dr = ImageDraw.Draw(im)
    for m in MESAS:
        c = _contorno(m)
        dr.polygon([((m["i"] + x / M_CEL) * SS, (m["j"] - y / M_CEL) * SS) for x, y in c], fill=255)
    pegada = np.asarray(im.resize((tw, th), Image.BOX), np.float32) / 255.0 > 0.02
    d_mesa = ndi.distance_transform_edt(~pegada) * M_CEL
    d_vale = np.min([np.hypot((jj - m["j"]) * M_CEL, (ii - m["i"]) * M_CEL) - m["a"] for m in MESAS], axis=0)
    # o peso: perto do eixo ou das mesas e longe da estrada (o chao da estrada nao se mexe)
    # (a norte o canyon chega a ~100 m do eixo com a aba: o planalto vai ate 105 m e
    # morre aos 140, onde a serra volta a subir)
    # (o vale das mesas e PLANO de uma ponta a outra: com 30-60 m, entre as mesas
    # ficavam as lombas da serra de antes)
    peso = np.maximum(_suave(140.0, 105.0, d_eixo), _suave(95.0, 55.0, d_vale))
    peso = peso * _suave(16.0, 23.0, d_estr) * terra
    rng_n = (np.sin(ii * 0.21 + np.sin(jj * 0.13) * 1.7) * np.sin(jj * 0.17 - np.sin(ii * 0.11) * 1.3))
    plano = (PLANO + 1.6 * rng_n.astype(np.float32)) / H_REF
    novo = alt01 * (1 - peso) + plano * peso
    # o talude: do pe da parede (TALUDE acima do vale) ao vale em CORRIDA metros
    t = np.clip(1.0 - d_mesa / CORRIDA, 0.0, 1.0) ** 1.25
    talude = (PLANO + TALUDE * t) / H_REF
    talude = np.where(pegada, (PLANO + TALUDE) / H_REF, talude)
    novo = np.where(d_mesa < CORRIDA, np.maximum(novo, talude), novo)
    if relato is not None:
        relato["folga_mesas_cel"] = float(d_estr[d_mesa < CORRIDA].min())
        relato["folga_canyon_cel"] = float(d_estr[d_eixo < (SECCAO[-1][0] + 16.0 + ABA[1])].min())
        relato["peso_pct"] = 100.0 * float((peso > 0.5).mean())
    return novo.astype(np.float32), peso.astype(np.float32), pegada


def estratos(k_h=1.0):
    """a tabela para o mapa3d.json: [[z em m, r, g, b], ...] de baixo para cima"""
    return [[round((PLANO + z) * k_h, 2), *c] for z, c in ESTRATOS]


def cor_por_altura(z, k_h=1.0):
    """(so a bancada) a mesma tabela, por vertice"""
    tab = estratos(k_h)
    zs = np.array([t[0] for t in tab])
    cs = np.array([t[1:] for t in tab])
    return np.stack([np.interp(z, zs, cs[:, k]) for k in range(3)], axis=1)


def declive(V, F):
    """declive de cada triangulo (graus) e a area (m2)"""
    P = V[F] * np.array([M_CEL, M_CEL, 1.0])
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    a = np.linalg.norm(n, axis=1)
    dec = np.degrees(np.arccos(np.clip(np.abs(n[:, 2]) / np.maximum(a, 1e-9), 0, 1)))
    return dec, a / 2


if __name__ == "__main__":
    import os
    U = os.path.join(os.path.dirname(os.path.abspath(__file__)), "usa")
    R = np.load(os.path.join(U, "_altura.npy")) * H_REF
    cy = canyon(R)
    dec, area = declive(cy["v"], cy["f"])
    dentro = (cy["camada"][cy["f"]] >= 0).all(axis=1)
    print("canyon: %d vertices, %d triangulos, %d filas x %d, %d dobras" % (len(cy["v"]), len(cy["f"]), cy["n"], cy["ncol"], _orientar.dobras))
    for lim in (30, 60, 75):
        print("  area dentro com mais de %d graus: %.0f%%" % (lim, 100 * area[dentro & (dec > lim)].sum() / area[dentro].sum()))
    R2, nb = baixar_chao(R, cy)
    print("  chao baixado em %d vertices;" % nb, provar_costura(R2, R, cy))
    ms = mesas(templos=cy["templos"])
    print("  pes de mesa a vista (com o chao ja baixado):", provar_pes(R2, ms) or "nenhum")
    print("mesas: %d faces do avesso; templos: %s" % (_orientar.dobras, [(round(q["folga"], 1)) for q in cy["templos"]]))
    dec, area = declive(ms["v"], ms["f"])
    print("mesas: %d pecas, %d vertices, %d triangulos; paredes a mais de 75 graus: %.0f%% da area"
          % (len(MESAS), len(ms["v"]), len(ms["f"]), 100 * area[dec > 75].sum() / area.sum()))
