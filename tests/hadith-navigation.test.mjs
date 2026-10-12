import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chapterTitle } from "../lib/hadithChapters.ts";
test("all 153 collection headings have French and Arabic UI translations",()=>{
 for(const [book,count] of [["bukhari",97],["muslim",56]])for(let n=1;n<=count;n++){
   const fr=chapterTitle(book,String(n),"ENGLISH FALLBACK","fr"),ar=chapterTitle(book,String(n),"ENGLISH FALLBACK","ar");
   assert.notEqual(fr,"ENGLISH FALLBACK",`${book}/${n}`);assert.match(ar,/[\u0600-\u06ff]/,`${book}/${n}`);
 }
 assert.equal(chapterTitle("bukhari","1","Revelation","fr"),"La révélation");
});
test("chapter selection opens groups of ten and same-tab reselect restores the base menu",async()=>{
 const ui=await readFile(new URL("../components/HadithLibrary.tsx",import.meta.url),"utf8");
 assert.match(ui,/setStage\("groups"\)/);assert.match(ui,/Math.ceil\(results.length\/10\)/);assert.match(ui,/slice\(page\*10,page\*10\+10\)/);
 assert.match(ui,/nur-hadith-reselect/);assert.doesNotMatch(ui,/hadith-book-navigation/);
 const reader=await readFile(new URL("../app/read/page.tsx",import.meta.url),"utf8");
 assert.match(reader,/portraitReaderLayout\(\)\)showLibrary\(false\)/);
});
test("desktop sidebar persists and arrows now navigate actual chapters",async()=>{
 const ui=await readFile(new URL("../components/HadithLibrary.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(ui,/chapterNavigation|Hadiths précédents/);
 assert.match(ui,/onClick=\{\(\)=>adjacentChapter\(1\)\}/);
 assert.doesNotMatch(ui,/hadith-rail-choose|hadith-range-menu/);
 assert.match(ui,/hadith-rail-view/);
 assert.match(ui,/hadith-mobile-back/);assert.doesNotMatch(ui,/hadith-desktop-back/);
 assert.match(ui,/function backToChapters\(\)/);
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/hadith-rail\{max-width:none!important.*background:var\(--surface\)/);
 assert.match(css,/hadith-results\{[^}]*animation:hadith-view-in/);
 assert.match(ui,/key=\{reading\?`\$\{book\}:\$\{chapter\}`:"intro"\}/);
});
test("flat picker links remain visible and desktop header uses a centered grid",async()=>{
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/reading-wheel>a\{[^}]*opacity:1/);
 assert.match(css,/topbar:not\(\.landing-header\)\{display:grid!important[^}]*grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)!important/);
});
