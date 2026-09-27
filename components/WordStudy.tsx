"use client";

type Word = [string, string, string];
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/[^\u0600-\u06ff]/g, "");

export default function WordStudy({ words, arabic, language }: { words?: Word[]; arabic: string; language: "fr" | "en" | "ar" }) {
  if (language !== "en" || !words?.length || normalized(words.map(word => word[0]).join("")) !== normalized(arabic)) return null;
  return <details className="word-study"><summary>Word-by-word study (Hafs)</summary><div>{words.map((word, index) => <div className="word-chip" key={index}><strong lang="ar" dir="rtl">{word[0]}</strong><span>{word[1]}</span><small>{word[2]}</small></div>)}</div><p>English word glosses · <a href="https://github.com/mamun-al-abdullah/quran" target="_blank" rel="noreferrer">Hablullah/data-quran</a></p></details>;
}
