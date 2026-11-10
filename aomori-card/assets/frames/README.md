# フレームPNGの作り方(Photoshop)

1. `_guide.png` を Photoshop で開く(**1650 × 2730 px** = 縦名刺 55×91mm)
   - ピンクの枠が「写真の窓」。**透明のまま**にしてください(写真はPNGの**下**に敷かれます)
   - 黄の枠が名前(金文字)、青の帯が縦書きコメントの位置(アプリが後から描きます)
2. ランクごとに N / R / SR / UR / SP の5枚を作り、**透過PNG**で `assets/frames/local-preneur/` に保存
   (ファイル名例: `N.png` `R.png` `SR.png` `UR.png` `SP.png`、生成前プレビュー用に `PREVIEW.png` も任意)
3. `assets/config.js` の `png` に登録するとアプリに反映されます(未登録のランクは仮フレーム)
   ```js
   png: {
     N: 'assets/frames/local-preneur/N.png',
     SP: 'assets/frames/local-preneur/SP.png',
   },
   ```
4. 縦文字コメントもPNGに入れる場合は `slogan.drawn: false` にしてください
5. 角丸の外側は透明にしてください(アプリ側でも半径44(論理座標)で角を丸めます)
