/* LP の動き。依存なしの素の JavaScript。
 * config.js（window.LP_CONFIG）の値を読み、リンク先の設定・計測タグの読み込み・追従ボタンの出し入れを行う。 */
(function () {
  'use strict';

  // ID に使える文字（英数字とハイフンだけ）。設定の書き間違いでタグを壊さないための確認
  function isSafeId(v) {
    return typeof v === 'string' && /^[A-Za-z0-9-]{4,40}$/.test(v);
  }

  // リンク先に使える形。https:// で始まるもの、ページ内リンク（#）、同じサイトの相対パスだけ。
  // 先頭が // のもの、https 以外の通信、スクリプトを走らせる書き方は使わない。空白・制御文字・バックスラッシュを含むものも使わない
  function safeUrl(v) {
    if (typeof v !== 'string' || !v) return false;
    if (/[\s\u0000-\u001f\u007f\\]/.test(v)) return false;
    if (/^https:\/\/[^/]/i.test(v)) return true;
    if (/^#/.test(v)) return true;
    if (/^\.{1,2}\//.test(v)) return true;
    if (/^\/(?!\/)/.test(v)) return true;
    return /^[A-Za-z0-9_%-][^:]*$/.test(v);  // privacy.html のような、同じ場所のファイル名
  }

  if (typeof document === 'undefined') {
    // Node から関数だけ確かめるとき
    if (typeof module !== 'undefined') module.exports = { isSafeId: isSafeId, safeUrl: safeUrl };
    return;
  }

  // 貼り付けで付きやすい前後の空白は、確かめる前に取る
  var cfg = {};
  var raw = window.LP_CONFIG || {};
  Object.keys(raw).forEach(function (k) { cfg[k] = typeof raw[k] === 'string' ? raw[k].trim() : raw[k]; });

  function loadScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  // ---- リンク先 ----
  function setLinks() {
    var cta = safeUrl(cfg.ctaUrl) ? cfg.ctaUrl : '';
    var els = document.querySelectorAll('[data-cta]');
    for (var i = 0; i < els.length; i++) {
      if (cta) {
        els[i].setAttribute('href', cta);
      } else {
        // リンク先が未設定のあいだは、押してもページの先頭に戻らないようにする
        els[i].addEventListener('click', function (e) { e.preventDefault(); });
      }
    }
    var pairs = [['privacy', cfg.privacyUrl], ['tokusho', cfg.tokushoUrl]];
    pairs.forEach(function (p) {
      var list = document.querySelectorAll('[data-link="' + p[0] + '"]');
      for (var j = 0; j < list.length; j++) {
        if (safeUrl(p[1])) list[j].setAttribute('href', p[1]);
        else list[j].style.display = 'none';
      }
    });
    // 両方のリンクが隠れたら、リンクの段ごと隠す
    var box = document.querySelector('.lp-legal__links');
    if (box && !safeUrl(cfg.privacyUrl) && !safeUrl(cfg.tokushoUrl)) box.style.display = 'none';
  }

  // ---- 計測タグ（ID があるものだけ読み込む）----
  function initGa4(id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
  }

  function initMeta(id) {
    if (window.fbq) return;
    var n = window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function initClarity(id) {
    (function (c, l, a, r, i) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      var t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      var y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  function setTracking() {
    if (isSafeId(cfg.ga4Id)) initGa4(cfg.ga4Id);
    if (isSafeId(cfg.metaPixelId)) initMeta(cfg.metaPixelId);
    if (isSafeId(cfg.clarityId)) initClarity(cfg.clarityId);
    // 申込ボタンを押したとき、タグが使えるときだけイベントを送る
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
      if (!el) return;
      var where = el.hasAttribute('data-cta-sticky') ? 'sticky' : (el.hasAttribute('data-cta-fv') ? 'fv' : 'body');
      if (typeof window.gtag === 'function') window.gtag('event', 'cta_click', { cta_position: where });
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'cta_click', { cta_position: where });
    });
  }

  // ---- 追従ボタン ----
  function setSticky() {
    var sticky = document.querySelector('.lp-sticky');
    if (!sticky) return;
    function show(on) {
      sticky.classList.toggle('is-visible', on);
      sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    var fvBtn = document.querySelector('[data-cta-fv]');
    if (fvBtn && 'IntersectionObserver' in window) {
      // FV のボタンが画面に見えている間だけ隠す。まだ画面の下にあるとき（最初の画面の外）も、通り過ぎたあとも出す
      new IntersectionObserver(function (entries) {
        var en = entries[entries.length - 1];
        show(!en.isIntersecting);
      }).observe(fvBtn);
    } else {
      // FV のボタンが無いページは、少しスクロールしたら出す
      var onScroll = function () { show((window.pageYOffset || document.documentElement.scrollTop) > 120); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  setLinks();
  setTracking();
  setSticky();
})();
