"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ReaderOptions } from "../lib/quran/types";
import { warshReciters } from "../lib/quran/adapters/alQuranCloud";
import { useLanguage } from "../lib/i18n";
import { clearAndroidState } from "../lib/androidSync";

const legends=[{c:"madda_normal",fr:"Prolongation normale",en:"Normal prolongation",ar:"مد طبيعي"},{c:"madda_permissible",fr:"Prolongation permise",en:"Permissible prolongation",ar:"مد جائز"},{c:"madda_necessary",fr:"Prolongation nécessaire",en:"Necessary prolongation",ar:"مد لازم"},{c:"qlq",fr:"Qalqalah",en:"Qalqalah",ar:"قلقلة"},{c:"ghn",fr:"Ghunnah",en:"Ghunnah",ar:"غنة"},{c:"ikhf",fr:"Ikhfāʾ",en:"Ikhfa",ar:"إخفاء"},{c:"iqlb",fr:"Iqlāb",en:"Iqlab",ar:"إقلاب"},{c:"idgh_ghn",fr:"Idghām",en:"Idgham",ar:"إدغام"}];
const hafsVoices=[{id:"ar.alafasy",name:"Mishary Alafasy"},{id:"ar.husary",name:"Mahmoud Al-Hussary"},{id:"ar.abdurrahmaansudais",name:"Abdurrahman As-Sudais"},{id:"ar.mahermuaiqly",name:"Maher Al-Muaiqly"},{id:"ar.saoodshuraym",name:"Saoud Ash-Shuraym"},{id:"ar.abdulsamad",name:"Abdul Basit Abdus-Samad"},{id:"ar.aymanswoaid",name:"Ayman Sowaid"},{id:"ar.muhammadayyoub",name:"Muhammad Ayyoub"}];

