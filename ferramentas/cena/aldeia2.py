# aldeia2.py - as aldeias do mapa no estilo de Faro (26/09).
#
# ── DE ONDE VEM ──────────────────────────────────────────────────────────────
# Em 25/09 o Lucas pediu para me ver usar o Blender: montei Faro a mao, ao vivo,
# numa bancada da costa -- muralha de pedra com ameias, casas caiadas com barra
# azul ou ocre, telha, chamine algarvia, largo com poco e bancas, laranjeiras,
# palmeira. Ele aprovou ("ficou muito bom"), pediu menos alegria (sairam as
# buganvilias e a fruta, entraram lancas, escudos, alvo, lenha, braseiros) e
# depois: "uma versao para Lisboa e para Barcelona, mesmo estilo, mais
# imponente. E vamos levar tudo para o jogo."
#
# Este ficheiro e essa aldeia escrita como RECEITA, para as 24 do mapa:
#   pequena -> Faro, como foi aprovada;
#   media / grande -> a mesma, mais larga, com torres redondas no muro;
#   capital -> muralha alta com torres, CASTELO (recinto, torres de canto e
#              menagem), SE com torre sineira, largo maior, quartel.
#
# ── PORQUE GEOMETRIA CRUA E NAO bpy.ops ──────────────────────────────────────
# Montada no Blender aberto, com operadores, a Faro fez o Blender cair ao ser
# convertida (600 objetos, viewport a renderizar). Aqui cada primitiva e uma
# lista de vertices e faces com o UV ja feito: nao ha objetos, nao ha contexto,
# corre no forno em -b e da o mesmo resultado sempre.
#
# ── O QUE O glTF LEVA (CLAUDE.md, 7.3) ──────────────────────────────────────
# So imagem (por UV) -> Base Color. As tintas do Blender (MULTIPLY, e na cal um
# MIX de 78% para o branco) sao ASSADAS NA IMAGEM (`_imagem`). O UV e a
# projecao em caixa que o material do Blender fazia: eixo dominante da normal,
# em coordenadas LOCAIS da primitiva, dividido pelo ladrilho em metros.
import math
import os
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector

RAIZ = os.getcwd()
TEX = os.path.join(RAIZ, "assets", "texturas")
PASTA_TEX = os.path.join(RAIZ, "ferramentas", "cena", "_saida", "aldeia2_tex")
LADO_TEX = 1024           # uma aldeia tem 40-90 m e ve-se de 275 m

# ── OS MATERIAIS: os de Faro, tal como ficaram aprovados ─────────────────────
# pasta/metros: a fotografia e o tamanho do ladrilho; passos: as misturas do
# Blender, da imagem para fora; ajuste: o que o navegador pediu a mais (o three
# tem menos luz de ceu que o EEVEE -- as folhas sairam pretas, 26/09).
MATS = {
    "cal": dict(pasta="taipa", metros=2.5, rug=0.9,
                passos=[("MIX", 0.78, (0.84, 0.80, 0.72))]),
    "telha": dict(pasta="telha", metros=2.0, rug=0.8,
                  passos=[("MULTIPLY", 1.0, (1.0, 0.72, 0.55))]),
    "pedra": dict(pasta="pedra", metros=2.4, rug=0.95,
                  passos=[("MULTIPLY", 1.0, (1.0, 0.80, 0.56))]),
    "pedra_escura": dict(pasta="pedra", metros=2.4, rug=0.95,
                         passos=[("MULTIPLY", 1.0, (0.78, 0.64, 0.46))]),
    "madeira": dict(pasta="madeira", metros=1.6, rug=0.8,
                    passos=[("MULTIPLY", 1.0, (0.9, 0.75, 0.6))]),
    "chao": dict(pasta="caminho_batido", metros=3.0, rug=0.95,
                 passos=[("MULTIPLY", 1.0, (0.78, 0.58, 0.38))], ajuste=(0.95, 0.80, 0.62)),
    "empedrado": dict(pasta="pedra", metros=0.9, rug=0.9,
                      passos=[("MULTIPLY", 1.0, (0.9, 0.72, 0.52))], ajuste=(0.85, 0.78, 0.68)),
    "portada": dict(pasta="madeira", metros=1.2, rug=0.7,
                    passos=[("MULTIPLY", 1.0, (0.20, 0.30, 0.36))]),
    "toldo_vermelho": dict(pasta="linho", metros=1.2, rug=0.8,
                           passos=[("MULTIPLY", 1.0, (0.40, 0.13, 0.08))]),
    "toldo_azul": dict(pasta="linho", metros=1.2, rug=0.8,
                       passos=[("MULTIPLY", 1.0, (0.17, 0.21, 0.27))]),
    "toldo_amarelo": dict(pasta="linho", metros=1.2, rug=0.8,
                          passos=[("MULTIPLY", 1.0, (0.55, 0.43, 0.22))]),
    "folha_laranjeira": dict(pasta="relva", metros=1.0, rug=0.95,
                             passos=[("MULTIPLY", 1.0, (0.2, 0.45, 0.1))], ajuste=(2.2, 2.0, 1.6)),
    "palma": dict(pasta="relva", metros=1.0, rug=0.95,
                  passos=[("MULTIPLY", 1.0, (0.22, 0.42, 0.10))], ajuste=(2.0, 1.9, 1.5)),
    "tronco_palma": dict(pasta="madeira", metros=0.8, rug=0.9,
                         passos=[("MULTIPLY", 1.0, (0.62, 0.48, 0.32))], ajuste=(1.5, 1.4, 1.3)),
    "casca": dict(pasta="madeira", metros=1.6, rug=0.8,
                  passos=[("MULTIPLY", 1.0, (0.42, 0.22, 0.13))]),
    "barra_azul": dict(cor=(0.10, 0.17, 0.32), rug=0.6),
    "barra_ocre": dict(cor=(0.45, 0.28, 0.10), rug=0.6),
    "escuro": dict(cor=(0.035, 0.028, 0.024), rug=0.9),
    "ferro": dict(cor=(0.08, 0.08, 0.09), rug=0.5),
    "agua_poco": dict(cor=(0.02, 0.08, 0.10), rug=0.1),
    "feno": dict(cor=(0.80, 0.66, 0.30), rug=0.9),
    "laranjas": dict(cor=(1.0, 0.32, 0.01), rug=0.5),
    "saco": dict(cor=(0.30, 0.22, 0.12), rug=1.0),
    "escudo": dict(cor=(0.30, 0.22, 0.14), rug=0.8),
    # os braseiros: no navegador, com emissao 4, eram bolas brancas
    "brasa": dict(cor=(1.0, 0.35, 0.05), rug=0.5, emissao=1.2),
}

