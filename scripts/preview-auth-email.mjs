// Local visual preview only: does not access Gmail, secrets or account data.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const project = new URL("../", import.meta.url);
const result = await build({ absWorkingDir: fileURLToPath(project), entryPoints: ["worker/authEmail.ts"], tsconfigRaw: {}, bundle: true, write: false, platform: "node", format: "esm" });
const { verificationEmail } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const assets = new Set(["/icons/nur-192.png", "/icons/ui/play.png", "/icons/ui/heart.png"]);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost:3011").pathname;
  try {
    if (assets.has(path)) {
      response.setHeader("content-type", "image/png");
      response.end(await readFile(new URL(`public${path}`, project)));
    } else if (["/", "/fr", "/en", "/ar"].includes(path)) {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(verificationEmail("012345", path.slice(1) || "fr", "https://nur.example").html.replaceAll("https://nur.example", "http://localhost:3011"));
    } else { response.writeHead(404).end(); }
  } catch { response.writeHead(500).end("Preview unavailable"); }
});
server.listen(3011, "127.0.0.1", () => console.log("Local email preview: http://localhost:3011/fr (also /en and /ar)"));
