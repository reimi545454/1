/* ==========================================================================
   お問い合わせフォーム（入力検証）— index.html / estimate.html 共通
   --------------------------------------------------------------------------
   ・ブラウザ側の検証です。送信自体は <form action="submit.php" method="POST"> が行います
     （検証OKなら preventDefault せず、そのままPOST）。
   ・サーバー側（submit.php）でも同じ項目を再検証します。ここだけを信用しないこと。
   ・必須項目を変えるときは、下の RULES・HTMLの required・submit.php の3か所を揃える。
   ・ルール: 「配布予定人数」を入力したら「配布予定kg数」も必須。
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = document.getElementById('form-submit');
  var statusBox = document.getElementById('form-status');
  var formUrl = document.getElementById('form-url');
  if (formUrl) formUrl.value = window.location.href.split('#')[0];

  // 全角数字・カンマ・空白を取り除いて半角数字の文字列にする（submit.php 側も同じ処理）
  function normalizeNumber(v) {
    return String(v || '')
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[．。]/g, '.')
      .replace(/[,\s、，]/g, '');
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MAX_PEOPLE = 100000;
  var MAX_KG = 10000000;

  // 検証ルール（name属性 → 検証関数。エラーメッセージを返す／OKなら空文字）
  var RULES = {
    company: function (el) { return el.value.trim() ? '' : '会社名を入力してください。'; },
    name: function (el) { return el.value.trim() ? '' : 'ご担当者名を入力してください。'; },
    email: function (el) {
      var v = el.value.trim();
      if (!v) return 'メールアドレスを入力してください。';
      return EMAIL_RE.test(v) ? '' : 'メールアドレスの形式が正しくありません。（例：name@example.com）';
    },
    people: function (el) {
      var v = normalizeNumber(el.value);
      if (!v) return '';
      if (!/^\d+$/.test(v)) return '人数は半角数字で入力してください。（例：50）';
      var n = parseInt(v, 10);
      return n >= 1 && n <= MAX_PEOPLE ? '' : '人数は1〜' + MAX_PEOPLE.toLocaleString('ja-JP') + 'の範囲で入力してください。';
    },
    kg: function (el) {
      var v = normalizeNumber(el.value);
      var people = normalizeNumber(form.elements.people.value);
      if (!v) return people ? '配布予定人数を入力した場合は、kg数も入力してください。' : '';
      if (!/^\d+(\.\d+)?$/.test(v)) return 'kg数は半角数字で入力してください。（例：300）';
      var n = parseFloat(v);
      return n > 0 && n <= MAX_KG ? '' : 'kg数は0より大きい数値で入力してください。';
    },
    agree: function (el) { return el.checked ? '' : '個人情報の取扱いへの同意が必要です。'; }
  };
  var ORDER = ['company', 'name', 'email', 'people', 'kg', 'agree'];

  function setError(name, message) {
    var el = form.elements[name];
    var box = document.getElementById(name + '-error');
    var field = el.closest('.field');
    if (message) {
      box.textContent = message;
      box.hidden = false;
      field.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
    } else {
      box.textContent = '';
      box.hidden = true;
      field.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    }
    return !message;
  }

  function validate(name) { return setError(name, RULES[name](form.elements[name])); }

  // 人数が入っているときだけ、kg欄のラベルを「必須」にする
  var kgTag = document.getElementById('kg-tag');
  function syncKgRequired() {
    var need = !!normalizeNumber(form.elements.people.value);
    if (kgTag) {
      kgTag.textContent = need ? '必須' : '任意';
      kgTag.classList.toggle('tag--required', need);
    }
    form.elements.kg.setAttribute('aria-required', need ? 'true' : 'false');
  }
  syncKgRequired();

  // 入力中・離脱時に再検証（入力途中で責めない：一度エラーになった欄のみ入力中も再検証）
  ORDER.forEach(function (name) {
    var el = form.elements[name];
    var isCheck = el.type === 'checkbox';
    el.addEventListener(isCheck ? 'change' : 'blur', function () { validate(name); });
    el.addEventListener(isCheck ? 'change' : 'input', function () {
      if (name === 'people') {
        syncKgRequired();
        if (form.elements.kg.closest('.field').classList.contains('is-invalid')) validate('kg');
      }
      if (el.closest('.field').classList.contains('is-invalid')) validate(name);
    });
  });

  form.addEventListener('submit', function (e) {
    var firstInvalid = null;
    ORDER.forEach(function (name) {
      if (!validate(name) && !firstInvalid) firstInvalid = form.elements[name];
    });

    if (firstInvalid) {
      e.preventDefault();
      statusBox.textContent = '入力内容をご確認ください。赤字の項目をご入力のうえ、もう一度お試しください。';
      statusBox.hidden = false;
      firstInvalid.focus();
      return;
    }

    // 検証OK。数値は半角に整えてから送る（サーバー側でも同じ処理をする）
    form.elements.people.value = normalizeNumber(form.elements.people.value);
    form.elements.kg.value = normalizeNumber(form.elements.kg.value);

    statusBox.hidden = true;
    // 二重送信防止。検証OKなので、ここでは止めずに submit.php へそのままPOSTされる。
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中です…';
  });

  // 「戻る」で戻った場合（bfcache）にボタンが無効のままになるのを防ぐ
  window.addEventListener('pageshow', function () {
    submitBtn.disabled = false;
    submitBtn.textContent = 'お問い合わせを送信する';
  });
})();
