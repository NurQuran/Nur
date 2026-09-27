"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { surahNames } from "../lib/quran/surahs";
import { useLanguage } from "../lib/i18n";
import { motionReduced } from "../lib/motion";

type Position={surah:number;verse:number};

export default function ResumeToast(){
  const {language}=useLanguage();
  const pathname=usePathname();
  const [position,setPosition]=useState<Position|null>(null);
  const [closing,setClosing]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    if(timer.current)clearTimeout(timer.current);
    const blocked=pathname==="/assistant"||pathname==="/read";
    if(blocked){
      if(position){if(motionReduced())setPosition(null);else{setClosing(true);timer.current=setTimeout(()=>setPosition(null),260)}}
      return;
    }
    setClosing(false);
    try{
      if(sessionStorage.getItem("nur-resume-dismissed"))return;
      const saved=localStorage.getItem("nur-last-position");
      if(saved)timer.current=setTimeout(()=>setPosition(JSON.parse(saved)),650);
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
    <div><small>{title}</small><strong>{surahNames[position.surah-1]} · {position.surah}:{position.verse}</strong></div>
    <a href={`/read?surah=${position.surah}#verse-${position.verse}`} onClick={()=>{try{sessionStorage.setItem("nur-resume-dismissed","1")}catch{}}}>{action}</a>
    <button className="resume-close" onClick={close} aria-label={language==="ar"?"إغلاق":language==="en"?"Close":"Fermer"}><img className="header-png-icon" src="/icons/ui/close.png" alt=""/></button>
  </aside>;
}
