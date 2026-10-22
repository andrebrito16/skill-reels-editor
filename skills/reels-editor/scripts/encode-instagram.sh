#!/usr/bin/env bash
# Codificação final para Instagram Reels: H.264 High, VBR 2 passes, GOP fechado, AAC 48 kHz, -14 LUFS.
# Uso: encode-instagram.sh <entrada.mp4> <saida.mp4>
set -euo pipefail
IN="$1"; OUT="$2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# loudnorm em 2 passos (áudio)
ffmpeg -hide_banner -i "$IN" -vn -af loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' > "$TMP/ln.json"
LN=$(node -e 'const j=require(process.argv[1]);console.log(`loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.84:level=disabled`)' "$TMP/ln.json")

VIDEO=(-c:v libx264 -preset slow -profile:v high -level:v 4.2 -pix_fmt yuv420p
  -b:v 12M -maxrate 16M -bufsize 24M
  -x264-params "keyint=60:min-keyint=60:scenecut=0:open-gop=0:bframes=2:ref=4:aq-mode=2"
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -r 30)

ffmpeg -y -hide_banner -loglevel error -i "$IN" "${VIDEO[@]}" -pass 1 -passlogfile "$TMP/pass" -an -f mp4 /dev/null
echo "passo 1 ok"
ffmpeg -y -hide_banner -loglevel error -i "$IN" "${VIDEO[@]}" -pass 2 -passlogfile "$TMP/pass" \
  -af "$LN" -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart "$OUT"
echo "passo 2 ok"
