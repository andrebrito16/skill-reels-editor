// Monta o "master" 9:16 1080x1920@30 (graduado, áudio tratado) a partir de uma lista de cortes.
// Uso: node build-master.mjs <reel.config.json> [--reuse]
//
// reel.config.json
// {
//   "src": "assets/clips/A001.MP4",          // clipe principal (S-Log3, rotação via metadado é respeitada)
//   "lut": "work/lut/grade.cube",            // LUT de cor (make-lut.mjs)
//   "lutBw": "work/lut/grade_bw.cube",       // LUT P&B (make-lut.mjs --bw), opcional
//   "audioChannel": 0,                       // 0 = canal 1; 1 = canal 2 (safety track)
//   "workDir": "work",                       // onde ficam work/seg/*.mov, concat.txt, master_raw.mov, timeline.json
//   "master": "../public/master.mp4",        // saída final (normalizada em -14 LUFS)
//   "targetLufs": -14,
//   "filters": { "voice": "...", "megaphone": "..." },   // opcional: sobrescreve as cadeias de áudio
//   "segments": [
//     { "label": "intro", "kind": "speech", "a": 0.9, "b": 6.1, "audio": "voice", "grade": "color" },
//     { "fromCuts": { "file": "work/cuts.json", "key": "main" }, "label": "main", "kind": "speech" },
//     { "label": "unbox", "kind": "montage", "a": 21.4, "b": 22.1, "audio": "mute" },
//     { "label": "lacrado", "kind": "phrase", "a": 33, "b": 36.5, "audio": "megaphone", "grade": "bw" }
//   ]
// }
// audio: "voice" (padrão) | "megaphone" | "mute" ; grade: "color" (padrão) | "bw"
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [cfgPath, ...flags] = process.argv.slice(2);
if (!cfgPath) {
  console.error("uso: node build-master.mjs <reel.config.json> [--reuse]");
  process.exit(1);
}
const REUSE = flags.includes("--reuse");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const work = cfg.workDir ?? "work";
const segDir = path.join(work, "seg");
mkdirSync(segDir, { recursive: true });

// cadeias de áudio padrão (lapela: EQ suave + compressão leve; sem denoise agressivo)
const CH = cfg.audioChannel ?? 0;
const voice =
  cfg.filters?.voice ??
  `pan=mono|c0=c${CH},highpass=f=80,equalizer=f=280:t=q:w=1:g=-2.5,equalizer=f=3500:t=q:w=1:g=1.5,highshelf=f=8000:g=2.5,acompressor=threshold=-22dB:ratio=2:attack=15:release=160:makeup=4:knee=6`;
const megaphone =
  cfg.filters?.megaphone ??
  `pan=mono|c0=c${CH},highpass=f=450,lowpass=f=3400,equalizer=f=1500:t=q:w=1:g=6,acompressor=threshold=-30dB:ratio=8:attack=2:release=40:makeup=10,asoftclip=type=tanh:threshold=0.5,acrusher=bits=10:mode=lin:mix=0.25,aecho=0.8:0.6:25:0.25`;

// expande segmentos
const timeline = [];
for (const s of cfg.segments) {
  if (s.fromCuts) {
    const cuts = JSON.parse(readFileSync(s.fromCuts.file, "utf8"))[s.fromCuts.key];
    for (const [a, b] of cuts) timeline.push({ kind: "speech", audio: "voice", grade: "color", ...s, fromCuts: undefined, a, b });
  } else timeline.push({ kind: "speech", audio: "voice", grade: "color", ...s });
}

const grade = (lut) =>
  `scale=1080:1920:flags=lanczos:in_range=full:in_color_matrix=bt709,format=rgb48le,lut3d=file=${lut}:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,fps=30`;

const t0 = Date.now();
timeline.forEach((s, i) => {
  const f = path.join(segDir, `${String(i).padStart(3, "0")}.mov`);
  s.file = f;
  // duração em quadros inteiros (30 fps): áudio e vídeo do segmento ficam com o mesmo tamanho,
  // senão o concat acumula dessincronia (chegou a 130 ms no fim do master)
  s.dur = +(Math.round((s.b - s.a) * 30) / 30).toFixed(4);
  if (REUSE && existsSync(f)) return;
  const fade = `afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, s.dur - 0.012).toFixed(3)}:d=0.012`;
  const af = s.audio === "mute" ? "volume=0" : `${s.audio === "megaphone" ? megaphone : voice},${fade}`;
  const lut = s.grade === "bw" ? (cfg.lutBw ?? cfg.lut) : cfg.lut;
  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-ss", String(s.a), "-t", String(s.dur), "-i", cfg.src,
      "-map", "0:v:0", "-map", "0:a:0",
      "-vf", grade(lut),
      "-af", `${af},aresample=48000,pan=stereo|c0=c0|c1=c0`,
      "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-c:a", "pcm_s16le", "-ar", "48000", "-t", String(s.dur), f,
    ],
    { stdio: "inherit" },
  );
  process.stdout.write(`seg ${i + 1}/${timeline.length} ok\n`);
});

// concat caminhos relativos ao arquivo de lista
const listFile = path.join(work, "concat.txt");
writeFileSync(listFile, timeline.map((s) => `file '${path.relative(work, s.file)}'`).join("\n") + "\n");
const raw = path.join(work, "master_raw.mov");
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", raw], { stdio: "inherit" });

// loudnorm em 2 passos + limitador de pico
const I = cfg.targetLufs ?? -14;
const m = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", `loudnorm=I=${I}:TP=-1.5:LRA=9:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1));
const ln = `loudnorm=I=${I}:TP=-1.5:LRA=9:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.89`;
const master = cfg.master ?? path.join(work, "master.mp4");
mkdirSync(path.dirname(master), { recursive: true });
execFileSync(
  "ffmpeg",
  ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-af", ln, "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-g", "15", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", master],
  { stdio: "inherit" },
);

let t = 0;
for (const s of timeline) {
  s.start = +t.toFixed(3);
  t += s.dur;
}
writeFileSync(path.join(work, "timeline.json"), JSON.stringify({ total: +t.toFixed(3), timeline }, null, 1));
console.log(`duração total ${t.toFixed(2)} s; feito em ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${master}`);
