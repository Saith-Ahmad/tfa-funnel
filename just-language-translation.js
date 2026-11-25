/*!
 * tfa-language-videos.js v1.3.0
 * The Frequency Awakening LaunchPad funnel: language (?ln=) + video swap by language, with a theme section
 * that is switched off until the theme classes exist. Hosted remotely so one update ships to every sub-account.
 *
 * FILE MAP (each section is independent, so edit one without touching the others):
 *   1. THEME      notes only. The theme resolver is a small INLINE script in the funnel head code (it must run
 *                 before the page paints, which a deferred file cannot do). See the snippet in section 1.
 *   2. LANGUAGE   Google Translate driven by ?ln=, account default, language kept across steps, legacy /fr links,
 *                 and a list of elements Google must never translate (initials, brand marks).
 *   3. VIDEOS     Bunny Stream video per language per slot, English fallback, reserved height until mounted.
 *
 * LOAD IT IN THE FUNNEL-LEVEL HEAD TRACKING CODE (applies to every step), config line first:
 *   <script>window.TFA_CONFIG = { defaultLang: '{{custom_values.default_language_code}}' };</script>
 *   <script src="https://cdn.jsdelivr.net/gh/Saith-Ahmad/tfa-funnel@COMMIT_OR_TAG/tfa-language-videos.js" defer></script>
 *
 * Language order of precedence:
 *   1. ?ln= in the URL (a supported code, or en for English)
 *   2. the visitor's earlier choice in this session (sessionStorage, including an explicit English)
 *   3. the account default (custom value default_language_code; empty means English)
 *   4. English
 *
 * VIDEO PLACEHOLDER (a Custom Code element on the page, one per video position):
 *   <div class="ol-video" data-video="home-3"></div>
 *   Slot keys: home-1, home-2, home-3, affiliate-1, affiliate-2, products-1, products-2, frequency-1
 */


/* ==========================================================================================================
   1. THEME   (notes only: nothing in this file sets the theme)
   The theme is chosen by <html data-theme="light|aurora">; no attribute means dark. The page CSS reads it.
   It is set by a small INLINE script in the funnel-level head code, placed BEFORE this file's script tag,
   because it has to run before the first paint (this file is deferred, so a theme set from here would flash).
   Precedence there: ?style= preview, then the visitor's saved choice (localStorage "tfa-theme", written by the footer
   toggle widget), then the account default (custom value, via TFA_CONFIG.theme), then dark.
   Values accepted: light, dark, aurora (azure is accepted as an alias). Anything else counts as dark.
   ========================================================================================================== */


/* ==========================================================================================================
   2. LANGUAGE   (Google Translate driven by ?ln=)
   2a. Hide Google's own UI
   2b. Resolve the language, keep the URL in step, drive Google Translate
   2c. Legacy per-language links (/fr, /ru) become ?ln=
   ========================================================================================================== */

/* ---- 2a. Google Translate UI: hidden ------------------------------------------------------------------
   Injected as a <style> tag from here, so the CSS ships with the script and needs no copy in each account */
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

