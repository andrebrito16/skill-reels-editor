// Realinha os tempos das palavras do Whisper pela energia do áudio (o Whisper erra início/fim em até ~0,4 s).
// 1) acha as frases faladas no áudio (RMS 10 ms acima do limiar, unindo pausas curtas);
// 2) encaixa as palavras nas frases em ordem (programação dinâmica pela distância ao tempo do Whisper);
// 3) dentro de cada frase, distribui o tempo proporcional às vogais de cada palavra.
// Uso: node align-captions.mjs <media> <words.json> <out.json> [--thr -35] [--gap 0.08]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? +argv[i + 1] : d;
};
const [media, wordsFile, outFile] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!media || !wordsFile || !outFile) {
  console.error("uso: node align-captions.mjs <media> <words.json> <out.json> [--thr -35] [--gap 0.08]");
  process.exit(1);
}
const THR = opt("thr", -35);
const GAP = opt("gap", 0.08);
const HOP = 0.01;

// RMS por 10 ms (48 kHz -> 480 amostras)
const r = spawnSync(
  "ffmpeg",
  ["-v", "error", "-i", media, "-vn", "-af", "pan=mono|c0=c0,aresample=48000,asetnsamples=480,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"],
  { encoding: "utf8", maxBuffer: 1 << 28 },
);
const db = [...r.stdout.matchAll(/RMS_level=(\S+)/g)].map((m) => (m[1] === "-inf" ? -120 : +m[1]));

// frases = trechos acima do limiar, unindo buracos < GAP e descartando estalos < 80 ms
let phrases = [];
let start = null;
db.forEach((d, i) => {
  if (d > THR && start === null) start = i;
  if (d <= THR && start !== null) phrases.push([start * HOP, i * HOP]), (start = null);
});
if (start !== null) phrases.push([start * HOP, db.length * HOP]);
phrases = phrases.reduce((acc, p) => {
  const last = acc.at(-1);
  if (last && p[0] - last[1] < GAP) last[1] = p[1];
  else acc.push([...p]);
  return acc;
}, []);
phrases = phrases.filter(([a, b]) => b - a >= 0.08);

const words = JSON.parse(readFileSync(wordsFile, "utf8"));
const N = words.length;
const P = phrases.length;
const dist = (w, [a, b]) => {
  const s = w.startMs / 1000;
  const e = w.endMs / 1000;
  return Math.max(0, a - e) + Math.max(0, s - b);
};

// DP monotônica: palavra i na frase j, j não decresce
const cost = Array.from({ length: N }, () => new Float64Array(P).fill(Infinity));
const from = Array.from({ length: N }, () => new Int32Array(P));
for (let j = 0; j < P; j++) cost[0][j] = dist(words[0], phrases[j]);
for (let i = 1; i < N; i++) {
  let best = Infinity;
  let bj = 0;
  for (let j = 0; j < P; j++) {
    if (cost[i - 1][j] < best) (best = cost[i - 1][j]), (bj = j);
    cost[i][j] = best + dist(words[i], phrases[j]);
    from[i][j] = bj;
  }
}
const assign = new Int32Array(N);
let j = 0;
for (let k = 1; k < P; k++) if (cost[N - 1][k] < cost[N - 1][j]) j = k;
for (let i = N - 1; i >= 0; i--) (assign[i] = j), (j = from[i][j]);

const weight = (t) => Math.max(1, (t.toLowerCase().match(/[aeiouáéíóúâêôãõà]/g) ?? []).length);
const out = words.map((w) => ({ ...w }));
for (let p = 0; p < P; p++) {
  const idx = [...assign.keys()].filter((i) => assign[i] === p);
  if (!idx.length) continue;
  const [a, b] = phrases[p];
  const total = idx.reduce((s, i) => s + weight(words[i].text), 0);
  let t = a;
  for (const i of idx) {
    const d = ((b - a) * weight(words[i].text)) / total;
    out[i].startMs = Math.round(t * 1000);
    out[i].endMs = Math.round((t + d) * 1000);
    t += d;
  }
}
const moved = out.map((w, i) => Math.abs(w.startMs - words[i].startMs));
moved.sort((x, y) => x - y);
writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`ok: ${N} palavras em ${P} frases; deslocamento mediano ${moved[N >> 1]} ms, p90 ${moved[Math.floor(N * 0.9)]} ms -> ${outFile}`);
