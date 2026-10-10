#!/usr/bin/env python3
"""ART-015 セキュリティ記事紹介 X用動画 レンダラ (Pillow + FFmpeg)

使い方:
  python3 src/render.py            # assets/ の実素材で書き出し(欠けていればエラー終了)
  python3 src/render.py --preview-only   # シーン別プレビュー/サムネイルのみ
  python3 src/render.py --placeholder    # 素材欠落時のレイアウト検証用(出力名に _PLACEHOLDER を付与)
"""
import argparse, json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS, OUT = ROOT / "assets", ROOT / "output"
W, H, FPS, SEC = 1920, 1080, 30, 35
TOTAL = FPS * SEC  # 1050
MX, MY = 120, 100                       # 安全余白(左右/上下)
IVORY, ORANGE, INK = (252, 247, 236), (240, 124, 28), (51, 41, 33)
FONT_PATHS = [  # 日本語フォント(先頭から探索)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
]
SUB_PX = 60                              # 字幕サイズ(52〜64px)
LINE_H = 84
SUB_TOP = H - MY - LINE_H * 2            # 字幕ゾーン上端 = 812
IMG_BOX = (MX, MY, W - MX, SUB_TOP - 24) # 画像表示領域 (120,100)-(1800,788)
FADE = 0.5                               # 秒

# (開始秒, 終了秒, 画像キー, 字幕行)
SCENES = [
    (0, 5, ["cover"], ["AIでアプリは作れた。", "でも、仕事で使って大丈夫？"]),
    (5, 11, ["body1"], ["社内データ、どこまで渡す？"]),
    (11, 17, ["body2"], ["誰が見られる？", "AIはどこまで操作できる？"]),
    (17, 23, ["body3"], ["テストと、止め方まで確認。"]),
    (23, 29, ["body1", "body2", "body3"], ["Claude・ChatGPTで作る人へ", "確認したい7項目を記事に。"]),
    (29, 35, ["banner"], ["実務への導入で迷っている方は", "COACH AIへご相談ください"]),
]
FILES = {"cover": "cover.png", "body1": "body1.png", "body2": "body2.png",
         "body3": "body3.png", "banner": "coach_ai_banner.png"}
PH_SIZE = {"cover": (2000, 800), "body1": (1600, 900), "body2": (1600, 900),
           "body3": (1600, 900), "banner": (1600, 600)}


def font():
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, SUB_PX), p
    sys.exit("日本語フォントが見つかりません (FONT_PATHS を編集してください)")