export default function SettingsModal({value,onChange,onClose,studyPanel,customizePanel,audioDownloadPanel}:{value:ReaderOptions;onChange:(value:ReaderOptions)=>void;onClose:()=>void;studyPanel?:ReactNode;customizePanel?:ReactNode;audioDownloadPanel?:ReactNode}){
  const {t,language}=useLanguage(); const [closing,setClosing]=useState(false),[resetConfirm,setResetConfirm]=useState(false),[resetting,setResetting]=useState(false),[audioStatus,setAudioStatus]=useState("");
  const local=(fr:string,en:string,ar:string)=>language==="ar"?ar:language==="en"?en:fr;
  useEffect(()=>{const status=(event:Event)=>setAudioStatus(String((event as CustomEvent).detail||""));addEventListener("nur-audio-download-status",status);return()=>removeEventListener("nur-audio-download-status",status)},[]);
  function close(){setClosing(true);setTimeout(onClose,300)}
  async function resetAllData(){
    setResetting(true);
    Object.keys(localStorage).filter(key=>key.startsWith("nur-")).forEach(key=>localStorage.removeItem(key));
    clearAndroidState();
    Object.keys(sessionStorage).filter(key=>key.startsWith("nur-")).forEach(key=>sessionStorage.removeItem(key));
    if("caches" in window){try{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("nur-")).map(name=>caches.delete(name)))}catch{}}
    document.documentElement.setAttribute("data-theme","dark");
    location.replace("/");
  }
  return <div className={`modal-layer ${closing?"closing":""}`} role="presentation" onMouseDown={e=>e.target===e.currentTarget&&close()}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-head"><div><small>{t("preferences")}</small><h2 id="settings-title">{t("settings")}</h2></div><button className="icon" onClick={close} aria-label={t("close")}>×</button></div>
      <div className="settings-content">
      <div className="setting-group"><span className="setting-icon audio-setting-icon" aria-hidden="true"><i/><i/><i/></span><div><h3>{t("recitation")}</h3><p>{t("recitationHelp")}</p>
        <div className="choice-row"><button className={value.riwayah==="hafs"?"selected":""} onClick={()=>onChange({...value,riwayah:"hafs",reciter:"ar.alafasy"})}><strong>Ḥafṣ</strong><small>ʿan ʿĀṣim</small></button><button className={value.riwayah==="warsh"?"selected":""} onClick={()=>onChange({...value,riwayah:"warsh",reciter:"hicham-lharraz",tajweed:false})}><strong>Warsh</strong><small>ʿan Nāfiʿ · Maroc</small></button></div>
        <label>{t("voice")}<select value={value.reciter} onChange={e=>onChange({...value,reciter:e.target.value})}>{value.riwayah==="warsh"?warshReciters.map(v=><option key={v.id} value={v.id}>{v.name} · Warsh</option>):hafsVoices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        {value.riwayah==="warsh"&&<p className="audio-availability"><b>●</b> {local("Audio en sourate complète · non synchronisé verset par verset","Full-surah audio · not synchronized verse by verse","صوت السورة كاملة · غير متزامن آية بآية")}</p>}
        <div className="audio-options"><label>{local("Vitesse","Speed","السرعة")}<select value={value.playbackRate} onChange={e=>onChange({...value,playbackRate:Number(e.target.value)})}><option value="0.75">0,75×</option><option value="1">1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option></select></label><label className="switch-line"><span>{local("Répéter le verset","Repeat verse","تكرار الآية")}<small>{local("Disponible avec Ḥafṣ","Available with Hafs","متاح مع حفص")}</small></span><input type="checkbox" checked={value.repeatVerse} disabled={value.riwayah==="warsh"} onChange={e=>onChange({...value,repeatVerse:e.target.checked})}/></label></div>
      </div></div>
      {audioDownloadPanel||<div className="setting-group audio-download-setting"><span className="setting-icon"><img className="settings-png-icon" src="/icons/ui/download.png" alt=""/></span><div><h3>{local("Audio hors ligne","Offline audio","الصوت دون اتصال")}</h3><p>{local("Enregistrez l’audio de la sourate actuelle pour l’écouter sans connexion.","Save the current surah audio for listening without a connection.","احفظ صوت السورة الحالية للاستماع دون اتصال.")}</p><button className="download-surah-audio" onClick={()=>dispatchEvent(new Event("nur-download-current-audio"))}><img className="settings-png-icon" src="/icons/ui/download.png" alt=""/>{local("Télécharger l’audio de cette sourate","Download this surah audio","تنزيل صوت هذه السورة")}</button>{audioStatus&&<small className="download-status" aria-live="polite">{audioStatus}</small>}</div></div>}
      <div className="setting-group"><span className="setting-icon arabic-icon">أ</span><div><h3>{t("arabicWriting")}</h3><p>{t("writingHelp")}</p><label>{t("size")}<input type="range" min="28" max="60" value={value.fontSize} onChange={e=>onChange({...value,fontSize:Number(e.target.value)})}/><output>{value.fontSize}px</output></label><label className="switch-line"><span>{t("tajweedColors")}<small>{t("pronunciation")}</small></span><input type="checkbox" checked={value.tajweed} disabled={value.riwayah==="warsh"} onChange={e=>onChange({...value,tajweed:e.target.checked})}/></label>{value.riwayah==="warsh"&&<p className="warsh-setting-note">{local("Texte Warsh vérifié. Les couleurs restent désactivées faute de source Warsh colorée fiable.","Verified Warsh text. Colors remain disabled without a reliable colored Warsh source.","نص ورش موثوق. الألوان معطلة لعدم توفر مصدر ورش ملون موثوق.")}</p>}{value.tajweed&&value.riwayah==="hafs"&&<div className="tajweed-legend"><h4>{local("Légende des couleurs","Color legend","دليل الألوان")}</h4><div>{legends.map(item=><span key={item.c}><i className={item.c}/>{item[language]}</span>)}</div></div>}</div></div>
      <div className="setting-group"><span className="setting-icon">Aa</span><div><h3>{t("translations")}</h3><p>{t("translationsHelp")}</p><label className="switch-line"><span>Français</span><input type="checkbox" checked={value.showFrench} onChange={e=>onChange({...value,showFrench:e.target.checked})}/></label><label className="switch-line"><span>English</span><input type="checkbox" checked={value.showEnglish} onChange={e=>onChange({...value,showEnglish:e.target.checked})}/></label><label className="switch-line"><span>{local("Prononciation","Pronunciation","النطق")}</span><input type="checkbox" checked={value.showTransliteration} onChange={e=>onChange({...value,showTransliteration:e.target.checked})}/></label></div></div>
      {studyPanel}
      <div className="settings-reading-section">{customizePanel}</div>
      </div>
      <button className="primary modal-save" onClick={close}>{t("apply")}</button>
      <section className={`reset-data-card${resetConfirm?" confirming":""}`} aria-labelledby="reset-data-title">
        <span className="reset-data-icon" aria-hidden="true"><i/></span>
        <div><strong id="reset-data-title">{local("Réinitialiser Nūr","Reset Nūr","إعادة ضبط نُور")}</strong><p>{local("Efface les favoris, la progression, les téléchargements et toutes les préférences de cet appareil.","Erases favorites, progress, downloads and every preference on this device.","يمسح المفضلة والتقدم والتنزيلات وجميع التفضيلات على هذا الجهاز.")}</p></div>
        {!resetConfirm?<button className="reset-data-button" onClick={()=>setResetConfirm(true)}>{local("Effacer toutes les données","Erase all data","مسح جميع البيانات")}</button>:<div className="reset-data-confirm" role="alert"><p>{local("Tout recommencer et revoir l’introduction ?","Start over and show the introduction again?","هل تريد البدء من جديد وعرض المقدمة مرة أخرى؟")}</p><div><button onClick={()=>setResetConfirm(false)} disabled={resetting}>{local("Annuler","Cancel","إلغاء")}</button><button className="danger" onClick={resetAllData} disabled={resetting}>{resetting?local("Effacement…","Erasing…","جارٍ المسح…"):local("Oui, tout effacer","Yes, erase everything","نعم، امسح الكل")}</button></div></div>}
      </section>
    </section>
  </div>
}
