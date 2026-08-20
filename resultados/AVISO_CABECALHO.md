# Aviso — cabeçalho `condicoes:` desatualizado nos logs anteriores a 20/08

Os `.txt` das baterias de **17/08, 18/08 e 19/08** (`resultados/p4-bateria-0817/`,
`resultados/p4-bateria-0818/`, `resultados/p4-bateria-0819/`, e as demais anteriores geradas
por `runners/rei_vs_rei.js`) têm a linha `condicoes:` **desatualizada**. Ela era texto fixo —
`prompt=relatorio v3 (disponivel-para-enviar) ... regras=v4 (cav def2/1t, madeira 15, dist
x2/3, vitoria 75%/2t)` — e não refletia o que de fato correu.

**As partidas correram com:** P4 + fog of war, madeira 30 / ferro 20, `escalaMarcha` 0.2,
counter 1.5, cavaleiro def 2 em 1 turno, vitória 75%/2 turnos — o ruleset vivo descrito em
`CLAUDE.md` §7.

O ruleset real de cada partida está em `CLAUDE.md` §7 e, campo a campo, no `.replay.json`
gravado ao lado de cada `.txt` (quando existe — as 5 partidas de 17/08 não têm replay).

Esses `.txt` **não foram reescritos**. A correção (SPEC_SITE_V1 §2.2) só vale para os logs
gerados a partir de 20/08 em diante, que agora leem a linha `condicoes:` de `cfg`/
`Engine.CONFIG` em vez de texto fixo.
