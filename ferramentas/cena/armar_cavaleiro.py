# armar_cavaleiro.py — o cavaleiro do ComfyUI a galopar: cavalo com esqueleto,
# homem rigido em cima.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/armar_cavaleiro.py -- \
#           assets/cavaleiro.glb sonda3d/cavaleiro_novo.glb 8000
#
# ── O QUE HA DE DIFERENTE DO `armar_lanceiro.py` ─────────────────────────────
# Um cavalo nao e um homem de pe: quatro patas, pescoco, cauda, e um homem
# sentado cujas pernas pendem ao lado do cavalo. Nada aqui e adivinhado -- foi
# tudo o que o lanceiro e o arqueiro ensinaram, aplicado desde o inicio:
#   * as JUNTAS do cavalo foram postas pelo Lucas no Blender (marcas/cavaleiro_ossos.json);
#   * o HOMEM foi pintado por ele (marcas/cavaleiro_cavaleiro.json) e vai rigido;
#   * a marca aplica-se ANTES de reduzir, e o homem reduz-se como objeto seu;
#   * os cascos sao rigidos (como as botas); as patas so apanham o que esta dentro
#     do seu tubo (como os bracos), para a manta nao esticar com elas;
#   * o sentido de cada osso MEDE-SE (roda-se e ve-se para onde vai o casco).
# O tamanho e o nome da animacao sao os do cavaleiro que o jogo ja usa: 3,95 m de
# comprimento e "gallop" -- o mapa procura /^gallop$/.
import json
import math
import os
import sys
from collections import defaultdict

import bpy
import bmesh
import mathutils

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ENTRADA = ARGS[0] if ARGS else "assets/cavaleiro.glb"
SAIDA = ARGS[1] if len(ARGS) > 1 else "sonda3d/cavaleiro_novo.glb"
TRIANGULOS = int(ARGS[2]) if len(ARGS) > 2 else 8000
RAIZ = os.getcwd()
MARCAS = os.path.join(RAIZ, "ferramentas", "cena", "marcas")
PROVAS = os.path.join(RAIZ, "ferramentas", "cena", "_saida")
COMPRIMENTO_M = 3.95          # o do cavaleiro atual do jogo, focinho a cauda
CICLO = 18                    # quadros por galope, como o "Gallop" antigo
FPS = 24

bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
cena.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=os.path.join(RAIZ, ENTRADA))
malhas = [o for o in cena.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in malhas:
    o.select_set(True)
bpy.context.view_layer.objects.active = malhas[0]
if len(malhas) > 1:
    bpy.ops.object.join()
corpo = bpy.context.view_layer.objects.active
corpo.name = "cavaleiro"

# a cor de vertice tem de entrar no material, ou o exportador nao a escreve
for mat in (corpo.data.materials or []):
    if mat and mat.use_nodes and corpo.data.color_attributes:
        nt = mat.node_tree
        b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b and not b.inputs["Base Color"].is_linked:
            no = nt.nodes.new("ShaderNodeVertexColor")
            no.layer_name = corpo.data.color_attributes[0].name
            nt.links.new(no.outputs["Color"], b.inputs["Base Color"])
            b.inputs["Metallic"].default_value = 0.0
            b.inputs["Roughness"].default_value = 0.85

# ── AS MARCAS DO LUCAS ──────────────────────────────────────────────────────
nome_fig = os.path.splitext(os.path.basename(ENTRADA))[0].lower()
m_homem = json.load(open(os.path.join(MARCAS, nome_fig + "_cavaleiro.json"), encoding="utf-8"))
m_ossos = json.load(open(os.path.join(MARCAS, nome_fig + "_ossos.json"), encoding="utf-8"))
if m_homem["vertices_total"] != len(corpo.data.vertices):
    raise SystemExit("SONDA ERRO: a marca do homem e de outra malha (%d contra %d) -- pinte de novo"
                     % (m_homem["vertices_total"], len(corpo.data.vertices)))
corpo.vertex_groups.new(name="HOMEM").add(m_homem["indices_cavaleiro"], 1.0, "REPLACE")
print("SONDA homem pintado: %d vertices" % len(m_homem["indices_cavaleiro"]))

# ── REDUZIR: O HOMEM SAI PARA UM OBJETO SEU ─────────────────────────────────
# Um grupo sozinho nao atravessa o `Decimate` (faz a media dos pesos). Separa-se,
# reduz-se cada um pela mesma razao, e junta-se: a juncao guarda os grupos.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for i in m_homem["indices_cavaleiro"]:
    corpo.data.vertices[i].select = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="SELECTED")
