// Vänta på att config.js har initierat Firebase
function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.firebase?.apps?.length) return resolve();
    document.addEventListener("firebase-ready", resolve, { once: true });
  });
}

// Live-länkar
const STRIPE_PORTAL_URL   = "https://billing.stripe.com/p/login/7sY6oH7sX5BWbuT91cenS00"; // Hantera

// --- Ny E-postverifiering (Compat) ---
const VERIFY_COOLDOWN_MS = 60 * 1000; // 60 s

function showVerifyBanner() {
  document.getElementById('verify-banner')?.classList.remove('hidden');
}
function hideVerifyBanner() {
  document.getElementById('verify-banner')?.classList.add('hidden');
}
function blockMapUntilVerified() {
  document.getElementById('map-blocker')?.classList.remove('hidden');
  showVerifyBanner();
}
function allowMapUnblocked()
{
  document.getElementById('map-blocker')?.classList.add('hidden');
  hideVerifyBanner();
}

// Skicka verifieringsmejl, men max 1 gång per minut
async function maybeSendVerification(user, { silent } = {}) {
  if (!user) return;
  try {
    const last = Number(localStorage.getItem('verifySentTs') || 0);
    if (Date.now() - last < VERIFY_COOLDOWN_MS) return; // throttla
    await user.sendEmailVerification();
    localStorage.setItem('verifySentTs', String(Date.now()));
    if (!silent) alert("Verifieringsmejl skickat. Kolla inkorgen/spam.");
  } catch (e) {
    // console.warn("sendEmailVerification failed", e);
  }
}

// --- Verifieringskontroll: kastar UNVERIFIED men loggar INTE ut ---
async function assertVerified(user, opts = {}) {
  if (!user) throw new Error("NO_USER");
  try { await user.reload(); } catch {}
  if (user.emailVerified) {
    hideVerifyBanner();
    return true;
  }
  // O-verifierad: behåll sessionen men lås UI + ev. auto-sänd mejl
  showVerifyBanner();
  blockMapUntilVerified();
  if (!opts.noAutoSend) {
    await maybeSendVerification(user, { silent: opts.silent });
  }
  if (!opts.silent) {
    alert("Du måste verifiera din e-post innan du kan använda tjänsten.");
  }
  throw new Error("UNVERIFIED");
}

// Event: "Skicka verifieringsmejl igen" (om knappen finns i DOM)
document.getElementById('resend-verify')?.addEventListener('click', async () => {
  const u = firebase.auth().currentUser;
  await maybeSendVerification(u, { silent: false });
});

// --- Hjälpfunktioner för roll + portal/checkout ---
async function getUserRole(user) {
  // Försök claims först
  try {
    const tr = await user.getIdTokenResult(true);
    if (tr?.claims?.role) return String(tr.claims.role).toLowerCase();
  } catch {}
  // Fallback: Firestore users/{uid}.role
  try {
    const snap = await firebase.firestore().collection("users").doc(user.uid).get();
    if (snap.exists && snap.data()?.role) return String(snap.data().role).toLowerCase();
  } catch {}
  return "free";
}

async function openPortalOrFallback() {
  const user = firebase.auth().currentUser;
  if (!user) { alert("Du måste vara inloggad."); return; }

  try {
    // Behåll din egen callable (us-central1/createPortalSession)
    const fns = firebase.app().functions('us-central1').httpsCallable('createPortalSession');
    const { data } = await fns({ returnUrl: window.location.origin + "/download/" });
    if (data?.url) { window.location.href = data.url; return; }
  } catch (e) {
    console.warn("Portal callable misslyckades:", e);
  }
  // Fallback till fast portal-länk
  window.location.href = STRIPE_PORTAL_URL;
}

async function manageOrUpgrade(btnEl) {
  const user = firebase.auth().currentUser;
  if (!user) { alert("Du måste vara inloggad."); return; }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = "Öppnar…"; }
  try {
    await assertVerified(user);

    const role = await getUserRole(user);
    const isPremium = ["premium", "premium_year"].includes(String(role).toLowerCase());

    if (isPremium) {
      await openPortalOrFallback();
      return;
    }

    // Free: man ska inte hamna här längre (free väljer via två knappar)
    alert("Välj Premium månadsvis eller Premium årsvis.");
    return;

  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = "Hantera abonnemang"; }
  }
}

// Öppna uppgradering
async function openUpgrade(plan = "premium") {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Du måste vara inloggad.");
    return;
  }

  // ✅ priceId per plan (LIVE)
  const PRICE_MONTH = "price_1T1vf6DaZ6DO16iISWqFfjkA";     // premium mån
  const PRICE_YEAR  = "price_1SFN5MDaZ6DO16iIspZ4zPab";     // premium år

  const priceId = (plan === "premium_year") ? PRICE_YEAR : PRICE_MONTH;

  try {
    const fns = firebase.app().functions("us-central1").httpsCallable("createCheckoutSession");
    const { data } = await fns({
      priceId,
      successUrl: window.location.origin + "/download/success.html",
      cancelUrl:  window.location.origin + "/download/cancel.html",
    });

    window.location.href = data.url;
  } catch (err) {
    console.error("Checkout error", err);
    alert("Kunde inte starta betalningen.");
  }
}



// Öppna kundportal (callable → fallback till fast portal-länk)
function openPortal() {
  const user = firebase.auth().currentUser;
  if (!user) { alert("Du måste vara inloggad."); return; }

  assertVerified(user) // ✅ kastar om ej verifierad
    .then(() => {
      const fns = firebase.app().functions('us-central1').httpsCallable('createPortalSession');
      return fns({ returnUrl: window.location.origin + "/download/" })
        .then(({ data }) => { window.location.href = data?.url || STRIPE_PORTAL_URL; })
        .catch(() => { window.location.href = STRIPE_PORTAL_URL; });
    })
    .catch(() => {});
}

// -----------------------------
// Language detection + i18n (sv/da)
// -----------------------------
function detectLanguage() {
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    const normalize = (val) => {
      if (!val) return null;
      const v = String(val).toLowerCase();
      if (v === 'dk') return 'da';
      if (v.startsWith('da')) return 'da';
      if (v.startsWith('sv')) return 'sv';
      return null;
    };

    const fromUrl = normalize(urlLang);
    if (fromUrl) {
      try { localStorage.setItem("lang", fromUrl); } catch {}
      return fromUrl;
    }

    const keys = ["lang","language","selectedLanguage","siteLanguage"];
    for (const k of keys) {
      try {
        const val = normalize(localStorage.getItem(k));
        if (val) return val;
      } catch {}
    }

    const navLangs = Array.isArray(navigator?.languages) ? navigator.languages : [];
    for (const candidate of navLangs) {
      const val = normalize(candidate);
      if (val) return val;
    }

    const primaryNav = normalize(navigator?.language || navigator?.userLanguage);
    if (primaryNav) return primaryNav;

    const docLang = normalize(document?.documentElement?.lang);
    if (docLang) return docLang;

    return "sv";
  } catch {
    return "sv";
  }
}

