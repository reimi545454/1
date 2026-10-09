# ART-005 X用解説動画（Claude Frontier Academy）

記事「Claude Frontier Academyが示す『企業でAIを動かせる人』の条件」へ誘導する、横長1920×1080・30fps・40秒の導入動画です。
字幕・図の動き・注釈はすべてコードで描画します（画像に文字は生成しません）。標準版はナレーション・BGMなしで、字幕だけで理解できます。

> この動画の実践手順（観察 → 試作品 → テスト → 引き継ぎ）は記事独自の提案で、Frontier Academyの公式カリキュラムの再現ではありません。
> COACH AIはFrontier Academyと提携・認定関係にはありません。1億ドル・育成人数・研修日程は40秒版では扱っていません。

## 仕組み

- Chromium（Playwright）で `src/index.html` を1フレームずつ描画 → FFmpeg（libx264）でMP4化します。
- 画面は「フレーム番号だけ」から決まります。乱数・実時間・CSSアニメーションは使わないため、何度書き出しても同じ映像になります。
- 台本・秒数・字幕・注釈の位置は `src/timeline.mjs` に集約しています。
- Remotionは使っていません。企業での利用に有償ライセンスが必要になる場合があるため、課金の可能性がない構成にしました。外部の動画生成API・有料サービスは一切使いません。

## Macでの準備（初回のみ）

1. Node.js 20以上を入れます（22推奨）。 `node -v` で確認。
2. FFmpegを入れます。
   ```bash
   brew install ffmpeg
   ```
3. 依存関係を入れます（`package-lock.json` で固定済みです）。
   ```bash
   cd video-art005
   npm ci
   ```
4. 描画に使うブラウザを用意します。次のどちらかです。
   - Google Chromeが入っていれば、そのまま自動で使われます（追加作業なし）。
   - 入っていない場合: `npx playwright-core install chromium`
   - 別の場所のChromeを使うなら `export CHROME_PATH="/path/to/chrome"` を指定します。

## 画像素材

`assets/` に次の4点を置きます（このリポジトリには同梱済みです）。ファイル名は変えないでください。

| ファイル | 用途 |
|---|---|
| `ART-005_insert_01_roles_v1.png` | Scene 1, 3, 4（役割分担） |
| `ART-005_insert_02_testing_v1.png` | Scene 2, 5（テスト） |
| `ART-005_insert_03_practice_v1.png` | Scene 6（4段階の実践） |
| `COACHAI_article_footer_banner.jpg` | Scene 7（相談案内。公式バナーをそのまま使用） |

## プレビューと書き出し

```bash
npm run check     # 安全余白・字幕の行数・はみ出し・フォント読み込み・要素の重なりを検査
npm run preview   # サムネイルと preview_01/04/07.png のみ出力（数秒）
npm run render    # 全1200フレームを描画して MP4 を書き出す（数分〜十数分）
npm run verify    # MP4を検査して render-report.txt を作る
npm run script    # script.txt を timeline.mjs から再生成
npm run all       # 上をまとめて実行
```

任意のフレームを確認したいとき:

```bash
node scripts/render.mjs --frames 0,60,300,590 --out .work/frames
```

出力先は `output/` です。

- `ART-005_Claude_Frontier_Academy_X_1920x1080_40s.mp4`
- `ART-005_Claude_Frontier_Academy_X_thumbnail.png`（冒頭の見出し）
- `preview_01.png`（冒頭）, `preview_04.png`（役割分担）, `preview_07.png`（最後）

## 字幕・タイミングの修正

1. `src/timeline.mjs` の該当シーンの文字列を直します（`main`, `sub`, `questions`, `notes`, `texts` など）。
   - フレーム数は「秒 × 30」です。シーンの範囲は `start`〜`end`（`end` を含む）。全体は1200フレームのままにしてください。
   - 注釈・番号の位置 `x`, `y` は1920×1080の画面上の座標（中心）です。
2. `npm run check` で余白や行数を確認します。主字幕は最大2行、安全余白は左右120px・上90px・下150pxです。
3. `npm run preview` → 静止画を目視 → `npm run render` → `npm run verify` → `npm run script`。

## 仕様の対応

| 項目 | 設定 |
|---|---|
| 解像度・fps・尺 | 1920×1080 / 30fps / 40秒（1200フレーム） |
| 形式 | MP4 / H.264 High / yuv420p / BT.709 / faststart |
| ビットレート | 平均約7Mbps（上限8Mbps）。容量の目標は50MB以下 |
| 音声 | なし（標準版）。音声を付けるときは別版にし、AAC 48kHzで多重化します（`script.txt` に任意ナレーション台本あり） |
| 字幕の文字サイズ | 見出し84px、主字幕56〜58px、補助字幕38〜40px、注釈36px |
| 字幕帯 | 半透明アイボリー＋チャコール文字。帯の下端は下余白150px上 |
| 動き | 緩やかなズーム（1.00→1.025）、字幕0.3秒フェード、シーン切替8フレームのクロスフェード。点滅・跳ね・高速タイプ表示なし |

## フォントとライセンス

- 日本語フォント: Noto Sans JP（`@fontsource/noto-sans-jp` 5.2.5経由、SIL Open Font License 1.1）。商用利用・動画への埋め込みが可能です。`npm ci` で `node_modules` に入ります。
- 画像素材は記事用に作成済みの概念図で、実際のClaude画面・公式研修教材・導入実績ではありません。キャラクターを新しく描き足したり変形したりしていません。
- Scene 7のバナーは提供済みのCOACH AI公式バナーをそのまま表示しています。
- 公式ロゴは新規に描いていません。LINEのURL・QRコード・公開記事のURLは動画内に入れていません（ポスト本文・記事側に置く前提）。

## 構成

```
assets/            素材4点
src/timeline.mjs   台本・秒数・字幕・注釈（編集はここ）
src/index.html     スタイル
src/main.mjs       フレーム番号 → 画面
scripts/           render / check-layout / verify / gen-script
output/            MP4・サムネイル・プレビュー
script.txt         秒数・字幕・任意ナレーション
render-report.txt  書き出し結果と自動検査
```
