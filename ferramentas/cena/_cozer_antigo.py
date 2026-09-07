# cozer.py — a aldeia vira um sprite com alfa, para o jogo montar.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/cozer.py -- [lado_px] [amostras]
#
# ── É AQUI QUE A OPÇÃO (c) SE CUMPRE ─────────────────────────────────────────
# O Blender não corre dentro do jogo. O que o jogo recebe é ISTO: uma imagem com
# transparência, com a luz já assada, que o canvas desenha numa posição. É como
# o Age of Empires II, o Anno 1602 e o Caesar III funcionavam, e é o que nos
# deixa manter o motor determinístico e leve.
#
# TRÊS DECISÕES QUE ESTA PEÇA TOMA, e cada uma tem de bater certo com o jogo:
#
#  1. A PROJEÇÃO. Ortográfica, 60° a partir do zénite e 45° de rotação — a
#     isometria clássica de jogo, a mesma dos sprites que o jogo já usa. Se
#     divergir, esta aldeia parece inclinada ao lado das outras peças.
#  2. O SOL. O mesmo azimute e a mesma altura da cena grande, rodados com a
#     câmara. É isto que faz a sombra desta aldeia cair para o mesmo lado da
#     sombra de tudo o resto — a diferença que se vê sem se saber porquê.
#  3. A ÂNCORA. O jogo desenha o sprite pela BASE ao centro. Então recorta-se ao
#     alfa e devolve-se, num ficheiro ao lado, onde ficou o chão dentro da
#     imagem — para o `index.html` não ter de adivinhar.
import json
import math
import os
import random
import sys
import time

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
LADO = int(ARGS[0]) if ARGS else 1024
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 220
SAIDA = os.environ.get("COZER_SAIDA", os.path.join(
    os.getcwd(), "assets", "sprites", "aldeia_v4.png"))
COR_TIME = os.environ.get("COZER_TIME", "pano_azul")


def amb(nome, pad):
    return float(os.environ.get(nome, pad))


SEM = int(os.environ.get("CENA_SEMENTE", 11))
rnd = random.Random(SEM)
t0 = time.time()
RAIO = 34.0
ANG_PORTAO = math.radians(-64)

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
P.COR["pano_azul"] = P.COR[COR_TIME]        # a cor do Rei, antes de haver materiais


def z(x, y):
    return 0.0                               # chão liso: o relevo é do mapa, não da peça


# ---- o chão da peça ----------------------------------------------------------
# Um disco de terra batida com a orla irregular. É ele que assenta a aldeia no
# mapa; sem ele o sprite flutua e vê-se o corte.
verts, faces = [], []
N = 72
for i in range(N):
    a = 2 * math.pi * i / N
    r = (RAIO + 7.0) * (0.94 + 0.10 * math.sin(a * 3.7 + 1.1) + 0.05 * math.sin(a * 7.3))
    verts.append((r * math.cos(a), r * math.sin(a), -0.15))
verts.append((0.0, 0.0, -0.10))
for i in range(N):
    faces.append((i, (i + 1) % N, N))
P._malha("terreiro", verts, faces, "terra", bisel=0)
bpy.ops.mesh.primitive_circle_add(vertices=40, radius=RAIO + 2.0, fill_type="NGON",
                                  location=(0, 0, 0.04))
P._novo(bpy.context.object, "caminho", 0)

# ---- protótipos --------------------------------------------------------------
CASAS = [P.proto_casa2(7.6, 5.8, 2.9, "colmo", "reboco"),
         P.proto_casa2(9.0, 6.2, 3.1, "colmo2", "reboco2"),
         P.proto_casa2(6.8, 5.4, 2.8, "colmo", "reboco2"),
         P.proto_casa2(8.2, 6.0, 3.0, "colmo2", "reboco", False)]
CELEIRO = P.proto_celeiro2()
POCO = P.proto_poco()
MURO = P.proto_muro(4.4, 4.4)
TORRE = P.proto_torre_muro(13.5)
PORTAO = P.proto_casa_portao(16.0, 5.2)
FOLHA = P.proto_folha_portao(5.2, 4.8)
CARROCA = P.proto_carroca()
LENHA = P.proto_lenha()
MEDA = P.proto_meda()

# ---- a aldeia ----------------------------------------------------------------
LARGO = 9.0
postas = []
for i in range(9):
    a = 2 * math.pi * i / 9 + 0.22 + rnd.uniform(-0.08, 0.08)
    d = RAIO * (0.52 + 0.18 * rnd.random())
    if abs(((a - ANG_PORTAO + math.pi) % (2 * math.pi)) - math.pi) < 0.30:
        continue
    x, y = d * math.cos(a), d * math.sin(a)
    P.onde(CASAS[i % 4], x, y, -0.25, math.atan2(-y, -x) - math.pi / 2,
           0.94 + 0.16 * rnd.random())
    postas.append((x, y, a))

