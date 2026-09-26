"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../lib/i18n";

type Verse = { n: number; arabic: string; fr: string; en: string; pronunciation: string };
type Chapter = { number: number; nameLatin: string; nameArabic: string; hafs: Verse[]; warsh: Verse[] };
let chapters: Chapter[] | null = null;
let pending: Promise<Chapter[]> | null = null;

function loadCorpus() {
  if (chapters) return Promise.resolve(chapters);
  if (!pending) pending = new Promise<Chapter[]>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/data/quran-data.js";
    script.onload = () => {
      chapters = (window as unknown as { NUR_QURAN_DATA?: Chapter[] }).NUR_QURAN_DATA || null;
      chapters ? resolve(chapters) : reject(new Error("Corpus unavailable"));
    };
    script.onerror = () => reject(new Error("Corpus unavailable"));
    document.head.append(script);
  }).catch(error => { pending = null; throw error; });
  return pending;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/[ٱأإآ]/g, "ا").toLowerCase().replace(/[’'`´\-–—_]/g, " ").replace(/[^a-z0-9\u0600-\u06ff ]/g, "").replace(/\s+/g, " ").trim();
}

export default function GlobalVerseSearch({ onSelect, riwayah = "hafs" }: { onSelect: (surah: number, verse: number) => void; riwayah?: "hafs" | "warsh" }) {
  const { language } = useLanguage();
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Chapter[] | null>(chapters);
  const [error, setError] = useState(false);
  const needle = normalize(query);
  const found = useMemo(() => {
    if (!data || needle.length < 2) return { total: 0, matches: [] as { chapter: Chapter; verse: Verse }[] };
    const matches: { chapter: Chapter; verse: Verse }[] = [];
    let total = 0;
    for (const chapter of data) for (const verse of chapter[riwayah]) {
      if ([verse.arabic, verse.fr, verse.en, verse.pronunciation].some(text => normalize(text || "").includes(needle))) {
        total++;
        if (matches.length < 60) matches.push({ chapter, verse });
      }
    }
    return { total, matches };
  }, [data, needle, riwayah]);

  return <div className="global-verse-search"><label><span aria-hidden="true">⌕</span><input type="search" value={query} onFocus={() => { void loadCorpus().then(setData).catch(() => setError(true)); }} onChange={event => setQuery(event.target.value)} placeholder={local("Rechercher dans tous les versets", "Search all verses", "البحث في جميع الآيات")} /></label>
    {needle.length >= 2 && <div className="global-verse-results" role="region" aria-live="polite">
      {error ? <p>{local("Recherche indisponible pour le moment.", "Search is temporarily unavailable.", "البحث غير متاح الآن.")}</p> : !data ? <p>{local("Chargement du texte local…", "Loading local text…", "جارٍ تحميل النص المحلي…")}</p> : <><small>{found.total} {local("versets trouvés", "verses found", "آية")}</small>{found.matches.map(({ chapter, verse }) => <button key={`${chapter.number}:${verse.n}`} onClick={() => onSelect(chapter.number, verse.n)}><span>{chapter.number}:{verse.n} · {language === "ar" ? chapter.nameArabic : chapter.nameLatin}</span><b lang="ar" dir="rtl">{verse.arabic}</b><small>{language === "en" ? verse.en : verse.fr}</small></button>)}</>}
    </div>}
  </div>;
}
