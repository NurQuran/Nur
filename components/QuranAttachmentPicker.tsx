"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { surahs } from "../lib/quran/surahs";
import { arabicNames } from "../lib/quran/arabicNames";
type Verse={numberInSurah:number;text:string};
export default function QuranAttachmentPicker({onAttach}:{onAttach:(attachment:{label:string;context:string})=>void}) {
  const {language}=useLanguage(),local=(fr:string,en:string,ar:string)=>language==="ar"?ar:language==="en"?en:fr;
  const [surah,setSurah]=useState(1),[mode,setMode]=useState("all"),[from,setFrom]=useState(1),[to,setTo]=useState(1);
  const [arabic,setArabic]=useState<Verse[]>([]),[translated,setTranslated]=useState<Verse[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setArabic([]);setTranslated([]);setFrom(1);setTo(1);
    const editions=language==="ar"?"quran-uthmani":`quran-uthmani,${language==="en"?"en.asad":"fr.hamidullah"}`;
    fetch(`https://api.alquran.cloud/v1/surah/${surah}/editions/${editions}`,{signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{const data=Array.isArray(json.data)?json.data:[json.data];if(!data[0]?.ayahs?.length)throw new Error();if(!controller.signal.aborted){setArabic(data[0].ayahs);setTranslated(data[1]?.ayahs||[]);}})
      .catch(()=>{if(!controller.signal.aborted)setError(local("Impossible de charger cette sourate.","Unable to load this surah.","تعذر تحميل هذه السورة."))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[surah,language]);
  function attach(){
    const selected=mode==="all"?arabic:arabic.filter(v=>v.numberInSurah>=from&&v.numberInSurah<=to);
    const translation=new Map(translated.map(v=>[v.numberInSurah,v.text]));
    const passages:string[]=[];let size=0;
    for(const v of selected){const text=`${surah}:${v.numberInSurah} ${v.text}\n${translation.get(v.numberInSurah)||""}`;if(size+text.length>58000)break;size+=text.length;passages.push(text)}
    const name=language==="ar"?arabicNames[surah-1]:surahs[surah-1].name;
    onAttach({label:`${name} · ${mode==="all"?local("Sourate entière","Entire surah","السورة كاملة"):`${local("Versets","Verses","الآيات")} ${from}–${to}`}`,context:`Surah ${surah}. Included ${passages.length}/${selected.length} selected verses. ${passages.length<selected.length?"PARTIAL EXCERPTS, not the complete selection.":""}\n${passages.join("\n\n")}`});
  }
  return <div className="passage-attachment-fields">
    <label>{local("Sourate","Surah","السورة")}<select value={surah} onChange={e=>setSurah(Number(e.target.value))}>{surahs.map(s=><option key={s.number} value={s.number}>{s.number} · {language==="ar"?arabicNames[s.number-1]:s.name}</option>)}</select></label>
    <label>{local("Passage à joindre","Passage to attach","المقطع المرفق")}<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">{local("Sourate entière","Entire surah","السورة كاملة")}</option><option value="range">{local("Choisir des versets","Choose verses","اختيار آيات")}</option></select></label>
    {mode==="range"&&<div className="attachment-range">{[false,true].map(end=><label key={String(end)}>{end?local("Jusqu’au verset","To verse","إلى الآية"):local("Du verset","From verse","من الآية")}<select disabled={loading} value={end?to:from} onChange={e=>{const n=Number(e.target.value);if(end)setTo(n);else{setFrom(n);setTo(v=>Math.max(v,n));}}}>{arabic.filter(v=>!end||v.numberInSurah>=from).map(v=><option key={v.numberInSurah} value={v.numberInSurah}>{v.numberInSurah}</option>)}</select></label>)}</div>}
    {error&&<p role="alert">{error}</p>}
    <button className="attach-confirm" type="button" disabled={loading||!arabic.length} onClick={attach}>{loading?local("Chargement…","Loading…","جارٍ التحميل…"):local("Joindre ce passage","Attach passage","إرفاق المقطع")}</button>
  </div>;
}
