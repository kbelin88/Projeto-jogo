"""O PORTO DA ENSEADA (26/09): um pontao de madeira e barcos de pesca.

A praia a sul de Sevilha e a que mais aparece na moldura de gravacao (marca do
Lucas). Uma praia vazia le-se como maquete; um pontao e dois barcos dizem
"aqui vive gente" -- o mesmo papel dos campos e das cercas em volta das aldeias.

Nao e uma peca instanciada: entra na MESMA geometria das aldeias novas
(`aldeia2.Malhas`, uma malha por material), e por isso chega ao jogo pelo
prefixo `aldeia2_` sem tocar no `mapa3d.js`. Os materiais sao os das aldeias:
madeira, cal (o casco branco), barra_azul (a risca do Algarve), toldo.

Coordenadas: x, y no chao do mapa (metros), z para cima. `rumo` e o angulo da
direcao terra -> mar.
"""
import math

from mathutils import Matrix

import aldeia2 as A2

DECK_Z = 1.25             # o tabuleiro do pontao, acima do mar
LARGURA = 2.6


def pontao(G, x0, y0, rumo, comprimento, fundo_em, esc=1.0):
    """tabuleiro de tabuas + estacas. (x0, y0) e o inicio, na areia.

    `fundo_em(x, y)` da a altura do chao (ou do fundo do mar) para as estacas
    descerem ate ele, e nao ficarem a boiar nem a furar a praia. `esc`
    engrossa tudo (tabuas, largura, estacas, carga) menos o comprimento.
    """
    ux, uy = math.cos(rumo), math.sin(rumo)
    vx, vy = -uy, ux
    rz = rumo
    e = esc
    DZ, LG = DECK_Z * e, LARGURA * e
    # tabuas de 0,55 m, com uma fresta: de longe le-se a madeira em riscas
    passo = 0.62 * e
    for i in range(int(comprimento / passo)):
        t = 0.3 * e + i * passo
        A2.caixa(G, "madeira", x0 + ux * t, y0 + uy * t, DZ, 0.55 * e, LG, 0.12 * e, rz=rz)
    # longarinas por baixo
    for s in (-1, 1):
        mx = x0 + ux * comprimento / 2 + vx * s * (LG / 2 - 0.25 * e)
        my = y0 + uy * comprimento / 2 + vy * s * (LG / 2 - 0.25 * e)
        A2.caixa(G, "casca", mx, my, DZ - 0.28 * e, comprimento, 0.22 * e, 0.28 * e, rz=rz)
    # estacas de 3 em 3 m, dos dois lados, ate ao fundo
    t = 1.0
    while t <= comprimento + 0.01:
        for s in (-1, 1):
            ex = x0 + ux * t + vx * s * (LG / 2 - 0.1 * e)
            ey = y0 + uy * t + vy * s * (LG / 2 - 0.1 * e)
            base = min(fundo_em(ex, ey), DZ - 0.4) - 0.6
            alto = DZ + (0.55 * e if t > comprimento - 1.5 * e else 0.12 * e) - base
            A2.cilindro(G, "casca", ex, ey, base, 0.16 * e, alto, n=6)
        t += 3.0
    # a ponta: um cabeco para amarrar, caixas e um barril
    px_, py_ = x0 + ux * (comprimento - 1.2 * e), y0 + uy * (comprimento - 1.2 * e)
    A2.caixa(G, "madeira", px_ + vx * 0.7 * e, py_ + vy * 0.7 * e, DZ + 0.12 * e,
             0.7 * e, 0.6 * e, 0.55 * e, rz=rz + 0.3)
    A2.caixa(G, "madeira", px_ + (vx * 0.9 - ux * 0.8) * e, py_ + (vy * 0.9 - uy * 0.8) * e,
             DZ + 0.12 * e, 0.55 * e, 0.55 * e, 0.45 * e, rz=rz - 0.2)
    A2.cilindro(G, "casca", px_ - vx * 0.8 * e, py_ - vy * 0.8 * e, DZ + 0.12 * e,
                0.32 * e, 0.8 * e, n=10, r2=0.34 * e)


