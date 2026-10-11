#!/usr/bin/env python3
"""効果音をコードで合成(外部音源なし)し、無音版MP4に合成して SE版を出力する。
使い方: python3 src/sound.py   -> output/ART-015_security_X_1920x1080_35s_SE.mp4
控えめな設計: 緊張感のある低音(冒頭)、シーン切替のスウッシュ、字幕のやわらかいティック、終盤のチャイム。
"""
import subprocess, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output"
SR, DUR = 44100, 35.0
N = int(SR * DUR)
rng = np.random.default_rng(15)  # 再現性のため固定


def tt(d):
    return np.arange(int(SR * d)) / SR


def env(d, a=0.005, r=0.1):
    n = int(SR * d)
    e = np.ones(n)
    na, nr = max(1, int(SR * a)), max(1, int(SR * r))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return e


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s
        y[i] = s
    return y


def put(buf, x, t0, gain=1.0):
    i = int(t0 * SR)
    j = min(N, i + len(x))
    if i < N:
        buf[i:j] += x[: j - i] * gain


def drone(d):  # 冒頭の低い緊張音(ゆっくり膨らむ)
    t = tt(d)
    x = 0.6 * np.sin(2 * np.pi * 55 * t) + 0.35 * np.sin(2 * np.pi * 82.5 * t + 0.4) + 0.2 * np.sin(2 * np.pi * 110.7 * t)
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * 1.6 * t)  # ゆるい脈動
    sw = np.minimum(t / (d * 0.8), 1) ** 1.5
    return x * sw * env(d, 0.4, 0.9)


def whoosh(d=0.7):  # 切替: ノイズの上昇スウィープ
    n = rng.standard_normal(int(SR * d))
    out = np.zeros_like(n)
    for k, fc in enumerate([500, 1200, 2800]):
        seg = lowpass(n, fc) - lowpass(n, fc * 0.4)
        w = np.exp(-((np.linspace(0, 1, len(n)) - (0.45 + 0.2 * k)) ** 2) / 0.05)
        out += seg * w
    return out / np.max(np.abs(out)) * env(d, 0.25, 0.25)


def tick(f=1180, d=0.12):  # 字幕: やわらかい短い音
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 38) * env(d, 0.002, 0.05)


def bell(f, d=1.6):  # チャイム
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * dec)
            for m, a, dec in [(1, 1, 2.2), (2.01, 0.4, 3.5), (3.02, 0.2, 5.0)])
    return x * env(d, 0.003, 0.3)


mix = np.zeros(N)
put(mix, drone(5.0), 0.0, 0.34)
for t0 in (5, 11, 17, 23, 29):
    put(mix, whoosh(), t0 - 0.35, 0.30)      # 切替の直前から
for t0 in (0.8, 5.6, 11.6, 17.6, 23.6, 29.6):
    put(mix, tick(), t0, 0.22)               # 字幕の出現
for t0 in (25.0, 27.0):
    put(mix, tick(980), t0 - 0.05, 0.16)     # 23-29秒の画像切替
put(mix, bell(659.3), 29.9, 0.20)            # 終盤のやわらかいチャイム(E5→B5)
put(mix, bell(987.8), 30.15, 0.17)
mix *= np.minimum(1, (DUR - np.arange(N) / SR) / 1.0)  # 最後の1秒でフェードアウト
mix = mix / np.max(np.abs(mix)) * 0.98                 # 音量目安 約 -16.5 LUFS
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
wav = OUT / "ART-015_SE.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

src = OUT / "ART-015_security_X_1920x1080_35s.mp4"
dst = OUT / "ART-015_security_X_1920x1080_35s_SE.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
                "-t", "35", "-movflags", "+faststart", str(dst)], check=True)
print(dst)
