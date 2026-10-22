# Color grading (S-Log3 / S-Gamut3.Cine → Rec.709, cinematic)

No LUT from Sony is available, so `scripts/make-lut.mjs` builds a 65³ `.cube` from the official math:
S-Log3 decode → S-Gamut3.Cine→Rec709 matrix → filmic shoulder (tanh above 0.45) → Rec709 OETF → S-curve → split-toning → **skin** → **whites (teeth)** → magenta tame (LED wall) → global saturation.

```bash
node $S/scripts/make-lut.mjs work/lut/grade.cube            # colour
node $S/scripts/make-lut.mjs work/lut/grade_bw.cube --bw    # black & white (higher contrast)
# knobs (env): EXPO CONTRAST SAT SKIN_DESAT SKIN_HUE WHITES_DESAT
```
Apply in ffmpeg (input is full-range BT.709-matrix 10-bit; **scale + tag first**, LUT in RGB):
```
scale=1080:1920:flags=lanczos:in_range=full:in_color_matrix=bt709,format=rgb48le,lut3d=file=grade.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,fps=30
```
(`build-master.mjs` already does this.) Grade B-roll with the same LUT; already-Rec709 footage (phone clips, reference videos) gets **no** LUT.

## Defaults and what they fix (the maintainer's footage)
- EXPO 0.0, CONTRAST 0.4, SAT 0.85, highlight tint only slightly warm (R+0.008, B−0.008). A bigger warm tint made the face red and teeth yellow.
- Magenta/purple LED wall: −45 % saturation around hue 305°.
- **Skin** (hue −30…45°, sat 0.12–0.95, brand reds >0.82 sat excluded): −22 % saturation, +3° hue. 42 % looked ashen with magenta patches; 32 % started to wash out.
- **Teeth / warm whites** (hue 30–70°, light, sat 0.12–0.85): −55 % saturation, gate on value from 0.45 (so shadowed side teeth match the front ones). 70 % looks fake.

## Check with numbers (do this after any change)
```bash
ffmpeg -y -ss 90 -i clip.MP4 -frames:v 1 -vf "<grade chain above>" work/test/f.png
node $S/scripts/patch.mjs work/test/f.png <x> <y> <w> <h>      # RGB, Lab, hue, sat of a patch
```
Targets: cheek sat ≈ 0.35–0.55, hue 20–30°; teeth Lab b* ≈ 20–30 (was 46 before the fix; natural 15–25).
Compare variants side by side in one image (`hstack`) and look at faces + a brand-colour object (red cables) to make sure the brand red survives.
Wrong crop coordinates are common: look at the full frame once before sampling.

When the grade changes you must rebuild: master → B-roll files → roto PNGs (reuse the masks: `alphamerge` again, no need to rerun Vision) → render → encode.
