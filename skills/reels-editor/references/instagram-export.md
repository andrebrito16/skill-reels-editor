# Export for Instagram (Reels)

`scripts/encode-instagram.sh <in.mp4> <out.mp4>`:

| Item | Value |
|---|---|
| Container | MP4, `+faststart` |
| Video | H.264 **High**, level 4.2, 1080×1920, **30 fps CFR**, yuv420p |
| Rate control | **VBR, 2 passes**, target **12 Mbps**, maxrate 16 Mbps, bufsize 24 Mbps, preset slow |
| GOP | closed (`open-gop=0`), keyint = min-keyint = 60 (2 s), `scenecut=0`, 2 B-frames, 4 refs |
| Colour | BT.709 primaries/transfer/matrix, limited (tv) range |
| Audio | AAC-LC, 48 kHz, stereo, 256 kbps, loudnorm −14 LUFS (two-pass, linear), true peak −1.5 dBFS (`alimiter 0.84`) |

12 Mbps / 16 Mbps peak are the creator's chosen numbers (Instagram re-encodes anyway; a high-quality master survives it better). Max Reel length 3 min; keep files < 4 GB.

## Steps
1. Intermediate from Remotion (near-lossless, **JPEG quality 100** — the project config sets `jpeg` frames and the default quality 80 softens text/roto edges):
   `npx remotion render src/index.ts <Id> out/intermediate.mp4 --codec=h264 --crf=10 --x264-preset=medium --jpeg-quality=100 --pixel-format=yuv420p --color-space=bt709 --audio-codec=aac --audio-bitrate=320k --concurrency=6`
2. `encode-instagram.sh out/intermediate.mp4 out/<name>-reels.mp4`
3. Verify: `ffprobe -show_entries stream=codec_name,profile,level,width,height,r_frame_rate,pix_fmt,color_space,bit_rate,sample_rate,channels` + `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` (I ≈ −14, Peak ≤ −1.5) + keyframes every 2 s (`ffprobe -select_streams v -show_entries packet=pts_time,flags -of csv=p=0 | awk -F, '$2 ~ /K/'`).
4. Delete `out/intermediate.mp4` (~450 MB) when done; keep preview if the user wants.

zsh pitfall: do not store ffmpeg options in a plain variable and expand it (`$V`) — zsh doesn't word-split; the script uses a bash array.
