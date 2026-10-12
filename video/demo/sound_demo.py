#!/usr/bin/env python3
"""デモ動画用の効果音(合成)。src/sound.py の合成関数を流用し、14秒版の音を作って合成する。"""
import subprocess, wave
from pathlib import Path
src = (Path(__file__).resolve().parent.parent / "src" / "sound.py").read_text()
head = src.split("mix = np.zeros(N)")[0].replace("SR, DUR = 44100, 35.0", "SR, DUR = 44100, 14.0")
g = {"__file__": str(Path(__file__).resolve().parent.parent / "src" / "sound.py")}
exec(compile(head, "sound_head", "exec"), g)
np, put, tick, whoosh, bell, N, SR, DUR, OUT = (g[k] for k in ["np", "put", "tick", "whoosh", "bell", "N", "SR", "DUR", "OUT"])
mix = np.zeros(N)
put(mix, whoosh(0.8), 2.5, 0.30)                      # レポートが縮んでカードに変わる
for i in range(5):
    put(mix, tick(1000 + 90 * i, 0.14), 3.2 + i * 0.12 + 0.55, 0.22)   # カードが着地
for t0, f in ((7.2, 900), (7.9, 980), (8.6, 1060)):
    put(mix, tick(f, 0.08), t0, 0.12)                 # ホバー
put(mix, tick(700, 0.1), 9.0, 0.30)                   # クリック
put(mix, whoosh(0.6), 9.0, 0.22)                      # カードが開く
for i in range(4):
    put(mix, tick(880 + 110 * i, 0.1), 11.2 + i * 0.35 + 0.3, 0.14)   # 操作チップ
put(mix, bell(783.99, 1.4), 12.75, 0.18)
put(mix, bell(1174.7, 1.2), 13.0, 0.14)
mix *= np.minimum(1, (DUR - np.arange(N) / SR) / 0.8)
mix = mix / np.max(np.abs(mix)) * 0.98
wav = OUT / "ART-015_demo_SE.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
a = OUT / "ART-015_demo_report_to_cards_1920x1080_14s_silent.mp4"
b = OUT / "ART-015_demo_report_to_cards_1920x1080_14s_SE.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(a), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-t", "14",
                "-movflags", "+faststart", str(b)], check=True)
print(b)
