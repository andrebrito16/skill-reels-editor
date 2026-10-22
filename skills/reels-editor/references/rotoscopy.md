# Rotoscopy (person cut-out)

`scripts/roto.sh <master.mp4> <start_s> <dur_s> <outDir>` → Apple Vision `VNGeneratePersonSegmentationRequest` (`.accurate`, temporal sequence handler) → grey mattes → `alphamerge` → **PNG RGBA** per frame (`p_00000.png…`).
Quality on this footage: clean hair/shoulder edges; hands at the frame edge are cut like the frame itself. ~20 s for 6 s of video. macOS only; no extra installs.

Run it on the **graded master** so colours match the base layer, start at 0 so PNG numbers equal master frame numbers, and keep only the frames you use (≈ 2.2 MB each; the unboxing needed 186 frames ≈ 400 MB in `public/roto/`, gitignored/untracked).

## Use in Remotion
```tsx
<Sequence from={f(REF.from)} durationInFrames={f(REF.to - REF.from)}>
  <Backdrop />                          {/* image/video behind the person */}
  <RotoFrame offset={f(REF.from)} />  {/* PNG number = local frame + offset */}
</Sequence>
```
- `RotoFrame` wraps `<Img>` in `<AbsoluteFill>` — without it the PNG didn't render inside a `<Sequence>`.
- Do **not** use VP9-alpha WebM with `<OffthreadVideo transparent>` or `<Html5Video>`: both rendered nothing here.
- Ride the backdrop fade-in 6 frames; don't punch-zoom the base during roto windows (mask and base must stay aligned).
- When only colour changes (new LUT), reuse the mattes: `REMERGE=1 roto.sh <master> 0 <dur> public/roto <matteDir>` (skips Vision, only re-merges).

## When to roto
Graphic/print behind the creator (hook), reference/location footage behind them ("tocando lá no festival"), react "cutout" layout. Not worth it for the whole reel: only the seconds that need it.
