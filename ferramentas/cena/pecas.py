# pecas.py — as peças de que uma aldeia é feita.
#
# Não se corre sozinho: é importado pelo `aldeias.py`.
#
# ── DUAS REGRAS QUE ESTE FICHEIRO EXISTE PARA IMPOR ──────────────────────────
#
# 1. TUDO EM METROS. Uma casa tem 8 m porque uma casa tem 8 m; a câmara é que
#    decide quantos pixels isso dá. É o que evita a confusão do mapa da ilha,
#    onde uma unidade eram 100 px e ninguém sabia de cor quanto media uma serra.
#
# 2. `bpy.ops` SÓ PARA CONSTRUIR OS PROTÓTIPOS, NUNCA PARA POVOAR A CENA.
#    A primeira versão criava cada árvore, cada estaca e cada casa com
#    `bpy.ops.mesh.primitive_*_add`. Cada uma dessas chamadas obriga o Blender a
#    reavaliar o grafo da cena INTEIRA — com dez mil objetos o custo vira
#    quadrático e o render nunca chega a começar. Ficou parado dez minutos sem
#    escrever uma linha.
#    Aqui constrói-se cada TIPO uma vez (umas dezenas de chamadas) e povoa-se com
#    `obj.copy()` a partilhar a mesma malha. É instantâneo, e como a malha é
#    partilhada o Cycles trata as cópias como instâncias: mil árvores custam a
#    memória de uma.
#
# 3. Sem modificador de bisel por objeto. Dez mil modificadores são mais lentos
#    que a geometria toda; o bisel é aplicado UMA VEZ no protótipo.
import json
import math
import os
import random
import re

import bpy

# ---- materiais --------------------------------------------------------------
# Cores em linear. São ILUSTRAÇÃO, não fotografia: mais saturadas e mais
# separadas em valor do que a realidade. A lição da ilha foi essa — uma ortofoto
# tem contraste baixo por natureza e por isso lê-se mal; um mapa de jogo tem
# contraste porque alguém o pôs lá.
COR = {
    "relva":      (0.070, 0.128, 0.030, 1),
    "relva_seca": (0.180, 0.160, 0.048, 1),
    "terra":      (0.128, 0.082, 0.040, 1),
    "caminho":    (0.196, 0.150, 0.098, 1),
    "lavrado":    (0.150, 0.096, 0.048, 1),
    "trigo":      (0.310, 0.220, 0.062, 1),
    "madeira":    (0.104, 0.055, 0.024, 1),
    "madeira2":   (0.156, 0.088, 0.036, 1),
    "colmo":      (0.270, 0.180, 0.062, 1),
    "colmo2":     (0.205, 0.132, 0.048, 1),
    "pedra":      (0.185, 0.172, 0.150, 1),
    "folha":      (0.036, 0.076, 0.020, 1),
    "folha2":     (0.058, 0.098, 0.026, 1),
    "folha3":     (0.086, 0.104, 0.030, 1),
    "reboco":     (0.400, 0.340, 0.252, 1),   # taipa caiada
    "reboco2":    (0.330, 0.268, 0.190, 1),
    "viga":       (0.052, 0.030, 0.016, 1),   # o prumo escuro do enxaimel
    "alicerce":   (0.172, 0.146, 0.110, 1),   # pedra QUENTE: a cinzenta lia azul
    "telha":      (0.215, 0.070, 0.032, 1),
    "feno":       (0.330, 0.240, 0.072, 1),
    "horta":      (0.052, 0.112, 0.026, 1),
    "la":         (0.400, 0.380, 0.330, 1),
    # A FOLHADA E MAIS ESCURA QUE A RELVA, nunca mais clara. Com o chao liso
    # verde, o disco de "terra" que estava por baixo de cada bosque virava um
    # halo pálido e cada mancha lia-se como uma clareira em vez de mata cerrada.
    # Debaixo de arvores o chao esta na sombra: e isso que o olho espera.
    "folhada":    (0.020, 0.034, 0.012, 1),
    "pano_azul":  (0.045, 0.095, 0.290, 1),   # a cor do Rei
    "pano_verm":  (0.290, 0.045, 0.040, 1),
}
VARIA_INSTANCIA = 0.16

# ── DE QUE É FEITA CADA COR ───────────────────────────────────────────────────
# Uma cor chapada lê-se como plástico, por melhor que seja a cor. O que falta não
# é resolução — é ter GRÃO e ter RELEVO fino, porque é aí que a luz se agarra.
# Cada família abaixo é um padrão gerado por código: o lenho tem veio esticado ao
# longo da peça, o colmo tem palhas finas todas no mesmo sentido, a cantaria tem
# blocos, a taipa tem manchas de cal. Nenhuma precisa de um ficheiro.
#
# Isto NÃO substitui texturas fotográficas — substitui o nada. Quando houver
# ficheiros, entram por cima disto e este código continua a servir de base para o
# relevo.
FAMILIA = {
    "madeira": "lenho", "madeira2": "lenho", "viga": "lenho",
    "colmo": "palha", "colmo2": "palha", "feno": "palha", "trigo": "palha",
    "pedra": "cantaria", "alicerce": "cantaria",
    "reboco": "taipa", "reboco2": "taipa",
    "relva": "erva", "relva_seca": "erva", "horta": "erva", "folha": "erva",
    "folha2": "erva", "folha3": "erva", "la": "erva",
    "terra": "solo", "caminho": "solo", "lavrado": "solo",
}
# (escala do padrão, alongamento no eixo maior, força do relevo, contraste da cor)
RECEITA = {
    "lenho":    (18.0, 14.0, 0.55, 0.30),
    "palha":    (55.0, 9.0, 0.85, 0.26),
    "cantaria": (5.5, 1.0, 0.75, 0.24),
    "taipa":    (9.0, 1.0, 0.22, 0.13),
    "erva":     (46.0, 1.0, 0.35, 0.22),
    "solo":     (14.0, 1.0, 0.40, 0.20),
}
_mats = {}


def _padrao(nt, familia):
    """devolve (fator de cor 0..1, altura para o relevo) para uma família.

    Tudo em coordenadas de OBJETO, não de UV: assim funciona em geometria que
    nunca foi desdobrada — que é toda a nossa, porque nasce de caixas e
    cilindros criados por código.
    """
    nos, liga = nt.nodes, nt.links
    escala, alonga, _forca, _contr = RECEITA[familia]
    coord = nos.new("ShaderNodeTexCoord")
    mapa = nos.new("ShaderNodeMapping")
    mapa.inputs["Scale"].default_value = (escala / alonga, escala, escala)
    liga.new(coord.outputs["Object"], mapa.inputs["Vector"])

    if familia == "cantaria":
        # blocos: o Voronoi dá células, e a distância à aresta dá a junta
        v = nos.new("ShaderNodeTexVoronoi")
        v.feature = "DISTANCE_TO_EDGE"
        v.inputs["Scale"].default_value = 1.0
        liga.new(mapa.outputs["Vector"], v.inputs["Vector"])
        junta = nos.new("ShaderNodeMapRange")
        junta.inputs["From Min"].default_value = 0.0
        junta.inputs["From Max"].default_value = 0.10
        junta.clamp = True
        liga.new(v.outputs["Distance"], junta.inputs["Value"])
        # e uma segunda passagem, para cada bloco ter o seu tom
        v2 = nos.new("ShaderNodeTexVoronoi")
        v2.feature = "F1"
        v2.inputs["Scale"].default_value = 1.0
        liga.new(mapa.outputs["Vector"], v2.inputs["Vector"])
        mist = nos.new("ShaderNodeMath")
        mist.operation = "MULTIPLY_ADD"
        mist.inputs[1].default_value = 0.55
        mist.inputs[2].default_value = 0.45
        liga.new(v2.outputs["Distance"], mist.inputs[0])
        cor = nos.new("ShaderNodeMath")
        cor.operation = "MULTIPLY"
        liga.new(mist.outputs["Value"], cor.inputs[0])
        liga.new(junta.outputs["Result"], cor.inputs[1])
        return cor.outputs["Value"], junta.outputs["Result"]

    n = nos.new("ShaderNodeTexNoise")
    n.inputs["Detail"].default_value = 6.0 if familia != "palha" else 3.0
    n.inputs["Roughness"].default_value = 0.62
    n.inputs["Scale"].default_value = 1.0
    liga.new(mapa.outputs["Vector"], n.inputs["Vector"])
    # esticar o contraste: o `Fac` do ruído do Blender vive apertado à volta de
    # 0,5, e sem isto o padrão fica visível só ao microscópio (custou-nos três
    # renders no mapa da Ibéria antes de eu perceber)
    e = nos.new("ShaderNodeMapRange")
    e.inputs["From Min"].default_value = 0.36
    e.inputs["From Max"].default_value = 0.64
    e.clamp = True
    liga.new(n.outputs["Fac"], e.inputs["Value"])
    return e.outputs["Result"], e.outputs["Result"]


# ── AS TEXTURAS DE FICHEIRO ───────────────────────────────────────────────────
# Quando existe uma pasta em `assets/texturas/<familia>/`, ela ganha ao padrão
# gerado por código: cor, rugosidade e relevo passam a vir de fotografia. Quando
# não existe, fica o padrão. Assim o projeto anda mesmo com materiais a faltar —
# e ao fim de dois meses ninguém tem de se lembrar de quais é que já chegaram.
#
# O TAMANHO REAL DO PADRÃO, em metros, é o que faz isto ler bem ou mal. Uma
# textura de tábuas esticada por uma parede de 8 m dá tábuas de 8 m, que não
# existem; a mesma textura repetida a cada 1,2 m dá tábuas de tábua. É por isso
# que cada família traz o seu `metros`.
TEX_RAIZ = os.path.join(os.getcwd(), "assets", "texturas")

