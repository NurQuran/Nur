// Search transliterations approximately; this is an index, never displayed Quran/hadith text.
export function normalizeHadith(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670ـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}
const letters: Record<string, string> = { ا:"a",ب:"b",ت:"t",ث:"th",ج:"j",ح:"h",خ:"kh",د:"d",ذ:"dh",ر:"r",ز:"z",س:"s",ش:"sh",ص:"s",ض:"d",ط:"t",ظ:"dh",ع:"",غ:"gh",ف:"f",ق:"q",ك:"k",ل:"l",م:"m",ن:"n",ه:"h",و:"w",ي:"y",ء:"" };
function phonetic(text: string) {
  return normalizeHadith(text).replace(/[ء-ي]/g, c => letters[c] ?? c).replace(/3|2/g, "").replace(/7/g, "h").replace(/5/g, "kh")
    .replace(/ou/g, "w").replace(/ch/g, "sh").replace(/kh/g, "x").replace(/gh/g, "g").replace(/th/g, "t").replace(/dh/g, "d")
    .replace(/[aeiou'’\u02bf\u02be]/g, "").replace(/(.)\1+/g, "$1");
}
function near(a: string, b: string, tolerance: number) {
  if (Math.abs(a.length-b.length)>tolerance) return false;
  let row = Array.from({length:b.length+1}, (_,i)=>i);
  for(let i=1;i<=a.length;i++) {
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  return row[b.length]<=tolerance;
}
export function hadithSearchIndex(text: string, arabic: string) {
  return { text: normalizeHadith(text), words: normalizeHadith(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean), phonetic: phonetic(arabic).split(/[^a-z]+/).filter(Boolean) };
}
export function matchesHadith(index: ReturnType<typeof hadithSearchIndex>, query: string) {
  const normalized=normalizeHadith(query).trim();
  if (!normalized || index.text.includes(normalized)) return true;
  return normalized.split(/[^\p{L}\p{N}]+/u).filter(token => token && token!=="al" && token!=="el").every(token => {
    const sound=phonetic(token);
    return index.words.some(word => word===token || (token.length>=4 && near(token,word,token.length>=8?2:1)))
      || (!!sound && index.phonetic.some(word => word===sound || (word.startsWith("l") && word.slice(1)===sound) || (sound.length>=4 && near(sound,word,1))));
  });
}
