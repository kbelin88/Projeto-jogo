# vida.py -- as pecas que se MEXEM no mapa, modeladas no Blender (28/09).
#
#   "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/vida.py
#
# O `exportar_mapa.py` corre-o no fim. Sai `sonda3d/vida.glb`, com:
#   vida_pas_*     as pas de um moinho da Mancha: varal, grade de ripas, lona,
#                  a macaroca e o eixo. Rodam em torno do X local (o eixo sai
#                  da torre em +X); o jogo so lhes da a rotacao.
#   vida_barco_*   o barco a vela: o casco das enseadas (`porto.barco`) com
#                  mastro, antena e vela latina com barriga. Proa em +X.
#   vida_mastro_*  o mastro das bandeiras (9 m, madeira, pomo dourado, a adrica)
#   vida_pano      o pano da bandeira: linho em grelha 16 x 6, com bainha, de
#                  x = 0 (a tralha, no mastro) a x = 1; o jogo tinge-o com a
#                  cor do rei e fa-lo ondular.
#   vida_ave       uma gaivota, bico em +X, asas em Y, com duas formas
#                  (shape keys -> morph targets do glTF): "cima" e "baixo". O
#                  jogo bate as asas misturando-as, por instancia.
#
# ── PORQUE (regra "com calma e sem atalhos", CLAUDE.md §6) ───────────────────
# Ate 27/09 estas tres coisas eram triangulos de cor lisa escritos a mao no
# `mapa3d.js`, porque se mexem -- e ao lado da torre do moinho, feita no forno
# com textura pintada, liam-se como riscos. O que se mexe tambem se modela: as
# mesmas tintas das aldeias (`aldeia2.MATS`), com UV, e a mesma escala de
# cuidado. Cada numero abaixo foi visto de perto e a distancia de gravacao.
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.getcwd(), "ferramentas", "cena"))
import aldeia2 as A2          # noqa: E402
import porto as PORTO        # noqa: E402

SAIDA = os.path.join(os.getcwd(), "sonda3d", "vida.glb")

# as tintas novas, no mesmo formato das da aldeia
A2.MATS.setdefault("lona", dict(pasta="linho", metros=1.4, rug=0.9,
                                passos=[("MULTIPLY", 1.0, (0.93, 0.88, 0.76))]))
A2.MATS.setdefault("vela_latina", dict(pasta="linho", metros=2.2, rug=0.9,
                                       passos=[("MULTIPLY", 1.0, (0.90, 0.83, 0.68))]))
A2.MATS.setdefault("cabo", dict(cor=(0.16, 0.12, 0.08), rug=0.9))
A2.MATS.setdefault("pomo", dict(cor=(0.62, 0.45, 0.14), rug=0.35))


def _objetos(G, prefixo, colecao):
    """uma malha por material, `<prefixo>_<material>` (como `A2.objetos`)"""
    feitos = []
    for nome, (v, f, uv, ls) in sorted(G.g.items()):
        me = bpy.data.meshes.new(prefixo + "_" + nome)
        me.from_pydata(v, [], f)
        camada = me.uv_layers.new(name="UVMap")
        camada.data.foreach_set("uv", [c for uvf in uv for u in uvf for c in u])
        me.polygons.foreach_set("use_smooth", ls)
        me.materials.append(A2.material(nome))
        me.update()
        ob = bpy.data.objects.new(prefixo + "_" + nome, me)
        colecao.objects.link(ob)
        feitos.append(ob)
    return feitos


def _viga(G, mat, a, b, lx, ly, M):
    """uma viga de seccao lx x ly de `a` a `b` (pontos locais), seis faces"""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1))
    u = d.cross(ref).normalized() * (lx / 2)
    w = d.cross(u).normalized() * (ly / 2)
    c = [a - u - w, a + u - w, a + u + w, a - u + w, b - u - w, b + u - w, b + u + w, b - u + w]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    G.por(mat, [tuple(p) for p in c], f, M)


def _folha(G, mat, v, nu, nv, M):
    """uma folha (lona, vela) de (nu+1) x (nv+1) pontos, com as DUAS faces.
    Cada face tem os SEUS vertices: partilhados, o sombreado suave fazia a
    media da normal da frente com a de tras (zero) e a vela saia as manchas
    (visto no Blender, 28/09)."""
    f = [(i * (nv + 1) + j, (i + 1) * (nv + 1) + j, (i + 1) * (nv + 1) + j + 1, i * (nv + 1) + j + 1)
         for i in range(nu) for j in range(nv)]
    G.por(mat, v, f, M, liso=True)
    G.por(mat, v, [tuple(reversed(q)) for q in f], M, liso=True)