const I18N = {
  sv: {
    login_title: 'Logga in',
    email_label: 'E-post',
    email_placeholder: 'E-postadress',
    password_label: 'Lösenord',
    password_placeholder: 'Lösenord',
    password_confirm_placeholder: 'Lösenord (igen)',
    login_button: 'Logga in',
    forgot_password: 'Har du glömt ditt lösenord?',
    reset_password: 'Glömt lösenord',
    no_account: 'Har du inget konto?',
    create_account: 'Skapa konto',
    register_title: 'Skapa konto',
    register_button: 'Skapa konto',
    have_account: 'Har du redan konto?',
    go_login: 'Logga in',
    pw_len: 'Minst 8 tecken',
    pw_upper: 'Minst en versal (A–Z)',
    pw_number: 'Minst en siffra (0–9)',
    pw_special: 'Minst ett specialtecken (!@#...)',
    pw_match: 'Lösenorden stämmer överens',
    error_pw_mismatch: 'Lösenord matchar inte.',
    error_pw_invalid: 'Lösenordet uppfyller inte kraven.',
    register_verify_notice: 'Vi har skickat ett verifieringsmejl. Verifiera din e-post och logga sedan in.',
    error_register_email_in_use: 'Kunde inte skapa konto. Prova att logga in eller återställ lösenord.',
    error_register_invalid_email: 'Ogiltig e-postadress.',
    error_register_weak_password: 'Lösenordet är för svagt.',
    error_register_network: 'Nätverksfel. Kontrollera anslutningen och försök igen.',
    error_register_generic: 'Det gick inte att skapa konto just nu.',
    search_placeholder: 'Sök efter adress',
    map_controls_group: 'Kartkontroller',
    crs_button_label: 'Origo',
    crs_option_national: 'Nationellt',
    crs_option_local: 'Lokalt',
    crs_nationell: 'Nationellt koordinatsystem',
    dxf_toggle: 'Addera DXF till export',
    download_label: 'Ladda ner',
    manage_sub: 'Hantera abonnemang',
    hiw_title: 'Hur det fungerar',
    hiw_1_title: 'Välj område',
    hiw_1_text: 'Använd sökfunktionen för att hitta ditt område eller navigera direkt i kartan. Rita en ruta runt det område du vill ladda ner.',
    hiw_2_title: 'Exportera data',
    hiw_2_text: 'Klicka på exportknappen för att ladda ner terrängdata för det valda området. Datan levereras i ett lättanvänt format.',
    hiw_3_title: 'Använd data',
    hiw_3_text: 'Importera den nedladdade datan i ditt favoritprogram för 3D-modellering eller GIS-analys.',
    footer_rights: 'Alla rättigheter förbehållna.',
    footer_privacy: 'Integritetspolicy',
    welcome_title: 'Välkommen till Digmodel!',
    welcome_line1: 'Du har nu tillgång till 5 kostnadsfria nedladdningar upp till',
    welcome_line1_size: '100×100 m',
    welcome_line2_pre: 'Vill du få tillgång till',
    welcome_line2_size: '500×500 m',
    welcome_line2_post: '? Uppgradera till Premium för 295 kr/mån.',
    welcome_premium: 'Skaffa premium',
    welcome_continue: 'Fortsätt gratis',
    processing: 'Bearbetar terrängmodell...',
    info_contact_title: 'Kontakt',
    info_contact_org: 'Organisationsnummer: 559530-4030',
    info_contact_address: 'Adress: Kärragårdsvägen 57, 507 33 Brämhult',
    info_contact_phone: '+46 767089883',
    info_contact_email: 'support@digmodel.se',
    info_service_title: 'Tjänstens omfattning',
    info_service_p1: 'Digmodel tillhandahåller digitala terrängmodeller och ortofoton baserade på officiella geodata. Tjänsten är rikstäckande i Danmark och Sverige med undantag av vissa delar av Norrland.',
    info_datatype_title: 'Datatyp och källhänvisning',
    info_data_se_title: 'Svensk data',
    info_data_se_ortho: 'Ortofoto - Lantmäteriet - används enligt Användningsvillkor för värdefulla datamängder',
    info_data_se_laser: 'Laserdata - Lantmäteriet, CC BY 4.0',
    info_data_dk_title: 'Dansk data',
    info_data_dk_ortho: 'Ortofoto - GeoDanmark, CC BY 4.0',
    info_data_dk_laser: 'Laserdata - Styrelsen for Dataforsyning och Infrastruktur (SDFI), CC BY 4.0.',
    info_about_title: 'Om Digmodel',
    info_about_p1: 'Digmodel AB erbjuder tjänster som minskar riskerna och sänker trösklarna för implementering av digitalisering och öppen data inom arkitektur och samhällsbyggnad.',
    info_about_p2: 'Bolagets långsiktiga mål är att distribuera säker öppen data som en grund för innovation och utveckling. Med en innovativ "OpenData-OpenAI"-affärsmodell ska verksamheten främja framtida digitalisering och hållbarhetsarbete.',
    info_about_p3_part1: 'Digmodel AB är en del av',
    info_about_p3_part2: 'vilket ger oss stöd i att växa och leverera säkra, skalbara lösningar.',
    info_about_cta: 'Läs mer om Digmodel'
  },
  da: {
    login_title: 'Log ind',
    email_label: 'E-mail',
    email_placeholder: 'E-mailadresse',
    password_label: 'Adgangskode',
    password_placeholder: 'Adgangskode',
    password_confirm_placeholder: 'Gentag adgangskode',
    login_button: 'Log ind',
    forgot_password: 'Har du glemt din adgangskode?',
    reset_password: 'Glemt adgangskode',
    no_account: 'Har du ikke en konto?',
    create_account: 'Opret konto',
    register_title: 'Opret konto',
    register_button: 'Opret konto',
    have_account: 'Har du allerede en konto?',
    go_login: 'Log ind',
    pw_len: 'Mindst 8 tegn',
    pw_upper: 'Mindst ét stort bogstav (A–Z)',
    pw_number: 'Mindst ét tal (0–9)',
    pw_special: 'Mindst ét specialtegn (!@#...)',
    pw_match: 'Adgangskoderne matcher',
    error_pw_mismatch: 'Adgangskoderne matcher ikke.',
    error_pw_invalid: 'Adgangskoden opfylder ikke kravene.',
    register_verify_notice: 'Vi har sendt en bekræftelsesmail. Bekræft din e-mail og log ind.',
    error_register_email_in_use: 'Kunne ikke oprette konto. Prøv at logge ind eller nulstil adgangskode.',
    error_register_invalid_email: 'Ugyldig e-mailadresse.',
    error_register_weak_password: 'Adgangskoden er for svag.',
    error_register_network: 'Netværksfejl. Kontroller forbindelsen og prøv igen.',
    error_register_generic: 'Det var ikke muligt at oprette konto lige nu.',
    search_placeholder: 'Søg efter adresse',
    map_controls_group: 'Kortkontroller',
    crs_button_label: 'Origo',
    crs_option_national: 'Nationalt',
    crs_option_local: 'Lokalt',
    crs_nationell: 'Nationalt koordinatsystem',
    dxf_toggle: 'Tilføj DXF til eksport',
    download_label: 'Download',
    manage_sub: 'Administrer abonnement',
    hiw_title: 'Sådan fungerer det',
    hiw_1_title: 'Vælg område',
    hiw_1_text: 'Brug søgefunktionen til at finde dit område, eller navigér direkte i kortet. Tegn en firkant rundt om det område, du vil downloade.',
    hiw_2_title: 'Eksporter data',
    hiw_2_text: 'Klik på eksportknappen for at downloade terrændata for det valgte område. Data leveres i et let anvendeligt format.',
    hiw_3_title: 'Brug data',
    hiw_3_text: 'Importer de downloadede data i dit favoritprogram til 3D-modellering eller GIS-analyse.',
    footer_rights: 'Alle rettigheder forbeholdes.',
    footer_privacy: 'Fortrolighedspolitik',
    welcome_title: 'Velkommen til Digmodel!',
    welcome_line1: 'Du har nu adgang til 5 gratis downloads op til',
    welcome_line1_size: '100×100 m',
    welcome_line2_pre: 'Vil du have adgang til',
    welcome_line2_size: '500×500 m',
    welcome_line2_post: '? Opgrader til Premium for 295 kr/md.',
    welcome_premium: 'Få Premium',
    welcome_continue: 'Fortsæt gratis',
    processing: 'Behandler terrænmodel...',
    info_contact_title: 'Kontakt',
    info_contact_org: 'CVR-nummer: 559530-4030',
    info_contact_address: 'Adresse: Kärragårdsvägen 57, 507 33 Brämhult',
    info_contact_phone: '+46 767089883',
    info_contact_email: 'support@digmodel.se',
    info_service_title: 'Tjenestens omfang',
    info_service_p1: 'Digmodel leverer digitale terrænmodeller og ortofotos baseret på officielle geodata. Tjenesten dækker hele Danmark og Sverige med undtagelse af enkelte dele af Norrland.',
    info_datatype_title: 'Datatype og kildehenvisning',
    info_data_se_title: 'Svenske data',
    info_data_se_ortho: 'Ortofoto - Lantmäteriet - anvendes i henhold til brugsbetingelserne for værdifulde datamængder',
    info_data_se_laser: 'Laserdata - Lantmäteriet, CC BY 4.0',
    info_data_dk_title: 'Danske data',
    info_data_dk_ortho: 'Ortofoto - GeoDanmark, CC BY 4.0',
    info_data_dk_laser: 'Laserdata - Styrelsen for Dataforsyning og Infrastruktur (SDFI), CC BY 4.0.',
    info_about_title: 'Om Digmodel',
    info_about_p1: 'Digmodel AB tilbyder tjenester, der mindsker risici og sænker barriererne for digitalisering og åben data inden for arkitektur og byudvikling.',
    info_about_p2: 'Virksomhedens langsigtede mål er at distribuere sikker åben data som fundament for innovation og udvikling. Med en innovativ "OpenData-OpenAI"-forretningsmodel vil vi fremme fremtidig digitalisering og bæredygtighedsarbejde.',
    info_about_p3_part1: 'Digmodel AB er en del af',
    info_about_p3_part2: 'som giver os støtte til at vokse og levere sikre, skalerbare løsninger.',
    info_about_cta: 'Læs mere om Digmodel'
  }
};

