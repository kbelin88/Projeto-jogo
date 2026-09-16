# armar_lanceiro.py — pega numa figura sem ossos e devolve um soldado que marcha.
#
#   blender -b --factory-startup -noaudio -P ferramentas/cena/armar_lanceiro.py -- \
#       assets/Lanceiro.glb sonda3d/lanceiro_novo.glb 4000
#
# ── PORQUE UM ESQUELETO NOVO, E NAO O NOSSO ──────────────────────────────────
# O nosso soldado tem esqueleto e cinco animacoes, e era tentador colar esta
# malha neles. Mas os ossos do nosso foram feitos PARA O CORPO DELE: colar uma
# figura de outras proporcoes num esqueleto alheio e onde nascem os ombros
# tortos e as maos que atravessam a lanca. Aqui os ossos sao MEDIDOS nesta
# malha -- e as animacoes sao escritas por codigo, que e o que este projeto ja
# faz noutros sitios.
#
# ── E SO PRECISA DE UMA ANIMACAO ─────────────────────────────────────────────
# Medido no `mapa3d.js`: das animacoes de um soldado, o mapa so procura a que
# case com `idle_walk`. O resto era trabalho para ninguem ver.
#
# ── O QUE A MARCHA MEXE ──────────────────────────────────────────────────────
# Pernas, anca e um balanco no tronco. O braco da lanca NAO se mexe: ele foi
# modelado a segurar a haste, e qualquer rotacao ali descola a mao da lanca.
# A quarenta metros de camara, o que se le e a perna.
import math
import os
import sys

from collections import defaultdict

import bpy
import mathutils

ARGS = [a for a in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])]
ENTRADA = ARGS[0] if ARGS else "assets/Lanceiro.glb"
SAIDA = ARGS[1] if len(ARGS) > 1 else "sonda3d/lanceiro_novo.glb"
TRIANGULOS = int(ARGS[2]) if len(ARGS) > 2 else 4000
ALTURA_M = 2.0          # a altura do corpo no jogo, como o soldado antigo
FPS = 24
CICLO = 24              # quadros: um passo completo por segundo

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(), ENTRADA))
malhas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not malhas:
    raise SystemExit("o ficheiro nao traz malha nenhuma")

# ── UMA MALHA SO ─────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for o in malhas:
    o.select_set(True)
bpy.context.view_layer.objects.active = malhas[0]
if len(malhas) > 1:
    bpy.ops.object.join()
corpo = bpy.context.view_layer.objects.active
corpo.name = "soldado"

# ── A COR DE VERTICE ENTRA NO MATERIAL ──────────────────────────────────────
# Sem isto o exportador nao escreve a COLOR_0 e o soldado chega branco ao jogo
# (a mesma armadilha da relva: o que nao esta no material nao atravessa a porta)
for mat in (corpo.data.materials or []):
    if mat and mat.use_nodes and corpo.data.color_attributes:
        nt = mat.node_tree
        b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b and not b.inputs["Base Color"].is_linked:
            ca = nt.nodes.new("ShaderNodeVertexColor")
            ca.layer_name = corpo.data.color_attributes[0].name
            nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])
            b.inputs["Metallic"].default_value = 0.0
            b.inputs["Roughness"].default_value = 0.85

# ── A LANCA MARCA-SE ANTES DE REDUZIR ───────────────────────────────────────
# Aqui a malha ainda esta inteira (101 mil vertices) e a HASTE e uma ILHA sua,
# solta do corpo: 2529 vertices, de 0,07 a 0,77 da altura, com 0,12 de largura.
# Depois do `Decimate` isso desaparece -- o redutor parte a haste em pedacos e
# as 76 ilhas viram lixo. Tres tentativas de a achar DEPOIS de reduzir falharam
# (eixo vertical, direcao principal, votacao de retas), e a ultima deixou o
# fundo da haste solto: foi parar a bota, e o bico da lanca andava colado ao pe.
#
# COMO SE ESCOLHE A ILHA: a haste e a unica coisa COMPRIDA E FINA. Mede-se, de
# cada ilha, o vao em altura a dividir pela largura -- a haste da 6,1; as pernas
# dao 2,7 e o corpo 2,1. Nao ha empate possivel.
#
# A marca vai num GRUPO DE VERTICES, porque um grupo SOBREVIVE ao `Decimate`
# (o redutor interpola os pesos ao juntar vertices). Depois de reduzir, le-se o
# grupo de volta -- e o que era exato na malha inteira continua exato na pequena.
_ilhas = {}
_pai = list(range(len(corpo.data.vertices)))


def _acha(a):
    r = a
    while _pai[r] != r:
        r = _pai[r]
    while _pai[a] != r:
        _pai[a], a = r, _pai[a]
    return r


for _e in corpo.data.edges:
    _a, _b = _acha(_e.vertices[0]), _acha(_e.vertices[1])
    if _a != _b:
        _pai[_a] = _b
for _i in range(len(corpo.data.vertices)):
    _ilhas.setdefault(_acha(_i), []).append(_i)

_co = [v.co.copy() for v in corpo.data.vertices]
_zb = min(q.z for q in _co)
_hb = max(q.z for q in _co) - _zb
_eleita, _nota = None, 0.0
for _vv in _ilhas.values():
    if len(_vv) < 200:
        continue
    _zs = [_co[i].z for i in _vv]
    _xs = [_co[i].x for i in _vv]
    _ys = [_co[i].y for i in _vv]
    _vao = (max(_zs) - min(_zs)) / _hb
    _larg = max(max(_xs) - min(_xs), max(_ys) - min(_ys)) / _hb
    if _vao < 0.40 or _larg > 0.25:
        continue
    if _vao / _larg > _nota:
        _eleita, _nota = _vv, _vao / _larg
# ── NEM TODA A FIGURA TEM UMA HASTE ─────────────────────────────────────────
# O arqueiro nao tem: o arco e CURVO e esta soldado a malha do corpo, entao a
# maior razao vao/largura e 1,8 -- o proprio corpo. Antes isto era um erro
# fatal, e estava certo enquanto so havia o lanceiro. Agora segue-se sem arma
# marcada, e sao as PROVAS que dizem se alguma coisa parte: melhor medir o que
# acontece do que adivinhar uma regra para uma arma que ainda nao se viu.
TEM_HASTE = _eleita is not None
if not TEM_HASTE:
    print("SONDA lanca: NENHUMA ilha comprida e fina (maior razao %.1f). "
          "A figura segue sem arma marcada -- ver a prova dos pesos." % _nota)

# ⚠ HA DUAS HASTES, E A QUE SE VE NAO E A ILHA. O ComfyUI gerou a lanca duas
# vezes: uma vara SOLTA por dentro (a ilha eleita, raio 0,008 da altura) e a que
# se ve por fora, SOLDADA ao corpo na ilha grande. Marcar so a ilha deixou a de
# fora presa a perna -- na bancada viam-se duas madeiras no chao, uma certa e
# uma a seguir o pe direito. Um render das ilhas por cor mostrou isto num olhar:
# TODA a superficie visivel era da mesma ilha.
#
# A ilha serve na mesma, mas para outra coisa: da o EIXO exato da haste, sem
# palpite nenhum. Com esse eixo mede-se o resto da malha, e a separacao e limpa
# em toda a altura -- a madeira a 0,010-0,014 do eixo, o corpo e a bota a
# 0,04-0,11. O corte a 0,020 apanha as duas hastes e nenhuma bota.
#
# ⚠ NAO PODE HAVER CORTE EM ALTURA. Uma primeira versao so apanhava acima do
# fundo da vara interna, a pensar que mais abaixo so havia bota -- e a PONTEIRA
# (o ultimo palmo, o que pousa ao pe da bota) ficou de fora, branca na prova da
# marca. Era exatamente esse pedaco que andava agarrado ao pe.
_marca = set()
if TEM_HASTE:
    _cen = mathutils.Vector((0, 0, 0))
    for _i in _eleita:
        _cen += _co[_i]
    _cen /= len(_eleita)
    _M = [[0.0] * 3 for _ in range(3)]
    for _i in _eleita:
        _u = _co[_i] - _cen
        for _a in range(3):
            for _b in range(3):
                _M[_a][_b] += _u[_a] * _u[_b]
    _eixo = mathutils.Vector((0, 0, 1))
    for _ in range(80):
        _t = mathutils.Vector([sum(_M[_a][_b] * _eixo[_b] for _b in range(3))
                               for _a in range(3)])
        if _t.length < 1e-12:
            break
        _t.normalize()
        _eixo = _t
    if _eixo.z < 0:
        _eixo = -_eixo

    RAIO_LANCA = _hb * 0.020
    _marca = set(_eleita)
    for _i, _q in enumerate(_co):
        _u = _q - _cen
        if (_u - _eixo * _u.dot(_eixo)).length < RAIO_LANCA:
            _marca.add(_i)

    # ⚠ O CILINDRO TAMBEM APANHA A BIQUEIRA DA BOTA, que o eixo atravessa rente
    # ao chao. E o erro ao contrario do anterior: em vez de madeira presa ao pe,
    # fica um pedaco de PE preso a mao -- e a bota estica e borra a cada passo.
    # A madeira distingue-se por ser CONTINUA: dentro da marca, a haste e um
    # pedaco unico que atravessa o modelo de alto a baixo, e a biqueira e uma
    # mancha curta e solta. Entao parte-se a marca em pedacos ligados e ficam so
    # os compridos.
    _viz = defaultdict(set)
    for _e in corpo.data.edges:
        _a, _b = _e.vertices
        if _a in _marca and _b in _marca:
            _viz[_a].add(_b)
            _viz[_b].add(_a)
    _qual, _n = {}, 0
    for _s in _marca:
        if _s in _qual:
            continue
        _n += 1
        _fila = [_s]
        _qual[_s] = _n
        while _fila:
            _a = _fila.pop()
            for _b in _viz[_a]:
                if _b not in _qual:
                    _qual[_b] = _n
                    _fila.append(_b)
    _pedacos = defaultdict(list)
    for _i, _k in _qual.items():
        _pedacos[_k].append(_i)
    _fora = 0
    for _vv in _pedacos.values():
        _zz = [_co[_i].z for _i in _vv]
        if (max(_zz) - min(_zz)) < _hb * 0.08:
            _marca.difference_update(_vv)
            _fora += len(_vv)
    print("SONDA lanca: %d pedacos ligados, %d vertices curtos fora (bota)"
          % (len(_pedacos), _fora))

