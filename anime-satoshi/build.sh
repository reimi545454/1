#!/usr/bin/env bash
# 試作30秒の一括ビルド: 音声合成 → フレーム描画(再開可能) → MP4出力
# 使い方: ./build.sh [並列数=3]
set -euo pipefail
cd "$(dirname "$0")"
WORKERS="${1:-3}"; FPS=30; FRAMES=900
python3 audio/make_audio.py
node render.js 0 "$FRAMES" frames "$WORKERS" "$FPS"
test "$(ls frames/*.png | wc -l)" -eq "$FRAMES" || { echo "フレーム数不足"; exit 1; }
mkdir -p out
ffmpeg -y -loglevel error -framerate "$FPS" -i frames/%05d.png -i audio/mix.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -ac 2 -shortest out/satoshi_ep1_trial_30s.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of default=nw=1 out/satoshi_ep1_trial_30s.mp4
