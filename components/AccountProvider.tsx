"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { accountImportSnapshot, mergeSnapshots, syncKeys, validateSnapshot, type Snapshot } from "../lib/accountState";
import { patchAndroidState } from "../lib/androidSync";
import { allowedProfileName } from "../lib/profileName";

export type Account = { id: string; email: string; name: string; onboarded?: boolean };
type Capabilities = { google: boolean; email: boolean; sync: boolean };
type AccountContext = {
  user: Account | null; ready: boolean; guestAuthorized: boolean; capabilities: Capabilities;
  syncStatus: "guest" | "saved" | "syncing" | "offline" | "error";
  refresh: () => Promise<void>; synchronize: () => Promise<boolean>;
  logout: () => Promise<void>; resetAccount: () => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);
const noCapabilities: Capabilities = { google: false, email: false, sync: false };
export function useAccount() { const value = useContext(Context); if (!value) throw new Error("AccountProvider is missing"); return value; }
function snapshot(): Snapshot {
  const result: Snapshot = {};
  for (const key of syncKeys) { const value = localStorage.getItem(key); if (value !== null && validateSnapshot({ [key]: value })) result[key] = value; }
  return validateSnapshot(result) || {};
}
function apply(data: Snapshot) {
  for (const key of syncKeys) { if (data[key] === undefined) localStorage.removeItem(key); else localStorage.setItem(key, data[key]!); }
  const language = data["nur-language"] || "fr", theme = data["nur-theme"] || "dark";
  document.documentElement.lang = language; document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-motion", data["nur-reduced-motion"] === "1" ? "reduced" : "full");
  dispatchEvent(new CustomEvent("nur-language", { detail: language }));
  dispatchEvent(new CustomEvent("nur-theme-changed", { detail: theme }));
  dispatchEvent(new Event("nur-cloud-hydrated"));
  try {
    const settings = JSON.parse(data["nur-settings"] || "{}"), favorites = JSON.parse(data["nur-favorite-surahs"] || "[]"), read = JSON.parse(data["nur-read-surahs"] || "[]"), progress = JSON.parse(data["nur-progress"] || "{}");
    patchAndroidState({ language: language as "fr" | "en" | "ar", theme: theme as "light" | "dark", favorites, read, minutes: progress.minutes || 0, goal: progress.goal || 10, onboarded: !!data["nur-onboarding-complete"], ...(settings.riwayah ? { riwayah: settings.riwayah, reciter: settings.reciter, tajweed: !!settings.tajweed, french: !!settings.showFrench, english: !!settings.showEnglish, pronunciation: !!settings.showTransliteration } : {}) });
  } catch { /* Text remains readable without an Android bridge. */ }
}
export async function accountRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", signal: options?.signal || AbortSignal.timeout(15000), headers: { "content-type": "application/json", ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "service_unavailable"), { status: response.status });
  return data;
}

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null), [ready, setReady] = useState(false);
  const [guestAuthorized, setGuestAuthorized] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities>(noCapabilities);
  const [syncStatus, setSyncStatus] = useState<AccountContext["syncStatus"]>("guest");
  const accountRef = useRef<Account | null>(null), base = useRef<Snapshot>({}), syncing = useRef(false);
  const guestImport = useRef(false), initialized = useRef(false), suspended = useRef(false);
  const preparedOwner=useRef(""),lastSyncSucceeded=useRef(false);
  const synchronize = useCallback(async () => {
    while (syncing.current) await new Promise(resolve => setTimeout(resolve, 50));
    const account = accountRef.current;
    if (!account || suspended.current) return false;
    if (!navigator.onLine) { setSyncStatus("offline"); return false; }
    syncing.current = true;
    lastSyncSucceeded.current=false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await accountRequest("/api/account/state");
        if (suspended.current || accountRef.current?.id !== account.id) return false;
        const remoteData = validateSnapshot(remote.data); if (!remoteData) throw new Error("invalid_data");
        const importing = guestImport.current;
        const captured = importing ? accountImportSnapshot(snapshot()) : snapshot();
        const merged = mergeSnapshots(base.current, captured, remoteData, importing);
        if (!merged["nur-profile-name"] && allowedProfileName(account.name)) merged["nur-profile-name"] = allowedProfileName(account.name);
        let stored = remote;
        if (JSON.stringify(merged) !== JSON.stringify(remoteData)) {
          setSyncStatus("syncing");
          try { stored = await accountRequest("/api/account/state", { method: "PUT", body: JSON.stringify({ revision: remote.revision, data: merged }) }); }
          catch (error) { if ((error as { status?: number }).status === 409) continue; throw error; }
        }
        if (suspended.current || accountRef.current?.id !== account.id) return false;
        const latest = snapshot(), pending = mergeSnapshots(captured, importing ? accountImportSnapshot(latest) : latest, stored.data);
        base.current = stored.data; guestImport.current = false;
        localStorage.setItem("nur-cloud-base", JSON.stringify({ owner: account.id, data: stored.data }));
        localStorage.setItem("nur-sync-owner", account.id);
        if (JSON.stringify(latest) !== JSON.stringify(pending)) apply(pending);
        const updated = { ...account, name: pending["nur-profile-name"] || account.name, onboarded: pending["nur-onboarding-complete"] === "1" };
        accountRef.current = updated; setUser(updated);
        localStorage.setItem("nur-account-cache", JSON.stringify(updated));
        setSyncStatus("saved"); initialized.current = true;lastSyncSucceeded.current=true; return true;
      }
      throw new Error("conflict");
    } catch (error) {
      if ((error as { status?: number }).status === 401) { accountRef.current = null; setUser(null); setCapabilities(noCapabilities); }
      setSyncStatus(navigator.onLine ? "error" : "offline");
      return false;
    } finally { syncing.current = false; }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const session = await accountRequest("/api/auth/session");
      setGuestAuthorized(session.guest === true);
      setCapabilities(session.capabilities || noCapabilities);
      const account = session.user as Account | null, previousOwner = localStorage.getItem("nur-sync-owner");
      // Renew an intentional returning guest's device session, including older installations.
      if (!account && !previousOwner && localStorage.getItem("nur-onboarding-complete") === "1") {
        localStorage.setItem("nur-guest", "1");
        if (!session.guest && session.capabilities?.sync) {
          await accountRequest("/api/auth/guest", { method: "POST", body: JSON.stringify({ completed: true }) });
          const confirmed = await accountRequest("/api/auth/session");
          setGuestAuthorized(confirmed.guest === true);
        }
      }
      if (account && preparedOwner.current !== account.id) {
        setSyncStatus("syncing");
        base.current = {}; guestImport.current = !previousOwner;
        if (previousOwner === account.id) {
          try { const cached = JSON.parse(localStorage.getItem("nur-cloud-base") || "{}"); if (cached.owner === account.id) base.current = validateSnapshot(cached.data) || {}; } catch { /* Recover from the server. */ }
        } else if (previousOwner) {
          for (const key of syncKeys) localStorage.removeItem(key);
        }
        initialized.current = false;
        preparedOwner.current=account.id;
      }
      accountRef.current = account; setUser(account);
      if (account) await synchronize(); else setSyncStatus("guest");
    } catch {
      if (!navigator.onLine) setGuestAuthorized(localStorage.getItem("nur-guest") === "1" && localStorage.getItem("nur-onboarding-complete") === "1");
      try { const cached = JSON.parse(localStorage.getItem("nur-account-cache") || "null"); if (cached?.id && !navigator.onLine) { accountRef.current = cached; setUser(cached); setSyncStatus("offline"); } } catch { /* Guest mode stays usable. */ }
    } finally { setReady(true); }
  }, [synchronize]);
  const logout = useCallback(async () => {
    if (accountRef.current) {
      if (!navigator.onLine) throw new Error("offline");
      while(syncing.current)await new Promise(resolve=>setTimeout(resolve,50));
      await synchronize(); suspended.current = true;
      if(!lastSyncSucceeded.current){suspended.current=false;throw new Error("sync_pending")}
      try { await accountRequest("/api/auth/logout", { method: "POST", body: "{}" }); }
      catch (error) { suspended.current = false; throw error; }
    }
    accountRef.current = null; setUser(null); setGuestAuthorized(false); setSyncStatus("guest");
    for (const key of [...syncKeys, "nur-account-cache", "nur-sync-owner", "nur-cloud-base"]) localStorage.removeItem(key);
    location.assign("/");
  }, [synchronize]);
  const resetAccount = useCallback(async () => {
    if (!accountRef.current) return;
    if (!navigator.onLine) throw new Error("offline");
    suspended.current = true;
    while (syncing.current) await new Promise(resolve => setTimeout(resolve, 50));
    try {
      await accountRequest("/api/account/reset", { method: "POST", body: "{}" });
      await accountRequest("/api/auth/logout", { method: "POST", body: "{}" });
      accountRef.current = null; setUser(null);
    } catch (error) { suspended.current = false; throw error; }
  }, []);
  useEffect(() => {
    void refresh();
    const online = () => { void refresh(); }, offline = () => { if (accountRef.current) setSyncStatus("offline"); };
    const sync = () => { if (initialized.current && !syncing.current) void synchronize(); };
    const timer = setInterval(sync, 20000);
    const visibility = () => { if (document.visibilityState === "visible") void refresh(); else sync(); };
    addEventListener("online", online); addEventListener("offline", offline); addEventListener("nur-data-changed", sync); addEventListener("storage", sync); document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(timer); removeEventListener("online", online); removeEventListener("offline", offline); removeEventListener("nur-data-changed", sync); removeEventListener("storage", sync); document.removeEventListener("visibilitychange", visibility); };
  }, [refresh, synchronize]);
  return <Context.Provider value={{ user, ready, guestAuthorized, capabilities, syncStatus, refresh, synchronize, logout, resetAccount }}>{children}</Context.Provider>;
}