# ── OS TAMANHOS ──────────────────────────────────────────────────────────────
# `raio` TEM de ser o de `cozer.PERFIS`: e por ele que o forno aplana o
# patamar, puxa as pontas das estradas para dentro e desenha o chao da aldeia.
PERFIS = {
    "pequena": dict(raio=20.0, alt=3.4, esp=1.1, merlao=0.75, torres=0, t_raio=0.0, t_alt=0.0,
                    casas=9, dois_andares=0.35, menagem=(5.2, 11.0), castelo=False, se=False,
                    gate=(3.2, 5.6, 4.2), largo=6.2, bancas=3, laranjeiras=3, palmas=1,
                    cavaletes=1, alvos=1, lenhas=1, quartel=False),
    "media": dict(raio=26.0, alt=4.2, esp=1.3, merlao=0.85, torres=3, t_raio=2.4, t_alt=6.4,
                  casas=14, dois_andares=0.4, menagem=(6.0, 13.0), castelo=False, se=False,
                  gate=(3.6, 6.6, 4.6), largo=7.4, bancas=4, laranjeiras=4, palmas=1,
                  cavaletes=2, alvos=1, lenhas=2, quartel=False),
    "grande": dict(raio=34.0, alt=5.0, esp=1.5, merlao=0.95, torres=5, t_raio=2.8, t_alt=7.6,
                   casas=22, dois_andares=0.45, menagem=(7.0, 15.0), castelo=False, se="pequena",
                   gate=(4.2, 7.6, 5.0), largo=8.6, bancas=5, laranjeiras=5, palmas=2,
                   cavaletes=2, alvos=2, lenhas=2, quartel=False),
    # ── A CAPITAL: "mais imponente" ─────────────────────────────────────────
    # O que a distingue de longe e a SILHUETA: muralha de 6,5 m com torres
    # redondas a cada 40 graus, um castelo de pedra mais escura com uma menagem
    # de 21 m (o ponto mais alto do mapa, onde fica a bandeira do dono) e a
    # torre sineira da Se. De perto, o dobro das casas e um largo maior.
    "capital": dict(raio=42.0, alt=6.5, esp=2.0, merlao=1.1, torres=9, t_raio=3.4, t_alt=9.6,
                    casas=30, dois_andares=0.55, menagem=(9.0, 21.0), castelo=True, se="grande",
                    gate=(5.0, 10.0, 5.4), largo=10.5, bancas=6, laranjeiras=6, palmas=3,
                    cavaletes=4, alvos=2, lenhas=3, quartel=True),
}


# ── A GEOMETRIA ──────────────────────────────────────────────────────────────
class Malhas:
    """a geometria de TODAS as aldeias, junta por material (um desenho cada)"""

    def __init__(self):
        self.g = {}
        self.origem = Matrix.Identity(4)

    def por(self, mat, vloc, faces, M, liso=False):
        metros = MATS[mat].get("metros", 1.0)
        v, f, uv, ls = self.g.setdefault(mat, ([], [], [], []))
        base = len(v)
        W = self.origem @ M
        for p in vloc:
            v.append(tuple(W @ Vector(p)))
        for fa in faces:
            pts = [Vector(vloc[i]) for i in fa]
            n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
            ax = max(range(3), key=lambda i: abs(n[i]))
            uv.append([(((q.y, q.z), (q.x, q.z), (q.x, q.y))[ax][0] / metros,
                        ((q.y, q.z), (q.x, q.z), (q.x, q.y))[ax][1] / metros) for q in pts])
            f.append(tuple(base + i for i in fa))
            ls.append(liso)

    def triangulos(self):
        return sum(sum(len(fa) - 2 for fa in g[1]) for g in self.g.values())


