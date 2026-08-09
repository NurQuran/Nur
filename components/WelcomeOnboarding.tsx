"use client";

import { useEffect, useState } from "react";
import { useLanguage, type Language } from "../lib/i18n";

const hafsVoices=[
  {id:"ar.alafasy",name:"Mishary Alafasy"},
  {id:"ar.husary",name:"Mahmoud Al-Hussary"},
  {id:"ar.abdurrahmaansudais",name:"Abdurrahman As-Sudais"},
  {id:"ar.mahermuaiqly",name:"Maher Al-Muaiqly"},
];
const warshVoices=[
  {id:"hicham-lharraz",name:"Hicham El Harraz"},
  {id:"omar-qazabri",name:"Omar Al-Qazabri"},
  {id:"koshi",name:"Al-Oyoun Al-Kouchi"},
];

const words={
  fr:{welcome:"Bienvenue",lead:"Préparons Nūr pour votre première lecture.",language:"Choisissez votre langue",reading:"Votre lecture",readingLead:"Sélectionnez une transmission, une voix et l’affichage des couleurs.",riwayah:"Transmission",voice:"Voix",colors:"Couleurs de tajwīd",unavailable:"indisponible",appearance:"Votre ambiance",appearanceLead:"Choisissez le thème qui vous accompagne le mieux.",dark:"Sombre",light:"Clair",next:"Continuer",start:"Démarrer",back:"Retour"},
  en:{welcome:"Hello",lead:"Let’s prepare Nūr for your first reading.",language:"Choose your language",reading:"Your reading",readingLead:"Select a transmission, a voice and color display.",riwayah:"Transmission",voice:"Voice",colors:"Tajweed colors",unavailable:"unavailable",appearance:"Your atmosphere",appearanceLead:"Choose the theme that feels right for you.",dark:"Dark",light:"Light",next:"Continue",start:"Start",back:"Back"},
  ar:{welcome:"مرحبًا",lead:"لنُعِدّ نُور لقراءتك الأولى.",language:"اختر لغتك",reading:"قراءتك",readingLead:"اختر الرواية والصوت وعرض ألوان التجويد.",riwayah:"الرواية",voice:"الصوت",colors:"ألوان التجويد",unavailable:"غير متاح",appearance:"أجواء القراءة",appearanceLead:"اختر المظهر الأنسب لك.",dark:"داكن",light:"فاتح",next:"متابعة",start:"ابدأ",back:"رجوع"},
} as const;

export default function WelcomeOnboarding(){
  const {language,setLanguage}=useLanguage();
  const [visible,setVisible]=useState(false),[step,setStep]=useState(0),[riwayah,setRiwayah]=useState<"hafs"|"warsh">("hafs"),[voice,setVoice]=useState("ar.alafasy"),[colors,setColors]=useState(false),[theme,setTheme]=useState<"dark"|"light">("dark");
  const text=words[language];

  useEffect(()=>{if(!localStorage.getItem("nur-onboarding-complete")){setVisible(true);document.body.classList.add("onboarding-open")}return()=>document.body.classList.remove("onboarding-open")},[]);
  if(!visible)return null;

  function chooseLanguage(next:Language){setLanguage(next)}
  function chooseRiwayah(next:"hafs"|"warsh"){setRiwayah(next);setVoice(next==="warsh"?"hicham-lharraz":"ar.alafasy");if(next==="warsh")setColors(false)}
  function chooseTheme(next:"dark"|"light"){setTheme(next);document.documentElement.setAttribute("data-theme",next);localStorage.setItem("nur-theme",next)}
  function finish(){
    const settings={riwayah,reciter:voice,fontSize:40,tajweed:riwayah==="hafs"&&colors,showFrench:true,showEnglish:true,showTransliteration:true,playbackRate:1,repeatVerse:false};
    localStorage.setItem("nur-settings",JSON.stringify(settings));localStorage.setItem("nur-onboarding-complete","1");localStorage.setItem("nur-theme",theme);document.body.classList.remove("onboarding-open");setVisible(false);location.assign("/");
  }

  const voices=riwayah==="warsh"?warshVoices:hafsVoices;
  return <div className="onboarding-layer" role="presentation"><section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" dir={language==="ar"?"rtl":"ltr"}>
    <div className="onboarding-progress" aria-hidden="true">{[0,1,2].map(index=><span className={index===step?"active":index<step?"done":""} key={index}/>)}</div>
    <div className="onboarding-slide" key={step}>
      {step===0&&<><span className="onboarding-kicker">NŪR</span><h1 id="onboarding-title" lang={language==="ar"?"ar":undefined}>{text.welcome}</h1><p>{text.lead}</p><h2>{text.language}</h2><div className="language-cards"><button className={language==="fr"?"selected":""} onClick={()=>chooseLanguage("fr")}><b>FR</b><span>Français</span></button><button className={language==="en"?"selected":""} onClick={()=>chooseLanguage("en")}><b>EN</b><span>English</span></button><button className={language==="ar"?"selected":""} onClick={()=>chooseLanguage("ar")}><b>ع</b><span>العربية</span></button></div></>}
      {step===1&&<><span className="onboarding-kicker">02 · {text.riwayah}</span><h1 id="onboarding-title">{text.reading}</h1><p>{text.readingLead}</p><div className="onboarding-setting"><label>{text.riwayah}</label><div className="onboarding-choice"><button className={riwayah==="hafs"?"selected":""} onClick={()=>chooseRiwayah("hafs")}><b>Ḥafṣ</b><span>ʿan ʿĀṣim</span></button><button className={riwayah==="warsh"?"selected":""} onClick={()=>chooseRiwayah("warsh")}><b>Warsh</b><span>ʿan Nāfiʿ</span></button></div></div><div className="onboarding-setting"><label htmlFor="onboarding-voice">{text.voice}</label><select id="onboarding-voice" value={voice} onChange={event=>setVoice(event.target.value)}>{voices.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div><label className="onboarding-switch"><span><b>{text.colors}</b><small>{riwayah==="warsh"?`Warsh · ${text.unavailable}`:"Ḥafṣ"}</small></span><input type="checkbox" checked={colors} disabled={riwayah==="warsh"} onChange={event=>setColors(event.target.checked)}/></label></>}
      {step===2&&<><span className="onboarding-kicker">03 · NŪR</span><h1 id="onboarding-title">{text.appearance}</h1><p>{text.appearanceLead}</p><div className="theme-cards"><button className={theme==="dark"?"selected":""} onClick={()=>chooseTheme("dark")}><span className="theme-preview dark-preview"><i/></span><b>{text.dark}</b></button><button className={theme==="light"?"selected":""} onClick={()=>chooseTheme("light")}><span className="theme-preview light-preview"><i/></span><b>{text.light}</b></button></div></>}
    </div>
    <div className="onboarding-actions">{step>0&&<button className="onboarding-back" onClick={()=>setStep(value=>value-1)} aria-label={text.back}><span/></button>}<button className="onboarding-next" onClick={()=>step<2?setStep(value=>value+1):finish()}>{step<2?text.next:text.start}<span className="onboarding-arrow" aria-hidden="true"/></button></div>
  </section></div>;
}
