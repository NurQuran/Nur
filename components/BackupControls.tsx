"use client";

import { useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";

const keys = ["nur-language", "nur-theme", "nur-reduced-motion", "nur-settings", "nur-favorite-surahs", "nur-read-surahs", "nur-last-position", "nur-progress", "nur-study", "nur-onboarding-complete"];
const list = (value: unknown) => Array.isArray(value) && value.length <= 114 && value.every(n => Number.isInteger(n) && n >= 1 && n <= 114);

export default function BackupControls() {
  const { language } = useLanguage();
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  function exportBackup() {
    const web = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null));
    const position = JSON.parse(web["nur-last-position"] || "{}"), settings = JSON.parse(web["nur-settings"] || "{}");
    const state = { language: web["nur-language"] || "fr", theme: web["nur-theme"] || "dark", riwayah: settings.riwayah || "hafs", reciter: settings.reciter || "ar.alafasy", tajweed: !!settings.tajweed, pronunciation: !!settings.showTransliteration, french: !!settings.showFrench, english: !!settings.showEnglish, wordStudy: !!settings.wordStudy, fontSize: settings.fontSize || 40, current: position.surah || 1, currentVerse: position.verse || 1, favorites: JSON.parse(web["nur-favorite-surahs"] || "[]"), read: JSON.parse(web["nur-read-surahs"] || "[]"), minutes: JSON.parse(web["nur-progress"] || "{}").minutes || 0, goal: JSON.parse(web["nur-progress"] || "{}").goal || 10 };
    const blob = new Blob([JSON.stringify({ format: "nur-backup", version: 1, createdAt: new Date().toISOString(), state, web }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "Nur-sauvegarde.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(local("Sauvegarde téléchargée.", "Backup downloaded.", "تم تنزيل النسخة الاحتياطية."));
  }
  async function importBackup(file?: File) {
    try {
      if (!file || file.size > 200000) throw new Error("size");
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== "nur-backup" || parsed.version !== 1 || !parsed.state) throw new Error("format");
      const value = parsed.state;
      if (!list(value.favorites) || !list(value.read) || !["fr", "en", "ar"].includes(value.language) || !["dark", "light"].includes(value.theme) || !["hafs", "warsh"].includes(value.riwayah) || !Number.isInteger(value.current) || value.current < 1 || value.current > 114 || !Number.isInteger(value.currentVerse) || value.currentVerse < 1 || value.currentVerse > 286) throw new Error("values");
      if (parsed.web && typeof parsed.web === "object") {
        for (const key of keys) if (typeof parsed.web[key] === "string") localStorage.setItem(key, parsed.web[key]);
      } else {
        localStorage.setItem("nur-language", value.language); localStorage.setItem("nur-theme", value.theme);
        localStorage.setItem("nur-settings", JSON.stringify({ riwayah: value.riwayah, reciter: value.reciter, tajweed: !!value.tajweed, showTransliteration: !!value.pronunciation, showFrench: !!value.french, showEnglish: !!value.english, wordStudy: !!value.wordStudy, fontSize: Math.max(28, Math.min(60, Number(value.fontSize) || 40)), playbackRate: 1, repeatVerse: false }));
        localStorage.setItem("nur-favorite-surahs", JSON.stringify(value.favorites)); localStorage.setItem("nur-read-surahs", JSON.stringify(value.read));
        localStorage.setItem("nur-last-position", JSON.stringify({ surah: value.current, verse: value.currentVerse }));
        localStorage.setItem("nur-progress", JSON.stringify({ read: value.read.length, minutes: Math.max(0, Number(value.minutes) || 0), goal: Math.max(1, Number(value.goal) || 10) }));
      }
      localStorage.setItem("nur-onboarding-complete", "1"); location.reload();
    } catch { setStatus(local("Fichier de sauvegarde invalide.", "Invalid backup file.", "ملف النسخة الاحتياطية غير صالح.")); }
  }
  return <div className="setting-group backup-setting"><span className="setting-icon" aria-hidden="true">↕</span><div><h3>{local("Sauvegarde personnelle", "Personal backup", "نسخة احتياطية شخصية")}</h3><p>{local("Gardez vos favoris, votre progression et vos préférences.", "Keep your favorites, progress and preferences.", "احتفظ بالمفضلة والتقدم والتفضيلات.")}</p><div className="backup-actions"><button onClick={exportBackup}>{local("Exporter", "Export", "تصدير")}</button><button onClick={() => input.current?.click()}>{local("Importer", "Import", "استيراد")}</button></div><input ref={input} type="file" accept="application/json,.json" hidden onChange={event => { void importBackup(event.target.files?.[0]); event.target.value = ""; }}/>{status && <small role="status">{status}</small>}</div></div>;
}
