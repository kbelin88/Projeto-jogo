# ESTADO ATUAL — Motor V0 do Jogo (benchmark estilo Tribal Wars)

> Documento de sincronização. Descreve **exatamente** o que está construído e
> rodando hoje, com as mecânicas e números atuais. Serve para retomar a
> discussão de design e propor novas atualizações sobre uma base concreta.
> Data do snapshot: jogo V0 completo + ligado ao mapa + 1ª rodada de balanceamento.

---

## 1. O que é o projeto

Motor de um jogo de conquista por turnos (inspirado em Tribal Wars), cujo
objetivo final é ser um **benchmark de agentes de IA**. A IA ("o Rei") **ainda
não existe** — esta é a fase **V0**: o jogo rodando **sem nenhuma IA**, com dois
jogadores controlados por lógica burra, determinística. O V0 serve para ter um
jogo que **funciona, é observável e balanceável** antes de plugar qualquer IA.

- **Stack:** JavaScript puro, sem frameworks, sem build, sem dependências.
  Roda no navegador (abrindo `index.html`) e no Node (para testes/eval).
- A IA entra só na **V1** (trocar um jogador burro pelo Rei). A fronteira para
  isso **já está pronta e isolada** (ver seção 7).

---

## 2. Arquitetura central

Separação **MUNDO** vs **ESTADO**:

- **MUNDO** (`world.js`): o tabuleiro. Terreno procedural 200×200 gerado por
  hash determinístico (biomas, lagos, posições de vila). É **função pura, só
  leitura** — não guarda estado. É a fonte de verdade do terreno, usada tanto
  pelo render quanto pelo motor.
- **ESTADO** (`engine.js`): camada **mutável** por cima. As ~50 aldeias da
  partida, com dono, recursos, tropas. É o que muda a cada turno.

Regra de ouro: **todo número balanceável vive numa CONFIG única** no topo do
`engine.js`. Balanceamento se faz mexendo na CONFIG, nunca espalhado pelo código.
**Dado que muda por aldeia mora na aldeia; regra que vale para todas mora na CONFIG.**

---

## 3. Arquivos

| Arquivo | Papel |
|---|---|
| `world.js` | Terreno (leitura pura): hash, ruído, lagos, `cellData`, `villageName`, `TRIBES`. Fonte ÚNICA — o `index.html` lê daqui (não há mais cópia inline). |
| `engine.js` | O motor: CONFIG + estado + tick + combate + jogador burro + loop + observabilidade. |
| `index.html` | Mapa renderizado + **overlay da partida** (assistir jogar) + controles. |
| `test_peca1..4.js` | Testes de cada peça (rodar com `node test_pecaN.js`). |
| `eval_endurecimento.js` | Varredura de balanceamento (mede efeito de um parâmetro em N partidas). |
| `spec_v0_motor.txt` | Spec de design original do V0. |

---

## 4. CONFIG atual (a folha de balanceamento — TODOS provisórios)

```
seed: 1                         // mesma seed => mesma partida (determinístico)
partida_alvo_turnos: 30         // referência de design (não é limite)

producao (por aldeia/turno):    madeira 10, ferro 6

TROPAS (custo madeira/ferro | força | velocidade | turnos p/ construir):
  lanceiro:  15 / 0   | 10 | lenta  | 1
  arqueiro:  20 / 10  | 15 | media  | 1
  cavaleiro: 30 / 30  | 30 | rapida | 2

triangulo: lanceiro > cavaleiro > arqueiro > lanceiro
bonus_triangulo: 1.5            // +50% de eficiência da tropa com vantagem
combate.atrito_base: 0.5        // baixas do vencedor = força_perdedor * 0.5 * m

velocidade_passo:  lenta 6, media 9, rapida 14   // turnos = ceil(dist / passo)

neutra:  forca_min 20, forca_max 40, endurecimento 1   // <-- era 5, baixado p/ 1
teatro:  x0 80, y0 80, w 40, h 40, n_aldeias 50, min_dist 3

jogador (burro):  composicao_alvo {lanceiro 3, arqueiro 2, cavaleiro 1},
                  max_construir_por_turno 6, margem_ataque 1.2
max_turnos: 500                 // guarda de segurança do loop (não é regra do jogo)
```

---

## 5. Estrutura de uma aldeia-do-jogo

```js
{
  id, x, y,                  // posição fixa no grid do mundo
  nome,                      // nome procedural (do mundo)
  dono,                      // null = neutra ("bárbara") | "A" | "B"
  recursos: { madeira, ferro },
  tropas: { lanceiro, arqueiro, cavaleiro },   // tropas tipadas (dos reis)
  construindo: [ { tipo, turnosRestantes } ],
  guarnicao,                 // defensores BRUTOS sem tipo (só das neutras)
}
```