# (pasta em assets/texturas, quantos metros ocupa um ladrilho, força do relevo)
FICHEIRO = {
    "madeira":    ("madeira", 1.6, 0.9),
    "madeira2":   ("madeira2", 2.0, 0.8),
    "viga":       ("madeira", 1.4, 0.9),
    "pedra":      ("pedra", 3.0, 1.0),
    "alicerce":   ("alicerce", 2.6, 1.0),
    "reboco":     ("taipa", 3.4, 0.6),
    "reboco2":    ("taipa", 3.0, 0.6),
    "relva":      ("relva", 3.2, 0.5),
    "relva_seca": ("relva", 3.6, 0.5),
    "terra":      ("terra", 3.0, 0.7),
    "caminho":    ("caminho", 2.4, 0.7),
    "lavrado":    ("terra", 2.2, 0.7),
    # o colmo pede um ladrilho PEQUENO: a palha tem uns centimetros, e esticada
    # por um telhado de 8 m viram-se molhos de palha do tamanho de uma porta
    "colmo":      ("colmo", 1.1, 1.2),
    "colmo2":     ("colmo2", 1.3, 1.2),
    "feno":       ("colmo", 1.0, 1.0),
    "trigo":      ("colmo2", 1.6, 0.8),
    "telha":      ("telha", 1.4, 1.0),
}
_tex_avisado = set()


def carregar_tex(nt, pasta, metros, forca=1.0, tinta=None):
    """liga uma textura de ficheiro e devolve (cor, rugosidade, normal).

    Devolve os sinais em vez de os ligar a um sombreador, porque há sítios que
    precisam de DOIS materiais misturados — o chão, que é relva a passar a terra
    — e para isso é preciso ter os sinais na mão.

    COORDENADAS DE OBJETO, não UV: a nossa geometria nasce de caixas e cilindros
    criados por código e nunca foi desdobrada. Com coordenadas de objeto o padrão
    acompanha a peça e mantém a escala em metros.
    """
    nos, liga = nt.nodes, nt.links
    caminho = os.path.join(TEX_RAIZ, pasta)
    if not os.path.exists(os.path.join(caminho, "cor.jpg")):
        return None, None, None
    coord = nos.new("ShaderNodeTexCoord")
    mapa = nos.new("ShaderNodeMapping")
    k = 1.0 / metros
    mapa.inputs["Scale"].default_value = (k, k, k)
    liga.new(coord.outputs["Object"], mapa.inputs["Vector"])

    def imagem(f, dados=True):
        c = os.path.join(caminho, f)
        if not os.path.exists(c):
            return None
        t = nos.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(c, check_existing=True)
        if dados:
            t.image.colorspace_settings.name = "Non-Color"
        t.extension = "REPEAT"
        liga.new(mapa.outputs["Vector"], t.inputs["Vector"])
        return t

    cor = imagem("cor.jpg", dados=False).outputs["Color"]
    if tinta is not None:
        # A NOSSA COR MANDA, A FOTOGRAFIA DÁ O DETALHE. O modo COLOR do Blender
        # tira o matiz e a saturação da camada de cima e a LUMINOSIDADE da de
        # baixo — ou seja, fica o nosso tom com o claro-escuro da fotografia.
        # A primeira tentativa usou OVERLAY a 0,72 e escureceu tudo até à lama:
        # o overlay multiplica e queima, e nada disto é o que se queria.
        t = nos.new("ShaderNodeRGB")
        t.outputs[0].default_value = tinta
        m = nos.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.blend_type = "COLOR"
        m.inputs["Factor"].default_value = float(os.environ.get("TEX_TINTA", 0.80))
        liga.new(cor, m.inputs[6])
        liga.new(t.outputs[0], m.inputs[7])
        cor = m.outputs["Result"]

    r = imagem("rugosidade.png")
    rug = r.outputs["Color"] if r else None

    nor = None
    n = imagem("normal.png")
    if n:
        mn = nos.new("ShaderNodeNormalMap")
        mn.inputs["Strength"].default_value = forca
        liga.new(n.outputs["Color"], mn.inputs["Color"])
        nor = mn.outputs["Normal"]
    else:
        a = imagem("altura.png")
        if a:
            b = nos.new("ShaderNodeBump")
            b.inputs["Strength"].default_value = forca * 0.5
            liga.new(a.outputs["Color"], b.inputs["Height"])
            nor = b.outputs["Normal"]
    return cor, rug, nor


def _por_ficheiro(nt, p, nome):
    achado = FICHEIRO.get(nome)
    if not achado:
        return None
    pasta, metros, forca = achado
    cor, rug, nor = carregar_tex(nt, pasta, metros, forca, tinta=COR[nome])
    if cor is None:
        if pasta not in _tex_avisado:
            _tex_avisado.add(pasta)
            print("  (sem textura para '%s' — fica o padrao gerado)" % pasta)
        return None
    if rug:
        nt.links.new(rug, p.inputs["Roughness"])
    if nor:
        nt.links.new(nor, p.inputs["Normal"])
    return cor


def material(nome, rugosidade=0.9, variar=VARIA_INSTANCIA):
    """um material por cor, partilhado por todas as cópias.

    Duas variações, e são de naturezas diferentes:
      * ENTRE PEÇAS — cada cópia tem um tom seu, vindo do nó `Object Info`, que
        dá a cada objeto um número aleatório. Não pode ser um material por
        objeto: seriam milhares.
      * DENTRO DA PEÇA — o veio, a palha, os blocos, vindos de `_padrao`.
    """
    if nome in _mats:
        return _mats[nome]
    m = bpy.data.materials.new("M_" + nome)
    m.use_nodes = True
    nt = m.node_tree
    nos, liga = nt.nodes, nt.links
    p = nos["Principled BSDF"]
    p.inputs["Roughness"].default_value = rugosidade
    if "Specular IOR Level" in p.inputs:
        p.inputs["Specular IOR Level"].default_value = 0.06

    base = nos.new("ShaderNodeRGB")
    base.outputs[0].default_value = COR[nome]
    cor = base.outputs[0]

    familia = FAMILIA.get(nome)
    de_ficheiro = _por_ficheiro(nt, p, nome)
    if de_ficheiro is not None:
        cor = de_ficheiro
        familia = None                       # a fotografia ganha ao padrao
    if familia:
        _e, _a, forca, contraste = RECEITA[familia]
        fator, altura = _padrao(nt, familia)
        # o padrão escurece e clareia a cor base, sem lhe mudar o tom
        faixa = nos.new("ShaderNodeMapRange")
        faixa.inputs["To Min"].default_value = 1.0 - contraste
        faixa.inputs["To Max"].default_value = 1.0 + contraste
        liga.new(fator, faixa.inputs["Value"])
        cinza = nos.new("ShaderNodeCombineXYZ")
        for eixo in ("X", "Y", "Z"):
            liga.new(faixa.outputs["Result"], cinza.inputs[eixo])
        mult = nos.new("ShaderNodeMix")
        mult.data_type = "RGBA"
        mult.blend_type = "MULTIPLY"
        mult.inputs["Factor"].default_value = 1.0
        liga.new(cor, mult.inputs[6])
        liga.new(cinza.outputs["Vector"], mult.inputs[7])
        cor = mult.outputs["Result"]
        # e dá relevo: é o relevo que faz a luz agarrar-se à superfície
        rel = nos.new("ShaderNodeBump")
        rel.inputs["Strength"].default_value = forca
        rel.inputs["Distance"].default_value = 0.06
        liga.new(altura, rel.inputs["Height"])
        liga.new(rel.outputs["Normal"], p.inputs["Normal"])
        # a junta da pedra e a palha são mais ásperas que o resto
        asp = nos.new("ShaderNodeMapRange")
        asp.inputs["To Min"].default_value = min(1.0, rugosidade + 0.06)
        asp.inputs["To Max"].default_value = max(0.4, rugosidade - 0.12)
        liga.new(fator, asp.inputs["Value"])
        liga.new(asp.outputs["Result"], p.inputs["Roughness"])

    if variar:
        info = nos.new("ShaderNodeObjectInfo")
        faixa2 = nos.new("ShaderNodeMapRange")
        faixa2.inputs["To Min"].default_value = 1.0 - variar
        faixa2.inputs["To Max"].default_value = 1.0 + variar
        liga.new(info.outputs["Random"], faixa2.inputs["Value"])
        cinza2 = nos.new("ShaderNodeCombineXYZ")
        for eixo in ("X", "Y", "Z"):
            liga.new(faixa2.outputs["Result"], cinza2.inputs[eixo])
        mult2 = nos.new("ShaderNodeMix")
        mult2.data_type = "RGBA"
        mult2.blend_type = "MULTIPLY"
        mult2.inputs["Factor"].default_value = 1.0
        liga.new(cor, mult2.inputs[6])
        liga.new(cinza2.outputs["Vector"], mult2.inputs[7])
        cor = mult2.outputs["Result"]

    liga.new(cor, p.inputs["Base Color"])
    _mats[nome] = m
    return m


