#!/usr/bin/env bash
# reels-editor skill installer / requirements checker (works with macOS bash 3.2+ and Linux bash)
#
#   ./install.sh                      install for your user (~/.claude/skills/reels-editor)
#   ./install.sh --project [DIR]      install into a project (DIR/.claude/skills/reels-editor, default DIR=.)
#   ./install.sh --link               symlink instead of copy (handy to hack on the skill / keep it updated with git pull)
#   ./install.sh --check              only check requirements, don't install
#   ./install.sh --uninstall          remove the installed skill (use with --project DIR if you installed there)
#   ./install.sh --force              install even if required tools are missing
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/skills/reels-editor"
NAME="reels-editor"
MODE="global"; PROJECT_DIR="."; LINK=0; CHECK_ONLY=0; UNINSTALL=0; FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) MODE="project"; if [ $# -gt 1 ] && [ "${2#--}" = "$2" ]; then PROJECT_DIR="$2"; shift; fi ;;
    --link) LINK=1 ;;
    --check) CHECK_ONLY=1 ;;
    --uninstall) UNINSTALL=1 ;;
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

if [ "$MODE" = "project" ] && [ ! -d "$PROJECT_DIR" ]; then echo "project folder not found: $PROJECT_DIR (create it or pass an existing Remotion project)" >&2; exit 2; fi
if [ "$MODE" = "project" ]; then DEST_ROOT="$(cd "$PROJECT_DIR" && pwd)/.claude/skills"; else DEST_ROOT="${CLAUDE_HOME:-$HOME/.claude}/skills"; fi
DEST="$DEST_ROOT/$NAME"

ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$*"; }
MISSING_REQUIRED=0

check_requirements() {
  echo "Checking requirements…"
  # Node
  if command -v node >/dev/null 2>&1; then
    v="$(node -v | sed 's/^v//')"; major="${v%%.*}"; rest="${v#*.}"; minor="${rest%%.*}"
    if { [ "$major" -eq 20 ] && [ "$minor" -ge 19 ]; } || { [ "$major" -eq 22 ] && [ "$minor" -ge 13 ]; } || [ "$major" -ge 24 ]; then ok "node v$v"; else bad "node v$v (need ^20.19, ^22.13 or >=24 — Remotion 4.0.x requirement)"; MISSING_REQUIRED=1; fi
  else bad "node not found (https://nodejs.org)"; MISSING_REQUIRED=1; fi
  # ffmpeg / ffprobe
  if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')"
    missing=""
    # capture once: grep -q on a live pipe + pipefail gives false "missing" (SIGPIPE)
    FILTERS="$(ffmpeg -hide_banner -filters 2>/dev/null || true)"
    ENCODERS="$(ffmpeg -hide_banner -encoders 2>/dev/null || true)"
    for f in lut3d loudnorm alimiter acompressor asoftclip acrusher aecho highshelf equalizer silencedetect alphamerge curves gblur; do
      case "$FILTERS" in *" $f "*) ;; *) missing="$missing $f" ;; esac
    done
    case "$ENCODERS" in *libx264*) ;; *) missing="$missing libx264" ;; esac
    case "$ENCODERS" in *" aac "*) ;; *) missing="$missing aac" ;; esac
    if [ -z "$missing" ]; then ok "ffmpeg has every filter/encoder the scripts use"; else bad "ffmpeg is missing:$missing (install a full build, e.g. 'brew install ffmpeg' or a static build with libx264)"; MISSING_REQUIRED=1; fi
  else bad "ffmpeg/ffprobe not found (brew install ffmpeg | apt install ffmpeg | https://ffmpeg.org)"; MISSING_REQUIRED=1; fi
  # Swift (rotoscopy)
  if [ "$(uname -s)" = "Darwin" ]; then
    if command -v swift >/dev/null 2>&1; then ok "swift (Vision rotoscopy available)"; else warn "swift not found — run 'xcode-select --install' to enable rotoscopy (optional)"; fi
  else warn "not macOS: scripts/roto.sh (Apple Vision) won't run; produce PNG-with-alpha frames with another tool (see docs/GUIDE.md)"; fi
  # package manager + git
  if command -v bun >/dev/null 2>&1; then ok "bun $(bun -v)"; elif command -v npm >/dev/null 2>&1; then ok "npm $(npm -v)"; else warn "no bun/npm found (needed to run Remotion)"; fi
  command -v git >/dev/null 2>&1 && ok "git" || warn "git not found (optional)"
  # build tools for whisper.cpp
  if command -v make >/dev/null 2>&1 && { command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1; }; then ok "C toolchain (builds whisper.cpp on first transcription)"; else warn "make/cc not found — Whisper.cpp is compiled the first time you transcribe"; fi
  # project hints
  if [ "$MODE" = "project" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    for p in remotion @remotion/cli @remotion/media @remotion/google-fonts @remotion/install-whisper-cpp @remotion/captions; do
      if grep -q "\"$p\"" "$PROJECT_DIR/package.json"; then ok "project depends on $p"; else warn "project does not list $p — run: npx remotion add $p"; fi
    done
  elif [ "$MODE" = "project" ]; then warn "no package.json in $PROJECT_DIR — is this a Remotion project? (npx create-video@latest)"; fi
  echo
}

if [ "$UNINSTALL" -eq 1 ]; then
  if [ -e "$DEST" ] || [ -L "$DEST" ]; then rm -rf "$DEST"; echo "Removed $DEST"; else echo "Nothing to remove at $DEST"; fi
  exit 0
fi

[ -d "$SRC" ] || { echo "skill folder not found at $SRC — run this script from a clone of the repo" >&2; exit 1; }
check_requirements
if [ "$CHECK_ONLY" -eq 1 ]; then [ "$MISSING_REQUIRED" -eq 0 ] && echo "All required tools found." || echo "Some required tools are missing."; exit "$MISSING_REQUIRED"; fi
if [ "$MISSING_REQUIRED" -ne 0 ] && [ "$FORCE" -ne 1 ]; then echo "Fix the ✘ items above (or re-run with --force)." >&2; exit 1; fi

mkdir -p "$DEST_ROOT"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then rm -rf "$DEST"; fi
if [ "$LINK" -eq 1 ]; then ln -s "$SRC" "$DEST"; echo "Linked   $DEST -> $SRC"; else cp -R "$SRC" "$DEST"; echo "Installed $DEST"; fi
chmod +x "$DEST"/scripts/*.sh 2>/dev/null || true

cat <<MSG

Done. Open Claude Code in your reel project and try:
  /reels-editor            (or just: "edit this reel with the reels-editor skill")
Docs: README.md · docs/GUIDE.md · docs/GUIA.pt-BR.md
MSG
