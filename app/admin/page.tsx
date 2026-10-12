"use client";
import { useEffect, useState, type FormEvent } from "react";
import SiteHeader from "../../components/SiteHeader";
import { accountRequest } from "../../components/AccountProvider";
import { useLanguage } from "../../lib/i18n";
import { surahNames } from "../../lib/quran/surahs";
import { arabicNames } from "../../lib/quran/arabicNames";

type Stats = { totals: { views: number; visitorDays: number }; countries: { country: string; views: number }[]; chapters: { surah: number; views: number }[]; days: { day: string; views: number; visitors: number }[]; accounts: { total: number }; gmailConnected: boolean; retentionDays: number };
export default function AdminPage() {
  const { language } = useLanguage();
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  const [stats, setStats] = useState<Stats | null>(null), [challenge, setChallenge] = useState(""), [question, setQuestion] = useState(0);
  const [username, setUsername] = useState(""), [password, setPassword] = useState(""), [pin, setPin] = useState(""), [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false), [checking, setChecking] = useState(true), [error, setError] = useState(""), [unconfigured, setUnconfigured] = useState(false);
  async function loadChallenge() { const data = await accountRequest("/api/admin/challenge"); setQuestion(data.question); setChallenge(data.challenge); }
  async function loadStats() { const data = await accountRequest("/api/admin/stats"); setStats(data); }
  useEffect(() => {
    void loadStats().catch(async problem => {
      if (problem.status === 503) setUnconfigured(true);
      else if (problem.status === 401) { try { await loadChallenge(); } catch { setUnconfigured(true); } }
      else setError("service_unavailable");
    }).finally(() => setChecking(false));
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await accountRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password, pin, answer, challenge }) }); setPassword(""); setPin(""); setAnswer(""); await loadStats(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "service_unavailable"); try { await loadChallenge(); } catch { /* Keep access locked. */ } }
    finally { setBusy(false); }
  }
  const questions = [local("De quelle ville viens-tu ?", "Which city are you from?", "من أي مدينة أنت؟"), local("Quel était le nom de ton chien ?", "What was your dog’s name?", "ما اسم كلبك السابق؟"), local("Quel est ton youtubeur préféré ?", "Who is your favorite YouTuber?", "من هو صانع محتواك المفضل على يوتيوب؟")];
  const message = error === "rate_limited" ? local("Trop de tentatives. Réessayez dans 15 minutes.", "Too many attempts. Try again in 15 minutes.", "محاولات كثيرة. حاول مجددًا بعد 15 دقيقة.") : error === "invalid_credentials" ? local("Les informations de connexion sont incorrectes ou la question a expiré.", "Incorrect credentials or the question has expired.", "بيانات الدخول غير صحيحة أو انتهت صلاحية السؤال.") : local("Le service est indisponible. Réessayez plus tard.", "The service is unavailable. Try again later.", "الخدمة غير متاحة. حاول لاحقًا.");
  let countryNames: Intl.DisplayNames | null = null; try { countryNames = new Intl.DisplayNames([language], { type: "region" }); } catch { /* Use country codes. */ }
  return <main className="admin-page"><SiteHeader/><section className="admin-shell"><p className="eyebrow">NŪR · ADMIN</p><h1>{local("Tableau de bord", "Dashboard", "لوحة التحكم")}</h1>
    {checking ? <p role="status">{local("Vérification de l’accès…", "Checking access…", "جارٍ التحقّق من الوصول…")}</p> : unconfigured ? <div className="admin-not-ready"><h2>{local("Administration en attente d’activation", "Administration awaiting activation", "الإدارة بانتظار التفعيل")}</h2><p>{local("L’accès reste fermé tant que la base et les secrets de l’administrateur ne sont pas configurés.", "Access stays closed until the database and administrator secrets are configured.", "يبقى الوصول مغلقًا حتى إعداد قاعدة البيانات وأسرار المسؤول.")}</p></div> : !stats ? <form className="admin-login" onSubmit={signIn}>
      <label>{local("Identifiant", "Username", "اسم المستخدم")}<input autoComplete="username" required value={username} maxLength={100} onChange={event => setUsername(event.target.value)}/></label>
      <label>{local("Mot de passe", "Password", "كلمة المرور")}<input type="password" autoComplete="current-password" required value={password} maxLength={200} onChange={event => setPassword(event.target.value)}/></label>
      <label>{local("Code secret", "Secret code", "الرمز السري")}<input type="password" autoComplete="off" required maxLength={200} value={pin} onChange={event => setPin(event.target.value)}/></label>
      <label>{questions[question]}<input type="password" autoComplete="off" required maxLength={200} value={answer} onChange={event => setAnswer(event.target.value)}/></label>
      <button className="primary" disabled={busy || !challenge}>{busy ? local("Vérification…", "Checking…", "جارٍ التحقّق…") : local("Ouvrir l’administration", "Open administration", "فتح الإدارة")}</button>
    </form> : <>
      <div className="admin-toolbar"><span>{local("30 derniers jours · conservation : un an", "Last 30 days · retention: one year", "آخر 30 يومًا · الاحتفاظ: سنة")}</span><button className="account-secondary" onClick={() => void loadStats().catch(() => { setStats(null); void loadChallenge(); })}>{local("Actualiser", "Refresh", "تحديث")}</button><button className="account-secondary" onClick={() => void accountRequest("/api/admin/logout", { method: "POST", body: "{}" }).then(() => { setStats(null); return loadChallenge(); }).catch(() => setError("service_unavailable"))}>{local("Se déconnecter", "Sign out", "تسجيل الخروج")}</button></div>
      <div className="admin-metrics"><article><strong>{stats.totals.views.toLocaleString(language)}</strong><span>{local("Pages vues", "Page views", "مشاهدات الصفحات")}</span></article><article><strong>{stats.totals.visitorDays.toLocaleString(language)}</strong><span>{local("Visiteurs quotidiens cumulés", "Cumulative daily visitors", "مجموع الزوار اليوميين")}</span></article><article><strong>{stats.accounts.total.toLocaleString(language)}</strong><span>{local("Comptes créés", "Accounts created", "الحسابات المنشأة")}</span></article></div>
      <p className="admin-count-note">{local("Les visiteurs sont estimés par session et par jour ; une personne revenant plusieurs jours peut être comptée plusieurs fois.", "Visitors are estimated per session and day; someone returning on different days can be counted more than once.", "يُقدّر الزوار حسب الجلسة واليوم؛ وقد يُحسب الشخص العائد في أيام مختلفة أكثر من مرة.")}</p>
      <div className="admin-chart"><h2>{local("Fréquentation quotidienne", "Daily traffic", "الزيارات اليومية")}</h2>{stats.days.length ? <div className="traffic-bars">{stats.days.map(day => <div key={day.day} title={`${day.day}: ${day.views}`}><span style={{ height: `${Math.max(3, day.views / Math.max(...stats.days.map(d => d.views)) * 100)}%` }}/><small>{day.day.slice(5)}</small></div>)}</div> : <p>{local("Les premières visites apparaîtront ici.", "Your first visits will appear here.", "ستظهر الزيارات الأولى هنا.")}</p>}</div>
      <div className="admin-lists"><article><h2>{local("Pays", "Countries", "البلدان")}</h2><ol>{stats.countries.map(row => <li key={row.country}><span>{row.country === "XX" ? local("Non déterminé", "Unknown", "غير محدّد") : countryNames?.of(row.country) || row.country}</span><b>{row.views}</b></li>)}</ol></article><article><h2>{local("Sourates les plus ouvertes", "Most opened surahs", "السور الأكثر فتحًا")}</h2><ol>{stats.chapters.map(row => <li key={row.surah}><a href={`/read?surah=${row.surah}`}>{language === "ar" ? arabicNames[row.surah - 1] : surahNames[row.surah - 1]}</a><b>{row.views}</b></li>)}</ol></article></div>
      <section className="gmail-admin"><h2>{local("Envoi des codes par Gmail", "Sending codes through Gmail", "إرسال الرموز عبر Gmail")}</h2><p dir="ltr">support.nurquran@gmail.com</p><p>{stats.gmailConnected ? local("Gmail est autorisé. Les codes peuvent être envoyés.", "Gmail is authorized. Codes can be sent.", "تم التصريح لـ Gmail. يمكن إرسال الرموز.") : local("Autorisez le compte d’envoi pour activer les codes par e-mail.", "Authorize the sending account to activate email codes.", "صرّح لحساب الإرسال لتفعيل رموز البريد الإلكتروني.")}</p><a className="primary" href="/api/admin/gmail/connect">{stats.gmailConnected ? local("Renouveler l’autorisation Gmail", "Renew Gmail authorization", "تجديد تصريح Gmail") : local("Autoriser Gmail", "Authorize Gmail", "التصريح لـ Gmail")}</a></section>
    </>}{error && <p className="account-error" role="alert">{message}</p>}
  </section></main>;
}
