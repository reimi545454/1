# あおもりカードメーカー(ラフ版)

写真をアップ(またはカメラ撮影)して名前を入れると、ランダムなレア度(N / R / SR / UR / SP)のフレームで
青森カードが生成される静的Webアプリです。ビルド不要・外部依存なし・写真は端末内のみで処理(サーバー送信なし)。

## 動かし方
```
npm start      # http://localhost:8123 (カメラは https か localhost が必須)
npm test       # ロジックのユニットテスト
```
`index.html` + `assets/` をそのまま静的ホスティング(GitHub Pages / Netlify / S3 等)に置けば公開できます。

## 機能
- カードは縦の名刺サイズ(55×91mm)。論理座標 1100×1820、保存PNGは 1650×2730
- オープニング: くるくる回るりんご → 画面いっぱいに広がって本編へ(スキップ可、モーション低減設定に対応)
- 写真: ファイル選択 / ドラッグ&ドロップ / カメラ撮影(前後切替。不可環境はOS標準カメラにフォールバック)
- 位置・ズーム調整: ドラッグ、ピンチ、ホイール、スライダー、キーボード
- 名前: 苗字・名前を別欄でローマ字入力。ひらがな・カタカナは自動でローマ字化(漢字は不可と案内)。
  カードには金色の文字で「名前 / 苗字」の順に入る。書体は同梱フォント(Archivo Black Italic)で固定
- 縦文字コメント: ランクごとにフレームと一緒に固定(`assets/config.js` の `slogans`)。
  候補を複数にすればランダム、PNGに書き込む場合は `slogan.drawn: false`
- つくる: 暗号論的乱数でランク抽選 → 演出 → 結果(SR以上はホイル/キラキラ、ティルト反射)
- 保存(PNG) / Web Share API でシェア

## フレームPNGの差し替え
`assets/frames/README.md` を参照(ガイド `assets/frames/_guide.png` つき)。
PNGを置いて `assets/config.js` の `png` に登録するだけで、そのランクは仮フレームからPNGに切り替わります。

## 同梱フォント(SIL OFL 1.1)
`assets/fonts/` … Archivo Black Italic (名前) / Noto Sans JP Medium をJIS第1・2水準で軽量化したもの(縦文字コメント)

## 今後の拡張ポイント
- フレーム追加: `assets/config.js` の `frames` に定義を足し、`index.html` のチップを有効化
- 排出率・ランク配色: `assets/lib.js` の `RANKS`
- 要検討: 排出の公平性をサーバー側で担保するか(現状はクライアント抽選)、市町村別バッジ

## 書体(フォント)の変え方
書体は Google Fonts(SIL OFL・商用利用可)から選び、`assets/fonts/` に同梱しています(端末に依存せず常に同じ見た目)。
1. https://fonts.google.com で書体を選び、ダウンロードした `.ttf` を `woff2` に変換して `assets/fonts/` に置く
2. `assets/config.js` の `fonts.name`(名前)または `fonts.jp`(縦文字)の `url` / `weight` / `style` を書き換える
3. 名前の太さは `frames.*.name.weight`、字間は `spacing` で調整
※ 縦文字(日本語)の書体は容量が大きいので、使う文字だけに絞って(サブセット化して)同梱します。
