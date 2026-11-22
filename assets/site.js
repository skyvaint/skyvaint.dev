"use strict";
/* ==========================================================================
   skyvaint — page logic: content rendering, live Roblox stats, gallery,
   commission form, title screen, reveals. Effects/sound live in fx.js.
   ========================================================================== */

const P = window.Portfolio;
const { Sound } = FX;
const root = document.documentElement;
const $ = (s, scope = document) => scope.querySelector(s);
const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
const svgNS = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function safeURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ["https:", "http:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}
function outLink(label, href, className) {
  const a = el("a", className);
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  a.append(el("span", null, label));
  return a;
}
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");
const fmt = {
  compact: (n) => (n == null ? "—" : compact.format(n)),
  full: (n) => (n == null ? "—" : full.format(Math.round(n))),
  pct: (n) => (n == null ? "—" : Math.round(n) + "%"),
};

/* Count a number up/down to its new value. */
function tween(node, to, format) {
  const from = Number(node.dataset.n || 0);
  node.dataset.n = to;
  if (FX.motionOff() || from === to) { node.textContent = format(to); return; }
  const start = performance.now(), dur = 1300;
  (function step(now) {
    const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 4);
    node.textContent = format(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  })(start);
}

function youtubeId(value) {
  const url = safeURL(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  const id = host === "youtu.be" ? url.pathname.slice(1)
    : /youtube(-nocookie)?\.com$/.test(host) ? url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] : null;
  return /^[\w-]{11}$/.test(id || "") ? id : null;
}
const isVideoFile = (v) => /\.(mp4|webm)$/i.test(v || "");

/* ==========================================================================
   Games
   ========================================================================== */
const gameRefs = new Map();
// Roblox thumbnails saved in assets/games/<universeId>-<n>.webp (set `thumbs` if a game has fewer than 3)
const thumbsOf = (g) => Array.from({ length: g.thumbs || 3 }, (_, i) => `assets/games/${g.universeId}-${i + 1}.webp`);

/* Upcoming game: banner, UPCOMING badge, Invest + follow buttons, no stats. */
function renderUpcoming(g, grid) {
  const card = el("article", "game-card is-upcoming reveal");
  const inner = el("div", "game-inner");
  const media = el("div", "game-media");
  media.dataset.cursor = "Invest";
  const img = el("img"); img.src = g.banner; img.alt = `${g.name} banner`; img.loading = "lazy"; img.decoding = "async";
  media.append(img, el("span", "upcoming-tag", "Upcoming"));
  const swoosh = el("img", "swoosh"); swoosh.src = "assets/vfx/swoosh.webp"; swoosh.alt = ""; swoosh.loading = "lazy";
  media.append(swoosh);
  const body = el("div", "game-body");
  const head = el("div", "game-head");
  const icon = el("img", "game-icon"); icon.src = `assets/games/${g.universeId}-icon.webp`; icon.alt = ""; icon.width = 64; icon.height = 64; icon.loading = "lazy";
  icon.addEventListener("error", () => icon.remove(), { once: true });
  const titles = el("div");
  const role = el("p", "game-role", g.role);
  if (g.studio) role.append(el("span", null, " · " + g.studio));
  titles.append(el("h3", "game-name", g.name), role);
  head.append(icon, titles);
  const genre = el("div", "genre");
  (g.genre || []).forEach((x) => genre.append(el("i", null, x)));
  const foot = el("div", "game-foot");
  const invest = el("button", "btn btn-gold btn-sm"); invest.type = "button"; invest.append(el("span", null, "Invest"));
  invest.addEventListener("click", () => prefill("Investment", `I'm interested in investing in ${g.name}.\n\n`));
  media.addEventListener("click", () => invest.click());
  foot.append(invest, outLink("Follow on Roblox", `https://www.roblox.com/games/${g.placeId}`, "btn btn-ghost btn-sm"));
  body.append(head, genre, el("p", "game-blurb", g.blurb), foot);
  inner.append(media, body);
  card.append(inner);
  grid.append(card);
  upcomingCards.push(card);
}
const upcomingCards = [];

/* Order: games with players (most first) → upcoming banner → games at 0 players (smaller).
   Sizes are picked so every row of the 6-column grid is filled. */
const narrowGrid = matchMedia("(max-width: 1080px)");
function sizeRow(cards, perRow) {
  cards.forEach((c) => c.classList.remove("span-2", "span-3", "span-6"));
  const n = cards.length;
  if (!n) return;
  if (narrowGrid.matches) perRow = 2; // tablet: two per row, odd one out goes full width
  if (perRow === 2) {
    cards.forEach((c) => c.classList.add("span-3"));
    if (n % 2) {
      if (n >= 3 && !narrowGrid.matches) cards.slice(-3).forEach((c) => { c.classList.remove("span-3"); c.classList.add("span-2"); });
      else cards[n - 1].classList.replace("span-3", "span-6");
    }
  } else {
    cards.forEach((c) => c.classList.add("span-2"));
    const r = n % 3;
    if (r === 2) cards.slice(-2).forEach((c) => c.classList.replace("span-2", "span-3"));
    if (r === 1) {
      if (n >= 4) cards.slice(-4).forEach((c) => c.classList.replace("span-2", "span-3"));
      else cards[n - 1].classList.replace("span-2", "span-6");
    }
  }
}
function arrangeGames(stats) {
  const grid = $("#game-grid");
  const rows = [...gameRefs.values()].map((ref) => ({ ref, s: stats.get(ref.g.universeId) || ref.g.snapshot || {} }));
  const active = rows.filter((x) => (x.s.playing || 0) > 0).sort((a, b) => b.s.playing - a.s.playing);
  const idle = rows.filter((x) => !(x.s.playing > 0)).sort((a, b) => (b.s.visits || 0) - (a.s.visits || 0));
  active.forEach((x) => x.ref.card.classList.remove("is-compact"));
  idle.forEach((x) => x.ref.card.classList.add("is-compact"));
  sizeRow(active.map((x) => x.ref.card), 2);
  sizeRow(idle.map((x) => x.ref.card), 3);
  const order = [...active.map((x) => x.ref.card), ...upcomingCards, ...idle.map((x) => x.ref.card)];
  const current = [...grid.children];
  if (order.some((c, i) => current[i] !== c)) order.forEach((c) => grid.append(c));
}

function renderGames() {
  const grid = $("#game-grid");
  for (const g of P.games) {
    if (g.status === "upcoming") { renderUpcoming(g, grid); continue; }
    const card = el("article", "game-card reveal");
    const inner = el("div", "game-inner");

    const media = el("div", "game-media");
    media.tabIndex = 0;
    media.setAttribute("role", "button");
    media.setAttribute("aria-label", `Open ${g.name} details`);
    media.dataset.cursor = g.trailer ? "Play" : "View";
    if (isVideoFile(g.trailer)) {
      const v = el("video");
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: "none" });
      v.dataset.src = g.trailer;
      v.poster = thumbsOf(g)[0];
      media.append(v);
    } else {
      thumbsOf(g).forEach((src, i) => {
        const img = el("img", "slide" + (i === 0 ? " on" : ""));
        img.src = src; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        img.addEventListener("error", () => img.remove(), { once: true });
        media.append(img);
      });
      if (youtubeId(g.trailer)) media.append(Object.assign(el("span", "play-chip", "▶"), { ariaHidden: "true" }));
    }
    const swoosh = el("img", "swoosh"); swoosh.src = "assets/vfx/swoosh.webp"; swoosh.alt = ""; swoosh.loading = "lazy";
    media.append(swoosh);

    const badges = el("div", "game-badges");
    const left = el("div");
    const live = el("span", "live-pill");
    const liveNum = el("b", null, "—");
    live.append(el("i", "live-dot"), liveNum, document.createTextNode(" playing"));
    badges.append(left, live);
    media.append(badges);

    const body = el("div", "game-body");
    const head = el("div", "game-head");
    const icon = el("img", "game-icon"); icon.src = `assets/games/${g.universeId}-icon.webp`; icon.alt = ""; icon.width = 64; icon.height = 64; icon.loading = "lazy";
    const titles = el("div");
    const role = el("p", "game-role", g.role);
    if (g.studio) role.append(el("span", null, " · " + g.studio));
    titles.append(el("h3", "game-name", g.name), role);
    head.append(icon, titles);

    const stats = el("div", "game-stats");
    const stat = (label, cls) => { const s = el("div", "gstat" + (cls ? " " + cls : "")); const b = el("b", null, "—"); s.append(el("span", null, label), b); stats.append(s); return b; };
    const visits = stat("Visits"), favs = stat("Favorites"), peak = stat(g.peakCcu ? "Peak CCU" : "Status", "is-peak");
    peak.textContent = g.peakCcu ? fmt.compact(g.peakCcu) : (g.ccuNote || "—");
    if (!g.peakCcu) peak.style.fontSize = "16px";

    const hp = el("div", "hp");
    const hpTop = el("div", "hp-top"); const rating = el("b", null, "—");
    hpTop.append(el("span", null, "Player rating"), rating);
    const bar = el("div", "hp-bar"); const fill = el("i"); bar.append(fill);
    hp.append(hpTop, bar);

    const foot = el("div", "game-foot");
    foot.append(outLink("Play ▶", `https://www.roblox.com/games/${g.placeId}`, "btn btn-gold btn-sm"));
    const more = el("button", "btn btn-ghost btn-sm"); more.type = "button"; more.append(el("span", null, "Details"));
    foot.append(more);

    body.append(head);
    if (g.blurb) body.append(el("p", "game-blurb", g.blurb));
    body.append(stats, hp, foot);
    inner.append(media, body);
    card.append(inner);
    grid.append(card);

    const open = () => openGame(g);
    media.addEventListener("click", open);
    media.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    more.addEventListener("click", open);
    gameRefs.set(g.universeId, { g, card, media, live, liveNum, visits, favs, rating, fill });
  }
}

