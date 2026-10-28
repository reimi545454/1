# codex_proposal_review

X投稿用の解説動画（約28秒・1280×720・30fps・H.264・音声なし）。架空の資料を使った解説イメージで、実際のCodex操作録画ではありません。

## 構成
- `index.html` … 全場面のソース。`setTime(秒)` で任意時刻の画面を描画（テキスト・タイミングはここを編集）
- `fonts/` … Noto Sans JP（Regular/Medium/Bold）
- `render_frames.mjs` … Chromeで30fpsの連番PNGを書き出す（追加パッケージ不要、Node 22+）
- `encode.swift` … 連番PNGをH.264のMP4にする（macOS標準のAVFoundation）

## 再書き出し（macOS、Google Chrome が必要）
```bash
cd video/codex_proposal_review
node render_frames.mjs "$PWD/frames_tmp"
swiftc -O encode.swift -o /tmp/encode_codex_video && /tmp/encode_codex_video frames_tmp codex_proposal_review.mp4
rm -rf frames_tmp .chrome-profile
```
サムネイルは `frames_tmp/f_0660.png`（22.0秒）を `codex_proposal_review_cover.png` として保存したもの。
