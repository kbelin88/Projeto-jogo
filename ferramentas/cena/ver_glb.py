# ver_glb.py — o que ha DENTRO de um .glb, sem abrir o Blender.
#
#   python ferramentas/cena/ver_glb.py assets/Lanceiro.glb
#
# ── PORQUE EXISTE ────────────────────────────────────────────────────────────
# Um modelo que chega de fora pode trazer surpresas que so aparecem tarde: vem
# em centimetros, deitado de lado, com o pivo no meio do corpo, com materiais a
# mais, sem UV, ou com 300 mil triangulos para uma figura de 12 px no ecra.
# Todas essas coisas estao escritas no proprio ficheiro -- basta ler.
#
# O GLB e um cabecalho, um pedaco de JSON e um pedaco binario. O JSON diz tudo
# o que interessa aqui; so as caixas dos acessores (min/max) e que dao o
# tamanho, e vem tambem no JSON.
import json
import struct
import sys


def ler(caminho):
    with open(caminho, "rb") as f:
        magico, versao, _total = struct.unpack("<III", f.read(12))
        if magico != 0x46546C67:
            raise SystemExit("nao e um GLB (magico errado)")
        js = None
        while True:
            cab = f.read(8)
            if len(cab) < 8:
                break
            n, tipo = struct.unpack("<II", cab)
            dados = f.read(n)
            if tipo == 0x4E4F534A:
                js = json.loads(dados.decode("utf-8"))
        return versao, js


def caixa(js):
    """o tamanho da peca, em unidades do ficheiro, pela POSITION de cada malha"""
    lo = [1e30] * 3
    hi = [-1e30] * 3
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            ac = js["accessors"][p["attributes"]["POSITION"]]
            if "min" not in ac:
                continue
            for k in range(3):
                lo[k] = min(lo[k], ac["min"][k])
                hi[k] = max(hi[k], ac["max"][k])
    return lo, hi


def triangulos(js):
    n = 0
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            if "indices" in p:
                n += js["accessors"][p["indices"]]["count"] // 3
            else:
                n += js["accessors"][p["attributes"]["POSITION"]]["count"] // 3
    return n


def main(caminho):
    versao, js = ler(caminho)
    gerador = js.get("asset", {}).get("generator", "?")
    print("ficheiro : %s (glTF %d, gerado por %s)" % (caminho, versao, gerador))
    print("malhas   : %d, %d triangulos" % (len(js.get("meshes", [])), triangulos(js)))
    print("nos      : %d | materiais: %d | imagens: %d | texturas: %d"
          % (len(js.get("nodes", [])), len(js.get("materials", [])),
             len(js.get("images", [])), len(js.get("textures", []))))
    peles = js.get("skins", [])
    anims = js.get("animations", [])
    print("esqueleto: %s | animacoes: %s"
          % ("%d pele(s), %d ossos" % (len(peles), sum(len(s.get("joints", []))
                                                       for s in peles))
             if peles else "nenhum",
             ", ".join(a.get("name", "?") for a in anims) if anims else "nenhuma"))
    lo, hi = caixa(js)
    if lo[0] < 1e29:
        print("tamanho  : %.3f x %.3f x %.3f (unidades do ficheiro)"
              % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]))
        print("           chao em y=%.3f, topo em y=%.3f, centro xz=(%.3f, %.3f)"
              % (lo[1], hi[1], (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2))
    for i, m in enumerate(js.get("materials", [])):
        p = m.get("pbrMetallicRoughness", {})
        cor = p.get("baseColorFactor")
        print("  material %d: %-22s cor=%s textura=%s metal=%s rugos=%s%s"
              % (i, m.get("name", "?"),
                 "[" + ", ".join("%.2f" % v for v in cor) + "]" if cor else "-",
                 "sim" if "baseColorTexture" in p else "nao",
                 p.get("metallicFactor", "?"), p.get("roughnessFactor", "?"),
                 " NORMAL" if "normalTexture" in m else ""))
    for i, im in enumerate(js.get("images", [])):
        print("  imagem %d: %s %s" % (i, im.get("mimeType", "?"),
                                      im.get("name", "")))
    atrs = set()
    for m in js.get("meshes", []):
        for p in m["primitives"]:
            atrs |= set(p["attributes"])
    print("atributos: %s" % ", ".join(sorted(atrs)))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/Lanceiro.glb")
