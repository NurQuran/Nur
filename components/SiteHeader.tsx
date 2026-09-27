"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { hydrateFromAndroid, patchAndroidState, readAndroidState } from "../lib/androidSync";
import PwaInstallButton from "./PwaInstallButton";
import UiIcon from "./UiIcon";
import ThemePreference, { setSiteTheme, THEME_CHANGE_EVENT } from "./ThemePreference";
import { motionReduced } from "../lib/motion";

export default function SiteHeader({ active = "home", onSettings }: { active?: "home" | "read" | "favorites" | "assistant"; onSettings?: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [navHidden, setNavHidden] = useState(false);
  const [generalSettings,setGeneralSettings]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(false);
  const lastScroll = useRef(0);
  const scrollFrame = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  const indicatorFrame = useRef(0);
  const themePress = useRef<{x:number;y:number;at:number}|null>(null);
  const { t, language, setLanguage } = useLanguage();
  useLayoutEffect(()=>{
    const positions={home:0,read:1,assistant:2,favorites:3};
    const target=positions[active];
    const nav=navRef.current;
    if(!nav)return;
    const links=Array.from(nav.querySelectorAll("a"));
    let raw:string|null=null;
    try{raw=sessionStorage.getItem("nur-last-nav-position")}catch{}
    const previous=raw===null?target:Number(raw);
    const start=Number.isInteger(previous)&&previous>=0&&previous<links.length?previous:target;
    const measure=(index:number)=>{
      const parent=nav.getBoundingClientRect();
      const link=links[index].getBoundingClientRect();
      return {x:link.left-parent.left,width:link.width};
    };
    const setIndicator=(index:number)=>{
      const {x,width}=measure(index);
      nav.style.setProperty("--nav-x",`${x}px`);
      nav.style.setProperty("--nav-width",`${width}px`);
    };
    nav.classList.remove("nav-ready");
    setIndicator(start);
    void nav.offsetWidth;
    try{sessionStorage.setItem("nur-last-nav-position",String(target))}catch{}
    if(motionReduced()){setIndicator(target);nav.classList.add("nav-ready")}
    else indicatorFrame.current=requestAnimationFrame(()=>{
      nav.classList.add("nav-ready");
      indicatorFrame.current=requestAnimationFrame(()=>setIndicator(target));
    });
    const resize=()=>setIndicator(target);
    addEventListener("resize",resize);
    return()=>{cancelAnimationFrame(indicatorFrame.current);removeEventListener("resize",resize)};
  },[active,language]);
  useEffect(() => {
    hydrateFromAndroid();
    const saved = readAndroidState()?.theme || localStorage.getItem("nur-theme") as "light" | "dark" | null;
    const initial = saved || "dark";
    setTheme(initial); document.documentElement.setAttribute("data-theme", initial);
    setReducedMotion(localStorage.getItem("nur-reduced-motion")==="1");
    const syncTheme=()=>setTheme(document.documentElement.getAttribute("data-theme")==="light"?"light":"dark");
    addEventListener(THEME_CHANGE_EVENT,syncTheme);
    return()=>removeEventListener(THEME_CHANGE_EVENT,syncTheme);
  }, []);
  useEffect(()=>{patchAndroidState({currentView:active});},[active]);
  useEffect(()=>{
    const nativeTheme=()=>toggleTheme();
    const nativeSettings=()=>onSettings?onSettings():setGeneralSettings(true);
    addEventListener("nur-native-theme",nativeTheme);
    addEventListener("nur-native-settings",nativeSettings);
    return()=>{removeEventListener("nur-native-theme",nativeTheme);removeEventListener("nur-native-settings",nativeSettings)};
  });
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
    setTheme(next); setSiteTheme(next);
  }
  function changeMotion(next:boolean){setReducedMotion(next);localStorage.setItem("nur-reduced-motion",next?"1":"0");document.documentElement.setAttribute("data-motion",next?"reduced":"full")}
  return <><header className={`topbar${navHidden ? " mobile-hidden" : ""}`}>
    <a className="brand logo-brand" href="/" aria-label={`Nūr · ${t("home")}`}><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
    <nav ref={navRef} aria-label={t("mainNavigation")}><a className={active === "home" ? "active" : ""} href="/">{t("home")}</a><a className={active === "read" ? "active" : ""} href="/read">{t("read")}</a><a className={active === "assistant" ? "active" : ""} href="/assistant">{language==="ar"?"فقيه":"Fqih"}</a><a className={active === "favorites" ? "active" : ""} href="/favorites">{t("favorites")}</a></nav>
    <div className="header-actions"><PwaInstallButton /><button className="text-button settings-trigger" onClick={()=>onSettings?onSettings():setGeneralSettings(true)} aria-label={t("settings")}><img className="header-png-icon" src="/icons/ui/settings.png" alt=""/><span className="settings-label">{t("settings")}</span></button><button className="icon theme-trigger" aria-label={theme === "dark" ? (language==="ar"?"تفعيل الوضع الفاتح":language==="en"?"Enable light mode":"Activer le mode clair") : (language==="ar"?"تفعيل الوضع الداكن":language==="en"?"Enable dark mode":"Activer le mode sombre")} aria-pressed={theme==="light"} onPointerDown={event=>{event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom)themePress.current={x:event.clientX,y:event.clientY,at:performance.now()}}} onPointerUp={event=>{event.preventDefault();event.stopPropagation();const press=themePress.current,rect=event.currentTarget.getBoundingClientRect();themePress.current=null;if(press&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom&&performance.now()-press.at<900&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<12)toggleTheme()}} onPointerCancel={()=>{themePress.current=null}} onClick={event=>{event.preventDefault();event.stopPropagation()}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleTheme()}}}><UiIcon name={theme === "dark" ? "sun" : "moon"} className="theme-control-icon"/></button></div>
  </header>{generalSettings&&<div className="modal-layer global-settings-layer" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&setGeneralSettings(false)}><section className="settings-modal compact-settings" role="dialog" aria-modal="true" aria-labelledby="global-settings-title"><div className="modal-head"><div><small>{t("preferences")}</small><h2 id="global-settings-title">{t("settings")}</h2></div><button className="icon" onClick={()=>setGeneralSettings(false)} aria-label={t("close")}>×</button></div><div className="settings-content"><ThemePreference/><div className="setting-group language-setting"><span className="setting-icon"><img className="settings-png-icon" src="/icons/ui/language.png" alt=""/></span><div><h3>{t("language")}</h3><p>{language==="ar"?"اختر لغة الواجهة كاملة.":language==="en"?"Choose the language of the entire interface.":"Choisissez la langue de toute l’interface."}</p><div className="choice-row language-choice"><button className={language==="fr"?"selected":""} onClick={()=>setLanguage("fr")}><strong>Français</strong><small>FR</small></button><button className={language==="en"?"selected":""} onClick={()=>setLanguage("en")}><strong>English</strong><small>EN</small></button><button className={language==="ar"?"selected":""} onClick={()=>setLanguage("ar")}><strong>العربية</strong><small>ع</small></button></div></div></div><div className="setting-group motion-setting"><span className="setting-icon" aria-hidden="true">◌</span><div><h3>{language==="ar"?"تقليل الحركات":language==="en"?"Reduced animations":"Animations réduites"}</h3><p>{language==="ar"?"يعطّل جميع الحركات والتمرير المتحرك.":language==="en"?"Turns off all animations and smooth scrolling.":"Désactive toutes les animations et les défilements animés."}</p><label className="switch-line"><span>{language==="ar"?"تفعيل":language==="en"?"Enable":"Activer"}</span><input type="checkbox" checked={reducedMotion} onChange={e=>changeMotion(e.target.checked)}/></label></div></div></div><button className="primary modal-save" onClick={()=>setGeneralSettings(false)}>{t("apply")}</button></section></div>}</>;
}
