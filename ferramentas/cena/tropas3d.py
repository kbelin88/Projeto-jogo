# tropas3d.py — monta as unidades a partir do corpo animado CC0.
#
#   Corre dentro do Blender, importado pelos exportadores.
#
# ── O QUE ESTE FICHEIRO FAZ E O QUE NÃO FAZ ──────────────────────────────────
# NÃO modela um homem. O corpo, o esqueleto de 31 ossos e as 12 animações vêm
# do pacote CC0 do Quaternius (`assets/personagens/`), e é a melhor decisão que
# tomámos nesta parte: animar um andar à mão custaria semanas e ficaria pior.
#
# O que ele faz é MONTAR A UNIDADE — que é o trabalho que faltava e que eu
# tinha saltado. O pacote traz o corpo nu e o equipamento à parte de propósito:
# um só corpo serve para três unidades, e a diferença está no que se lhe põe.
# Um homem careca e sem arma não é um lanceiro, por melhor que ande.
#
# ── PORQUE O EQUIPAMENTO ENTRA COMO PESO E NÃO COMO FILHO ────────────────────
# Podia-se prender o elmo ao osso da cabeça (`parent_bone`). Faz-se assim em
# jogos onde as peças se trocam em tempo real. Aqui não se trocam: cada unidade
# é assada uma vez.
#
# Então cada peça é FUNDIDA no corpo, com todos os seus vértices a pesar 1 num
# só osso. Ganha-se três coisas: uma malha em vez de cinco (uma chamada de
# desenho por soldado), o glTF sai simples, e o encaixe deixa de depender de
# acertar deslocamentos relativos a um osso — que foi onde eu falhei à
# primeira e o elmo saiu a flutuar ao lado da cabeça.
import math
import os

import bpy
from mathutils import Vector

RAIZ = os.getcwd()
PACOTE = os.path.join(RAIZ, "assets", "personagens")

# ── AS MEDIDAS DO CORPO, TIRADAS DELE E NÃO INVENTADAS ───────────────────────
# T-pose, 5,60 m de alto. Braços abertos ao longo de X, cara virada para -Y.
#   cabeça (malha)   x ±0,60   z 4,11..5,60
#   ombros (ossos)   x ±0,33   z 3,49
#   mão direita      x -2,89   y 0,35   z 3,74
# Tudo o que se põe a seguir usa estes números; se um dia o pacote mudar de
# corpo, é aqui que se volta a medir.
CABECA_Z = 4.98
MAO_R = (-2.89, 0.35, 3.74)
MAO_L = (2.89, 0.35, 3.74)
ANTEBRACO_L = (2.05, 0.28, 3.70)     # entre o cotovelo e a mão, onde a correia
                                     # de um escudo de facto assenta
# A ALTURA DO CORPO, sem contar com o que se lhe põe. Quem escalar a unidade
# tem de usar ISTO e não a caixa envolvente: com a lança a subir 5 m acima da
# mão, escalar pela caixa encolhia o homem para 1,42 m em vez de 2,00.
ALT_CORPO = 5.60


def _importar(nome):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(PACOTE, "FBX", nome + ".fbx"))
    novos = [o for o in set(bpy.data.objects) - antes if o.type == "MESH"]
    for o in set(bpy.data.objects) - antes:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    return novos


def repouso_de(arm, osso, mundo):
    """converte um ponto do MUNDO POSADO para o espaço de repouso do osso.

    ── PORQUE ISTO É PRECISO ────────────────────────────────────────────────
    Uma peça presa a um osso é gravada em coordenadas de REPOUSO, e o esqueleto
    aplica-lhe depois a pose. O corpo vem em T-pose: os braços apontam para
    fora, ao longo de X. Pus a lança a subir em Z na mão direita — vertical, na
    T-pose — e quando o braço desceu, levou-a consigo: ficou deitada ao longo
    do corpo, e por isso não aparecia em lado nenhum do enquadramento.

    O que se quer é o contrário: dizer onde a peça há de ficar COM O HOMEM A
    ANDAR, e deixar a conta encontrar onde ela tem de estar em repouso para lá
    ir parar. É exatamente a matriz de repouso vezes a inversa da matriz de
    pose — o caminho de volta.
    """
    b = arm.pose.bones[osso]
    return arm.data.bones[osso].matrix_local @ b.matrix.inverted() @ mundo


