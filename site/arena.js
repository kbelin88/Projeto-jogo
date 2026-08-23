/* The Kings Arena — base comum: idioma, formatação, cabeçalho. */
const DIC = {
  pt:{
    marca_sub:"benchmark de estratégia para LLMs",
    nav_class:"Classificação", nav_part:"Partidas", nav_metodo:"Método", nav_repo:"Repositório",
    hero_h1:"LLMs jogam como Reis. A gente mede quem joga melhor.",
    hero_p1:"O jogo existe para testar diferentes LLMs num jogo de estratégia simples: cada modelo comanda um exército num mapa, constrói tropas, administra recursos e conquista aldeias para vencer a outra LLM.",
    kpi_part:"partidas", kpi_mod:"modelos medidos",
    sec_class_h:"Classificação",
    sec_class_p:"Ordenada por vitórias; empate desfeito pelo saldo total de aldeias e, por fim, por menos derrotas. Só partidas decididas contam para vitória e derrota; partidas interrompidas entram apenas nas colunas de comportamento.",
    leg_h:"O que cada coluna quer dizer",
    leg_vd:"V / D — partidas ganhas e perdidas. Ganha quem tiver mais aldeias no fim.",
    leg_partidas:"partidas — quantas vezes o modelo jogou. Num espelho, o mesmo modelo joga dos dois lados e conta duas vezes.",
    leg_turninv:"turnos inválidos — turnos em que o modelo não conseguiu jogar: não respondeu, respondeu fora do formato, ou a resposta não chegou.",
    leg_ordinv:"ordens inválidas — ordens que o motor recusou: mandar tropa que não existe, atacar uma aldeia que não está no mapa, gastar recurso que não tem.",
    leg_sturno:"s / turno — quanto tempo o modelo leva para decidir um turno (mediana).",
    leg_tok:"tokens entrada / saída — tamanho médio do que o modelo lê e do que escreve por turno.",
    leg_rac:"% raciocínio — quanto da saída foi pensar antes de responder. Vem do contador do provedor; — quer dizer que ele não informa.",
    leg_custo:"custo / turno (est.) — todas as partidas correram no free tier — o custo real foi US$ 0,00. Esta coluna estima o que o mesmo modelo custaria a preço de tabela da OpenRouter, para dar uma base de comparação.",
    leg_lac:"lanceiro / arqueiro / cavaleiro — de que o modelo montou o exército. Lanceiro é barato e fraco, cavaleiro é caro e forte, arqueiro fica no meio.",
    leg_atkvenc:"ataques vencidos — de cada 100 ataques, quantos tomaram a aldeia.",
    leg_aldpart:"aldeias / partida — quantas aldeias o modelo conquista, em média, por partida.",
    grp_resultado:"resultado", grp_confiab:"confiabilidade", grp_custo:"custo", grp_jogo:"jogo",
    th_mod:"modelo", th_v:"V", th_d:"D", th_partidas:"partidas",
    th_turninv:"turnos inválidos", th_ordinv:"ordens inválidas",
    th_sturno:"s / turno", th_tokin:"tokens entrada", th_tokout:"tokens saída",
    th_pctrac:"% raciocínio", th_custo:"custo / turno (est.)",
    th_lanc:"% lanceiro", th_arq:"% arqueiro", th_cav:"% cavaleiro",
    th_atkvenc:"ataques vencidos", th_aldpart:"aldeias / partida",
    sec_part_h:"Partidas",
    th_data:"data", th_conf:"confronto", th_placar:"placar", th_turnos:"turnos", th_fim:"fim", th_ver:"",
    fim_limite:"limite de turnos", fim_vitoriaA:"vitória por dominância", fim_vitoriaB:"vitória por dominância", fim_interrompida:"interrompida",
    ver_replay:"ver replay →", sem_replay:"—",
    sec_met_h:"Método",
    sec_met_p:"Dois modelos de linguagem jogam como Reis, um de cada lado do mapa. A cada turno, cada Rei recebe um relatório em texto do que consegue ver e responde com um JSON de ordens: o que construir e para onde mandar tropa. Um motor determinístico executa as duas ordens ao mesmo tempo e devolve o mundo novo. Os modelos nunca se falam e nunca veem o código.",
    met_partida_legenda:"Uma partida a correr: as duas capitais, as 22 aldeias neutras e a rede de estradas. O mapa é simétrico — para cada cidade do Oeste existe uma gêmea no Este com os custos de marcha invertidos.",
    reiA_lbl:"Rei A",
    reiB_lbl:"Rei B",
    rodape_arte:"Ilustrações geradas com IA e tratadas para o projeto.",
    carregando:"a carregar os dados…",
    erro_dados_h:"Os dados não carregaram",
    erro_dados_p:"A página abriu, mas os ficheiros de dados não chegaram ao navegador. Costuma ser uma falha de rede momentânea ou uma versão antiga em cache — tentar de novo resolve quase sempre.",
    erro_dados_btn:"Tentar de novo",
    met_mapa_legenda:"24 aldeias, 41 estradas. As duas capitais são o ponto de partida de cada Rei. O mapa é simétrico: para cada cidade do Oeste existe uma gêmea no Este com os custos de marcha invertidos.",
    met_regras_h:"As regras",
    met_regras:"Cada aldeia produz 30 de madeira e 20 de ferro por turno.|Três tropas: lanceiro (ataque 1, barato), arqueiro (ataque 2), cavaleiro (ataque 4, caro e rápido). Elas se contra-atacam em triângulo — lanceiro vence cavaleiro, cavaleiro vence arqueiro, arqueiro vence lanceiro — e acertar o contra-ataque multiplica a força por 1,5.|Marchar leva turnos, e o custo é o da estrada, nunca a distância no desenho.|Aldeias neutras endurecem sozinhas com o tempo: quem demora a expandir paga mais caro.|Névoa de guerra: cada Rei vê as próprias aldeias e as vizinhas diretas. Vê onde ficam todas as cidades — o mapa é público — mas não o que há dentro das que não alcança. Não existe unidade de exploração: explorar é conquistar.|Vitória: quem segurar 75% das aldeias por dois turnos seguidos ganha. Sem isso, a partida vai até o limite de turnos e quem tiver mais aldeias fica na frente.",
    met_medido_h:"O que é medido",
    met_medido_p:"Tudo o que a tabela mostra sai do estado do motor gravado a cada turno, não da narração do jogo. O registro de cada partida fica no repositório, aberto: o texto de todos os turnos, o raciocínio dos modelos e o arquivo de replay.",
    p_voltar:"← todas as partidas", p_seed:"seed", p_turnos:"turnos",
    aba_replay:"Replay", aba_log:"Log", aba_analise:"Análise",
    ctrl_play:"▶ tocar", ctrl_pause:"❚❚ pausar", ctrl_ini:"⏮", ctrl_fim:"⏭",
    lbl_aldeias:"aldeias", lbl_tropas:"tropas", lbl_transito:"em marcha", lbl_constr:"construindo",
    lbl_dep:"depoimento do Rei", lbl_semdep:"(sem depoimento neste turno)",
    lbl_eventos:"o que aconteceu neste turno", lbl_semeventos:"nada — os exércitos ainda marcham",
    log_carregando:"carregando o log…", log_rac:"raciocínio do modelo", log_crua:"resposta crua",
    log_ordens:"ordens emitidas", log_motor:"o que o motor fez", log_plano:"plano (volta no próximo prompt)",
    log_verrac:"ver raciocínio completo", log_semrac:"(raciocínio não capturado)",
    leg_A:"Rei A", leg_B:"Rei B", leg_neu:"neutra", leg_cap:"capital",
    conquista:"CONQUISTA", venceu_def:"defensor segurou", venceu_atk:"atacante venceu",
  },
  en:{
    marca_sub:"a strategy benchmark for LLMs",
    nav_class:"Leaderboard", nav_part:"Matches", nav_metodo:"Method", nav_repo:"Repository",
    hero_h1:"LLMs play as Kings. We measure who plays better.",
    hero_p1:"The game exists to test different LLMs on a simple strategy game: each model commands an army on a map, builds troops, manages resources and captures villages to beat the other LLM.",
    kpi_part:"matches", kpi_mod:"models measured",
    sec_class_h:"Leaderboard",
    sec_class_p:"Ranked by wins; ties broken by total village margin and then by fewer losses. Only decided matches count towards wins and losses; matches cut short appear only in the behaviour columns.",
    leg_h:"What each column means",
    leg_vd:"W / L — matches won and lost. You win by having more villages at the end.",
    leg_partidas:"matches — how many times the model played. In a mirror, the same model plays both sides and counts twice.",
    leg_turninv:"invalid turns — turns where the model failed to play: no response, malformed response, or the response never arrived.",
    leg_ordinv:"invalid orders — orders the engine rejected: sending troops it doesn't have, attacking a village that isn't on the map, spending a resource it doesn't have.",
    leg_sturno:"s / turn — how long the model takes to decide a turn (median).",
    leg_tok:"input / output tokens — the typical size of what the model reads and writes per turn.",
    leg_rac:"% reasoning — how much of the output was thinking before answering. Comes from the provider's own counter; — means it doesn't report one.",
    leg_custo:"cost / turn (est.) — every match ran on the free tier — the real cost was US$ 0.00. This column estimates what the same model would cost at OpenRouter's list price, as a basis for comparison.",
    leg_lac:"spearman / archer / knight — what the model built its army from. Spearmen are cheap and weak, knights are expensive and strong, archers sit in between.",
    leg_atkvenc:"attacks won — out of every 100 attacks, how many took the village.",
    leg_aldpart:"villages / match — how many villages the model captures, on average, per match.",
    grp_resultado:"result", grp_confiab:"reliability", grp_custo:"cost", grp_jogo:"game",
    th_mod:"model", th_v:"W", th_d:"L", th_partidas:"matches",
    th_turninv:"invalid turns", th_ordinv:"invalid orders",
    th_sturno:"s / turn", th_tokin:"input tokens", th_tokout:"output tokens",
    th_pctrac:"% reasoning", th_custo:"cost / turn (est.)",
    th_lanc:"% spearmen", th_arq:"% archers", th_cav:"% knights",
    th_atkvenc:"attacks won", th_aldpart:"villages / match",
    sec_part_h:"Matches",
    th_data:"date", th_conf:"matchup", th_placar:"score", th_turnos:"turns", th_fim:"ending", th_ver:"",
    fim_limite:"turn limit", fim_vitoriaA:"win by dominance", fim_vitoriaB:"win by dominance", fim_interrompida:"cut short",
    ver_replay:"watch replay →", sem_replay:"—",
    sec_met_h:"Method",
    sec_met_p:"Two language models play as Kings, one on each side of the map. Each turn, every King gets a text report of what it can see and answers with a JSON of orders: what to build and where to send troops. A deterministic engine runs both orders at the same time and returns the new world. The models never talk to each other and never see the code.",
    met_partida_legenda:"A match in progress: the two capitals, the 22 neutral villages and the road network. The map is symmetric — every city in the West has a twin in the East with mirrored marching costs.",
    reiA_lbl:"King A",
    reiB_lbl:"King B",
    rodape_arte:"Illustrations generated with AI and processed for the project.",
    carregando:"loading the data…",
    erro_dados_h:"The data did not load",
    erro_dados_p:"The page opened, but the data files never reached the browser. This is usually a momentary network failure or a stale cached version — retrying almost always fixes it.",
    erro_dados_btn:"Try again",
    met_mapa_legenda:"24 villages, 41 roads. The two capitals are each King's starting point. The map is symmetric: every city in the West has a twin in the East with mirrored marching costs.",
    met_regras_h:"The rules",
    met_regras:"Each village produces 30 wood and 20 iron per turn.|Three troop types: spearman (attack 1, cheap), archer (attack 2), knight (attack 4, expensive and fast). They counter each other in a triangle — spearman beats knight, knight beats archer, archer beats spearman — and landing the counter multiplies force by 1.5.|Marching takes turns, and the cost is the road's, never the distance on the drawing.|Neutral villages harden on their own over time: waiting to expand costs more.|Fog of war: each King sees its own villages and their direct neighbours. It sees where every city is — the map is public — but not what's inside the ones it can't reach. There's no scout unit: to explore is to conquer.|Victory: whoever holds 75% of the villages for two consecutive turns wins. Short of that, the match runs to the turn limit and whoever has more villages comes out ahead.",
    met_medido_h:"What is measured",
    met_medido_p:"Everything the table shows comes from the engine state saved every turn, not from the game's narration. Each match's record is in the repository, open: the text of every turn, the models' own reasoning, and the replay file.",
    p_voltar:"← all matches", p_seed:"seed", p_turnos:"turns",
    aba_replay:"Replay", aba_log:"Log", aba_analise:"Analysis",
    ctrl_play:"▶ play", ctrl_pause:"❚❚ pause", ctrl_ini:"⏮", ctrl_fim:"⏭",
    lbl_aldeias:"villages", lbl_tropas:"troops", lbl_transito:"marching", lbl_constr:"in build",
    lbl_dep:"the King's dispatch", lbl_semdep:"(no dispatch this turn)",
    lbl_eventos:"what happened this turn", lbl_semeventos:"nothing — the armies are still marching",
    log_carregando:"loading the log…", log_rac:"model reasoning", log_crua:"raw response",
    log_ordens:"orders issued", log_motor:"what the engine did", log_plano:"plan (returns in next prompt)",
    log_verrac:"show full reasoning", log_semrac:"(reasoning not captured)",
    leg_A:"King A", leg_B:"King B", leg_neu:"neutral", leg_cap:"capital",
    conquista:"CAPTURED", venceu_def:"defender held", venceu_atk:"attacker won",
  }
};
let LANG = 'pt';
try{ const s=localStorage.getItem('arena_lang'); if(s==='pt'||s==='en') LANG=s; }catch(e){}
function t(k){ return (DIC[LANG]&&DIC[LANG][k]) || (DIC.pt[k]) || k; }
function aplicarIdioma(){
  document.documentElement.lang = LANG==='pt'?'pt-BR':'en';
  document.querySelectorAll('[data-t]').forEach(el=>{ el.textContent = t(el.dataset.t); });
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('on', b.dataset.lang===LANG));
  if(window.aoTrocarIdioma) window.aoTrocarIdioma();
}
function setLang(l){ LANG=l; try{localStorage.setItem('arena_lang',l);}catch(e){} aplicarIdioma(); }
function cabecalho(ativo){
  return `<header class="topo"><div class="wrap">
    <a class="marca" href="index.html">
      <img src="assets/simbolo.png" alt="">
      <span><span class="the">The</span><span class="nome">Kings <i>Arena</i></span></span>
    </a>
    <nav class="menu">
      <a href="index.html#classificacao" class="${ativo==='c'?'on':''}" data-t="nav_class"></a>
      <a href="index.html#partidas" class="${ativo==='p'?'on':''}" data-t="nav_part"></a>
      <a href="index.html#metodo" data-t="nav_metodo"></a>
      <a href="https://github.com/kbelin88/Projeto-jogo" target="_blank" rel="noopener" data-t="nav_repo"></a>
      <div class="lang">
        <button data-lang="pt" onclick="setLang('pt')">PT</button>
        <button data-lang="en" onclick="setLang('en')">EN</button>
      </div>
    </nav></div></header>`;
}
function curto(m){ return String(m).replace(/^openrouter:/,'').replace(/:free$/,'').replace(/^nvidia\//,'').replace(/^dots-studio\//,'').replace(/^poolside\//,'').replace(/^openai\//,''); }
function pct(x){ return x==null?'—':Math.round(x*100)+'%'; }
function num(x,d){ return x==null?'—':(d?Number(x).toFixed(d):x); }
function seg(s){ if(s==null) return '—'; return s>=60? Math.floor(s/60)+'m'+String(Math.round(s%60)).padStart(2,'0')+'s' : Math.round(s)+'s'; }
function fmtCusto(x){ return x==null?'—':('$'+x.toFixed(4)); }
function fmtPctRac(x){ return x==null?'—':(x==='over100'?'>100%':x+'%'); }
function barraLAC(l,a,c){
  if(l==null) return '—';
  return `<div class="barra" style="display:flex;min-width:74px"><i style="width:${l}%;background:#7c7060"></i><i style="width:${a}%;background:#9c8a4e"></i><i style="width:${c}%;background:var(--ouro)"></i></div>`+
    `<span class="mini">${l}/${a}/${c}%</span>`;
}

/* ------------------------------------------------------------------
   Carregamento de dados que NUNCA falha em silencio.

   O bug que isto corrige: `Promise.all([fetch(...)]).then(...)` sem
   `.catch()` deixava a pagina inteira renderizada com as tabelas
   vazias sempre que um dos fetch falhasse — sem mensagem, sem retry,
   sem nada no ecra. Um engasgo de rede ou um HTML em cache eram
   indistinguiveis de "o site nao tem dados".

   - `cache:'no-cache'` forca revalidacao (ETag) em vez de servir uma
     copia velha do disco; o custo e um 304 de algumas centenas de bytes.
   - retenta 2x com espera crescente antes de desistir.
   - o erro diz QUAL ficheiro falhou e com que codigo.
------------------------------------------------------------------ */
function escaparHTML(x){ return String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function buscarJSON(caminho, tentativas){
  const n = (tentativas==null) ? 3 : tentativas;
  function tentar(i, ultimoErro){
    if(i >= n){
      const e = new Error(caminho + ' → ' + (ultimoErro && ultimoErro.message || 'falhou'));
      e.arquivo = caminho;
      return Promise.reject(e);
    }
    return fetch(caminho, {cache:'no-cache'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(err=> new Promise(res=>setTimeout(res, 400*(i+1))).then(()=>tentar(i+1, err)));
  }
  return tentar(0, null);
}

/* Placeholder visivel enquanto os dados nao chegam: uma tabela vazia
   deixa de ser ambigua. */
function marcarCarregando(seletor, colspan){
  const tb = document.querySelector(seletor);
  if(tb) tb.innerHTML = '<tr><td colspan="'+(colspan||17)+'" class="mini" style="padding:18px;text-align:center">'+escaparHTML(t('carregando'))+'</td></tr>';
}

function mostrarErroDados(err, tentarDeNovo){
  console.error('[Kings Arena] falha ao carregar dados:', err);
  let cx = document.getElementById('erro-dados');
  if(!cx){
    cx = document.createElement('div');
    cx.id = 'erro-dados';
    cx.className = 'erro-dados';
    document.body.insertBefore(cx, document.body.firstChild);
  }
  cx.innerHTML = '<div class="wrap">'
    + '<b>' + escaparHTML(t('erro_dados_h')) + '</b>'
    + '<p>' + escaparHTML(t('erro_dados_p')) + '</p>'
    + '<p class="mini det">' + escaparHTML(err && err.message || err) + '</p>'
    + '<button type="button" id="erro-retry">' + escaparHTML(t('erro_dados_btn')) + '</button>'
    + '</div>';
  cx.querySelector('#erro-retry').onclick = function(){
    cx.parentNode.removeChild(cx);
    tentarDeNovo();
  };
}
