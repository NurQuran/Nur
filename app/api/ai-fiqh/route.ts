export async function POST(request:Request){
 const apiKey=process.env.OPENAI_API_KEY;
 if(!apiKey)return Response.json({error:"L'assistant n'est pas encore configuré."},{status:503});
 try{
  const body=await request.json() as {messages?:Array<{role:"user"|"assistant";content:string}>;attachment?:{label?:string;context?:string};safetyId?:string};
  const messages=(body.messages||[]).slice(-10).filter(m=>(m.role==="user"||m.role==="assistant")&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,12000)}));
  const attachment=body.attachment?.context?"\n\nDOCUMENT CORANIQUE JOINT ("+(body.attachment.label||"passage")+") :\n"+body.attachment.context.slice(0,70000):"";
  const instructions="Tu es l'Assistant Fiqh de Nūr, un outil éducatif consacré à l'islam. Réponds dans la langue de l'utilisateur. Distingue clairement texte coranique, traduction, tafsir et avis juridique. Ne fabrique jamais de verset, hadith, source, numéro ou consensus. Si une référence précise n'est pas certaine, dis-le. Mentionne les divergences reconnues entre écoles quand elles sont pertinentes. Ne présente jamais ta réponse comme une fatwa et recommande un savant qualifié pour les décisions personnelles ou sensibles. Pour expliquer un passage joint, appuie-toi d'abord sur ce passage, donne le contexte avec prudence, les idées principales et les limites d'interprétation. Termine les réponses juridiques sensibles par : Information éducative — pas une fatwa."+attachment;
  const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+apiKey},body:JSON.stringify({model:"gpt-5.6-terra",instructions,input:messages,reasoning:{effort:"low"},text:{verbosity:"medium"},max_output_tokens:1400,safety_identifier:(body.safetyId||"nur-anonymous").slice(0,64)})});
  const data=await upstream.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>;error?:{message?:string}};
  if(!upstream.ok)return Response.json({error:data.error?.message||"Réponse indisponible."},{status:upstream.status});
  const answer=data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||"").join("\n").trim();
  return Response.json({answer:answer||"Je n'ai pas pu formuler une réponse fiable."},{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({error:"La requête n'a pas pu être traitée."},{status:400})}
}
