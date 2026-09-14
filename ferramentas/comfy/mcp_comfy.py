# mcp_comfy.py — a porta para o ComfyUI, aberta como ferramentas MCP.
#
#   (nao se corre a mao: quem o arranca e o Claude Code, pelo .mcp.json)
#
# ── PORQUE EXISTE, E PORQUE E NOSSO ──────────────────────────────────────────
# O ComfyUI ja fala por HTTP em 127.0.0.1:8188 -- da para lhe pedir tudo com
# `curl`. O que faltava nao era acesso, era ACESSO ARRUMADO: ferramentas com
# nome, que aparecem sozinhas em cada sessao nova, sem eu ter de me lembrar das
# rotas nem o Lucas de deixar nada preparado.
#
# Escrevemos o nosso em vez de instalar um de terceiros por tres razoes:
#   1. nao depende de um repositorio que pode mudar de nome ou morrer;
#   2. nao precisa de instalar NADA (so a biblioteca que ja vem com o Python);
#   3. da para crescer com o projeto -- quando precisarmos de uma ferramenta
#      nova, escreve-se aqui.
#
# ── O PROTOCOLO, EM DUAS LINHAS ──────────────────────────────────────────────
# MCP por stdio e JSON-RPC 2.0: cada mensagem e UMA linha de JSON na entrada, e
# a resposta e UMA linha de JSON na saida. Tres pedidos importam: `initialize`
# (apresentacoes), `tools/list` (que ferramentas ha) e `tools/call` (usa esta).
# ⚠ NADA pode ser impresso no stdout a nao ser respostas -- um `print` de
# depuracao parte a ligacao sem dizer porque. Avisos vao para o stderr.
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SERVIDOR = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PASTA_FLUXOS = os.path.join(RAIZ, "ferramentas", "comfy", "fluxos")
PASTA_SAIDA = os.path.join(RAIZ, "assets", "gerado")
VERSAO = "2026-09-14"


def avisar(t):
    sys.stderr.write("[mcp_comfy] %s\n" % t)
    sys.stderr.flush()


def pedir(rota, dados=None, metodo=None, bruto=False, espera=60):
    """uma chamada ao ComfyUI. `dados` em JSON faz um POST."""
    url = SERVIDOR + rota
    corpo = None
    cab = {}
    if dados is not None:
        corpo = json.dumps(dados).encode("utf-8")
        cab["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=corpo, headers=cab,
                                 method=metodo or ("POST" if corpo else "GET"))
    with urllib.request.urlopen(req, timeout=espera) as r:
        cru = r.read()
    return cru if bruto else json.loads(cru.decode("utf-8"))


# ── AS FERRAMENTAS ───────────────────────────────────────────────────────────
# Cada uma e uma funcao que devolve TEXTO. O modelo le texto, nao estruturas:
# uma tabela curta e mais util do que o JSON cru de 2 MB do `object_info`.

def t_estado(_):
    """o que a maquina aguenta agora"""
    try:
        d = pedir("/system_stats")
    except Exception as e:
        return ("ComfyUI nao responde em %s (%s).\n"
                "E preciso ter o ComfyUI aberto." % (SERVIDOR, e))
    s = d.get("system", {})
    linhas = ["ComfyUI %s | python %s | %s"
              % (s.get("comfyui_version", "?"), s.get("python_version", "?")[:6],
                 s.get("os", "?"))]
    for g in d.get("devices", []):
        linhas.append("placa: %s | VRAM %.1f GB, %.1f GB livres"
                      % (g.get("name", "?"), g.get("vram_total", 0) / 2 ** 30,
                         g.get("vram_free", 0) / 2 ** 30))
    try:
        f = pedir("/queue")
        linhas.append("fila: %d a correr, %d a espera"
                      % (len(f.get("queue_running", [])),
                         len(f.get("queue_pending", []))))
    except Exception:
        pass
    return "\n".join(linhas)