def barco(G, x, y, z, rz, L=7.2, B=2.3, H=1.05, mastro=False, adernar=0.0, esc=1.0):
    """barco de pesca: casco branco, risca azul, borda de madeira.

    O casco e aberto -- oco por dentro, com o fundo em tabuado -- porque um
    barco visto de cima (que e como o jogo o ve) le-se pelo INTERIOR.
    """
    # secoes da popa (0) a proa (1): meia-largura em cima e no fundo, e a
    # tosa (a borda sobe na proa)
    sec = [(0.00, 0.78, 0.35, 0.10), (0.18, 0.96, 0.45, 0.00), (0.45, 1.00, 0.48, 0.00),
           (0.72, 0.86, 0.36, 0.08), (0.90, 0.48, 0.14, 0.22), (1.00, 0.00, 0.00, 0.36)]
    hb = B / 2
    Z_RISCA = 0.62 * H
    fora_fundo, fora_risca, fora_topo, dentro_topo, dentro_fundo = [], [], [], [], []
    for t, wt, wb, tosa in sec:
        xs = (t - 0.5) * L
        fora_fundo.append((xs, wb * hb, 0.0))
        fora_risca.append((xs, (wb + (wt - wb) * 0.78) * hb, Z_RISCA))
        fora_topo.append((xs, wt * hb, H + tosa * H))
        dentro_topo.append((xs, max(0.0, wt * hb - 0.14), H + tosa * H))
        dentro_fundo.append((xs, max(0.0, wb * hb - 0.10), 0.34 * H))
    # `esc` aumenta o barco inteiro: o jogo ve-o de centenas de metros
    M = A2._TR(x, y, z, rz, rx=adernar) @ Matrix.Scale(esc, 4)

    def lado(mat, a, b, s):
        """faixa entre duas fiadas de pontos, do lado s (+1 bombordo, -1 estibordo)"""
        v, f = [], []
        for p in a:
            v.append((p[0], s * p[1], p[2]))
        for p in b:
            v.append((p[0], s * p[1], p[2]))
        n = len(a)
        # as DUAS faces: o material das aldeias e de uma so, e um casco fino
        # ve-se de dentro e de fora
        for i in range(n - 1):
            q = (i, i + 1, n + i + 1, n + i)
            f.append(q)
            f.append(tuple(reversed(q)))
        G.por(mat, v, f, M)

    for s in (1, -1):
        lado("cal", [(p[0], p[1], p[2]) for p in fora_fundo], fora_risca, -s)
        lado("barra_azul", fora_risca, fora_topo, -s)
        lado("madeira", fora_topo, dentro_topo, -s)             # a borda
        lado("madeira", dentro_topo, dentro_fundo, s)           # o costado por dentro
    # o fundo por fora (quilha) e o tabuado por dentro
    for fiada, zf, mat, cima in ((fora_fundo, 0.0, "cal", False), (dentro_fundo, 0.34 * H, "casca", True)):
        v = [(p[0], p[1], zf) for p in fiada] + [(p[0], -p[1], zf) for p in fiada]
        n = len(fiada)
        f = []
        for i in range(n - 1):
            q = (i, i + 1, n + i + 1, n + i)
            f.append(q)
            f.append(tuple(reversed(q)))
        G.por(mat, v, f, M)
    # o painel da popa (fechado, por fora e por dentro)
    p0 = fora_fundo[0], fora_topo[0], dentro_topo[0], dentro_fundo[0]
    v = [(p0[0][0], p0[0][1], 0.0), (p0[0][0], -p0[0][1], 0.0),
         (p0[1][0], -p0[1][1], p0[1][2]), (p0[1][0], p0[1][1], p0[1][2])]
    G.por("barra_azul", v, [(0, 3, 2, 1), (0, 1, 2, 3)], M)
    # bancadas, no referencial do barco
    for t in (0.30, 0.58):
        xs = (t - 0.5) * L
        hz = 0.62 * H
        hx, hy = 0.19, B * 0.40
        v = [(xs - hx, -hy, hz), (xs + hx, -hy, hz), (xs + hx, hy, hz), (xs - hx, hy, hz),
             (xs - hx, -hy, hz + 0.08), (xs + hx, -hy, hz + 0.08), (xs + hx, hy, hz + 0.08), (xs - hx, hy, hz + 0.08)]
        G.por("madeira", v, [(4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (3, 0, 4, 7)], M)
    if mastro:
        # mastro com a vela recolhida na verga: da a silhueta de barco de longe
        n = 6
        v, f = [], []
        for k in range(n):
            a = 2 * math.pi * k / n
            v.append((0.12 * L + 0.09 * math.cos(a), 0.09 * math.sin(a), 0.34 * H))
        for k in range(n):
            a = 2 * math.pi * k / n
            v.append((0.12 * L + 0.06 * math.cos(a), 0.06 * math.sin(a), 0.34 * H + 5.2))
        for k in range(n):
            f.append((k, (k + 1) % n, n + (k + 1) % n, n + k))
        G.por("casca", v, f, M)
        # a vela enrolada: um fuso de linho ao longo da verga
        v, f = [], []
        xa, xb, zv = 0.12 * L - 0.4, -0.30 * L, 0.34 * H + 4.2
        pts = [(xa, 0.10), ((xa + xb) / 2, 0.24), (xb, 0.10)]
        for xx, r in pts:
            for k in range(n):
                a = 2 * math.pi * k / n
                v.append((xx, r * math.cos(a), zv + r * math.sin(a)))
        for j in range(len(pts) - 1):
            for k in range(n):
                f.append((j * n + k, j * n + (k + 1) % n, (j + 1) * n + (k + 1) % n, (j + 1) * n + k))
        G.por("toldo_vermelho", v, f, M)


# ── AS PONTES (F4, 26/09) ────────────────────────────────────────────────────
# Onde um rio cruza uma estrada. A estrada (a fita) fica a altura de antes do
# rio -- e o tabuleiro; aqui poe-se o que a SEGURA: a laje de pedra por baixo,
# os arcos, os pilares ate ao leito e os parapeitos. Pedra das aldeias, para a
# ponte ser da mesma terra que as muralhas.
def ponte(G, ponto, perfil, vao, z_agua, largura=9.0):
    """ponte de pedra rustica, a seguir a estrada (27/09, 3.a versao).

    A referencia do Lucas (estilo AoE4): estreita -- a largura da estrada --,
    CORCUNDA, em pedras irregulares, com parapeitos baixos de pedra e um ou dois
    arcos redondos. `ponto(t)` e `perfil(t)` dao o eixo da estrada e a sua
    altura a `t` metros do meio da ponte (o forno ja la pos a corcunda); a ponte
    segue-os, e por isso nunca fica ao lado da estrada nem abaixo dela.
    """
    hl = largura / 2
    L2 = vao / 2 + 2.5                         # meio comprimento, com os encontros
    N = max(12, int(vao / 1.2))
    ts = [(-L2 + 2 * L2 * k / N) for k in range(N + 1)]

    def base_em(t):
        x, y = ponto(t)
        x1, y1 = ponto(t + 0.8)
        x0, y0 = ponto(t - 0.8)
        return x, y, math.atan2(y1 - y0, x1 - x0), perfil(t)

    anel = [base_em(t) for t in ts]
    I = A2._TR(0, 0, 0)

    def faixa(mat, a_, b_, za, zb):
        v, f = [], []
        for (x, y, r, z) in anel:
            nx, ny = -math.sin(r), math.cos(r)
            v.append((x + nx * a_, y + ny * a_, z + za))
            v.append((x + nx * b_, y + ny * b_, z + zb))
        for k in range(len(anel) - 1):
            q = (2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1)
            f += [q, tuple(reversed(q))]
        G.por(mat, v, f, I)

    # o tabuleiro, calcado
    # 0,5 m acima do eixo: a fita da estrada (com desvio de poligono) furava
    faixa("ponte_calcada", -hl + 0.5, hl - 0.5, 0.5, 0.5)
    z_min = min(a[3] for a in anel)
    fundo_corpo = z_min - 1.4
    for s_ in (-1, 1):
        # a face do corpo, do tabuleiro ao fundo
        v, f = [], []
        for (x, y, r, z) in anel:
            nx, ny = -math.sin(r), math.cos(r)
            v.append((x + nx * hl * s_, y + ny * hl * s_, z + 0.5))
            v.append((x + nx * hl * s_, y + ny * hl * s_, fundo_corpo))
        for k in range(len(anel) - 1):
            q = (2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1)
            f += [q, tuple(reversed(q))]
        G.por("ponte_rustica", v, f, I)
        # o parapeito: muro baixo de pedra, com capeamento escuro, a abrir nas pontas
        for k in range(len(anel) - 1):
            x0, y0, r0, z0 = anel[k]
            x1, y1, r1, z1 = anel[k + 1]
            ab = 1.0 + 0.5 * max(0.0, (abs(ts[k]) - (L2 - 3.0)) / 3.0)
            nx, ny = -math.sin(r0), math.cos(r0)
            cx = (x0 + x1) / 2 + nx * (hl - 0.3) * s_ * ab
            cy = (y0 + y1) / 2 + ny * (hl - 0.3) * s_ * ab
            comp = math.hypot(x1 - x0, y1 - y0) + 0.05
            rz = math.atan2(y1 - y0, x1 - x0)
            A2.caixa(G, "ponte_rustica", cx, cy, min(z0, z1) + 0.45, comp, 0.6, 0.95 + abs(z1 - z0), rz=rz)
            A2.caixa(G, "ponte_rustica_esc", cx, cy, max(z0, z1) + 1.35, comp, 0.72, 0.18, rz=rz)
        for q in (0, -1):
            x, y, r, z = anel[q]
            nx, ny = -math.sin(r), math.cos(r)
            A2.caixa(G, "ponte_rustica_esc", x + nx * (hl + 0.3) * s_, y + ny * (hl + 0.3) * s_, z - 0.2,
                     0.95, 0.95, 1.5, rz=r)
    # -- OS ARCOS: um ou dois, redondos; o timpano a volta do vao aberto, o
    # intradorso, e as aduelas em leque
    n = 1 if vao < 26 else 2
    Lv = vao / n
    x_m, y_m, r_m, _ = base_em(0.0)
    ux, uy = math.cos(r_m), math.sin(r_m)
    topo_arco = min(z_min - 1.0, z_agua + Lv * 0.42)
    base_a = z_agua - 1.2
    nasc = base_a + 1.0
    NS = 14
    M = A2._TR(x_m, y_m, 0.0, r_m)
    for k in range(n):
        t0 = -vao / 2 + k * Lv
        v, f = [], []
        for s_ in (-hl + 0.05, hl - 0.05):
            for i in range(NS + 1):
                a = i / NS
                v.append((t0 + a * Lv, s_, nasc + (topo_arco - nasc) * math.sin(math.pi * a)))
            v.append((t0 + Lv, s_, fundo_corpo))
            v.append((t0, s_, fundo_corpo))
        m_ = NS + 3
        fr = tuple(range(m_))
        tr = tuple(m_ + i for i in range(m_))
        f += [fr, tuple(reversed(fr)), tr, tuple(reversed(tr))]
        for i in range(NS):
            f.append((i, i + 1, m_ + i + 1, m_ + i))
            f.append((m_ + i, m_ + i + 1, i + 1, i))
        G.por("ponte_rustica", v, f, M)
        for s_ in (-1, 1):
            for i in range(NS):
                a = (i + 0.5) / NS
                tt = t0 + a * Lv
                zz = nasc + (topo_arco - nasc) * math.sin(math.pi * a)
                ang = math.atan2((topo_arco - nasc) * math.pi * math.cos(math.pi * a) / Lv, 1.0)
                vv = [(-0.3, -0.12, -0.05), (0.3, -0.12, -0.05), (0.3, 0.12, -0.05), (-0.3, 0.12, -0.05),
                      (-0.3, -0.12, 0.85), (0.3, -0.12, 0.85), (0.3, 0.12, 0.85), (-0.3, 0.12, 0.85)]
                ff = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
                G.por("ponte_rustica_esc", vv, ff, M @ A2._TR(tt, s_ * (hl + 0.06), zz, 0.0, 0.0, -ang))
    for k in range(1, n):
        t = -vao / 2 + k * Lv
        A2.caixa(G, "ponte_rustica", x_m + ux * t, y_m + uy * t, base_a, 2.2, largura - 0.2,
                 fundo_corpo - base_a + 0.5, rz=r_m)
    for q in (-1, 1):
        t = q * (vao / 2 + 0.6)
        A2.caixa(G, "ponte_rustica_esc", x_m + ux * t, y_m + uy * t, base_a, 1.8, largura + 0.6,
                 fundo_corpo - base_a + 0.4, rz=r_m)


# -- A BEIRA DA ESTRADA (27/09) ------------------------------------------------
# A referencia do Lucas: o que faz uma estrada VIVER sao as coisas ao lado dela
# -- muros de pedra seca, cercas de madeira, marcos e carrocas. Muros e cercas
# aparecem as dezenas, por isso sao peças leves feitas aqui (nao TRELLIS).
def muro_seco(G, pts, alt_em, semente=0):
    """muro de pedra seca ao longo de `pts` [(x, y)]: blocos irregulares em
    duas fiadas, com a altura a variar e o topo recortado"""
    import random as _r
    rnd = _r.Random(semente)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.5:
            continue
        rz = math.atan2(y1 - y0, x1 - x0)
        t = 0.0
        while t < L:
            c = rnd.uniform(0.9, 1.6)
            u = min(t + c / 2, L)
            x, y = x0 + (x1 - x0) * u / L, y0 + (y1 - y0) * u / L
            z = alt_em(x, y) - 0.15
            h1 = rnd.uniform(0.45, 0.6)
            A2.caixa(G, "muro_seco", x, y, z, c, rnd.uniform(0.7, 0.85), h1, rz=rz + rnd.uniform(-0.06, 0.06))
            if rnd.random() < 0.85:
                A2.caixa(G, "muro_seco", x + rnd.uniform(-0.2, 0.2), y + rnd.uniform(-0.1, 0.1), z + h1,
                         c * rnd.uniform(0.6, 0.95), rnd.uniform(0.55, 0.7), rnd.uniform(0.35, 0.5),
                         rz=rz + rnd.uniform(-0.1, 0.1))
            t += c


def cerca(G, pts, alt_em, semente=0, passo=2.6):
    """cerca de madeira: postes de 2,6 em 2,6 m e duas travessas"""
    import random as _r
    rnd = _r.Random(semente)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(round(L / passo)))
        rz = math.atan2(y1 - y0, x1 - x0)
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            A2.cilindro(G, "cerca_madeira", x, y, alt_em(x, y) - 0.2, 0.09, 1.45 + rnd.uniform(-0.1, 0.1), n=6)
        for hz in (0.55, 1.05):
            xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
            A2.caixa(G, "cerca_madeira", xm, ym, alt_em(xm, ym) + hz, L + 0.2, 0.08, 0.11,
                     rz=rz, rx=rnd.uniform(-0.03, 0.03))



