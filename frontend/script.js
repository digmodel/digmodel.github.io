// Cookie Management Module
const CookieManager = {
  set(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    const sameSite = 'Strict';
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=${sameSite}${secure}`;
  },

  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },

  delete(name) {
    this.set(name, '', -1);
  },

  applyPreferences(type) {
    if (type === 'all') {
      this.set('analytics_cookies', 'enabled', 365);
      this.set('marketing_cookies', 'enabled', 365);
    } else {
      this.delete('analytics_cookies');
      this.delete('marketing_cookies');
    }
    this.set('functional_cookies', 'enabled', 365);
    this.set('cookieConsent', type, 365);
    console.log(`âœ… Cookie consent set to: ${type}`);
  }
};

// DOM Ready
$(document).ready(function () {
  $('.logo-slider').slick({
  infinite: true,
  autoplay: true,
  autoplaySpeed: 3000,
  speed: 800,
  arrows: false,
  dots: false,
  slidesToShow: 3,
  slidesToScroll: 1,
  centerMode: false,
  variableWidth: false,
  responsive: [
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1,
        centerMode: false,
        variableWidth: false
      }
    }
  ]
}); // <-- stÃ¤nger slick korrekt hÃ¤r


// Handle cookie buttons
$('[data-action]').on('click', function () {
  const action = $(this).data('action');
  switch (action) {
    case 'accept-all':
      CookieManager.applyPreferences('all');
      $('.cookie-popup').removeClass('show').fadeOut();
      loadScriptsFromConsent();
      if (window.applyGaConsentFlags) window.applyGaConsentFlags();
      break;

    case 'accept-necessary':
      CookieManager.applyPreferences('necessary');
      $('.cookie-popup').removeClass('show').fadeOut();
      if (window.applyGaConsentFlags) window.applyGaConsentFlags();
      break;

    case 'reject-all':
      CookieManager.applyPreferences('none');
      $('.cookie-popup').removeClass('show').fadeOut();
      if (window.applyGaConsentFlags) window.applyGaConsentFlags();
      break;

    case 'settings':
      $('#cookieSettingsModal').addClass('show');
      break;
  }
});


// Cookie settings form submit
$('#cookieSettingsForm').on('submit', function (e) {
  e.preventDefault();
  const analytics = $('#analyticsCookies').is(':checked');
  const marketing = $('#marketingCookies').is(':checked');

  CookieManager.set('functional_cookies', 'enabled', 365);

  if (analytics) {
    CookieManager.set('analytics_cookies', 'enabled', 365);
  } else {
    CookieManager.delete('analytics_cookies');
  }

  if (marketing) {
    CookieManager.set('marketing_cookies', 'enabled', 365);
  } else {
    CookieManager.delete('marketing_cookies');
  }

  const consentLevel = (analytics || marketing) ? 'custom' : 'necessary';
  CookieManager.set('cookieConsent', consentLevel, 365);

  $('#cookieSettingsModal').removeClass('show');
  $('.cookie-popup').removeClass('show').fadeOut();

  // Ladda ev. skript och uppdatera GA:s consentlÃ¤ge direkt
  loadScriptsFromConsent();
  if (window.applyGaConsentFlags) window.applyGaConsentFlags();
});


  // Init on page load
  initializeCookieConsent();

  // StÃ¤ng instÃ¤llningsmodalen pÃ¥ "Avbryt"
$('#closeSettings').off('click').on('click', function () {
  $('#cookieSettingsModal').removeClass('show');
});

// StÃ¤ng om man klickar pÃ¥ bakgrunden (utanfÃ¶r inner-wrapper)
$('.cookie-settings-modal').off('click').on('click', function (e) {
  if (e.target === this) $(this).removeClass('show');
});

// StÃ¤ng med Escape
$(document).off('keydown.cookieModal').on('keydown.cookieModal', function (e) {
  if (e.key === 'Escape') $('#cookieSettingsModal').removeClass('show');
});


  // CTA tracking
  document.querySelectorAll('.cta-outline-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const consent = CookieManager.get('cookieConsent');
      if ((consent === 'all' || consent === 'custom') && typeof gtag === 'function') {
        gtag('event', 'cta_click', {
          event_category: 'engagement',
          event_label: 'Download tool',
          value: 1
        });
        console.log('ðŸŽ¯ CTA tracked with gtag');
      }
    });
  });

  // Video autoplay on scroll to center
  const video = document.getElementById('scrollVideo');
  if (video) {
    video.playbackRate = 0.75;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && video.paused) {
          video.play().catch(e => console.error("ðŸš« Video kunde inte startas:", e));
        }
      });
    }, {
      rootMargin: "-25% 0px -25% 0px"
    });

    observer.observe(video);

    video.addEventListener('ended', () => {
      video.pause();
      video.currentTime = video.duration;
    });
  }

});

function loadScriptsFromConsent() {
  // Ladda endast om anvÃ¤ndaren har godkÃ¤nt analyscookies
  const analyticsEnabled = CookieManager.get('analytics_cookies') === 'enabled';
  if (!analyticsEnabled) {
    console.log('â„¹ï¸ Analytics inte aktiverat â€“ inga skript laddas.');
    return;
  }

  // Skydd mot dubbel laddning
  if (window.__gaLoaded || document.getElementById('ga-gtag')) {
    console.log('â„¹ï¸ Google Analytics Ã¤r redan laddat.');
    return;
  }

  // Ladda GA4 gtag
  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.id = 'ga-gtag';
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-ESBGQFVMPH';
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };

  // SÃ¤tt GA4 consent-lÃ¤ge innan fÃ¶rsta config
  if (window.applyGaConsentFlags) window.applyGaConsentFlags();

  gtag('js', new Date());
  gtag('config', 'G-ESBGQFVMPH', { anonymize_ip: true });

  window.__gaLoaded = true;
  console.log('ðŸ“ˆ Google Analytics laddat med anonymize_ip.');
}

function initializeCookieConsent() {
  const consent = CookieManager.get('cookieConsent');

  // HjÃ¤lpare: sÃ¤tt GA4-lÃ¤ge efter aktuella cookieval
  function applyGaConsentFlags() {
    const analyticsOn = CookieManager.get('analytics_cookies') === 'enabled';

    // StÃ¤ng av/pÃ¥ mÃ¤tning pÃ¥ klientsidan
    window['ga-disable-G-ESBGQFVMPH'] = !analyticsOn;

    // Uppdatera Consent Mode om gtag finns
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: analyticsOn ? 'granted' : 'denied'
      });
    }
  }
  // Exponera globalt ifall du vill anropa den frÃ¥n andra handlers
  window.applyGaConsentFlags = applyGaConsentFlags;

  // Synka checkboxar med cookie-lÃ¤ge (sÃ¥ instÃ¤llningsrutan speglar lÃ¤get)
  const analyticsEnabled = CookieManager.get('analytics_cookies') === 'enabled';
  const marketingEnabled = CookieManager.get('marketing_cookies') === 'enabled';
  try {
    $('#analyticsCookies').prop('checked', analyticsEnabled);
    $('#marketingCookies').prop('checked', marketingEnabled);
  } catch (e) {
    // ignorera om elementen inte finns pÃ¥ sidan
  }

  if (!consent) {
    // Visa popup tills anvÃ¤ndaren vÃ¤ljer
    $('.cookie-popup').addClass('show').fadeIn(0);
  } else {
    // DÃ¶lj popup om val redan finns och ladda ev. skript
    $('.cookie-popup').removeClass('show').hide();
    loadScriptsFromConsent();
  }

  // SÃ¤kerstÃ¤ll rÃ¤tt GA-lÃ¤ge direkt vid sidladdning
  applyGaConsentFlags();
}



function setFavicon(mode) {
  const existing = document.querySelector("link[rel='icon']");
  const newFavicon = document.createElement("link");
  newFavicon.rel = "icon";
  newFavicon.type = "image/svg+xml";
  newFavicon.href = mode === "dark"
    ? "/assets/Favicon_Dark.svg"
    : "/assets/Favicon_Light.svg";

  if (existing) {
    document.head.removeChild(existing);
  }
  document.head.appendChild(newFavicon);
}

// --- SprÃ¥k: hjÃ¤lpfunktioner (endast EN gÃ¥ng, ovanfÃ¶r IIFE) ---
const DEFAULT_LANG = 'sv';
const LANG_CODE   = { sv: 'sv-SE', da: 'da-DK' };
const OG_LOCALE   = { sv: 'sv_SE', da: 'da_DK' };

function getLangFromUrl() {
  const m = location.search.match(/[?&]lang=(sv|da)\b/);
  return m ? m[1] : null;
}

function detectInitialLang() {
  // Prioritet: URL > cookie > default
  return getLangFromUrl() || CookieManager.get('site_lang') || DEFAULT_LANG;
}

function setActiveLangButton(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
    const svg = btn.querySelector('svg');
    if (svg) svg.style.opacity = active ? '1' : '0.3';
  });
}

function persistLangOnInternalLinks(lang) {
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    // hoppa Ã¶ver ankarlÃ¤nkar och andra protokoll
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) return;

    try {
      // anvÃ¤nd a.href (resolverar relativ URL mot aktuell sida)
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return; // bara interna
      url.searchParams.set('lang', lang);
      a.href = url.toString();
    } catch { /* ignore */ }
  });
}

// script.js
(function () {

  // 1) Dansk Ã¶versÃ¤ttning (lÃ¤gg till/Ã¤ndra allt eftersom)
  const I18N = {
    da: {
      // Språkknapper & nav
      lang: {
        group: 'Sprog',
        sv: { title: 'Skift til svensk', label: 'Svensk' },
        da: { title: 'Skift til dansk', label: 'Dansk' },
      },
      nav: {
        label: 'Hovedmenu',
        about: 'Om os',
        cta: 'Kom i gang',
      },

      // Hero
      hero: {
        title: 'Digitale terrænmodeller og ortofotos til arkitektur og by- og samfundsplanlægning',
        subtitle:
          'Grundlag for de tidlige faser tilpasset arkitekter, planlæggere og entreprenører. Forenklet adgang til åbne data for langsigtet bæredygtige beslutninger inden for planlægning og byggeri',
        coverage: 'Landsdækkende i Sverige og Danmark',
      },

      // CTA
      cta: {
        heading: 'Hent din terrænmodel gratis!',
        button: 'Hent',
        iconAlt: 'Download-ikon',
      },

      // Pricing
      pricing: {
        sectionTitle: 'Vælg abonnement',
        sectionAria: 'Vælg abonnement',
        cards: {
          free: {
            label: 'Mindre projekter og byggetilladelser',
            name: 'Free',
            period: '/ registrering',
            features: {
              1: 'Op til <strong>3 nedhentninger</strong>',
              2: 'Op til <strong>500&times;500 m</strong>',
              3: 'OBJ + PNG (basis)',
              4: 'Origo/koordinat',
            },
            cta: 'Vælg Free',
          },
          premium: {
            label: 'Større projekter og byplanlægning',
            name: 'Premium',
            period: '/ måned',
            features: {
              1: 'Op til <strong>10 nedhentninger</strong>',
              2: 'Op til <strong>1000&times;1000 m</strong>',
              3: 'OBJ + PNG + DXF',
              4: 'Origo/koordinat',
              5: 'Prioriteret support',
            },
            cta: 'Vælg Premium',
          },
          year: {
            badge: 'Populær',
            label: 'Virksomheder og eksperter',
            name: 'Premium Year',
            period: '/ år',
            features: {
              1: '<strong>Ubegrænset antal nedhentninger</strong>',
              2: 'Op til <strong>1000&times;1000 m</strong>',
              3: 'OBJ + PNG + DXF + Åbne data',
              4: 'Origo/koordinat',
              5: 'Prioriteret support',
            },
            cta: 'Vælg Premium Year',
          },
        },
      },

      // Problem
      problem: {
        heading:
          'Svært at finde pålidelige data eller stedsinformation i dine tidlige processer?',
        body:
          'At få fat i pålidelige data eller stedsinformation skal ikke være svært. Lange leveringstider, tekniske barrierer og dyre konsulentindsatser gør, at åbne data kan være svære at udnytte. At søge, forstå og konvertere tager tid og bremser projekter allerede fra start. Digmodel gør det enklere.',
      },

      // Steg
      steps: {
        heading: 'Sådan fungerer det',
        '1': {
          title: 'Lokalisering og koordinater',
          body: 'Vælg område via søgefunktionen eller ved at navigere i kortet.',
          iconAlt: 'Ikon for sted og koordinater',
        },
        '2': {
          title: 'Datatype og datasætstørrelse',
          body: 'Vælg datatype og angiv datasættets størrelse til download.',
          iconAlt: 'Ikon for datatype og størrelse',
        },
        '3': {
          title: 'Format og eksport',
          body: 'Vælg filformat og eksporter datasættet til integration i dit projekt.',
          iconAlt: 'Ikon for format og eksport',
        },
      },

      // Værditilbud
      value: {
        title: 'Effektiv designproces med korrekte data',
        body:
          'Download, analyser og simuler med åbne data til arkitektur og samfundsplanlægning. Arbejd omkostningseffektivt, samarbejd smidigt mellem aktører og reducer tidlige risici for at accelerere bæredygtighed.',
      },

      // Fordele
      benefits: {
        cost: {
          title: 'Omkostningseffektivt',
          iconAlt: 'Ikon for omkostningseffektivitet',
          items: {
            1: 'Materialeomkostninger',
            2: 'Licensomkostninger',
            3: 'Automatisering',
            4: 'Optimering',
            5: 'Ressourceeffektivitet',
          },
        },
        collab: {
          title: 'Samarbejde',
          iconAlt: 'Ikon for samarbejde',
          items: {
            1: 'Vidensdeling',
            2: 'Effektivt samarbejde',
            3: 'Stærkere partnerskaber',
            4: 'Hurtigere beslutninger',
            5: 'Forbedret kommunikation',
          },
        },
        sec: {
          title: 'Sikkerhed',
          iconAlt: 'Ikon for sikkerhed',
          items: {
            1: 'Stabil infrastruktur',
            2: 'Sikker integration',
            3: 'Sikker information',
            4: 'Pålidelig lagring',
            5: 'Datasikkerhed',
          },
        },
      },

      // Logoband
      credits: {
        line: 'Tilgængeliggøres og distribueres under Creative Commons-licens',
      },

      // Info
      info: {
        contact: {
          title: 'Kontakt',
          org: 'Organisationsnummer: 559530-4030',
          address: 'Adresse: Kärragårdsvägen 57, 507 33 Brämhult',
          phone: '+46 767089883',
          email: 'support@digmodel.se',
        },
        service: {
          title: 'Tjenestens omfang',
          p1: 'Digmodel leverer digitale terrænmodeller og ortofotos baseret på officielle geodata. Tjenesten dækker hele Danmark og Sverige med undtagelse af visse dele af Norrland.',
        },
        datatype: {
          title: 'Datatype og kildehenvisning',
        },
        data: {
          se: {
            title: 'Svenske data',
            ortho: 'Ortofoto - Lantmäteriet - anvendes i henhold til Anvendelsesvilkår for værdifulde datamængder',
            laser: 'Laserdata - Lantmäteriet, CC BY 4.0',
          },
          dk: {
            title: 'Danske data',
            ortho: 'Ortofoto - GeoDanmark, CC BY 4.0',
            laser: 'Laserdata - Styrelsen for Dataforsyning og Infrastruktur (SDFI), CC BY 4.0.',
          },
        },
        about: {
          title: 'Om Digmodel',
          p1: 'Digmodel AB tilbyder tjenester, der reducerer risici og sænker barriererne for implementering af digitalisering og åbne data inden for arkitektur og samfundsbyggeri.',
          p2: 'Virksomhedens langsigtede mål er at distribuere sikre åbne data som et grundlag for innovation og udvikling. Med en innovativ "OpenData-OpenAI"-forretningsmodel skal virksomheden fremme fremtidig digitalisering og bæredygtighedsarbejde.',
          p3: {
            part1: 'Digmodel AB er en del af',
            part2:
              'hvilket giver os støtte til at vokse og levere sikre, skalerbare løsninger.',
          },
          cta: 'Læs mere om Digmodel',
        },
      },

      // Footer
      footer: {
        rights: 'Alle rettigheder forbeholdes.',
        privacy: 'Fortrolighedspolitik',
        logoAlt: 'Logo i sidefoden',
      },

      // Cookies
      cookie: {
        title: 'Cookies - digmodel.se',
        body1:
          'Vi bruger cookies for at give dig en optimal oplevelse af vores website. Nogle cookies er nødvendige for, at siden fungerer korrekt, mens andre hjælper os med at analysere trafik, tilpasse indhold og annoncer samt tilbyde sociale mediefunktioner.',
        // body2 innehåller HTML - vi sætter den med innerHTML (se nedenfor)
        body2:
          'Ved at klikke på <strong>"Accepter alle"</strong> accepterer du, at vi bruger cookies i henhold til vores cookiepolitik. Vil du tilpasse hvilke cookies der aktiveres? Klik på <strong>"Cookie-indstillinger"</strong> for at foretage dine valg eller læse mere i vores <a href="/integritetspolicy.html" target="_blank" rel="noopener">fortrolighedspolitik</a>.',
        acceptAll: 'Accepter alle cookies',
        acceptNecessary: 'Accepter kun nødvendige cookies',
        rejectAll: 'Afvis alle cookies',
        iconAlt: 'Indstillinger for cookies',
        settingsTitle: 'Cookieindstillinger',
        functional: 'Funktionelle cookies (nødvendige)',
        analytics: 'Analysecookies (Google Analytics m.fl.)',
        marketing: 'Marketingcookies (fx. Meta, YouTube)',
        save: 'Gem indstillinger',
        cancel: 'Annuller',
        settingsBtnLabel: 'Cookieindstillinger',
      },

      // Meta/OG/Twitter (head)
      meta: {
        title: 'Digmodel AB - Download digitale terrænmodeller og åbne geodata',
        description:
          'Digmodel AB er en digital platform, der forenkler adgangen til højopløste terrænmodeller og åbne geodata fra offentlige myndigheder.',
        ogTitle: 'Digmodel AB - Download digitale terrænmodeller og åbne data',
        ogDescription:
          'Digitale terrænmodeller og åbne data til arkitektur og planlægning. Byg dit 3D-miljø effektivt.',
        twTitle: 'Digmodel AB - Download digitale terrænmodeller og åbne data',
        twDescription:
          'Digmodel forenkler adgangen til terrændata og åbne data for 3D-applikationer. For arkitekter og samfundsplanlæggere.',
      },
    },
  };

  // 2) LÃ¤s svenska defaults frÃ¥n DOM fÃ¶rsta gÃ¥ngen (sÃ¥ du slipper duplicera sv i I18N)
  const DEFAULTS = { text: {}, attr: {}, head: {} };

  function captureDefaults() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (!key || DEFAULTS.text[key]) return;
      // spara innerHTML fÃ¶r att bevara ev. lÃ¤nkar/markup
      DEFAULTS.text[key] = el.innerHTML;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(',').forEach((pairRaw) => {
        const [attr, key] = pairRaw.split(':').map((s) => s.trim());
        if (!attr || !key) return;
        DEFAULTS.attr[key] = DEFAULTS.attr[key] || {};
        if (!(attr in DEFAULTS.attr[key])) {
          DEFAULTS.attr[key][attr] = el.getAttribute(attr) || '';
        }
      });
    });

    // Head-meta
    DEFAULTS.head = {
      title: document.getElementById('meta-title')?.textContent || '',
      desc: document.getElementById('meta-desc')?.getAttribute('content') || '',
      ogTitle: document.getElementById('og-title')?.getAttribute('content') || '',
      ogDesc: document.getElementById('og-desc')?.getAttribute('content') || '',
      ogLocale: document.getElementById('og-locale')?.getAttribute('content') || 'sv_SE',
      twTitle: document.getElementById('tw-title')?.getAttribute('content') || '',
      twDesc: document.getElementById('tw-desc')?.getAttribute('content') || '',
      // valfria (lÃ¤gg id i HTML om du vill byta dem)
      ogImageAlt: document.getElementById('og-image-alt')?.getAttribute?.('content') || null,
      twImageAlt: document.getElementById('tw-image-alt')?.getAttribute?.('content') || null,
    };
  }

// 3) Applicera Ã¶versÃ¤ttning
function applyI18n(lang) {
  const dict = lang === 'da' ? I18N.da : null; // sv = default via DOM-snapshot

  // âœ… sÃ¤tt html@lang fÃ¶r tillgÃ¤nglighet/SEO
  document.documentElement.setAttribute('lang', LANG_CODE[lang] || LANG_CODE[DEFAULT_LANG]);

    // Head/meta
    setTextById('meta-title', dict?.meta?.title ?? DEFAULTS.head.title);
    setContentById('meta-desc', dict?.meta?.description ?? DEFAULTS.head.desc);
    setContentById('og-title', dict?.meta?.ogTitle ?? DEFAULTS.head.ogTitle);
    setContentById('og-desc', dict?.meta?.ogDescription ?? DEFAULTS.head.ogDesc);
    setContentById('og-locale', OG_LOCALE[lang] || DEFAULTS.head.ogLocale);
    setContentById('tw-title', dict?.meta?.twTitle ?? DEFAULTS.head.twTitle);
    setContentById('tw-desc', dict?.meta?.twDescription ?? DEFAULTS.head.twDesc);
    // valfritt: alt-texter om id finns
    if (DEFAULTS.head.ogImageAlt !== null) {
      setContentById('og-image-alt', dict?.meta?.ogImageAlt ?? DEFAULTS.head.ogImageAlt);
    }
    if (DEFAULTS.head.twImageAlt !== null) {
      setContentById('tw-image-alt', dict?.meta?.twImageAlt ?? DEFAULTS.head.twImageAlt);
    }

    // Textnoder
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) return;
      const value =
        dict && deepGet(dict, key) != null ? deepGet(dict, key) : DEFAULTS.text[key];

      if (key === 'cookie.body2') {
        // Viktigt: behÃ¥ll lÃ¤nkar/strong i cookietexten
        el.innerHTML = value;
      } else {
        // Om defaulten innehÃ¥ller markup (t.ex. p3.part1/part2) funkar innerHTML ocksÃ¥.
        // Men vi anvÃ¤nder textContent dÃ¤r vi kan fÃ¶r att undvika oavsiktlig HTML.
        if (/[<>&]/.test(value)) {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
      }
    });

    // Attribut
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(',').forEach((pairRaw) => {
        const [attr, key] = pairRaw.split(':').map((s) => s.trim());
        if (!attr || !key) return;
        const v = dict && deepGet(dict, key) != null ? deepGet(dict, key) : DEFAULTS.attr[key]?.[attr];
        if (v != null) el.setAttribute(attr, v);
      });
    });

    // Flaggor aktiv/pressed
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Spara + uppdatera UI och lÃ¤nkar
CookieManager.set('site_lang', lang, 365);
setActiveLangButton(lang);
persistLangOnInternalLinks(lang);

    // Spara val
    localStorage.setItem('lang', lang);
  }

  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setContentById(id, content) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', content);
  }

  function deepGet(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
  }

  // 4) Init
  document.addEventListener('DOMContentLoaded', () => {
    captureDefaults();

// Klick pÃ¥ sprÃ¥kknappar (applyI18n skÃ¶ter cookie + UI + lÃ¤nkar)
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang === 'da' ? 'da' : 'sv';
    applyI18n(lang);
  });
});

// Starta pÃ¥ URL > cookie > default (sv). applyI18n skÃ¶ter resten.
const initialLang = detectInitialLang();
applyI18n(initialLang);

  });
})();