bpy.ops.object.mode_set(mode="OBJECT")
homem = [o for o in bpy.context.selected_objects if o is not corpo][0]
antes = 0
for ob in (corpo, homem):
    ob.data.calc_loop_triangles()
    antes += len(ob.data.loop_triangles)
for ob in (corpo, homem):
    md = ob.modifiers.new("reduzir", "DECIMATE")
    md.ratio = min(1.0, TRIANGULOS / antes)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=md.name)
bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
homem.select_set(True)
bpy.context.view_layer.objects.active = corpo
bpy.ops.object.join()
corpo.data.calc_loop_triangles()
print("SONDA malha: %d -> %d triangulos" % (antes, len(corpo.data.loop_triangles)))

# ── O ESPACO DO JOGO: meia-volta, centro, chao, tamanho ─────────────────────
# O modelo olha para -Y e o mapa quer +Y. RODA-SE A MALHA, NAO O OBJETO (o
# importador prende a malha a um no; a rotacao do objeto nao chegava a geometria).
ROT = mathutils.Matrix.Rotation(math.pi, 4, "Z")
corpo.data.transform(ROT)
ossos_crus = {n: (ROT @ mathutils.Vector(o["cabeca"]), ROT @ mathutils.Vector(o["cauda"]), o["pai"])
              for n, o in m_ossos["ossos"].items()}
cascos = [ossos_crus[n][1] for n in ossos_crus if n.startswith("casco.")]
cx = sum(p.x for p in cascos) / len(cascos)
cy = sum(p.y for p in cascos) / len(cascos)
zs = [v.co.z for v in corpo.data.vertices]
z0 = min(zs)
ys = [v.co.y for v in corpo.data.vertices]
k = COMPRIMENTO_M / (max(ys) - min(ys))
DESLOCA = mathutils.Vector((-cx, -cy, -z0))
corpo.data.transform(mathutils.Matrix.Translation(DESLOCA))
corpo.data.transform(mathutils.Matrix.Scale(k, 4))


def no_jogo(p):
    return (p + DESLOCA) * k


OSSOS = {n: (no_jogo(a), no_jogo(b), pai) for n, (a, b, pai) in ossos_crus.items()}
ALTURA = (max(zs) - z0) * k

# ── E O TAMANHO E O DOS NOSSOS SOLDADOS ─────────────────────────────────────
# O comprimento de 3,95 m era o do cavaleiro antigo, que o jogo exagerava. Ao
# lado do lanceiro e do arqueiro novos (2 m) o cavalo saiu enorme -- o Lucas viu.
# A regra passa a ser anatomica: o dorso de um cavalo fica a ~0,89 da altura de
# um homem, portanto com soldados de 2 m o dorso vai a 1,78 m.
ALTURA_SOLDADO_M = 2.0
# ⚠ E MAIS 25% MENOR, escolhido pelo Lucas de olho na sala de provas. Pela
# anatomia o dorso ia a 1,78 m, mas a armadura do homem do ComfyUI e volumosa:
# o capacete batia com o do lanceiro (0,24 m) e os ombros saiam ~35% mais largos,
# e a figura lia-se grande de mais ao lado dos soldados.
# (e depois +10%, porque a 0,75 ficou pequeno -- tambem de olho, na bancada)
ALTURA_DORSO_M = ALTURA_SOLDADO_M * 0.89 * 0.75 * 1.10
_z_dorso = OSSOS["dorso"][0].z
_k2 = ALTURA_DORSO_M / _z_dorso
corpo.data.transform(mathutils.Matrix.Scale(_k2, 4))
OSSOS = {n: (a * _k2, b * _k2, pai) for n, (a, b, pai) in OSSOS.items()}
ALTURA *= _k2
COMPRIMENTO_M *= _k2
print("SONDA reescala pelo dorso: %.2f m -> %.2f m (x%.2f)" % (_z_dorso, ALTURA_DORSO_M, _k2))
print("SONDA tamanho: %.2f m de comprido, %.2f m de alto (escala x%.2f)"
      % (COMPRIMENTO_M, ALTURA, k))

# ── O ESQUELETO, COM AS JUNTAS DO LUCAS ─────────────────────────────────────
arm_d = bpy.data.armatures.new("esqueleto")
arm = bpy.data.objects.new("esqueleto", arm_d)
cena.collection.objects.link(arm)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_d.edit_bones
for n, (a, b, pai) in OSSOS.items():
    e = eb.new(n)
    e.head, e.tail = a, b
