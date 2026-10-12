"use client";
import { useState, type FormEvent } from "react";
import { accountRequest, useAccount } from "./AccountProvider";
import { useLanguage } from "../lib/i18n";

export default function SignInStep({ onContinue, onBusyChange, mode = "signup" }: { onContinue: () => void; onBusyChange?: (busy: boolean) => void; mode?: "login" | "signup" }) {
  const { language } = useLanguage(), { user, capabilities, refresh } = useAccount();
  const [email, setEmail] = useState(""), [code, setCode] = useState(""), [challenge, setChallenge] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sentAt, setSentAt] = useState(0);
  const local = (fr: string, en: string, ar: string) => language === "ar" ? ar : language === "en" ? en : fr;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); onBusyChange?.(true); setError("");
    try {
      if (challenge) { await accountRequest("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ challenge, code }) }); await refresh(); }
      else { const data = await accountRequest("/api/auth/email/request", { method: "POST", body: JSON.stringify({ email, language, mode }) }); setChallenge(data.challenge); setSentAt(Date.now()); }
    } catch (problem) {
      const reason = problem instanceof Error ? problem.message : "";
      if (reason === "account_exists" || reason === "account_missing") {
        setChallenge(""); setCode("");
        setError(reason === "account_exists"
          ? local("Un compte existe déjà avec cette adresse. Choisissez « Se connecter » pour retrouver votre espace.", "An account already exists with this address. Choose “Sign in” to return to your space.", "يوجد حساب بهذا البريد بالفعل. اختر «تسجيل الدخول» للعودة إلى مساحتك.")
          : local("Aucun compte n’est associé à cette adresse. Choisissez « S’inscrire » pour créer votre espace.", "No account is associated with this address. Choose “Sign up” to create your space.", "لا يوجد حساب بهذا البريد. اختر «إنشاء حساب» لإنشاء مساحتك."));
        return;
      }
      setError(reason === "invalid_code" ? local("Code incorrect ou expiré. Vérifiez les six chiffres.", "Incorrect or expired code. Check the six digits.", "الرمز غير صحيح أو انتهت صلاحيته. تحقّق من الأرقام الستة.") : reason === "rate_limited" ? local("Trop de tentatives. Réessayez dans quelques minutes.", "Too many attempts. Try again in a few minutes.", "محاولات كثيرة. حاول مجددًا بعد بضع دقائق.") : reason === "invalid_email" ? local("Vérifiez votre adresse e-mail.", "Check your email address.", "تحقّق من عنوان بريدك الإلكتروني.") : local("La connexion est indisponible pour le moment. Vous pouvez continuer en invité.", "Sign-in is unavailable right now. You can continue as a guest.", "تسجيل الدخول غير متاح الآن. يمكنك المتابعة كضيف."));
    } finally { setBusy(false); onBusyChange?.(false); }
  }
  if (user) return <div className="signin-success"><span aria-hidden="true">✓</span><p>{local("Connecté avec", "Signed in with", "تم تسجيل الدخول بواسطة")}<br/><strong dir="ltr">{user.email}</strong></p><button className="primary" onClick={onContinue}>{local("Continuer", "Continue", "متابعة")}</button></div>;
  return <div className="signin-options">
    {capabilities.google ? <a className="google-signin" href={`/api/auth/google/start?mode=${mode}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 5.9Z"/></svg>{local("Continuer avec Google", "Continue with Google", "المتابعة باستخدام Google")}</a> : <button className="google-signin" disabled>{local("Connexion Google bientôt disponible", "Google sign-in coming soon", "تسجيل الدخول عبر Google قريبًا")}</button>}
    {capabilities.email ? <form className="email-signin" onSubmit={submit}>
      <label htmlFor="signin-email">{local("Adresse e-mail", "Email address", "البريد الإلكتروني")}</label><input id="signin-email" type="email" autoComplete="email" dir="ltr" required maxLength={254} value={email} disabled={busy || !!challenge} onChange={event => setEmail(event.target.value)}/>
      {challenge && <><p className="code-sent" role="status">{local("Un code a été envoyé. Pensez aussi aux courriers indésirables.", "A code has been sent. Check your spam folder too.", "أُرسل الرمز. تحقّق أيضًا من البريد غير المرغوب فيه.")}</p><label htmlFor="signin-code">{local("Code à six chiffres", "Six-digit code", "رمز من ستة أرقام")}</label><input id="signin-code" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} dir="ltr" onChange={event => setCode(event.target.value.replace(/\D/g, ""))}/></>}
      <button className="primary" disabled={busy}>{busy ? local("Un instant…", "One moment…", "لحظة…") : challenge ? local("Vérifier et continuer", "Verify and continue", "تحقّق وتابع") : local("Recevoir un code", "Send me a code", "أرسل لي رمزًا")}</button>
      {challenge && <button className="quiet-link" type="button" disabled={busy} onClick={() => { if (Date.now() - sentAt < 60000) setError(local("Attendez une minute avant de demander un nouveau code.", "Wait one minute before requesting another code.", "انتظر دقيقة قبل طلب رمز جديد.")); else { setChallenge(""); setCode(""); setError(""); } }}>{local("Changer d’adresse ou renvoyer", "Change address or resend", "غيّر العنوان أو أعد الإرسال")}</button>}
    </form> : <p className="signin-unavailable">{local("Les codes par e-mail seront disponibles dès l’activation du service.", "Email codes will be available once the service is activated.", "ستتوفر رموز البريد الإلكتروني عند تفعيل الخدمة.")}</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
  </div>;
}
