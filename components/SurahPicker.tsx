"use client";

import { useMemo, useState } from "react";
import { surahs } from "../lib/quran/surahs";
import { useLanguage } from "../lib/i18n";

export default function SurahPicker({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const results = useMemo(() => surahs.filter(s => `${s.number} ${s.name}`.toLowerCase().includes(search.toLowerCase())), [search]);
  return <div className={compact ? "picker compact" : "picker"}>
    <button className="picker-trigger simplified" onClick={() => setOpen(!open)} aria-expanded={open}><strong>{t("choose")}</strong><b>{open ? "↑" : "↓"}</b></button>
    {open && <div className="picker-menu"><label>⌕<input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchSurah")} /></label><div>{results.map(s => <a key={s.number} href={`/read?surah=${s.number}`}><span>{String(s.number).padStart(3,"0")}</span><strong>{s.name}</strong><b>→</b></a>)}</div></div>}
  </div>;
}
