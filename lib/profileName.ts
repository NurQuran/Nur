export type NameIssue = "inappropriate" | "reserved" | null;

function normalize(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\p{M}\p{Cf}\u0640]/gu, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/œ/g, "oe")
    .replace(/[0134579@$!]/g, character => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "9": "q", "@": "a", "$": "s", "!": "i" })[character]!);
}

// Whole-word matching avoids the "Scunthorpe problem": legitimate names are
// not rejected just because they contain part of a prohibited word. This local
// lexicon can be extended; no user's name is sent to a moderation service.
const prohibited = new Set(`
fuck fucking fucker fuckoff motherfucker motherfucking fck fuk fack
shit bullshit shitty shite bitch bitches bastard bastards asshole arsehole
cunt cunts dick dickhead cock cocksucker prick wanker twat whore slut
nigger nigga niggas niggers faggot faggots fag retard retarded
merde merdique putain pute putes salope salopes salopard connard connasse con conne
encule enculer enculé enculée encules enculées enculerie enculade
couille couilles bite bites chatte chattes branleur branleuse batard batarde
bordel foutre foutu chier chiotte chiottes trouduc pd pede pedale negro negre
nique niquer niqueur niqueta ngue ta-mere nik mok nikmok khra hmar hmara hmarat
zebi zeb zbi zb zobb zboub zizi khara 9ahba kahba qahba ch9af zoubi
كسم كسامك كسمك كسمكم كسمه كسختك كسخت كسامك كسامكم كسامها
كس كسا زب زبي زبر زوبر زبك قحبة قحبه قحاب شرموطة شرموطه شراميط
عاهرة عاهره عاهرات خرا خراء خري خريان خنزير حمار حمارة حماره كلاب كلب
منيوك منيوق متناك منايك نيك ناك نيكك نيكامك احا يلعن لعنة عرص عرصة عرصه طيز
`.split(/\s+/).filter(Boolean).map(normalize));

export function profileNameIssue(value: string): NameIssue {
  if (value.length > 60 || /[<>\u0000-\u001f\u007f]/.test(value)) return "inappropriate";
  if (!value.trim()) return null; // A guest may choose not to give a name.
  if (!/\p{L}/u.test(value)) return "inappropriate";
  const folded = normalize(value), tokens = folded.match(/\p{L}+/gu) || [];
  const compact = tokens.join("");
  if (compact.includes("dilmiaoukli")) return "reserved";
  const blocked = (word: string) => prohibited.has(word) || (/^[\u0600-\u06ff]+$/.test(word) && prohibited.has(word.replace(/^(?:وال|بال|ال)/, "")));
  if (blocked(compact) || tokens.some(blocked)) return "inappropriate";
  // Also recognize spelling a banned word letter by letter, even inside a name.
  for (let start = 0; start < tokens.length; start++) {
    let joined = "";
    for (let end = start; end < Math.min(tokens.length, start + 14) && tokens[end].length <= 2; end++) {
      joined += tokens[end];
      if (joined.length >= 3 && blocked(joined)) return "inappropriate";
    }
  }
  return null;
}

export function allowedProfileName(value: unknown) {
  return typeof value === "string" && !profileNameIssue(value) ? value.trim() : "";
}