/* Slideshows: rotate thumbnails while a card is on screen. */
const onScreen = new Set();
const slideObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const media = e.target;
    if (e.isIntersecting) onScreen.add(media); else onScreen.delete(media);
    const v = media.querySelector("video");
    if (!v) continue;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!FX.motionOff()) v.play().catch(() => {}); }
    else v.pause();
  }
}, { threshold: .35 });
setInterval(() => {
  if (document.hidden || FX.motionOff()) return;
  for (const media of onScreen) {
    const slides = $$(".slide", media);
    if (slides.length < 2) continue;
    const i = slides.findIndex((s) => s.classList.contains("on"));
    slides[i]?.classList.remove("on");
    slides[(i + 1) % slides.length].classList.add("on");
  }
}, 3600);

/* Live stats: own API (Vercel) → public CORS proxy → saved snapshot. */
const statGames = P.games.filter((g) => g.status !== "upcoming");
const ids = statGames.map((g) => g.universeId).join(",");
async function getJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function fetchStats() {
  try {
    const d = await getJSON(`/api/stats?ids=${ids}`);
    if (Array.isArray(d.games) && d.games.length) return { games: d.games, live: true };
  } catch {}
  try {
    const [g, v] = await Promise.all([
      getJSON(`https://games.roproxy.com/v1/games?universeIds=${ids}`),
      getJSON(`https://games.roproxy.com/v1/games/votes?universeIds=${ids}`).catch(() => ({ data: [] })),
    ]);
    const snap = new Map(statGames.map((x) => [x.universeId, x.snapshot]));
    const votes = new Map(v.data.map((x) => [x.id, x]));
    for (const [id, s] of snap) if (!votes.has(id)) votes.set(id, { upVotes: s.up, downVotes: s.down });
    return {
      live: true,
      games: g.data.map((x) => ({ id: x.id, playing: x.playing, visits: x.visits, favorites: x.favoritedCount, up: votes.get(x.id)?.upVotes ?? null, down: votes.get(x.id)?.downVotes ?? null })),
    };
  } catch {}
  return { live: false, games: statGames.map((g) => ({ id: g.universeId, ...g.snapshot })) };
}

