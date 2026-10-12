"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "../lib/i18n";
import { hadithBooks, hadithAttachment, hadithBookAttachment, type HadithData, type HadithMetadata } from "../lib/hadith";
import { hadithSearchIndex, matchesHadith, normalizeHadith } from "../lib/hadithSearch";
import { useHadithPreferences } from "../lib/hadithPreferences";
import { scrollMotion } from "../lib/motion";
import { useReadingWheel } from "../lib/useReadingWheel";
import { chapterTitle } from "../lib/hadithChapters";
import { portraitReaderLayout } from "../lib/routeMotion";

export default function HadithLibrary() {
  const { language, ready } = useLanguage();
  const {preferences}=useHadithPreferences(language);
  const local=(fr:string,en:string,ar:string)=>language==="ar"?ar:language==="en"?en:fr;
  const [book,setBook]=useState("bukhari"),[chapter,setChapter]=useState("1");
  const [railChapter,setRailChapter]=useState("1"),[railRows,setRailRows]=useState<HadithData["hadiths"]>([]),[railLoading,setRailLoading]=useState(true),[railError,setRailError]=useState(false);
  const resumeHadith=useRef<number|null>(null);
  const [metadata,setMetadata]=useState<HadithMetadata|null>(null);
  const [metadataError,setMetadataError]=useState(false);
  const [texts,setTexts]=useState<Partial<Record<"ar"|"fr"|"en",HadithData>>>({});
  const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const [search,setSearch]=useState(""),[bookSearch,setBookSearch]=useState("");
  const [stage,setStage]=useState<"chapters"|"groups"|"reading">("chapters"),[page,setPage]=useState(0),[online,setOnline]=useState(true);
  const [railMode,setRailMode]=useState<"chapters"|"groups">("chapters");
  const [direction,setDirection]=useState<"forward"|"back">("forward");
  const [readingDirection,setReadingDirection]=useState<"forward"|"back">("forward");
  const reading=stage==="reading";
  const wheel=useReadingWheel(`${book}:${bookSearch}:${!!metadata}:${railMode}:${railChapter}`);
  const selected=hadithBooks.find(item=>item.id===book)!;
  const title=language==="ar"?selected.ar:selected.name;
  const bookWord=local("Chapitre","Chapter","باب");
  const chapterName=chapterTitle(book,chapter,metadata?.sections[chapter]||"",language);
  useEffect(()=>{const query=new URLSearchParams(location.search),resume=Number(query.get("hadith")),n=Number(query.get("chapter"));
    if(resume>0&&Number.isInteger(resume)&&resume<=50000&&Number.isInteger(n)&&n>=1&&n<=150){setBook(query.get("book")==="muslim"?"muslim":"bukhari");setChapter(String(n));setRailChapter(String(n));setRailMode("groups");setStage("reading");resumeHadith.current=resume}
    else if(!portraitReaderLayout())setStage("reading");
  },[]);
  useEffect(()=>{const reset=()=>{setChapter("1");setRailChapter("1");setPage(0);setStage(portraitReaderLayout()?"chapters":"reading");setRailMode("chapters");setSearch("");setBookSearch("");window.scrollTo({top:0,behavior:scrollMotion()})};addEventListener("nur-hadith-reselect",reset);return()=>removeEventListener("nur-hadith-reselect",reset)},[]);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);update();addEventListener("online",update);addEventListener("offline",update);
    return()=>{removeEventListener("online",update);removeEventListener("offline",update)};
  },[]);
  useEffect(()=>{
    if(!ready)return;const controller=new AbortController();setMetadata(null);setMetadataError(false);
    fetch(`/api/hadith/${book}/en/meta`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(meta=>{if(!controller.signal.aborted)setMetadata(meta)}).catch(()=>{if(!controller.signal.aborted)setMetadataError(true)});
    return()=>controller.abort();
  },[book,ready,retry]);
  useEffect(()=>{
    if(!ready)return;const controller=new AbortController();setLoading(true);setError(false);setTexts({});
    Promise.all((["ar","fr","en"] as const).map(async lang=>{
      try{const response=await fetch(`/api/hadith/${book}/${lang}/${chapter}`,{signal:controller.signal});if(!response.ok)throw new Error();
        const json=await response.json();if(!Array.isArray(json.hadiths))throw new Error();return [lang,json] as const;
      }catch{return [lang,null] as const;}
    })).then(entries=>{if(controller.signal.aborted)return;const loaded=Object.fromEntries(entries.filter(([,value])=>value)) as typeof texts;setTexts(loaded);setError(!loaded.ar);setLoading(false)});
    return()=>controller.abort();
  },[book,chapter,ready,retry]);
  useEffect(()=>{if(!ready)return;const controller=new AbortController();setRailRows([]);setRailLoading(true);setRailError(false);
    fetch(`/api/hadith/${book}/ar/${railChapter}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then((data:HadithData)=>{if(controller.signal.aborted)return;if(!Array.isArray(data.hadiths))throw new Error();setRailRows(data.hadiths);setRailLoading(false)}).catch(()=>{if(!controller.signal.aborted){setRailError(true);setRailLoading(false)}});
    return()=>controller.abort();
  },[book,railChapter,ready,retry]);
  const chapters=Object.entries(metadata?.sections||{}).filter(([n])=>Number(n)>0);
  const maps=useMemo(()=>Object.fromEntries((["ar","fr","en"] as const).map(l=>[l,new Map((texts[l]?.hadiths||[]).map(item=>[item.hadithnumber,item]))])) as Record<"ar"|"fr"|"en",Map<number,NonNullable<HadithData["hadiths"]>[number]>>,[texts]);
  const indexed=useMemo(()=>(texts.ar?.hadiths||[]).map(item=>({item,index:hadithSearchIndex(`${item.hadithnumber} ${item.text} ${maps.fr.get(item.hadithnumber)?.text||""}`,item.text)})),[texts,maps]);
  const results=useMemo(()=>indexed.filter(({index})=>matchesHadith(index,search)).map(({item})=>item),[indexed,search]);
  function chooseChapter(n:string){setDirection("forward");setRailChapter(n);setRailMode("groups");if(portraitReaderLayout()){setStage("groups");window.scrollTo({top:0,behavior:scrollMotion()})}}
  function attachBook(){sessionStorage.setItem("nur-ai-attachment",JSON.stringify(hadithBookAttachment(book,chapter,texts.ar?.hadiths||[],texts[language==="ar"?"ar":language]?.hadiths||[],language)))}
  const pages=Math.ceil(results.length/10);
  const chapterIndex=chapters.findIndex(([n])=>n===chapter);
  function adjacentChapter(delta:number){const next=chapters[chapterIndex+delta]?.[0];if(next)chooseChapter(next)}
  const groups=Array.from({length:pages},(_,index)=>({index,first:results[index*10].hadithnumber,last:results[Math.min(results.length-1,index*10+9)].hadithnumber}));
  const railGroups=Array.from({length:Math.ceil(railRows.length/10)},(_,index)=>({index,first:railRows[index*10].hadithnumber,last:railRows[Math.min(railRows.length-1,index*10+9)].hadithnumber}));
  function choosePage(index:number,fromRail=false){if(index<0||index>=(fromRail?railGroups.length:pages))return;const nextDirection=stage==="reading"&&index<page?"back":"forward";setDirection(nextDirection);setReadingDirection(nextDirection);if(fromRail){if(railChapter!==chapter){setTexts({});setLoading(true);}setChapter(railChapter);setSearch("");}setPage(index);setStage("reading");requestAnimationFrame(()=>window.scrollTo({top:0,behavior:scrollMotion()}))}
  function back(){setDirection("back");setRailChapter(chapter);setRailMode("groups");setStage("groups");setSearch("");window.scrollTo({top:0,behavior:scrollMotion()})}
  useEffect(()=>{if(loading||!results.length||resumeHadith.current===null)return;const n=resumeHadith.current,index=results.findIndex(h=>h.hadithnumber===n);resumeHadith.current=null;if(index<0)return;setPage(Math.floor(index/10));requestAnimationFrame(()=>document.getElementById(`hadith-${n}`)?.scrollIntoView({behavior:scrollMotion(),block:"center"}))},[loading,results]);
  useEffect(()=>{if(!reading||loading||!results[page*10]||resumeHadith.current!==null)return;
    const save=(hadith:number)=>{try{localStorage.setItem("nur-last-hadith",JSON.stringify({book,chapter:Number(chapter),hadith,updatedAt:Date.now()}));sessionStorage.removeItem("nur-resume-dismissed");dispatchEvent(new Event("nur-data-changed"))}catch{}};
    save(results[page*10].hadithnumber);
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top-innerHeight/2)-Math.abs(b.boundingClientRect.top-innerHeight/2))[0];if(visible)save(Number((visible.target as HTMLElement).dataset.hadith))},{rootMargin:"-40% 0px -40% 0px",threshold:.05});
    document.querySelectorAll(".hadith-card").forEach(node=>observer.observe(node));return()=>observer.disconnect();
  },[reading,loading,book,chapter,page,results]);
  function backToChapters(){setDirection("back");setRailMode("chapters");if(stage!=="reading")setStage("chapters");}
  const pageNavigation=()=> <div className="hadith-page-navigation"><button disabled={chapterIndex<=0} onClick={()=>adjacentChapter(-1)}>{local("← Chapitre précédent","← Previous chapter","الباب السابق →")}</button><button disabled={chapterIndex<0||chapterIndex+1>=chapters.length} onClick={()=>adjacentChapter(1)}>{local("Chapitre suivant →","Next chapter →","← الباب التالي")}</button></div>;
  return <section className={`hadith-library hadith-reader hadith-stage-${stage} hadith-motion-${direction} hadith-reading-motion-${readingDirection} ${reading?"hadith-reading":"hadith-selecting"}`} style={{"--hadith-font":`${preferences.fontSize}px`,"--hadith-arabic-font":`${preferences.fontSize*1.5}px`} as CSSProperties}>
    <aside className="hadith-rail">
      <div className="hadith-rail-view" key={`${railMode}:${book}:${railChapter}`}>
      <h2>{railMode==="groups"?local("Choisir un hadith","Choose a hadith","اختر حديثًا"):local("Choisir un chapitre","Choose a chapter","اختر بابًا")}</h2>
      {railMode==="chapters"?<>
      <div className="hadith-collections">{hadithBooks.map(item=><button key={item.id} className={book===item.id?"selected":""} aria-pressed={book===item.id} onClick={()=>{if(book===item.id)return;setTexts({});setMetadata(null);setLoading(true);setBook(item.id);setChapter("1");setRailChapter("1");setPage(0);setStage(portraitReaderLayout()?"chapters":"reading");setRailMode("chapters");setSearch("");setBookSearch("");}}>{language==="ar"?item.ar:item.name}</button>)}</div>
      <input type="search" aria-label={local("Rechercher un chapitre","Search chapters","ابحث عن باب")} placeholder={local("Rechercher un chapitre…","Search chapters…","ابحث عن باب…")} value={bookSearch} onChange={e=>setBookSearch(e.target.value)}/>
      <div ref={wheel} className="hadith-book-list reading-wheel hadith-selection-list">{!metadata&&<p role={metadataError?"alert":"status"}>{metadataError?local("Chapitres indisponibles. Réessayez.","Chapters unavailable. Try again.","الأبواب غير متاحة. حاول مجددًا."):local("Chargement des chapitres…","Loading chapters…","جارٍ تحميل الأبواب…")}<button type="button" onClick={()=>setRetry(n=>n+1)}>{local("Réessayer","Retry","أعد المحاولة")}</button></p>}
        {chapters.filter(([n,name])=>normalizeHadith(`${bookWord} ${n} ${name} ${chapterTitle(book,n,name,language)}`).includes(normalizeHadith(bookSearch))).map(([n,name])=><button key={n} className={stage!=="chapters"&&chapter===n?"selected":""} aria-current={stage!=="chapters"&&chapter===n?"true":undefined} onClick={()=>chooseChapter(n)}><small>{n.padStart(3,"0")}</small><span>{bookWord} {n}<em>{chapterTitle(book,n,name,language)}</em></span></button>)}
      </div>
      </>:<>
      <button className="hadith-back" onClick={backToChapters}>{local("← Retour aux chapitres","← Back to chapters","العودة إلى الأبواب →")}</button>
      <p className="hadith-group-title">{title}<br/>{bookWord} {railChapter} · {chapterTitle(book,railChapter,metadata?.sections[railChapter]||"",language)}</p>
      <div ref={wheel} className="hadith-book-list reading-wheel hadith-selection-list">{railLoading?<p role="status">{local("Chargement des hadiths…","Loading hadiths…","جارٍ تحميل الأحاديث…")}</p>:railError?<button onClick={()=>setRetry(n=>n+1)}>{local("Réessayer","Retry","أعد المحاولة")}</button>:railGroups.map(group=><button key={group.index} className={reading&&chapter===railChapter&&page===group.index?"selected":""} aria-current={reading&&chapter===railChapter&&page===group.index?"true":undefined} onClick={()=>choosePage(group.index,true)}><small>{String(group.index+1).padStart(3,"0")}</small><span>{local("Hadiths","Hadiths","الأحاديث")} {group.first}{group.first!==group.last?`–${group.last}`:""}</span></button>)}</div>
      </>}
      </div>
    </aside>
    <div className="hadith-reading-pane">
      <div className="hadith-view" key={reading?`${book}:${chapter}`:"intro"}>
      {stage!=="reading"?<div className="hadith-intro"><p className="eyebrow">{local("LA TRADITION PROPHÉTIQUE","THE PROPHETIC TRADITION","السنة النبوية")}</p><h1>{local("Les hadiths","Hadiths","الأحاديث")}</h1><p>{local("Choisissez un chapitre, puis un groupe de hadiths dans la barre latérale pour commencer votre lecture.","Choose a chapter, then a group of hadiths in the sidebar to start reading.","اختر بابًا ثم مجموعة أحاديث من القائمة الجانبية لبدء القراءة.")}</p></div>:<>
      <button className="hadith-back hadith-mobile-back" onClick={back}>{stage==="reading"?local("← Choisir un hadith","← Choose a hadith","اختيار حديث →"):local("← Choisir un chapitre","← Choose a chapter","اختيار باب →")}</button>
      {pageNavigation()}
      {!loading&&!error&&groups.length>1&&<label className="hadith-range-select">{local("Aller aux hadiths","Go to hadiths","الانتقال إلى الأحاديث")}<select value={page} onChange={e=>choosePage(Number(e.target.value))}>{groups.map(group=><option key={group.index} value={group.index}>{group.first}{group.first!==group.last?`–${group.last}`:""}</option>)}</select></label>}
      <header className="hadith-heading"><p className="eyebrow">{local("LA TRADITION PROPHÉTIQUE","THE PROPHETIC TRADITION","السنة النبوية")}</p><h1>{title}</h1><p>{bookWord} {chapter} · {chapterName}</p><p>{groups[page]?`${local("Hadiths","Hadiths","الأحاديث")} ${groups[page].first}${groups[page].first!==groups[page].last?`–${groups[page].last}`:""}`:""}</p>
        {online&&!loading&&!error&&<a className="primary hadith-explain-book" href="/assistant?auto=explain" onClick={attachBook}>{local("Expliquer ce chapitre avec l’IA","Explain this chapter with AI","شرح هذا الباب بالذكاء الاصطناعي")}</a>}
      </header>
      <label className="hadith-text-search"><span>{local("Rechercher dans ce chapitre","Search this chapter","ابحث في هذا الباب")}</span><input type="search" value={search} placeholder={local("Français ou phonétique arabe…","French or Arabic transliteration…","كلمات عربية أو فرنسية أو كتابة صوتية…")} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label>
      <div className="hadith-results" key={page} aria-busy={loading}>
        {loading?<p role="status">{local("Chargement des hadiths…","Loading hadiths…","جارٍ تحميل الأحاديث…")}</p>:error?<div role="alert"><p>{local("Impossible de charger ce livre. Hors ligne, seuls les livres déjà consultés sont disponibles.","Unable to load this book. Offline, only previously visited books are available.","تعذر تحميل الكتاب. دون اتصال تتوفر الكتب التي قرأتها سابقًا فقط.")}</p><button className="primary" onClick={()=>setRetry(n=>n+1)}>{local("Réessayer","Retry","أعد المحاولة")}</button></div>:<>
          <p className="hadith-count" role="status">{results.length} {local("hadiths","hadiths","حديثًا")}</p>
          {!results.length&&<p>{local("Aucun résultat. Essayez un mot plus court ou une autre orthographe.","No results. Try a shorter word or another spelling.","لا توجد نتائج. جرّب كلمة أقصر أو كتابة أخرى.")}</p>}
          {results.slice(page*10,page*10+10).map(item=><article className="hadith-card" id={`hadith-${item.hadithnumber}`} data-hadith={item.hadithnumber} key={`${book}-${chapter}-${item.hadithnumber}`}>
            <header><strong>{title} · {item.hadithnumber}</strong><span>{bookWord} {chapter}</span></header>
            {(["ar","fr","en"] as const).filter(l=>preferences.languages.includes(l)).map(l=><div key={l} className="hadith-language"><small>{l==="ar"?"العربية":l==="fr"?"Français":"English"}</small><p className={l==="ar"?"hadith-arabic":"hadith-translation"} lang={l} dir={l==="ar"?"rtl":"ltr"}>{maps[l].get(item.hadithnumber)?.text||local("Texte indisponible dans cette langue.","Text unavailable in this language.","النص غير متاح بهذه اللغة.")}</p></div>)}
            <footer>{online?<a className="primary" href="/assistant?auto=explain" onClick={()=>sessionStorage.setItem("nur-ai-attachment",JSON.stringify(hadithAttachment(book,maps[language].get(item.hadithnumber)||item,item.text)))}>{local("Expliquer avec Fqih","Explain with Fqih","اشرح مع فقيه")}</a>:<span>{local("Fqih nécessite Internet","Fqih requires Internet","فقيه يتطلب الإنترنت")}</span>}</footer>
          </article>)}
          {pageNavigation()}
          {!search&&<button className="primary hadith-next-group" disabled={page+1>=pages&&!chapters[chapterIndex+1]} onClick={()=>page+1<pages?choosePage(page+1):adjacentChapter(1)}>{page+1<pages?local("Hadiths suivants →","Next hadiths →","← الأحاديث التالية"):local("Choisir les hadiths du chapitre suivant →","Choose hadiths from the next chapter →","← اختيار أحاديث الباب التالي")}</button>}
        </>}
      </div>
      <p className="hadith-credit">{local("Textes et traductions :","Texts and translations:","النصوص والترجمات:")} <a href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noopener noreferrer">Hadith API · fawazahmed0</a></p>
      </>}
      </div>
    </div>
  </section>;
}
