# ART-015 セキュリティ記事紹介 X用動画(35秒)

## 状態: **未完成(素材待ち)**
依頼文中の「画像管理」表と、表紙・本文画像3枚・COACH AI公式バナーの実ファイルが作業環境に存在せず、
新規キャラクター/ロゴ/画面の生成も禁止のため、**最終MP4はまだ書き出していません**。
パイプライン(コード)は完成しており、仮枠でレイアウト・尺・仕様(1920×1080/30fps/1050フレーム/H.264/yuv420p/faststart)を検証済みです。

## 手順
1. 素材を `assets/` に置く(ファイル名固定)
   `cover.png`(5:2表紙) / `body1.png` / `body2.png` / `body3.png` / `coach_ai_banner.png`
2. `pip install pillow` と `ffmpeg`(libx264)を用意
3. `python3 src/render.py` → `output/ART-015_security_X_1920x1080_35s.mp4`、`output/ART-015_thumbnail.png`、`output/previews/`
4. `python3 src/verify.py output/ART-015_security_X_1920x1080_35s.mp4` → `output/VERIFY_REPORT.md`(尺・解像度・容量の実測)
5. `output/previews/scene*_phone360.png`(幅360px相当)で字幕の可読性を目視確認

`--placeholder` は素材欠落時のレイアウト検証用で、出力名に `_PLACEHOLDER` が付き、成果物としては使えません。

## 設計
- 背景アイボリー(#FCF7EC)＋オレンジ(#F07C1C)。演出は0.5秒フェードと100→104%の軽いズームのみ。点滅・速い文字送りなし。
- 画像は縦横比維持で (120,100)-(1800,788) に収める(表紙5:2は引き伸ばさず左右に余白)。
- 字幕は画像領域の下(y=812〜980)に固定。60px・最大2行・左右120px/上下100px安全余白内。長すぎる行は実行時にエラー。
- フォント: Noto Sans CJK Bold → IPAGothic の順に探索(`src/render.py` の FONT_PATHS)。
- 23–29秒は本文画像1→2→3を各2秒、0.8秒のクロスディゾルブで切替。
- 音声なし(標準版は無音)。SNSへの投稿・予約はしていません。

## 構成
`src/render.py` 描画+エンコード / `src/verify.py` 実測レポート / `docs/SUBTITLES.md` 字幕台本 / `output/` 出力
