(() => {
  'use strict';
  document.documentElement.classList.add('js');

  // スクロールリビール
  const targets = document.querySelectorAll('.section .container > *, .stats li');
  targets.forEach(el => el.classList.add('sr'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    targets.forEach(el => io.observe(el));
  } else targets.forEach(el => el.classList.add('in'));

  // モバイル固定CTA（ヒーロー通過後〜申し込み欄到達前に表示）
  const sticky = document.getElementById('sticky');
  const entry = document.getElementById('entry');
  const onScroll = () => {
    const y = window.scrollY, entryTop = entry.getBoundingClientRect().top;
    sticky.classList.toggle('show', y > window.innerHeight * 0.8 && entryTop > window.innerHeight * 0.5);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // プランボタン → フォームのプラン選択に反映
  const form = document.getElementById('entry-form');
  const planSel = form.elements.plan;
  document.querySelectorAll('[data-plan]').forEach(a =>
    a.addEventListener('click', () => { planSel.value = a.dataset.plan; }));

  // バリデーション
  const rules = {
    name: v => v.trim() ? '' : 'お名前を入力してください。',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形式が正しくありません。',
    tel: v => !v || /^[0-9０-９+\-()\s]{10,15}$/.test(v) ? '' : '電話番号の形式が正しくありません。',
    plan: v => v ? '' : 'プランを選択してください。',
    agree: (v, el) => el.checked ? '' : 'プライバシーポリシーへの同意が必要です。'
  };
  const setErr = (name, msg) => {
    const el = form.elements[name], box = document.getElementById('e-' + name);
    box.textContent = msg;
    el.closest('.field').classList.toggle('invalid', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el.setAttribute('aria-describedby', box.id); else el.removeAttribute('aria-describedby');
    return !msg;
  };
  const check = name => setErr(name, rules[name](form.elements[name].value, form.elements[name]));
  Object.keys(rules).forEach(n => form.elements[n].addEventListener('blur', () => check(n)));

  const status = document.getElementById('status');
  const btn = document.getElementById('submit');
  const say = (msg, cls) => { status.textContent = msg; status.className = 'form-status ' + (cls || ''); };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const results = Object.keys(rules).map(check);
    if (results.includes(false)) {
      say('入力内容をご確認ください。', 'ng');
      const first = form.querySelector('.invalid input, .invalid select');
      if (first) first.focus();
      return;
    }
    if (form.elements.website.value) return; // honeypot（ボットは成功したように見せて破棄）

    const data = Object.fromEntries(new FormData(form));
    delete data.website;
    const endpoint = form.dataset.endpoint;

    // エンドポイント未設定時はメールソフト起動にフォールバック
    if (!endpoint) {
      const body = `お名前：${data.name}\nメール：${data.email}\n電話：${data.tel || '-'}\nプラン：${data.plan}\n\n${data.message || ''}`;
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('田んぼオーナー申し込み')}&body=${encodeURIComponent(body)}`;
      say('メールソフトが起動します。送信して完了してください。', 'ok');
      return;
    }

    btn.disabled = true; say('送信中です…');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      say('お申し込みを受け付けました。3営業日以内にメールでご案内します。', 'ok');
    } catch {
      say('送信に失敗しました。時間をおいて再度お試しいただくか、お電話でご連絡ください。', 'ng');
    } finally {
      clearTimeout(timer); btn.disabled = false;
    }
  });
})();
