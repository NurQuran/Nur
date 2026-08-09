/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OPENAI_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai-fiqh") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (!env.OPENAI_API_KEY) return Response.json({ error: "L'assistant n'est pas encore configuré." }, { status: 503 });
      try {
        const body = await request.json() as { messages?: Array<{ role: "user" | "assistant"; content: string }>; attachment?: { label?: string; context?: string }; safetyId?: string };
        const messages = (body.messages || []).slice(-10).filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
        const attachment = body.attachment?.context ? `\n\nDOCUMENT CORANIQUE JOINT PAR L'UTILISATEUR (${body.attachment.label || "passage"}) :\n${body.attachment.context.slice(0, 70000)}` : "";
        const instructions = `Tu es l'Assistant Fiqh de Nūr, un outil éducatif consacré à l'islam. Réponds dans la langue de l'utilisateur. Distingue clairement le texte coranique, la traduction, le tafsir et l'avis juridique. Ne fabrique jamais de verset, hadith, source, numéro ou consensus. Si une référence précise n'est pas certaine, dis-le. Mentionne les divergences reconnues entre écoles quand elles sont pertinentes. Ne présente jamais ta réponse comme une fatwa et recommande un savant qualifié pour les décisions personnelles ou sensibles. Pour expliquer un passage joint, appuie-toi d'abord sur ce passage, donne le contexte avec prudence, les idées principales et les limites d'interprétation. Tu peux structurer la réponse avec un Markdown léger et lisible : titres courts, listes, **gras** et *italique*. N'utilise cette mise en forme que lorsqu'elle facilite la lecture. Termine les réponses juridiques sensibles par : « Information éducative — pas une fatwa. »${attachment}`;
        const upstream = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: "gpt-5.6-terra", instructions, input: messages, reasoning: { effort: "low" }, text: { verbosity: "medium" }, max_output_tokens: 1400, safety_identifier: (body.safetyId || "nur-anonymous").slice(0, 64) })
        });
        const data = await upstream.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
        if (!upstream.ok) return Response.json({ error: data.error?.message || "Réponse indisponible." }, { status: upstream.status });
        const answer = data.output_text || data.output?.flatMap(item => item.content || []).map(item => item.text || "").join("\n").trim();
        return Response.json({ answer: answer || "Je n'ai pas pu formuler une réponse fiable." }, { headers: { "cache-control": "no-store" } });
      } catch {
        return Response.json({ error: "La requête n'a pas pu être traitée." }, { status: 400 });
      }
    }

    const warshMatch = url.pathname.match(/^\/api\/warsh\/(\d{1,3})$/);
    if (warshMatch) {
      const surah = Number(warshMatch[1]);
      if (surah < 1 || surah > 114) return new Response("Invalid surah", { status: 400 });
      try {
        const upstream = await fetch(`https://api.quranpedia.net/v1/mushafs/4/${surah}`, { headers: { Accept: "application/json" } });
        if (!upstream.ok) return new Response("Warsh source unavailable", { status: 502 });
        return new Response(upstream.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=86400" } });
      } catch {
        return new Response("Warsh source unavailable", { status: 502 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
