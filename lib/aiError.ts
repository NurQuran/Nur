export function workerRestarted(text: string) { return /worker restarted|mid-request|handle.*closing/i.test(text); }
export function readableAIError(text: string, language: "fr"|"en"|"ar") {
  if(workerRestarted(text))return language==="ar"?"أُعيد تشغيل الخدمة أثناء الطلب. يرجى المحاولة مجددًا.":language==="en"?"The service restarted during your request. Please try again.":"Le service a redémarré pendant la demande. Réessayez dans un instant.";
  if(/not.*configured|pas.*configuré/i.test(text))return language==="ar"?"لم يتم تفعيل فقيه في هذه النسخة بعد.":language==="en"?"Fqih has not been configured in this version yet.":"Fqih n’est pas encore configuré dans cette version.";
  if(/<!doctype|<html|internal server error/i.test(text))return language==="ar"?"الخدمة غير متاحة مؤقتًا. حاول مجددًا.":language==="en"?"The service is temporarily unavailable. Try again.":"Le service est temporairement indisponible. Réessayez.";
  return text;
}
