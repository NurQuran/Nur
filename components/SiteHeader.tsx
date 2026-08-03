"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
import PwaInstallButton from "./PwaInstallButton";

export default function SiteHeader({ active = "home", onSettings }: { active?: "home" | "read" | "favorites"; onSettings?: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const { t } = useLanguage();
  useEffect(() => {
    const saved = localStorage.getItem("nur-theme") as "light" | "dark" | null;
    const initial = saved || "dark";
    setTheme(initial); document.documentElement.setAttribute("data-theme", initial);
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); localStorage.setItem("nur-theme", next); document.documentElement.setAttribute("data-theme", next);
  }
  return <header className="topbar">
    <a className="brand logo-brand" href="/" aria-label="Nūr, accueil"><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
    <nav aria-label="Navigation principale"><a className={active === "home" ? "active" : ""} href="/">{t("home")}</a><a className={active === "read" ? "active" : ""} href="/read">{t("read")}</a><a className={active === "favorites" ? "active" : ""} href="/favorites">{t("favorites")}</a></nav>
    <div className="header-actions"><PwaInstallButton />{onSettings && <button className="text-button settings-trigger" onClick={onSettings}><span aria-hidden="true">⌘</span> {t("settings")}</button>}<button className="icon theme-trigger" aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"} onClick={toggleTheme}>{theme === "dark" ? "☀" : "☾"}</button></div>
  </header>;
}