# ── AS PAS DO MOINHO ─────────────────────────────────────────────────────────
# O moinho da Mancha: quatro varais que saem da macaroca, cada um com uma
# GRADE de ripas de um lado (o bordo de fuga) e a LONA esticada por cima. De
# longe le-se como um X claro com as quatro velas; de perto, a grade por tras
# da lona e as ripas a atravessa-la. Medidas no referencial do moinho de
# `porto.moinho` (esc 1): o eixo a 7,6 m, as pas com 6,3 m de raio. O plano
# das pas e o YZ; rodam em torno de X; o eixo entra na torre por -X.
def pas(G):
    M = Matrix.Identity(4)
    R0, R1 = 1.25, 6.3             # onde comeca e acaba a grade, ao longo do varal
    L0, L1 = 0.16, 1.30            # a grade, de lado: do varal ate a borda
    for k in range(4):
        ang = k * math.pi / 2
        ca, sa = math.cos(ang), math.sin(ang)

        def P(r, w, x=0.0):
            # r ao longo do varal, w de traves (para o lado de fuga), x a frente
            return (x, r * ca - w * sa, r * sa + w * ca)
        # o varal: afina da macaroca a ponta
        _viga(G, "casca", P(0.2, 0.0), P(R1 + 0.25, 0.0), 0.24, 0.24, M)
        # a grade: duas longarinas e ripas de traves a cada ~0,42 m, a 12 cm
        # a frente do varal (a lona fica entre elas e o vento)
        for w in (L0, L1):
            _viga(G, "madeira", P(R0, w, 0.12), P(R1, w, 0.12), 0.07, 0.07, M)
        n = int((R1 - R0) / 0.42)
        for i in range(n + 1):
            r = R0 + (R1 - R0) * i / n
            _viga(G, "madeira", P(r, -0.10, 0.12), P(r, L1 + 0.04, 0.12), 0.05, 0.06, M)
        # a lona: uma folha com barriga (5 cm a meio), dos dois lados (a ma-
        # teria das aldeias e de uma face), um pouco antes da ponta
        nr, nw = 8, 3
        v = []
        for i in range(nr + 1):
            for j in range(nw + 1):
                r = R0 + 0.15 + (R1 - R0 - 0.35) * i / nr
                w = L0 + 0.03 + (L1 - L0 - 0.06) * j / nw
                barriga = 0.05 * math.sin(math.pi * i / nr) * math.sin(math.pi * j / nw)
                v.append(P(r, w, 0.08 - barriga))
        _folha(G, "lona", v, nr, nw, M)
    # a macaroca (o cubo) e o eixo que entra na torre
    A2.cilindro(G, "casca", 0.25, 0, 0, 0.42, 0.55, n=12, ry=math.pi / 2)
    A2.cilindro(G, "casca", 0.80, 0, 0, 0.28, 0.12, n=12, ry=math.pi / 2)
    A2.cilindro(G, "madeira", -2.4, 0, 0, 0.2, 2.7, n=10, ry=math.pi / 2)


# ── O BARCO A VELA ──────────────────────────────────────────────────────────
# O casco e o das enseadas (o mesmo barco, visto a navegar), maior. A vela e
# LATINA, a do Mediterraneo: uma antena comprida atravessada no mastro, baixa a
# proa e alta a popa, e a vela triangular da antena ate a escota na popa, com
# BARRIGA a sotavento (0,7 m) -- uma vela lisa le-se como cartao.
BARCO = dict(L=11.0, B=3.4, H=1.3)


