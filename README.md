# Moonlit Cove

GK’s Hideaway: GokulMV's portfolio, built as a beach camp to explore under a live night sky.

The résumé is part of the camp. The basket holds blueprints of the architecture, the clipboard on the van lists what it's built with, the journal by the fire has stories from the build, and contact is a letter in a bottle. The sky follows the visitor's local time with the real moon, stars and planets, and the tide follows the moon.

Everything is drawn in the browser with three.js and hand-written shaders. A small Node server serves the page and keeps the shared wish board and drawings.

## In the cove

- Walk the beach and out onto the reef, or let it walk itself
- Pick up a crab, a shell, a flower or a butterfly and turn it over in your hands
- Drive the van down a coast that never repeats, and pitch camp anywhere
- Let a sky lantern go with a wish, pinned to a board by the fire for everyone to read
- Draw on the sketchboard and leave it in the toolbox for others to open
- Sit by the fire and play the radio: world radio, your own songs, or a Spotify link pasted in
- Watch it full screen, nothing over it, for as long as you like (Esc to leave)

## Run it locally

Needs Node 20 or newer.

```bash
npm install
npm run dev    # builds the site, then serves it on http://localhost:8080
```

| Command | What it does |
| --- | --- |
| `npm run build` | builds the site into `public/` |
| `npm start` | serves `public/` |
| `npm run build:single` | builds the whole site as one file, `dist/moonlit-cove.html` (wishes then stay in that browser) |

## Deploy

The `Dockerfile` builds the page and runs `server.js`. Railway deploys it from GitHub and redeploys on every push to `main`. The health check is `/healthz`.

| Variable | What it's for |
| --- | --- |
| `PORT` | the port to listen on (default 8080; Railway sets it) |
| `DATABASE_URL` | Postgres for the wishes and drawings (on Railway, `${{Postgres.DATABASE_URL}}`). Without it they're kept as files in `data/`, which don't survive a redeploy |
| `WISH_ADMIN_KEY` | lets you take a wish down: `DELETE /api/wishes/<id>` with the header `X-Admin-Key` |

## Project layout

```
src3d/          the engine: sky, sea, coast, camp, wildlife, sound and the render loop
src3d/models/   the hand-built models: camp gear, beach finds and creatures
src3d/page/     the page: markup, styles and the résumé text (content.js)
assets/         the sounds
tools/          the build (build3d.mjs) and headless browser checks (Playwright)
server.js       the static server, plus the wish board and drawings API
```

To change what the page says, edit `src3d/page/content.js` and push.

## Credits

The full list is in the cove itself, under **Credits and licences**.

- [three.js](https://github.com/mrdoob/three.js) (MIT)
- Sun and moon positions: formulas from [SunCalc](https://github.com/mourner/suncalc) (BSD-2-Clause)
- Stars and the Milky Way: data from [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD-3-Clause)
- Clouds: after takram's [three-clouds](https://github.com/takram-design-engineering/three-geospatial), Sébastien Hillaire's [TileableVolumeNoise](https://github.com/sebh/TileableVolumeNoise) and MJP's Catmull-Rom sampling (all MIT)
- Fonts: Fraunces, Instrument Sans, Caveat and JetBrains Mono (SIL OFL 1.1), via [Fontsource](https://github.com/fontsource/fontsource)
- Sounds: the [Moodist](https://github.com/remvze/moodist) library (Pixabay Content License and CC0) and Kenney's [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (CC0)
- Radio: stations from the [Radio Browser](https://www.radio-browser.info) directory, streamed straight from their broadcasters
- Spotify links play in Spotify’s own [embedded player](https://developer.spotify.com/documentation/embeds), through its iFrame API
