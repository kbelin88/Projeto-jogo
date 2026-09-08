# guerreiros.py — os soldados, feitos de carne e não de caixas.
#
# Importado pelo `pecas.py`; não corre sozinho.
#
# ── PORQUE ESTES NÃO SÃO FEITOS COMO O RESTO ─────────────────────────────────
# Todo o resto deste projeto nasce de caixas e cilindros, e faz muito bem: uma
# casa É uma caixa, uma muralha É uma fileira de prumos. Vinte e quatro aldeias
# únicas saem daí de graça.
#
# Um homem não. Um homem feito de caixas é um boneco de encaixe, e nota-se ao
# primeiro olhar — foi exatamente o que o Lucas viu quando aproximou a câmara.
#
# Aqui desenha-se um ESQUELETO DE VARETAS — bacia, peito, ombros, braços,
# pernas — dá-se um raio a cada nó, e o modificador de pele constrói carne à
# volta. Com subdivisão por cima, sai uma forma orgânica a partir de código, que
# é a única maneira de eu poder esculpir sem ter mãos.
#
# ── E O MESMO DESENHO SERVE DUAS VEZES ───────────────────────────────────────
# O Blender constrói uma ARMADURA a partir deste mesmo esqueleto, já presa à
# malha (`skin_armature_create`). Verificado: 7 ossos, ligados. Portanto o que
# se desenha aqui não é só a forma — é também o esqueleto que há de andar.
# Não existe um passo separado de "agora amarra o modelo aos ossos", que é
# justamente o passo que se faz à mão e que eu não conseguiria fazer.
import math

import bpy


def corpo(nome, ossos, cor, subdiv=2, suave=True):
    """carne à volta de um esqueleto de varetas.

    `ossos` é uma lista de (ponto_a, ponto_b, raio) em metros. Os pontos
    repetidos são o MESMO nó — é assim que o braço fica preso ao ombro em vez
    de ficar ao lado dele.
    """
    verts, arestas, raios = [], [], []
    indice = {}
    for a, b, r in ossos:
        for p in (a, b):
            if p not in indice:
                indice[p] = len(verts)
                verts.append(p)
                raios.append(r)
        # cada nó fica com o MAIOR raio que lhe chega: um ombro é mais grosso
        # que o braço que sai dele, e é o ombro que manda
        raios[indice[a]] = max(raios[indice[a]], r)
        raios[indice[b]] = max(raios[indice[b]], r)
        arestas.append((indice[a], indice[b]))

    me = bpy.data.meshes.new(nome)
    me.from_pydata(verts, arestas, [])
    me.update()
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)

    ob.modifiers.new("pele", "SKIN")
    for i, r in enumerate(raios):
        ob.data.skin_vertices[0].data[i].radius = (r, r)
    # a RAIZ tem de ser declarada: sem ela o modificador não sabe por onde
    # começar a engrossar e devolve uma malha vazia, sem dizer nada
    ob.data.skin_vertices[0].data[0].use_root = True
    if subdiv:
        s = ob.modifiers.new("suave", "SUBSURF")
        s.levels = s.render_levels = subdiv

    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    if suave:
        bpy.ops.object.shade_smooth()
    return ob


# ── AS MEDIDAS ───────────────────────────────────────────────────────────────
# Um homem de 2,0 m da cabeça aos pés. Não é a altura de um homem: é a altura
# desta peça, que o mapa depois multiplica por 2,2 porque um jogo de estratégia
# aumenta as unidades face aos edifícios. As proporções é que são humanas —
# sete cabeças e meia, ombros a 1,2 vezes a largura da bacia.
ALT = 2.0
CAB = ALT / 7.5                      # a cabeça, a unidade de toda a proporção


def esqueleto_homem(passo=0.0, braco=0.0):
    """as varetas de um homem de pé. `passo` abre as pernas, `braco` os braços.

    ── TUDO TEM DE SER UM SÓ CORPO ─────────────────────────────────────────
    A primeira versão pôs as ancas em nós próprios, à largura da bacia, sem
    aresta que as ligasse ao tronco. Ficaram um SEGUNDO corpo, solto — e o
    modificador de pele só constrói a partir da raiz. O resultado foi um torso
    com dois bracinhos a flutuar, sem pernas e sem cabeça, e nem um aviso.
    Aqui todos os nós descem do mesmo: bacia -> anca -> joelho -> pé.

    Os dois parâmetros existem para o mesmo esqueleto dar uma pose de sentinela
    e uma de marcha sem se reescrever nada — e é ele que há de virar armadura.
    """
    p = math.radians(passo)
    b = math.radians(braco)
    z_bacia = ALT * 0.50
    z_peito = ALT * 0.66
    z_ombro = ALT * 0.78
    BACIA = (0.0, 0.0, z_bacia)
    PEITO = (0.0, 0.0, z_peito)
    OMBRO = (0.0, 0.0, z_ombro)
    o = []

    # ── tronco ──────────────────────────────────────────────────────────
    # a bacia é mais estreita que o peito: é essa diferença que faz cintura,
    # e é a primeira coisa que separa um homem de um caixote
    o += [(BACIA, PEITO, CAB * 0.38),
          (PEITO, OMBRO, CAB * 0.48)]

    # ── pescoço e cabeça ────────────────────────────────────────────────
    # O PESCOÇO PRECISA DE DOIS NÓS, não de um. A pele interpola o raio entre
    # nós vizinhos: com um só, os 0,48 do ombro derretem-se nos 0,38 da cabeça
    # e não há pescoço nenhum — a cabeça sai um caroço nos ombros, que foi o
    # que aconteceu à primeira. Com dois nós finos a seguir, o estreitamento
    # tem onde acontecer.
    N1 = (0.0, 0.0, z_ombro + CAB * 0.16)
    N2 = (0.0, 0.0, z_ombro + CAB * 0.34)
    o += [(OMBRO, N1, CAB * 0.155),
          (N1, N2, CAB * 0.145),
          (N2, (0.0, 0.0, ALT * 0.995), CAB * 0.40)]

    # ── braços ──────────────────────────────────────────────────────────
    # os ombros saem PARA FORA antes de o braço descer: sem esse cotovelo
    # horizontal os braços nascem do peito e o homem fica sem ombros
    for lado in (1, -1):
        oml = (0.0, lado * CAB * 0.60, z_ombro)
        cot = (math.sin(b) * CAB * 0.9 * lado, lado * CAB * 0.66, z_ombro - CAB * 1.05)
        mao = (math.sin(b) * CAB * 1.7 * lado, lado * CAB * 0.58, z_ombro - CAB * 1.95)
        o += [(OMBRO, oml, CAB * 0.23), (oml, cot, CAB * 0.17), (cot, mao, CAB * 0.13)]

    # ── pernas ──────────────────────────────────────────────────────────
    # AS ANCAS BEM AFASTADAS. Com elas juntas as duas coxas derretem-se uma na
    # outra e o homem fica com um tronco de árvore em vez de pernas.
    for lado in (1, -1):
        anc = (0.0, lado * CAB * 0.44, z_bacia - CAB * 0.16)
        joe = (math.sin(p) * CAB * 0.9 * lado, lado * CAB * 0.46, z_bacia * 0.48)
        pe = (math.sin(p) * CAB * 1.7 * lado, lado * CAB * 0.46, CAB * 0.15)
        o += [(BACIA, anc, CAB * 0.27), (anc, joe, CAB * 0.24), (joe, pe, CAB * 0.17)]
    return o
