import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

async function bundled(file) {
  const result = await build({ absWorkingDir: fileURLToPath(new URL("../", import.meta.url)), entryPoints: [file.slice(3)], tsconfigRaw: {}, bundle: true, write: false, platform: "node", format: "esm", target: "node24" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { accountApi, cleanupAccounts, hasAppAccess } = await bundled("../worker/accountApi.ts");
const { verificationEmail, verificationMime } = await bundled("../worker/authEmail.ts");
const { accountImportSnapshot, mergeSnapshots, validateSnapshot } = await bundled("../lib/accountState.ts");
const schema = await readFile(new URL("../migrations/0001_accounts.sql", import.meta.url), "utf8");
const secret = "test-only-secret-at-least-thirty-two-characters";
const b64 = value => Buffer.from(value).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);
async function hash(value) { return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
async function hmac(value) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))); }
async function emailChallenge(id, mode = "signup", exp = now() + 600) {
  const payload = b64(JSON.stringify({ purpose: "email", id, mode, exp }));
  return `${payload}.${await hmac(payload)}`;
}
function mimePart(message, type) {
  const part = message.match(new RegExp(`Content-Type: ${type}; charset=UTF-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`));
  assert.ok(part, `${type} MIME part is present`);
  return Buffer.from(part[1], "base64").toString("utf8");
}
async function passwordHash(value) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return `pbkdf2$100000$${b64(salt)}$${b64(derived)}`;
}
function fixture(overrides = {}) {
  const db = new DatabaseSync(":memory:"); db.exec(schema);
  const prepare = (sql, values = []) => ({
    bind: (...next) => prepare(sql, next),
    first: async column => { const row = db.prepare(sql).get(...values); return row ? column ? row[column] : row : null; },
    all: async () => ({ results: db.prepare(sql).all(...values) }),
    run: async () => ({ meta: db.prepare(sql).run(...values) }),
  });
  const env = { DB: { prepare, batch: async statements => { db.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec("COMMIT"); return results; } catch (error) { db.exec("ROLLBACK"); throw error; } } }, AUTH_SECRET: secret, ...overrides };
  const call = (path, input, headers = {}) => accountApi(new Request(`https://nur.example${path}`, { method: input === undefined ? "GET" : "POST", headers: { origin: "https://nur.example", "content-type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) }), env, { waitUntil() {} });
  return { db, env, call };
}
async function session(f, id = "user-one") {
  const token = crypto.randomUUID();
  f.db.prepare("INSERT INTO nur_users(id,email,created_at) VALUES(?,?,?)").run(id, `${id}@example.com`, now());
  f.db.prepare("INSERT INTO nur_user_state(user_id,updated_at) VALUES(?,?)").run(id, now());
  f.db.prepare("INSERT INTO nur_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(await hash(token), id, now() + 3600);
  return { cookie: `__Host-nur-session=${token}` };
}

test("authentication and administration stay closed without configuration; requests enforce origin", async () => {
  const f = fixture();
  const unconfigured = await accountApi(new Request("https://nur.example/api/auth/session"), {}, { waitUntil() {} });
  assert.deepEqual(await unconfigured.json(), { user: null, guest: false, capabilities: { google: false, email: false, sync: false } });
  assert.equal((await f.call("/api/admin/challenge")).status, 503);
  assert.equal((await f.call("/api/auth/logout", {}, { origin: "https://other.example" })).status, 403);
  assert.equal((await f.call("/api/account/state")).status, 401);
  assert.equal((await f.call("/api/auth/google/callback")).status, 303);
});

test("app entry requires a real session or a signed guest choice, never a forged flag", async () => {
  const f = fixture({ ADMIN_USERNAME: "test-admin", ADMIN_PASSWORD_HASH: "test", ADMIN_PIN_HASH: "test", ADMIN_ANSWER_1_HASH: "test", ADMIN_ANSWER_2_HASH: "test", ADMIN_ANSWER_3_HASH: "test" });
  const request = cookie => new Request("https://nur.example/read", { headers: { cookie } });
  assert.equal(await hasAppAccess(request(""), f.env), false);
  assert.equal(await hasAppAccess(request("nur-guest=1; __Host-nur-guest=1"), f.env), false);
  assert.equal((await f.call("/api/auth/guest", { completed: true }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await f.call("/api/auth/guest", { completed: false })).status, 400);
  const guest = await f.call("/api/auth/guest", { completed: true });
  const cookie = guest.headers.get("set-cookie").split(";")[0];
  assert.match(guest.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(await hasAppAccess(request(cookie), f.env), true);
  assert.equal(await hasAppAccess(request(cookie + "tampered"), f.env), false);
  const payload = b64(JSON.stringify({ purpose: "guest-entry", exp: now() - 1 }));
  assert.equal(await hasAppAccess(request(`__Host-nur-guest=${payload}.${await hmac(payload)}`), f.env), false);
  assert.equal((await f.call("/api/account/state", undefined, { cookie })).status, 401);
  assert.equal((await f.call("/api/admin/stats", undefined, { cookie })).status, 401);
  const account = await session(f);
  assert.equal(await hasAppAccess(request(account.cookie), f.env), true);
  const cleared = await f.call("/api/auth/clear-device", {}, account);
  assert.equal(cleared.status, 200);
  for (const name of ["session", "admin", "oauth", "guest"]) assert.match(cleared.headers.get("set-cookie"), new RegExp(`__Host-nur-${name}=;`));
  assert.equal(await hasAppAccess(request(account.cookie), f.env), false);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_user_state").get().total, 1);
});

test("the deployed worker checks direct pages and Fqih requests before rendering or calling AI", async () => {
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url));
  const f = fixture(), context = { waitUntil() {}, passThroughOnException() {} };
  const env = { ...f.env, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const request = (path, cookie = "", post = false, origin = "https://nur.example") => new Request(`https://nur.example${path}`, { method: post ? "POST" : "GET", headers: { cookie, origin, "content-type": "application/json", accept: "text/html" }, ...(post ? { body: "{}" } : {}) });
  for (const path of ["/read?surah=2", "/assistant", "/read.rsc?surah=2", "/assistant.rsc", "/home.rsc", "/favorites.rsc"]) {
    assert.equal((await worker.fetch(request(path), env, context)).status, 303);
    assert.equal((await worker.fetch(request(path, "nur-guest=1"), env, context)).status, 303);
  }
  assert.equal((await worker.fetch(request("/api/ai-fiqh", "", true), env, context)).status, 401);
  const guest = await f.call("/api/auth/guest", { completed: true });
  const cookie = guest.headers.get("set-cookie").split(";")[0];
  assert.equal((await worker.fetch(request("/read?surah=2", cookie), env, context)).status, 200);
  assert.equal((await worker.fetch(request("/assistant", cookie), env, context)).status, 200);
  assert.equal((await worker.fetch(request("/api/ai-fiqh", cookie, true, "https://evil.example"), env, context)).status, 403);
});

test("email codes are hashed, expire, allow at most five guesses and can be consumed only once", async () => {
  const f = fixture();
  const add = async (id, expiration = now() + 600) => {
    f.db.prepare("INSERT INTO nur_email_codes(id,email,code_hash,expires_at) VALUES(?,?,?,?)").run(id, "person@example.com", await hmac(`${id}:signup:123456`), expiration);
    return emailChallenge(id);
  };
  const guessed = await add("a".repeat(64));
  for (let i = 0; i < 5; i++) assert.equal((await f.call("/api/auth/email/verify", { challenge: guessed, code: "000000" })).status, 400);
  assert.equal((await f.call("/api/auth/email/verify", { challenge: guessed, code: "123456" })).status, 400);
  const expired = await add("b".repeat(64), now() - 1);
  assert.equal((await f.call("/api/auth/email/verify", { challenge: expired, code: "123456" })).status, 400);
  const valid = await add("c".repeat(64));
  const results = await Promise.all([f.call("/api/auth/email/verify", { challenge: valid, code: "123456" }), f.call("/api/auth/email/verify", { challenge: valid, code: "123456" })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  const success = results.find(r => r.status === 200);
  assert.match(success.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_email_codes WHERE id=?").get("c".repeat(64)).total, 0);
});

test("Gmail sends a code without exposing it or provider secrets in the API response", async () => {
  const f = fixture({ GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret", GMAIL_REFRESH_TOKEN: "test-refresh", ASSETS: { fetch: async request => new Response(await readFile(new URL(`../public${new URL(request.url).pathname}`, import.meta.url)), { headers: { "content-type": "image/png" } }) } });
  const original = globalThis.fetch; let message = "";
  globalThis.fetch = async url => {
    if (String(url).includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access" });
    if (String(url).includes("gmail.googleapis.com")) return Response.json({ id: "sent" });
    throw new Error("Unexpected external request");
  };
  // Capture only the generated test message, never a real email.
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access" });
    message = Buffer.from(JSON.parse(init.body).raw, "base64url").toString(); return Response.json({ id: "sent" });
  };
  try {
    const response = await f.call("/api/auth/email/request", { email: "test@example.com", language: "ar" });
    assert.equal(response.status, 200);
    const result = await response.json(); assert.deepEqual(Object.keys(result).sort(), ["challenge", "expiresIn"]);
    const text = mimePart(message, "text/plain"); assert.match(text, /رمز التحقّق/);
    const html = mimePart(message, "text/html"); assert.match(html, /lang="ar" dir="rtl"/);
    assert.match(html, /src="cid:logo@nur"/); assert.match(message, /Content-ID: <logo@nur>/);
    const code = text.match(/\d{6}/)[0];
    const flow = JSON.parse(Buffer.from(result.challenge.split(".")[0], "base64url"));
    const row = f.db.prepare("SELECT * FROM nur_email_codes WHERE id=?").get(flow.id);
    assert.notEqual(row.code_hash, code); assert.equal(row.code_hash, await hmac(`${flow.id}:signup:${code}`));
    assert.equal((await f.call("/api/auth/email/request", { email: "bad\r\nTo: attacker@example.com" })).status, 400);
  } finally { globalThis.fetch = original; }
});

test("email requests honor the selected welcome language in all three languages", async () => {
  const original = globalThis.fetch;
  try {
    for (const language of ["fr", "en", "ar"]) {
      const f = fixture({ GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret", GMAIL_REFRESH_TOKEN: "test-refresh" });
      let message = "";
      globalThis.fetch = async (url, init) => {
        if (String(url).includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access" });
        assert.ok(String(url).includes("gmail.googleapis.com"));
        message = Buffer.from(JSON.parse(init.body).raw, "base64url").toString();
        return Response.json({ id: "test-only" });
      };
      assert.equal((await f.call("/api/auth/email/request", { email: "welcome@example.com", language, mode: "signup" })).status, 200);
      const html = mimePart(message, "text/html");
      assert.ok(html.includes(`lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"`));
      f.db.close();
    }
  } finally { globalThis.fetch = original; }
});

test("sync enforces account isolation and rejects a stale revision rather than overwriting data", async () => {
  const f = fixture(), first = await session(f), second = await session(f, "user-two");
  const put = async (input, headers) => accountApi(new Request("https://nur.example/api/account/state", { method: "PUT", headers: { origin: "https://nur.example", "content-type": "application/json", ...headers }, body: JSON.stringify(input) }), f.env, { waitUntil() {} });
  assert.equal((await put({ revision: 0, data: { "nur-favorite-surahs": "[1,2]" } }, first)).status, 200);
  assert.equal((await put({ revision: 0, data: { "nur-favorite-surahs": "[]" } }, first)).status, 409);
  assert.deepEqual((await (await f.call("/api/account/state", undefined, second)).json()).data, {});
  assert.equal((await put({ revision: 1, data: { "nur-favorite-surahs": "[999]" } }, first)).status, 400);
  for(const name of ["connard","fuck","قحبة","Dilmi AOUKLI"])
    assert.equal((await put({ revision: 1, data: { "nur-profile-name": name } }, first)).status, 400);
  assert.equal((await (await f.call("/api/account/state", undefined, first)).json()).revision, 1);
});

test("three-way sync preserves favorite removals, concurrent additions and only new listening time", () => {
  const base = { "nur-favorite-surahs": "[1,2]", "nur-progress": '{"minutes":10,"goal":10}' };
  const local = { "nur-favorite-surahs": "[2,3]", "nur-progress": '{"minutes":12,"goal":10}' };
  const remote = { "nur-favorite-surahs": "[1,2,4]", "nur-progress": '{"minutes":15,"goal":20}' };
  const merged = mergeSnapshots(base, local, remote);
  assert.deepEqual(JSON.parse(merged["nur-favorite-surahs"]), [2, 3, 4]);
  assert.equal(JSON.parse(merged["nur-progress"]).minutes, 17);
  assert.equal(JSON.parse(merged["nur-progress"]).goal, 20);
  const guest = mergeSnapshots({}, local, remote, true);
  assert.equal(JSON.parse(guest["nur-progress"]).minutes, 15);
  assert.equal(JSON.parse(guest["nur-progress"]).goal, 20);
  assert.deepEqual(JSON.parse(mergeSnapshots({}, { "nur-settings": '{"riwayah":"hafs","showFrench":true}' }, { "nur-settings": '{"riwayah":"warsh","showFrench":false}' }, true)["nur-settings"]), { riwayah: "warsh", showFrench: false });
  assert.equal(validateSnapshot({ "nur-progress": '{"minutes":-1,"goal":10}' }), null);
  assert.equal(validateSnapshot({ "nur-profile-name": "<script>" }), null);
});

test("guest imports do not skip a new account's setup or replace a returning account's name and preferences", () => {
  const guest = { "nur-onboarding-complete": "1", "nur-profile-name": "Guest name", "nur-language": "fr", "nur-theme": "light", "nur-reduced-motion": "0", "nur-settings": '{"riwayah":"hafs","reciter":"ar.alafasy","showFrench":true}', "nur-favorite-surahs": "[2]" };
  const imported = accountImportSnapshot(guest);
  const fresh = mergeSnapshots({}, imported, {}, true);
  assert.equal(fresh["nur-onboarding-complete"], undefined);
  assert.equal(fresh["nur-profile-name"], undefined);
  assert.equal(guest["nur-profile-name"], "Guest name", "the original snapshot is not mutated");
  const saved = { "nur-onboarding-complete": "1", "nur-profile-name": "Amine", "nur-language": "ar", "nur-theme": "dark", "nur-reduced-motion": "1", "nur-settings": '{"riwayah":"warsh","reciter":"omar-qazabri","showFrench":false}', "nur-favorite-surahs": "[1]" };
  const returning = mergeSnapshots({}, imported, saved, true);
  for (const key of ["nur-onboarding-complete", "nur-profile-name", "nur-language", "nur-theme", "nur-reduced-motion", "nur-settings"]) assert.equal(returning[key], saved[key]);
  assert.deepEqual(JSON.parse(returning["nur-favorite-surahs"]), [1, 2]);
});

test("email sign-in restores the existing account without resetting its name or tutorial", async () => {
  const f = fixture();
  await session(f);
  const saved = { "nur-profile-name": "Amine", "nur-onboarding-complete": "1", "nur-language": "en", "nur-theme": "light", "nur-settings": '{"riwayah":"warsh","reciter":"omar-qazabri","fontSize":44}' };
  f.db.prepare("UPDATE nur_users SET name=? WHERE id=?").run("Amine", "user-one");
  f.db.prepare("UPDATE nur_user_state SET data=?,revision=3 WHERE user_id=?").run(JSON.stringify(saved), "user-one");
  const id = "d".repeat(64);
  f.db.prepare("INSERT INTO nur_email_codes(id,email,code_hash,expires_at) VALUES(?,?,?,?)").run(id, "user-one@example.com", await hmac(`${id}:login:123456`), now() + 600);
  const verified = await f.call("/api/auth/email/verify", { challenge: await emailChallenge(id, "login"), code: "123456" });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).user.name, "Amine");
  const cookie = verified.headers.get("set-cookie").split(";")[0];
  assert.deepEqual((await (await f.call("/api/account/state", undefined, { cookie })).json()).data, saved);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 1);
});

test("Google callback verifies JWT signature, audience, state and nonce before creating a session", async () => {
  const f = fixture({ GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret" });
  const { privateKey, publicKey } = await generateKeyPair("RS256"), jwk = await exportJWK(publicKey);
  jwk.kid = "test-key"; jwk.alg = "RS256"; jwk.use = "sig";
  const start = await f.call("/api/auth/google/start"), url = new URL(start.headers.get("location"));
  const flowCookie = start.headers.get("set-cookie").split(";")[0];
  const makeToken = async (nonce, email = "google@example.com", sub = "test-google-sub") => new SignJWT({ email, email_verified: true, given_name: "Test", nonce }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer("https://accounts.google.com").setAudience("test-google-client").setSubject(sub).setIssuedAt().setExpirationTime("5m").sign(privateKey);
  let idToken = await makeToken("wrong-nonce");
  const original = globalThis.fetch;
  let refreshToken, scope;
  globalThis.fetch = async target => String(target).includes("/certs") ? Response.json({ keys: [jwk] }) : Response.json({ id_token: idToken, refresh_token: refreshToken, scope });
  try {
    const path = `/api/auth/google/callback?code=test-code&state=${url.searchParams.get("state")}`;
    assert.equal((await f.call(path, undefined, { cookie: flowCookie })).headers.get("location"), "/welcome?auth=failed");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 0);
    idToken = await makeToken(url.searchParams.get("nonce"));
    const result = await f.call(path, undefined, { cookie: flowCookie });
    assert.equal(result.headers.get("location"), "/welcome?auth=success");
    assert.match(result.headers.get("set-cookie"), /__Host-nur-session=/);
    const returningState = { "nur-profile-name": "Amine", "nur-onboarding-complete": "1", "nur-language": "ar", "nur-theme": "dark" };
    f.db.prepare("UPDATE nur_users SET name='Amine' WHERE email='google@example.com'").run();
    f.db.prepare("UPDATE nur_user_state SET data=?").run(JSON.stringify(returningState));
    const loginStart = await f.call("/api/auth/google/start?mode=login"), loginUrl = new URL(loginStart.headers.get("location"));
    assert.equal(loginUrl.searchParams.get("scope"), "openid email profile", "visitors never authorize Gmail");
    const loginCookie = loginStart.headers.get("set-cookie").split(";")[0];
    const loginPath = `/api/auth/google/callback?code=test-code&state=${loginUrl.searchParams.get("state")}`;
    idToken = await makeToken("wrong-nonce");
    assert.equal((await f.call(loginPath, undefined, { cookie: loginCookie })).headers.get("location"), "/welcome?login=1&auth=failed");
    idToken = await makeToken(loginUrl.searchParams.get("nonce"));
    const returning = await f.call(loginPath, undefined, { cookie: loginCookie });
    assert.equal(returning.headers.get("location"), "/welcome?login=1&auth=success");
    const returningCookie = returning.headers.get("set-cookie").match(/__Host-nur-session=[^; ,]+/)[0];
    assert.deepEqual((await (await f.call("/api/account/state", undefined, { cookie: returningCookie })).json()).data, returningState);
    assert.equal((await (await f.call("/api/auth/session", undefined, { cookie: returningCookie })).json()).user.name, "Amine");
    const count = f.db.prepare("SELECT COUNT(*) AS total FROM nur_sessions").get().total;
    const signupStart = await f.call("/api/auth/google/start?mode=signup"), signupUrl = new URL(signupStart.headers.get("location"));
    const signupCookie = signupStart.headers.get("set-cookie").split(";")[0];
    idToken = await makeToken(signupUrl.searchParams.get("nonce"));
    const duplicate = await f.call(`/api/auth/google/callback?code=test-code&state=${signupUrl.searchParams.get("state")}`, undefined, { cookie: signupCookie });
    assert.equal(duplicate.headers.get("location"), "/welcome?auth=success");
    assert.match(duplicate.headers.get("set-cookie"), /__Host-nur-session=/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_sessions").get().total, count + 1);
    const signupSession = duplicate.headers.get("set-cookie").match(/__Host-nur-session=[^; ,]+/)[0];
    assert.equal((await (await f.call("/api/auth/session", undefined, { cookie: signupSession })).json()).user.name, "Amine");
    assert.deepEqual((await (await f.call("/api/account/state", undefined, { cookie: signupSession })).json()).data, returningState);
    assert.deepEqual(JSON.parse(f.db.prepare("SELECT data FROM nur_user_state").get().data), returningState);
    idToken = await makeToken(signupUrl.searchParams.get("nonce"), "google@example.com", "other-google-sub");
    assert.equal((await f.call(`/api/auth/google/callback?code=test-code&state=${signupUrl.searchParams.get("state")}`, undefined, { cookie: signupCookie })).headers.get("location"), "/welcome?auth=failed", "a different Google identity cannot replace the linked identity");
    assert.equal(f.db.prepare("SELECT google_sub FROM nur_users").get().google_sub, "test-google-sub");
    idToken = await makeToken(loginUrl.searchParams.get("nonce"), "missing@example.com", "missing-google-sub");
    const missing = await f.call(loginPath, undefined, { cookie: loginCookie });
    assert.equal(missing.headers.get("location"), "/welcome?login=1&auth=account_missing");
    assert.doesNotMatch(missing.headers.get("set-cookie"), /__Host-nur-session=/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 1);
    await session(f, "email-only");
    f.db.prepare("UPDATE nur_users SET name='Yasmine' WHERE id='email-only'").run();
    f.db.prepare("UPDATE nur_user_state SET data=? WHERE user_id='email-only'").run(JSON.stringify(returningState));
    const emailGoogleStart = await f.call("/api/auth/google/start?mode=signup"), emailGoogleUrl = new URL(emailGoogleStart.headers.get("location"));
    idToken = await makeToken(emailGoogleUrl.searchParams.get("nonce"), "email-only@example.com", "email-google-sub");
    const linked = await f.call(`/api/auth/google/callback?code=test-code&state=${emailGoogleUrl.searchParams.get("state")}`, undefined, { cookie: emailGoogleStart.headers.get("set-cookie").split(";")[0] });
    assert.equal(linked.headers.get("location"), "/welcome?auth=success");
    const linkedCookie = linked.headers.get("set-cookie").match(/__Host-nur-session=[^; ,]+/)[0];
    assert.equal((await (await f.call("/api/auth/session", undefined, { cookie: linkedCookie })).json()).user.name, "Yasmine");
    assert.deepEqual((await (await f.call("/api/account/state", undefined, { cookie: linkedCookie })).json()).data, returningState);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 2);
    Object.assign(f.env, { ADMIN_USERNAME: "test-owner", ADMIN_PASSWORD_HASH: "test-password-hash", ADMIN_PIN_HASH: "test-pin-hash", ADMIN_ANSWER_1_HASH: "test-answer", ADMIN_ANSWER_2_HASH: "test-answer", ADMIN_ANSWER_3_HASH: "test-answer", GMAIL_SENDER: "support@example.com" });
    const adminToken = "test-admin-token", cookie = `__Host-nur-admin=${adminToken}`;
    f.db.prepare("INSERT INTO nur_admin_sessions VALUES(?,?)").run(await hmac(`${adminToken}:${f.env.ADMIN_PASSWORD_HASH}:${f.env.ADMIN_PIN_HASH}`), now() + 3600);
    const gmailStart = await f.call("/api/admin/gmail/connect", undefined, { cookie });
    const gmailUrl = new URL(gmailStart.headers.get("location")), gmailFlow = gmailStart.headers.get("set-cookie").split(";")[0];
    const gmailPath = `/api/auth/google/callback?code=test-gmail-code&state=${gmailUrl.searchParams.get("state")}`;
    const gmailHeaders = { cookie: `${cookie}; ${gmailFlow}` };
    refreshToken = "test-only-refresh-token"; scope = "openid email https://www.googleapis.com/auth/gmail.send";
    idToken = await makeToken(gmailUrl.searchParams.get("nonce"));
    assert.equal((await f.call(gmailPath, undefined, gmailHeaders)).headers.get("location"), "/admin?gmail=failed", "a different Gmail account is rejected");
    idToken = await makeToken(gmailUrl.searchParams.get("nonce"), "support@example.com");
    scope = "openid email";
    assert.equal((await f.call(gmailPath, undefined, gmailHeaders)).headers.get("location"), "/admin?gmail=failed", "missing send permission is rejected");
    scope += " https://www.googleapis.com/auth/gmail.send";
    assert.equal((await f.call(gmailPath, undefined, gmailHeaders)).headers.get("location"), "/admin?gmail=connected");
    const encrypted = f.db.prepare("SELECT encrypted_value FROM nur_service_credentials").get().encrypted_value;
    assert.equal(encrypted.includes(refreshToken), false);
    const stats = await (await f.call("/api/admin/stats", undefined, { cookie })).json();
    assert.equal(stats.gmailConnected, true); assert.equal(JSON.stringify(stats).includes(refreshToken), false);
  } finally { globalThis.fetch = original; }
});

test("email registration checks existing addresses before sending and still verifies intent and concurrent registrations", async () => {
  const f = fixture({ GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret", GMAIL_REFRESH_TOKEN: "test-refresh" });
  await session(f);
  f.db.prepare("UPDATE nur_users SET name='Amine' WHERE id='user-one'").run();
  const initial = f.db.prepare("SELECT COUNT(*) AS total FROM nur_sessions").get().total;
  const original = globalThis.fetch; let message;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access" });
    message = Buffer.from(JSON.parse(init.body).raw, "base64url").toString(); return Response.json({ id: "sent" });
  };
  try {
    const existing = await f.call("/api/auth/email/request", { email: "USER-ONE@example.com", mode: "signup", language: "fr" });
    assert.equal(existing.status, 409); assert.deepEqual(await existing.json(), { error: "account_exists" });
    assert.equal(message, undefined, "no provider call or email for an existing account");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_email_codes").get().total, 0);
    assert.equal(existing.headers.get("set-cookie"), null, "the existence check never authenticates");
    const response = await f.call("/api/auth/email/request", { email: "new@example.com", mode: "signup", language: "fr" });
    assert.equal(response.status, 200);
    const { challenge } = await response.json(), code = mimePart(message, "text/plain").match(/\d{6}/)[0];
    const flow = JSON.parse(Buffer.from(challenge.split(".")[0], "base64url"));
    // Another tab can register the address while the first code is in the inbox.
    f.db.prepare("INSERT INTO nur_users(id,email,name,created_at) VALUES('concurrent','new@example.com','Yasmine',?)").run(now());
    const altered = b64(JSON.stringify({ ...flow, mode: "login" })) + "." + challenge.split(".")[1];
    assert.equal((await f.call("/api/auth/email/verify", { challenge: altered, code })).status, 400);
    assert.equal((await f.call("/api/auth/email/verify", { challenge: flow.id, code })).status, 400);
    // Even a separately signed login proof cannot reuse a signup code's stored hash.
    assert.equal((await f.call("/api/auth/email/verify", { challenge: await emailChallenge(flow.id, "login"), code })).status, 400);
    const rejected = await f.call("/api/auth/email/verify", { challenge, code, mode: "login" });
    assert.equal(rejected.status, 409); assert.deepEqual(await rejected.json(), { error: "account_exists" });
    assert.equal(rejected.headers.get("set-cookie"), null);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_sessions").get().total, initial);
    assert.equal(f.db.prepare("SELECT name FROM nur_users WHERE id='user-one'").get().name, "Amine");
    assert.equal(f.db.prepare("SELECT name FROM nur_users WHERE id='concurrent'").get().name, "Yasmine");
    assert.equal((await f.call("/api/auth/email/verify", { challenge, code })).status, 400, "the rejected signup code is consumed too");
  } finally { globalThis.fetch = original; }
});

test("early signup email checks stay rate-limited even when no email is sent", async () => {
  const f = fixture(); await session(f);
  for (let attempt = 0; attempt < 3; attempt++) assert.equal((await f.call("/api/auth/email/request", { email: "user-one@example.com", mode: "signup" })).status, 409);
  assert.equal((await f.call("/api/auth/email/request", { email: "user-one@example.com", mode: "signup" })).status, 429);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_email_codes").get().total, 0);
});

test("login does not create a new account and duplicate registration cannot create a second session", async () => {
  const f = fixture();
  async function attempt(id, mode, email) {
    f.db.prepare("INSERT INTO nur_email_codes(id,email,code_hash,expires_at) VALUES(?,?,?,?)").run(id, email, await hmac(`${id}:${mode}:123456`), now() + 600);
    return f.call("/api/auth/email/verify", { challenge: await emailChallenge(id, mode), code: "123456" });
  }
  const absent = await attempt("1".repeat(64), "login", "new@example.com");
  assert.equal(absent.status, 409); assert.deepEqual(await absent.json(), { error: "account_missing" });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 0);
  assert.equal((await attempt("2".repeat(64), "signup", "new@example.com")).status, 200);
  assert.equal((await attempt("3".repeat(64), "signup", "new@example.com")).status, 409);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_users").get().total, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_sessions").get().total, 1);
});

test("verification mail is branded, translated, accessible and includes inline PNGs with a plain-text alternative", async () => {
  const images = await Promise.all([["logo", "nur-192.png"], ["reading", "ui/play.png"], ["favorites", "ui/heart.png"]].map(async ([id, path]) => ({ id, data: new Uint8Array(await readFile(new URL(`../public/icons/${path}`, import.meta.url))) })));
  for (const language of ["fr", "en", "ar"]) {
    const mail = verificationEmail("012345", language, "https://nur.example", images);
    assert.match(mail.html, new RegExp(`lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"`));
    assert.match(mail.html, /src="cid:logo@nur"/); assert.match(mail.html, /dir="ltr"[^>]*>012345/);
    assert.doesNotMatch(mail.html, /<script|<svg|<iframe/);
    const mime = verificationMime("sender@example.com", "person@example.com", "012345", language, "https://nur.example", images);
    assert.match(mime, /Subject: =\?UTF-8\?B\?/);
    assert.match(mime, /Content-ID: <logo@nur>/);
    assert.equal(mimePart(mime, "text/plain"), mail.text);
    assert.equal(mimePart(mime, "text/html"), mail.html);
  }
  assert.throws(() => verificationMime("sender@example.com\r\nBcc:bad@example.com", "person@example.com", "123456", "fr", "https://nur.example"));
  assert.throws(() => verificationEmail("<script>", "fr", "https://nur.example"));
});

test("analytics deduplicate events, use server country and remove records older than one year", async () => {
  const f = fixture(), data = { page: "/read", surah: 2, visitor: crypto.randomUUID(), eventId: crypto.randomUUID() };
  const request = new Request("https://nur.example/api/analytics/event", { method: "POST", headers: { origin: "https://nur.example", "content-type": "application/json" }, body: JSON.stringify(data) });
  Object.defineProperty(request, "cf", { value: { country: "MA" } });
  assert.equal((await accountApi(request, f.env, { waitUntil() {} })).status, 200);
  await f.call("/api/analytics/event", data);
  const rows = f.db.prepare("SELECT * FROM nur_analytics").all(); assert.equal(rows.length, 1); assert.equal(rows[0].country, "MA"); assert.notEqual(rows[0].visitor_hash, data.visitor);
  f.db.prepare("INSERT INTO nur_analytics VALUES(?,?,?,?,?,?)").run("old", "2020-01-01", "MA", "/", null, "old-hash");
  await cleanupAccounts(f.env); assert.equal(f.db.prepare("SELECT COUNT(*) AS total FROM nur_analytics").get().total, 1);
});

test("administrator access requires the password, secret code and a valid personal answer", async () => {
  const password = "test-password-only", pin = "test-pin-only", answer = "test answer";
  const f = fixture({ ADMIN_USERNAME: "test-owner", ADMIN_PASSWORD_HASH: await passwordHash(password), ADMIN_PIN_HASH: await passwordHash(pin), ADMIN_ANSWER_1_HASH: await passwordHash(answer), ADMIN_ANSWER_2_HASH: await passwordHash(answer), ADMIN_ANSWER_3_HASH: await passwordHash(answer) });
  assert.equal((await f.call("/api/admin/stats")).status, 401);
  const { challenge } = await (await f.call("/api/admin/challenge")).json();
  assert.equal((await f.call("/api/admin/login", { username: "test-owner", password, pin, answer: "wrong", challenge })).status, 401);
  const response = await f.call("/api/admin/login", { username: "test-owner", password, pin, answer, challenge });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await f.call("/api/admin/stats", undefined, { cookie })).status, 200);
  assert.equal((await f.call("/api/account/state", undefined, { cookie })).status, 401);
  f.env.ADMIN_PASSWORD_HASH = await passwordHash("a different password");
  assert.equal((await f.call("/api/admin/stats", undefined, { cookie })).status, 401, "changing the admin password revokes old sessions");
});
