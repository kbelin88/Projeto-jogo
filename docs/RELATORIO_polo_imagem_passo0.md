# Polo de Imagem — passo 0: levantamento (10/10/2026)

## Ferramentas na máquina
- **GPU**: NVIDIA RTX 3050 Ti Laptop, **4 GB de VRAM** (limite duro: SDXL/Flux só quantizados; vídeo por IA fora de questão).
- **Blender 5.2** instalado (`C:/Program Files/Blender Foundation`).
- **ComfyUI** portátil em `C:/Users/biolu/ComfyUI_windows_portable_nvidia` (há `ferramentas/comfy/` no repo).
- **HyperFrames** via `npx` (npm global presente); **ffmpeg 8.1.1** full build; **Node 24**, **Python 3.12** + Pillow.

## Replays do Kings Arena
- `site/dados/replay_<id>.json` guarda **um frame por turno** (`t`, `a` aldeias, `m` marchas, `e` eventos, `d`), não posições contínuas.
- Cada marcha traz origem, destino, caminho (lista de aldeias), turnos que faltam e total → a posição **entre turnos é interpolável** por fração do caminho (é o que o site e o gerador de thumbnails fazem). Combates vêm como eventos por turno.
- Conclusão: dá para reconstruir movimento suave, mas é interpolação, não gravação.

## Câmera livre no jogo
- Existe: o mapa 3D usa **OrbitControls** (arrasto/zoom), há "cam auto" que segue os combates (`apontarCamera`) e `enquadrarGravacao()` para câmera fixa de gravação (index.html).
- Falta: caminho de câmera **por keyframes/scriptado** reproduzível para captura; hoje só auto-foco ou fixa.

## Estimativa da Câmera 3D (real)
- Câmera scriptada (keyframes + easing sobre o OrbitControls, comandada por parâmetro de URL/hook) e captura quadro a quadro com ffmpeg: **~2 sessões**.
- Render no navegador da própria máquina (WebGL na 3050 Ti) em 1080p: viável, mais lento que tempo real em cenas cheias; Blender só se for para peça premium (~+2 sessões).
- Risco principal: 4 GB de VRAM e 7,7 GB de RAM; cortar a captura por zonas em sequência.

## Passo 1 — thumbnails
`python ferramentas/gerar_thumbnails.py E1010-02 [--gancho "..."] [--turno N]` → `thumbnails/E1010-02_A_mapa.png` e `_B_placar.png` (1280x720, sem IA de imagem; pasta fora do git). Gerou para a **s30** (E1010-02, seed 30: ling-3.1-flash x dots-3-note-preview, 2 x 22 em 14 turnos).

## Custo e modelos
Nenhum modelo pago nem IA de imagem; só Pillow. Sonnet 5.5 construiu; sem chamadas a OpenRouter.
