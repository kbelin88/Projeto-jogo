# povoar.py — o que faz a terra parecer habitada: campos, cercas e pedras.
#
# ── PORQUE E UM MODULO A PARTE, E SEM bpy ───────────────────────────────────
# Aqui so ha geometria: listas de vertices, faces e cores. Quem as transforma
# em objetos e o `exportar_mapa.py`, com o mesmo `_pousar` que ja assenta a
# areia e o labio de rocha. Assim isto corre e testa-se sem abrir o Blender, e
# o forno nao cresce mais 300 linhas.
#
# ── E PORQUE NAO SAO PECAS INSTANCIADAS ─────────────────────────────────────
# Um campo nao se repete: cada parcela tem a forma do sitio onde esta, segue o
# declive e para onde a estrada passa. Instanciar uma "peca campo" daria o
# mesmo retangulo 80 vezes -- que e exatamente o ar de carimbo que se quer
# evitar. E sao poucos triangulos: uma parcela custa menos que uma casa.
#
# Tudo com semente fixa: o mapa e sempre o mesmo, entre fornadas e entre o
# jogo e o video.
import math
import random

# as regras, num sitio so
PARCELA = (26.0, 48.0, 16.0, 30.0)   # comprimento min/max, largura min/max
SULCO = 2.3                          # largura de cada rego, em metros
DECLIVE_MAX = 11.0                   # acima disto ninguem lavra
ANEL = (34.0, 135.0)                 # distancia a muralha onde os campos cabem
POSTE = 3.2                          # de quantos em quantos metros vai um poste
ALT_CERCA = 1.15


def _quad(va, fa, cores, p0, p1, p2, p3, cor):
    # ── A ORDEM DOS CANTOS DECIDE PARA ONDE A FACE OLHA ─────────────────────
    # Uma parcela rodada mais de 90 graus inverte a ordem, a normal passa a
    # apontar para BAIXO e a face sai PRETA -- foi o que apareceu ao lado de
    # Santarem na primeira fornada. Aqui mede-se e, se for preciso, troca-se.
    ax, ay = p1[0] - p0[0], p1[1] - p0[1]
    bx, by = p2[0] - p0[0], p2[1] - p0[1]
    if ax * by - ay * bx < 0:
        p0, p1, p2, p3 = p3, p2, p1, p0
    i = len(va)
    va.extend([p0, p1, p2, p3])
    cores.extend([cor] * 4)
    fa.append((i, i + 1, i + 2, i + 3))


def _caixa(va, fa, cores, x, y, z, larg, comp, alt, ang, cor):
    """uma caixa assente no chao, virada `ang`"""
    c, s = math.cos(ang), math.sin(ang)
    cantos = []
    for dx, dy in ((-comp / 2, -larg / 2), (comp / 2, -larg / 2),
                   (comp / 2, larg / 2), (-comp / 2, larg / 2)):
        cantos.append((x + dx * c - dy * s, y + dx * s + dy * c))
    base = len(va)
    for cx, cy in cantos:
        va.append((cx, cy, z))
        cores.append(cor)
    for cx, cy in cantos:
        va.append((cx, cy, z + alt))
        cores.append([min(1.0, v * 1.12) for v in cor])
    fa.append((base + 4, base + 5, base + 6, base + 7))          # o topo
    for k in range(4):
        fa.append((base + k, base + (k + 1) % 4,
                   base + 4 + (k + 1) % 4, base + 4 + k))


def _cantos(px, py, comp, larg, giro):
    c, s = math.cos(giro), math.sin(giro)
    for dx, dy in ((-comp / 2, -larg / 2), (comp / 2, -larg / 2),
                   (comp / 2, larg / 2), (-comp / 2, larg / 2)):
        yield px + dx * c - dy * s, py + dx * s + dy * c


def _cabe(px, py, comp, larg, giro, altura, declive, livre):
    cs = list(_cantos(px, py, comp, larg, giro))
    pontos = [(px, py)] + cs
    # tambem os meios dos lados: uma parcela que atravessa uma estrada pelo
    # meio passava no teste so dos cantos
    for k in range(4):
        a, b = cs[k], cs[(k + 1) % 4]
        pontos.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    zs = []
    for x, y in pontos:
        if not livre(x, y) or declive(x, y) > DECLIVE_MAX:
            return False
        z = altura(x, y)
        if z < 4.0:                      # nao se lavra na beira da agua
            return False
        zs.append(z)
    return max(zs) - min(zs) < 4.5       # e nem em degrau