for n, (a, b, pai) in OSSOS.items():
    if pai:
        e = eb[n]
        e.parent = eb[pai]
        # ligado quando a cabeca cai na cauda do pai (as cadeias das patas)
        e.use_connect = (e.head - eb[pai].tail).length < 1e-3
bpy.ops.object.mode_set(mode="OBJECT")
print("SONDA esqueleto: %d ossos" % len(arm_d.bones))

# ── OS PESOS ────────────────────────────────────────────────────────────────
grupo_homem = corpo.vertex_groups["HOMEM"].index
homem_idx = {v.index for v in corpo.data.vertices
             if any(g.group == grupo_homem and g.weight > 0.5 for g in v.groups)}
corpo.vertex_groups.remove(corpo.vertex_groups["HOMEM"])
for g in list(corpo.vertex_groups):
    corpo.vertex_groups.remove(g)
grupos = {n: corpo.vertex_groups.new(name=n) for n in OSSOS}


def dist_seg(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def t_seg(p, a, b):
    ab = b - a
    return (p - a).dot(ab) / max(ab.length_squared, 1e-9)


PATAS = sorted({n.split(".", 1)[1] for n in OSSOS if n.startswith("casco.")})
# ⚠ OS CASCOS SAO RIGIDOS, como as botas: pesados vertice a vertice partiam-se
# entre o casco e a canela e esticavam. O casco e o que esta a menos de 10% da
# altura do chao e perto da ponta do osso "casco" dessa pata.
Z_CASCO = ALTURA * 0.075
casco_de = {}
for v in corpo.data.vertices:
    if v.index in homem_idx or v.co.z > Z_CASCO:
        continue
    melhor = min(PATAS, key=lambda p: (v.co.xy - OSSOS["casco." + p][1].xy).length)
    if (v.co.xy - OSSOS["casco." + melhor][1].xy).length < ALTURA * 0.08:
        casco_de[v.index] = "casco." + melhor
# ⚠ O TUBO DA PATA. A manta azul pende ao lado das patas de cima e ia com elas
# (a licao do casaco do arqueiro). Um osso de pata so apanha o que esta dentro da
# sua grossura e entre as suas pontas.
RAIO_PATA = ALTURA * 0.05
pesos = []
for v in corpo.data.vertices:
    if v.index in homem_idx:
        pesos.append({"cavaleiro": 1.0})
        continue
    if v.index in casco_de:
        pesos.append({casco_de[v.index]: 1.0})
        continue
    cand = []
    for n, (a, b, _) in OSSOS.items():
        if n == "cavaleiro":
            continue
        if n.startswith(("pata_", "casco.")):
            tt = t_seg(v.co, a, b)
            if tt < -0.1 or tt > 1.05 or dist_seg(v.co, a, b) > RAIO_PATA:
                continue
        cand.append((dist_seg(v.co, a, b), n))
    cand.sort()
    if len(cand) == 1:
        pesos.append({cand[0][1]: 1.0})
        continue
    (d1, n1), (d2, n2) = cand[0], cand[1]
    w1 = d2 / max(d1 + d2, 1e-6)
    pesos.append({n1: w1, n2: 1.0 - w1})

vizinhos = [[] for _ in corpo.data.vertices]
for e in corpo.data.edges:
    a, b = e.vertices
    vizinhos[a].append(b)
    vizinhos[b].append(a)
for _ in range(4):
    novos = []
    for i, p_i in enumerate(pesos):
        if i in homem_idx or i in casco_de or not vizinhos[i]:
            novos.append(p_i)
            continue
        soma = dict(p_i)
        for j in vizinhos[i]:
            if j in homem_idx:
                continue          # o homem nao empresta peso ao cavalo
            for n, w in pesos[j].items():
                soma[n] = soma.get(n, 0.0) + w
        tot = sum(soma.values()) or 1.0
        novos.append({n: w / tot for n, w in soma.items() if w / tot > 0.02})
    pesos = novos
# a media espalha: o que esta fora do tubo perde as patas outra vez
for i, v in enumerate(corpo.data.vertices):
    if i in homem_idx or i in casco_de:
        continue
    limpo = {}
    for n, w in pesos[i].items():
        if n.startswith(("pata_", "casco.")):
            a, b, _ = OSSOS[n]
            if dist_seg(v.co, a, b) > RAIO_PATA * 1.3:
                continue
        if n == "cavaleiro":
            continue
        limpo[n] = w
    if limpo:
        pesos[i] = limpo
for i, p_i in enumerate(pesos):
    tot = sum(p_i.values()) or 1.0
    for n, w in p_i.items():
        grupos[n].add([i], w / tot, "REPLACE")
corpo.parent = arm
md = corpo.modifiers.new("esqueleto", "ARMATURE")
md.object = arm
pesados = sum(1 for v in corpo.data.vertices if v.groups)
print("SONDA pele: %d de %d vertices com peso | homem %d | cascos %d"
      % (pesados, len(corpo.data.vertices), len(homem_idx), len(casco_de)))
if pesados < len(corpo.data.vertices) * 0.99:
    raise SystemExit("pele incompleta")

# ── O SENTIDO DE CADA OSSO, MEDIDO ──────────────────────────────────────────
# Na passada do lanceiro, adivinhar o sinal do joelho deu hiperextensao. Aqui
# roda-se cada osso de pata 0,4 rad e ve-se para onde vai a ponta do casco.
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


def ponta_casco(p):
    bpy.context.view_layer.update()
    return arm.matrix_world @ arm.pose.bones["casco." + p].tail


SINAL = {}
for p in PATAS:
    for osso in ("pata_cima", "pata_meio"):
        pb = arm.pose.bones["%s.%s" % (osso, p)]
        base = ponta_casco(p)
        pb.rotation_quaternion = mathutils.Quaternion((1, 0, 0), 0.4)
        depois = ponta_casco(p)
        pb.rotation_quaternion = (1, 0, 0, 0)
        # cima: + tem de levar o casco para a FRENTE (+y)
        # meio: + tem de DOBRAR -- casco para tras na pata da frente, para a
        #       frente na de tras (o jarrete dobra ao contrario do joelho)
        dy = depois.y - base.y
        if osso == "pata_cima":
            SINAL[pb.name] = 1.0 if dy > 0 else -1.0
        else:
            quer = -1.0 if p.startswith("frente") else 1.0
            SINAL[pb.name] = 1.0 if dy * quer > 0 else -1.0
print("SONDA sinais: %s" % ", ".join("%s %+d" % (n, s) for n, s in sorted(SINAL.items())))

# qual eixo local da garupa sobe o corpo
pg = arm.pose.bones["garupa"]
bpy.context.view_layer.update()
h0 = (arm.matrix_world @ pg.head).z
EIXO_SOBE = None
for eixo in ((0, 0.1, 0), (0, 0, 0.1), (0.1, 0, 0), (0, -0.1, 0), (0, 0, -0.1), (-0.1, 0, 0)):
    pg.location = eixo
    bpy.context.view_layer.update()
    if (arm.matrix_world @ pg.head).z - h0 > 0.09:
        EIXO_SOBE = mathutils.Vector(eixo) * 10
        break
pg.location = (0, 0, 0)
print("SONDA a garupa sobe pelo eixo local %s" % (str(tuple(EIXO_SOBE)) if EIXO_SOBE is not None else "nenhum"))

# ── O GALOPE ────────────────────────────────────────────────────────────────
# Galope simplificado em quatro tempos: as de tras apoiam primeiro (quase
# juntas), depois as da frente. Cada pata balanca da frente para tras; a junta
# do meio dobra quando a pata vem a frente no ar. O corpo sobe e desce duas
# vezes por ciclo e o pescoco acompanha a contra-tempo.
FASE = {"tras.R": 0.00, "tras.L": 0.10, "frente.R": 0.45, "frente.L": 0.55}
BALANCO = {"frente": math.radians(30), "tras": math.radians(26)}
DOBRA = {"frente": math.radians(55), "tras": math.radians(40)}
SOBE = ALTURA * 0.02


def poe(pb, q, **campos):
    for c, val in campos.items():
        setattr(pb, c, val)
        pb.keyframe_insert(data_path=c, frame=q)


for i in range(CICLO + 1):
    q = 1 + i
    t = i / CICLO
    for p in PATAS:
        tipo = p.split(".")[0]
        ang = 2 * math.pi * (t - FASE.get(p, 0.0))
        cima = arm.pose.bones["pata_cima." + p]
        meio = arm.pose.bones["pata_meio." + p]
        poe(cima, q, rotation_quaternion=mathutils.Quaternion(
            (1, 0, 0), SINAL[cima.name] * math.sin(ang) * BALANCO[tipo]))
        dobra = max(0.0, math.cos(ang)) * DOBRA[tipo]
        poe(meio, q, rotation_quaternion=mathutils.Quaternion(
            (1, 0, 0), SINAL[meio.name] * dobra))
    if EIXO_SOBE is not None:
        poe(pg, q, location=EIXO_SOBE * (abs(math.sin(2 * math.pi * t)) * SOBE))
    poe(pg, q, rotation_quaternion=mathutils.Quaternion((1, 0, 0), math.sin(2 * math.pi * t) * math.radians(3)))
    poe(arm.pose.bones["pescoco"], q, rotation_quaternion=mathutils.Quaternion(
        (1, 0, 0), -math.sin(2 * math.pi * t) * math.radians(7)))
    poe(arm.pose.bones["cauda"], q, rotation_quaternion=mathutils.Quaternion(
        (1, 0, 0), math.sin(2 * math.pi * t + 1.0) * math.radians(10)))
acao = arm.animation_data.action
acao.name = "gallop"
cena.frame_start, cena.frame_end = 1, CICLO
bpy.ops.object.mode_set(mode="OBJECT")
print("SONDA galope: %d quadros, acao '%s'" % (CICLO, acao.name))

# ── PROVA: OS CASCOS VAO A FRENTE E ATRAS? ──────────────────────────────────
linhas = []
for p in PATAS:
    ys_ = []
    for q in range(1, CICLO + 1, 3):
        cena.frame_set(q)
        bpy.context.view_layer.update()
        ys_.append((arm.matrix_world @ arm.pose.bones["casco." + p].tail).y)
    linhas.append("%s %+.2f..%+.2f" % (p, min(ys_), max(ys_)))
print("SONDA cascos (y de cada ponta ao longo do ciclo): %s" % " | ".join(linhas))
cena.frame_set(1)

# ── EXPORTAR ────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
arm.select_set(True)
alvo = os.path.join(RAIZ, SAIDA)
bpy.ops.export_scene.gltf(filepath=alvo, export_format="GLB", export_yup=True,
                          export_animations=True, export_apply=False,
                          export_cameras=False, export_lights=False)
print("SONDA -> %s (%.1f MB)" % (SAIDA, os.path.getsize(alvo) / 1e6))

# ── PROVAS EM IMAGEM ────────────────────────────────────────────────────────
# 1. os pesos, cada osso numa cor (de lado); 2. o galope de perfil, 4 quadros
cena.render.engine = "BLENDER_WORKBENCH"
cena.display.shading.color_type = "VERTEX"
cena.display.shading.light = "STUDIO"
cena.render.resolution_x, cena.render.resolution_y = 640, 560
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cena.collection.objects.link(cam)
cena.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(COMPRIMENTO_M, ALTURA) * 1.15
cam.location = (12, 0, ALTURA / 2)
cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
base_ca = corpo.data.color_attributes[0]
paleta = [(0.95, 0.25, 0.2), (0.2, 0.55, 0.95), (0.95, 0.8, 0.2), (0.3, 0.85, 0.35),
          (0.8, 0.35, 0.9), (0.2, 0.85, 0.85), (0.95, 0.55, 0.15), (0.6, 0.6, 0.6),
          (0.4, 0.25, 0.75), (0.85, 0.45, 0.55), (0.35, 0.7, 0.45), (0.75, 0.75, 0.3),
          (0.25, 0.35, 0.6), (0.9, 0.65, 0.75), (0.55, 0.4, 0.2), (0.1, 0.1, 0.1),
          (1.0, 1.0, 1.0), (0.5, 0.9, 0.6)]
cor_osso = {n: paleta[i % len(paleta)] for i, n in enumerate(sorted(OSSOS))}
cp = corpo.data.color_attributes.new("PESOS", "FLOAT_COLOR", "POINT")
for i, p_i in enumerate(pesos):
    dom = max(p_i.items(), key=lambda kv: kv[1])[0]
    cp.data[i].color = (*cor_osso[dom], 1)
corpo.data.color_attributes.active_color = cp
corpo.data.color_attributes.render_color_index = list(corpo.data.color_attributes).index(cp)
cena.frame_set(1)
cena.render.filepath = os.path.join(PROVAS, "cav_pesos.png")
bpy.ops.render.render(write_still=True)
corpo.data.color_attributes.render_color_index = list(corpo.data.color_attributes).index(base_ca)
corpo.data.color_attributes.active_color = base_ca
for n_q, q in enumerate((1, 1 + CICLO // 4, 1 + CICLO // 2, 1 + 3 * CICLO // 4)):
    cena.frame_set(q)
    cena.render.filepath = os.path.join(PROVAS, "cav_galope_%d.png" % n_q)
    bpy.ops.render.render(write_still=True)
print("SONDA provas: _saida/cav_pesos.png e _saida/cav_galope_0..3.png")
