"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { useLanguage } from "../../lib/i18n";
import { surahs } from "../../lib/quran/surahs";

type Progress = { read: number; minutes: number; goal: number };

export default function FavoritesPage() {
  const [favorites,setFavorites]=useState<number[]>([]);
  const [progress,setProgress]=useState<Progress>({read:0,minutes:0,goal:10});
  const {t,language}=useLanguage();

  useEffect(()=>{
    try{
      const saved=localStorage.getItem("nur-favorite-surahs");
      const stats=localStorage.getItem("nur-progress");
      const completed=localStorage.getItem("nur-read-surahs");
      if(saved)setFavorites(JSON.parse(saved));
      if(stats)setProgress({...{read:0,minutes:0,goal:10},...JSON.parse(stats)});
      if(completed){const read=JSON.parse(completed) as number[];setProgress(current=>({...current,read:read.length}))}
    }catch{}
  },[]);

  function updateGoal(goal:number){
    const next={...progress,goal};
    setProgress(next);
    localStorage.setItem("nur-progress",JSON.stringify(next));
    const study=localStorage.getItem("nur-study");
    let current={continuous:false,goal};
    try{if(study)current={...JSON.parse(study),goal}}catch{}
    localStorage.setItem("nur-study",JSON.stringify(current));
  }

  const progressTitle=language==="ar"?"تقدمك الشخصي":language==="en"?"Your personal progress":"Votre progression personnelle";
  const readLabel=language==="ar"?"سورة مقروءة":language==="en"?"surahs read":"sourates lues";
  const listeningLabel=language==="ar"?"دقيقة استماع":language==="en"?"minutes listened":"minutes d’écoute";
  const goalLabel=language==="ar"?"الهدف اليومي بالدقائق":language==="en"?"Daily goal in minutes":"Objectif quotidien en minutes";

  return <main><SiteHeader active="favorites"/><section className="favorites-page">
    <p className="eyebrow"><span/> {t("library")} <span/></p><h1>{t("favoriteTitle")}</h1><p>{t("favoriteLead")}</p>
    {favorites.length?<div className="favorite-grid">{favorites.map(n=>{const s=surahs[n-1];return <a href={`/read?surah=${n}`} key={n}><span>{String(n).padStart(3,"0")}</span><h2>{s.name}</h2><b>{t("open")} →</b></a>})}</div>:<div className="empty"><span>♡</span><h2>{t("none")}</h2><p>{t("noneLead")}</p><a className="primary" href="/read">{t("discover")}</a></div>}
    <section className="favorites-progress" aria-labelledby="progress-title"><div><small>{language==="ar"?"إحصائيات القراءة":language==="en"?"READING STATS":"STATISTIQUES DE LECTURE"}</small><h2 id="progress-title">{progressTitle}</h2></div><div className="favorites-progress-stats"><article><b>{progress.read}</b><span>/114 {readLabel}</span></article><article><b>{Math.floor(progress.minutes)}</b><span>{listeningLabel}</span></article></div><label>{goalLabel}<input type="number" min="1" max="120" value={progress.goal} onChange={event=>updateGoal(Math.max(1,Math.min(120,Number(event.target.value)||1)))}/></label></section>
  </section><SiteFooter/></main>;
}
