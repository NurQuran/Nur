"use client";
import { useEffect, useState } from "react";
import { useAccount } from "./AccountProvider";
import { useLanguage } from "../lib/i18n";

export default function SiteFooter({landing=false}:{landing?:boolean}) {
  const { t, language } = useLanguage();
  const {ready}=useAccount();
  const [homeHref,setHomeHref]=useState("/");
  useEffect(()=>{if(ready)setHomeHref(localStorage.getItem("nur-onboarding-complete")?"/home":"/")},[ready]);
  return <footer className="site-footer">
    <div className="footer-main">
      <a className="brand logo-brand footer-logo" href={homeHref} aria-label="Nūr"><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
      {!landing&&<nav><a href={homeHref}>{t("home")}</a><a href="/read">{t("read")}</a><a href="/assistant">{language==="ar"?"فقيه":"Fqih"}</a><a href="/favorites">{language==="ar"?"الأحاديث":"Hadiths"}</a></nav>}
    </div>
    <div className="credits"><span>{t("credits")}</span><p>{t("creditText")}</p><a className="github-link" href="https://github.com/NurQuran/Nur" target="_blank" rel="noreferrer" aria-label="GitHub Nūr">GitHub <span aria-hidden="true">↗</span></a><span>© 2026 Nūr</span></div>
  </footer>;
}
