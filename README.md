# reels-editor

> An agent skill that edits vertical **Instagram Reels** end to end: transcription, silence cuts, S-Log3 color grading, rotoscopy, captions, SFX, music mix, the Instagram safe area and a 2-pass VBR export. Built for [Claude Code](https://claude.com/claude-code) and [Remotion](https://www.remotion.dev).

🇧🇷 [Leia em português](README.pt-BR.md) · 📘 [Detailed guide](docs/GUIDE.md) · 📘 [Guia detalhado (pt-BR)](docs/GUIA.pt-BR.md)

---

## What it does

You give the agent your footage (and, optionally, B-roll, a reference video, a music track). The skill walks it through a proven pipeline and keeps you in the loop:

1. **Intake** – asks the right questions first (goal, duration, hook, handle, music…).
2. **Transcribes** with Whisper.cpp (local) and fixes what Whisper gets wrong.
3. **Cuts** silences hard while keeping word tails, then shows you a **cut plan** before building anything.
4. **Color grades** Sony **S-Log3 / S-Gamut3.Cine** → Rec.709 with a cinematic look, with skin-tone and teeth care (checked with numbers, not by eye).
5. **Cleans the voice** (lavalier EQ + light compression, no destructive denoise) and normalizes to −14 LUFS.
6. **Rotoscopes** the person (Apple Vision) to put prints, locations or reference videos *behind* you.
7. **Composes in Remotion**: B-roll cutaways, captions (2–4 words, simple, centered), lower thirds, on-screen **corrections** (when you said the wrong word), SFX and a music bed.
8. **Respects the Instagram safe area** for every piece of text or graphic.
9. **Previews at 540p**, then exports with **H.264 High, 2-pass VBR (12/16 Mbps), closed GOP, BT.709, AAC 48 kHz, −14 LUFS**.

Reel types covered: **talking-head / unboxing / review**, **react reels** (`stack`, `pip`, `cutout` layouts) and **tutorials with B-roll**.

## Install

> Requirements first? See [Requirements](#requirements) or run `./install.sh --check`.

**Option A – `skills` CLI**

```bash
npx skills add andrebrito16/skill-reels-editor          # project; add -g for user-level
```

**Option B – installer script (recommended: it checks your tools)**

```bash
git clone https://github.com/andrebrito16/skill-reels-editor.git
cd skill-reels-editor

./install.sh                      # for your user  → ~/.claude/skills/reels-editor
./install.sh --project ~/my-reels # for one project → ~/my-reels/.claude/skills/reels-editor
./install.sh --link               # symlink instead of copy (git pull = update)
./install.sh --check              # only verify requirements
./install.sh --uninstall          # remove
```

**Option C – manual**

```bash
cp -R skills/reels-editor ~/.claude/skills/            # personal
# or
cp -R skills/reels-editor <your-project>/.claude/skills/
```

Then open Claude Code in your Remotion project and run:

```
/reels-editor
```

or just say *"edit this reel with the reels-editor skill"*.

### Set up the Remotion project (once)

```bash
npx create-video@latest          # blank TypeScript template
cd my-reels
npx remotion add @remotion/media
npx remotion add @remotion/google-fonts
npx remotion add @remotion/captions
npx remotion add @remotion/install-whisper-cpp
```

## Requirements

| Need | Details |
|---|---|
| **Agent** | [Claude Code](https://claude.com/claude-code) (or any agent that loads `SKILL.md` skills) |
| **Node.js** | `^20.19`, `^22.13` or `>=24` (Remotion 4.0.x requirement) |
| **Remotion project** | Remotion 4.0.x with `@remotion/media`, `@remotion/google-fonts`, `@remotion/captions`, `@remotion/install-whisper-cpp` |
| **FFmpeg + FFprobe** | Full build with `libx264`, AAC and the filters `lut3d, loudnorm, alimiter, acompressor, asoftclip, acrusher, aecho, equalizer, highshelf, silencedetect, alphamerge, curves, gblur` (e.g. `brew install ffmpeg`) |
| **C toolchain** | `make` + a C/C++ compiler — Whisper.cpp is compiled the first time you transcribe (≈1.5 GB `medium` model download) |
| **macOS + Swift** *(optional)* | Rotoscopy uses Apple Vision (`xcode-select --install`). On Linux/Windows everything else works; bring your own alpha PNGs for roto |
| **Disk** | Plan for tens of GB: 4K clips, ~450 MB intermediate render per ~100 s, rotoscopy PNGs ≈ 2 MB per frame |

Tested on macOS 26 · Node 24 · FFmpeg 9.0.1 · Remotion 4.0.537 · Swift 6.4. Full details: [docs/GUIDE.md](docs/GUIDE.md#2-requirements).

## What's inside

```
skills/reels-editor/
├── SKILL.md              # rules, defaults and the 11-step workflow (what the agent reads)
├── references/           # pipeline, react reels, color, audio, captions & safe area, roto, export, pitfalls
├── scripts/              # transcribe · silence-cuts · make-lut · build-master · align-captions · group-captions · roto · encode-instagram · patch
├── templates/remotion/   # Captions, LowerThird, Correction, RotoFrame, SfxMusic, ReactReel, safe area, palette, font
└── examples/             # an anonymised real reel's config, cut ranges and caption fixes
install.sh                # installer + requirements checker
docs/                     # detailed guides (EN / pt-BR)
```

## Make it yours

The defaults come from the maintainer's channel (Portuguese captions, Sony S-Log3, Montserrat, a specific palette). Change them in one place each:

- Palette / font / safe area → `templates/remotion/palette.ts`, `font.ts`, `safe.ts`
- Look → `scripts/make-lut.mjs` (env knobs: `EXPO`, `CONTRAST`, `SAT`, `SKIN_DESAT`, `WHITES_DESAT`…)
- Preferences the agent applies (caption style, SFX policy, loudness…) → the **Creator defaults** section of `SKILL.md`
- Export bitrate / GOP → `scripts/encode-instagram.sh`

See [docs/GUIDE.md](docs/GUIDE.md#8-customization).

## Honest limitations

- The agent **cannot listen**: it verifies audio with loudness/RMS measurements and tells you what it did not verify. Always give the preview a listen.
- The color LUT is built for **Sony S-Log3 / S-Gamut3.Cine**. Other cameras need a different transform (or skip the LUT for Rec.709 footage).
- Rotoscopy is macOS-only out of the box.
- `ReactReel.tsx` is type-checked and documented but has not yet been battle-tested on real footage. Feedback welcome.
- Reusing other creators' videos can get a Reel muted or limited by Instagram; keep excerpts short, credit the author and add commentary.

## Contributing

Issues and PRs are welcome — especially: LUTs for other cameras, a non-macOS rotoscopy path (e.g. RVM/SAM2 → PNG alpha), new reel types, and translations of the defaults.

## Credits & License

Built on [Remotion](https://www.remotion.dev), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [FFmpeg](https://ffmpeg.org) and Apple's Vision framework. Fonts: [Montserrat](https://fonts.google.com/specimen/Montserrat) (SIL OFL).

Released under the [MIT License](LICENSE).
