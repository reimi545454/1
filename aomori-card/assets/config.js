/*
 * あおもりカードメーカー: 設定ファイル(デザイン調整はここだけ触ればOK)
 *
 * 座標はすべて「カード論理サイズ 1100 x 1820」基準。
 * 縦名刺サイズ 55 x 91 mm = 縦横比 55:91 です。
 * フレームPNGは 1650 x 2730 px(= 論理サイズの 1.5 倍)で作ると保存画像と1:1で綺麗です。
 * (1100 x 1820 でも動きます。拡縮して使います)
 */
window.AomoriConfig = {
  card: { width: 1100, height: 1820, exportScale: 1.5 },

  // 書き出し・描画に使う書体(アプリに同梱。端末に依存せず常に同じ見た目)
  fonts: {
    name: { family: 'AomoriName', url: 'assets/fonts/Exo2-Italic-VF-latin.woff2', weight: '100 900', style: 'italic' },
    jp: { family: 'AomoriJP', url: 'assets/fonts/NotoSansJP-Black-subset.woff2', weight: '900', style: 'normal' },
  },

  frames: {
    'local-preneur': {
      label: 'ローカルプレナー',

      /*
       * フレームPNG(Photoshopで作成したもの)のパス。ランクごとに指定。
       *   - 写真が見える「窓」は透明にしておく(写真はPNGの下に敷かれる)
       *   - 指定のないランクは、仮の自動描画フレームで表示される
       *   - PREVIEW は生成前のプレビュー用(ランクを伏せた状態)。無ければ仮フレーム
       * 例:
       *   N: 'assets/frames/local-preneur/N.png',
       */
      png: {},

      // 写真が見える窓(論理座標)。polygon は窓の形(左上が斜めカット)
      photo: {
        x: 24, y: 112, w: 926, h: 1388,
        polygon: [[24, 244], [338, 112], [950, 112], [950, 1500], [24, 1500]],
      },

      // 右の縦書きコメント。drawn=false にするとアプリは描かない(PNGに書き込む場合)
      slogan: { drawn: true, x: 1017, top: 170, height: 1160, maxSize: 56, color: '#111111' },

      // 名前(金色文字)。first=名前(上段)、last=苗字(下段)。片方だけのときは single
      name: {
        size: 86, spacing: 14,
        first: { x: 42, y: 1388, maxW: 720 },
        last: { x: 190, y: 1474, maxW: 640 },
        single: { x: 42, y: 1470, maxW: 720 },
      },

      // 仮フレーム(PNG未指定時)の見出しとバッジ文字
      headline: 'LOCAL PRENEUR',
      badge: ['AOMORI', 'SUPPORT'],
    },
  },

  /*
   * 縦文字コメント(ガチャモード)。ランクごとに候補を並べる。
   *   - 候補が1つ → そのランクは固定(現在はこの設定)
   *   - 候補を複数にすると、ガチャ時にその中からランダム
   * 全角スペース(\u3000)で区切ると1文字ぶん空く。20文字前後までがきれいに収まる。
   * ※ SP 以外は仮の文面です。フレームPNGに文字を入れる場合は frames.*.slogan.drawn=false
   */
  slogans: {
    N: ['人と人、酒と肴、つなぐ青森。'],
    R: ['ねぶたの熱さを、ひとの力に'],
    SR: ['青森の未来は、ここから始まる'],
    UR: ['地域を動かす、あなたが主役'],
    SP: ['地域の課題を未来の価値へ\u3000未来を拓く青森'],
  },

  /*
   * 「じぶんで えらぶ」モード(別枠): ランクと縦文字を自由に指定してガチャなしで作る。
   *   enabled=false でモード切替ごと非表示。ranks で選べるランクを制限できる
   *   (ガチャの希少性を守りたい場合は ['N','R'] などに絞る)。
   */
  customMode: { enabled: true, ranks: ['N', 'R', 'SR', 'UR', 'SP'], sloganMaxLength: 20 },

  // 生成前プレビューで縦帯に出す文字
  sloganPreview: 'ひとことは　ガチャで決まる',

  // SR以上にかける虹色ホイル/キラキラ(フレームPNG側で表現するなら false)
  foilEffect: true,
};
