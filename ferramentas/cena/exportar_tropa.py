# exportar_tropa.py — as três tropas, todas do mesmo corpo.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b \
#       --factory-startup -noaudio -P ferramentas/cena/exportar_tropa.py -- lanceiro
#                                                                       -- arqueiro
#                                                                       -- cavaleiro
#
# UMA POR PROCESSO, e isto não é preguiça: `abrir_soldado` abre o .blend do
# soldado, e abrir um ficheiro duas vezes na mesma sessão liberta materiais
# criados entre as duas aberturas. O Blender morre com
# EXCEPTION_ACCESS_VIOLATION e sem uma linha de mensagem. Já aconteceu.
#
# ── O QUE SAI DAQUI ──────────────────────────────────────────────────────────
# `sonda3d/<tropa>.glb`: uma malha com esqueleto e as animações lá dentro. Não é
# como as outras peças do mapa — as aldeias e a mata saem como geometria rígida
# e são instanciadas aos milhares. Estas saem COM OSSOS, e o `three` não
# instancia malhas com ossos.
#
# Isso não é problema, e é por causa de uma decisão anterior: o corte por
# píxeis limita as figuras visíveis a algumas dezenas. Aquilo que fizemos para
# elas se LEREM é o que torna a animação a sério acessível.
#
# ── E TODAS AS TRÊS SÃO O MESMO HOMEM ────────────────────────────────────────
# Um corpo, um esqueleto, um passo. O que muda é o que ele leva na mão, o que
# veste, e — no cavaleiro — o facto de ir sentado em cima de outro bicho. Um
# desenhista faria três personagens; eu não sei desenhar, mas sei vestir o
# mesmo três vezes, e a essa distância é o que se lê.
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
PERNA_X = T.PERNA_X
CAVALO = os.path.join(RAIZ, "assets", "Personagens", "Blends", "Horse.blend")

QUAL = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "lanceiro"


# ── AS FERRAMENTAS ───────────────────────────────────────────────────────────
def _linear(c):
    """de sRGB (o que se vê num seletor de cor) para linear (o que o nó lê)"""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
                 for v in c)


def _tingir(mat, cor, nome):
    """a cor entra como FATOR do glTF, uma multiplicação por cima da textura.

    É a única maneira de tingir que sobrevive à exportação: um nó de mistura
    qualquer sai de lá sem textura nenhuma. O linho cru é quase branco e a pele
    dele também é clara — sem tingir, a calça desaparece contra a perna e o
    homem volta a parecer de saia.
    """
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
    nt.links.new(fonte, mis.inputs[6])                  # A
    mis.inputs[7].default_value = (*_linear(cor), 1.0)  # B
    nt.links.new(mis.outputs[2], bsdf.inputs["Base Color"])
    return m


def _cor(nome, rgb, rugosidade=0.78):
    """um material de cor lisa, sem textura.

    Existe por causa do cavalo: as texturas deste projeto sao mapeadas por
    COORDENADA DE OBJETO, e o exportador de glTF converte isso usando o UV da
    malha. O cavalo nao tem UV nenhum -- e ficaria com a textura a escorrer.
    """
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*_linear(rgb), 1.0)
    b.inputs["Roughness"].default_value = rugosidade
    b.inputs["Metallic"].default_value = 0.0
    return m


def _caixa(bm, larg, comp, alt, centro):
    r = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, verts=r, vec=(larg, comp, alt))
    bmesh.ops.translate(bm, verts=r, vec=centro)


def _cilindro(bm, raio, comp, centro, lados=6):
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=lados,
                              radius1=raio, radius2=raio, depth=comp)["verts"]
    bmesh.ops.translate(bm, verts=r, vec=centro)


def _objeto(nome, bm, materiais):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in materiais:
        me.materials.append(m)
    return ob


