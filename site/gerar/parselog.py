import re,json,sys,os
HDR=re.compile(r'^########## TURNO (\d+) — Rei ([AB]) \((.*?)\) ##########$',re.M)
TOK=re.compile(r'^tokens(?:\.contexto)?: prompt (\d+) \| resposta (\d+) \| raciocinio (\d+) \| finish (\S+)(?: \| nativo (\S+))? \| ms (\d+)')
MOTOR=re.compile(r'^(ACEITO|REJEITADO|NORMALIZADO|COMBATE|REFORCO|CONQUISTA|placar:|>>>|RETENTATIVA|THROTTLE)')

def _json_do_plano(resp_raw):
    plano=dep=''
    try:
        txt=json.loads(resp_raw)
    except Exception:
        return plano,dep,None
    m=re.search(r'\{.*\}', txt, re.S)
    if m:
        try:
            o=json.loads(m.group(0))
            plano=str(o.get('plano','') or ''); dep=str(o.get('depoimento','') or '')
        except Exception:
            p=re.search(r'"plano"\s*:\s*"((?:[^"\\]|\\.)*)"',txt)
            d=re.search(r'"depoimento"\s*:\s*"((?:[^"\\]|\\.)*)"',txt)
            if p: plano=p.group(1).encode().decode('unicode_escape')
            if d: dep=d.group(1).encode().decode('unicode_escape')
    return plano,dep,txt

def parse(path):
    src=open(path,encoding='utf-8',errors='replace').read()
    cab=src.split('##########',1)[0]
    marcas=list(HDR.finditer(src))
    blocos=[]
    for k,m in enumerate(marcas):
        ini=m.end(); fim=marcas[k+1].start() if k+1<len(marcas) else len(src)
        corpo=src[ini:fim]
        L=corpo.split('\n')
        rec={'turno':int(m.group(1)),'rei':m.group(2),'modelo':m.group(3)}
        tok=None
        for ln in L[:6]:
            t=TOK.match(ln)
            if t:
                tok={'prompt':int(t.group(1)),'resposta':int(t.group(2)),'raciocinio':int(t.group(3)),
                     'finish':t.group(4),'ms':int(t.group(6))}
                break
        rec['tokens']=tok
        iC=max((i for i,ln in enumerate(L) if ln.startswith('ordem.construir:')), default=None)
        iE=next((i for i,ln in enumerate(L) if i>(iC or -1) and ln.startswith('ordem.envios')), None)
        iR=next((i for i,ln in enumerate(L) if ln.startswith('resposta crua: ')), None)
        iRac=next((i for i,ln in enumerate(L) if ln.startswith('raciocinio:')), None)
        resp = '\n'.join(L[iR:iRac]) [len('resposta crua: '):] if (iR is not None and iRac is not None) else ''
        rac  = '\n'.join(L[iRac:iC if iC is not None else len(L)])[len('raciocinio:'):].strip() if iRac is not None else ''
        rec['construir']=L[iC].split(':',1)[1].strip() if iC is not None else ''
        rec['envios']=L[iE].split(':',1)[1].strip() if iE is not None else ''
        plano,dep,cru=_json_do_plano(resp.strip())
        rec['plano']=plano; rec['depoimento']=dep
        rec['raciocinio']=rac
        rec['respostaCrua']=cru if cru is not None else resp.strip()
        rec['motor']=[ln for ln in (L[iE+1:] if iE is not None else L) if MOTOR.match(ln)]
        blocos.append(rec)
    return cab.strip(), blocos

if __name__=='__main__':
    cab,bl=parse(sys.argv[1])
    print(len(bl),'blocos')
    for r in bl[2:4]:
        print('---',r['turno'],r['rei'],r['tokens'])
        print('  plano:',r['plano'][:110])
        print('  dep  :',r['depoimento'][:110])
        print('  rac  :',len(r['raciocinio']),'chars |', r['raciocinio'][:90].replace('\n',' '))
        print('  constr:',r['construir'][:90]); print('  motor:',r['motor'][:3])
