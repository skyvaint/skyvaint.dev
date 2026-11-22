// GET /api/stats?ids=1,2,3 — live Roblox numbers for the games section.
// Roblox's APIs don't allow browser requests from other sites, so this
// fetches them server-side and lets Vercel's CDN cache the answer for 60s.

module.exports = async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const ids = (url.searchParams.get("ids") || "").split(",").filter((id) => /^\d{1,15}$/.test(id)).slice(0, 20);
  res.setHeader("Content-Type", "application/json");
  if (!ids.length) { res.statusCode = 400; return res.end(JSON.stringify({ error: "No ids." })); }

  try {
    const q = ids.join(",");
    const get = (u) => fetch(u, { headers: { Accept: "application/json" } }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [games, votes] = await Promise.all([
      get(`https://games.roblox.com/v1/games?universeIds=${q}`),
      get(`https://games.roblox.com/v1/games/votes?universeIds=${q}`),
    ]);
    const v = new Map(votes.data.map((x) => [x.id, x]));
    const out = games.data.map((g) => ({
      id: g.id, name: g.name, playing: g.playing, visits: g.visits, favorites: g.favoritedCount,
      up: v.get(g.id)?.upVotes ?? null, down: v.get(g.id)?.downVotes ?? null, updated: g.updated,
    }));
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.statusCode = 200;
    res.end(JSON.stringify({ games: out, at: new Date().toISOString() }));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Roblox didn’t answer." }));
  }
};