let lastStats = null;
function applyStats({ games, live }) {
  lastStats = new Map(games.map((s) => [Number(s.id), s]));
  let playing = 0, visits = 0;
  for (const [id, ref] of gameRefs) {
    const s = lastStats.get(id);
    if (!s) continue;
    playing += s.playing || 0; visits += s.visits || 0;
    tween(ref.liveNum, s.playing || 0, fmt.full);
    ref.live.classList.toggle("is-zero", !s.playing);
    tween(ref.visits, s.visits || 0, fmt.compact);
    tween(ref.favs, s.favorites || 0, fmt.compact);
    const total = (s.up || 0) + (s.down || 0);
    const pct = total ? (s.up / total) * 100 : null;
    ref.rating.textContent = fmt.pct(pct);
    ref.fill.style.setProperty("--v", (pct ?? 0) + "%");
  }
  arrangeGames(lastStats);
  for (const node of $$('[data-live="totalPlaying"]')) tween(node, playing, fmt.full);
  for (const node of $$('[data-live="totalVisits"]')) tween(node, visits, (n) => fmt.compact(n) + "+");
  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  for (const node of $$('[data-live="updated"]')) node.textContent = live ? `Updated ${stamp} · refreshes every minute.` : "Showing saved numbers — Roblox didn’t answer.";
}
async function refreshStats() { applyStats(await fetchStats()); }
narrowGrid.addEventListener?.("change", () => { if (lastStats) arrangeGames(lastStats); });