def _anel(G, mat, M, cx, cz, r_ext, r_int, larg, n=18):
    """um aro (roda) no plano XZ local, centrado em (cx, cz), espessura `larg` em Y"""
    v, f = [], []
    for y in (-larg / 2, larg / 2):
        for k in range(n):
            a = 2 * math.pi * k / n
            v.append((cx + r_ext * math.cos(a), y, cz + r_ext * math.sin(a)))
            v.append((cx + r_int * math.cos(a), y, cz + r_int * math.sin(a)))
    for k in range(n):
        k2 = (k + 1) % n
        a0, b0, a1, b1 = 2 * k, 2 * k + 1, 2 * k2, 2 * k2 + 1
        o = 2 * n
        f += [(a0, a1, b1, b0), (o + a0, o + b0, o + b1, o + a1),          # faces
              (a0, o + a0, o + a1, a1), (b0, b1, o + b1, o + b0)]          # aro fora e dentro
    G.por(mat, v, f, M)


def carroca(G, x, y, z, rz, esc=1.0, semente=0):
    """a carroca da referencia (gerada no SDXL e copiada aqui): caixa de tabuas,
    duas rodas grandes de raios, varais pousados no chao e carga de barris e
    sacos. ~4 m de comprido."""
    import random as _r
    rnd = _r.Random(semente)
    M = A2._TR(x, y, z, rz) @ Matrix.Scale(esc, 4)
    R = 0.62                                   # raio da roda
    # a caixa: fundo e quatro bordas de tabuas, 2,4 x 1,4
    def cx_(mat, px, py, pz, sx, sy, sz, rx=0.0):
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        vv = [(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0),
              (-hx, -hy, sz), (hx, -hy, sz), (hx, hy, sz), (-hx, hy, sz)]
        ff = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        G.por(mat, vv, ff, M @ A2._TR(px, py, pz, 0.0, rx))
    zb = R + 0.05
    cx_("madeira", 0, 0, zb, 2.4, 1.4, 0.1)
    for sy in (-1, 1):
        for k in range(3):                     # tres tabuas por lado, com fresta
            cx_("madeira", 0, sy * 0.68, zb + 0.1 + k * 0.17, 2.4, 0.06, 0.13)
        for sx in (-1, 0, 1):                  # os fueiros
            cx_("casca", sx * 1.1, sy * 0.72, zb - 0.05, 0.08, 0.08, 0.72)
    for sx in (-1, 1):
        for k in range(3):
            cx_("madeira", sx * 1.18, 0, zb + 0.1 + k * 0.17, 0.06, 1.4, 0.13)
    # o eixo e as rodas (aro, cubo, 10 raios)
    cx_("casca", 0.2, 0, R - 0.06, 0.12, 1.75, 0.12)
    for sy in (-1, 1):
        Mr = M @ A2._TR(0.2, sy * 0.86, 0.0)
        _anel(G, "casca", Mr, 0.0, R, R, R - 0.09, 0.1)
        v, f = [], []
        for k in range(10):
            a = 2 * math.pi * k / 10
            ca, sa = math.cos(a), math.sin(a)
            b = len(v)
            for rr in (0.1, R - 0.08):
                v += [(rr * ca - 0.025 * sa, -0.03, R + rr * sa + 0.025 * ca),
                      (rr * ca + 0.025 * sa, -0.03, R + rr * sa - 0.025 * ca),
                      (rr * ca + 0.025 * sa, 0.03, R + rr * sa - 0.025 * ca),
                      (rr * ca - 0.025 * sa, 0.03, R + rr * sa + 0.025 * ca)]
            f += [(b, b + 1, b + 5, b + 4), (b + 1, b + 2, b + 6, b + 5),
                  (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 7)]
        G.por("madeira", v, f, Mr)
        _anel(G, "casca", Mr, 0.0, R, 0.12, 0.0, 0.2, n=8)          # o cubo
    # os varais, a descer ate ao chao a frente
    for sy in (-0.4, 0.4):
        vv, ff = [], []
        x0, z0, x1, z1 = 1.1, zb + 0.05, 2.9, 0.05
        for (xx, zz) in ((x0, z0), (x1, z1)):
            vv += [(xx, sy - 0.04, zz - 0.04), (xx, sy + 0.04, zz - 0.04),
                   (xx, sy + 0.04, zz + 0.04), (xx, sy - 0.04, zz + 0.04)]
        ff = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        G.por("casca", vv, ff, M)
    # a carga: barris de pe e deitados, e sacos
    for (bx, by) in ((-0.6, -0.3), (-0.6, 0.32), (0.25, 0.0)):
        # o barril: dois troncos de cone costas com costas, tampa e aros de ferro
        h = 0.72 + rnd.uniform(-0.05, 0.05)
        Mb = M @ A2._TR(bx, by, zb + 0.1)
        for zz, r0, r1 in ((0.0, 0.26, 0.31), (h * 0.5, 0.31, 0.26)):
            v, f = [], []
            for k in range(12):
                a = 2 * math.pi * k / 12
                v.append((r0 * math.cos(a), r0 * math.sin(a), zz))
            for k in range(12):
                a = 2 * math.pi * k / 12
                v.append((r1 * math.cos(a), r1 * math.sin(a), zz + h * 0.5))
            for k in range(12):
                f.append((k, (k + 1) % 12, 12 + (k + 1) % 12, 12 + k))
            G.por("madeira", v, f, Mb)
        v = [(0.26 * math.cos(2 * math.pi * k / 12), 0.26 * math.sin(2 * math.pi * k / 12), h) for k in range(12)]
        G.por("casca", v, [tuple(range(12))], Mb)
        for zz in (h * 0.18, h * 0.82):
            _anel(G, "ferro", Mb @ A2._TR(0, 0, zz) @ Matrix.Rotation(math.pi / 2, 4, "X"),
                  0.0, 0.0, 0.305, 0.28, 0.05, n=12)
    for (sx, sy) in ((0.55, 0.35), (0.95, 0.3)):
        vv, ff = [], []
        Ms = M @ A2._TR(sx, sy, zb + 0.1)
        n = 8
        for zz, r in ((0.0, 0.18), (0.16, 0.24), (0.34, 0.16), (0.42, 0.05)):
            for k in range(n):
                a = 2 * math.pi * k / n
                vv.append((r * math.cos(a) * 1.3, r * math.sin(a), zz))
        for j in range(3):
            for k in range(n):
                ff.append((j * n + k, j * n + (k + 1) % n, (j + 1) * n + (k + 1) % n, (j + 1) * n + k))
        G.por("saco", vv, ff, Ms)


