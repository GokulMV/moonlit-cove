# Moonlit Cove

GokulMV's portfolio as a beach camp under a live sky. The résumé is a menu on the picnic table, experience is a journal by the fire, milestones hang as tags on the string lights, projects are blueprints in the basket, the stack is a packing list on the van, and contact is a letter in a bottle. You can click the sea to send waves, take the van down an endless coast, and walk the beach.

Everything is drawn in the browser with three.js and hand-written shaders; there is no backend. The sky follows the visitor's local time and the real moon.

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # builds public/ and serves it on http://localhost:8080
```

`npm run build` writes the site to `public/` and `npm start` serves it. `PORT` sets the port.

## Deploy on Railway

The repo has a `Dockerfile`, which Railway uses automatically: it installs the build tools, builds the page, and runs `server.js` on the port Railway gives it.

1. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
2. Once it is deployed, open the service's **Settings → Networking** and click **Generate Domain** to check it on a `*.up.railway.app` address.
3. Optional: set the health check path to `/healthz` in the service settings.

Every push to `main` redeploys.

## Your own domain through Cloudflare

1. In Railway, **Settings → Networking → Custom Domain**, enter the domain (for example `gokulmv.com` or `cove.gokulmv.com`). Railway shows a **CNAME** target and a **TXT** record for verification.
2. In Cloudflare, **DNS → Records**, add both exactly as shown:
   - `CNAME` — name `@` for the root domain (Cloudflare flattens it) or the subdomain, target the Railway value. Proxy can stay on (orange cloud).
   - `TXT` — the name and value Railway gives. The domain won't verify without it.
3. In Cloudflare, **SSL/TLS → Overview**, set the mode to **Full** (not Flexible, which loops redirects, and not Full (strict)).
4. Wait for the green check in Railway; the certificate usually comes within the hour.

For `www`, add a proxied `CNAME` `www → @` in Cloudflare and a redirect rule from `www` to the root.

## How it is made

```
src3d/            the engine: sky and moon (astro, sky), shaders (glsl), materials (mats),
                  painted textures (paint), the camp, nature, the endless coast (world),
                  shore life (life), fire and insects (fx), audio, and the render loop (engine)
src3d/page/       the page: markup and styles, the résumé content, typeset pages, the app
assets/snd2/      the recordings
tools/build3d.mjs the build: web (public/), single-file (dist/), and the engine test bench
server.js         a small static server with compression and caching, no dependencies
```

To change what the page says, edit `src3d/page/content.js` and push.

## Credits

- [three.js](https://threejs.org) (MIT).
- Fonts: Fraunces, Instrument Sans, Caveat (SIL OFL) and JetBrains Mono (OFL), from Fontsource.
- Sounds: ocean samples from GokulMV; ambience from the Moodist library (Pixabay licence and CC0); the van's engine and knocks from Kenney's [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (MIT).
