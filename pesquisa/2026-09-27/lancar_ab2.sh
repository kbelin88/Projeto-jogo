#!/bin/bash
# A/B dentro da partida: o mesmo modelo dos dois lados, um Rei com o P4 e o outro
# com as VERDADES (informacao, nenhum conselho). Seeds 3 e 5, assentos trocados.
cd /home/user/Projeto-jogo
export NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=injetada-pelo-proxy
V=regras,combate,intencao,alcance,capital,vigia,avaliacao,semteto
D=pesquisa/2026-09-28/ab2; mkdir -p $D
for m in super:nvidia/nemotron-3-super-120b-a12b:free dots:dots-studio/dots-3-note-preview:free; do
  n=${m%%:*}; id=openrouter:${m#*:}
  for s in 3 5; do
    PROMPT_P5_A=P4 PROMPT_P5_B=$V nohup node --no-warnings runners/rei_vs_rei.js $id $id $s 30 $D/AB2_${n}_P4xV_seed$s.txt > $D/.run_${n}_P4xV_s$s.log 2>&1 &
    PROMPT_P5_A=$V PROMPT_P5_B=P4 nohup node --no-warnings runners/rei_vs_rei.js $id $id $s 30 $D/AB2_${n}_VxP4_seed$s.txt > $D/.run_${n}_VxP4_s$s.log 2>&1 &
  done
done
