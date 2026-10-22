// Calcula trechos de fala (sem pausas) dentro de janelas da gravação bruta.
// Uso: node silence-cuts.mjs --wav in.wav --ranges ranges.json --out cuts.json
//        [--noise -40] [--dur 0.3] [--pad-in 0.09] [--pad-out 0.15] [--min 0.25]
// ranges.json: { "intro": [0.85, 6.3], "main": [68.8, 152.4, 153.05] }   (3º valor opcional = fim mínimo do último trecho)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const wav = opt("wav");
const rangesFile = opt("ranges");
const outFile = opt("out", "cuts.json");
if (!wav || !rangesFile) {
  console.error("uso: node silence-cuts.mjs --wav in.wav --ranges ranges.json --out cuts.json");
  process.exit(1);
}
const noise = opt("noise", "-40");
const minSil = opt("dur", "0.3");
const PAD_IN = Number(opt("pad-in", "0.09"));
const PAD_OUT = Number(opt("pad-out", "0.15"));
const MIN = Number(opt("min", "0.25"));

// silencedetect escreve no stderr, então usamos o shell para redirecionar
const text = execFileSync(
  "sh",
  ["-c", `ffmpeg -hide_banner -i "${wav}" -af silencedetect=noise=${noise}dB:d=${minSil} -f null - 2>&1 | grep -oE "silence_(start|end): [0-9.-]+"`],
  { encoding: "utf8", maxBuffer: 1 << 26 },
);
const sil = [];
let s = 0;
for (const l of text.trim().split("\n")) {
  const [k, v] = l.split(": ");
  if (k === "silence_start") s = Math.max(0, +v);
  else sil.push([s, +v]);
}

const keep = (from, to) => {
  const out = [];
  let cur = from;
  for (const [a, b] of sil) {
    if (b <= from || a >= to) continue;
    if (a > cur) out.push([cur, Math.min(a, to)]);
    cur = Math.max(cur, b);
  }
  if (cur < to) out.push([cur, to]);
  return out.filter(([a, b]) => b - a >= MIN).map(([a, b]) => [Math.max(from, a - PAD_IN), Math.min(to, b + PAD_OUT)]);
};

const ranges = JSON.parse(readFileSync(rangesFile, "utf8"));
const res = {};
for (const [k, [a, b, minEnd]] of Object.entries(ranges)) {
  res[k] = keep(a, b).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  if (minEnd && res[k].length) res[k].at(-1)[1] = Math.max(res[k].at(-1)[1], minEnd);
  const dur = res[k].reduce((t, [x, y]) => t + y - x, 0);
  console.log(`${k}: ${res[k].length} trechos, ${dur.toFixed(1)}s`);
}
writeFileSync(outFile, JSON.stringify(res, null, 1));