# ── A ARMA MARCADA A MAO VENCE QUALQUER REGRA ───────────────────────────────
# Ha armas que nenhuma regra geometrica apanha. O arco do arqueiro e CURVO, esta
# colado a mao, e a corda saiu do ComfyUI em dois fios soltos em V, longe das
# pontas do arco -- uma "corda entre as pontas" apanhou o pulso em vez dela. Em
# vez de mais palpites, o Lucas marcou a arma no Blender (laco em raio-X, ligado
# pelo MCP) e a selecao ficou num ficheiro:
#     ferramentas/cena/marcas/<figura>_<peca>.json
# com os indices dos vertices da malha ORIGINAL, antes de reduzir. Havendo marca
# para esta figura, e ela que manda. So vale se o numero de vertices bater: um
# GLB regerado no ComfyUI tem outros indices, e a marca velha apanharia lixo.
_nome_fig = os.path.splitext(os.path.basename(ENTRADA))[0].lower()
_pasta_marcas = os.path.join(os.getcwd(), "ferramentas", "cena", "marcas")
_mao_marca = set()
_manga_marca = set()
_apagar_marca = set()
if os.path.isdir(_pasta_marcas):
    import json as _json
    for _f in sorted(os.listdir(_pasta_marcas)):
        if not (_f.lower().startswith(_nome_fig + "_") and _f.endswith(".json")):
            continue
        _d = _json.load(open(os.path.join(_pasta_marcas, _f), encoding="utf-8"))
        # a pasta tem marcas de outras coisas (ex.: <figura>_ossos.json, juntas
        # do esqueleto); arma e so o que traz indices de vertices
        if "indices_apagar" in _d:
            if _d.get("vertices_total") != len(corpo.data.vertices):
                raise SystemExit("SONDA ERRO: a marca %s e de outra malha -- marque de novo" % _f)
            _apagar_marca |= set(_d["indices_apagar"])
            print("SONDA marca a mao: %s (%d vertices a apagar)" % (_f, len(_d["indices_apagar"])))
            continue
        if "indices_manga" in _d:
            if _d.get("vertices_total") != len(corpo.data.vertices):
                raise SystemExit("SONDA ERRO: a marca %s e de outra malha -- marque de novo" % _f)
            _manga_marca |= set(_d["indices_manga"])
            print("SONDA marca a mao: %s (%d vertices de manga)" % (_f, len(_d["indices_manga"])))
            continue
        if "indices_mao" in _d:
            if _d.get("vertices_total") != len(corpo.data.vertices):
                raise SystemExit("SONDA ERRO: a marca %s e de outra malha -- marque de novo" % _f)
            _mao_marca |= set(_d["indices_mao"])
            print("SONDA marca a mao: %s (%d vertices de mao)" % (_f, len(_d["indices_mao"])))
            continue
        if "indices" not in _d:
            continue
        if _d.get("vertices_total") != len(corpo.data.vertices):
            raise SystemExit("SONDA ERRO: a marca %s foi feita numa malha de %s "
                             "vertices e esta tem %d -- o GLB mudou, marque de novo"
                             % (_f, _d.get("vertices_total"), len(corpo.data.vertices)))
        _marca |= set(_d["indices"])
        _d_arma = _d
        if not TEM_HASTE:
            _eleita, _nota = [], 0.0
        TEM_HASTE = True
        print("SONDA marca a mao: %s (%d vertices)" % (_f, len(_d["indices"])))

# ── A MAO QUE PENDE JUNTO AO CASACO ─────────────────────────────────────────
# A mao esquerda do arqueiro pende encostada a coxa e a barra do casaco. Com a
# regra "dois ossos mais proximos" ela ficou METADE braco, METADE coxa (os 83
# vertices para la do pulso tinham todos a coxa, peso medio 0,46), e o casaco ao
# lado ia com o antebraco: ao girar o braco, mao e casaco esticavam juntos e o
# Lucas via "a ponta dos dedos presa ao casaco". Nao era cola -- nessa zona ja
# eram sete pedacos soltos -- era PESO. Pintar o casaco de azul no Weight Paint
# nao chegou, porque a coxa continuava dentro da mao.
# O Lucas pintou a mao (Vertex Paint), e ela fica num grupo que atravessa a
# reducao como a arma: 100% antebraco, nada de coxa.
if _mao_marca:
    corpo.vertex_groups.new(name="MAO").add(sorted(_mao_marca), 1.0, "REPLACE")
# as mangas nao precisam de sair para um objeto seu: sao uma zona larga, e a media
# que o `Decimate` faz aos pesos so borra a borda -- lida depois com corte em 0,5
if _manga_marca:
    corpo.vertex_groups.new(name="MANGA").add(sorted(_manga_marca), 1.0, "REPLACE")

# ── O QUE O LUCAS MANDOU APAGAR ─────────────────────────────────────────────
# Na mao esquerda do arqueiro, a ponta de um dedo esta FUNDIDA a borda do casaco:
# a mesma malha. Nenhum peso separa isso -- ao girar o braco, o ponto de fusao ia
# com o dedo e puxava uma aba inteira do casaco (viu-se na captura do viewport,
# com o braco aberto: um triangulo do casaco da anca ate aos dedos). Ele pintou o
# ponto exato (33 vertices) e aqui ele desaparece.
# Apaga-se DEPOIS de as outras marcas estarem em grupos: apagar vertices muda a
# numeracao de todos, e so os grupos atravessam isso intactos. A marca da arma,
# que ainda e uma lista de indices, vai num grupo temporario e volta dele.
if _apagar_marca:
    import bmesh
    _gt = corpo.vertex_groups.new(name="MARCA_TMP_AP")
    if _marca:
        _gt.add(sorted(_marca), 1.0, "REPLACE")
    _bm = bmesh.new()
    _bm.from_mesh(corpo.data)
    _bm.verts.ensure_lookup_table()
    bmesh.ops.delete(_bm, geom=[v for v in _bm.verts if v.index in _apagar_marca],
                     context="VERTS")
    _bm.to_mesh(corpo.data)
    _bm.free()
    _marca = {v.index for v in corpo.data.vertices
              if any(g.group == _gt.index and g.weight > 0.5 for g in v.groups)}
    corpo.vertex_groups.remove(_gt)
    print("SONDA apagado: %d vertices" % len(_apagar_marca))

# ── O ARCO: MAIOR, E COM UMA CORDA QUE LIGA AS PONTAS ───────────────────────
# O Lucas viu duas coisas na bancada: o arco era CURTO (1,15 m de ponta a ponta
# num homem de 2 m -- de longe nao se le) e a corda NAO LIGAVA as pontas. Medido:
# dentro da marca ha um pedaco grosso (o arco, 5 cm) e quatro fiapos com menos de
# 1 cm (a corda que o ComfyUI deixou solta). Entao:
#   1. os fiapos APAGAM-SE;
#   2. os bracos do arco ESTICAM-SE a partir da pega: cada ponto afasta-se da mao
#      ao longo do raio que ja tinha, e o que esta junto a mao nao se mexe (a mao
#      fica do tamanho que era);
#   3. depois de reduzir, poe-se uma corda NOVA, reta, de ponta a ponta.
# Vale so para quem tem "arco" na marca -- o lanceiro nao passa por aqui.
ARCO_CFG = None
# ⚠ Le-se da marca da ARMA (`_d_arma`), e nao da ultima marca aberta: quando
# apareceu a marca das juntas dos bracos, era ela a ultima, e o arco deixou de
# ser esticado sem um erro -- so a linha "SONDA arco" desapareceu do registo.
if TEM_HASTE and "_d_arma" in dir():
    ARCO_CFG = _d_arma.get("arco")
_eixo_arco = None
if ARCO_CFG:
    import bmesh
    _co = [v.co.copy() for v in corpo.data.vertices]
    _vz = defaultdict(set)
    for _e in corpo.data.edges:
        _a, _b = _e.vertices
        _vz[_a].add(_b)
        _vz[_b].add(_a)
    _comp, _n = {}, 0
    for _s in _marca:
        if _s in _comp:
            continue
        _n += 1
        _fila = [_s]
        _comp[_s] = _n
        while _fila:
            _a = _fila.pop()
            for _b in _vz[_a]:
                if _b in _marca and _b not in _comp:
                    _comp[_b] = _n
                    _fila.append(_b)
    _pd = defaultdict(list)
    for _i, _k in _comp.items():
        _pd[_k].append(_i)

    def _eixo_de(ids):
        c = sum((_co[i] for i in ids), mathutils.Vector()) / len(ids)
        M = [[0.0] * 3 for _ in range(3)]
        for i in ids:
            u = _co[i] - c
            for a in range(3):
                for b in range(3):
                    M[a][b] += u[a] * u[b]
        e = mathutils.Vector((0.3, 0.3, 0.9))
        for _ in range(60):
            t = mathutils.Vector([sum(M[a][b] * e[b] for b in range(3)) for a in range(3)])
            if t.length < 1e-12:
                break
            t.normalize()
            e = t
        esp = max(((_co[i] - c) - e * (_co[i] - c).dot(e)).length for i in ids)
        return c, e, esp

    _corpo_arco = max(_pd.values(), key=len)
    _fios = []
    for _vv in _pd.values():
        if _vv is not _corpo_arco and _eixo_de(_vv)[2] < _hb * 0.015:
            _fios += _vv
    _c, _e, _ = _eixo_de(_corpo_arco)
    _eixo_arco = _e
    # a pega: onde o arco toca no que NAO esta marcado (a mao, a luva)
    _borda = [i for i in _corpo_arco if any(j not in _marca for j in _vz[i])]
    _pega = (sum((_co[i] for i in _borda), mathutils.Vector()) / len(_borda)
             if _borda else _c)
    _proj = {i: (_co[i] - _pega).dot(_e) for i in _corpo_arco}
    _R = _hb * 0.06
    _alvo = ARCO_CFG.get("comprimento", 0.85) * _hb
    # ⚠ CADA BRACO ESTICA POR SI. No modelo do ComfyUI os bracos do arco ja
    # nasceram desiguais: o de cima com 40 cm, o de baixo com 75 (medido da pega a
    # ponta). Esticados pela mesma razao, continuavam desiguais, e o Lucas viu a
    # corda mal encaixada na ponta curta. Agora cada um vai a METADE do alvo.
    _cima = max(_proj.values())
    _baixo = -min(_proj.values())
    # ⚠ (16/09) Esticar cada braco POR SI deformou a ponta curta num bloco largo
    # -- 2,6 vezes estica tambem a largura da ponta. Voltou-se a razao unica; o
    # braco curto ficou resolvido a mao pelo Lucas (ver "A ARMA QUE O LUCAS
    # DESENHOU A MAO", mais abaixo).
    _Fc = _Fb = max(1.0, (_alvo - 2 * _R) / max(_cima + _baixo - 2 * _R, 1e-6))
    for _i in _corpo_arco:
        _u = _co[_i] - _pega
        _dd = _u.length
        if _dd > _R:
            _F = _Fc if _proj[_i] > 0 else _Fb
            corpo.data.vertices[_i].co = _pega + _u * ((_R + (_dd - _R) * _F) / _dd)
    _vao = _cima + _baixo
    # os fiapos saem; o grupo guarda a marca atraves da mudanca de indices
    _gtmp = corpo.vertex_groups.new(name="MARCA_TMP")
    _gtmp.add(sorted(_marca - set(_fios)), 1.0, "REPLACE")
    _bm = bmesh.new()
    _bm.from_mesh(corpo.data)
    _bm.verts.ensure_lookup_table()
    _fs = set(_fios)
    bmesh.ops.delete(_bm, geom=[v for v in _bm.verts if v.index in _fs], context="VERTS")
    _bm.to_mesh(corpo.data)
    _bm.free()
    _marca = {v.index for v in corpo.data.vertices
              if any(g.group == _gtmp.index and g.weight > 0.5 for g in v.groups)}
    corpo.vertex_groups.remove(_gtmp)
    print("SONDA arco: %d vertices de fios soltos apagados; bracos de %.2f e %.2f "
          "da altura -> os dois a %.2f (x%.2f e x%.2f)"
          % (len(_fios), _cima / _hb, _baixo / _hb, _alvo / 2 / _hb, _Fc, _Fb))

