import React from "react";
import { AbsoluteFill, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { Captions, type CaptionPage } from "./Captions";
import { UI_FONT } from "./font";
import { PALETTE } from "./palette";
import { RotoFrame } from "./RotoFrame";
import { SAFE } from "./safe";

/**
 * Template de REACT REEL: o criador (reactor) reage a um vídeo de referência.
 *
 * Layouts (todos respeitam a safe area do Instagram):
 *  - "stack":  referência em cima (16:9 ou 9:16 "contain"), reactor embaixo (cover). Mais legível; bom p/ vídeos longos.
 *  - "pip":    referência em tela cheia (cover, fundo desfocado se for 16:9), reactor num retângulo arredondado no canto inferior esquerdo.
 *  - "cutout": referência em tela cheia + reactor recortado (rotoscopia, PNGs) na frente, embaixo. Mais "premium"; exige roto.
 *
 * Linha do tempo: o vídeo do reactor (master.mp4, já graduado, com áudio) corre o tempo todo.
 * `clips` define as JANELAS em que a referência aparece. Fora delas o reactor fica em tela cheia.
 * Áudio da referência: toca só dentro da janela, com volume `volume` (use ~0.35 quando o reactor fala por cima).
 * Crédito do criador original é obrigatório (`credit`), no topo, dentro da safe area.
 */
export type ClipWindow = {
  at: number; // segundo (vídeo final) em que a janela começa
  dur: number; // duração em segundos
  from: number; // segundo da referência em que começa a tocar
  volume?: number; // 0-1 (padrão 0.5)
  freeze?: boolean; // congela o quadro em `from` (pausa para comentar)
};

export type ReactReelProps = {
  layout: "stack" | "pip" | "cutout";
  reactorSrc: string; // ex.: "master.mp4"
  clipSrc: string; // ex.: "reference.mp4" (em public/)
  clipOrientation: "landscape" | "portrait";
  clips: ClipWindow[];
  credit?: string; // ex.: "@criador_original"
  captions: CaptionPage[];
  rotoWindows?: { at: number; dur: number }[]; // só para layout "cutout": janelas com PNGs em public/roto/
};

const f = (fps: number, s: number) => Math.round(s * fps);

const Credit: React.FC<{ handle: string }> = ({ handle }) => (
  <AbsoluteFill style={{ paddingTop: SAFE.top - 90, paddingLeft: SAFE.side, alignItems: "flex-start" }}>
    <div
      style={{
        fontFamily: UI_FONT,
        fontWeight: 800,
        fontSize: 34,
        color: "white",
        padding: "10px 22px",
        borderRadius: 18,
        background: `${PALETTE.black}cc`,
        borderLeft: `8px solid ${PALETTE.turquoise}`,
      }}
    >
      Original: {handle}
    </div>
  </AbsoluteFill>
);

const ClipPlayer: React.FC<{ w: ClipWindow; src: string; style: React.CSSProperties; fit: "cover" | "contain" }> = ({ w, src, style, fit }) => {
  const { fps } = useVideoConfig();
  const video = (
    <Video src={staticFile(src)} trimBefore={f(fps, w.from)} volume={w.freeze ? 0 : (w.volume ?? 0.5)} objectFit={fit} style={style} />
  );
  return w.freeze ? <Freeze frame={0}>{video}</Freeze> : video;
};

const Window: React.FC<{ w: ClipWindow; props: ReactReelProps }> = ({ w, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [f(fps, w.dur) - 6, f(fps, w.dur)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(enter, exit);
  const portrait = props.clipOrientation === "portrait";

  if (props.layout === "stack") {
    // referência ocupa de y=SAFE.top até ~1000; reactor continua embaixo (vídeo base já está lá)
    const h = portrait ? 760 : 608;
    const wpx = portrait ? Math.round((h * 9) / 16) : 1080 - 2 * SAFE.side + 100;
    return (
      <AbsoluteFill style={{ opacity: o }}>
        <AbsoluteFill style={{ backgroundColor: PALETTE.black, height: SAFE.top + h + 40 }} />
        <div style={{ position: "absolute", top: SAFE.top - 20, left: (1080 - wpx) / 2, width: wpx, height: h, borderRadius: 28, overflow: "hidden", border: `6px solid ${PALETTE.violet}`, boxShadow: "0 20px 60px rgba(4,4,4,0.6)" }}>
          <ClipPlayer w={w} src={props.clipSrc} fit="cover" style={{ width: "100%", height: "100%" }} />
        </div>
      </AbsoluteFill>
    );
  }
  // pip / cutout: referência em tela cheia
  return (
    <AbsoluteFill style={{ opacity: o, backgroundColor: PALETTE.black }}>
      {!portrait ? (
        <AbsoluteFill style={{ filter: "blur(40px) brightness(0.55)", scale: "1.2" }}>
          <ClipPlayer w={w} src={props.clipSrc} fit="cover" style={{ width: "100%", height: "100%" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ justifyContent: "center" }}>
        <ClipPlayer w={w} src={props.clipSrc} fit={portrait ? "cover" : "contain"} style={{ width: "100%", height: portrait ? "100%" : "auto" }} />
      </AbsoluteFill>
      {props.layout === "pip" ? (
        <div style={{ position: "absolute", left: SAFE.side, bottom: SAFE.bottom + 60, width: 380, height: 380, borderRadius: 36, overflow: "hidden", border: `6px solid ${PALETTE.turquoise}`, boxShadow: "0 18px 50px rgba(4,4,4,0.6)" }}>
          <Video src={staticFile(props.reactorSrc)} trimBefore={f(fps, w.at)} muted objectFit="cover" style={{ width: "100%", height: "100%", objectPosition: "50% 30%", scale: "1.9", transformOrigin: "50% 30%" }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const ReactReel: React.FC<ReactReelProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.black }}>
      {/* reactor: vídeo base com áudio (voz) o tempo todo */}
      <Video src={staticFile(props.reactorSrc)} objectFit="cover" style={{ width: "100%", height: "100%" }} />

      {/* janelas da referência (por cima do reactor; no "stack" só cobrem a parte de cima) */}
      {props.clips.map((w, i) => (
        <Sequence key={i} from={f(fps, w.at)} durationInFrames={f(fps, w.dur)} name={`Referência ${i + 1}${w.freeze ? " (congelada)" : ""}`}>
          <Window w={w} props={props} />
          {props.credit ? <Credit handle={props.credit} /> : null}
        </Sequence>
      ))}

      {/* cutout: reactor recortado na frente da referência */}
      {props.layout === "cutout"
        ? (props.rotoWindows ?? []).map((r, i) => (
            <Sequence key={i} from={f(fps, r.at)} durationInFrames={f(fps, r.dur)} name="Reactor recortado (roto)">
              <RotoFrame offset={f(fps, r.at)} />
            </Sequence>
          ))
        : null}

      <Captions pages={props.captions} />
    </AbsoluteFill>
  );
};
