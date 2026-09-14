# ilhas_cor.py — cada ILHA da malha numa cor, para se ver do que ela e feita.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/ilhas_cor.py -- <ficheiro.glb>
#
# ── PORQUE EXISTE ────────────────────────────────────────────────────────────
# Um modelo que vem de fora nao e "uma malha": sao dezenas de pedacos soltos que
# so parecem um corpo porque estao encostados. Quando um deles fica com o osso
# errado, ve-se no video uma peca a mexer sozinha -- e descrever isso por
# palavras e lento e ambiguo. Aqui pinta-se cada pedaco de uma cor e tira-se uma
# fotografia: quantas pecas ha, onde estao, e qual e qual.
import math
import os
import sys
from collections import defaultdict

import bpy
import mathutils

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ALVO = ARGS[0] if ARGS else "assets/Lanceiro.glb"
PASTA = os.path.join(os.getcwd(), "ferramentas", "cena", "_saida")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(), ALVO))
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.context.view_layer.objects.active = ms[0]
for o in ms:
    o.select_set(True)
if len(ms) > 1:
    bpy.ops.object.join()
corpo = bpy.context.object
corpo.data.transform(mathutils.Matrix.Rotation(math.pi, 4, "Z"))
me = corpo.data

pai = list(range(len(me.vertices)))


def acha(a):
    r = a
    while pai[r] != r:
        r = pai[r]
    while pai[a] != r:
        pai[a], a = r, pai[a]
    return r


for e in me.edges:
    a, b = acha(e.vertices[0]), acha(e.vertices[1])
    if a != b:
        pai[a] = b
g = defaultdict(list)
for i in range(len(me.vertices)):
    g[acha(i)].append(i)

zs = [v.co.z for v in me.vertices]
z0, H = min(zs), max(zs) - min(zs)
ordem = sorted(g.values(), key=lambda vv: -len(vv))
print("SONDA ilhas: %d" % len(ordem))
# ── A TABELA E O QUE SE LE DEPOIS DA FOTOGRAFIA ─────────────────────────────
# "comprida/fina" = vao em altura a dividir pela largura. Uma haste passa de 4;
# uma perna anda por 2,7; um bloco de corpo por 1. E por aqui que se decide o
# que e madeira e o que e gente, sem olhar para a cor.
print("SONDA  # cor            n  z/H de..ate  largura/H  comprida/fina  centro xy")
PALETA = [(0.95, 0.20, 0.15), (0.15, 0.45, 0.95), (0.98, 0.80, 0.10),
          (0.20, 0.80, 0.25), (0.75, 0.25, 0.90), (0.10, 0.85, 0.85),
          (0.98, 0.50, 0.10), (0.55, 0.55, 0.55), (0.35, 0.20, 0.70),
          (0.90, 0.40, 0.55), (0.30, 0.65, 0.40), (0.70, 0.70, 0.25)]
NOMES = ["vermelho", "azul", "amarelo", "verde", "roxo", "ciano",
         "laranja", "cinza", "anil", "rosa", "musgo", "azeitona"]
ca = me.color_attributes.new(name="ILHAS", type="FLOAT_COLOR", domain="POINT")
for k, vv in enumerate(ordem):
    cor = PALETA[k % len(PALETA)] if k < 12 else (0.85, 0.85, 0.85)
    for i in vv:
        ca.data[i].color = (*cor, 1.0)
    if len(vv) < 60:
        continue
    zz = [(me.vertices[i].co.z - z0) / H for i in vv]
    xx = [me.vertices[i].co.x for i in vv]
    yy = [me.vertices[i].co.y for i in vv]
    larg = max(max(xx) - min(xx), max(yy) - min(yy)) / H
    print("SONDA %3d %-9s %6d  %.3f..%.3f    %.3f       %5.1f      (%+.3f, %+.3f)"
          % (k, NOMES[k] if k < 12 else "cinza-claro", len(vv), min(zz), max(zz),
             larg, (max(zz) - min(zz)) / max(larg, 1e-6),
             (min(xx) + max(xx)) / 2, (min(yy) + max(yy)) / 2))

mat = bpy.data.materials.new("ilhas")
mat.use_nodes = True
nt = mat.node_tree
b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
at = nt.nodes.new("ShaderNodeVertexColor")
at.layer_name = "ILHAS"
nt.links.new(at.outputs["Color"], b.inputs["Base Color"])
b.inputs["Roughness"].default_value = 0.9
me.materials.clear()
me.materials.append(mat)

cena = bpy.context.scene
luz = bpy.data.lights.new("l", "SUN")
luz.energy = 2.8
ol = bpy.data.objects.new("l", luz)
cena.collection.objects.link(ol)
ol.rotation_euler = (math.radians(55), 0, math.radians(25))
cena.world = bpy.data.worlds.new("w")
cena.world.use_nodes = True
cena.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.93, .93, .93, 1)

cd = bpy.data.cameras.new("c")
cm = bpy.data.objects.new("c", cd)
cena.collection.objects.link(cm)
cena.camera = cm
mira = bpy.data.objects.new("m", None)
cena.collection.objects.link(mira)
tt = cm.constraints.new("TRACK_TO")
tt.target = mira
tt.track_axis = "TRACK_NEGATIVE_Z"
tt.up_axis = "UP_Y"
cena.render.engine = "CYCLES"
cena.cycles.samples = 24
cena.render.resolution_x = cena.render.resolution_y = 760
cena.view_settings.view_transform = "Standard"

# a vista inteira e, depois, so os pes -- que e onde as pecas se confundem
for nome, mz, d, alt in (("todo", 0.50, 2.0, 0.55), ("pes", 0.10, 0.55, 0.12)):
    mira.location = (0, 0, z0 + H * mz)
    for lado, (dx, dy) in (("lado", (1, 0)), ("frente", (0, -1))):
        cm.location = (dx * H * d, dy * H * d, z0 + H * (mz + alt * 0.3))
        cena.render.filepath = os.path.join(PASTA, "ilhas_%s_%s.png" % (nome, lado))
        bpy.ops.render.render(write_still=True)
print("SONDA -> ferramentas/cena/_saida/ilhas_{todo,pes}_{lado,frente}.png")
