import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("sidebar motion cannot restart committed hadith reading motion",async()=>{
 const ui=await readFile(new URL("../components/HadithLibrary.tsx",import.meta.url),"utf8");
 const selection=ui.slice(ui.indexOf("function chooseChapter"),ui.indexOf("function attachBook"));
 assert.doesNotMatch(selection,/setReadingDirection|setChapter\(n\)|setTexts/);
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.doesNotMatch(css,/\.hadith-motion-back \.hadith-view/);assert.match(css,/\.hadith-reading-motion-back \.hadith-view/);
});
test("navigation remains stationary and mobile composer shares its proportions",async()=>{
 const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
 assert.match(css,/html\{scrollbar-gutter:stable\}/);
 assert.match(css,/topbar:not\(\.landing-header\)\{animation:none!important\}/);
 for(const selector of [".topbar:not(.landing-header)",".assistant-page .chat-composer"]){
   const rules=css.slice(css.lastIndexOf(selector+"{"));
   assert.match(rules,/width:calc\(100% - 20px\)!important/);assert.match(rules,/(?:min-)?height:80px!important/);
 }
});
