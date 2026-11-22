// POST /api/commission — validates a commission request and forwards it to Discord.
// The webhook URL lives only in the DISCORD_WEBHOOK_URL environment variable
// (Vercel → Project → Settings → Environment Variables, or .env locally).

const TYPES = ["Full game", "UI frames", "Scripting system", "Liveops", "Investment", "Other"];
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?skyvaint\.com$/, /^https:\/\/[\w-]+\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map(); // best effort per warm instance

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
// stop @everyone / role / user pings and keep markdown links from being clickable bait
const tame = (v) => v.replace(/@(everyone|here)/gi, "@​$1").replace(/<@[!&]?\d+>/g, "[mention]").replace(/\]\(/g, "]​(");

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) throw new Error("too large"); }
  return JSON.parse(raw || "{}");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Method not allowed." }); }

  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) return send(res, 403, { error: "Forbidden." });

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook || !/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(webhook)) {
    return send(res, 503, { error: "The form isn’t configured yet." });
  }

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "Bad request." }); }

  // Bots: honeypot filled or submitted faster than a human could type → pretend it worked.
  if (body.website || Number(body.t) < 3000) return send(res, 200, { ok: true });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return send(res, 429, { error: "Too many requests — try again in a few minutes." });

  const data = {
    name: clean(body.name, 60),
    discord: clean(body.discord, 40),
    type: clean(body.type, 40),
    budget: clean(body.budget, 40),
    timeline: clean(body.timeline, 40),
    link: clean(body.link, 200),
    details: clean(body.details, 1500),
  };
  if (!/^[\w.]{2,32}(#\d{4})?$/.test(data.discord)) return send(res, 400, { error: "Add a valid Discord username." });
  if (!TYPES.includes(data.type)) return send(res, 400, { error: "Pick a project type." });
  if (data.details.length < 20) return send(res, 400, { error: "Tell me a bit more about the project." });
  if (data.link && !/^https?:\/\/\S+$/i.test(data.link)) return send(res, 400, { error: "That link doesn’t look right." });

  const fields = [
    { name: "Discord", value: "`" + data.discord + "`", inline: true },
    { name: "Type", value: data.type, inline: true },
    { name: "Budget", value: data.budget || "Not sure yet", inline: true },
    { name: "Timeline", value: data.timeline || "Flexible", inline: true },
  ];
  if (data.name) fields.unshift({ name: "Name", value: tame(data.name), inline: true });
  if (data.link) fields.push({ name: "Link", value: data.link, inline: false });

  const who = "@" + data.discord + (data.name ? ` (${tame(data.name)})` : "");
  const payload = {
    username: "skyvaint.com",
    content: `**New ${data.type === "Investment" ? "investment inquiry" : "request"} from ${who}**`,
    allowed_mentions: { parse: [] },
    embeds: [{
      author: { name: who },
      title: data.type === "Investment" ? "💰 New investment inquiry" : "⚡ New commission request",
      description: tame(data.details),
      color: 0xffd23f,
      fields,
      footer: { text: "Sent from skyvaint.com" },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const r = await fetch(webhook + (webhook.includes("?") ? "&" : "?") + "wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return send(res, 502, { error: "Couldn’t deliver the message right now." });
  } catch {
    return send(res, 502, { error: "Couldn’t deliver the message right now." });
  }

  recent.push(now);
  hits.set(ip, recent);
  return send(res, 200, { ok: true });
};