def barco(G):
    L, B, H = BARCO["L"], BARCO["B"], BARCO["H"]
    PORTO.barco(G, 0.0, 0.0, 0.0, 0.0, L=L, B=B, H=H, mastro=False)
    M = Matrix.Identity(4)
    xm = 0.16 * L                          # o mastro, a vante do meio
    topo = H + 8.2
    A2.cilindro(G, "casca", xm, 0, 0.34 * H, 0.13, topo - 0.34 * H, n=8, r2=0.08)
    # a antena: da proa, baixa, a popa, alta; cruza o mastro perto do topo
    a0 = Vector((0.56 * L, 0.0, H + 1.1))
    a1 = Vector((-0.42 * L, 0.0, H + 11.6))
    _viga(G, "casca", tuple(a0), tuple(a1), 0.12, 0.12, M)
    # a vela: triangulo punho de amura (a0) -- pena (a1) -- escota (popa, baixo)
    esc = Vector((-0.40 * L, 0.0, H + 1.0))
    nu, nv = 10, 8
    v = []
    for i in range(nu + 1):             # ao longo da antena
        for j in range(nv + 1):         # da antena para a esteira
            s, t = i / nu, j / nv
            pa = a0.lerp(a1, s)
            # cada fiada vai da antena ate a esteira (a0 -> esc), que encolhe
            pe = a0.lerp(esc, s)
            p = pa.lerp(pe, t)
            # a barriga: maior a meio da vela, nula nas tres bordas
            b = 0.7 * math.sin(math.pi * t) * math.sin(math.pi * s) * (1 - 0.3 * t)
            p = p + Vector((0.0, b, 0.0))
            v.append((p.x, p.y + 0.06, p.z))
    _folha(G, "vela_latina", v, nu, nv, M)
    # os cabos: o estai a proa, a escota, e o amante da antena ao mastro
    topo_m = (xm, 0.0, topo)
    for a, b in ((topo_m, (0.5 * L, 0.0, H + 0.6)), (tuple(esc), (-0.47 * L, 0.0, H + 0.9)),
                 (topo_m, (-0.46 * L, 0.35, H + 0.9)), (topo_m, (-0.46 * L, -0.35, H + 0.9))):
        _viga(G, "cabo", a, b, 0.035, 0.035, M)


# ── A GAIVOTA ────────────────────────────────────────────────────────────────
# 1,4 m de envergadura (o jogo aumenta-a: a gravacao e de longe). Corpo em
# seccoes elipticas, bico, cauda em leque, e asas com PULSO: a parte do braco
# e a da mao dobram em separado, que e o que faz o bater ler-se como ave e nao
# como tesoura. As formas "cima" e "baixo" rodam o braco no ombro e a mao no
# pulso. A pintura (dorso cinzento, ventre branco, pontas pretas com espelhos
# brancos, bico amarelo) e uma imagem feita aqui, com UV de cima e de baixo.
AVE_TEX = 256


def _pintura_ave():
    """a imagem: metade esquerda o dorso visto de cima, a direita o ventre"""
    W = AVE_TEX
    u = (np.arange(W) + 0.5) / W
    U, V = np.meshgrid(u, u)
    # coordenadas da ave em cada metade: x (cauda -0,34 .. bico +0,34), |y| ate 0,72
    x = (V - 0.5) * 0.68 * 2
    y = (np.where(U < 0.5, U, U - 0.5) * 2 - 0.5) * 1.6
    ay = np.abs(y)
    rng = np.random.default_rng(3)
    ruido = rng.normal(0, 1, (W, W))
    # riscas ao longo das penas: borrao gaussiano so ao longo do corpo (V) --
    # o Python do Blender nao traz scipy
    k = np.exp(-0.5 * (np.arange(-7, 8) / 2.5) ** 2)
    k /= k.sum()
    penas = np.apply_along_axis(lambda c_: np.convolve(np.pad(c_, 7, mode="wrap"), k, "valid"), 0, ruido)
    penas /= penas.std() + 1e-6
    cinza = np.array([0.50, 0.53, 0.57])
    branco = np.array([0.92, 0.92, 0.90])
    preto = np.array([0.05, 0.05, 0.06])
    c = np.empty((W, W, 3))
    cima = U < 0.5
    # dorso: cinzento nas asas e no manto, branco na cabeca e na cauda
    corpo = ay < 0.07
    cab = corpo & (x > 0.10)
    c[:] = cinza
    c[corpo] = cinza * 0.9 + branco * 0.1
    c[cab | (corpo & (x < -0.22))] = branco
    # a ponta: preta nos ultimos 20 cm, com dois espelhos brancos
    ponta = ay > 0.58
    c[ponta] = preto
    esp = (np.hypot(ay - 0.70, x + 0.10) < 0.022) | (np.hypot(ay - 0.63, x + 0.06) < 0.018)
    c[ponta & esp] = branco
    # o bordo de fuga da asa, mais claro (as secundarias com ponta branca)
    fuga = (ay > 0.07) & (ay < 0.58) & (x < -0.06) & (x > -0.13)
    c[fuga] = c[fuga] * 0.5 + branco * 0.5
    # ventre: branco, pontas pretas por baixo tambem
    c[~cima] = branco
    c[~cima & ponta] = preto * 1.4
    c[~cima & ponta & esp] = branco
    # o bico amarelo com a mancha vermelha
    bico = corpo & (x > 0.25)
    c[bico] = np.array([0.90, 0.72, 0.15])
    c[bico & (np.abs(x - 0.285) < 0.012)] = np.array([0.70, 0.12, 0.05])
    # o olho
    c[cima & (np.abs(x - 0.20) < 0.012) & (np.abs(ay - 0.035) < 0.012)] = 0.02
    c *= (1.0 + 0.08 * penas[..., None])
    im = bpy.data.images.new("vida_ave_cor", W, W)
    px = np.ones((W, W, 4), np.float32)
    # as cores acima sao sRGB (as do ecra): uma imagem nova do Blender guarda-as assim
    # a linha r da pintura e v = (r + 0,5) / W, e a linha 0 do Blender e v = 0:
    # vai tal e qual (invertida, o bico amarelo caia na cauda -- visto 28/09)
    px[..., :3] = np.clip(c, 0, 1)
    im.pixels.foreach_set(px.ravel())
    os.makedirs(A2.PASTA_TEX, exist_ok=True)
    im.filepath_raw = os.path.join(A2.PASTA_TEX, "vida_ave_cor.png")
    im.file_format = "PNG"
    im.save()
    return im


