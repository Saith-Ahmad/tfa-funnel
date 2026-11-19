/*!
 * just-language-translation.js v1.2.0
 * Language only: Google Translate driven by ?ln=, with the language carried across funnel steps.
 * Supports a per-account default language and rewrites legacy per-language links (/fr, /ru).
 * No theme code, no video swap. Hosted remotely so one update ships to every sub-account.
 *
 * LOAD IT IN THE FUNNEL-LEVEL HEAD TRACKING CODE (applies to every step), config line first:
 *   <script>window.TFA_CONFIG = { defaultLang: '{{custom_values.default_language_code}}' };</script>
 *   <script src="https://cdn.jsdelivr.net/gh/Saith-Ahmad/tfa-funnel@COMMIT_OR_TAG/just-language-translation.js" defer></script>
 *
 * Language order of precedence:
 *   1. ?ln= in the URL (a supported code, or en for English)
 *   2. the visitor's earlier choice in this session (sessionStorage, including an explicit English)
 *   3. the account default (custom value default_language_code)
 *   4. English
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
    'hu', 'bg', 'cs', 'sk', 'ro', 'hi', 'zh-CN', 'ja', 'ko', 'ar', 'pl', 'ru'
  ];

  // Case-insensitive match so ?ln=zh-cn or ?ln=HI still resolve to the exact Google code.
  // Returns null for English, for junk, and for an unresolved merge tag.
  function normalize(code) {
    if (!code) return null;
    var lower = String(code).trim().toLowerCase();
    for (var i = 0; i < ALLOWED.length; i++) {
      if (ALLOWED[i].toLowerCase() === lower) return ALLOWED[i];
    }
    return null;
  }

  // Account default, from the funnel header: window.TFA_CONFIG = { defaultLang: '{{custom_values.default_language_code}}' }
  // An empty value, a typo, or a merge tag that was never resolved all normalize to null, which means English.
  var cfg = window.TFA_CONFIG || {};
  var defaultLang = normalize(cfg.defaultLang);

  var raw = null;
  try { raw = new URLSearchParams(window.location.search).get('ln'); } catch (e) {}

  var fromUrl = normalize(raw);                                         // a supported language in the URL
  var urlEnglish = raw !== null && String(raw).trim().toLowerCase() === 'en'; // explicit English in the URL

  var stored = null;
  try { stored = sessionStorage.getItem(STORE_KEY); } catch (e) {}
  var storedLang = normalize(stored);
  var storedEnglish = stored === 'en';

  var lang = null;      // the active non-English language, or null for English
  var english = false;  // true when English was chosen explicitly (this URL or an earlier step)

  if (fromUrl) {
    lang = fromUrl;
  } else if (urlEnglish) {
    english = true;
  } else if (storedLang) {
    lang = storedLang;
  } else if (storedEnglish) {
    english = true;
  } else {
    // No ln, or an unknown value like ?ln=hrm, and no earlier choice: use the account default
    lang = defaultLang;
  }

  // Remember only what the visitor chose. The account default is a fallback, not a choice,
  // so it is not stored; that way changing default_language_code takes effect for new visits.
  // An explicit English is stored too, so the next step doesn't fall back to the default.
  try {
    if (fromUrl) sessionStorage.setItem(STORE_KEY, fromUrl);
    else if (urlEnglish) sessionStorage.setItem(STORE_KEY, 'en');
  } catch (e) {}

  // Shared with other scripts and with the language switcher
  window.OL_LANG = lang || 'en';
  log('resolved language:', window.OL_LANG, '| default:', defaultLang, '| explicit English:', english);

  // Keep the URL in step with the active language, so the form's hidden field (Query Key "ln")
  // reads a clean value on every step. This rewrites the URL when:
  //   - ln is missing but a language is active (earlier choice or account default)
  //   - English was chosen earlier in this session
  //   - ln holds junk (?ln=hrm) or the wrong case (?ln=HI); without this the CRM would store the raw text
  // A visitor on a plain English funnel with no ln keeps an untouched URL.
  var wanted = lang || (english ? 'en' : null);
  if (!wanted && raw !== null) wanted = 'en'; // junk with nothing else to fall back to
  if (wanted && raw !== wanted) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('ln', wanted);
      // Pass the existing history.state through so GHL's router state isn't lost
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      log('URL ln set to', wanted);
    } catch (e) {
      console.warn('[OL Lang] could not update ln param:', e);
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

/* =========================================================
   3. LEGACY LANGUAGE LINKS: /fr, /ru ... -> current page + ?ln=
   The old setup had one funnel per language, so existing switchers link to /fr, /ru, etc.
   With one funnel those paths no longer exist. This turns such a click into
   "same page, same params, only ln replaced". It sits outside the language block on purpose,
   because that block returns early for English visitors and the links must work for them too.
   ========================================================= */
(function () {
  if (window.__olLegacyLinks) return;
  window.__olLegacyLinks = true;

  // A bare language path: /fr, /ru, /zh-CN, optional trailing slash. Nothing deeper (so /fr/thanks is left alone)
  var LANG_PATH = /^\/([a-z]{2}(?:-[a-z]{2})?)\/?$/i;

  // Capture phase, so this runs before GHL's own link handling can navigate away
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;

    var link;
    try { link = new URL(a.getAttribute('href'), window.location.href); } catch (err) { return; }

    // Only same-site links; a link to another domain is never ours to rewrite
    if (link.origin !== window.location.origin) return;

    var m = LANG_PATH.exec(link.pathname);
    // Skip links that already point at the current page (for example the new ?ln= switcher)
    if (!m || link.pathname === window.location.pathname) return;

    e.preventDefault();
    e.stopPropagation();

    // Base URL stays the same: current path and params, only ln replaced
    var next = new URL(window.location.href);
    next.searchParams.set('ln', m[1]);
    next.hash = ''; // a hash-only difference would not reload the page
    window.location.assign(next.pathname + next.search);
  }, true);
})();