def _TR(x, y, z, rz=0.0, rx=0.0, ry=0.0):
    return (Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z")
            @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rx, 4, "X"))


def caixa(G, mat, x, y, z, sx, sy, sz, rz=0.0, rx=0.0):
    """caixa pousada em z (a base), rodada em torno do seu centro"""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
         (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    G.por(mat, v, f, _TR(x, y, z + hz, rz, rx))


def telhado(G, mat, x, y, z, sx, sy, alto, rz=0.0, beiral=0.35):
    """duas aguas com beiral (a cumeeira ao longo de x)"""
    hx, hy = sx / 2 + beiral, sy / 2 + beiral
    v = [(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0), (-hx, 0, alto), (hx, 0, alto)]
    f = [(0, 1, 5, 4), (3, 4, 5, 2), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    G.por(mat, v, f, _TR(x, y, z, rz))


def piramide(G, mat, x, y, z, lado, alto, rz=0.0, beiral=0.3):
    h = lado / 2 + beiral
    v = [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0), (0, 0, alto)]
    f = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)]
    G.por(mat, v, f, _TR(x, y, z, rz))


def cilindro(G, mat, x, y, z, r, h, n=12, r2=None, rz=0.0, rx=0.0, ry=0.0, esc=(1, 1, 1), tampas=True):
    """cilindro (ou tronco de cone, com r2) com o centro a meia altura; lados
    lisos e tampas planas com vertices proprios (sem escurecer a aresta)"""
    r2 = r if r2 is None else r2
    hz = h / 2
    ex, ey, ez = esc
    v, f = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        v.append((r * math.cos(a) * ex, r * math.sin(a) * ey, -hz * ez))
    for i in range(n):
        a = 2 * math.pi * i / n
        v.append((r2 * math.cos(a) * ex, r2 * math.sin(a) * ey, hz * ez))
    for i in range(n):
        f.append((i, (i + 1) % n, n + (i + 1) % n, n + i))
    M = _TR(x, y, z + hz * ez if rx == 0 and ry == 0 else z, rz, rx, ry)
    G.por(mat, v, f, M, liso=True)
    if tampas:
        cima = [(r2 * math.cos(2 * math.pi * i / n) * ex, r2 * math.sin(2 * math.pi * i / n) * ey, hz * ez)
                for i in range(n)]
        G.por(mat, cima, [tuple(range(n))], M)
        if r > 0.01:
            baixo = [(r * math.cos(2 * math.pi * i / n) * ex, r * math.sin(2 * math.pi * i / n) * ey, -hz * ez)
                     for i in range(n)]
            G.por(mat, baixo, [tuple(reversed(range(n)))], M)


def bola(G, mat, x, y, z, r, esc=(1, 1, 1), seg=10, aneis=6):
    """esfera baixa (10 x 6): uma copa ou um saco nao pedem mais"""
    v = [(0, 0, -r * esc[2])]
    for j in range(1, aneis):
        t = math.pi * j / aneis - math.pi / 2
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append((r * math.cos(t) * math.cos(a) * esc[0], r * math.cos(t) * math.sin(a) * esc[1],
                      r * math.sin(t) * esc[2]))
    v.append((0, 0, r * esc[2]))
    topo = len(v) - 1
    f = []
    for i in range(seg):
        f.append((0, 1 + (i + 1) % seg, 1 + i))
    for j in range(aneis - 2):
        b0, b1 = 1 + j * seg, 1 + (j + 1) * seg
        for i in range(seg):
            f.append((b0 + i, b0 + (i + 1) % seg, b1 + (i + 1) % seg, b1 + i))
    ult = 1 + (aneis - 2) * seg
    for i in range(seg):
        f.append((ult + i, ult + (i + 1) % seg, topo))
    G.por(mat, v, f, _TR(x, y, z), liso=True)


def disco(G, mat, x, y, z, r, n=48, alto=0.08):
    cilindro(G, mat, x, y, z, r, alto, n=n)


# ── AS PECAS DA ALDEIA ───────────────────────────────────────────────────────
def _perto(a, b, graus):
    return abs((a - b + math.pi) % (2 * math.pi) - math.pi) < math.radians(graus)


def _no_corredor(x, y, portoes, larg):
    """dentro da passagem que vai do portao ao largo?"""
    for g in portoes:
        c, s = math.cos(g), math.sin(g)
        ao_longo = c * x + s * y
        if ao_longo > 0 and abs(-s * x + c * y) < larg:
            return True
    return False