# ---- construção de protótipos (bpy.ops só aqui) ------------------------------
LIXO = None            # coleção onde vivem os protótipos, fora do render


def _prototipos():
    global LIXO
    if LIXO is None:
        LIXO = bpy.data.collections.new("prototipos")
    return LIXO


def material_orla(cor, raio, borda):
    """o material do chão de uma peça, com a beira a DISSOLVER-SE.

    ── O ANEL PÁLIDO ("parece neve") ────────────────────────────────────────
    O terreiro de terra batida é legitimamente mais claro que a relva — é chão
    pisado. Medido: luminância 146 contra 107 da relva. Com uma beira DURA isso
    lê-se como um anel de neve à volta da muralha.
    A saída não é escurecer o pátio (ele deve ser claro) nem afinar a cor para
    esta relva (amanhã o chão muda). É a beira desaparecer: nos últimos metros o
    alfa cai a zero e a peça funde-se com o que estiver por baixo, seja verde,
    seja areia, seja neve a sério.
    """
    chave = "ORLA_%s_%d" % (cor, int(raio * 10))
    if chave in _mats:
        return _mats[chave]
    m = bpy.data.materials.new(chave)
    m.use_nodes = True
    nt = m.node_tree
    nos, liga = nt.nodes, nt.links
    p = nos["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.95
    base = _por_ficheiro(nt, p, cor)
    if base is None:
        rgb = nos.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = COR[cor]
        base = rgb.outputs[0]
    liga.new(base, p.inputs["Base Color"])

    coord = nos.new("ShaderNodeTexCoord")
    sep = nos.new("ShaderNodeSeparateXYZ")
    liga.new(coord.outputs["Object"], sep.inputs["Vector"])
    d = nos.new("ShaderNodeMath")
    d.operation = "PYTHAGORAS" if False else "POWER"
    # distancia ao centro, no plano: hypot(x, y)
    qx = nos.new("ShaderNodeMath"); qx.operation = "MULTIPLY"
    liga.new(sep.outputs["X"], qx.inputs[0]); liga.new(sep.outputs["X"], qx.inputs[1])
    qy = nos.new("ShaderNodeMath"); qy.operation = "MULTIPLY"
    liga.new(sep.outputs["Y"], qy.inputs[0]); liga.new(sep.outputs["Y"], qy.inputs[1])
    som = nos.new("ShaderNodeMath"); som.operation = "ADD"
    liga.new(qx.outputs["Value"], som.inputs[0]); liga.new(qy.outputs["Value"], som.inputs[1])
    raiz = nos.new("ShaderNodeMath"); raiz.operation = "SQRT"
    liga.new(som.outputs["Value"], raiz.inputs[0])
    # e um ruído largo para a beira não ser um círculo perfeito
    n = nos.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 2.2
    n.inputs["Detail"].default_value = 4.0
    liga.new(coord.outputs["Object"], n.inputs["Vector"])
    desv = nos.new("ShaderNodeMath"); desv.operation = "MULTIPLY_ADD"
    desv.inputs[1].default_value = borda * 0.55
    desv.inputs[2].default_value = -borda * 0.27
    liga.new(n.outputs["Fac"], desv.inputs[0])
    total = nos.new("ShaderNodeMath"); total.operation = "ADD"
    liga.new(raiz.outputs["Value"], total.inputs[0])
    liga.new(desv.outputs["Value"], total.inputs[1])

    faixa = nos.new("ShaderNodeMapRange")
    faixa.inputs["From Min"].default_value = raio - borda
    faixa.inputs["From Max"].default_value = raio
    faixa.clamp = True
    liga.new(total.outputs["Value"], faixa.inputs["Value"])

    mist = nos.new("ShaderNodeMixShader")
    transp = nos.new("ShaderNodeBsdfTransparent")
    liga.new(faixa.outputs["Result"], mist.inputs["Fac"])
    liga.new(p.outputs["BSDF"], mist.inputs[1])
    liga.new(transp.outputs["BSDF"], mist.inputs[2])
    liga.new(mist.outputs["Shader"], nos["Material Output"].inputs["Surface"])
    _mats[chave] = m
    return m


def _novo_orla(obj, cor, raio, borda):
    obj.data.materials.clear()
    obj.data.materials.append(material_orla(cor, raio, borda))
    return obj


def _novo(obj, cor, bisel=0.05):
    obj.data.materials.clear()
    obj.data.materials.append(material(cor))
    if bisel:
        b = obj.modifiers.new("bisel", "BEVEL")
        b.width = bisel
        b.segments = 2
        b.limit_method = "ANGLE"
        b.angle_limit = 0.55
    return obj


def _juntar(partes):
    bpy.ops.object.select_all(action="DESELECT")
    for o in partes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.join()
    o = bpy.context.object
    # o bisel é aplicado AQUI, uma vez, e todas as cópias herdam-no de graça
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    # ── A ORIGEM VOLTA AO ZERO ───────────────────────────────────────────────
    # `join` faz a peça herdar a origem do PRIMEIRO objeto da lista. No portão o
    # primeiro bloco é a base da torre esquerda, a x = −5,5 — e a peça inteira
    # passava a assentar 5,5 m ao lado de onde era colocada. Era essa a brecha
    # que restava entre o muro e o portão.
    #
    # E ISTO É FILHO DA CORREÇÃO ANTERIOR: enquanto o `transform_apply` aplicava
    # também a localização (o bug das madeiras a voar), todas as origens caíam no
    # zero e o `join` herdava zero por acidente. Corrigir um destapou o outro.
    # Os protótipos são todos desenhados à volta da origem, portanto é aí que a
    # origem tem de ficar — dito de propósito, e não por sorte.
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return o


def _encaixe(obj, largura):
    """largura, em metros, a que o muro deve encostar a esta peça.

    NÃO é a caixa envolvente, e a diferença é a que abriu o último buraco. A
    caixa envolvente do portão mede 17,6 m porque inclui a BEIRA DO TELHADO, que
    avança meio metro além da base de pedra de cada lado. O muro encostava ao
    telhado e ficava meio metro de folga lá em baixo, tapada de cima e à vista de
    lado.
    Só quem constrói a peça sabe onde é que ela recebe o muro — então é quem a
    constrói que o diz, na mesma função onde a geometria é escrita. Medir a
    caixa envolvente foi trocar um número mágico por outro.
    """
    obj["encaixe"] = float(largura)
    return obj


def _guardar(obj):
    """tira o protótipo da cena: ele não é para ser visto, só copiado.

    E carimba-lhe os mastros que foram registados enquanto ele se construía —
    em coordenadas LOCAIS, para o `onde()` as poder transformar depois. Guardados
    achatados porque as propriedades do Blender não gostam de listas de listas.
    """
    global _MASTROS_LOCAIS
    if _MASTROS_LOCAIS:
        plano = []
        for m in _MASTROS_LOCAIS:
            plano.extend(m)
        obj["mastros"] = plano
    _MASTROS_LOCAIS = []
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    _prototipos().objects.link(obj)
    return obj


def _aplicar_escala():
    """aplica SÓ a escala, e o `location=False` não é opcional.

    ── O BUG DAS MADEIRAS A VOAR ────────────────────────────────────────────
    Os parâmetros dos operadores do Blender são `True` por omissão. Escrever
    `transform_apply(scale=True)` não desliga `location` nem `rotation` — aplica
    os três. E aplicar a localização move a ORIGEM do objeto para o zero do
    mundo.
    Enquanto a peça não roda, não se nota: a malha continua no sítio certo. Mas
    uma peça que RODE depois disso passa a rodar em torno do zero do mundo em
    vez de em torno de si própria. Uma mísula de torre, a dez metros de altura,
    rodada 0,6 rad, saltava de x=2,1 para x=6,6 — doze tábuas a flutuar no ar à
    volta de cada torre, que foi exatamente o que o Lucas viu.
    Medido: origem (0,0,0) em vez de (2,1, 0, 9,3).
    """
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def _caixa(x, y, z, c, l, a, cor, bisel=0.05):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + a / 2))
    o = bpy.context.object
    o.scale = (c, l, a)
    _aplicar_escala()
    return _novo(o, cor, bisel)


