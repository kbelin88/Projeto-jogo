# aldeias.py — duas aldeias ligadas por uma estrada.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/aldeias.py -- [largura_px] [amostras]
#
# O PRIMEIRO PASSO do caminho novo. Não é o mapa da Ibéria a 1097 m por pixel —
# é uma cena de 400 m de largura, a uns 0,2 m por pixel. Cinco mil vezes mais
# perto, e é essa a única razão por que aqui se pode ver uma casa, uma árvore ou
# um caminho de terra.
#
# O QUE ESTA CENA TEM DE PROVAR:
#   1. que as peças se lêem (casa, torre, paliçada, campo, árvore);
#   2. que a luz é uma só e as sombras contam a mesma história;
#   3. que a estrada liga de facto duas aldeias, que é a mecânica do jogo;
#   4. QUANTO CUSTA uma imagem destas — se custar dez minutos serve para vídeo,
#      não para um jogo, e isso muda toda a arquitetura a seguir.
import math
import os
import random
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402
import relevo as R                                         # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LARG = int(ARGS[0]) if ARGS else 1920
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 160
SAIDA = os.environ.get(
    "CENA_SAIDA", os.path.join(os.getcwd(), "ferramentas", "cena", "_saida", "aldeias.png"))

CAMPO_X, CAMPO_Y = 310.0, 174.0        # metros que a câmara abrange (16:9)
SEM = int(os.environ.get("CENA_SEMENTE", 7))
rnd = random.Random(SEM)
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene

# ---- o terreno ---------------------------------------------------------------
# Gerado em numpy, e e o MESMO vetor de alturas que responde ao `altura(x, y)`.
# Uma fonte de verdade: se a malha diz 4,2 m naquele ponto, a casa assenta a
# 4,2 m. Foi a falta disto que deixou a primeira cena toda a flutuar.
A = (-92.0, -26.0)           # aldeia oeste
B = (98.0, 36.0)             # aldeia leste
R_A, R_B = 32.0, 25.0

T = R.Terreno(CAMPO_X * 3.2, CAMPO_Y * 4.0, celula=2.6, semente=SEM, amplitude=16.0)


def caminho(a, b, curva=32.0, n=60):
    """polilinha entre duas aldeias, com uma curva e ondulacao.

    Reta perfeita entre dois pontos e a marca mais visivel de que aquilo foi
    tracado por um computador, e nenhuma textura a disfarca.
    """
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    pts = []
    for i in range(n + 1):
        t = i / n
        f = math.sin(t * math.pi)
        dd = curva * f + math.sin(t * 7.5 + 1.2) * 7.0 * f
        pts.append((ax + dx * t + nx * dd, ay + dy * t + ny * dd))
    return pts


PLANO = caminho(A, B)
T.patamar(A[0], A[1], R_A + 4, 16.0)          # os patamares primeiro: a estrada
T.patamar(B[0], B[1], R_B + 4, 14.0)          # depois liga-se a eles
ESTRADA = T.corredor(PLANO, largura=8.0, borda=18.0)

verts, faces = T.malha()
chao = P._malha("chao", verts, faces, "relva", bisel=0)
chao.data.materials.clear()

mat = bpy.data.materials.new("chao")
mat.use_nodes = True
nos, liga = mat.node_tree.nodes, mat.node_tree.links
princ = nos["Principled BSDF"]
princ.inputs["Roughness"].default_value = 0.95


def _ruido(escala, detalhe=8.0):
    n = nos.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = escala
    n.inputs["Detail"].default_value = detalhe
    return n.outputs["Fac"]


rampa = nos.new("ShaderNodeValToRGB")
rampa.color_ramp.elements[0].position = 0.36
rampa.color_ramp.elements[0].color = P.COR["relva"]
rampa.color_ramp.elements[1].position = 0.70
rampa.color_ramp.elements[1].color = P.COR["relva_seca"]
rampa.color_ramp.elements.new(0.52).color = (0.108, 0.152, 0.038, 1)
liga.new(_ruido(0.045), rampa.inputs["Fac"])
# a encosta a pique fica pelada: e o que desenha as arestas do terreno de graca
geo = nos.new("ShaderNodeNewGeometry")
sep = nos.new("ShaderNodeSeparateXYZ")
liga.new(geo.outputs["Normal"], sep.inputs["Vector"])
decl = nos.new("ShaderNodeMapRange")
decl.inputs["From Min"].default_value = 0.985
decl.inputs["From Max"].default_value = 0.92
decl.clamp = True
liga.new(sep.outputs["Z"], decl.inputs["Value"])
mist = nos.new("ShaderNodeMix")
mist.data_type = "RGBA"
liga.new(decl.outputs["Result"], mist.inputs["Factor"])
liga.new(rampa.outputs["Color"], mist.inputs[6])
mist.inputs[7].default_value = P.COR["terra"]
liga.new(mist.outputs["Result"], princ.inputs["Base Color"])
relevo = nos.new("ShaderNodeBump")
relevo.inputs["Strength"].default_value = 0.30
liga.new(_ruido(3.0, 6.0), relevo.inputs["Height"])
liga.new(relevo.outputs["Normal"], princ.inputs["Normal"])
chao.data.materials.append(mat)
bpy.context.view_layer.objects.active = chao
bpy.ops.object.shade_smooth()

