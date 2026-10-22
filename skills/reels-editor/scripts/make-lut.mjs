// Gera uma LUT 3D (.cube) de S-Log3 / S-Gamut3.Cine para Rec.709 com look cinematográfico.
// Uso: node make-lut.mjs <saida.cube> [--bw]
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "grade.cube";
const BW = process.argv.includes("--bw");
const SIZE = 65;

// ---- Parâmetros do look (ajustáveis) ----
const EXPOSURE_STOPS = Number(process.env.EXPO ?? 0.0); // S-Log3 gravado um pouco escuro
const CONTRAST = Number(process.env.CONTRAST ?? 0.4); // força da curva em S
const SATURATION = Number(process.env.SAT ?? 0.85);
const SHADOW_TINT = [-0.012, 0.004, 0.018]; // sombras frias (azul/teal)
const HIGHLIGHT_TINT = [0.008, 0.004, -0.008]; // altas luzes levemente quentes (menos que antes: pele ficava vermelha)
const WHITES_DESAT = Number(process.env.WHITES_DESAT ?? 0.55); // dentes/brancos amarelados: quanto neutralizar o amarelo claro
const SKIN_DESAT = Number(process.env.SKIN_DESAT ?? 0.22); // quanto reduzir a saturação dos tons de pele
const SKIN_HUE_SHIFT = Number(process.env.SKIN_HUE ?? 3); // graus em direção ao amarelo/laranja

const slog3ToLinear = (x) =>
  x >= 171.2102946929 / 1023
    ? Math.pow(10, (x * 1023 - 420) / 261.5) * (0.18 + 0.01) - 0.01
    : ((x * 1023 - 95) * 0.01125) / (171.2102946929 - 95);

// S-Gamut3.Cine -> Rec.709 (D65), linear
const M = [
  [1.6269474099, -0.5401385392, -0.0868088707],
  [-0.1785155272, 1.4179409274, -0.2394254004],
  [-0.044436115, -0.1959199662, 1.2403560812],
];

const rec709Oetf = (l) => (l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ombro filmico: linear até "a", depois comprime suavemente até 1.0
const rolloff = (v) => {
  const a = 0.45;
  return v <= a ? v : a + (1 - a) * Math.tanh((v - a) / (1 - a));
};

const toHsv = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
};
const fromHsv = ([h, s, v]) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
};
const ramp = (x, a, b) => clamp01((x - a) / (b - a));
// peso de "pele": matiz de rosado a laranja (-25 a 45 graus), com bordas largas e suaves
const skinWeight = (h, s, v) => {
  const hh = h > 300 ? h - 360 : h;
  const hueW = smooth(ramp(hh, -30, 6)) * (1 - smooth(ramp(hh, 30, 50)));
  // vermelhos muito saturados (cabos/adesivos da marca) ficam de fora
  const brand = 1 - smooth(ramp(s, 0.82, 0.95));
  return hueW * brand * smooth(ramp(s, 0.12, 0.32)) * smooth(ramp(v, 0.1, 0.3));
};

// amarelo claro (dentes, brancos quentes): matiz 30-70, claro e pouco/medio saturado; amarelos vivos (displays) ficam de fora
const whitesWeight = (h, s, v) =>
  smooth(ramp(h, 30, 41)) * (1 - smooth(ramp(h, 62, 78))) * smooth(ramp(s, 0.12, 0.3)) * (1 - smooth(ramp(s, 0.68, 0.85))) * smooth(ramp(v, 0.45, 0.72));

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const gain = Math.pow(2, EXPOSURE_STOPS);

const lines = [`TITLE "SLog3 SGamut3Cine to Rec709 cinematic"`, `LUT_3D_SIZE ${SIZE}`, ""];
for (let b = 0; b < SIZE; b++) {
  for (let g = 0; g < SIZE; g++) {
    for (let r = 0; r < SIZE; r++) {
      const lin = [r, g, b].map((c) => slog3ToLinear(c / (SIZE - 1)));
      let rgb = M.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
      rgb = rgb.map((v) => rolloff(Math.max(0, v) * gain));
      rgb = rgb.map((v) => clamp01(rec709Oetf(clamp01(v))));

      // curva em S em torno do cinza médio display (~0.45)
      rgb = rgb.map((v) => {
        const s = v + (smooth(v) - v) * CONTRAST * 2;
        return clamp01(s);
      });

      // split toning
      const y = lum(...rgb);
      rgb = rgb.map((v, i) =>
        clamp01(v + SHADOW_TINT[i] * (1 - smooth(y)) + HIGHLIGHT_TINT[i] * smooth(y)),
      );

      // pele: menos saturada e levemente menos vermelha (preserva vermelhos de marca fora da faixa de matiz)
      {
        const [h, sat, v] = toHsv(rgb);
        const w = skinWeight(h, sat, v);
        if (w > 0) rgb = fromHsv([h + SKIN_HUE_SHIFT * w, sat * (1 - SKIN_DESAT * w), v]);
      }

      {
        const [h, sat, v] = toHsv(rgb);
        const w = whitesWeight(h, sat, v);
        if (w > 0) rgb = fromHsv([h, sat * (1 - WHITES_DESAT * w), v]);
      }

      // dessatura magenta/roxo (parede com LED), preserva pele e laranja da marca
      {
        const mx = Math.max(...rgb), mn = Math.min(...rgb), d = mx - mn;
        if (d > 1e-4) {
          let h;
          if (mx === rgb[0]) h = (((rgb[1] - rgb[2]) / d) % 6 + 6) % 6;
          else if (mx === rgb[1]) h = (rgb[2] - rgb[0]) / d + 2;
          else h = (rgb[0] - rgb[1]) / d + 4;
          h *= 60;
          const w = Math.max(0, 1 - Math.abs(h - 305) / 50); // pico em 305 graus
          const yy = lum(...rgb);
          const k = 1 - 0.45 * w;
          rgb = rgb.map((v) => yy + (v - yy) * k);
        }
      }

      // saturação
      const y2 = lum(...rgb);
      rgb = rgb.map((v) => clamp01(y2 + (v - y2) * SATURATION));

      if (BW) {
        const yb = lum(...rgb);
        // preto e branco com contraste um pouco maior
        const c = clamp01(yb + (smooth(yb) - yb) * 0.5);
        rgb = [c, c, c];
      }
      lines.push(rgb.map((v) => v.toFixed(6)).join(" "));
    }
  }
}
writeFileSync(out, lines.join("\n") + "\n");
console.log("LUT escrita em", out);