def _no_osso(ob, osso, material):
    """prepara uma peça para ser fundida: um grupo só, peso 1, e a nossa cor"""
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    g = ob.vertex_groups.new(name=osso)
    g.add(range(len(ob.data.vertices)), 1.0, "REPLACE")
    ob.data.materials.clear()
    ob.data.materials.append(material)
    return ob


def _cone(nome, r, h):
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=0.0, depth=h,
                                    location=(0, 0, 0))
    o = bpy.context.object
    o.name = nome
    return o


def _girar_para_repouso(arm, osso):
    """a rotação que desfaz a pose do osso, para a peça sair a prumo no mundo"""
    b = arm.pose.bones[osso]
    m = arm.data.bones[osso].matrix_local.to_3x3() @ b.matrix.to_3x3().inverted()
    return m.to_euler()


def _caixa(nome, c, l, a, pos, cor):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.name = nome
    o.scale = (c, l, a)
    return o


def _cil(nome, r, h, pos, cor, lados=8, eixo="Z"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=h, location=pos)
    o = bpy.context.object
    o.name = nome
    if eixo == "Y":
        o.rotation_euler = (math.radians(90), 0, 0)
    return o


def abrir_corpo():
    """abre o cavaleiro CC0 e devolve (malha, armadura)"""
    bpy.ops.wm.open_mainfile(
        filepath=os.path.join(PACOTE, "Blends", "KnightCharacter.blend"))
    corpo = next(o for o in bpy.data.objects if o.type == "MESH")
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    return corpo, arm


