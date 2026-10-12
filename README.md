# Moonlit Cove

GokulMV's portfolio as a beach camp under a live sky, and a tour of how it was made. The basket holds blueprints of its architecture; the clipboard on the van lists what it is built with; the journal by the fire keeps stories from the build; and contact is a letter in a bottle. You can turn the view round the camp the way a map turns, get out and walk the beach (or let it walk itself), click the sea to send waves, take the van down a coast that never repeats, past beach shacks, coco huts and fishing boats, park anywhere and pitch camp there, let a sky lantern go with a wish (pinned to a board by the fire for everyone to read), draw on the board at the picnic table and leave the drawing in the toolbox for others to open, and sit by the fire to play the radio: world radio, or your own songs.

Everything is drawn in the browser with three.js and hand-written shaders. The only backend keeps the wish board and the toolbox of drawings, in the same small server that serves the page. The sky follows the visitor's local time and the real moon.

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # builds public/ and serves it on http://localhost:8080
```

`npm run build` writes the site to `public/` and `npm start` serves it. `PORT` sets the port. Wishes and drawings are kept in `data/` (`DATA_DIR` moves it; the folder is ignored by git), or in Postgres when `DATABASE_URL` is set.

Opened straight from a file (`npm run build:single` makes `dist/moonlit-cove.html`), there is no server to keep wishes, so they stay in that browser and say so ("only on this device").

## Deploy on Railway

The repo has a `Dockerfile`, which Railway uses automatically: it installs the build tools, builds the page, and runs `server.js` on the port Railway gives it.

1. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
2. Once it is deployed, open the service's **Settings → Networking** and click **Generate Domain** to check it on a `*.up.railway.app` address.
3. Optional: set the health check path to `/healthz` in the service settings.
4. Give the wishes and drawings a database, or they vanish with every deploy: in the project, press ⌘K / Ctrl+K (or **+ Create**) and add **Database → PostgreSQL**. Then open this service's **Variables**, click **New Variable**, name it `DATABASE_URL` and set its value to `${{Postgres.DATABASE_URL}}` (Railway offers it as a reference). On the next deploy the server makes its two tables (`cove_wishes`, `cove_drawings`) and says `in Postgres at …` in the deploy log. Without a database the log says `NOTHING IS KEPT ACROSS DEPLOYS` and `/api/wishes` answers `"kept": false`. (A volume mounted at `/data` also works: the server follows `RAILWAY_VOLUME_MOUNT_PATH`; anything kept that way moves into the database on its first start with one.)
5. To be able to take a wish down, open the service's **Variables** and add `WISH_ADMIN_KEY` with a long random value (for example the output of `openssl rand -hex 24`). Without it, deleting is switched off.

Every push to `main` redeploys.

## The wish board

Wishes are plain words: the server tidies each one (Unicode NFC, no control or text-direction characters, single spaces, at most 160 characters and a 32-character name), turns away links, email addresses, @handles, phone numbers and unkind words with a friendly note, and takes at most one wish every 20 seconds and eight an hour from each visitor (counted by `CF-Connecting-IP`, then the first `X-Forwarded-For`, then the connection). It keeps the newest 2000: in Postgres when there is a database, otherwise in `$DATA_DIR/wishes.json`, written to a temporary file and renamed into place so a crash never leaves half a file.

```
GET    /api/wishes?limit=100      { wishes: [{ id, text, name, at }], total }, newest first
POST   /api/wishes                { "text": "...", "name": "..." }  →  201 { wish, total }, or 4xx { error }
DELETE /api/wishes/<id>           header X-Admin-Key: $WISH_ADMIN_KEY
```

To take a wish down, find its `id` and delete it with the key:

```bash
curl -s 'https://your-domain/api/wishes?limit=50'          # each wish has an id
curl -X DELETE https://your-domain/api/wishes/<id> -H "X-Admin-Key: $WISH_ADMIN_KEY"
```

`node tools/wishapi.mjs` checks the whole API against a throwaway server (build `public/` first), and `node tools/drawapi.mjs` the toolbox's; with `COVE_TEST_PG=postgres://user:password@host:port` both run against a throwaway Postgres database instead. `node tools/wishtest.mjs` does the same in a headless browser, with the chairs and the radio.

## The radio

Sitting in either camp chair puts the radio on the picnic table in your hands. **World radio** lists sixty of the most-played HTTPS stations from the [Radio Browser](https://www.radio-browser.info) community directory and streams them straight from their broadcasters (an `<audio>` element, so nothing passes through this server); a station that won't play is skipped. **Your songs** plays audio files the visitor picks from their own device, from object URLs in the tab: they are never uploaded. The page's content-security policy allows exactly this: `media-src https: blob:` for the streams and the songs, and `connect-src` for `*.api.radio-browser.info`.

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
server.js         a small static server with compression and caching, and the APIs of the wish board and the toolbox
                  (Postgres through pg when DATABASE_URL is set, files otherwise)
docker-entrypoint.sh  hands a volume, if there is one, to the node user, then starts the server as that user
```

To change what the page says, edit `src3d/page/content.js` and push.

## Credits

- [three.js](https://threejs.org) (MIT).
- Fonts: Fraunces, Instrument Sans, Caveat (SIL OFL) and JetBrains Mono (OFL), from Fontsource.
- Sounds: ocean samples from GokulMV; ambience from the Moodist library (Pixabay licence and CC0); the van's engine and knocks from Kenney's [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (MIT).
- Radio: stations from the [Radio Browser](https://www.radio-browser.info) community directory. Every stream belongs to its broadcaster; nothing is recorded or re-hosted.
