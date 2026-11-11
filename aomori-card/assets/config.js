/*
 * あおもりカードメーカー: 設定ファイル(デザイン調整はここだけ触ればOK)
 *
 * 座標はすべて「カード論理サイズ 1100 x 1820」基準。
 * 縦名刺サイズ 55 x 91 mm = 縦横比 55:91 です。
 * フレームPNGは 1650 x 2730 px(= 論理サイズの 1.5 倍)で作ると保存画像と1:1で綺麗です。
 * (1100 x 1820 でも動きます。拡縮して使います)
 */
window.AomoriConfig = {
  // 保存画像: 縦名刺サイズ 55 x 91 mm(650 x 1075 px = 300dpi)。
  //   フレームPNGがあるときは、そのPNGと同じ大きさで保存する(大きくしたいときは、フレームPNGを同じ比率で大きく作る)。
  //   exportWidth は、フレームPNGが無いときの幅(高さは 650:1075 の比率で決まる)
  card: { width: 1100, height: 1820, exportWidth: 650 },

  // 書き出し・描画に使う書体(アプリに同梱。端末に依存せず常に同じ見た目)
  fonts: {
    // 名前: Helvetica Neue Condensed Black Italic に近い Archivo Black Italic(幅75)(仮)
    name: { family: 'AomoriName', url: 'assets/fonts/Archivo-BlackItalic-w75-Latin.woff2', weight: '900', style: 'italic' },
    jp: { family: 'AomoriJP', url: 'assets/fonts/NotoSansJP-Medium-subset.woff2', weight: '500', style: 'normal' },
  },

  /*
   * Adobe Fonts(Apotek Extra Cond)。名前(斜体)とランク文字(通常体)に使う。
   *   - Adobe の配信(Typekit)から読み込む。同梱はしない(規約のため)。読み込みの際にAdobeへアクセスが発生する
   *   - 読み込めなかったとき(オフライン・ドメイン未登録など)は、上の同梱書体に自動で切り替わる
   *   - kit の「ドメイン」に、公開先のドメインを登録しておくこと
   *   - enabled: false にすると、Adobe には一切アクセスしない
   */
  adobeFonts: { enabled: true, css: 'https://use.typekit.net/mwj8mmr.css', family: 'apotek-extracond', weight: 600, timeoutMs: 4000 },

  defaultFrame: 'sp',

  /*
   * ランクの固定。'SP' にすると、つくるを押したときのランクが常にSPになる(抽選しない)。
   * null にすると、従来どおり重み付きの抽選(N / R / SR / UR / SP)。
   */
  rankOverride: 'SP',

  /*
   * 画面に出す部品。標準は「写真アップロード → 名前 + 地域 → つくる」(+ カメラ)。
   *   frameChooser: フレーム選択(複数フレームを出すとき true)
   *   regionSelect: バッジの市町村選択
   *   camera      : 「カメラでその場でとる」ボタン
   */
  ui: { frameChooser: false, regionSelect: false, camera: true },


  /*
   * マスコット画像(任意)。空のままなら、りんごのイラスト(SVG)を使う。
   * 画像を置いてパスを書くと、読み込めたときだけ入れ替わる(作り方は assets/mascot/README.md)。
   *   main  : 基本の画像(正面向き)。他が空のときはこれを使う
   *   splash: オープニング用 / gacha: ガチャ待ち用 / logo: ヘッダーとボタンの小さいアイコン用
   */
  mascotImages: { main: '', splash: '', gacha: '', logo: '' },

  // 名前が未入力のときにプレビューへ薄く出す見本(first=名前 / last=苗字)
  sampleName: { first: 'TARO', last: 'AOMORI' },

  frames: {
    /* ---- SP(本番のフレームPNGを使用。写真と名前だけを入れる) ---- */
    sp: {
      label: 'SP',
      style: 'png',
      // ランク文字・星・縦文字・LOCAL PRENEUR・バッジ(AOMORI SUPPORT)は、すべてフレームPNGの絵。
      // アプリが描くのは「写真」と「名前」だけ(市町村名・位置の点・ホイルは入れない)
      png: { SP: 'assets/frames/sp/SP.png', PREVIEW: 'assets/frames/sp/SP.png' },
      badgeDraw: false,
      foil: false,

      // 写真が見える窓(論理座標 1100×1820。フレームPNG 1209×2000 の透明部分から算出)
      photo: {
        x: 0, y: 99, w: 951, h: 1454,
        polygon: [[950,99],[354,101],[0,250],[0,1552],[740,1547],[775,1490],[822,1451],[883,1428],[950,1427]],
      },

      slogan: { drawn: false, x: 0, top: 0, height: 0, maxSize: 0, color: '#000' },
      // 名前(金色+黒のシャドウ)。写真の左下
      name: {
        size: 110, weight: 900, spacing: 6,
        adobe: { size: 129, spacing: 20 },
        first: { x: 34, y: 1432, maxW: 508 },
        last: { x: 166, y: 1537, maxW: 423 },
        single: { x: 34, y: 1500, maxW: 508 },
      },
      headline: '',
      badge: ['AOMORI', 'SUPPORT'],
      badgePos: { x: 0, y: 0, r: 0 },
      slogans: { SP: [''] },
      sloganPreview: '',
    },

    /* ---- 漁師カード風(出来上がりイメージの基本) ---- */
    fisherman: {
      label: '漁師カード風',
      style: 'fisher', // 仮フレームの描き分け: 'fisher'(写真いっぱい) / 'strip'(右に白い縦帯)
      png: {}, // ランク別PNGを登録できる。例: N: 'assets/frames/fisherman/N.png'(作り方は assets/frames/README.md)

      photo: {
        x: 24, y: 112, w: 1052, h: 1596,
        polygon: [[24, 252], [450, 112], [1076, 112], [1076, 1708], [24, 1708]],
      },
      // 縦文字は写真の上に重ねる(halo=読みやすさ用のごく薄い白フチ)
      slogan: { drawn: true, x: 994, top: 175, height: 1100, maxSize: 72, color: '#111111', halo: '#ffffff' },
      // 名前は写真の左下に重ねる(後ろに暗いぼかし影が入る)
      name: {
        size: 120, weight: 900, spacing: 6,
        adobe: { size: 132, spacing: 17 }, // Apotek(極細の書体)のときの大きさと字間
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

  // バッジに入れる地域(青森県40市町村)。[日本語, ローマ字, 種別, 地図上のx, y(assets/geo.js の座標系。国土数値情報の市町村境界から、各市町村の面積の中心=最大内接円の中心を算出)]
  regions: [
    ['青森市', 'AOMORI', 'CITY', 51.2, 58.2], ['弘前市', 'HIROSAKI', 'CITY', 30.6, 70.4], ['八戸市', 'HACHINOHE', 'CITY', 89.2, 76.6],
    ['黒石市', 'KUROISHI', 'CITY', 47.6, 68.3], ['五所川原市', 'GOSHOGAWARA', 'CITY', 35.0, 50.3], ['十和田市', 'TOWADA', 'CITY', 62.9, 71.6],
    ['三沢市', 'MISAWA', 'CITY', 83.8, 61.7], ['むつ市', 'MUTSU', 'CITY', 63.9, 17.9], ['つがる市', 'TSUGARU', 'CITY', 26.4, 52.2],
    ['平川市', 'HIRAKAWA', 'CITY', 48.0, 77.0],
    ['平内町', 'HIRANAI', 'TOWN', 61.8, 48.2], ['今別町', 'IMABETSU', 'TOWN', 36.0, 29.0], ['蓬田村', 'YOMOGITA', 'VILLAGE', 41.0, 40.0],
    ['外ヶ浜町', 'SOTOGAHAMA', 'TOWN', 39.6, 34.5], ['鰺ヶ沢町', 'AJIGASAWA', 'TOWN', 19.9, 61.9], ['深浦町', 'FUKAURA', 'TOWN', 8.0, 68.2],
    ['西目屋村', 'NISHIMEYA', 'VILLAGE', 20.3, 76.2], ['藤崎町', 'FUJISAKI', 'TOWN', 36.0, 63.5], ['大鰐町', 'OWANI', 'TOWN', 36.6, 77.9],
    ['田舎館村', 'INAKADATE', 'VILLAGE', 38.0, 65.9], ['板柳町', 'ITAYANAGI', 'TOWN', 34.8, 60.0], ['鶴田町', 'TSURUTA', 'TOWN', 31.9, 58.0],
    ['中泊町', 'NAKADOMARI', 'TOWN', 32.6, 40.9], ['野辺地町', 'NOHEJI', 'TOWN', 67.1, 50.3], ['七戸町', 'SHICHINOHE', 'TOWN', 67.6, 59.6],
    ['六戸町', 'ROKUNOHE', 'TOWN', 80.2, 65.8], ['横浜町', 'YOKOHAMA', 'TOWN', 79.0, 33.5], ['東北町', 'TOHOKU', 'TOWN', 74.6, 52.5],
    ['六ヶ所村', 'ROKKASHO', 'VILLAGE', 80.4, 43.6], ['おいらせ町', 'OIRASE', 'TOWN', 85.0, 67.3], ['大間町', 'OMA', 'TOWN', 58.7, 5.8],
    ['東通村', 'HIGASHIDORI', 'VILLAGE', 81.9, 18.0], ['風間浦村', 'KAZAMAURA', 'VILLAGE', 63.9, 6.5], ['佐井村', 'SAI', 'VILLAGE', 56.0, 10.9],
    ['三戸町', 'SANNOHE', 'TOWN', 75.0, 85.9], ['五戸町', 'GONOHE', 'TOWN', 77.4, 76.8], ['田子町', 'TAKKO', 'TOWN', 64.5, 90.7],
    ['南部町', 'NANBU', 'TOWN', 82.0, 81.2], ['階上町', 'HASHIKAMI', 'TOWN', 93.7, 81.5], ['新郷村', 'SHINGO', 'VILLAGE', 69.6, 79.4],
  ],

  // SR以上にかける虹色ホイル/キラキラ(フレームPNG側で表現するなら false)
  foilEffect: true,
};
