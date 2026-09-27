#!/bin/bash
# Sonda "a partida, nao o turno" (27/09): o mapa da frente e a campanha, nos 12
# turnos de retaguarda parada, dots e Super, bracos intercalados no mesmo run.
cd /home/user/Projeto-jogo/pesquisa/2026-09-25/experimentos
export NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=injetada-pelo-proxy
S=../../2026-09-26/sonda
for m in super:nvidia/nemotron-3-super-120b-a12b:free dots:dots-studio/dots-3-note-preview:free; do
  n=${m%%:*}
  nohup node --no-warnings sonda_p5.js $S/casos_logistica.json openrouter:${m#*:} --n 3 --paralelo 4 \
    --saida $S/partida_$n --bracos "P4|frente|campanha|frente,campanha" >> $S/partida_$n.log 2>&1 &
done