# ⚠ UM GRUPO DE VERTICES NAO ATRAVESSA O `Decimate` INTEIRO. O redutor junta
# vertices e faz a MEDIA dos pesos: dos 7883 marcados sobravam 25 acima de 0,5,
# e a haste voltava a ficar solta. Por isso a arma sai da malha para um objeto
# SEU, cada um reduz-se por si, e depois juntam-se outra vez -- a juncao guarda
# os grupos tal e qual, e a marca fica exata (peso 1,0) na malha pequena.
if TEM_HASTE:
    _gl = corpo.vertex_groups.new(name="LANCA")
    _gl.add(sorted(_marca), 1.0, "REPLACE")
    print("SONDA lanca: vara solta %d vertices (comprida/fina = %.1f) + haste "
          "visivel %d = %d no total"
          % (len(_eleita), _nota, len(_marca) - len(_eleita), len(_marca)))
    bpy.ops.object.select_all(action="DESELECT")
    corpo.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for _i in _marca:
        corpo.data.vertices[_i].select = True
    if "MAO" in corpo.vertex_groups:
        _im = corpo.vertex_groups["MAO"].index
        for v in corpo.data.vertices:
            if any(g.group == _im and g.weight > 0.5 for g in v.groups):
                v.select = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    lanca = [o for o in bpy.context.selected_objects if o is not corpo][0]
    lanca.name = "lanca"
    pecas = (corpo, lanca)
else:
    pecas = (corpo,)

antes = 0
for _ob in pecas:
    _ob.data.calc_loop_triangles()
    antes += len(_ob.data.loop_triangles)
if TRIANGULOS and antes > TRIANGULOS:
    # a mesma razao em todas, para a haste nao ficar grossa ao pe de um corpo fino
    for _ob in pecas:
        md = _ob.modifiers.new("reduzir", "DECIMATE")
        md.ratio = TRIANGULOS / antes
        bpy.context.view_layer.objects.active = _ob
        bpy.ops.object.modifier_apply(modifier=md.name)
if TEM_HASTE:
    bpy.ops.object.select_all(action="DESELECT")
    corpo.select_set(True)
    lanca.select_set(True)
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.join()
corpo.data.calc_loop_triangles()
print("SONDA malha: %d -> %d triangulos" % (antes, len(corpo.data.loop_triangles)))

# ── A CORDA NOVA ────────────────────────────────────────────────────────────
# So DEPOIS de reduzir: um tubo fino de seis lados, reduzido junto com o resto,
# desfazia-se numa linha. As pontas saem dos proprios vertices do arco (ja
# reduzido), nos extremos do eixo; e a corda entra no grupo da arma, para andar
# com a mao como o arco.
if ARCO_CFG and ARCO_CFG.get("refazer_corda") and _eixo_arco is not None:
    import bmesh
    _ig = corpo.vertex_groups["LANCA"].index
    _ids = [v.index for v in corpo.data.vertices
            if any(g.group == _ig and g.weight > 0.5 for g in v.groups)]
    _pr = {i: corpo.data.vertices[i].co.dot(_eixo_arco) for i in _ids}
    _mx, _mn = max(_pr.values()), min(_pr.values())
    _tol = _hb * 0.02
    _topo = [corpo.data.vertices[i].co for i in _ids if _pr[i] > _mx - _tol]
    _base = [corpo.data.vertices[i].co for i in _ids if _pr[i] < _mn + _tol]
    _A = sum(_topo, mathutils.Vector()) / len(_topo)
    _B = sum(_base, mathutils.Vector()) / len(_base)
    _eixo_c = (_B - _A).normalized()
    _p1 = _eixo_c.orthogonal().normalized()
    _p2 = _eixo_c.cross(_p1).normalized()
    _raio = _hb * 0.004
    _bm = bmesh.new()
    _bm.from_mesh(corpo.data)
    _dl = _bm.verts.layers.deform.verify()
    _novos = []
    _aneis = []
    for _ponto in (_A, _B):
        _anel = []
        for _k in range(6):
            _ang = _k / 6 * 2 * math.pi
            _v = _bm.verts.new(_ponto + (_p1 * math.cos(_ang) + _p2 * math.sin(_ang)) * _raio)
            _v[_dl][_ig] = 1.0
            _anel.append(_v)
            _novos.append(_v)
        _aneis.append(_anel)
    _faces = []
    for _k in range(6):
        _a0, _a1 = _aneis[0][_k], _aneis[0][(_k + 1) % 6]
        _b0, _b1 = _aneis[1][_k], _aneis[1][(_k + 1) % 6]
        _faces.append(_bm.faces.new((_a0, _a1, _b1, _b0)))
    # a cor: pinta-se a corda de linho no atributo de cor que o modelo usa
    _cor = (0.82, 0.78, 0.66, 1.0)
    _ca = corpo.data.color_attributes[0] if corpo.data.color_attributes else None
    if _ca is not None:
        if _ca.domain == "POINT":
            _lay = (_bm.verts.layers.float_color.get(_ca.name)
                    or _bm.verts.layers.color.get(_ca.name))
            if _lay is not None:
                for _v in _novos:
                    _v[_lay] = _cor
        else:
            _lay = (_bm.loops.layers.float_color.get(_ca.name)
                    or _bm.loops.layers.color.get(_ca.name))
            if _lay is not None:
                for _f in _faces:
                    for _l in _f.loops:
                        _l[_lay] = _cor
    _bm.to_mesh(corpo.data)
    _bm.free()
    corpo.data.calc_loop_triangles()
    print("SONDA corda nova: de ponta a ponta, %.2f da altura" % ((_B - _A).length / _hb))

# ── MEIA-VOLTA: O NOSSO MAPA OLHA PARA +Y ───────────────────────────────────
# Medido nas quatro vistas: esta figura olha para -Y.
# ⚠ RODA-SE A MALHA, NAO O OBJETO. O importador do glTF prende a malha a um no
# proprio; uma rotacao posta no objeto e assentada com `transform_apply` nao
# chegou a geometria -- o soldado saiu virado como veio e marchou de costas no
# mapa, e nas quatro vistas do ficheiro exportado via-se o erro.
corpo.data.transform(mathutils.Matrix.Rotation(math.pi, 4, "Z"))

# ── A LANCA, LIDA DE VOLTA ──────────────────────────────────────────────────
# Tem de ser ANTES de medir a altura e as pernas: a haste passa por cima da
# cabeca e ao lado do corpo, e em qualquer das duas contas mente.
lanca_idx = set()
if TEM_HASTE:
    _ig = corpo.vertex_groups["LANCA"].index
    for v in corpo.data.vertices:
        for g in v.groups:
            if g.group == _ig and g.weight > 0.5:
                lanca_idx.add(v.index)
    if len(lanca_idx) < 40:
        raise SystemExit("SONDA ERRO: a marca da lanca nao sobreviveu ao "
                         "Decimate (%d vertices)" % len(lanca_idx))
    _zs = [corpo.data.vertices[i].co.z for i in lanca_idx]
    print("SONDA lanca: %d vertices depois de reduzir, de z=%.2f a z=%.2f"
          % (len(lanca_idx), min(_zs), max(_zs)))
    corpo.vertex_groups.remove(corpo.vertex_groups["LANCA"])
mao_idx = set()
if "MAO" in corpo.vertex_groups:
    _im = corpo.vertex_groups["MAO"].index
    mao_idx = {v.index for v in corpo.data.vertices
               if any(g.group == _im and g.weight > 0.5 for g in v.groups)}
    corpo.vertex_groups.remove(corpo.vertex_groups["MAO"])
    print("SONDA mao: %d vertices depois de reduzir" % len(mao_idx))
manga_idx = set()
LADOS_PINTADOS = set()
if "MANGA" in corpo.vertex_groups:
    _ig2 = corpo.vertex_groups["MANGA"].index
    manga_idx = {v.index for v in corpo.data.vertices
                 if any(g.group == _ig2 and g.weight > 0.5 for g in v.groups)}
    corpo.vertex_groups.remove(corpo.vertex_groups["MANGA"])
    LADOS_PINTADOS = {("L" if corpo.data.vertices[i].co.x > 0 else "R") for i in manga_idx}
    print("SONDA mangas: %d vertices depois de reduzir, lados pintados: %s"
          % (len(manga_idx), ", ".join(sorted(LADOS_PINTADOS))))

# ── A ALTURA DO CORPO, SEM A LANCA ──────────────────────────────────────────
# A caixa da malha vai ate a PONTA DA LANCA, que passa a cabeca; escalar por
# ela deixava o homem baixo. Antes contavam-se vertices por fatia de altura e
# procurava-se onde a contagem cai -- um palpite que se enganou assim que a
# haste passou a ser reduzida a parte e ficou com pontos mais espalhados: o
# corte subiu, e o soldado saiu 15% mais pequeno sem ninguem dar por isso.
# Agora nao ha palpite nenhum: sabemos EXATAMENTE quais vertices sao a lanca,
# entao o alto da cabeca e simplesmente o vertice mais alto que nao e dela.
zs = [v.co.z for v in corpo.data.vertices]
z0 = min(zs)
z_cabeca = max(v.co.z for v in corpo.data.vertices if v.index not in lanca_idx)
k = ALTURA_M / (z_cabeca - z0)
# ── E O CORPO TEM DE FICAR NO MEIO ──────────────────────────────────────────
# O esqueleto e construido simetrico a volta de x=0, mas a malha do ComfyUI nao
# vem centrada. Duas tentativas antes desta falharam, e pela mesma razao: davam
# por adquirido um centro. "x < 0" separava mal (uma perna inteira e metade da
# outra do mesmo lado) e a mediana a altura da anca puxava para a tunica -- as
# pernas saiam a 0,110 de um lado e 0,193 do outro, e nenhuma afinacao arranjava
# isso porque o erro era o eixo, nao o valor.
#
# Aqui nao se supoe nada. Numa fatia a altura do joelho, os x dos vertices fazem
# DOIS MONTES com um vazio no meio (o vao entre as pernas). Procura-se o maior
# vazio, corta-se ali, e cada monte da uma perna: o meio de cada um e o eixo
# dessa perna, o meio dos dois e o centro do corpo, e metade da distancia entre
# eles e o afastamento -- medido, e nao herdado de uma constante.
def _pernas_cruas(altura_rel, espessura=0.05, base=None):
    _hc = z_cabeca - z0
    _z = (z0 if base is None else base) + _hc * altura_rel
    _xs = sorted(v.co.x for v in corpo.data.vertices
                 if v.index not in lanca_idx and abs(v.co.z - _z) < _hc * espessura)
    if len(_xs) < 20:
        return None
    # o corte so pode cair no miolo: nas pontas ha sempre buracos de amostragem
    _i0, _i1 = int(len(_xs) * 0.20), int(len(_xs) * 0.80)
    _melhor, _onde = 0.0, None
    for _i in range(_i0, _i1):
        _g = _xs[_i + 1] - _xs[_i]
        if _g > _melhor:
            _melhor, _onde = _g, _i
    if _onde is None or _melhor < _hc * 0.01:
        return None
    _e, _d = _xs[:_onde + 1], _xs[_onde + 1:]
    return ((_e[0] + _e[-1]) / 2, (_d[0] + _d[-1]) / 2, _melhor)


def _pernas_cruas_centrada(a):
    return _pernas_cruas(a, base=0.0)


_pj = _pernas_cruas(0.30) or _pernas_cruas(0.24) or _pernas_cruas(0.36)
if _pj is None:
    raise SystemExit("SONDA ERRO: nao achei o vao entre as pernas")
