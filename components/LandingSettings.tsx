"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../lib/i18n";
import { motionReduced } from "../lib/motion";
import ResetNur from "./ResetNur";

export default function LandingSettings({ onClose }: { onClose: () => void }) {
  const { language, setLanguage, t } = useLanguage(), [closing, setClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dialog = useRef<HTMLElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  function close() { if (closing || timer.current) return; if (motionReduced()) { onClose(); return; } setClosing(true); timer.current = setTimeout(onClose, 240); }
  function changeMotion(next: boolean) {
    setReducedMotion(next);
    localStorage.setItem("nur-reduced-motion", next ? "1" : "0");
    document.documentElement.setAttribute("data-motion", next ? "reduced" : "full");
    dispatchEvent(new Event("nur-data-changed"));
  }
  useEffect(() => {
    setReducedMotion(localStorage.getItem("nur-reduced-motion") === "1");
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("landing-settings-open");
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)") || []);
      const first = controls[0], last = controls.at(-1), outside = !controls.includes(document.activeElement as HTMLElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first?.focus(); }
    };
    addEventListener("keydown", keyboard);
    return () => { removeEventListener("keydown", keyboard); document.body.classList.remove("landing-settings-open"); if (timer.current) clearTimeout(timer.current); if (previous?.isConnected) previous.focus(); };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div className={`modal-layer landing-settings-layer${closing ? " closing" : ""}`} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className="settings-modal compact-settings landing-settings" role="dialog" aria-modal="true" aria-labelledby="landing-settings-title" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="modal-head"><div><small>NŪR</small><h2 id="landing-settings-title">{t("settings")}</h2></div><button className="icon" onClick={close} aria-label={t("close")}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <div className="settings-content"><div className="setting-group language-setting"><span className="setting-icon"><img className="settings-png-icon" src="/icons/ui/language.png" alt=""/></span><div><h3>{t("language")}</h3><p>{local("Cette langue sera aussi utilisée pour vos e-mails.", "Your emails will use this language too.", "سنستخدم هذه اللغة أيضًا في رسائل البريد الإلكتروني.")}</p><div className="choice-row language-choice" role="group" aria-label={t("language")}>{(["fr", "en", "ar"] as const).map(value => <button key={value} lang={value} aria-pressed={language === value} className={language === value ? "selected" : ""} onClick={() => setLanguage(value)}>{value === "fr" ? "Français" : value === "en" ? "English" : "العربية"}</button>)}</div></div></div><div className="setting-group motion-setting"><span className="setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10 5v14M16 5v14M4 8v8M22 10v4"/></svg></span><div><h3>{local("Animations réduites", "Reduced animations", "تقليل الحركات")}</h3><p>{local("Désactive toutes les animations et les défilements animés.", "Turns off all animations and smooth scrolling.", "يعطّل جميع الحركات والتمرير المتحرك.")}</p><label className="switch-line"><span>{local("Activer les animations réduites", "Enable reduced animations", "تفعيل تقليل الحركات")}</span><input type="checkbox" checked={reducedMotion} onChange={event => changeMotion(event.target.checked)}/></label></div></div><ResetNur deviceOnly/></div>
      <button className="primary modal-save" onClick={close}>{local("Terminé", "Done", "تم")}</button>
    </section>
  </div>, document.body);
}