def casa(G, rnd, x, y, sx, sy, cfg, k):
    rz = math.atan2(y, x) + math.pi / 2          # a fachada vira para o largo
    andares = 2 if rnd.random() < cfg["dois_andares"] else 1
    h = 3.1 * andares + rnd.uniform(-0.2, 0.3)
    caixa(G, "cal", x, y, 0, sx, sy, h, rz)
    caixa(G, "barra_azul" if k % 3 else "barra_ocre", x, y, 0, sx + 0.06, sy + 0.06, 0.6, rz)
    telhado(G, "telha", x, y, h, sx, sy, rnd.uniform(1.3, 1.8), rz)
    fx, fy = math.cos(rz - math.pi / 2), math.sin(rz - math.pi / 2)
    ox, oy = x + fx * (sy / 2), y + fy * (sy / 2)
    caixa(G, "madeira", ox, oy, 0, 1.0, 0.12, 2.1, rz)
    for dx in (-sx * 0.3, sx * 0.3):
        wx, wy = ox + math.cos(rz) * dx, oy + math.sin(rz) * dx
        caixa(G, "escuro", wx, wy, 1.5, 0.7, 0.12, 0.8, rz)
        caixa(G, "portada", wx + math.cos(rz) * 0.55, wy + math.sin(rz) * 0.55, 1.45, 0.32, 0.14, 0.9, rz)
        if andares == 2:
            caixa(G, "escuro", wx, wy, 4.5, 0.7, 0.12, 0.8, rz)
    # a chamine algarvia, branca e alta, com chapeu de telha
    cx = x + math.cos(rz) * sx * 0.3 + math.cos(rz + math.pi / 2) * sy * 0.2
    cy = y + math.sin(rz) * sx * 0.3 + math.sin(rz + math.pi / 2) * sy * 0.2
    caixa(G, "cal", cx, cy, h, 0.6, 0.6, 2.2, rz)
    caixa(G, "telha", cx, cy, h + 2.2, 0.85, 0.85, 0.22, rz)


def torre_quadrada(G, mat, x, y, lado, alt, rz, merlao):
    caixa(G, mat, x, y, 0, lado, lado, alt, rz)
    d = lado / 2 - merlao * 0.55
    passos = max(2, int(round(lado / (merlao * 1.9))))
    for i in range(passos):
        t = -d + 2 * d * i / (passos - 1)
        for (px, py) in ((t, -d), (t, d), (-d, t), (d, t)):
            ox = x + math.cos(rz) * px - math.sin(rz) * py
            oy = y + math.sin(rz) * px + math.cos(rz) * py
            caixa(G, mat, ox, oy, alt, merlao, merlao, merlao * 1.1, rz)


def torre_redonda(G, mat, x, y, r, alt, merlao):
    cilindro(G, mat, x, y, 0, r, alt, n=16)
    cilindro(G, mat, x, y, alt, r * 1.08, 0.5, n=16)          # o cordao
    n = max(6, int(2 * math.pi * r / (merlao * 2.0)))
    for i in range(n):
        a = 2 * math.pi * i / n
        caixa(G, mat, x + math.cos(a) * r * 0.9, y + math.sin(a) * r * 0.9, alt + 0.5,
              merlao, merlao, merlao * 1.1, a)


def cavalete(G, x, y, rz):
    """o cavalete das lancas: trave em dois postes e seis lancas encostadas"""
    c, s = math.cos(rz), math.sin(rz)
    for k in (-1, 1):
        cilindro(G, "madeira", x + c * k * 1.2, y + s * k * 1.2, 0, 0.08, 1.6, n=6)
    caixa(G, "madeira", x, y, 1.35, 2.7, 0.12, 0.12, rz)
    for j in range(6):
        t = -1.0 + j * 0.4
        px, py = x + c * t - s * 0.25, y + s * t + c * 0.25
        # inclinada 10 graus para a trave
        cilindro(G, "madeira", px, py, 1.6, 0.035, 3.2, n=5, rz=rz, rx=math.radians(10), tampas=False)
        tx, ty = px + s * 0.28, py - c * 0.28
        cilindro(G, "ferro", tx, ty, 3.1, 0.07, 0.35, n=5, r2=0.0)


def laranjeira(G, rnd, x, y, e=1.0):
    cilindro(G, "madeira", x, y, 0, 0.16 * e, 1.3 * e, n=7)
    R = 1.15 * e * 1.25
    bola(G, "folha_laranjeira", x, y, 1.9 * e, R, esc=(1, 1, 0.9))
    for _j in range(8):
        a = rnd.uniform(0, 2 * math.pi)
        b = rnd.uniform(-0.3, 0.6)
        bola(G, "laranjas", x + R * 0.95 * math.cos(a) * math.cos(b), y + R * 0.95 * math.sin(a) * math.cos(b),
             1.9 * e + R * 0.85 * math.sin(b), 0.13 * e, seg=6, aneis=4)