def _parcela(va, fa, cor, vaf, faf, corf, px, py, comp, larg, giro, altura, rnd):
    """os regos, e a cerca a toda a volta menos uma entrada"""
    c, s = math.cos(giro), math.sin(giro)
    n = max(3, int(larg / SULCO))
    # duas culturas: lavrado (castanho) e seara (verde-palha)
    seara = rnd.random() < 0.45
    base = [0.52, 0.50, 0.22] if seara else [0.42, 0.30, 0.17]
    for i in range(n):
        y0 = -larg / 2 + larg * i / n
        y1 = -larg / 2 + larg * (i + 1) / n
        k = 1.0 + (0.11 if i % 2 else -0.11) + rnd.uniform(-0.04, 0.04)
        tom = [min(1.0, v * k) for v in base]
        pts = []
        # cada rego acaba onde calha, ate 1,4 m: uma parcela com os quatro
        # lados a esquadro le-se como autocolante
        recuo0 = rnd.uniform(-1.4, 0.6)
        recuo1 = rnd.uniform(-1.4, 0.6)
        for dx, dy in ((-comp / 2 - recuo0, y0), (comp / 2 + recuo1, y0),
                       (comp / 2 + recuo1, y1), (-comp / 2 - recuo0, y1)):
            x = px + dx * c - dy * s
            y = py + dx * s + dy * c
            # o rego levanta 8 cm: de raso le-se como sulco, de cima como risca
            pts.append((x, y, altura(x, y) + 0.12 + (0.08 if i % 2 else 0.0)))
        _quad(va, fa, cor, pts[0], pts[1], pts[2], pts[3], tom)
    # ── A CERCA ──────────────────────────────────────────────────────────────
    # Postes de 3 em 3 m e duas travessas. A entrada fica num lado inteiro,
    # sorteado: uma cerca fechada a toda a volta le-se como curral, e as
    # carrocas teriam de saltar.
    cs = list(_cantos(px, py, comp, larg, giro))
    entrada = rnd.randrange(4)
    for lado in range(4):
        if lado == entrada:
            continue
        a, b = cs[lado], cs[(lado + 1) % 4]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        quantos = max(2, int(L / POSTE))
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        for q in range(quantos + 1):
            t = q / quantos
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            _caixa(vaf, faf, corf, x, y, altura(x, y) - 0.1, 0.16, 0.16,
                   ALT_CERCA + rnd.uniform(-0.08, 0.08), ang, [0.55, 0.42, 0.26])
        zm = (altura(a[0], a[1]) + altura(b[0], b[1])) / 2
        for trave in (0.45, 0.88):
            _caixa(vaf, faf, corf, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
                   zm + trave, 0.07, L, 0.09, ang, [0.58, 0.45, 0.28])


def campos_e_cercas(centros, raio_de, altura, declive, livre, semente=7):
    """parcelas lavradas em volta das aldeias, cada uma com a sua cerca.

    `livre(x, y)` diz se aquele ponto aceita campo (fora de estrada, mata,
    areia e muralha). `altura` e `declive` leem o terreno.
    """
    rnd = random.Random(semente)
    va_c, fa_c, cor_c = [], [], []      # os campos
    va_f, fa_f, cor_f = [], [], []      # as cercas
    parcelas = 0
    for cid, (cx, cy) in sorted(centros.items()):
        raio = raio_de(cid)
        postos = []
        for _ in range(rnd.randint(3, 6)):
            for _tentativa in range(40):
                ang = rnd.uniform(0, 2 * math.pi)
                d = rnd.uniform(raio + ANEL[0], raio + ANEL[1])
                px, py = cx + math.cos(ang) * d, cy + math.sin(ang) * d
                if any(math.hypot(px - qx, py - qy) < 52 for qx, qy in postos):
                    continue
                comp = rnd.uniform(PARCELA[0], PARCELA[1])
                larg = rnd.uniform(PARCELA[2], PARCELA[3])
                giro = ang + rnd.uniform(-0.5, 0.5)
                if not _cabe(px, py, comp, larg, giro, altura, declive, livre):
                    continue
                postos.append((px, py))
                _parcela(va_c, fa_c, cor_c, va_f, fa_f, cor_f,
                         px, py, comp, larg, giro, altura, rnd)
                parcelas += 1
                break
    return (va_c, fa_c, cor_c), (va_f, fa_f, cor_f), parcelas


