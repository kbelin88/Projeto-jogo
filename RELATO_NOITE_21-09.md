# A noite de 21/09 — penhascos, mapa oficial e a batalha no jogo

O que o Lucas pediu antes de dormir, ponto por ponto, e o que ficou feito.

---

## 1. A técnica da textura, só nos penhascos da costa ✔

A mistura relva↔rocha por declive (a que se provou na bancada das montanhas)
**ficou guardada mas desligada** no jogo: nesta fase não há montanhas, e ela só
punha pedra em encostas que hoje são de relva.

O que foi para o jogo é o **triplanar na parede da costa**: a fotografia da
falésia passa a ser lida pelos três eixos em vez de projetada de cima, e por
isso deixa de esticar ao longo da queda. Mais o ladrilho por hexágonos e as
manchas grandes, que já lá estavam.

Para voltar a ligar a mistura por declive (quando houver montanhas), é um
parâmetro: `forcaRocha: 1` em `mapa3d.js`.

## 2. O mapa oficial, cozido ✔

`sonda3d/pecas.glb` e `sonda3d/mapa3d.json` refeitos (21/09, 01:08). Levam:

- os **portões virados para as estradas** e as torres espalhadas (0 defeitos
  medidos por `ferramentas/cena/medir_portoes.py`);
- o **chão suave** — acabou o xadrez de losangos nas encostas;
- a **areia com textura** nas praias;
- o relevo **igual ao de sempre** (139 m de amplitude): não entrou montanha
  nenhuma.

## 3. Os soldados novos no jogo ✔

Já estavam desde 17/09 (o mapa carrega `lanceiro_novo.glb` e companhia) — e
agora aparecem também na batalha.

## 4. A batalha de estrada, dentro do jogo ✔

`sonda3d/batalha.js` (novo) + ligação em `mapa3d.js` e `index.html`.

**Como funciona:** quando o motor resolve um `combate_estrada`, o jogo converte
o evento (trecho + fração) e o mapa monta a cena naquele ponto da estrada: duas
hostes em formação, cavaleiro à frente, flechas, golpes, tombos.

**O cuidado que o Lucas pediu, e que mudou a cena:** na bancada o perdedor
debandava. No motor **não há debandada** — `resolverCombateEstrada` tira o
perdedor INTEIRO do trânsito. Portanto aqui o perdedor **cai até ao último
homem** e o vencedor perde só a fração que o motor cobrou (`baixasVencedor`).
O que se vê é o que o motor executou.

O sistema de pontos na estrada de que ele falou é do motor e continua intocado:
a varredura por troços percorridos (`testes/test_varredura_estrada.js`) garante
que dois exércitos na mesma estrada lutam sempre.

### O que se aprendeu a medir (três defeitos, todos apanhados a correr partidas)

1. **59 batalhas ao mesmo tempo.** Numa partida burro×burro deram-se **49
   combates de estrada em 23 turnos**. A 16 figuras com esqueleto por cena, são
   ~950 bonecos. Agora há **teto de 4** e as velhas fecham.
2. **Ninguém via as batalhas.** A câmara do 3D não seguia nada e o combate
   acontecia fora do ecrã. Agora ela **salta para a batalha** (se estiver longe)
   e fica o tempo da cena; se a mão tocar nos controlos, a câmara é de quem a
   mexeu durante cinco segundos.
3. **A cena montava-se dentro das aldeias.** O encontro pode dar-se à porta de
   uma; a cena afasta-se agora para a estrada (fração entre 0,12 e 0,88).

### Provas

- `ferramentas/cena/_saida/batalhas_na_partida.mp4` — batalhas de uma partida a
  sério (burro×burro), gravadas só nos instantes em que há combate.
- `ferramentas/cena/_saida/folha_batalhas_partida.jpg` — oito momentos dessa
  gravação.
- Suíte verde: 29 testes do motor, 9 smokes e o carregamento do `index.html`.

---

## O que falta (por ordem)

1. **Afinar a cena**: os corpos desaparecem de repente no fim; falta poeira no
   choque; o cavaleiro podia carregar.
2. **Assalto e conquista de aldeia** — a peça do portão já abre, é o próximo
   item do `PLANO_BATALHAS_E_ALDEIAS.md`.
3. **Prompt e bateria de partidas** — o que dá vídeo.

Commits da noite: `7a1d958`, `dfc8fc9`, `0a04391` (e os anteriores da tarde).
Nada foi enviado para o GitHub.
