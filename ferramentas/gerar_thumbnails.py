#!/usr/bin/env python3
# gerar_thumbnails.py — 2 THUMBNAILS por partida, SEM IA de imagem.
#
# Uso:  python ferramentas/gerar_thumbnails.py E1010-02
#       python ferramentas/gerar_thumbnails.py E1010-02 --gancho "22 of 24 villages." --turno 12
#
# Sai em thumbnails/<id>_A_mapa.png e thumbnails/<id>_B_placar.png (1280x720,
# pasta fora do git: imagem fica so no disco). Tudo vem de site/dados/:
#   replay_<id>.json  o frame do replay (aldeias, donos, tropas, marchas, combates)
#   mapa.json         onde fica cada aldeia
#   partidas.json     modelos A/B, vencedor, turnos
# e da arte do site (mapa_arte.jpg, brasoes). O texto do gancho vem do
# --gancho; sem ele, sai uma frase calculada do placar final.
#
#   A_mapa    o MAPA no turno mais dramatico (ou --turno): aldeias coloridas
#             pelo dono, colunas em marcha, gancho grande em cima, placar em baixo
#   B_placar  o PLACAR: dois brasoes, os numeros de aldeias, o gancho, e o mapa
#             do turno final esmaecido por tras
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "site", "dados")
ARTE = os.path.join(RAIZ, "site", "assets")
W, H = 1280, 720
S = 2                                   # supersampling: desenha a 2x e reduz
COR_A, COR_A2 = (91, 154, 216), (47, 93, 138)
COR_B, COR_B2 = (207, 90, 85), (155, 47, 44)
OURO, FUNDO, CREME = (224, 176, 74), (18, 16, 12), (247, 239, 221)
FONTES = {
    "titulo": ["C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf"],
    "corpo": ["C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/arialbd.ttf"],
}


def fonte(tipo, tam):
    for caminho in FONTES[tipo]:
        if os.path.exists(caminho):
            return ImageFont.truetype(caminho, int(tam * S))
    return ImageFont.load_default()


def curto(modelo):
    """'nvidia/nemotron-3-super-120b-a12b:free' -> 'nemotron-3-super-120b-a12b'."""
    return modelo.split("/")[-1].split(":")[0]


def carregar(pid):
    def j(nome):
        with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
            return json.load(f)
    partida = next((p for p in j("partidas.json") if p["id"] == pid), None)
    if not partida:
        sys.exit("partida %s nao esta em site/dados/partidas.json" % pid)
    return partida, j("replay_%s.json" % pid), j("mapa.json")


def pontos(frame, row):
    return sum(row[2:5])


def aldeias(frame, dono):
    return sum(1 for r in frame["a"] if r[1] == dono)


def drama(frame):
    """Pontua um turno: conquistas pesam mais que combates; marchas desempatam."""
    ev = [e for e in frame.get("e", []) if e.get("tipo") == "combate"]
    return 3 * sum(1 for e in ev if e.get("conquista")) + len(ev) + 0.2 * len(frame.get("m", []))


def turno_dramatico(rep):
    # ignora o turno 0 e o ultimo (o mapa final ja e o do placar)
    quadros = rep["frames"][1:-1] or rep["frames"]
    return max(quadros, key=drama)


def ponto_no_caminho(mapa, caminho, frac):
    pts = [mapa["cidades"][i] for i in caminho if i < len(mapa["cidades"])]
    if len(pts) < 2:
        return None
    segs = [((b["x"] - a["x"]) ** 2 + (b["y"] - a["y"]) ** 2) ** 0.5 for a, b in zip(pts, pts[1:])]
    alvo, acc = sum(segs) * max(0.0, min(1.0, frac)), 0.0
    for i, d in enumerate(segs):
        if acc + d >= alvo or i == len(segs) - 1:
            f = (alvo - acc) / d if d else 0
            return (pts[i]["x"] + (pts[i + 1]["x"] - pts[i]["x"]) * f,
                    pts[i]["y"] + (pts[i + 1]["y"] - pts[i]["y"]) * f)
        acc += d
    return None


