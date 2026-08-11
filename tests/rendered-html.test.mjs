import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(html, /Nūr a été imaginé et créé par Anas Youbi, 14 ans/i);
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
