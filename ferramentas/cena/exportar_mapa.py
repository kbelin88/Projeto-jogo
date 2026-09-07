# exportar_mapa.py — o mapa inteiro, como MALHA, para o navegador.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/exportar_mapa.py -- [px_textura]
#
# ── A DECISAO DE ARQUITETURA ─────────────────────────────────────────────────
# Nao sai UMA cena com o mapa todo dentro. Saem DUAS coisas:
#
#   pecas.glb    a biblioteca: cada prototipo UMA vez, na origem
#   mapa3d.json  onde fica cada copia: peca, posicao, rotacao, escala
#
# O navegador junta as duas com `InstancedMesh` — uma malha na memoria, milhares
# de matrizes. Exportar o mapa inteiro como geometria daria a mesma casa
# repetida trezentas vezes e milhoes de triangulos unicos; assim, 22 aldeias e
# 380 bosques custam o que custa a maior peca.
#
# E o mesmo principio que ja governa o forno: uma malha partilhada, muitas
# copias. So que agora quem instancia e o WebGL em vez do Cycles.
#
# ── A ESCALA, E UMA CORRECAO QUE ELA TRAZ ────────────────────────────────────
# O mapa 2D desenha TODAS as aldeias com a mesma largura em celulas (3,8), seja
# a peca de 85 m ou a de 117 m — ou seja, comprime a grande e estica a pequena.
# Em metros isso nao existe: ha uma escala so. Uma capital passa a ser
# VISIVELMENTE maior que uma aldeia pequena, que e como devia ter sido sempre.
import json
import math
import os
import re
import subprocess
import sys
import time

import bpy
import numpy as np

sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P                                          # noqa: E402
import cozer as C                                          # noqa: E402

ARGS = [int(a) for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
        if a.isdigit()]
TEX_PX = ARGS[0] if ARGS else 512
SAIDA = os.path.join(os.getcwd(), "sonda3d")

# viewBox do mapa -> metros. Vem da aldeia media: 98,9 m de peca desenhados em
# 3,8 celulas de 13,23 unidades. Um numero so, e o mapa inteiro obedece-lhe.
DIV = 1429.0 / 108.0
M_POR_VB = 98.9 / (3.8 * DIV)
IB_OX, IB_OY, IB_LARG, IB_ALT = 130.0, 144.0, 1429.0, 886.0


def em_metros(vx, vy):
    """viewBox do jogo -> metros da cena. O y do ecra desce; o da cena sobe."""
    return ((vx - IB_OX - IB_LARG / 2) * M_POR_VB,
            -(vy - IB_OY - IB_ALT / 2) * M_POR_VB)


