"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";

function haptic(kind:string){
  try{
    if(window.NurAndroid?.performHaptic){window.NurAndroid.performHaptic(kind);return}
    if(!navigator.vibrate)return;
    navigator.vibrate(kind==="warning"?[18,32,24]:kind==="medium"?18:8);
  }catch{}
}

export default function AppRuntime(){
  const {language}=useLanguage();
  const [offline,setOffline]=useState(false);
  useEffect(()=>{
    const update=()=>{const unavailable=!navigator.onLine;setOffline(unavailable);if(unavailable&&window.NurAndroid?.openOffline)setTimeout(()=>window.NurAndroid?.openOffline?.(),450)};update();
    addEventListener("online",update);addEventListener("offline",update);
    const press=(event:PointerEvent)=>{if(event.pointerType==="mouse"&&!window.NurAndroid)return;const control=(event.target as HTMLElement)?.closest<HTMLElement>("button,a[href],select,input[type=checkbox],input[type=range]");if(!control||control.hasAttribute("disabled"))return;const warning=control.matches(".danger,.reset-data-button,.offline-clear");const medium=control.matches(".primary,.play-surah,.main-play,.mark-read-button,.download-surah-audio");haptic(warning?"warning":medium?"medium":"selection")};
    document.addEventListener("pointerdown",press,true);
    return()=>{removeEventListener("online",update);removeEventListener("offline",update);document.removeEventListener("pointerdown",press,true)};
  },[]);
  if(!offline)return null;
  return <div className="global-offline-notice" role="status"><span aria-hidden="true"/><strong>{language==="ar"?"أنت غير متصل بالإنترنت":language==="en"?"You are offline":"Vous êtes hors ligne"}</strong><small>{language==="ar"?"تم تشغيل نسخة القراءة دون اتصال.":language==="en"?"The offline reading version is active.":"La version de lecture hors ligne est active."}</small></div>;
}
