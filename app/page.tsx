"use client";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import SurahPicker from "../components/SurahPicker";
import { useLanguage } from "../lib/i18n";

export default function Home() {
  const { t, language } = useLanguage();
  const hero = language === "ar"
    ? ["كل آية،", "لحظة تدبّر.", "اقرأ واستمع وتابع رحلتك مع القرآن الكريم، بروايات وأصوات وترجمات ترافقك بهدوء."]
    : language === "en"
      ? ["Every verse,", "a moment to reflect.", "Read, listen and continue your journey through the Quran, with recitations, voices and translations designed around you."]
      : ["Chaque verset,", "un instant pour méditer.", "Lisez, écoutez et poursuivez votre chemin dans le Coran, avec des récitations, des voix et des traductions pensées autour de vous."];
  return <main><SiteHeader active="home"/><section className="home-hero"><div className="halo h1"/><div className="halo h2"/><p className="eyebrow"><span/> القرآن الكريم <span/></p><h1>{hero[0]}<br/><em>{hero[1]}</em></h1><p className="lede">{hero[2]}</p><SurahPicker/><a className="quiet-link" href="/read">{t("resume")} →</a></section><section className="home-features"><article><span>01</span><h2>{t("voices")}</h2><p>{t("voicesText")}</p></article><article><span>02</span><h2>{t("tajweed")}</h2><p>{t("tajweedText")}</p></article><article><span>03</span><h2>{t("yourSurahs")}</h2><p>{t("yourSurahsText")}</p></article></section><section className="about-section"><span>{t("aboutEyebrow")}</span><h2>{t("aboutTitle")}</h2><p>{t("aboutText")}</p><div aria-hidden="true">✦</div></section><SiteFooter/></main>;
}
