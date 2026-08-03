export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "L'assistant n'est pas encore configuré." }, { status: 503 });
  try {
    const body = await request.json() as { messages?: Array<{ role: "user" | "assistant"; content: string }>; attachment?: { label?: string; context?: string }; safetyId?: string };
    const messages = (body.messages || []).slice(-10).filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
    const attachment = body.attachment?.context ? `\n\nDOCUMENT CORANIQUE JOINT (${body.attachment.label || "passage"}) :\n${body.attachment.context.slice(0, 70000)}` : "";
    const instructions = `Tu es Fqih de Nūr, un outil éducatif consacré à l'islam. Réponds dans la langue de l'utilisateur. Distingue clairement le texte coranique, la traduction, le tafsir et l'avis juridique. Ne fabrique jamais de verset, hadith, source, numéro ou consensus. Si une référence précise n'est pas certaine, dis-le. Mentionne les divergences reconnues entre écoles quand elles sont pertinentes. Ne présente jamais ta réponse comme une fatwa et recommande un savant qualifié pour les décisions personnelles ou sensibles. Pour expliquer un passage joint, appuie-toi d'abord sur ce passage, donne le contexte avec prudence, les idées principales et les limites d'interprétation. Termine les réponses juridiques sensibles par : « Information éducative — pas une fatwa. »${attachment}`;
    const contents = messages.map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] }));
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents, generationConfig: { maxOutputTokens: 1400, temperature: 0.3 } }) });
    const data = await upstream.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!upstream.ok) return Response.json({ error: data.error?.message || "Réponse indisponible." }, { status: upstream.status });
    const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim();
    return Response.json({ answer: answer || "Je n'ai pas pu formuler une réponse fiable." }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "La requête n'a pas pu être traitée." }, { status: 400 });
  }
}
