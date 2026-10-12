export const hadithBooks = [
  { id: "bukhari", name: "Sahih al-Bukhari", ar: "صحيح البخاري", french: true },
  { id: "muslim", name: "Sahih Muslim", ar: "صحيح مسلم", french: true },
] as const;
export type Hadith = { hadithnumber: number; text: string; grades: Array<{ name: string; grade: string }>; reference?: { book: number; hadith: number } };
export type HadithData = { hadiths: Hadith[] };
export type HadithMetadata = { sections: Record<string, string>; section_details?: Record<string, { hadithnumber_first: number; hadithnumber_last: number }> };
export function sahihHadith(book: string, hadith: Hadith) {
  return book === "bukhari" || book === "muslim" || (hadith.grades || []).some(item => /\bsahih\b|صحيح/i.test(item.grade));
}
export function hadithBookAttachment(book: string, number: string, arabic: Hadith[], translation: Hadith[] = [], language: "fr"|"en"|"ar" = "fr") {
  const title = hadithBooks.find(item => item.id === book)?.name || book;
  const translated = new Map(translation.map(item => [item.hadithnumber, item.text]));
  const passages: string[] = [];
  let size = 0;
  for (const item of arabic) {
    const passage = `#${item.hadithnumber}\n${item.text}\n${translated.get(item.hadithnumber) || ""}`;
    if (size + passage.length > 58000) break;
    passages.push(passage); size += passage.length;
  }
  const displayTitle = language === "ar" ? hadithBooks.find(item => item.id === book)?.ar || title : title;
  return { kind: "hadith" as const, scope: "book" as const, label: `${displayTitle} · ${language === "ar" ? "باب" : language === "en" ? "Chapter" : "Chapitre"} ${number}`,
    context: `${title}, book ${number}. Included ${passages.length}/${arabic.length} narrations. ${passages.length < arabic.length ? "PARTIAL EXCERPTS: do not claim to summarize the complete book." : "Complete supplied book."}\n${passages.join("\n\n")}` };
}
export function hadithAttachment(book: string, hadith: Hadith, arabic?: string) {
  const title = hadithBooks.find(item => item.id === book)?.name || book;
  return { kind: "hadith" as const, label: `${title} · ${hadith.hadithnumber}`, context: `${title}, #${hadith.hadithnumber}\n${arabic || ""}\n${hadith.text}\n${(hadith.grades || []).map(item => `${item.name}: ${item.grade}`).join("\n")}` };
}
