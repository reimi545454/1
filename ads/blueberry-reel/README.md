# ブルーベリー農園 Meta広告クリエイティブ（説明会予約）

LP: https://newez-farming.jp/lp/blueberry/ ／ ゴール: 説明会予約

## 成果物（`out/`）

| ファイル | 内容 |
|---|---|
| `a-owner.mp4` | 動画A：未経験からオーナーに（15秒・1080x1920） |
| `b-farmland.mp4` | 動画B：耕作放棄地の再生 |
| `c-track-record.mp4` | 動画C：実績（195農園／135社／6期目） |
| `d-bonus.mp4` | 動画D：説明会参加特典（10月限定） |
| `*_cover.jpg` | 各動画のカバー画像 |
| `static/*.png` | 静止画 5デザイン × 3サイズ（ストーリー1080x1920／フィード1080x1350／正方形1080x1080） |

## 再生成

```
npm install
node render.mjs variants/a-owner.json     # 動画（ffmpeg / python3+numpy が必要）
node render-static.mjs                    # 静止画（全デザイン×全サイズ）
node render.mjs variants/a-owner.json --guides --stills   # セーフゾーン確認用
```

コピーの変更は `variants/*.json`（動画）・`template/static.js`（静止画）。
文字がInstagramのUI領域（上269px／下672px／左右64px）や枠からはみ出すと、書き出し時にエラーで止まります。

## 入稿前に確認してほしい点（クライアント確認事項）
- 特典（お米／BISSスキンケア・10月限定）が今回のブルーベリーLPでも有効か
- 「費用がかかります／収益を保証しません」の注意書きの文言（景品表示法・投資的な誤認防止）
- 実績数値（195農園・135社・6期目）は2026/10/5付の自社資料に基づく。掲載可否・時点表記
- 農園写真は同資料から流用。広告利用の許諾
- LPの実内容は本環境から取得できなかったため未反映（訴求はPDF資料と既存クリエイティブに基づく）
