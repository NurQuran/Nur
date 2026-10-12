import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hadithBooks, sahihHadith, hadithAttachment, hadithBookAttachment } from "../lib/hadith.ts";

test("only the two Sahih collections are exposed", () => {
  assert.deepEqual(hadithBooks.map(b=>b.id), ["bukhari","muslim"]);
  assert.ok(hadithBooks.every(b=>b.french));
});
test("Sahih filter does not label all Sunan narrations authentic", () => {
  const item = { hadithnumber: 2, text: "Test", grades: [] };
  assert.equal(sahihHadith("bukhari", item), true);
  assert.equal(sahihHadith("muslim", item), true);
  assert.equal(sahihHadith("abudawud", item), false);
  assert.equal(sahihHadith("nasai", { ...item, grades: [{ name: "A", grade: "Daif" }] }), false);
  assert.equal(sahihHadith("nasai", { ...item, grades: [{ name: "A", grade: "Hasan Sahih" }, { name: "B", grade: "Daif" }] }), true);
});
test("Fqih attachment carries the actual source, Arabic and conflicting grades", () => {
  const attachment = hadithAttachment("bukhari", { hadithnumber: 2, text: "Translation", grades: [{ name: "A", grade: "Sahih" }, { name: "B", grade: "Daif" }] }, "النص");
  assert.equal(attachment.kind, "hadith");
  for (const text of ["Sahih al-Bukhari", "#2", "Translation", "النص", "B: Daif"]) assert.ok(attachment.context.includes(text));
});
test("reader is book-bounded, cancellation-safe and uses persistent display preferences", async () => {
  const ui = await readFile(new URL("../components/HadithLibrary.tsx", import.meta.url), "utf8");
  assert.match(ui, /controller\.abort\(\)/);
  assert.match(ui, /slice\(page\*10,page\*10\+10\)/);
  assert.match(ui, /useHadithPreferences/);
  assert.match(ui, /nur-ai-attachment/);
  assert.doesNotMatch(ui, /Sahih uniquement|target="_blank".*Source/);
  const worker = await readFile(new URL("../worker/hadithApi.ts", import.meta.url), "utf8");
  assert.match(worker, /hadithBooks\.find/);
  assert.match(worker, /chapter > 150/);
  assert.match(worker, /raw\.githubusercontent\.com/);
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /startsWith\("\/api\/hadith\/"\)/);
});
test("hadith preferences require at least one language and a bounded font size", async () => {
 const {validHadithPreferences}=await import("../lib/hadithSettings.ts");
 assert.ok(validHadithPreferences({languages:["ar","fr","en"],fontSize:18}));
 for(const value of [{languages:[],fontSize:18},{languages:["fr","fr"],fontSize:18},{languages:["fr"],fontSize:100}])assert.equal(validHadithPreferences(value),false);
});
test("home favorite grid grows to three columns and shares progress width", async () => {
  const ui = await readFile(new URL("../components/PersonalLibrary.tsx", import.meta.url), "utf8");
  assert.match(ui, /Math\.min\(3, favorites.length\)/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.personal-library \.favorite-grid\{max-width:none;width:100%;grid-template-columns:repeat\(var\(--favorite-columns,3\),minmax\(0,1fr\)\)/);
});
test("French typo and Arabic transliteration search are tolerant", async () => {
  const {hadithSearchIndex,matchesHadith}=await import("../lib/hadithSearch.ts");
  const index=hadithSearchIndex("Les actions ne valent que par les intentions. إنما الأعمال بالنيات","إنما الأعمال بالنيات");
  for(const query of ["intentons","inténtions","innama","al a3mal","بالنيات"]) assert.ok(matchesHadith(index,query),query);
  assert.equal(matchesHadith(index,"astronomie"),false);
});
test("long-book attachment labels partial context explicitly and stays bounded", () => {
 const rows=Array.from({length:100},(_,i)=>({hadithnumber:i+1,text:"ن".repeat(2000),grades:[]}));
 const a=hadithBookAttachment("muslim","1",rows);
 assert.equal(a.scope,"book"); assert.ok(a.context.length<60000); assert.match(a.context,/PARTIAL EXCERPTS/);
});
