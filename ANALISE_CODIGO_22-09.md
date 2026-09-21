# Análise profunda do código — 22/09

Pedida pelo Lucas antes de qualquer correção: **identificar tudo primeiro**.
Nada foi alterado para escrever isto. Tudo o que está aqui é medido, com o
comando ou o número ao lado.

---

## 0. O estado de saúde, primeiro

| prova | resultado |
|---|---|
| testes do motor (`testes/test_*.js`) | **33 passam, 0 falham** |
| smokes (`testes_arena/*.js`) | **9 passam, 0 falham** |
| sintaxe de todos os `.js` versionados | **ok** |
| sintaxe de todos os `.py` versionados | **ok** |
| `verificarEquilibrio()` do mapa | **0 falhas** (24 cidades, 37 estradas) |
| funções mortas no `index.html` | 4 em 173 (e 2 são falso positivo) |
| API pública do motor | 77 entradas, 8 nunca usadas fora |

**O motor não está partido.** O que está baralhado é a camada que DESENHA, e a
arrumação dos ficheiros. É importante dizer isto antes de mexer: a limpeza é de
organização e de camadas repetidas, não de bugs no cálculo da partida.

---

## 1. O tamanho do problema, em linhas

| ficheiro | linhas | o que tem lá dentro |
|---|---|---|
| `index.html` | **6 424** | jogo, desenho 2D, 4 clientes de API, replay, crónica, caderno de marcas, ponte 3D |
| `engine.js` | 3 557 | o motor (e dois renderizadores de prompt: P4 e o legado) |
| `ferramentas/cena/exportar_mapa.py` | 2 021 | o forno do mapa inteiro |
| `ferramentas/cena/pecas.py` | 1 748 | a biblioteca de peças |
| `sonda3d/mapa3d.js` | 1 729 | mapa, tropas, placas, marcas, batalhas, câmara |
| `sonda3d/encontro.html` | 841 | a bancada da batalha (guião **duplicado** do `batalha.js`) |
| `sonda3d/batalha.js` | 418 | a cena de batalha do jogo |

---

## 2. Camadas repetidas — a causa da "bagunça"

### 2.1 Três sistemas desenham tropas

| sistema | onde | modelo | usa-se? |
|---|---|---|---|
| símbolo rígido instanciado | `mapa3d.js` (`tropaInst`, teto 400/tipo) | **soldados ANTIGOS** do `pecas.glb` | só como reserva |
| poço animado (28 por tipo) | `mapa3d.js` (`animados`) | soldados novos | sim |
| cópias próprias da batalha | `batalha.js` | soldados novos | sim |

**Medido no jogo:** com a câmara sobre uma estrada movimentada, **56 figuras
novas e 4 antigas ao mesmo tempo, em 410 de 410 amostras**. É a mistura que o
Lucas viu. As peças antigas (`lanceiro` 1 224 tri, `arqueiro` 1 360, `cavaleiro`
1 956) continuam a ser assadas no `pecas.glb` e têm **zero cópias** no mapa.

### 2.2 Duas cenas de batalha

`encontro.html` (841 linhas) tem o guião completo, e `batalha.js` (418) tem o
mesmo guião outra vez. Quando se afina um, o outro fica para trás.

### 2.3 Dois clientes de OpenRouter

`index.html` (83 linhas, com `Retry-After` e 9 tentativas) e `rei.js` — dívida
conhecida desde agosto. Hoje só o do browser sabe sobreviver a throttle.

### 2.4 O desenhador 2D continua vivo

269 linhas do `draw()` que **nunca pintam** com o 3D ligado (sai logo na
primeira linha), mais todo o desenho de aldeias, estradas e mata por baixo.

### 2.5 Números iguais escritos em vários sítios

- escala do soldado **2.2** em 4 ficheiros (`mapa3d`, `batalha`, `encontro`, `marcha`);
- tinta do Rei B **0xe08070** em 3;
- tetos e poços (`POCO_ANIM 28`, `TETO_TROPA 400`, `MAX_VIVAS 6`, `POR_LADO 8`)
  espalhados sem ninguém que os relacione.

---

## 3. Defeitos de comportamento já identificados (com número)

1. **Combates sem cena.** Por turno chegam **10** combates de estrada; o teto é
   **6**. Os outros não têm cena *nem marcador*. A conversão do evento não perde
   nada (55 eventos do motor → 55 convertidos); o corte é só o teto.
2. **Tropa parada depois da luta.** O rescaldo de 12 s deixa os **sobreviventes
   de pé**; devia deixar só os mortos e mandar o vencedor seguir.
3. **Assalto a aldeia sem cena nenhuma** — só o combate em campo aberto tem.
4. **`feitas` cresce para sempre** em `batalha.js` (um id por combate; numa
   sessão longa é lixo que nunca sai).