const LANG = detectLanguage();
try { document.documentElement.lang = LANG; } catch {}

function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || key;
}

function applyPageTranslations() {
  try {
    // Login modal (titel räcker – resten sköts av FirebaseUI/native)
    const loginTitle = document.querySelector('#login-modal h2');
    if (loginTitle) loginTitle.textContent = t('login_title');
    const resetLink = document.getElementById('nl-reset');
    const resetWrap = resetLink?.parentElement;
    if (resetWrap && resetLink) {
      resetLink.textContent = t('reset_password');
      const textNode = Array.from(resetWrap.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = ' ' + t('forgot_password') + ' ';
    }

    const signUpLink = document.getElementById('open-register-link');
    const signUpWrap = signUpLink?.parentElement;
    if (signUpWrap && signUpLink) {
      signUpLink.textContent = t('create_account');
      const textNode = Array.from(signUpWrap.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = ' ' + t('no_account') + ' ';

    }
    // Register modal
    const registerTitle = document.getElementById('register-title');
    if (registerTitle) registerTitle.textContent = t('register_title');

    const regEmail = document.getElementById('reg-email');
    if (regEmail) regEmail.placeholder = t('email_placeholder');
    const regPass = document.getElementById('reg-pass');
    if (regPass) regPass.placeholder = t('password_placeholder');
    const regPass2 = document.getElementById('reg-pass2');
    if (regPass2) regPass2.placeholder = t('password_confirm_placeholder');

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) registerBtn.textContent = t('register_button');

    const pwItems = document.querySelectorAll('#register-form ul li');
    const pwKeys = ['pw_len', 'pw_upper', 'pw_number', 'pw_special'];
    pwItems.forEach((item, idx) => {
      const key = pwKeys[idx];
      if (key) item.textContent = t(key);
    });

    const openLoginLink = document.getElementById('open-login-link');
    const openLoginWrap = openLoginLink?.parentElement;
    if (openLoginWrap && openLoginLink) {
      openLoginLink.textContent = t('go_login');
      const textNode = Array.from(openLoginWrap.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = ' ' + t('have_account') + ' ';
    }

    // Map controls
    const search = document.getElementById('search');
    if (search) search.placeholder = t('search_placeholder');

    const mapControls = document.querySelector('.map-controls');
    if (mapControls) mapControls.setAttribute('aria-label', t('map_controls_group'));

    const crsBtn = document.getElementById('crs-button');
    if (crsBtn) {
      crsBtn.setAttribute('aria-label', t('crs_button_label'));
      const crsLabel = crsBtn.querySelector('.control-label');
      if (crsLabel) crsLabel.textContent = t('crs_button_label');
    }

    const crsOptionNation = document.querySelector('.crs-option[data-value="3006"]');
    if (crsOptionNation) crsOptionNation.textContent = t('crs_option_national');

    const crsOptionLocal = document.querySelector('.crs-option[data-value="local"]');
    if (crsOptionLocal) crsOptionLocal.textContent = t('crs_option_local');

    const dxfBtn = document.getElementById('toggle-dxf');
    if (dxfBtn) {
      dxfBtn.setAttribute('aria-label', t('dxf_toggle'));
      const dxfLabel = dxfBtn.querySelector('.control-label');
      if (dxfLabel) dxfLabel.textContent = t('dxf_toggle');
    }

    const downloadBtn = document.getElementById('download-button');
    if (downloadBtn) {
      downloadBtn.setAttribute('aria-label', t('download_label'));
      const dlText = downloadBtn.querySelector('.control-label');
      if (dlText) dlText.textContent = t('download_label');
    }

    const manage = document.getElementById('manage-sub');
    if (manage) manage.textContent = t('manage_sub');

    // How it works
    const hiw = document.querySelector('.how-it-works');
    if (hiw) {
      const title = hiw.querySelector('h1'); if (title) title.textContent = t('hiw_title');
      const cards = hiw.querySelectorAll('article.info-card');
      if (cards[0]) {
        const h2 = cards[0].querySelector('h2'); if (h2) h2.textContent = t('hiw_1_title');
        const p = cards[0].querySelector('p'); if (p) p.textContent = t('hiw_1_text');
      }
      if (cards[1]) {
        const h2 = cards[1].querySelector('h2'); if (h2) h2.textContent = t('hiw_2_title');
        const p = cards[1].querySelector('p'); if (p) p.textContent = t('hiw_2_text');
      }
      if (cards[2]) {
        const h2 = cards[2].querySelector('h2'); if (h2) h2.textContent = t('hiw_3_title');
        const p = cards[2].querySelector('p'); if (p) p.textContent = t('hiw_3_text');
      }
    }

    // Info section
    const info = document.querySelector('.info-section');
    if (info) {
      const infoTexts = {
        sv: {
          'info.contact.title': 'Kontakt',
          'info.contact.org': 'Organisationsnummer: 559530-4030',
          'info.contact.address': 'Adress: K\u00E4rrag\u00E5rdsv\u00E4gen 57, 507 33 Br\u00E4mhult',
          'info.contact.phone': '+46 767089883',
          'info.contact.email': 'support@digmodel.se',
          'info.service.title': 'Tj\u00E4nstens omfattning',
          'info.service.p1': 'Digmodel tillhandah\u00E5ller digitala terr\u00E4ngmodeller och ortofoton baserade p\u00E5 officiella geodata. Tj\u00E4nsten \u00E4r rikst\u00E4ckande i Danmark och Sverige med undantag av vissa delar av Norrland.',
          'info.datatype.title': 'Datatyp och k\u00E4llh\u00E4nvisning',
          'info.data.se.title': 'Svensk data',
          'info.data.se.ortho': 'Ortofoto \u00A9 Lantm\u00E4teriet \u2013 anv\u00E4nds enligt Anv\u00E4ndningsvillkor f\u00F6r v\u00E4rdefulla datam\u00E4ngder',
          'info.data.se.laser': 'Laserdata \u00A9 Lantm\u00E4teriet, CC BY 4.0',
          'info.data.dk.title': 'Dansk data',
          'info.data.dk.ortho': 'Ortofoto \u00A9 GeoDanmark, CC BY 4.0',
          'info.data.dk.laser': 'Laserdata \u00A9 Styrelsen for Dataforsyning och Infrastruktur (SDFI), CC BY 4.0.',
          'info.about.title': 'Om Digmodel',
          'info.about.p1': 'Digmodel AB erbjuder tj\u00E4nster som minskar riskerna och s\u00E4nker tr\u00F6sklarna f\u00F6r implementering av digitalisering och \u00F6ppen data inom arkitektur och samh\u00E4llsbyggnad.',
          'info.about.p2': 'Bolagets l\u00E5ngsiktiga m\u00E5l \u00E4r att distribuera s\u00E4ker \u00F6ppen data som en grund f\u00F6r innovation och utveckling. Med en innovativ "OpenData-OpenAI"-aff\u00E4rsmodell ska verksamheten fr\u00E4mja framtida digitalisering och h\u00E5llbarhetsarbete.',
          'info.about.p3.part1': 'Digmodel AB \u00E4r en del av',
          'info.about.p3.part2': 'vilket ger oss st\u00F6d i att v\u00E4xa och leverera s\u00E4kra, skalbara l\u00F6sningar.',
          'info.about.cta': 'L\u00E4s mer om Digmodel'
        },
        da: {
          'info.contact.title': 'Kontakt',
          'info.contact.org': 'CVR-nummer: 559530-4030',
          'info.contact.address': 'Adresse: K\u00E4rrag\u00E5rdsv\u00E4gen 57, 507 33 Br\u00E4mhult',
          'info.contact.phone': '+46 767089883',
          'info.contact.email': 'support@digmodel.se',
          'info.service.title': 'Tjenestens omfang',
          'info.service.p1': 'Digmodel leverer digitale terr\u00E6nmodeller og ortofotos baseret p\u00E5 officielle geodata. Tjenesten d\u00E6kker hele Danmark og Sverige med undtagelse af visse dele af Norrland.',
          'info.datatype.title': 'Datatype og kildehenvisning',
          'info.data.se.title': 'Svenske data',
          'info.data.se.ortho': 'Ortofoto \u00A9 Lantm\u00E4teriet \u2013 anvendes i henhold til Anvendelsesvilk\u00E5r for v\u00E6rdifulde datam\u00E6ngder',
          'info.data.se.laser': 'Laserdata \u00A9 Lantm\u00E4teriet, CC BY 4.0',
          'info.data.dk.title': 'Danske data',
          'info.data.dk.ortho': 'Ortofoto \u00A9 GeoDanmark, CC BY 4.0',
          'info.data.dk.laser': 'Laserdata \u00A9 Styrelsen for Dataforsyning og Infrastruktur (SDFI), CC BY 4.0.',
          'info.about.title': 'Om Digmodel',
          'info.about.p1': 'Digmodel AB tilbyder tjenester, der reducerer risici og s\u00E6nker barriererne for implementering af digitalisering og \u00E5bne data inden for arkitektur og samfundsbyggeri.',
          'info.about.p2': 'Virksomhedens langsigtede m\u00E5l er at distribuere sikre \u00E5bne data som et grundlag for innovation og udvikling. Med en innovativ "OpenData-OpenAI"-forretningsmodel skal virksomheden fremme fremtidig digitalisering og b\u00E6redygtighedsarbejde.',
          'info.about.p3.part1': 'Digmodel AB er en del af',
          'info.about.p3.part2': 'hvilket giver os st\u00F8tte til at vokse og levere sikre, skalerbare l\u00F8sninger.',
          'info.about.cta': 'L\u00E6s mere om Digmodel'
        }

      };
      const infoMap = infoTexts[LANG] || infoTexts.sv;
      Object.entries(infoMap).forEach(([key, value]) => {
        const el = info.querySelector(`[data-i18n="${key}"]`);
        if (!el) return;
        if (key === 'info.about.cta') {
          const arrow = el.querySelector('.learn-more-arrow');
          const arrowMarkup = arrow ? ' <span class="learn-more-arrow"></span>' : '';
          el.innerHTML = `${value}${arrowMarkup}`;
        } else {
          el.textContent = value;
        }
      });
    }
    // Footer
    const rights = document.querySelector('.footer-left p span[data-i18n="footer.rights"]');
    if (rights) rights.textContent = t('footer_rights');
    const privacy = document.querySelector('.footer-left a[data-i18n="footer.privacy"]');
    if (privacy) privacy.textContent = t('footer_privacy');

    // Welcome popup
    const wTitle = document.querySelector('#welcome-popup h2');
    if (wTitle) wTitle.textContent = ' ' + t('welcome_title');
    const pAll = document.querySelectorAll('#welcome-popup p');
    if (pAll[0]) {
      pAll[0].innerHTML = `${t('welcome_line1')} <strong style="color:#ffffff;">${t('welcome_line1_size')}</strong>.`;
    }
    if (pAll[1]) {
      pAll[1].innerHTML = `${t('welcome_line2_pre')} <strong style="color:#ffffff;">${t('welcome_line2_size')}</strong>${t('welcome_line2_post')}`;
    }
    const premBtn = document.getElementById('go-premium');
    if (premBtn) premBtn.textContent = t('welcome_premium');
    const contBtn = document.getElementById('continue-free');
    if (contBtn) contBtn.textContent = t('welcome_continue');

    // Processing message
    const pm = document.getElementById('processing-message');
    if (pm) pm.textContent = t('processing');
  } catch (e) {
    console.warn('i18n apply failed', e);
  }
}

// Apply translations as soon as possible and after DOM ready
try { applyPageTranslations(); } catch {}
window.addEventListener('DOMContentLoaded', () => { setTimeout(applyPageTranslations, 0); });

// --- Login-modal: turkos rubrik + ta bort vit ram ---
(function patchLoginStyles(){
  if (document.getElementById('login-style-overrides')) return;
  const css = `
    :root { --brand-turkos:#2BC6D6; }

    /* Rubriken i inloggningsrutan */
    #login-modal h2 { 
      color: var(--brand-turkos) !important;
    }

    /* Ta bort vita ramen runt formuläret oavsett källa */
    #login-modal #native-login,
    #login-modal #native-login > div,
    #login-modal .firebaseui-card,
    #login-modal .firebaseui-container,
    #login-modal .auth-box,
    #login-modal .panel,
    #login-modal .box,
    #login-modal .border,
    #login-modal .ring-1,
    #login-modal .border-white {
      border: none !important;
      box-shadow: none !important;
    }
  `;
  const s = document.createElement('style');
  s.id = 'login-style-overrides';
  s.textContent = css;
  document.head.appendChild(s);
})();

// --- Stil + centrering av länkraden i login ---
(function styleLoginActions(){
  // färg
  const BRAND = '#2BC6D6';

  // CSS
  const css = `
    :root{ --brand-turkos:${BRAND}; }
    /* rad med länkar */
    #login-modal .nl-actions{
      display:flex; justify-content:center; gap:16px; margin-top:6px;
    }
    /* gör dem till "turkosa textlänkar" */
    #login-modal .nl-actions button{
      background:transparent !important;
      border:0 !important;
      color:var(--color-primary) !important;
      padding:0 6px !important;
      font-weight:600;
      cursor:pointer;
    }
    #login-modal .nl-actions button:hover{ text-decoration:underline; }
  `;
  const s = document.createElement('style');
  s.id = 'login-actions-style';
  s.textContent = css;
  document.head.appendChild(s);

  // Lägg klass på knappraden när den finns (DOM byggs dynamiskt)
  function tagRow(){
    const row = document.querySelector('#native-login #nl-login')?.parentElement;
    if (row && !row.classList.contains('nl-actions')) row.classList.add('nl-actions');
  }
  // försök nu och lyssna på DOM-ändringar (FirebaseUI/native kan re-rendera)
  const mo = new MutationObserver(tagRow);
  mo.observe(document.body, { childList:true, subtree:true });
  tagRow();
})();


document.addEventListener('DOMContentLoaded', async () => {
  await waitForFirebase();
  
function getPlanFromUrlOrStorage() {
  // 1) URL (download/?plan=...)
  try {
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p) return p.toLowerCase();
  } catch {}

  // 2) localStorage fallback
  try {
    const ls = localStorage.getItem("selectedPlan");
    if (ls) return ls.toLowerCase();
  } catch {}

  return null;
}

function highlightUpgradeButton(plan) {
  const monthBtn = document.getElementById("upgrade-month");
  const yearBtn  = document.getElementById("upgrade-year");

  monthBtn?.classList.remove("is-selected");
  yearBtn?.classList.remove("is-selected");

  if (plan === "premium") monthBtn?.classList.add("is-selected");
  if (plan === "premium_year") yearBtn?.classList.add("is-selected");
}

function setBillingUI(role) {
  const upM = document.getElementById("upgrade-month");
  const upY = document.getElementById("upgrade-year");
  const man = document.getElementById("manage-sub");

  // göm allt först
  [upM, upY, man].forEach(el => el?.classList.add("hidden"));

  role = String(role || "free").toLowerCase();

  if (role === "free") {
    upM?.classList.remove("hidden");
    upY?.classList.remove("hidden");

    // ✅ Highlighta vald plan när man är free
    const plan = getPlanFromUrlOrStorage();
    highlightUpgradeButton(plan);

  } else if (role === "premium" || role === "premium_year") {
    man?.classList.remove("hidden");
  }
}

// koppla klick
document.getElementById("upgrade-month")?.addEventListener("click", () => openUpgrade("premium"));
document.getElementById("upgrade-year")?.addEventListener("click", () => openUpgrade("premium_year"));
document.getElementById("manage-sub")?.addEventListener("click", () => openPortalOrFallback());

// när user är inloggad+verifierad: hämta roll och visa rätt knappar
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) return;

  try { await assertVerified(user, { silent: true }); } catch { return; }

  const role = await getUserRole(user); // din befintliga funktion
  setBillingUI(role);

  const roleEl = document.getElementById("sub-role");
  if (roleEl) roleEl.textContent = role.toUpperCase();
});

