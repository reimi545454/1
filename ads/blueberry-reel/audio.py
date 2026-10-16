#!/usr/bin/env python3
"""構成JSONからBGM＋効果音(WAV)を合成する。外部素材を使わないので著作権上の懸念がない。

使い方: python3 -I audio.py variants/xxx.json out.wav
BGM: 120BPM のコード進行(C-G-Am-F)にマリンバ風アルペジオ＋軽いキック/ハット。
SE : シーン切替のスウッシュ、CTAのタップ音、最終シーンの到達チャイム。
"""
import json
import sys
import wave

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM


def note_freq(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def pluck(freq, dur, amp=0.25, decay=6.0):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-decay * t) * np.minimum(1, t / 0.004)
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-12 * t)
    return amp * env * tone


def mix_in(buf, sig, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def bell(freq, dur, amp=0.3):
    """澄んだ鐘の音（サイン波＋倍音の減衰）。ノイズ成分なし。"""
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / 0.003) * np.exp(-3.2 * t)
    tone = (np.sin(2 * np.pi * freq * t)
            + 0.30 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-5 * t)
            + 0.12 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-9 * t))
    return amp * env * tone


def kick(amp=0.5):
    t = np.arange(int(SR * 0.25)) / SR
    f = 120 * np.exp(-18 * t) + 45
    return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-9 * t)


def hat(rng, amp=0.07):
    t = np.arange(int(SR * 0.05)) / SR
    return amp * rng.standard_normal(len(t)) * np.exp(-70 * t)


def whoosh(rng, dur=0.5, amp=0.16):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 周波数が上がるバンドパス風：移動平均の窓を縮める
    out = np.zeros(n)
    for k, w in enumerate([400, 200, 100, 50, 25]):
        seg = np.convolve(noise, np.ones(w) / w, mode='same')
        out += seg * np.sin(np.pi * np.clip((t / dur) * (1 + k * 0.1), 0, 1)) ** 2
    out /= np.max(np.abs(out)) + 1e-9
    return amp * out


def main():
    cfg = json.load(open(sys.argv[1], encoding='utf-8'))
    dur = float(cfg['duration'])
    n = int(SR * (dur + 0.5))
    rng = np.random.default_rng(7)  # 毎回同じ音になるよう固定
    buf = np.zeros(n)

    chords = [(48, [60, 64, 67, 72]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65])]
    bars = int(dur / (BEAT * 4)) + 2
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * BEAT * 4
        mix_in(buf, pluck(note_freq(root - 12), BEAT * 3.5, 0.28, 2.2), t0)
        for step in range(8):
            tone = tones[[0, 1, 2, 3, 2, 1, 2, 1][step]]
            mix_in(buf, pluck(note_freq(tone + 12), BEAT, 0.16, 7), t0 + step * BEAT / 2)
        for beat in (0, 2):  # やわらかいキックだけ（ノイズ成分のハットは使わない）
            mix_in(buf, kick(0.22), t0 + beat * BEAT)

    # 効果音は最後の「ピロン」だけ。切り替え音・クリック音は入れない
    last = cfg['scenes'][-1]
    buf *= 0.55  # BGMを控えめにして、ピロンが聞き取れるようにする
    chime_at = last['start'] + 0.45
    for k, (m, amp) in enumerate([(88, 0.34), (95, 0.30)]):  # E6 → B6
        mix_in(buf, bell(note_freq(m), 1.6, amp), chime_at + k * 0.16)

    buf = buf[: int(SR * dur)]
    fade = int(SR * 0.6)
    buf[-fade:] *= np.linspace(1, 0, fade)
    buf *= 0.9 / (np.max(np.abs(buf)) + 1e-9)
    pcm = (buf * 32767).astype('<i2')
    stereo = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


if __name__ == '__main__':
    main()
