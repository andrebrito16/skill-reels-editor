# Pitfalls hit on the first reel (and the fix)

**Footage / ffmpeg**
- ffprobe shows 3840×2160 but the clip has a rotation tag → frames are portrait; no crop needed. Always extract a frame first.
- No `drawtext` in this ffmpeg → can't burn timestamps into contact sheets; keep a mental order or use `tile`.
- `-ss` before `-i` is fine for cuts here; scaling happens before the LUT; `in_range=full:in_color_matrix=bt709` is required for S-Log3 files (untagged).
- Contact-sheet crops with guessed coordinates often land on the wrong place (forehead instead of cheek) → view the full frame, then crop.
- Don't use shell loops with `set -- $s` for arguments that contain spaces; use functions.

**Audio**
- Silence threshold −37 dB with 0.07 s padding clipped word tails; −40 dB / 0.3 s / pad 0.09–0.15 sounds right. A "Tchau!" the transcript showed at the end did not exist in the audio (hallucination) — check RMS before extending a cut.
- Never read the end of a clip from transcript time alone: the last word was cut mid-"detalhadamente" until the final range's min-end was set.
- `afftdn` + fast compressor made the voice sound dirty; removed.

**Transcription**
- Whisper `medium` (multilingual) is good for PT-BR but loses words in quiet/noisy passages, smears timestamps over silence, and invents text ("Tchau!", "[barulho de lente]"). Verify with RMS and re-transcribe boosted windows.
- Transcribe the **final master** for caption timing; the raw-clip timestamps no longer match after cuts.
- Whisper mangles proper nouns (e.g. brand or event names); always ask the user for proper-noun spelling.

**Remotion**
- `<Img>` inside `<Sequence>` without `<AbsoluteFill>` renders nothing (roto person "missing").
- VP9-alpha WebM via `OffthreadVideo transparent` / `Html5Video` → nothing visible. Use PNG sequences.
- tsconfig lib is ES2015: `String.padStart`, `Array.flatMap` fail typecheck. Use `("0000"+n).slice(-5)` and `.map` + spread.
- Hooks (`useCurrentFrame`) must be called inside the component rendered under the `<Sequence>`, not in the parent that builds JSX.
- `TheBoldFont` lacks accents/@/_ → captions looked wrong; use Montserrat (Google font via `@remotion/google-fonts`).
- Default JPEG quality 80 in Remotion config → set `--jpeg-quality=100` for finals.
- Mixed Remotion output peaked at +0.1 dBFS → always loudnorm in the encode step.
- `remotion still` vs. Studio: if a layer is missing in stills, first suspect layout (AbsoluteFill) before suspecting caching.

**Process**
- A background render's log file kept the previous run's `RENDER_EXIT=0` marker, so the "wait" loop returned early and the next step read a half-written file. Truncate the log before starting, or run in the foreground.
- Rebuilding after a grade change touches: LUT → master → graded B-roll → roto PNGs (re-merge mattes) → render → encode. Forgetting one gives mismatched colours between layers.
- Measure centring, loudness, skin and teeth numerically; say what was not verified.
- Ask before choosing between interpretations (e.g. "no caption at 0:20": removed the gag-line caption entirely and said so, offering to restore).
- User wants the reel to be shorter than raw cuts allow: report actual duration vs target every time and offer the tightening option.
- Silence cuts inside a sentence (even 30–160 ms removed) plus a punch-in on every cut read as "cortado, não dá para ouvir eu terminando a frase". Merge cuts that remove < 0.3 s; cut only between sentences; put punch-ins at sentence starts.
- Cut edges from Whisper word times clip heads/tails; set them from the 10 ms RMS envelope.
- `build-master.mjs` used to cut audio to the exact length but video to whole frames, so `concat` drifted ~130 ms by the end. Durations are now rounded to whole frames.
- Whisper word times drift up to ~0.4 s, and the user notices the captions lag. Run `scripts/align-captions.mjs <master> captions-master.json captions-aligned.json` and group from the aligned file.
