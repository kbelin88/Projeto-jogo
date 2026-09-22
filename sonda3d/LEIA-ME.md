# sonda3d/ — o mapa 3D, e o que dele está no git

Esta pasta tem **código versionado** e **saída de forno que não está no git**.
Quem clona o repositório recebe só a primeira metade, e o jogo diz o que falta.

## O que está no git

| ficheiro | o que é |
|---|---|
| `mapa3d.js` | o mapa 3D: carrega, povoa, anima, e é a ponte com o motor |
| `batalha.js` | a cena da batalha de estrada — a mesma no jogo e na bancada |
| `mapa.html` | o mapa sozinho, sem jogo: é onde se confere qualquer alteração |
| `encontro.html` | bancada: duas colunas descem a estrada e encontram-se |
| `marcha.html` | bancada: duas aldeias e uma tropa a ir e vir |
| `bancada.html` | bancada: os soldados de perto, para ver a malha e a animação |
| `montanhas.html` | bancada: os estilos de montanha (parados por decisão de 21/09) |
| `tamanhos.html` | bancada: as peças lado a lado, à escala |
| `vendor/` | three.js e o `GLTFLoader` |

## O que NÃO está no git, e como se coze

São dezenas de MB de saída de Blender. Estão no `.gitignore` de propósito: o
repositório público é backup de **código e motor**.

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -noaudio -P ferramentas/cena/exportar_mapa.py
```
(~105 s) — escreve `pecas.glb` (a biblioteca: cada protótipo UMA vez, na
origem), `mapa3d.json` (onde fica cada cópia), `bancada.glb`/`.json` e
`cena.json`.

| ficheiro | tamanho | quem precisa dele |
|---|---|---|
| `pecas.glb` | 45 MB | o jogo |
| `mapa3d.json` | — | o jogo, o `marcas.js`, quatro ferramentas do forno |
| `lanceiro_novo.glb`, `arqueiro_novo.glb`, `cavaleiro_novo.glb` | 1 MB ao todo | o jogo (as tropas) |
| `cena.json`, `mar_costa.json`, `mar_costa.png` | — | o jogo (o mar sabe onde é raso por aqui) |
| `bancada.glb`, `bancada.json` | 28 MB | só a `bancada.html` |
| `montanhas.glb`, `montanhas.json` | 28 MB | só a `montanhas.html` (`MONTANHAS=1` no forno) |

⚠ **`mapa_montanhas.glb` e `mapa_montanhas.json` foram apagados em 22/09**: eram
45 MB que **nenhum ficheiro carregava**. A `montanhas.html` lê a biblioteca
(`montanhas.glb`), não o mapa inteiro. As montanhas em si não se perderam — o que
as faz é `ferramentas/cena/montanhas.py` e a decisão está em
`ferramentas/cena/MONTANHAS.md`, os dois no git. Recozem-se com `MONTANHAS=1`.

## Os `.png` soltos

`_lanceiro_*.png`, `_cavaleiro_deles.png`, `_soldado_oga.png` e companhia são
**provas**: renders que mediram um defeito antes de o corrigir (ver a secção 8.6
do `CLAUDE.md` — "cada defeito que ele consegue VER tem de virar um número ou uma
imagem que EU consigo ver, antes de tentar corrigir"). Ficam aqui porque é aqui
que se olha para elas.