**Distinção importante:** os **reis** usam `tropas` (tipadas, com força/triângulo).
As **neutras** usam `guarnicao` — um número bruto de defensores, **sem tipo**
(no combate elas contam como força crua, matchup neutro no triângulo).

---

## 6. Mecânicas (como funciona, exatamente)

### 6.1 Geração do teatro
Varre a região do teatro (40×40 no centro do mapa), coleta as células que **já
são vila** no mundo procedural, e seleciona 50 com espaçamento mínimo. Os **2
reis** ficam em cantos opostos (min e max de x+y); o resto vira neutra com
**guarnição aleatória na faixa [20,40]** (semeada pela seed). As 50 aldeias caem
em pontos reais do terreno.

### 6.2 Produção
Cada aldeia **com dono** acumula `madeira +10 / ferro +6` por turno nos seus
próprios recursos. **Neutras não acumulam recurso** (só endurecem).

### 6.3 Construção de tropas
O custo é **debitado na hora de enfileirar** (reserva). A tropa fica pronta
após `turnos` ticks (lanceiro/arqueiro 1, cavaleiro 2) e entra em `tropas`.

### 6.4 Endurecimento ("o mundo congela")
Cada neutra ganha `endurecimento` de guarnição por turno (**hoje +1**). Cria
pressão de tempo: expandir cedo é barato; demorar deixa as neutras caras.

### 6.5 Movimento
Exército viaja entre aldeias; custa tempo: `turnos = max(1, ceil(distância /
passo))`. Distância = euclidiana no grid. `passo` vem da velocidade da tropa.
Exército **misto viaja na velocidade da tropa mais lenta**. Ao enviar, as tropas
**saem da origem** na hora; a viagem decrementa 1 turno por tick; ao chegar,
resolve.

### 6.6 Combate (REGRA CENTRAL: número decide vencedor; triângulo modula baixas)
1. **Força** de cada lado = soma de (nº tropas × força). Neutra defende com sua
   `guarnicao` bruta.
2. **Vencedor = maior força base.** Empate → **defensor segura** (defesa
   naturalmente mais eficiente). *O triângulo NÃO entra na decisão do vencedor.*
3. **Baixas do vencedor** = `força_do_perdedor × atrito_base × m`, onde:
   - `m = 1/1.5` se o vencedor tinha **vantagem** do triângulo (vitória barata),
   - `m = 1.5` se estava em **desvantagem** (vitória cara),
   - `m = 1` se neutro.
   O matchup do triângulo é decidido pelo **tipo dominante** de cada lado
   (simplificação V0). O **perdedor é eliminado** por completo.
4. **Conquista:** se o atacante vence uma aldeia, ela **troca de dono** e os
   **sobreviventes do atacante viram a guarnição tipada** dela (guarnição bruta
   zera).

### 6.7 Ordem do loop de turno (determinística)
`tick` faz: **1) Produção → 2) Construção → 3) Movimento → 4) Combate →
5) Endurecimento**. Depois, fora do tick: **6) Decisão dos jogadores →
7) Checagem de vitória**.

### 6.8 Vitória
Por **eliminação**: um rei perde quando fica com **0 aldeias**. (Exército em
trânsito sem nenhuma base **não** salva — leitura literal da regra.) O número de
turnos até a vitória é um **resultado medido**, não um teto.

---

## 7. O jogador burro e a FRONTEIRA decisão/motor (chave para a V1)

A decisão está isolada atrás de uma interface limpa, de propósito, para a V1
trocar um lado pela IA sem mexer no motor:

```
montarVisao(estado, dono)  ->  visao     // relatório só-leitura do que o jogador vê
decisor(visao)             ->  ordem     // ORDEM ESTRUTURADA
executarOrdem(estado, ...)               // motor aplica e valida a ordem
```

- **visao** = `{ dono, turno, config, minhas:[...], alvos:[...] }` (minhas aldeias
  com recursos/tropas; alvos = todas as não-minhas com sua força de defesa).
- **ordem** = `{ construir: [{aldeiaId, tipo}], ataques: [{origemId, destinoId, tropas}] }`.

**Lógica burra atual (determinística, sem RNG):**
1. Constrói puxando a `composicao_alvo` (escolhe o tipo mais "em falta" que cabe
   no recurso), até `max_construir_por_turno`.
