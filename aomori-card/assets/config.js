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
    // 名前: Helvetica Neue Condensed Black Italic に近い Archivo Black Italic(幅75)(仮)
    name: { family: 'AomoriName', url: 'assets/fonts/Archivo-BlackItalic-w75-Latin.woff2', weight: '900', style: 'italic' },
    jp: { family: 'AomoriJP', url: 'assets/fonts/NotoSansJP-Medium-subset.woff2', weight: '500', style: 'normal' },
  },

  defaultFrame: 'fisherman',

  /*
   * 画面に出す部品。標準は「写真アップロード → 名前 + 地域 → つくる」(+ カメラ)。
   *   frameChooser: フレーム選択(複数フレームを出すとき true)
   *   regionSelect: バッジの市町村選択
   *   camera      : 「カメラでその場でとる」ボタン
   */
  ui: { frameChooser: false, regionSelect: true, camera: true },

  // 待ち時間・ロゴのマスコット: 'apple'(りんご) / 'mark'(青森県マーク)
  mascot: 'apple',

  // 名前が未入力のときにプレビューへ薄く出す見本(first=名前 / last=苗字)
  sampleName: { first: 'TARO', last: 'AOMORI' },

  frames: {
    /* ---- 漁師カード風(出来上がりイメージの基本) ---- */
    fisherman: {
      label: '漁師カード風',
      style: 'fisher', // 仮フレームの描き分け: 'fisher'(写真いっぱい) / 'strip'(右に白い縦帯)
      png: {}, // ローカルプレナーと同じ形式でランク別PNGを登録できる

      photo: {
        x: 24, y: 112, w: 1052, h: 1596,
        polygon: [[24, 252], [450, 112], [1076, 112], [1076, 1708], [24, 1708]],
      },
      // 縦文字は写真の上に重ねる(halo=読みやすさ用のごく薄い白フチ)
      slogan: { drawn: true, x: 994, top: 175, height: 1100, maxSize: 72, color: '#111111', halo: '#ffffff' },
      // 名前は写真の左下に重ねる(後ろに暗いぼかし影が入る)
      name: {
        size: 120, weight: 900, spacing: 6,
        first: { x: 40, y: 1580, maxW: 640 },
        last: { x: 240, y: 1700, maxW: 450 },
        single: { x: 40, y: 1690, maxW: 640 },
      },
      headline: '',
      badge: ['AOMORI', 'PREFECTURE'], // 地域を選ばなかったときのバッジ文字
      badgePos: { x: 888, y: 1555, r: 180 },

      // 縦文字: 漁師カードと同じ文言(全ランク固定)。複数書くとガチャ時にランダム
      slogans: {
        N: ['人と人、酒と肴、つなぐ青森。'], R: ['人と人、酒と肴、つなぐ青森。'],
        SR: ['人と人、酒と肴、つなぐ青森。'], UR: ['人と人、酒と肴、つなぐ青森。'],
        SP: ['人と人、酒と肴、つなぐ青森。'],
      },
      sloganPreview: '人と人、酒と肴、つなぐ青森。',
    },

    /* ---- ローカルプレナー(右に白い縦帯) ---- */
    'local-preneur': {
      label: 'ローカルプレナー',
      style: 'strip',
      /*
       * フレームPNG(Photoshopで作成)のパス。ランクごとに指定。
       *   - 写真が見える「窓」は透明にしておく(写真はPNGの下に敷かれる)
       *   - 指定のないランクは、仮の自動描画フレームで表示される
       *   - PREVIEW は生成前プレビュー用(ランクを伏せた状態)。無ければ仮フレーム
       * 例: N: 'assets/frames/local-preneur/N.png',
       */
      png: {},

      photo: {
        x: 24, y: 112, w: 926, h: 1388,
        polygon: [[24, 244], [338, 112], [950, 112], [950, 1500], [24, 1500]],
      },
      // 縦書きコメント。drawn=false にするとアプリは描かない(PNGに書き込む場合)
      slogan: { drawn: true, x: 1017, top: 170, height: 1160, maxSize: 56, color: '#111111' },
      // 名前(金色文字)。first=名前(上段)、last=苗字(下段)。片方だけのときは single
      name: {
        size: 86, spacing: 14,
        first: { x: 42, y: 1388, maxW: 720 },
        last: { x: 190, y: 1474, maxW: 640 },
        single: { x: 42, y: 1470, maxW: 720 },
      },
      headline: 'LOCAL PRENEUR',
      badge: ['AOMORI', 'SUPPORT'],
      badgePos: { x: 915, y: 1590, r: 166 },

      /*
       * 縦文字の候補(ランクごと)。
       *   - 候補が1つ → そのランクは固定 / 複数 → ガチャ時にランダム
       *   - 全角スペース(\u3000)で区切ると1文字ぶん空く。20文字前後までがきれい
       * ※ SP 以外は仮の文面です
       */
      slogans: {
        N: ['人と人、酒と肴、つなぐ青森。'],
        R: ['ねぶたの熱さを、ひとの力に'],
        SR: ['青森の未来は、ここから始まる'],
        UR: ['地域を動かす、あなたが主役'],
        SP: ['地域の課題を未来の価値へ\u3000未来を拓く青森'],
      },
      sloganPreview: 'ひとことは\u3000ガチャで決まる',
    },
  },

  // バッジに入れる地域(青森県40市町村)。[日本語, ローマ字, 種別, 地図上のx, y(assets/geo.js の座標系。市町村の境界地図から、各領域の中心に近い点を算出)]
  regions: [
    ['青森市', 'AOMORI', 'CITY', 46.7, 57.8], ['弘前市', 'HIROSAKI', 'CITY', 30.6, 70.2], ['八戸市', 'HACHINOHE', 'CITY', 88.7, 76.5],
    ['黒石市', 'KUROISHI', 'CITY', 47.5, 68.1], ['五所川原市', 'GOSHOGAWARA', 'CITY', 35.9, 53.2], ['十和田市', 'TOWADA', 'CITY', 62.1, 71.5],
    ['三沢市', 'MISAWA', 'CITY', 83.8, 63.1], ['むつ市', 'MUTSU', 'CITY', 64.3, 17.5], ['つがる市', 'TSUGARU', 'CITY', 26.5, 51.9],
    ['平川市', 'HIRAKAWA', 'CITY', 47.7, 76.4],
    ['平内町', 'HIRANAI', 'TOWN', 61.8, 48.2], ['今別町', 'IMABETSU', 'TOWN', 36.1, 28.9], ['蓬田村', 'YOMOGITA', 'VILLAGE', 41.2, 39.8],
    ['外ヶ浜町', 'SOTOGAHAMA', 'TOWN', 39.8, 34.3], ['鰺ヶ沢町', 'AJIGASAWA', 'TOWN', 20.0, 61.5], ['深浦町', 'FUKAURA', 'TOWN', 8.2, 67.6],
    ['西目屋村', 'NISHIMEYA', 'VILLAGE', 20.4, 75.6], ['藤崎町', 'FUJISAKI', 'TOWN', 35.9, 63.1], ['大鰐町', 'OWANI', 'TOWN', 36.5, 77.6],
    ['田舎館村', 'INAKADATE', 'VILLAGE', 37.3, 65.5], ['板柳町', 'ITAYANAGI', 'TOWN', 34.5, 59.7], ['鶴田町', 'TSURUTA', 'TOWN', 31.4, 57.4],
    ['中泊町', 'NAKADOMARI', 'TOWN', 32.8, 40.6], ['野辺地町', 'NOHEJI', 'TOWN', 68.9, 49.6], ['七戸町', 'SHICHINOHE', 'TOWN', 67.4, 59.5],
    ['六戸町', 'ROKUNOHE', 'TOWN', 80.0, 69.5], ['横浜町', 'YOKOHAMA', 'TOWN', 78.1, 36.9], ['東北町', 'TOHOKU', 'TOWN', 74.5, 52.6],
    ['六ヶ所村', 'ROKKASHO', 'VILLAGE', 80.6, 47.4], ['おいらせ町', 'OIRASE', 'TOWN', 83.8, 65.7], ['大間町', 'OMA', 'TOWN', 59.7, 6.8],
    ['東通村', 'HIGASHIDORI', 'VILLAGE', 81.9, 18.1], ['風間浦村', 'KAZAMAURA', 'VILLAGE', 64.7, 7.3], ['佐井村', 'SAI', 'VILLAGE', 56.7, 9.6],
    ['三戸町', 'SANNOHE', 'TOWN', 73.5, 85.6], ['五戸町', 'GONOHE', 'TOWN', 77.2, 76.7], ['田子町', 'TAKKO', 'TOWN', 62.9, 90.7],
    ['南部町', 'NANBU', 'TOWN', 81.7, 81.1], ['階上町', 'HASHIKAMI', 'TOWN', 94.1, 80.8], ['新郷村', 'SHINGO', 'VILLAGE', 67.3, 79.6],
  ],

  // SR以上にかける虹色ホイル/キラキラ(フレームPNG側で表現するなら false)
  foilEffect: true,
};