const logoutBtn = document.getElementById('logout-btn');
// Visa/dölj logout-knappen
function showLogout(show) {
  if (!logoutBtn) return;
  logoutBtn.classList.toggle('hidden', !show);
}
// göm som utgångsläge
showLogout(false);

if (logoutBtn && !logoutBtn.dataset.listenerAdded) {
  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    const prevText = logoutBtn.textContent;
    logoutBtn.textContent = 'Loggar ut…';

    try {
      // (valfritt) rensa lite sessionsnära state
      try { localStorage.removeItem('verifySentTs'); } catch {}

      await firebase.auth().signOut();
      // onAuthStateChanged tar över → visar login-modal igen
    } catch (e) {
      console.error('signOut error', e);
      alert('Kunde inte logga ut. Försök igen.');
    } finally {
      logoutBtn.disabled = false;
      logoutBtn.textContent = prevText;
    }
  });
  logoutBtn.dataset.listenerAdded = 'true';
}


  // -----------------------------
  // FirebaseUI popup + dimmad karta
  // -----------------------------
  const loginModal = document.getElementById('login-modal');
  const mapBlocker = document.getElementById('map-blocker');
  const statusMessage = document.getElementById('status');

  const auth = firebase.auth();
  try { auth.useDeviceLanguage(); } catch {}

  // Visa initialt (ingen FOUC) om inte Googlebot
  const isGooglebot = /googlebot/i.test(navigator.userAgent);
  if (!isGooglebot) {
    loginModal?.classList.remove('hidden');
    mapBlocker?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  } else {
    loginModal?.classList.add('hidden');
    mapBlocker?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  function showModal() {
    if (isGooglebot) return;
    loginModal?.classList.remove('hidden');
    mapBlocker?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
  function hideModal() {
    loginModal?.classList.add('hidden');
    mapBlocker?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    if (statusMessage) statusMessage.textContent = '';
  }

  // Återanvänd UI-instans
  const ui = window.firebaseui
    ? (firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth))
    : null;

  // --- Uppdaterad FirebaseUI-konfiguration ---
  // OBS: vi låter FirebaseUI endast hantera Google-inloggning (enumeration-säkert).
  // --- FirebaseUI-konfiguration: inga providers (vi kör bara native e-post/lösen) ---
const uiConfig = {
  signInFlow: 'popup',
  credentialHelper: firebaseui.auth.CredentialHelper.NONE,
  signInOptions: [], // ⬅️ Inga knappar alls
  callbacks: {
    uiShown: () => {},
    signInFailure: async () => {
      alert('Inloggning misslyckades. Prova igen eller använd e-post och lösenord.');
      return Promise.resolve();
    },
    signInSuccessWithAuthResult: async ({ user }) => {
      try {
        await assertVerified(user, { silent: true });
        // säkerställ users/{uid}… (behåll din befintliga kod här)
        hideModal();
      } catch {
        const statusMessage = document.getElementById('status');
        if (statusMessage) statusMessage.textContent = "Verifieringsmejl skickat. Kolla inkorgen (även skräppost).";
        showModal();
      }
      return false;
    }
  }
};


  function startUi() {
    if (!ui) {
      console.error("FirebaseUI saknas – se till att firebaseui-auth.js laddas efter Firebase SDK.");
      return;
    }
    ui.start('#firebaseui-auth-container', uiConfig);
  }

  // --- Vår egen e-post/lösen-inloggning ("native") som injiceras i modalen ---
  function mountNativeLogin() {
    const host = document.getElementById('firebaseui-auth-container');
    if (!host) return;

    // Redan injicerad?
    if (document.getElementById('native-login')) return;

    const box = document.createElement('div');
    box.id = 'native-login';
    box.style.marginBottom = '16px';
    box.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <label>
          <span style="display:block; font-size:12px; opacity:.8;">${t('email_label')}</span>
          <input id="nl-email" type="email" autocomplete="username"
  style="width:100%; height:40px; padding:0 12px; background:#fff; color:#111; border:1px solid #ddd; border-radius:6px;">
        </label>
        <label>
          <span style="display:block; font-size:12px; opacity:.8;">${t('password_label')}</span>
          <input id="nl-pass" type="password" autocomplete="current-password"
  style="width:100%; height:40px; padding:0 12px; background:#fff; color:#111; border:1px solid #ddd; border-radius:6px;">
        </label>
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div style="width:100%; height:40px; background-color:var(--color-accent); border-radius:6px; display:flex; align-items:center; justify-content:center;">
            <button id="nl-login" type="button" class="w-full rounded font-semibold transition" style="height:100%; width:100%; background:transparent; color:#002235; border:none; border-radius:6px; display:flex; align-items:center; justify-content:center; text-decoration:none;">${t('login_button')}</button>
          </div>
        </div>
                <p class="text-sm text-center mt-4" style="color:#A3A3A3;">
          ${t('forgot_password')}
          <a href="#" id="nl-reset" class="underline">${t('reset_password')}</a>
        </p>

    `;
    host.prepend(box);

    const emailEl = box.querySelector('#nl-email');
    const passEl  = box.querySelector('#nl-pass');
    const tipEl   = box.querySelector('#nl-tip');

    const getCreds = () => ({
      email: (emailEl.value || '').trim().toLowerCase(),
      pass:  passEl.value || ''
    });

    box.querySelector('#nl-login').addEventListener('click', async () => {
      const { email, pass } = getCreds();
      if (!email || !pass) return alert('Fyll i e-post och lösenord.');
      try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        // lyckad inloggning → onAuthStateChanged + assertVerified tar över
      } catch (e) {
        // Generiska fel (läck inte om mejlet finns)
        alert('Inloggning misslyckades. Kontrollera uppgifterna eller återställ lösenordet.');
        console.warn('signin error', e);
      }
    });

    box.querySelector('#nl-reset').addEventListener('click', async (e) => {
      e.preventDefault();
      const { email } = getCreds();
      if (!email) return alert('Fyll i e-post först.');
      try {
        await firebase.auth().sendPasswordResetEmail(email);
        alert('Om e-posten finns får du ett återställningsmejl.');
      } catch (e) {
        alert('Om e-posten finns får du ett återställningsmejl.');
        console.warn('reset error', e);
      }
    });

    // Bekvämlighet (icke-kritiskt): försök ge tips om Google-metod
    try {
      emailEl.addEventListener('blur', async () => {
        const em = (emailEl.value || '').trim().toLowerCase();
        if (!em) return;
        try {
          const methods = await firebase.auth().fetchSignInMethodsForEmail(em);
          if (methods?.includes('google.com') && !methods.includes('password')) {
            tipEl.textContent = 'Det här kontot verkar vara kopplat till Google. Använd “Logga in med Google”.';
          } else {
            tipEl.textContent = 'Tips: Använd din Google-inloggning om du skapade kontot med Google.';
          }
        } catch {}
      });
    } catch {}
  }

  // --- Kör UI + vår native-login ---
  function startUiWithNative() {
    startUi();
    // FirebaseUI muterar DOM asynkront – mounta direkt och när UI ändras
    const root = document.getElementById('firebaseui-auth-container');
    const mo = new MutationObserver(() => mountNativeLogin());
    if (root) mo.observe(root, { childList: true, subtree: true });
    mountNativeLogin();
  }

// Auth state
auth.onAuthStateChanged(async (user) => {
  if (isGooglebot) { 
    hideModal(); 
    showLogout(false); 
    return; 
  }

  if (!user) {
    showModal();
    startUiWithNative();
    // lås kartan och dölj logout när ingen är inloggad
    blockMapUntilVerified();
    showLogout(false);
    return;
  }

  // Inloggad – släpp bara igenom om verifierad
  try {
    await assertVerified(user, { silent: true, noAutoSend: true }); // kastar om ej verifierad
    hideModal();
    allowMapUnblocked();
    // ✅ visa "Logga ut" när allt är grönt
    showLogout(true);
  } catch {
    // o-verifierad: visa modal + lås karta + dölj logout
    showModal();
    startUiWithNative();
    blockMapUntilVerified();
    showLogout(false);
  }
});

  // -----------------------------
  // Billing / Kundportal (no-code portal-länk)
  // -----------------------------
  const db = firebase.firestore();

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    // ✅ Kräv verifiering
    try { await assertVerified(user, { silent: true }); } 
    catch { return; } // o-verifierad: gör inget mer

    try {
      const u = await db.collection("users").doc(user.uid).get();
      const d = u.data() || {};

      const roleEl = document.getElementById("sub-role");
      if (roleEl) roleEl.textContent = (d.role || "free").toUpperCase();

      const nextEl = document.getElementById("sub-next");
      if (nextEl) {
        if (d.next_billing?.toDate) {
          nextEl.textContent = d.next_billing.toDate()
            .toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
        } else {
          nextEl.textContent = "—";
        }
      }

      const manageBtn = document.getElementById("manage-sub");
      if (manageBtn && !manageBtn.dataset.listenerAdded) {
        manageBtn.addEventListener("click", function () { manageOrUpgrade(this); });
        manageBtn.dataset.listenerAdded = "true";
      } else if (!manageBtn) {
        console.warn("#manage-sub saknas i DOM – lägg in knappen i HTML.");
      }

    } catch (e) {
      console.error("Fel vid läsning av user-subscription:", e);
    }
  });

  // -----------------------------
  // Premium-popup (öppna no-code-portalen)
  // -----------------------------
  function showFreeWelcomePopup() {
    const popup = document.getElementById("welcome-popup");
    if (popup) popup.classList.remove("hidden");

    const goPremiumBtn = document.getElementById("go-premium");
    const continueBtn  = document.getElementById("continue-free");

    if (goPremiumBtn && !goPremiumBtn.dataset.listenerAdded) {
      goPremiumBtn.addEventListener("click", function () { manageOrUpgrade(this); }); // Payment Link
      goPremiumBtn.dataset.listenerAdded = "true";
    }

    if (continueBtn && !continueBtn.dataset.listenerAdded) {
      continueBtn.addEventListener("click", () => popup?.classList.add("hidden"));
      continueBtn.dataset.listenerAdded = "true";
    }
  }

// -----------------------------
// Koordinatsystem (floating control)
// -----------------------------
// -----------------------------
// DXF-toggle (default false, med UI + localStorage)
// -----------------------------
let includeDxf = false; // default

(function initDxfToggle() {
  const dxfBtn = document.getElementById('toggle-dxf');
  if (!dxfBtn) return;

  // hämta ev. sparat val
  try {
    const saved = localStorage.getItem('includeDxf');
    if (saved === 'true') includeDxf = true;
  } catch {}

  function renderDxf() {
    // uppdatera UI
    dxfBtn.classList.toggle('is-active', includeDxf);
    dxfBtn.setAttribute('aria-pressed', includeDxf ? 'true' : 'false');
    // (valfritt) liten visuell indikator i knappen
    const lbl = dxfBtn.querySelector('.control-label');
    if (lbl) {
      lbl.textContent = t('dxf_toggle') + (includeDxf ? ' (på)' : ' (av)');
    }
  }

  function toggleDxf() {
    includeDxf = !includeDxf;
    try { localStorage.setItem('includeDxf', String(includeDxf)); } catch {}
    renderDxf();
    // för enkel debug i DevTools:
    window.includeDxf = includeDxf;
    console.log('[DXF]', includeDxf);
  }

  // init UI-state
  dxfBtn.setAttribute('role', 'button');
  dxfBtn.setAttribute('tabindex', '0');
  renderDxf();

  // mouse/keyboard
  dxfBtn.addEventListener('click', (e) => { e.preventDefault(); toggleDxf(); });
  dxfBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleDxf(); }
  });
})();


const crsButton = document.getElementById("crs-button");
const crsControl = crsButton ? crsButton.closest(".crs-control") : null;
const crsOptions = Array.from(document.querySelectorAll(".crs-option"));
const crsSelectedLabel = crsButton?.querySelector(".crs-selected-text");
let crsTextFadeTimeout = null;

function normalizeCrsValue(value) {
  const v = String(value || "").toLowerCase();
  if (v === "local" || v === "lokal" || v === "lokalt") return "local";
  if (v === "origo") return "origo";
  if (v === "3006" || v.includes("nationell") || v.includes("national")) return "3006";
  return "3006";
}

function updateCrsDisplay(targetValue) {
  const normalized = normalizeCrsValue(targetValue);
  const previous = crsButton?.dataset?.crs;

  if (crsButton) {
    crsButton.dataset.crs = normalized;
  }

  const selectedOption = crsOptions.find(opt => opt.dataset.value === normalized) || null;

  crsOptions.forEach(opt => {
    const isActive = opt === selectedOption;
    opt.classList.toggle("is-active", isActive);
    opt.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (selectedOption && crsSelectedLabel) {
    crsSelectedLabel.textContent = selectedOption.textContent;
  }

  return { normalized, changed: normalized !== previous };
}

function dispatchCrsChange() {
  if (!crsButton) return;
  const changeEvent = new Event("change", { bubbles: true });
  crsButton.dispatchEvent(changeEvent);
}

function openCrsMenu() {
  if (!crsControl || !crsButton) return;
  if (crsControl.classList.contains("is-open")) return;
  crsControl.classList.add("is-open");
  crsButton.setAttribute("aria-expanded", "true");
}

function closeCrsMenu() {
  if (!crsControl || !crsButton) return;
  if (!crsControl.classList.contains("is-open")) return;
  crsControl.classList.remove("is-open");
  crsButton.setAttribute("aria-expanded", "false");
}

function toggleCrsMenu(forceOpen) {
  if (!crsControl || !crsButton) return;
  const shouldOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : !crsControl.classList.contains("is-open");
  if (shouldOpen) {
    openCrsMenu();
  } else {
    closeCrsMenu();
  }
}

function focusActiveCrsOption() {
  const target =
    crsOptions.find(opt => opt.classList.contains("is-active")) || crsOptions[0] || null;
  target?.focus({ preventScroll: true });
}

function focusSiblingCrsOption(current, direction) {
  if (!crsOptions.length || !current) return;
  const index = crsOptions.indexOf(current);
  if (index === -1) return;
  let nextIndex = index + direction;
  if (nextIndex < 0) nextIndex = crsOptions.length - 1;
  if (nextIndex >= crsOptions.length) nextIndex = 0;
  const target = crsOptions[nextIndex];
  target?.focus({ preventScroll: true });
}

if (crsButton) {
  updateCrsDisplay(crsButton.dataset.crs || "origo");

  function showCrsText() {
    if (!crsControl) return;
    crsControl.classList.remove("crs-text-hidden");
  }

  function scheduleCrsTextFade() {
    if (!crsControl) return;
    if (crsTextFadeTimeout) {
      clearTimeout(crsTextFadeTimeout);
    }
    crsTextFadeTimeout = setTimeout(() => {
      crsControl.classList.add("crs-text-hidden");
      crsTextFadeTimeout = null;
    }, 3000);
  }

  crsButton.addEventListener("click", (event) => {
    event.preventDefault();
    const { changed } = updateCrsDisplay("origo");
    if (changed) dispatchCrsChange();
    closeCrsMenu();
    showCrsText();
    scheduleCrsTextFade();
  });

  crsButton.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openCrsMenu();
      focusActiveCrsOption();
    } else if (event.key === "Escape") {
      closeCrsMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!crsControl) return;
    if (crsControl.contains(event.target)) return;
    closeCrsMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCrsMenu();
    }
  });

  crsOptions.forEach(option => {
    option.setAttribute("tabindex", "-1");

    option.addEventListener("click", () => {
      const { changed } = updateCrsDisplay(option.dataset.value);
      if (changed) dispatchCrsChange();
      closeCrsMenu();
      crsButton.focus({ preventScroll: true });
    });

    option.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSiblingCrsOption(option, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSiblingCrsOption(option, -1);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        const { changed } = updateCrsDisplay(option.dataset.value);
        if (changed) dispatchCrsChange();
        closeCrsMenu();
        crsButton.focus({ preventScroll: true });
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeCrsMenu();
        crsButton.focus({ preventScroll: true });
      }
    });
  });
}

function getTransformOption() {
  const button = document.getElementById("crs-button");
  if (!button) return "origo";
  const v = String(button.dataset.crs || "").toLowerCase();

  if (v === "local" || v === "lokal" || v === "lokalt") return "local";
  if (v === "origo") return "origo";
  if (v === "3006" || v === "nationell") return "nationell";

  console.warn("Okänt crs-val, defaultar till 'nationell':", v);
  return "nationell";
}
window.getTransformOption = getTransformOption;

crsButton?.addEventListener("change", () => {
  console.log("Koordinatsystem:", getTransformOption());
});



  // -----------------------------
  // Proj4 & Leaflet
  // -----------------------------
  proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");

  const crs3006 = new L.Proj.CRS('EPSG:3006',
    proj4.defs("EPSG:3006"),
    {
      resolutions: [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1],
      origin: [0, 0]
    }
  );

  const map = L.map('map', { zoomControl: false }).setView([57.7, 11.97], 17);
  window.map = map;

  const MAPBOX_PUBLIC_TOKEN = 'REPLACE_WITH_DOMAIN_RESTRICTED_MAPBOX_PUBLIC_TOKEN';

  L.tileLayer(`https://api.mapbox.com/styles/v1/digmodelmapbox/cm8ioynst000y01s9ax5gh38m/tiles/512/{z}/{x}/{y}?access_token=${MAPBOX_PUBLIC_TOKEN}`, {
    maxZoom: 22,
    tileSize: 512,
    zoomOffset: -1,
    attribution: '© Mapbox'
  }).addTo(map);

  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

  const drawnItems = new L.FeatureGroup().addTo(map);
  let selectedRect = null;
  let editHandler = null;

  function drawRectangle() {
    const centerLatLng = map.getCenter();
    const center3006 = proj4("EPSG:4326", "EPSG:3006", [centerLatLng.lng, centerLatLng.lat]);

    const halfSize = 50; // meter (100x100 m)
    const minX = center3006[0] - halfSize;
    const maxX = center3006[0] + halfSize;
    const minY = center3006[1] - halfSize;
    const maxY = center3006[1] + halfSize;

    const sw = proj4("EPSG:3006", "EPSG:4326", [minX, minY]);
    const ne = proj4("EPSG:3006", "EPSG:4326", [maxX, maxY]);

    const bounds = [ [sw[1], sw[0]], [ne[1], ne[0]] ];

    if (selectedRect) {
      drawnItems.removeLayer(selectedRect);
      editHandler?.disable();
    }

    selectedRect = L.rectangle(bounds, {
      color: 'white',
      weight: 2,
      fillColor: 'white',
      fillOpacity: 0.5
    }).addTo(drawnItems);
    window.selectedRect = selectedRect;  // 👈 exportera aktuell ruta

    editHandler = new L.EditToolbar.Edit(map, { featureGroup: drawnItems });
    editHandler.enable();

    updateAreaLabel(selectedRect);
    selectedRect.on('edit', () => updateAreaLabel(selectedRect));
  }

  function updateAreaLabel(rect) {
    const bounds = rect.getBounds();

    const sw = proj4("EPSG:4326", "EPSG:3006", [bounds.getWest(), bounds.getSouth()]);
    const ne = proj4("EPSG:4326", "EPSG:3006", [bounds.getEast(), bounds.getNorth()]);

    const width = Math.abs(ne[0] - sw[0]);
    const height = Math.abs(ne[1] - sw[1]);
    const areaM2 = width * height;
    const areaHa = areaM2 / 10000;

    // Maxgränser per nivå
    const FREE_MAX = 250_000;        // 100 x 100 m
    const PREMIUM_MAX = 1_000_000;    // nuvarande premiumgräns
    const PREMIUM_YEAR_MAX = 1_000_000; // premium year
    
    let label = `Area: ${areaHa.toFixed(1)} ha`;
    
    if (areaM2 > PREMIUM_MAX) {
      label += " – <span style='color:red'>Överskriden maxarea</span>";
    } else if (areaM2 > FREE_MAX) {
      label += " – <span style='color:var(--color-accent)'>Kräver Premium</span>";
    } else {
      label += " – <span style='color:var(--color-success, #16a34a)'>Free</span>";
    }


    const labelDiv = document.getElementById('area-label');
    if (labelDiv) {
      labelDiv.innerHTML = label;

      const center = bounds.getCenter();
      const point = map.latLngToContainerPoint(center);
      labelDiv.style.left = `${point.x}px`;
      labelDiv.style.top = `${point.y - 30}px`;
    }
  }

  drawRectangle();

  map.on('moveend zoomend', () => {
    if (!selectedRect) return;

    const bounds = selectedRect.getBounds();
    const sw3006 = proj4("EPSG:4326", "EPSG:3006", [bounds.getWest(), bounds.getSouth()]);
    const ne3006 = proj4("EPSG:4326", "EPSG:3006", [bounds.getEast(), bounds.getNorth()]);

    const width = ne3006[0] - sw3006[0];
    const height = ne3006[1] - sw3006[1];

    const centerLatLng = map.getCenter();
    const center3006 = proj4("EPSG:4326", "EPSG:3006", [centerLatLng.lng, centerLatLng.lat]);

    const minX = center3006[0] - width / 2;
    const maxX = center3006[0] + width / 2;
    const minY = center3006[1] - height / 2;
    const maxY = center3006[1] + height / 2;

    const sw = proj4("EPSG:3006", "EPSG:4326", [minX, minY]);
    const ne = proj4("EPSG:3006", "EPSG:4326", [maxX, maxY]);

    const newBounds = [[sw[1], sw[0]], [ne[1], ne[0]]];
    selectedRect.setBounds(newBounds);
    window.selectedRect = selectedRect;  // 👈 se till att global ref alltid pekar rätt


    editHandler?.disable();
    editHandler = new L.EditToolbar.Edit(map, { featureGroup: drawnItems });
    editHandler.enable();

    updateAreaLabel(selectedRect);
  });

  // -----------------------------
  // Download request
  // -----------------------------
  const downloadBtn = document.getElementById("download-button");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      if (!selectedRect) return alert("Ingen ruta vald.");

      const user = firebase.auth().currentUser;
      if (!user) return alert("Du måste vara inloggad.");

      try {
        await assertVerified(user); // ✅ kräver verifiering; kastar om ej verifierad
      } catch {
        return; // verifiera först
      }

      downloadBtn.classList.add("is-active");

      // BBOX i WGS84 (EPSG:4326)
      const b = selectedRect.getBounds();
      const bbox4326 = {
        west:  b.getWest(),
        south: b.getSouth(),
        east:  b.getEast(),
        north: b.getNorth()
      };


      const pm = document.getElementById("processing-message");
      if (pm) pm.style.display = "block";

      try {
        const idToken = await user.getIdToken(true);

        const transformOption = (typeof getTransformOption === "function" ? getTransformOption() : "nationell");

        console.log("[DM SEND]", {
          transformOption,
          bbox4326,
          includeDxf
        }); // 👈 syns i DevTools

        const res = await fetch("https://api.digmodel.se/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({ bbox4326, transformOption, includeDxf })  // <-- RÄTT
        });

        const contentType = res.headers.get("content-type") || "";
        const text = await res.text();

        if (!res.ok) {
          throw new Error(`Backend ${res.status} ${res.statusText}. Svar: ${text.slice(0, 200)}`);
        }
        if (!contentType.includes("application/json")) {
          throw new Error(`Ovnt. content-type: ${contentType}. Första tecken: ${text.slice(0, 20)}`);
        }

        const data = JSON.parse(text);
        if (!data.zip_url) throw new Error(data.error || "Svar saknar 'zip_url'.");
        window.open(data.zip_url, "_blank");
      } catch (err) {
        alert("Fel vid nedladdning: " + err.message);
        console.error(err);
      } finally {
        if (pm) pm.style.display = "none";
        downloadBtn.classList.remove("is-active");
      }
    });
  }

  // -----------------------------
  // Adressök (Mapbox)
  // -----------------------------
  const search = document.getElementById('search');
  const suggestions = document.getElementById('suggestions');
  let marker = null;

  search?.addEventListener('input', async () => {
    const query = search.value;
    const token = MAPBOX_PUBLIC_TOKEN;
    if (query.length < 3) { if (suggestions) suggestions.innerHTML = ''; return; }

    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}`);
    const data = await res.json();

    if (suggestions) {
      suggestions.innerHTML = '';
      (data.features || []).forEach(feature => {
        const option = document.createElement('option');
        option.value = feature.place_name;
        suggestions.appendChild(option);
      });
    }
  });

  search?.addEventListener('keyup', async (e) => {
    if (e.key !== 'Enter') return;
    const query = search.value;
    const token = MAPBOX_PUBLIC_TOKEN;

    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}`);
    const data = await res.json();

    if ((data.features || []).length > 0) {
      const [lng, lat] = data.features[0].center;
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map).bindPopup(data.features[0].place_name).openPopup();
      map.setView([lat, lng], 16);
    } else {
      alert("Ingen adress hittades.");
    }
  });
});


















