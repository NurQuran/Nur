"use client";
import { useLanguage } from "../lib/i18n";

export default function SiteFooter() {
  const { t } = useLanguage();
  return <footer className="site-footer">
    <div className="footer-main">
      <a className="brand logo-brand footer-logo" href="/" aria-label="Nūr"><span className="logo-crop"><img src="/nur-logo.png" alt="Nūr" /></span></a>
      <nav><a href="/">{t("home")}</a><a href="/read">{t("read")}</a><a href="/assistant">Fqih</a><a href="/favorites">{t("favorites")}</a></nav>
    </div>
    <div className="credits"><span>{t("credits")}</span><p>{t("creditText")}</p><a className="github-link" href="https://github.com/NurQuran/Nur" target="_blank" rel="noreferrer" aria-label="GitHub Nūr">GitHub <span aria-hidden="true">↗</span></a><span>© 2026 Nūr</span></div>
  </footer>;
}
