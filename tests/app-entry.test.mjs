import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { clientEntryAllowed, protectedPage, safeEntryDestination } from "../lib/appEntry.ts";

test("reading and Fqih require account setup or an explicitly completed guest setup", () => {
  for (const path of ["/read", "/read/", "/assistant", "/home", "/favorites", "/read.rsc", "/assistant.rsc", "/home.rsc", "/favorites.rsc"]) assert.equal(protectedPage(path), true);
  for (const path of ["/", "/welcome", "/admin", "/read-anything"]) assert.equal(protectedPage(path), false);
  assert.equal(clientEntryAllowed(false, null, null), false);
  assert.equal(clientEntryAllowed(false, null, "1"), false);
  assert.equal(clientEntryAllowed(false, "1", null), false);
  assert.equal(clientEntryAllowed(true, null, null), false);
  assert.equal(clientEntryAllowed(true, "1", null), true);
  assert.equal(clientEntryAllowed(false, "1", "1"), true);
});

test("login return destinations preserve a surah but cannot redirect off-site", () => {
  assert.equal(safeEntryDestination("/read?surah=2#verse-7"), "/read?surah=2#verse-7");
  assert.equal(safeEntryDestination("/assistant?surah=1"), "/assistant?surah=1");
  assert.equal(safeEntryDestination("/read.rsc?surah=2"), "/read?surah=2");
  for (const path of [null, "//evil.example", "/\\evil.example", "https://evil.example", "/admin", "/welcome", "javascript:alert(1)"]) assert.equal(safeEntryDestination(path), "/home");
});

test("landing settings and welcome motion remain scoped and respect reduced motion", async () => {
  const [settings, intro, onboarding, css, sw, gate] = await Promise.all([
    "components/LandingSettings.tsx", "components/FirstVisitLanguage.tsx", "components/WelcomeOnboarding.tsx",
    "app/globals.css", "public/sw.js", "components/EntryGate.tsx",
  ].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(settings, /<ResetNur deviceOnly\/>/);
  assert.match(settings, /localStorage\.setItem\("nur-reduced-motion", next \? "1" : "0"\)/);
  assert.match(settings, /document\.documentElement\.setAttribute\("data-motion", next \? "reduced" : "full"\)/);
  assert.match(settings, /checked=\{reducedMotion\}/);
  assert.doesNotMatch(settings, /<AccountPanel|<BackupControls/);
  assert.match(intro, /if \(motionReduced\(\)\) \{ finish\(\); return; \}/);
  assert.match(onboarding, /if \(motionReduced\(\)\) \{ setStep\(next\); return; \}/);
  assert.match(css, /\.topbar\.landing-header \.landing-settings-trigger\{[^}]*width:48px!important;height:42px!important/);
  assert.match(css, /@keyframes welcome-card-out/);
  assert.match(sw, /response.ok && !response.redirected/);
  assert.doesNotMatch(sw.match(/const OFFLINE_SHELL = \[[^\]]*/)[0], /"\/read"|"\/assistant"|"\/home"/);
  assert.match(gate, /allowed && ready && \(user \|\| guestAuthorized\) \? children/);
  assert.doesNotMatch(gate, /role="status"|>\{t\("loading"\)\}</);
  assert.match(onboarding, /className="onboarding-auth-modes" role="group"/);
  assert.match(onboarding, /onClick=\{\(\) => chooseAuthMode\("login"\)\}/);
  assert.match(onboarding, /onClick=\{\(\) => chooseAuthMode\("signup"\)\}/);
  assert.match(onboarding, /<SignInStep key=\{mode\} mode=\{mode\} onBusyChange=\{setAuthBusy\}/);
  assert.match(onboarding, /history\.replaceState\(history\.state/);
  assert.match(onboarding, /guestAuthorized && !explicitAuth && localStorage\.getItem\("nur-onboarding-complete"\)/);
  assert.match(onboarding, /if \(!\(await accountRequest\("\/api\/auth\/session"\)\)\.guest\) throw new Error\("cookies_disabled"\)/);
});

test("tab navigation retains the session and outgoing page without full-document loading flashes", async () => {
  const runtime = await readFile(new URL("../components/AppRuntime.tsx", import.meta.url), "utf8");
  assert.match(runtime, /router\.push\(destination\.pathname\+destination\.search\+destination\.hash\)/);
  assert.doesNotMatch(runtime, /location\.assign\(destination/);
  assert.match(runtime, /\[pathname,router\]/);
  assert.match(runtime, /if\(navigating===destination\.href\)return/);
  assert.match(runtime, /destination\.pathname==="\/welcome"\|\|pathname==="\/welcome"/);
  assert.match(runtime, /const route=routeOrder\[pathname\]/);
});

test("faster transitions preserve their direction and keep the fixed composer outside animated content", async () => {
  const [css, assistant] = await Promise.all(["app/globals.css", "app/assistant/page.tsx"].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(css, /body\.nur-route-forward main>section\{animation:nur-page-from-right \.56s/);
  assert.match(css, /body\.nur-route-back main>section\{animation:nur-page-from-left \.56s/);
  assert.match(css, /transform \.48s cubic-bezier/);
  assert.match(assistant, /<\/section>\s*<form ref=\{composer\}/);
  assert.match(css, /\.assistant-shell:not\(\.conversation-started\) \.chat-stream\{flex:1;min-height:0!important/);
  assert.match(css, /\.chat-composer textarea\{min-width:0;font-size:16px\}/);
});

test("active reader tabs do not reload and reselect according to the responsive layout", async () => {
  const [runtime, reader, motion, header, css] = await Promise.all([
    "components/AppRuntime.tsx", "app/read/page.tsx", "lib/routeMotion.ts", "components/SiteHeader.tsx", "app/globals.css",
  ].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(runtime, /anchor\.matches\("\.topbar nav a\.active"\)/);
  assert.match(runtime, /dispatchEvent\(new Event\("nur-reader-reselect"\)\)/);
  assert.match(reader, /if\(portraitReaderLayout\(\)\)showLibrary\(false\)/);
  assert.match(reader, /querySelector\("\.chapter-head"\)\?\.scrollIntoView/);
  assert.match(reader, /onClick=\{\(\)=>showLibrary\(\)\}/);
  assert.match(motion, /frame\.inert = true/);
  assert.match(motion, /frame\.hidden = true/);
  assert.match(motion, /if \(motionReduced\(\)\) return null/);
  assert.match(header, /!portraitReaderLayout\(\) \|\| !readingSurah/);
  assert.match(header, /lastScroll\.current \+ 12/);
  assert.match(css, /\.nur-route-snapshot\.playing\.exit-left\{animation:nur-page-to-left \.22s/);
  assert.doesNotMatch(css, /nur-page-wait-left/);
  assert.match(css, /\.topbar:not\(\.landing-header\)\.mobile-hidden\{opacity:1!important/);
});
