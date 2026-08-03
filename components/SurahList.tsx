"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { surahs } from "../lib/quran/surahs";

const searchable = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
  .toLowerCase()
  .replace(/[-_'’ʻʿ\s]/g, "");

export default function SurahList({ active, onSelect }: { active: number; onSelect: (n: number) => void }) {
  const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const results = useMemo(() => {
    const query = searchable(search);
    return surahs.filter(s => searchable(`${s.number} ${s.name}`).includes(query));
  }, [search]);

  return <div className="rail-surahs">
    <h2>{t("choose")}</h2>
    <label>⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchSurah")} /></label>
    <div>{results.map(s => <button className={active === s.number ? "active" : ""} key={s.number} onClick={() => onSelect(s.number)}><span>{String(s.number).padStart(3, "0")}</span><strong>{s.name}</strong></button>)}</div>
  </div>;
}
