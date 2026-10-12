"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/i18n";
import { hadithBooks, hadithBookAttachment, type HadithData, type HadithMetadata } from "../lib/hadith";
import { chapterTitle } from "../lib/hadithChapters";
export default function HadithAttachmentPicker({onAttach}:{onAttach:(attachment:ReturnType<typeof hadithBookAttachment>)=>void}) {
  const {language}=useLanguage(),local=(fr:string,en:string,ar:string)=>language==="ar"?ar:language==="en"?en:fr;
  const [book,setBook]=useState("bukhari"),[chapter,setChapter]=useState("1"),[meta,setMeta]=useState<HadithMetadata|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const pending=useRef<AbortController|null>(null);
  const [mode,setMode]=useState("all"),[from,setFrom]=useState(1),[to,setTo]=useState(1);
  const [numbers,setNumbers]=useState<number[]>([]);
  useEffect(()=>()=>pending.current?.abort(),[]);
  useEffect(()=>{
    const controller=new AbortController();setMeta(null);setError("");
    fetch(`/api/hadith/${book}/en/meta`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(setMeta).catch(()=>{if(!controller.signal.aborted)setError(local("Livres indisponibles.","Books unavailable.","الكتب غير متاحة."))});
    return()=>controller.abort();
  },[book,language]);
  useEffect(()=>{
    const controller=new AbortController();setNumbers([]);setFrom(1);setTo(1);
    fetch(`/api/hadith/${book}/ar/${chapter}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then((data:HadithData)=>{
      if(controller.signal.aborted)return;const list=data.hadiths.map(h=>h.hadithnumber);setNumbers(list);setFrom(list[0]||1);setTo(list[0]||1);
    }).catch(()=>{});
    return()=>controller.abort();
  },[book,chapter]);
  async function attach() {
    pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setError("");
    try{
      const load=async(lang:string)=>{const r=await fetch(`/api/hadith/${book}/${lang}/${chapter}`,{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json() as HadithData;if(!Array.isArray(data.hadiths))throw new Error();return data.hadiths};
      const arabic=await load("ar"),translation=language==="ar"?[]:await load(language);
      const selected=mode==="all"?arabic:arabic.filter(h=>h.hadithnumber>=from&&h.hadithnumber<=to);
      if(!selected.length)throw new Error();
      const attachment=hadithBookAttachment(book,chapter,selected,translation,language);
      if(mode==="range"){attachment.label+=` · ${local("Hadiths","Hadiths","الأحاديث")} ${from}–${to}`;attachment.context="SELECTED EXCERPTS ONLY, not the complete book.\n"+attachment.context.replace("Complete supplied book.","Complete supplied selection.");}
      if(!controller.signal.aborted)onAttach(attachment);
    }catch{if(!controller.signal.aborted)setError(local("Impossible de joindre ce livre. Réessayez.","Unable to attach this book. Try again.","تعذر إرفاق الكتاب. حاول مجددًا."))}finally{if(!controller.signal.aborted)setBusy(false)}
  }
  return <div className="hadith-attachment-fields">
    <label>{local("Recueil","Collection","المجموعة")}<select disabled={busy} value={book} onChange={e=>{setBook(e.target.value);setChapter("1")}}>{hadithBooks.map(b=><option key={b.id} value={b.id}>{language==="ar"?b.ar:b.name}</option>)}</select></label>
    <label>{local("Chapitre","Chapter","الباب")}<select disabled={!meta||busy} value={chapter} onChange={e=>setChapter(e.target.value)}>{Object.entries(meta?.sections||{"1":""}).filter(([n])=>Number(n)>0).map(([n,name])=><option key={n} value={n}>{local("Chapitre","Chapter","باب")} {n} · {chapterTitle(book,n,name,language)}</option>)}</select></label>
    <label className="attachment-scope">{local("Passage à joindre","Passage to attach","المقطع المرفق")}<select disabled={busy} value={mode} onChange={e=>setMode(e.target.value)}><option value="all">{local("Chapitre entier","Entire chapter","الباب كاملًا")}</option><option value="range">{local("Choisir des hadiths","Choose hadiths","اختيار أحاديث")}</option></select></label>
    {mode==="range"&&<div className="attachment-range">{[false,true].map(end=><label key={String(end)}>{end?local("Jusqu’au hadith","To hadith","إلى الحديث"):local("Du hadith","From hadith","من الحديث")}<select disabled={busy||!numbers.length} value={end?to:from} onChange={e=>{const n=Number(e.target.value);if(end)setTo(n);else{setFrom(n);setTo(v=>Math.max(n,v));}}}>{numbers.filter(n=>!end||n>=from).map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}</div>}
    <button className="attach-confirm" type="button" disabled={!meta||busy||!numbers.length} onClick={attach}>{busy?local("Chargement…","Loading…","جارٍ التحميل…"):local("Joindre ce passage","Attach passage","إرفاق المقطع")}</button>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
