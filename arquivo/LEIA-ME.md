# arquivo/ — o que saiu da raiz em 28/08/2026

A raiz tinha **31 ficheiros `.md`** e mais de 45 entradas no topo. Ficou com 4 `.md`
e 27 entradas. Nada foi apagado: tudo o que estava na raiz está aqui.

**A regra da limpeza foi: a raiz tem só o que está VIVO.** Vivo = o que se lê ou
se corre hoje. O resto é registo — vale a pena guardar, não vale a pena tropeçar
nele todos os dias.

## O que está onde

| pasta | o que guarda |
|---|---|
| `baterias/` | specs e relatórios das baterias headless (17→21/08) e a análise consolidada de 20/08 |
| `lotes/` | relatórios dos LOTES C, D e E, e a revisão do Fable 5 |
| `prompt/` | o estudo do P4, o rascunho do P4 e o guia de anatomia do prompt |
| `site/` | spec e relatório do site v1, e as publicações do LinkedIn |
| `video/` | planos do vídeo e da vinheta, roteiro, narração e folha de tempos |
| `imagens-plano/` | mockups e imagens de plano (não são assets do jogo) |
| `fases-antigas/` | `exp/`, `logs/`, `patches/`, `traces/`, prompts reconstruídos, backups e `.patch` soltos |

## O que NÃO saiu da raiz, e porquê

Estas ficaram onde estavam de propósito — mover partia alguma coisa:

- **`mapa-ajustes.js`** — o `index.html:861` carrega-o por `<script src>` e o editor
  de mapa grava-o de volta na raiz. Um `<script>` que dá 404 **falha em silêncio**:
  o jogo abria na mesma e os ajustes manuais do mapa desapareciam sem aviso.
  Chegou a ser movido durante esta limpeza e foi reposto.
- **`checkpoints/`** — caminho de escrita cravado no `servir.py:87` (auto-save por
  turno, o que salvou os 38 turnos do crash de 15/08).
- **`docs/`** — dois comentários de código apontam para
  `docs/ACHADO_2026-07-27_truncamento_ollama.txt` (`index.html:3245`, `rei.js:60`).
- **`resultados/`** — 53 `.replay.json` e 89 `.txt`. É o corpo de medição inteiro do
  projeto: o número do "um terço da força fica parado" sai daqui. **Não se toca.**
- **`pesquisa/`** — é de 28/08, ainda está a ser usada. A `SPEC_PESQUISA_2026-08-28.md`
  foi para dentro dela, junto dos resultados que produziu.

## Sobre apagar

**Nada foi apagado hoje, de propósito.** Metade destes ficheiros sustenta um número
que já foi citado num relatório, e a diferença entre "velho" e "descartável" só se
vê com a lista à frente. Apagar é uma segunda decisão, do Lucas.

Candidatos óbvios, quando essa decisão vier: `fases-antigas/_to_delete/` (o nome já
decidiu), `fases-antigas/prompts_reconstruidos_1303/` (reconstruível por
`ferramentas/reconstruir-prompts.js`) e `__pycache__/` (regenerado sozinho).
