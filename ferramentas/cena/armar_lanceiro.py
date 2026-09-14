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
if _eleita is None:
    raise SystemExit("SONDA ERRO: nao ha ilha comprida e fina -- a haste mudou")

# o eixo da haste sai da propria ilha (media + direcao principal), e nao de uma
# votacao as cegas: e a reta que a haste JA e.
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

# ⚠ HA DUAS HASTES, E A QUE SE VE NAO E A ILHA. O ComfyUI gerou a lanca duas
# vezes: uma vara SOLTA por dentro (a ilha de cima, raio 0,008 da altura) e a
# que se ve por fora, SOLDADA ao corpo na ilha grande. Marcar so a ilha deixou
# a de fora presa a perna -- na bancada viam-se duas madeiras no chao, uma certa
# e uma a seguir o pe direito. Um render das ilhas por cor mostrou isto num
# olhar: TODA a superficie visivel era da mesma ilha.
#
# A ilha serve na mesma, mas para outra coisa: da o EIXO exato da lanca, sem
# palpite nenhum. Com esse eixo, mede-se o resto da malha e a separacao e
# limpa em toda a altura -- a madeira fica a 0,010-0,014 do eixo, o corpo e a
# bota a 0,04-0,11. O corte a 0,020 apanha as duas hastes e nenhuma bota.
#
# ⚠ NAO PODE HAVER CORTE EM ALTURA. Uma primeira versao so apanhava acima do
# fundo da vara interna, a pensar que mais abaixo so havia bota -- e a PONTEIRA
# (o ultimo palmo, o que pousa ao pe da bota) ficou de fora, branca na prova da
# marca. Era exatamente esse pedaco que andava agarrado ao pe. O raio sozinho
# chega: a bota mais proxima esta a 0,04 do eixo, o dobro do corte.
RAIO_LANCA = _hb * 0.020
_marca = set(_eleita)
for _i, _q in enumerate(_co):
    _u = _q - _cen
    if (_u - _eixo * _u.dot(_eixo)).length < RAIO_LANCA:
        _marca.add(_i)

# ⚠ O CILINDRO TAMBEM APANHA A BIQUEIRA DA BOTA, que o eixo da lanca atravessa
# rente ao chao. E o erro ao contrario do anterior: em vez de madeira presa ao
# pe, fica um pedaco de PE preso a mao -- e a bota estica-se e borra a cada
# passo, que foi o que se viu na bancada.
# A madeira distingue-se por ser CONTINUA: dentro da marca, a haste e um pedaco
# unico que atravessa o modelo de alto a baixo, e a biqueira e uma mancha curta
# e solta. Entao parte-se a marca em pedacos ligados e ficam so os compridos.
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

