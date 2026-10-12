export function recordVisit(surah?: number) {
  try {
    if (!navigator.onLine || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const day = new Date().toISOString().slice(0, 10), key = `nur-visit-${day}`;
    let visitor = sessionStorage.getItem(key);
    if (!visitor) { visitor = crypto.randomUUID(); sessionStorage.setItem(key, visitor); }
    const body = JSON.stringify({ page: location.pathname, surah, visitor, eventId: crypto.randomUUID() });
    void fetch("/api/analytics/event", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* Analytics never interrupt navigation. */ }
}
