# exportar_tropa.py — o lanceiro, vestido de nosso, com esqueleto e animações.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/exportar_tropa.py
#
# ── O QUE SAI DAQUI ──────────────────────────────────────────────────────────
# `sonda3d/lanceiro.glb`: uma malha com esqueleto e as animações lá dentro. Não
# é como as outras peças do mapa — as aldeias e a mata saem como geometria
# rígida e são instanciadas aos milhares. Esta sai COM OSSOS, e o `three` não
# instancia malhas com ossos.
#
# Isso não é um problema aqui, e é por causa de uma decisão anterior: o corte
# por píxeis limita as figuras visíveis a algumas dezenas. Aquilo que fizemos
# para elas se LEREM é o que torna a animação a sério acessível.
import math
import os
import sys

import bmesh
import bpy
import mathutils

RAIZ = os.getcwd()
sys.path.append(os.path.join(RAIZ, "ferramentas", "cena"))
import tropas3d as T                                       # noqa: E402

SAIDA = os.path.join(RAIZ, "sonda3d")

corpo, arm = T.abrir_soldado()
import pecas as P                                          # noqa: E402
P._mats.clear()
P.LIXO = None

n_pano, n_perna = T.de_saia_para_calca(corpo)
print("SONDA calças: %d vértices de barra, %d de perna" % (n_pano, n_perna))

# ── A LANÇA ──────────────────────────────────────────────────────────────────
# A dele fica no ficheiro. Vem solta (sem pai e sem pesos) e, pior, desenhada
# para uma pose que não é a que o ficheiro traz: ao prendê-la ao osso da mão ela
# aparecia a flutuar meio metro à frente do peito. E é curta — pouco mais de um
# metro na escala do homem, mais dardo do que lança.
#
# Fazemos a nossa. Não se desenha em repouso: escolhe-se onde ela há de estar
# COM O HOMEM DE PÉ (a subir do punho, como se leva uma lança em marcha) e a
# conta encontra onde isso fica no espaço de repouso do osso — que é a única
# coordenada que o esqueleto aceita.
velha = bpy.data.objects.get("spear")
if velha:
    bpy.data.objects.remove(velha, do_unlink=True)

COMP = 1.40                      # nas unidades deste corpo (1,169 = a altura)
ABAIXO = 0.34                    # quanto sobra por baixo da mão
RAIO = 0.014

pb = arm.pose.bones["hand.R"]
punho = arm.matrix_world @ ((pb.head + pb.tail) / 2.0)

me = bpy.data.meshes.new("lanca")
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=8,
                      radius1=RAIO, radius2=RAIO, depth=COMP)
bmesh.ops.translate(bm, verts=bm.verts, vec=(0.0, 0.0, COMP / 2 - ABAIXO))
ponta = bmesh.ops.create_cone(bm, cap_ends=True, segments=8,
                              radius1=RAIO * 3.0, radius2=0.0, depth=0.17)
bmesh.ops.translate(bm, verts=ponta["verts"],
                    vec=(0.0, 0.0, COMP - ABAIXO + 0.085))
bm.to_mesh(me)
bm.free()

lanca = bpy.data.objects.new("lanca", me)
bpy.context.scene.collection.objects.link(lanca)
me.transform(mathutils.Matrix.Translation(punho))
# a ponta é de aço e a haste de madeira: dois materiais, separados pela altura
me.materials.append(P.material("madeira2"))
me.materials.append(P.material("aco"))
for f in me.polygons:
    if f.center.z > punho.z + COMP - ABAIXO:
        f.material_index = 1

M = (arm.matrix_world
     @ arm.data.bones["hand.R"].matrix_local
     @ pb.matrix.inverted()
     @ arm.matrix_world.inverted())
me.transform(M)

g = lanca.vertex_groups.new(name="hand.R")
g.add(range(len(me.vertices)), 1.0, "REPLACE")
bpy.ops.object.select_all(action="DESELECT")
lanca.select_set(True)
corpo.select_set(True)
bpy.context.view_layer.objects.active = corpo
bpy.ops.object.join()
print("SONDA lança de %.2f m presa à mão direita" % (COMP * 2.0 / T.ALT_OGA))

