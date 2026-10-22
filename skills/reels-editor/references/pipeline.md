# Pipeline (talking-head / unboxing / review reels)

All commands run from the **project root**. `S=.claude/skills/reels-editor`.
Work files go in `<reel>/work/`, final assets in `public/`. Keep raw footage read-only.

## 0. Intake (ask, don't assume)
Reel goal and CTA · target duration · which clip is the main one, which are B-roll · extra assets (print, screen recording, logo, reference video) · music (user sends it) · brand/handle to show · language of captions · anything the creator said wrong (needs a correction title) · hook idea. Offer a recommendation for each open question.

## 1. Probe
```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,channels,sample_rate -show_entries stream_side_data=rotation -of compact clip.MP4
ffmpeg -i clip.MP4 -af astats=metadata=1:reset=0 -f null - 2>&1 | grep -E "Channel|Peak level dB|RMS level dB"
```
- Sony files: coded size looks 3840×2160 but there is a rotation tag → frames are portrait. Extract a frame to confirm before planning a crop.
- Audio channels: safety track means ch2 ≈ ch1 − 6 dB.
- This ffmpeg build has **no `drawtext`**: label contact sheets by order, not by burned-in text.

## 2. Transcribe the raw clip
```bash
ffmpeg -y -i clip.MP4 -map 0:a -af "pan=mono|c0=c0" -ar 16000 work/main-ch1-16k.wav     # ch2: c0=c1
node $S/scripts/transcribe.mjs work/main-ch1-16k.wav work/captions-raw.json --lang pt --model medium
```
Whisper fails on quiet/noisy passages (unboxing noises) and hallucinates ("Tchau!", "[barulho de lente]"). For each suspicious window:
```bash
ffmpeg -y -ss 32.5 -t 5 -i work/main-ch1-16k.wav -af "volume=10dB" work/seg.wav   # re-transcribe just this window
# energy per 0.5 s to know where speech REALLY is (≥ -45 dB) vs noise floor (~ -58 dB):
ffmpeg -hide_banner -loglevel error -i work/main-ch1-16k.wav -af "asetnsamples=8000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=work/rms.txt" -f null -
```
Whisper timestamps get "smeared" across silent stretches: trust RMS, not word times, there. Also catch **instructions to the editor** spoken on camera ("pode colocar esse take como B-roll") → cut them out.

## 3. Cut plan
`ranges.json` = windows of the raw clip that should survive (see `examples/example-ranges.json`).
```bash
node $S/scripts/silence-cuts.mjs --wav work/main-ch1-16k.wav --ranges work/ranges.json --out work/cuts.json
```
Defaults (-40 dB, ≥0.3 s, pad-in 0.09, pad-out 0.15) keep word tails. 3rd value in a range = minimum end of the last cut (so the final word/wink isn't clipped).
Silent action shots (opening a package, etc.): choose 0.7 s shots that show **action from the first frame** and chain them with hard cuts (~3 s max). Contact-sheet candidate times first.

**Present to the user before building:** table of what stays / goes with timestamps, estimated duration, where each overlay goes, open questions.

## 4. Grade
See `color-grading.md`. Produce `work/lut/grade.cube` and `grade_bw.cube`, check 3–4 frames + skin/teeth numbers.

## 5. Build the master
Write a config (see `examples/example.reel.config.json`) and run:
```bash
node $S/scripts/build-master.mjs work/reel.config.json            # --reuse keeps already-rendered segments
```
Outputs `public/master.mp4` (1080×1920@30, graded, voice chain, −14 LUFS) and `work/timeline.json` (start/dur of every segment in final time).
To change only the last segment: delete its `work/seg/NNN.mov` and rerun with `--reuse`.

## 6. Captions from the MASTER audio
```bash
ffmpeg -y -i public/master.mp4 -vn -ac 1 -ar 16000 work/master-16k.wav
node $S/scripts/transcribe.mjs work/master-16k.wav work/captions-master.json
node $S/scripts/group-captions.mjs --words work/captions-master.json --fixes work/caption-fixes.json --out src/<Reel>/data/captions.ts
```
`caption-fixes.json` handles Whisper errors, retimed phrases, wording fixes, and `clipBefore` (no caption across montage cuts) — see `examples/example-caption-fixes.json`. Skipping captions on an effect moment = `dropRanges`.
Timeline for Remotion: write `work/timeline.json` segments into `src/<Reel>/data/timeline.ts` (`export const TOTAL_SECONDS`, `segments`).

## 7. Rotoscopy (only the windows that need it)
`references/rotoscopy.md`. Needed for: print/graphic **behind** the creator, reference video behind, react "cutout".

## 8. Compose (Remotion)
Copy `templates/remotion/*` to `src/<Reel>/`, add `<Composition id="…" width={1080} height={1920} fps={30} durationInFrames={Math.round(TOTAL_SECONDS*30)}>` in `src/Root.tsx`. Typical layers: master `<Video>` → roto/backdrops → B-roll cutaways (hard cuts, slow push-in 1→1.08) → captions → lower thirds/corrections → SFX → music.
- B-roll windows: align with caption times (`grep -n "keyword" src/<Reel>/data/captions.ts`), 2.5–3.6 s each.
- Alternate punch-in zoom (1.0 / 1.07) on consecutive speech cuts hides jump cuts (not during roto windows).
- Lower third for @handle when the creator says it; no label words like "PARCERIA", outline typography (`LowerThird.tsx`).
- Run `npx tsc --noEmit` and `npx eslint src/<Reel>` (lib target is ES2015: no `padStart`/`flatMap`).

## 9. Preview + checks
```bash
npx remotion still src/index.ts <Id> work/stills/s.jpg --frame=120 --scale=0.5   # key frames
npx remotion render src/index.ts <Id> out/preview_raw.mp4 --scale=0.5 --crf=23
ffmpeg -y -i out/preview_raw.mp4 -af "loudnorm=I=-14:TP=-1.5:LRA=9" -c:v copy -c:a aac -b:a 256k out/preview.mp4
```
Contact sheet of ~16 moments (hook, cut points, B&W moment, each overlay, last 2 s) → read it → fix. Report loudness (`ebur128`), duration vs target, and what you could not verify.

## 10. Final
```bash
npx remotion render src/index.ts <Id> out/intermediate.mp4 --codec=h264 --crf=10 --x264-preset=medium --jpeg-quality=100 --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --concurrency=6
$S/scripts/encode-instagram.sh out/intermediate.mp4 out/<name>-reels.mp4
```
Run the render in the foreground (or reset its log file first — a stale "exit" marker already fooled this workflow once). Verify with `ffprobe`: High profile, 1080×1920, 30 fps, ~12 Mbps, AAC 48 kHz, −14 LUFS, keyframes every 2 s.