def _cil(x, y, z, r, a, cor, lados=8, bisel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(vertices=lados, radius=r, depth=a,
                                        location=(x, y, z + a / 2))
    return _novo(bpy.context.object, cor, bisel)


def _malha(nome, verts, faces, cor, bisel=0.04):
    me = bpy.data.meshes.new(nome)
    me.from_pydata(verts, [], faces)
    me.validate()
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    return _novo(o, cor, bisel)


def malha_rapida(nome, co, quads, cor):
    """malha grande, pela via a granel do Blender.

    `from_pydata` percorre a lista em Python; `foreach_set` recebe o bloco de
    uma vez. Medido num terreno de 205 920 vértices: 0,24 s contra 0,10 s. É a
    via certa e é a que escala, mas NÃO é onde estava o tempo desta cena — ver
    o cabeçalho do `uma_aldeia.py`, que traz a repartição medida.
    """
    import numpy as np
    me = bpy.data.meshes.new(nome)
    nv, nf = len(co), len(quads)
    me.vertices.add(nv)
    me.vertices.foreach_set("co", co.reshape(-1))
    me.loops.add(nf * 4)
    me.loops.foreach_set("vertex_index", quads.reshape(-1))
    me.polygons.add(nf)
    me.polygons.foreach_set("loop_start", np.arange(nf, dtype=np.int32) * 4)
    me.update(calc_edges=True)
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    return _novo(o, cor, 0)


def _telhado(x, y, z, c, l, a, cor, beira=0.55):
    """duas águas com beiral. O beiral é o que faz a casa parecer construída:
    sem ele o telhado assenta rente à parede e lê-se como caixa com um pico."""
    C, L = c / 2 + beira, l / 2 + beira
    v = [(x - C, y - L, z), (x + C, y - L, z), (x + C, y + L, z), (x - C, y + L, z),
         (x - C, y, z + a), (x + C, y, z + a)]
    f = [(0, 1, 5, 4), (3, 2, 5, 4), (0, 4, 3), (1, 2, 5)]
    return _malha("telhado", v, f, cor)


# ── A FAMÍLIA DE POVOAÇÕES ───────────────────────────────────────────────────
# O mapa tem 24 aldeias e já as distingue por tamanho: 12 pequenas, 6 médias,
# 4 grandes e 2 capitais. Vinte e quatro cópias da mesma peça ficariam PIOR do
# que os sprites antigos — a repetição lê-se de imediato e denuncia o truque.
# Como tudo aqui é paramétrico, uma família custa quase o mesmo que uma peça:
# muda o raio, o número de casas, o tipo de muro e quantas torres.
#
# A BANDEIRA é global de propósito. É a única coisa que muda entre a mesma
# povoação em mãos de um Rei ou do outro, e passar a cor por argumento a todas
# as peças que a usam era espalhar a mesma decisão por cinco sítios.
# ── A BANDEIRA NÃO É ASSADA. É UMA COORDENADA. ──────────────────────────────
# A cor do Rei é o eixo que mais multiplica: 24 povoações x 3 cores são 72
# renders hoje, e 24 x 7 seriam 168 numa expansão com seis Reis — tudo isso para
# desenhar um pano diferente. E o pano não muda a FORMA de nada.
#
# Então o mastro é assado (é geometria) e o pano não. Cada protótipo regista onde
# tem mastros, em coordenadas locais; o `onde()` transforma-as para a cena quando
# coloca a peça; o cozedor projeta-as para píxeis e grava-as no manifesto; e o
# jogo hasteia lá a flâmula da cor de quem for dono — coisa que ele já sabe fazer
# desde a pele v2.
#
# Resultado: 24 renders em vez de 72, e um sétimo Rei custa ZERO.
_MASTROS_LOCAIS = []          # a encher enquanto um protótipo é construído
MASTROS_CENA = []             # o que já foi colocado na cena, em metros


def bandeira(p, x, y, z, larg=1.4, alt=1.7):
    """regista um mastro. NÃO acrescenta pano nenhum.

    Os argumentos `larg` e `alt` ficam porque dizem o TAMANHO que o pano deveria
    ter naquele mastro — a torre de menagem quer um estandarte maior que um
    postigo — e o jogo usa-os para a flâmula não sair fora de escala.
    """
    _MASTROS_LOCAIS.append((float(x), float(y), float(z), float(alt)))
    return p


def proto_muro_estacas(comp=4.2, altura=3.0):
    """o muro pobre: estacas fincadas, sem adarve nem pedra.

    É o que uma aldeia pequena tem. A diferença com o muro grande não é de
    tamanho — é de MATERIAL e de perfil: sem embasamento, sem passadiço, sem
    parapeito. Ao lado um do outro lê-se logo qual é a praça-forte.
    """
    p = []
    n = max(3, int(comp / 0.52))
    for i in range(n):
        x = -comp / 2 + comp * (i + 0.5) / n
        h = altura * (0.88 + 0.24 * ((i * 7919) % 11) / 10.0)
        p.append(_cil(x, 0, -0.35, 0.26, h + 0.35, "madeira" if i % 3 else "madeira2", 6, 0.03))
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.26, radius2=0.0,
                                        depth=0.42, location=(x, 0, h + 0.21))
        p.append(_novo(bpy.context.object, "madeira", 0))
    for z in (0.9, 2.1):                                    # as travessas de dentro
        p.append(_caixa(0, 0.34, z, comp, 0.16, 0.18, "madeira2", 0.03))
    return _guardar(_encaixe(_juntar(p), comp))


def proto_portao_simples(vao=4.2, alt=5.0):
    """o portão pobre: duas jambas grossas e uma verga. Sem casa em cima."""
    p = []
    for lado in (-1, 1):
        x = lado * (vao / 2 + 0.5)
        p.append(_cil(x, 0, -0.6, 0.48, alt, "madeira", 8, 0.05))
        p.append(_caixa(x, 0, alt - 0.4, 1.6, 1.4, 0.5, "madeira2", 0.05))
    p.append(_caixa(0, 0, alt - 0.2, vao + 2.6, 0.55, 0.6, "madeira", 0.05))
    p.append(_caixa(0, 0, alt + 0.4, vao + 2.0, 0.4, 0.34, "madeira2", 0.04))
    p.append(_cil(0, 0, alt + 0.7, 0.08, 2.6, "madeira", 6, 0.02))
    bandeira(p, 0.62, 0, alt + 1.9, 1.2, 1.4)
    return _guardar(_encaixe(_juntar(p), vao + 2.6))


def proto_menagem(alt=20.0, lado=7.0):
    """a torre de menagem: a peça que faz uma capital ler-se como capital.

    Toda em PEDRA, quando o resto da povoação é madeira. O contraste de material
    vale mais do que a altura: uma torre de madeira de vinte metros lê-se como
    torre alta; uma de pedra lê-se como o sítio onde mora o Rei.
    """
    # O CORPO É "alicerce" (pedra quente e escura) e os cunhais são "pedra"
    # (mais clara). Ao contrário — corpo claro — a menagem lia como mármore e
    # saltava da paleta de toda a povoação.
    p = [_caixa(0, 0, -1.0, lado + 2.2, lado + 2.2, 3.0, "alicerce")]
    p.append(_caixa(0, 0, 2.0, lado, lado, alt - 5.0, "alicerce"))
    for sx in (-1, 1):                                       # cunhais
        for sy in (-1, 1):
            p.append(_caixa(sx * (lado / 2 - 0.35), sy * (lado / 2 - 0.35), 2.0,
                            0.9, 0.9, alt - 5.0, "pedra", 0.06))
    p.append(_caixa(0, 0, alt - 3.0, lado + 1.6, lado + 1.6, 0.8, "alicerce"))
    p.append(_caixa(0, 0, alt - 2.2, lado + 1.8, lado + 1.8, 0.3, "pedra"))
    for i in range(4):                                       # ameias de pedra
        a = math.pi / 2 * i
        dx, dy = math.cos(a), math.sin(a)
        for k in (-1.5, -0.5, 0.5, 1.5):
            px = dx * (lado / 2 + 0.75) - dy * k * 1.5
            py = dy * (lado / 2 + 0.75) + dx * k * 1.5
            p.append(_caixa(px, py, alt - 1.9, 1.1, 1.1, 1.3, "pedra", 0.06))
    for h in (7.0, 12.0):                                    # frestas
        for lado2 in (-1, 1):
            p.append(_caixa(lado2 * (lado / 2 + 0.02), 0, h, 0.16, 0.6, 1.6, "viga", 0.02))
    p.append(_cil(0, 0, alt - 1.9, 0.11, 4.2, "madeira", 6, 0.02))
    bandeira(p, 0.9, 0, alt + 0.4, 1.8, 2.2)
    return _guardar(_juntar(p))


# ---- os protótipos -----------------------------------------------------------

def proto_casa(c=8.0, l=6.0, alt=3.0, cor_teto="colmo"):
    corpo = _caixa(0, 0, 0, c, l, alt, "madeira2")
    teto = _telhado(0, 0, alt, c, l, alt * 0.72, cor_teto)
    porta = _caixa(0, l / 2 + 0.07, 0, 1.2, 0.14, 2.0, "madeira", 0.02)
    return _guardar(_juntar([corpo, teto, porta]))


def proto_celeiro():
    corpo = _caixa(0, 0, 0, 12.0, 7.0, 3.6, "madeira2")
    teto = _telhado(0, 0, 3.6, 12.0, 7.0, 3.1, "colmo2")
    anexo = _caixa(7.4, 0, 0, 2.4, 2.4, 1.5, "madeira")
    return _guardar(_juntar([corpo, teto, anexo]))


def proto_estaca(altura=2.8):
    p = _cil(0, 0, -0.35, 0.15, altura + 0.35, "madeira", 6)
    topo = _cil(0, 0, altura - 0.35, 0.15, 0.34, "madeira2", 6, 0)
    return _guardar(_juntar([p, topo]))


def proto_torre(alt=10.0):
    partes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            partes.append(_cil(sx * 1.5, sy * 1.5, 0, 0.22, alt * 0.82, "madeira"))
    for z in (alt * 0.26, alt * 0.56):
        for s in (-1, 1):
            partes.append(_caixa(s * 1.5, 0, z, 0.16, 3.0, 0.16, "madeira2", 0.02))
            partes.append(_caixa(0, s * 1.5, z, 3.0, 0.16, 0.16, "madeira2", 0.02))
    partes.append(_caixa(0, 0, alt * 0.82, 4.6, 4.6, 0.24, "madeira2"))
    for i in range(4):
        a = math.pi / 2 * i
        partes.append(_caixa(2.2 * math.cos(a), 2.2 * math.sin(a), alt * 0.82 + 0.24,
                             4.6 if i % 2 else 0.22, 0.22 if i % 2 else 4.6, 1.1,
                             "madeira", 0.02))
    partes.append(_telhado(0, 0, alt * 0.82 + 1.34, 4.8, 4.8, 2.1, "colmo", 0.45))
    return _guardar(_juntar(partes))