def base_mapa(mapa, frame, esmaecer=0.0):
    """Mapa do frame, 'cover' em largura, centrado na vertical. Devolve RGBA W*S x H*S."""
    vx, vy, vw, vh = [float(v) for v in str(mapa["viewBox"]).split()]
    k = W * S / vw                                   # unidades do mapa -> pixels
    off_y = (vh * k - H * S) / 2                     # corte vertical (centrado)
    arte = Image.open(os.path.join(ARTE, "mapa_arte.jpg")).convert("RGB")
    # a arte esta ancorada em (130,144) com largura 1429 (igual ao site/partida.html)
    esc = 1429 * k / arte.width
    arte = arte.resize((int(arte.width * esc), int(arte.height * esc)), Image.LANCZOS)
    img = Image.new("RGB", (W * S, H * S), FUNDO)
    img.paste(arte, (int((130 - vx) * k), int((144 - vy) * k - off_y)))
    img = Image.blend(img, Image.new("RGB", img.size, FUNDO), 0.28 + esmaecer)
    d = ImageDraw.Draw(img, "RGBA")

    def P(x, y):
        return ((x - vx) * k, (y - vy) * k - off_y)

    cid = mapa["cidades"]
    for e in mapa["estradas"]:
        pts = [(cid[e["a"]]["x"], cid[e["a"]]["y"])] + [tuple(v) for v in e.get("via", [])] \
            + [(cid[e["b"]]["x"], cid[e["b"]]["y"])]
        d.line([P(*p) for p in pts], fill=(214, 190, 140, 120), width=int(2.2 * S), joint="curve")
    # colunas em marcha (losango do rei, como no site)
    for m in frame.get("m", []):
        dono, ori, dst, l, a, c, rest, tot, cam = m
        frac = (tot - rest + 0.55) / tot if tot else 0.5
        p = ponto_no_caminho(mapa, cam if cam else [ori, dst], max(0.14, min(0.86, frac)))
        if not p:
            continue
        x, y = P(*p)
        r = min(15, 8 + (l + a + c) ** 0.5 * 1.6) * S
        d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)],
                  fill=(COR_A2 if dono == "A" else COR_B2) + (240,),
                  outline=(COR_A if dono == "A" else COR_B) + (255,), width=int(2 * S))
    # combates do turno: aro dourado
    for e in frame.get("e", []):
        if e.get("tipo") == "combate" and e.get("alvoId") is not None:
            c = cid[e["alvoId"]]
            x, y = P(c["x"], c["y"])
            r = 36 * S
            d.ellipse([x - r, y - r, x + r, y + r],
                      outline=OURO + (255 if e.get("conquista") else 170,), width=int(3.5 * S))
    # aldeias
    fn = fonte("corpo", 17)
    for row in frame["a"]:
        i, dono = row[0], row[1]
        c = cid[i]
        x, y = P(c["x"], c["y"])
        n = pontos(frame, row)
        r = (14 + min(18, n ** 0.5 * 2.2)) * S
        cor = COR_A2 if dono == "A" else (COR_B2 if dono == "B" else (58, 50, 42))
        borda = OURO if c.get("papel") == "capital" else (COR_A if dono == "A" else COR_B if dono == "B" else (110, 100, 88))
        d.ellipse([x - r, y - r, x + r, y + r], fill=cor + (235,), outline=borda + (255,),
                  width=int((4 if c.get("papel") == "capital" else 2.5) * S))
        if n:
            d.text((x, y), str(n), font=fn, fill=CREME, anchor="mm", stroke_width=S, stroke_fill=FUNDO)
    return img.convert("RGBA")


def gradiente(img, y0, y1, a0, a1):
    """Faixa escura com opacidade a0->a1 entre y0 e y1 (coordenadas em pixels finais)."""
    cam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(cam)
    for y in range(int(y0 * S), int(y1 * S)):
        t = (y - y0 * S) / max(1, (y1 - y0) * S)
        d.line([(0, y), (img.width, y)], fill=FUNDO + (int(a0 + (a1 - a0) * t),))
    return Image.alpha_composite(img, cam)


def quebrar(d, texto, f, largura):
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = (atual + " " + palavra).strip()
        if d.textlength(teste, font=f) <= largura * S or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def texto_gancho(img, gancho, y, tam=92, largura=1180):
    d = ImageDraw.Draw(img)
    f = fonte("titulo", tam)
    linhas = quebrar(d, gancho.upper(), f, largura)
    while len(linhas) > 3 and tam > 40:
        tam -= 6
        f = fonte("titulo", tam)
        linhas = quebrar(d, gancho.upper(), f, largura)
    for i, ln in enumerate(linhas):
        d.text((40 * S, (y + i * tam * 1.05) * S), ln, font=f, fill=CREME,
               stroke_width=int(5 * S), stroke_fill=FUNDO)
    return y + len(linhas) * tam * 1.05


def faixa_placar(img, nomeA, nomeB, nA, nB, turno, total, venc):
    d = ImageDraw.Draw(img, "RGBA")
    y0 = 604
    d.rectangle([0, y0 * S, W * S, H * S], fill=FUNDO + (225,))
    d.line([(0, y0 * S), (W * S, y0 * S)], fill=OURO + (255,), width=3 * S)
    fm, fn = fonte("corpo", 26), fonte("titulo", 74)
    d.rectangle([0, y0 * S + 3 * S, 14 * S, H * S], fill=COR_A)
    d.rectangle([(W - 14) * S, y0 * S + 3 * S, W * S, H * S], fill=COR_B)
    d.text((40 * S, 640 * S), nomeA, font=fm, fill=COR_A, anchor="lm")
    d.text((40 * S, 690 * S), "Rei A" + ("  ·  VENCEU" if venc == "A" else ""), font=fonte("corpo", 20), fill=CREME, anchor="lm")
    d.text(((W - 40) * S, 640 * S), nomeB, font=fm, fill=COR_B, anchor="rm")
    d.text(((W - 40) * S, 690 * S), ("VENCEU  ·  " if venc == "B" else "") + "Rei B", font=fonte("corpo", 20), fill=CREME, anchor="rm")
    d.text((W / 2 * S - 70 * S, 660 * S), str(nA), font=fn, fill=COR_A, anchor="rm", stroke_width=S * 2, stroke_fill=FUNDO)
    d.text((W / 2 * S + 70 * S, 660 * S), str(nB), font=fn, fill=COR_B, anchor="lm", stroke_width=S * 2, stroke_fill=FUNDO)
    d.text((W / 2 * S, 660 * S), "x", font=fonte("corpo", 34), fill=OURO, anchor="mm")
    d.text((W / 2 * S, 706 * S), "turno %d" % turno, font=fonte("corpo", 17), fill=(195, 178, 145), anchor="mm")


