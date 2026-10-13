/* ==========================================================================
   計測タグ（Meta Pixel / GA4 / GTM）
   --------------------------------------------------------------------------
   ・このLP専用のIDを下の TRACKING に貼るだけで有効になります。
     空文字（''）のままのタグは何も読み込みません（ブルーベリーLPとは別のIDを使う前提）。
   ・ブルーベリーLPのID（GTM-K46LWZX6 / G-1GNJMDYLBM / G-SQGCT1G3DG / 1121501496967440）は
     区別のため、ここには入れないこと。
   ・index.html（body の data-page="lp"）では PageView、
     thanks.html（data-page="thanks"）では PageView + Lead（GA4は generate_lead）を送ります。
     = 送信完了ページの表示を「お問い合わせ完了（コンバージョン）」として計測。
   ・thanks.html をリロードしても二重計測しないよう、同一タブでは1回だけ送ります。
   ========================================================================== */
(function () {
  'use strict';

  var TRACKING = {
    metaPixelId: '',   // 例: '1234567890123456'（Meta ビジネスマネージャで新規作成したピクセルID）
    ga4Id: '',         // 例: 'G-XXXXXXXXXX'
    gtmId: ''          // 例: 'GTM-XXXXXXX'
  };

  var page = document.body ? document.body.getAttribute('data-page') : '';
  var isThanks = page === 'thanks';

  // 完了ページの二重計測防止（storageが使えない環境ではそのまま計測）
  var fireLead = isThanks;
  if (isThanks) {
    try {
      if (sessionStorage.getItem('newez_lead_sent') === '1') fireLead = false;
      else sessionStorage.setItem('newez_lead_sent', '1');
    } catch (e) { /* 何もしない */ }
  }

  // ---- Google Tag Manager ----
  if (TRACKING.gtmId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var gtm = document.createElement('script');
    gtm.async = true;
    gtm.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(TRACKING.gtmId);
    document.head.appendChild(gtm);
    if (fireLead) window.dataLayer.push({ event: 'generate_lead' });
  }

  // ---- GA4 ----
  if (TRACKING.ga4Id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TRACKING.ga4Id);
    document.head.appendChild(ga);
    window.gtag('js', new Date());
    window.gtag('config', TRACKING.ga4Id);
    if (fireLead) window.gtag('event', 'generate_lead');
  }

  // ---- Meta Pixel ----
  if (TRACKING.metaPixelId) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', TRACKING.metaPixelId);
    window.fbq('track', 'PageView');
    if (fireLead) window.fbq('track', 'Lead');
  }
})();
