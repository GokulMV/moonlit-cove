/* ─────────────────────────────────────────────────────────────
   content.js — what the cove says, chapter by chapter, each one
   anchored to an object in the scene:
     making     the menu on the picnic table: how the cove is made
     plans      blueprints in the basket: its architecture, drawn
     stack      the clipboard on the van: what it is built with
     notes      the journal by the fire: stories from the build
     milestones the string lights: the journey so far
     contact    the letter in the bottle
   ───────────────────────────────────────────────────────────── */
const Content = {
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
  /* the journey, one bulb each */
  journey: [
    { when: '2018', title: 'Graduated', text: 'B.Tech, Electronics and Communications Engineering, JNTU Anantapur' },
    { when: '2019', title: 'Cognizant', text: 'Programmer Analyst, on the IVS Portal for a North American carmaker' },
    { when: '2021', title: 'OpenText', text: 'Software Engineer on the OT2 multi-tenant SaaS platform' },
    { when: '2023', title: 'Thoughtworks', text: 'Senior Consultant on an e-commerce customer-service platform' },
    { when: 'Today', title: 'Still building', text: 'Fast, steady backends, and AI tooling that helps teams write better code' }
  ],

  /* ── the menu on the table: how the cove is made, one course at a time ── */
  making: [
    { course: 'To start', title: 'What this is', lead: 'A portfolio you can walk into: a beach camp under the real sky over wherever you are, drawn live in your browser. No video, no game engine, no framework. Every object you can open is a chapter.',
      points: ['Plain JavaScript, joined into one page by a small build script.', 'One library, <b>three.js</b>, for the WebGL plumbing. Every shader, model and texture is written in code.', 'The sun and the moon are placed for your time zone and today’s date, and the moon shows its real phase.', 'The sounds load only when you turn sound on.'] },
    { course: 'The main course', title: 'One frame', lead: 'About sixty times a second, in this order:',
      steps: [['Time', 'Your clock, or the hour you picked, becomes the sun’s and moon’s height, bearing and phase.'],
        ['Sky', 'Those angles mix the sky’s colours, the light on the clouds, the moonlight and the shadows.'],
        ['Sea and sand', 'One shader draws both: tide swells and the ones you clicked, the swash on the sand, foam, wet sand, tyre tracks, the moon’s glitter.'],
        ['The coast', 'Headlands, rocks and forest are built a few milliseconds at a time as you travel, with less detail far away.'],
        ['Light', 'The fire and the string lights render shadow maps of their own; the sky becomes the reflection in anything glossy.'],
        ['Finish', 'The frame renders in high precision, then gets ambient occlusion, a ray-marched fire, bloom, depth of field, heat haze, rain and grain.'],
        ['Sound', 'Each wave you see is scheduled into the soundtrack, so its wash lands as it reaches the sand.']] },
    { course: 'From the sea', title: 'Waves', lead: 'Close to the shore the water is a fine mesh that follows the camera and really rises and falls; further out it is a 40-kilometre plane drawn with the same maths.',
      points: ['Click the water and a swell rolls in. Clicks close together stack into a taller one.', 'A big one runs up the sand, puts out the fire and knocks things over: the props use the same run-up the shader draws.', 'Far water keeps its ripples: its textures are filtered along the view and fade by how much sea each pixel covers.'] },
    { course: 'From the sky', title: 'Sun, moon and weather', lead: 'The sky is one shader painted from the sun’s and moon’s real positions.',
      points: ['Five kinds of cloud drift on their own clock and change shape as they go.', 'Rain darkens the sand and rings the shallows; a storm brings lightning, with thunder a few seconds later.', 'Change the hour in the settings and the whole cove relights: dusk, deep night, sunrise.'] },
    { course: 'Along the shore', title: 'A coast that never ends', lead: 'Drive the van in either direction and the beach keeps going, and it never repeats.',
      points: ['Every 280 metres of coast rolls its own headland: how wide, how far it juts out, how high its rock terraces climb, how many sea stacks stand off it.', 'Rocks are rough spheres cut by random planes into fractured faces; the forest is thousands of palms, trees, bushes and ferns, instanced chunk by chunk.', 'Every so often there are people: a shack under palm thatch with its fairy lights and sunbeds, a row of coco huts on stilts, fishing boats pulled up above the tide. Each stretch draws its own from a hash, and after dark they light up.', 'Park anywhere and pitch camp there: awning, rug, table, lights, fire and kettle go up one at a time.', 'Or get out and walk: at eye height, leaving footprints the sea smooths away, or on Auto, strolling and looking about on your own.', 'Drag to turn the view round a point on the sand, the way a map turns: one swipe is gentle, quick swipes in a row build speed.'] },
    { course: 'At the camp', title: 'Things you can open', lead: 'Everything at the camp is modelled in code: the van, the rug, the chairs, the fire, the bottle.',
      points: ['The books are real books, with boards, a spine, and pages that bend into the gutter and pile up on the left as you read.', 'Every page is typeset onto a canvas in Fraunces, Caveat and JetBrains Mono, then laid onto the paper in 3D.', 'Tap either half of a page to turn it, or take hold of it and drag.'] },
    { course: 'On the side', title: 'Sound', lead: 'Recorded ocean, crickets, birds, gulls, an owl, the fire, rain and thunder, mixed live.',
      points: ['They follow the time of day: no crickets in the morning, and the fire crackles only while it is lit.', 'The mix is centred on 111 Hz, with a soft 111 Hz tone you can switch off.', 'The van’s engine is a recorded loop pitched by its speed and throttle.'] },
    { course: 'To finish', title: 'Shipping it', lead: 'One page, cached hard, served by a server with no dependencies.',
      points: ['The build puts the engine, styles and fonts into one HTML file; three.js and the sounds get content-hashed names and are cached for a year.', 'A Node server serves it with brotli, ETags and a strict content-security policy, and keeps the wish board.', 'Docker builds it on Railway; Cloudflare sits in front. Every push to GitHub ships.', 'Tested headless: Chromium renders every chapter and drives the van, with software graphics.'] }
  ],

  /* ── the journal by the fire: stories from the build ── */
  notes: [
    { title: 'The sea looked like fog', problem: 'A few metres out the water smeared into a grey haze.', fix: 'The water’s textures are now filtered along the view, each ripple fades by how much sea a pixel covers, and three plain swell trains replaced a blotchy swell texture. The sea stays water all the way to the horizon.' },
    { title: 'Ripples, not waves', problem: 'A click on the sea made rings, like a pond.', fix: 'A click now sends a real swell along the wave field. Clicks close together stack into a taller one, and it runs up the sand by the same rule in the shader and in the code that knocks things over.' },
    { title: 'Pins pointing at nothing', problem: 'The dots for the chapters floated in the air, one of them out at sea.', fix: 'Each dot is measured from its object every frame: the book, the bottle, the clipboard on the van, wherever the van has been driven.' },
    { title: 'A book of loose paper', problem: 'The menu looked like sheets thrown on a pad.', fix: 'Now it has boards larger than the pages, a spine that stands up as it shuts, page blocks that thicken as you read, and pages that dive into a shaded gutter.' },
    { title: 'Tyre tracks that slid', problem: 'Tracks drew off to one side, and stayed after the sea came over them.', fix: 'They are stamped every 12 cm into a window of sand that follows the van, and each wave smooths them away where it actually reached.' },
    { title: 'The engine', problem: 'The first engine was synthesised, and it was rude.', fix: 'A recorded engine loop, pitched by speed and throttle, with a starter crank before it catches.' },
    { title: '111 Hz', problem: 'Every sound should sit around one frequency.', fix: 'The whole mix is EQ’d around 111 Hz, with a quiet 111 Hz tone underneath that you can switch off.' },
    { title: 'Stuck van', problem: 'The van hit a rock and couldn’t get out.', fix: 'The van is three circles. Anything it touches pushes it out sideways, so it slides along rocks instead of sticking, and R puts it back on open sand.' },
    { title: 'The end of the beach', problem: 'The beach stopped at a wall.', fix: 'The coast is built in 128-metre chunks around you, a few milliseconds a frame, and every stretch rolls its own headland.' },
    { title: 'A flickering horizon', problem: 'With softness at zero the horizon shimmered.', fix: 'Ripples fade before they can alias, ambient occlusion fades out far away, and the ground is cut into cells so depth doesn’t tear.' },
    { title: 'The eraser line', problem: 'Where the sea drew back, the wet sand dried along a straight line, like someone rubbing it out.', fix: 'Each wave’s reach now wanders along the beach, the sand dries in patches and soaks in from the edge, and the foam breaks into lace as it goes.' }
  ],

  /* ── the clipboard: what this cove is built with ── */
  stack: [
    { group: 'In your browser', items: ['JavaScript, no framework', 'GLSL shaders', 'three.js r160', 'WebGL 2', 'Web Audio API', 'Canvas 2D'] },
    { group: 'Type', items: ['Fraunces', 'Instrument Sans', 'Caveat', 'JetBrains Mono', 'via Fontsource'] },
    { group: 'Sky', items: ['SunCalc’s sun and moon formulas', 'your time zone, for where you are'] },
    { group: 'Sound', items: ['Ocean clips made with ElevenLabs', 'Moodist ambience library', 'Kenney’s engine and knocks', 'a 111 Hz mix'] },
    { group: 'Server', items: ['Node.js 22', 'a server with no dependencies', 'brotli, ETags, CSP'] },
    { group: 'Shipping', items: ['GitHub', 'Docker', 'Railway', 'Cloudflare'] },
    { group: 'Tools', items: ['Playwright + headless Chromium', 'ffmpeg', 'Git', 'Claude, as pair programmer'] }
  ],

  /* ── who made what: every sound, typeface, library and idea that came from someone else ── */
  credits: [
    { group: 'Sound', items: [
      { what: 'Breaking waves: swell, lap and crash', who: 'Made by GokulMV with ElevenLabs', link: ['elevenlabs.io', 'https://elevenlabs.io'], licence: 'ElevenLabs terms; credit: elevenlabs.io' },
      { what: 'Ocean bed, crickets, birds, seagulls, owl, campfire, rain and thunder', who: 'The Moodist sound library by MAZE (remvze)', link: ['github.com/remvze/moodist', 'https://github.com/remvze/moodist'], licence: 'Each sound under the Pixabay Content License or CC0' },
      { what: 'The van’s engine and knocks', who: 'Kenney, Starter Kit Racing', link: ['github.com/KenneyNL/Starter-Kit-Racing', 'https://github.com/KenneyNL/Starter-Kit-Racing'], licence: 'Sounds CC0 (the kit’s code is MIT)' }
    ] },
    { group: 'Radio', items: [
      { what: 'World radio, on the picnic table', who: 'Stations from the Radio Browser community directory. Every stream belongs to its broadcaster and plays straight from them; nothing is recorded or re-hosted here', link: ['radio-browser.info', 'https://www.radio-browser.info'], licence: 'Your own songs play from your device and never leave it' }
    ] },
    { group: 'Code and ideas', items: [
      { what: 'WebGL plumbing', who: 'three.js r160, © 2010–2023 three.js authors', link: ['github.com/mrdoob/three.js', 'https://github.com/mrdoob/three.js'], licence: 'MIT' },
      { what: 'Where the sun and moon are', who: 'Formulas from SunCalc by Vladimir Agafonkin', link: ['github.com/mourner/suncalc', 'https://github.com/mourner/suncalc'], licence: 'BSD-2-Clause' },
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

  chapters: [
    { id: 'making', label: 'How it’s made', anchor: 'menu', cam: 'menu', eyebrow: 'On the picnic table', title: 'How the cove is made' },
    { id: 'plans', label: 'Blueprints', anchor: 'basket', cam: 'basket', eyebrow: 'Rolled up in the basket', title: 'Blueprints' },
    { id: 'stack', label: 'Stack', anchor: 'clipboard', cam: 'van', eyebrow: 'On the van', title: 'What it’s built with' },
    { id: 'notes', label: 'Build notes', anchor: 'journal', cam: 'journal', eyebrow: 'By the fire', title: 'Stories from the build' },
    { id: 'milestones', label: 'Milestones', anchor: 'lights', cam: 'lights', eyebrow: 'One bulb for each', title: 'The journey so far' },
    { id: 'contact', label: 'Contact', anchor: 'bottle', cam: 'bottle', eyebrow: 'Message in a bottle', title: 'A letter' }
  ]
};
