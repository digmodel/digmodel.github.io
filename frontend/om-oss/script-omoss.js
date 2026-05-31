/* ===== i18n för /om-oss/ ===== */

const DEFAULT_LANG = 'sv';
const LANG_CODE = { sv: 'sv-SE', da: 'da-DK' };

/* --- persistence helpers --- */
function getLangFromUrl() {
  const m = location.search.match(/[?&]lang=(sv|da)\b/);
  return m ? m[1] : null;
}
function getSavedLang() {
  try {
    const m = document.cookie.match(/(?:^|;\s*)site_lang=(sv|da)\b/);
    if (m) return m[1];
  } catch {}
  try {
    const v = localStorage.getItem('lang');
    if (v === 'sv' || v === 'da') return v;
  } catch {}
  return null;
}
function setSavedLang(lang) {
  try {
    document.cookie = `site_lang=${lang}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Strict`;
    localStorage.setItem('lang', lang);
  } catch {}
}

/* --- Dansk ordbok (notera om-oss & info.om-oss) --- */
const I18N = {
  da: {
    head: {
      title: 'Digmodel AB – Vision & bæredygtighed',
      desc: 'Digmodel AB tilbyder en digital platform til download af højopløselige digitale terrænmodeller og åbne geodata fra statslige myndigheder.',
      ogLocale: 'da_DK'
    },
    lang: {
      group: 'Sprog',
      sv: { title: 'Skift til svensk', label: 'Svensk' },
      da: { title: 'Skift til dansk', label: 'Dansk' }
    },
    nav: { label: 'Hovedmenu', about: 'Om os', cta: 'Kom i gang' },

    hero: {
      prefix: 'Jeres forretningspartner for øget ',
      subtitle: '”Visionen er at reducere risiciene ved digitalisering med sikker åben data. Ved at effektivisere digitale arbejdsprocesser i arkitektur og samfundsbyggeri kan vi accelerere bæredygtighedsarbejdet.”',
      agenda: '”Agenda 2030 er retningsgivende for vores virksomhed. Vi fremmer bæredygtighedsmålene ved at lette klimatilpasning. Vi er overbeviste om, at bæredygtighed opnås gennem global konsensus og lokal handlekraft.”',
      sdg8Alt: 'Billede 1',
      sdg9Alt: 'Billede 2',
      sdg11Alt: 'Billede 3',
      words: ['innovation', 'samarbejde', 'sikkerhed']
    },

    'om-oss': {
      team: { heading: 'Holdet bag Digmodel' }
    },

    info: {
      contact: {
        title: 'Kontakt',
        org: 'Organisationsnummer: 559530-4030',
        address: 'Adresse: Kärragårdsvägen 57, 507 33 Brämhult',
        phone: '+46 767089883',
        email: 'support@digmodel.se'
      },
      service: {
        title: 'Tjenestens omfang',
        p1: 'Digmodel leverer digitale terrænmodeller og ortofoto baseret på officielle geodata. Tjenesten dækker hele Danmark og Sverige med undtagelse af visse dele af Norrland.'
      },
      datatype: {
        title: 'Datatype og kildehenvisning'
      },
      data: {
        se: {
          title: 'Svenske data',
          ortho: 'Ortofoto – Lantmäteriet – anvendes i henhold til Anvendelsesvilkår for værdifulde datamængder',
          laser: 'Laserdata – Lantmäteriet, CC BY 4.0'
        },
        dk: {
          title: 'Danske data',
          ortho: 'Ortofoto – GeoDanmark, CC BY 4.0',
          laser: 'Laserdata – Styrelsen for Dataforsyning og Infrastruktur (SDFI), CC BY 4.0.'
        }
      },
      'om-oss': {
        title: 'Om Digmodel',
        p1: 'Digmodel AB tilbyder tjenester, der reducerer risici og sænker barriererne for implementering af digitalisering og åbne data inden for arkitektur og samfundsbyggeri.',
        p2: 'Virksomhedens langsigtede mål er at distribuere sikker åben data som grundlag for innovation og udvikling. Med en innovativ "OpenData-OpenAI"-forretningsmodel vil virksomheden fremme fremtidig digitalisering og bæredygtighedsarbejde.',
        p3: {
          part1: 'Digmodel AB er en del af',
          part2: 'hvilket giver os støtte til at vokse og levere sikre, skalerbare løsninger.'
        },
        cta: 'Læs mere om Digmodel'
      }
    },

    roles: {
      cto: 'Grundlægger & CTO',
      architect: 'Arkitekt',
      cmo: 'Grundlægger & Marketingchef',
      engineer: 'Ingeniør'
    },
    bio: {
      tobias: 'Specialist med 15 års erfaring inden for IT, geodata og AI-drevne analyseværktøjer. Tobias har arbejdet med statslige myndigheder i digitaliseringsprojekter og har bred erfaring med automatisering af håndtering af åbne geodata.',
      afshin: 'Specialist med 15 års erfaring med digitale værktøjer, digital fabrikation og forståelse for digitale processer i arkitektur og byudvikling. Har mange års erfaring fra den offentlige sektor og arbejdet med bæredygtighed.',
      deli: 'Med erfaring inden for produktudvikling og management har Deli ansvar for Digmodels brandudvikling og kommunikation ud mod arkitekter, planlæggere og ejendomsudviklere.',
      ingvar: 'Med over 15 års erfaring i projektledelse og en ledende position på Island inden for modulhuse i træ bidrager Ingvar med indsigt i digitale værktøjers rolle i industrialiseret byggeri og styrker virksomhedens nordiske ekspansion.',
      emil: 'Med baggrund i kommercielle bygge- og byudviklingsprojekter bidrager Emil med perspektiver fra markedets behov for hurtig adgang til grunddata og styrker forståelsen for planlægningsprocesser.'
    },

    footer: {
      rights: 'Alle rettigheder forbeholdes.',
      privacy: 'Fortrolighedspolitik',
      logoAlt: 'Logo i sidefoden'
    }
  }
};

