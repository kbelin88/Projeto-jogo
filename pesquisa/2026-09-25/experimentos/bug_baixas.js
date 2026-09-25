// bug_baixas.js — o "your losses: N troops" do P4 de 23/09 contra as tropas
// realmente perdidas. Mede o texto ANTIGO (baixasForca, que e PODER): a partir
// de 25/09 o prompt le baixasTropas (flag baixasReais), e este script fica como
// a prova do que as partidas de 23/09 leram.
const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
let tot=0,difer=0,ex=[]; const soma={dito:0,real:0};
for(const f of process.argv.slice(2)){const P=carregar(f); const mov=new Map();
  reexec(P,(g,t,fase)=>{ if(fase==="pos"){for(const m of g.movimentos) if(!mov.has(m.id)) mov.set(m.id,{dono:m.dono,tropas:Object.assign({},m.tropas),Fatk:E.ataqueDe(m.tropas,g.config)});return;}
    for(const ev of g.log.filter(e=>e.turno===g.turno&&e.tipo==="combate"&&e.vencedor==="atacante")){
      const cand=[...mov.values()].find(m=>m.dono===ev.atacante&&m.Fatk===ev.Fatk); if(!cand) continue;
      const real=n(cand.tropas)-ev.sobreviventesForca; tot++; soma.dito+=ev.baixasForca; soma.real+=real;
      if(real!==ev.baixasForca){difer++; if(ex.length<5) ex.push(`enviou ${JSON.stringify(cand.tropas)} -> o prompt diz "your losses: ${ev.baixasForca} troops", perdeu de facto ${real}`);} }
  });}
console.log(`vitorias de ataque verificadas: ${tot} | o numero do prompt difere das tropas perdidas em ${difer} (${(100*difer/tot).toFixed(0)}%) | soma dita ${soma.dito} vs soma real ${soma.real}`); ex.forEach(x=>console.log("  "+x));