def _asa_pose(p, lado, a_braco, a_mao):
    """roda um ponto da asa: o braco no ombro (|y| = 0,06), a mao no pulso
    (|y| = 0,36). `lado` +1 (esquerda, +y) ou -1."""
    x, y, z = p
    ay = abs(y)
    if ay <= 0.06:
        return p
    # o ombro
    r = ay - 0.06
    a = a_braco
    ny, nz = 0.06 + r * math.cos(a), z + r * math.sin(a)
    if ay > 0.36:
        # o pulso ja rodado pelo braco; a mao roda mais a_mao a partir dele
        rp = 0.30
        py_, pz_ = 0.06 + rp * math.cos(a), rp * math.sin(a)
        rm = ay - 0.36
        ny, nz = py_ + rm * math.cos(a + a_mao), z + pz_ + rm * math.sin(a + a_mao)
    return (x, lado * ny, nz)


def ave():
    """a malha da gaivota com UV e as duas formas; devolve o objeto"""
    v, f, uvs = [], [], []

    def uv_de(x, y, baixo):
        u = (y / 1.6 + 0.5) * 0.5 + (0.5 if baixo else 0.0)
        return (u, x / (0.68 * 2) + 0.5)

    lado_de = []        # por vertice: 0 corpo, +1/-1 asa
    # o corpo: seccoes elipticas da cauda ao bico
    sec = [(-0.30, 0.012, 0.010), (-0.22, 0.040, 0.035), (-0.10, 0.060, 0.055), (0.02, 0.062, 0.058),
           (0.12, 0.048, 0.050), (0.19, 0.036, 0.040), (0.24, 0.022, 0.024), (0.30, 0.006, 0.010)]
    n = 10
    base = len(v)
    for (x, ry, rz) in sec:
        for k in range(n):
            a = 2 * math.pi * k / n
            v.append((x, ry * math.cos(a), rz * math.sin(a) + (0.01 if x > 0.1 else 0.0)))
            lado_de.append(0)
    for i in range(len(sec) - 1):
        for k in range(n):
            f.append((base + i * n + k, base + (i + 1) * n + k, base + (i + 1) * n + (k + 1) % n,
                      base + i * n + (k + 1) % n))
    # a cauda: um leque fino
    b = len(v)
    for p in ((-0.20, 0.035, 0.0), (-0.34, 0.075, -0.005), (-0.36, 0.0, -0.005), (-0.34, -0.075, -0.005),
              (-0.20, -0.035, 0.0)):
        v.append(p)
        lado_de.append(0)
    f += [(b, b + 1, b + 2), (b, b + 2, b + 4), (b + 4, b + 2, b + 3)]
    f += [(b + 2, b + 1, b), (b + 4, b + 2, b), (b + 3, b + 2, b + 4)]
    # as asas: planta com pulso, bordo de ataque direito ate ao pulso e a mao
    # varrida para tras ate a ponta; 1,2 cm de espessura
    # (y, bordo de ataque, bordo de fuga): o braco largo ate ao pulso (0,36), a
    # mao a estreitar e a varrer para tras ate uma ponta fina
    plan = [(0.06, 0.11, -0.12), (0.20, 0.12, -0.10), (0.36, 0.12, -0.08),
            (0.48, 0.07, -0.09), (0.60, 0.00, -0.10), (0.70, -0.08, -0.12), (0.77, -0.15, -0.16)]
    for lado in (1, -1):
        b = len(v)
        for (y, xa, xf) in plan:
            for xx in (xa, (xa + xf) / 2, xf):
                for dz in (0.006, -0.006):
                    v.append((xx, lado * y, dz))
                    lado_de.append(lado)
        m = len(plan)

        def I(i, j, s):
            return b + (i * 3 + j) * 2 + s
        for i in range(m - 1):
            for j in range(2):
                q = (I(i, j, 0), I(i + 1, j, 0), I(i + 1, j + 1, 0), I(i, j + 1, 0))
                qb = (I(i, j + 1, 1), I(i + 1, j + 1, 1), I(i + 1, j, 1), I(i, j, 1))
                if lado < 0:
                    q, qb = tuple(reversed(q)), tuple(reversed(qb))
                f += [q, qb]
            # o bordo de ataque e o de fuga
            for j, s in ((0, 1), (2, 0)):
                q = (I(i, j, 0), I(i, j, 1), I(i + 1, j, 1), I(i + 1, j, 0))
                f.append(q if (lado > 0) == (j == 0) else tuple(reversed(q)))
    me = bpy.data.meshes.new("vida_ave")
    me.from_pydata(v, [], f)
    camada = me.uv_layers.new(name="UVMap")
    dados = []
    for poly in me.polygons:
        baixo = poly.normal.z < -0.3
        for li in poly.loop_indices:
            p = v[me.loops[li].vertex_index]
            dados += list(uv_de(p[0], p[1], baixo))
    camada.data.foreach_set("uv", dados)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    mat = bpy.data.materials.new("vida_ave")
    mat.use_nodes = True
    bs = next(n_ for n_ in mat.node_tree.nodes if n_.type == "BSDF_PRINCIPLED")
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["Roughness"].default_value = 0.9
    tx = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tx.image = _pintura_ave()
    mat.node_tree.links.new(tx.outputs["Color"], bs.inputs["Base Color"])
    me.materials.append(mat)
    ob = bpy.data.objects.new("vida_ave", me)
    # as formas: planar e levemente em M (a base), asas em cima, asas em baixo
    bpy.context.scene.collection.objects.link(ob)
    ob.shape_key_add(name="Basis")
    for nome, ab, am in (("cima", math.radians(38), math.radians(18)),
                         ("baixo", math.radians(-30), math.radians(-22))):
        k = ob.shape_key_add(name=nome)
        # no Blender 5 a forma nova nasce com valor 1: as duas somavam-se por
        # cima do planeio (e o glTF levava-as como peso inicial)
        k.value = 0.0
        for i, p in enumerate(v):
            if lado_de[i]:
                k.data[i].co = _asa_pose(p, lado_de[i], ab, am)
    # a base e o planeio: braco um pouco acima, mao um pouco abaixo (o M)
    for i, p in enumerate(v):
        if lado_de[i]:
            me.vertices[i].co = _asa_pose(p, lado_de[i], math.radians(8), math.radians(-12))
    ob.data.shape_keys.key_blocks["Basis"].data.foreach_set(
        "co", [c for vv in me.vertices for c in vv.co])
    bpy.context.scene.collection.objects.unlink(ob)
    return ob


