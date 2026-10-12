"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useLanguage, type Language } from "../lib/i18n";
import { hydrateFromAndroid, patchAndroidState } from "../lib/androidSync";
import { warshReciters } from "../lib/quran/adapters/alQuranCloud";
import { accountRequest, useAccount } from "./AccountProvider";
import SignInStep from "./SignInStep";
import { profileNameIssue } from "../lib/profileName";
import { languageWelcomeEvent, languageWelcomeKey, needsLanguageWelcome } from "../lib/firstVisit";
import { safeEntryDestination } from "../lib/appEntry";
import { motionReduced } from "../lib/motion";

const hafsVoices = [
  { id: "ar.alafasy", name: "Mishary Alafasy" },
  { id: "ar.husary", name: "Mahmoud Al-Hussary" },
  { id: "ar.abdurrahmaansudais", name: "Abdurrahman As-Sudais" },
  { id: "ar.mahermuaiqly", name: "Maher Al-Muaiqly" },
];
const words = {
  fr: { welcome: "Bienvenue", lead: "Préparons Nūr pour votre première lecture.", language: "Choisissez votre langue", reading: "Votre lecture", readingLead: "Sélectionnez une transmission, une voix et l’affichage des couleurs.", riwayah: "Transmission", voice: "Voix", colors: "Couleurs de tajwīd", unavailable: "indisponible", appearance: "Votre ambiance", appearanceLead: "Choisissez le thème qui vous accompagne le mieux.", dark: "Sombre", light: "Clair", reducedMotion: "Animations réduites", reducedMotionHelp: "Désactive toutes les animations et les défilements animés.", next: "Continuer", start: "Commencer à lire", back: "Retour" },
  en: { welcome: "Hello", lead: "Let’s prepare Nūr for your first reading.", language: "Choose your language", reading: "Your reading", readingLead: "Select a transmission, a voice and color display.", riwayah: "Transmission", voice: "Voice", colors: "Tajweed colors", unavailable: "unavailable", appearance: "Your atmosphere", appearanceLead: "Choose the theme that feels right for you.", dark: "Dark", light: "Light", reducedMotion: "Reduced animations", reducedMotionHelp: "Turns off all animations and smooth scrolling.", next: "Continue", start: "Start reading", back: "Back" },
  ar: { welcome: "مرحبًا", lead: "لنُعِدّ نُور لقراءتك الأولى.", language: "اختر لغتك", reading: "قراءتك", readingLead: "اختر الرواية والصوت وعرض ألوان التجويد.", riwayah: "الرواية", voice: "الصوت", colors: "ألوان التجويد", unavailable: "غير متاح", appearance: "أجواء القراءة", appearanceLead: "اختر المظهر الأنسب لك.", dark: "داكن", light: "فاتح", reducedMotion: "تقليل الحركات", reducedMotionHelp: "يعطّل جميع الحركات والتمرير المتحرك.", next: "متابعة", start: "ابدأ القراءة", back: "رجوع" },
} as const;

// Authentication → introduction → language → reading → atmosphere.
type Step = 0 | 1 | 2 | 3 | 4;
const AUTH: Step = 0, NAME: Step = 1, LANGUAGE: Step = 2, READING: Step = 3, AMBIENCE: Step = 4;

