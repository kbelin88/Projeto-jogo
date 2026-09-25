const fs=require("fs");const [re,max]=[new RegExp(process.argv[2],"i"),+process.argv[3]||20];
const out=[];
for(const f of process.argv.slice(4)){const txt=fs.readFileSync(f,"utf8");
 for(const b of txt.split(/\n########## TURNO /).slice(1)){const m=/^(\d+) — Rei ([AB]) \(openrouter:[^/]+\/([^):]+)/.exec(b); const r=/^raciocinio: ([\s\S]*?)\nordem\.construir/m.exec(b); if(!m||!r) continue;
  const frases=r[1].replace(/\n/g," ").split(/(?<=[.?!])\s+/);
  frases.forEach((s,i)=>{ if(re.test(s)) out.push(`[${f.match(/P\d/)[0]} T${m[1]} ${m[3].slice(0,12)}] `+frases.slice(Math.max(0,i-1),i+2).join(" ").slice(0,420)); });}}
const pick=out.filter((_,i)=>i%Math.max(1,Math.floor(out.length/max))===0).slice(0,max);
console.log("total",out.length); pick.forEach(s=>console.log("- "+s));
