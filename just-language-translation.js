/*!
 * just-language-translation.js v1.0.0
 * Language only: Google Translate driven by ?ln=, with the language carried across funnel steps.
 * No theme code, no video swap. Hosted remotely so one update ships to every sub-account.
 *
 * LOAD IT IN THE FUNNEL-LEVEL HEAD TRACKING CODE (applies to every step):
 *   <script src="https://cdn.jsdelivr.net/gh/Saith-Ahmad/tfa-funnel@COMMIT_OR_TAG/just-language-translation.js" defer></script>
 *
 * Why defer is safe: this file only sets the googtrans cookie and registers the init callback.
 * Google's element.js is injected after window load, so the cookie always exists before Google reads it.
 */

/* =========================================================
   1. GOOGLE TRANSLATE UI: hidden
   Injected as a <style> tag from here, so the CSS ships with the script
   and needs no separate copy in each account
   ========================================================= */
(function () {
  if (document.getElementById('tfa-google-hide')) return;

  var css = [
    '#google_translate_element { display: none !important; }',
    /* Top banner (old and new class names) */
    '.goog-te-banner-frame, iframe.skiptranslate, .skiptranslate > iframe, .VIpgJd-ZVi9od-ORHb-OEVmcd { display: none !important; }',
    /* Loading spinner; the prefix match survives small suffix changes */
    '.goog-te-spinner-pos, .goog-te-spinner-animation, [class^="VIpgJd-ZVi9od-aZ2wEe"], [class*=" VIpgJd-ZVi9od-aZ2wEe"] { display: none !important; }',
    /* Hover tooltip and highlight on translated text */
    '.goog-tooltip, .VIpgJd-yAWNEb-L7lbkb, .VIpgJd-yAWNEb-hvhgNd { display: none !important; }',
    '.goog-text-highlight, .VIpgJd-yAWNEb-VIpgJd-fmcmS-sn54Q { background: none !important; box-shadow: none !important; }',
    /* Google pushes body down to make room for the banner; undo that */
    'body { top: 0 !important; position: static !important; }'
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'tfa-google-hide';
  style.textContent = css;
  // In the head when loaded as recommended; falls back to <html> if this ever runs before <head> exists
  (document.head || document.documentElement).appendChild(style);
})();

/* =========================================================
   2. LANGUAGE (Google Translate driven by ?ln=)
   ========================================================= */
(function () {
  // Run once per page, even if this file is accidentally loaded twice
  if (window.__olLangInit) return;
  window.__olLangInit = true;

  var DEBUG = false; // set to true only while testing; logs to the console
  function log() { if (DEBUG) console.log.apply(console, ['[OL Lang]'].concat([].slice.call(arguments))); }

  var STORE_KEY = 'ol_lang';
  var ALLOWED = [
    'es', 'de', 'fr', 'it', 'pt', 'nl', 'da', 'fi', 'el',
    'hu', 'bg', 'cs', 'sk', 'ro', 'hi', 'zh-CN', 'ja', 'ko', 'ar', 'pl'
  ];

  // Case-insensitive match so ?ln=zh-cn or ?ln=HI still resolve to the exact Google code
  function normalize(code) {
    if (!code) return null;
    var lower = String(code).trim().toLowerCase();
    for (var i = 0; i < ALLOWED.length; i++) {
      if (ALLOWED[i].toLowerCase() === lower) return ALLOWED[i];
    }
    return null;
  }

  // Resolve the language: URL param wins, sessionStorage carries it across funnel steps
  var raw = null;
  try { raw = new URLSearchParams(window.location.search).get('ln'); } catch (e) {}

  var lang = null;
  if (raw !== null) {
    // An explicit param is the visitor's intent: 'en' or an unknown code means English
    lang = normalize(raw);
    try {
      if (lang) sessionStorage.setItem(STORE_KEY, lang);
      else sessionStorage.removeItem(STORE_KEY);
    } catch (e) {}
  } else {
    try { lang = normalize(sessionStorage.getItem(STORE_KEY)); } catch (e) {}
  }

  // Exposed so a form field or a later script can read the active language without re-parsing
  window.OL_LANG = lang || 'en';
  log('resolved language:', window.OL_LANG);

  // Put ?ln= back in the URL when it came from sessionStorage. This keeps shared links in the
  // same language, and lets a hidden form field with Query Key "ln" read it on every step.
  if (raw === null && lang) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('ln', lang);
      // Pass the existing history.state through so GHL's router state isn't lost
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      log('restored ?ln=' + lang + ' to URL');
    } catch (e) {
      console.warn('[OL Lang] could not restore ln param:', e);
    }
  }

  // Cookies: clear every googtrans variant, then set the active one
  var host = window.location.hostname;
  var rootDomain = host.split('.').slice(-2).join('.');

  function clearGoogleCookies() {
    var paths = ['/', window.location.pathname];
    var domains = ['', host, '.' + host, '.' + rootDomain];
    domains.forEach(function (dom) {
      paths.forEach(function (pth) {
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT;' +
          (dom ? ' domain=' + dom + ';' : '') + ' path=' + pth + ';';
      });
    });
  }

  clearGoogleCookies();

  // English: stop here, so Google never loads and stale cookies are already gone
  if (!lang) return;

  document.cookie = 'googtrans=/en/' + lang + '; path=/;';
  if (rootDomain && rootDomain.indexOf('.') !== -1) {
    document.cookie = 'googtrans=/en/' + lang + '; path=/; domain=.' + rootDomain + ';';
  }

  // Google adds translated-ltr / translated-rtl to <html> once the page is translated
  function isTranslated() {
    var cls = document.documentElement.className || '';
    return cls.indexOf('translated-ltr') !== -1 || cls.indexOf('translated-rtl') !== -1;
  }

  // Fallback: drive the hidden dropdown until the page is actually translated
  function forceLanguage() {
    var tries = 0;
    var maxTries = 40; // 40 x 300 ms = 12 s
    var timer = setInterval(function () {
      tries++;
      if (isTranslated()) {
        log('translated after', tries, 'checks');
        clearInterval(timer);
        return;
      }
      var combo = document.querySelector('select.goog-te-combo');
      // Re-dispatch when the value is wrong, or every 5th tick if Google ignored the first change
      if (combo && (combo.value !== lang || tries % 5 === 0)) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
        log('dropdown set to', lang);
      }
      if (tries >= maxTries) {
        clearInterval(timer);
        console.warn('[OL Lang] page not translated after 12 s (blocked script or cookies?)');
      }
    }, 300);
  }

  // Global callback name required by element.js (?cb=googleTranslateElementInit)
  window.googleTranslateElementInit = function () {
    try {
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: ALLOWED.join(','), // keeps the hidden dropdown to the whitelist
        autoDisplay: false
      }, 'google_translate_element');
      log('widget initialised');
    } catch (e) {
      console.warn('[OL Lang] widget init failed:', e);
    }
    forceLanguage();
  };

  // Load Google after the page is fully rendered, so GHL can't overwrite the translation
  function boot() {
    // The container must exist before element.js calls back
    if (!document.getElementById('google_translate_element')) {
      var box = document.createElement('div');
      box.id = 'google_translate_element';
      document.body.appendChild(box);
    }

    // Already loaded: just init
    if (window.google && google.translate && google.translate.TranslateElement) {
      window.googleTranslateElementInit();
      return;
    }

    // Already requested elsewhere: don't load a second copy
    if (document.querySelector('script[src*="translate_a/element.js"]')) {
      log('element.js already on page, waiting for its callback');
      forceLanguage();
      return;
    }

    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.body.appendChild(s);
  }

  // A short delay after load gives GHL time to finish its last render
  if (document.readyState === 'complete') {
    setTimeout(boot, 200);
  } else {
    window.addEventListener('load', function () { setTimeout(boot, 200); });
  }
})();
