#!/usr/bin/env python3
"""試作30秒の音声(BGM・環境音・効果音)を合成して audio/mix.wav を出力する。
セリフ音声は含まない(TTS未導入のため字幕のみ)。タイミングは src/main.js のタイムラインと一致させている。"""
import numpy as np, wave, json, os
SR = 44100; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR

def env_ad(n, a=0.005, d=0.3):
    x = np.arange(n) / SR
    return np.minimum(x / a, 1) * np.exp(-x / d)

def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sig)); buf[i:j] += sig[: j - i] * gain

def lowpass(x, fc):  # 1次IIR(簡易)
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for k in range(len(x)): s = (1 - a) * x[k] + a * s; y[k] = s
    return y

def smooth_noise(fc, n=N):
    return lowpass(rng.standard_normal(n), fc)

def sm(a, b, x): u = np.clip((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)

events = []  # 管理データ出力用
def log(kind, at, note): events.append({"t": round(float(at), 3), "type": kind, "note": note})

# ---------- 環境音: 波 ----------
n1 = smooth_noise(600); n1 /= np.abs(n1).max()
swell = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + 1.0) * np.sin(2 * np.pi * 0.07 * t)
waves = n1 * swell * 0.55
waves += smooth_noise(3500) * 0.05 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t))   # 泡のシュワ
log("ambience", 0, "波・港の環境音(全編)")

# ---------- カモメ ----------
gull = np.zeros(N)
def gull_call(at, f0=1700, dur=0.55):
    n = int(dur * SR); x = np.arange(n) / SR
    f = f0 * (1 + 0.35 * np.sin(np.pi * np.minimum(x / dur, 1))) + 40 * np.sin(2 * np.pi * 28 * x)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.sin(np.pi * x / dur) ** 0.7
    place(gull, s, at, 0.10); log("sfx", at, "カモメの鳴き声")
for a in [0.9, 1.7, 3.1, 7.6, 10.4, 13.6, 18.9, 21.7, 24.9, 27.6]: gull_call(a, 1550 + 120 * (hash(str(a)) % 5), 0.45 + 0.1 * (a % 2))

# ---------- 足音(入場・船へ歩く) ----------
foot = np.zeros(N)
def step(at, g=1.0):
    n = int(0.12 * SR); x = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 110 * x) * np.exp(-x / 0.025) + smooth_noise(1800, n) * np.exp(-x / 0.02) * 1.5) * g
    place(foot, s, at, 0.45)
for k in range(11): step(0.75 + k * 0.29 * (1 + 0.04 * k), 1.0 - 0.05 * k)
for k in range(10): step(12.5 + k * 0.29, 0.9)
log("sfx", 0.75, "木製の岸壁の足音(入場)"); log("sfx", 12.5, "足音(船へ)")

# ---------- ジャンプ・着地・水音 ----------
fx = np.zeros(N)
def boing(at):
    n = int(0.35 * SR); x = np.arange(n) / SR; f = 300 + 500 * x / 0.35
    place(fx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12), at, 0.25)
boing(4.35); boing(15.85); log("sfx", 4.35, "ぴょん(小ジャンプ)"); log("sfx", 15.85, "ぴょん(船へジャンプ)")
n = int(0.5 * SR); x = np.arange(n) / SR
place(fx, (np.sin(2 * np.pi * 70 * x) * np.exp(-x / 0.09) * 1.4 + smooth_noise(900, n) * np.exp(-x / 0.12) * 1.2), 16.72, 0.5); log("sfx", 16.72, "着地(ドスン)+船が揺れる音")
place(fx, smooth_noise(2500, int(0.9 * SR)) * np.exp(-np.arange(int(0.9 * SR)) / SR / 0.3), 16.74, 0.2)

# ---------- ワイプ(場面転換) ----------
whoosh = np.zeros(N); i0, i1 = int(19.35 * SR), int(20.65 * SR); m = i1 - i0
xs = np.linspace(0, 1, m); w = smooth_noise(1, m) * 0 + rng.standard_normal(m)
fc = 300 + 5000 * np.sin(np.pi * xs) ** 2
# 時変フィルタ(ブロック処理)
out = np.zeros(m); blk = 512
for b in range(0, m, blk):
    out[b:b + blk] = lowpass(w[b:b + blk], float(fc[min(b, m - 1)]))
whoosh[i0:i1] = out * np.sin(np.pi * xs) ** 1.5 * 0.9; log("sfx", 19.35, "シーン転換のシュッ(アイリスワイプ)")

