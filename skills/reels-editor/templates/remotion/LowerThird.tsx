import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { UI_FONT } from "./font";
import { PALETTE } from "./palette";
import { SAFE } from "./safe";

export const LowerThird: React.FC<{ handle: string; durationInFrames: number }> = ({
  handle,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 150 }, durationInFrames: 14 });
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
          translate: `${(1 - enter) * -800 - exit * 800}px 0px`,
          opacity: 1 - exit,
          display: "flex",
          alignItems: "stretch",
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 16px 44px rgba(4,4,4,0.55)",
        }}
      >
        <div style={{ width: 16, background: PALETTE.turquoise }} />
        <div
          style={{
            padding: "20px 34px 22px 28px",
            background: `linear-gradient(100deg, ${PALETTE.hanPurple}, ${PALETTE.violet})`,
            fontFamily: UI_FONT,
            fontWeight: 800,
            fontSize: 58,
            lineHeight: 1.1,
            color: "white",
            WebkitTextStroke: `9px ${PALETTE.black}`,
            paintOrder: "stroke fill",
            letterSpacing: 0.5,
          }}
        >
          {handle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
