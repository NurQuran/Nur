import { createRemoteJWKSet, jwtVerify } from "jose";
import { validateSnapshot } from "../lib/accountState";
import { allowedProfileName } from "../lib/profileName";
import { verificationMime, type EmailImage } from "./authEmail";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface NurDatabase { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
export interface AccountEnv {
  DB?: NurDatabase;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  AUTH_SECRET?: string;
  APP_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GMAIL_SENDER?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PIN_HASH?: string;
  ADMIN_ANSWER_1_HASH?: string;
  ADMIN_ANSWER_2_HASH?: string;
  ADMIN_ANSWER_3_HASH?: string;
  ANALYTICS_ENABLED?: string;
}
type User = { id: string; email: string; name: string; google_sub?: string };
type AuthMode = "login" | "signup";
type Context = { waitUntil(task: Promise<unknown>): void };
const encoder = new TextEncoder();
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION = "__Host-nur-session", ADMIN = "__Host-nur-admin", OAUTH = "__Host-nur-oauth";
const GUEST = "__Host-nur-guest";
const now = () => Math.floor(Date.now() / 1000);
const random = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
const b64 = (bytes: Uint8Array) => { let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); };
const unb64 = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
const hash = async (value: string) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
function equal(left: string, right: string) { let diff = left.length ^ right.length; for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0); return diff === 0; }
function cookie(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) || ""; }
function setCookie(name: string, value: string, age: number) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
function json(body: unknown, status = 200, extra?: HeadersInit) {
  const headers = new Headers(extra); headers.set("content-type", "application/json; charset=utf-8"); headers.set("cache-control", "no-store"); headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}
