# site/ — a Arena dos Reis na web

Site estático, sem build e sem dependências. Três páginas e uma pasta de dados:

```
site/
  index.html      classificação dos modelos (17 colunas + legenda) + lista de partidas + método
  partida.html    uma partida: replay no mapa, log turno a turno, análise escrita
  estilo.css      folha única
  arena.js        idioma (PT/EN), cabeçalho, formatação
  analises.js     o texto de análise de cada partida (bilíngue) — edite aqui
  dados/          JSON gerado (não edite à mão)
  gerar/          o gerador + o manifesto das partidas
```

## Ver localmente

```bash
python servir.py          # ou: python -m http.server 8000
# abre http://localhost:8000/site/
```

Precisa de servidor: as páginas buscam os JSON com `fetch`, e `file://` bloqueia isso.

## Publicar no GitHub Pages

1. Suba o repositório (`git add -A && git commit && git push`).
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, pasta `/ (root)`. Salve.
3. Um ou dois minutos depois o site fica em
   `https://kbelin88.github.io/Projeto-jogo/site/`.

Só isso — não há passo de build. Cada `push` republica.

> Se quiser o site na raiz do endereço (`.../Projeto-jogo/` em vez de `.../Projeto-jogo/site/`),
> mova os quatro arquivos e a pasta `dados/` para a raiz do repo. O `index.html` do jogo ocuparia
> o mesmo nome, então isso pede renomear um dos dois — por enquanto a pasta `site/` evita o conflito.

## Acrescentar uma partida nova

Desde a SPEC_SITE_V1 (FASE 1, 20/08) o manifesto só guarda o que um humano sabe — modelos,
turnos, placar, construções, rejeições, ataques, conquistas, tokens e ms saem todos de
`ferramentas/analisar-log.js --json` e do `.replay.json`, nunca digitados à mão.

1. Copie o `.txt` (e o `.replay.json`, se o runner gravou um) para `resultados/<bateria>/`.
2. Abra `site/gerar/manifesto.json` e acrescente uma entrada:

```json
{ "id": "0821-P1", "data": "2026-08-21", "bat": "21/08",
  "seed": 1, "fim": "limite",
  "txt":    "resultados/p4-bateria-0821/P1_...",
  "replay": "resultados/p4-bateria-0821/P1_...",
  "publicarReplay": false }
```

- `fim`: `limite`, `vitoriaA`, `vitoriaB` ou `interrompida`. Partida `interrompida` entra na
  lista e conta nas colunas de comportamento (tokens, ms, rejeições, ataques), mas **não conta**
  para vitória, derrota nem saldo.
- `txt` e `replay` são caminhos relativos à raiz do repo, **sem extensão**. Deixe `replay: null`
  se não houver `.replay.json` (é o caso das 5 partidas de 17/08 — nessas, o placar final sai da
  linha `placar:` que o motor escreveu no `.txt`, nunca estimado).
- `publicarReplay: true` é o que dá à partida uma página navegável (`partida.html?p=...`) com
  replay no mapa, log turno a turno e análise. Exige `.replay.json` para o replay e `.txt` para
  o log; sem replay, a partida some da tabela só, mesmo com `publicarReplay: true`.

3. Rode, a partir da raiz. Se algum `.txt` faltar ou `analisar-log.js` falhar, o gerador para
   com erro — nunca escreve dado parcial em silêncio:

```bash
python site/gerar/gerar.py
```

4. Se quiser análise escrita para a partida, acrescente um bloco em `analises.js` com a chave
   igual ao `id`, nas duas línguas.

5. Se o modelo for novo e tiver versão paga na OpenRouter, acrescente o preço (dólar por token,
   não por milhão) em `site/dados/precos.json` — senão a coluna de custo estimado mostra `—`.

## De onde vem cada número

Toda métrica sai de duas fontes, nunca de reparsear a narração à toa: o **`.replay.json`**
(estado do motor, turno a turno — placar final e a curva de aldeias de cada partida) e o
**`.txt`** só para o que não existe no replay (tokens, ms, finish, plano, depoimento,
raciocínio) — via `ferramentas/analisar-log.js --json`. Regra do projeto: **o `.txt` narra, o
JSON mede**, e o cabeçalho do runner headless já provou uma vez que a narração pode estar
desatualizada.

A tabela de classificação (`site/dados/modelos.json`) agrega por **modelo**, somando todos os
"lados" que ele jogou (um modelo que joga um espelho conta duas vezes). Medianas de tokens/ms
são a mediana **pooled** de todos os turnos de todas as partidas do modelo — nunca a média das
medianas de cada partida. `s / turno` inclui turnos vazios e não-vazios (o modelo gastou aquele
tempo de qualquer forma, mesmo quando a resposta não veio).