def proto_arvore(alt=11.0, folha="folha", copas=((0.52, 1.0), (0.74, 0.74), (0.92, 0.40))):
    raio = alt * 0.30
    partes = [_cil(0, 0, 0, alt * 0.045, alt * 0.58, "madeira", 6)]
    for z, k in copas:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=raio * k,
                                              location=(0, 0, alt * z))
        o = bpy.context.object
        o.scale = (1.0, 1.0, 0.72)
        _aplicar_escala()
        bpy.ops.object.shade_smooth()
        partes.append(_novo(o, folha, 0))
    return _guardar(_juntar(partes))


def proto_penedo(raio=1.6):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=raio,
                                          location=(0, 0, raio * 0.35))
    o = bpy.context.object
    o.scale = (1.0, 0.78, 0.5)
    _aplicar_escala()
    return _guardar(_novo(o, "pedra", 0.08))


# ---- povoar (sem bpy.ops) ----------------------------------------------------
CENA = None


# ── O REGISTO DE COLOCACOES ──────────────────────────────────────────────────
# Toda a peça que entra numa cena passa por `onde`. Isso faz desta função o
# único sítio de onde se pode saber, sem adivinhar, ONDE ficou tudo — e é o que
# permite exportar o mapa como uma BIBLIOTECA DE PEÇAS mais uma lista de cópias,
# em vez de um bloco de geometria com a mesma casa repetida trezentas vezes.
#
# O navegador faz o mesmo que o Cycles faz aqui: uma malha na memória, milhares
# de matrizes. Sem isto, o mapa inteiro seriam milhões de triângulos únicos.
#
# Está desligado por omissão: os fornos que já existem não pagam nada por ele.
REGISTO = None                # None = não registar; [] = registar


def registar(ligado=True):
    global REGISTO
    REGISTO = [] if ligado else None
    return REGISTO


def onde(proto, x, y, z=0.0, rz=0.0, escala=1.0, alvo=None):
    """uma cópia do protótipo, a partilhar a MESMA malha.

    É esta função que substitui os dez mil `bpy.ops` da primeira versão. Como a
    malha é partilhada, o Cycles trata as cópias como instâncias — mil árvores
    custam a memória de uma.
    """
    if REGISTO is not None:
        # o Blender junta ".001" a um nome repetido dentro do mesmo ficheiro —
        # e as duas folhas de um portão SÃO o mesmo objeto, pedido duas vezes.
        # Como o nome carrega a receita, dois nomes com a mesma base têm a mesma
        # geometria por construção, e o sufixo só atrapalharia a biblioteca.
        base = re.sub(r"\.\d{3}$", "", proto.name)
        REGISTO.append({"peca": base, "p": [round(x, 3), round(y, 3), round(z, 3)],
                        "rz": round(rz, 4), "e": round(escala, 4)})
    o = proto.copy()                     # cópia do OBJETO, não da malha
    o.location = (x, y, z)
    o.rotation_euler = (0, 0, rz)
    o.scale = (escala, escala, escala)
    (alvo or bpy.context.scene.collection).objects.link(o)
    plano = proto.get("mastros")
    if plano:
        c, s_ = math.cos(rz), math.sin(rz)
        for i in range(0, len(plano), 4):
            mx, my, mz, malt = plano[i:i + 4]
            mx, my, mz = mx * escala, my * escala, mz * escala
            MASTROS_CENA.append((x + mx * c - my * s_, y + mx * s_ + my * c,
                                 z + mz, malt * escala))
    return o


# ---- agrupamentos ------------------------------------------------------------

def palicada(estaca, cx, cy, raio, portao_ang=None, passo=1.05, semente=0):
    r = random.Random(semente)
    n = max(12, int(2 * math.pi * raio / passo))
    for i in range(n):
        a = 2 * math.pi * i / n
        if portao_ang is not None:
            d = abs(((a - portao_ang + math.pi) % (2 * math.pi)) - math.pi)
            if d < 0.15:
                continue
        onde(estaca, cx + raio * math.cos(a), cy + raio * math.sin(a),
             0, r.random() * 3.1, 0.86 + 0.28 * r.random())


def campo(x, y, c, l, rz=0.0, cor="trigo", semente=0):
    """um campo lavrado: a laje e os sulcos.

    Os sulcos são o detalhe que diz "isto é trabalhado" — sem eles o campo é um
    retângulo de outra cor, e um retângulo de outra cor lê-se como erro de
    textura, não como agricultura.
    """
    partes = [_caixa(0, 0, -0.06, c, l, 0.14, cor, 0)]
    n = max(2, int(l / 1.7))
    for i in range(n):
        d = (i - (n - 1) / 2) * (l / n)
        partes.append(_caixa(0, d, 0.04, c * 0.95, l / n * 0.34, 0.10, "lavrado", 0))
    o = _juntar(partes)
    o.location = (x, y, 0)
    o.rotation_euler = (0, 0, rz)
    return o


# ── as peças da aldeia, versão 2 ─────────────────────────────────────────────
# A CASA É A PEÇA HERÓI. A primeira versão era uma caixa com um telhado, e a
# aldeia lia-se como um armazém. O que faz uma casa medieval reconhecer-se de
# longe não é detalhe: são quatro contrastes fortes —
#   embasamento de PEDRA escura contra parede CLARA,
#   prumos de madeira PRETOS contra a taipa caiada,
#   telhado que avança em BEIRAL e faz sombra na parede,
#   chaminé que quebra a silhueta.
# Nenhum deles custa mais de duas caixas, e juntos valem mais do que mil
# polígonos de telhado bem feito.

def proto_casa2(c=8.0, l=6.0, alt=3.0, teto="colmo", parede="reboco", chamine=True):
    p = []
    p.append(_caixa(0, 0, 0, c + 0.34, l + 0.34, 0.55, "alicerce"))       # embasamento
    p.append(_caixa(0, 0, 0.55, c, l, alt, parede))                        # taipa
    for sx in (-1, 1):                                                     # prumos de canto
        for sy in (-1, 1):
            p.append(_caixa(sx * (c / 2 - 0.11), sy * (l / 2 - 0.11), 0.55,
                            0.26, 0.26, alt, "viga", 0.02))
    z = 0.55 + alt * 0.58                                                  # travessa a meio
    p.append(_caixa(0, l / 2 - 0.05, z, c, 0.16, 0.22, "viga", 0.02))
    p.append(_caixa(0, -(l / 2 - 0.05), z, c, 0.16, 0.22, "viga", 0.02))
    p.append(_caixa(c / 2 - 0.05, 0, z, 0.16, l, 0.22, "viga", 0.02))
    p.append(_caixa(-(c / 2 - 0.05), 0, z, 0.16, l, 0.22, "viga", 0.02))
    p.append(_telhado(0, 0, 0.55 + alt, c, l, alt * 0.80, teto, 0.62))
    p.append(_caixa(0, 0, 0.55 + alt + alt * 0.80 - 0.16, c + 0.7, 0.42, 0.26,
                    "colmo2" if teto == "colmo" else "colmo", 0.06))       # cumeeira
    if chamine:
        p.append(_caixa(c / 2 - 1.4, l * 0.18, 0.55 + alt * 0.4,
                        0.85, 0.85, alt * 1.35, "alicerce", 0.04))
    p.append(_caixa(0, l / 2 + 0.05, 0.55, 1.25, 0.18, 2.05, "viga", 0.02))  # porta
    for s in (-1, 1):                                                      # janelas
        p.append(_caixa(s * (c * 0.27), l / 2 + 0.05, 0.55 + 1.35,
                        0.75, 0.16, 0.72, "viga", 0.02))
    return _guardar(_juntar(p))


def proto_celeiro2():
    """celeiro de lavoura: um lado aberto, com esteios à vista"""
    p = [_caixa(0, 0, 0, 13.0, 7.4, 0.5, "alicerce"),
         _caixa(0, -1.1, 0.5, 13.0, 5.2, 3.9, "madeira2")]
    for i in range(5):                                                     # esteios
        p.append(_caixa(-5.2 + i * 2.6, 2.9, 0.5, 0.3, 0.3, 3.9, "viga", 0.02))
    p.append(_telhado(0, 0, 4.4, 13.0, 7.4, 3.3, "colmo2", 0.8))
    p.append(_caixa(0, 0, 4.4 + 3.3 - 0.16, 13.7, 0.45, 0.28, "colmo", 0.06))
    return _guardar(_juntar(p))


def proto_poco():
    """o poço. É a peça que diz 'isto é habitado' — uma praça sem poço é um
    largo vazio, e com poço é o centro de uma aldeia."""
    p = [_cil(0, 0, 0, 1.35, 1.1, "pedra", 12, 0.05)]
    for s in (-1, 1):
        p.append(_caixa(s * 1.15, 0, 1.1, 0.22, 0.22, 2.1, "viga", 0.03))
    p.append(_caixa(0, 0, 3.1, 2.7, 0.2, 0.2, "viga", 0.03))
    p.append(_telhado(0, 0, 3.2, 2.6, 2.0, 0.9, "colmo", 0.35))
    p.append(_caixa(0, 0, 2.3, 0.5, 0.5, 0.42, "madeira", 0.03))           # o balde
    return _guardar(_juntar(p))


