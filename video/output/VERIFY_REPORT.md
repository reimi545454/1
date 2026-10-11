# 確認レポート: ART-015_security_X_1920x1080_35s.mp4

| 項目 | 実測値 | 仕様 |
|---|---|---|
| 解像度 | 1920x1080 | 1920x1080 |
| コーデック | h264 | h264 |
| pix_fmt | yuv420p | yuv420p |
| fps | 30/1 | 30/1 |
| フレーム数 | 1050 | 1050 |
| 尺(秒) | 35.000000 | 35.0 |
| 音声トラック数 | 0 | 0 (無音) |
| faststart(moovがmdatより前) | True | True |
| 容量(MB) | 4.12 | <= 50 |

**判定: 仕様どおり**

## 効果音付き版 (ART-015_security_X_1920x1080_35s_SE.mp4)
```
stream|codec_name=h264
stream|codec_name=aac|sample_rate=44100|channels=2
format|duration=35.000000|size=4431253
```
映像は標準版と同一(コピー)、音声はAAC 192kbps ステレオ。音量 約-16.5LUFS(実測は本文参照)。
