"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { patchAndroidState } from "../lib/androidSync";
import { surahs } from "../lib/quran/surahs";
import { arabicNames } from "../lib/quran/arabicNames";

export default function PersonalLibrary() {
  const { t, language } = useLanguage();
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  const [favorites, setFavorites] = useState<number[]>([]), [progress, setProgress] = useState({ read: 0, minutes: 0, goal: 10 });
  useEffect(() => {
    const load = () => { try {
      const favorites = JSON.parse(localStorage.getItem("nur-favorite-surahs") || "[]"), read = JSON.parse(localStorage.getItem("nur-read-surahs") || "[]"), stats = JSON.parse(localStorage.getItem("nur-progress") || "{}");
      setFavorites(Array.isArray(favorites) ? favorites.filter(n => Number.isInteger(n) && n >= 1 && n <= 114) : []);
      setProgress({ minutes: Math.max(0, Number(stats.minutes) || 0), goal: Math.min(120, Math.max(1, Number(stats.goal) || 10)), read: Array.isArray(read) ? read.length : 0 });
    } catch { /* Empty library on a new device. */ } };
    load(); addEventListener("nur-cloud-hydrated", load); addEventListener("storage", load);
    return () => { removeEventListener("nur-cloud-hydrated", load); removeEventListener("storage", load); };
  }, []);
  function goal(value: number) {
    const next = { ...progress, goal: Math.min(120, Math.max(1, value || 10)) };
    setProgress(next); localStorage.setItem("nur-progress", JSON.stringify(next));
    const study = JSON.parse(localStorage.getItem("nur-study") || "{}"); localStorage.setItem("nur-study", JSON.stringify({ ...study, goal: next.goal }));
    patchAndroidState({ minutes: next.minutes, goal: next.goal }); dispatchEvent(new Event("nur-data-changed"));
  }
  return <section className="personal-library" aria-labelledby="library-title"><div className="personal-section-head"><span>{t("library")}</span><h2 id="library-title">{t("favoriteTitle")}</h2></div>
    {favorites.length ? <div className="favorite-grid" style={{ "--favorite-columns": Math.min(3, favorites.length) } as React.CSSProperties}>{favorites.map((n, index) => <a style={{ "--list-index": index } as React.CSSProperties} href={`/read?surah=${n}`} key={n}><span>{String(n).padStart(3, "0")}</span><h3>{language === "ar" ? arabicNames[n - 1] : surahs[n - 1].name}</h3><b>{t("open")} {language === "ar" ? "←" : "→"}</b></a>)}</div> : <div className="empty personal-empty"><span aria-hidden="true">♡</span><h3>{t("none")}</h3><p>{t("noneLead")}</p><a className="primary" href="/read">{t("discover")}</a></div>}
    <section className="favorites-progress" aria-labelledby="progress-title"><div><small>{local("VOTRE CHEMIN", "YOUR JOURNEY", "رحلتك")}</small><h2 id="progress-title">{local("Votre progression personnelle", "Your personal progress", "تقدمك الشخصي")}</h2></div><div className="favorites-progress-stats"><article><b>{progress.read}</b><span>/114 {local("sourates lues", "surahs read", "سورة مقروءة")}</span></article><article><b>{Math.floor(progress.minutes)}</b><span>{local("minutes d’écoute", "minutes listened", "دقيقة استماع")}</span></article></div><label>{local("Objectif quotidien en minutes", "Daily goal in minutes", "الهدف اليومي بالدقائق")}<input type="number" min="1" max="120" value={progress.goal} onChange={event => goal(Number(event.target.value))}/></label></section>
  </section>;
}