def proto_cerca(comp=4.0):
    """um troço de cerca, para se enfileirar ao longo de uma linha"""
    p = []
    for x in (-comp / 2, 0.0, comp / 2):
        p.append(_cil(x, 0, -0.2, 0.10, 1.5, "madeira", 6, 0.02))
    for z in (0.55, 1.05):
        p.append(_caixa(0, 0, z, comp, 0.09, 0.13, "madeira2", 0.02))
    return _guardar(_juntar(p))


def proto_carroca():
    p = [_caixa(0, 0, 0.62, 3.2, 1.5, 0.42, "madeira2"),
         _caixa(0, 0, 1.04, 3.0, 1.36, 0.5, "madeira")]
    for s in (-1, 1):                                                      # rodas
        r = _cil(s * 0.95, 0.86, 0, 0.62, 0.14, "madeira", 12, 0.02)
        r.rotation_euler = (math.pi / 2, 0, 0)
        p.append(r)
        r2 = _cil(s * 0.95, -0.86, 0, 0.62, 0.14, "madeira", 12, 0.02)
        r2.rotation_euler = (math.pi / 2, 0, 0)
        p.append(r2)
    p.append(_caixa(2.1, 0, 0.9, 1.6, 0.14, 0.14, "madeira", 0.02))        # varal
    return _guardar(_juntar(p))


def proto_lenha():
    p = []
    for j in range(4):
        for i in range(6):
            t = _cil(-0.9 + i * 0.36, 0, j * 0.34, 0.17, 2.2, "madeira", 8, 0)
            t.rotation_euler = (math.pi / 2, 0, 0)
            p.append(t)
    return _guardar(_juntar(p))


def proto_meda():
    """meda de feno: um cone, e é das poucas coisas redondas de uma aldeia —
    por isso destaca-se entre tanto telhado reto"""
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=1.9, radius2=0.15,
                                    depth=3.0, location=(0, 0, 1.5))
    corpo = _novo(bpy.context.object, "feno", 0.05)
    pau = _cil(0, 0, 2.9, 0.08, 0.9, "madeira", 6, 0)
    return _guardar(_juntar([corpo, pau]))


def proto_horta(c=6.0, l=4.0):
    """canteiros: leiras estreitas de verde escuro sobre terra lavrada"""
    p = [_caixa(0, 0, -0.04, c, l, 0.12, "lavrado", 0)]
    n = max(3, int(l / 0.9))
    for i in range(n):
        d = (i - (n - 1) / 2) * (l / n)
        p.append(_caixa(0, d, 0.04, c * 0.92, l / n * 0.55, 0.22, "horta", 0.03))
    return _guardar(_juntar(p))


def proto_ovelha():
    corpo = _cil(0, 0, 0.42, 0.34, 0.85, "la", 8, 0.08)
    corpo.rotation_euler = (0, math.pi / 2, 0)
    p = [corpo, _cil(0.52, 0, 0.5, 0.16, 0.3, "viga", 6, 0.04)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(_cil(sx * 0.28, sy * 0.18, 0, 0.055, 0.44, "viga", 4, 0))
    return _guardar(_juntar(p))


def proto_arvore_folha(alt=12.0, folha="folha2"):
    """árvore de folha: copa larga e redonda. Ao lado dos pinheiros altos e
    estreitos, é a diferença entre uma mata e uma plantação."""
    raio = alt * 0.30
    p = [_cil(0, 0, 0, alt * 0.05, alt * 0.5, "madeira", 6)]
    for dx, dy, z, k in ((0, 0, 0.62, 1.0), (0.35, 0.2, 0.5, 0.62),
                         (-0.3, -0.25, 0.55, 0.58), (0.1, -0.3, 0.78, 0.5)):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2, radius=raio * k,
            location=(dx * raio, dy * raio, alt * z))
        o = bpy.context.object
        o.scale = (1.0, 1.0, 0.82)
        _aplicar_escala()
        bpy.ops.object.shade_smooth()
        p.append(_novo(o, folha, 0))
    return _guardar(_juntar(p))


def proto_arbusto(raio=1.1, folha="folha3"):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=raio,
                                          location=(0, 0, raio * 0.55))
    o = bpy.context.object
    o.scale = (1.0, 0.88, 0.62)
    _aplicar_escala()
    bpy.ops.object.shade_smooth()
    return _guardar(_novo(o, folha, 0))


def enfileirar(proto, pts, passo, alt_fn, fechado=False):
    """põe cópias de `proto` ao longo de uma polilinha, viradas para a frente.

    Serve para cercas, muros e paliçadas: o que muda entre elas é só o protótipo.
    """
    postos = []
    pontos = list(pts) + ([pts[0]] if fechado else [])
    for i in range(len(pontos) - 1):
        ax, ay = pontos[i]
        bx, by = pontos[i + 1]
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(round(L / passo)))
        ang = math.atan2(by - ay, bx - ax)
        for k in range(n):
            t = (k + 0.5) / n
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            postos.append(onde(proto, x, y, alt_fn(x, y), ang))
    return postos


# ── A FORTIFICAÇÃO ───────────────────────────────────────────────────────────
# A aldeia da primeira versão tinha uma paliçada de estacas soltas e lia-se como
# uma cerca de gado. O que distingue uma MURALHA de uma cerca não é a altura: é
# ter ESPESSURA e ter gente em cima dela. Portanto três coisas, sempre:
#
#   1. um embasamento de pedra, que diz "isto foi construído para durar";
#   2. um adarve — o passadiço por dentro, onde os defensores andam — com o seu
#      parapeito e as escoras que o seguram;
#   3. torres MAIS ALTAS que o pano de muro, senão a silhueta é uma linha reta e
#      uma linha reta não se lê como castelo.
#
# E o fosso, que é do terreno e não daqui, mas é o que obriga a estrada a entrar
# por um sítio só.

def proto_muro(comp=4.2, alt=4.2):
    """um pano de muralha: pedra em baixo, troncos em pé, adarve por dentro"""
    p = [_caixa(0, 0, -0.5, comp, 2.3, 1.3, "alicerce")]                 # embasamento
    p.append(_caixa(0, -0.25, 0.8, comp, 0.8, alt - 0.8, "madeira"))     # o pano
    n = max(3, int(comp / 0.62))
    for i in range(n):                                                    # os troncos
        x = -comp / 2 + comp * (i + 0.5) / n
        p.append(_cil(x, -0.62, 0.8, 0.30, alt - 0.6, "madeira2", 8, 0.03))
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.30, radius2=0.0,
                                        depth=0.5, location=(x, -0.62, alt + 0.45))
        p.append(_novo(bpy.context.object, "madeira", 0))
    p.append(_caixa(0, 0.72, alt - 1.5, comp, 1.7, 0.24, "madeira2"))     # adarve
    p.append(_caixa(0, 1.48, alt - 1.26, comp, 0.22, 0.85, "madeira", 0.03))  # parapeito
    for s in (-1, 1):                                                     # escoras
        e = _caixa(s * comp * 0.32, 1.1, 0.0, 0.22, 0.22, 3.2, "madeira", 0.02)
        e.rotation_euler = (0.42, 0, 0)
        p.append(e)
    return _guardar(_encaixe(_juntar(p), comp))


def proto_torre_muro(alt=13.0):
    """torre de flanco.

    A PRIMEIRA VERSÃO TINHA UM TELHADO GRANDE E NÃO SE LIA COMO TORRE: o telhado
    tapava o andar saliente e as ameias, e o que sobrava era um silo com chapéu.
    Uma torre de guerra reconhece-se por DUAS coisas, e as duas têm de ficar à
    vista de cima — que é de onde este jogo se vê:
      * o andar saliente, mais largo do que o corpo (era de lá que se atirava
        sobre quem estava encostado ao muro);
      * as ameias abertas à volta da plataforma.
    O telhado passou a ser um pequeno guarda-sol sobre quatro postes, ao centro,
    que deixa a plataforma à vista e ainda quebra a silhueta.
    """
    p = [_caixa(0, 0, -1.2, 5.6, 5.6, 4.4, "alicerce")]                  # base de pedra
    p.append(_caixa(0, 0, 3.2, 4.0, 4.0, alt - 6.2, "madeira"))          # corpo
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(_caixa(sx * 1.85, sy * 1.85, 3.2, 0.38, 0.38, alt - 6.2,
                            "madeira2", 0.03))
    p.append(_caixa(0, 0, alt - 3.0, 6.0, 6.0, 0.9, "madeira2"))         # andar saliente
    for s2 in (-1, 1):                                                    # mísulas
        for t in (-1.6, 0.0, 1.6):
            e = _caixa(s2 * 2.1, t, alt - 4.2, 0.9, 0.28, 1.4, "madeira", 0.03)
            e.rotation_euler = (0, s2 * 0.6, 0)
            p.append(e)
            e2 = _caixa(t, s2 * 2.1, alt - 4.2, 0.28, 0.9, 1.4, "madeira", 0.03)
            e2.rotation_euler = (-s2 * 0.6, 0, 0)
            p.append(e2)
    p.append(_caixa(0, 0, alt - 2.1, 6.2, 6.2, 0.25, "madeira"))         # o soalho
    for i in range(4):                                                    # ameias abertas
        a = math.pi / 2 * i
        dx, dy = math.cos(a), math.sin(a)
        for k in (-2, -1, 0, 1, 2):
            px = dx * 2.95 - dy * k * 1.25
            py = dy * 2.95 + dx * k * 1.25
            p.append(_caixa(px, py, alt - 1.85, 0.9 if abs(dx) > 0.5 else 0.75,
                            0.75 if abs(dx) > 0.5 else 0.9, 1.15, "madeira2", 0.04))
    for sx in (-1, 1):                                                    # o guarda-sol
        for sy in (-1, 1):
            p.append(_cil(sx * 1.1, sy * 1.1, alt - 1.85, 0.13, 2.2, "madeira", 6))
    p.append(_telhado(0, 0, alt + 0.35, 3.2, 3.2, 1.5, "colmo2", 0.4))
    p.append(_cil(0, 0, alt + 1.7, 0.09, 3.2, "madeira", 6, 0.02))       # o mastro
    bandeira(p, 0.72, 0, alt + 2.4, 1.4, 1.7)
    for lado in (-1, 1):                                                  # seteiras
        p.append(_caixa(lado * 2.02, 0, 6.0, 0.14, 0.5, 1.3, "viga", 0.02))
        p.append(_caixa(0, lado * 2.02, 6.0, 0.5, 0.14, 1.3, "viga", 0.02))
    return _guardar(_encaixe(_juntar(p), 5.6))


