"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { hydrateFromAndroid, patchAndroidState, readAndroidState } from "../lib/androidSync";
import PwaInstallButton from "./PwaInstallButton";

export default function SiteHeader({ active = "home", onSettings }: { active?: "home" | "read" | "favorites" | "assistant"; onSettings?: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [navHidden, setNavHidden] = useState(false);
  const [generalSettings,setGeneralSettings]=useState(false);
  const lastScroll = useRef(0);
  const scrollFrame = useRef(0);
  const themePress = useRef<{x:number;y:number;at:number}|null>(null);
  const { t, language, setLanguage } = useLanguage();
  useEffect(() => {
    hydrateFromAndroid();
    const saved = readAndroidState()?.theme || localStorage.getItem("nur-theme") as "light" | "dark" | null;
    const initial = saved || "dark";
    setTheme(initial); document.documentElement.setAttribute("data-theme", initial);
  }, []);
  useEffect(() => {
    if (active !== "read") return;
    const onScroll = () => {
      if(scrollFrame.current)return;
      scrollFrame.current=requestAnimationFrame(()=>{
        const current = Math.max(0, window.scrollY);
        const readingSurah = new URLSearchParams(location.search).has("surah");
        if (!readingSurah || current < 90) setNavHidden(false);
        else if (current > lastScroll.current + 8) setNavHidden(true);
        else if (current < lastScroll.current - 8) setNavHidden(false);
        lastScroll.current = current;
        scrollFrame.current=0;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {removeEventListener("scroll", onScroll);if(scrollFrame.current)cancelAnimationFrame(scrollFrame.current)};
  }, [active]);
  function toggleTheme() {
    const current=document.documentElement.getAttribute("data-theme")==="light"?"light":"dark";
    const next = current === "dark" ? "light" : "dark";
    setTheme(next); localStorage.setItem("nur-theme", next); patchAndroidState({theme:next}); document.documentElement.setAttribute("data-theme", next);
  }
  return <><header className={`topbar${navHidden ? " mobile-hidden" : ""}`}>
    <a className="brand logo-brand" href="/" aria-label={`Nūr · ${t("home")}`}><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
    <nav aria-label={t("mainNavigation")}><a className={active === "home" ? "active" : ""} href="/">{t("home")}</a><a className={active === "read" ? "active" : ""} href="/read">{t("read")}</a><a className={active === "assistant" ? "active" : ""} href="/assistant">Fqih</a><a className={active === "favorites" ? "active" : ""} href="/favorites">{t("favorites")}</a></nav>
    <div className="header-actions"><PwaInstallButton /><button className="text-button settings-trigger" onClick={()=>onSettings?onSettings():setGeneralSettings(true)} aria-label={t("settings")}><img className="header-png-icon" src="/icons/ui/settings.png" alt=""/><span className="settings-label">{t("settings")}</span></button><button className="icon theme-trigger" aria-label={theme === "dark" ? (language==="ar"?"تفعيل الوضع الفاتح":language==="en"?"Enable light mode":"Activer le mode clair") : (language==="ar"?"تفعيل الوضع الداكن":language==="en"?"Enable dark mode":"Activer le mode sombre")} aria-pressed={theme==="light"} onPointerDown={event=>{event.stopPropagation();themePress.current={x:event.clientX,y:event.clientY,at:performance.now()}}} onPointerUp={event=>{event.preventDefault();event.stopPropagation();const press=themePress.current;themePress.current=null;if(press&&performance.now()-press.at<900&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<12)toggleTheme()}} onPointerCancel={()=>{themePress.current=null}} onClick={event=>{event.preventDefault();event.stopPropagation()}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleTheme()}}}><img className="header-png-icon" src={theme === "dark" ? "/icons/ui/sun.png" : "/icons/ui/moon.png"} alt=""/></button></div>
  </header>{generalSettings&&<div className="modal-layer global-settings-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&setGeneralSettings(false)}><section className="settings-modal compact-settings" role="dialog" aria-modal="true" aria-labelledby="global-settings-title"><div className="modal-head"><div><small>{t("preferences")}</small><h2 id="global-settings-title">{t("settings")}</h2></div><button className="icon" onClick={()=>setGeneralSettings(false)} aria-label={t("close")}>×</button></div><div className="settings-content"><div className="setting-group language-setting"><span className="setting-icon"><img className="settings-png-icon" src="/icons/ui/language.png" alt=""/></span><div><h3>{t("language")}</h3><p>{language==="ar"?"اختر لغة الواجهة كاملة.":language==="en"?"Choose the language of the entire interface.":"Choisissez la langue de toute l’interface."}</p><div className="choice-row language-choice"><button className={language==="fr"?"selected":""} onClick={()=>setLanguage("fr")}><strong>Français</strong><small>FR</small></button><button className={language==="en"?"selected":""} onClick={()=>setLanguage("en")}><strong>English</strong><small>EN</small></button><button className={language==="ar"?"selected":""} onClick={()=>setLanguage("ar")}><strong>العربية</strong><small>ع</small></button></div></div></div></div><button className="primary modal-save" onClick={()=>setGeneralSettings(false)}>{t("apply")}</button></section></div>}</>;
}
