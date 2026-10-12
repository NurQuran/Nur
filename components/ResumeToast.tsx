"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { surahNames } from "../lib/quran/surahs";
import { useLanguage } from "../lib/i18n";
import { motionReduced } from "../lib/motion";
import { hadithBooks } from "../lib/hadith";
import { validHadithPosition,hadithResumeUrl,type HadithPosition } from "../lib/hadithPosition";

type Position={surah:number;verse:number;updatedAt?:number};

export default function ResumeToast(){
  const {language}=useLanguage();
  const pathname=usePathname();
  const [position,setPosition]=useState<Position|HadithPosition|null>(null);
  const [closing,setClosing]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    if(timer.current)clearTimeout(timer.current);
    const blocked=pathname==="/assistant"||pathname==="/read"||pathname==="/favorites"||pathname==="/"||pathname==="/welcome"||pathname==="/admin";
    if(blocked){
      if(position){if(motionReduced())setPosition(null);else{setClosing(true);timer.current=setTimeout(()=>setPosition(null),260)}}
      return;
    }
    setClosing(false);
    try{
      if(sessionStorage.getItem("nur-resume-dismissed"))return;
      const saved=JSON.parse(localStorage.getItem("nur-last-position")||"null") as Position|null;
      const hadith=JSON.parse(localStorage.getItem("nur-last-hadith")||"null");
      const latest=validHadithPosition(hadith)&&hadith.updatedAt>(saved?.updatedAt||0)?hadith:saved;
      if(latest)timer.current=setTimeout(()=>setPosition(latest),650);
    }catch{}
    return()=>{if(timer.current)clearTimeout(timer.current)};
  },[pathname]);

  function close(){
    try{sessionStorage.setItem("nur-resume-dismissed","1")}catch{}
    if(motionReduced()){setPosition(null);return}
    setClosing(true);timer.current=setTimeout(()=>setPosition(null),260);
  }

  if(!position)return null;
  const title=language==="ar"?"متابعة القراءة؟":language==="en"?"Continue reading?":"Reprendre votre lecture ?";
  const action=language==="ar"?"متابعة":language==="en"?"Continue":"Reprendre";
  return <aside className={`resume-toast ${closing?"closing":""}`} aria-live="polite">
    <div><small>{title}</small><strong>{"surah" in position?`${surahNames[position.surah-1]} · ${position.surah}:${position.verse}`:`${hadithBooks.find(b=>b.id===position.book)?.[language==="ar"?"ar":"name"]} · ${language==="ar"?"حديث":"Hadith"} ${position.hadith}`}</strong></div>
    <a href={"surah" in position?`/read?surah=${position.surah}#verse-${position.verse}`:hadithResumeUrl(position)} onClick={()=>{try{sessionStorage.setItem("nur-resume-dismissed","1")}catch{}}}>{action}</a>
    <button className="resume-close" onClick={close} aria-label={language==="ar"?"إغلاق":language==="en"?"Close":"Fermer"}><img className="header-png-icon" src="/icons/ui/close.png" alt=""/></button>
  </aside>;
}
