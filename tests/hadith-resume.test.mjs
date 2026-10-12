import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validHadithPosition,hadithResumeUrl} from "../lib/hadithPosition.ts";
test("hadith resume links are bounded and reopen the actual narration",()=>{
 const p={book:"muslim",chapter:2,hadith:251,updatedAt:10};assert.ok(validHadithPosition(p));assert.equal(hadithResumeUrl(p),"/favorites?book=muslim&chapter=2&hadith=251#hadith-251");
 for(const bad of [{...p,book:"unknown"},{...p,chapter:0},{...p,hadith:-1},{...p,updatedAt:NaN}])assert.equal(validHadithPosition(bad),false);
});
test("pending chapter selection never changes the committed reader",async()=>{
 const ui=await readFile(new URL("../components/HadithLibrary.tsx",import.meta.url),"utf8");
 const choose=ui.slice(ui.indexOf("function chooseChapter"),ui.indexOf("function attachBook"));
 assert.match(choose,/setRailChapter\(n\)/);assert.doesNotMatch(choose,/setChapter\(n\)|setTexts/);
 assert.match(ui,/setChapter\(railChapter\)/);assert.match(ui,/railChapter!==chapter\)\{setTexts\(\{\}\);setLoading\(true\)/);assert.match(ui,/hadith-next-group/);assert.match(ui,/nur-last-hadith/);
});