# ---- protótipos (é aqui, e SÓ aqui, que se usa bpy.ops) ----------------------
CASAS = [P.proto_casa(6.5, 5.2, 2.8, "colmo"),
         P.proto_casa(8.5, 6.0, 3.1, "colmo2"),
         P.proto_casa(7.2, 5.6, 3.0, "colmo")]
CELEIRO = P.proto_celeiro()
ESTACA = P.proto_estaca(2.8)
TORRE = P.proto_torre(10.0)
ARVORES = [P.proto_arvore(11.0, "folha"),
           P.proto_arvore(9.0, "folha2", ((0.55, 1.0), (0.80, 0.62))),
           P.proto_arvore(13.0, "folha3", ((0.48, 0.9), (0.70, 0.78), (0.90, 0.44)))]
PENEDO = P.proto_penedo(1.6)
print("SONDA prototipos prontos em %.1f s" % (time.time() - t0), flush=True)

# ---- a estrada, deitada SOBRE o terreno --------------------------------------
def fita(pts, largura, alto, cor):
    """a faixa segue a altura do chao ponto a ponto, mais uns centimetros"""
    v, f = [], []
    for i, (x, y, z) in enumerate(pts):
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        tx, ty = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        L = max(math.hypot(tx, ty), 1e-6)
        nx, ny = -ty / L, tx / L
        w = largura * (0.86 + 0.28 * math.sin(i * 0.9))
        for lado in (1, -1):
            ex, ey = x + nx * w / 2 * lado, y + ny * w / 2 * lado
            v.append((ex, ey, T.altura(ex, ey) + alto))
        if i:
            k = 2 * i
            f.append((k - 2, k - 1, k + 1, k))
    return P._malha("estrada", v, f, cor, bisel=0)


fita(ESTRADA, 5.4, 0.09, "caminho")
fita(ESTRADA, 2.3, 0.15, "terra")       # o rodado, mais batido

# ---- as aldeias --------------------------------------------------------------


def aldeia(cx, cy, raio, n_casas, para, com_torre, semente):
    r = random.Random(semente)
    ang = math.atan2(para[1] - cy, para[0] - cx)
    # o chão pisado, primeiro, para tudo assentar em cima
    z0 = T.altura(cx, cy)
    bpy.ops.mesh.primitive_circle_add(vertices=30, radius=raio + 3.0,
                                      fill_type="NGON", location=(cx, cy, z0 + 0.07))
    P._novo(bpy.context.object, "caminho", 0)
    n = max(12, int(2 * math.pi * raio / 1.05))
    for i in range(n):
        a = 2 * math.pi * i / n
        if abs(((a - ang + math.pi) % (2 * math.pi)) - math.pi) < 0.15:
            continue
        ex, ey = cx + raio * math.cos(a), cy + raio * math.sin(a)
        P.onde(ESTACA, ex, ey, T.altura(ex, ey), r.random() * 3.1,
               0.86 + 0.28 * r.random())
    for lado in (-1, 1):                                    # as jambas do portao
        ex = cx + raio * math.cos(ang + lado * 0.20)
        ey = cy + raio * math.sin(ang + lado * 0.20)
        P.onde(ESTACA, ex, ey, T.altura(ex, ey), 0, 1.55)
    postos = []
    for i in range(n_casas):
        for _ in range(50):
            a = r.random() * 2 * math.pi
            dd = raio * (0.18 + 0.62 * math.sqrt(r.random()))
            x, y = cx + dd * math.cos(a), cy + dd * math.sin(a)
            if all((x - ox) ** 2 + (y - oy) ** 2 > 128 for ox, oy in postos):
                postos.append((x, y))
                break
        else:
            continue
        rz = math.atan2(cy - y, cx - x) + (r.random() - 0.5) * 0.9
        P.onde(CELEIRO if i == 0 else CASAS[i % len(CASAS)], x, y,
               T.altura(x, y) - 0.25, rz, 0.92 + 0.22 * r.random())
    if com_torre:
        tx = cx - math.cos(ang) * raio * 0.5
        ty = cy - math.sin(ang) * raio * 0.5
        P.onde(TORRE, tx, ty, T.altura(tx, ty) - 0.3, r.random() * 3)


aldeia(A[0], A[1], R_A, 9, B, True, SEM)
aldeia(B[0], B[1], R_B, 6, A, False, SEM + 50)