# ── AS BANDEIRAS ─────────────────────────────────────────────────────────────
# Ate 28/09 o mastro era um cilindro de seis lados de cor chapada e o pano um
# plano de cor lisa. O pano agora e linho (a trama le-se de perto), com a
# bainha mais escura a toda a volta e uma dobra de sombra junto a tralha; a
# COR do rei nao esta aqui -- o jogo multiplica-a, porque muda com o dono.
ALT_MASTRO = 9.0


def mastro(G):
    M = Matrix.Identity(4)
    A2.cilindro(G, "casca", 0, 0, 0, 0.22, ALT_MASTRO, n=10, r2=0.13)
    A2.bola(G, "pomo", 0, 0, ALT_MASTRO + 0.22, 0.3, seg=10, aneis=6)
    # a adrica: o cabo do topo ao pe, afastado 12 cm
    _viga(G, "cabo", (0.14, 0.0, 0.5), (0.14, 0.0, ALT_MASTRO - 0.1), 0.03, 0.03, M)


def _pintura_pano():
    W, H = 512, 256
    lin = bpy.data.images.load(os.path.join(A2.TEX, "linho", "cor.jpg"), check_existing=True)
    px = np.empty(lin.size[0] * lin.size[1] * 4, np.float32)
    lin.pixels.foreach_get(px)
    px = px.reshape(lin.size[1], lin.size[0], 4)[:H, :W, :3]
    lum = px @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum = lum / max(float(lum.mean()), 1e-6)
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(u, v)
    borda = np.minimum(np.minimum(U, 1 - U) * 2.0, np.minimum(V, 1 - V))
    c = 0.92 * (0.85 + 0.15 * lum)
    c = np.where(borda < 0.035, c * 0.62, c)                 # a bainha
    c = c * (0.8 + 0.2 * np.clip(U / 0.12, 0, 1))            # a dobra na tralha
    im = bpy.data.images.new("vida_pano_cor", W, H)
    out = np.ones((H, W, 4), np.float32)
    out[..., :3] = np.clip(c, 0, 1)[..., None]
    im.pixels.foreach_set(out.ravel())
    os.makedirs(A2.PASTA_TEX, exist_ok=True)
    im.filepath_raw = os.path.join(A2.PASTA_TEX, "vida_pano_cor.png")
    im.file_format = "PNG"
    im.save()
    return im