def montar(tipo, mats, corpo, arm):
    """monta uma unidade sobre um corpo JÁ ABERTO.

    ── PORQUE O CORPO VEM DE FORA ───────────────────────────────────────────
    A primeira versão abria o ficheiro aqui dentro. Quem chamava já o tinha
    aberto uma vez para poder criar os materiais — e a segunda abertura deita
    fora tudo o que estava em memória. Os materiais passavam a apontar para
    memória libertada e o Blender morria com uma violação de acesso, sem
    mensagem de Python nenhuma. Abre-se UMA vez, lá fora; aqui só se monta.

    Devolve (malha, armadura). A malha leva TUDO fundido e continua presa ao
    esqueleto, portanto continua a andar.
    """
    # a pele e as botas do pacote passam a ser as nossas
    for i, m in enumerate(corpo.data.materials):
        corpo.data.materials[i] = mats.get(
            # a "Armor" deles vira COTA DE MALHA e nao aco: um lanceiro nao
            # anda de placas, anda de malha -- e e a malha, com o seu ladrilho
            # de 12 cm, que da a superficie granulada que se le como armadura.
            {"Armor": "malha", "Boots": "couro", "Skin": "carne"}.get(m.name, "pano"),
            mats["pano"])

    pecas = []

    # ── o ELMO ───────────────────────────────────────────────────────────
    # A cabeça mede 1,20 de largo e o elmo vem com 1,60: sem encolher, o homem
    # fica com um capacete de mergulhador.
    if tipo != "arqueiro":
        elmo = _importar("Helmet1" if tipo == "lanceiro" else "Helmet2")[0]
        elmo.scale = (0.80, 0.80, 0.80)
        elmo.location = (0.0, 0.06, CABECA_Z)
        pecas.append(_no_osso(elmo, "Head", mats["aco"]))

    # ── as OMBREIRAS ─────────────────────────────────────────────────────
    # é o que dá volume ao tronco: sem elas o soldado é um tubo com braços
    om = _importar("ShoulderPads")[0]
    om.scale = (0.86, 0.86, 0.86)
    om.location = (0.0, 0.10, 3.60)
    pecas.append(_no_osso(om, "Torso", mats["aco"]))

    if tipo == "lanceiro":
        # ── a LANÇA ──────────────────────────────────────────────────────
        # Vertical e ALTA. É o sinal que se lê primeiro e de mais longe: um
        # traço a subir acima da cabeça não se confunde com nada.
        #
        # Colocada NA POSE: pergunta-se onde está a mão com o homem a andar,
        # põe-se a haste a prumo aí, e a conta devolve onde ela tem de estar
        # em repouso.
        mao = arm.pose.bones["Palm.R"].matrix.translation
        for ob, osso, cor, alvo in (
                # GROSSA DE PROPOSITO. A 7,5 cm num homem de 5,6 m, a haste
                # dava dois pixeis no ecra e nao se via -- medida, estava la e
                # a prumo, e continuava invisivel. E o mesmo exagero das
                # estradas: o que e INFORMACAO desenha-se maior do que e.
                (_cil("haste", 0.17, 5.0, (0, 0, 0), "madeira2", 6), "Palm.R",
                 "madeira2", Vector((mao.x, mao.y, mao.z + 0.9))),
                (_cone("ponta", 0.34, 1.00), "Palm.R", "aco",
                 Vector((mao.x, mao.y, mao.z + 3.75)))):
            ob.location = repouso_de(arm, osso, alvo)
            ob.rotation_euler = _girar_para_repouso(arm, osso)
            pecas.append(_no_osso(ob, osso, mats[cor]))
        # ── o ESCUDO, no braço esquerdo ──────────────────────────────────
        ant = arm.pose.bones["LowerArm.L"].matrix.translation
        esc = _caixa("escudo", 0.16, 1.10, 1.40, (0, 0, 0), "madeira")
        esc.location = repouso_de(arm, "LowerArm.L",
                                  Vector((ant.x, ant.y - 0.34, ant.z)))
        esc.rotation_euler = _girar_para_repouso(arm, "LowerArm.L")
        pecas.append(_no_osso(esc, "LowerArm.L", mats["madeira"]))

    elif tipo == "arqueiro":
        # ── o ARCO ───────────────────────────────────────────────────────
        # Três troços a fazer a curva: à distância a que isto se vê, uma curva
        # de três segmentos e uma de trinta são a mesma curva.
        for dz, ang in ((1.15, 0.34), (0.0, 0.0), (-1.15, -0.34)):
            a = _cil("arco", 0.055, 1.25,
                     (MAO_L[0] + 0.12, MAO_L[1] - 0.30 - abs(dz) * 0.16,
                      MAO_L[2] + dz), "madeira2", 5)
            a.rotation_euler = (ang, 0, 0)
            pecas.append(_no_osso(a, "Palm.L", mats["madeira2"]))
        alj = _caixa("aljava", 0.16, 0.16, 0.75, (0.0, 0.42, 3.35), "couro")
        pecas.append(_no_osso(alj, "Torso", mats["couro"]))

    else:                                  # cavaleiro
        esp = _importar("Sword")[0]
        esp.scale = (0.85, 0.85, 0.85)
        esp.rotation_euler = (0, math.radians(-64), 0)
        esp.location = (MAO_R[0] - 0.2, MAO_R[1], MAO_R[2] + 0.1)
        pecas.append(_no_osso(esp, "Palm.R", mats["aco"]))
        esc = _caixa("escudo", 0.16, 1.05, 1.30,
                     (ANTEBRACO_L[0], ANTEBRACO_L[1] - 0.34, ANTEBRACO_L[2]),
                     "madeira")
        pecas.append(_no_osso(esc, "LowerArm.L", mats["madeira"]))

    # ── FUNDIR TUDO NO CORPO ─────────────────────────────────────────────
    # O `join` junta os grupos de vértices PELO NOME. Como cada peça já traz um
    # grupo com o nome do osso a que pertence, ela cai no sítio certo do
    # esqueleto sem mais nada — e passa a andar com ele.
    bpy.ops.object.select_all(action="DESELECT")
    for p in pecas:
        p.select_set(True)
    corpo.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.join()
    return corpo, arm
