# maquete.py — o mapa do jogo INTEIRO com as peças novas, para se decidir.
#
#   python ferramentas/ilha3d/maquete.py [ilha.png] [saida.jpg]
#
# Não é o jogo: é uma montagem em PIL com a ilha renderizada, as estradas reais
# do world-iberia.js e as peças do pecas.py assentes nas âncoras verdadeiras.
# Existe porque nenhuma das peças se julga sozinha — a ilha parecia boa isolada e
# só ao lado da pintura antiga se viu que lhe faltava grão; as peças parecem boas
# em fundo escuro e é sobre o mapa que se vê se ficam legíveis.
#
# As estradas são desenhadas AQUI de propósito, num tratamento diferente do
# jogo: sombra, encaixe escuro, leito claro e um veio ao meio. É a proposta de
# "melhorar as estradas" — o jogo hoje empilha sprites de pedra ao longo do
# traço, e ao longe elas viram uma corrente de contas.
import json
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
GALERIA = os.path.join(AQUI, "galeria")
PECAS = os.path.join(AQUI, "_saida", "pecas")

# modo "antigo": a MESMA montagem com o material que o jogo usa hoje. Serve
# para comparar em condições iguais — a maquete nova sozinha favorece-se, porque
# o jogo real desenha mais coisas por cima (bandeiras, painéis, números).
ANTIGO = "--antigo" in sys.argv
livres = [a for a in sys.argv[1:] if not a.startswith("--")]
ILHA = livres[0] if livres else os.path.join(
    AQUI, "_saida", "ilha_v3.png") if not ANTIGO else os.path.join(RAIZ, "assets/ilha-recortada.png")
if ANTIGO and not livres:
    ILHA = os.path.join(RAIZ, "assets/ilha-recortada.png")
NOME = livres[1] if len(livres) > 1 else ("12b_maquete_hoje.jpg" if ANTIGO else "12_maquete.jpg")

ESC, OX, OY = 1.17613, 130.0, 144.0
SS = 3                                   # supra-amostragem das estradas
LEVANTA = 0.30                           # IB.levanta do index.html

M = json.loads(subprocess.run(
    ["node", "-e", "const W=require('./world-iberia.js');console.log(JSON.stringify("
     "{c:W.CIDADES,e:W.ESTRADAS}))"],
    capture_output=True, text=True, check=True, cwd=RAIZ).stdout)
CID = {c["id"]: c for c in M["c"]}


def px(x, y):
    return ((x - OX) / ESC, (y - OY) / ESC)


# ---- o fundo: a ilha sobre o mar do jogo ------------------------------------
ilha = Image.open(ILHA).convert("RGBA")
W, H = ilha.size
agua = Image.open(os.path.join(RAIZ, "assets/agua-textura.png")).convert("RGB")
fundo = Image.new("RGB", (W, H))
for y in range(0, H, agua.size[1]):
    for x in range(0, W, agua.size[0]):
        fundo.paste(agua, (x, y))
fundo = Image.blend(fundo, Image.new("RGB", (W, H), (40, 86, 96)), 0.25)
fundo.paste(ilha, (0, 0), ilha)
mapa = fundo.convert("RGBA")


# ---- as estradas ------------------------------------------------------------
def suavizar(pts, n=14):
    """Catmull-Rom: o traço passa pelos pontos e não corta esquinas.

    O jogo liga os pontos com retas e nos nós vê-se o canto. Numa estrada, o
    canto é o que mais denuncia que aquilo foi desenhado por um computador.
    """
    if len(pts) < 3:
        return pts
    ext = [pts[0]] + list(pts) + [pts[-1]]
    saida = []
    for i in range(len(ext) - 3):
        p0, p1, p2, p3 = ext[i:i + 4]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            saida.append((
                0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)))
    saida.append(pts[-1])
    return saida


