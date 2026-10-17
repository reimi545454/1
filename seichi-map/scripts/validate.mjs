// data/spots.json の検証。CI・デプロイ前に `node scripts/validate.mjs` で実行する。
import { readFileSync } from 'node:fs';

const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const CATEGORIES = ['anime','manga','movie','drama','game'];
// 日本の領域(沖ノ鳥島〜択捉島を含む外接矩形)。日本国外の登録を弾く最終防衛線。
const BOUNDS = { latMin: 20.4, latMax: 45.6, lngMin: 122.9, lngMax: 154.0 };

const data = JSON.parse(readFileSync(new URL('../data/spots.json', import.meta.url), 'utf8'));
const errors = [];
const ids = new Set();

if (!Array.isArray(data.spots) || data.spots.length === 0) errors.push('spots が空です');

for (const s of data.spots ?? []) {
  const where = `[${s.id ?? '(id なし)'}]`;
  if (!/^[a-z0-9-]+$/.test(s.id ?? '')) errors.push(`${where} id は英小文字・数字・ハイフンのみ`);
  if (ids.has(s.id)) errors.push(`${where} id が重複`);
  ids.add(s.id);
  for (const k of ['name', 'work', 'desc']) {
    if (typeof s[k] !== 'string' || !s[k].trim()) errors.push(`${where} ${k} が空`);
  }
  if (!CATEGORIES.includes(s.category)) errors.push(`${where} category 不正: ${s.category}`);
  if (!PREFS.includes(s.prefecture)) errors.push(`${where} prefecture 不正: ${s.prefecture}`);
  if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) {
    errors.push(`${where} 座標が数値ではありません`);
  } else if (s.lat < BOUNDS.latMin || s.lat > BOUNDS.latMax || s.lng < BOUNDS.lngMin || s.lng > BOUNDS.lngMax) {
    errors.push(`${where} 座標が日本の範囲外: ${s.lat}, ${s.lng}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `NG ${e}`).join('\n'));
  process.exit(1);
}
console.log(`OK: ${data.spots.length} 件を検証しました`);
