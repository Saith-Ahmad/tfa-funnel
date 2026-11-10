/*!
 * tfa.js v1.0.0
 * Theme + language (?ln=) + Bunny video swap for The Frequency Awakening GHL funnels.
 * Hosted remotely so one update ships to every sub-account.
 *
 * LOAD IT SYNCHRONOUSLY IN THE HEAD (no defer / async), after window.TFA_CONFIG:
 *   <script>window.TFA_CONFIG = { theme: '{{custom_values.site_theme}}', toggle: '{{custom_values.theme_toggle}}' };</script>
 *   <script src="https://cdn.jsdelivr.net/gh/OWNER/tfa-funnel@v1.0.0/tfa.js"></script>
 * A synchronous head script blocks rendering until it runs, so data-theme is set before first paint (no flash).
 *
 * GHL merge tags ({{custom_values.x}}) do NOT resolve in this file. Per-account settings arrive via window.TFA_CONFIG.
 */

/* =========================================================
   1. THEME RESOLVER
   Order: ?style= preview > visitor choice (only if toggle is on) > owner site_theme > default
   ========================================================= */
(function () {
  if (window.TFATheme) return; // guard against double loading

  var THEMES = ['default', 'light', 'aurora'];
  var KEY = 'tfa_theme';

  // Normalizes and whitelists, so a typo or an empty custom value can never produce an unstyled page
  function valid(t) {
    t = String(t || '').trim().toLowerCase();
    return THEMES.indexOf(t) > -1 ? t : null;
  }

  var cfg = window.TFA_CONFIG || {};
  var owner = valid(cfg.theme); // empty in a fresh snapshot account, so it falls back to 'default'
  var allowVisitor = String(cfg.toggle || '').trim().toLowerCase() === 'on';

  // Wrapped in try because Safari private mode and some embeds throw on localStorage
  var visitor = null;
  try { visitor = valid(localStorage.getItem(KEY)); } catch (e) {}

  // Preview links win, but are never saved
  var preview = null;
  try { preview = valid(new URLSearchParams(location.search).get('style')); } catch (e) {}

  var theme = preview || (allowVisitor && visitor) || owner || 'default';
  document.documentElement.setAttribute('data-theme', theme);

  // Small API used by the nav theme switcher widget
  window.TFATheme = {
    themes: THEMES,
    allowVisitor: allowVisitor,
    get: function () { return document.documentElement.getAttribute('data-theme'); },
    set: function (t) {
      if (!valid(t)) return;
      document.documentElement.setAttribute('data-theme', valid(t));
      try { localStorage.setItem(KEY, valid(t)); } catch (e) {}
    },
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      document.documentElement.setAttribute('data-theme', owner || 'default');
    }
  };
})();

/* =========================================================
   2. GOOGLE TRANSLATE UI: hidden
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
   3. LANGUAGE (Google Translate driven by ?ln=)
   ========================================================= */
