# manifesto.py — junta os .json de cada sprite num so, para o jogo ler de uma vez.
#
#   python ferramentas/cena/manifesto.py
#
# POR QUE UM SO: sao 72 sprites e 72 ficheiros. O jogo precisa de saber a ANCORA
# de cada povoacao antes de a desenhar, e 72 pedidos ao servidor por causa de
# dois numeros e desperdicio. As tres cores da mesma cidade partilham o mesmo
# desenho, portanto a ancora e uma so por cidade.
#
# E POR QUE A ANCORA TEM DE VIAJAR: o jogo assenta um sprite pelo FUNDO da
# imagem. O chao da nossa aldeia nao esta no fundo — o disco isometrico continua
# para baixo dele — portanto o ponto que tem de cair na posicao da cidade esta a
# uns 40% da altura. Sem este numero a aldeia flutua acima do cruzamento das
# estradas, que foi exatamente o que aconteceu.
import glob
import json
import os

RAIZ = os.getcwd()
PASTA = os.path.join(RAIZ, "assets", "sprites")
saida = {}
for cam in sorted(glob.glob(os.path.join(PASTA, "aldeia_*.json"))):
    nome = os.path.splitext(os.path.basename(cam))[0]
    if nome.endswith("_quadro") or nome.startswith("_bruto"):
        continue
    cidade = "_".join(nome.split("_")[1:])
    d = json.load(open(cam, encoding="utf-8"))
    saida[cidade] = {
        "ancora_x": round(d["ancora_x"], 4),
        "ancora_y": round(d["ancora_y"], 4),
        "metros": round(d["metros_de_largura"], 1),
        "largura": d["largura"], "altura": d["altura"],
        "mastros": d.get("mastros", []),
        "bocas": d.get("bocas", []),
    }
alvo = os.path.join(PASTA, "aldeias_v4.json")
with open(alvo, "w", encoding="utf-8") as f:
    json.dump(saida, f, indent=1, sort_keys=True)
print("SONDA manifesto: %d cidades -> %s (%.1f KB)"
      % (len(saida), alvo, os.path.getsize(alvo) / 1024))