function redirect(path: string, cookies: string[] = []) { const headers = new Headers({ location: path, "cache-control": "no-store", "referrer-policy": "no-referrer" }); for (const c of cookies) headers.append("set-cookie", c); return new Response(null, { status: 303, headers }); }
function origin(request: Request, env: AccountEnv) { return env.APP_ORIGIN ? new URL(env.APP_ORIGIN).origin : new URL(request.url).origin; }
function ready(env: AccountEnv) { return !!env.DB && !!env.AUTH_SECRET && env.AUTH_SECRET.length >= 32; }
function adminReady(env: AccountEnv) { return ready(env) && !!env.ADMIN_USERNAME && !!env.ADMIN_PASSWORD_HASH && !!env.ADMIN_PIN_HASH && !!env.ADMIN_ANSWER_1_HASH && !!env.ADMIN_ANSWER_2_HASH && !!env.ADMIN_ANSWER_3_HASH; }
function googleReady(env: AccountEnv) { return ready(env) && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET; }
function gmailClient(env: AccountEnv) { return { id: env.GMAIL_CLIENT_ID || env.GOOGLE_CLIENT_ID, secret: env.GMAIL_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET }; }
async function gmailToken(env: AccountEnv) {
  if (env.GMAIL_REFRESH_TOKEN) return env.GMAIL_REFRESH_TOKEN;
  if (!ready(env)) return "";
  const stored = await env.DB!.prepare("SELECT encrypted_value FROM nur_service_credentials WHERE name='gmail'").first<{ encrypted_value: string }>();
  if (!stored) return "";
  const [iv, ciphertext] = stored.encrypted_value.split(".");
  try {
    const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", encoder.encode(env.AUTH_SECRET)), "AES-GCM", false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ciphertext)));
  } catch { return ""; }
}
async function saveGmailToken(env: AccountEnv, token: string) {
  const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", encoder.encode(env.AUTH_SECRET)), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = b64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(token))));
  await env.DB!.prepare("INSERT INTO nur_service_credentials(name,encrypted_value,updated_at) VALUES('gmail',?,?) ON CONFLICT(name) DO UPDATE SET encrypted_value=excluded.encrypted_value,updated_at=excluded.updated_at").bind(`${b64(iv)}.${encrypted}`, now()).run();
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid_body");
  if (Number(request.headers.get("content-length")) > 25000) throw new Error("invalid_body");
  const text = await request.text(); if (text.length > 25000) throw new Error("invalid_body");
  const parsed = JSON.parse(text); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_body"); return parsed;
}
async function limit(request: Request, env: AccountEnv, scope: string, max: number, seconds: number, identity?: string) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const window = Math.floor(now() / seconds);
  const key = await hmac(env.AUTH_SECRET!, `${scope}:${window}:${identity || ip}`);
  const result = await env.DB!.prepare("INSERT INTO nur_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, (window + 1) * seconds).first<{ count: number }>();
  return !!result && result.count <= max;
}
async function user(request: Request, env: AccountEnv): Promise<User | null> {
  const token = cookie(request, SESSION); if (!ready(env) || !token || token.length > 128) return null;
  return env.DB!.prepare("SELECT u.id,u.email,u.name,u.google_sub FROM nur_sessions s JOIN nur_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await hash(token), now()).first<User>();
}
export async function hasAppAccess(request: Request, env: AccountEnv) {
  if (!ready(env)) return false;
  try {
    if (await user(request, env)) return true;
    const guest = await unsigned(env, cookie(request, GUEST));
    return guest?.purpose === "guest-entry";
  } catch { return false; }
}
async function isAdmin(request: Request, env: AccountEnv) {
  const token = cookie(request, ADMIN); if (!adminReady(env) || !token || token.length > 128) return false;
  return !!await env.DB!.prepare("SELECT token_hash FROM nur_admin_sessions WHERE token_hash=? AND expires_at>?").bind(await adminTokenHash(token, env), now()).first();
}
const adminTokenHash = (token: string, env: AccountEnv) => hmac(env.AUTH_SECRET!, `${token}:${env.ADMIN_PASSWORD_HASH}:${env.ADMIN_PIN_HASH}`);
async function login(email: string, name: string, env: AccountEnv, mode: AuthMode | "continue", sub?: string) {
  // Check intent only after the address or Google identity has been verified.
  let account = sub ? await env.DB!.prepare("SELECT id,email,name,google_sub FROM nur_users WHERE google_sub=?").bind(sub).first<User>() : null;
  account ||= await env.DB!.prepare("SELECT id,email,name,google_sub FROM nur_users WHERE email=?").bind(email).first<User>();
  if (mode === "signup" && account) throw new Error("account_exists");
  if (mode === "login" && !account) throw new Error("account_missing");
  if (!account) {
    const id = random();
    const created = await env.DB!.prepare("INSERT INTO nur_users(id,email,name,google_sub,created_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING").bind(id, email, allowedProfileName(name.slice(0, 60)), sub || null, now()).run();
    if (!created.meta.changes && mode !== "continue") throw new Error("account_exists");
    // Google can safely return to an account created by a concurrent request.
    account = created.meta.changes
      ? await env.DB!.prepare("SELECT id,email,name,google_sub FROM nur_users WHERE id=?").bind(id).first<User>()
      : await env.DB!.prepare("SELECT id,email,name,google_sub FROM nur_users WHERE email=? OR google_sub=?").bind(email, sub || null).first<User>();
  }
  if (!account) throw new Error("account_failed");
  if (sub && account.google_sub && account.google_sub !== sub) throw new Error("account_failed");
  if (sub && !account.google_sub) await env.DB!.prepare("UPDATE nur_users SET google_sub=? WHERE id=? AND google_sub IS NULL").bind(sub, account.id).run();
  await env.DB!.prepare("INSERT OR IGNORE INTO nur_user_state(user_id,revision,data,updated_at) VALUES(?,0,'{}',?)").bind(account.id, now()).run();
  const token = random();
  await env.DB!.prepare("INSERT INTO nur_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hash(token), account.id, now() + 30 * 86400).run();
  return { account: { id: account.id, email: account.email, name: account.name }, session: setCookie(SESSION, token, 30 * 86400) };
}
function emailAddress(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email) ? email : "";
}
async function sendCode(email: string, code: string, language: unknown, env: AccountEnv) {
  const client = gmailClient(env), refresh = await gmailToken(env);
  if (!client.id || !client.secret || !refresh) throw new Error("mail_unavailable");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, refresh_token: refresh, grant_type: "refresh_token" }), signal: AbortSignal.timeout(15000) });
  const token = await response.json() as { access_token?: string };
  if (!response.ok || !token.access_token) throw new Error("mail_unavailable");
  const sender = emailAddress(env.GMAIL_SENDER || "support.nurquran@gmail.com"); if (!sender) throw new Error("mail_unavailable");
  const appOrigin = env.APP_ORIGIN || "https://nur.youbianas1.workers.dev";
  const images: EmailImage[] = [];
  // Read packaged assets, not remote images: CID images also work without tracking requests.
  if (env.ASSETS) await Promise.all(([ ["logo", "/icons/nur-192.png"], ["reading", "/icons/ui/play.png"], ["favorites", "/icons/ui/heart.png"] ] as const).map(async ([id, path]) => {
    try {
      const image = await env.ASSETS!.fetch(new Request(new URL(path, appOrigin)));
      if (image.ok && image.headers.get("content-type")?.startsWith("image/png")) {
        const data = new Uint8Array(await image.arrayBuffer());
        if (data.length <= 128000) images.push({ id, data });
      }
    } catch { /* Readable text and public logo URLs remain available if an asset is missing. */ }
  }));
  const message = verificationMime(sender, email, code, language, appOrigin, images);
  const sent = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ raw: b64(encoder.encode(message)) }), signal: AbortSignal.timeout(15000) });
  if (!sent.ok) throw new Error("mail_unavailable");
}
async function signed(env: AccountEnv, value: object) { const data = b64(encoder.encode(JSON.stringify(value))); return `${data}.${await hmac(env.AUTH_SECRET!, data)}`; }
async function unsigned(env: AccountEnv, value: string): Promise<Record<string, unknown> | null> {
  if (value.length > 4000) return null;
  const parts = value.split("."); if (parts.length !== 2) return null;
  const [data, signature] = parts; if (!data || !signature || !equal(signature, await hmac(env.AUTH_SECRET!, data))) return null;
  try { const decoded = JSON.parse(new TextDecoder().decode(unb64(data))); return decoded.exp > now() ? decoded : null; } catch { return null; }
}
async function oauthStart(request: Request, env: AccountEnv, purpose: "login" | "gmail") {
  const client = purpose === "gmail" ? gmailClient(env) : { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };
  if (!ready(env) || !client.id || !client.secret) return json({ error: "not_configured" }, 503);
  const state = random(), nonce = random(), verifier = random();
  const callback = `${origin(request, env)}/api/auth/google/callback`;
  const mode = new URL(request.url).searchParams.get("mode") === "login" ? "login" : "signup";
  const payload = { purpose, mode, state, nonce, verifier, exp: now() + 600 };
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: client.id, redirect_uri: callback, response_type: "code", scope: purpose === "gmail" ? "openid email https://www.googleapis.com/auth/gmail.send" : "openid email profile", state, nonce, code_challenge: await hash(verifier), code_challenge_method: "S256", prompt: purpose === "gmail" ? "consent" : "select_account", ...(purpose === "gmail" ? { access_type: "offline", login_hint: env.GMAIL_SENDER || "support.nurquran@gmail.com" } : {}) }).toString();
  return redirect(url.href, [setCookie(OAUTH, await signed(env, payload), 600)]);
}
async function oauthCallback(request: Request, env: AccountEnv) {
  const url = new URL(request.url), flow = await unsigned(env, cookie(request, OAUTH));
  const welcome = flow?.mode === "login" ? "/welcome?login=1&auth=" : "/welcome?auth=";
  const clear = setCookie(OAUTH, "", 0), failure = () => redirect(flow?.purpose === "gmail" ? "/admin?gmail=failed" : `${welcome}failed`, [clear]);
  if (!flow || !equal(String(flow.state), url.searchParams.get("state") || "") || !url.searchParams.get("code")) return failure();
  if (flow.purpose !== "login" && flow.purpose !== "gmail") return failure();
  if (flow.purpose === "gmail" && !await isAdmin(request, env)) return failure();
  const client = flow.purpose === "gmail" ? gmailClient(env) : { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };
  if (!client.id || !client.secret) return failure();
  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, code: url.searchParams.get("code")!, code_verifier: String(flow.verifier), redirect_uri: `${origin(request, env)}/api/auth/google/callback`, grant_type: "authorization_code" }), signal: AbortSignal.timeout(15000) });
    const token = await exchange.json() as { id_token?: string; refresh_token?: string; scope?: string };
    if (!exchange.ok || !token.id_token) return failure();
    const { payload } = await jwtVerify(token.id_token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: client.id, algorithms: ["RS256"], maxTokenAge: "10m" });
    const email = emailAddress(payload.email);
    if (!payload.sub || payload.email_verified!==true || !email || !equal(String(payload.nonce), String(flow.nonce))) return failure();
    if (flow.purpose === "gmail") {
      if (email !== (env.GMAIL_SENDER || "support.nurquran@gmail.com").toLowerCase() || !token.refresh_token || !token.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.send")) return failure();
      await saveGmailToken(env, token.refresh_token);
      return redirect("/admin?gmail=connected", [clear]);
    }
    const result = await login(email, typeof payload.given_name === "string" ? payload.given_name : "", env, flow.mode === "login" ? "login" : "continue", payload.sub);
    return redirect(`${welcome}success`, [clear, result.session]);
  } catch (error) {
    if (flow.purpose === "login" && error instanceof Error && ["account_exists", "account_missing"].includes(error.message)) return redirect(`${welcome}${error.message}`, [clear]);
    return failure();
  }
}
async function verifySecret(value: string, encoded: string | undefined) {
  if (!encoded || value.length > 200) return false;
  const [algorithm, iterations, salt, expected] = encoded.split("$");
  const count = Number(iterations); if (algorithm !== "pbkdf2" || count !== 100000 || !salt || !expected) return false;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
    const result = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: count }, key, 256);
    return equal(b64(new Uint8Array(result)), expected);
  } catch { return false; }
}
function regionalLanguage(country: string) {
  if (["MA", "DZ", "TN", "MR", "FR", "BE", "MC", "LU", "CH", "SN", "CI", "BF", "BJ", "TG", "NE", "ML", "GN", "CM", "GA", "CG", "CD", "TD", "MG", "KM", "DJ", "HT", "SC", "MU", "RE", "GP", "MQ", "GF", "PF", "NC", "YT"].includes(country)) return "fr";
  if (["SA", "AE", "QA", "KW", "BH", "OM", "YE", "IQ", "JO", "PS", "LB", "SY", "EG", "SD", "LY", "SO"].includes(country)) return "ar";
  return "en";
}
export async function cleanupAccounts(env: AccountEnv) {
  if (!env.DB) return;
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM nur_analytics WHERE day<?").bind(cutoff),
    env.DB.prepare("DELETE FROM nur_rate_limits WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM nur_email_codes WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM nur_sessions WHERE expires_at<?").bind(now()),
    env.DB.prepare("DELETE FROM nur_admin_sessions WHERE expires_at<?").bind(now()),
  ]);
}

