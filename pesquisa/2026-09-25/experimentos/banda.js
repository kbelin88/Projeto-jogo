const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,16);}
  const acc={A:{t:0,ald:0,ativas:0,ref:0,atk:0,retAld:0,retAtivas:0,retAtk:0},B:{t:0,ald:0,ativas:0,ref:0,atk:0,retAld:0,retAtivas:0,retAtk:0}};
  let ids=null;
  reexec(P,(g,t,fase)=>{ if(fase==="pre"){ids=new Set(g.movimentos.map(m=>m.id));return;}
    for(const l of["A","B"]){const minhas=E.aldeiasDe(g,l); if(!minhas.length) continue; const A=acc[l]; A.t++;
      const novos=g.movimentos.filter(m=>m.dono===l&&!ids.has(m.id)); const origens=new Set(novos.map(m=>m.origemId));
      A.ald+=minhas.length; A.ativas+=origens.size;
      for(const m of novos){const d=g.aldeias.find(a=>a.id===m.destinoId); if(d.dono===l)A.ref++; else A.atk++;}
      for(const a of minhas){ if(g.estradas.adj[a.id].every(v=>g.aldeias.find(x=>x.id===v).dono===l)){A.retAld++; if(origens.has(a.id))A.retAtivas++;} }
    }});
  console.log(path.basename(f).slice(9));
  for(const l of["A","B"]){const A=acc[l]; console.log(`  ${nomes[l].padEnd(16)} aldeias medias ${(A.ald/A.t).toFixed(1)} | aldeias que dao ordem de envio/turno ${(A.ativas/A.t).toFixed(1)} (${(100*A.ativas/A.ald).toFixed(0)}%) | aldeias de RETAGUARDA que mexem ${(100*A.retAtivas/Math.max(1,A.retAld)).toFixed(0)}% | reforcos ${A.ref} vs ataques ${A.atk}`);}
}