def palmeira(G, x, y):
    for i in range(7):
        cilindro(G, "tronco_palma", x + 0.08 * i, y, 1.2 * i, 0.26 - 0.015 * i, 1.25, n=8)
    topo = (x + 0.56, y, 8.4)
    for j in range(9):
        a = 2 * math.pi * j / 9
        # folha: cone achatado, a sair do topo e a cair para fora
        # deitada a 100 graus: a base no tronco, a ponta para fora e a cair
        cilindro(G, "palma", topo[0] + math.cos(a) * 1.5, topo[1] + math.sin(a) * 1.5, topo[2],
                 0.45, 3.4, n=4, r2=0.02, rz=a, ry=math.radians(100), esc=(1, 0.25, 1))


def banca(G, rnd, x, y, rz, toldo):
    caixa(G, "madeira", x, y, 0, 2.2, 1.0, 0.95, rz)
    for dx in (-1.0, 1.0):
        for dy in (-0.45, 0.45):
            caixa(G, "madeira", x + math.cos(rz) * dx - math.sin(rz) * dy,
                  y + math.sin(rz) * dx + math.cos(rz) * dy, 0, 0.08, 0.08, 2.3, rz)
    caixa(G, toldo, x, y, 2.3, 2.5, 1.5, 0.06, rz, rx=math.radians(10))
    for _k in range(3):
        bola(G, "saco", x + rnd.uniform(-0.5, 0.5), y + rnd.uniform(-0.3, 0.3), 1.2, 0.28,
             esc=(1, 1, 0.8), seg=7, aneis=4)


def poco(G):
    cilindro(G, "pedra", 0, 0, 0, 1.1, 0.9, n=16)
    cilindro(G, "agua_poco", 0, 0, 0.5, 0.85, 0.42, n=16)
    for s in (-1, 1):
        caixa(G, "madeira", s * 0.95, 0, 0.9, 0.15, 0.15, 1.9)
    telhado(G, "telha", 0, 0, 2.8, 2.3, 1.5, 0.7, beiral=0.15)


def lenha(G, x, y, rz):
    for fila in range(3):
        for j in range(5 - fila):
            off = (j - (4 - fila) / 2) * 0.33
            cilindro(G, "casca", x + math.cos(rz) * off, y + math.sin(rz) * off, 0.16 + fila * 0.29,
                     0.16, 1.4, n=7, rz=rz + math.pi / 2, rx=math.pi / 2)


def alvo(G, x, y, rz):
    cilindro(G, "feno", x, y, 1.1, 0.75, 0.35, n=14, rz=rz, rx=math.radians(80))
    for k in (-1, 1):
        cilindro(G, "madeira", x + math.cos(rz) * k * 0.5, y + math.sin(rz) * k * 0.5, 0, 0.06, 1.4, n=6)


def carroca(G, x, y, rz):
    caixa(G, "madeira", x, y, 0.55, 2.6, 1.4, 0.5, rz)
    for s in (-1, 1):
        wx = x + math.cos(rz + math.pi / 2) * s * 0.8
        wy = y + math.sin(rz + math.pi / 2) * s * 0.8
        cilindro(G, "madeira", wx, wy, 0.6, 0.6, 0.12, n=12, rz=rz, rx=math.pi / 2)
    caixa(G, "madeira", x + math.cos(rz) * 2.2, y + math.sin(rz) * 2.2, 0.6, 2.0, 0.12, 0.12, rz)
    for j in range(3):
        bola(G, "feno", x + math.cos(rz) * (j - 1) * 0.6, y + math.sin(rz) * (j - 1) * 0.6, 1.2, 0.45,
             esc=(1, 1, 0.7), seg=8, aneis=5)


def se(G, x, y, rz, grande):
    """a igreja: nave de pedra com telhado, e a torre sineira a um canto"""
    L, W, H = (18.0, 9.0, 10.0) if grande else (12.0, 6.5, 7.5)
    caixa(G, "pedra", x, y, 0, L, W, H, rz)
    telhado(G, "telha", x, y, H, L, W, W * 0.42, rz, beiral=0.4)
    # a torre sineira, na fachada (lado -x local), com telhado de pirâmide
    tl, th = (5.5, 19.0) if grande else (4.2, 13.0)
    tx = x + math.cos(rz) * (-L / 2 + tl / 2) - math.sin(rz) * (W / 2 + tl / 2 - 0.4)
    ty = y + math.sin(rz) * (-L / 2 + tl / 2) + math.cos(rz) * (W / 2 + tl / 2 - 0.4)
    caixa(G, "pedra", tx, ty, 0, tl, tl, th, rz)
    for lado in range(4):
        a = rz + lado * math.pi / 2
        caixa(G, "escuro", tx + math.cos(a) * tl / 2, ty + math.sin(a) * tl / 2, th - 3.4,
              0.1, 1.2, 2.0, a)
    piramide(G, "telha", tx, ty, th, tl, tl * 0.9, rz)
    # a porta e a rosacea na fachada
    fx, fy = x - math.cos(rz) * (L / 2 + 0.05), y - math.sin(rz) * (L / 2 + 0.05)
    caixa(G, "madeira", fx, fy, 0, 0.12, 2.2, 3.6, rz)
    cilindro(G, "escuro", fx, fy, H * 0.68, 1.1, 0.12, n=14, rz=rz, ry=math.pi / 2)
    return max(L, W) * 0.62 + 2.0