def load_images(placeholder):
    imgs, missing = {}, []
    for k, f in FILES.items():
        p = ASSETS / f
        if p.exists():
            imgs[k] = Image.open(p).convert("RGB")
        else:
            missing.append(f)
    if missing:
        if not placeholder:
            sys.exit("素材が見つかりません: " + ", ".join(missing) +
                     f"\n{ASSETS} に配置してください。(検証のみなら --placeholder)")
        f0, _ = font()
        for k in FILES:
            if k not in imgs:  # レイアウト検証専用の無地枠。素材ではない。
                w, h = PH_SIZE[k]
                im = Image.new("RGB", (w, h), (225, 225, 225))
                d = ImageDraw.Draw(im)
                d.rectangle([0, 0, w - 1, h - 1], outline=(150, 150, 150), width=8)
                d.line([0, 0, w, h], fill=(190, 190, 190), width=6)
                d.line([0, h, w, 0], fill=(190, 190, 190), width=6)
                d.text((w // 2, h // 2), f"仮枠 {FILES[k]}", font=f0, fill=(90, 90, 90), anchor="mm")
                imgs[k] = im
    return imgs, missing


def fit(im, scale=1.0):
    bw, bh = IMG_BOX[2] - IMG_BOX[0], IMG_BOX[3] - IMG_BOX[1]
    s = min(bw / im.width, bh / im.height) * scale
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BICUBIC)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def draw_subtitle(canvas, lines, alpha, f):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    a = int(255 * alpha)
    y0 = SUB_TOP + (2 - len(lines)) * LINE_H // 2
    for i, ln in enumerate(lines):
        tw = d.textlength(ln, font=f)
        assert tw <= W - 2 * MX - 24, f"字幕が長すぎます: {ln} ({tw}px)"
        cy = y0 + i * LINE_H + LINE_H // 2
        d.text((W // 2, cy), ln, font=f, fill=INK + (a,), anchor="mm", stroke_width=1, stroke_fill=INK + (a,))
    # オレンジのアクセントライン(字幕ゾーン上)
    d.rounded_rectangle([W // 2 - 60, SUB_TOP - 12, W // 2 + 60, SUB_TOP - 6], 3, fill=ORANGE + (a,))
    canvas.alpha_composite(layer)


def frame(n, imgs, f):
    t = n / FPS
    si = next(i for i, s in enumerate(SCENES) if s[0] <= t < s[1])
    s0, s1, keys, lines = SCENES[si]
    local, dur = t - s0, s1 - s0
    # シーン端のフェード(最初/最後のシーンは端を固定)
    fa = ease(local / FADE) if si > 0 else 1.0
    fo = ease((dur - local) / FADE) if si < len(SCENES) - 1 else 1.0
    alpha = min(fa, fo)
    canvas = Image.new("RGBA", (W, H), IVORY + (255,))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, 14], fill=ORANGE)
    zoom = 1.0 + 0.04 * (local / dur)  # 軽いズーム 100%→104%

    if len(keys) == 1:
        weights = [(keys[0], 1.0)]
    else:  # 穏やかなクロスディゾルブ(各2秒、重なり0.8秒)
        seg, xf = dur / len(keys), 0.8
        weights = []
        for j, k in enumerate(keys):
            a = 1.0
            if j > 0:
                a = min(a, ease((local - (j * seg - xf / 2)) / xf))
            if j < len(keys) - 1:
                a = min(a, 1 - ease((local - ((j + 1) * seg - xf / 2)) / xf)) if local > j * seg else a
            weights.append((k, a))
        # 現在区間のみ描画し、直前の画像は次が不透明になるまで残す
        cur = min(int(local // seg), len(keys) - 1)
        weights = [(k, a) for j, (k, a) in enumerate(weights) if j in (cur, cur - 1) or j == cur + 1]
    bx0, by0, bx1, by1 = IMG_BOX
    for k, a in weights:
        if a <= 0:
            continue
        im = fit(imgs[k], zoom).convert("RGBA")
        im.putalpha(int(255 * a * alpha))
        # 影は付けず、中央配置
        canvas.alpha_composite(im, ((bx0 + bx1 - im.width) // 2, (by0 + by1 - im.height) // 2))
    draw_subtitle(canvas, lines, alpha, f)
    return canvas.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--placeholder", action="store_true")
    ap.add_argument("--preview-only", action="store_true")
    a = ap.parse_args()
    f, fpath = font()
    imgs, missing = load_images(a.placeholder)
    suffix = "_PLACEHOLDER" if missing else ""
    (OUT / "previews").mkdir(parents=True, exist_ok=True)
    mp4 = OUT / f"ART-015_security_X_1920x1080_35s{suffix}.mp4"

    for i, (s0, s1, _, _) in enumerate(SCENES, 1):
        frame(int((s0 + (s1 - s0) * 0.6) * FPS), imgs, f).save(OUT / "previews" / f"scene{i}{suffix}.png")
    frame(int(2.5 * FPS), imgs, f).save(OUT / f"ART-015_thumbnail{suffix}.png")
    # スマホ相当(幅360px)の確認用
    for i in range(1, len(SCENES) + 1):
        p = OUT / "previews" / f"scene{i}{suffix}.png"
        Image.open(p).resize((360, 203), Image.LANCZOS).save(OUT / "previews" / f"scene{i}_phone360{suffix}.png")
    if a.preview_only:
        return

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-r", str(FPS), "-frames:v", str(TOTAL),
           "-movflags", "+faststart", str(mp4)]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(TOTAL):
        pr.stdin.write(frame(n, imgs, f).tobytes())
    pr.stdin.close()
    if pr.wait() != 0:
        sys.exit("ffmpeg 失敗")
    print("OK", mp4, "font:", fpath, "missing:", missing)


if __name__ == "__main__":
    main()
