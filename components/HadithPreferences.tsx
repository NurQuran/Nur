"use client";
import { useLanguage } from "../lib/i18n";
import { useHadithPreferences } from "../lib/hadithPreferences";
export default function HadithPreferences() {
  const {language}=useLanguage(),{preferences,save}=useHadithPreferences(language);
  const local=(fr:string,en:string,ar:string)=>language==="ar"?ar:language==="en"?en:fr;
  return <div className="setting-group hadith-preferences"><span className="setting-icon" aria-hidden="true">Aa</span><div>
    <h3>{local("Lecture des hadiths","Hadith reading","قراءة الأحاديث")}</h3>
    <p>{local("Choisissez une ou plusieurs langues à afficher.","Choose one or more display languages.","اختر لغة واحدة أو عدة لغات للعرض.")}</p>
    <div className="choice-row">{(["ar","fr","en"] as const).map(l=><button key={l} type="button" aria-pressed={preferences.languages.includes(l)} className={preferences.languages.includes(l)?"selected":""} onClick={()=>save({...preferences,languages:preferences.languages.includes(l)?preferences.languages.filter(v=>v!==l):[...preferences.languages,l]})}>{l==="ar"?"العربية":l==="fr"?"Français":"English"}</button>)}
      <button type="button" onClick={()=>save({...preferences,languages:["ar","fr","en"]})}>{local("Tout","All","الكل")}</button></div>
    <label className="hadith-size-label">{local("Taille des lettres","Text size","حجم الخط")} · {preferences.fontSize}<input type="range" min="14" max="28" value={preferences.fontSize} onChange={e=>save({...preferences,fontSize:Number(e.target.value)})}/></label>
  </div></div>;
}
