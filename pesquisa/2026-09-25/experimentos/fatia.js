const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
const med=v=>{v=v.slice().sort((x,y)=>x-y);return v.length?v[v.length>>1]:0};
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,16);}
  const fr={A:[],B:[]}, nAt={A:0,B:0}, fatias={A:0,B:0}; let pre=null;
  reexec(P,(g,t,fase)=>{ if(fase==="pre"){pre={ids:new Set(g.movimentos.map(m=>m.id)),k:Object.fromEntries(g.aldeias.map(a=>[a.id,n(a.tropas)]))};return;}
    for(const l of["A","B"]){const novos=g.movimentos.filter(m=>m.dono===l&&!pre.ids.has(m.id));
      const porOrig={}; for(const m of novos){const d=g.aldeias.find(a=>a.id===m.destinoId); if(d.dono===l) continue; (porOrig[m.origemId]=porOrig[m.origemId]||[]).push(m);}
      for(const o in porOrig){const disp=pre.k[o]; for(const m of porOrig[o]){fr[l].push(n(m.tropas)/Math.max(1,disp)); nAt[l]++;} if(porOrig[o].length>1) fatias[l]++;}
    }});
  console.log(path.basename(f).slice(9));
  for(const l of["A","B"]) console.log(`  ${nomes[l].padEnd(16)} ataque = ${(100*med(fr[l])).toFixed(0)}% da guarnicao da origem (mediana) | ataques com >=90% da guarnicao: ${(100*fr[l].filter(x=>x>=0.9).length/fr[l].length).toFixed(0)}% | <50%: ${(100*fr[l].filter(x=>x<0.5).length/fr[l].length).toFixed(0)}%`);
}
