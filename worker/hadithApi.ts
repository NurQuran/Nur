import { hadithBooks } from "../lib/hadith";
export async function hadithApi(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/hadith/")) return null;
  // Fixed allowlists: never proxy an arbitrary URL or edition.
  const match = path.match(/^\/api\/hadith\/([a-z]+)\/(ar|en|fr)\/(meta|\d{1,3})$/);
  const book = hadithBooks.find(item => item.id === match?.[1]);
  if (request.method !== "GET" || !match || !book || (match[2] === "fr" && !book.french)) return Response.json({ error: "invalid_hadith_request" }, { status: 400 });
  const chapter = match[3];
  if (chapter !== "meta" && (+chapter < 1 || +chapter > 150)) return Response.json({ error: "invalid_chapter" }, { status: 400 });
  const edition = `${({ ar: "ara", en: "eng", fr: "fra" })[match[2] as "ar" | "en" | "fr"]}-${book.id}`;
  const endpoint = chapter === "meta" ? "info" : `editions/${edition}/sections/${chapter}`;
  for (const root of ["https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/", "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/"]) {
    try {
      const response = await fetch(`${root}${endpoint}.json`, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" }, cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
      if (!response.ok) continue;
      const data = await response.json() as Record<string, { metadata?: unknown }>;
      const result = chapter === "meta" ? data[book.id]?.metadata : data;
      if (!result) continue;
      return Response.json(result, { headers: { "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
    } catch { /* Independently hosted fallback. */ }
  }
  return Response.json({ error: "hadith_source_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
}
