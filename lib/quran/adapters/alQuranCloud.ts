import type { QuranDataSource, QuranSurah, ReaderOptions } from "../types";

type Edition = { edition:{identifier:string}; name:string; englishName:string; revelationType:string; ayahs:{numberInSurah:number;text:string;audio?:string;juz?:number;page?:number;hizbQuarter?:number}[] };
type WarshAyah = { number:number; text:string; number_in_hafs?:number[]; page_number?:number };

const tajweedClasses:Record<string,string>={h:"ham_wasl",s:"slnt",l:"slnt",n:"madda_normal",p:"madda_permissible",m:"madda_necessary",q:"qlq",o:"madda_obligatory",c:"ikhf_shfw",f:"ikhf",w:"idghm_shfw",i:"iqlb",a:"idgh_ghn",u:"idgh_w_ghn",d:"idgh_mus",b:"idgh_mus",g:"ghn"};
function parseTajweed(value:string){const escaped=value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return stripLeadingBasmala(escaped.replace(/\[([hslpnmqocfwiaudbg])(?::\d+)?\[([^\]]*)\]/g,(_,code:string,text:string)=>`<tajweed class="${tajweedClasses[code]}">${text}</tajweed>`))}
function stripLeadingBasmala(value:string){
  const target="بسم الله الرحمن الرحيم"; let normalized="",inTag=false,previousSpace=false,cut=0;
  for(let i=0;i<value.length;i++){
    const char=value[i]; if(char==="<"){inTag=true;continue} if(inTag){if(char===">")inTag=false;continue}
    if(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ]/.test(char))continue;
    const next=char==="ٱ"?"ا":/\s/.test(char)?" ":char;
    if(next===" "&&previousSpace)continue; normalized+=next;previousSpace=next===" ";cut=i+1;
    if(normalized.length>=target.length)break;
  }
  if(!normalized.startsWith(target))return value;
  return value.slice(cut).replace(/^(?:[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06EDـ\s]+|<\/[^>]+>)*/,"").trimStart();
}

export const quranApi:QuranDataSource={async getSurah(number:number,options:ReaderOptions):Promise<QuranSurah>{
  const arabic=options.tajweed?"quran-tajweed":"quran-uthmani";
  const editions=[arabic,"quran-uthmani","en.asad","fr.hamidullah","en.transliteration",options.riwayah==="hafs"?options.reciter:"ar.alafasy"].join(",");
  const response=await fetch(`https://api.alquran.cloud/v1/surah/${number}/editions/${editions}`);
  if(!response.ok)throw new Error(`Quran API ${response.status}`);
  const json=await response.json() as {code:number;data:Edition[]};
  if(json.code!==200||!Array.isArray(json.data))throw new Error("Réponse invalide");
  const byId=Object.fromEntries(json.data.map(item=>[item.edition.identifier,item]));
  const ar=byId["quran-uthmani"],tajweed=byId["quran-tajweed"],fr=byId["fr.hamidullah"],en=byId["en.asad"],tr=byId["en.transliteration"],audio=byId[options.riwayah==="hafs"?options.reciter:"ar.alafasy"];
  if(!ar||!fr||!en)throw new Error("Éditions requises indisponibles");
  ar.ayahs.forEach(ayah=>{ayah.text=stripLeadingBasmala(ayah.text)});

  if(options.riwayah==="warsh"){
    const warshResponse=await fetch(`/api/warsh/${number}`);
    if(!warshResponse.ok)throw new Error(`Warsh API ${warshResponse.status}`);
    const warsh=(await warshResponse.json() as WarshAyah[]).map(ayah=>({...ayah,text:stripLeadingBasmala(ayah.text)}));
    return {number,nameArabic:ar.name,nameLatin:ar.englishName,revelationType:ar.revelationType==="Meccan"?"Mecquoise":"Médinoise",sourceLabel:"Quranpedia · Muṣḥaf Warsh",verses:warsh.map(ayah=>{const hafsNumber=ayah.number_in_hafs?.[0]||ayah.number;const i=number===1?Math.min(6,ayah.number):Math.max(0,hafsNumber-1);return{number:ayah.number,arabic:ayah.text,transliteration:tr?.ayahs[i]?.text||"Prononciation indisponible",fr:fr.ayahs[i]?.text||"",en:en.ayahs[i]?.text||"",juz:ar.ayahs[i]?.juz,page:ayah.page_number||ar.ayahs[i]?.page,hizbQuarter:ar.ayahs[i]?.hizbQuarter}})};
  }

  const start=number===1?1:0;
  return {number,nameArabic:ar.name,nameLatin:ar.englishName,revelationType:ar.revelationType==="Meccan"?"Mecquoise":"Médinoise",sourceLabel:`AlQuran Cloud · ${options.tajweed?"tajwīd coloré":"Uthmani"} · Hamidullah · Asad`,verses:ar.ayahs.slice(start).map((ayah,i)=>{const sourceIndex=i+start;return{number:i+1,arabic:ayah.text,tajweedHtml:tajweed?.ayahs[sourceIndex]?.text?parseTajweed(tajweed.ayahs[sourceIndex].text):undefined,transliteration:tr?.ayahs[sourceIndex]?.text||"Prononciation indisponible",fr:fr.ayahs[sourceIndex]?.text||"",en:en.ayahs[sourceIndex]?.text||"",audioUrl:audio?.ayahs[sourceIndex]?.audio,juz:ayah.juz,page:ayah.page,hizbQuarter:ayah.hizbQuarter}})};
}};

export const warshReciters=[
  {id:"hicham-lharraz",name:"Hicham El Harraz",server:"https://server16.mp3quran.net/H-Lharraz/Rewayat-Warsh-A-n-Nafi/",missing:[33]},
  {id:"omar-qazabri",name:"Omar Al-Qazabri",server:"https://server9.mp3quran.net/omar_warsh/",missing:[]},
  {id:"koshi",name:"Al-Oyoun Al-Kouchi",server:"https://server11.mp3quran.net/koshi/",missing:[]},
  {id:"benkirane",name:"Abdelmoujib Benkirane",server:"https://server16.mp3quran.net/A-Benkirane/Rewayat-Warsh-A-n-Nafi/",missing:[]},
  {id:"husr-warsh",name:"Mahmoud Al-Hussary",server:"https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi/",missing:[]},
  {id:"abdulbasit-warsh",name:"Abdul Basit Abdus-Samad",server:"https://server7.mp3quran.net/basit/Rewayat-Warsh-A-n-Nafi/",missing:[]},
  {id:"rachid-belalya",name:"Rachid Belalya",server:"https://server6.mp3quran.net/bl3/Rewayat-Warsh-A-n-Nafi/",missing:[]},
  {id:"ibrahim-dosari",name:"Ibrahim Al-Dosari",server:"https://server10.mp3quran.net/ibrahim_dosri/Rewayat-Warsh-A-n-Nafi/",missing:[]},
] as const;

export function warshSurahAudio(number:number,reciter:string){const voice=warshReciters.find(item=>item.id===reciter)||warshReciters[0];return (voice.missing as readonly number[]).includes(number)?null:`${voice.server}${String(number).padStart(3,"0")}.mp3`}