t0 = time.time()
os.makedirs(SAIDA, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear(); P.LIXO = None

REDE = C.REDE
MATA = json.load(open(os.path.join(os.getcwd(), "assets/sprites/mata.json"), encoding="utf-8"))

copias = []
protos = {}          # nome curto -> receita (para reconstruir)
legiveis = {}        # nome curto -> assinatura legivel (so para se ler o JSON)


def juntar(reg, dx, dy, giro=0.0):
    """passa um registo de colocacoes de coordenadas da PECA para as do MAPA"""
    c, s = math.cos(giro), math.sin(giro)
    for r in reg:
        x, y, z = r["p"]
        copias.append({"peca": r["peca"], "p": [round(dx + x * c - y * s, 2),
                                                round(dy + x * s + y * c, 2),
                                                round(z, 2)],
                       "rz": round(r["rz"] + giro, 4), "e": r["e"]})


# ── as aldeias ──────────────────────────────────────────────────────────────
cidades = [c for c in REDE["c"] if c not in C.DE_FORA]
for cid in cidades:
    perfil = REDE["c"][cid]["t"]
    P.registar(True)
    C.construir(perfil, cidade=cid)      # limpa a cena e monta a povoacao
    reg = P.REGISTO
    P.registar(False)
    # NAO se guarda o objeto: a proxima cidade chama `read_factory_settings` e
    # ele morre. Guarda-se a RECEITA, que e texto, e no fim reconstroi-se a
    # biblioteca de uma vez numa cena limpa.
    for ob in list(P.LIXO.objects if P.LIXO else []):
        nome = re.sub(r"\.\d{3}$", "", ob.name)
        if nome not in protos and ob.get("receita"):
            protos[nome] = ob["receita"]
            legiveis[nome] = ob.get("assinatura", nome)
    vx, vy = REDE["c"][cid]["x"], REDE["c"][cid]["y"]
    mx, my = em_metros(vx, vy)
    juntar(reg, mx, my)
    print("SONDA %-11s %-8s %3d pecas" % (cid, perfil, len(reg)), flush=True)

print("SONDA %d aldeias, %d copias, %d prototipos distintos"
      % (len(cidades), len(copias), len(protos)))
print("SONDA escala: 1 unidade de viewBox = %.3f m  ->  o mapa mede %.0f x %.0f m"
      % (M_POR_VB, IB_LARG * M_POR_VB, IB_ALT * M_POR_VB))

# ── os bosques ──────────────────────────────────────────────────────────────
# HIERARQUICO, e nao achatado. Ha 380 manchas e cada uma tem umas 25 arvores:
# achatar dava 9 mil linhas de JSON. Assim saem os SEIS arranjos (as arvores de
# cada tipo de bosque, em coordenadas do bosque) e as 380 transformacoes. O
# navegador compoe as duas — a mesma conta que o mapa ja faz com os sprites.
import cozer_mata as CM                                        # noqa: E402

bosques = []
for i, (nome, quantas, raio, folhosas) in enumerate(CM.BOSQUES):
    P.registar(True)
    CM.construir(nome, quantas, raio, folhosas, 40 + i * 7)
    reg = P.REGISTO
    P.registar(False)
    for ob in list(P.LIXO.objects if P.LIXO else []):
        n = re.sub(r"\.\d{3}$", "", ob.name)
        if n not in protos and ob.get("receita"):
            protos[n] = ob["receita"]
            legiveis[n] = ob.get("assinatura", n)
    bosques.append([{"peca": r["peca"], "p": r["p"], "rz": r["rz"], "e": r["e"]}
                    for r in reg])
    print("SONDA bosque %s: %d arvores" % (nome, len(reg)), flush=True)

manchas = []
for m in MATA:
    mx, my = em_metros(m["x"], m["y"])
    manchas.append({"b": m["s"], "p": [round(mx, 1), round(my, 1)],
                    "e": round(m["e"] * M_POR_VB * DIV * 1.95 / ((14 + 5) * 2.3), 3)})
print("SONDA %d manchas de mata sobre %d arranjos" % (len(manchas), len(bosques)))
for b in bosques:
    for r in b:
        if r["peca"] not in {c["peca"] for c in copias}:
            pass
usadas_mata = {r["peca"] for b in bosques for r in b}

# ── a biblioteca ────────────────────────────────────────────────────────────
# Uma cena limpa, cada peca UMA vez, na origem. E daqui que sai o `pecas.glb`
# que o navegador carrega uma vez e instancia mil vezes.
bpy.ops.wm.read_factory_settings(use_empty=True)
P._mats.clear(); P.LIXO = None
cena = bpy.context.scene.collection
usadas = sorted({c["peca"] for c in copias} | usadas_mata)
feitas, faltam = [], []
for nome in usadas:
    receita = protos.get(nome)
    if not receita:
        faltam.append(nome)
        continue
    fn, args, kw = json.loads(receita)
    ob = getattr(P, fn)(*args, **kw)
    for col in list(ob.users_collection):
        col.objects.unlink(ob)
    ob.name = nome                      # o nome E a chave do mapa3d.json
    # A MALHA TAMBEM. O glTF guarda o nome do OBJETO num no e o da MALHA noutro,
    # e a malha herda o nome da primitiva que lhe deu origem ("Cube.005"). Do
    # lado do navegador, quem tem `.isMesh` e a malha — e 19 das 22 pecas nao
    # eram encontradas por causa disso. Batizar as duas resolve dos dois lados.
    ob.data.name = nome
    cena.objects.link(ob)
    feitas.append(nome)
if faltam:
    print("SONDA AVISO: sem receita para %s" % faltam)

# ── O CHAO, COM A FORMA DA ILHA ─────────────────────────────────────────────
# Uma grelha sobre o retangulo do mapa, da qual se apagam as faces que caem na
# agua. E a primeira vez que a terra tem BORDA em vez de um desfoque de alfa:
# a fronteira entre a agua e a terra passa a ser geometria, e nao um esbatido
# de 16 pixeis por cima de um PNG.
#
# A mascara vem do alfa da propria ilha (`_terra.npy`), portanto a costa e
# EXATAMENTE a que o jogo ja usa — nao ha duas ilhas com formas diferentes.
terra = np.load(os.path.join(os.getcwd(), "ferramentas/cena/_terra.npy"))
th, tw = terra.shape
LX, LY = IB_LARG * M_POR_VB, IB_ALT * M_POR_VB
px, py = LX / tw, LY / th
verts, faces = [], []
indice = {}
for j in range(th):
    for i in range(tw):
        if not terra[j, i]:
            continue
        canto = []
        for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1)):
            ch = (i + di, j + dj)
            if ch not in indice:
                indice[ch] = len(verts)
                verts.append(((i + di) * px - LX / 2, LY / 2 - (j + dj) * py, 0.0))
            canto.append(indice[ch])
        faces.append(tuple(canto))
