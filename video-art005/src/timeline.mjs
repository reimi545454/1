// 台本・秒数・字幕の原本。映像（main.mjs）と script.txt はここから生成する。
// 字幕を直すときは、このファイルの文字列だけを編集する。
export const FPS = 30;
export const TOTAL_FRAMES = 1200; // 40秒
export const RAMP = 5; // シーン切り替えのクロスフェード（フレーム）
export const FADE = 9; // 字幕・注釈のフェードイン（0.3秒）

export const ASSETS = {
  roles: '/assets/ART-005_insert_01_roles_v1.png',
  testing: '/assets/ART-005_insert_02_testing_v1.png',
  practice: '/assets/ART-005_insert_03_practice_v1.png',
  banner: '/assets/COACHAI_article_footer_banner.jpg',
};

export const SCENES = [
  {
    id: 1, start: 0, end: 119,
    main: ['Claudeを使える。', 'でも、会社の仕事で止まる。'],
    narration: 'Claudeを使える。でも、会社の仕事に組み込むと、手が止まる。',
  },
  {
    id: 2, start: 120, end: 269,
    questions: [
      { from: 120, to: 164, text: 'どの業務から始める？' },
      { from: 165, to: 209, text: '社内データ、どこまで渡す？' },
      { from: 210, to: 269, text: '担当者が変わったら？' },
    ],
    narration: '業務の選び方、社内データ、担当者が変わったあとの運用。',
  },
  {
    id: 3, start: 270, end: 419,
    title: 'Claude Frontier Academy',
    sub: '企業でClaudeを実装する人材を育てる取り組み',
    narration: 'AnthropicのClaude Frontier Academyが示すのは、企業で実装する人材を育てる視点です。',
  },
  {
    id: 4, start: 420, end: 629,
    main: ['AIが返信案を作る。', '人が確認して、送信する。'],
    sub: 'まず、任せる範囲を決める',
    notes: [
      { at: 465, text: 'AIの準備', x: 420, y: 150 },
      { at: 520, text: '人の確認', x: 1520, y: 215 },
    ],
    narration: '例えば問い合わせ対応。AIが返信案を作り、人が確認してから送信します。',
  },
  {
    id: 5, start: 630, end: 809,
    main: ['うまくいくケースだけでなく、', '情報不足や例外も試す。'],
    sub: '不明なことは、確認待ちへ',
    notes: [
      { at: 655, text: '情報不足', x: 244, y: 178 },
      { at: 690, text: '複数の依頼', x: 490, y: 178 },
      { at: 725, text: '判断できない', x: 782, y: 178 },
      { at: 760, text: '確認待ち', x: 1670, y: 150, strong: true },
    ],
    narration: '情報不足や例外も試して、分からないことは確認待ちにします。',
  },
  {
    id: 6, start: 810, end: 1019,
    main: ['観察 → 試作品 → テスト → 引き継ぎ'],
    sub: '一つの仕事で、使える成果物へ',
    numbers: [
      { at: 840, n: 1, x: 320, y: 340 },
      { at: 885, n: 2, x: 764, y: 250 },
      { at: 930, n: 3, x: 1220, y: 250 },
      { at: 975, n: 4, x: 1656, y: 150 },
    ],
    narration: '業務を観察し、小さく作り、テストして、他の人へ引き継ぐ。',
  },
  {
    id: 7, start: 1020, end: 1199,
    texts: [
      { from: 1020, to: 1109, lines: ['詳しい手順・プロンプトは記事へ'] },
      { from: 1110, to: 1199, lines: ['実務につなげたい方は', 'COACH AIへご相談ください'] },
    ],
    narration: '具体的な手順は記事で解説。実務につなげたい方は、COACH AIへご相談ください。',
  },
];

// プレビュー・サムネイルに使うフレーム
export const PREVIEWS = {
  'ART-005_Claude_Frontier_Academy_X_thumbnail.png': 45, // 冒頭の見出し
  'preview_01.png': 60, // 冒頭
  'preview_04.png': 590, // 役割分担（注釈2つ表示後）
  'preview_07.png': 1190, // 最後
};

export function allText() {
  const t = [];
  for (const s of SCENES) {
    t.push(...(s.main || []), s.sub || '', s.title || '');
    (s.questions || []).forEach((q) => t.push(q.text));
    (s.notes || []).forEach((n) => t.push(n.text));
    (s.numbers || []).forEach((n) => t.push(String(n.n)));
    (s.texts || []).forEach((x) => t.push(...x.lines));
  }
  return t.join('');
}
