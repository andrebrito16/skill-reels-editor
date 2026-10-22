# reels-editor — detailed guide

🇧🇷 [Versão em português](GUIA.pt-BR.md) · ← [Back to README](../README.md)

**Contents**
1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [Prepare your project](#4-prepare-your-project)
5. [How it works](#5-how-it-works)
6. [Using it](#6-using-it)
7. [Scripts and templates](#7-scripts-and-templates)
8. [Customization](#8-customization)
9. [Troubleshooting](#9-troubleshooting)
10. [Privacy, licensing and limits](#10-privacy-licensing-and-limits)
11. [Contributing](#11-contributing)

---

## 1. Overview

`reels-editor` is a **skill**: a folder with a `SKILL.md` (instructions the agent reads), reference docs, helper scripts and Remotion templates. When you ask Claude Code to edit a reel, it loads the skill and follows the same disciplined workflow every time:

- **Plan first, edit second.** It probes your footage, transcribes it and presents a cut plan with open questions before building anything.
- **Preview before final.** A 540p preview with a contact sheet of key frames; the final render only when you ask.
- **Measure, don't guess.** An agent cannot watch or listen in real time, so it checks loudness (`ebur128`), skin/teeth color (Lab/HSV), text centering (pixel scans) and tells you what it could *not* verify.
- **Instagram-ready.** Safe-area aware graphics and a 2-pass VBR H.264 export.

The skill was extracted from real reel projects and keeps the lessons learned in `references/pitfalls.md`.

## 2. Requirements

### 2.1 Summary

| Component | Required? | Version / notes |
|---|---|---|
| Claude Code (or another agent that loads `SKILL.md` skills) | **Yes** | Skills live in `~/.claude/skills/` or `<project>/.claude/skills/` |
| Node.js | **Yes** | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| A Remotion project | **Yes** | Remotion **4.0.x** (tested 4.0.537) |
| `@remotion/media`, `@remotion/google-fonts`, `@remotion/captions`, `@remotion/install-whisper-cpp` | **Yes** | Same version as `remotion`. `@remotion/media` may be installed transitively but is **not** declared by the blank template — add it explicitly |
| FFmpeg + FFprobe | **Yes** | Full build, tested 9.0.1. Needs `libx264`, `aac` and filters: `lut3d loudnorm alimiter acompressor asoftclip acrusher aecho equalizer highshelf silencedetect alphamerge curves gblur` |
| C toolchain (`make`, `cc`) | **Yes** (for transcription) | Whisper.cpp 1.6.0 is compiled on first use |
| Internet (first runs) | **Yes** | Whisper model (`medium` ≈ 1.5 GB), Remotion's headless Chrome, Google Fonts at render time |
| macOS + Swift (Xcode Command Line Tools) | Optional | Rotoscopy via Apple Vision (`scripts/roto.sh`). Tested on macOS 26 / Swift 6.4 |
| Bun or npm | Recommended | To run Remotion and the `reel:*` npm shortcuts |
| Disk space | — | Tens of GB: 4K clips; ≈ 450 MB intermediate render per ~100 s; roto PNGs ≈ 2 MB/frame (only the seconds that use roto) |

### 2.2 Install the tools

**macOS**
```bash
xcode-select --install          # compiler + Swift (roto)
brew install node ffmpeg        # or use fnm/nvm for Node
```

**Ubuntu / Debian**
```bash
sudo apt update
sudo apt install ffmpeg build-essential git
# Node 20.19+/22.13+/24: use https://github.com/Schniz/fnm or nvm
```
Rotoscopy (`roto.sh`) won't run; see [Customization → rotoscopy](#rotoscopy-without-macos).

**Windows** — use **WSL2** (Ubuntu) and follow the Ubuntu steps. Run Claude Code inside WSL.

### 2.3 Verify

```bash
./install.sh --check
```

It confirms Node's version, FFmpeg's encoders/filters, Swift (optional), the package manager, the C toolchain and — with `--project <dir>` — the Remotion packages your project is missing.

### 2.4 Footage assumptions

- The color transform targets **Sony S-Log3 / S-Gamut3.Cine**. For Rec.709 footage (phone, reference clips) skip the LUT. For other log cameras adapt `scripts/make-lut.mjs` (see [Customization](#8-customization)).
- Camera files with a **rotation tag** are handled (FFmpeg autorotates). Check with a single frame before planning crops.
- Audio: works with any mic; the defaults assume a **lavalier** and a **safety track** on channel 2 (channel 1 is used; channel 2 is a fallback).

## 3. Installation

Pick **one**:

### A. `skills` CLI
```bash
npx skills add andrebrito16/skill-reels-editor                       # interactive; installs into the current project
npx skills add andrebrito16/skill-reels-editor -g -a claude-code -y  # user-level, non-interactive
```
Tested: it finds the skill and copies it to `./.claude/skills/reels-editor` (project) or `~/.claude/skills` (`-g`). It does not check your tools — run `./install.sh --check` for that.

### B. Installer script (recommended)
```bash
git clone https://github.com/andrebrito16/skill-reels-editor.git
cd skill-reels-editor
./install.sh                         # → ~/.claude/skills/reels-editor
./install.sh --project ~/my-reels    # → ~/my-reels/.claude/skills/reels-editor
./install.sh --link                  # symlink: `git pull` updates the skill
./install.sh --check                 # requirements only
./install.sh --uninstall [--project DIR]
./install.sh --force                 # install even if required tools are missing
```
`CLAUDE_HOME=/path ./install.sh` installs under `/path/skills/` (useful for tests or non-default setups).

### C. Manual
Copy `skills/reels-editor/` to `~/.claude/skills/` (all projects) or `<project>/.claude/skills/` (one project). Some setups keep skills in `.agents/skills/` with `.claude/skills` as a symlink — both work.

### Check that it loaded
Start Claude Code in the project and type `/reels-editor` (or open the skills list). Updating = pull + reinstall (or nothing, if you used `--link`).

## 4. Prepare your project

```bash
npx create-video@latest            # choose the blank TypeScript template
cd my-reels
npx remotion add @remotion/media
npx remotion add @remotion/google-fonts
npx remotion add @remotion/captions
npx remotion add @remotion/install-whisper-cpp
```

Suggested layout (the skill uses these conventions):

```
my-reels/
├─ public/                  # what Remotion serves: master.mp4, music.mp3, sfx/, roto/, brolls/, images
├─ src/<ReelName>/          # your composition (copied from the templates) + data/captions.ts, timeline.ts
├─ <reel-name>/
│  ├─ assets/{clips,brolls,images}   # raw footage — never modified
│  └─ work/                 # wavs, transcripts, cuts.json, LUTs, rendered segments, mattes, test frames
└─ out/                     # preview, intermediate and final exports
```

Notes
- The template's `tsconfig` targets `lib: ["es2015"]`; the skill's templates avoid newer APIs (`padStart`, `flatMap`).
- `Config.setVideoImageFormat("jpeg")` is fine for previews; final renders use `--jpeg-quality=100`.
- Add `out/`, `public/roto/`, `public/master.mp4`, `whisper.cpp/` and `*/work/` to `.gitignore`.

## 5. How it works

The agent follows 11 steps (details in `references/pipeline.md`):

| # | Step | What happens |
|---|---|---|
| 0 | **Intake** | Asks: goal, CTA, target duration, which clip is main/B-roll, extra assets, music, handle, language, anything said wrongly, hook idea |
| 1 | **Probe** | `ffprobe` (rotation, fps, channels) + audio levels |
| 2 | **Transcribe** | Extracts 16 kHz mono audio → Whisper.cpp (local). Re-transcribes boosted windows where Whisper fails; checks RMS to find where speech really is; spots instructions spoken to the editor and hallucinated text |
| 3 | **Cut plan** | `silence-cuts.mjs` (−40 dB, ≥ 0.3 s, pad-in 0.09 s / pad-out 0.15 s) + a hand-picked montage for silent action shots. **You approve the plan first** |
| 4 | **Grade** | `make-lut.mjs` builds a 65³ `.cube`: S-Log3 → S-Gamut3.Cine → Rec.709, filmic shoulder, S-curve, split-toning, selective skin / teeth / magenta-wall handling. 3–4 test frames + numeric checks |
| 5 | **Master** | `build-master.mjs`: per-segment grade + voice chain, concat, two-pass `loudnorm` → `public/master.mp4` + `timeline.json` |
| 6 | **Captions** | Transcribes the **master** (so times match the final cut) → `group-captions.mjs` makes 2–4-word pages, with fixes for names, retimed lines, no-caption zones |
| 7 | **Rotoscopy** | Only for the seconds that need it (graphic behind you, location behind you, react cutout) |
| 8 | **Compose** | Remotion: base video, roto layers, B-roll cutaways, captions, lower third, correction title, SFX, music bed |
| 9 | **Preview** | 540p render, ~16-frame contact sheet, loudness, duration vs. target; you review |
| 10 | **Final** | High-quality intermediate → `encode-instagram.sh` (2-pass VBR) |

### Defaults the skill applies
- **Format:** 1080×1920, 30 fps.
- **Safe area:** text/graphics inside x ∈ [130, 950], y ∈ [300, 1440] (top 300 px, bottom 480 px, symmetric 130 px sides) so everything is centered on x = 540.
- **Captions:** 2–4 words, mixed case, ~54 px Montserrat ExtraBold, white with dark stroke, **no animation, no emoji, no per-word colors**; none on silent/effect moments.
- **Audio:** voice −14 LUFS; music bed ≈ −27 LUFS with a small swell when nobody talks and a 3 s fade-out; SFX only at transitions/graphics, never on handling shots; true peak ≤ −1.5 dBFS.
- **Corrections:** wrong word on camera → on-screen title, not a cut.
- **Colors:** cheek saturation ≈ 0.35–0.55 and teeth Lab b\* ≈ 20–30 (checked with `scripts/patch.mjs`).
- **Export:** H.264 High L4.2, 12 Mbps target / 16 Mbps max, 2 passes, closed GOP every 2 s, BT.709, AAC-LC 256 kbps 48 kHz.

## 6. Using it

Open Claude Code in your Remotion project.

**Talking-head / unboxing**
> `/reels-editor` — Edit the clip in `my-reel/assets/clips/` into a 9:16 reel. Footage is S-Log3. Add the B-rolls from `assets/brolls/`, show the screenshot `assets/images/comment.png` behind me in the intro, target ~1:15. Show me the plan first.

**React reel**
> Make a react reel: me reacting to `reference.mp4` (credit `@original_creator`), `stack` layout, pause on the funniest frames and comment. Keep the excerpts short.

**Iterating**
> "Captions are too big." · "My skin looks too red." · "Remove the SFX from the unboxing." · "Add a correction: I said Y, it's L." · "Render the final."

The agent should answer in your language, ask before guessing, and always tell you what it did and did not verify.

## 7. Scripts and templates

Run from the project root. `S=.claude/skills/reels-editor`.

| Script | Purpose | Example |
|---|---|---|
| `transcribe.mjs` | Whisper.cpp → word-timed JSON | `node $S/scripts/transcribe.mjs work/a.wav work/captions.json --lang pt --model medium` |
| `silence-cuts.mjs` | Speech ranges without pauses | `node $S/scripts/silence-cuts.mjs --wav work/a.wav --ranges work/ranges.json --out work/cuts.json` |
| `make-lut.mjs` | Builds the `.cube` color LUT | `node $S/scripts/make-lut.mjs work/lut/grade.cube` · `… grade_bw.cube --bw` |
| `build-master.mjs` | Graded + cut + mixed master from a JSON config | `node $S/scripts/build-master.mjs work/reel.config.json [--reuse]` |
| `align-captions.mjs` | Re-aligns Whisper word times to the audio energy (Whisper drifts up to ~0.4 s) | `node $S/scripts/align-captions.mjs work/master.mp4 work/captions-master.json work/captions-aligned.json` |
| `group-captions.mjs` | Words → 2–4-word caption pages (`.ts`) | `node $S/scripts/group-captions.mjs --words work/captions-aligned.json --fixes work/fixes.json --out src/MyReel/data/captions.ts` |
| `roto.sh` | Person cut-out → PNG with alpha (macOS) | `bash $S/scripts/roto.sh public/master.mp4 0 6 public/roto` (`REMERGE=1` reuses mattes) |
| `patch.mjs` | Color of a pixel patch (RGB/Lab/HSV) | `node $S/scripts/patch.mjs frame.png 440 900 40 40` |
| `encode-instagram.sh` | 2-pass VBR Instagram export | `bash $S/scripts/encode-instagram.sh out/intermediate.mp4 out/reel.mp4` |

Templates (`templates/remotion/`, copy to `src/<ReelName>/`): `Captions`, `LowerThird`, `Correction`, `RotoFrame`, `SfxMusic` (SFX list + music bed), `ReactReel`, plus `safe.ts`, `palette.ts`, `font.ts`. `examples/` holds the real config, ranges and caption-fix files of the source project.

## 8. Customization

| What | Where |
|---|---|
| Brand palette | `templates/remotion/palette.ts` |
| Caption / UI font | `templates/remotion/font.ts` (uses `@remotion/google-fonts`; swap Montserrat for any font that has your language's glyphs) |
| Safe area | `templates/remotion/safe.ts` |
| Caption look | `templates/remotion/Captions.tsx` |
| Color look | `scripts/make-lut.mjs` — env knobs: `EXPO`, `CONTRAST`, `SAT`, `SKIN_DESAT`, `SKIN_HUE`, `WHITES_DESAT`; e.g. `SKIN_DESAT=0.3 node make-lut.mjs out.cube` |
| Whisper language / model | `transcribe.mjs --lang en --model small` (use multilingual models, not `*.en`, for non-English) |
| Voice / megaphone chains | `"filters"` in `reel.config.json` |
| Export bitrate / GOP | `scripts/encode-instagram.sh` |
| Preferences the agent follows | **Creator defaults** section in `SKILL.md` — rewrite it for your channel (caption style, SFX policy, loudness, duration habits) |

### Other cameras
`make-lut.mjs` decodes S-Log3 with the official formula and converts S-Gamut3.Cine → Rec.709 with a 3×3 matrix. For another camera replace `slog3ToLinear` and the matrix `M` (e.g. Canon C-Log3 / Cinema Gamut, Panasonic V-Log / V-Gamut) and keep the rest of the look pipeline. Or point `lut` in the config at the manufacturer's official `.cube`.

### Rotoscopy without macOS
Any tool that outputs **PNG frames with alpha** named `p_00000.png…` (numbered from the start of the master) works: Robust Video Matting, SAM 2, DaVinci's Magic Mask, etc. Put them in `public/roto/` and use `RotoFrame`.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `install.sh` says FFmpeg lacks filters | Install a full build (`brew install ffmpeg`, `apt install ffmpeg`) |
| Whisper build fails | Install a C toolchain (`xcode-select --install` / `build-essential`) |
| Transcript misses words or invents text in noisy/quiet passages | Expected with Whisper; the skill re-transcribes boosted windows and checks RMS. Spelling of proper nouns: ask the user |
| Person from rotoscopy doesn't show | `<Img>` must be inside `<AbsoluteFill>` (the `RotoFrame` template does this). Alpha WebM does **not** work — use PNG |
| Captions show wrong glyphs | Your font lacks accents/symbols — use Montserrat or another full-Latin font |
| Render looks soft | Final render needs `--jpeg-quality=100` |
| Peaks above 0 dBFS in the render | Always run `encode-instagram.sh` (loudnorm + limiter) |
| Remotion typecheck errors on `padStart` / `flatMap` | `lib` is ES2015 in the template; use the patterns in the templates |
| A background render "finished" instantly | A stale log marker; truncate the log before starting or render in the foreground |
| ffmpeg options stored in a variable don't work in zsh | zsh doesn't word-split; use the provided scripts (bash arrays) |
| Colors differ between layers after changing the grade | Rebuild in order: LUT → master → graded B-rolls → roto PNGs (`REMERGE=1`) → render → encode |

More in `skills/reels-editor/references/pitfalls.md`.

## 10. Privacy, licensing and limits

- **Local by default.** Transcription, grading, rotoscopy and encoding run on your machine. Network use: package installs, the Whisper model download, Remotion's Chrome download, Google Fonts at render time and (optionally) free SFX from `remotion.media`, which you can copy into `public/sfx/` for offline renders.
- **The agent can't hear.** Always listen to the preview.
- **Music and third-party footage:** you are responsible for licenses. Instagram may mute or limit Reels that reuse other creators' content or unlicensed music.
- The skill's examples come from a real reel (anonymised); replace them with your own.
- Licensed under MIT (see `LICENSE`).

## 11. Contributing

Ideas: LUTs for other cameras, rotoscopy outside macOS, YouTube Shorts / TikTok export presets, new reel types (podcast clips, carousels-to-video, product demos), translations of the defaults. Open an issue first for larger changes; keep scripts dependency-light (Node built-ins + FFmpeg).
