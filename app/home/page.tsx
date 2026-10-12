"use client";
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import SurahPicker from "../../components/SurahPicker";
import PersonalLibrary from "../../components/PersonalLibrary";
import { useAccount } from "../../components/AccountProvider";
import { useLanguage } from "../../lib/i18n";
import { allowedProfileName, profileNameIssue } from "../../lib/profileName";

const reminders = [
  { reference: "20:114", surah: 20, verse: 114, fr: "Gardez le désir d’apprendre et demandez à Allah de vous accroître en savoir.", en: "Keep a desire to learn and ask Allah to increase your knowledge.", ar: "احرص على التعلّم واسأل الله أن يزيدك علمًا." },
  { reference: "49:11", surah: 49, verse: 11, fr: "Veillez à vos paroles : évitez les moqueries et les surnoms blessants.", en: "Take care with your words: avoid ridicule and hurtful nicknames.", ar: "اعتنِ بكلماتك، وتجنّب السخرية والألقاب المؤذية." },
  { reference: "16:90", surah: 16, verse: 90, fr: "Cherchez la justice et la bienfaisance dans vos gestes du quotidien.", en: "Seek justice and kindness in your everyday actions.", ar: "احرص على العدل والإحسان في أعمالك اليومية." },
  { reference: "2:153", surah: 2, verse: 153, fr: "Dans les difficultés, cherchez de l’aide dans la patience et la prière.", en: "In difficulty, seek help through patience and prayer.", ar: "استعن بالصبر والصلاة في أوقات الصعوبة." },
] as const;

export default function PersonalHome() {
  const { language } = useLanguage(), { user, ready } = useAccount();
  const [name, setName] = useState(""), [nameReady, setNameReady] = useState(false), [reminder, setReminder] = useState(0);
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  useEffect(() => {
    if (!ready) return;
    if (!localStorage.getItem("nur-onboarding-complete")) { location.replace("/"); return; }
    const load = () => {
      const stored = localStorage.getItem("nur-profile-name") || "";
      if (profileNameIssue(stored)) { location.replace("/welcome?name=1"); return; }
      setName(allowedProfileName(stored)); setNameReady(true);
    }; load();
    const day = new Date().toISOString().slice(0, 10);
    let selected = Number(sessionStorage.getItem(`nur-reminder-${day}`));
    if (!sessionStorage.getItem(`nur-reminder-${day}`)) { selected = crypto.getRandomValues(new Uint8Array(1))[0] % reminders.length; sessionStorage.setItem(`nur-reminder-${day}`, String(selected)); }
    setReminder(selected % reminders.length);
    addEventListener("nur-cloud-hydrated", load); return () => removeEventListener("nur-cloud-hydrated", load);
  }, [ready]);
  const tip = reminders[reminder];
  const displayName = !ready || !nameReady ? "…" : name || allowedProfileName(user?.name) || local("Invité", "Guest", "ضيف");
  return <main className="personal-home"><SiteHeader active="home"/><section className="home-hero personal-hero"><div className="halo h1"/><div className="halo h2"/><p className="eyebrow"><span/>NŪR · القرآن الكريم<span/></p><h1 aria-busy={!ready}>{local("Bienvenue,", "Welcome,", "مرحبًا،")}<br/><em>{displayName}</em></h1><p className="lede">{local("Un moment pour lire, écouter et avancer à votre rythme.", "A moment to read, listen and move at your own pace.", "لحظة للقراءة والاستماع والتقدّم على وتيرتك.")}</p><SurahPicker label={local("Commencer à lire", "Start reading", "ابدأ القراءة")}/></section>
    <aside className="daily-reminder"><span aria-hidden="true">✦</span><div><small>{local("UN RAPPEL POUR AUJOURD’HUI", "A REMINDER FOR TODAY", "تذكير لهذا اليوم")}</small><p>{tip[language]}</p><a href={`/read?surah=${tip.surah}#verse-${tip.verse}`}>{local("Inspiré du Coran", "Inspired by the Quran", "مستوحى من القرآن")} · {tip.reference} {language === "ar" ? "←" : "→"}</a></div></aside>
    <PersonalLibrary/><SiteFooter/>
  </main>;
}
