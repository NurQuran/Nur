"use client";

import { useMemo, useRef, useState } from "react";
import { surahs } from "../lib/quran/surahs";
import { useLanguage } from "../lib/i18n";
import { scrollMotion } from "../lib/motion";
import { arabicNames } from "../lib/quran/arabicNames";
import { useReadingWheel } from "../lib/useReadingWheel";

const searchable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "").toLowerCase().replace(/[-_'’ʻʿ\s]/g, "");

export default function SurahPicker({ compact = false, label }: { compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const wheel=useReadingWheel(`${open}:${search}`);
  const { t, language } = useLanguage();
  const results = useMemo(() => { const query=searchable(search); return surahs.filter(s => searchable(`${s.number} ${s.name} ${arabicNames[s.number-1]}`).includes(query)); }, [search]);
  function toggle(){if(!compact&&matchMedia("(max-width:900px), (max-width:1280px) and (orientation:portrait)").matches){location.assign("/read");return}const next=!open;setOpen(next);if(next)setTimeout(()=>{pickerRef.current?.scrollIntoView({behavior:scrollMotion(),block:"start"});if(innerWidth<=900)setTimeout(()=>scrollBy({top:120,behavior:scrollMotion()}),180)},40)}
  return <div ref={pickerRef} className={compact ? "picker compact" : "picker"}>
    <button className="picker-trigger simplified" onClick={toggle} aria-expanded={open}><strong>{label || t("choose")}</strong><b>{open ? "↑" : "↓"}</b></button>
    {open && <div className="picker-menu"><label>⌕<input autoFocus value={search} onFocus={()=>{if(innerWidth<=900)setTimeout(()=>scrollBy({top:150,behavior:scrollMotion()}),120)}} onChange={e => setSearch(e.target.value)} placeholder={t("searchSurah")} /></label><div ref={wheel} className="reading-wheel">{results.map(s => <a key={s.number} href={`/read?surah=${s.number}`}><span>{String(s.number).padStart(3,"0")}</span><strong>{language==="ar"?arabicNames[s.number-1]:s.name}</strong><b>{language==="ar"?"←":"→"}</b></a>)}</div></div>}
  </div>;
}
