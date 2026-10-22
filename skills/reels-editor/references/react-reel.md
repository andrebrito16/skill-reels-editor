# React reels (creator reacts to someone else's video)

Template: `templates/remotion/ReactReel.tsx` (typechecked). Same pipeline as `pipeline.md` for the **reactor** footage (cut, grade, voice chain → `master.mp4`); the **reference** video is a second source placed in windows.

## Intake (extra questions)
1. Reference video: file, who made it (handle for the credit), orientation (9:16 or 16:9), which seconds matter.
2. Layout: `stack` (reference on top, you below — most readable), `pip` (reference full-screen, you in a corner box), `cutout` (reference full-screen, you rotoscoped in front — premium, needs roto).
3. Style of reaction: pause-and-comment (freeze frames) vs. talk over playback.
4. Rights: Instagram may mute/limit reels that reuse long chunks of other people's content. Keep reference excerpts short (a few seconds each), always credit, transform with commentary. Tell the user this once; don't lecture.

## Recording advice to give the user
Record the reactor in one take with the reference playing in headphones **or** record the reference separately and react to the memory of it; leave 0.5 s of silence before each reaction line so cuts are clean. Note the timestamp of the reference where each comment starts.

## Build
1. Reference: normalise to H.264, 30 fps, no HDR; copy to `public/reference.mp4` (cut to the needed excerpts if long). If it is Rec.709 phone footage, **do not** apply the S-Log LUT.
2. Reactor: pipeline steps 1–6 (transcript → cuts → grade → master). Captions are for the **reactor only**.
3. Define `clips` windows (final-time seconds):
```ts
clips: [
  { at: 2.0,  dur: 4.0, from: 12.0, volume: 0.6 },                // plays, reactor listens
  { at: 6.0,  dur: 3.0, from: 16.0, freeze: true },               // pause on a frame while reactor comments
  { at: 15.0, dur: 5.0, from: 41.5, volume: 0.35 },               // reactor talking over it → duck
]
```
4. Duck the reference audio whenever the reactor speaks (`volume` 0.3–0.4); full volume only when nobody talks. Music bed (if any) is optional here — the reference's own audio is the "music"; keep it lower than the voice.
5. Mount in `Root.tsx` with `layout`, `credit="@original"`, `captions` (from `group-captions.mjs`), and for `cutout` the `rotoWindows` + PNGs from `scripts/roto.sh`.
6. Safe area: the credit tag sits at `SAFE.top − 90` (y≈210) left — if it collides with the profile bar on a test device move it inside `SAFE.top`. The `pip` box is bottom-left above the caption area so the right-side buttons stay free.

## Design rules
- Hook in the first 1.5 s: the funniest/most surprising reference second **or** the reactor's reaction face; never a logo.
- Cut on reaction beats: show the reference → hold 0.3 s on the reactor's face → comment. Remove dead air hard.
- Captions only for the reactor's voice. If the reference has important speech, add a distinct style (smaller, `#40E4C9` stroke) rather than mixing them.
- Punch-in alternating 1.0/1.07 on the reactor still works in `stack`/full-screen reactor moments; not on the reference.
- SFX: `whoosh` on each reference entrance/exit, `switch` on freeze, nothing on reaction faces.
- Check duration (15–45 s works best for reacts; user decides) and loudness the same way as other reels.

## Verification checklist
Contact sheet with one frame at each window start/end, a frozen frame, a reactor-only moment, last 2 s · reference audio vs voice levels (voice must dominate: voice window RMS ≥ 8 dB above reference) · credit visible whenever the reference is · all text inside the safe area · export with `encode-instagram.sh`.