/* Game details dialog */
const gameDialog = $("#game-dialog");
const gameDialogTitle = $("#game-dialog-title");
const gameDialogContent = $("#game-dialog-content");
function openGame(g) {
  Sound.teleport();
  gameDialogTitle.textContent = g.name;
  gameDialogContent.replaceChildren();
  const media = el("div", "dlg-media");
  const yt = youtubeId(g.trailer);
  if (yt) {
    const f = el("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&rel=0`;
    f.title = `${g.name} trailer`; f.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media"; f.allowFullscreen = true;
    media.append(f);
  } else if (isVideoFile(g.trailer)) {
    const v = el("video"); Object.assign(v, { controls: true, autoplay: true, muted: true, playsInline: true, src: g.trailer });
    media.append(v);
  } else {
    const big = el("img"); big.src = thumbsOf(g)[0]; big.alt = `${g.name} thumbnail`;
    media.append(big);
  }
  gameDialogContent.append(media);
  if (!yt && !isVideoFile(g.trailer)) {
    const row = el("div", "dlg-thumbs");
    thumbsOf(g).forEach((src, i) => {
      const b = el("button"); b.type = "button"; b.className = i === 0 ? "on" : ""; b.setAttribute("aria-label", `Thumbnail ${i + 1}`);
      const im = el("img"); im.src = src; im.alt = "";
      im.addEventListener("error", () => b.remove(), { once: true });
      b.append(im);
      b.addEventListener("click", () => { media.querySelector("img").src = src; $$("button", row).forEach((x) => x.classList.toggle("on", x === b)); });
      row.append(b);
    });
    gameDialogContent.append(row);
  }
  const s = lastStats?.get(g.universeId) || { ...g.snapshot };
  const total = (s.up || 0) + (s.down || 0);
  const stats = el("div", "dlg-stats");
  [["Playing", fmt.full(s.playing)], ["Visits", fmt.compact(s.visits)], ["Favorites", fmt.compact(s.favorites)], ["Rating", fmt.pct(total ? (s.up / total) * 100 : null)], [g.peakCcu ? "Peak CCU" : "Status", g.peakCcu ? fmt.compact(g.peakCcu) : g.ccuNote || "—"]]
    .forEach(([k, v]) => { const d = el("div", "gstat"); d.append(el("span", null, k), el("b", null, v)); stats.append(d); });
  const role = el("p", "game-role", g.role + (g.studio ? " · " + g.studio : ""));
  const actions = el("div", "dlg-actions");
  actions.append(outLink("Play on Roblox ▶", `https://www.roblox.com/games/${g.placeId}`, "btn btn-gold"));
  const hire = el("a", "btn btn-ghost"); hire.href = "#commission"; hire.append(el("span", null, "Build one with me"));
  hire.addEventListener("click", () => gameDialog.close());
  actions.append(hire);
  gameDialogContent.append(role, el("p", null, g.blurb), stats, actions);
  if (!gameDialog.open) gameDialog.showModal();
}
$(".dialog-close", gameDialog).addEventListener("click", () => gameDialog.close());
gameDialog.addEventListener("click", (e) => { if (e.target === gameDialog) gameDialog.close(); });
gameDialog.addEventListener("close", () => gameDialogContent.replaceChildren());

/* ==========================================================================
   UI gallery + lightbox
   ========================================================================== */
const SHOWN = 9;
function renderUI() {
  const grid = $("#ui-grid");
  P.ui.forEach((item, i) => {
    const b = el("button", "ui-item reveal" + (i >= SHOWN ? " is-extra" : ""));
    b.type = "button"; b.dataset.cursor = "View";
    b.setAttribute("aria-label", `Open ${item.alt}`);
    const img = el("img"); img.src = item.thumb || item.src; img.alt = item.alt; img.loading = "lazy"; img.decoding = "async";
    b.append(img);
    b.addEventListener("click", () => openLightbox(i));
    grid.append(b);
  });
  const more = $("#ui-more");
  const label = $("span", more);
  if (P.ui.length <= SHOWN) more.hidden = true;
  label.textContent = `Show all ${P.ui.length}`;
  more.addEventListener("click", () => {
    const open = grid.classList.toggle("show-all");
    label.textContent = open ? "Show less" : `Show all ${P.ui.length}`;
    if (open) $$(".ui-item.is-extra", grid).forEach((n) => n.classList.add("in"));
    else $("#ui").scrollIntoView({ behavior: FX.motionOff() ? "auto" : "smooth" });
    Sound.whoosh();
  });
}
const lightbox = $("#lightbox");
const lbImg = $(".lb-figure img", lightbox);
const lbCap = $(".lb-figure figcaption", lightbox);
let lbIndex = 0;
function showLightbox(i) {
  lbIndex = (i + P.ui.length) % P.ui.length;
  const item = P.ui[lbIndex];
  lbImg.src = item.src; lbImg.alt = item.alt;
  lbImg.style.animation = "none"; void lbImg.offsetWidth; lbImg.style.animation = "";
  lbCap.textContent = `${String(lbIndex + 1).padStart(2, "0")} / ${String(P.ui.length).padStart(2, "0")}`;
}
function openLightbox(i) { showLightbox(i); if (!lightbox.open) lightbox.showModal(); Sound.teleport(); }
$(".lb-close", lightbox).addEventListener("click", () => lightbox.close());
$(".lb-prev", lightbox).addEventListener("click", () => { showLightbox(lbIndex - 1); Sound.hover(); });
$(".lb-next", lightbox).addEventListener("click", () => { showLightbox(lbIndex + 1); Sound.hover(); });
lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.classList.contains("lb-figure")) lightbox.close(); });
lightbox.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showLightbox(lbIndex - 1);
  if (e.key === "ArrowRight") showLightbox(lbIndex + 1);
});
let swipeX = null;
lightbox.addEventListener("pointerdown", (e) => { swipeX = e.clientX; });
lightbox.addEventListener("pointerup", (e) => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 50) showLightbox(lbIndex + (dx < 0 ? 1 : -1));
});

/* ==========================================================================
   Programming — arts cards, all custom requests
   ========================================================================== */
const artIcons = {
  STRIKE: '<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/>',
  BLAST: '<circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  SPECIAL: '<path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill="currentColor"/>',
  ULTIMATE: '<path d="M12 2 22 12 12 22 2 12z" fill="currentColor"/><path d="M12 7 17 12 12 17 7 12z" fill="#fff" opacity=".5"/>',
  ABILITY: '<path d="m12 2 8.7 5v10L12 22l-8.7-5V7z" fill="currentColor"/><path d="M12 7v10M7.5 9.5l9 5M16.5 9.5l-9 5" stroke="#fff" stroke-width="1.5" opacity=".6"/>',
};

