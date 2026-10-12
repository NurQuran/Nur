"use client";
import { useState } from "react";
import { useAccount } from "./AccountProvider";
import { useLanguage } from "../lib/i18n";

export default function AccountPanel() {
  const { user, ready, syncStatus, logout } = useAccount();
  const { language } = useLanguage();
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try { await logout(); } catch { setError(navigator.onLine ? local("Vos dernières données ne sont pas encore synchronisées. Réessayez dans un instant.", "Your latest data has not synchronized yet. Try again shortly.", "لم تتم مزامنة أحدث بياناتك بعد. حاول بعد قليل.") : local("Reconnectez-vous à Internet pour vous déconnecter.", "Reconnect to the internet to sign out.", "اتصل بالإنترنت لتسجيل الخروج.")); } finally { setBusy(false); }
  }
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  if (!ready) return null;
  const status = syncStatus === "saved" ? local("Données synchronisées", "Data synchronized", "تمت مزامنة البيانات") : syncStatus === "syncing" ? local("Synchronisation…", "Synchronizing…", "جارٍ المزامنة…") : syncStatus === "offline" ? local("Hors ligne · sauvegarde sur cet appareil", "Offline · saved on this device", "دون اتصال · محفوظ على هذا الجهاز") : local("Synchronisation en attente · données conservées", "Sync pending · your data is saved", "المزامنة معلّقة · بياناتك محفوظة");
  return <div className="setting-group account-setting"><span className="setting-icon" aria-hidden="true">◎</span><div><h3>{local("Votre compte", "Your account", "حسابك")}</h3><p>{user ? user.email : local("Invité · vos données restent sur cet appareil.", "Guest · your data stays on this device.", "ضيف · تبقى بياناتك على هذا الجهاز.")}</p>{user ? <><small className="account-sync-status" role="status">{status}</small><button className="account-secondary" disabled={busy} onClick={() => void signOut()}>{busy ? local("Sauvegarde…", "Saving…", "جارٍ الحفظ…") : local("Se déconnecter", "Sign out", "تسجيل الخروج")}</button></> : <a className="account-secondary" href="/welcome?login=1">{local("Se connecter et synchroniser", "Sign in and synchronize", "سجّل الدخول وزامن بياناتك")}</a>}{error && <p role="alert">{error}</p>}</div></div>;
}