def brasao(nome, tam):
    im = Image.open(os.path.join(ARTE, nome)).convert("RGBA")
    return im.resize((int(tam * S), int(tam * S)), Image.LANCZOS)


def final(img, caminho):
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(caminho, "PNG", optimize=True)
    print("ok", caminho)


def gancho_auto(partida, frame):
    nA, nB = aldeias(frame, "A"), aldeias(frame, "B")
    venc = partida.get("venc") or ("A" if nA >= nB else "B")
    vence, perde = (nA, nB) if venc == "A" else (nB, nA)
    nome = curto(partida[venc])
    return "%d of 24 villages. %s took the peninsula." % (vence, nome) if perde <= 4 else \
        "%d vs %d. %s won the war for Iberia." % (vence, perde, nome)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("partida", help="id da partida, ex.: E1010-02")
    ap.add_argument("--gancho", help="texto do gancho (por omissao, calculado do placar)")
    ap.add_argument("--turno", type=int, help="turno do mapa na thumbnail A (por omissao, o mais dramatico)")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "thumbnails"))
    a = ap.parse_args()

    partida, rep, mapa = carregar(a.partida)
    quadros = rep["frames"]
    ult = quadros[-1]
    if a.turno is not None:
        fr = next((q for q in quadros if q["t"] == a.turno), None)
        if not fr:
            sys.exit("turno %d nao existe (0..%d)" % (a.turno, ult["t"]))
    else:
        fr = turno_dramatico(rep)
    nA, nB = aldeias(ult, "A"), aldeias(ult, "B")
    venc = partida.get("venc") or ("A" if nA > nB else "B" if nB > nA else None)
    gancho = a.gancho or gancho_auto(partida, ult)
    nomeA, nomeB = curto(partida["A"]), curto(partida["B"])
    os.makedirs(a.saida, exist_ok=True)

    # ── A: o mapa no turno dramatico ───────────────────────────────────
    img = base_mapa(mapa, fr)
    img = gradiente(img, 0, 330, 235, 0)
    texto_gancho(img, gancho, 22)
    faixa_placar(img, nomeA, nomeB, aldeias(fr, "A"), aldeias(fr, "B"), fr["t"], ult["t"], None)
    final(img, os.path.join(a.saida, "%s_A_mapa.png" % a.partida))

    # ── B: o placar final, com o mapa final esmaecido ──────────────────
    img = base_mapa(mapa, ult, esmaecer=0.38).filter(ImageFilter.GaussianBlur(3 * S))
    img = gradiente(img, 0, H, 150, 190)
    d = ImageDraw.Draw(img, "RGBA")
    ba, bb = brasao("brasao_reiA_azul.png", 250), brasao("brasao_reiB_vermelho.png", 250)
    img.alpha_composite(ba, (130 * S, 215 * S))
    img.alpha_composite(bb, ((W - 130 - 250) * S, 215 * S))
    fn = fonte("titulo", 190)
    d.text((W / 2 * S - 35 * S, 335 * S), str(nA), font=fn, fill=COR_A, anchor="rm", stroke_width=6 * S, stroke_fill=FUNDO)
    d.text((W / 2 * S + 35 * S, 335 * S), str(nB), font=fn, fill=COR_B, anchor="lm", stroke_width=6 * S, stroke_fill=FUNDO)
    d.text((W / 2 * S, 470 * S), "VILLAGES HELD", font=fonte("corpo", 26), fill=OURO, anchor="mm")
    texto_gancho(img, gancho, 22, tam=70)
    d.text((130 * S + 125 * S, 500 * S), nomeA, font=fonte("corpo", 24), fill=COR_A, anchor="mm")
    d.text(((W - 130 - 125) * S, 500 * S), nomeB, font=fonte("corpo", 24), fill=COR_B, anchor="mm")
    d.text((W / 2 * S, 650 * S), "%s  ·  %d turns" % (a.partida, ult["t"]), font=fonte("corpo", 22),
           fill=(195, 178, 145), anchor="mm")
    if venc:
        x = 130 + 125 if venc == "A" else W - 130 - 125
        d.text((x * S, 540 * S), "WINNER", font=fonte("titulo", 40), fill=OURO, anchor="mm",
               stroke_width=2 * S, stroke_fill=FUNDO)
    final(img, os.path.join(a.saida, "%s_B_placar.png" % a.partida))


if __name__ == "__main__":
    main()