/* --- hämta svenska defaults (text + attribut + head/meta) --- */
const DEFAULTS = { text: {}, attr: {}, head: {} };

function captureDefaults() {
  // Text
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    if (k && !DEFAULTS.text[k]) DEFAULTS.text[k] = el.innerHTML;
  });
  // Attribut
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((raw) => {
      const [attr, key] = raw.split(':').map((s) => s.trim());
      if (!attr || !key) return;
      if (!DEFAULTS.attr[key]) DEFAULTS.attr[key] = {};
      if (!(attr in DEFAULTS.attr[key])) DEFAULTS.attr[key][attr] = el.getAttribute(attr) || '';
    });
  });
  // Head/meta (kräver id i HTML: meta-title, meta-desc, og-title, og-desc, tw-title, tw-desc, og-locale)
  DEFAULTS.head.title = document.title;
  const m = (sel) => document.getElementById(sel);
  DEFAULTS.head.desc = m('meta-desc')?.getAttribute('content') ?? '';
  DEFAULTS.head.ogTitle = m('og-title')?.getAttribute('content') ?? '';
  DEFAULTS.head.ogDesc = m('og-desc')?.getAttribute('content') ?? '';
  DEFAULTS.head.twTitle = m('tw-title')?.getAttribute('content') ?? '';
  DEFAULTS.head.twDesc = m('tw-desc')?.getAttribute('content') ?? '';
  DEFAULTS.head.ogLocale = m('og-locale')?.getAttribute('content') || 'sv_SE';
}

/* --- utils --- */
function deepGet(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
}

/* --- applicera head/meta --- */
function applyHeadI18n(lang) {
  const isDA = lang === 'da';
  const da = I18N.da.head;
  const byId = (id) => document.getElementById(id);

  document.title = isDA ? da.title : DEFAULTS.head.title || document.title;
  const set = (id, val, fallback) => {
    const el = byId(id);
    if (el && val != null) el.setAttribute('content', val);
    else if (el && fallback != null) el.setAttribute('content', fallback);
  };

  set('meta-desc', isDA ? da.desc : DEFAULTS.head.desc, DEFAULTS.head.desc);
  set('og-title', isDA ? da.title : DEFAULTS.head.ogTitle, DEFAULTS.head.ogTitle);
  set('og-desc', isDA ? da.desc : DEFAULTS.head.ogDesc, DEFAULTS.head.ogDesc);
  set('tw-title', isDA ? da.title : DEFAULTS.head.twTitle, DEFAULTS.head.twTitle);
  set('tw-desc', isDA ? da.desc : DEFAULTS.head.twDesc, DEFAULTS.head.twDesc);

  const ogLoc = byId('og-locale');
  if (ogLoc) ogLoc.setAttribute('content', isDA ? da.ogLocale || 'da_DK' : DEFAULTS.head.ogLocale || 'sv_SE');

  // <html lang="">
  document.documentElement.setAttribute('lang', LANG_CODE[lang] || LANG_CODE[DEFAULT_LANG]);
}

/* --- språk på länkar --- */
function persistLangOnInternalLinks(lang) {
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    try {
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      url.searchParams.set('lang', lang);
      a.href = url.toString();
    } catch {}
  });
}

