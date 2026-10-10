#!/usr/bin/env python3
"""実ファイルの尺・解像度・容量などを ffprobe で確認し output/VERIFY_REPORT.md に出力"""
import json, subprocess, sys
from pathlib import Path
mp4 = Path(sys.argv[1])
j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(mp4)]))
v = next(s for s in j["streams"] if s["codec_type"] == "video")
audio = [s for s in j["streams"] if s["codec_type"] == "audio"]
size = mp4.stat().st_size
head = mp4.read_bytes()[:65536]
faststart = head.find(b"moov") != -1 and (head.find(b"mdat") == -1 or head.find(b"moov") < head.find(b"mdat"))
rows = [
 ("解像度", f'{v["width"]}x{v["height"]}', "1920x1080"),
 ("コーデック", v["codec_name"], "h264"),
 ("pix_fmt", v["pix_fmt"], "yuv420p"),
 ("fps", v["avg_frame_rate"], "30/1"),
 ("フレーム数", v["nb_read_frames"], "1050"),
 ("尺(秒)", j["format"]["duration"], "35.0"),
 ("音声トラック数", str(len(audio)), "0 (無音)"),
 ("faststart(moovがmdatより前)", str(faststart), "True"),
 ("容量(MB)", f"{size/1e6:.2f}", "<= 50"),
]
ok = (v["width"], v["height"], v["codec_name"], v["pix_fmt"], v["avg_frame_rate"], v["nb_read_frames"]) == (1920, 1080, "h264", "yuv420p", "30/1", "1050") \
     and abs(float(j["format"]["duration"]) - 35) < 0.05 and not audio and faststart and size <= 50e6
out = [f"# 確認レポート: {mp4.name}", "", "| 項目 | 実測値 | 仕様 |", "|---|---|---|"] + [f"| {a} | {b} | {c} |" for a, b, c in rows]
out += ["", f"**判定: {'仕様どおり' if ok else '仕様不一致あり'}**"]
if "PLACEHOLDER" in mp4.name:
    out += ["", "> ⚠ 本ファイルは実素材が無い状態で作った**レイアウト検証用**です。成果物ではありません(未完成)。"]
(mp4.parent / "VERIFY_REPORT.md").write_text("\n".join(out) + "\n")
print("\n".join(out))