export async function accountApi(request: Request, env: AccountEnv, ctx: Context): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/api/region") {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const country = (request as Request & { cf?: { country?: string } }).cf?.country || "";
    return json({ language: regionalLanguage(country), regional: !!country });
  }
  if (!path.startsWith("/api/auth/") && !path.startsWith("/api/account/") && !path.startsWith("/api/admin/") && path !== "/api/analytics/event") return null;
  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
  if (request.method !== "GET" && request.headers.get("origin") !== origin(request, env)) return json({ error: "invalid_origin" }, 403);
  try {
    if (path === "/api/auth/session" && request.method === "GET") {
      const available = ready(env);
      const mailReady = available && !!gmailClient(env).id && !!gmailClient(env).secret && !!await gmailToken(env);
      const guest = available ? await unsigned(env, cookie(request, GUEST)) : null;
      return json({ user: available ? await user(request, env) : null, guest: guest?.purpose === "guest-entry", capabilities: { google: googleReady(env), email: mailReady, sync: available } });
    }
    if (path === "/api/auth/clear-device" && request.method === "POST") {
      if (ready(env)) {
        await env.DB!.prepare("DELETE FROM nur_sessions WHERE token_hash=?").bind(await hash(cookie(request, SESSION))).run();
        if (adminReady(env)) await env.DB!.prepare("DELETE FROM nur_admin_sessions WHERE token_hash=?").bind(await adminTokenHash(cookie(request, ADMIN), env)).run();
      }
      const headers = new Headers();
      for (const name of [SESSION, ADMIN, OAUTH, GUEST]) headers.append("set-cookie", setCookie(name, "", 0));
      return json({ ok: true }, 200, headers);
    }
    if (!ready(env)) return json({ error: "not_configured" }, 503);
    if (path === "/api/auth/guest" && request.method === "POST") {
      const input = await body(request);
      if (input.completed !== true) return json({ error: "invalid_data" }, 400);
      // This is intentional guest access, never account or administrator access.
      return json({ ok: true }, 200, { "set-cookie": setCookie(GUEST, await signed(env, { purpose: "guest-entry", exp: now() + 30 * 86400 }), 30 * 86400) });
    }
    if (path === "/api/auth/google/start" && request.method === "GET") return oauthStart(request, env, "login");
    if (path === "/api/auth/google/callback" && request.method === "GET") return oauthCallback(request, env);
    if (path === "/api/auth/email/request" && request.method === "POST") {
      const input = await body(request), email = emailAddress(input.email);
      if (!email) return json({ error: "invalid_email" }, 400);
      if (input.mode !== undefined && input.mode !== "login" && input.mode !== "signup") return json({ error: "invalid_data" }, 400);
      const mode: AuthMode = input.mode === "login" ? "login" : "signup";
      if (!await limit(request, env, "mail-ip", 5, 600) || !await limit(request, env, "mail-email", 3, 600, email)) return json({ error: "rate_limited" }, 429, { "retry-after": "600" });
      // This requested early check reveals account existence, so it stays rate-limited.
      // It never establishes email ownership or creates a login session.
      if (mode === "signup" && await env.DB!.prepare("SELECT id FROM nur_users WHERE email=?").bind(email).first()) return json({ error: "account_exists" }, 409);
      if (!await limit(request, env, "mail-total", 150, 3600, "global")) return json({ error: "rate_limited" }, 429, { "retry-after": "600" });
      // Rejection sampling avoids modulo bias in the one-time code.
      let n: number; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= 4294000000);
      const code = String(n % 1000000).padStart(6, "0"), id = random();
      await env.DB!.prepare("INSERT INTO nur_email_codes(id,email,code_hash,expires_at) VALUES(?,?,?,?)").bind(id, email, await hmac(env.AUTH_SECRET!, `${id}:${mode}:${code}`), now() + 600).run();
      try { await sendCode(email, code, input.language, env); } catch { await env.DB!.prepare("DELETE FROM nur_email_codes WHERE id=?").bind(id).run(); return json({ error: "mail_unavailable" }, 503); }
      return json({ challenge: await signed(env, { purpose: "email", id, mode, exp: now() + 600 }), expiresIn: 600 });
    }
    if (path === "/api/auth/email/verify" && request.method === "POST") {
      if (!await limit(request, env, "verify-ip", 12, 600)) return json({ error: "rate_limited" }, 429);
      const input = await body(request);
      if (typeof input.challenge !== "string" || typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) return json({ error: "invalid_code" }, 400);
      const flow = await unsigned(env, input.challenge);
      if (!flow || flow.purpose !== "email" || typeof flow.id !== "string" || !/^[a-f0-9]{64}$/.test(flow.id) || (flow.mode !== "login" && flow.mode !== "signup")) return json({ error: "invalid_code" }, 400);
      const challenge = await env.DB!.prepare("UPDATE nur_email_codes SET attempts=attempts+1 WHERE id=? AND expires_at>? AND attempts<5 RETURNING email,code_hash").bind(flow.id, now()).first<{ email: string; code_hash: string }>();
      if (!challenge || !equal(challenge.code_hash, await hmac(env.AUTH_SECRET!, `${flow.id}:${flow.mode}:${input.code}`))) return json({ error: "invalid_code" }, 400);
      const consumed = await env.DB!.prepare("DELETE FROM nur_email_codes WHERE id=? AND expires_at>? RETURNING email").bind(flow.id, now()).first();
      if (!consumed) return json({ error: "invalid_code" }, 400);
      const result = await login(challenge.email, "", env, flow.mode);
      const headers = new Headers(); headers.append("set-cookie", result.session);
      return json({ user: result.account }, 200, headers);
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      await env.DB!.prepare("DELETE FROM nur_sessions WHERE token_hash=?").bind(await hash(cookie(request, SESSION))).run();
      const headers = new Headers();
      for (const name of [SESSION, GUEST]) headers.append("set-cookie", setCookie(name, "", 0));
      return json({ ok: true }, 200, headers);
    }
    if (path.startsWith("/api/account/")) {
      const account = await user(request, env); if (!account) return json({ error: "unauthorized" }, 401);
      if (path === "/api/account/state" && request.method === "GET") {
        const row = await env.DB!.prepare("SELECT revision,data FROM nur_user_state WHERE user_id=?").bind(account.id).first<{ revision: number; data: string }>();
        return json({ revision: row?.revision || 0, data: JSON.parse(row?.data || "{}") });
      }
      if (path === "/api/account/state" && request.method === "PUT") {
        if (!await limit(request, env, "sync", 120, 60, account.id)) return json({ error: "rate_limited" }, 429);
        const input = await body(request), data = validateSnapshot(input.data);
        if (!data || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) return json({ error: "invalid_data" }, 400);
        const row = await env.DB!.prepare("UPDATE nur_user_state SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? RETURNING revision").bind(JSON.stringify(data), now(), account.id, input.revision).first<{ revision: number }>();
        if (!row) return json({ error: "conflict" }, 409);
        if (data["nur-profile-name"] !== undefined) await env.DB!.prepare("UPDATE nur_users SET name=? WHERE id=?").bind(data["nur-profile-name"], account.id).run();
        return json({ revision: row.revision, data });
      }
      if (path === "/api/account/reset" && request.method === "POST") {
        await env.DB!.batch([env.DB!.prepare("UPDATE nur_user_state SET data='{}',revision=revision+1,updated_at=? WHERE user_id=?").bind(now(), account.id), env.DB!.prepare("UPDATE nur_users SET name='' WHERE id=?").bind(account.id)]);
        return json({ ok: true });
      }
      return json({ error: "not_found" }, 404);
    }
    if (path === "/api/analytics/event" && request.method === "POST") {
      if (env.ANALYTICS_ENABLED === "0" || request.headers.get("Sec-GPC") === "1" || request.headers.get("DNT") === "1") return json({ ok: true });
      if (!await limit(request, env, "analytics", 120, 60)) return json({ error: "rate_limited" }, 429);
      const input = await body(request);
      const pages = ["/", "/home", "/welcome", "/read", "/assistant", "/favorites"];
      if (typeof input.page !== "string" || !pages.includes(input.page) || typeof input.visitor !== "string" || !/^[a-f0-9-]{36}$/.test(input.visitor) || typeof input.eventId !== "string" || !/^[a-f0-9-]{36}$/.test(input.eventId)) return json({ error: "invalid_data" }, 400);
      const day = new Date().toISOString().slice(0, 10), country = (request as Request & { cf?: { country?: string } }).cf?.country || "XX";
      const surah = input.page === "/read" && Number.isInteger(input.surah) && Number(input.surah) >= 1 && Number(input.surah) <= 114 ? Number(input.surah) : null;
      await env.DB!.prepare("INSERT OR IGNORE INTO nur_analytics(event_id,day,country,page,surah,visitor_hash) VALUES(?,?,?,?,?,?)").bind(input.eventId, day, /^[A-Z]{2}$/.test(country) ? country : "XX", input.page, surah, await hmac(env.AUTH_SECRET!, `${day}:${input.visitor}`)).run();
      if (crypto.getRandomValues(new Uint8Array(1))[0] === 0) ctx.waitUntil(cleanupAccounts(env).catch(() => {}));
      return json({ ok: true });
    }
    if (path.startsWith("/api/admin/")) {
      if (!adminReady(env)) return json({ error: "not_configured" }, 503);
      if (path === "/api/admin/challenge" && request.method === "GET") {
        const question = crypto.getRandomValues(new Uint8Array(1))[0] % 3;
        return json({ question, challenge: await signed(env, { question, id: random(), exp: now() + 300 }) });
      }
      if (path === "/api/admin/login" && request.method === "POST") {
        if (!await limit(request, env, "admin-ip", 5, 900) || !await limit(request, env, "admin-global", 30, 3600, "owner")) return json({ error: "rate_limited" }, 429);
        const input = await body(request), challenge = typeof input.challenge === "string" ? await unsigned(env, input.challenge) : null;
        if (!challenge || ![0, 1, 2].includes(Number(challenge.question))) return json({ error: "invalid_credentials" }, 401);
        const fields = [input.username, input.password, input.pin, input.answer]; if (fields.some(f => typeof f !== "string" || f.length > 200)) return json({ error: "invalid_credentials" }, 401);
        const answerHash = [env.ADMIN_ANSWER_1_HASH, env.ADMIN_ANSWER_2_HASH, env.ADMIN_ANSWER_3_HASH][Number(challenge.question)];
        const valid = equal(String(input.username), env.ADMIN_USERNAME!) && await verifySecret(String(input.password), env.ADMIN_PASSWORD_HASH) && await verifySecret(String(input.pin), env.ADMIN_PIN_HASH) && await verifySecret(String(input.answer).normalize("NFKC").trim().toLowerCase(), answerHash);
        if (!valid) return json({ error: "invalid_credentials" }, 401);
        const token = random(); await env.DB!.prepare("INSERT INTO nur_admin_sessions(token_hash,expires_at) VALUES(?,?)").bind(await adminTokenHash(token, env), now() + 3600).run();
        return json({ ok: true }, 200, { "set-cookie": setCookie(ADMIN, token, 3600) });
      }
      if (!await isAdmin(request, env)) return json({ error: "unauthorized" }, 401);
      if (path === "/api/admin/logout" && request.method === "POST") { await env.DB!.prepare("DELETE FROM nur_admin_sessions WHERE token_hash=?").bind(await adminTokenHash(cookie(request, ADMIN), env)).run(); return json({ ok: true }, 200, { "set-cookie": setCookie(ADMIN, "", 0) }); }
      if (path === "/api/admin/gmail/connect" && request.method === "GET") return oauthStart(request, env, "gmail");
      if (path === "/api/admin/stats" && request.method === "GET") {
        const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
        const [totals, countries, chapters, days, accounts] = await Promise.all([
          env.DB!.prepare("SELECT COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitorDays FROM nur_analytics WHERE day>=?").bind(since).first(),
          env.DB!.prepare("SELECT country,COUNT(*) AS views FROM nur_analytics WHERE day>=? GROUP BY country ORDER BY views DESC LIMIT 20").bind(since).all(),
          env.DB!.prepare("SELECT surah,COUNT(*) AS views FROM nur_analytics WHERE day>=? AND surah IS NOT NULL GROUP BY surah ORDER BY views DESC LIMIT 10").bind(since).all(),
          env.DB!.prepare("SELECT day,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM nur_analytics WHERE day>=? GROUP BY day ORDER BY day").bind(since).all(),
          env.DB!.prepare("SELECT COUNT(*) AS total FROM nur_users").first(),
        ]);
        return json({ totals, countries: countries.results, chapters: chapters.results, days: days.results, accounts, retentionDays: 365, gmailConnected: !!await gmailToken(env) });
      }
      return json({ error: "not_found" }, 404);
    }
    return json({ error: "not_found" }, 404);
  } catch (error) {
    if (error instanceof Error && ["account_exists", "account_missing"].includes(error.message)) return json({ error: error.message }, 409);
    if (error instanceof Error && (error.message === "invalid_body" || error instanceof SyntaxError)) return json({ error: "invalid_data" }, 400);
    // Never send provider responses, SQL errors or credentials to a browser.
    return json({ error: "service_unavailable" }, 503);
  }
}