5. **4 `catch` mudos** no `index.html` (engolem o erro sem uma linha).

---

## 4. Ficheiros órfãos (não são chamados por ninguém)

**JS/HTML:** `calibrar-mapa.html`, `docs/proto_site_v2.html`,
`ferramentas/{assento-burro,baseline-burro,dossie,folga-de-saida,sonda-burro-estrada,tokens-crescimento}.js`,
`runners/{exp_tabela_tarefa7,partida_local,partida_local_log,rei_partida}.js`,
`sonda3d/{bancada,montanhas}.html` (estes dois são bancadas que abrimos à mão).

**Python:** 17 ficheiros, mas **a maioria é ferramenta de mão** e deve ficar
(`medir_portoes`, `ver_montanhas`, `sala_provas`, `ver_glb`, `quatro_vistas`…).
Órfãos a sério: `_cozer_antigo.py`, `chao_liso.py`, `junta.py`, `manifesto.py`,
`preparar_texturas.py`, e o par `guerreiros.py`/`tropas3d.py` (os soldados
antigos) assim que o símbolo rígido sair.

**Disco (fora do git):** `videos/` 2,9 GB, `resultados/` 116 MB, e em `sonda3d/`
cerca de **160 MB** de GLB, dos quais o jogo só usa `pecas.glb` (46 MB) e os
três soldados novos (1 MB ao todo). O resto são bancadas e modelos velhos.

---

## 5. O motor, por dentro

- **Dois renderizadores de prompt**: P4 (77 + 260 linhas) e o **legado**
  (103 + 316 linhas), que existe só para o `test_lote_c` continuar a validar
  textos congelados. São 419 linhas vivas por causa de um teste.
- **11 flags de lote** ainda lidas (`promptP3`, `marchaComOrigem`,
  `redeComDono`, `marcarFronteira`, `contagemAgregada`, `rotulosExpectativa`,
  `deltaDefesa`, `memoriaAlvo`, `ordensSimultaneas`, `resumosDoRei`,
  `desempateEstradaRng`) — todas ligadas por omissão e nunca desligadas no jogo.
- `CONFIG_V3_ARQUIVO` citado 7 vezes, congelado de propósito.

Nada disto está errado; é peso que se carrega a cada leitura do ficheiro.

---

## 6. Git

- **25 commits por enviar** para o GitHub.
- 4 branches antigas não mescladas (`exp-cautela-2x2`, `exp-duas-fases`,
  `exp-exemplo-ancora`, `sonda-admissao-8b`) — experiências fechadas.
- Ficheiros grandes versionados: `site/dados/rac_*.json` (3,6 MB o maior).

---

## 7. O plano de limpeza, por ordem

Cada passo tem uma **prova** que fica como teste. Nenhum muda regras de jogo.

### Passo 1 — Uma só tropa no ecrã *(o que o Lucas viu)*
- tirar o símbolo rígido do `mapa3d.js`; acima do poço mostra-se **menos**
  figuras, nunca figuras de outro modelo;
- poço de 28 → 40 por tipo, com empréstimo entre tipos;
- tirar do forno as peças de tropa antigas e apagar `guerreiros.py`/`tropas3d.py`;
- **prova:** contador "figuras antigas no ecrã" que tem de dar 0, num teste.

### Passo 2 — A batalha comporta-se
- rescaldo só com os mortos; vencedor volta a marchar;
- **marcador para todos** os combates do turno (mesmo sem cena), com fila;
- `feitas` passa a esquecer o que já fechou;
- **prova:** "todo combate do turno tem marcador" e "o vencedor volta a marchar".

### Passo 3 — Uma só cena de batalha
- `encontro.html` passa a importar `batalha.js`; morre o guião duplicado.

### Passo 4 — Arrumar o `index.html` sem reescrever
- separar em módulos com nome: `ponte3d.js`, `replay.js`, `cronica.js`,
  `marcas.js`, `clientes.js`; o ficheiro fica com o jogo e o HTML;
- **prova:** a suíte e os 9 smokes continuam verdes (eles fazem `eval` do bloco,
  por isso este passo tem de ser feito com eles a correr a cada movimento).

### Passo 5 — Matar o 2D
- apagar o desenhador 2D e o `?mapa=2d`; a etiqueta `v1` no git guarda o antes.

### Passo 6 — Unificar o cliente OpenRouter
- um só módulo com `Retry-After`, usado pelo browser e pelo runner.

### Passo 7 — Varrer o resto
- apagar os órfãos a sério; arquivar as 4 branches; decidir o que fazer aos
  160 MB de GLB de bancada.

**Sugiro fazer 1 e 2 já** (são os defeitos que se veem), depois 3 e 4. O 5 e o 6
são limpeza pura e podem esperar por um dia de menos pressa.