def _icosfera():
    """icosaedro subdividido uma vez: 42 vertices, 80 faces, raio 1"""
    t = (1.0 + 5 ** 0.5) / 2.0
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t),
         (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    v = [tuple(c / math.sqrt(sum(q * q for q in p)) for c in p) for p in v]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4),
         (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8),
         (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    meio = {}

    def m(a, b):
        k = (min(a, b), max(a, b))
        if k not in meio:
            p = [(v[a][q] + v[b][q]) / 2 for q in range(3)]
            n = math.sqrt(sum(c * c for c in p))
            v.append(tuple(c / n for c in p))
            meio[k] = len(v) - 1
        return meio[k]
    f2 = []
    for a, b, c in f:
        ab, bc, ca = m(a, b), m(b, c), m(c, a)
        f2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    return v, f2


_ICO = None


def _penedo(va, fa, cor, x, y, z, r, rnd):
    """um penedo: um bloco arredondado e torto, achatado, com a base enterrada.

    (28/09) Era uma bipiramide de oito lados (16 triangulos): no chao liam-se
    como piramides cinzentas, "▲" soltos pelo mapa. Agora e uma icosfera
    deformada por tres ondas de baixa frequencia (o bloco nunca e redondo),
    achatada, rodada ao acaso, com o topo mais claro que os lados (a pedra que
    apanha sol e liquen) e a base cortada ao nivel do chao.
    """
    global _ICO
    if _ICO is None:
        _ICO = _icosfera()
    v0, f0 = _ICO
    sx, sy, sz = 1.0, rnd.uniform(0.7, 0.95), rnd.uniform(0.75, 1.05)
    # duas FRATURAS: planos que cortam o bloco -- faces lisas e arestas vivas,
    # que e o que faz um penedo ler-se como pedra e nao como seixo (visto no
    # Blender, 28/09: so com a onda sairam montinhos redondos)
    cortes = []
    for _ in range(2):
        a_, e_ = rnd.uniform(0, 2 * math.pi), rnd.uniform(-0.2, 0.9)
        cortes.append(((math.cos(a_) * math.cos(e_), math.sin(a_) * math.cos(e_), math.sin(e_)),
                       rnd.uniform(0.55, 0.75)))
    rot = rnd.uniform(0, 2 * math.pi)
    ca, sa = math.cos(rot), math.sin(rot)
    fa_ = [rnd.uniform(1.6, 2.6) for _ in range(3)]
    fb_ = [rnd.uniform(0, 6.3) for _ in range(3)]
    tom = 0.60 + rnd.uniform(-0.07, 0.07)
    quente = rnd.uniform(0.96, 1.04)
    base = len(va)
    for (px_, py_, pz_) in v0:
        k = (math.sin(px_ * fa_[0] + fb_[0]) + math.sin(py_ * fa_[1] + fb_[1])
             + math.sin(pz_ * fa_[2] + fb_[2])) / 3.0
        rr = 1.0 + 0.28 * k
        qx, qy, qz = px_ * rr, py_ * rr, pz_ * rr
        for (nx_, ny_, nz_), d_ in cortes:
            e = qx * nx_ + qy * ny_ + qz * nz_ - d_
            if e > 0:
                qx, qy, qz = qx - e * nx_, qy - e * ny_, qz - e * nz_
        lx, ly, lz = qx * r * sx, qy * r * sy, max(qz, -0.35) * r * sz
        va.append((x + lx * ca - ly * sa, y + lx * sa + ly * ca, z + lz))
        luz = 0.70 + 0.42 * max(0.0, pz_)
        cor.append([min(1.0, tom * luz * quente), min(1.0, tom * luz), min(1.0, tom * luz / quente)])
    for a, b, c in f0:
        fa.append((base + a, base + b, base + c))


def pedras(quantas, ponto_ao_acaso, altura, declive, livre, semente=13):
    """penedos soltos: onde o chao e bravo, e nunca no caminho de ninguem"""
    rnd = random.Random(semente)
    va, fa, cor = [], [], []
    postas = 0
    for _ in range(quantas * 30):
        if postas >= quantas:
            break
        x, y = ponto_ao_acaso(rnd)
        if not livre(x, y) or altura(x, y) < 3.0:
            continue
        if declive(x, y) < 9.0 and rnd.random() > 0.18:
            continue
        r = rnd.uniform(0.55, 2.1)
        _penedo(va, fa, cor, x, y, altura(x, y) - r * 0.3, r, rnd)
        postas += 1
    return (va, fa, cor), postas
