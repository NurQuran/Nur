"use client";
import { useState } from "react";
import { accountRequest, useAccount } from "./AccountProvider";
import { clearAndroidState } from "../lib/androidSync";
import { useLanguage } from "../lib/i18n";
export default function ResetNur({ deviceOnly = false }: { deviceOnly?: boolean } = {}) {
  const { user, resetAccount } = useAccount(), { language } = useLanguage();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  async function reset() {
    if (busy) return; setBusy(true); setError("");
    try {
      if (deviceOnly) await accountRequest("/api/auth/clear-device", { method: "POST", body: "{}" });
      else await resetAccount();
      Object.keys(localStorage).filter(key => key.startsWith("nur-")).forEach(key => localStorage.removeItem(key));
      Object.keys(sessionStorage).filter(key => key.startsWith("nur-")).forEach(key => sessionStorage.removeItem(key));
      clearAndroidState();
      for (const entry of document.cookie.split(";")) {
        const name = entry.split("=")[0].trim();
        if (name.startsWith("nur-") || name.startsWith("__Host-nur-")) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
      }
      if ("caches" in window) { const names = await caches.keys(); await Promise.all(names.filter(name => name.startsWith("nur-")).map(name => caches.delete(name))); }
      location.replace("/");
    } catch { setBusy(false); setError(deviceOnly ? local("Reconnectez-vous à Internet pour fermer les sessions et effacer toutes les données de cet appareil.", "Reconnect to close sessions and erase all data on this device.", "اتصل بالإنترنت لإغلاق الجلسات ومسح بيانات هذا الجهاز.") : local("Reconnectez-vous à Internet pour effacer les données synchronisées.", "Reconnect to erase synchronized data.", "اتصل بالإنترنت لمسح البيانات المتزامنة.")); }
  }
  return <section className={`reset-data-card${confirm ? " confirming" : ""}`}><span className="reset-data-icon" aria-hidden="true"><i/></span><div><strong>{local("Réinitialiser Nūr", "Reset Nūr", "إعادة ضبط نُور")}</strong><p>{deviceOnly ? local("Efface les cookies et les données Nūr de cet appareil, ferme les sessions et relance l’introduction. Les données du compte synchronisées restent conservées.", "Erases Nūr cookies and data on this device, closes sessions and restarts the introduction. Synchronized account data is kept.", "يمسح ملفات الارتباط وبيانات نُور من هذا الجهاز، ويغلق الجلسات ويعيد المقدمة. تبقى بيانات الحساب المتزامنة محفوظة.") : user ? local("Efface les favoris, la progression et les préférences du compte et de cet appareil.", "Erases your account and device favorites, progress and preferences.", "يمسح المفضلة والتقدم والتفضيلات من الحساب وهذا الجهاز.") : local("Efface les données de cet appareil et recommence la configuration.", "Erases this device’s data and restarts setup.", "يمسح بيانات هذا الجهاز ويعيد الإعداد.")}</p></div>{confirm ? <div className="reset-data-confirm"><p>{local("Tout effacer et revoir l’introduction ?", "Erase everything and restart the introduction?", "هل تريد مسح الكل وإعادة المقدمة؟")}</p><div><button onClick={() => setConfirm(false)} disabled={busy}>{local("Annuler", "Cancel", "إلغاء")}</button><button className="danger" onClick={() => void reset()} disabled={busy}>{busy ? local("Effacement…", "Erasing…", "جارٍ المسح…") : local("Oui, tout effacer", "Yes, erase everything", "نعم، امسح الكل")}</button></div></div> : <button className="reset-data-button" onClick={() => setConfirm(true)}>{deviceOnly ? local("Effacer cookies et données", "Clear cookies and data", "مسح ملفات الارتباط والبيانات") : local("Effacer toutes les données", "Erase all data", "مسح جميع البيانات")}</button>}{error && <p className="account-error" role="alert">{error}</p>}</section>;
}