# ---------- エンジン・水しぶき ----------
speed = np.clip((t - 18.2) * 0.8, 0, 3.3)
start = sm(17.9, 18.6, t)
f0 = 38 + 10 * speed / 3.3
ph = 2 * np.pi * np.cumsum(f0) / SR
chug = 0.65 + 0.35 * np.sin(2 * np.pi * (4.0 + 3.0 * speed / 3.3) * t) ** 2
engine = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph) + 0.12 * np.sign(np.sin(ph * 0.5)) ) * chug * (0.25 + 0.75 * start) * 0.35
engine += smooth_noise(200) * 0.4 * start
engine *= np.where(t > 17.9, 1, 0)
log("sfx", 17.9, "エンジン始動→航行(ドドド)")
spray = smooth_noise(4500) * 1.8 * (speed / 3.3) ** 1.2 * 0.5 * np.where(t > 18.5, 1, 0)
spray *= (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * t))
log("sfx", 18.5, "水しぶき・航跡のシュワー(速度に連動)")

# ---------- BGM(ウクレレ風プラック+ベース+マリンバ+シェイカー) ----------
bgm = np.zeros(N); BPM = 112; beat = 60 / BPM
NOTE = {'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.0, 'A': 440.0, 'B': 493.88}
def hz(name, octv=0): return NOTE[name[0]] * (2 ** octv)
def pluck(f, dur=0.6, bright=3):
    n = int(dur * SR); x = np.arange(n) / SR
    s = sum((1 / (k ** 1.3)) * np.sin(2 * np.pi * f * k * x) * np.exp(-x / (0.35 / k ** 0.6)) for k in range(1, bright + 3))
    return s * np.minimum(x / 0.004, 1)
def marimba(f, dur=0.5):
    n = int(dur * SR); x = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * x) * np.exp(-x / 0.22) + 0.35 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x / 0.05)) * np.minimum(x / 0.003, 1)
def pad(f, dur):
    n = int(dur * SR); x = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * f * 2.003 * x)) * np.minimum(x / 0.6, 1) * np.minimum((dur - x) / 0.6, 1)
chords = [('C', ['C', 'E', 'G']), ('G', ['B', 'D', 'G']), ('A', ['A', 'C', 'E']), ('F', ['A', 'C', 'F'])]
bar = beat * 4; nb = int(DUR / bar) + 1
for b in range(nb):
    t0 = b * bar; root, tri = chords[b % 4]
    # パッド(全編)
    for nn in tri: place(bgm, pad(hz(nn), bar + 0.4), t0, 0.035)
    if t0 >= 3.5:  # リズムが入る
        for k in range(8):                               # ウクレレ ストラム(8分)
            at = t0 + k * beat / 2
            if k % 2 == 0 or k in (3, 7):
                for q, nn in enumerate(tri): place(bgm, pluck(hz(nn, 1), 0.35, 2), at + q * 0.012, 0.045 if k % 2 == 0 else 0.03)
        for k in (0, 2): place(bgm, pluck(hz(root, -1), 0.5, 1), t0 + k * beat, 0.22)       # ベース
        for k in range(8):                               # シェイカー
            n = int(0.05 * SR); place(bgm, rng.standard_normal(n) * np.exp(-np.arange(n) / SR / 0.012), t0 + k * beat / 2, 0.035 if k % 2 else 0.05)
    # メロディ(マリンバ): ペンタトニックの明るいフレーズ
    mel = [['E', 'G', 'A', 'G'], ['D', 'E', 'G', 'E'], ['C', 'E', 'A', 'G'], ['A', 'G', 'E', 'D']][b % 4]
    if t0 >= 1.0:
        for k, nn in enumerate(mel):
            place(bgm, marimba(hz(nn, 1 if b % 2 == 0 else 2)), t0 + k * beat + (beat / 2 if k % 2 else 0), 0.12 if t0 >= 3.5 else 0.08)
log("bgm", 0, "ウクレレ+マリンバの明るいBGM(112BPM, C-G-Am-F)。0-3.5秒はパッド+マリンバのみ、3.5秒でリズムイン")

# ---------- ミックス ----------
mix = waves * 0.9 + gull + foot + fx + whoosh * 0.55 + engine * 0.9 + spray * 0.55 + bgm * 1.0
# 全体フェード
mix *= np.minimum(t / 0.6, 1) * np.minimum((DUR - t) / 0.7, 1)
# ソフトリミッタ
mix = np.tanh(mix * 0.9) / np.tanh(0.9) * 0.85
pk = np.abs(mix).max(); mix = mix / max(pk, 1e-9) * 0.89
pcm = (mix * 32767).astype(np.int16)
here = os.path.dirname(os.path.abspath(__file__))
with wave.open(os.path.join(here, 'mix.wav'), 'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
json.dump({"duration": DUR, "sample_rate": SR, "voice": "なし(字幕のみ)", "events": sorted(events, key=lambda e: e["t"])}, open(os.path.join(here, 'audio_manifest.json'), 'w'), ensure_ascii=False, indent=1)
print("ok", DUR, "s, peak", pk)
