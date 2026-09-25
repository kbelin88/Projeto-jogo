// Ataques que GANHAVAM na hora da ordem e falharam porque a defesa cresceu por
// CONSTRUCAO durante a marcha: o estoque do alvo, na hora da ordem, avisava?
const {carregar,reexec,fotografia}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));
const n=t=>(t.lanceiro||0)+(t.arqueiro||0)+(t.cavaleiro||0);
let tot=0,avisava=0,tamb=0,okTot=0,okAvisava=0;
for(const f of process.argv.slice(2)){const P=carregar(f); const vivos=new Map(),vistos=new Set();
  let estoquePre={}, foto=null;
  reexec(P,(g,t,fase)=>{
    // o estoque que conta e o de ANTES das ordens (as ordens sao simultaneas:
    // no "pos" o inimigo ja gastou a madeira nas construcoes deste turno)
    if(fase==="pre"){ estoquePre=Object.fromEntries(g.aldeias.map(a=>[a.id,a.recursos.madeira])); foto=fotografia(g); }
    if(fase==="pos"){ for(const m of g.movimentos){ if(vistos.has(m.id)) continue; vistos.add(m.id);
        const a=g.aldeias.find(x=>x.id===m.destinoId); if(a.dono===m.dono||a.dono===null) continue; // so alvos de REI (neutras nao constroem)
        const p=E.preverCombate(g,m.tropas,foto[a.id]); if(!p.atacanteVence) continue;
        const bonus=a.capital?g.config.combate.bonus_defesa_castelo:g.config.combate.bonus_defesa_aldeia;
        // o pior caso que o estoque paga: tudo em lanceiro (def 2, 15 madeira)
        const lanc=Math.floor((estoquePre[a.id])/g.config.tropas.lanceiro.custo.madeira);
        const pior=(E.defesaDe(foto[a.id].tropas,g.config)+lanc*g.config.tropas.lanceiro.def)*bonus;
        vivos.set(m.id,{dono:m.dono,Fatk:E.ataqueDe(m.tropas,g.config),alvo:a.id,avisa:p.FatkEf<=pior}); } return; }
    const evs=g.log.filter(e=>e.turno===g.turno); const ids=new Set(g.movimentos.map(m=>m.id));
    for(const [id,r] of vivos){ if(ids.has(id)) continue; vivos.delete(id);
      const ev=evs.find(e=>e.tipo==="combate"&&e.atacante===r.dono&&e.Fatk===r.Fatk&&e.alvoId===r.alvo&&!e._u); if(!ev) continue; ev._u=1;
      const reforco=evs.some(e=>e.tipo==="reforco"&&e.alvoId===r.alvo);
      if(ev.vencedor==="defensor"&&!reforco){tot++; if(r.avisa) avisava++;}
      if(ev.vencedor==="atacante"){okTot++; if(r.avisa) okAvisava++;}
    }});}
console.log(`ataques a aldeias de Rei que ganhavam na ordem e FALHARAM sem reforco: ${tot}; o estoque do alvo ja pagava defesa suficiente em ${avisava} (${(100*avisava/tot).toFixed(0)}%)`);
console.log(`(controlo) os que VENCERAM: ${okTot}; o mesmo alarme teria soado em ${okAvisava} (${(100*okAvisava/okTot).toFixed(0)}%) -- o alarme e o pior caso, nao uma previsao`);