def proto_casa_portao(alt=16.0, vao=5.2):
    """a casa do portão: duas torres de pedra e madeira e a passagem no meio.

    TEM DE SER A PEÇA MAIS ALTA DA PRAÇA. Na primeira versão era mais baixa e
    mais estreita que as torres de flanco, e lia-se como um anexo — quando é
    exatamente o contrário: numa praça-forte a casa do portão é a construção
    dominante, porque é o ponto por onde se entra e o que tem de ser defendido.

    A folha do portão NÃO faz parte desta peça — é `proto_folha_portao`, solta,
    porque um dia vai ter de rodar quando as tropas saírem.
    """
    p = []
    for lado in (-1, 1):
        x = lado * (vao / 2 + 2.9)
        p.append(_caixa(x, 0, -1.4, 5.6, 6.4, 6.0, "alicerce"))          # base de pedra
        p.append(_caixa(x, 0, 4.6, 4.4, 5.2, alt - 7.6, "madeira"))      # corpo
        for sy in (-1, 1):
            p.append(_caixa(x + lado * 2.05, sy * 2.45, 4.6, 0.40, 0.40,
                            alt - 7.6, "madeira2", 0.03))
        p.append(_caixa(x, 0, alt - 3.0, 6.2, 7.0, 1.0, "madeira2"))     # andar saliente
        p.append(_caixa(x, 0, alt - 2.0, 6.4, 7.2, 0.26, "madeira"))
        for i in range(4):                                                # ameias
            for sy in (-1, 1):
                p.append(_caixa(x - 2.1 + i * 1.4, sy * 3.3, alt - 1.74,
                                1.05, 0.8, 1.25, "madeira2", 0.05))
        p.append(_telhado(x, 0, alt + 0.05, 6.6, 7.4, 3.0, "colmo2", 0.55))
        p.append(_caixa(x, 0, 7.6, 0.18, 0.55, 1.5, "viga", 0.02))       # seteira
    # a passagem
    p.append(_caixa(0, 0, alt - 7.4, vao + 5.8, 4.6, 1.2, "madeira"))    # verga
    p.append(_caixa(0, 0, alt - 6.2, vao + 6.2, 5.2, 1.0, "madeira2"))   # balcão
    for i in range(4):
        p.append(_caixa(-vao / 2 - 1.1 + i * (vao + 2.2) / 3, 2.85, alt - 5.2,
                        1.05, 0.8, 1.15, "madeira2", 0.05))
    p.append(_cil(0, 0, alt - 5.2, 0.10, 4.6, "madeira", 6, 0.02))       # mastro
    bandeira(p, 0.80, 0, alt - 1.6, 1.55, 1.9)
    return _guardar(_encaixe(_juntar(p), 2 * (vao / 2 + 2.9) + 5.6))


def proto_folha_portao(vao=5.0, alt=4.6):
    """meia folha do portão. O ponto de rotação fica na ARESTA, não no centro,
    porque é aí que estão os gonzos — assim, no dia em que isto abrir, basta
    rodar o objeto em Z."""
    p = [_caixa(vao / 4, 0, 0, vao / 2, 0.3, alt, "madeira")]
    for i in range(3):
        p.append(_caixa(vao / 4, 0, alt * (0.2 + i * 0.3), vao / 2 + 0.1, 0.4,
                        0.22, "viga", 0.03))                              # ferragens
    for i in range(4):
        p.append(_caixa(vao / 8 + i * vao / 8, 0, 0, 0.12, 0.36, alt, "madeira2", 0.02))
    return _guardar(_juntar(p))


def proto_estandarte(alt=6.0, cor="pano_azul"):
    """mastro e pano. É a única mancha de cor forte da cena, e é ela que diz de
    quem é a praça — no jogo, a cor do Rei."""
    p = [_cil(0, 0, 0, 0.10, alt, "madeira", 6, 0.02)]
    pano = _caixa(0.75, 0, alt - 2.6, 1.5, 0.06, 2.2, cor, 0.01)
    p.append(pano)
    p.append(_caixa(0.4, 0, alt - 0.42, 0.9, 0.12, 0.12, "madeira2", 0.02))
    return _guardar(_juntar(p))


def proto_muro_pedra(comp=4.2, alt=2.6):
    """um troço de muro de pedra seca, para o recinto interior"""
    p = [_caixa(0, 0, -0.2, comp, 1.5, 0.5, "alicerce")]
    p.append(_caixa(0, 0, 0.3, comp, 1.1, alt - 0.3, "pedra"))
    for i in range(int(comp / 1.0)):                                      # remate
        p.append(_caixa(-comp / 2 + 0.5 + i * 1.0, 0, alt, 0.85, 1.25, 0.25,
                        "alicerce", 0.05))
    return _guardar(_juntar(p))


def proto_alvo():
    """poste de treino: um tronco e um escudo. Diz 'aqui treinam-se soldados'
    em duas peças."""
    p = [_cil(0, 0, 0, 0.22, 2.4, "madeira", 8),
         _caixa(0, 0.24, 1.2, 0.1, 0.12, 1.4, "madeira2", 0.03),
         _cil(0, 0.34, 1.35, 0.55, 0.14, "pano_azul", 12, 0.04)]
    p[2].rotation_euler = (math.pi / 2, 0, 0)
    return _guardar(_juntar(p))


def proto_lancas():
    """feixe de lanças encostadas: enche um canto e diz guarnição"""
    p = []
    for i in range(7):
        h = _cil(-0.5 + i * 0.17, 0, 0, 0.05, 3.0, "madeira", 4, 0)
        h.rotation_euler = (0.30 + 0.04 * i, 0, 0.2 * i)
        p.append(h)
        p.append(_cil(-0.5 + i * 0.17, -0.85, 2.7, 0.07, 0.45, "pedra", 4, 0))
    return _guardar(_juntar(p))


def proto_ponte(comp=14.0, larg=6.0):
    """tabuado sobre o fosso, com guardas dos dois lados"""
    p = [_caixa(0, 0, 0, comp, larg, 0.35, "madeira2")]
    n = int(comp / 1.1)
    for i in range(n):
        p.append(_caixa(-comp / 2 + comp * (i + 0.5) / n, 0, 0.35,
                        comp / n * 0.78, larg - 0.3, 0.14, "madeira", 0.03))
    for lado in (-1, 1):
        for i in range(4):
            x = -comp / 2 + comp * (i + 0.5) / 4
            p.append(_cil(x, lado * (larg / 2 - 0.2), 0.35, 0.14, 1.4, "madeira", 6))
        p.append(_caixa(0, lado * (larg / 2 - 0.2), 1.35, comp, 0.14, 0.16,
                        "madeira2", 0.03))
    for lado in (-1, 1):                                                  # esteios
        p.append(_cil(0, lado * (larg / 2 - 0.5), -3.2, 0.3, 3.6, "madeira", 8))
    return _guardar(_juntar(p))


PORTOES_CENA = []             # bocas colocadas, em metros: (x, y, z, rumo no mapa)


def angulo_de_tela(ang_cena, giro=math.pi / 4, inclina=math.pi / 3):
    """o inverso do `angulo_de_cena`: em que rumo do MAPA aponta este portão.

    Serve para o jogo saber qual das bocas serve cada estrada, sem ter de
    refazer a conta da projeção do lado do canvas.
    """
    f = ang_cena - giro
    return math.atan2(-math.sin(f) * math.cos(inclina), math.cos(f))


