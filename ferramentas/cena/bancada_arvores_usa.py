# bancada_arvores_usa.py — as arvores dos EUA (M3, passo 3) lado a lado, antes do forno.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/bancada_arvores_usa.py -- <pasta_saida>
#
# Fila de tras: cada especie inteira (a de perto). Fila da frente: a mesma com
# `lod=True` (a de longe, que o jogo poe a mais de 420 m). Uma figura de 2 m e
# uma casa de 8 m dao a escala. Escreve `arvores_perto.jpg`, `arvores_cima.jpg`
# e `triangulos.json` (por peca, perto e longe).
import json
import math
import os
import sys

import bpy

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402

SAIDA = (sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv
         else os.path.join("ferramentas", "cena", "_saida", "arvores_usa"))
SAIDA = os.path.abspath(SAIDA)
os.makedirs(SAIDA, exist_ok=True)

ESPECIES = [
    ("sequoia", P.proto_sequoia, (34.0, "folha_sequoia", 1)),
    ("abeto", P.proto_abeto, (24.0, "folha_abeto", 2)),
    ("ponderosa", P.proto_ponderosa, (22.0, "folha_ponderosa", 3)),
    ("saguaro", P.proto_saguaro, (10.0, 2)),
    ("josue", P.proto_josue, (8.0, 1)),
    ("palmeira", P.proto_palmeira, (14.0, 4)),
    ("bordo_verm", P.proto_bordo, (14.0, "folha_bordo_verm", 5)),
    ("bordo_lar", P.proto_bordo, (13.0, "folha_bordo_lar", 6)),
    ("bordo_amar", P.proto_bordo, (12.0, "folha_bordo_amar", 7)),
    ("betula", P.proto_betula, (13.0, "folha_betula", 8)),
    ("bordo_verde", P.proto_bordo, (14.0, "folha_bordo_verde", 9)),
    ("carv_ca", P.proto_sobreiro, (11.0, "folha_carvalho_ca", 24)),
    ("loblolly", P.proto_pinheiro_bravo, (20.0, "folha_loblolly", 17)),
    ("junipero", P.proto_junipero, (5.5, "folha_junipero", 5)),
    ("artemisia", P.proto_artemisia, (1.3, "folha_artemisia", 43)),
    ("paloverde", P.proto_oliveira, (5.0, "folha_paloverde", 6)),
    ("carv_vivo", P.proto_sobreiro, (11.0, "folha_sobro", 25)),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear()
P.LIXO = None
cena = bpy.context.scene
tri = {}


def contar(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


PASSO = 18.0
for k, (nome, fn, args) in enumerate(ESPECIES):
    x = (k - (len(ESPECIES) - 1) / 2) * PASSO
    for fila, lod in ((0, False), (1, True)):
        ob = fn(*args, lod=lod)
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        cena.collection.objects.link(ob)
        ob.location = (x, 22.0 if fila == 0 else -4.0, 0.0)
        tri.setdefault(nome, {})["longe" if lod else "perto"] = contar(ob)

# o chao e a escala
bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
chao = bpy.context.object
P._novo(chao, "relva_seca", 0)
for k, h in enumerate((2.0,)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.3, depth=h, location=(-128, -16, h / 2))
    P._novo(bpy.context.object, "pano_verm", 0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-128, -26, 2.5))
casa = bpy.context.object
casa.scale = (8, 6, 5)
P._novo(casa, "reboco", 0)

elev = math.radians(20)
bpy.ops.object.light_add(type="SUN", location=(0, 0, 200))
sol = bpy.context.object
sol.data.energy = 4.5
sol.data.angle = 0.05
sol.data.color = (1.0, 0.86, 0.66)
sol.rotation_euler = (math.pi / 2 - elev, 0.0, math.radians(215))
mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
nm = mundo.node_tree.nodes
nm["Background"].inputs["Color"].default_value = (0.55, 0.62, 0.75, 1)
nm["Background"].inputs["Strength"].default_value = 0.9

for motor in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        cena.render.engine = motor
        break
    except TypeError:
        continue
cena.render.resolution_x, cena.render.resolution_y = 2400, 900
cena.render.image_settings.file_format = "JPEG"
cena.view_settings.view_transform = "AgX"

bpy.ops.object.camera_add(location=(0, -130, 30), rotation=(math.radians(80), 0, 0))
cam = bpy.context.object
cam.data.lens = 30
cena.camera = cam
for lado, cx in (("esq", -78.0), ("dir", 80.0)):
    cam.location.x = cx
    cena.render.filepath = os.path.join(SAIDA, "arvores_perto_%s.jpg" % lado)
    bpy.ops.render.render(write_still=True)
cam.location.x = 0.0

# de cima, como a camara de jogo (60 graus de inclinacao)
cam.location = (0, -110, 190)
cam.rotation_euler = (math.radians(30), 0, 0)
cam.data.lens = 40
cena.render.filepath = os.path.join(SAIDA, "arvores_cima.jpg")
bpy.ops.render.render(write_still=True)

with open(os.path.join(SAIDA, "triangulos.json"), "w", encoding="utf-8") as f:
    json.dump(tri, f, indent=1)
print("SONDA bancada arvores:", json.dumps(tri))