// --- typed-effekt ---
let typedTimer = null;
function initTyped(words) {
  const target = document.getElementById('typed-text');
  if (!target || !Array.isArray(words) || !words.length) return;

  // 1) Lås rutan efter längsta ordet (innan vi börjar skriva)
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  document.documentElement.style.setProperty('--typed-box', `${longest + 1}ch`);

  // 2) Avbryt ev. pågående animation
  if (typedTimer) {
    clearTimeout(typedTimer);
    typedTimer = null;
  }

  // 3) Skriv/ta bort
  let iW = 0,
    iC = 0;
  const typing = 110,
    pause = 1800;

  function type() {
    if (iC < words[iW].length) {
      target.textContent += words[iW].charAt(iC++);
      typedTimer = setTimeout(type, typing);
    } else {
      typedTimer = setTimeout(erase, pause);
    }
  }

  function erase() {
    if (iC > 0) {
      target.textContent = words[iW].slice(0, --iC);
      typedTimer = setTimeout(erase, typing / 1.5);
    } else {
      iW = (iW + 1) % words.length;
      typedTimer = setTimeout(type, typing);
    }
  }

  target.textContent = '';
  type();
}

/* --- applyI18n --- */
function applyI18n(lang) {
  const dict = lang === 'da' ? I18N.da : null;

  // text
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const val = dict ? deepGet(dict, key) : undefined;
    el.innerHTML = val != null ? val : DEFAULTS.text[key] ?? el.innerHTML;
  });

  // attribut
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((raw) => {
      const [attr, key] = raw.split(':').map((s) => s.trim());
      if (!attr || !key) return;
      const v = dict ? deepGet(dict, key) : undefined;
      const fallback = DEFAULTS.attr[key]?.[attr];
      if (v != null) el.setAttribute(attr, v);
      else if (fallback != null) el.setAttribute(attr, fallback);
    });
  });

  // språkknappar
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
    const svg = btn.querySelector('svg');
    if (svg) svg.style.opacity = active ? '1' : '0.3';
  });

  // typed ord
  const words = lang === 'da' ? I18N.da.hero?.words || ['innovation', 'samarbejde', 'sikkerhed'] : ['innovation', 'samverkan', 'säkerhet'];
  initTyped(words);

  // head/meta + persist länkar
  applyHeadI18n(lang);
  setSavedLang(lang);
  persistLangOnInternalLinks(lang);
}

/* --- init --- */
document.addEventListener('DOMContentLoaded', () => {
  captureDefaults();

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang === 'da' ? 'da' : 'sv';
      applyI18n(lang);
    });
  });

  const initial = getLangFromUrl() || getSavedLang() || DEFAULT_LANG;
  applyI18n(initial);
});

// --- Scroll-fade: kör i tre steg (första h2 -> andra h2 -> SDG-kort) ---
function initHeroFadeOnUserScroll(options) {
  const { delaySecond = 1000, delayCardsAfterSecond = 1000, threshold = 0.25, rootMargin = '0px' } = options || {};

  const first = document.querySelector('h2.scroll-fade[data-i18n="hero.subtitle"]');
  const second = document.getElementById('agenda-text');
  const cards = document.getElementById('vision-cards');
  if (!first || !second) return;

  let started = false;
  let hasUserScrolled = window.scrollY > 0;
  let lastIntersecting = false;
  let io = null;

  const passive = { passive: true };

  const cleanup = () => {
    window.removeEventListener('scroll', onUserScroll, passive);
    window.removeEventListener('wheel', onUserScroll, passive);
    window.removeEventListener('touchstart', onUserScroll, passive);
    window.removeEventListener('keydown', onUserScroll, passive);
    if (io) io.disconnect();
  };

  const start = () => {
    if (started) return;
    started = true;

    // steg 1: första texten
    first.classList.add('fade-in');

    // steg 2: andra texten
    setTimeout(() => {
      second.classList.add('fade-in');

      // steg 3: SDG-korten
      if (cards) {
        setTimeout(() => {
          cards.classList.add('fade-in');
        }, delayCardsAfterSecond);
      }
    }, delaySecond);

    cleanup();
  };

  const onUserScroll = () => {
    hasUserScrolled = true;
    if (lastIntersecting) start();
  };

  // lyssna på första användarinteraktion
  window.addEventListener('scroll', onUserScroll, passive);
  window.addEventListener('wheel', onUserScroll, passive);
  window.addEventListener('touchstart', onUserScroll, passive);
  window.addEventListener('keydown', onUserScroll, passive);

  // observera när första <h2> kommer in i bild,
  // men starta först EFTER att användaren faktiskt scrollat/rört sig
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target !== first) continue;
          lastIntersecting = e.isIntersecting;
          if (e.isIntersecting && hasUserScrolled) start();
        }
      },
      { threshold, rootMargin }
    );
    io.observe(first);
  } else {
    if (hasUserScrolled) start();
  }
}

// kör när sidan laddat
document.addEventListener('DOMContentLoaded', () => {
  // …din övriga init här (captureDefaults, applyI18n, initTyped, osv.)
  initHeroFadeOnUserScroll({
    delaySecond: 1000,
    delayCardsAfterSecond: 1000
  });
});
