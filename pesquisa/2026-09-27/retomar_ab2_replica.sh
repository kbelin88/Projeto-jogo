#!/bin/bash
# Retoma as 8 partidas da replica do candidato interrompidas (30/09) a partir do replay.
# Os mesmos modelos, seed e prompt por lado; a saida vai para *_cont.txt (o replay novo
# leva os frames antigos + os novos). Memoria de fog e historico de defesa recomecam.
cd /home/user/Projeto-jogo
export NODE_USE_ENV_PROXY=1 OPENROUTER_API_KEY=injetada-pelo-proxy
V=regras,combate,intencao,alcance,capital,vigia,campanha,frente
D=pesquisa/2026-09-30/ab2_replica
for m in super:nvidia/nemotron-3-super-120b-a12b:free dots:dots-studio/dots-3-note-preview:free; do
  n=${m%%:*}; id=openrouter:${m#*:}
  for s in 7 9; do
    RETOMAR_DE=$D/AB2_${n}_P4xV_seed$s.replay.json PROMPT_P5_A=P4 PROMPT_P5_B=$V nohup node --no-warnings runners/rei_vs_rei.js $id $id $s 30 $D/AB2_${n}_P4xV_seed${s}_cont.txt > $D/.run_${n}_P4xV_s${s}_cont.log 2>&1 &
    RETOMAR_DE=$D/AB2_${n}_VxP4_seed$s.replay.json PROMPT_P5_A=$V PROMPT_P5_B=P4 nohup node --no-warnings runners/rei_vs_rei.js $id $id $s 30 $D/AB2_${n}_VxP4_seed${s}_cont.txt > $D/.run_${n}_VxP4_s${s}_cont.log 2>&1 &
  done
done
