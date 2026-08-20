#!/usr/bin/env python3
"""Gera os dados do site da Arena a partir dos resultados do repo.

Uso (a partir da raiz do repositorio):
    python site/gerar/gerar.py

Le:
    site/gerar/manifesto.json   — uma entrada por partida (id/data/seed/fim/caminhos)
    resultados/**/*.txt         — o log narrativo (via ferramentas/analisar-log.js --json)
    resultados/**/*.replay.json — o estado do motor, fonte de placar/curva quando existe
    site/dados/precos.json      — precos de tabela da OpenRouter, consultados uma vez
    world-iberia.js             — o mapa (via node)

Escreve em site/dados/: mapa.json, partidas.json, modelos.json,
    replay_<id>.json, log_<id>.json, rac_<id>.json

SPEC_SITE_V1 FASE 1 (20/08): antes desta versao, cA/cB/aldA/aldB/turnos vinham
digitados a mao no manifesto. Agora tudo isso sai de analisar-log.js --json e do
replay — a mesma fonte que a Fase 0 corrigiu. Regra: onde o .replay.json tem o
dado, usa-se o replay; o .txt so para o que nao existe no replay (tokens, ms,
finish, plano, depoimento, raciocinio) — CLAUDE.md: "o .txt narra, o JSON mede".
"""
import json, os, sys, subprocess, statistics as st, re

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
GERAR = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(RAIZ, 'site', 'dados')
os.makedirs(DADOS, exist_ok=True)
MAN = json.load(open(os.path.join(GERAR, 'manifesto.json'), encoding='utf-8'))
PRECOS = json.load(open(os.path.join(DADOS, 'precos.json'), encoding='utf-8'))['precos']
sys.path.insert(0, GERAR)
import parselog

ATK = {'lanceiro': 1, 'arqueiro': 2, 'cavaleiro': 4}
TMP_ANALISE = os.path.join(DADOS, '_tmp_analise.json')


def canon(modelo):
    """Nome canonico do modelo: sem prefixo de backend, com o ':free' de quem
    tem (convencao ja usada no catalogo do index.html e no manifesto antigo).
    'gemini' bare (etiqueta do cliente Gemini direto, sem backend:modelo no
    invoke) mapeia para o unico modelo Gemini medido no catalogo."""
    m = re.sub(r'^openrouter:', '', modelo or '')
    if m == 'gemini':
        return 'gemini-2.5-flash'
    m = re.sub(r'^gemini:', '', m)
    m = re.sub(r'^ollama:', '', m)
    return m


def analisar(txt_rel, replay_rel):
    """Roda ferramentas/analisar-log.js --json e devolve o objeto. Erro = para
    tudo com mensagem clara (regra da FASE 1: nunca dado parcial em silencio)."""
    txt_abs = os.path.join(RAIZ, txt_rel + '.txt')
    if not os.path.exists(txt_abs):
        sys.exit('ERRO FASE 1: .txt nao encontrado: %s' % txt_abs)
    replay_abs = None
    if replay_rel:
        cand = os.path.join(RAIZ, replay_rel + '.replay.json')
        if os.path.exists(cand):
            replay_abs = cand
    cmd = ['node', os.path.join(RAIZ, 'ferramentas', 'analisar-log.js'), txt_abs, '--json', TMP_ANALISE]
    if replay_abs:
        cmd += ['--replay', replay_abs]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0 or not os.path.exists(TMP_ANALISE):
        sys.exit('ERRO FASE 1: analisar-log.js falhou em %s\n%s\n%s' % (txt_abs, p.stdout, p.stderr))
    d = json.load(open(TMP_ANALISE, encoding='utf-8'))
    os.remove(TMP_ANALISE)
    return d, replay_abs


