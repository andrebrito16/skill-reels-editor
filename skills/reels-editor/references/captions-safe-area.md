# Captions, graphics and the Instagram safe area

## Safe area (1080×1920)
Instagram covers the top (profile/back), the bottom (caption, audio, buttons) and the right edge (like/comment/share); the profile grid crops 3:4 from the centre.
`templates/remotion/safe.ts`:
```ts
export const SAFE = { top: 300, bottom: 480, side: 130 }; // text/graphics inside x∈[130,950], y∈[300,1440]
```
- Use **symmetric** side padding so content is centred on x=540. (A 70/130 split put captions 30 px left of centre — measured and fixed.)
- Full-bleed video/B-roll/backdrops can ignore it; anything readable cannot.
- Verify centring by pixels: crop the caption band from a rendered still, threshold white (≥245), min/max x → centre must be 540 ± 1.

## Captions (default style)
`Captions.tsx`: Montserrat 800, 54 px, white fill, `WebkitTextStroke` ≈ 17 % of size in `#040404` with `paintOrder: "stroke fill"`, soft shadow, `textWrap: balance`, no animation. Pages of 2–4 words come from `group-captions.mjs` (sentence-case after . ? !, drops trailing , . ; keeps `?`, never ends a page on a weak word, breaks on punctuation or pauses > 450 ms).
- Whisper writes `"y"` etc. with quotes → normalised. Fix proper nouns ("Acme Audio", "Acme Audio") via `textReplace`.
- Never caption: montage cuts, megaphone gag, pure-music moments.
- ALL-CAPS and 100+ px caption sizes were rejected ("muitooo grandes").

## Lower third / handle
`LowerThird.tsx`: gradient pill (Han Purple → Blue Violet) + turquoise bar, Montserrat 800 58 px **with black outline**, spring slide in, slide out 8 frames before the end. Only the handle (e.g. `@yourhandle`), no label.

## Correction title (wrong word on camera)
`Correction.tsx`: black pill, orange (#FF5E1E) border, L-plug icon, "CORREÇÃO" + corrected text, ~3.4 s, enters while the creator is still saying the wrong word. Also fix the caption text itself (`textReplace`). Don't cut or retime the video.

## Print/comment card as hook
Card inside the safe area (`left: SAFE.side`, `width: 1080 − 2·SAFE.side`, `top: SAFE.top + 40`), turquoise border, slight tilt and spring pop; the creator (roto) overlaps its lower edge for depth. Dim backdrop `radial-gradient(Han Purple → black)`.
