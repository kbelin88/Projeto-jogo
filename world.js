// ============================================================
//  world.js  —  LEITURA DO MUNDO (terreno procedural)
// ------------------------------------------------------------
//  Funcoes PURAS, deterministicas, SO LEITURA. Copia fiel da
//  geracao de terreno que vive dentro do index.html.
//
//  Por que existe: o motor (engine.js) precisa saber onde ha
//  terra/agua e onde ha aldeia, sem reescrever o mapa. Estas
//  funcoes sao a "fonte de verdade" do tabuleiro.
//
//  IMPORTANTE: nao mexer na geracao do terreno. Se um dia o
//  index.html for ligado a este arquivo (fase de UI), ele passa
//  a IMPORTAR daqui em vez de ter sua propria copia inline.
//
//  Roda no navegador (vira global `World`) e no Node (module.exports).
// ============================================================
(function (root, factory) {
  const World = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = World;
  else root.World = World;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- Constantes do mundo ----------
  const WORLD = 200;   // grade WORLD x WORLD de coordenadas
  const LAKE_G = 16;   // tamanho da regiao onde pode existir um lago

  // Tipos de celula
  const T_GRASS = 0, T_FOREST = 1, T_MOUNT = 2, T_WATER = 3;

  // Tribos / cores de bandeira (do mapa original)
  const TRIBES = [
    { c: "#d83b3b", n: "VERMELHA" },
    { c: "#3b6bd8", n: "AZUL" },
    { c: "#39a845", n: "VERDE" },
    { c: "#e0a020", n: "DOURADA" },
    { c: "#9b3bd8", n: "ROXA" },
    { c: "#e0e0e0", n: "BRANCA" },
  ];

  // ---------- PRNG deterministico baseado em hash ----------
  function hash(x, y, salt = 0) {
    let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (y | 0) ^ 0xc2b2ae35, 0x27d4eb2f);
    h = Math.imul(h ^ (salt | 0) ^ 0x165667b1, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Ruido suave (value noise) para agrupar biomas
  function vnoise(x, y, salt, freq) {
    const fx = x * freq, fy = y * freq;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = hash(x0, y0, salt), b = hash(x0 + 1, y0, salt);
    const c = hash(x0, y0 + 1, salt), d = hash(x0 + 1, y0 + 1, salt);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }

  // Lagos pequenos e irregulares
  function lakeInfo(gx, gy) {
    if (hash(gx, gy, 71) > 0.40) return null; // so ~40% das regioes tem lago
    return {
      cx: gx * LAKE_G + 3 + hash(gx, gy, 72) * (LAKE_G - 6),
      cy: gy * LAKE_G + 3 + hash(gx, gy, 73) * (LAKE_G - 6),
      rad: 1.8 + hash(gx, gy, 74) * 2.6,
      seed: (gx & 1023) * 1024 + (gy & 1023),
    };
  }
  function isWater(x, y) {
    const gx0 = Math.floor(x / LAKE_G), gy0 = Math.floor(y / LAKE_G);
    for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
      for (let gy = gy0 - 1; gy <= gy0 + 1; gy++) {
        const lk = lakeInfo(gx, gy);
        if (!lk) continue;
        const dx = x + 0.5 - lk.cx, dy = y + 0.5 - lk.cy;
        const wobble = 0.80 + hash(x, y, 75) * 0.45; // borda irregular
        const rr = lk.rad * wobble;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
    return false;
  }

  // Dado de uma celula: tipo de terreno + se ha aldeia (e tribo/nivel)
  function cellData(x, y) {
    const r = hash(x, y, 1);
    let type = T_GRASS;
    if (isWater(x, y)) {
      type = T_WATER;
    } else {
      const mt = vnoise(x, y, 7, 0.09);  // cordilheiras
      const ft = vnoise(x, y, 9, 0.15);  // bosques
      if (mt > 0.93 && hash(x, y, 5) > 0.70) type = T_MOUNT;
      else if (ft > 0.56 && hash(x, y, 6) > 0.35) type = T_FOREST;
    }

    let village = false, tribe = 0, level = 1;
    if (type === T_GRASS || type === T_FOREST) {
      if (hash(x, y, 3) < 0.08) {   // bem menos vilas que antes
        village = true;
        tribe = Math.floor(hash(x, y, 4) * TRIBES.length);
        level = 1 + Math.floor(hash(x, y, 6) * 5);
      }
    }
    return { type, village, tribe, level, r };
  }

  // Nomes de vila proceduralmente
  const SYL_A = ["Vald", "Nor", "Eich", "Stein", "Brun", "Hel", "Kal", "Mor", "Ast", "Dorn", "Falk", "Rab", "Wolf", "Gold"];
  const SYL_B = ["heim", "burg", "feld", "stadt", "wald", "berg", "tal", "furt", "dorf", "hain", "see", "ried"];
  function villageName(x, y) {
    const a = SYL_A[Math.floor(hash(x, y, 11) * SYL_A.length)];
    const b = SYL_B[Math.floor(hash(x, y, 12) * SYL_B.length)];
    return a + b;
  }

  return {
    WORLD, LAKE_G,
    T_GRASS, T_FOREST, T_MOUNT, T_WATER,
    TRIBES,
    hash, lerp, vnoise, lakeInfo, isWater, cellData, villageName,
  };
});
