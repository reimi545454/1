# マスコット画像の置き方

画像を置いて `assets/config.js` の `mascotImages` にパスを書くと、りんごのイラストから入れ替わります
(読み込めなかったときは、りんごのまま表示されます)。

| 項目 | 使われる場所 | ファイル名の例 |
|---|---|---|
| `main` | 基本(正面向き)。他が空のときはこれを使う | `front.png` |
| `splash` | オープニング(くるくる回って広がる) | `front.png` でよい |
| `gacha` | ガチャ待ち(揺れる) | `shake.png`(なければ `main`) |
| `logo` | ヘッダーとボタンの小さいアイコン | `logo.png`(なければ `main`) |

## 仕様
- 透過PNG(または SVG)。正方形 1024 × 1024 px 推奨。キャラのまわりに余白をとる
- 正面向きで、顔と全身が見えること(回転・拡大の演出に使う)
- 文字・ロゴ・県章は入れない

```js
mascotImages: { main: 'assets/mascot/front.png', splash: '', gacha: 'assets/mascot/shake.png', logo: 'assets/mascot/logo.png' },
```
