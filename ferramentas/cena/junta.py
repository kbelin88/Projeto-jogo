# junta.py — o portao com os panos vizinhos, de varios angulos.
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#       -noaudio -P ferramentas/cena/junta.py -- [lado_px] [amostras]
#
# POR QUE: uma brecha entre duas pecas pode estar em ANGULO (visivel de cima) ou
# em PROFUNDIDADE (visivel so de lado). A verificacao do `muralha()` so sabe ver
# a primeira. Esta ferramenta poe as pecas vizinhas sozinhas e roda a camara a
# volta delas, que e a unica forma de ver a segunda.
import math, os, sys, time
import bpy
sys.path.append(os.path.join(os.getcwd(), "ferramentas", "cena"))
import pecas as P

ARGS = [a for a in (sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []) if a.isdigit()]
LADO = int(ARGS[0]) if ARGS else 760
AMOSTRAS = int(ARGS[1]) if len(ARGS) > 1 else 90
SAIDA = os.path.join(os.getcwd(), "ferramentas", "cena", "_saida", "junta")
os.makedirs(SAIDA, exist_ok=True)

RAIO = 34.0
t0 = time.time()
for rot, giro, inclina in (("cima", 45, 62), ("lado", 45, 22),
                           ("fora", 118, 30), ("dentro", -62, 30)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P._mats.clear(); P.LIXO = None
    MURO = P.proto_muro(4.4, 4.4)
    PORTAO = P.proto_casa_portao(16.0, 5.2)
    FOLHA = P.proto_folha_portao(5.2, 4.8)
    m_p = math.asin(PORTAO.get("encaixe", PORTAO.dimensions.x) / 2 / RAIO)
    m_m = math.asin(MURO.get("encaixe", MURO.dimensions.x) / 2 / RAIO)
    P.onde(PORTAO, RAIO, 0.0, 0.0, math.pi/2)
    for lado in (-1, 1):
        for k in range(3):
            a = lado * (m_p + m_m * (2*k + 1))
            P.onde(MURO, RAIO*math.cos(a), RAIO*math.sin(a), 0.0, a + math.pi/2)
    for lado in (-1, 1):
        hx = RAIO + math.cos(math.pi/2) * lado * 2.6
        hy = 0.0 + math.sin(math.pi/2) * lado * 2.6
        P.onde(FOLHA, hx, hy, 0.0, (math.pi/2 if lado < 0 else math.pi/2 + math.pi))
    bpy.ops.mesh.primitive_plane_add(size=200, location=(RAIO, 0, -0.02))
    P._novo(bpy.context.object, "relva", 0)

    cena = bpy.context.scene
    bpy.ops.object.light_add(type="SUN", location=(RAIO, 0, 90))
    sol = bpy.context.object
    sol.data.energy = 4.6; sol.data.angle = 0.06
    sol.rotation_euler = (math.pi/2 - math.radians(38), 0.0, 2.2)
    mundo = bpy.data.worlds.new("ceu"); cena.world = mundo; mundo.use_nodes = True
    f = mundo.node_tree.nodes["Background"]
    f.inputs["Color"].default_value = (0.44, 0.52, 0.62, 1.0)
    f.inputs["Strength"].default_value = 1.0

    inc, gir, D, Q = math.radians(inclina), math.radians(giro), 160.0, 42.0
    bpy.ops.object.camera_add(
        location=(RAIO + D*math.sin(inc)*math.sin(gir), -D*math.sin(inc)*math.cos(gir),
                  6.0 + D*math.cos(inc)),
        rotation=(inc, 0, gir))
    cam = bpy.context.object
    cam.data.type = "ORTHO"; cam.data.ortho_scale = Q
    cam.data.clip_start, cam.data.clip_end = 1.0, 500.0
    cena.camera = cam
    bpy.ops.preferences.addon_enable(module="cycles")
    cena.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ("OPTIX", "CUDA"):
        try: prefs.compute_device_type = tipo
        except Exception: continue
        prefs.get_devices()
        if any(x.type == tipo for x in prefs.devices):
            for dev in prefs.devices: dev.use = dev.type in (tipo, "CPU")
            cena.cycles.device = "GPU"; break
    cena.cycles.samples = AMOSTRAS; cena.cycles.use_denoising = True
    cena.render.resolution_x = cena.render.resolution_y = LADO
    cena.view_settings.view_transform = "AgX"
    cena.render.filepath = os.path.join(SAIDA, rot + ".png")
    bpy.ops.render.render(write_still=True)
print("SONDA junta: 4 angulos em %s (%.1f s)" % (SAIDA, time.time()-t0))
