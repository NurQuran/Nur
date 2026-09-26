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
  return <main><SiteHeader active="home"/><section className="home-hero"><div className="halo h1"/><div className="halo h2"/><p className="eyebrow"><span/><b className="desktop-home-name">القرآن الكريم</b><b className="mobile-home-name">NŪR · القرآن الكريم</b><span/></p><h1>{hero[0]}<br/><em>{hero[1]}</em></h1><p className="lede">{hero[2]}</p><SurahPicker/><a className="quiet-link" href="/read">{t("resume")} →</a></section><section className="home-features"><article><span>01</span><h2>{t("voices")}</h2><p>{t("voicesText")}</p></article><article><span>02</span><h2>{language==="ar"?"فقيه · مساعد تعليمي":language==="en"?"Fqih · educational assistant":"Fqih · assistant éducatif"}</h2><p>{language==="ar"?"اطرح سؤالًا عن سورة أو آية واستكشف شرحًا بحذر، مع اتصال بالإنترنت.":language==="en"?"Ask about a surah or verse and explore a careful explanation when online.":"Posez une question sur une sourate ou un verset et découvrez une explication prudente, avec connexion."}</p></article><article><span>03</span><h2>{t("yourSurahs")}</h2><p>{t("yourSurahsText")}</p></article></section><section className="about-section"><span>{t("aboutEyebrow")}</span><h2>{t("aboutTitle")}</h2><p>{language==="ar"?"أُنشئ نُور على يد شاب يبلغ من العمر 14 عامًا بنية الصدقة الجارية: مساحة مجانية تُيسّر قراءة القرآن والاستماع إليه وفهمه.":language==="en"?"Nūr was created by a 14-year-old as a sadaqah jariyah: a free space for reading, listening to and understanding the Quran.":"Nūr a été créé par un jeune de 14 ans comme une sadaqa jariya : un espace gratuit pour faciliter la lecture, l’écoute et la compréhension du Coran."}</p><div aria-hidden="true">✦</div></section><SiteFooter/></main>;
}
