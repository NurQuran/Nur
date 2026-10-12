/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { accountApi, cleanupAccounts, hasAppAccess, type AccountEnv } from "./accountApi";
import { protectedPage } from "../lib/appEntry";
import { hadithApi } from "./hadithApi";

interface Env extends AccountEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
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
    const accountResponse = await accountApi(request, env, ctx);
    if (accountResponse) return accountResponse;
    const hadithResponse = await hadithApi(request);
    if (hadithResponse) return hadithResponse;

    if (protectedPage(url.pathname) || url.pathname === "/api/ai-fiqh") {
      if (url.pathname === "/api/ai-fiqh" && request.method === "POST" && request.headers.get("origin") !== (env.APP_ORIGIN ? new URL(env.APP_ORIGIN).origin : url.origin)) {
        return Response.json({ error: "invalid_origin" }, { status: 403, headers: { "cache-control": "no-store" } });
      }
      if (!await hasAppAccess(request, env)) {
        if (url.pathname === "/api/ai-fiqh") return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
        return new Response(null, { status: 303, headers: { location: `/welcome?login=1&next=${encodeURIComponent(url.pathname + url.search)}`, "cache-control": "no-store" } });
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

    const response = await handler.fetch(request, env, ctx);
    if (!protectedPage(url.pathname)) return response;
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupAccounts(env));
  },
};

export default worker;
