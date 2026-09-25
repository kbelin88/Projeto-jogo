// conta, por modelo, em quantos TURNOS o raciocinio toca cada duvida de regra
const fs=require("fs"),path=require("path");
const CAT={
  "counter: forca toda ou parte?": /(whole force|entire force|only the (countering|relevant)|multipl\w* (the )?(whole|entire|total)|apply to (the )?(whole|all)|does (it|the counter) (multiply|apply))/i,
  "envios somam? (combinar)": /(combine|add up|sum (of )?(the |my )?(armies|sends|attacks)|together (they|to)|(two|both|multiple) (sends|armies|attacks) (arrive|hit|at the same))/i,
  "reforco ou ataque do inimigo?": /(reinforc\w+ (it|or)|or attack\w* it|attacking or reinforcing|reinforcing or attacking)/i,
  "de onde vem / tamanho do exercito inimigo": /(where is it coming from|size of (the|that) (enemy|army)|how (big|large|many)[^.?]{0,40}(enemy|army|they)|unknown size|don'?t know (its|the) size)/i,
  "perdas/atrito": /(attrition|how many (troops )?(will )?(i|we) lose|losses (will|would) be)/i,
  "capital: proteger": /(protect (my|the) capital|defend (my|the) capital|capital (is|would be) (vulnerable|exposed|undefended|empty)|leave (my|the) capital)/i,
  "defesa na chegada (vai crescer?)": /(by the time (we|i|my|they|it) arriv|defense (may|might|could|will) (grow|increase)|they (may|might|could) (build|reinforce))/i,
  "suposicao explicita": /\b(let'?s assume|i('| wi)ll assume|assume that|assuming)\b/i,
  "fog: o que nao vejo": /(can'?t see|cannot see|unexplored|don'?t know what)/i,
  "conquista: tropas ficam na aldeia?": /(survivors (stay|remain|become)|troops (stay|remain) (there|in)|become the garrison|garrison the (captured|conquered))/i,
};
for(const f of process.argv.slice(2)){
  const txt=fs.readFileSync(f,"utf8");
  const blocos=txt.split(/\n########## TURNO /).slice(1);
  const res={};
  for(const b of blocos){const m=/^(\d+) — Rei ([AB]) \(openrouter:[^/]+\/([^):]+)/.exec(b); if(!m) continue;
    const r=/^raciocinio: ([\s\S]*?)\nordem\.construir/m.exec(b); if(!r||r[1].startsWith("(nao capturado)")) continue;
    const k=m[3].slice(0,22)+" ("+m[2]+")"; res[k]=res[k]||{turnos:0};
    res[k].turnos++;
    for(const c in CAT) if(CAT[c].test(r[1])) res[k][c]=(res[k][c]||0)+1;
  }
  console.log("\n== "+path.basename(f).slice(9));
  for(const k in res){console.log("  "+k+" — turnos com raciocinio: "+res[k].turnos); for(const c in CAT) if(res[k][c]) console.log("     "+c.padEnd(40)+res[k][c]);}
}
