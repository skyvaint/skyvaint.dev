"""Local preview for skyvaint.com — serves the site and imitates the two API routes.

    python dev_server.py            # http://localhost:8417, form is a dry run (nothing sent)
    python dev_server.py --live     # form really posts to DISCORD_WEBHOOK_URL from .env

On Vercel the real routes in api/ are used instead; this file is not deployed logic.
"""
import json
import os
import re
import sys
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8417
LIVE = "--live" in sys.argv
TYPES = {"Full game", "UI frames", "Scripting system", "Liveops", "Investment", "Other"}


def load_env():
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "skyvaint-dev", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        blocked = (".env", ".git", ".claude", "dev_server.py", "api/")
        if url.path != "/api/stats" and any(url.path.lstrip("/").startswith(b) for b in blocked):
            return self.send_error(404)
        if url.path == "/api/stats":
            ids = [i for i in parse_qs(url.query).get("ids", [""])[0].split(",") if re.fullmatch(r"\d{1,15}", i)][:20]
            if not ids:
                return self.send_json(400, {"error": "No ids."})
            try:
                q = ",".join(ids)
                games = get_json(f"https://games.roblox.com/v1/games?universeIds={q}")["data"]
                votes = {v["id"]: v for v in get_json(f"https://games.roblox.com/v1/games/votes?universeIds={q}")["data"]}
                out = [{"id": g["id"], "name": g["name"], "playing": g["playing"], "visits": g["visits"],
                        "favorites": g["favoritedCount"], "up": votes.get(g["id"], {}).get("upVotes"),
                        "down": votes.get(g["id"], {}).get("downVotes")} for g in games]
                return self.send_json(200, {"games": out})
            except Exception:
                return self.send_json(502, {"error": "Roblox didn't answer."})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/commission":
            return self.send_error(404)
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 20000)) or b"{}")
        except Exception:
            return self.send_json(400, {"error": "Bad request."})
        if body.get("website") or float(body.get("t") or 0) < 3000:
            return self.send_json(200, {"ok": True})
        discord = str(body.get("discord", "")).strip()
        if not re.fullmatch(r"[\w.]{2,32}(#\d{4})?", discord):
            return self.send_json(400, {"error": "Add a valid Discord username."})
        if body.get("type") not in TYPES:
            return self.send_json(400, {"error": "Pick a project type."})
        if len(str(body.get("details", "")).strip()) < 20:
            return self.send_json(400, {"error": "Tell me a bit more about the project."})
        if not LIVE:
            print("\n[dry run] commission request (not sent):\n" + json.dumps(body, indent=2, ensure_ascii=False), flush=True)
            return self.send_json(200, {"ok": True, "dryRun": True})
        hook = os.environ.get("DISCORD_WEBHOOK_URL", "")
        if not hook:
            return self.send_json(503, {"error": "DISCORD_WEBHOOK_URL is missing from .env"})
        who = "@" + discord + (f" ({str(body.get('name') or '')[:60]})" if body.get("name") else "")
        embed = {"author": {"name": who}, "title": "⚡ New commission request (local test)", "description": body["details"][:1500], "color": 0xFFD23F,
                 "fields": [{"name": k.title(), "value": str(body.get(k) or "—")[:200], "inline": True}
                            for k in ("name", "discord", "type", "budget", "timeline", "link")]}
        req = urllib.request.Request(hook + "?wait=true", method="POST",
                                     data=json.dumps({"username": "skyvaint.com", "content": f"**New request from {who}**", "allowed_mentions": {"parse": []}, "embeds": [embed]}).encode(),
                                     headers={"Content-Type": "application/json", "User-Agent": "skyvaint-dev"})
        try:
            urllib.request.urlopen(req, timeout=15)
            return self.send_json(200, {"ok": True})
        except Exception:
            return self.send_json(502, {"error": "Couldn't deliver the message right now."})


if __name__ == "__main__":
    load_env()
    print(f"skyvaint dev server on http://localhost:{PORT}  (form: {'LIVE — posts to Discord' if LIVE else 'dry run'})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
