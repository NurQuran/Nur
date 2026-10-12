const protectedPages = new Set(["/read", "/assistant", "/home", "/favorites"]);
export function protectedPage(path: string) { return protectedPages.has(path.replace(/\/+$/, "").replace(/\.rsc$/, "")); }
export function safeEntryDestination(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  try {
    const url = new URL(value, "https://nur.invalid");
    return url.origin === "https://nur.invalid" && protectedPage(url.pathname) ? url.pathname.replace(/\.rsc$/, "") + url.search + url.hash : "/home";
  } catch { return "/home"; }
}
export function clientEntryAllowed(hasAccount: boolean, onboarded: string | null, guest: string | null) {
  return onboarded === "1" && (hasAccount || guest === "1");
}
