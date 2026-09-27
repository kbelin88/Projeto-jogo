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
def ponte(G, x, y, rumo, vao, z_via, z_agua, largura=11.0):
    """ponte de arcos em arenito, a cavalo da estrada.

    (x, y) o meio; `rumo` o da ESTRADA; `vao` o comprimento entre pegoes;
    `z_via` a superficie da estrada ali (o forno pos-a a passar por cima da
    agua); `z_agua` o nivel do rio. O tabuleiro e CALCADO e fica 12 cm acima da
    fita da estrada, e mais largo do que ela: de cima le-se a ponte, e nao a
    estrada a atravessar o rio.
    """
    ux, uy = math.cos(rumo), math.sin(rumo)
    vx, vy = -uy, ux
    hl = largura / 2
    topo = z_via + 0.12                          # a face de cima do lajedo
    ESP = 1.5                                    # corpo de pedra por baixo
    base = z_agua - 1.8                          # os pilares assentam no leito
    L_tot = vao + 4.0
    M = A2._TR(x, y, 0.0, rumo)
    # o lajedo e o corpo
    A2.caixa(G, "ponte_lajedo", x, y, topo - 0.25, L_tot, largura - 1.2, 0.25, rz=rumo)
    A2.caixa(G, "ponte", x, y, topo - ESP, L_tot, largura, ESP - 0.25, rz=rumo)
    # a cornija: uma faixa escura a toda a volta, por baixo dos parapeitos
    for s_ in (-1, 1):
        A2.caixa(G, "ponte_escura", x + vx * s_ * (hl + 0.15), y + vy * s_ * (hl + 0.15), topo - 0.55,
                 L_tot + 0.4, 0.5, 0.45, rz=rumo)
        # parapeitos com capeamento
        A2.caixa(G, "ponte", x + vx * s_ * (hl - 0.35), y + vy * s_ * (hl - 0.35), topo - 0.25,
                 L_tot, 0.6, 1.25, rz=rumo)
        A2.caixa(G, "ponte_escura", x + vx * s_ * (hl - 0.35), y + vy * s_ * (hl - 0.35), topo + 1.0,
                 L_tot + 0.1, 0.8, 0.22, rz=rumo)
        # os pegoes das pontas: blocos que abrem para a estrada
        for q in (-1, 1):
            A2.caixa(G, "ponte_escura", x + ux * q * (L_tot / 2 - 0.6) + vx * s_ * (hl - 0.2),
                     y + uy * q * (L_tot / 2 - 0.6) + vy * s_ * (hl - 0.2), topo - 0.25,
                     1.4, 1.2, 1.85, rz=rumo)
    # os arcos
    n = max(1, int(round(vao / 10.0)))
    L = vao / n
    fundo = topo - ESP
    flecha = min(L * 0.48, max(1.2, fundo - z_agua - 0.4))
    for k in range(1, n):
        t = -vao / 2 + k * L
        cx, cy = x + ux * t, y + uy * t
        A2.caixa(G, "ponte", cx, cy, base, 2.0, largura - 0.4, fundo - base, rz=rumo)
        # os talha-mares: prismas em bico dos dois lados do pilar, ate meio
        for s_ in (-1, 1):
            h_tm = max(0.8, (z_agua + 1.4) - base)
            v, f = [], []
            for zz in (base, base + h_tm):
                v += [(t - 1.0, s_ * (hl - 0.2), zz), (t + 1.0, s_ * (hl - 0.2), zz),
                      (t, s_ * (hl + 1.6), zz)]
            f = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
            f += [tuple(reversed(ff)) for ff in f]
            G.por("ponte_escura", v, f, M)
    NS = 12
    for k in range(n):
        t0 = -vao / 2 + k * L
        # o timpano (a pedra entre o arco e o corpo) e o intradorso
        v, f = [], []
        for s_ in (-hl + 0.05, hl - 0.05):
            for i in range(NS + 1):
                a = i / NS
                v.append((t0 + a * L, s_, fundo - flecha * math.sin(math.pi * a)))
            v.append((t0 + L, s_, fundo))
            v.append((t0, s_, fundo))
        m = NS + 3
        frente = tuple(range(m))
        tras = tuple(m + i for i in range(m))
        f += [frente, tuple(reversed(frente)), tras, tuple(reversed(tras))]
        for i in range(NS):
            f.append((i, i + 1, m + i + 1, m + i))
            f.append((m + i, m + i + 1, i + 1, i))
        G.por("ponte", v, f, M)
        # as aduelas: um anel escuro a contornar o arco, saliente 12 cm
        for s_ in (-1, 1):
            v, f = [], []
            y0 = s_ * (hl + 0.07)
            for i in range(NS + 1):
                a = i / NS
                tt = t0 + a * L
                zi = fundo - flecha * math.sin(math.pi * a)
                # a normal ao arco, no plano da face
                dz = -flecha * math.pi * math.cos(math.pi * a) / L
                nn = math.hypot(1.0, dz)
                ox, oz = -dz / nn, 1.0 / nn
                v += [(tt, y0, zi), (tt + ox * 0.75, y0, zi + oz * 0.75)]
            for i in range(NS):
                q = (2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1)
                f += [q, tuple(reversed(q))]
            G.por("ponte_escura", v, f, M)