def prender(ob, corpo, arm, osso):
    """converte a peça para o espaço de REPOUSO do osso e funde-a no corpo.

    ── PORQUE A CONVERSÃO ───────────────────────────────────────────────────
    Uma peça presa a um osso é gravada em coordenadas de repouso, e o esqueleto
    põe-lhe a pose por cima. Entregá-la desenhada na POSE é aplicar-lhe a pose
    duas vezes: a lança sai da mão e fica a flutuar ao lado do homem, que foi
    exatamente o que se viu na primeira marcha.

    O que se quer é o contrário: dizer onde a peça há de ficar COM O HOMEM DE
    PÉ, e deixar a conta encontrar onde isso fica em repouso.
    """
    pb = arm.pose.bones[osso]
    M = (arm.matrix_world
         @ arm.data.bones[osso].matrix_local
         @ pb.matrix.inverted()
         @ arm.matrix_world.inverted())
    ob.data.transform(M)
    g = ob.vertex_groups.new(name=osso)
    g.add(range(len(ob.data.vertices)), 1.0, "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    corpo.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.join()


def juntar_ranhuras(corpo):
    """duas ranhuras com o mesmo material são duas primitivas de glTF, e cada
    primitiva é uma chamada de desenho POR SOLDADO. Com quarenta e oito homens
    no ecrã, uma ranhura repetida custa quarenta e oito chamadas para nada.

    Só se REAPONTAM as faces; a ranhura repetida fica lá, vazia, e o exportador
    não escreve primitiva para um material que ninguém usa. Tirar a ranhura
    seria mais limpo e é uma armadilha: o Blender já reindexa as faces ao
    remover uma, e reindexar por cima disso mandou a ponta de aço da lança para
    o material da madeira — sem um aviso.
    """
    visto, troca = {}, {}
    for i, m in enumerate(corpo.data.materials):
        if m.name in visto:
            troca[i] = visto[m.name]
        else:
            visto[m.name] = i
    for f in corpo.data.polygons:
        f.material_index = troca.get(f.material_index, f.material_index)
    return len(troca)


def exportar(nome, malha):
    for im in bpy.data.images:
        if im.size[0] > 512:
            im.scale(512, 512)
        # empacotada, a imagem passa a estar DENTRO do ficheiro: a pele dele não
        # saía no glTF porque a imagem vive fora do .blend e o exportador não
        # lhe chegou
        if im.size[0] and not im.packed_file:
            try:
                im.pack()
            except RuntimeError:
                pass
    malha.data.calc_loop_triangles()
    alvo = os.path.join(SAIDA, nome + ".glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=alvo, export_format="GLB", export_apply=False,
        export_yup=True, export_cameras=False, export_lights=False,
        export_animations=True, export_skins=True,
        export_animation_mode="ACTIONS", export_nla_strips=False)
    print("SONDA -> %s  (%d triângulos, %.2f MB)"
          % (alvo, len(malha.data.loop_triangles), os.path.getsize(alvo) / 1e6))


# ── O HOMEM, ANTES DE SABER O QUE VAI SER ────────────────────────────────────
corpo, arm = T.abrir_soldado()
import pecas as P                                          # noqa: E402
P._mats.clear()
P.LIXO = None

n_pano, n_perna = T.de_saia_para_calca(corpo)
print("SONDA calças: %d vértices de barra, %d de perna" % (n_pano, n_perna))


def calcar(corpo, cor=(0.30, 0.23, 0.17)):
    """duas caixas por pé, presas ao osso da canela.

    O sapato do modelo é uma SOLA: uma casca de 3 cm no fundo do pé e mais
    nada. Com o homem a andar, essa casca fica ao nível do chão e a estrada
    come-a metade do tempo — o que se vê é um soldado descalço que enterra o pé
    no terreno a cada passo. Não há geometria de bota para pintar; há que a
    fazer. Não há osso de pé neste esqueleto, e não faz falta: o tornozelo não
    articula.
    """
    mat = _tingir(P.material("couro"), cor, "M_bota")
    botas = []
    for osso, sinal in (("lowerleg.R", 1.0), ("lowerleg.L", -1.0)):
        bm = bmesh.new()
        x = sinal * PERNA_X
        _caixa(bm, 0.088, 0.130, 0.056, (x, 0.012, 0.026))     # o pé
        _caixa(bm, 0.076, 0.080, 0.072, (x, -0.006, 0.088))    # o cano
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                        offset=0.009, segments=1, affect="EDGES")
        ob = _objeto("bota", bm, [mat])
        g = ob.vertex_groups.new(name=osso)
        g.add(range(len(ob.data.vertices)), 1.0, "REPLACE")
        botas.append(ob)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in botas:
        ob.select_set(True)
    corpo.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.join()


