export type HadithPreferences = { languages: Array<"ar"|"fr"|"en">; fontSize: number };
export function validHadithPreferences(value: unknown): value is HadithPreferences {
  if(!value || typeof value!=="object")return false;
  const p=value as HadithPreferences;
  return Array.isArray(p.languages)&&p.languages.length>0&&p.languages.length<=3&&new Set(p.languages).size===p.languages.length
    &&p.languages.every(l=>["ar","fr","en"].includes(l))&&Number.isFinite(p.fontSize)&&p.fontSize>=14&&p.fontSize<=28;
}