(function () {
  // Run once per page, even if this file is accidentally loaded twice
  if (window.__olLangInit) return;
  window.__olLangInit = true;

  var DEBUG = true; // set to false after testing
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

  window.OL_LANG = lang || 'en'; // shared with the video script below
  log('resolved language:', window.OL_LANG);

  // Put ?ln= back in the URL when it came from sessionStorage, so shared links keep the language
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

/* =========================================================
   4. VIDEOS (Bunny Stream, swapped per language)
   ========================================================= */
(function () {
  if (window.__olVideoInit) return; // guard against double loading
  window.__olVideoInit = true;

  // Bunny Stream IDs as "libraryId/videoId".
  // One array per language; array position = slot number on the page (slot 1 = index 0).
  // English is the fallback for any missing language or missing slot.
  var VIDEOS = {
    home: {
      en: [
        '689036/ad8151ce-a709-4fcd-8196-1be893203888',
        '700474/d7148501-2ff2-4101-8333-3c00a663fd68',
        '689036/fa365bf8-b071-480f-8329-568d42cc02b4'
      ],
      fr: [
        '700125/680fec28-37ff-401f-971e-00fe15359fae',
        '700125/d442a62d-4fef-4e59-bcef-957d544315af',
        '700125/ea71a094-d80f-4112-9f79-5d86a68a206a'
      ],
      hi: [
        '714878/d3f42a22-4b80-4f12-89c6-5f9de4141491',
        '714878/92fa88f8-f604-4c64-a743-b008363614f9',
        '714878/7aa81a61-21ec-44b6-a230-10c64d491bbc'
      ],
      el: [
        '700078/f2de3578-5421-4cc7-a2a6-6ea8cc80927d',
        '700078/c114870c-63ee-4f76-bec9-22db0175dbd7',
        '700078/0f7a46ac-b00d-4db0-aa6e-1e9dda7b9d31'
      ],
      es: [
        '699702/9cd5b4ad-1973-4f09-abc6-1405a51bf2dc',
        '699702/bd9cdf76-86bc-4a78-af01-2afc851b899a',
        '699702/8dc43fa9-20ea-4cb1-bee1-e905fe5b9035'
      ],
      nl: [
        '713039/f8f892b3-7f2f-4ea6-9b4d-7f06f0355612',
        '713039/5978ff9a-7aac-448c-a40c-f2e921ca4178',
        '713039/c67cba4d-6c32-4fb6-8fb5-48f44d5699ba'
      ]
    }
  };

  // Shared embed settings, written once instead of in every embed code
  var BASE = 'https://player.mediadelivery.net/embed/';
  var QUERY = '?autoplay=false&loop=false&muted=false&preload=false&responsive=true';

  // Single source of truth: set by the language block above (invalid or missing ln = 'en')
  function currentLang() {
    return window.OL_LANG || 'en';
  }

  // "home-2" -> group "home", index 1 -> ID for the current language, else the English ID
  function resolve(key) {
    var cut = key.lastIndexOf('-');
    if (cut === -1) return null;

    var group = VIDEOS[key.slice(0, cut)];
    var idx = parseInt(key.slice(cut + 1), 10) - 1;
    if (!group || isNaN(idx) || idx < 0) return null;

    var list = group[currentLang()];
    var path = (list && list[idx]) || (group.en && group.en[idx]);
    return path ? path.trim() : null;
  }

  function mount(box) {
    var key = box.getAttribute('data-video') || '';
    // Mark first, so a bad key is not retried on every poll
    box.setAttribute('data-ready', '1');

    var path = resolve(key);
    if (!path) {
      console.warn('[OL Video] no video for key:', key);
      return;
    }

    // Responsive 16:9 wrapper; notranslate keeps Google from touching the player area
    var wrap = document.createElement('div');
    wrap.className = 'notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.style.cssText = 'position:relative;padding-top:56.25%;width:100%;height:0;overflow:hidden;';

    var frame = document.createElement('iframe');
    frame.loading = 'lazy';
    frame.style.cssText = 'border:0;position:absolute;top:0;left:0;width:100%;height:100%;';
    frame.allow = 'accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;';
    frame.allowFullscreen = true;
    // Bunny checks the referrer when domain protection is on
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    // Attach first, then set src, so the iframe loads once inside the page
    wrap.appendChild(frame);
    box.innerHTML = '';
    box.appendChild(wrap);
    frame.src = BASE + path + QUERY;

    console.log('[OL Video]', key, '(' + currentLang() + ') ->', frame.src);
  }

  // Mounts any placeholder not yet handled; cheap enough to repeat
  function scan() {
    var boxes = document.querySelectorAll('.ol-video:not([data-ready])');
    for (var i = 0; i < boxes.length; i++) mount(boxes[i]);
  }

  // GHL renders sections after load, so poll for 10 s instead of a MutationObserver
  function init() {
    scan();
    var ticks = 0;
    var timer = setInterval(function () {
      scan();
      if (++ticks >= 50) clearInterval(timer); // 50 x 200 ms = 10 s
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