chao = P._novo(P._malha("chao", verts, faces, "relva", bisel=0), "relva")
for col in list(chao.users_collection):
    col.objects.unlink(col.objects.get(chao.name) or chao)
cena.objects.link(chao)
chao.name = "chao"
print("SONDA chao: %d faces de %.0f x %.0f m, ilha de %.0f x %.0f m"
      % (len(faces), px, py, LX, LY))

# as texturas descem antes de viajar (ver a medicao em SONDAGEM_3D)
for im in bpy.data.images:
    if im.size[0] > TEX_PX:
        im.scale(TEX_PX, TEX_PX)
# e a cor achata-se na paleta, porque o glTF nao leva os nossos grafos de nos
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    cor = P.COR.get(m.name[2:]) if bsdf else None
    if cor is None:
        continue
    for lig in list(bsdf.inputs["Base Color"].links):
        m.node_tree.links.remove(lig)
    bsdf.inputs["Base Color"].default_value = cor

tris = 0
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        ob.data.calc_loop_triangles()
        tris += len(ob.data.loop_triangles)
alvo = os.path.join(SAIDA, "pecas.glb")
bpy.ops.export_scene.gltf(filepath=alvo, export_format="GLB", export_apply=True,
                          export_yup=True, export_cameras=False, export_lights=False)
print("SONDA biblioteca: %d pecas, %d triangulos, %.1f MB"
      % (len(feitas), tris, os.path.getsize(alvo) / 1e6))

with open(os.path.join(SAIDA, "mapa3d.json"), "w", encoding="utf-8") as f:
    json.dump({"m_por_vb": round(M_POR_VB, 4),
               "mapa_m": [round(IB_LARG * M_POR_VB), round(IB_ALT * M_POR_VB)],
               "pecas": {n: legiveis.get(n, n) for n in feitas}, "copias": copias,
               "arranjos": bosques, "manchas": manchas}, f, separators=(",", ":"))
print("SONDA -> sonda3d/mapa3d.json  (%.0f KB)  em %.1f s"
      % (os.path.getsize(os.path.join(SAIDA, "mapa3d.json")) / 1024, time.time() - t0))
