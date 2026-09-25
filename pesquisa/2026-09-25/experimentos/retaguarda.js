const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,16);}
  const acc={}; for(const l of["A","B"]) acc[l]={retPre:0,retSaiu:0,frPre:0,frSaiu:0,envAtk:0,tamAtk:[],alvosTurno:[],forcaTot:0,maiorEnvio:[],turnos:0};
  let snap=null;
  reexec(P,(g,t,fase)=>{
    const cls=(l)=>{const r={}; for(const a of E.aldeiasDe(g,l)){const viz=g.estradas.adj[a.id].map(v=>g.aldeias.find(x=>x.id===v)); r[a.id]={ret:viz.every(b=>b.dono===l),k:n(a.tropas)};} return r;};
    if(fase==="pre"){snap={A:cls("A"),B:cls("B"),ids:new Set(g.movimentos.map(m=>m.id))};return;}
    for(const l of["A","B"]){const A=acc[l]; if(!E.aldeiasDe(g,l).length) continue; A.turnos++;
      const novos=g.movimentos.filter(m=>m.dono===l&&!snap.ids.has(m.id));
      const saiu={}; for(const m of novos) saiu[m.origemId]=(saiu[m.origemId]||0)+n(m.tropas);
      for(const id in snap[l]){const s=snap[l][id]; if(s.ret){A.retPre+=s.k;A.retSaiu+=saiu[id]||0;} else {A.frPre+=s.k;A.frSaiu+=saiu[id]||0;}}
      const atk=novos.filter(m=>{const a=g.aldeias.find(x=>x.id===m.destinoId);return a.dono!==l;});
      A.envAtk+=atk.length; atk.forEach(m=>A.tamAtk.push(n(m.tropas)));
      A.alvosTurno.push(new Set(atk.map(m=>m.destinoId)).size);
      const tot=E.aldeiasDe(g,l).reduce((s,a)=>s+n(a.tropas),0)+g.movimentos.filter(m=>m.dono===l).reduce((s,m)=>s+n(m.tropas),0);
      if(atk.length) A.maiorEnvio.push(Math.max(...atk.map(m=>n(m.tropas)))/Math.max(1,tot));
    }
  });
  const med=v=>{v=v.slice().sort((x,y)=>x-y);return v.length?v[v.length>>1]:0};
  const fim=/resultado: (\S+)/.exec(P.txt);
  console.log("\n"+path.basename(f).slice(9)+" | vencedor "+(fim?fim[1]:"interrompida"));
  for(const l of["A","B"]){const A=acc[l];
    console.log(`  ${l} ${nomes[l].padEnd(16)} retaguarda que SAI por turno ${(100*A.retSaiu/A.retPre).toFixed(0).padStart(3)}% | fronteira que sai ${(100*A.frSaiu/A.frPre).toFixed(0).padStart(3)}% | ataques/turno ${(A.envAtk/A.turnos).toFixed(1)} | alvos distintos/turno ${(A.alvosTurno.reduce((s,x)=>s+x,0)/A.turnos).toFixed(1)} | tamanho mediano do ataque ${med(A.tamAtk)} tropas | maior ataque do turno = ${(100*med(A.maiorEnvio)).toFixed(0)}% do exercito (mediana)`);}
}