def t_modelos(a):
    """que pesos estao instalados (checkpoints, loras, vae...)"""
    d = pedir("/object_info", espera=120)
    achado = {}
    for nome, no in d.items():
        req = (no.get("input", {}).get("required") or {})
        for campo, spec in req.items():
            if (isinstance(spec, list) and spec and isinstance(spec[0], list)
                    and spec[0] and all(isinstance(x, str) for x in spec[0])):
                # uma lista de ficheiros: e um carregador de pesos
                if any(campo.endswith(s) for s in ("_name", "ckpt_name", "name")):
                    achado.setdefault(campo, set()).update(spec[0])
    filtro = (a.get("contem") or "").lower()
    linhas = []
    for campo in sorted(achado):
        itens = sorted(x for x in achado[campo] if filtro in x.lower())
        if not itens:
            continue
        linhas.append("%s (%d):" % (campo, len(itens)))
        linhas += ["   " + x for x in itens[:40]]
        if len(itens) > 40:
            linhas.append("   ... e mais %d" % (len(itens) - 40))
    return "\n".join(linhas) or "nenhum peso encontrado com esse filtro"


def t_nos(a):
    """procurar tipos de caixa e ver o que cada uma pede"""
    d = pedir("/object_info", espera=120)
    q = (a.get("procurar") or "").lower()
    achados = [n for n in d if q in n.lower()]
    if not achados:
        return "nenhum no com '%s' (ha %d instalados)" % (q, len(d))
    achados.sort()
    if a.get("detalhe") and len(achados) <= 6:
        linhas = []
        for n in achados:
            no = d[n]
            linhas.append("== %s ==  (%s)" % (n, no.get("category", "?")))
            for grupo in ("required", "optional"):
                for campo, spec in (no.get("input", {}).get(grupo) or {}).items():
                    tipo = spec[0] if isinstance(spec, list) and spec else spec
                    if isinstance(tipo, list):
                        tipo = "escolha: " + ", ".join(map(str, tipo[:6]))
                    linhas.append("   %-22s %s%s" % (campo, tipo,
                                                    "" if grupo == "required" else "  (opcional)"))
            linhas.append("   -> devolve: %s" % ", ".join(no.get("output", [])))
        return "\n".join(linhas)
    return ("%d nos com '%s':\n" % (len(achados), q)) + "\n".join(
        "   " + n for n in achados[:60])


def t_fluxos(_):
    """os workflows guardados no projeto (formato API)"""
    if not os.path.isdir(PASTA_FLUXOS):
        return ("ainda nao ha nenhum. Guarde em %s um workflow exportado pelo "
                "ComfyUI em Workflow -> Export (API)." % PASTA_FLUXOS)
    linhas = []
    for f in sorted(os.listdir(PASTA_FLUXOS)):
        if not f.endswith(".json"):
            continue
        cam = os.path.join(PASTA_FLUXOS, f)
        try:
            w = json.load(open(cam, encoding="utf-8"))
            tipos = {}
            for _i, no in w.items():
                tipos[no.get("class_type", "?")] = tipos.get(no.get("class_type", "?"), 0) + 1
            resumo = ", ".join("%s x%d" % (k, v) if v > 1 else k
                               for k, v in sorted(tipos.items())[:8])
            linhas.append("%-30s %2d caixas: %s" % (f, len(w), resumo))
        except Exception as e:
            linhas.append("%-30s ILEGIVEL (%s)" % (f, e))
    return "\n".join(linhas) or "a pasta esta vazia"


def t_ver_fluxo(a):
    """os campos de um workflow, para saber o que se pode trocar"""
    cam = os.path.join(PASTA_FLUXOS, a["fluxo"])
    w = json.load(open(cam, encoding="utf-8"))
    linhas = []
    for nid in sorted(w, key=lambda x: int(x) if x.isdigit() else 0):
        no = w[nid]
        linhas.append("no %-4s %s" % (nid, no.get("class_type", "?")))
        for campo, val in (no.get("inputs") or {}).items():
            if isinstance(val, list):      # ligacao a outra caixa
                continue
            v = str(val)
            linhas.append("      %-18s = %s" % (campo, v[:90] + ("..." if len(v) > 90 else "")))
    return "\n".join(linhas)


def _ficheiros_da_historia(h):
    """apanha todo o {filename, subfolder, type} que o resultado tiver, seja
    qual for a caixa -- imagens, GLB, video: o formato e sempre este."""
    fora = []

    def varrer(x):
        if isinstance(x, dict):
            if "filename" in x and isinstance(x.get("filename"), str):
                fora.append(x)
            else:
                for v in x.values():
                    varrer(v)
        elif isinstance(x, list):
            for v in x:
                varrer(v)

    varrer(h.get("outputs", {}))
    return fora