def castelo(G, x, y, rz, cfg):
    """o castelo da capital: recinto de pedra escura, torres de canto e menagem"""
    lado = 20.0
    hmuro = cfg["alt"] + 1.5
    m = cfg["merlao"]
    d = lado / 2
    for i in range(4):
        a = rz + i * math.pi / 2
        # muro do recinto (um lado do quadrado)
        cx, cy = x + math.cos(a) * d, y + math.sin(a) * d
        caixa(G, "pedra_escura", cx, cy, 0, 1.6, lado, hmuro, a)
        for k in range(-4, 5):
            t = k * lado / 10
            caixa(G, "pedra_escura", cx - math.sin(a) * t, cy + math.cos(a) * t, hmuro, 1.65, m, m * 1.1, a)
    for i in range(4):
        a = rz + math.pi / 4 + i * math.pi / 2
        torre_quadrada(G, "pedra_escura", x + math.cos(a) * d * 1.41, y + math.sin(a) * d * 1.41,
                       4.6, hmuro + 4.0, rz, m)
    ml, mh = cfg["menagem"]
    torre_quadrada(G, "pedra_escura", x, y, ml, mh, rz, m)
    # a porta do recinto, virada para o centro da aldeia
    a = math.atan2(-y, -x)
    caixa(G, "madeira", x + math.cos(a) * (d + 0.9), y + math.sin(a) * (d + 0.9), 0, 0.3, 3.2, 3.6, a)
    return mh