/* ---- 2b. Language resolution and Google Translate ----------------------------------------------------- */
(function () {
  // Run once per page, even if this file is accidentally loaded twice
  if (window.__olLangInit) return;
  window.__olLangInit = true;

  var DEBUG = false; // set to true only while testing; logs to the console
  function log() { if (DEBUG) console.log.apply(console, ['[OL Lang]'].concat([].slice.call(arguments))); }

  var STORE_KEY = 'ol_lang';

  // Supported languages. To add one: add its code here and its videos in section 3.
  var ALLOWED = [
    'es', 'de', 'fr', 'it', 'pt', 'nl', 'da', 'fi', 'el',
    'hu', 'bg', 'cs', 'sk', 'ro', 'hi', 'zh-CN', 'ja', 'ko', 'ar', 'pl', 'ru',
    'he', 'no', 'sv', 'tr'
  ];

  // Hebrew is the one code Google may name differently: older widget builds use 'iw', newer ones accept 'he'.
  // The URL, the CRM and the video map keep 'he'; only the calls to Google use these aliases, tried in order.
  var GOOGLE_ALIASES = { he: ['iw', 'he'] };
  function googleCodes(code) { return GOOGLE_ALIASES[code] || [code]; }

  // Case-insensitive match so ?ln=zh-cn or ?ln=HI still resolve to the exact code.
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

  var fromUrl = normalize(raw);                                               // a supported language in the URL
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

  // Shared with section 3 (videos) and with the language switcher widget
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

  var cookieCode = googleCodes(lang)[0];
  document.cookie = 'googtrans=/en/' + cookieCode + '; path=/;';
  if (rootDomain && rootDomain.indexOf('.') !== -1) {
    document.cookie = 'googtrans=/en/' + cookieCode + '; path=/; domain=.' + rootDomain + ';';
  }

  // Google adds translated-ltr / translated-rtl to <html> once the page is translated
  function isTranslated() {
    var cls = document.documentElement.className || '';
    return cls.indexOf('translated-ltr') !== -1 || cls.indexOf('translated-rtl') !== -1;
  }

  // The language list handed to Google: every supported code plus any Google-side alias
  var included = [];
  ALLOWED.forEach(function (c) {
    googleCodes(c).forEach(function (g) { if (included.indexOf(g) === -1) included.push(g); });
  });

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
      if (combo) {
        // Pick the first Google code this dropdown actually offers (matters for Hebrew: iw or he)
        var target = googleCodes(lang).filter(function (c) {
          return Array.prototype.some.call(combo.options, function (o) { return o.value === c; });
        })[0] || googleCodes(lang)[0];
        // Re-dispatch when the value is wrong, or every 5th tick if Google ignored the first change
        if (combo.value !== target || tries % 5 === 0) {
          combo.value = target;
          combo.dispatchEvent(new Event('change'));
          log('dropdown set to', target);
        }
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
        includedLanguages: included.join(','), // keeps the hidden dropdown to the whitelist
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

/* ---- 2c. Legacy language links: /fr, /ru ... -> current page + ?ln= ---------------------------------
   The old setup had one funnel per language, so existing switchers link to /fr, /ru, etc.
   With one funnel those paths no longer exist. This turns such a click into
   "same page, same params, only ln replaced". It sits outside block 2b on purpose,
   because 2b returns early for English visitors and the links must work for them too. */
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


/* ---- 2d. Never translate: initials and brand marks ------------------------------------------------------
   Google translates short acronyms as if they were words (the "TQ" avatar becomes "Total Transaction Quality" in Greek
   and breaks the card layout). Everything matching a selector below gets class "notranslate" + translate="no",
   which Google respects. To protect another element, add its selector to NO_TRANSLATE.
   It runs on every phase and then polls, because the page builder can render elements after this file loads.
   The class has to be there BEFORE Google translates the element, so it also runs ahead of the Google boot in 2b. */
(function () {
  if (window.__tfaNoTranslate) return;
  window.__tfaNoTranslate = true;

  var NO_TRANSLATE = [
    '.tfa-av'            // Tommy Quinn card: the "TQ" initials circle
    // , '.tfa-name'     // uncomment to keep the person's name untranslated as well
  ];

  function mark() {
    for (var i = 0; i < NO_TRANSLATE.length; i++) {
      var nodes = document.querySelectorAll(NO_TRANSLATE[i]);
      for (var j = 0; j < nodes.length; j++) {
        if (!nodes[j].classList.contains('notranslate')) {
          nodes[j].classList.add('notranslate');
          nodes[j].setAttribute('translate', 'no');
        }
      }
    }
  }

  mark();
  document.addEventListener('DOMContentLoaded', mark);
  window.addEventListener('load', mark);
  var ticks = 0;
  var timer = setInterval(function () { mark(); if (++ticks >= 100) clearInterval(timer); }, 100); // 10 s
})();


/* ==========================================================================================================
   3. VIDEOS   (Bunny Stream, swapped per language)
   Reads window.OL_LANG from section 2. Default is English: any language without a video for a slot,
   and any visitor with no language, gets the English video.
   To add or fix a video: edit the one line in VIDEOS (and LIBRARY if a new language is added).
   ========================================================================================================== */
(function () {
  if (window.__tfaVideosInit) return; // guard against double loading
  window.__tfaVideosInit = true;

  var DEBUG = false; // set to true only while testing; logs each mounted video

  // Each language's Bunny Stream library. A value below without a slash is a video ID in that library.
  // A value WITH a slash is a full "libraryId/videoId" path and is used as is (for the few exceptions).
  var LIBRARY = {
    en: '700474',
    bg: '714851',
    cs: '714859',
    da: '713380',
    nl: '713039',
    fr: '700125',
    de: '701919',
    el: '700078',
    he: '702882',
    hi: '714878',
    hu: '707689',
    it: '699719',
    no: '713059',
    pl: '714834',
    pt: '699657',
    ro: '714886',
    ru: '710252',
    es: '699702',
    sv: '713321',
    tr: '713447'
  };

  // slot -> language -> video. English is the fallback for any language that has no entry for a slot.
  var VIDEOS = {
    // Home video 1: all 20 languages. English is this design's own video; the others come from the reference site.
    'home-1': {
      en: '689036/ad8151ce-a709-4fcd-8196-1be893203888',
      bg: '4c2b255b-c87a-4f69-bfb5-4a879e540568',
      cs: '69b08a67-14bf-402c-ae70-083fede042af',
      da: '9d54cc00-c058-407b-8e2f-4ba3970c56b1',
      nl: 'f8f892b3-7f2f-4ea6-9b4d-7f06f0355612',
      fr: '680fec28-37ff-401f-971e-00fe15359fae',
      de: '1bd67f05-9383-4ae2-ab94-5392c17f7e40',
      el: 'f2de3578-5421-4cc7-a2a6-6ea8cc80927d',
      he: '069146a0-9ac4-463c-b1d6-dc0d10d23b1c',
      hi: 'd3f42a22-4b80-4f12-89c6-5f9de4141491',
      hu: '714845/58ee5988-1df6-47f3-bcd6-50a11c618ccf',
      it: 'e3541dbe-4d06-47bd-aecb-bc9b051084d8',
      no: 'c3a1000f-a15c-43e6-9128-6e50da320d5a',
      pl: '1db779b8-33cc-4a2d-9c55-1d3af70d3f64',
      pt: '2d64e68e-a0a7-4fba-8740-218b19e86a46',
      ro: '5adc5ff9-aed6-4893-8128-a9e839ec8516',
      ru: 'eb6d68dd-b406-4ded-a185-5226706482fa',
      es: '9cd5b4ad-1973-4f09-abc6-1405a51bf2dc',
      sv: '754c5c9b-ce9e-40ea-962f-2c7a94d772d1',
      tr: '5afd23da-ca40-4914-bd9f-163f7f4678e6'
    },
    // Home video 2: all 20 languages. English is this design's own video; the others come from the reference site.
    'home-2': {
      en: 'd7148501-2ff2-4101-8333-3c00a663fd68',
      bg: 'eb754889-4187-4d83-a2fc-3bb7b4449c7c',
      cs: 'd7df5b57-8f1f-4c5a-8ece-fc51dddcd545',
      da: 'e93c7bed-b5b5-4fc2-8250-56f4bb2ee275',
      nl: '5978ff9a-7aac-448c-a40c-f2e921ca4178',
      fr: 'd442a62d-4fef-4e59-bcef-957d544315af',
      de: 'd146ed0f-a839-45ba-b6ac-c0c74dfd7283',
      el: 'c114870c-63ee-4f76-bec9-22db0175dbd7',
      he: '7a6c19e6-5d26-4297-87e3-947572d7d36d',
      hi: '92fa88f8-f604-4c64-a743-b008363614f9',
      hu: '06bab377-93e4-432c-a997-8dee660598df',
      it: 'b12311d4-6648-433c-b9a4-7d80b96bfa90',
      no: 'ea31dc62-6c28-41e6-a5fc-552ae5393b2b',
      pl: 'cde85ea5-6de6-4b7d-9672-756effdc6273',
      pt: 'e05fbf12-a07f-4020-bfa3-397d6250d072',
      ro: '8f3f16ed-7208-4e0a-bc0a-68f079e00d0f',
      ru: '7817e752-d904-482e-91a0-8d582c230d28',
      es: 'bd9cdf76-86bc-4a78-af01-2afc851b899a',
      sv: 'f646eb94-5816-405c-b705-8c6430c8fc02',
      tr: 'b832ccc1-60ac-49c0-8d91-b2484aa0ed13'
    },
    // NEW: The Future of Wellness Starts Here
    'home-3': {
      en: 'a72d08fe-b656-4541-b106-3c8c7950639f',
      bg: '83e86fbb-2f94-4032-8554-c3a84218ce94',
      cs: '764765ea-58da-46f4-9013-aadb17b02219',
      da: 'fdea914e-622d-4587-8b09-b2a103f5103b',
      nl: '97468708-d742-4a17-ab1b-77cbff406fa1',
      fr: '8d99f31c-af95-4aac-b267-dbfa5924508c',
      de: 'c26e6ac6-a82d-4428-a3e9-4480c08a5f72',
      el: '3b342602-237d-4af0-8bd3-e9efa2fa98dc',
      he: 'aa894078-6a93-49fd-b56a-066cb18f1d0d',
      hi: 'f9181ea7-cde7-44a0-b4c2-e54398f4273d',
      hu: '2962bb67-a806-4880-9b8c-29c96d0c476a',
      it: 'e65375b2-2da5-49ac-83d4-1b40c350542b',
      no: 'd268c3c6-2484-4b0b-90ea-ea390b850dc3',
      pl: 'f9617a69-f209-4c20-a705-a72f283fb460',
      pt: 'da3ea862-d539-4e45-ad1e-15e438f7524c',
      ro: '96f90756-34e5-4a9e-b5b2-06ed9291a8c2',
      ru: '3eeaea9d-6dcd-4a22-91e0-68645e3b4a2b',
      es: 'b023edd1-0c53-467e-b2dc-7ad59438b8d1',
      sv: 'aa9dffca-2888-4d0f-9354-e4b14cb0cc60',
      tr: 'e8761b4b-dd3b-4664-8e6e-65dafeaf5595'
    },
    // NEW: Discover how you can earn (remove all old affiliate videos)
    'affiliate-1': {
      en: 'ee9e0c52-a879-49b6-a4fe-3b17402f6cc9',
      bg: '97d6932d-74a2-416e-936a-57a0be2ff55a',
      cs: '5fdd0d5c-1422-4158-a0c3-ff531ddfbd45',
      da: '2b45b669-83ee-4be0-8ad9-3e1c0d368fee',
      nl: '0a0ca71f-6dfd-4b63-8b94-9b64dc0c5192',
      fr: '9cc6697f-2577-42f8-8982-0a48c4c495be',
      de: '2ec0656d-43d4-4972-b461-761ba7419223',
      el: 'e98a4a3b-8915-4932-a555-1fc8f56d8b88',
      he: 'e5b166dc-c691-4a92-9797-c5f686dc0876',
      hi: '2271f2f8-e4b2-4d23-acf3-82085d12d83f',
      hu: '66c2c7ac-fa2a-4b64-ae1f-3366fd26bade',
      it: '8064e2c1-0acd-4a1b-8074-9a0c4ad13e4b',
      no: 'ca2e9410-b191-4feb-acbe-d6c9e169e871',
      pl: 'a2cd1ad1-80b9-4d21-9860-4d607ea70640',
      pt: 'd26168fb-ce03-44eb-9214-072f62aff940',
      ro: '53a4d90b-5537-4984-a007-ec11e70415af',
      ru: '3e66b293-3027-49e3-8ec6-d6c79a6892f1',
      es: '6c4fa151-625f-4122-9662-48eb8beea9ec',
      sv: '1a17691b-ce98-4fbb-9c9f-68f956e7bc19',
      tr: '3bf75d28-cc6f-43d5-8b96-805132da1e62'
    },
    // NEW: The Power of 2
    'affiliate-2': {
      en: '8cb808fc-0989-4d45-adbc-4a564da69528',
      bg: 'b7201ac5-c625-4ed5-bd04-5df02454c601',
      cs: '3f1818ec-5866-4795-875b-5b1a31dac67b',
      da: '05d5835a-27e8-44bb-a7be-35e21e2fdf5d',
      nl: '0018179e-f6ef-4b68-8b3e-7a71f3e43a90',
      fr: 'f38a8d2c-7755-4c14-89ca-8b2aa47b31c5',
      de: 'a73240f8-3986-4f6b-ae43-8f188acf722d',
      el: 'e4f08163-c14e-4528-b24f-34d265093060',
      he: 'a252ed13-aab2-4ad7-b42f-50a958ced84d',
      hi: '38acf112-3118-42c3-8e94-94918eeba49a',
      hu: '470d1abe-96e2-4929-a40e-d962580e65f2',
      it: '48b379fc-1cbe-41be-a5ab-3c0a01a9a9ec',
      no: 'b5f46a0c-1aa9-46b0-868b-31b4a9e6ef33',
      pl: 'd8edbdf0-3f33-40a7-b477-a570cb6c083d',
      pt: '355ebf96-89a0-427c-94f9-b4095a6fe107',
      ro: '7ea3a2bf-7c17-438c-9a91-b94f623d446b',
      ru: '855dfe13-3177-4b5e-a656-5d542354873f',
      es: '8044ae02-e673-4914-9bfb-cc72770027b7',
      sv: 'bddfd8bd-6e6d-412f-89d4-bada6fe703cb',
      tr: '821150e2-b050-448f-9c0e-113ffaf07c14'
    },
    // NEW: Next-Generation Wellness Devices (hero of /products)
    'products-1': {
      en: '0fb74168-38bf-452e-a2a9-7107412cfb01',
      bg: '2d0b0737-c1f9-48be-bf67-4aaca8666863',
      cs: '36ac0cc9-cca0-4233-8b47-27c34d46ca5d',
      da: '4611b410-0059-4eed-9597-3123afad768d',
      nl: '99618b00-5ed4-497a-bd37-667b14d047d2',
      fr: '02bd9da7-46d7-4135-9405-af7ea47a3145',
      de: '4b43a95d-9723-4d89-9141-2d6f18376e20',
      el: '9c042cc3-3884-4d26-997c-9efa3990672a',
      he: '42db8379-af65-4ee4-92ce-79c505c585c4',
      hi: '2fa653c9-53d8-4873-967f-d931fd7f389c',
      hu: '140c0dc2-69f3-41f7-8e0a-52f32589d74b',
      it: '168b633b-e513-469b-841f-e24686275bcd',
      no: '5ecb78f4-5f77-46c5-a051-b82c5b21751c',
      pl: '204abe17-7971-452d-8268-4ebb0f6357e7',
      pt: '6d218419-46ea-467b-bb7a-5815dcd2fd28',
      ro: '41a2b51e-ab50-4959-8663-986020c6ff3b',
      ru: '18154426-38fa-4b01-ae4a-e1003784a8ae',
      es: '1e673ffd-9540-49aa-b651-763d45ba24c5',
      sv: 'e785482c-d325-43f7-9326-f7ad8242357d',
      tr: 'bfa35e25-48b7-4275-8b8e-2705cf5462fb'
    },
    // NEW: Safety, Technology & Trust (above Why It Works)
    'products-2': {
      en: '689036/fa365bf8-b071-480f-8329-568d42cc02b4',
      bg: 'ba4df776-d383-44bd-bef2-367fe465d0c6',
      cs: 'f6a3a4e1-1403-487a-be5d-1485f304bc93',
      da: 'b5586615-5bd3-4307-8c7f-202a7b947c57',
      nl: 'c67cba4d-6c32-4fb6-8fb5-48f44d5699ba',
      fr: 'ea71a094-d80f-4112-9f79-5d86a68a206a',
      de: 'd03b5479-f10f-4a85-89de-6a795bd7e1e0',
      el: '0f7a46ac-b00d-4db0-aa6e-1e9dda7b9d31',
      he: '73079e31-0adc-4b06-b993-4f4598fbe4dc',
      hi: '7aa81a61-21ec-44b6-a230-10c64d491bbc',
      hu: '85b3b7eb-dbea-46d2-85d0-f8445dc46803',
      it: '0a7366ee-ce7e-4fce-9c15-95061bfc7d79',
      no: '6f2a1bd2-31c0-4975-b1be-51ed6d2a4714',
      pl: '2dda66a1-4144-4e07-96ad-7a73c97e771a',
      pt: 'fbcefa7c-f544-4101-8f76-bc2c29af9e06',
      ro: 'fc74629c-19dc-4ebc-8d9c-8a71965026f5',
      ru: '3b799fd8-bfba-4396-a7e1-51d50ef3a32f',
      es: '8dc43fa9-20ea-4cb1-bee1-e905fe5b9035',
      sv: '06da0ad6-3c43-47d6-a08d-1a080b66d15f',
      tr: '95fc0617-9c79-4607-95ae-b557f44beec6'
    },
    // NEW: Frequency video (top of What is the Frequency Awakening)
    'frequency-1': {
      en: '8b51efc6-397d-47fd-a072-8d384529b7ba',
      bg: 'd6e1cc68-a472-4f6f-a185-b2a8d885c711',
      cs: '0ef214fd-e3d9-4227-988a-31091a53f5f4',
      da: '67de8cc3-32a1-42fc-8510-302fe7e26a67',
      nl: 'ea34cc0b-84ee-4672-b79f-21fa0d959378',
      fr: '174ac569-3e1e-41e5-af88-5362bd8710c8',
      de: 'e16db4e5-8445-4b6f-bc77-2feba8c7c9b0',
      el: 'ce289560-6072-498e-9a37-cad09f332069',
      he: '93c5a71f-b0ed-47c1-b314-0666d4bbec8c',
      hi: '31e112b8-5cee-47ab-8e31-c255e8d0aa1e',
      hu: '04bd2b12-3240-4bf0-b5fe-4b4dc71df90d',
      it: 'dea98c82-8717-49a4-a4e6-93d2a21a9865',
      pl: 'a2ee84ec-13ea-4c66-b777-0b528ef0c659',
      pt: 'c31fa62b-9760-4db2-aeaf-33f67c349b28',
      ro: 'a1a6ae17-60c3-4343-82d6-d596d6adf454',
      ru: '6e256980-f0f2-451e-b37f-66d71fdf2060',
      es: 'b9bcfc44-dfd6-4814-b437-1fbe27cec66f',
      sv: '3862bcab-2515-415b-a3c7-a669c506d893',
      tr: 'e8df7e32-66a6-429c-9ec2-6543543dcfb1'
    }
  };

  // Shared embed settings, written once instead of in every embed code
  var BASE = 'https://player.mediadelivery.net/embed/';
  var QUERY = '?autoplay=false&loop=false&muted=false&preload=false&responsive=true';

  // Reserve the video's space before it loads, so the page doesn't jump and the block never looks empty.
  // 16:9 box with a minimum height; once the player is mounted the box drops these and the player sizes it.
  // A slot with no video at all is hidden instead of leaving an empty grey box.
  function injectStyle() {
    if (document.getElementById('tfa-video-css')) return;
    var css = [
      '.ol-video { display: block; position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 180px;',
      '  background: rgba(127, 127, 127, 0.12); border-radius: 12px; overflow: hidden; }',
      '.ol-video[data-ready] { aspect-ratio: auto; min-height: 0; background: none; }',
      '.ol-video[data-empty] { display: none; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'tfa-video-css';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // Set by section 2 (an unknown or missing ln means English)
  function currentLang() {
    return window.OL_LANG || 'en';
  }

  // Returns "libraryId/videoId" for a slot in the given language, else the English one, else null
  function resolve(slot, lang) {
    var entry = VIDEOS[slot];
    if (!entry) return null;
    var use = entry[lang] ? lang : 'en';
    var value = entry[use];
    if (!value) return null;
    return value.indexOf('/') === -1 ? LIBRARY[use] + '/' + value : value;
  }

  function mount(box) {
    var slot = box.getAttribute('data-video') || '';
    // Mark first, so a bad key is not retried on every poll
    box.setAttribute('data-ready', '1');

    var path = resolve(slot, currentLang());
    if (!path) {
      console.warn('[TFA Video] no video for slot:', slot);
      box.setAttribute('data-empty', '1'); // hide the reserved box rather than show an empty one
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

    if (DEBUG) console.log('[TFA Video]', slot, '(' + currentLang() + ') ->', frame.src);
  }

  // Mounts any placeholder not yet handled; cheap enough to repeat
  function scan() {
    var boxes = document.querySelectorAll('.ol-video:not([data-ready])');
    for (var i = 0; i < boxes.length; i++) mount(boxes[i]);
  }

  // GHL renders sections after load, so poll for 10 s instead of a MutationObserver
  function init() {
    injectStyle();
    scan();
    var ticks = 0;
    var timer = setInterval(function () {
      scan();
      if (++ticks >= 50) clearInterval(timer); // 50 x 200 ms = 10 s
    }, 200);
  }

  // Exposed for checking in the console: TFAVideos.resolve('home-3', 'es')
  window.TFAVideos = { resolve: resolve, slots: Object.keys(VIDEOS) };

  // The style goes in right away, so placeholders already in the page hold their space from the first paint
  injectStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
