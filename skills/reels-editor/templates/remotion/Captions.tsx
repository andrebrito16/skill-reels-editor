import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { UI_FONT } from "./font";
import { PALETTE } from "./palette";
import { SAFE } from "./safe";

export type CaptionPage = { text: string; startMs: number; endMs: number };

const FONT_SIZE = 54;

// Padrão do canal: legenda simples, SEM animação, sem emoji, sem destaque de cor, centrada em x=540.
const Page: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill
    style={{
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: SAFE.bottom,
      paddingLeft: SAFE.side,
      paddingRight: SAFE.side,
    }}
  >
    <div
      style={{
        fontFamily: UI_FONT,
        fontWeight: 800,
        fontSize: FONT_SIZE,
        lineHeight: 1.18,
        textAlign: "center",
        color: "white",
        WebkitTextStroke: `${Math.round(FONT_SIZE * 0.17)}px ${PALETTE.black}`,
        paintOrder: "stroke fill",
        textShadow: "0 4px 14px rgba(4,4,4,0.5)",
        textWrap: "balance",
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);

export const Captions: React.FC<{ pages: CaptionPage[] }> = ({ pages }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps);
        const to = Math.max(from + 4, Math.round((p.endMs / 1000) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none" name={p.text}>
            <Page text={p.text} />
          </Sequence>
        );
      })}
    </>
  );
};