def vestir(corpo, nosso, cor):
    """a pele fica com o atlas PINTADO dele; o resto passa às nossas texturas.

    Nenhuma textura repetível iguala um atlas feito à medida numa cara. Mas o
    atlas dele é quase branco no pano, e era isso que fazia o soldado parecer
    de gesso.
    """
    for i, m in enumerate(corpo.data.materials):
        novo = nosso.get(m.name)
        if not novo:
            continue
        base = P.material(novo)
        c = cor.get(m.name)
        corpo.data.materials[i] = _tingir(base, c, "M_" + m.name) if c else base
    print("SONDA materiais: %s" % ", ".join(m.name for m in corpo.data.materials))


def lanca(corpo, arm, comp=1.40, abaixo=0.34, raio=0.014, inclinar=0.0):
    """a nossa, não a dele.

    A do ficheiro vem solta (sem pai e sem pesos) e, pior, desenhada para uma
    pose que não é a que o ficheiro traz: ao prendê-la ao osso da mão aparecia
    a flutuar meio metro à frente do peito. E é curta — pouco mais de um metro
    na escala do homem, mais dardo do que lança.
    """
    velha = bpy.data.objects.get("spear")
    if velha:
        bpy.data.objects.remove(velha, do_unlink=True)
    pb = arm.pose.bones["hand.R"]
    punho = arm.matrix_world @ ((pb.head + pb.tail) / 2.0)
    bm = bmesh.new()
    _cilindro(bm, raio, comp, (0, 0, comp / 2 - abaixo), lados=8)
    ponta = bmesh.ops.create_cone(bm, cap_ends=True, segments=8,
                                  radius1=raio * 3.0, radius2=0.0, depth=0.17)
    bmesh.ops.translate(bm, verts=ponta["verts"],
                        vec=(0.0, 0.0, comp - abaixo + 0.085))
    ob = _objeto("lanca", bm, [P.material("madeira2"), P.material("aco")])
    for f in ob.data.polygons:                 # a ponta é de aço, a haste não
        if f.center.z > comp - abaixo - 0.001:
            f.material_index = 1
    # ── A LANÇA DO CAVALEIRO VAI INCLINADA, E ISSO É UMA RENDIÇÃO ────────────
    # Eu disse ao Lucas que baixar a lança na carga seria uma pose, como sentar
    # o homem. Estava errado, e a culpa é de uma decisão minha anterior: o
    # cavaleiro é carga RÍGIDA presa a um osso do cavalo, sem esqueleto próprio.
    # Não há braço para rodar em tempo de execução.
    #
    # A saída honesta é inclinar a lança AQUI, de vez. Um cavaleiro leva a lança
    # meio deitada tanto a marchar como a carregar, e no mapa ele está sempre a
    # galope — portanto a inclinação está certa nos dois casos, e não custa um
    # ficheiro nem um quadro.
    if inclinar:
        ob.data.transform(mathutils.Matrix.Rotation(-inclinar, 4, "X"))
    ob.data.transform(mathutils.Matrix.Translation(punho))
    prender(ob, corpo, arm, "hand.R")
    print("SONDA lança de %.2f m" % (comp * 2.0 / T.ALT_OGA))