def placar_e_curva(r, replay_abs):
    """(aldA, aldB, turnos, curva). Do replay (ultimo frame + serie por turno)
    quando existe; senao do placar_final que analisar-log.js le da linha
    'placar:' que o MOTOR escreveu no .txt (so as 5 partidas de 17/08 caem aqui
    — nao ha replay para reconstruir, e a regra e nao estimar)."""
    if replay_abs:
        rep = json.load(open(replay_abs, encoding='utf-8'))
        fr = rep['frames']
        ult = fr[-1]
        aldA = sum(1 for a in ult['aldeias'] if a['dono'] == 'A')
        aldB = sum(1 for a in ult['aldeias'] if a['dono'] == 'B')
        curva = [[f['turno'], sum(1 for a in f['aldeias'] if a['dono'] == 'A'),
                  sum(1 for a in f['aldeias'] if a['dono'] == 'B')] for f in fr]
        return aldA, aldB, ult['turno'], curva
    pf = r['partida']['placar_final']
    turnos = r['partida']['turnos_registados']
    if not pf:
        return 0, 0, turnos, []
    return pf['aldeiasA'], pf['aldeiasB'], turnos, []


def compactar_replay(replay_abs, pid, A, B):
    d = json.load(open(replay_abs, encoding='utf-8'))
    fr = []
    for f in d['frames']:
        fr.append({'t': f['turno'],
          'a': [[a['id'], a['dono'], a['tropas']['lanceiro'], a['tropas']['arqueiro'], a['tropas']['cavaleiro'],
                 len(a.get('construindo') or []), a.get('recursos', {}).get('madeira', 0), a.get('recursos', {}).get('ferro', 0)]
                for a in f['aldeias']],
          'm': [[m['dono'], m['origemId'], m['destinoId'], m['tropas']['lanceiro'], m['tropas']['arqueiro'],
                 m['tropas']['cavaleiro'], m.get('turnosRestantes', 0), m.get('turnosTotal', 0), m.get('caminho', [])]
                for m in (f.get('movimentos') or [])],
          'e': [{k: ev.get(k) for k in ('tipo','alvoId','alvoNome','atacante','atkType','defType',
                                        'Fatk','Fdef','FatkEf','FdefEf','vantagem','vencedor','conquista','baixasForca')}
                for ev in (f.get('eventos') or [])],
          'd': {k: {'ms': (f['diag'][k] or {}).get('ms'), 'finish': (f['diag'][k] or {}).get('finish'),
                    'vazio': (f['diag'][k] or {}).get('vazio'), 'tokens': (f['diag'][k] or {}).get('tokens'),
                    'rej': len((f['diag'][k] or {}).get('rejeicoes') or [])} for k in 'AB'}})
    json.dump({'id': pid, 'A': A, 'B': B, 'frames': fr},
              open(os.path.join(DADOS, 'replay_%s.json' % pid), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


def compactar_log(txt_abs, pid):
    cab, bl = parselog.parse(txt_abs)
    leve = [{'t': b['turno'], 'r': b['rei'], 'tok': b['tokens'], 'plano': b['plano'], 'dep': b['depoimento'],
             'constr': b['construir'], 'env': b['envios'], 'motor': b['motor']} for b in bl]
    pes = [{'t': b['turno'], 'r': b['rei'], 'rac': b['raciocinio'], 'crua': b['respostaCrua']} for b in bl]
    json.dump({'cabecalho': cab, 'turnos': leve}, open(os.path.join(DADOS, 'log_%s.json' % pid), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    json.dump(pes, open(os.path.join(DADOS, 'rac_%s.json' % pid), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


def mapa():
    js = ("const I=require(%r);const idx={};I.CIDADES.forEach((c,i)=>idx[c.id]=i);"
          "process.stdout.write(JSON.stringify({viewBox:I.MAPA.viewBox,"
          "cidades:I.CIDADES.map(c=>({id:c.id,nome:c.nome,x:c.x,y:c.y,papel:c.papel,tamanho:c.tamanho,lado:c.lado})),"
          "estradas:I.ESTRADAS.map(e=>({a:idx[e.de],b:idx[e.para],custo:e.custo,terreno:e.terreno,via:e.via||null}))}))"
          ) % os.path.join(RAIZ, 'world-iberia.js')
    out = subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout
    open(os.path.join(DADOS, 'mapa.json'), 'w', encoding='utf-8').write(out)
    return json.loads(out)


RAIO_TAMANHO = {'capital': 13, 'grande': 9.5, 'media': 7.5, 'pequena': 6}


def gerar_svg_mapa(m):
    """FASE 4 (§6.1): mapa estatico, sem JavaScript, mesma geometria do replay
    (reaproveita x/y/estradas de mapa.json, so desenhado uma vez em Python)."""
    vb = m['viewBox'] if isinstance(m['viewBox'], str) else ' '.join(str(v) for v in m['viewBox'])
    partes = ['<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
              % vb]
    partes.append('<g>')
    for e in m['estradas']:
        a, b = m['cidades'][e['a']], m['cidades'][e['b']]
        pts = [(a['x'], a['y'])] + [(p[0], p[1]) for p in (e['via'] or [])] + [(b['x'], b['y'])]
        d = 'M' + ' L'.join('%.1f,%.1f' % p for p in pts)
        serra = e['terreno'] == 'serra'
        partes.append('<path d="%s" fill="none" stroke="#3a332b" stroke-width="%s" stroke-linecap="round"%s/>'
                       % (d, '2.4' if serra else '1.8', ' stroke-dasharray="8 5"' if serra else ''))
    partes.append('</g><g>')
    for c in m['cidades']:
        r = RAIO_TAMANHO.get(c['tamanho'], 6)
        cap = c['papel'] == 'capital'
        partes.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                       % (c['x'], c['y'], r, '#2f2a24', '#c9a227' if cap else '#4a4239', '2.6' if cap else '1.4'))
        partes.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="%s" fill="%s">%s</text>'
                       % (c['x'], c['y'] + r + 13, '13' if cap else '11',
                          '#e8e0d2' if cap else '#a89a84', c['nome']))
    partes.append('</g></svg>')
    os.makedirs(os.path.join(RAIZ, 'site', 'assets'), exist_ok=True)
    open(os.path.join(RAIZ, 'site', 'assets', 'mapa.svg'), 'w', encoding='utf-8').write('\n'.join(partes))


def novo_acumulador():
    return {'lados': 0, 'decididas': 0, 'vit': 0, 'der': 0, 'saldoTotal': 0,
            'turnosInvalidos': 0, 'ordensInvalidas': 0,
            'msLista': [], 'tokInLista': [], 'tokOutLista': [], 'tokRacLista': [],
            'constr': {'lanceiro': 0, 'arqueiro': 0, 'cavaleiro': 0},
            'ataques': 0, 'conquistas': 0, 'partidas': []}


def mediana(lst):
    return round(st.median(lst)) if lst else None


def main():
    gerar_svg_mapa(mapa())
    P = []
    MOD = {}

    for p in MAN['partidas']:
        pid = p['id']
        r, replay_abs = analisar(p['txt'], p.get('replay'))
        mA, mB = canon(r['meta']['modelos'].get('A')), canon(r['meta']['modelos'].get('B'))
        aldA, aldB, turnos, curva = placar_e_curva(r, replay_abs)
        decidida = p['fim'] != 'interrompida'
        venc = ('A' if aldA > aldB else ('B' if aldB > aldA else '-')) if decidida else '-'

        registro = dict(p)
        registro.update({'A': mA, 'B': mB, 'aldA': aldA, 'aldB': aldB, 'turnos': turnos, 'venc': venc, 'curva': curva})
        P.append(registro)

        if p.get('publicarReplay') and replay_abs:
            compactar_replay(replay_abs, pid, mA, mB)
        if p.get('publicarReplay'):
            txt_abs = os.path.join(RAIZ, p['txt'] + '.txt')
            compactar_log(txt_abs, pid)

        for lado, modelo, outro_ald, proprio_ald in (('A', mA, aldB, aldA), ('B', mB, aldA, aldB)):
            rei = r['reis'][lado]
            e = MOD.setdefault(modelo, novo_acumulador())
            e['lados'] += 1
            e['partidas'].append(pid)
            if decidida:
                e['decididas'] += 1
                e['saldoTotal'] += proprio_ald - outro_ald
                if proprio_ald > outro_ald:
                    e['vit'] += 1
                elif proprio_ald < outro_ald:
                    e['der'] += 1
            e['turnosInvalidos'] += rei['vazios'] + rei['infra_erros']
            e['ordensInvalidas'] += rei['rejeicoes_total']
            e['msLista'].extend(rei['ms_turnos_nao_vazios_lista'])
            e['msLista'].extend(rei['ms_turnos_vazios_lista'])
            e['tokInLista'].extend(rei['tokens_prompt_lista'])
            e['tokOutLista'].extend(rei['tokens_resposta_lista'])
            e['tokRacLista'].extend(rei['tokens_raciocinio_lista'])
            for tp in ('lanceiro', 'arqueiro', 'cavaleiro'):
                e['constr'][tp] += rei['construcoes_aceites'][tp]
            e['ataques'] += rei['ataques']
            e['conquistas'] += rei['conquistas']

    json.dump(P, open(os.path.join(DADOS, 'partidas.json'), 'w', encoding='utf-8'), ensure_ascii=False)

    # -------- FASE 2 (§4.3): agregacao por MODELO, uma linha por coluna --------
    saida = []
    for modelo, e in MOD.items():
        totalConstr = sum(e['constr'].values())
        pct = (lambda tp: round(e['constr'][tp] / totalConstr * 100) if totalConstr else None)

        somaRac = sum(e['tokRacLista'])
        somaOut = sum(e['tokOutLista'])
        if not e['tokRacLista'] or somaRac == 0:
            pctRac = None  # nao reportado (Gemini: raciocina, o cliente conta 0) — §4.3.11
        else:
            razao = somaRac / somaOut if somaOut else 0
            pctRac = 'over100' if razao > 1 else round(razao * 100)

        precoInfo = PRECOS.get(modelo.replace(':free', ''))
        tokInMed, tokOutMed = mediana(e['tokInLista']), mediana(e['tokOutLista'])
        custo = None
        if precoInfo and tokInMed is not None and tokOutMed is not None:
            custo = round(tokInMed * precoInfo['prompt'] + tokOutMed * precoInfo['completion'], 6)

        saida.append({
            'modelo': modelo,
            'lados': e['lados'],
            'vit': e['vit'], 'der': e['der'],
            'saldoTotal': e['saldoTotal'],
            'turnosInvalidos': e['turnosInvalidos'],
            'ordensInvalidas': e['ordensInvalidas'],
            'sTurnoMediana': (mediana(e['msLista']) / 1000) if e['msLista'] else None,
            'tokEntradaMediana': tokInMed,
            'tokSaidaMediana': tokOutMed,
            'pctRaciocinio': pctRac,
            'custoTurno': custo,
            'pctLanceiro': pct('lanceiro'), 'pctArqueiro': pct('arqueiro'), 'pctCavaleiro': pct('cavaleiro'),
            'ataquesVencidosPct': round(e['conquistas'] / e['ataques'] * 100) if e['ataques'] else None,
            'aldeiasPorPartida': round(e['conquistas'] / e['lados'], 1) if e['lados'] else None,
            'partidas': e['partidas'],
        })

    # §4.1: vitorias desc -> saldo total desc (desempate, nao exibido) -> menos derrotas
    saida.sort(key=lambda x: (-x['vit'], -x['saldoTotal'], x['der']))
    json.dump(saida, open(os.path.join(DADOS, 'modelos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('ok — %d partidas, %d modelos' % (len(P), len(saida)))


if __name__ == '__main__':
    main()