ac = ANG_PORTAO + math.pi * 0.72
xc, yc = RAIO * 0.60 * math.cos(ac), RAIO * 0.60 * math.sin(ac)
P.onde(CELEIRO, xc, yc, -0.25, math.atan2(-yc, -xc) - math.pi / 2, 0.95)
P.onde(POCO, 1.5, -0.8, -0.1, 0.4)
for proto, n in ((CARROCA, 2), (LENHA, 3), (MEDA, 3)):
    for i in range(n):
        a = rnd.random() * 6.3
        d = RAIO * (0.34 + 0.32 * rnd.random())
        P.onde(proto, d * math.cos(a), d * math.sin(a), 0, rnd.random() * 6.3)

# ---- a muralha, as torres e a casa do portao ---------------------------------
# UMA implementacao so, em `pecas.muralha`. Estava escrita duas vezes, aqui e no
# outro ficheiro, e as duas copias ja tinham divergido — foi dai que veio a falha
# entre o muro e o portao.
_panos, (gx, gy, zg) = P.muralha(
    MURO, TORRE, PORTAO, FOLHA, RAIO, ANG_PORTAO,
    [ANG_PORTAO + 2.05, ANG_PORTAO - 2.05], z,
    abertura=amb("PORTAO_ABERTO", 0.0))

# ---- luz: a MESMA da cena grande, rodada com a câmara -----------------------
GIRO = math.radians(45)
ELEV = amb("SOL_ELEV", math.radians(30))
bpy.ops.object.light_add(type="SUN", location=(0, 0, 200))
sol = bpy.context.object
sol.data.energy = amb("SOL_FORCA", 5.2)
sol.data.angle = 0.055
sol.data.color = (1.0, 0.90, 0.74)
sol.rotation_euler = (math.pi / 2 - ELEV, 0.0, amb("SOL_AZ", 2.22) + GIRO)

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
nm, lm = mundo.node_tree.nodes, mundo.node_tree.links
ceu = nm.new("ShaderNodeTexSky")
try:
    ceu.sky_type = "NISHITA"
    ceu.sun_elevation = ELEV
    ceu.sun_rotation = amb("SOL_AZ", 2.22) + GIRO
    ceu.sun_disc = False
except Exception:
    pass
lm.new(ceu.outputs["Color"], nm["Background"].inputs["Color"])
nm["Background"].inputs["Strength"].default_value = amb("CEU_FORCA", 0.65)

# ---- câmara: a isometria do jogo --------------------------------------------
INCLINA = math.radians(60)
QUADRO = (RAIO + 12) * 2.35
D = 400.0
bpy.ops.object.camera_add(
    location=(D * math.sin(INCLINA) * math.sin(GIRO),
              -D * math.sin(INCLINA) * math.cos(GIRO),
              D * math.cos(INCLINA)),
    rotation=(INCLINA, 0, GIRO))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = QUADRO
cam.data.clip_start, cam.data.clip_end = 10.0, 900.0
cena.camera = cam

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
cena.render.resolution_x = cena.render.resolution_y = LADO
cena.render.film_transparent = True            # o mapa é que põe o fundo
cena.render.image_settings.file_format = "PNG"
cena.render.image_settings.color_mode = "RGBA"
cena.view_settings.view_transform = os.environ.get("CENA_COR", "AgX")
try:
    cena.view_settings.look = os.environ.get("CENA_LOOK", "AgX - Medium High Contrast")
except Exception:
    pass

bruto = os.path.join(os.path.dirname(SAIDA), "_bruto_" + os.path.basename(SAIDA))
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
cena.render.filepath = bruto
bpy.ops.render.render(write_still=True)

# ---- entregar o bruto, e dizer em que quadro foi renderizado ----------------
# O corte ao alfa NÃO se faz aqui: `bpy.types.Image` não tem recorte, e o Python
# do Blender não traz PIL garantidamente. Fica para o `recortar_sprite.py`, que
# corre no Python do sistema. Daqui vai só o que só o Blender sabe: em quantos
# metros o quadro foi enquadrado, e que o centro da aldeia caiu no meio dele.
with open(os.path.splitext(bruto)[0] + "_quadro.json", "w", encoding="utf-8") as f:
    json.dump({"lado_px": LADO, "metros_do_quadro": QUADRO,
               "isometria": {"inclinacao_graus": 60, "giro_graus": 45},
               "destino": SAIDA}, f, indent=2)
print("SONDA bruto: %s  %dx%d  quadro de %.0f m  %.1f s"
      % (bruto, LADO, LADO, QUADRO, time.time() - t0))
