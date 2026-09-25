// para ataques que ganhavam na ordem e falharam: o que mudou?
const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,14);}
  const vivos=new Map(), vistos=new Set(); const out={};
  reexec(P,(g,t,fase)=>{
    if(fase==="pos"){
      // envios deste turno, agrupados por dono+alvo
      const novos=g.movimentos.filter(m=>!vistos.has(m.id)); novos.forEach(m=>vistos.add(m.id));
      for(const m of novos){const alvo=g.aldeias.find(a=>a.id===m.destinoId); if(alvo.dono===m.dono) continue;
        const irmaos=novos.filter(x=>x!==m&&x.dono===m.dono&&x.destinoId===m.destinoId).length;
        const inimigoRumo=g.movimentos.filter(x=>x.dono!==m.dono&&x.destinoId===m.destinoId).length;
        vivos.set(m.id,{dono:m.dono,t,alvo:alvo.id,donoAlvo:alvo.dono,Fatk:E.ataqueDe(m.tropas,g.config),ok0:E.preverCombate(g,m.tropas,alvo).atacanteVence,def0:Math.round(E.forcaDefesa(g,alvo)),tr0:n(alvo.tropas),irmaos,inimigoRumo,turnos:m.turnosRestantes,dest:m.destinoId});}
      return;}
    const evs=g.log.filter(e=>e.turno===g.turno); const ids=new Set(g.movimentos.map(m=>m.id));
    for(const [id,r] of vivos){ if(ids.has(id)) continue; vivos.delete(id); if(!r.ok0) continue;
      const ev=evs.find(e=>e.tipo==="combate"&&e.atacante===r.dono&&e.Fatk===r.Fatk&&!e._u); if(!ev||ev.vencedor!=="defensor") continue; ev._u=1;
      const alvo=g.aldeias.find(a=>a.id===ev.alvoId);
      let causa;
      if(ev.alvoId!==r.dest) causa="parou noutra aldeia";
      else { const antes=evs.filter(e=>e.alvoId===r.alvo && e!==ev && g.log.indexOf(e)<g.log.indexOf(ev));
        const trocouDono = antes.some(e=>e.tipo==="combate"&&e.vencedor==="atacante");
        const reforco = antes.some(e=>e.tipo==="reforco");
        if(r.donoAlvo===null && trocouDono) causa="neutra foi tomada pelo INIMIGO antes (chegou a uma aldeia inimiga fresca)";
        else if(trocouDono) causa="aldeia mudou de dono antes da chegada";
        else if(reforco) causa="inimigo REFORCOU a aldeia antes";
        else if(ev.Fdef>r.def0) causa="defesa cresceu (construcao) durante a marcha";
        else causa="outro: counter/tipo mudou";
      }
      const k=nomes[r.dono]; out[k]=out[k]||{}; out[k][causa]=(out[k][causa]||0)+1;
      if(r.irmaos){const k2="(tinha outros envios ao mesmo alvo)"; out[k][k2]=(out[k][k2]||0)+1;}
      if(r.inimigoRumo){const k3="(inimigo ja marchava p/ o alvo na hora da ordem)"; out[k][k3]=(out[k][k3]||0)+1;}
    }
  });
  console.log("\n"+path.basename(f).slice(9)); for(const k in out) console.log("  "+k.padEnd(15),JSON.stringify(out[k]));
}