# ── A PROVA DA MARCA: O QUE VAI SER LANCA, PINTADO ──────────────────────────
# Sem isto, a marca so se julga depois -- exportar, abrir a bancada, ver uma
# madeira a mexer com o pe. Aqui pinta-se de vermelho o que foi marcado e
# renderiza-se ANTES de reduzir: se sobrar madeira cinzenta, ela vai ficar
# presa a perna, e ve-se aqui em vez de no video.
if os.environ.get("PROVA_LANCA", "1") == "1":
    _ca = corpo.data.color_attributes.new(name="MARCA", type="FLOAT_COLOR",
                                          domain="POINT")
    for _i in range(len(corpo.data.vertices)):
        _ca.data[_i].color = ((0.95, 0.15, 0.10, 1.0) if _i in _marca
                              else (0.72, 0.72, 0.72, 1.0))
    _mat = bpy.data.materials.new("marca")
    _mat.use_nodes = True
    _nt = _mat.node_tree
    _b = next(n for n in _nt.nodes if n.type == "BSDF_PRINCIPLED")
    _at = _nt.nodes.new("ShaderNodeVertexColor")
    _at.layer_name = "MARCA"
    _nt.links.new(_at.outputs["Color"], _b.inputs["Base Color"])
    _b.inputs["Roughness"].default_value = 0.9
    _guarda = list(corpo.data.materials)
    corpo.data.materials.clear()
    corpo.data.materials.append(_mat)
    _ce = bpy.context.scene
    _luz = bpy.data.lights.new("l", "SUN")
    _luz.energy = 2.8
    _ol = bpy.data.objects.new("l", _luz)
    _ce.collection.objects.link(_ol)
    _ol.rotation_euler = (math.radians(55), 0, math.radians(25))
    _ce.world = bpy.data.worlds.new("w")
    _ce.world.use_nodes = True
    _ce.world.node_tree.nodes["Background"].inputs["Color"].default_value =         (.93, .93, .93, 1)
    _cd = bpy.data.cameras.new("c")
    _cm = bpy.data.objects.new("c", _cd)
    _ce.collection.objects.link(_cm)
    _ce.camera = _cm
    _mira = bpy.data.objects.new("m", None)
    _ce.collection.objects.link(_mira)
    _tt = _cm.constraints.new("TRACK_TO")
    _tt.target = _mira
    _tt.track_axis = "TRACK_NEGATIVE_Z"
    _tt.up_axis = "UP_Y"
    _ce.render.engine = "CYCLES"
    _ce.cycles.samples = 20
    _ce.render.resolution_x = _ce.render.resolution_y = 720
    _ce.view_settings.view_transform = "Standard"
    _zb = min(q.z for q in _co)
    for _nome, _mz, _d in (("todo", 0.50, 2.0), ("pes", 0.10, 0.55)):
        _mira.location = (0, 0, _zb + _hb * _mz)
        _cm.location = (_hb * _d, 0, _zb + _hb * (_mz + _d * 0.15))
        _ce.render.filepath = os.path.join(os.getcwd(), "ferramentas", "cena",
                                           "_saida", "marca_lanca_%s.png" % _nome)
        bpy.ops.render.render(write_still=True)
    corpo.data.materials.clear()
    for _m in _guarda:
        corpo.data.materials.append(_m)
    corpo.data.color_attributes.remove(_ca)
    bpy.data.objects.remove(_ol, do_unlink=True)
    bpy.data.objects.remove(_cm, do_unlink=True)
    bpy.data.objects.remove(_mira, do_unlink=True)
    print("SONDA prova da marca: _saida/marca_lanca_{todo,pes}.png "
          "(vermelho = vai com a mao)")

_gl = corpo.vertex_groups.new(name="LANCA")
_gl.add(sorted(_marca), 1.0, "REPLACE")
print("SONDA lanca: vara solta %d vertices (comprida/fina = %.1f) + haste "
      "visivel %d = %d no total"
      % (len(_eleita), _nota, len(_marca) - len(_eleita), len(_marca)))

# ⚠ UM GRUPO DE VERTICES NAO ATRAVESSA O `Decimate` INTEIRO. O redutor junta
# vertices e faz a MEDIA dos pesos: dos 3037 marcados sobravam 25 acima de 0,5,
# e a haste voltava a ficar solta. Por isso a lanca sai da malha para um objeto
# SEU, cada um reduz-se por si, e depois juntam-se outra vez -- a juncao guarda
# os grupos tal e qual, e a marca fica exata (peso 1,0) na malha pequena.
bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
bpy.context.view_layer.objects.active = corpo
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for _i in _marca:
    corpo.data.vertices[_i].select = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="SELECTED")
bpy.ops.object.mode_set(mode="OBJECT")
lanca = [o for o in bpy.context.selected_objects if o is not corpo][0]
lanca.name = "lanca"

corpo.data.calc_loop_triangles()
lanca.data.calc_loop_triangles()
antes = len(corpo.data.loop_triangles) + len(lanca.data.loop_triangles)
if TRIANGULOS and antes > TRIANGULOS:
    # a mesma razao nos dois, para a haste nao ficar grossa ao pe de um corpo fino
    for _ob in (corpo, lanca):
        md = _ob.modifiers.new("reduzir", "DECIMATE")
        md.ratio = TRIANGULOS / antes
        bpy.context.view_layer.objects.active = _ob
        bpy.ops.object.modifier_apply(modifier=md.name)
