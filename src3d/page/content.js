/* ─────────────────────────────────────────────────────────────
   content.js — what the cove says, chapter by chapter, each one
   anchored to an object in the scene:
     plans      blueprints in the basket: its architecture, drawn
     stack      the clipboard on the van: what it is built with
     notes      the journal by the fire: stories from the build
     contact    the letter in the bottle
   ───────────────────────────────────────────────────────────── */
const Content = {
  site: 'GK’s Hideaway',
  name: 'GokulMV',
  role: 'Senior Consultant at Thoughtworks',
  links: [['LinkedIn', 'https://linkedin.com/in/gokulmv', 'linkedin.com/in/gokulmv'], ['GitHub', 'https://github.com/GokulMV', 'github.com/GokulMV']],
  contact: { email: 'reddy.gokul@gmail.com' },
  /* the letter in the bottle: edit freely; the ways to reach me close it */
  letter: {
    to: 'To the stranger who wandered in,',
    body: [
      'I’m Gokul, a software engineer in Hyderabad. You’ve found my little cove: a calm beach, a patient ocean, a fire that keeps the night company. I come here to slow down. The waves never hurry, and out here, neither do I.',
      'By day I build the systems people lean on without ever noticing them: Java, Kafka, the cloud, and lately the AI tooling that helps teams write better code. I love the quiet craft of it, making things fast, steady and kind to whoever looks after them next.',
      'If something here made you smile, or you’d just like to talk, write back. The bottle always finds its way to me.'
    ],
    close: 'Warmly,',
    sign: 'Gokul'
  },
  /* ── the journal by the fire: stories from the build ── */
  notes: [
    { title: 'The sea looked like fog', problem: 'A few metres out the water smeared into a grey haze.', fix: 'The water’s textures are now filtered along the view, each ripple fades by how much sea a pixel covers, and three plain swell trains replaced a blotchy swell texture. The sea stays water all the way to the horizon.' },
    { title: 'Ripples, not waves', problem: 'A click on the sea made rings, like a pond.', fix: 'A click now sends a real swell along the wave field. Clicks close together stack into a taller one, and it runs up the sand by the same rule in the shader and in the code that knocks things over.' },
    { title: 'Pins pointing at nothing', problem: 'The dots for the chapters floated in the air, one of them out at sea.', fix: 'Each dot is measured from its object every frame: the book, the bottle, the clipboard on the van, wherever the van has been driven.' },
    { title: 'A book of loose paper', problem: 'The journal looked like sheets thrown on a pad.', fix: 'Now it has boards larger than the pages, a spine that stands up as it shuts, page blocks that thicken as you read, and pages that dive into a shaded gutter.' },
    { title: 'Footprints like figures of eight', problem: 'Footprints were two dark ovals, the tyre tracks plain smudges, and the beach never cleared either.', fix: 'A footprint is now the shape of a foot, heel to toes, left and right, pressed into the sand as a relief the light shades; tyres leave a rut with a tread. Both soften away over a couple of minutes, and a wave smooths them out wherever it actually runs.' },
    { title: 'The engine', problem: 'The first engine was synthesised, and it was rude.', fix: 'A recorded engine loop, pitched by speed and throttle, with a starter crank before it catches.' },
    { title: 'Robotic on headphones', problem: 'The surf, the crickets and the birds sounded garbled and robotic, and a 111 Hz tone hummed underneath like a beep.', fix: 'The recordings had been squeezed to low bitrates, then chopped and pitch-shifted. Now the originals are cut into seamless loops at clean bitrates and played whole, at their own pitch; the tone and every synthesised sound are gone.' },
    { title: 'Stuck van', problem: 'The van hit a rock and couldn’t get out.', fix: 'The van is three circles. Anything it touches pushes it out sideways, so it slides along rocks instead of sticking, and R puts it back on open sand.' },
    { title: 'The end of the beach', problem: 'The beach stopped at a wall.', fix: 'The beach is two kilometres long and its two ends are joined: drive on along it and you come round to the camp again, with no seam anywhere. It is built in 128-metre chunks around you, a few milliseconds a frame.' },
    { title: 'A flickering horizon', problem: 'With softness at zero the horizon shimmered.', fix: 'Ripples fade before they can alias, ambient occlusion fades out far away, and the ground is cut into cells so depth doesn’t tear.' },
    { title: 'The eraser line', problem: 'Where the sea drew back, the wet sand dried along a straight line, like someone rubbing it out.', fix: 'Each wave’s reach now wanders along the beach, the sand dries in patches and soaks in from the edge, and the foam breaks into lace as it goes.' }
  ],

  /* ── the clipboard: what this cove is built with ── */
  stack: [
    { group: 'In your browser', items: ['JavaScript, no framework', 'GLSL shaders', 'three.js r160', 'WebGL 2', 'Web Audio API', 'Canvas 2D'] },
    { group: 'Type', items: ['Fraunces', 'Instrument Sans', 'Caveat', 'JetBrains Mono', 'via Fontsource'] },
    { group: 'Sky', items: ['SunCalc’s sun and moon formulas', 'your time zone, for where you are'] },
    { group: 'Sound', items: ['Moodist field recordings', 'Kenney’s engine and knocks', 'Web Audio, mixed live'] },
    { group: 'Server', items: ['Node.js 22', 'a server with no dependencies', 'brotli, ETags, CSP'] },
    { group: 'Shipping', items: ['GitHub', 'Docker', 'Railway', 'Cloudflare'] },
    { group: 'Tools', items: ['Playwright + headless Chromium', 'ffmpeg', 'Git', 'Claude, as pair programmer'] }
  ],

  /* ── who made what: every sound, typeface, library and idea that came from someone else ── */
  credits: [
    { group: 'Sound', items: [
      { what: 'Surf, crickets, birds, seagulls, owl, campfire, rain, thunder and turning pages', who: 'The Moodist sound library by MAZE (remvze)', link: ['github.com/remvze/moodist', 'https://github.com/remvze/moodist'], licence: 'Each sound under the Pixabay Content License or CC0' },
      { what: 'The van’s engine and knocks', who: 'Kenney, Starter Kit Racing', link: ['github.com/KenneyNL/Starter-Kit-Racing', 'https://github.com/KenneyNL/Starter-Kit-Racing'], licence: 'Sounds CC0 (the kit’s code is MIT)' }
    ] },
    { group: 'Radio', items: [
      { what: 'World radio, on the table by the fire', who: 'Stations from the Radio Browser community directory. Every stream belongs to its broadcaster and plays straight from them; nothing is recorded or re-hosted here', link: ['radio-browser.info', 'https://www.radio-browser.info'], licence: 'Your own songs play from your device and never leave it' },
      { what: 'Spotify in your songs', who: 'A Spotify link pasted into the radio plays in Spotify’s own embedded player, through its iFrame API. It all streams from Spotify, whole songs for listeners signed in to Spotify in that browser and previews otherwise; the links are kept only on your device', link: ['developer.spotify.com/documentation/embeds', 'https://developer.spotify.com/documentation/embeds'], licence: 'Spotify’s Developer Terms' }
    ] },
    { group: 'Code and ideas', items: [
      { what: 'WebGL plumbing', who: 'three.js r160, © 2010–2023 three.js authors', link: ['github.com/mrdoob/three.js', 'https://github.com/mrdoob/three.js'], licence: 'MIT' },
      { what: 'Where the sun and moon are', who: 'Formulas from SunCalc by Vladimir Agafonkin', link: ['github.com/mourner/suncalc', 'https://github.com/mourner/suncalc'], licence: 'BSD-2-Clause' },
      { what: 'The night sky’s stars and the Milky Way', who: 'Data from d3-celestial by Olaf Frohn (the stars from the Hipparcos catalogue); the planets from JPL’s approximate orbital elements', link: ['github.com/ofrohn/d3-celestial', 'https://github.com/ofrohn/d3-celestial'], licence: 'BSD-3-Clause (© 2015 Olaf Frohn)' },
      { what: 'How the clouds are built and lit', who: 'Andrew Schneider’s “Real-time Volumetric Cloudscapes of Horizon Zero Dawn” (Guerrilla, 2015), as written for three.js in takram’s three-clouds by Shota Matsuda: the weather map, the height rounding, the noise erosion and the many-times-scattered light', link: ['github.com/takram-design-engineering/three-geospatial', 'https://github.com/takram-design-engineering/three-geospatial'], licence: 'MIT (© 2024 Shota Matsuda)' },
      { what: 'The clouds’ noise', who: 'Recipes from Sébastien Hillaire’s TileableVolumeNoise, baked on the GPU', link: ['github.com/sebh/TileableVolumeNoise', 'https://github.com/sebh/TileableVolumeNoise'], licence: 'MIT (© 2017 Sébastien Hillaire)' },
      { what: 'Sharp sampling of the cloud buffer', who: 'Catmull-Rom filtering in nine taps, by MJP', link: ['gist.github.com/TheRealMJP/c83b8c0f46b63f3a88a5986f4fa982b1', 'https://gist.github.com/TheRealMJP/c83b8c0f46b63f3a88a5986f4fa982b1'], licence: 'MIT (© 2019 MJP)' },
      { what: 'Cloth and paper motion', who: 'The idea, Verlet integration with gravity and wind, from Pedro Ferraz’s PhysicsBasedClothAnimation; written afresh here, no code copied', link: ['github.com/pedromsferraz/PhysicsBasedClothAnimation', 'https://github.com/pedromsferraz/PhysicsBasedClothAnimation'], licence: 'Credited as inspiration' },
      { what: 'Font packages', who: 'Fontsource', link: ['github.com/fontsource/fontsource', 'https://github.com/fontsource/fontsource'], licence: 'MIT' },
      { what: 'Testing', who: 'Playwright, driving headless Chromium', link: ['github.com/microsoft/playwright', 'https://github.com/microsoft/playwright'], licence: 'Apache-2.0' }
    ] },
    { group: 'Typefaces', items: [
      { what: 'Fraunces', who: 'The Fraunces Project Authors', link: ['github.com/undercasetype/Fraunces', 'https://github.com/undercasetype/Fraunces'], licence: 'SIL Open Font License 1.1' },
      { what: 'Instrument Sans', who: 'The Instrument Sans Project Authors', link: ['github.com/Instrument/instrument-sans', 'https://github.com/Instrument/instrument-sans'], licence: 'SIL Open Font License 1.1' },
      { what: 'Caveat', who: 'The Caveat Project Authors', link: ['github.com/googlefonts/caveat', 'https://github.com/googlefonts/caveat'], licence: 'SIL Open Font License 1.1' },
      { what: 'JetBrains Mono', who: 'The JetBrains Mono Project Authors', link: ['github.com/JetBrains/JetBrainsMono', 'https://github.com/JetBrains/JetBrainsMono'], licence: 'SIL Open Font License 1.1' }
    ] },
    { group: 'Made by', items: [
      { what: 'The cove', who: 'GokulMV, with Claude (Anthropic) as pair programmer', link: ['github.com/GokulMV/moonlit-cove', 'https://github.com/GokulMV/moonlit-cove'], licence: '' }
    ] }
  ],

  /* ── the work hut on the beach: its four boards, each opened to read (edit freely: a board's lines are short on
     purpose, it is read across a room) ── */
  work: [
    { id: 'about', eyebrow: 'On the board by the window', title: 'Gokul', lines: ['Senior Consultant at Thoughtworks', 'Software engineer, Hyderabad'],
      body: ['I build the systems people lean on without noticing them: steady services, streams of events, and lately the AI tooling that helps teams write better code.', 'Seven years and more of it, and I still like the quiet craft best: making things fast, steady and kind to whoever looks after them next.'],
      links: true },
    { id: 'stack', eyebrow: 'Pinned over the desk', title: 'What I build with', lines: ['Java · Spring Boot', 'Apache Kafka · event-driven', 'AWS', 'React', 'Microservices', 'LangChain4j · MCP · RAG'],
      body: ['Backends in Java and Spring Boot, talking through Kafka; microservices that stay simple to run on AWS; a React front when it needs one.', 'With AI: LangChain4j, the Model Context Protocol and retrieval-augmented pipelines, put to work in real codebases.'] },
    { id: 'work', eyebrow: 'On the wall', title: 'Where I’ve worked', lines: ['Thoughtworks — now', 'OpenText', 'Cognizant'],
      body: ['Thoughtworks: consulting on the systems clients run their business on.', 'Before that, OpenText and Cognizant: the enterprise software years, where I learned how big systems are kept alive.'] },
    { id: 'projects', eyebrow: 'On the wall', title: 'Things I’ve made', lines: ['Levitas Validators — on Maven Central', 'A macOS app that mutes you when you step away', 'This cove'],
      body: ['Levitas Validators: a Java validation library, published on Maven Central.', 'An open-source macOS app, installed with Homebrew: when you step away it mutes your mic in a call and pauses what you were watching, and picks up again when you are back.', 'And this cove: three.js and shaders, written by hand with Claude as a pair programmer. The blueprints, the stack and the build notes are at the camp.'] }
  ],

  chapters: [
    { id: 'plans', label: 'Blueprints', anchor: 'basket', cam: 'basket', eyebrow: 'Rolled up in the basket', title: 'Blueprints' },
    { id: 'stack', label: 'Stack', anchor: 'clipboard', cam: 'van', eyebrow: 'On the van', title: 'What it’s built with' },
    { id: 'notes', label: 'Build notes', anchor: 'journal', cam: 'journal', eyebrow: 'By the fire', title: 'Stories from the build' },
    { id: 'contact', label: 'Contact', anchor: 'bottle', cam: 'bottle', eyebrow: 'Message in a bottle', title: 'A letter' }
  ]
};
