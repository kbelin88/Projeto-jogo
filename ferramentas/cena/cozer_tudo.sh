#!/usr/bin/env bash
# coze as 24 povoacoes nas 3 cores e recorta cada uma.
#   bash ferramentas/cena/cozer_tudo.sh [lado_px] [amostras]
set -e
LADO=${1:-900}
AM=${2:-160}
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" -b --factory-startup -noaudio -P ferramentas/cena/cozer.py -- "$LADO" "$AM" 2>&1 \
  | grep -E "SONDA|AVISO"
for f in assets/sprites/_bruto_*.png; do
  python ferramentas/cena/recortar_sprite.py "$f" | tail -1
done
echo "FIM: $(ls assets/sprites/aldeia_*_azul.png | wc -l) povoacoes x 3 cores"
