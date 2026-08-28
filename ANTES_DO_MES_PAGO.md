# Antes de gastar saldo — lista de 28/08/2026

O saldo entra por volta de **02/09**. As partidas pagas desse mês são as que vão
gerar o vídeo. Esta lista sai da bateria de hoje (`resultados/p4-bateria-0828/`).

**Critério de entrada:** só entra o que, ficando por arranjar, **estraga uma
partida paga**. Não entra o que seria bom ter. Ordenada por isso.

---

## 1. Ver a cena do combate de estrada com os próprios olhos — BLOQUEANTE

Hoje o combate de estrada passou a aparecer nos quatro canais e ganhou cena
própria (choque em duas cores → o estandarte do perdedor tomba). **Ninguém viu
como fica.** A suíte prova que o código corre e que os 19 campos existem; não
prova que é bonito, nem que se lê a 0.35x, que é a velocidade do vídeo.

Isto é o primeiro da lista porque é *material de vídeo* e porque a correção, se
for preciso, é de minutos — mas descobri-lo durante uma partida paga custa a
partida.

**Como:** `python servir.py`, burro × burro, **seed 1** (produz 75 combates de
estrada em 40 turnos), velocidade baixa. Ver um choque e decidir.

⚠️ **A cena não é a que estava no plano.** O plano pedia anel de duas cores +
número de baixas a subir. Não foi feito assim porque em 25/08 o Lucas tirou anel
e número flutuante da conquista ("círculos piscando e número de tropas mortas
poluem o momento"). Se ele preferir o desenho do plano, é trocar duas batidas.

## 1b. O runner aborta uma partida por uma falha de MINUTOS — BLOQUEANTE

Descoberto hoje, ao correr a P1. O runner mata a partida ao **2º erro de rede
consecutivo**, com a mensagem *"provável teto diário/throttle do free tier"*. Essa
suposição estava errada neste caso: era **HTTP 400 "DEGRADED function cannot be
invoked"** da Nvidia, e **2 minutos depois o mesmo modelo respondia 200**.

Num free-tier isto custa uma repetição. **Numa partida paga, no turno 25, custa a
partida inteira e o dinheiro** — foi exatamente assim que se perderam ~$2.25 em
17/08, por outra razão.

O 429 já é tratado com respeito ao `Retry-After`. O que falta é o caso **sem**
`Retry-After`: antes de abortar, esperar e sondar uma vez. Mexer aqui é mexer numa
proteção de custo — foi por isso que não o fiz por conta própria hoje.

**Três modos de falha de fornecedor, todos vistos só hoje**, e nenhum previsível
pelos metadados do catálogo:
- **403** gating por app (`inkling`) — nunca responde
- **429** pool partilhado (`gemma-4-31b`, `lfm-2.5`) — responde noutra hora
- **400 DEGRADED** (`nemotron-3.5-lightning`) — responde dois minutos depois

## 2. Decidir a REGRA do exército em trânsito — antes de filmar, não depois

Com a visibilidade feita, o passo 2 do plano de 28/08 fica possível: assistir e
marcar os turnos. Mas a decisão de fundo continua aberta, e é de REGRA:

> o padrão real é um exército a chegar a uma aldeia enquanto o inimigo
> **passa por dentro dela** (passa reto porque a aldeia é dele — o
> motor só para em aldeia que não é sua).

**Exército em trânsito guarnece a aldeia por onde passa? Pode ser interceptado?**

**Medido hoje com n grande.** Os campos novos do evento tornaram a conta direta:
em **1 809 combates de estrada** de 20 partidas burro × burro,

| padrão | fração |
|---|---|
| trecho com **uma ponta de cada** (a linha da frente) | 84,2% |
| nenhuma ponta pertence a nenhum dos dois | **0%** |
| **ao menos um exército atravessa aldeia própria** (passa reto) | **89,7%** |

Os 89,7% confirmam por outra via a amostragem da `REVISAO-OPUS` (18 de 20), agora
com n=1 809 e numa população diferente (burro, não LLM). Duas amostras
independentes a dar ~90% — a decisão de regra tem base.


Porque está na lista: mudar regra **depois** de filmar invalida o material. Se a
regra vai mudar, muda antes das partidas pagas.

## 3. Contar com 2-3 h de relógio por partida, e um pico de 17 min num turno

Medido hoje: `dots` 95-116 s de mediana por turno, `120b` 202-214 s — e **um pico
de 1 033 s** num único turno de R1. Uma partida de ~25 turnos custou 2h46 e 2h00.

Modelos pagos com raciocínio tendem a ser mais lentos, não menos. Planear a
sessão de filmagem por **relógio**, não por número de partidas, e ter regra de
aborto por projeção.

## 4. O prompt já toca 5 935 tokens — pensar qualquer acréscimo no fim, não no início

Máximo real medido hoje (tokenizer, não estimativa): **5 935** tokens, R2 Rei B,
turno 18. O prompt começa em ~2 340 e mais que dobra, porque cresce com o número
de aldeias.

Não é bloqueante — modelos de fronteira lidam com isto sem esforço. Está na lista
porque muda o **critério** de qualquer linha nova no prompt: uma linha *por
aldeia* custa 1× no T1 e ~3× no T30, quando o modelo já está mais carregado.

Critério para admitir informação nova, que continua a valer:
**o Rei consegue chegar a este número sozinho?** Se sim, não entra.
E a regra de sempre: informar, nunca recomendar.

## 5. Re-sondar dois modelos antes de os excluir

`minimax/minimax-m3:free` e `liquid/lfm-2.5-2.6b:free` constam **MORTO** no
`resultados_arena.json` (404 em 18/08) mas **voltaram ao catálogo** hoje. Uma
sonda de 3 turnos cada resolve. Constar no catálogo não prova endpoint vivo — por
isso a etiqueta não foi mexida.

## 6. Revogar as 2 chaves expostas em 03/08

Continua por fazer desde 03/08. Não estraga uma partida, mas é a única coisa
desta lista que piora com o tempo, e o repo é público.

---

## O que NÃO entra nesta lista, e porquê

- **Repetir o A/B da retaguarda com n maior.** A medida de hoje deu a direção
  certa nas duas seeds, mas com n=2 e uma dispersão entre partidas maior que o
  efeito. Seria bom ciência — não estraga uma partida paga. Fica para depois do
  vídeo, ou para uma tarde de free.
- **O cliente OpenRouter duplicado** (`rei.js` × `index.html`). Dívida real, mas
  as duas cópias funcionam e a bateria de hoje correu com 0 erros de rede.
  Unificar antes de filmar é risco sem retorno.
- **As duas estradas que se cruzam no desenho.** Bug latente: zero ocorrências em
  17 verificadas, e a amostragem discreta falha 1 em 5 451.
