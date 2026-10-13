/* ==========================================================================
   お問い合わせフォーム（入力検証）
   --------------------------------------------------------------------------
   ・ブラウザ側の検証です。送信自体は <form action="submit.php" method="POST"> が行います
     （ブルーベリーLPと同じ方式。検証OKなら preventDefault せず、そのままPOST）。
   ・サーバー側（submit.php）でも同じ項目を再検証します。ここだけを信用しないこと。
   ・必須項目を変えるときは、下の RULES・index.html の required・submit.php の3か所を揃える。
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = document.getElementById('form-submit');
  var statusBox = document.getElementById('form-status');
  var formUrl = document.getElementById('form-url');
  if (formUrl) formUrl.value = window.location.href.split('#')[0];

  // 検証ルール（name属性 → 検証関数。エラーメッセージを返す／OKなら空文字）
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var RULES = {
    company: function (el) { return el.value.trim() ? '' : '会社名を入力してください。'; },
    name: function (el) { return el.value.trim() ? '' : 'ご担当者名を入力してください。'; },
    email: function (el) {
      var v = el.value.trim();
      if (!v) return 'メールアドレスを入力してください。';
      return EMAIL_RE.test(v) ? '' : 'メールアドレスの形式が正しくありません。（例：name@example.com）';
    },
    agree: function (el) { return el.checked ? '' : '個人情報の取扱いへの同意が必要です。'; }
  };
  var ORDER = ['company', 'name', 'email', 'agree'];

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

  // 入力中・離脱時に、一度エラーになった欄だけ再検証（入力途中で責めない）
  ORDER.forEach(function (name) {
    var el = form.elements[name];
    var evt = el.type === 'checkbox' ? 'change' : 'blur';
    el.addEventListener(evt, function () { validate(name); });
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
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
