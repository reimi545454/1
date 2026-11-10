'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/lib.js');

test('pickRank: 乱数の両端で最小・最大ランクを返す', () => {
  assert.equal(L.pickRank(() => 0).id, 'N');
  assert.equal(L.pickRank(() => 0.9999999).id, 'SP');
  // 範囲外の乱数でも落ちない
  assert.equal(L.pickRank(() => 5).id, 'SP');
  assert.equal(L.pickRank(() => -1).id, 'N');
});

test('pickRank: 排出率が設定どおり(100万回の試行で±1%以内)', () => {
  const counts = {};
  const n = 1_000_000;
  for (let i = 0; i < n; i++) {
    const id = L.pickRank(Math.random).id;
    counts[id] = (counts[id] || 0) + 1;
  }
  const total = L.RANKS.reduce((s, r) => s + r.weight, 0);
  for (const r of L.RANKS) {
    const actual = (counts[r.id] / n) * 100;
    const expected = (r.weight / total) * 100;
    assert.ok(Math.abs(actual - expected) < 1, `${r.id}: ${actual} vs ${expected}`);
  }
});

test('kanaToRomaji: 基本・拗音・促音・長音', () => {
  assert.equal(L.kanaToRomaji('しんいち'), 'shinichi');
  assert.equal(L.kanaToRomaji('シンイチ'), 'shinichi');
  assert.equal(L.kanaToRomaji('ゆうき'), 'yuki');
  assert.equal(L.kanaToRomaji('きょうこ'), 'kyoko');
  assert.equal(L.kanaToRomaji('さっぽろ'), 'sapporo');
  assert.equal(L.kanaToRomaji('じゅん'), 'jun');
  assert.equal(L.kanaToRomaji('おおの'), 'ono');
  assert.equal(L.kanaToRomaji('ちゃみ'), 'chami');
  assert.equal(L.kanaToRomaji('まっちゃ'), 'matcha');
  assert.equal(L.kanaToRomaji('ヒロシー'), 'hiroshi');
});

test('toRomajiName: 英字は大文字化、全角は半角化、かな混在OK', () => {
  assert.deepEqual(L.toRomajiName('shinichi'), { text: 'SHINICHI', invalid: false });
  assert.deepEqual(L.toRomajiName('ｙｏｋｏｎｏ'), { text: 'YOKONO', invalid: false });
  assert.deepEqual(L.toRomajiName('  よこの  '), { text: 'YOKONO', invalid: false });
  assert.deepEqual(L.toRomajiName("Mary-Ann O'Neil"), { text: "MARY-ANN O'NEIL", invalid: false });
  assert.deepEqual(L.toRomajiName(''), { text: '', invalid: false });
  assert.deepEqual(L.toRomajiName(undefined), { text: '', invalid: false });
});

test('toRomajiName: 漢字・絵文字は invalid(自動変換できない)', () => {
  assert.equal(L.toRomajiName('横野').invalid, true);
  assert.equal(L.toRomajiName('SHIN一').invalid, true);
  assert.equal(L.toRomajiName('A😀').invalid, true);
});

test('coverRect: 枠をはみ出さず、ずらし量は補正される', () => {
  const r = L.coverRect(1000, 500, 400, 600, 1, 0, 0);
  // 高さ基準で拡大 → 幅 1200×高さ 600
  assert.equal(r.h, 600);
  assert.equal(r.w, 1200);
  assert.equal(r.x, -400);
  // 大きくずらしても端で止まる
  const far = L.coverRect(1000, 500, 400, 600, 1, 99999, 99999);
  assert.equal(far.ox, 400);
  assert.equal(far.oy, 0);
  assert.ok(far.x <= 0 && far.x + far.w >= 400);
  // zoom は 1〜6 に丸める
  assert.equal(L.coverRect(100, 100, 100, 100, 0.2, 0, 0).zoom, 1);
  assert.equal(L.coverRect(100, 100, 100, 100, 99, 0, 0).zoom, 6);
});

test('centerCrop: 指定比率で中央を切り出す', () => {
  const wide = L.centerCrop(1920, 1080, 0.5);
  assert.deepEqual(wide, { sx: 690, sy: 0, sw: 540, sh: 1080 });
  const tall = L.centerCrop(1000, 3000, 0.5);
  assert.deepEqual(tall, { sx: 0, sy: 500, sw: 1000, sh: 2000 });
});

test('fitWithin: 長辺を上限に収め、拡大はしない', () => {
  assert.deepEqual(L.fitWithin(4000, 3000, 2000), { w: 2000, h: 1500 });
  assert.deepEqual(L.fitWithin(800, 600, 2000), { w: 800, h: 600 });
});
