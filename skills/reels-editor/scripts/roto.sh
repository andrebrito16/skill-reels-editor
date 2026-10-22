#!/usr/bin/env bash
# Rotoscopia (recorte da pessoa) de um trecho do master: máscaras Vision -> PNGs RGBA quadro a quadro.
# Uso: roto.sh <master.mp4> <start_s> <dur_s> <outDir> [matteDir]
#   outDir recebe p_00000.png ... (numeração relativa ao START; use start=0 para alinhar com o frame do vídeo final)
#   REMERGE=1 roto.sh ...  -> NÃO roda o Vision de novo: reaproveita as máscaras em matteDir e só refaz o merge
#                              (use quando só a cor/grade do master mudou e o enquadramento/tempo é o mesmo)
# Requer macOS (Swift + Vision). Depois use <RotoFrame offset={frameInicial} /> no Remotion (templates/remotion).
set -euo pipefail
IN="$1"; START="$2"; DUR="$3"; OUT="$4"; WORK="${5:-$(dirname "$OUT")/matte}"
HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$OUT"; mkdir -p "$OUT"
if [ "${REMERGE:-0}" = "1" ]; then
  [ -d "$WORK" ] || { echo "REMERGE=1 mas não há máscaras em $WORK" >&2; exit 1; }
else
  rm -rf "$WORK"; mkdir -p "$WORK"
  swift "$HERE/roto.swift" "$IN" "$START" "$DUR" "$WORK" 2>&1 | tail -1
fi
# curva reforça o interior da máscara (microfone de lapela etc.) e blur suaviza a borda
ffmpeg -y -hide_banner -loglevel error -ss "$START" -t "$DUR" -i "$IN" -framerate 30 -i "$WORK/m_%05d.png" \
  -filter_complex "[1:v]format=gray,curves=all='0/0 0.15/0.45 0.45/1 1/1',gblur=sigma=1.3[a];[0:v]format=rgb24[v];[v][a]alphamerge" \
  -start_number 0 "$OUT/p_%05d.png"
echo "$(ls "$OUT" | wc -l) PNGs em $OUT (máscaras em $WORK)"
