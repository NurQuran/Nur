"use client";

import { useMemo, useState } from "react";
import { surahs } from "../lib/quran/surahs";
import { useLanguage } from "../lib/i18n";

const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "").toLowerCase().replace(/[-_'’ʻʿ\s]/g, "");

export default function SurahPicker({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const results = useMemo(() => { const query=searchable(search); return surahs.filter(s => searchable(`${s.number} ${s.name}`).includes(query)); }, [search]);
  return <div className={compact ? "picker compact" : "picker"}>
    <button className="picker-trigger simplified" onClick={() => setOpen(!open)} aria-expanded={open}><strong>{t("choose")}</strong><b>{open ? "↑" : "↓"}</b></button>
    {open && <div className="picker-menu"><label>⌕<input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchSurah")} /></label><div>{results.map(s => <a key={s.number} href={`/read?surah=${s.number}`}><span>{String(s.number).padStart(3,"0")}</span><strong>{s.name}</strong><b>→</b></a>)}</div></div>}
  </div>;
}
