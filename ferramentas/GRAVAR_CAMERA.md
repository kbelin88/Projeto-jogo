# GRAVAR_CAMERA — câmera por roteiro em MP4

## O que é

Grava um trecho de uma partida (replay) em vídeo MP4 com a câmera a seguir um roteiro de keyframes. Sem dependências além de Node 24, Edge instalado, e ffmpeg no PATH. O roteiro é uma lista de poses (alvo, distância, ângulo, elevação) com tempos em segundos e easing; a câmera interpola suavemente entre eles.

## Formato do roteiro

JSON com um array `keyframes`. Cada keyframe tem:

- **t** (segundos): tempo de chegada (≥ 0, estritamente crescente)
- **alvo**: slug/id/nome de aldeia OU `[x, y, z]` (metros do mundo 3D; y = altura; z = −y do mapa)
- **dist** (metros): distância câmera–alvo, > 0
- **angulo** (graus): azimute; 0 = sul (+z), 90 = este (+x)
- **elevacao** (graus): acima do horizonte; omissão = padrão (~41°)
- **easing**: `linear`, `suave` (easeInOutCubic, omissão), ou `segurar` (salta para o destino); vale para o trecho que **chega** a este keyframe

**Exemplo** (`roteiros/exemplo_E1010-07.json`):
```json
{
  "descricao": "E1010-07, turnos 0-4: visao geral -> aproxima Lisboa -> desliza para Faro",
  "keyframes": [
    { "t": 0, "alvo": "lisboa", "dist": 1500, "angulo": 20, "elevacao": 50 },
    { "t": 4, "alvo": "lisboa", "dist": 520, "angulo": 50, "elevacao": 38, "easing": "suave" },
    { "t": 8, "alvo": "faro", "dist": 420, "angulo": 90, "elevacao": 32, "easing": "suave" }
  ]
}
```

## Pré-visualizar no navegador

Servir estáticamente com `servir.py` (ou outro servidor estático), depois abrir:

```
index.html?replay=resultados/estadio/E1010-07.replay.json&roteiro=roteiros/exemplo_E1010-07.json
```

Parâmetros:
- **replay**: caminho do `.replay.json` completo (o `site/dados/replay_*.json` compacto não serve)
- **roteiro**: caminho `.json` ou JSON em base64url (omissão: plano geral fixo)
- **gravar=1**: modo quadro a quadro (cinema + limpo, sem `runReplay`); sem ele o replay corre normalmente, com a câmera do roteiro
- **inicio**: turno por onde começar (omissão: 0)
- **segPorTurno**: segundos por turno (omissão: 2); o tempo `t` do replay = turnos × segPorTurno

## Comando de gravação

```bash
node ferramentas/gravar_camera.js --replay resultados/estadio/E1010-07.replay.json \
     --roteiro roteiros/exemplo_E1010-07.json --duracao 8 --formato ambos
```

Argumentos:
- **--replay** (obrigatório): caminho do `.replay.json`
- **--roteiro**: roteiro `.json` (omissão: plano geral fixo)
- **--duracao**: segundos de filme (omissão: replay inteiro)
- **--seg**: segundos por turno (omissão: 2)
- **--formato**: `vertical` (1080×1920), `horizontal` (1920×1080), ou `ambos` (omissão)
- **--saida**: pasta de saída (omissão: `videos/camera`; `videos/` está no `.gitignore`)
- **--navegador**: caminho do `msedge.exe` ou `chrome.exe` (omissão: procura Edge automaticamente)
- **--manter**: não apaga a pasta dos quadros PNG

Saída: `videos/camera/<replay>_<formato>.mp4`

## Requisitos

- Node 24
- Edge instalado (ou caminho via `--navegador`)
- ffmpeg no PATH
- Ficheiros do forno em `sonda3d/`: `vendor/`, `cena.json`, `.glb` (ficam fora do git; num worktree novo, copiar do repositório principal)
- Sem instalações adicionais (`npm install`, drivers, etc.)

## API do modo gravar (no navegador)

Quando `?gravar=1`, o `index.html` expõe:

- **`window.gravarQuadro(n)`**: prepara o frame `n` (sem screenshot); move a câmera, atualiza o mapa
- **`window.gravacaoPronta`**: Promise resolvida quando mapa 3D e replay estão prontos
- **`window.duracaoGravacao`**: duração total (segundos)

A gravação **só anda para a frente** — recarregue a página para voltar ao início.

## Tempos medidos

Medidos em 11/10/2026 (Edge sem janela, WebGL pela GPU da máquina; a flag `predefinido` bastou, sem `--use-angle` nem SwiftShader):

- 1920×1080: ~2,2 s por quadro; 8 s = 240 quadros em ~9 min.
- 1080×1920: ~2,1 s por quadro; 8 s = 240 quadros em ~8,5 min.
- `--formato ambos` grava um formato de cada vez (o Edge fecha entre eles): ~17 min no total.
- Repetida, a gravação dá quadros quase iguais (PSNR > 73 dB entre duas corridas; não são bit a bit).

## Limitações

- Banners desligados durante a gravação
- Só anda para a frente; recarregue para recomeçar
- As batalhas usam `performance.now()` em `batalha.js` para duração de segurança — podem sair ligeiramente diferentes entre gravações
- `resultados/` não está no repo: replays completos ficam só no disco
