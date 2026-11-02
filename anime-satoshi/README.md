# サトシと大海原の大冒険！ 第1話 — 試作(30秒)

Three.js(WebGL)で組んだ3Dシーンを、ヘッドレスChromium(Playwright)で1フレームずつ描画し、FFmpegでMP4にまとめる構成です。
**すべて無料のローカル処理**で、外部APIは使っていません。

## 範囲
| 時間 | 内容 | 絵コンテ |
|---|---|---|
| 0:00–0:20 | 朝の港でサトシが挨拶し、サト丸に飛び乗る | シーン1 |
| 0:20–0:30 | サト丸で出港(シーン2の冒頭10秒) | シーン2 |

## ビルド(約15分 / CPU 4コア)
```bash
npm install
./build.sh 3            # → out/satoshi_ep1_trial_30s.mp4
```
- 描画は再開可能(`frames/` に既存のPNGはスキップ)。
- 修正後に特定の範囲だけ描き直す: `rm frames/00300.png … ` または `rm -rf frames` してから `./build.sh`。
- 1フレームだけ確認: `node render.js 150 151 preview 1`(`t = フレーム番号/30` 秒)。
- 低解像度の下見は不要(1フレーム約0.8秒と軽量)。

## 構成
| ファイル | 役割 |
|---|---|
| `src/main.js` | タイムライン(サトシの演技・カメラ・ライティング・字幕・ワイプ)。`window.renderFrame(t)` |
| `src/satoshi.js` | サトシのモデル、表情(`applyExpr`)、ポーズ(`applyPose`)。**全シーン共通の同一モデル** |
| `src/lipsync.js` | セリフ定義(`LINES`)と、かな→母音→口の開きによる口パク |
| `src/boat.js` / `src/harbor.js` | サト丸(船名「サト丸」入り)、港、灯台、街並み |
| `src/sea.js` | 波のシェーダ、空、雲 |
| `src/fx.js` | 水しぶき、航跡、カモメ |
| `audio/make_audio.py` | BGM・環境音・効果音の合成 → `audio/mix.wav`、`audio/audio_manifest.json` |
| `render.js` / `build.sh` | フレーム書き出し / 一括ビルド |

### キャラクターの見た目を統一する仕組み
サトシは `makeSatoshi()` 1つだけで生成し、色は `COL` に固定しています。全シーンで同じ関数・同じ表情パラメータ(`baseExpr`)・同じポーズ系(`basePose`)を使うため、シーンごとに顔が変わることはありません。

### 動きの決め方
全ての動きは時刻 `t` の関数(決定論的)です。同じ `t` なら常に同じ絵になるため、任意のフレームを独立に再描画できます。