def pano():
    nu, nv = 16, 6
    v, f, uv = [], [], []
    for i in range(nu + 1):
        for j in range(nv + 1):
            v.append((i / nu, 0.0, j / nv - 0.5))
    for i in range(nu):
        for j in range(nv):
            a, b = i * (nv + 1) + j, (i + 1) * (nv + 1) + j
            f.append((a, b, b + 1, a + 1))
    me = bpy.data.meshes.new("vida_pano")
    me.from_pydata(v, [], f)
    camada = me.uv_layers.new(name="UVMap")
    dados = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = v[me.loops[li].vertex_index]
            dados += [p[0], p[2] + 0.5]
    camada.data.foreach_set("uv", dados)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    mat = bpy.data.materials.new("vida_pano")
    mat.use_nodes = True
    bs = next(n_ for n_ in mat.node_tree.nodes if n_.type == "BSDF_PRINCIPLED")
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["Roughness"].default_value = 0.85
    tx = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tx.image = _pintura_pano()
    mat.node_tree.links.new(tx.outputs["Color"], bs.inputs["Base Color"])
    # o pano ve-se dos dois lados: aqui o material e de duas faces (o jogo
    # tambem o poe DoubleSide), e a grelha e de uma so
    mat.use_backface_culling = False
    me.materials.append(mat)
    return bpy.data.objects.new("vida_pano", me)


def construir(colecao):
    G = A2.Malhas()
    pas(G)
    feitos = _objetos(G, "vida_pas", colecao)
    G = A2.Malhas()
    barco(G)
    feitos += _objetos(G, "vida_barco", colecao)
    G = A2.Malhas()
    mastro(G)
    feitos += _objetos(G, "vida_mastro", colecao)
    ob = ave()
    colecao.objects.link(ob)
    feitos.append(ob)
    # UMA face por lado: as folhas finas (lona, vela, costado) ja tem as duas
    # modeladas. Com o material de dois lados (o das aldeias) as duas faces
    # coincidentes disputavam o pixel -- no Blender via-se um xadrez na lona.
    # (so a lona e a vela: o casco do `porto.barco` tem as duas voltas nos
    # MESMOS vertices, o Blender apaga a face repetida, e com uma face so o
    # fundo por dentro sumia visto de cima -- via-se o mar no barco, marca do
    # Lucas 28/09. O resto fica de duas faces, como nas aldeias.)
    for o in feitos:
        for m in o.data.materials:
            m.use_backface_culling = m.name in ("aldeia2_lona", "aldeia2_vela_latina")
    ob = pano()                      # (este e de duas faces: fica de fora)
    colecao.objects.link(ob)
    feitos.append(ob)
    return feitos


def exportar(feitos):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in feitos:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = feitos[0]
    bpy.ops.export_scene.gltf(filepath=SAIDA, export_format="GLB", use_selection=True,
                              export_morph=True, export_apply=False, export_yup=True,
                              export_animations=False)
    tri = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in feitos)
    print("SONDA vida: %d objetos, %d triangulos -> %s" % (len(feitos), tri, SAIDA))


if __name__ == "__main__":
    col = bpy.data.collections.new("vida")
    bpy.context.scene.collection.children.link(col)
    exportar(construir(col))
