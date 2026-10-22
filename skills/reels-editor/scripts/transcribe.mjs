// Transcreve um WAV com Whisper.cpp (via @remotion/install-whisper-cpp) e grava Caption[] com tempo por palavra.
// Rode da RAIZ do projeto (whisper.cpp é instalado em ./whisper.cpp na primeira vez).
// Uso: node transcribe.mjs <in.wav> <out.json> [--lang pt] [--model medium]
import path from "node:path";
import { writeFileSync } from "node:fs";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith("--") && !/^(pt|en|es|medium|small|large-v3)$/.test(a));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (!input || !output) {
  console.error("uso: node transcribe.mjs <in.wav> <out.json> [--lang pt] [--model medium]");
  process.exit(1);
}
const lang = opt("lang", "pt");
const model = opt("model", "medium"); // multilíngue (não use *.en para PT)
const whisperPath = path.join(process.cwd(), "whisper.cpp");
const version = "1.6.0";

await installWhisperCpp({ to: whisperPath, version });
await downloadWhisperModel({ folder: whisperPath, model });
const out = await transcribe({
  inputPath: path.resolve(input),
  model,
  tokenLevelTimestamps: true,
  whisperPath,
  whisperCppVersion: version,
  language: lang,
  splitOnWord: true,
});
const { captions } = toCaptions({ whisperCppOutput: out });
writeFileSync(output, JSON.stringify(captions, null, 2));
console.log(`ok: ${captions.length} palavras -> ${output}`);
