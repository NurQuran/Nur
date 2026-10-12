import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {workerRestarted,readableAIError} from "../lib/aiError.ts";
test("worker restart errors are detected and translated without exposing the raw proxy message",()=>{
 const raw="Your worker restarted mid-request. Please try sending the request again.";
 assert.ok(workerRestarted(raw));
 for(const language of ["fr","en","ar"])assert.notEqual(readableAIError(raw,language),raw);
 assert.match(readableAIError(raw,"fr"),/redémarré/);
});
test("the passage picker offers bounded verse and hadith selections",async()=>{
 const q=await readFile(new URL("../components/QuranAttachmentPicker.tsx",import.meta.url),"utf8");
 assert.match(q,/numberInSurah>=from&&v.numberInSurah<=to/);
 assert.match(q,/58000/); assert.match(q,/controller.abort/);
 const h=await readFile(new URL("../components/HadithAttachmentPicker.tsx",import.meta.url),"utf8");
 assert.match(h,/hadithnumber>=from&&h.hadithnumber<=to/);
 assert.match(h,/SELECTED EXCERPTS ONLY/);
});
test("reading lists stay flat and do not automatically select another passage",async()=>{
 const source=await readFile(new URL("../lib/useReadingWheel.ts",import.meta.url),"utf8");
 assert.doesNotMatch(source,/wheel-angle|wheel-scale|rotateX/);
 assert.match(source,/requestAnimationFrame/);
 assert.doesNotMatch(source,/location.assign|\.click\(/);
});
test("wheel haptics follow item changes during user scrolling, not initial layout",async()=>{
 const source=await readFile(new URL("../lib/useReadingWheel.ts",import.meta.url),"utf8");
 assert.match(source,/scrolled&&centered&&nearest!==centered&&now<userScrollUntil/);
 assert.match(source,/now-lastPulse>=45/);
 assert.match(source,/haptic\("selection"\)/);
 const bridge=await readFile(new URL("../lib/haptics.ts",import.meta.url),"utf8");
 assert.match(bridge,/NurAndroid\?\.performHaptic/);
 assert.match(bridge,/navigator.vibrate/);
});
