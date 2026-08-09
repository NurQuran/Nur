"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import { useLanguage } from "../../lib/i18n";
import { surahs } from "../../lib/quran/surahs";

type Message = { role: "user" | "assistant"; content: string; attachmentLabel?: string };
type Attachment = { label: string; context: string };

function stableSafetyId() {
  let id = localStorage.getItem("nur-ai-safety-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("nur-ai-safety-id", id); }
  return id;
}

export default function AssistantPage() {
  const { language, t } = useLanguage();
  const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(""),[attachment,setAttachment]=useState<Attachment|null>(null);
  const [pickerOpen,setPickerOpen]=useState(false),[surahNumber,setSurahNumber]=useState(1),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const end=useRef<HTMLDivElement>(null),autoSent=useRef(false),composer=useRef<HTMLFormElement>(null);

  useEffect(()=>{
    try { const saved=sessionStorage.getItem("nur-ai-attachment"); if(saved){const parsed=JSON.parse(saved) as Attachment;setAttachment(parsed);sessionStorage.removeItem("nur-ai-attachment");const params=new URLSearchParams(location.search);if(params.get("auto")==="explain"&&!autoSent.current){autoSent.current=true;const prompt=language==="ar"?"اشرح هذا المقطع وسياقه وأهم معانيه مع مراعاة ضوابط التفسير.":language==="en"?"Explain this passage, its context and main lessons, while noting the limits of interpretation.":"Explique-moi ce passage, son contexte et ses enseignements principaux, avec les précautions d’interprétation.";setTimeout(()=>void send(prompt,parsed),250)}} } catch {}
  },[language]);
  useEffect(()=>end.current?.scrollIntoView({behavior:"smooth",block:"end"}),[messages,loading]);

  async function attachSurah(){
    setError(""); setLoading(true);
    try{
      const translation=language==="en"?"en.asad":"fr.hamidullah";
      const response=await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,${translation}`);
      if(!response.ok)throw new Error();
      const json=await response.json(); const editions=json.data as Array<{ayahs:Array<{numberInSurah:number;text:string}>}>;
      const arabic=editions[0]?.ayahs||[],translated=editions[1]?.ayahs||[];
      const label=language==="ar"?`${surahs[surahNumber-1].name} · سورة ${surahNumber}`:`${surahs[surahNumber-1].name} · ${language==="en"?"Surah":"Sourate"} ${surahNumber}`;
      const context=arabic.map((a,i)=>`${a.numberInSurah}. ${a.text}\n${language==="en"?"EN":"FR"}: ${translated[i]?.text||""}`).join("\n\n");
      setAttachment({label,context});setPickerOpen(false);
    }catch{setError(language==="ar"?"تعذر تحميل هذه السورة الآن.":language==="en"?"This surah could not be loaded right now.":"Impossible de charger cette sourate pour le moment.")}finally{setLoading(false)}
  }

  async function send(text=draft,forcedAttachment=attachment){
    const clean=text.trim(); if(!clean||loading)return;
    const user:Message={role:"user",content:clean,attachmentLabel:forcedAttachment?.label};const next=[...messages,user];
    setMessages(next);setDraft("");setLoading(true);setError("");
    try{
      const requestBody=JSON.stringify({messages:next.map(({role,content})=>({role,content})),attachment:forcedAttachment,language,safetyId:stableSafetyId()});
      let response:Response|null=null;
      let data:{answer?:string;error?:string}={};
      for(let attempt=0;attempt<2;attempt++){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),45_000);
        try{
          response=await fetch("/api/ai-fiqh",{method:"POST",headers:{"content-type":"application/json"},body:requestBody,signal:controller.signal,cache:"no-store"});
          const raw=await response.text();
          try{data=raw?JSON.parse(raw):{}}catch{data={error:raw||"Response unavailable."}}
          if(response.ok||![429,500,502,503,504].includes(response.status))break;
        }catch(requestError){
          if(attempt===1)throw requestError;
        }finally{clearTimeout(timeout)}
        await new Promise(resolve=>setTimeout(resolve,850));
      }
      if(!response?.ok)throw new Error(data.error||(language==="ar"?"تعذر الحصول على إجابة. حاول مرة أخرى.":language==="en"?"The assistant did not respond. Please try again.":"L’assistant n’a pas répondu. Réessayez."));
      if(!data.answer?.trim())throw new Error(language==="ar"?"لم تصل إجابة. حاول مرة أخرى.":language==="en"?"No answer was received. Please try again.":"Aucune réponse reçue. Réessayez.");
      setMessages(items=>[...items,{role:"assistant",content:data.answer!.trim()}]);setAttachment(null);
    }catch(e){setError(e instanceof Error?e.message:(language==="ar"?"المساعد غير متاح.":language==="en"?"The assistant is unavailable.":"L’assistant est indisponible."))}finally{setLoading(false)}
  }
  function submit(e:FormEvent){e.preventDefault();void send()}
  function handleKeyDown(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}
  function openPicker(){setPickerOpen(v=>!v);requestAnimationFrame(()=>{composer.current?.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>window.scrollBy({top:Math.min(220,innerHeight*.24),behavior:"smooth"}),180)})}

  return <main className="assistant-page"><SiteHeader active="assistant"/><section className={`assistant-shell${messages.length?" conversation-started":""}`}>
    {!messages.length&&<><header className="assistant-hero"><span className="ai-mark" aria-hidden="true">✦</span><div><small>{t("fqihEyebrow")}</small><h1>Fqih</h1><p>{t("fqihLead")}</p></div></header>
    <div className="ai-disclaimer">✦ {t("fqihDisclaimer")}</div></>}
    <div className="chat-stream" aria-live="polite">
      {!messages.length&&<div className="ai-welcome"><h2>{t("fqihWelcome")}</h2><p>{t("fqihWelcomeLead")}</p><div><button onClick={()=>setDraft(language==="ar"?"اشرح الموضوع الرئيسي لسورة الفاتحة.":language==="en"?"Explain the main theme of Surah Al-Fātiḥah.":"Explique-moi le thème principal de la sourate Al-Fātiḥah.")}>{language==="ar"?"شرح الفاتحة":language==="en"?"Explain Al-Fātiḥah":"Expliquer Al-Fātiḥah"}</button><button onClick={()=>setDraft(language==="ar"?"كيف أميّز بين الشرح والحكم الشرعي؟":language==="en"?"How do I distinguish an explanation from a legal opinion?":"Comment distinguer une explication d’un avis juridique ?")}>{language==="ar"?"فهم الرأي الشرعي":language==="en"?"Understand an opinion":"Comprendre un avis"}</button></div></div>}
      {messages.map((m,i)=><article key={i} className={`chat-message ${m.role}`}><span>{m.role==="assistant"?"✦":t("you")}</span><div>{m.attachmentLabel&&<b className="attachment-bubble">◈ {m.attachmentLabel}</b>}<p>{m.content}</p></div></article>)}
      {loading&&<article className="chat-message assistant thinking"><span>✦</span><div><i/><i/><i/></div></article>}
      {error&&<div className="ai-error" role="alert">{error}</div>}<div ref={end}/>
    </div>
    <form ref={composer} className="chat-composer" onSubmit={submit}>
      {attachment&&<div className="pending-attachment">◈ {attachment.label}<button type="button" onClick={()=>setAttachment(null)} aria-label={t("close")}>×</button></div>}
      {pickerOpen&&<div className="attachment-picker"><strong>{t("attachSurah")}</strong><select aria-label={t("choose")} value={surahNumber} onChange={e=>setSurahNumber(Number(e.target.value))}>{surahs.map(s=><option value={s.number} key={s.number}>{String(s.number).padStart(3,"0")} · {s.name}</option>)}</select><button type="button" onClick={attachSurah}>{t("add")}</button></div>}
      <div><button className="composer-plus" type="button" aria-label={t("attachSurah")} onClick={openPicker}>+</button><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("askPlaceholder")} rows={1}/><button type="submit" className="composer-send" disabled={!draft.trim()||loading} aria-label={t("send")}>↑</button></div>
    </form>
  </section></main>;
}
