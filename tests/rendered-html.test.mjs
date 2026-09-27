import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { renderWarshTajweed } from "../lib/quran/warshTajweed.ts";

test("Warsh color spans preserve the exact verse and reject mismatched text", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/warsh-tajweed/001.json", import.meta.url), "utf8"));
  const [text, spans] = data["3"];
  assert.ok(spans.length > 0);
  const html = renderWarshTajweed(text, [text, spans]);
  assert.match(html, /<tajweed class="/);
  assert.equal(html.replace(/<[^>]+>/g, ""), text);
  assert.equal(renderWarshTajweed(`${text}x`, [text, spans]), undefined);
  assert.equal(renderWarshTajweed(text, [text, [[0, text.length + 1, "ghn"]]]), undefined);
  assert.equal(renderWarshTajweed(text, [text, [[0, 1, "untrusted"]]]), undefined);
});

test("localized navigation and reader arrows keep their destination", async () => {
  const [header, reader, assistant, css] = await Promise.all([
    readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/assistant/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(header, /if\(!ready\)return;/);
  assert.match(header, /\[active,language,ready\]/);
  assert.match(reader, /navVerse-1\)[^\n]*language==="ar"\?"→":"←"/);
  assert.match(reader, /navVerse\+1\)[^\n]*language==="ar"\?"←":"→"/);
  assert.match(assistant, /<header className="assistant-hero">/);
  assert.doesNotMatch(assistant, /!messages\.length&&<><header className="assistant-hero">/);
  assert.match(css, /reader-page\.mobile-selecting \.rail-surahs>div>button\{min-height:66px/);
});

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Nūr application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Nūr — Le Coran, éclairé<\/title>/i);
  assert.match(html, /href="\/read"[^>]*>Lire<\/a>/i);
  assert.match(html, /href="\/assistant"[^>]*>Fqih<\/a>/i);
  assert.match(html, /href="\/favorites"[^>]*>Favoris<\/a>/i);
  assert.match(html, /Nūr a été créé par un jeune de 14 ans comme une sadaqa jariya/i);
  assert.match(html, /Fqih · assistant éducatif/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("keeps offline audio Android-only and supports both motion directions", async () => {
  const [settings, reader, runtime, css] = await Promise.all([
    readFile(new URL("../components/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AppRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /audio-download-setting/);
  assert.match(reader, /NurAndroid\?\.downloadAudioPack/);
  assert.match(reader, /nur-native-audio-progress/);
  assert.match(runtime, /nur-android-runtime/);
  assert.match(css, /html\.nur-android-runtime \.audio-download-setting/);
  assert.doesNotMatch(css, /@media\(max-width:700px\)\{\.audio-download-setting\{display:grid/);
  assert.match(css, /nur-page-from-right/);
  assert.match(css, /nur-page-from-left/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("dismisses resume reading before read and Fqih routes", async () => {
  const [resume, runtime, css] = await Promise.all([
    readFile(new URL("../components/ResumeToast.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AppRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(resume, /usePathname/);
  assert.match(resume, /pathname==="\/assistant"/);
  assert.match(resume, /pathname==="\/read"/);
  assert.match(resume, /closing/);
  assert.match(runtime, /nur-route-leave-left/);
  assert.match(runtime, /nur-route-leave-right/);
  assert.match(css, /\.assistant-page~\.resume-toast/);
  assert.match(css, /\.resume-toast\.closing/);
});

test("keeps reader controls consistent across mobile, tablet and desktop", async () => {
  const [reader, settings, onboarding, header, icons, css] = await Promise.all([
    readFile(new URL("../app/read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/WelcomeOnboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/UiIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.ok(reader.indexOf('className="chapter-actions"') < reader.indexOf('className="basmala"'));
  assert.match(reader, /Écouter la sourate en entier/);
  assert.match(reader, /showFrench:true, showEnglish:false/);
  assert.match(reader, /nur-translation-mode/);
  assert.match(settings, /translation-choice/);
  assert.match(onboarding, /showFrench=language==="fr",showEnglish=language==="en"/);
  assert.match(header, /theme-control-icon/);
  assert.match(icons, /name==="pause"/);
  assert.match(css, /\(min-width:901px\) and \(max-width:1280px\)/);
});

test("keeps word study, backups, appearance and reduced-motion preferences", async () => {
  const [reader, settings, onboarding, sw, css, header] = await Promise.all([
    readFile(new URL("../app/read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/WelcomeOnboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(reader, /GlobalVerseSearch|onVerseSelect/);
  assert.match(reader, /WordStudy/);
  assert.match(settings, /BackupControls/);
  assert.match(settings, /ThemePreference/);
  assert.match(settings, /motion-setting/);
  assert.match(onboarding, /reducedMotionHelp/);
  assert.doesNotMatch(sw, /\/data\/quran-data\.js/);
  assert.match(sw, /\/data\/word-data\.js/);
  assert.match(header, /--nav-x/);
  assert.match(css, /data-motion="reduced"/);
});

test("avoids mixed service-worker versions and limits long-surah work", async () => {
  const [reader, api, sw, install] = await Promise.all([
    readFile(new URL("../app/read/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/quran/adapters/alQuranCloud.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../components/PwaInstallButton.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(sw, /self\.skipWaiting\(|self\.clients\.claim\(/);
  assert.doesNotMatch(install, /registration\.update\(/);
  assert.doesNotMatch(reader, /registration\.update\(/);
  assert.match(sw, /event\.request\.mode === "navigate"/);
  assert.match(sw, /new Request\(url\.origin \+ url\.pathname\)/);
  assert.match(reader, /surah\.verses\.slice\(0,visibleCount\)/);
  assert.match(reader, /loadAbort\.current\?\.abort\(\)/);
  assert.match(api, /new Set\(\[arabic/);
  assert.doesNotMatch(reader, /go\(number\+1\);setTimeout\(\(\)=>location\.assign/);
});

test("reduced motion removes animations, transitions and animated scrolling", async () => {
  const [css, motion, runtime, settings] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/motion.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AppRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/SettingsModal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /html\[data-motion="reduced"\]:not\(#nur-motion-override\) \*,/);
  assert.match(css, /animation:none!important;\s*transition:none!important;\s*scroll-behavior:auto!important/);
  assert.match(motion, /return motionReduced\(\) \? "auto" : "smooth"/);
  assert.match(runtime, /if\(motionReduced\(\)\)/);
  assert.match(settings, /if\(motionReduced\(\)\)\{onClose\(\);return\}/);
});

test("service worker caches one reader shell per path without intercepting audio", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const handlers = new Map();
  const entries = new Map();
  const keyOf = request => typeof request === "string" ? request : request.url;
  const caches = {
    open: async () => ({ put: async (request, response) => entries.set(keyOf(request), response) }),
    match: async request => entries.get(keyOf(request)),
    keys: async () => [],
  };
  vm.runInNewContext(source, {
    self: { location: { origin: "https://nur.example" }, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches, fetch: async () => new Response("reader", { status: 200 }),
    Promise, Request, Response, URL,
  });
  async function visit(url, mode = "navigate") {
    const lifecycle = [];
    let response;
    handlers.get("fetch")({
      request: { method: "GET", url, mode, destination: "" },
      respondWith: task => { response = task },
      waitUntil: task => lifecycle.push(task),
    });
    if (!response) return false;
    assert.equal(lifecycle.length, 1);
    await response;
    await Promise.all(lifecycle);
    return true;
  }
  assert.equal(await visit("https://nur.example/read?surah=2"), true);
  assert.equal(await visit("https://nur.example/read?surah=3"), true);
  assert.equal(entries.size, 1);
  assert.ok(entries.has("https://nur.example/read"));
  assert.equal(await visit("https://server9.mp3quran.net/001.mp3", "cors"), false);
});

test("offers timed Warsh reciters and a clean four-tab mobile navigation", async () => {
  const [adapter, header, css] = await Promise.all([
    readFile(new URL("../lib/quran/adapters/alQuranCloud.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const voices = adapter.match(/export const warshReciters=\[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.equal((voices.match(/\{id:/g) ?? []).length, 4);
  assert.equal((voices.match(/timingId:\d+/g) ?? []).length, 4);
  assert.doesNotMatch(voices, /hicham-lharraz|benkirane|abdulbasit-warsh/);
  assert.match(header, /home:0,read:1,assistant:2,favorites:3/);
  assert.match(header, /--nav-x/);
  assert.match(css, /\.topbar nav a\.active::after\{display:none!important;content:none!important\}/);
  assert.match(css, /\.topbar\.mobile-hidden\{translate:none!important;transform:translate3d/);
});

test("hydrates Arabic before Fqih auto-explanations and keeps word study English/Hafs only", async () => {
  const [i18n, layout, assistant, reader, settings, wordStudy, api, header, css] = await Promise.all([
    "lib/i18n.ts", "app/layout.tsx", "app/assistant/page.tsx", "app/read/page.tsx",
    "components/SettingsModal.tsx", "components/WordStudy.tsx", "app/api/ai-fiqh/route.ts",
    "components/SiteHeader.tsx", "app/globals.css",
  ].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(i18n, /return\{language,ready,setLanguage,t\}/);
  assert.match(layout, /document\.documentElement\.dir=language==='ar'\?'rtl':'ltr'/);
  assert.match(assistant, /if\(!ready\)return/);
  assert.match(assistant, /language==="ar"\?"اشرح هذا المقطع/);
  assert.match(assistant, /language==="ar"\?"فقيه":"Fqih"/);
  assert.match(reader, /language!=="en"\|\|!options\.wordStudy\|\|options\.riwayah!=="hafs"/);
  assert.match(reader, /const name=language==="ar"\?surah\.nameArabic:surah\.nameLatin/);
  assert.match(settings, /language==="en"&&value\.riwayah==="hafs"&&<div className="setting-group word-study-setting"/);
  assert.match(wordStudy, /language !== "en"/);
  assert.match(api, /اكتب الإجابة كاملةً باللغة العربية الفصحى/);
  assert.match(header, /href="\/assistant">\{language==="ar"\?"فقيه":"Fqih"\}/);
  assert.match(css.slice(css.indexOf("/* The indicator is measured")), /html\[data-motion="reduced"\] \.topbar nav::before\{transform:translate3d\(var\(--nav-x,0px\),0,0\)!important\}/);
  assert.match(css.slice(css.indexOf("/* The indicator is measured")), /\[dir="rtl"\] \.topbar nav::before\{left:0!important;right:auto!important\}/);
});