export default function WelcomeOnboarding() {
  const pathname = usePathname();
  const { user, ready: accountReady, guestAuthorized, syncStatus, refresh, synchronize } = useAccount();
  const { language, setLanguage } = useLanguage();
  const [visible, setVisible] = useState(false), [step, setStep] = useState<Step>(AUTH);
  const [mode, setMode] = useState<"login" | "signup">("signup"), [nameOnly, setNameOnly] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [name, setName] = useState(""), [finishing, setFinishing] = useState(false), [error, setError] = useState("");
  const [riwayah, setRiwayah] = useState<"hafs" | "warsh">("hafs"), [voice, setVoice] = useState("ar.alafasy");
  const [colors, setColors] = useState(false), [pronunciation, setPronunciation] = useState(true), [translation, setTranslation] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark"), [reducedMotion, setReducedMotion] = useState(false);
  const [direction, setDirection] = useState(1);
  const [languageIntroFinished, setLanguageIntroFinished] = useState(false);
  const [slideClosing, setSlideClosing] = useState(false);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false), card = useRef<HTMLElement>(null);
  const text = words[language];
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  function destination() {
    const next = new URLSearchParams(location.search).get("next") || sessionStorage.getItem("nur-auth-return-to");
    sessionStorage.removeItem("nur-auth-return-to");
    return safeEntryDestination(next);
  }
  useEffect(() => () => { if (slideTimer.current) clearTimeout(slideTimer.current); }, []);

  useEffect(() => {
    const completed = () => setLanguageIntroFinished(true);
    addEventListener(languageWelcomeEvent, completed);
    return () => removeEventListener(languageWelcomeEvent, completed);
  }, []);
  useEffect(() => {
    if (pathname !== "/welcome") { initialized.current = false; setVisible(false); return; }
    if (!accountReady || initialized.current) return;
    if (needsLanguageWelcome(!!user, localStorage.getItem("nur-onboarding-complete"), localStorage.getItem(languageWelcomeKey))) return;
    const query = new URLSearchParams(location.search), editName = query.get("name") === "1";
    const login = query.get("login") === "1" || query.get("mode") === "login";
    const explicitAuth = login || query.get("mode") === "signup" || query.has("auth");
    if (query.get("next")) sessionStorage.setItem("nur-auth-return-to", safeEntryDestination(query.get("next")));
    // Only account data can skip account setup: a guest's completion flag is not proof.
    if (!editName && ((user?.onboarded && (syncStatus === "saved" || syncStatus === "offline")) || (!user && guestAuthorized && !explicitAuth && localStorage.getItem("nur-onboarding-complete")))) {
      location.replace(destination()); return;
    }
    if (!user && guestAuthorized && query.has("next") && localStorage.getItem("nur-guest") === "1" && localStorage.getItem("nur-onboarding-complete") === "1") { location.replace(destination()); return; }
    let draft: Record<string, unknown> = {}, settings: Record<string, unknown> = {};
    try {
      const stored = JSON.parse(localStorage.getItem("nur-onboarding-draft") || "{}");
      if (stored.version === 2 && stored.owner === (user?.id || "guest") && stored.mode === (login ? "login" : "signup")) draft = stored;
      settings = JSON.parse(localStorage.getItem("nur-settings") || "{}");
    } catch { /* Ignore an old or damaged draft. */ }
    const shared = hydrateFromAndroid(), r = draft.riwayah || settings.riwayah || shared?.riwayah;
    setMode(login ? "login" : "signup"); setNameOnly(editName);
    setRiwayah(r === "warsh" ? "warsh" : "hafs");
    setVoice(String(draft.voice || settings.reciter || (r === "warsh" ? "omar-qazabri" : "ar.alafasy")));
    setTheme(localStorage.getItem("nur-theme") === "light" ? "light" : "dark");
    setColors(r !== "warsh" && !!(draft.colors ?? settings.tajweed ?? shared?.tajweed));
    setPronunciation(Boolean(draft.pronunciation ?? settings.showTransliteration ?? true));
    setTranslation(Boolean(draft.translation ?? (language === "en" ? settings.showEnglish : settings.showFrench) ?? true));
    setReducedMotion(localStorage.getItem("nur-reduced-motion") === "1");
    setName(String(draft.name ?? localStorage.getItem("nur-profile-name") ?? user?.name ?? ""));
    const resume = Math.min(AMBIENCE, Math.max(NAME, Number(draft.step) || NAME)) as Step;
    setStep(editName ? NAME : user && syncStatus === "saved" ? resume : !explicitAuth && draft.guest ? resume : AUTH);
    if (query.get("auth") === "failed") setError(local("La connexion Google n’a pas abouti. Réessayez ou utilisez votre adresse e-mail.", "Google sign-in did not complete. Try again or use your email address.", "لم يكتمل تسجيل الدخول عبر Google. حاول مجددًا أو استخدم بريدك الإلكتروني."));
    if (query.get("auth") === "account_exists") setError(local("Vous avez déjà un compte avec cette adresse. Choisissez « Se connecter » pour retrouver votre espace.", "You already have an account with this address. Choose “Sign in” to return to your space.", "لديك حساب بهذا البريد بالفعل. اختر «تسجيل الدخول» للعودة إلى مساحتك."));
    if (query.get("auth") === "account_missing") setError(local("Vous n’avez pas encore de compte avec cette adresse. Choisissez « S’inscrire » pour commencer.", "You don't have an account with this address yet. Choose “Sign up” to get started.", "ليس لديك حساب بهذا البريد بعد. اختر «إنشاء حساب» للبدء."));
    initialized.current = true; setVisible(true);
  }, [pathname, accountReady, user, guestAuthorized, syncStatus, language, languageIntroFinished]);

  useEffect(() => {
    if (!visible || !user || nameOnly || finishing) return;
    if (syncStatus === "saved" || (syncStatus === "offline" && user.onboarded)) {
      if (user.onboarded) { location.replace(destination()); return; }
      if (step === AUTH) {
        setName(localStorage.getItem("nur-profile-name") || user.name || "");
        setDirection(1); setStep(NAME); setError("");
      }
    }
  }, [visible, user, syncStatus, nameOnly, finishing, step]);

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add("onboarding-open");
    return () => document.body.classList.remove("onboarding-open");
  }, [visible]);
  useEffect(() => {
    if (visible) localStorage.setItem("nur-onboarding-draft", JSON.stringify({ version: 2, owner: user?.id || "guest", mode, guest: !user && step > AUTH, step, name, riwayah, voice, colors, pronunciation, translation }));
  }, [visible, user?.id, mode, step, name, riwayah, voice, colors, pronunciation, translation]);
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      if (card.current) { card.current.scrollTop = 0; const heading = card.current.querySelector<HTMLElement>("h1"); if (heading) { heading.tabIndex = -1; heading.focus(); } }
    });
    const trap = (event: KeyboardEvent) => {
      if (document.body.classList.contains("landing-settings-open")) return;
      if (event.key === "Escape" && step === AUTH) { event.preventDefault(); location.assign("/"); return; }
      if (event.key !== "Tab" || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)"));
      const first = items[0], last = items.at(-1), outside = !items.includes(document.activeElement as HTMLElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first?.focus(); }
    };
    addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); removeEventListener("keydown", trap); };
  }, [visible, step, mode]);

  function go(next: Step) {
    if (slideClosing) return;
    setDirection(next < step ? -1 : 1); setError("");
    if (motionReduced()) { setStep(next); return; }
    setSlideClosing(true);
    slideTimer.current = setTimeout(() => { setStep(next); setSlideClosing(false); slideTimer.current = null; }, 180);
  }
  function chooseLanguage(next: Language) { setLanguage(next); }
  function chooseAuthMode(next: "login" | "signup") {
    if (authBusy || user || next === mode) return;
    setDirection(next === "signup" ? 1 : -1); setMode(next); setError("");
    const url = new URL(location.href);
    url.searchParams.delete("login"); url.searchParams.delete("auth");
    url.searchParams.set("mode", next);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
  function chooseRiwayah(next: "hafs" | "warsh") { setRiwayah(next); setVoice(next === "warsh" ? "omar-qazabri" : "ar.alafasy"); if (next === "warsh") setColors(false); }
  function chooseTheme(next: "dark" | "light") {
    setTheme(next); document.documentElement.setAttribute("data-theme", next); localStorage.setItem("nur-theme", next);
    dispatchEvent(new CustomEvent("nur-theme-changed", { detail: next })); patchAndroidState({ theme: next });
  }
  function changeMotion(next: boolean) { setReducedMotion(next); localStorage.setItem("nur-reduced-motion", next ? "1" : "0"); document.documentElement.setAttribute("data-motion", next ? "reduced" : "full"); }
  const nameIssue = profileNameIssue(name), nameMissing = !!user && !name.trim();
  const nameError = nameIssue === "reserved" ? local("TU NEST PAS LE GOAT", "YOU ARE NOT THE GOAT", "لست الأسطورة") : nameIssue ? local("Nom inapproprié, astaghfirullah !", "Inappropriate name, astaghfirullah!", "اسم غير مناسب، أستغفر الله!") : "";

  async function finish() {
    if (finishing || nameIssue || nameMissing) return;
    setFinishing(true); setError("");
    try {
      const showFrench=language==="fr",showEnglish=language==="en";
      const tajweed = riwayah === "hafs" && colors;
      if (!nameOnly) {
        const settings = { riwayah, reciter: voice, fontSize: 40, tajweed, showFrench: translation && showFrench, showEnglish: translation && showEnglish, showTransliteration: pronunciation, playbackRate: 1, repeatVerse: false };
        localStorage.setItem("nur-settings", JSON.stringify(settings)); localStorage.removeItem("nur-translation-mode");
        patchAndroidState({ language, theme, riwayah, tajweed, pronunciation, french: translation && showFrench, english: translation && showEnglish, fontSize: 40 });
      }
      localStorage.setItem("nur-profile-name", name.trim().slice(0, 60));
      if (user) {
        localStorage.setItem("nur-onboarding-complete", "1");
        localStorage.removeItem("nur-guest");
        if (!await synchronize()) throw new Error("sync_failed");
      } else {
        if (navigator.onLine) {
          await accountRequest("/api/auth/guest", { method: "POST", body: JSON.stringify({ completed: true }) });
          if (!(await accountRequest("/api/auth/session")).guest) throw new Error("cookies_disabled");
        }
        localStorage.setItem("nur-guest", "1");
        localStorage.setItem("nur-onboarding-complete", "1");
      }
      localStorage.removeItem("nur-onboarding-draft");
      patchAndroidState({ onboarded: true });
      setVisible(false); document.body.classList.remove("onboarding-open"); location.assign(destination());
    } catch {
      setError(local("Vos choix sont conservés sur cet appareil. Vérifiez votre connexion et réessayez pour les synchroniser.", "Your choices are saved on this device. Check your connection and try again to synchronize them.", "حُفظت اختياراتك على هذا الجهاز. تحقّق من اتصالك وحاول مجددًا لمزامنتها."));
      setFinishing(false);
    }
  }
  function next() {
    if (step === NAME && (nameIssue || nameMissing)) { card.current?.querySelector<HTMLInputElement>("#profile-name")?.focus(); return; }
    if (nameOnly || step === AMBIENCE) void finish(); else go((step + 1) as Step);
  }
  if (!visible) return null;
  const voices = riwayah === "warsh" ? warshReciters : hafsVoices;
  const stages: Step[] = nameOnly ? [NAME] : mode === "login" && step === AUTH ? [AUTH] : [AUTH, NAME, LANGUAGE, READING, AMBIENCE];
  const slideStyle = { "--onboarding-enter": String(direction * (language === "ar" ? -22 : 22)) + "px" } as CSSProperties;

  return <div className="onboarding-layer" role="presentation"><section ref={card} className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="onboarding-card-head"><div className="onboarding-progress" aria-hidden="true">{stages.map(index => <span className={index === step ? "active" : index < step ? "done" : ""} key={index}/>)}</div>{step === AUTH && <a href="/" className="onboarding-close" aria-label={local("Retour à l’accueil", "Back to the home page", "العودة إلى الصفحة الرئيسية")} title={local("Retour à l’accueil", "Back to the home page", "العودة إلى الصفحة الرئيسية")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></a>}</div>
    <div className={`onboarding-slide${slideClosing ? " leaving" : ""}`} key={step === AUTH ? `auth-${mode}` : step} style={slideStyle} inert={slideClosing}>
      {step === AUTH && <>
        <span className="onboarding-kicker">01 · {mode === "login" ? local("Connexion", "Sign in", "تسجيل الدخول") : local("Inscription", "Sign up", "إنشاء حساب")}</span>
        <h1 id="onboarding-title">{mode === "login" ? local("Heureux de vous revoir", "Good to see you again", "يسعدنا لقاؤك مجددًا") : local("Bienvenue dans Nūr", "Welcome to Nūr", "مرحبًا بك في نُور")}</h1>
        <p>{mode === "login" ? local("Retrouvez votre espace, votre prénom et vos préférences de lecture.", "Return to your space, your name and your reading preferences.", "عُد إلى مساحتك واسمك وتفضيلات القراءة المحفوظة.") : local("Créez votre espace pour garder vos favoris et votre progression sur tous vos appareils.", "Create your space to keep your favorites and progress across your devices.", "أنشئ مساحتك لحفظ مفضلتك وتقدمك على جميع أجهزتك.")}</p>
        {!user && <div className="onboarding-auth-modes" role="group" aria-label={local("Connexion ou inscription", "Sign in or sign up", "تسجيل الدخول أو إنشاء حساب")}>
          <button type="button" aria-pressed={mode === "login"} disabled={authBusy} onClick={() => chooseAuthMode("login")}>{local("Se connecter", "Sign in", "تسجيل الدخول")}</button>
          <button type="button" aria-pressed={mode === "signup"} disabled={authBusy} onClick={() => chooseAuthMode("signup")}>{local("S’inscrire", "Sign up", "إنشاء حساب")}</button>
        </div>}
        <SignInStep key={mode} mode={mode} onBusyChange={setAuthBusy} onContinue={() => void refresh()}/>
        {user && syncStatus === "error" && <p className="account-error" role="alert">{local("Impossible de récupérer vos préférences. Réessayez avec Continuer.", "Your preferences could not be restored. Try Continue again.", "تعذّر استعادة تفضيلاتك. حاول مجددًا بالضغط على متابعة.")}</p>}
      </>}
      {step === NAME && <>
        <span className="onboarding-kicker">02 · NŪR</span><h1 id="onboarding-title">{local("Faisons connaissance", "Let’s get acquainted", "لنتعرّف إليك")}</h1>
        <p>{user ? local("Comment souhaitez-vous être appelé ? Votre prénom sera sauvegardé avec votre compte.", "What would you like to be called? Your name will be saved with your account.", "بأي اسم تود أن نناديك؟ سنحفظ اسمك مع حسابك.") : local("Vous continuez en invité. Vous pouvez donner un prénom ou laisser ce champ vide.", "You are continuing as a guest. Add a first name or leave this blank.", "تتابع كضيف. يمكنك إدخال اسم أو ترك الخانة فارغة.")}</p>
        <label className="profile-name-label" htmlFor="profile-name">{local("Prénom ou pseudonyme", "First name or nickname", "الاسم أو اللقب")}</label>
        <input className={"profile-name-input" + (nameIssue ? " invalid" : "")} id="profile-name" autoComplete="given-name" aria-invalid={!!nameIssue} aria-describedby={nameIssue ? "profile-name-error" : "profile-name-help"} value={name} maxLength={60} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); next(); } }}/>
        {nameError && <p id="profile-name-error" className="profile-name-error" role="alert">{nameError}</p>}
        <small id="profile-name-help" className="profile-name-help">{local("Vous pourrez modifier vos préférences dans les paramètres.", "You can change your preferences in settings.", "يمكنك تعديل تفضيلاتك في الإعدادات.")}</small>
      </>}
      {step === LANGUAGE && <>
        <span className="onboarding-kicker">03 · NŪR</span><h1 id="onboarding-title" lang={language === "ar" ? "ar" : undefined}>{text.welcome}</h1><p>{text.lead}</p><h2>{text.language}</h2>
        <div className="language-cards"><button className={language === "fr" ? "selected" : ""} onClick={() => chooseLanguage("fr")}><b>FR</b><span>Français</span></button><button className={language === "en" ? "selected" : ""} onClick={() => chooseLanguage("en")}><b>EN</b><span>English</span></button><button className={language === "ar" ? "selected" : ""} onClick={() => chooseLanguage("ar")}><b>ع</b><span>العربية</span></button></div>
      </>}
      {step === READING && <>
        <span className="onboarding-kicker">04 · {text.riwayah}</span><h1 id="onboarding-title">{text.reading}</h1><p>{text.readingLead}</p>
        <div className="onboarding-setting"><label>{text.riwayah}</label><div className="onboarding-choice"><button className={riwayah === "hafs" ? "selected" : ""} onClick={() => chooseRiwayah("hafs")}><b>{language === "ar" ? "حفص" : "Ḥafṣ"}</b><span>{language === "ar" ? "عن عاصم" : "ʿan ʿĀṣim"}</span></button><button className={riwayah === "warsh" ? "selected" : ""} onClick={() => chooseRiwayah("warsh")}><b>{language === "ar" ? "ورش" : "Warsh"}</b><span>{language === "ar" ? "عن نافع" : "ʿan Nāfiʿ"}</span></button></div></div>
        <div className="onboarding-setting"><label htmlFor="onboarding-voice">{text.voice}</label><select id="onboarding-voice" value={voice} onChange={event => setVoice(event.target.value)}>{voices.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <label className="onboarding-switch"><span><b>{text.colors}</b><small>{riwayah === "warsh" ? text.unavailable : language === "ar" ? "حفص" : "Ḥafṣ"}</small></span><input type="checkbox" checked={riwayah === "hafs" && colors} disabled={riwayah === "warsh"} onChange={event => setColors(event.target.checked)}/></label>
        <div className="onboarding-display-options"><label className="onboarding-switch"><span><b>{local("Prononciation", "Pronunciation", "النطق بالحروف اللاتينية")}</b></span><input type="checkbox" checked={pronunciation} onChange={event => setPronunciation(event.target.checked)}/></label>{language !== "ar" && <label className="onboarding-switch"><span><b>{local("Traduction française", "English translation", "الترجمة")}</b></span><input type="checkbox" checked={translation} onChange={event => setTranslation(event.target.checked)}/></label>}</div>
      </>}
      {step === AMBIENCE && <>
        <span className="onboarding-kicker">05 · NŪR</span><h1 id="onboarding-title">{text.appearance}</h1><p>{text.appearanceLead}</p>
        <div className="theme-cards"><button className={theme === "dark" ? "selected" : ""} onClick={() => chooseTheme("dark")}><span className="theme-preview dark-preview"><i/></span><b>{text.dark}</b></button><button className={theme === "light" ? "selected" : ""} onClick={() => chooseTheme("light")}><span className="theme-preview light-preview"><i/></span><b>{text.light}</b></button></div>
        <label className="onboarding-switch motion-option"><span><b>{text.reducedMotion}</b><small>{text.reducedMotionHelp}</small></span><input type="checkbox" checked={reducedMotion} onChange={event => changeMotion(event.target.checked)}/></label>
      </>}
    </div>
    {error && <p className="account-error onboarding-error" role="alert">{error}</p>}
    <div className="onboarding-actions">
      {!nameOnly && (step > NAME || (!user && step === NAME)) && <button className="onboarding-back" disabled={finishing || slideClosing} onClick={() => go((step - 1) as Step)} aria-label={text.back}><span/></button>}
      {step === AUTH ? (!user && <button className="onboarding-skip" disabled={slideClosing || authBusy} onClick={() => go(NAME)}>{local("Ignorer · continuer en invité", "Skip · continue as a guest", "تخطّ · تابع كضيف")}</button>) : <button className="onboarding-next" disabled={finishing || slideClosing || (step === NAME && (!!nameIssue || nameMissing))} onClick={next}>{finishing ? local("Sauvegarde…", "Saving…", "جارٍ الحفظ…") : nameOnly ? local("Enregistrer", "Save", "حفظ") : step === AMBIENCE ? text.start : text.next}<span className="onboarding-arrow" aria-hidden="true"/></button>}
    </div>
  </section></div>;
}
