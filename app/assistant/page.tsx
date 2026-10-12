"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import MarkdownMessage from "../../components/MarkdownMessage";
import HadithAttachmentPicker from "../../components/HadithAttachmentPicker";
import { useLanguage } from "../../lib/i18n";
import QuranAttachmentPicker from "../../components/QuranAttachmentPicker";
import { readableAIError, workerRestarted } from "../../lib/aiError";
import { scrollMotion } from "../../lib/motion";

type Message = { role: "user" | "assistant"; content: string; attachmentLabel?: string };
type Attachment = { label: string; context: string; kind?: "hadith"; scope?: "book" };

function stableSafetyId() {
  let id = localStorage.getItem("nur-ai-safety-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("nur-ai-safety-id", id); }
  return id;
}

export default function AssistantPage() {
  const { language, ready, t } = useLanguage();
  const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(""),[attachment,setAttachment]=useState<Attachment|null>(null);
  const [pickerOpen,setPickerOpen]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [attachmentKind,setAttachmentKind]=useState<"surah"|"hadith">("surah");
  const end=useRef<HTMLDivElement>(null),autoSent=useRef(false),composer=useRef<HTMLFormElement>(null);

  useEffect(()=>{
    if(!ready)return;
    try { const saved=sessionStorage.getItem("nur-ai-attachment"); if(saved){const parsed=JSON.parse(saved) as Attachment;setAttachment(parsed);sessionStorage.removeItem("nur-ai-attachment");const params=new URLSearchParams(location.search);if(params.get("auto")==="explain"&&!autoSent.current){autoSent.current=true;const prompt=parsed.scope==="book"?(language==="ar"?"اشرح موضوعات كتاب الأحاديث المرفق ودروسه، وميّز بين النص والتفسير. إن كانت المرفقات جزئية فصرّح بذلك ولا تدّع تغطية الكتاب كله.":language==="en"?"Explain the attached hadith book’s themes and lessons. Distinguish text from interpretation. If only excerpts are supplied, say so and do not claim to cover the entire book.":"Explique les thèmes et enseignements du livre de hadiths joint. Distingue texte et interprétation. Si les extraits sont partiels, précise-le sans prétendre couvrir tout le livre."):parsed.kind==="hadith"?(language==="ar"?"اشرح هذا الحديث ومعانيه وسياقه، واذكر مرجعه وأحكام المصدر دون اختلاق حكم على صحته.":language==="en"?"Explain this hadith, its meaning and context. Refer to the supplied reference and gradings without inventing an authenticity ruling.":"Explique ce hadith, son sens et son contexte. Utilise la référence et les évaluations jointes sans inventer de jugement d’authenticité."):language==="ar"?"اشرح هذا المقطع وسياقه وأهم معانيه مع مراعاة ضوابط التفسير.":language==="en"?"Explain this passage, its context and main lessons, while noting the limits of interpretation.":"Explique-moi ce passage, son contexte et ses enseignements principaux, avec les précautions d’interprétation.";setTimeout(()=>void send(prompt,parsed),250)}} } catch {}
  },[language,ready]);
  useEffect(()=>{if(messages.length||loading)requestAnimationFrame(()=>end.current?.scrollIntoView({behavior:scrollMotion(),block:"nearest"}))},[messages,loading]);

  async function send(text=draft,forcedAttachment=attachment){
    const clean=text.trim(); if(!clean||loading)return;
    const user:Message={role:"user",content:clean,attachmentLabel:forcedAttachment?.label};const next=[...messages,user];
    setMessages(next);setDraft("");setLoading(true);setError("");
    try{
      const requestBody=JSON.stringify({messages:next.map(({role,content})=>({role,content})),attachment:forcedAttachment,language,safetyId:stableSafetyId()});
      let response:Response|null=null;
      let data:{answer?:string;error?:string}={};
      for(let attempt=0;attempt<3;attempt++){
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),45_000);
        try{
          response=await fetch("/api/ai-fiqh",{method:"POST",headers:{"content-type":"application/json"},body:requestBody,signal:controller.signal,cache:"no-store"});
          const raw=await response.text();
          try{data=raw?JSON.parse(raw):{}}catch{data={error:raw||"Response unavailable."}}
          if(response.ok || /not.*configured|pas.*configuré/i.test(data.error||"") || (!workerRestarted(data.error||"") && ![429,500,502,503,504].includes(response.status)))break;
        }catch(requestError){
          if(attempt===2)throw requestError;
        }finally{clearTimeout(timeout)}
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,attempt===0?1200:2400));
      }
      if(!response?.ok)throw new Error(data.error||(language==="ar"?"تعذر الحصول على إجابة. حاول مرة أخرى.":language==="en"?"The assistant did not respond. Please try again.":"L’assistant n’a pas répondu. Réessayez."));
      if(!data.answer?.trim())throw new Error(language==="ar"?"لم تصل إجابة. حاول مرة أخرى.":language==="en"?"No answer was received. Please try again.":"Aucune réponse reçue. Réessayez.");
      setMessages(items=>[...items,{role:"assistant",content:data.answer!.trim()}]);setAttachment(null);
    }catch(e){setError(e instanceof Error?readableAIError(e.message,language):(language==="ar"?"المساعد غير متاح.":language==="en"?"The assistant is unavailable.":"L’assistant est indisponible."))}finally{setLoading(false)}
  }
  function submit(e:FormEvent){e.preventDefault();void send()}
  function handleKeyDown(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}
  function openPicker(){setPickerOpen(v=>!v);requestAnimationFrame(()=>{composer.current?.scrollIntoView({behavior:scrollMotion(),block:"center"});setTimeout(()=>window.scrollBy({top:Math.min(220,innerHeight*.24),behavior:scrollMotion()}),180)})}

  return <main className="assistant-page"><SiteHeader active="assistant"/><section className={`assistant-shell${messages.length?" conversation-started":""}`}>
    <header className="assistant-hero"><span className="ai-mark" aria-hidden="true"><img src="/icons/ui/fqih.svg" alt=""/></span><div><small>{t("fqihEyebrow")}</small><h1>{language==="ar"?"فقيه":"Fqih"}</h1>{!messages.length&&<p>{t("fqihLead")}</p>}</div></header>
    {!messages.length&&<div className="ai-disclaimer"><span className="inline-spark" aria-hidden="true"/> {t("fqihDisclaimer")}</div>}
    <div className="chat-stream" aria-live="polite">
      {!messages.length&&<div className="ai-welcome"><h2>{t("fqihWelcome")}</h2><p>{language==="ar"?"اكتب سؤالك أو أرفق آيات أو أحاديث بواسطة زر +.":language==="en"?"Ask a question or attach verses or hadiths with the + button.":"Posez une question ou joignez des versets ou des hadiths avec le bouton +."}</p><div><button onClick={()=>setDraft(language==="ar"?"اشرح الموضوع الرئيسي لسورة الفاتحة.":language==="en"?"Explain the main theme of Surah Al-Fātiḥah.":"Explique-moi le thème principal de la sourate Al-Fātiḥah.")}>{language==="ar"?"شرح الفاتحة":language==="en"?"Explain Al-Fātiḥah":"Expliquer Al-Fātiḥah"}</button><button onClick={()=>setDraft(language==="ar"?"كيف أميّز بين الشرح والحكم الشرعي؟":language==="en"?"How do I distinguish an explanation from a legal opinion?":"Comment distinguer une explication d’un avis juridique ?")}>{language==="ar"?"فهم الرأي الشرعي":language==="en"?"Understand an opinion":"Comprendre un avis"}</button></div></div>}
      {messages.map((m,i)=><article key={i} className={`chat-message ${m.role}`}><span>{m.role==="assistant"?(language==="ar"?"فقيه":"Fqih"):t("you")}</span><div>{m.attachmentLabel&&<b className="attachment-bubble">{m.attachmentLabel}</b>}{m.role==="assistant"?<MarkdownMessage content={m.content}/>:<p>{m.content}</p>}</div></article>)}
      {loading&&<article className="chat-message assistant thinking"><span>{language==="ar"?"فقيه":"Fqih"}</span><div><i/><i/><i/></div></article>}
      {error&&<div className="ai-error" role="alert">{error}</div>}<div ref={end}/>
    </div>
  </section>
    <form ref={composer} className="chat-composer" onSubmit={submit}>
      {attachment&&<div className="pending-attachment">{attachment.label}<button type="button" onClick={()=>setAttachment(null)} aria-label={t("close")}>×</button></div>}
      {pickerOpen&&<div className="attachment-picker attachment-picker-expanded"><div className="attachment-kind"><button type="button" aria-pressed={attachmentKind==="surah"} onClick={()=>setAttachmentKind("surah")}>{language==="ar"?"سورة":language==="en"?"Surah":"Sourate"}</button><button type="button" aria-pressed={attachmentKind==="hadith"} onClick={()=>setAttachmentKind("hadith")}>{language==="ar"?"كتاب حديث":language==="en"?"Hadith book":"Livre de hadiths"}</button></div>{attachmentKind==="hadith"?<HadithAttachmentPicker onAttach={value=>{setAttachment(value);setPickerOpen(false)}}/>:<QuranAttachmentPicker onAttach={value=>{setAttachment(value);setPickerOpen(false)}}/>}</div>}
      <div><button className="composer-plus" type="button" aria-label={language==="ar"?"إرفاق سورة أو كتاب حديث":language==="en"?"Attach a surah or hadith book":"Joindre une sourate ou un livre de hadiths"} onClick={openPicker}>+</button><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("askPlaceholder")} rows={1}/><button type="submit" className="composer-send" disabled={!draft.trim()||loading} aria-label={t("send")}>↑</button></div>
    </form>
  </main>;
}
