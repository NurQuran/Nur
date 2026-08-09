"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
import PwaInstallButton from "./PwaInstallButton";

export default function SiteHeader({ active = "home", onSettings }: { active?: "home" | "read" | "favorites" | "assistant"; onSettings?: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [navHidden, setNavHidden] = useState(false);
  const lastScroll = useRef(0);
  const { t, language } = useLanguage();
  useEffect(() => {
    const saved = localStorage.getItem("nur-theme") as "light" | "dark" | null;
    const initial = saved || "dark";
    setTheme(initial); document.documentElement.setAttribute("data-theme", initial);
  }, []);
  useEffect(() => {
    if (active !== "read") return;
    const onScroll = () => {
      const current = Math.max(0, window.scrollY);
      const readingSurah = new URLSearchParams(location.search).has("surah");
      if (!readingSurah || current < 90) setNavHidden(false);
      else if (current > lastScroll.current + 6) setNavHidden(true);
      else if (current < lastScroll.current - 6) setNavHidden(false);
      lastScroll.current = current;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [active]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); localStorage.setItem("nur-theme", next); document.documentElement.setAttribute("data-theme", next);
  }
  return <header className={`topbar${navHidden ? " mobile-hidden" : ""}`}>
    <a className="brand logo-brand" href="/" aria-label={`Nūr · ${t("home")}`}><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
    <nav aria-label={t("mainNavigation")}><a className={active === "home" ? "active" : ""} href="/">{t("home")}</a><a className={active === "read" ? "active" : ""} href="/read">{t("read")}</a><a className={active === "assistant" ? "active" : ""} href="/assistant">Fqih</a><a className={active === "favorites" ? "active" : ""} href="/favorites">{t("favorites")}</a></nav>
    <div className="header-actions"><PwaInstallButton />{onSettings && <button className="text-button settings-trigger" onClick={onSettings} aria-label={t("settings")}><span className="settings-glyph" aria-hidden="true"><i/><i/></span><span className="settings-label">{t("settings")}</span></button>}<button className="icon theme-trigger" aria-label={theme === "dark" ? (language==="ar"?"تفعيل الوضع الفاتح":language==="en"?"Enable light mode":"Activer le mode clair") : (language==="ar"?"تفعيل الوضع الداكن":language==="en"?"Enable dark mode":"Activer le mode sombre")} onClick={toggleTheme}><span className={theme === "dark" ? "theme-glyph sun-glyph" : "theme-glyph moon-glyph"} aria-hidden="true"><i/></span></button></div>
  </header>;
}