# ── A ALDEIA ─────────────────────────────────────────────────────────────────
def construir(G, perfil, portoes, semente, origem):
    """monta uma aldeia em `origem` (x, y, z do mapa). `portoes` sao os rumos,
    em radianos do mapa, dos portoes -- um por molho de estradas. Devolve o
    mastro [x, y, z_relativo] e quantos objetos saiu."""
    cfg = PERFIS[perfil]
    R, ALT, ESP, m = cfg["raio"], cfg["alt"], cfg["esp"], cfg["merlao"]
    rnd = random.Random(semente)
    G.origem = Matrix.Translation(origem)
    portoes = list(portoes) or [math.radians(-64)]
    principal = portoes[0]

    # onde fica a menagem (ou o castelo): o sitio mais longe de todos os portoes
    def folga(a):
        return min(abs((a - g + math.pi) % (2 * math.pi) - math.pi) for g in portoes)
    ang_mn = max((2 * math.pi * i / 72 for i in range(72)), key=folga)

    ocupado = []                 # (x, y, raio) do que ja esta no chao

    def livre(x, y, r):
        return all(math.hypot(x - ox, y - oy) > r + orr for ox, oy, orr in ocupado)

    # ---- a muralha: panos com ameias, e o vao de cada portao -------------------
    t_lado, t_alt, porta_l = cfg["gate"]
    meio_vao = (porta_l / 2 + t_lado / 2 - 0.4) / R            # radianos
    nseg = max(24, int(round(2 * math.pi * R / 3.2)))
    for i in range(nseg):
        a0, a1 = 2 * math.pi * i / nseg, 2 * math.pi * (i + 1) / nseg
        am = (a0 + a1) / 2
        if any(_perto(am, g, math.degrees(meio_vao) + 360 / nseg / 2) for g in portoes):
            continue
        comp = 2 * R * math.sin(math.pi / nseg) + 0.15
        x, y = R * math.cos(am), R * math.sin(am)
        caixa(G, "pedra", x, y, 0, ESP, comp, ALT, am)
        for k in (-0.25, 0.25):
            caixa(G, "pedra", x + math.cos(am + math.pi / 2) * comp * k, y + math.sin(am + math.pi / 2) * comp * k,
                  ALT, ESP * 1.02, comp * 0.28, m, am)
    # ---- os portoes: duas torres, porta de madeira, verga de pedra -------------
    for gi, g in enumerate(portoes):
        for s in (-1, 1):
            a = g + s * (porta_l / 2 + t_lado / 2 - 0.2) / R
            tx, ty = R * math.cos(a), R * math.sin(a)
            torre_quadrada(G, "pedra", tx, ty, t_lado, t_alt, a, m * 0.95)
            if gi == 0:
                # braseiros so no portao principal
                cilindro(G, "ferro", tx, ty, t_alt, 0.35, 0.3, n=10)
                bola(G, "brasa", tx, ty, t_alt + 0.32, 0.26, esc=(1, 1, 0.5), seg=8, aneis=4)
        gx, gy = R * math.cos(g), R * math.sin(g)
        caixa(G, "madeira", gx, gy, 0, 0.35, porta_l, min(3.4, ALT * 0.8), g)
        caixa(G, "pedra", gx, gy, min(3.4, ALT * 0.8), ESP * 1.1, porta_l + 1.2, ALT - min(3.4, ALT * 0.8) + 0.4, g)
    # ---- torres redondas no muro, longe dos portoes e da menagem ----------------
    if cfg["torres"]:
        n = cfg["torres"]
        for i in range(n):
            a = ang_mn + math.pi / n + 2 * math.pi * i / n
            if any(_perto(a, g, math.degrees(meio_vao) + 12) for g in portoes):
                continue
            torre_redonda(G, "pedra", R * math.cos(a), R * math.sin(a), cfg["t_raio"], cfg["t_alt"], m)

    # ---- a menagem / o castelo -----------------------------------------------
    ml, mh = cfg["menagem"]
    if cfg["castelo"]:
        rc = R * 0.56
        cx, cy = rc * math.cos(ang_mn), rc * math.sin(ang_mn)
        h_topo = castelo(G, cx, cy, ang_mn, cfg)
        ocupado.append((cx, cy, 16.5))
    else:
        rc = R * 0.66
        cx, cy = rc * math.cos(ang_mn), rc * math.sin(ang_mn)
        torre_quadrada(G, "pedra", cx, cy, ml, mh, ang_mn, m)
        h_topo = mh
        ocupado.append((cx, cy, ml * 0.75 + 1.0))
    mastro = [cx, cy, h_topo]

    # ---- a Se ----------------------------------------------------------------
    if cfg["se"]:
        melhor = None
        for d_ang in (1.9, -1.9, 2.4, -2.4, 1.4, -1.4):
            a = ang_mn + d_ang
            if folga(a) < math.radians(30):
                continue
            melhor = a
            break
        if melhor is not None:
            rs = R * 0.48
            sx_, sy_ = rs * math.cos(melhor), rs * math.sin(melhor)
            ocupado.append((sx_, sy_, se(G, sx_, sy_, melhor + math.pi / 2, cfg["se"] == "grande")))

    # ---- o largo, o poco, as bancas ------------------------------------------
    L = cfg["largo"]
    G.origem = Matrix.Translation(origem)
    disco(G, "empedrado", 0, 0, 0, L, n=48)
    poco(G)
    ocupado.append((0, 0, L + 1.2))
    toldos = ("toldo_vermelho", "toldo_azul", "toldo_amarelo")
    for k in range(cfg["bancas"]):
        a = principal + math.radians(55 + 300 / max(1, cfg["bancas"]) * k * 0.62)
        rb = L * 0.69
        banca(G, rnd, rb * math.cos(a), rb * math.sin(a), a + math.pi / 2, toldos[k % 3])

    # ---- as casas --------------------------------------------------------------
    postas, tent = 0, 0
    while postas < cfg["casas"] and tent < 3000:
        tent += 1
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(L + 3.0, R - ESP - 3.8)
        x, y = r * math.cos(a), r * math.sin(a)
        sx, sy = rnd.uniform(4.2, 6.2), rnd.uniform(3.6, 4.8)
        raio_c = max(sx, sy) * 0.62
        if r + raio_c > R - ESP - 1.2:
            continue
        if _no_corredor(x, y, portoes, 3.6 + raio_c):
            continue
        if not livre(x, y, raio_c):
            continue
        casa(G, rnd, x, y, sx, sy, cfg, postas)
        ocupado.append((x, y, raio_c))
        postas += 1

    # ---- o quartel (so a capital) -----------------------------------------------
    if cfg["quartel"]:
        for _t in range(400):
            a = rnd.uniform(0, 2 * math.pi)
            r = R * rnd.uniform(0.55, 0.72)
            x, y = r * math.cos(a), r * math.sin(a)
            if _no_corredor(x, y, portoes, 9.0) or not livre(x, y, 8.0):
                continue
            rz = a + math.pi / 2
            caixa(G, "pedra", x, y, 0, 14.0, 6.0, 4.2, rz)
            telhado(G, "telha", x, y, 4.2, 14.0, 6.0, 2.0, rz)
            ocupado.append((x, y, 8.0))
            break

    # ---- vida e guerra: arvores, lancas, alvo, lenha, barris, carroca ----------
    def sitio(rmin, rmax, raio_obj, corredor=2.5):
        for _t in range(400):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(rmin, rmax)
            x, y = r * math.cos(a), r * math.sin(a)
            if _no_corredor(x, y, portoes, corredor + raio_obj) or not livre(x, y, raio_obj):
                continue
            ocupado.append((x, y, raio_obj))
            return x, y, a
        return None

    for _k in range(cfg["laranjeiras"]):
        s = sitio(L + 0.8, R * 0.7, 1.7)
        if s:
            laranjeira(G, rnd, s[0], s[1], rnd.uniform(0.9, 1.15))
    for _k in range(cfg["palmas"]):
        s = sitio(L + 1.0, R * 0.75, 1.2)
        if s:
            palmeira(G, s[0], s[1])
    for k in range(cfg["cavaletes"]):
        s = sitio(R - ESP - 5.5, R - ESP - 2.5, 1.6)
        if s:
            cavalete(G, s[0], s[1], s[2] + math.pi / 2)
    for _k in range(cfg["alvos"]):
        s = sitio(R * 0.45, R - ESP - 3.0, 1.2)
        if s:
            alvo(G, s[0], s[1], s[2])
    for _k in range(cfg["lenhas"]):
        s = sitio(R - ESP - 4.0, R - ESP - 2.0, 1.2)
        if s:
            lenha(G, s[0], s[1], s[2] + math.pi / 2)
    for k in range(int(R * 0.5)):
        s = sitio(R - ESP - 3.2, R - ESP - 1.4, 0.7)
        if not s:
            continue
        if k % 2:
            cilindro(G, "madeira", s[0], s[1], 0, 0.45, 1.0, n=10)
            for zz in (0.2, 0.72):
                cilindro(G, "ferro", s[0], s[1], zz, 0.47, 0.08, n=10)
        else:
            caixa(G, "madeira", s[0], s[1], 0, 0.8, 0.8, 0.7, rnd.uniform(0, 1.5))
            caixa(G, "madeira", s[0] + 0.2, s[1], 0.7, 0.6, 0.6, 0.55, rnd.uniform(0, 1.5))
    # a carroca a entrada do portao principal
    rcar = R * 0.68
    carroca(G, rcar * math.cos(principal + 0.25), rcar * math.sin(principal + 0.25), principal + 0.25)
    # escudos encostados a muralha, ao lado do portao principal
    for j in range(4):
        a = principal - (meio_vao + 0.08 + j * 0.06)
        r = R - ESP / 2 - 0.35
        x, y = r * math.cos(a), r * math.sin(a)
        cilindro(G, "escudo", x, y, 0.6, 0.45, 0.08, n=12, rz=a + math.pi / 2, rx=math.radians(75))
    return mastro