def t_executar(a):
    """poe um workflow na fila, espera, e traz os ficheiros para o projeto"""
    if a.get("fluxo"):
        w = json.load(open(os.path.join(PASTA_FLUXOS, a["fluxo"]), encoding="utf-8"))
    elif a.get("json"):
        w = json.loads(a["json"]) if isinstance(a["json"], str) else a["json"]
    else:
        return "e preciso `fluxo` (nome do ficheiro) ou `json` (o workflow)"

    # ── TROCAS: mudar um campo sem reescrever o workflow ────────────────────
    # É assim que se geram variantes: o mesmo fluxo, outro texto, outra semente.
    for nid, campos in (a.get("trocas") or {}).items():
        if nid not in w:
            return "o workflow nao tem o no %s (ha: %s)" % (nid, ", ".join(sorted(w)))
        for campo, val in campos.items():
            w[nid].setdefault("inputs", {})[campo] = val

    r = pedir("/prompt", {"prompt": w, "client_id": "claude-code"})
    if "prompt_id" not in r:
        return "o ComfyUI recusou: %s" % json.dumps(r)[:900]
    pid = r["prompt_id"]

    # ⚠ ESPERAR E OBRIGATORIO, e pode demorar: nesta placa (4 GB) uma malha 3D
    # leva minutos. Sem espera, devolvia-se um numero de bilhete e mais nada.
    teto = int(a.get("espera_s") or 600)
    t0 = time.time()
    while time.time() - t0 < teto:
        try:
            hist = pedir("/history/" + pid)
        except Exception:
            hist = {}
        if pid in hist:
            h = hist[pid]
            estado = (h.get("status") or {}).get("status_str", "?")
            fich = _ficheiros_da_historia(h)
            if not fich:
                return ("terminou em %.0f s com estado '%s' e NENHUM ficheiro.\n"
                        "Costuma ser um workflow sem caixa de gravar "
                        "(SaveImage / SaveGLB).\n%s"
                        % (time.time() - t0, estado,
                           json.dumps(h.get("status", {}))[:500]))
            os.makedirs(PASTA_SAIDA, exist_ok=True)
            trazidos = []
            for f in fich:
                qs = urllib.parse.urlencode({"filename": f["filename"],
                                             "subfolder": f.get("subfolder", ""),
                                             "type": f.get("type", "output")})
                try:
                    dados = pedir("/view?" + qs, bruto=True, espera=180)
                except Exception as e:
                    trazidos.append("  (falhou %s: %s)" % (f["filename"], e))
                    continue
                destino = os.path.join(PASTA_SAIDA, os.path.basename(f["filename"]))
                with open(destino, "wb") as g:
                    g.write(dados)
                trazidos.append("  assets/gerado/%s  (%.1f MB)"
                                % (os.path.basename(f["filename"]),
                                   len(dados) / 2 ** 20))
            return ("pronto em %.0f s (estado %s), %d ficheiro(s):\n%s"
                    % (time.time() - t0, estado, len(fich), "\n".join(trazidos)))
        time.sleep(2.0)
    return ("passaram %d s e ainda nao acabou (bilhete %s). "
            "Use comfy_estado para ver a fila, ou espere mais." % (teto, pid))


