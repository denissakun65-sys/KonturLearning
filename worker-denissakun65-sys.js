// KONTUR AI — вставьте этот файл целиком в Cloudflare Workers editor.
// 1. GitHub-логин уже указан: denissakun65-sys.
// 2. Добавьте OPENAI_API_KEY как Secret в Settings → Variables and Secrets.
//    Ключ не добавляют в этот код и не публикуют на GitHub.

const ALLOWED_ORIGIN = "https://denissakun65-sys.github.io";
const MODEL = "gpt-4.1-mini";
const SYSTEM_INSTRUCTIONS = `Ты — «Контур», русскоязычный помощник образовательной платформы по OSINT, цифровой безопасности и устойчивости к социальной инженерии. Отвечай по-русски, ясно и структурированно. Помогай только с законным, защитным и уважительным к приватности обучением: верификацией открытых источников, цифровой гигиеной, распознаванием манипуляций и безопасным реагированием. Строго отказывайся давать инструкции, код или советы для несанкционированного доступа, обхода защит, кражи учётных данных, фишинга, предтекстинга, социальной инженерии против реальных людей, вредоносного ПО, деанонимизации, слежки, доксинга или эксплуатации уязвимостей. Кратко объясни причину отказа и предложи безопасную альтернативу. Не запрашивай и не повторяй пароли, токены, персональные данные, реальные цели или конфиденциальную информацию.`;

function headers(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function cleanMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-10).map(m => ({ role: m.role, content: m.content.trim().slice(0, 1800) })).filter(m => m.content);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: origin === ALLOWED_ORIGIN ? 204 : 403, headers: headers(ALLOWED_ORIGIN) });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/api/chat") return new Response("Not found", { status: 404 });
    if (origin !== ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: "Источник не разрешён." }), { status: 403, headers: { "Content-Type": "application/json" } });
    if (!env.OPENAI_API_KEY) return new Response(JSON.stringify({ error: "AI-сервис пока не настроен." }), { status: 503, headers: { "Content-Type": "application/json", ...headers(origin) } });
    let payload;
    try { payload = await request.json(); } catch { return new Response(JSON.stringify({ error: "Некорректный запрос." }), { status: 400, headers: { "Content-Type": "application/json", ...headers(origin) } }); }
    const input = cleanMessages(payload.messages);
    if (!input.length) return new Response(JSON.stringify({ error: "Добавьте вопрос." }), { status: 400, headers: { "Content-Type": "application/json", ...headers(origin) } });
    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, instructions: SYSTEM_INSTRUCTIONS, input, stream: true, max_output_tokens: 700, temperature: 0.35 })
    });
    if (!ai.ok || !ai.body) return new Response(JSON.stringify({ error: "AI-сервис временно недоступен." }), { status: 502, headers: { "Content-Type": "application/json", ...headers(origin) } });
    return new Response(ai.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", ...headers(origin) } });
  }
};
