// Agrupa palavras (Caption[] do Whisper) em legendas simples de 2 a 4 palavras e gera um arquivo .ts.
// Uso: node group-captions.mjs --words captions-master.json --out src/data/captions.ts [--fixes caption-fixes.json]
//
// caption-fixes.json (tudo opcional; tempos em ms do VÍDEO FINAL)
// {
//   "dropRanges": [[15121, 23800]],                 // remove palavras que tocam esse intervalo (Whisper errou/alucinou)
//   "retime": [{ "text": "Olha aí o que a Acme Audio me mandou aqui.", "startMs": 21481, "endMs": 23780 }],
//                                                    // insere a frase, com tempo distribuído proporcional ao tamanho de cada palavra
//   "insert": [{ "text": "Veio", "startMs": 17321, "endMs": 17921 }],   // palavras com tempo exato
//   "textReplace": [
//     { "find": "um unboxing", "replace": "o unboxing" },
//     { "find": "^em Y aqui", "replace": "em L aqui", "afterPageMatching": "cabos$" }
//   ],
//   "clipBefore": [15121, 15821],                    // nenhuma legenda atravessa esses instantes (cortes de montagem/sem fala)
//   "gapMs": 450, "maxWords": 4
// }
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const wordsFile = opt("words");
const outFile = opt("out");
if (!wordsFile || !outFile) {
  console.error("uso: node group-captions.mjs --words captions-master.json --out src/data/captions.ts [--fixes fixes.json]");
  process.exit(1);
}
const words = JSON.parse(readFileSync(wordsFile, "utf8"));
const fx = opt("fixes") ? JSON.parse(readFileSync(opt("fixes"), "utf8")) : {};
const GAP = fx.gapMs ?? 450;
const MAXW = fx.maxWords ?? 4;

let ws = words
  .filter((w) => !(fx.dropRanges ?? []).some(([a, b]) => w.endMs > a && w.startMs < b))
  .map((w) => ({ text: w.text.trim(), startMs: w.startMs, endMs: w.endMs }))
  .filter((w) => w.text);

for (const r of fx.retime ?? []) {
  const toks = r.text.split(/\s+/);
  const total = toks.join("").length;
  const span = r.endMs - r.startMs;
  let t = r.startMs;
  for (const text of toks) {
    const d = (text.length / total) * span;
    ws.push({ text, startMs: Math.round(t), endMs: Math.round(t + d) });
    t += d;
  }
}
for (const w of fx.insert ?? []) ws.push({ ...w });
ws.sort((a, b) => a.startMs - b.startMs);

// agrupamento em páginas de 2-4 palavras (não termina em palavra fraca; quebra em pontuação/pausas)
const weak = new Set(["e", "a", "o", "de", "da", "do", "que", "pra", "um", "uma", "no", "na", "em", "eu", "tô", "me", "se", "com", "é", "já", "ou", "os", "as", "meu", "minha", "esse", "essa", "mais", "ainda"]);
const strongEnd = /[.?!]$/;
const softEnd = /[,;:]$/;
const pages = [];
let cur = [];
const flush = () => {
  if (cur.length) pages.push(cur), (cur = []);
};
ws.forEach((w, i) => {
  const prev = ws[i - 1];
  if (prev && w.startMs - prev.endMs > GAP) flush();
  cur.push(w);
  const next = ws[i + 1];
  const nextGap = next ? next.startMs - w.endMs : 9999;
  const lastWeak = weak.has(w.text.toLowerCase().replace(/[^\p{L}@]/gu, ""));
  if (strongEnd.test(w.text)) flush(); // nunca mistura o fim de uma frase com o começo da próxima
  else if (cur.length >= MAXW) flush();
  else if (cur.length === 3 && !lastWeak && (softEnd.test(w.text) || nextGap > 250)) flush();
  else if (cur.length >= 2 && softEnd.test(w.text)) flush();
  else if (cur.length >= 2 && nextGap > GAP) flush();
});
flush();

const norm = (t) => t.replace(/^y$/i, "Y").replace(/"y"/gi, "Y").replace(/"/g, "");
const clip = (fx.clipBefore ?? []).slice().sort((a, b) => a - b);
const out = pages.map((p, i) => {
  let text = p.map((w) => norm(w.text)).join(" ").replace(/[.,;:!?]+$/g, (m) => (m.includes("?") ? "?" : ""));
  const prevLast = pages[i - 1]?.at(-1).text ?? ".";
  if (/[.?!]$/.test(prevLast)) text = text.charAt(0).toUpperCase() + text.slice(1);
  const startMs = p[0].startMs;
  const nextStart = pages[i + 1]?.[0].startMs ?? Infinity;
  let endMs = Math.min(p.at(-1).endMs + 120, nextStart - 20);
  const cut = clip.find((m) => m > startMs && m < endMs);
  if (cut) endMs = cut;
  return { text, startMs, endMs };
});
for (const [i, pg] of out.entries()) {
  for (const r of fx.textReplace ?? []) {
    if (r.afterPageMatching && !new RegExp(r.afterPageMatching).test(out[i - 1]?.text ?? "")) continue;
    pg.text = pg.text.replace(new RegExp(r.find), r.replace);
  }
}
writeFileSync(
  outFile,
  `export type CaptionPage = { text: string; startMs: number; endMs: number };\n\nexport const captionPages: CaptionPage[] = ${JSON.stringify(out, null, 2)};\n`,
);
console.log(`${out.length} legendas -> ${outFile}`);
