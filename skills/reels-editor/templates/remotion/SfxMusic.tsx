import React from "react";
import { Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

// [segundo, arquivo em public/sfx/<nome>.wav, volume 0-1]
export type SfxCue = readonly [number, string, number];

export const SfxTrack: React.FC<{ cues: ReadonlyArray<SfxCue>; gain?: number }> = ({ cues, gain = 1 }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {cues.map(([t, file, v], i) => (
        <Sequence key={i} from={Math.round(t * fps)} layout="none" name={`SFX ${file}`}>
          <Audio src={staticFile(`sfx/${file}.wav`)} volume={v * gain} />
        </Sequence>
      ))}
    </>
  );
};

// Cama de música já normalizada em ~-27 LUFS contra a voz em -14 LUFS (≈13 LU abaixo).
// swell = janelas sem fala em que a música sobe ~3-5 dB (ex.: unboxing mudo).
export const MusicBed: React.FC<{
  src: string; // arquivo em public/
  totalFrames: number;
  gain?: number;
  swell?: ReadonlyArray<{ from: number; to: number; gain: number }>; // segundos
}> = ({ src, totalFrames, gain = 0.7, swell = [] }) => {
  const { fps } = useVideoConfig();
  return (
    <Audio
      src={staticFile(src)}
      name="Música"
      volume={(frame) => {
        const t = frame / fps;
        let s = 1;
        for (const w of swell) {
          s = Math.max(s, interpolate(t, [w.from - 0.3, w.from, w.to, w.to + 0.5], [1, w.gain, w.gain, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
        }
        const fadeIn = interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
        const fadeOut = interpolate(frame, [totalFrames - 3.2 * fps, totalFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return gain * s * fadeIn * fadeOut;
      }}
    />
  );
};