/* ==========================================================================
   Studios, tools, socials
   ========================================================================== */
function renderExtras() {
  const tl = $("#timeline");
  for (const s of P.studios) {
    const li = el("li", "reveal");
    li.append(el("span", "tl-when", s.when), el("h3", null, s.name), el("span", "tl-role", s.role), el("p", null, s.desc));
    tl.append(li);
  }
  loadDiscord();
  const socials = $("#socials");
  [["Discord", "assets/icons/discord.svg", P.contact.discord], ["Roblox", "assets/icons/roblox.svg", P.contact.roblox], ["X", "assets/icons/x.svg", P.contact.x]].forEach(([name, icon, c]) => {
    if (!c?.url) return;
    const li = el("li"); const a = el("a"); a.href = c.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    const img = el("img"); img.src = icon; img.alt = "";
    a.append(img, el("strong", null, name), el("span", null, "@" + c.handle));
    li.append(a); socials.append(li);
  });
  $("#year").textContent = new Date().getFullYear();
}

/* Discord card: names/avatar refresh live from japi.rest (a public Discord
   user lookup); the files in assets/discord/ stay as the fallback. */
async function loadDiscord() {
  const d = P.discordProfile;
  if (!d) return;
  const clanText = $(".dc-clan").lastChild;
  $(".dc-name").textContent = d.globalName || d.username;
  $(".dc-user").textContent = "@" + d.username;
  if (d.about) $(".dc-about").textContent = d.about;
  if (d.clanTag) clanText.textContent = d.clanTag;
  $(".dc-link").href = `https://discord.com/users/${d.id}`;
  try {
    const r = await fetch(`https://japi.rest/discord/v1/user/${d.id}`);
    if (!r.ok) return;
    const u = (await r.json()).data;
    if (!u) return;
    $(".dc-name").textContent = u.global_name || u.username;
    $(".dc-user").textContent = "@" + u.username;
    if (u.avatar && /^\w+$/.test(u.avatar)) {
      const ext = u.avatar.startsWith("a_") ? "gif" : "webp";
      const av = $(".dc-avatar .av");
      const next = new Image();
      next.onload = () => { av.src = next.src; };
      next.src = `https://cdn.discordapp.com/avatars/${d.id}/${u.avatar}.${ext}?size=160`;
    }
    const tag = u.primary_guild?.tag || u.clan?.tag;
    if (tag) clanText.textContent = tag;
  } catch {}
}

/* ==========================================================================
   Commission form → /api/commission → Discord webhook (server side)
   ========================================================================== */
const form = $("#commission-form");
const status = $(".form-status", form);
const shownAt = Date.now();
const details = form.elements.details;
const counter = $(".count b", form);
details.addEventListener("input", () => { counter.textContent = details.value.length; });

function prefill(type, text) {
  form.elements.type.value = type;
  if (text && !details.value.startsWith(text.trim())) details.value = text + details.value;
  counter.textContent = details.value.length;
  $("#commission").scrollIntoView({ behavior: FX.motionOff() ? "auto" : "smooth" });
  setTimeout(() => details.focus({ preventScroll: true }), 650);
  Sound.whoosh();
}
$$("[data-request]").forEach((b) => b.addEventListener("click", () => prefill(b.dataset.request, "")));

