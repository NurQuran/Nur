import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { languageWelcomeKey, needsLanguageWelcome } from "../lib/firstVisit.ts";

test("first language welcome never replaces returning account or guest preferences", () => {
  assert.equal(needsLanguageWelcome(false, null, null), true);
  assert.equal(needsLanguageWelcome(false, null, "1"), false);
  assert.equal(needsLanguageWelcome(false, "1", null), false);
  assert.equal(needsLanguageWelcome(true, null, null), false);
  assert.equal(needsLanguageWelcome(true, "1", "1"), false);
  assert.notEqual(languageWelcomeKey, "nur-onboarding-complete");
});

test("first language choice precedes authentication and flows to the email request", async () => {
  const [welcome, introduction, signIn, reset] = await Promise.all([
    "components/WelcomeOnboarding.tsx", "components/FirstVisitLanguage.tsx",
    "components/SignInStep.tsx", "components/ResetNur.tsx",
  ].map(path => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(welcome, /needsLanguageWelcome\([\s\S]*?\)\) return;/);
  assert.match(welcome, /addEventListener\(languageWelcomeEvent, completed\)/);
  assert.match(introduction, /setLanguage\(language\)/);
  assert.match(introduction, /localStorage.setItem\(languageWelcomeKey, "1"\)/);
  assert.match(introduction, /chosen.current \|\| localStorage.getItem\("nur-language"\)/);
  assert.doesNotMatch(introduction, /setItem\("nur-onboarding-complete"/);
  assert.match(signIn, /JSON.stringify\(\{ email, language, mode \}\)/);
  assert.match(reset, /key.startsWith\("nur-"\)/);
  for (const title of ["Bienvenue dans Nūr", "Welcome to Nūr", "مرحبًا بك في نُور"]) assert.ok(introduction.includes(title));
});

test("the auth close button returns to the public landing without erasing data", async () => {
  const source = await readFile(new URL("../components/WelcomeOnboarding.tsx", import.meta.url), "utf8");
  assert.match(source, /step === AUTH && <a href="\/" className="onboarding-close"/);
  assert.match(source, /event.key === "Escape" && step === AUTH/);
  assert.match(source, /Back to the home page/);
});
