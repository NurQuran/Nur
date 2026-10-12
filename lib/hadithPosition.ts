export type HadithPosition={book:"bukhari"|"muslim";chapter:number;hadith:number;updatedAt:number};
export function validHadithPosition(value:unknown):value is HadithPosition{
 if(!value||typeof value!=="object")return false;
 const p=value as HadithPosition;
 return ["bukhari","muslim"].includes(p.book)&&Number.isInteger(p.chapter)&&p.chapter>=1&&p.chapter<=150&&Number.isInteger(p.hadith)&&p.hadith>=1&&p.hadith<=50000&&Number.isFinite(p.updatedAt)&&p.updatedAt>=0;
}
export function hadithResumeUrl(p:HadithPosition){return `/favorites?book=${p.book}&chapter=${p.chapter}&hadith=${p.hadith}#hadith-${p.hadith}`}