def arco(corpo, arm):
    """o arco, na mão esquerda, com o plano ao longo da marcha.

    Curvo, e não uma vara: é a curva que o faz ler como arco a quarenta
    píxeis. Sai de uma curva com espessura, convertida em malha — desenhar o
    tubo à mão seriam cinquenta linhas para o mesmo resultado.

    O plano do arco fica no plano de andar, que é o que se vê de lado — e é de
    lado que se vê uma coluna a marchar.
    """
    pb = arm.pose.bones["hand.L"]
    punho = arm.matrix_world @ ((pb.head + pb.tail) / 2.0)

    ALT, BOJO = 1.05, 0.16
    cur = bpy.data.curves.new("arco", "CURVE")
    cur.dimensions = "3D"
    sp = cur.splines.new("POLY")
    N = 11
    sp.points.add(N - 1)
    for i in range(N):
        u = i / (N - 1.0)
        sp.points[i].co = (0.0, BOJO * math.cos((u - 0.5) * math.pi),
                           (u - 0.5) * ALT, 1.0)
    cur.bevel_depth = 0.013
    cur.bevel_resolution = 0
    ob = bpy.data.objects.new("arco", cur)
    bpy.context.scene.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob.data.materials.append(P.material("madeira2"))

    bm = bmesh.new()                                   # a corda, de ponta a ponta
    _cilindro(bm, 0.004, ALT, (0, 0, 0), lados=4)
    corda = _objeto("corda", bm,
                    [_tingir(P.material("couro"), (0.22, 0.19, 0.15), "M_corda")])
    bpy.ops.object.select_all(action="DESELECT")
    corda.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()

    ob.data.transform(mathutils.Matrix.Translation(punho))
    prender(ob, corpo, arm, "hand.L")
    print("SONDA arco de %.2f m" % (ALT * 1.95 / T.ALT_OGA))


def aljava(corpo, arm):
    """a aljava às costas, e três hastes de fora.

    Não se vê uma flecha a esta distância; vê-se que ELE TEM flechas, que é o
    que distingue um arqueiro de um homem com um pau curvo.
    """
    pb = arm.pose.bones["upper_chest"]
    meio = arm.matrix_world @ ((pb.head + pb.tail) / 2.0)
    bm = bmesh.new()
    _cilindro(bm, 0.048, 0.34, (0.0, 0.0, 0.0), lados=6)
    for dx in (-0.028, 0.0, 0.028):
        _cilindro(bm, 0.006, 0.26, (dx, 0.0, 0.22), lados=3)
    ob = _objeto("aljava", bm,
                 [_tingir(P.material("couro"), (0.34, 0.25, 0.18), "M_aljava")])
    # deitada nas costas: caída para trás e para o ombro esquerdo
    M = (mathutils.Matrix.Translation(meio + mathutils.Vector((-0.05, -0.12, 0.02)))
         @ mathutils.Matrix.Rotation(math.radians(24), 4, "X")
         @ mathutils.Matrix.Rotation(math.radians(-14), 4, "Y"))
    ob.data.transform(M)
    prender(ob, corpo, arm, "upper_chest")


def escalar(arm, metros):
    """a escala aplica-se à ARMADURA e não à malha: a malha é deformada pelos
    ossos, e escalá-la deixava-a a discordar deles a cada quadro."""
    k = metros / T.ALT_OGA
    arm.scale = (k, k, k)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def sentar(arm):
    """dobra-lhe as pernas para montar.

    O corpo traz cinco animações e nenhuma delas é montar. Mas um cavaleiro
    está quase sempre PARADO em cima do cavalo: é uma pose, não uma animação.

    A pose que o ficheiro traz (braços em baixo) TEM de ser preservada: o
    repouso deste esqueleto é um T, e limpar a animação punha-o de braços
    abertos como um espantalho. Por isso se lê a pose primeiro e se volta a
    pousá-la, dos pais para os filhos — a pose de um osso depende da do pai, e
    pousá-las por outra ordem dá um resultado diferente a cada vez.
    """
    def fundo(b):
        n = 0
        while b.parent:
            b, n = b.parent, n + 1
        return n

    ordem = sorted(arm.pose.bones, key=lambda pb: fundo(pb.bone))
    guardado = {pb.name: pb.matrix.copy() for pb in ordem}
    arm.animation_data_clear()
    for pb in ordem:
        pb.matrix = guardado[pb.name]
        bpy.context.view_layer.update()

    def apontar(pb, direcao):
        """aponta o osso numa direção do mundo, mantendo-lhe o comprimento.

        Não se rodam ângulos: o eixo local de um osso vem com o `roll` dele, e
        uma rotação de 1,2 rad em X mandava o joelho para fora e para trás ao
        mesmo tempo. Diz-se para onde há de apontar, e a matriz sai da conta.
        """
        y = mathutils.Vector(direcao).normalized()
        ref = (mathutils.Vector((0, 0, 1)) if abs(y.z) < 0.95
               else mathutils.Vector((0, 1, 0)))
        x = y.cross(ref).normalized()
        z = x.cross(y).normalized()
        M = mathutils.Matrix((x, y, z)).transposed().to_4x4()
        M.translation = pb.head
        pb.matrix = M
        bpy.context.view_layer.update()

    for lado, s in (("R", 1.0), ("L", -1.0)):
        apontar(arm.pose.bones["thigh." + lado], (s * 0.52, 0.80, -0.30))
        apontar(arm.pose.bones["lowerleg." + lado], (s * 0.10, -0.16, -0.98))
    print("SONDA sentado: joelho %s pé %s"
          % ([round(v, 3) for v in arm.pose.bones["thigh.R"].tail],
             [round(v, 3) for v in arm.pose.bones["lowerleg.R"].tail]))


