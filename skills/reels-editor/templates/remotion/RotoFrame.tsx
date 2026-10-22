import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

// Pessoa recortada (PNGs RGBA de scripts/roto.sh em public/roto/p_00000.png ...).
// IMPORTANTE: o <Img> precisa estar dentro de <AbsoluteFill>, senão não ocupa a tela dentro de uma <Sequence>.
// `offset` = frame do vídeo final em que a <Sequence> começa (os PNGs são numerados desde o frame 0 do master).
// <WebM com alpha / OffthreadVideo transparent> NÃO funcionaram no render; use sempre PNG.
export const RotoFrame: React.FC<{ offset: number; dir?: string }> = ({ offset, dir = "roto" }) => {
  const frame = useCurrentFrame();
  const n = ("0000" + (frame + offset)).slice(-5);
  return (
    <AbsoluteFill>
      <Img src={staticFile(`${dir}/p_${n}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};
