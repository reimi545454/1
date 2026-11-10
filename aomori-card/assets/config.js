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
    // 名前: Futura Condensed ExtraBold に近い Big Shoulders Display Black(仮)。斜体はブラウザが自動で付ける
    name: { family: 'AomoriName', url: 'assets/fonts/BigShouldersDisplay-Black-Latin.woff2', weight: '900', style: 'normal' },
    jp: { family: 'AomoriJP', url: 'assets/fonts/NotoSansJP-Medium-subset.woff2', weight: '500', style: 'normal' },
  },

  defaultFrame: 'fisherman',

  /*
   * 画面に出す部品。標準は「写真アップロード → 名前 → つくる」のみ(+ カメラ)。
   *   frameChooser: フレーム選択(複数フレームを出すとき true)
   *   regionSelect: バッジの市町村選択
   *   camera      : 「カメラでその場でとる」ボタン
   */
  ui: { frameChooser: false, regionSelect: false, camera: true },

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
        size: 124, weight: 900, spacing: 7,
        first: { x: 40, y: 1580, maxW: 700 },
        last: { x: 240, y: 1700, maxW: 640 },
        single: { x: 40, y: 1690, maxW: 760 },
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

  // バッジに入れる地域(青森県40市町村)。[日本語, ローマ字, 種別]
  regions: [
    ['青森市', 'AOMORI', 'CITY'], ['弘前市', 'HIROSAKI', 'CITY'], ['八戸市', 'HACHINOHE', 'CITY'],
    ['黒石市', 'KUROISHI', 'CITY'], ['五所川原市', 'GOSHOGAWARA', 'CITY'], ['十和田市', 'TOWADA', 'CITY'],
    ['三沢市', 'MISAWA', 'CITY'], ['むつ市', 'MUTSU', 'CITY'], ['つがる市', 'TSUGARU', 'CITY'],
    ['平川市', 'HIRAKAWA', 'CITY'],
    ['平内町', 'HIRANAI', 'TOWN'], ['今別町', 'IMABETSU', 'TOWN'], ['蓬田村', 'YOMOGITA', 'VILLAGE'],
    ['外ヶ浜町', 'SOTOGAHAMA', 'TOWN'], ['鰺ヶ沢町', 'AJIGASAWA', 'TOWN'], ['深浦町', 'FUKAURA', 'TOWN'],
    ['西目屋村', 'NISHIMEYA', 'VILLAGE'], ['藤崎町', 'FUJISAKI', 'TOWN'], ['大鰐町', 'OWANI', 'TOWN'],
    ['田舎館村', 'INAKADATE', 'VILLAGE'], ['板柳町', 'ITAYANAGI', 'TOWN'], ['鶴田町', 'TSURUTA', 'TOWN'],
    ['中泊町', 'NAKADOMARI', 'TOWN'], ['野辺地町', 'NOHEJI', 'TOWN'], ['七戸町', 'SHICHINOHE', 'TOWN'],
    ['六戸町', 'ROKUNOHE', 'TOWN'], ['横浜町', 'YOKOHAMA', 'TOWN'], ['東北町', 'TOHOKU', 'TOWN'],
    ['六ヶ所村', 'ROKKASHO', 'VILLAGE'], ['おいらせ町', 'OIRASE', 'TOWN'], ['大間町', 'OMA', 'TOWN'],
    ['東通村', 'HIGASHIDORI', 'VILLAGE'], ['風間浦村', 'KAZAMAURA', 'VILLAGE'], ['佐井村', 'SAI', 'VILLAGE'],
    ['三戸町', 'SANNOHE', 'TOWN'], ['五戸町', 'GONOHE', 'TOWN'], ['田子町', 'TAKKO', 'TOWN'],
    ['南部町', 'NANBU', 'TOWN'], ['階上町', 'HASHIKAMI', 'TOWN'], ['新郷村', 'SHINGO', 'VILLAGE'],
  ],

  // SR以上にかける虹色ホイル/キラキラ(フレームPNG側で表現するなら false)
  foilEffect: true,
};