def t_historico(a):
    """o que o ComfyUI ja correu -- e de onde se recupera um workflow"""
    # ── O MENU NAO E O UNICO CAMINHO ────────────────────────────────────────
    # Em 14/09 o "Export (API)" nao apareceu no menu do ComfyUI e o Lucas ficou
    # preso. Mas o servidor guarda o workflow EXATO de tudo o que executou, ja
    # em formato API -- e foi de aqui que saiu o `figura_3d.json`. Nunca mais e
    # preciso pedir-lhe uma exportacao a mao.
    h = pedir("/history?max_items=50", espera=60)
    if not h:
        return "o ComfyUI ainda nao correu nada nesta instalacao"
    linhas, escolhido = [], None
    for pid, d in h.items():
        fluxo = d.get("prompt", [None, None, {}])[2] or {}
        saidas = _ficheiros_da_historia(d)
        nomes = [f["filename"] for f in saidas]
        if (a.get("qual") and pid.startswith(a["qual"])) or \
           (not a.get("qual") and any(n.endswith((".glb", ".gltf", ".obj")) for n in nomes)):
            escolhido = (pid, fluxo)
        linhas.append("%s | %2d caixas | %s | %s"
                      % (pid[:8], len(fluxo),
                         (d.get("status") or {}).get("status_str", "?"),
                         ", ".join(nomes[:3]) or "sem ficheiro"))
    if a.get("guardar_como"):
        if not escolhido:
            return "nao achei nenhuma execucao com malha 3D:\n" + "\n".join(linhas)
        os.makedirs(PASTA_FLUXOS, exist_ok=True)
        cam = os.path.join(PASTA_FLUXOS, a["guardar_como"])
        json.dump(escolhido[1], open(cam, "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False)
        return ("guardei a execucao %s (%d caixas) em fluxos/%s\n\n%s"
                % (escolhido[0][:8], len(escolhido[1]), a["guardar_como"],
                   "\n".join(linhas)))
    return "\n".join(linhas)


def t_enviar_imagem(a):
    """poe uma imagem do disco na pasta de entrada do ComfyUI"""
    # ── PORQUE E PRECISO ────────────────────────────────────────────────────
    # O nosso workflow e IMAGEM -> 3D, e o ficheiro dele guarda so o NOME da
    # imagem, nao a imagem. Sem esta ferramenta eu podia mudar o nome mas nunca
    # por la um desenho novo -- e so o Lucas conseguiria comecar uma geracao.
    cam = a["ficheiro"]
    if not os.path.isabs(cam):
        cam = os.path.join(RAIZ, cam)
    if not os.path.isfile(cam):
        return "nao encontrei %s" % cam
    nome = a.get("nome") or os.path.basename(cam)
    with open(cam, "rb") as f:
        dados = f.read()
    # multipart a mao: e o unico sitio onde o JSON nao serve
    lim = "----claude%d" % int(time.time() * 1000)
    ext = os.path.splitext(nome)[1].lower().lstrip(".") or "png"
    corpo = b"".join([
        ("--%s\r\nContent-Disposition: form-data; name=\"image\"; "
         "filename=\"%s\"\r\nContent-Type: image/%s\r\n\r\n"
         % (lim, nome, "jpeg" if ext in ("jpg", "jpeg") else ext)).encode("utf-8"),
        dados, b"\r\n",
        ("--%s\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n"
         % lim).encode("utf-8"),
        ("--%s--\r\n" % lim).encode("utf-8")])
    req = urllib.request.Request(
        SERVIDOR + "/upload/image", data=corpo, method="POST",
        headers={"Content-Type": "multipart/form-data; boundary=%s" % lim})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read().decode("utf-8"))
    return ("enviada como '%s' (%.1f MB). Use este nome no campo `image` da "
            "caixa que carrega a imagem." % (resp.get("name", nome),
                                             len(dados) / 2 ** 20))


def t_saidas(a):
    """o que ja foi gerado e trazido para o projeto"""
    if not os.path.isdir(PASTA_SAIDA):
        return "ainda nao foi gerado nada"
    fs = []
    for f in os.listdir(PASTA_SAIDA):
        cam = os.path.join(PASTA_SAIDA, f)
        fs.append((os.path.getmtime(cam), f, os.path.getsize(cam)))
    fs.sort(reverse=True)
    n = int(a.get("quantos") or 20)
    return "\n".join("%s  %7.1f MB  %s"
                     % (time.strftime("%d/%m %H:%M", time.localtime(t)),
                        s / 2 ** 20, f) for t, f, s in fs[:n]) or "vazio"


def t_parar(_):
    """cancelar o que esta a correr"""
    try:
        pedir("/interrupt", {})
        return "interrompido"
    except Exception as e:
        return "nao consegui interromper: %s" % e


FERRAMENTAS = [
    ("comfy_estado", "Se o ComfyUI esta a responder, que placa tem, quanta VRAM "
                     "esta livre e o que ha na fila. Use SEMPRE antes de gerar.",
     {"type": "object", "properties": {}}, t_estado),
    ("comfy_nos", "Procurar tipos de caixa instalados no ComfyUI pelo nome "
                  "(ex.: 'Hunyuan3D', 'SaveGLB', 'Flux'). Com detalhe=true e ate "
                  "6 resultados, mostra tambem os campos de cada uma.",
     {"type": "object", "properties": {
         "procurar": {"type": "string", "description": "pedaco do nome"},
         "detalhe": {"type": "boolean"}}, "required": ["procurar"]}, t_nos),
    ("comfy_modelos", "Que pesos estao instalados (checkpoints, loras, vae). "
                      "Filtra por `contem`.",
     {"type": "object", "properties": {"contem": {"type": "string"}}}, t_modelos),
    ("comfy_fluxos", "Os workflows guardados em ferramentas/comfy/fluxos "
                     "(formato API), com um resumo das caixas de cada um.",
     {"type": "object", "properties": {}}, t_fluxos),
    ("comfy_ver_fluxo", "Todos os campos de um workflow guardado, com o numero "
                        "de cada caixa — e daqui que saem os numeros para `trocas`.",
     {"type": "object", "properties": {
         "fluxo": {"type": "string", "description": "nome do ficheiro .json"}},
      "required": ["fluxo"]}, t_ver_fluxo),
    ("comfy_executar", "Poe um workflow a correr, espera que acabe, e traz os "
                       "ficheiros gerados para assets/gerado/. `trocas` muda "
                       "campos sem reescrever o workflow: "
                       "{\"6\": {\"text\": \"a stone wall\"}, \"3\": {\"seed\": 7}}.",
     {"type": "object", "properties": {
         "fluxo": {"type": "string", "description": "nome do ficheiro em fluxos/"},
         "json": {"type": "string", "description": "ou o workflow API inteiro"},
         "trocas": {"type": "object", "description": "{no: {campo: valor}}"},
         "espera_s": {"type": "integer", "description": "teto de espera (600 s)"}}},
     t_executar),
    ("comfy_enviar_imagem", "Poe uma imagem do disco na pasta de entrada do "
                            "ComfyUI, para um workflow de imagem->3D a poder "
                            "usar. Devolve o nome a pôr no campo `image`.",
     {"type": "object", "properties": {
         "ficheiro": {"type": "string", "description": "caminho no disco"},
         "nome": {"type": "string", "description": "outro nome, opcional"}},
      "required": ["ficheiro"]}, t_enviar_imagem),
    ("comfy_historico", "As execucoes que o ComfyUI ja fez, com as caixas e os "
                        "ficheiros que saíram. Serve para recuperar um workflow "
                        "sem passar pelo menu: `guardar_como` grava-o em fluxos/.",
     {"type": "object", "properties": {
         "guardar_como": {"type": "string", "description": "nome do .json"},
         "qual": {"type": "string", "description": "inicio do id; por omissao "
                                                   "a ultima que deu ficheiro"}}},
     lambda a: t_historico(a)),
    ("comfy_saidas", "O que ja foi gerado e trazido para assets/gerado/.",
     {"type": "object", "properties": {"quantos": {"type": "integer"}}}, t_saidas),
    ("comfy_parar", "Cancela o trabalho que esta a correr no ComfyUI.",
     {"type": "object", "properties": {}}, t_parar),
]
POR_NOME = {n: f for n, _d, _e, f in FERRAMENTAS}


def responder(ident, resultado=None, erro=None):
    m = {"jsonrpc": "2.0", "id": ident}
    if erro is not None:
        m["error"] = {"code": -32000, "message": erro}
    else:
        m["result"] = resultado
    sys.stdout.write(json.dumps(m) + "\n")
    sys.stdout.flush()


def principal():
    avisar("a servir %s" % SERVIDOR)
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        try:
            m = json.loads(linha)
        except Exception:
            continue
        met, ident = m.get("method"), m.get("id")
        if met == "initialize":
            responder(ident, {
                "protocolVersion": m.get("params", {}).get("protocolVersion",
                                                           "2024-11-05"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "comfy", "version": VERSAO}})
        elif met == "tools/list":
            responder(ident, {"tools": [
                {"name": n, "description": d, "inputSchema": e}
                for n, d, e, _f in FERRAMENTAS]})
        elif met == "tools/call":
            p = m.get("params", {})
            f = POR_NOME.get(p.get("name"))
            if not f:
                responder(ident, erro="nao ha ferramenta '%s'" % p.get("name"))
                continue
            try:
                texto = f(p.get("arguments") or {})
            except urllib.error.URLError as e:
                texto = ("o ComfyUI nao respondeu (%s). Esta aberto? "
                         "Tentei %s" % (e, SERVIDOR))
            except Exception as e:
                texto = "falhou: %s: %s" % (type(e).__name__, e)
            responder(ident, {"content": [{"type": "text", "text": str(texto)}]})
        elif ident is not None:
            responder(ident, {})
        # sem id = aviso, nao se responde


if __name__ == "__main__":
    principal()