bpy.ops.object.select_all(action="DESELECT")
corpo.select_set(True)
lanca.select_set(True)
bpy.context.view_layer.objects.active = corpo
bpy.ops.object.join()
corpo.data.calc_loop_triangles()
print("SONDA malha: %d -> %d triangulos" % (antes, len(corpo.data.loop_triangles)))

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
_ig = corpo.vertex_groups["LANCA"].index
lanca_idx = set()
for v in corpo.data.vertices:
    for g in v.groups:
        if g.group == _ig and g.weight > 0.5:
            lanca_idx.add(v.index)
if len(lanca_idx) < 40:
    raise SystemExit("SONDA ERRO: a marca da lanca nao sobreviveu ao Decimate "
                     "(%d vertices)" % len(lanca_idx))
_zs = [corpo.data.vertices[i].co.z for i in lanca_idx]
print("SONDA lanca: %d vertices depois de reduzir, de z=%.2f a z=%.2f"
      % (len(lanca_idx), min(_zs), max(_zs)))
corpo.vertex_groups.remove(corpo.vertex_groups["LANCA"])

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
APERTO_PERNAS = 0.76
_z_anca = (z_cabeca - z0) * 0.52
_z_coxa = (z_cabeca - z0) * 0.42
for _v in corpo.data.vertices:
    if _v.co.z >= _z_anca:
        continue
    _t = 1.0 if _v.co.z <= _z_coxa else (_z_anca - _v.co.z) / (_z_anca - _z_coxa)
    _v.co.x *= 1.0 - (1.0 - APERTO_PERNAS) * _t

_pj = _pernas_cruas_centrada(0.30) or _pernas_cruas_centrada(0.24)
FRACAO_PERNA = (_pj[1] - _pj[0]) / 2 / (z_cabeca - z0) if _pj else _antes_pernas * APERTO_PERNAS
print("SONDA pernas apertadas: %.3f -> %.3f da altura (%.0f cm -> %.0f cm num "
      "homem de %.1f m)" % (_antes_pernas, FRACAO_PERNA,
                            _antes_pernas * 2 * ALTURA_M * 100,
                            FRACAO_PERNA * 2 * ALTURA_M * 100, ALTURA_M))
corpo.data.transform(mathutils.Matrix.Scale(k, 4))
H = ALTURA_M
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
    osso("thigh." + lado, (s * x_anca, 0, H * 0.50), (s * x_perna, 0, H * 0.27), "hips")
    osso("lowerleg." + lado, (s * x_perna, 0, H * 0.27), (s * x_torno, 0, H * 0.07),
         "thigh." + lado)
    osso("foot." + lado, (s * x_torno, 0, H * 0.07), (s * x_torno, H * 0.09, H * 0.01),
         "lowerleg." + lado)
    osso("upperarm." + lado, (s * x_ombro, 0, H * 0.78), (s * x_ombro * 1.1, 0, H * 0.62),
         "chest")
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

pesos = []
for v in corpo.data.vertices:
    if v.index in lanca_idx:
        pesos.append({"upperarm.R": 1.0})
        continue
    if v.index in bota_idx:
        pesos.append({bota_idx[v.index]: 1.0})
        continue
    ds = sorted(((_dist_ao_osso(v.co, a, b), n) for n, a, b in ossos))[:2]
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
        if i in lanca_idx or i in bota_idx or not vizinhos[i]:
            novos.append(p_i)
            continue
        soma = dict(p_i)
        for j in vizinhos[i]:
            for nome, w in pesos[j].items():
                soma[nome] = soma.get(nome, 0.0) + w
        total = sum(soma.values()) or 1.0
        novos.append({n: w / total for n, w in soma.items() if w / total > 0.02})
    pesos = novos

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
for q in range(1, CICLO + 1, 3):
    bpy.context.scene.frame_set(q)
    _arm = arm.evaluated_get(_dep)
    _pe = _arm.matrix_world @ _arm.pose.bones["foot.L"].tail
    _anca = _arm.matrix_world @ _arm.pose.bones["hips"].head
    _linha.append("%+.2f" % (_pe.y - _anca.y))
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

print("SONDA pe esquerdo em relacao a anca (m, + e a frente): %s"
      % " ".join(_linha))
bpy.context.scene.frame_set(1)

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