# ---- os campos, do lado de fora ---------------------------------------------
for cx, cy, raio, n in ((A[0], A[1], R_A, 5), (B[0], B[1], R_B, 4)):
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.random() * 0.5
        dd = raio + 26 + rnd.random() * 18
        fx, fy = cx + dd * math.cos(a), cy + dd * math.sin(a)
        if T.declive(fx, fy) > 0.17:            # ninguem semeia numa encosta
            continue
        o = P.campo(fx, fy, 24 + rnd.random() * 14, 16 + rnd.random() * 10, a,
                    "trigo" if rnd.random() < 0.6 else "lavrado")
        o.location = (fx, fy, T.altura(fx, fy))

# ---- árvores e pedras, longe do que já lá está -------------------------------
LONGE = [(A[0], A[1], R_A + 30), (B[0], B[1], R_B + 26)]


def livre(x, y):
    for cx, cy, r in LONGE:
        if (x - cx) ** 2 + (y - cy) ** 2 < r * r:
            return False
    for ex, ey, _ in ESTRADA[::2]:
        if (x - ex) ** 2 + (y - ey) ** 2 < 100:
            return False
    return True


arv = 0
for i in range(9000):
    x = (rnd.random() - 0.5) * CAMPO_X * 2.6
    y = (rnd.random() - 0.5) * CAMPO_Y * 3.2
    if not livre(x, y):
        continue
    # a mata adensa nas beiras e rareia no meio, onde vivem as aldeias
    borda = max(abs(x) / (CAMPO_X * 0.60), abs(y) / (CAMPO_Y * 0.66))
    if rnd.random() > 0.08 + borda ** 2 * 1.25:
        continue
    P.onde(ARVORES[i % 3], x, y, T.altura(x, y) - 0.4, rnd.random() * 3.1,
           0.72 + rnd.random() * 0.62)
    arv += 1
ped = 0
for i in range(400):
    x = (rnd.random() - 0.5) * CAMPO_X * 2.4
    y = (rnd.random() - 0.5) * CAMPO_Y * 3.0
    if livre(x, y):
        P.onde(PENEDO, x, y, T.altura(x, y) - 0.3, rnd.random() * 3.1,
               0.5 + rnd.random() * 1.3)
        ped += 1
print("SONDA cena povoada em %.1f s | %d arvores, %d pedras" % (time.time() - t0, arv, ped),
      flush=True)

# ---- luz ---------------------------------------------------------------------
# Sol BAIXO. É o que faz a sombra ser comprida, e é a sombra comprida que dá
# volume — foi a primeira coisa que se viu na referência do Age of Empires, muito
# antes de qualquer detalhe de geometria.
bpy.ops.object.light_add(type="SUN", location=(0, 0, 300))
sol = bpy.context.object
sol.data.energy = float(os.environ.get("SOL_FORCA", 5.0))
sol.data.angle = 0.10
sol.data.color = (1.0, 0.90, 0.74)
sol.rotation_euler = (float(os.environ.get("SOL_ALT", 1.16)), 0.0,
                      float(os.environ.get("SOL_AZ", 2.15)))

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
fundo = mundo.node_tree.nodes["Background"]
fundo.inputs["Color"].default_value = (0.30, 0.42, 0.58, 1.0)
fundo.inputs["Strength"].default_value = float(os.environ.get("CEU_FORCA", 0.62))

# ---- câmara ------------------------------------------------------------------
# Ortográfica e inclinada, como no mapa: a projeção continua afim, portanto uma
# posição no chão mapeia linearmente para o ecrã e o motor pode continuar a
# raciocinar em duas dimensões.
INCLINA = float(os.environ.get("CENA_INCLINA", math.radians(56)))
GIRO = float(os.environ.get("CENA_GIRO", math.radians(28)))
D = 700.0
bpy.ops.object.camera_add(
    location=(D * math.sin(INCLINA) * math.sin(GIRO),
              -D * math.sin(INCLINA) * math.cos(GIRO),
              D * math.cos(INCLINA)),
    rotation=(INCLINA, 0, GIRO))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = CAMPO_X
cam.data.clip_start, cam.data.clip_end = 10.0, 2000.0
cena.camera = cam

# ---- render ------------------------------------------------------------------
bpy.ops.preferences.addon_enable(module="cycles")
cena.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for tipo in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = tipo
    except Exception:
        continue
    prefs.get_devices()
    if any(x.type == tipo for x in prefs.devices):
        for dev in prefs.devices:
            dev.use = dev.type in (tipo, "CPU")
        cena.cycles.device = "GPU"
        break

cena.cycles.samples = AMOSTRAS
cena.cycles.use_denoising = True
cena.render.resolution_x = LARG
cena.render.resolution_y = int(LARG * CAMPO_Y / CAMPO_X)
cena.render.image_settings.file_format = "PNG"
cena.view_settings.view_transform = "Standard"
cena.render.filepath = SAIDA
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
bpy.ops.render.render(write_still=True)
print("SONDA cena escrita: %s  %dx%d | %d amostras | %.1f s no total"
      % (SAIDA, cena.render.resolution_x, cena.render.resolution_y,
         AMOSTRAS, time.time() - t0))