def endireitar(o):
    """assenta rotação e escala do objeto na própria geometria"""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# ── E AGORA, QUEM ELE É ──────────────────────────────────────────────────────
COR_CALCA = (0.46, 0.41, 0.33)
VESTE = {"armor_clothe": "pano", "calcas": "pano", "belt": "couro",
         "helmet": "malha", "shoes": "couro"}

if QUAL == "lanceiro":
    calcar(corpo)
    lanca(corpo, arm)
    vestir(corpo, VESTE,
           {"armor_clothe": (0.62, 0.47, 0.28), "calcas": COR_CALCA})
    juntar_ranhuras(corpo)
    escalar(arm, 2.00)

elif QUAL == "arqueiro":
    # ── PORQUE ELE É VERDE E NÃO TEM ELMO ────────────────────────────────────
    # À distância a que isto se vê não se distingue uma arma da outra: o que
    # separa as três tropas no ecrã é a SILHUETA e a COR. O arqueiro leva pano
    # verde e um gorro de couro no lugar da cota de malha — de longe lê-se "não
    # é o mesmo homem", que é tudo o que tem de dizer.
    calcar(corpo, (0.33, 0.26, 0.19))
    arco(corpo, arm)
    aljava(corpo, arm)
    vestir(corpo, dict(VESTE, helmet="couro"),
           {"armor_clothe": (0.36, 0.44, 0.26), "calcas": COR_CALCA,
            "helmet": (0.42, 0.32, 0.22)})
    juntar_ranhuras(corpo)
    escalar(arm, 1.95)

