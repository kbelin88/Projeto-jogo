# ver_peca.py — uma fotografia de qualquer .glb, sem montar cena nenhuma.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/ver_peca.py -- <ficheiro.glb> [lado]
#
# Existe para responder depressa a "como e que isto chega aqui?": importa,
# enquadra pela caixa da peca, acende a MESMA luz do forno e renderiza. Sem
# isto, um modelo que vem de fora so se ve depois de entrar no mapa -- e ai
# ja e tarde para descobrir que veio deitado, oco ou em centimetros.
import json
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ALVO = ARGS[0] if ARGS else "assets/Lanceiro.glb"
LADO = int(ARGS[1]) if len(ARGS) > 1 else 900
# terceiro argumento: quantos triangulos queremos na peca (0 = deixa como veio).
# E assim que se descobre ONDE uma malha comeca a quebrar, sem adivinhar.
CORTAR = int(ARGS[2]) if len(ARGS) > 2 else 0
SAIDA = os.path.join(os.getcwd(), "ferramentas", "cena", "_saida",
                     os.path.splitext(os.path.basename(ALVO))[0]
                     + ("_%dk" % round(CORTAR / 1000) if CORTAR else "") + "_vista.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(), ALVO))
malhas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not malhas:
    raise SystemExit("nenhuma malha no ficheiro")

# ── A COR DE VERTICE TEM DE SER LIGADA A MAO ────────────────────────────────
# Um ficheiro sem textura e com COLOR_0 chega ao Blender com a cor nos DADOS da
# malha e um material branco por cima: renderiza tudo branco, e parece que a
# peca veio sem cor nenhuma. Aqui liga-se, para a fotografia dizer a verdade.
for ob in malhas:
    if not ob.data.color_attributes:
        continue
    for mat in (ob.data.materials or []):
        if not mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf or bsdf.inputs["Base Color"].is_linked:
            continue
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = ob.data.color_attributes[0].name
        nt.links.new(ca.outputs["Color"], bsdf.inputs["Base Color"])

if CORTAR:
    # ── REDUZIR E MEDIR, NAO REDUZIR E ESPERAR ──────────────────────────────
    # O `Decimate` trabalha por RACIO, nao por numero de triangulos: e preciso
    # contar antes, dividir, e contar outra vez para dizer o que saiu de facto.
    antes = sum(len(o.data.loop_triangles) for o in malhas
                if (o.data.calc_loop_triangles() or True))
    razao = min(1.0, CORTAR / max(antes, 1))
    for ob in malhas:
        md = ob.modifiers.new("reduzir", "DECIMATE")
        md.ratio = razao
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=md.name)
    depois = sum(len(o.data.loop_triangles) for o in malhas
                 if (o.data.calc_loop_triangles() or True))
    print("SONDA reduzido: %d -> %d triangulos (pedido %d)" % (antes, depois, CORTAR))

lo = [1e30] * 3
hi = [-1e30] * 3
for ob in malhas:
    for v in ob.bound_box:
        p = ob.matrix_world @ type(ob.location)(v)
        for k in range(3):
            lo[k] = min(lo[k], p[k])
            hi[k] = max(hi[k], p[k])
meio = [(lo[k] + hi[k]) / 2 for k in range(3)]
raio = max(hi[k] - lo[k] for k in range(3)) or 1.0
print("SONDA caixa: %.3f x %.3f x %.3f, centro (%.3f, %.3f, %.3f)"
      % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], *meio))

# o chao, para a peca nao flutuar no vazio
bpy.ops.mesh.primitive_plane_add(size=raio * 12, location=(meio[0], meio[1], lo[2]))
chao = bpy.context.object
m = bpy.data.materials.new("chao")
m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.22, .25, .18, 1)
chao.data.materials.append(m)

cena = bpy.context.scene
cfg = json.load(open(os.path.join(os.getcwd(), "sonda3d", "cena.json"), encoding="utf-8"))
d = cfg["sol"]["direcao_yup"]
sol = bpy.data.lights.new("sol", "SUN")
sol.energy = 3.4
sol.angle = math.radians(2.0)
ob_sol = bpy.data.objects.new("sol", sol)
cena.collection.objects.link(ob_sol)
ob_sol.rotation_euler = (math.radians(52), 0, math.radians(35))

mundo = bpy.data.worlds.new("ceu")
cena.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (.55, .68, .82, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.1

cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
cena.collection.objects.link(cam)
cena.camera = cam
# ── A MIRA E UMA RESTRICAO, NAO UMA CONTA ───────────────────────────────────
# Apontar a camara "a mao" com angulos de Euler e facil de errar -- a primeira
# versao disto renderizou o chao visto de dentro. Com um alvo e um TRACK_TO,
# a camara olha para onde tem de olhar, e nao ha conta nenhuma para falhar.
ang = math.radians(38)
dist = raio * 2.4
cam.location = (meio[0] + dist * math.cos(ang), meio[1] - dist * math.sin(ang),
                meio[2] + raio * 0.75)
alvo = bpy.data.objects.new("alvo", None)
alvo.location = meio
cena.collection.objects.link(alvo)
olhar = cam.constraints.new("TRACK_TO")
olhar.target = alvo
olhar.track_axis = "TRACK_NEGATIVE_Z"
olhar.up_axis = "UP_Y"

cena.render.engine = "CYCLES"
cena.cycles.samples = 64
cena.render.resolution_x = cena.render.resolution_y = LADO
cena.render.film_transparent = False
cena.view_settings.view_transform = "AgX"
cena.render.filepath = SAIDA
bpy.ops.render.render(write_still=True)
print("SONDA -> %s" % SAIDA)