_ce, _cd, _vao_pernas = _pj
cx = (_ce + _cd) / 2
_my = sorted(v.co.y for v in corpo.data.vertices if v.index not in lanca_idx
             and abs(v.co.z - (z0 + (z_cabeca - z0) * 0.50)) < (z_cabeca - z0) * 0.06)
cy = _my[len(_my) // 2] if _my else 0.0
_antes_pernas = ((_cd - _ce) / 2) / (z_cabeca - z0)
print("SONDA centro do corpo: x=%+.3f y=%+.3f | pernas em %+.3f e %+.3f, "
      "vao de %.3f -> afastamento %.3f da altura"
      % (cx, cy, _ce, _cd, _vao_pernas, _antes_pernas))
corpo.data.transform(mathutils.Matrix.Translation((-cx, -cy, -z0)))

# ── APERTAR AS PERNAS ───────────────────────────────────────────────────────
# O modelo vinha com os eixos das pernas a 0,073 da altura um do outro -- 29 cm
# num homem de 2 m, quando uma pessoa anda com 22. De longe le-se como um
# soldado de pernas abertas, e foi o que se viu na bancada.
# ⚠ Nao chega estreitar os OSSOS: o esqueleto mexe-se e a malha fica onde
# estava, com o osso a correr fora do tubo da perna -- e ai a deformacao e que
# parte. Quem tem de se mexer e a GEOMETRIA; os ossos vem depois, medidos por
# cima do resultado.
# A aperto e por rampa: nada na anca, tudo da coxa para baixo. Encolher o corpo
# todo em x deixava-o magro de ombros.
# ⚠ ALVO, E NAO FATOR. Isto era um 0,76 fixo, afinado a olho para o lanceiro --
# e no arqueiro, que nasce com as pernas a 39 cm, 0,76 deixava 29 cm, ainda
# larguissimo, e a passada abria em espargata. Cada figura do ComfyUI vem com o
# seu proprio afastamento, entao o que tem de ser constante e o RESULTADO: um
# homem anda com os eixos das pernas a ~0,055 da sua altura (22 cm num de 2 m).
# O fator sai da divisao, e nunca ALARGA (teto em 1,0) nem esmaga (piso 0,45).
ALVO_PERNAS = 0.055
APERTO_PERNAS = min(1.0, max(0.45, ALVO_PERNAS / max(_antes_pernas, 1e-6)))
_z_anca = (z_cabeca - z0) * 0.52
_z_coxa = (z_cabeca - z0) * 0.42
for _v in corpo.data.vertices:
    # ⚠ A ARMA NAO SE APERTA. A parte de baixo da lanca tambem esta abaixo da
    # anca, e era encolhida com as pernas: a haste saia com uma CURVA entre 0,9
    # e 1,1 m (10 cm de desvio em 20 cm, medido no GLB), exatamente na rampa do
    # aperto. O Lucas viu-a na sala de provas; no original a lanca e reta.
    if _v.index in lanca_idx:
        continue
    if _v.co.z >= _z_anca:
        continue
    _t = 1.0 if _v.co.z <= _z_coxa else (_z_anca - _v.co.z) / (_z_anca - _z_coxa)
    _v.co.x *= 1.0 - (1.0 - APERTO_PERNAS) * _t

# ── OS PES NAO ESTAO A PAR, E ISSO NAO SE CONSERTA NA MALHA ─────────────────
# A pose que vem do ComfyUI nao e neutra: o arqueiro nasce com um pe 64 cm a
# frente do outro (o lanceiro, 1 cm). A primeira tentativa foi empurrar os
# vertices de cada perna em y, por rampa -- e RASGOU A TUNICA: a saia e uma peca
# so, atravessa os dois lados, e meia dela foi para a frente e meia para tras.
# Ficou muito pior do que o defeito que ia corrigir.
# O sitio certo e o ESQUELETO: mede-se o y de cada pe e constroi-se a perna
# desse lado ali, em vez de a supor no meio. Assim o osso corre por dentro do
# tubo da perna (que e o que faz a deformacao ficar boa) e cada pe baloica a
# volta do sitio onde ja esta.
_zb2 = (z_cabeca - z0) * 0.12
_pes = {}
for _lado, _sinal in (("esq", -1), ("dir", +1)):
    _ys = sorted(v.co.y for v in corpo.data.vertices
                 if v.index not in lanca_idx and v.co.z < _zb2
                 and v.co.x * _sinal > 0)
    if len(_ys) >= 8:
        _pes[_lado] = (_ys[int(len(_ys) * .05)] + _ys[int(len(_ys) * .95)]) / 2
Y_PE = {"L": 0.0, "R": 0.0}
if len(_pes) == 2:
    _mid = (_pes["esq"] + _pes["dir"]) / 2
    Y_PE = {"L": _pes["dir"] - _mid, "R": _pes["esq"] - _mid}
    print("SONDA pes: desencontro de %.0f cm na pose de repouso -- os ossos de "
          "cada perna vao para o sitio dela" % (abs(_pes["dir"] - _pes["esq"])
                                                / (z_cabeca - z0) * ALTURA_M * 100))

_pj = _pernas_cruas_centrada(0.30) or _pernas_cruas_centrada(0.24)
FRACAO_PERNA = (_pj[1] - _pj[0]) / 2 / (z_cabeca - z0) if _pj else _antes_pernas * APERTO_PERNAS
print("SONDA pernas apertadas: %.3f -> %.3f da altura (%.0f cm -> %.0f cm num "
      "homem de %.1f m)" % (_antes_pernas, FRACAO_PERNA,
                            _antes_pernas * 2 * ALTURA_M * 100,
                            FRACAO_PERNA * 2 * ALTURA_M * 100, ALTURA_M))
corpo.data.transform(mathutils.Matrix.Scale(k, 4))
H = ALTURA_M
Y_PE = {_l: _v * k for _l, _v in Y_PE.items()}
print("SONDA corpo: cabeca a %.3f de %.3f unidades; escala %.3f -> %.2f m"
      % (z_cabeca - z0, max(zs) - z0, k, H))



# ── ONDE ESTAO AS PERNAS ────────────────────────────────────────────────────
# Medidas na malha: numa fatia a altura do joelho, os vertices separam-se em
# dois grupos (esquerda e direita). A media de cada grupo da o eixo da perna.
def eixo_das_pernas(altura_rel, espessura=0.04, limite=0.22):
    z = H * altura_rel
    # MEDIANA, e nao media: a tunica alarga e a lanca esta ao lado, e as duas
    # puxavam o valor para fora -- foi assim que as pernas sairam afastadas de
    # mais. O `limite` corta o que esta longe de mais para ser perna.
    esq, dir_ = [], []
    for v in corpo.data.vertices:
        if v.index in lanca_idx or abs(v.co.z - z) > H * espessura:
            continue
        if abs(v.co.x) > H * limite:
            continue
        (esq if v.co.x < 0 else dir_).append(abs(v.co.x))

    def meio(l):
        return sorted(l)[len(l) // 2] if l else H * 0.05

    return (meio(esq) + meio(dir_)) / 2


# ⚠ VEM DO AGRUPAMENTO feito antes de escalar (ver "O CORPO TEM DE FICAR NO
# MEIO"), e nao da mediana de |x|: a mediana mede a PAREDE do tubo da perna, e
# nao o seu eixo, e por isso as pernas nasciam mais abertas do que sao.
x_perna = FRACAO_PERNA * H
# ⚠ NAO medir o tornozelo: a bota alarga em baixo e a medida saia MAIOR que a
# do joelho -- as pernas abriam em compasso. O tornozelo segue a perna.
x_torno = x_perna * 0.90
x_anca = x_perna * 0.80          # a anca e mais estreita que a perna em pe
x_ombro = eixo_das_pernas(0.78, limite=0.30)

# ── OS BRACOS MEDEM-SE PELA BORDA, E NAO PELA MEDIANA ───────────────────────
# O `x_ombro` acima e a mediana de |x| numa fatia a altura do ombro -- e nessa
# fatia quase tudo e PEITO e capa. Deu 0,12 m, quando o ombro do arqueiro esta a
# 0,22-0,27 e o braco a 0,31: o osso do braco corria por DENTRO do peito. Nunca
# se viu, porque os bracos nunca foram animados; viu-se quando o Lucas posou o
# braco na sala de provas e o tronco inteiro veio atras, distorcido. A pele e
# pesada pela distancia ao osso, e o peitoral estava mais perto do osso do braco
# do que do osso do peito.
# Os bracos colam-se a capa em quase todas as alturas, entao nao ha vazio para
# separar montes, como nas pernas. O que e seguro e a BORDA DE FORA: a cada
# altura, os vertices mais afastados do centro, de cada lado, sao o braco.
def _junta_braco(sinal, frac, folga):
    z = H * frac
    pts = [v.co for v in corpo.data.vertices
           if v.index not in lanca_idx and abs(v.co.z - z) < H * 0.025
           and v.co.x * sinal > 0]
    if len(pts) < 6:
        return None
    borda = max(abs(q.x) for q in pts)
    ponta = [q for q in pts if abs(q.x) > borda - H * folga]
    return mathutils.Vector((sum(q.x for q in ponta) / len(ponta),
                             sum(q.y for q in ponta) / len(ponta), z))


# ── E O QUE O LUCAS POSICIONOU A MAO VENCE A MEDIDA ─────────────────────────
# A borda nao sabe distinguir um braco dobrado de uma mao afastada: no lanceiro
# o "cotovelo" saiu na mao que segura a lanca. O Lucas pos as juntas do braco no
# sitio, na sala de provas (modo de edicao do esqueleto, olhando de frente e de
# lado), e elas ficaram em  ferramentas/cena/marcas/<figura>_ossos.json.
# As posicoes sao do esqueleto EXPORTADO, que ja subiu com as pernas a prumo;
# aqui ainda nao subiu. Por isso o z guarda-se relativo a cabeca do osso hips,
# que nesta fase esta sempre em H * 0.50.
OSSOS_MAO = {}
_f_ossos = os.path.join(os.getcwd(), "ferramentas", "cena", "marcas",
                        os.path.splitext(os.path.basename(ENTRADA))[0].lower() + "_ossos.json")
if os.path.isfile(_f_ossos):
    import json as _json
    _od = _json.load(open(_f_ossos, encoding="utf-8"))
    _dzh = _od["hips_cabeca"][2] - H * 0.50

    def _pt(v):
        return mathutils.Vector((v[0], v[1], v[2] - _dzh))

    for _lado in ("L", "R"):
        _u = _od["ossos"].get("upperarm." + _lado)
        _fa = _od["ossos"].get("forearm." + _lado)
        if _u and _fa:
            OSSOS_MAO[_lado] = (_pt(_u["cabeca"]), _pt(_u["cauda"]), _pt(_fa["cauda"]))
    print("SONDA ossos a mao: %s (%s)" % (os.path.basename(_f_ossos),
                                           ", ".join(sorted(OSSOS_MAO))))

BRACO = {}
for _lado, _sinal in (("L", 1.0), ("R", -1.0)):
    _o = _junta_braco(_sinal, 0.76, 0.05)
    _c = _junta_braco(_sinal, 0.60, 0.05)
    _p = _junta_braco(_sinal, 0.47, 0.04)
    if _o is None or _c is None:
        continue
    # o ombro nao e a borda do chumaco: e o sitio onde o braco nasce, um pouco
    # para dentro. Fica a 3/4 do caminho entre o centro e a borda medida.
    _o = mathutils.Vector((_o.x * 0.75, _o.y, _o.z))
    # ⚠ A BORDA PODE SER A MAO, e nao o braco. O lanceiro segura a lanca com a
    # mao afastada do corpo, e a altura do cotovelo o ponto mais de fora era essa
    # mao: o cotovelo saiu a 0,54 m do centro. Um braco nao se abre tanto entre
    # juntas, entao limita-se o salto lateral de cada uma.
    def _limita(q, ref, maximo):
        dx = max(-maximo, min(maximo, q.x - ref.x))
        return mathutils.Vector((ref.x + dx, q.y, q.z))
    _c = _limita(_c, _o, H * 0.08)
    if _p is None:
        _p = _c + (_c - _o) * 0.8
    _p = _limita(_p, _c, H * 0.06)
    BRACO[_lado] = (_o, _c, _p)
    print("SONDA braco %s: ombro x=%+.2f  cotovelo x=%+.2f  pulso x=%+.2f  "
          "(antes: x=%+.2f)" % (_lado, _o.x, _c.x, _p.x, _sinal * x_ombro))
print("SONDA pernas: anca x=%.3f perna x=%.3f tornozelo x=%.3f | ombro x=%.3f"
      % (x_anca, x_perna, x_torno, x_ombro))
# ── A PERNA E UM TUBO: O EIXO E O MEIO DAS DUAS PAREDES ─────────────────────
# Serve para ver se a mediana esta a apanhar o eixo ou a parede de fora.
for _alt in (0.30, 0.20):
    _z = H * _alt
    for _nome, _sinal in (("esq", -1), ("dir", +1)):
        _xs = sorted(abs(v.co.x) for v in corpo.data.vertices
                     if v.index not in lanca_idx and abs(v.co.z - _z) < H * 0.04
                     and abs(v.co.x) < H * 0.22 and v.co.x * _sinal > 0)
        if len(_xs) < 8:
            continue
        print("SONDA perna %s a %.2f H: |x| p05 %.3f p50 %.3f p95 %.3f -> "
              "eixo %.3f (n=%d)" % (_nome, _alt, _xs[int(len(_xs) * .05)],
                                    _xs[len(_xs) // 2], _xs[int(len(_xs) * .95)],
                                    (_xs[int(len(_xs) * .05)]
                                     + _xs[int(len(_xs) * .95)]) / 2, len(_xs)))

# ── O ESQUELETO ─────────────────────────────────────────────────────────────
bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
arm = bpy.context.object
arm.name = "esqueleto"
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
ed = arm.data.edit_bones
for b in list(ed):
    ed.remove(b)


def osso(nome, cabeca, cauda, pai=None):
    b = ed.new(nome)
    b.head = cabeca
    b.tail = cauda
    if pai:
        b.parent = ed[pai]
        b.use_connect = False
    return b


osso("hips", (0, 0, H * 0.50), (0, 0, H * 0.60))
osso("spine", (0, 0, H * 0.60), (0, 0, H * 0.70), "hips")
osso("chest", (0, 0, H * 0.70), (0, 0, H * 0.80), "spine")
osso("neck", (0, 0, H * 0.80), (0, 0, H * 0.86), "chest")
osso("head", (0, 0, H * 0.86), (0, 0, H * 1.00), "neck")
for lado, s in (("L", 1.0), ("R", -1.0)):
    # ⚠ CADA PERNA NO SEU SITIO, EM Y. A anca fica no meio; o joelho e o pe vao
    # para onde a perna DESSE lado esta de facto (`Y_PE`, medido na malha). Com
    # os dois no meio, o osso corria fora do tubo da perna que esta avancada, e
    # a deformacao partia -- e empurrar a malha para os juntar rasgava a tunica.
    _yp = Y_PE.get(lado, 0.0)
    osso("thigh." + lado, (s * x_anca, 0, H * 0.50),
         (s * x_perna, _yp * 0.55, H * 0.27), "hips")
    osso("lowerleg." + lado, (s * x_perna, _yp * 0.55, H * 0.27),
         (s * x_torno, _yp, H * 0.07), "thigh." + lado)
    osso("foot." + lado, (s * x_torno, _yp, H * 0.07),
         (s * x_torno, _yp + H * 0.09, H * 0.01), "lowerleg." + lado)
    if lado in OSSOS_MAO:
        _o, _c, _p = OSSOS_MAO[lado]
        osso("upperarm." + lado, tuple(_o), tuple(_c), "chest")
        osso("forearm." + lado, tuple(_c), tuple(_p), "upperarm." + lado)
    elif lado in BRACO:
        _o, _c, _p = BRACO[lado]
        osso("upperarm." + lado, tuple(_o), tuple(_c), "chest")
        osso("forearm." + lado, tuple(_c), tuple(_p), "upperarm." + lado)
    else:
        osso("upperarm." + lado, (s * x_ombro, 0, H * 0.78),
             (s * x_ombro * 1.1, 0, H * 0.62), "chest")
        osso("forearm." + lado, (s * x_ombro * 1.1, 0, H * 0.62),
             (s * x_ombro * 1.1, 0, H * 0.50), "upperarm." + lado)
bpy.ops.object.mode_set(mode="OBJECT")

# ── A PELE, PESADA POR CODIGO ───────────────────────────────────────────────
# O "pesar automatico" do Blender (difusao de calor) FALHOU nesta malha: criou
# os 15 grupos e deixou 0 de 2514 vertices com peso -- e sem peso nenhum o
# exportador nao escreve pele, e o soldado chega ao jogo rigido, sem um erro em
# lado nenhum. Foi preciso contar os vertices com peso para descobrir.
#
# Entao pesa-se aqui: cada vertice vai para os DOIS ossos mais proximos, com
# peso pela distancia. E chega, porque esta figura nao tem panos largos nem
# dedos -- e a camara mais proxima ve o homem com 40 px de altura.
import bmesh                                                   # noqa: E402


def _dist_ao_osso(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def _ilhas(malha):
    """os pedacos separados da malha: o corpo e a lanca sao dois"""
    bm = bmesh.new()
    bm.from_mesh(malha)
    bm.verts.ensure_lookup_table()
    por_ver = {}
    ilhas = []
    for v in bm.verts:
        if v.index in por_ver:
            continue
        pilha, grupo = [v], []
        por_ver[v.index] = len(ilhas)
        while pilha:
            u = pilha.pop()
            grupo.append(u.index)
            for e in u.link_edges:
                o = e.other_vert(u)
                if o.index not in por_ver:
                    por_ver[o.index] = len(ilhas)
                    pilha.append(o)
        ilhas.append(grupo)
    bm.free()
    return ilhas


bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
bpy.context.view_layer.objects.active = corpo
for g in list(corpo.vertex_groups):
    corpo.vertex_groups.remove(g)
grupos = {b.name: corpo.vertex_groups.new(name=b.name) for b in arm.data.bones}
ossos = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones]

ilhas = _ilhas(corpo.data)
ilhas.sort(key=len, reverse=True)
corpo_idx = set(ilhas[0])
# ── A LANCA E UMA ILHA A PARTE, E VAI INTEIRA PARA O BRACO ──────────────────
# Pesada vertice a vertice, a ponta (que passa a cabeca) ficaria presa ao
# pescoco e a haste dobrava a cada passo. Presa ao braco -- que nao se mexe --
# ela fica quieta na mao, que e o que uma lanca faz.
# (a lanca ja foi encontrada la em cima, antes de medir as pernas)
print("SONDA ilhas: %d | corpo %d vertices" % (len(ilhas), len(corpo_idx)))

# ── A BOTA E RIGIDA ─────────────────────────────────────────────────────────
# Pesada vertice a vertice, ela ficava repartida entre o pe, a canela e ate a
# coxa: partes dela seguiam ossos diferentes e a bota ESTICAVA -- via-se a
# biqueira, o meio e o cano em sitios que nao combinavam, tudo ao mesmo tempo.
# Uma bota nao se deforma: vai inteira com o pe.
Z_BOTA = H * 0.115
bota_idx = {}
for v in corpo.data.vertices:
    if v.index in lanca_idx or v.co.z > Z_BOTA:
        continue
    bota_idx[v.index] = "foot.L" if v.co.x > 0 else "foot.R"
print("SONDA botas: %d vertices presos ao pe (abaixo de %.2f m)"
      % (len(bota_idx), Z_BOTA))

# a arma vai para o braco do LADO onde ela esta (x < 0 e o lado R), e nao para
# um braco fixo: o lanceiro e o arqueiro calharam a segurar pela direita, o
# proximo pode nao calhar
BRACO_ARMA = "upperarm.R"
if lanca_idx:
    _mx = sum(corpo.data.vertices[i].co.x for i in lanca_idx) / len(lanca_idx)
    # vai com o ANTEBRACO, e nao com o braco de cima: e a mao que segura a arma.
    # (Enquanto os bracos nao eram animados tanto fazia; com as juntas postas pelo
    # Lucas e os bracos a mexer, o arco tem de seguir a mao.)
    BRACO_ARMA = "forearm.L" if _mx > 0 else "forearm.R"
    print("SONDA arma: %d vertices presos a %s" % (len(lanca_idx), BRACO_ARMA))
pesos = []
for v in corpo.data.vertices:
    if v.index in lanca_idx:
        pesos.append({BRACO_ARMA: 1.0})
        continue
    if v.index in bota_idx:
        pesos.append({bota_idx[v.index]: 1.0})
        continue
    if v.index in mao_idx:
        pesos.append({("forearm.L" if v.co.x > 0 else "forearm.R"): 1.0})
        continue
    # ⚠ O TUBO DO BRACO ACABA NO PULSO. Um vertice que nao e mao nem arma so pode
    # seguir um osso do braco se estiver ENTRE as pontas desse osso; para la do
    # pulso (e acima do ombro) nao ha braco, ha casaco e peito.
    _cand = []
    for n, a, b in ossos:
        # ⚠ NO LADO QUE O LUCAS PINTOU, SO A MANGA SEGUE O BRACO. O casaco encosta
        # a manga: 16 vertices seguiam o antebraco com peso ate 0,8 e abriam uma
        # aba do casaco ao girar o braco para tras. Nenhuma distancia os separava
        # sem cortar a propria manga -- o olho dele separou.
        if n.startswith(("upperarm", "forearm")) and n[-1] in LADOS_PINTADOS:
            if v.index not in manga_idx:
                continue
            _ab = b - a
            _t = (v.co - a).dot(_ab) / max(_ab.length_squared, 1e-9)
            if _t < -0.05 or _t > 1.02:
                continue
            _cand.append((_dist_ao_osso(v.co, a, b), n))
            continue
        if n.startswith(("upperarm", "forearm")):
            _ab = b - a
            _t = (v.co - a).dot(_ab) / max(_ab.length_squared, 1e-9)
            if _t < -0.05 or _t > 1.02:
                continue
            # ⚠ E O TUBO TEM GROSSURA. O antebraco esquerdo pende PARALELO ao
            # casaco, encostado, e o casaco ao lado dele esta "entre o ombro e o
            # pulso" -- uma aba inteira abria-se ao girar o braco para tras.
            # Medido pela distancia ao eixo do osso: a manga fica ate 8 cm, ha um
            # vale entre 8 e 10 (4 vertices), e o casaco esta a 10-14 cm (42).
            # Corta-se no vale.
            if _dist_ao_osso(v.co, a, b) > H * 0.047:
                continue
        _cand.append((_dist_ao_osso(v.co, a, b), n))
    ds = sorted(_cand)[:2]
    (d1, n1), (d2, n2) = ds[0], ds[1]
    w1 = d2 / max(d1 + d2, 1e-6)
    pesos.append({n1: w1, n2: 1.0 - w1})

# ── E OS PESOS SAO SUAVIZADOS ───────────────────────────────────────────────
# Com cada vertice preso aos dois ossos mais proximos, a fronteira entre a coxa
# e a canela e um CORTE: ao dobrar o joelho a malha abre e a perna parece
# partida -- via-se nos quadros de perfil. Quatro passagens de media entre
# vizinhos resolvem. E o mesmo principio da costa: o que apaga um degrau e
# MEDIAR, nao deslocar. (O operador do Blender para isto exige o modo de
# pintura e nao corre em segundo plano; a media por arestas nao tem contexto
# nenhum para falhar.)
vizinhos = [[] for _ in corpo.data.vertices]
for e in corpo.data.edges:
    a, b = e.vertices
    vizinhos[a].append(b)
    vizinhos[b].append(a)
for _ in range(4):
    novos = []
    for i, p_i in enumerate(pesos):
        if i in lanca_idx or i in bota_idx or i in mao_idx or not vizinhos[i]:
            novos.append(p_i)
            continue
        soma = dict(p_i)
        for j in vizinhos[i]:
            for nome, w in pesos[j].items():
                soma[nome] = soma.get(nome, 0.0) + w
        total = sum(soma.values()) or 1.0
        novos.append({n: w / total for n, w in soma.items() if w / total > 0.02})
    pesos = novos

# ⚠ A MEDIA ENTRE VIZINHOS ESPALHA. A manga e o casaco tocam-se por arestas, e
# quatro passagens de media levavam peso de braco para o casaco outra vez. No
# lado pintado, o que nao e manga nem mao perde o braco depois de suavizar.
if LADOS_PINTADOS:
    for i, p_i in enumerate(pesos):
        if i in manga_idx or i in mao_idx or i in lanca_idx:
            continue
        limpo = {n: w for n, w in p_i.items()
                 if not (n.startswith(("upperarm", "forearm")) and n[-1] in LADOS_PINTADOS)}
        if limpo and len(limpo) != len(p_i):
            pesos[i] = limpo

for i, p_i in enumerate(pesos):
    total = sum(p_i.values()) or 1.0
    for nome, w in p_i.items():
        grupos[nome].add([i], w / total, "REPLACE")

# ── E OS PESOS SAO SUAVIZADOS ───────────────────────────────────────────────
# Com cada vertice preso aos dois ossos mais proximos, a fronteira entre a coxa
# e a canela e um CORTE: ao dobrar o joelho a malha abre e a perna parece
# partida. Quatro passagens de media entre vizinhos resolvem -- e e o mesmo
# principio da costa: o que apaga um degrau e mediar, nao deslocar.
corpo.parent = arm
corpo.parent_type = "OBJECT"
md = corpo.modifiers.new("esqueleto", "ARMATURE")
md.object = arm
pesados = sum(1 for v in corpo.data.vertices if v.groups)
print("SONDA pele: %d grupos, %d de %d vertices com peso"
      % (len(corpo.vertex_groups), pesados, len(corpo.data.vertices)))
if pesados < len(corpo.data.vertices) * 0.99:
    raise SystemExit("pele incompleta: o exportador ia escrever uma malha rigida")

# ── A POSE DE REPOUSO FICA COM AS PERNAS A PAR ──────────────────────────────
# O arqueiro nasce com um pe 60 cm a frente do outro. Deixar os ossos no sitio
# de cada perna (a correcao anterior) fazia a marcha balancar em volta dessa pose
# torta: o pe direito ficava SEMPRE a frente, e o Lucas viu "o passo sempre
# igual, as pernas sempre a abrir para o mesmo lado". Empurrar a malha a mao
# rasgava a tunica. O que resolve e o que um rigger faria, e foi provado ao vivo
# no Blender pelo MCP antes de vir para aqui:
#   1. POSAR as coxas ate a perna ficar a prumo (e o pe a compensar, senao a
#      biqueira aponta para o chao);
#   2. APLICAR o esqueleto: a malha fica nessa pose, e a TUNICA vem junto,
#      deformada pela pele -- suave, sem rasgar;
#   3. voltar a por os ossos das pernas direitos, e o modificador de novo.
# Com as pernas a prumo a figura fica mais alta (a passada abaixava a anca), por
# isso sobe-se tudo ate os pes voltarem ao chao.
if any(abs(_v) > H * 0.01 for _v in Y_PE.values()):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for _lado in ("L", "R"):
        _cx = arm.data.bones["thigh." + _lado]
        _pe = arm.data.bones["foot." + _lado]
        _a, _t = _cx.head_local, _pe.head_local
        _R = (_t - _a).normalized().rotation_difference(
            mathutils.Vector((_t.x - _a.x, 0.0, _t.z - _a.z)).normalized()).to_matrix()
        _M = _cx.matrix_local.to_3x3()
        _pb = arm.pose.bones["thigh." + _lado]
        _pb.rotation_mode = "QUATERNION"
        _pb.rotation_quaternion = (_M.inverted() @ _R @ _M).to_quaternion()
        _Mf = _pe.matrix_local.to_3x3()
        _pf = arm.pose.bones["foot." + _lado]
        _pf.rotation_mode = "QUATERNION"
        _pf.rotation_quaternion = (_Mf.inverted() @ _R.inverted() @ _Mf).to_quaternion()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = corpo
    bpy.ops.object.modifier_apply(modifier=md.name)
    for _pb in arm.pose.bones:
        _pb.rotation_quaternion = (1, 0, 0, 0)
    _dz = -min(v.co.z for v in corpo.data.vertices)
    corpo.data.transform(mathutils.Matrix.Translation((0, 0, _dz)))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    _eb = arm.data.edit_bones
    for _b in _eb:
        if not _b.name.split(".")[0] in ("thigh", "lowerleg", "foot"):
            _b.head.z += _dz
            _b.tail.z += _dz
    _zh, _za = H * 0.50 + _dz, H * 0.07
    _zj = _za + (_zh - _za) * (0.20 / 0.43)
    for _lado, _s in (("L", 1.0), ("R", -1.0)):
        _eb["thigh." + _lado].head = (_s * x_anca, 0, _zh)
        _eb["thigh." + _lado].tail = (_s * x_perna, 0, _zj)
        _eb["lowerleg." + _lado].head = (_s * x_perna, 0, _zj)
        _eb["lowerleg." + _lado].tail = (_s * x_torno, 0, _za)
        _eb["foot." + _lado].head = (_s * x_torno, 0, _za)
        _eb["foot." + _lado].tail = (_s * x_torno, H * 0.09, H * 0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    md = corpo.modifiers.new("esqueleto", "ARMATURE")
    md.object = arm
    print("SONDA pose de repouso: pernas postas a prumo pelo esqueleto; "
          "a figura subiu %.0f cm para os pes voltarem ao chao" % (_dz * 100))

# ── AJUSTES QUE O LUCAS FEZ DE OLHO NA SALA DE PROVAS ───────────────────────
# Em ferramentas/cena/marcas/<figura>_ajustes.json ficam NUMEROS, e nao malha:
# um angulo ou uma razao sobrevivem a qualquer refazer do soldado, uma malha
# guardada nao. Aplicam-se aqui porque este e o espaco em que ele os fez: a pose
# de repouso final, com os pes no chao e os ossos das pernas direitos.
_f_aj = os.path.join(os.getcwd(), "ferramentas", "cena", "marcas",
                     os.path.splitext(os.path.basename(ENTRADA))[0].lower() + "_ajustes.json")
if os.path.isfile(_f_aj):
    import json as _json
    _aj = _json.load(open(_f_aj, encoding="utf-8"))
    _gi = {g.name: g.index for g in corpo.vertex_groups}

    def _peso(v, nome):
        return next((g.weight for g in v.groups if g.group == _gi.get(nome, -1)), 0.0)

    # 1. BOTAS VIRADAS PARA A FRENTE. O arqueiro nasceu com a biqueira esquerda
    #    a fugir para fora; o Lucas girou cada bota em volta do tornozelo (R, Z,
    #    vista de cima). A bota gira inteira; o cano da perna acima dela gira por
    #    rampa, para a junta nao rasgar.
    for _lado, _graus in (_aj.get("girar_bota_graus") or {}).items():
        _ank = arm.data.bones["foot." + _lado].head_local
        _z0, _z1 = H * 0.115, H * 0.20
        _n = 0
        for v in corpo.data.vertices:
            _pf = _peso(v, "foot." + _lado)
            _pl = _peso(v, "lowerleg." + _lado)
            if _pf > 0.99:
                _t = 1.0
            elif _pl > 0.5 and v.co.z < _z1:
                _t = max(0.0, min(1.0, (_z1 - v.co.z) / (_z1 - _z0)))
            else:
                continue
            _r = mathutils.Matrix.Rotation(math.radians(_graus * _t), 3, "Z")
            _u = v.co - _ank
            v.co = _ank + _r @ mathutils.Vector((_u.x, _u.y, 0)) + mathutils.Vector((0, 0, _u.z))
            _n += 1
        print("SONDA bota %s girada %+.1f graus (%d vertices)" % (_lado, _graus, _n))

    # 2. COXAS MAIS GROSSAS. Medido: as do arqueiro tinham ~5,8 cm de raio contra
    #    8-9 no lanceiro. Afastam-se do eixo do osso da coxa, com rampa nas duas
    #    pontas (anca e joelho) para nao abrir degraus.
    _k = float(_aj.get("engrossar_coxas", 1.0))
    if abs(_k - 1.0) > 1e-3:
        for _lado in ("L", "R"):
            _b = arm.data.bones["thigh." + _lado]
            _a, _c = _b.head_local, _b.tail_local
            _ab = _c - _a
            _n = 0
            for v in corpo.data.vertices:
                if _peso(v, "thigh." + _lado) < 0.6:
                    continue
                _t = max(0.0, min(1.0, (v.co - _a).dot(_ab) / _ab.length_squared))
                _rampa = min(1.0, _t / 0.2, (1.0 - _t) / 0.2)
                _eixo = _a + _ab * _t
                _off = v.co - _eixo
                v.co = _eixo + _off * (1.0 + (_k - 1.0) * max(0.0, _rampa))
                _n += 1
            print("SONDA coxa %s engrossada x%.2f (%d vertices)" % (_lado, _k, _n))

# ── A PROVA DOS PESOS: CADA OSSO NUMA COR ───────────────────────────────────
# Ate aqui os erros de pesagem eram descobertos pela silhueta em movimento -- o
# Lucas via "uma mancha borrada" e eu adivinhava a causa. Com esta prova ve-se
# DIRETAMENTE de quem e cada vertice: se a bota tiver cor de braco, o problema
# esta dito. Escreve dois PNG e nao toca no que e exportado.
if os.environ.get("PROVA_PESOS", "1") == "1":
    _cores = {}
    _paleta = [(0.95, 0.25, 0.20), (0.20, 0.55, 0.95), (0.95, 0.80, 0.20),
               (0.30, 0.85, 0.35), (0.80, 0.35, 0.90), (0.20, 0.85, 0.85),
               (0.95, 0.55, 0.15), (0.60, 0.60, 0.60), (0.40, 0.25, 0.75),
               (0.85, 0.45, 0.55), (0.35, 0.70, 0.45), (0.75, 0.75, 0.30),
               (0.25, 0.35, 0.60), (0.90, 0.65, 0.75), (0.55, 0.40, 0.20)]
    for _i, _b in enumerate(arm.data.bones):
        _cores[_b.name] = _paleta[_i % len(_paleta)]
    _ca = corpo.data.color_attributes.new(name="PESOS", type="FLOAT_COLOR",
                                          domain="POINT")
    for _i, _p in enumerate(pesos):
        _dom = max(_p.items(), key=lambda kv: kv[1])[0] if _p else "hips"
        _ca.data[_i].color = (*_cores[_dom], 1.0)
    _mat = bpy.data.materials.new("pesos")
    _mat.use_nodes = True
    _nt = _mat.node_tree
    _b = next(n for n in _nt.nodes if n.type == "BSDF_PRINCIPLED")
    _at = _nt.nodes.new("ShaderNodeVertexColor")
    _at.layer_name = "PESOS"
    _nt.links.new(_at.outputs["Color"], _b.inputs["Base Color"])
    _b.inputs["Roughness"].default_value = 0.9
    _guarda = list(corpo.data.materials)
    corpo.data.materials.clear()
    corpo.data.materials.append(_mat)

    _ce = bpy.context.scene
    _luz = bpy.data.lights.new("l", "SUN"); _luz.energy = 2.6
    _ol = bpy.data.objects.new("l", _luz); _ce.collection.objects.link(_ol)
    _ol.rotation_euler = (math.radians(55), 0, math.radians(25))
    _mundo = bpy.data.worlds.new("w"); _ce.world = _mundo
    _mundo.use_nodes = True
    _mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (.9, .9, .9, 1)
    _cd = bpy.data.cameras.new("c"); _cm = bpy.data.objects.new("c", _cd)
    _ce.collection.objects.link(_cm); _ce.camera = _cm
    _mira = bpy.data.objects.new("m", None); _mira.location = (0, 0, H * 0.45)
    _ce.collection.objects.link(_mira)
    _tt = _cm.constraints.new("TRACK_TO"); _tt.target = _mira
    _tt.track_axis = "TRACK_NEGATIVE_Z"; _tt.up_axis = "UP_Y"
    _ce.render.engine = "CYCLES"; _ce.cycles.samples = 16
    _ce.render.resolution_x = _ce.render.resolution_y = 700
    _ce.view_settings.view_transform = "Standard"
    for _nome, _pos in (("frente", (0, -H * 1.9, H * 0.55)),
                        ("lado", (H * 1.9, 0, H * 0.55))):
        _cm.location = _pos
        _ce.render.filepath = os.path.join(os.getcwd(), "ferramentas", "cena",
                                           "_saida", "pesos_%s.png" % _nome)
        bpy.ops.render.render(write_still=True)
    corpo.data.materials.clear()
    for _m in _guarda:
        corpo.data.materials.append(_m)
    corpo.data.color_attributes.remove(_ca)
    bpy.data.objects.remove(_ol, do_unlink=True)
    bpy.data.objects.remove(_cm, do_unlink=True)
    bpy.data.objects.remove(_mira, do_unlink=True)
    print("SONDA prova dos pesos: ferramentas/cena/_saida/pesos_{frente,lado}.png")

# ── A MARCHA ────────────────────────────────────────────────────────────────
cena = bpy.context.scene
cena.render.fps = FPS
cena.frame_start = 1
cena.frame_end = CICLO
# ⚠ NAO se cria a acao a mao. No Blender 5 uma acao tem camadas e ranhuras, e
# uma acao criada vazia e atribuida "a antiga" fica sem ligacao ao esqueleto --
# as chaves entram e nao movem nada. Deixa-se o proprio `keyframe_insert`
# cria-la, e no fim da-se-lhe o nome que o mapa procura.
arm.animation_data_create()
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"

# ⚠ OS DOIS SINAIS que decidem se ele anda para a frente ou de costas. Com o
# joelho invertido ele fica hiperextendido -- dobra para a frente -- e le-se
# como marcha de costas. So se ve em MOVIMENTO.
# MEDIDO, osso a osso, com a figura parada:
#   coxa  +0,4 rad -> pe 0,55 m A FRENTE da anca   (positivo = para a frente)
#   joelho +0,4 rad -> tornozelo A FRENTE do joelho = HIPEREXTENSAO
# por isso o joelho leva sinal negativo: assim o calcanhar vai para tras.
SENTIDO_COXA = 1.0
SENTIDO_JOELHO = -1.0
BALANCO = math.radians(22)      # quanto a coxa vai a frente e atras
DOBRA = math.radians(38)        # quanto o joelho dobra ao levantar
SOBE = H * 0.012                # a anca sobe e desce duas vezes por passo


def poe(nome, quadro, **campos):
    pb = arm.pose.bones[nome]
    for campo, valor in campos.items():
        setattr(pb, campo, valor)
        pb.keyframe_insert(data_path=campo, frame=quadro)


_bal_braco, _ang_frente = None, 0.0
if "_od" in dir() and _od.get("balanco_braco"):
    _bal_braco = mathutils.Quaternion(_od["balanco_braco"]["rotacao_no_corpo"])
    # so a parte PARA A FRENTE (a rotacao em torno do eixo lateral x)
    _dir = _bal_braco.to_matrix() @ mathutils.Vector((0, 0, -1))
    _ang_frente = abs(math.atan2(_dir.y, -_dir.z))
    print("SONDA bracos: balanco posado pelo Lucas (%.0f graus no ponto mais a frente)"
          % math.degrees(_bal_braco.angle))
for i in range(CICLO + 1):
    q = 1 + i
    t = i / CICLO
    a = 2 * math.pi * t
    for lado, fase in (("L", 0.0), ("R", math.pi)):
        coxa = math.sin(a + fase) * BALANCO
        # o joelho so dobra quando a perna VAI ATRAS e sobe para a frente
        joelho = SENTIDO_JOELHO * max(0.0, math.sin(a + fase + math.pi / 2)) * DOBRA
        poe("thigh." + lado, q, rotation_euler=(SENTIDO_COXA * coxa, 0, 0))
        poe("lowerleg." + lado, q, rotation_euler=(joelho, 0, 0))
        poe("foot." + lado, q, rotation_euler=(-joelho * 0.4, 0, 0))
    # ⚠ o Y LOCAL da anca e que aponta para cima (medido: (0, 0.1, 0) sobe
    # 10 cm; (0, 0, 0.1) empurra o corpo para a frente). Com o eixo errado, o
    # "balanco" era um solavanco para a frente duas vezes por passo.
    poe("hips", q, location=(0, abs(math.sin(a)) * SOBE, 0))
    poe("chest", q, rotation_euler=(0, 0, math.sin(a) * math.radians(5)))
    # ── OS BRACOS BALANCAM (16/09) ──────────────────────────────────────────
    # O ponto mais a frente foi o Lucas que escolheu, posando o braco na sala de
    # provas (41 graus a frente, 16 para fora). A rotacao vem gravada no espaco do
    # CORPO, e nao nos eixos do osso: o importador de glTF roda os ossos por
    # dentro, e os eixos da sala nao sao os daqui.
    #   * a frente: a pose dele;  atras: metade, e SO para tras (para fora, ao
    #     recuar, o braco entrava no corpo);
    #   * cada braco ao contrario da perna do seu lado;
    #   * o braco do arco a um terco, para o arco nao sacudir.
    if _bal_braco is not None:
        for lado, amp, fase_b in (("L", 1.0, 0.0), ("R", 0.35, math.pi)):
            _Rq = _bal_braco if lado == "L" else mathutils.Quaternion(
                (_bal_braco.w, _bal_braco.x, -_bal_braco.y, -_bal_braco.z))
            _k = -math.sin(a + fase_b) * amp
            if _k >= 0:
                _Q = mathutils.Quaternion().slerp(_Rq, _k)
            else:
                _Q = mathutils.Quaternion((1, 0, 0), -_ang_frente * 0.5 * -_k)
            _M = arm.data.bones["upperarm." + lado].matrix_local.to_3x3()
            arm.pose.bones["upperarm." + lado].rotation_mode = "QUATERNION"
            poe("upperarm." + lado, q,
                rotation_quaternion=(_M.inverted() @ _Q.to_matrix() @ _M).to_quaternion())
acao = arm.animation_data.action
acao.name = "idle_walk"


def curvas_de(a):
    """as curvas de uma acao, na forma antiga e na nova (camadas/ranhuras)"""
    if hasattr(a, "fcurves") and len(a.fcurves):
        return list(a.fcurves)
    fora = []
    for camada in getattr(a, "layers", []):
        for tira in camada.strips:
            for saco in getattr(tira, "channelbags", []):
                fora.extend(saco.fcurves)
    return fora


cs = curvas_de(acao)
for fc in cs:
    for kp in fc.keyframe_points:
        kp.interpolation = "BEZIER"
# o ciclo fecha porque o quadro 25 repete o quadro 1 (o seno da a volta
# completa): nao e preciso marcar a acao como ciclica no ficheiro
print("SONDA marcha: %d quadros, %d curvas, acao '%s'" % (CICLO, len(cs), acao.name))

# ── QUAL DOS QUATRO SINAIS E QUE ANDA PARA A FRENTE ─────────────────────────
# Ha duas escolhas (coxa e joelho) e nenhuma se ve com a figura parada. Em vez
# de adivinhar, medem-se as quatro e escolhe-se pela ANATOMIA:
#   * no meio da passada o calcanhar fica ATRAS do joelho (senao o joelho esta
#     hiperextendido, e le-se como marcha de costas);
#   * e o pe balanca de forma simetrica a volta da anca.
def _medir(sc, sj):
    for i in range(CICLO + 1):
        q = 1 + i
        a = 2 * math.pi * (i / CICLO)
        for lado, fase in (("L", 0.0), ("R", math.pi)):
            coxa = math.sin(a + fase) * BALANCO
            joelho = sj * max(0.0, math.sin(a + fase + math.pi / 2)) * DOBRA
            poe("thigh." + lado, q, rotation_euler=(sc * coxa, 0, 0))
            poe("lowerleg." + lado, q, rotation_euler=(joelho, 0, 0))
            poe("foot." + lado, q, rotation_euler=(-joelho * 0.4, 0, 0))
    dep = bpy.context.evaluated_depsgraph_get()
    pes, calc = [], []
    for q in range(1, CICLO + 1):
        bpy.context.scene.frame_set(q)
        a2 = arm.evaluated_get(dep)
        pe = a2.matrix_world @ a2.pose.bones["foot.L"].tail
        joe = a2.matrix_world @ a2.pose.bones["lowerleg.L"].head
        tor = a2.matrix_world @ a2.pose.bones["foot.L"].head
        anca = a2.matrix_world @ a2.pose.bones["hips"].head
        pes.append(pe.y - anca.y)
        calc.append(tor.y - joe.y)          # tornozelo menos joelho
    return (sum(pes) / len(pes), min(pes), max(pes), min(calc), max(calc))


print("SONDA sinais  coxa joelho | pe medio  min   max | tornozelo-joelho min  max")
for _sc in (1.0, -1.0):
    for _sj in (1.0, -1.0):
        m, mn, mx, cmn, cmx = _medir(_sc, _sj)
        print("SONDA sinais  %+.0f   %+.0f    | %+.2f  %+.2f %+.2f | %+.2f %+.2f"
              % (_sc, _sj, m, mn, mx, cmn, cmx))
# fica com os sinais escolhidos em cima
_medir(SENTIDO_COXA, SENTIDO_JOELHO)

# ── O PE VAI MESMO A FRENTE? ────────────────────────────────────────────────
# "a perna nunca passa a frente do quadril" e uma afirmacao que se mede: basta
# ver, quadro a quadro, o y do pe em relacao a anca. Positivo = a frente.
_dep = bpy.context.evaluated_depsgraph_get()
_linha = []
_dois = []
for q in range(1, CICLO + 1, 3):
    bpy.context.scene.frame_set(q)
    _arm = arm.evaluated_get(_dep)
    _pe = _arm.matrix_world @ _arm.pose.bones["foot.L"].tail
    _anca = _arm.matrix_world @ _arm.pose.bones["hips"].head
    _linha.append("%+.2f" % (_pe.y - _anca.y))
    _pd = _arm.matrix_world @ _arm.pose.bones["foot.R"].tail
    _dois.append((_pe.y - _anca.y, _pd.y - _anca.y))
if TEM_HASTE:
    # ── A LANCA ANDA COM A MAO, OU COM O PE? ────────────────────────────────────
    # Este numero e o que faltava. "a ponta do pe esta colada a ponta de baixo da
    # lanca" so se via no video, e eu corrigia as cegas. Agora mede-se: segue-se a
    # MALHA JA DEFORMADA quadro a quadro -- o vertice mais baixo da haste e a ponta
    # da bota -- e ve-se quanto a distancia entre os dois VARIA no ciclo.
    #   * colados (o erro): a haste vai presa ao pe, a distancia nao mexe (~0 cm);
    #   * certos: a haste fica quieta na mao e o pe passa por baixo dela, entao a
    #     distancia abre e fecha varios centimetros a cada passada.
    _baixo = min(lanca_idx, key=lambda i: corpo.data.vertices[i].co.z)
    _dedo = min((v.index for v in corpo.data.vertices if v.index in bota_idx),
                key=lambda i: corpo.data.vertices[i].co.y)
    _ds = []
    for q in range(1, CICLO + 1, 2):
        bpy.context.scene.frame_set(q)
        _mc = corpo.evaluated_get(_dep)
        _mm = _mc.to_mesh()
        _ds.append(((_mm.vertices[_baixo].co - _mm.vertices[_dedo].co).length))
        _mc.to_mesh_clear()
    _var = max(_ds) - min(_ds)
    print("SONDA lanca x bota: distancia %.2f a %.2f m, varia %.1f cm"
          % (min(_ds), max(_ds), _var * 100))
    if _var < 0.04:
        print("SONDA AVISO: a haste mal se separa do pe (%.1f cm) -- esta presa a bota"
              % (_var * 100))

# ⚠ OS DOIS PES, e nao so um. A prova antiga so olhava o esquerdo, e por isso
# nao apanhou o arqueiro com o pe direito SEMPRE a frente. Numa marcha certa os
# dois pes vao a frente e atras por igual: a MEDIA de cada um fica perto de zero
# e as duas medias ficam iguais.
_me = sum(a for a, b in _dois) / len(_dois)
_md2 = sum(b for a, b in _dois) / len(_dois)
print("SONDA dois pes: media esq %+.2f  dir %+.2f  (diferenca %.0f cm)"
      % (_me, _md2, abs(_me - _md2) * 100))
if abs(_me - _md2) > 0.10:
    print("SONDA AVISO: um pe fica sempre mais a frente que o outro -- a passada "
          "abre sempre para o mesmo lado")
print("SONDA pe esquerdo em relacao a anca (m, + e a frente): %s"
      % " ".join(_linha))
bpy.context.scene.frame_set(1)

# ── A ARMA QUE O LUCAS DESENHOU A MAO ───────────────────────────────────────
# O arco do ComfyUI nasceu com um braco de 40 cm e outro de 75. O script tentou
# iguala-los esticando o curto 2,6 vezes, e a ponta deformou-se num bloco largo.
# O Lucas pegou no arco na sala de provas e puxou a ponta de cima ate onde queria;
# a peca dele (arco, corda e mao, tudo o que vai rigido com o antebraco) ficou em
#     ferramentas/cena/marcas/<figura>_arma_editada.json
# ja no espaco FINAL do soldado. Aqui a arma gerada sai e entra a dele.
# ⚠ So vale enquanto o corpo sair no mesmo sitio: se as juntas, a escala ou a
# pose mudarem, a mao dele deixa de bater com o braco. Por isso mede-se a
# distancia entre o centro da arma gerada e o da dele, e avisa-se.
_f_arma = os.path.join(os.getcwd(), "ferramentas", "cena", "marcas",
                       os.path.splitext(os.path.basename(ENTRADA))[0].lower() + "_arma_editada.json")
if os.path.isfile(_f_arma):
    import bmesh
    import json as _json
    _ae = _json.load(open(_f_arma, encoding="utf-8"))
    _ig = corpo.vertex_groups[_ae["osso"]].index
    _velha = [v for v in corpo.data.vertices
              if any(g.group == _ig and g.weight > 0.99 for g in v.groups)]
    _cv = (sum((v.co for v in _velha), mathutils.Vector()) / len(_velha)
           if _velha else mathutils.Vector())
    _cn = sum((mathutils.Vector(q) for q in _ae["vertices"]), mathutils.Vector()) / len(_ae["vertices"])
    _bm = bmesh.new()
    _bm.from_mesh(corpo.data)
    _bm.verts.ensure_lookup_table()
    _sai = {v.index for v in _velha}
    bmesh.ops.delete(_bm, geom=[v for v in _bm.verts if v.index in _sai], context="VERTS")
    _dl = _bm.verts.layers.deform.verify()
    _nv = []
    for q in _ae["vertices"]:
        _v = _bm.verts.new(q)
        _v[_dl][_ig] = 1.0
        _nv.append(_v)
    _bm.verts.ensure_lookup_table()
    _ca = corpo.data.color_attributes[0] if corpo.data.color_attributes else None
    _lay = None
    _usa_float = True
    if _ca is not None:
        _camadas = _bm.loops.layers if _ca.domain == "CORNER" else _bm.verts.layers
        _lay = _camadas.float_color.get(_ca.name)
        _usa_float = _lay is not None
        if _lay is None:
            _lay = _camadas.color.get(_ca.name)
    for _fi, _f in enumerate(_ae["faces"]):
        try:
            _face = _bm.faces.new([_nv[k] for k in _f])
        except ValueError:
            continue
        # ⚠ sem isto a peca saia FACETADA: as faces novas nascem planas
        _face.smooth = True
        if _lay is not None:
            for _l, _cor in zip(_face.loops, _ae["cores"][_fi]):
                # ⚠ E ESCURA: a cor foi lida em LINEAR (o que `.color` devolve), mas
                # a camada de bytes do bmesh guarda sRGB. Converte-se antes de
                # escrever; na camada de floats vai tal e qual.
                if not _usa_float:
                    _cor = [(12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055)
                            if k < 3 else x for k, x in enumerate(_cor)]
                if _ca.domain == "CORNER":
                    _l[_lay] = _cor
                else:
                    _l.vert[_lay] = _cor
    _bm.normal_update()
    _bm.to_mesh(corpo.data)
    _bm.free()
    corpo.data.update()
    print("SONDA arma editada a mao: %s (%d vertices; a gerada tinha %d) | centros a %.1f cm"
          % (os.path.basename(_f_arma), len(_ae["vertices"]), len(_velha),
             (_cv - _cn).length * 100))
    if (_cv - _cn).length > 0.08:
        print("SONDA AVISO: a arma editada esta longe da mao gerada -- o corpo mudou; "
              "a peca pode ter de ser refeita na sala")

# ── SAIR ────────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
_md = next((m for m in corpo.modifiers if m.type == "ARMATURE"), None)
_pesados = sum(1 for v in corpo.data.vertices if v.groups)
print("SONDA antes de exportar: pai=%s (tipo %s) | modificador->%s | ossos=%d "
      "| deform=%d | vertices com peso=%d/%d | objeto: loc=%s rot=%s esc=%s"
      % (corpo.parent.name if corpo.parent else "NENHUM", corpo.parent_type,
         _md.object.name if _md and _md.object else "NADA", len(arm.data.bones),
         sum(1 for b in arm.data.bones if b.use_deform), _pesados,
         len(corpo.data.vertices),
         [round(v, 2) for v in corpo.location], [round(v, 2) for v in corpo.rotation_euler],
         [round(v, 2) for v in corpo.scale]))
alvo = os.path.join(os.getcwd(), SAIDA)
# ⚠ SEM `use_selection`. Com ela, este exportador escreveu a malha e os ossos
# mas NAO a pele (`skins`) -- e uma malha com pesos e sem pele chega ao jogo
# rigida, sem um erro em lado nenhum. Um cubo de teste com dois ossos provou a
# diferenca. A cena so tem o soldado e o esqueleto, portanto exporta-se tudo.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=alvo, export_format="GLB",
                          export_yup=True, export_animations=True,
                          export_apply=False, export_cameras=False,
                          export_lights=False)
print("SONDA -> %s (%.1f MB)" % (SAIDA, os.path.getsize(alvo) / 1e6))

# ── A PROVA: A PASSADA VISTA DE PERFIL ──────────────────────────────────────
# O joelho ao contrario NAO se ve com a figura parada -- e foi assim que um
# soldado hiperextendido chegou ao mapa. Quatro quadros do ciclo, de lado, e
# o defeito salta a vista antes de sair daqui.
if os.environ.get("PROVA", "1") == "1":
    for o in list(bpy.context.scene.objects):
        if o.type not in ("MESH", "ARMATURE"):
            bpy.data.objects.remove(o, do_unlink=True)
    luz = bpy.data.lights.new("sol", "SUN")
    luz.energy = 3.2
    ol = bpy.data.objects.new("sol", luz)
    bpy.context.scene.collection.objects.link(ol)
    ol.rotation_euler = (math.radians(58), 0, math.radians(20))
    mundo = bpy.data.worlds.new("ceu")
    bpy.context.scene.world = mundo
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (.6, .68, .78, 1)
    cd = bpy.data.cameras.new("cam")
    cm = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(cm)
    bpy.context.scene.camera = cm
    mira = bpy.data.objects.new("mira", None)
    mira.location = (0, 0, H * 0.45)
    bpy.context.scene.collection.objects.link(mira)
    tt = cm.constraints.new("TRACK_TO")
    tt.target = mira
    tt.track_axis = "TRACK_NEGATIVE_Z"
    tt.up_axis = "UP_Y"
    cm.location = (H * 2.2, 0, H * 0.6)
    ce = bpy.context.scene
    ce.render.engine = "CYCLES"
    ce.cycles.samples = 24
    ce.render.resolution_x = ce.render.resolution_y = 520
    ce.view_settings.view_transform = "AgX"
    for q in (1, 7, 13, 19):
        ce.frame_set(q)
        ce.render.filepath = os.path.join(
            os.getcwd(), "ferramentas", "cena", "_saida", "passo_%02d.png" % q)
        bpy.ops.render.render(write_still=True)
    print("SONDA prova: quatro quadros de perfil em ferramentas/cena/_saida/passo_*.png")
if os.environ.get("SONDA_PELE") == "1":
    bpy.ops.export_scene.gltf(filepath=alvo.replace(".glb", "_sem_anim.glb"),
                              export_format="GLB", export_yup=True,
                              export_animations=False)
    print("SONDA -> tambem sem animacao, para comparar")