2. Se a guarnição parada vence algum alvo (`defesa × margem_ataque < nossa
   força`), manda **todo o exército** no alvo **mais próximo** vencível.

Na **V1**, basta passar `decisores = { A: jogadorBurro, B: reiIA }` — o `reiIA`
recebe a `visao` (ou um relatório derivado dela) e devolve uma `ordem` no mesmo
formato. O resto do motor não muda.

---

## 8. Observabilidade (o "eval")

- `rodarPartida(config, decisores, { verbose, maxTurnos })` roda uma partida
  inteira. **Modo rápido** (verbose off) devolve `{ vencedor, turnos, motivo,
  aldeiasA, aldeiasB, historico, estado }`. **Modo verbose** imprime uma linha
  por turno: `T.. | A:Nald F.. | B:Nald F.. | neutras | trânsito | combates`.
- Combates e reforços são registrados em `estado.log`.
- Dá para rodar muitas partidas variando a `seed` e medir: duração, quem vence,
  com que margem, quantas neutras foram tomadas.

---

## 9. Visualização (index.html)

Abrir `index.html` no navegador roda a partida sobre o mapa:
- **Só as 50 aldeias da partida** aparecem (cenário procedural escondido), com
  cor do dono (azul A / vermelho B / tom claro neutra) e número (guarnição ou
  força) em cima.
- **Exércitos em trânsito** = bolinhas na cor do dono, interpoladas entre origem
  e destino, com linha pontilhada até o alvo. Avançam 1 "passo" por turno.
- **HUD** com turno, aldeias/força de cada rei, neutras, trânsito, e vencedor.
- **Controles:** Play / Pausar / Passo / Reiniciar + slider de velocidade.
- Câmera enquadra o teatro ao iniciar; `MIN_SCALE 0.55` permite ver tudo.

---

## 10. Decisões de design já tomadas (interpretações do spec)

1. **Vencedor = força base pura** (triângulo só modula baixas). Honra a regra
   central "número decide o vencedor". O exemplo solto do spec foi tratado como
   ilustrativo, não como restrição numérica.
2. **Matchup do triângulo pelo tipo dominante** de cada exército (não pairwise
   por composição) — simplificação V0 que o spec autoriza.
3. **Custo debitado ao enfileirar** a construção (reserva), não ao completar.
4. **Eliminação = 0 aldeias** (trânsito não revive). Trocado de uma versão
   anterior que mantinha o jogador vivo com exército em trânsito — isso criava
   "partidas zumbi" que arrastavam até o teto.
5. **Recursos por aldeia** (não num caixa por jogador).
6. **Neutras = guarnição bruta sem tipo**; reis = tropas tipadas.

---

## 11. Estado de balanceamento (números empíricos)

O V0 está correto; os números são provisórios e ajustados por medição.

**Já feito — endurecimento das neutras 5 → 1.** Motivo: com +5 as neutras
endureciam mais rápido do que dá para crescer e **quase nenhuma era conquistada**
(sem incentivo de expandir). Varredura (30 seeds por valor) mostrou que o salto
de atratividade está em +1:

| endurecimento | neutras tomadas (de 48) | duração média |
|---|---|---|
| +5 (antigo) | ~2 (4%) | ~83 turnos |
| +2 | ~5 (10%) | ~59 |
| **+1 (atual)** | **~16 (34%)** | **~57** |
| +0 | ~44 (93%) | ~71 |

Com **+1**: as neutras viram campo de batalha de verdade, mas ainda endurecem
o bastante para fechar a janela com o tempo (preserva "janela de expansão →
ponto de virada"). Partidas terminam por eliminação, vitórias equilibradas.

**Em aberto / candidato a próximo ajuste:**
- **Duração ainda ~2× o alvo** (~57 vs ~30 turnos). Alavancas para encurtar:
  produção, custos das tropas, ou a `margem_ataque`/agressividade do jogador
  burro.
- Possível: baixar `forca_min/max` inicial das neutras (mais convidativas no
  começo).
- O cavaleiro raramente é construído (caro em ferro); checar se o triângulo
  aparece de fato nas partidas (hoje o mix é quase só lanceiro/arqueiro).

---

## 12. O que NÃO está no V0 (próximas fases)

- **V1:** trocar um jogador burro pelo Rei (IA) atrás da fronteira `decidirAcoes`.
  Tem spec própria; não implementado.
- UI mais rica (referências visuais `tw1.png`/`tw2.jpg`), nomes, animação suave.
- Refinos de combate por composição detalhada (hoje é por tipo dominante).
```
