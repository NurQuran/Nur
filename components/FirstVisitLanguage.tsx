"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { accountRequest, useAccount } from "./AccountProvider";
import { useLanguage, type Language } from "../lib/i18n";
import { languageWelcomeEvent, languageWelcomeKey, needsLanguageWelcome } from "../lib/firstVisit";
import { motionReduced } from "../lib/motion";

const languages: { id: Language; abbreviation: string; name: string }[] = [
  { id: "fr", abbreviation: "FR", name: "Français" },
  { id: "en", abbreviation: "EN", name: "English" },
  { id: "ar", abbreviation: "ع", name: "العربية" },
];
export default function FirstVisitLanguage() {
  const pathname = usePathname(), { user, ready: accountReady } = useAccount();
  const { language, ready: languageReady, setLanguage } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLElement>(null), chosen = useRef(false);
  const publicPage = pathname === "/" || pathname === "/welcome";
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!publicPage || !accountReady || !languageReady) { setVisible(false); return; }
    if (!needsLanguageWelcome(!!user, localStorage.getItem("nur-onboarding-complete"), localStorage.getItem(languageWelcomeKey))) {
      setVisible(false); return;
    }
    setVisible(true);
    if (localStorage.getItem("nur-language")) return;
    const abort = new AbortController();
    void accountRequest("/api/region", { signal: abort.signal }).then(region => {
      if (abort.signal.aborted || chosen.current || localStorage.getItem("nur-language")) return;
      const suggested = region.regional ? region.language : navigator.language.startsWith("fr") ? "fr" : navigator.language.startsWith("ar") ? "ar" : "en";
      if (suggested === "fr" || suggested === "en" || suggested === "ar") setLanguage(suggested);
    }).catch(() => {});
    return () => abort.abort();
  }, [publicPage, accountReady, languageReady, user]);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("language-welcome-open");
    dialog.current?.querySelector<HTMLElement>("h1")?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button") || []);
      const first = buttons[0], last = buttons.at(-1), outside = !buttons.includes(document.activeElement as HTMLButtonElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first?.focus(); }
    }
    addEventListener("keydown", trap);
    return () => { document.body.classList.remove("language-welcome-open"); removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [visible]);
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  function complete() {
    if (closing) return;
    // Persist even the suggested/default choice; email requests use this same language.
    setLanguage(language);
    const finish = () => {
      localStorage.setItem(languageWelcomeKey, "1");
      setVisible(false); setClosing(false); closeTimer.current = null;
      dispatchEvent(new Event(languageWelcomeEvent));
    };
    if (motionReduced()) { finish(); return; }
    setClosing(true); closeTimer.current = setTimeout(finish, 240);
  }
  if (!visible) return null;
  return <div className={`onboarding-layer language-welcome-layer${closing ? " closing" : ""}`} role="presentation">
    <section ref={dialog} className="onboarding-card language-welcome-card" role="dialog" aria-modal="true" aria-labelledby="language-welcome-title" aria-describedby="language-welcome-description" dir={language === "ar" ? "rtl" : "ltr"}>
      <span className="onboarding-kicker">NŪR</span>
      <div className="language-welcome-copy" key={language}><h1 id="language-welcome-title" tabIndex={-1}>{local("Bienvenue dans Nūr", "Welcome to Nūr", "مرحبًا بك في نُور")}</h1>
      <p id="language-welcome-description">{local("Choisissez votre langue pour commencer. Vos e-mails seront aussi envoyés dans cette langue.", "Choose your language to get started. Your emails will use this language too.", "اختر لغتك للبدء. سنرسل رسائل البريد الإلكتروني بهذه اللغة أيضًا.")}</p></div>
      <div className="language-cards" role="group" aria-label={local("Choisissez votre langue", "Choose your language", "اختر لغتك")}>
        {languages.map(item => <button key={item.id} disabled={closing} type="button" lang={item.id} dir={item.id === "ar" ? "rtl" : "ltr"} className={language === item.id ? "selected" : ""} aria-pressed={language === item.id} onClick={() => { chosen.current = true; setLanguage(item.id); }}><b>{item.abbreviation}</b><span>{item.name}</span></button>)}
      </div>
      <div className="onboarding-actions"><button type="button" disabled={closing} className="onboarding-next" onClick={complete}>{local("Continuer", "Continue", "متابعة")}<span className="onboarding-arrow" aria-hidden="true"/></button></div>
    </section>
  </div>;
}
