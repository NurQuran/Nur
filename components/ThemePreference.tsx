"use client";

import { useEffect, useState } from "react";
import { patchAndroidState } from "../lib/androidSync";
import { useLanguage } from "../lib/i18n";
import UiIcon from "./UiIcon";

type Theme = "dark" | "light";

export const THEME_CHANGE_EVENT = "nur-theme-changed";

export function setSiteTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nur-theme", next);
  patchAndroidState({ theme: next });
  dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: next }));
}

export default function ThemePreference() {
  const { language } = useLanguage();
  const [theme, setTheme] = useState<Theme>("dark");
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    sync();
    addEventListener(THEME_CHANGE_EVENT, sync);
    addEventListener("storage", sync);
    return () => { removeEventListener(THEME_CHANGE_EVENT, sync); removeEventListener("storage", sync); };
  }, []);

  function choose(next: Theme) { setTheme(next); setSiteTheme(next); }

  return <div className="setting-group appearance-setting">
    <span className="setting-icon" aria-hidden="true"><UiIcon name={theme === "dark" ? "moon" : "sun"}/></span>
    <div><h3>{local("Apparence", "Appearance", "المظهر")}</h3>
      <p>{local("Choisissez le mode clair ou sombre.", "Choose light or dark mode.", "اختر الوضع الفاتح أو الداكن.")}</p>
      <div className="choice-row appearance-choice" role="group" aria-label={local("Apparence", "Appearance", "المظهر")}>
        <button type="button" className={theme === "dark" ? "selected" : ""} aria-pressed={theme === "dark"} onClick={() => choose("dark")}><UiIcon name="moon"/>{local("Sombre", "Dark", "داكن")}</button>
        <button type="button" className={theme === "light" ? "selected" : ""} aria-pressed={theme === "light"} onClick={() => choose("light")}><UiIcon name="sun"/>{local("Clair", "Light", "فاتح")}</button>
      </div>
    </div>
  </div>;
}
