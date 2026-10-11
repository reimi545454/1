#!/usr/bin/env python3
"""告知用サムネイル(1920x1080)。記事内画像+コード描画の文字・図形のみ。新規キャラ/ロゴ/漏えい画面は使わない。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageChops

ROOT = Path(__file__).resolve().parent.parent
W, H = 1920, 1080
ORANGE, RED, IVORY = (245, 124, 24), (214, 56, 38), (252, 247, 236)
FP = next(p for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
                      "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"] if Path(p).exists())
F = lambda s: ImageFont.truetype(FP, s)

# 背景: 暗いチャコール + 右下から迫る赤橙の光
bg = Image.new("RGB", (W, H), (26, 22, 21))
glow = Image.new("RGB", (W, H), (0, 0, 0))
ImageDraw.Draw(glow).ellipse([900, 200, 2300, 1400], fill=(150, 48, 22))
glow = glow.filter(ImageFilter.GaussianBlur(220))
bg = ImageChops.add(bg, glow)

# 右: 記事内画像(鍵と封筒)を暗めにして配置、左端をなじませる
im = Image.open(ROOT / "assets/body2.png").convert("RGB")
im = im.resize((int(im.width * 880 / im.height), 880), Image.LANCZOS)
im = ImageEnhance.Brightness(im).enhance(0.5)
mask = Image.new("L", im.size, 255)
md = ImageDraw.Draw(mask)
for x in range(im.width):
    a = min(1, x / 620) * min(1, (im.width - 1 - x) / 160)
    md.line([x, 0, x, im.height], fill=int(255 * a))
mask = ImageChops.multiply(mask, Image.linear_gradient("L").resize(im.size).point(lambda v: min(255, int(v * 3))).transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: v) if False else Image.new("L", im.size, 255))
fade = Image.new("L", im.size, 255)
fd = ImageDraw.Draw(fade)
for y in range(160):
    fd.line([0, y, im.width, y], fill=int(255 * y / 160))
    fd.line([0, im.height - 1 - y, im.width, im.height - 1 - y], fill=int(255 * y / 160))
mask = ImageChops.multiply(mask, fade)
bg.paste(im, (W - im.width - 40, 100 + 30), mask)

# 迫る感じ: 暗い周辺減光 + 斜めの警告ストライプ(上下)
vig = Image.new("L", (W, H), 0)
ImageDraw.Draw(vig).ellipse([-300, -300, W + 300, H + 300], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(200))
bg = Image.composite(bg, Image.new("RGB", (W, H), (8, 6, 6)), vig)
d = ImageDraw.Draw(bg)
for y0 in (0, H - 36):
    d.rectangle([0, y0, W, y0 + 36], fill=(30, 26, 25))
    for x in range(-60, W + 60, 72):
        d.polygon([(x, y0 + 36), (x + 36, y0), (x + 72, y0), (x + 36, y0 + 36)], fill=ORANGE)

# 文字(左寄せ、左右120px/上下100px内)
def text(xy, s, size, fill, stroke=2):
    d.text(xy, s, font=F(size), fill=fill, stroke_width=stroke, stroke_fill=fill)

# 警告三角(汎用図形)+ ラベル
tx, ty = 120, 140
d.polygon([(tx + 34, ty), (tx + 68, ty + 60), (tx, ty + 60)], fill=ORANGE)
d.text((tx + 34, ty + 38), "!", font=F(40), fill=(26, 22, 21), anchor="mm", stroke_width=2, stroke_fill=(26, 22, 21))
text((tx + 90, ty + 2), "仕事で使う前に、確認を", 48, ORANGE, 0)

text((120, 290), "AIで作ったアプリ、", 112, IVORY, 3)
text((120, 440), "そのまま", 112, IVORY, 3)
text((120, 590), "仕事で使って", 112, ORANGE, 3)
text((120, 740), "大丈夫？", 112, ORANGE, 3)

# バッジ
d.rounded_rectangle([120, 890, 700, 970], 16, fill=ORANGE)
d.text((410, 930), "確認したい7項目", font=F(50), fill=(26, 22, 21), anchor="mm", stroke_width=1, stroke_fill=(26, 22, 21))

out = ROOT / "output" / "ART-015_thumbnail_alert.png"
bg.save(out)
bg.resize((360, 203), Image.LANCZOS).save(ROOT / "output/previews/thumbnail_alert_phone360.png")
print(out)
