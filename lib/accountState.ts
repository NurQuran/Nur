import { profileNameIssue } from "./profileName";
import { validHadithPreferences } from "./hadithSettings";
import { validHadithPosition } from "./hadithPosition";
export const syncKeys = [
  "nur-language", "nur-theme", "nur-reduced-motion", "nur-settings",
  "nur-favorite-surahs", "nur-read-surahs", "nur-last-position", "nur-progress",
  "nur-study", "nur-onboarding-complete", "nur-translation-mode", "nur-profile-name", "nur-hadith-preferences", "nur-last-hadith",
] as const;
export type Snapshot = Partial<Record<(typeof syncKeys)[number], string>>;

// Guest reading data may follow an account, but its name and completed tutorial
// must not turn a newly authenticated account into a returning one.
export function accountImportSnapshot(local: Snapshot): Snapshot {
  const result = { ...local };
  delete result["nur-profile-name"];
  delete result["nur-onboarding-complete"];
  return result;
}

function object(value?: string): Record<string, unknown> {
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
function numbers(value?: string): number[] {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter(n => Number.isInteger(n) && n >= 1 && n <= 114) : []; } catch { return []; }
}

export function validateSnapshot(input: unknown): Snapshot | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result: Snapshot = {};
  for (const key of syncKeys) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 6000) return null;
    if (key === "nur-language" && !["fr", "en", "ar"].includes(value)) return null;
    if (key === "nur-theme" && !["dark", "light"].includes(value)) return null;
    if (key === "nur-reduced-motion" && !["0", "1"].includes(value)) return null;
    if (key === "nur-onboarding-complete" && value !== "1") return null;
    if (key === "nur-translation-mode" && value !== "manual") return null;
    if (key === "nur-profile-name" && profileNameIssue(value)) return null;
    if (key === "nur-hadith-preferences") { try { if (!validHadithPreferences(JSON.parse(value))) return null; } catch { return null; } }
    if (key === "nur-last-hadith") { try { if (!validHadithPosition(JSON.parse(value))) return null; } catch { return null; } }
    if (key === "nur-favorite-surahs" || key === "nur-read-surahs") {
      try { const list = JSON.parse(value); if (!Array.isArray(list) || list.length > 114 || list.some(n => !Number.isInteger(n) || n < 1 || n > 114)) return null; } catch { return null; }
    }
    if (["nur-settings", "nur-last-position", "nur-progress", "nur-study"].includes(key)) {
      try { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some(field => ["__proto__", "prototype", "constructor"].includes(field))) return null; } catch { return null; }
    }
    result[key] = value;
  }
  const position = object(result["nur-last-position"]);
  if (result["nur-last-position"] && (!Number.isInteger(position.surah) || Number(position.surah) < 1 || Number(position.surah) > 114 || !Number.isInteger(position.verse) || Number(position.verse) < 1 || Number(position.verse) > 286)) return null;
  const progress = object(result["nur-progress"]);
  if (result["nur-progress"] && (!Number.isFinite(progress.minutes) || Number(progress.minutes) < 0 || Number(progress.minutes) > 1e7 || !Number.isFinite(progress.goal) || Number(progress.goal) < 1 || Number(progress.goal) > 120)) return null;
  const settings=object(result["nur-settings"]);
  if(settings.riwayah!==undefined&&settings.riwayah!=="hafs"&&settings.riwayah!=="warsh")return null;
  if(settings.reciter!==undefined&&(typeof settings.reciter!=="string"||!/^[a-zA-Z0-9._-]{1,100}$/.test(settings.reciter)))return null;
  if(settings.fontSize!==undefined&&(!Number.isFinite(settings.fontSize)||Number(settings.fontSize)<20||Number(settings.fontSize)>100))return null;
  if(settings.playbackRate!==undefined&&(!Number.isFinite(settings.playbackRate)||Number(settings.playbackRate)<.25||Number(settings.playbackRate)>3))return null;
  for(const key of ["tajweed","showFrench","showEnglish","showTransliteration","wordStudy","repeatVerse"])if(settings[key]!==undefined&&typeof settings[key]!=="boolean")return null;
  const study=object(result["nur-study"]);
  if(study.continuous!==undefined&&typeof study.continuous!=="boolean")return null;
  if(study.goal!==undefined&&(!Number.isFinite(study.goal)||Number(study.goal)<1||Number(study.goal)>120))return null;
  return result;
}

// Three-way merge preserves removals and concurrent additions. A changed local
// preference wins; unrelated remote preferences are kept. Guest import uses
// unions and the larger listening total, so repeated imports do not double it.
export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot, guestImport = false): Snapshot {
  const result = { ...remote };
  for (const key of syncKeys) {
    if (local[key] === base[key]) continue;
    if (key === "nur-favorite-surahs" || key === "nur-read-surahs") {
      const before = new Set(numbers(base[key])), here = new Set(numbers(local[key]));
      const merged = new Set(numbers(remote[key]));
      for (const n of here) if (guestImport || !before.has(n)) merged.add(n);
      if (!guestImport) for (const n of before) if (!here.has(n)) merged.delete(n);
      result[key] = JSON.stringify([...merged].sort((a, b) => a - b));
    } else if (["nur-settings", "nur-study", "nur-progress"].includes(key)) {
      if (!local[key]) { if (!guestImport) delete result[key]; continue; }
      const before = object(base[key]), here = object(local[key]), there = object(remote[key]);
      const merged = { ...there };
      for (const field of new Set([...Object.keys(before), ...Object.keys(here)])) {
        // Existing account preferences win over defaults from a new guest device.
        if (guestImport && there[field] !== undefined) continue;
        if (JSON.stringify(here[field]) !== JSON.stringify(before[field])) {
          if (here[field] === undefined) delete merged[field]; else merged[field] = here[field];
        }
      }
      if (key === "nur-progress") {
        const remoteMinutes = Number(there.minutes) || 0, localMinutes = Number(here.minutes) || 0;
        merged.minutes = guestImport ? Math.max(remoteMinutes, localMinutes) : remoteMinutes + Math.max(0, localMinutes - (Number(before.minutes) || 0));
      }
      result[key] = JSON.stringify(merged);
    } else if (local[key] === undefined) { if (!guestImport) delete result[key]; }
    else if (!guestImport || remote[key] === undefined) result[key] = local[key];
  }
  if (result["nur-progress"]) result["nur-progress"] = JSON.stringify({ ...object(result["nur-progress"]), read: numbers(result["nur-read-surahs"]).length });
  return result;
}