def serpentear(pts, amp=5.0, onda=0.055):
    """desvia o traço na perpendicular, com uma onda longa ao longo do caminho.

    Uma estrada medieval contorna o que lhe aparece à frente. Reta perfeita entre
    duas cidades é a marca mais visível de que aquilo foi traçado num computador,
    e nenhuma quantidade de textura a disfarça.
    """
    if len(pts) < 3:
        return pts
    saida, s_acum = [], 0.0
    for i, (x, y) in enumerate(pts):
        if i:
            s_acum += math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
        j0, j1 = max(0, i - 1), min(len(pts) - 1, i + 1)
        dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        L = max(math.hypot(dx, dy), 1e-6)
        # a ponta cola na cidade: sem isto a estrada nasce ao lado da porta
        beira = min(i, len(pts) - 1 - i) / max(1.0, len(pts) * 0.22)
        k = min(1.0, beira)
        d = (math.sin(s_acum * onda) * 0.7 + math.sin(s_acum * onda * 2.3 + 1.1) * 0.3) * amp * k
        saida.append((x - dy / L * d, y + dx / L * d))
    return saida


tracos = []
for e in M["e"]:
    a, b = CID.get(e["de"]), CID.get(e["para"])
    if not a or not b:
        continue
    pts = [px(a["x"], a["y"])]
    for v in e.get("via", []):
        pts.append(px(v[0], v[1]))
    pts.append(px(b["x"], b["y"]))
    sua = suavizar(pts)
    tracos.append((sua if ANTIGO else serpentear(sua), e.get("custo", 1)))

tela = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
dr = ImageDraw.Draw(tela)


def passada(cor, larg, desl=(0, 0)):
    for pts, custo in tracos:
        p = [((x + desl[0]) * SS, (y + desl[1]) * SS) for x, y in pts]
        principal = custo <= 1.5
        dr.line(p, fill=cor, width=int(larg * SS * (1.0 if principal else 0.78)),
                joint="curve")


if ANTIGO:
    # o traço do jogo hoje (desenharEstradasTraco): duas passadas, sem sombra
    passada((62, 48, 32, 107), 6.0)
    passada((217, 196, 154, 255), 3.7)
else:
    passada((26, 20, 12, 62), 8.0, (0, 1.6))    # a sombra que assenta a estrada no chão
    passada((50, 38, 24, 175), 6.2)             # o encaixe escuro
    passada((192, 168, 122, 230), 3.9)          # o leito de terra batida
    passada((220, 200, 156, 180), 1.5)          # o veio claro do meio, de tanto passar
estradas = tela.resize((W, H), Image.LANCZOS)
mapa = Image.alpha_composite(mapa, estradas)

# ---- as peças ---------------------------------------------------------------
CACHE = {}


def peca(nome, larg):
    chave = (nome, larg)
    if chave in CACHE:
        return CACHE[chave]
    cam = (os.path.join(RAIZ, "assets/sprites", nome + ".png") if ANTIGO
           else os.path.join(PECAS, nome + ".png"))
    im = Image.open(cam).convert("RGBA")
    im = im.crop(im.getbbox())
    im = im.resize((larg, max(1, int(im.size[1] * larg / im.size[0]))), Image.LANCZOS)
    CACHE[chave] = im
    return im


# de trás para a frente, senão uma cidade do norte tapa uma do sul
for c in sorted(M["c"], key=lambda c: c["y"]):
    x, y = px(c["x"], c["y"])
    dl = c.get("desloc") or [0, 0]
    x += dl[0] / ESC
    y += dl[1] / ESC
    capital = c.get("papel") == "capital"
    if ANTIGO:
        im = peca("castelo" if capital else "torre_base", 82 if capital else 52)
    else:
        im = peca("castelo_v3" if capital else "torre_v3", 82 if capital else 52)
    # a mesma regra do jogo: a arte sobe LEVANTA da própria altura acima da âncora
    mapa.alpha_composite(im, (int(x - im.size[0] / 2),
                              int(y - im.size[1] * (1.0 - LEVANTA))))

destino = os.path.join(GALERIA, NOME)
mapa.convert("RGB").save(destino, quality=94)
print(destino, mapa.size, "|", len(tracos), "estradas,", len(M["c"]), "cidades")
