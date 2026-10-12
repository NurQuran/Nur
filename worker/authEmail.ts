type Language = "fr" | "en" | "ar";
export type EmailImage = { id: string; data: Uint8Array };
const copy = {
  fr: { subject: "Votre code de vérification Nūr", eyebrow: "VOTRE ESPACE NŪR", title: "Un petit code, et vous y êtes.", intro: "Saisissez ce code dans Nūr pour vérifier votre adresse e-mail et continuer.", code: "Votre code de vérification", expiry: "Valable pendant 10 minutes", security: "Gardez ce code pour vous. L’équipe Nūr ne vous demandera jamais de le partager.", ignore: "Vous n’avez rien demandé ? Ignorez simplement ce message.", footer: "Votre lecture. Votre rythme. Votre chemin.", link: "Retrouver Nūr", reading: "Lire", favorites: "Vos favoris" },
  en: { subject: "Your Nūr verification code", eyebrow: "YOUR NŪR SPACE", title: "One small code. Welcome in.", intro: "Enter this code in Nūr to verify your email address and continue.", code: "Your verification code", expiry: "Valid for 10 minutes", security: "Keep this code private. The Nūr team will never ask you to share it.", ignore: "Didn't request this? Simply ignore this message.", footer: "Your reading. Your pace. Your journey.", link: "Return to Nūr", reading: "Read", favorites: "Your favorites" },
  ar: { subject: "رمز التحقّق الخاص بك في نُور", eyebrow: "مساحتك في نُور", title: "رمز صغير، وخطوة إلى نُور.", intro: "أدخل هذا الرمز في نُور للتحقّق من بريدك الإلكتروني والمتابعة.", code: "رمز التحقّق الخاص بك", expiry: "صالح لمدة 10 دقائق", security: "احتفظ بهذا الرمز لنفسك. لن يطلب منك فريق نُور مشاركته أبدًا.", ignore: "لم تطلب هذا الرمز؟ يمكنك تجاهل هذه الرسالة.", footer: "قراءتك. وتيرتك. رحلتك.", link: "العودة إلى نُور", reading: "القراءة", favorites: "مفضّلاتك" },
} satisfies Record<Language, Record<string, string>>;
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const base64 = (value: string | Uint8Array) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const wrapped = (value: string | Uint8Array) => base64(value).match(/.{1,76}/g)?.join("\r\n") || "";

export function verificationEmail(code: string, language: unknown, appOrigin: string, images: EmailImage[] = []) {
  if (!/^\d{6}$/.test(code)) throw new Error("invalid_code");
  const lang: Language = language === "ar" || language === "en" ? language : "fr", c = copy[lang];
  const url = new URL(appOrigin); if (url.protocol !== "https:") throw new Error("invalid_email_origin");
  const site = escape(url.origin), image = (id: string, path: string) => images.some(item => item.id === id) ? `cid:${id}@nur` : `${site}${path}`;
  const text = `${c.code} : ${code}\n\n${c.intro}\n${c.expiry}.\n${c.security}\n\n${c.ignore}\n\nNūr — ${c.footer}\n${url.origin}`;
  const html = `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;background:#f5f2e9;color:#12352c;font-family:Arial,Tahoma,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${c.intro} ${c.expiry}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2e9"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px"><tr><td align="center" style="padding:0 0 24px">
<img src="${image("logo", "/icons/nur-192.png")}" width="64" height="64" alt="Nūr" style="display:block;border:0;border-radius:18px"><div style="padding-top:12px;font-family:Georgia,serif;font-size:24px;letter-spacing:3px;color:#937028">NŪR</div></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3ddcc;border-radius:28px;padding:36px 24px;text-align:center">
<p style="margin:0 0 14px;color:#937028;font-size:11px;letter-spacing:${lang === "ar" ? "0" : "2px"};font-weight:bold">${c.eyebrow}</p>
<h1 style="margin:0 0 18px;font-family:${lang === "ar" ? "Tahoma,Arial,sans-serif" : "Georgia,serif"};font-size:28px;line-height:1.35;font-weight:normal">${c.title}</h1>
<p style="margin:0 0 26px;font-size:15px;line-height:1.8;color:#61746b">${c.intro}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:20px 8px;background:#f7f2e5;border:1px solid #d9c995;border-radius:18px;text-align:center">
<div style="font-size:12px;color:#68776e;margin-bottom:12px">${c.code}</div><div dir="ltr" style="font-family:Arial,sans-serif;font-size:36px;line-height:1.3;letter-spacing:7px;font-weight:bold;color:#173c30">${code}</div>
</td></tr></table>
<p style="margin:16px 0 24px;font-size:12px;color:#937028">${c.expiry}</p>
<p style="margin:0;font-size:13px;line-height:1.8;color:#61746b">${c.security}</p>
</td></tr><tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:1.8;color:#748077">
<p style="margin:0 0 20px">${c.ignore}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding:0 12px"><img src="${image("reading", "/icons/ui/play.png")}" width="18" height="18" alt="" style="vertical-align:middle;border:0"> ${c.reading}</td><td style="padding:0 12px"><img src="${image("favorites", "/icons/ui/heart.png")}" width="18" height="18" alt="" style="vertical-align:middle;border:0"> ${c.favorites}</td></tr></table>
<p style="margin:16px 0 10px">${c.footer}</p><a href="${site}" style="color:#937028;text-decoration:underline">${c.link}</a>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}

export function verificationMime(sender: string, recipient: string, code: string, language: unknown, appOrigin: string, images: EmailImage[] = []) {
  if ([sender, recipient].some(value => /[\r\n]/.test(value))) throw new Error("invalid_email");
  const { subject, text, html } = verificationEmail(code, language, appOrigin, images);
  const boundary = `nur-${crypto.randomUUID()}`, alternative = `${boundary}-alternative`;
  const content = (type: string, value: string) => `Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapped(value)}\r\n`;
  let message = `From: Nur <${sender}>\r\nTo: ${recipient}\r\nSubject: =?UTF-8?B?${base64(subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n--${alternative}\r\n${content("text/plain", text)}--${alternative}\r\n${content("text/html", html)}--${alternative}--\r\n`;
  for (const item of images) message += `--${boundary}\r\nContent-Type: image/png\r\nContent-ID: <${item.id}@nur>\r\nContent-Disposition: inline; filename="nur-${item.id}.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapped(item.data)}\r\n`;
  return `${message}--${boundary}--\r\n`;
}
