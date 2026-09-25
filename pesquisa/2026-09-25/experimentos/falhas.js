const {carregar,reexec}=require("./reexec.js");const E=require(require("path").join(__dirname,"..","..","..","engine.js"));const path=require("path");
const tot={};
for(const f of process.argv.slice(2)){
  const P=carregar(f); const nomes={}; for(const l of["A","B"]){const m=new RegExp("Rei "+l+" \\(openrouter:([^)]+)\\)").exec(P.txt); nomes[l]=m[1].split("/")[1].replace(":free","").slice(0,18);}
  const vivos=new Map(); let conhecidos=new Set();
  const cls={};
  reexec(P,(g,t,fase)=>{
    if(fase==="pos"){
      for(const m of g.movimentos){ if(conhecidos.has(m.id)) continue; conhecidos.add(m.id);
        const alvo=g.aldeias.find(a=>a.id===m.destinoId); if(alvo.dono===m.dono) continue;
        const p=E.preverCombate(g,m.tropas,alvo);
        const vis=E.montarVisao(g,m.dono).alvos.find(a=>a.id===alvo.id);
        // envios do MESMO dono ao MESMO alvo neste turno
        vivos.set(m.id,{dono:m.dono,t,alvo:alvo.id,Fatk:E.ataqueDe(m.tropas,g.config),ok0:p.atacanteVence,vis:vis&&vis.visivel,ratio:p.FatkEf/Math.max(1,p.FdefEf),v:p.v});
      }
      return;
    }
    // pre: depois do tick -> eventos deste turno
    const evs=g.log.filter(e=>e.turno===g.turno);
    const idsAgora=new Set(g.movimentos.map(m=>m.id));
    for(const [id,r] of vivos){ if(idsAgora.has(id)) continue; vivos.delete(id);
      const ev=evs.find(e=>e.tipo==="combate"&&e.atacante===r.dono&&e.Fatk===r.Fatk&&!e._usado);
      const es=evs.find(e=>e.tipo==="combate_estrada"&&(e.atkId===id||e.defId===id));
      let k;
      if(es) k=(es.vencedorDono===r.dono)?(ev&&ev.vencedor==="defensor"?"estrada+falhou":null):"morto na estrada";
      if(!k&&ev){ev._usado=1; if(ev.vencedor==="atacante") k=r.ok0?"ok (previsto)":"ok (sorte/mudou)"; else k=r.ok0?"FALHOU mas ganhava na ordem (defesa mudou na marcha)":(r.vis?"FALHOU e ja perdia na ordem (alvo VISIVEL)":"FALHOU e ja perdia (alvo nao visivel)");}
      if(!k) k="outro (reforco/sem evento)";
      const key=nomes[r.dono]; cls[key]=cls[key]||{}; cls[key][k]=(cls[key][k]||0)+1;
      if(k.startsWith("FALHOU e ja perdia")){cls[key].razoes=(cls[key].razoes||[]); cls[key].razoes.push(r.ratio.toFixed(2)+(r.v<0?"c":""));}
    }
  });
  console.log("\n"+path.basename(f).slice(9));
  for(const k in cls){const {razoes,...rest}=cls[k]; console.log("  "+k.padEnd(20),JSON.stringify(rest)); if(razoes) console.log("     razao ef/def na ordem (c = defensor tinha counter):",razoes.join(" "));}
}
