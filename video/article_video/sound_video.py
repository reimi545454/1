#!/usr/bin/env python3
"""記事引用動画(30秒)の効果音を合成して SE版を作る。ノイズ系のスウッシュは使わない。"""
import subprocess, wave
from pathlib import Path
base = Path(__file__).resolve().parent.parent
src = (base / "src" / "sound.py").read_text()
head = src.split("mix = np.zeros(N)")[0].replace("SR, DUR = 44100, 35.0", "SR, DUR = 44100, 30.0")
g = {"__file__": str(base / "src" / "sound.py")}
exec(compile(head, "sound_head", "exec"), g)
np, put, tick, bell, N, SR, DUR, OUT = (g[k] for k in ["np", "put", "tick", "bell", "N", "SR", "DUR", "OUT"])
mix = np.zeros(N)
for i in range(6): put(mix, tick(880 + 70 * i, 0.12), 2.05 + i * 0.4, 0.22)      # S1 最上位モデルへ入る
for i in range(8): put(mix, tick(760 + 40 * (i % 3), 0.12), 6.6 + i * 0.4, 0.16)  # S2 振り分け
put(mix, bell(783.99, 1.2), 9.4, 0.16)                                              # Astra レーン強調
for t0 in (12.9, 13.9, 14.9): put(mix, tick(1000, 0.12), t0, 0.2)                  # S3 依頼メモの各欄
for i, t0 in enumerate((16.8, 17.15, 17.5)): put(mix, tick(1100 + 100 * i, 0.12), t0, 0.2)
put(mix, bell(987.8, 1.0), 18.0, 0.12)
for t0 in (19.9, 20.5, 21.1, 21.7): put(mix, tick(900, 0.1), t0 + 0.1, 0.14)      # S4 工程が進む
put(mix, tick(700, 0.1), 22.8, 0.3)                                                 # 人が確認(クリック)
put(mix, bell(659.3, 1.4), 23.7, 0.18)
put(mix, tick(1000, 0.12), 25.1, 0.16)                                              # S5
for i in range(4): put(mix, tick(900 + 80 * i, 0.1), 25.8 + i * 0.25, 0.14)
put(mix, bell(659.3, 1.6), 28.3, 0.2); put(mix, bell(987.8, 1.4), 28.55, 0.16)      # S6 まとめ
mix *= np.minimum(1, (DUR - np.arange(N) / SR) / 0.8)
mix = mix / np.max(np.abs(mix)) * 0.98
wav = OUT / "POST_astra_SE.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
a = OUT / "POST_astra_quote_1920x1080_30s_silent.mp4"
b = OUT / "POST_astra_quote_1920x1080_30s_SE.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(a), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-t", "30",
                "-movflags", "+faststart", str(b)], check=True)
wav.unlink()
print(b)