def marco(G, x, y, z, rz, esc=1.0):
    """o marco da referencia: pilar de pedra afunilado com remate em piramide, e
    um poste com duas tabuas-seta"""
    M = A2._TR(x, y, z, rz) @ Matrix.Scale(esc, 4)
    v, f = [], []
    for zz, h in ((0.0, 0.42), (1.7, 0.32)):
        v += [(-h, -h, zz), (h, -h, zz), (h, h, zz), (-h, h, zz)]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    G.por("muro_seco", v, f, M)
    vp = [(-0.38, -0.38, 1.7), (0.38, -0.38, 1.7), (0.38, 0.38, 1.7), (-0.38, 0.38, 1.7), (0, 0, 2.35)]
    G.por("ponte_rustica_esc", vp, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)], M)
    # o poste e as setas, a frente do pilar
    Mp = M @ A2._TR(0.55, 0, 0)
    vv = []
    for zz, r in ((0.0, 0.06), (2.1, 0.05)):
        for k in range(6):
            a = 2 * math.pi * k / 6
            vv.append((r * math.cos(a), r * math.sin(a), zz))
    G.por("casca", vv, [(k, (k + 1) % 6, 6 + (k + 1) % 6, 6 + k) for k in range(6)], Mp)
    for zz, ang, sgn in ((1.85, 0.5, 1), (1.55, -0.6, -1)):
        va = [(0.0, -0.05, -0.1), (0.7, -0.05, -0.1), (0.85, -0.05, 0.0), (0.7, -0.05, 0.1), (0.0, -0.05, 0.1),
              (0.0, 0.05, -0.1), (0.7, 0.05, -0.1), (0.85, 0.05, 0.0), (0.7, 0.05, 0.1), (0.0, 0.05, 0.1)]
        fa = [(0, 1, 2, 3, 4), (9, 8, 7, 6, 5), (0, 5, 6, 1), (1, 6, 7, 2), (2, 7, 8, 3), (3, 8, 9, 4), (4, 9, 5, 0)]
        G.por("madeira", [(sgn * a, b, c) for a, b, c in va], fa if sgn > 0 else [tuple(reversed(q)) for q in fa],
              Mp @ A2._TR(0, 0, zz, ang))
