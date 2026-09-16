# sala_provas.py — uma sala fixa no Blender onde qualquer asset se ve igual.
#
#   pelo MCP (Blender aberto):  exec(open(r"...\sala_provas.py").read(),
#                                    {"__file__": r"...\sala_provas.py"})
#   sem janela:  blender -b --factory-startup -noaudio -P ferramentas/cena/sala_provas.py
#
# ── PORQUE EXISTE ────────────────────────────────────────────────────────────
# Ate aqui cada prova montava a sua propria luz e a sua propria camara, e duas
# fotografias de dias diferentes nao se podiam comparar: mudava o angulo, a
# distancia, a luz. A sala e sempre a mesma -- chao com grelha de 1 m, uma regua
# de 2 m, a luz do jogo e tres camaras fixas -- e por isso uma figura nova ao lado
# das antigas diz logo se esta grande, pequena, escura ou torta.
#
# So mexe na cena "sala_provas": as outras cenas do Blender ficam como estavam.
import math
import os

import bpy
import mathutils

try:
    RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
except NameError:
    RAIZ = os.getcwd()

# as figuras que entram na sala, lado a lado (ficheiro, posicao em x)
FIGURAS = [("sonda3d/lanceiro_novo.glb", -0.9), ("sonda3d/arqueiro_novo.glb", 0.9),
           ("sonda3d/cavaleiro_novo.glb", 3.4)]

cena = bpy.data.scenes.get("sala_provas")
if cena is not None:
    for o in list(cena.objects):
        bpy.data.objects.remove(o, do_unlink=True)
else:
    cena = bpy.data.scenes.new("sala_provas")
if bpy.context.window is not None:
    bpy.context.window.scene = cena
else:
    bpy.context.window_manager.windows[0].scene = cena


def ligar(o):
    cena.collection.objects.link(o)
    return o


def material(nome, cor, rugosidade=0.8):
    m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = cor
    b.inputs["Roughness"].default_value = rugosidade
    b.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = cor
    return m


# ── O CHAO: quadrados de 1 m, para medir de olho ────────────────────────────
me = bpy.data.meshes.new("chao")
me.from_pydata([(-10, -10, 0), (10, -10, 0), (10, 10, 0), (-10, 10, 0)], [], [(0, 1, 2, 3)])
chao = ligar(bpy.data.objects.new("chao", me))
mc = bpy.data.materials.get("sala_chao") or bpy.data.materials.new("sala_chao")
mc.use_nodes = True
nt = mc.node_tree
b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
b.inputs["Roughness"].default_value = 0.95
xadrez = nt.nodes.new("ShaderNodeTexChecker")
xadrez.inputs["Scale"].default_value = 10.0        # plano de 20 m -> casas de 1 m
xadrez.inputs["Color1"].default_value = (0.30, 0.32, 0.26, 1)
xadrez.inputs["Color2"].default_value = (0.24, 0.26, 0.21, 1)
nt.links.new(xadrez.outputs["Color"], b.inputs["Base Color"])
mc.diffuse_color = (0.27, 0.29, 0.23, 1)
me.materials.append(mc)

# ── A REGUA: 2 m em quatro faixas de 50 cm ──────────────────────────────────
branco = material("sala_regua_branco", (0.9, 0.9, 0.9, 1))
vermelho = material("sala_regua_vermelho", (0.8, 0.12, 0.08, 1))
for k in range(4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    faixa = bpy.context.active_object
    for col in list(faixa.users_collection):
        col.objects.unlink(faixa)
    cena.collection.objects.link(faixa)
    faixa.name = "regua_%d" % k
    faixa.scale = (0.06, 0.06, 0.5)
    faixa.location = (-2.2, 0, 0.25 + k * 0.5)
    faixa.data.materials.append(vermelho if k % 2 else branco)

# ── A LUZ DO JOGO: sol inclinado e ceu azulado ──────────────────────────────
sol = ligar(bpy.data.objects.new("sol", bpy.data.lights.new("sol", "SUN")))
sol.data.energy = 3.4
sol.data.angle = math.radians(2.0)
sol.rotation_euler = (math.radians(52), 0, math.radians(35))
ceu = bpy.data.worlds.get("sala_ceu") or bpy.data.worlds.new("sala_ceu")
ceu.use_nodes = True
fundo = next(n for n in ceu.node_tree.nodes if n.type == "BACKGROUND")
fundo.inputs["Color"].default_value = (0.55, 0.68, 0.82, 1)
fundo.inputs["Strength"].default_value = 1.1
cena.world = ceu

# ── AS FIGURAS ──────────────────────────────────────────────────────────────
for ficheiro, x in FIGURAS:
    cam = os.path.join(RAIZ, ficheiro)
    if not os.path.isfile(cam):
        print("SALA: falta %s" % ficheiro)
        continue
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=cam)
    novos = [o for o in bpy.data.objects if o not in antes]
    # ⚠ O importador cria tambem uma ESFERA escondida, que serve de desenho aos
    # ossos. Uma primeira versao mudava todos os objetos novos para a cena e ela
    # apareceu como uma bola branca enorme aos pes de cada figura. O importador
    # ja poe as figuras na cena ativa; so se mexe no que ele deixou a vista.
    raiz = [o for o in novos if o.parent is None and o.name in cena.objects
            and o.type in ("ARMATURE", "MESH", "EMPTY") and not o.hide_get()]
    for o in raiz:
        o.location.x += x
    nome = os.path.splitext(os.path.basename(ficheiro))[0]
    for o in raiz:
        o.name = nome
    print("SALA: %s em x=%+.1f" % (nome, x))

# a marcha em loop: carregar ESPACO no Blender poe-nos a andar no sitio
cena.frame_start, cena.frame_end = 1, 24
cena.render.fps = 30

# ── AS TRES CAMARAS, todas a olhar para o mesmo ponto ───────────────────────
alvo = ligar(bpy.data.objects.new("alvo", None))
alvo.location = (0, 0, 1.0)


def camara(nome, pos, lente):
    c = ligar(bpy.data.objects.new(nome, bpy.data.cameras.new(nome)))
    c.location = pos
    c.data.lens = lente
    t = c.constraints.new("TRACK_TO")
    t.target = alvo
    t.track_axis = "TRACK_NEGATIVE_Z"
    t.up_axis = "UP_Y"
    return c


# o soldado olha para +Y: a camara "frente" esta em +Y a olhar para ele
camara("cam_lado", (7.0, 0.0, 1.1), 45)
frente = camara("cam_frente", (0.0, 7.0, 1.1), 45)
# a do jogo: 20 m de distancia, 20 graus de altura, como a bancada
ang, dist = math.radians(20), 20.0
camara("cam_jogo", (dist * math.cos(ang) * math.sin(math.radians(35)),
                    dist * math.cos(ang) * math.cos(math.radians(35)),
                    1.0 + dist * math.sin(ang)), 50)
cena.camera = frente

# o nome do motor mudou entre versoes do Blender; tenta-se, sem cravar um so
for motor in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        cena.render.engine = motor
        break
    except TypeError:
        pass
cena.render.resolution_x, cena.render.resolution_y = 1280, 720
print("SALA: pronta")