function setStatus(text, isError, html) {
  status.classList.toggle("is-error", !!isError);
  if (html) status.innerHTML = html; else status.textContent = text;
}
function validate() {
  const f = form.elements;
  const bad = [];
  const discord = f.discord.value.trim();
  if (!/^[\w.]{2,32}(#\d{4})?$/.test(discord)) bad.push([f.discord, "Add your Discord username so I can reply."]);
  if (!f.type.value) bad.push([f.type, "Pick a project type."]);
  if (f.link.value.trim() && !safeURL(f.link.value.trim())) bad.push([f.link, "That link doesn’t look right."]);
  if (details.value.trim().length < 20) bad.push([details, "Tell me a bit more (20+ characters)."]);
  $$(".field", form).forEach((x) => x.classList.remove("is-bad"));
  bad.forEach(([input]) => input.closest(".field").classList.add("is-bad"));
  if (bad.length) { bad[0][0].focus(); setStatus(bad[0][1], true); Sound.error(); return false; }
  return true;
}
const discordFallback = `<a href="${P.contact.discord.url}" target="_blank" rel="noopener noreferrer">message me on Discord (@${P.contact.discord.handle})</a>`;
/* Static hosting (GitHub Pages) has no /api route, so the form posts to Discord
   directly through the scrambled relay in assets/relay.js. */
const RATE_KEY = "sky-sent";
function rateLimited() {
  const now = Date.now();
  const recent = JSON.parse(localStorage.getItem(RATE_KEY) || "[]").filter((t) => now - t < 10 * 60 * 1000);
  return recent.length >= 3;
}
function markSent() {
  const now = Date.now();
  const recent = JSON.parse(localStorage.getItem(RATE_KEY) || "[]").filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  localStorage.setItem(RATE_KEY, JSON.stringify(recent));
}
const tame = (v) => v.replace(/@(everyone|here)/gi, "@\u200b$1").replace(/<@[!&]?\d+>/g, "[mention]").replace(/\]\(/g, "]\u200b(");
async function sendDirect(p) {
  if (typeof window.Relay !== "function") throw Object.assign(new Error("offline"), { offline: true });
  const fields = [
    { name: "Discord", value: "`" + p.discord + "`", inline: true },
    { name: "Type", value: p.type, inline: true },
    { name: "Budget", value: p.budget || "Not sure yet", inline: true },
    { name: "Timeline", value: p.timeline || "Flexible", inline: true },
  ];
  if (p.name) fields.unshift({ name: "Name", value: tame(p.name.slice(0, 60)), inline: true });
  if (p.link) fields.push({ name: "Link", value: p.link.slice(0, 200), inline: false });
  const who = "@" + p.discord + (p.name ? ` (${tame(p.name.slice(0, 60))})` : "");
  const body = {
    username: "skyvaint.com",
    content: `**New ${p.type === "Investment" ? "investment inquiry" : "request"} from ${who}**`,
    allowed_mentions: { parse: [] },
    embeds: [{
      author: { name: who },
      title: p.type === "Investment" ? "💰 New investment inquiry" : "⚡ New commission request",
      description: tame(p.details.slice(0, 1500)),
      color: 0xffffff,
      fields,
      footer: { text: "Sent from skyvaint.com" },
      timestamp: new Date().toISOString(),
    }],
  };
  const r = await fetch(window.Relay() + "?wait=true", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status === 429) throw new Error("Too many requests — try again in a minute.");
  if (!r.ok) throw new Error("Couldn’t deliver the message right now.");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (form.classList.contains("is-sending") || !validate()) return;
  const f = form.elements;
  const payload = {
    name: f.name.value.trim(), discord: f.discord.value.trim(), type: f.type.value, budget: f.budget.value,
    timeline: f.timeline.value, link: f.link.value.trim(), details: details.value.trim(), website: f.website.value, t: Date.now() - shownAt,
  };
  const done = () => {
    form.reset(); counter.textContent = "0";
    setStatus("Sent! I’ll reply on Discord.");
    summon(payload.discord);
  };
  // bots: honeypot filled or submitted faster than a person could type
  if (payload.website || payload.t < 3000) { done(); return; }
  if (rateLimited()) { Sound.error(); setStatus("", true, `You’ve sent a few already — give it a few minutes, or ${discordFallback}.`); return; }
  form.classList.add("is-sending");
  setStatus("Sending…");
  try {
    let viaApi = false;
    try {
      const r = await fetch("/api/commission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (![404, 405, 501].includes(r.status)) {
        viaApi = true;
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Something went wrong.");
      }
    } catch (err) {
      if (viaApi) throw err;
    }
    if (!viaApi) await sendDirect(payload);
    markSent();
    done();
  } catch (err) {
    Sound.error();
    if (err.offline) setStatus("", true, `The form isn’t connected on this host yet — ${discordFallback}.`);
    else setStatus("", true, `${err.message === "Failed to fetch" ? "Couldn’t reach the server." : err.message} You can also ${discordFallback}.`);
  } finally {
    form.classList.remove("is-sending");
  }
});

/* Summon reveal */
const summonEl = $("#summon");
function summon(discord) {
  $(".summon-discord", summonEl).textContent = "@" + discord;
  summonEl.hidden = false;
  root.style.overflow = "hidden";
  Sound.summon();
  setTimeout(() => FX.speedBurst(innerWidth / 2, innerHeight / 2, 1), 1000);
  setTimeout(() => $(".summon-close", summonEl).focus(), 1300);
}
function closeSummon() { summonEl.hidden = true; root.style.overflow = ""; }
$(".summon-close", summonEl).addEventListener("click", closeSummon);
summonEl.addEventListener("click", (e) => { if (e.target === summonEl || e.target.classList.contains("summon-stage")) closeSummon(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !summonEl.hidden) closeSummon(); });

/* ==========================================================================
   Chrome: nav, sound, motion, clock, scramble, reveals, tilt, intro
   ========================================================================== */
const header = $(".site-header");
const navToggle = $(".nav-toggle");
const navigation = $("#navigation");
function setMenu(open) { navigation.classList.toggle("is-open", open); navToggle.setAttribute("aria-expanded", String(open)); }
navToggle.addEventListener("click", () => setMenu(navToggle.getAttribute("aria-expanded") === "false"));
navigation.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") { setMenu(false); navToggle.focus(); } });
addEventListener("scroll", () => header.classList.toggle("is-scrolled", scrollY > 30), { passive: true });
const navLinks = $$("#navigation a");
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
}, { rootMargin: "-45% 0px -50% 0px" });
navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean).forEach((s) => spy.observe(s));

