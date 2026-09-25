// Envios de ALDEIAS DIFERENTES ao MESMO alvo no MESMO turno (o motor nao os
// soma: lutam um de cada vez). Quantos, e quantos ganhariam se somassem?
const {carregar,reexec,fotografia}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,16);}
  const st={}; for(const l of["A","B"]) st[l]={ataques:0,grupos:0,envNosGrupos:0,sozinhoPerde:0,somadoGanha:0};
  let ids=null, foto=null;
  reexec(P,(g,t,fase)=>{ if(fase==="pre"){ids=new Set(g.movimentos.map(m=>m.id)); foto=fotografia(g); return;}
    for(const l of["A","B"]){const novos=g.movimentos.filter(m=>m.dono===l&&!ids.has(m.id));
      const por={}; for(const m of novos){const a=g.aldeias.find(x=>x.id===m.destinoId); if(a.dono===l) continue; st[l].ataques++; (por[a.id]=por[a.id]||[]).push(m);}
      for(const id in por){const g2=por[id]; if(new Set(g2.map(m=>m.origemId)).size<2) continue; const S=st[l]; S.grupos++; S.envNosGrupos+=g2.length;
        const a=foto[+id]; /* o alvo como o Rei o via */ const soma={lanceiro:0,arqueiro:0,cavaleiro:0}; for(const m of g2) for(const k in soma) soma[k]+=m.tropas[k]||0;
        const algumGanha=g2.some(m=>E.preverCombate(g,m.tropas,a).atacanteVence);
        if(!algumGanha){S.sozinhoPerde++; if(E.preverCombate(g,soma,a).atacanteVence) S.somadoGanha++;}}
    }});
  console.log(path.basename(f).slice(9));
  for(const l of["A","B"]){const S=st[l]; console.log(`  ${nomes[l].padEnd(16)} ataques ${S.ataques} | grupos de envios de aldeias diferentes ao mesmo alvo no mesmo turno: ${S.grupos} (${S.envNosGrupos} envios = ${(100*S.envNosGrupos/Math.max(1,S.ataques)).toFixed(0)}% dos ataques) | grupos em que NENHUM envio vencia sozinho: ${S.sozinhoPerde}, dos quais SOMADOS venceriam: ${S.somadoGanha}`);}
}