elif QUAL == "cavaleiro":
    calcar(corpo)
    lanca(corpo, arm, comp=1.55, abaixo=0.30, inclinar=math.radians(52))
    vestir(corpo, VESTE,
           {"armor_clothe": (0.52, 0.24, 0.20), "calcas": COR_CALCA})
    juntar_ranhuras(corpo)
    sentar(arm)

    # ── E O HOMEM CONGELA ────────────────────────────────────────────────────
    # Aplicado o modificador, a malha fica na pose sentada e deixa de precisar
    # do esqueleto dele. Passa a ser CARGA RÍGIDA presa a um osso do cavalo —
    # a mesma técnica da lança, um andar acima. Dois esqueletos no mesmo
    # ficheiro seriam duas árvores de animação para o `three` gerir, e este
    # homem, sentado, não tem nada para animar.
    bpy.ops.object.select_all(action="DESELECT")
    corpo.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    for m in list(corpo.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    corpo.parent = None
    k = 2.00 / T.ALT_OGA
    corpo.data.transform(mathutils.Matrix.Scale(k, 4))

    bpy.data.objects.remove(arm, do_unlink=True)
    for a in list(bpy.data.actions):
        # as ações dele não servem ao cavalo, e o exportador tenta aplicar
        # TODAS as ações a TODAS as armaduras: sobrando, saíam cinco animações
        # de disparate por cima do galope
        bpy.data.actions.remove(a)

    # ── O CAVALO ─────────────────────────────────────────────────────────────
    with bpy.data.libraries.load(CAVALO) as (de, para):
        para.objects = list(de.objects)
        para.actions = list(de.actions)
    for o in para.objects:
        bpy.context.scene.collection.objects.link(o)
    cav = next(o for o in para.objects if o.type == "ARMATURE")
    pele = next(o for o in para.objects if o.type == "MESH")
    print("SONDA cavalo: %d ossos, %d ações" % (len(cav.data.bones),
                                                len(bpy.data.actions)))

    # o cavalo olha para -Y e o homem para +Y. Uniformiza-se AQUI e não no
    # mapa: uma peça que sai virada ao contrário das outras é uma armadilha
    # para quem vier a seguir. Desfaz-se primeiro a filiação, senão assentar a
    # rotação da armadura movia os ossos e deixava a pele para trás.
    pele.parent = None
    for o in (cav, pele):
        o.rotation_euler = (0.0, 0.0, math.pi)
        endireitar(o)

    # a altura do dorso MEDIDA, não adivinhada: é onde o homem se senta
    # o dorso mudou de lado com a meia-volta: o que era +0,75 (a garupa,
    # atras, com o cavalo virado a -Y) esta agora em -0,75
    SELA = -0.55
    dorso = max(v.co.z for v in pele.data.vertices
                if abs(v.co.y - SELA) < 0.35 and abs(v.co.x) < 0.25)
    K = 1.60 / dorso
    for o in (cav, pele):
        o.scale = (K, K, K)
        endireitar(o)
    print("SONDA dorso a %.2f unidades -> escala %.3f (dorso a 1,60 m)"
          % (dorso, K))

    # ── A PELAGEM ────────────────────────────────────────────────────────────
    # Os materiais dele nao sobrevivem a exportacao: saem sem cor, sem metal e
    # sem rugosidade -- e no glTF um material sem `metallicFactor` vale metal a
    # UM. Metal branco sem ceu a refletir e PRETO, e foi um cavalo preto que
    # apareceu no mapa. Pinta-se de novo, em cor lisa e com o metal declarado.
    PELO = {"Main": (0.40, 0.25, 0.14), "Main_Dark": (0.24, 0.14, 0.08),
            "Main_Light": (0.55, 0.38, 0.22), "Hooves": (0.16, 0.15, 0.14),
            "Hair": (0.14, 0.10, 0.07), "Muzzle": (0.21, 0.15, 0.11),
            "Eye_White": (0.86, 0.85, 0.82), "Eye_Black": (0.05, 0.04, 0.04)}
    for i, m in enumerate(pele.data.materials):
        c = PELO.get(m.name)
        if c:
            pele.data.materials[i] = _cor("C_" + m.name, c)

    # treze acoes, e o mapa so galopa. As outras sao meio megabyte de curvas
    # para animacoes que ninguem pede -- e o `Walk` fica, para quando a coluna
    # andar a passo.
    GUARDAR = {"Gallop", "Walk", "Idle"}
    for a in list(bpy.data.actions):
        if a.name not in GUARDAR:
            bpy.data.actions.remove(a)

    corpo.data.transform(mathutils.Matrix.Translation(
        mathutils.Vector((0.0, SELA * K, 1.60 - 0.473 * k))))
    # ── E O CAVALO TEM DE ESTAR EM REPOUSO PARA O RECEBER ────────────────────
    # A sela foi medida na malha, e a malha esta gravada em REPOUSO. Mas o
    # ficheiro dele vem com uma acao aplicada, e `prender` converte da POSE
    # para o repouso: dar-lhe coordenadas de repouso a pedir uma conversao era
    # aplicar o desvio da pose ao contrario, e o homem sentava-se ao lado do
    # cavalo. Com a armadura em repouso a conversao e a identidade, e as duas
    # medidas passam a estar no mesmo sitio.
    cav.data.pose_position = "REST"
    bpy.context.view_layer.update()
    prender(corpo, pele, cav, "Back")
    cav.data.pose_position = "POSE"
    pele.name = "cavaleiro"
    corpo, arm = pele, cav

else:
    raise SystemExit("tropa desconhecida: " + QUAL)

exportar(QUAL, corpo)