const motionToggle = $(".motion-toggle");
function setMotionPaused(paused) {
  root.classList.toggle("motion-paused", paused);
  motionToggle.setAttribute("aria-pressed", String(paused));
  motionToggle.textContent = paused ? "Resume motion" : "Pause motion";
  localStorage.setItem("sky-motion", paused ? "off" : "on");
}
if (localStorage.getItem("sky-motion") === "off") setMotionPaused(true);
motionToggle.addEventListener("click", () => setMotionPaused(motionToggle.getAttribute("aria-pressed") === "false"));

const soundToggle = $(".sound-toggle");
function paintSound(on) { soundToggle.setAttribute("aria-pressed", String(on)); $(".sound-label", soundToggle).textContent = on ? "Sound on" : "Sound off"; }
document.addEventListener("sky:sound", (e) => paintSound(e.detail));
paintSound(false);
soundToggle.addEventListener("click", () => {
  const on = !Sound.enabled;
  if (on) localStorage.removeItem("sky-mute"); else localStorage.setItem("sky-mute", "1");
  Sound.set(on);
  Sound.click();
});

const timeEl = $("#stat-time");
$("#stat-place").textContent = P.location || "Spain";
function tickClock() {
  try { timeEl.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: P.timezone }); }
  catch { timeEl.textContent = new Date().toLocaleTimeString(); }
}
setInterval(tickClock, 1000); tickClock();

for (const line of $$(".hero-small")) {
  const text = line.textContent;
  line.textContent = ""; line.setAttribute("aria-label", text);
  [...text].forEach((ch, i) => { const s = el("span", "char", ch === " " ? " " : ch); s.setAttribute("aria-hidden", "true"); s.style.setProperty("--i", i); line.append(s); });
}

const glyphs = "身勝手の極意ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&*+=<>/";
function scramble(node) {
  if (!node || node.dataset.scrambling) return;
  const parts = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) parts.push({ n: walker.currentNode, t: walker.currentNode.nodeValue });
  if (FX.motionOff() || !parts.length) return;
  node.dataset.scrambling = "1";
  const total = parts.reduce((a, p) => a + p.t.length, 0);
  const duration = Math.min(650, 250 + total * 14), began = performance.now();
  let frame = 0;
  (function step() {
    frame++;
    const progress = Math.min(1, (performance.now() - began) / duration);
    const done = Math.floor(progress * total);
    let k = 0;
    for (const p of parts) {
      let out = "";
      for (const ch of p.t) { out += k < done || ch === " " ? ch : glyphs[(Math.random() * glyphs.length) | 0]; k++; }
      p.n.nodeValue = out;
    }
    if (frame % 2) Sound.tick();
    if (progress < 1) requestAnimationFrame(step);
    else { parts.forEach((p) => (p.n.nodeValue = p.t)); delete node.dataset.scrambling; }
  })();
}

const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    revealer.unobserve(e.target);
    if (e.target.matches("[data-scramble]")) { scramble(e.target); Sound.whoosh(); }
    else e.target.classList.add("in");
  }
}, { threshold: .12, rootMargin: "0px 0px -5% 0px" });
function armReveals() {
  const stagger = (sel) => $$(sel).forEach((n, i) => { n.style.transitionDelay = (i % 6) * 70 + "ms"; });
  stagger(".game-card"); stagger(".ui-item");
  $$(".reveal, main [data-scramble]").forEach((n) => { if (!n.closest(".hero")) revealer.observe(n); });
}

/* hero afterimage dodge */
const heroName = $(".hero-name");
function dodge() { if (FX.motionOff()) return; heroName.classList.remove("dodge"); void heroName.offsetWidth; heroName.classList.add("dodge"); }
heroName.addEventListener("pointerenter", () => { dodge(); Sound.teleport(); });
setInterval(() => { if (!document.hidden && scrollY < innerHeight) dodge(); }, 5200);

/* character card tilt */
const charCard = $(".char-card");
charCard.addEventListener("pointermove", (e) => {
  if (FX.motionOff() || e.pointerType === "touch") return;
  const r = charCard.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  charCard.style.setProperty("--ry", (x - .5) * 18 + "deg");
  charCard.style.setProperty("--rx", (.5 - y) * 14 + "deg");
  charCard.style.setProperty("--mx", x * 100 + "%");
  charCard.style.setProperty("--my", y * 100 + "%");
});
charCard.addEventListener("pointerleave", () => ["--rx", "--ry", "--mx", "--my"].forEach((p) => charCard.style.removeProperty(p)));
charCard.addEventListener("pointerenter", () => Sound.teleport());