# ── OS MATERIAIS PARA O glTF ─────────────────────────────────────────────────
def _srgb_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def _carregar(caminho, lado, dados=False):
    im = bpy.data.images.load(caminho, check_existing=False)
    if dados:
        im.colorspace_settings.name = "Non-Color"
    if im.size[0] > lado:
        im.scale(lado, lado)
    return im


def _imagem(nome, cfg):
    """a fotografia com as tintas do Blender assadas nos pixeis"""
    im = _carregar(os.path.join(TEX, cfg["pasta"], "cor.jpg"), LADO_TEX)
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    c = _srgb_lin(px[:, :3])
    for tipo, f, cor in cfg.get("passos", []):
        cor = np.array(cor, dtype=np.float32)
        c = c * (1 - f) + (c * cor if tipo == "MULTIPLY" else cor) * f
    if cfg.get("ajuste"):
        c = c * np.array(cfg["ajuste"], dtype=np.float32)
    px[:, :3] = _lin_srgb(c)
    nova = bpy.data.images.new("aldeia2_" + nome, w, h)
    nova.pixels.foreach_set(px.ravel())
    os.makedirs(PASTA_TEX, exist_ok=True)
    nova.filepath_raw = os.path.join(PASTA_TEX, nome + ".jpg")
    nova.file_format = "JPEG"
    nova.save()
    bpy.data.images.remove(im)
    return nova


def material(nome):
    m = bpy.data.materials.get("aldeia2_" + nome)
    if m:
        return m
    cfg = MATS[nome]
    m = bpy.data.materials.new("aldeia2_" + nome)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = cfg.get("rug", 0.85)
    # sem metallicFactor o glTF assume metal = 1 (o cavalo preto)
    b.inputs["Metallic"].default_value = 0.0
    if cfg.get("pasta"):
        no = nt.nodes.new("ShaderNodeTexImage")
        no.image = _imagem(nome, cfg)
        nt.links.new(no.outputs["Color"], b.inputs["Base Color"])
        nf = os.path.join(TEX, cfg["pasta"], "normal.png")
        if os.path.exists(nf):
            nn = nt.nodes.new("ShaderNodeTexImage")
            nn.image = _carregar(nf, LADO_TEX, dados=True)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 0.8
            nt.links.new(nn.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    else:
        b.inputs["Base Color"].default_value = (*cfg["cor"], 1.0)
    if cfg.get("emissao"):
        b.inputs["Emission Color"].default_value = (*cfg["cor"], 1.0)
        b.inputs["Emission Strength"].default_value = cfg["emissao"]
    return m


def objetos(G, colecao):
    """uma malha por material, com o nome `aldeia2_<material>` -- e por esse
    prefixo que o `mapa3d.js` as poe na cena (nao sao pecas instanciadas)"""
    feitos = []
    for nome, (v, f, uv, ls) in sorted(G.g.items()):
        me = bpy.data.meshes.new("aldeia2_" + nome)
        me.from_pydata(v, [], f)
        camada = me.uv_layers.new(name="UVMap")
        # o from_pydata guarda a ordem das faces e dos cantos: o UV vai de uma vez
        camada.data.foreach_set("uv", [c for uvf in uv for u in uvf for c in u])
        me.polygons.foreach_set("use_smooth", ls)
        me.materials.append(material(nome))
        me.update()
        ob = bpy.data.objects.new("aldeia2_" + nome, me)
        colecao.objects.link(ob)
        feitos.append(ob)
    return feitos
