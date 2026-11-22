/* ==========================================================================
   Everything editable on the site lives here.
   Live numbers (players, visits, favorites, likes) refresh from Roblox; the
   `snapshot` values are only shown if Roblox can't be reached.
   ========================================================================== */
window.Portfolio = {
  robloxUserId: 1996540411,
  timezone: "Europe/Madrid",
  location: "Ciudad Real, ES",

  contact: {
    discord: { handle: "skyvaint", url: "https://discord.com/users/1367774975045406801" },
    roblox: { handle: "skyvaint", url: "https://www.roblox.com/users/1996540411/profile" },
    x: { handle: "skyvaint", url: "https://x.com/skyvaint" },
  },

  /* Games. `trailer` can be an .mp4/.webm in assets/ (plays muted on the card)
     or a YouTube link (opens in the details view). Leave it "" to show the
     Roblox thumbnails as a slideshow instead.
     Cards are ordered live by players online: active games first, then the
     upcoming game (status: "upcoming", big banner + Invest), then games at 0 players
     as smaller cards. Leave blurb "" to hide the description. */
  games: [
    {
      universeId: 9674224595, placeId: 77393318863643,
      name: "Aura Ascension", role: "Liveops Programmer", studio: "BlockTurns",
      peakCcu: 80000,
      blurb: "Liveops: new systems, events and QOL updates to keep players engaged through an 80K CCU spike.",
      trailer: "",
      snapshot: { playing: 41, visits: 95328925, favorites: 3417709, up: 140894, down: 8609 },
    },
    {
      universeId: 8507699752, placeId: 73257710123935,
      name: "Poison Treats", role: "Liveops Programmer", studio: "Poisoned Things",
      peakCcu: 20000,
      blurb: "Liveops: shipping updates and keeping the game stable through a 20K CCU spike.",
      trailer: "",
      snapshot: { playing: 79, visits: 116018040, favorites: 10272118, up: 54824, down: 5557 },
    },
    {
      universeId: 8365871374, placeId: 72845937010155,
      name: "Gear Slap Tower", role: "Liveops Programmer", studio: "Brazilian Team",
      peakCcu: null, ccuNote: "2K constant",
      blurb: "Liveops on a tower game that holds a constant 2K players.",
      trailer: "",
      snapshot: { playing: 2269, visits: 269853750, favorites: 21176712, up: 210250, down: 11161 },
    },
    {
      universeId: 8306337706, placeId: 119350251891348,
      name: "Future Soccer", role: "Founder · Solo Dev", studio: "Future Sports",
      peakCcu: null, ccuNote: "In development", thumbs: 1,
      blurb: "A unique football experience for experienced players, built around momentum and physics.",
      trailer: "",
      snapshot: { playing: 0, visits: 400, favorites: 4, up: 6, down: 1 },
    },
    {
      universeId: 10771982978, placeId: 78862803369272,
      name: "SCORE", role: "Founder · Fullstack", studio: "skyvaint",
      status: "upcoming", banner: "assets/games/score-banner.webp", genre: ["Blue Lock", "Football", "Anime"],
      blurb: "An upcoming Blue Lock football game I'm building from the ground up. In development and open to investors.",
      trailer: "",
    },
    {
      universeId: 10770237203, placeId: 132974555712777,
      name: "Sneak For Eggs", role: "Owner · Fullstack", studio: "some bunch of farmers",
      peakCcu: null, ccuNote: "Fresh release",
      blurb: "A farm-to-base loop with egg hatching, passive income and training upgrades.",
      trailer: "",
      snapshot: { playing: 0, visits: 1673, favorites: 8, up: 5, down: 3 },
    },
    {
      universeId: 10771351496, placeId: 82605394674193,
      name: "Be The Manager", role: "Programmer", studio: "Othorth Studios",
      peakCcu: null, ccuNote: "Live",
      blurb: "",
      trailer: "",
      snapshot: { playing: 241, visits: 166048, favorites: 6012, up: 127, down: 47 },
    },
    {
      universeId: 10771383023, placeId: 94831407518345,
      name: "TROLL Hug & Gear Tower", role: "Programmer", studio: "Wrong Decisions",
      peakCcu: null, ccuNote: "Live",
      blurb: "",
      trailer: "",
      snapshot: { playing: 47, visits: 83130, favorites: 9420, up: 40, down: 16 },
    },
    {
      universeId: 10772991177, placeId: 90831941913879,
      name: "Don't Press The Button Extreme", role: "Programmer", studio: "Colorful Party",
      peakCcu: null, ccuNote: "Live",
      blurb: "",
      trailer: "",
      snapshot: { playing: 11, visits: 44814, favorites: 5568, up: 33, down: 29 },
    },
    {
      universeId: 10775792017, placeId: 133616997465873,
      name: "TROLL Carry Christmas Tower", role: "Programmer", studio: "Christmas Chapter",
      peakCcu: null, ccuNote: "Seasonal", thumbs: 1,
      blurb: "",
      trailer: "",
      snapshot: { playing: 0, visits: 4948, favorites: 512, up: 12, down: 5 },
    },
  ],

  /* UI gallery — images in assets/ui/. Add more by appending entries. */
  ui: Array.from({ length: 23 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { src: `assets/ui/ui-${n}.webp`, thumb: `assets/ui/ui-${n}-sm.webp`, alt: `Roblox UI design ${i + 1}` };
  }),


  studios: [
    { name: "BlockTurns Studio", role: "Liveops Programmer", when: "April – June", desc: "Keeping players engaged, coding new systems and QOL improvements." },
    { name: "Indigo Studios", role: "Programmer", when: "January – March", desc: "New systems, games and liveops for the Indigo experiences I maintained." },
    { name: "Future Soccer", role: "Founder / Solo Dev", when: "2024 – Today", desc: "My own project, focused on building a unique soccer experience." },
  ],

  /* Discord profile card. Names refresh live from Discord (via japi.rest); the
     images in assets/discord/ are the fallback if that service is down. */
  discordProfile: {
    id: "1367774975045406801",
    globalName: "skyvaint 吾艾",
    username: "skyvaint",
    clanTag: "SKY",
    about: "Roblox programmer & UI designer. DMs open for commissions and investors.",
  },
};
