# Audio, music, SFX

## Voice (lavalier, safety track)
Chain used by `build-master.mjs`: `pan=mono|c0=c0, highpass 80, −2.5 dB @280 Hz (mud), +1.5 dB @3.5 kHz, +2.5 dB high shelf @8 kHz, acompressor thr −22 dB ratio 2 att 15 rel 160 makeup 4`.
- **No `afftdn`** — the room noise is ≈ −58 dB (≈ 28 dB under speech) and the denoiser + fast compressor made the voice "dirty/strange". Tight cuts that clip word tails also sound dirty: keep pad-out ≥ 0.15 s.
- 12 ms fades at every cut edge. Montage/unboxing shots are muted (`volume=0`).
- Final: `loudnorm` two-pass (I −14, TP −1.5, linear) + `alimiter`. Mixed result must have TP ≤ −1.5 dBFS (Remotion's mix of voice+music+SFX reached +0.1 before normalising → always normalise the exported file).
- If the voice still sounds odd, ask which symptom (muffled / robotic / hiss / pumping) before changing anything.

## Megaphone effect (gag lines)
`highpass 450, lowpass 3400, +6 dB @1.5 kHz, hard compressor, asoftclip tanh, acrusher 10 bit mix 0.25, aecho 0.8:0.6:25:0.25` + black & white grade. No caption on that line. Whisper can't transcribe it → write the text by hand.

## Music
- User provides the track. Analyse: duration, `ebur128` (the example track is −9.3 LUFS, very dense), energy per 0.5 s, dips. Dips every 2 bars are rhythmic accents → align one with the main visual cut (the unboxing cut). Avoid ending on a breakdown/drop.
- Process: slice (`atrim`), `highpass 45`, −3.5 dB @2.2 kHz (opens space for voice), −1.5 dB @300 Hz, `lowpass 14k`, `loudnorm I=-27 TP=-3 LRA=7` (two-pass, linear) → `public/music.mp3`.
- In Remotion `MusicBed`: gain 0.7, +3.5 dB swell in windows with no speech, 0.6 s fade-in, last 3.2 s fade-out. With speech present the music adds ≈ +0.2 LU to the voice (≈ 13 LU under it).
- Credit/licence: remind the user to check the track's licence for Instagram.

## SFX
Library: `https://remotion.media/{whoosh,whip,page-turn,switch,mouse-click,shutter-modern,ding}.wav` (download into `public/sfx/`; offline renders). Synthesised in ffmpeg: `crinkle` (filtered tremolo noise), `boom` (62 Hz sine + low pink noise), `whoosh-slow` (whoosh at 0.55× rate).
Use at: graphic/print entrance, background swaps, B-roll in/out (quiet whoosh/switch), lower third (`ding` 0.3), correction title (`switch` 0.3).
**Do not** use SFX on handling/unboxing shots or on top of dialogue emphasis unless asked — the creator called them "horríveis" there. Volumes 0.3–0.6; mix peaks are normalised afterwards.
