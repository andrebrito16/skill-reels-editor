import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { UI_FONT } from "./font";
import { PALETTE } from "./palette";
import { SAFE } from "./safe";

// Plugue P10 em "L" (angulado)
const LPlug: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <path d="M14 8v34a8 8 0 0 0 8 8h22" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="44" y="40" width="14" height="20" rx="3" fill={PALETTE.orange} />
    <path d="M14 8v34a8 8 0 0 0 8 8h22" stroke={PALETTE.black} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
  </svg>
);

// Faixa de correção: entra por cima da fala, sem cortar o vídeo.
export const Correction: React.FC<{ label: string; text: string; durationInFrames: number }> = ({
  label,
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 170 }, durationInFrames: 12 });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: SAFE.top,
        paddingLeft: SAFE.side,
        paddingRight: SAFE.side,
      }}
    >
      <div
        style={{
          opacity: Math.min(enter, 1 - exit),
          scale: String(0.9 + 0.1 * enter),
          translate: `0px ${(1 - enter) * -30 - exit * 20}px`,
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "18px 34px 20px 26px",
          borderRadius: 26,
          background: `${PALETTE.black}e6`,
          border: `4px solid ${PALETTE.orange}`,
          boxShadow: "0 16px 44px rgba(4,4,4,0.55)",
        }}
      >
        <LPlug size={78} />
        <div style={{ fontFamily: UI_FONT, fontWeight: 800, lineHeight: 1.08 }}>
          <div style={{ fontSize: 30, letterSpacing: 3, color: PALETTE.orange }}>{label}</div>
          <div
            style={{
              fontSize: 56,
              color: "white",
              WebkitTextStroke: `8px ${PALETTE.black}`,
              paintOrder: "stroke fill",
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