# ── VESTIDO DE NOSSO ─────────────────────────────────────────────────────────
# A pele fica com o mapa PINTADO dele — é um atlas feito à medida deste corpo,
# e nenhuma textura repetível o iguala numa cara.
#
# O resto passa às nossas: o atlas dele é quase branco no pano, e é isso que
# fazia o soldado parecer de gesso. As nossas são ladrilhos mapeados por
# coordenada de objeto, portanto não precisam de UV nenhum.
#
# ── E TINGIDO ────────────────────────────────────────────────────────────────
# O linho cru e quase branco, e a pele dele tambem e clara: com os dois ao lado
# um do outro a calca desaparece e o homem volta a parecer de saia e pernas
# nuas. A cor entra como FATOR do glTF (uma multiplicacao por cima da textura),
# que e a unica maneira de tingir que sobrevive a exportacao -- um no de mistura
# qualquer sai de la sem textura nenhuma.
def _linear(c):
    """de sRGB (o que se ve num seletor de cor) para linear (o que o no le)"""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
                 for v in c)


def _tingir(mat, cor, nome):
    m = mat.copy()
    m.name = nome
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    lig = bsdf.inputs["Base Color"].links
    if not lig:
        bsdf.inputs["Base Color"].default_value = (*_linear(cor), 1.0)
        return m
    fonte = lig[0].from_socket
    mis = nt.nodes.new("ShaderNodeMix")
    mis.data_type = "RGBA"
    mis.blend_type = "MULTIPLY"
    mis.inputs["Factor"].default_value = 1.0
    nt.links.new(fonte, mis.inputs[6])                 # A
    mis.inputs[7].default_value = (*_linear(cor), 1.0)  # B
    nt.links.new(mis.outputs[2], bsdf.inputs["Base Color"])
    return m


# tunica de linho tinto de ocre, calcas de la escura, e a pele a ficar clara
# por contraste -- e assim que se le um soldado a quarenta pixeis de altura
COR = {"armor_clothe": (0.62, 0.47, 0.28), "calcas": (0.27, 0.22, 0.18)}
NOSSO = {"armor_clothe": "pano", "calcas": "pano", "belt": "couro",
         "helmet": "malha", "shoes": "couro"}
for i, m in enumerate(corpo.data.materials):
    novo = NOSSO.get(m.name)
    if not novo:
        continue
    base = P.material(novo)
    cor = COR.get(m.name)
    corpo.data.materials[i] = _tingir(base, cor, "M_" + m.name) if cor else base
print("SONDA materiais: %s" % ", ".join(m.name for m in corpo.data.materials))

# ── O TAMANHO ────────────────────────────────────────────────────────────────
# 2,0 m de peça; o mapa desenha a 2,2x. A escala aplica-se à ARMADURA e não à
# malha: a malha é deformada pelos ossos, e escalá-la deixava-a a discordar
# deles a cada quadro.
k = 2.0 / T.ALT_OGA
arm.scale = (k, k, k)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

for a in bpy.data.actions:
    print("SONDA animação: %-16s %d quadros" % (a.name, int(a.frame_range[1] - a.frame_range[0])))

# ── AS TEXTURAS DESCEM ───────────────────────────────────────────────────────
# 888 triângulos e 15 MB: o peso era todo das fotografias a 2K. Um soldado de
# 5,3 m visto a 40 píxeis não distingue 2048 de 512, e o jogador descarrega
# trinta vezes menos.
for im in bpy.data.images:
    if im.size[0] > 512:
        im.scale(512, 512)
    # ── E EMBRULHAM-SE NO FICHEIRO ───────────────────────────────────────────
    # A pele dele nao saia no glTF: o material apontava para a imagem certa, e o
    # exportador escrevia o material SEM textura nenhuma, sem um aviso. A imagem
    # vive fora do .blend (`//textures/skin.png`) e o exportador nao lhe chegou.
    # Empacotada, a imagem passa a estar DENTRO do ficheiro e ha uma coisa so
    # para exportar. Conferido no GLB: `skin` deixa de sair com baseTex nulo.
    if im.size[0] and not im.packed_file:
        try:
            im.pack()
        except RuntimeError:
            pass

corpo.data.calc_loop_triangles()
alvo = os.path.join(SAIDA, "lanceiro.glb")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=alvo, export_format="GLB", export_apply=False,
    export_yup=True, export_cameras=False, export_lights=False,
    export_animations=True, export_skins=True,
    export_animation_mode="ACTIONS", export_nla_strips=False)
print("SONDA -> %s  (%d triângulos, %.2f MB)"
      % (alvo, len(corpo.data.loop_triangles), os.path.getsize(alvo) / 1e6))
