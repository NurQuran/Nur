"use client";
import {FormEvent,useEffect,useRef,useState} from "react";
import SiteHeader from "../../components/SiteHeader";
import {surahs} from "../../lib/quran/surahs";
type Message={role:"user"|"assistant";content:string;attachmentLabel?:string};
type Attachment={label:string;context:string};
function safetyId(){let id=localStorage.getItem("nur-ai-safety-id");if(!id){id=crypto.randomUUID();localStorage.setItem("nur-ai-safety-id",id)}return id}
export default function AssistantPage(){
 const[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(""),[attachment,setAttachment]=useState<Attachment|null>(null);
 const[pickerOpen,setPickerOpen]=useState(false),[surahNumber,setSurahNumber]=useState(1),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const end=useRef<HTMLDivElement>(null),autoSent=useRef(false);
 useEffect(()=>{try{const saved=sessionStorage.getItem("nur-ai-attachment");if(saved){const parsed=JSON.parse(saved) as Attachment;setAttachment(parsed);sessionStorage.removeItem("nur-ai-attachment");if(new URLSearchParams(location.search).get("auto")==="explain"&&!autoSent.current){autoSent.current=true;setTimeout(()=>send("Explique-moi ce passage avec son contexte, ses enseignements principaux et les précautions d’interprétation.",parsed),250)}}}catch{}},[]);
 useEffect(()=>end.current?.scrollIntoView({behavior:"smooth"}),[messages,loading]);
 async function attachSurah(){setError("");setLoading(true);try{const response=await fetch("https://api.alquran.cloud/v1/surah/"+surahNumber+"/editions/quran-uthmani,fr.hamidullah");if(!response.ok)throw new Error();const json=await response.json();const editions=json.data as Array<{ayahs:Array<{numberInSurah:number;text:string}>}>;const arabic=editions[0]?.ayahs||[],fr=editions[1]?.ayahs||[];const context=arabic.map((a,i)=>a.numberInSurah+". "+a.text+"\nFR: "+(fr[i]?.text||"")).join("\n\n");setAttachment({label:surahs[surahNumber-1].name+" · Sourate "+surahNumber,context});setPickerOpen(false)}catch{setError("Impossible de charger cette sourate pour le moment.")}finally{setLoading(false)}}
 async function send(text=draft,forced=attachment){const clean=text.trim();if(!clean||loading)return;const user:Message={role:"user",content:clean,attachmentLabel:forced?.label};const next=[...messages,user];setMessages(next);setDraft("");setLoading(true);setError("");try{const response=await fetch("/api/ai-fiqh",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:next.map(({role,content})=>({role,content})),attachment:forced,safetyId:safetyId()})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Réponse indisponible.");setMessages(items=>[...items,{role:"assistant",content:data.answer}]);setAttachment(null)}catch(e){setError(e instanceof Error?e.message:"L’assistant est indisponible.")}finally{setLoading(false)}}
 function submit(e:FormEvent){e.preventDefault();void send()}
 return <main className="assistant-page"><SiteHeader active="assistant"/><section className="assistant-shell">
  <header className="assistant-hero"><span className="ai-mark">ن</span><div><small>ASSISTANT ÉDUCATIF</small><h1>Assistant Fiqh</h1><p>Comprendre un passage, explorer une notion et distinguer les avis avec prudence.</p></div></header>
  <div className="ai-disclaimer">✦ Les réponses sont éducatives et ne remplacent ni un savant qualifié ni une fatwa.</div>
  <div className="chat-stream" aria-live="polite">
   {!messages.length&&<div className="ai-welcome"><h2>Que souhaitez-vous comprendre ?</h2><p>Posez une question ou joignez une sourate avec le bouton +.</p><div><button onClick={()=>setDraft("Explique-moi le thème principal de la sourate Al-Fātiḥah.")}>Expliquer Al-Fātiḥah</button><button onClick={()=>setDraft("Comment distinguer une explication d’un avis juridique ?")}>Comprendre un avis</button></div></div>}
   {messages.map((m,i)=><article key={i} className={"chat-message "+m.role}><span>{m.role==="assistant"?"ن":"Vous"}</span><div>{m.attachmentLabel&&<b className="attachment-bubble">◈ {m.attachmentLabel}</b>}<p>{m.content}</p></div></article>)}
   {loading&&<article className="chat-message assistant thinking"><span>ن</span><div><i/><i/><i/></div></article>}{error&&<div className="ai-error">{error}</div>}<div ref={end}/>
  </div>
  <form className="chat-composer" onSubmit={submit}>{attachment&&<div className="pending-attachment">◈ {attachment.label}<button type="button" onClick={()=>setAttachment(null)}>×</button></div>}{pickerOpen&&<div className="attachment-picker"><strong>Joindre une sourate</strong><select value={surahNumber} onChange={e=>setSurahNumber(Number(e.target.value))}>{surahs.map(s=><option value={s.number} key={s.number}>{String(s.number).padStart(3,"0")} · {s.name}</option>)}</select><button type="button" onClick={attachSurah}>Ajouter</button></div>}<div><button className="composer-plus" type="button" aria-label="Joindre une sourate" onClick={()=>setPickerOpen(v=>!v)}>+</button><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Posez votre question…" rows={1}/><button className="composer-send" disabled={!draft.trim()||loading} aria-label="Envoyer">↑</button></div></form>
 </section></main>
}