def angulo_de_cena(ang_tela, giro=math.pi / 4, inclina=math.pi / 3):
    """direção NO MAPA -> direção DENTRO da cena, para o portão dar para a estrada.

    ── POR QUE NÃO É SÓ SOMAR O GIRO DA CÂMARA ──────────────────────────────
    A peça é vista em isometria: a câmara está rodada 45° e inclinada 60°. Nessa
    projeção uma direção do chão NÃO aparece rodada — aparece rodada E ACHATADA,
    porque o eixo que foge da câmara encolhe por cos(inclinação). Duas estradas
    que saem a 90° uma da outra no mapa aparecem no sprite a ângulos diferentes
    de 90°.
    Então inverte-se a projeção: dado o ângulo que a estrada tem NO MAPA, qual o
    ângulo em que a peça tem de ser construída para, depois de projetada, sair
    exatamente naquele. É esta conta.

    `ang_tela` em coordenadas de ecrã (y para BAIXO), que é como o mapa do jogo
    e o canvas pensam.
    """
    c = math.cos(inclina)
    return giro + math.atan2(-math.sin(ang_tela) / max(c, 1e-6), math.cos(ang_tela))


def escolher_portoes(angulos, quantos):
    """dos rumos das estradas, quais merecem portão.

    Uma aldeia pode ter seis estradas e não pode ter seis portões: numa muralha
    de 20 m de raio seis portões são mais portão do que muro, e a praça deixa de
    se ler como fechada. Fica o primeiro (o portão principal) e depois os que
    estiverem MAIS LONGE dos já escolhidos — assim os postigos ficam espalhados
    em vez de encostados uns aos outros.
    """
    if not angulos:
        return []
    escolhidos = [angulos[0]]
    restantes = list(angulos[1:])
    while restantes and len(escolhidos) < quantos:
        def afastamento(a):
            return min(abs(((a - e + math.pi) % (2 * math.pi)) - math.pi)
                       for e in escolhidos)
        melhor = max(restantes, key=afastamento)
        if afastamento(melhor) < 0.55:        # encostado de mais: não vale a pena
            break
        escolhidos.append(melhor)
        restantes.remove(melhor)
    return escolhidos


def muralha(muro, torre, portoes, raio, ang_torres,
            z=lambda x, y: 0.0, abertura=0.0):
    """assenta a muralha, as torres e os portões à volta de um centro.

    `portoes` é uma lista de (ângulo, protótipo do portão, protótipo da folha,
    afastamento da folha ao eixo). Uma aldeia pode ter um portão ou três.

    ── TRÊS CORREÇÕES, TODAS DE MÉTODO ──────────────────────────────────────

    1. AS LARGURAS SÃO MEDIDAS, NÃO DECLARADAS — e o que se mede é o ENCAIXE que
       cada peça declara (`_encaixe`), não a caixa envolvente. A caixa envolvente
       do portão inclui a beira do telhado, que avança um metro além da base: o
       muro encostava ao telhado e ficava um metro de folga lá em baixo, tapada
       de cima e à vista de lado.

    2. OS PANOS PREENCHEM ARCOS, NÃO MARCHAM A PASSO FIXO. A versão que avançava
       de `2 x meio-pano` e saltava o que caísse num obstáculo abria buracos por
       três razões: depois de saltar uma torre a grelha desalinha-se dela; dois
       panos no mesmo vão eram saltados os dois; e as duas voltas encontravam-se
       no lado oposto em fase arbitrária. Aqui o muro é o que fica ENTRE
       obstáculos: para cada arco livre calcula-se quantos panos lá cabem,
       ARREDONDANDO PARA CIMA, e distribuem-se por igual. Arredondar para cima
       faz os panos sobreporem-se uns milímetros — que não se vê — em vez de
       deixarem folga — que se vê.

    3. A VERIFICAÇÃO OLHA PARA O QUE FOI COLOCADO. A primeira perguntava se cada
       ângulo estava num obstáculo ou num arco entre obstáculos, e por construção
       está sempre num dos dois: dava verde inclusive com buracos.
    """
    def meio_de(peca):
        larg = peca.get("encaixe", peca.dimensions.x)
        return math.asin(min(0.95, (larg / 2) / raio))

    m_muro, m_torre = meio_de(muro), meio_de(torre)
    obst = [(a % (2 * math.pi), meio_de(pt)) for a, pt, _f, _d in portoes]
    obst += [(t % (2 * math.pi), m_torre) for t in ang_torres]
    obst.sort()

    panos = 0
    cobertura = list(obst)                    # portões e torres já cobrem o seu
    for i, (a0, meio0) in enumerate(obst):
        a1, meio1 = obst[(i + 1) % len(obst)]
        inicio, fim = a0 + meio0, a1 - meio1
        arco = (fim - inicio) % (2 * math.pi)
        if arco < 1e-4:
            continue                          # duas peças encostadas
        n = max(1, math.ceil(arco / (2 * m_muro)))
        passo = arco / n
        for k in range(n):
            a = inicio + passo * (k + 0.5)
            x, y = raio * math.cos(a), raio * math.sin(a)
            onde(muro, x, y, z(x, y), a + math.pi / 2)
            cobertura.append((a % (2 * math.pi), m_muro))
            panos += 1

    for t in ang_torres:
        tx, ty = raio * math.cos(t), raio * math.sin(t)
        onde(torre, tx, ty, z(tx, ty), t + math.pi / 2)

    bocas = []
    for ang, pt, folha, desvio in portoes:
        gx, gy = raio * math.cos(ang), raio * math.sin(ang)
        zg = z(gx, gy)
        onde(pt, gx, gy, zg, ang + math.pi / 2)
        # A BOCA fica um pouco FORA da muralha, onde a estrada de facto encosta.
        # Guardada com o rumo que tem NO MAPA, para o jogo escolher qual das
        # bocas serve cada estrada sem refazer a conta da projeção.
        fora = raio + pt.dimensions.y * 0.5
        PORTOES_CENA.append((fora * math.cos(ang), fora * math.sin(ang), zg,
                             angulo_de_tela(ang)))
        eixo = ang + math.pi / 2
        for lado in (-1, 1):
            hx = gx + math.cos(eixo) * lado * desvio
            hy = gy + math.sin(eixo) * lado * desvio
            fecho = eixo if lado < 0 else eixo + math.pi
            onde(folha, hx, hy, zg, fecho - lado * abertura * 2.0)
        bocas.append((gx, gy, zg))

    passos = 3600
    coberto = [False] * passos
    for centro, meio in cobertura:
        i0 = int((centro - meio) / (2 * math.pi) * passos)
        i1 = int((centro + meio) / (2 * math.pi) * passos)
        for i in range(i0, i1 + 1):
            coberto[i % passos] = True
    buracos, aberto, maior, corrida = 0, False, 0, 0
    for i in range(passos * 2):               # duas voltas: apanha o buraco que
        c = coberto[i % passos]               # cai em cima do zero
        if not c:
            corrida += 1
            if not aberto:
                buracos += 1
            aberto = True
        else:
            maior = max(maior, corrida)
            corrida, aberto = 0, False
    if buracos:
        print("  AVISO: muralha com %d buraco(s); o maior tem %.1f m"
              % (buracos // 2, maior / passos * 2 * math.pi * raio))
    else:
        print("  muralha fechada: %d panos, %d portao(oes), %d torre(s)"
              % (panos, len(portoes), len(ang_torres)))
    return panos, bocas


# ── CADA PROTOTIPO PASSA A SABER O QUE E ─────────────────────────────────────
# Os nomes vinham do Blender: "Cube.005", "Cylinder.001". Servem enquanto tudo
# vive numa cena só — e deixam de servir no minuto em que se quer uma
# BIBLIOTECA de peças partilhada por vinte e duas aldeias. O nome é atribuído
# por ordem de criação, portanto o "Cube.005" de Toledo e o de Madrid podem ser
# peças diferentes, e nada avisa: a muralha de uma aldeia apareceria com as
# casas da outra.
#
# Aqui cada fábrica passa a carimbar o que produziu — o nome da função e os
# argumentos com que foi chamada. Duas consequências, e as duas fazem falta:
#   * o nome é ESTÁVEL: a mesma peça tem o mesmo nome em qualquer cena;
#   * a peça leva a sua RECEITA, portanto pode ser reconstruída sozinha, sem se
#     saber que aldeia a pediu.
#
# Feito por embrulho e não à mão em cada fábrica: são vinte e tal funções, e uma
# que se esquecesse voltaria a dar o bug silencioso que isto veio resolver.
def _carimbar_prototipos():
    import functools
    import hashlib
    for nome, fn in list(globals().items()):
        if not nome.startswith("proto_") or not callable(fn):
            continue

        def embrulho(fn=fn, nome=nome):
            @functools.wraps(fn)
            def dentro(*a, **k):
                ob = fn(*a, **k)
                if ob is not None and hasattr(ob, "name"):
                    partes = [repr(x) for x in a] + \
                             ["%s=%r" % (c, v) for c, v in sorted(k.items())]
                    assinatura = ",".join(partes)
                    # O NOME TEM DE SER UM IDENTIFICADOR. A primeira versao punha
                    # os argumentos no nome -- "casa2(7.6,5.8,2.9,'colmo')" -- que
                    # se le muito bem e NAO sobrevive a exportacao: o glTF saneia
                    # parenteses, virgulas, plicas e pontos, e do lado do
                    # navegador so 1 das 22 pecas voltou a ser encontrada.
                    # Fica o nome curto e estavel; a receita legivel vai a parte.
                    ob.name = nome[6:] + ("_" + hashlib.md5(
                        assinatura.encode("utf-8")).hexdigest()[:6] if partes else "")
                    ob["receita"] = json.dumps([nome, list(a), k])
                    ob["assinatura"] = nome[6:] + "(" + assinatura + ")"
                return ob
            return dentro
        globals()[nome] = embrulho()


_carimbar_prototipos()