/* Lightning that keeps crackling around white buttons for as long as they're hovered. */
function startCrackle(button) {
  if (FX.motionOff() || button._crackle) return;
  const hold = el("span", "bolt-hold");
  hold.setAttribute("aria-hidden", "true");
  const bolts = [0, 1].map(() => { const img = el("img"); img.src = "assets/vfx/lightning.webp"; img.alt = ""; hold.append(img); return img; });
  button.append(hold);
  const zap = () => {
    for (const img of bolts) {
      const on = Math.random() < .7;
      img.style.opacity = on ? (.55 + Math.random() * .45).toFixed(2) : "0";
      if (on) {
        img.style.left = (Math.random() * 40 - 5).toFixed(0) + "%";
        img.style.top = (Math.random() * 30 - 10).toFixed(0) + "%";
        img.style.transform = `scale(${Math.random() < .5 ? -1 : 1}, ${Math.random() < .5 ? -1 : 1}) rotate(${(Math.random() * 50 - 25).toFixed(0)}deg)`;
      }
    }
    button._crackle.timer = setTimeout(zap, 70 + Math.random() * 160);
  };
  button._crackle = { hold, timer: 0 };
  zap();
}
function stopCrackle(button) {
  const c = button._crackle;
  if (!c) return;
  clearTimeout(c.timer);
  button._crackle = null;
  c.hold.classList.add("off");
  setTimeout(() => c.hold.remove(), 220);
}
document.addEventListener("pointerover", (e) => {
  const b = e.target.closest(".btn-gold");
  if (e.pointerType === "touch" || !b || b.contains(e.relatedTarget)) return;
  startCrackle(b);
});
document.addEventListener("pointerout", (e) => {
  const b = e.target.closest(".btn-gold");
  if (b && !b.contains(e.relatedTarget)) stopCrackle(b);
});

/* distant lightning in the background every so often */
const strike = $(".bg-fx .strike"), bgFlash = $(".bg-fx .bg-flash");
function scheduleStrike() {
  setTimeout(() => {
    if (!document.hidden && !FX.motionOff()) {
      const x = 5 + Math.random() * 60;
      strike.style.left = x + "vw";
      strike.style.top = -5 + Math.random() * 25 + "vh";
      strike.style.transform = `scaleX(${Math.random() < .5 ? -1 : 1}) rotate(${(Math.random() * 40 - 20).toFixed(0)}deg)`;
      bgFlash.style.setProperty("--fx", x + 20 + "%");
      for (const n of [strike, bgFlash]) { n.classList.remove("on"); void n.offsetWidth; n.classList.add("on"); }
      Sound.thunder();
    }
    scheduleStrike();
  }, 7000 + Math.random() * 9000);
}
scheduleStrike();
document.addEventListener("click", (e) => {
  const t = e.target.closest("a, button, summary");
  if (!t || t.closest(".loader") || t === soundToggle || t.type === "submit") return;
  if (t.matches("[data-impact]")) FX.impact(e.clientX, e.clientY);
  else if (t.matches("summary")) Sound.whoosh();
  else Sound.click();
});

/* ==========================================================================
   Boot: render → title screen → intro
   ========================================================================== */
const markFonts = () => root.classList.add("fonts-ready");
document.fonts?.ready.then(() => requestAnimationFrame(markFonts));
setTimeout(markFonts, 3000);
renderGames();
renderUI();
renderExtras();
$$(".game-media").forEach((m) => slideObserver.observe(m));
refreshStats();
setInterval(() => { if (!document.hidden) refreshStats(); }, 60000);

const loader = $("#loader");
function startIntro() {
  root.classList.add("intro");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.remove("intro");
    scramble($(".eyebrow [data-scramble]"));
    setTimeout(dodge, 1100);
  }));
  armReveals();
}
function enter(withSound) {
  if (withSound) localStorage.removeItem("sky-mute");
  Sound.set(withSound);
  loader.classList.add("is-gone");
  root.classList.remove("is-loading");
  if (withSound) Sound.awaken();
  setTimeout(() => FX.impact(innerWidth / 2, innerHeight / 2), withSound ? 1050 : 150);
  setTimeout(() => loader.classList.add("is-hidden"), 1000);
  sessionStorage.setItem("sky-entered", "1");
  startIntro();
}
if (sessionStorage.getItem("sky-entered")) {
  loader.classList.add("is-hidden");
  root.classList.remove("is-loading");
  startIntro();
  // Browsers only allow audio after a click or key press, so sound starts on the first one.
  if (!localStorage.getItem("sky-mute")) {
    const wake = () => {
      ["pointerdown", "keydown", "touchstart"].forEach((t) => removeEventListener(t, wake, true));
      if (!Sound.enabled) Sound.set(true);
    };
    ["pointerdown", "keydown", "touchstart"].forEach((t) => addEventListener(t, wake, true));
  }
} else {
  const pct = $(".loader-pct b", loader), bar = $(".loader-bar", loader), started = performance.now();
  (function load() {
    const t = Math.min(1, (performance.now() - started) / 1800), p = 1 - Math.pow(1 - t, 3);
    pct.textContent = String(Math.round(p * 100)).padStart(3, "0");
    bar.style.setProperty("--p", p);
    if (t < 1) requestAnimationFrame(load);
    else { loader.classList.add("is-ready"); $(".tap-start", loader).focus({ preventScroll: true }); }
  })();
  for (const b of $$("[data-sound]", loader)) b.addEventListener("click", (e) => { e.stopPropagation(); enter(b.dataset.sound === "on"); }, { once: true });
  loader.addEventListener("click", () => { if (loader.classList.contains("is-ready") && !loader.classList.contains("is-gone")) enter(true); });
}
