/* ─────────────────────────────────────────────────────────────
   inspect.js — the cove's small lives, held up close. Click a crab
   on the sand, a shell or a starfish at the tide line, a flower at
   the forest's edge, a butterfly, a gull: it comes up into your
   hands to be turned over and looked at, and then you throw it —
   a sea creature back into the sea, with a splash; a flower back to
   the grass; anything with wings off into the air.
   What you hold is the creature's own model (models/life/), drawn
   over the finished frame so the depth of field never blurs it, lit
   by the sky above you; thrown, it goes back out into the world and
   flies there as everything else is lit. The creatures themselves
   (fauna.js, life.js, flora.js) say where each of theirs is, hide it
   while it is held, and take it back wherever it lands.
   ───────────────────────────────────────────────────────────── */
const Inspect = (() => {
  const T = THREE, TAU = Math.PI * 2;
  /* what each is, where it belongs, how big it really is (its model's radius, in metres, as built), how near it must
     be to be picked up, and a line about it */
  const KINDS = {
    crab: { model: 'life/crab', name: 'Ghost crab', latin: 'Ocypode', home: 'sea', reach: 30,
      note: 'Out on the sand at night. It runs sideways faster than you walk, and lives in a burrow it digs above the tide line.' },
    star: { model: 'life/star', name: 'Sea star', latin: 'Asteroidea', home: 'sea', reach: 30,
      note: 'It walks on hundreds of tiny tube feet underneath, and can grow back an arm it loses.' },
    scallop: { model: 'life/scallop', name: 'Scallop shell', latin: 'Pectinidae', home: 'sea', reach: 30,
      note: 'When it lived, a row of tiny eyes looked out from between its two shells, as many as two hundred of them.' },
    cowrie: { model: 'life/cowrie', name: 'Tiger cowrie', latin: 'Cypraea tigris', home: 'sea', reach: 30,
      note: 'Its gloss was kept polished by the animal inside, which wraps its mantle right round the shell.' },
    whelk: { model: 'life/whelk', name: 'Whelk shell', latin: 'Buccinidae', home: 'sea', reach: 30,
      note: 'Nearly every whelk coils the same way: hold it point up with its mouth toward you, and the mouth is on the right.' },
    daisy: { model: 'life/daisy', name: 'Beach daisy', latin: 'Sphagneticola trilobata', home: 'land', reach: 26, flower: 'daisy', view: [-2.2, 0.95],
      note: 'Each yellow ray is a flower of its own; the disc in the middle is a crowd of tiny tubular ones.' },
    glory: { model: 'life/glory', name: 'Beach morning glory', latin: 'Ipomoea pes-caprae', home: 'land', reach: 26, flower: 'glory', view: [-2.2, 0.7],
      note: 'Goat’s foot, for its leaves. Its runners hold the dunes together, and each flower lasts a single day.' },
    frangi: { model: 'life/frangi', name: 'Frangipani', latin: 'Plumeria', home: 'land', reach: 26, flower: 'frangi', view: [-2.2, 0.95],
      note: 'Sweetest after dark, to bring the moths, though it has no nectar to give them.' },
    butterfly: { model: 'life/butterfly', name: 'Butterfly', latin: 'Lepidoptera', home: 'air', toLand: true, handoff: 3.4, reach: 24, view: [-2.6, 0.9],
      names: [['Plain tiger', 'Danaus chrysippus'], ['Lemon emigrant', 'Catopsilia pomona'], ['Cabbage white', 'Pieris rapae'], ['Common blue', 'Polyommatus icarus']],
      note: 'It tastes with its feet: what it lands on tells it whether a leaf is the one to lay its eggs on.' },
    dragonfly: { model: 'life/dragonfly', name: 'Dragonfly', latin: 'Anisoptera', home: 'air', toLand: true, handoff: 3, reach: 24, view: [-2.4, 0.95],
      names: [['Blue emperor', 'Anax imperator'], ['Green darner', 'Anax junius'], ['Scarlet darter', 'Crocothemis erythraea'], ['Wandering glider', 'Pantala flavescens']],
      note: 'Each of its eyes has up to thirty thousand facets; between them it sees almost all the way round.' },
    firefly: { model: 'life/firefly', name: 'Firefly', latin: 'Lampyridae', home: 'air', toLand: true, handoff: 3, reach: 20, view: [-2.4, 0.9],
      note: 'Its light is cold: nearly all the energy goes into light, almost none into heat. Each kind flashes its own code.' },
    gull: { model: 'life/gull', name: 'Herring gull', latin: 'Larus argentatus', home: 'air', handoff: 0.75, reach: 40, view: [-2.0, 0.25],
      note: 'It drinks seawater: glands above its eyes take the salt out of its blood and it runs out of its bill.' },
    sandpiper: { model: 'life/sandpiper', name: 'Sanderling', latin: 'Calidris alba', home: 'air', handoff: 0.6, reach: 35, view: [-2.0, 0.3],
      note: 'It runs down the wet sand behind each wave and back up ahead of the next, probing for the tiny shellfish the water stirs up.' },
    bat: { model: 'life/bat', name: 'Free-tailed bat', latin: 'Molossidae', home: 'air', handoff: 1.1, reach: 30, view: [-2.2, 1.0],
      note: 'It hunts by echo in the dark, calling faster and faster as it closes in on a moth, up to two hundred times a second.' },
    turtle: { model: 'life/turtle', name: 'Green sea turtle', latin: 'Chelonia mydas', home: 'sea', reach: 45, view: [-2.2, 0.75],
      note: 'Named for the green of the fat beneath its shell, not the shell itself. A grown one grazes on seagrass.' },
    dolphin: { model: 'life/dolphin', name: 'Bottlenose dolphin', latin: 'Tursiops truncatus', home: 'sea', big: true, reach: 160, view: [-1.9, 0.3],
      note: 'It sleeps with one half of its brain at a time, one eye open, so it can keep coming up to breathe.' },
    whale: { model: 'life/whale', name: 'Humpback whale', latin: 'Megaptera novaeangliae', home: 'sea', big: true, reach: 450, view: [-1.9, 0.35],
      note: 'Its flippers are a third as long as it is, the longest of any whale; its songs can go on for hours.' },
    hermit: { model: 'life/hermit', name: 'Hermit crab', latin: 'Paguroidea', home: 'sea', reach: 26, view: [-2.4, 0.55],
      note: 'Its soft tail is curled into a shell some snail left behind; as it grows it moves house to a bigger one.' },
    shrimp: { model: 'life/shrimp', name: 'Cleaner shrimp', latin: 'Lysmata amboinensis', home: 'sea', reach: 24, view: [-2.3, 0.5],
      note: 'Fish queue at its station on the rocks to have their parasites picked off, even big ones that could eat it.' },
    reeffish: { model: 'life/reeffish', name: 'Sergeant major', latin: 'Abudefduf saxatilis', home: 'sea', reach: 28, view: [-1.75, 0.2],
      note: 'Named for its stripes, like a sergeant’s; the males guard their eggs on the rocks and turn darker blue while they do.' },
    fish: { model: 'life/fish', name: 'Grey mullet', latin: 'Mugil cephalus', home: 'sea', reach: 40, view: [-1.75, 0.2],
      note: 'Mullet leap clear of the water all the time, and still nobody is quite sure why.' }
  };
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* opt: { scene, root (where thrown things fly), camera, sources: [fn(list, cam)], splash(x, z, size), ground(x, z) } */
  function build(opt) {
    const { camera } = opt, sources = opt.sources || [];
    /* the view of what is held: a scene of its own, a key light from up and to the left, a cool fill from the right, a
       rim from behind; the sky's own environment map for its reflections */
    const oS = new T.Scene(), key = new T.DirectionalLight(0xffffff, 0), fill = new T.DirectionalLight(0xffffff, 0), rim = new T.DirectionalLight(0xffffff, 0), amb = new T.AmbientLight(0xffffff, 0);
    oS.add(key, key.target, fill, fill.target, rim, rim.target, amb);
    /* the world behind dimmed toward the edges while something is held */
    const veil = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ uniforms: { uK: { value: 0 }, uAsp: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform float uK, uAsp; varying vec2 vUv;
void main(){ vec2 p = (vUv - 0.5)*vec2(uAsp, 1.0); float r = length(p); gl_FragColor = vec4(0.02, 0.025, 0.04, uK*(0.22 + 0.5*smoothstep(0.25, 0.95, r))); }` }));
    veil.frustumCulled = false; const vS = new T.Scene(); vS.add(veil); const vCam = new T.Camera();

    let held = null, k = 0, lastT = null;
    const flying = [], lying = [];
    const _v = new T.Vector3(), _w = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _e = new T.Euler(), _m = new T.Matrix4();
    const UP = new T.Vector3(0, 1, 0), RIGHT = new T.Vector3(1, 0, 0);

    /* a model, centred on its pivot, with what it needs to know about its size */
    function specimen(kind, o) {
      const K = KINDS[kind], model = Models.make(K.model, o || {}), pivot = new T.Group();
      const box = new T.Box3().setFromObject(model), sph = box.getBoundingSphere(new T.Sphere());
      model.position.copy(sph.center).negate(); pivot.add(model);
      const mats = new Set(); model.traverse(m => { if (m.isMesh) { m.frustumCulled = false; (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => mats.add(x)); } });
      return { pivot, model, R: sph.radius || 0.05, mats: [...mats], anim: model.userData.anim || null };
    }
    function dispose(sp) {
      sp.pivot.parent && sp.pivot.parent.remove(sp.pivot);
      sp.pivot.traverse(m => { if (m.isMesh) m.geometry.dispose(); });
      for (const m of sp.mats) { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); }
    }

    /* ── picking: what lies within reach near where the screen was touched ── */
    function candidates() { const list = []; for (const fn of sources) { try { fn(list, camera.position); } catch (e) { /* a source that can't say */ } } return list; }
    function pick(nx, ny, W, H) {
      if (held) return null;
      const list = candidates(), tf = Math.tan(camera.fov * Math.PI / 360);
      let best = null, bs = 1e9;
      for (const c of list) {
        const K = KINDS[c.kind]; if (!K) continue;
        _v.set(c.x, c.y, c.z); const d = _v.distanceTo(camera.position); if (d > (c.reach || K.reach)) continue;
        _v.project(camera); if (_v.z > 1 || _v.z < -1) continue;
        const sx = (_v.x * 0.5 + 0.5 - nx) * W, sy = (-_v.y * 0.5 + 0.5 - ny) * H, sd = Math.hypot(sx, sy);
        const rpx = (c.r || 0.05) / (d * tf) * H / 2, lim = Math.max(rpx * 1.35, 18);
        if (sd > lim) continue;
        const score = sd / Math.max(rpx, 12) + d * 0.004;
        if (score < bs) { bs = score; best = c; }
      }
      return best;
    }

    /* ── holding one ── */
    function hold(c, t) {
      if (held || !c || !KINDS[c.kind]) return null;
      const K = KINDS[c.kind], sp = specimen(c.kind, c.opts);
      c.take && c.take();
      /* it comes up from where it was, as big as it was, turned as it lay */
      const real = (c.size || 1), from = new T.Vector3(c.x, c.y, c.z);
      _e.set(0, c.yaw || 0, 0); const q0 = new T.Quaternion().setFromEuler(_e);
      const view = K.view || [-2.2, 0.5], qU = new T.Quaternion().setFromAxisAngle(RIGHT, view[1]).multiply(_q.setFromAxisAngle(UP, view[0]));
      oS.add(sp.pivot); sp.pivot.position.copy(from); sp.pivot.quaternion.copy(q0); sp.pivot.scale.setScalar(real);
      held = { c, K, sp, t0: t, from, q0, real, qU, spin: new T.Vector2(), touched: -1e9, zoom: 1, phase: 'in', back: null, flick: null };
      const nm = K.names && c.opts && K.names[c.opts.kind | 0];
      return { kind: c.kind, name: nm ? nm[0] : K.name, latin: nm ? nm[1] : K.latin, note: K.note, home: K.home, flower: K.flower || null, big: !!K.big };
    }
    /* where it is held: in front of the eye, a little below the middle */
    function holdPose(out, q) {
      const D = 0.6 * held.zoom; _v.set(0, 0.045 * held.zoom, -D).applyQuaternion(camera.quaternion); out.copy(camera.position).add(_v);
      q.copy(camera.quaternion).multiply(held.qU);
    }
    const shown = sp => 0.16 / sp.R;   /* (scaled so it fills a good part of the view) */
    function turn(dx, dy) {
      if (!held || held.phase !== 'hold') return;
      held.qU.premultiply(_q.setFromAxisAngle(UP, dx * 0.011)).premultiply(_q.setFromAxisAngle(RIGHT, dy * 0.011)).normalize();
      held.spin.set(dx * 0.011, dy * 0.011); held.touched = lastT ?? 0;
    }
    function zoom(f) { if (held) held.zoom = Math.max(0.62, Math.min(1.7, held.zoom * f)); }

    /* ── letting it go: thrown where it belongs, or put back where it was ── */
    function throwIt(t, dir) {
      if (!held || held.phase !== 'hold') return false;
      /* (a dolphin or a whale is let go: back it goes to where it was, with a splash as it goes in) */
      if (held.K.big) { const at = held.from.clone(); putBack(t); held.splashAt = at; return { to: 'sea', at: [at.x, at.y, at.z] }; }
      const h = held, K = h.K, sp = h.sp, p0 = sp.pivot.position.clone(), fwd = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const f2 = new T.Vector2(fwd.x, fwd.z); if (f2.lengthSq() < 1e-6) f2.set(0, -1); f2.normalize();
      /* (a flick sideways sends it that way a little) */
      if (dir) { const side = new T.Vector2(-f2.y, f2.x); f2.addScaledVector(side, Math.max(-0.6, Math.min(0.6, dir))).normalize(); }
      const target = landing(K.home, p0, f2);
      const air = K.home === 'air';
      const dist = Math.hypot(target.x - p0.x, target.z - p0.z), Tf = air ? 0 : Math.max(0.7, Math.min(1.7, 0.45 + dist * 0.075)), g = -9.8;
      let vel;
      if (!air) vel = new T.Vector3((target.x - p0.x) / Tf, (target.y - p0.y - 0.5 * g * Tf * Tf) / Tf, (target.z - p0.z) / Tf);
      else if (K.toLand) { const tx = p0.x + f2.x * 3, tz = Layout.vegZ(tx) + 4, d = Math.hypot(tx - p0.x, tz - p0.z) || 1; vel = new T.Vector3((tx - p0.x) / d * 2.2, 1.1, (tz - p0.z) / d * 2.2); }
      else vel = new T.Vector3(f2.x * 4, 3.4, f2.y * 4);
      const axis = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      flying.push({ h, sp, p: p0, vel, g, t0: t, Tf, target, axis, w: 5 + Math.random() * 6, s0: sp.pivot.scale.x, inWorld: false, done: false, sink: 0 });
      held = null;
      return { to: K.home, at: [target.x, target.y, target.z] };
    }
    /* where something thrown comes down: on the water well beyond the line of the waves for a sea creature; in the grass
       at the forest's edge for a flower; for one with wings, nowhere (it flies) */
    function landing(home, p0, f2) {
      const gr = opt.ground, cx = camera.position.x, cz = camera.position.z;
      if (home === 'sea') {
        for (let d = 6; d <= 26; d += 1.5) { const x = cx + f2.x * d, z = cz + f2.y * d; if (z < Layout.shoreZ(x) - 3 && gr(x, z) <= 0.02) return new T.Vector3(x, 0, z); }
        const x = cx + f2.x * 5; return new T.Vector3(x, 0, Layout.shoreZ(x) - 6);
      }
      if (home === 'land') {
        for (let d = 3; d <= 16; d += 1) { const x = cx + f2.x * d, z = cz + f2.y * d, vz = Layout.vegZ(x); if (z > vz - 1.6 && z < vz + 4) return new T.Vector3(x, Math.max(0, gr(x, z)), z); }
        const x = cx + f2.x * 5, z = Layout.vegZ(x) - 0.6 + Math.random() * 1.6; return new T.Vector3(x, Math.max(0, gr(x, z)), z);
      }
      return new T.Vector3(p0.x + f2.x * 20, p0.y + 8, p0.z + f2.y * 20);
    }
    function putBack(t) {
      if (!held || held.phase !== 'hold') return false;
      held.phase = 'back'; held.back = { t0: t, p: held.sp.pivot.position.clone(), q: held.sp.pivot.quaternion.clone(), s: held.sp.pivot.scale.x };
      return true;
    }
    /* gone into the bouquet (flowers): it shrinks away toward the bottom of the view */
    function keep(t) {
      if (!held || held.phase !== 'hold') return false;
      held.phase = 'keep'; held.back = { t0: t, p: held.sp.pivot.position.clone(), s: held.sp.pivot.scale.x };
      return true;
    }

    /* ── every frame ── */
    function update(t, S) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      k += ((held && (held.phase === 'in' || held.phase === 'hold') ? 1 : 0) - k) * Math.min(1, dt * 5);
      if (held) {
        const h = held, sp = h.sp, P = sp.pivot;
        if (h.phase === 'in' || h.phase === 'hold') {
          /* turning on by itself until it is touched; a spin given it slows away */
          if (h.phase === 'hold') {
            const idle = t - h.touched > 2.5;
            if (h.spin.lengthSq() > 1e-8) { h.qU.premultiply(_q.setFromAxisAngle(UP, h.spin.x)).premultiply(_q.setFromAxisAngle(RIGHT, h.spin.y)).normalize(); h.spin.multiplyScalar(Math.pow(0.04, dt)); if (h.spin.lengthSq() < 1e-8) h.spin.set(0, 0); }
            if (idle) h.qU.premultiply(_q.setFromAxisAngle(UP, 0.32 * dt * sm(2.5, 4, t - h.touched)));
          }
          holdPose(_w, _q2);
          const u = h.phase === 'in' ? ease(Math.min(1, (t - h.t0) / 0.55)) : 1;
          P.position.lerpVectors(h.from, _w, u); P.quaternion.slerpQuaternions(h.q0, _q2, u);
          P.scale.setScalar(h.real + (shown(sp) - h.real) * u);
          /* (bobbing a little in the hand) */
          P.position.y += 0.004 * Math.sin(t * 1.3) * u;
          if (h.phase === 'in' && u >= 1) h.phase = 'hold';
        } else if (h.phase === 'back' || h.phase === 'keep') {
          const b = h.back, u = ease(Math.min(1, (t - b.t0) / 0.5));
          if (h.phase === 'back') { P.position.lerpVectors(b.p, h.from, u); P.quaternion.slerpQuaternions(b.q, h.q0, u); P.scale.setScalar(b.s + (h.real - b.s) * u); }
          else { _v.set(-0.25, -0.32, -0.6).applyQuaternion(camera.quaternion).add(camera.position); P.position.lerpVectors(b.p, _v, u); P.scale.setScalar(b.s * (1 - u)); }
          if (u >= 1) { if (h.phase === 'back' && h.c.give) h.c.give('back', h.from); if (h.splashAt && opt.splash) opt.splash(h.splashAt.x, h.splashAt.z, 1.4); dispose(sp); held = null; }
        }
        if (held && sp.anim) sp.anim(t);
      }
      /* thrown */
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i], P = f.sp.pivot, e = t - f.t0, K = f.h.K;
        /* out of the hand's own view and into the world once it is on its way */
        if (!f.inWorld && e > 0.12) { opt.root.attach ? opt.root.attach(P) : opt.root.add(P); f.inWorld = true; }
        P.scale.setScalar(f.s0 + (f.h.real - f.s0) * sm(0, 0.3, e));
        if (K.home === 'air') {
          /* wings: an insect flutters off toward the trees, weaving; a bird is tossed up and away, and takes to the air
             (handed back to the world's own flock once it is off) */
          if (K.toLand) { P.position.addScaledVector(f.vel, dt); P.position.x += Math.sin(e * 7) * 0.6 * dt; P.position.y += Math.sin(e * 11) * 0.5 * dt; f.vel.multiplyScalar(1 + dt * 0.3);
            _v.copy(f.vel).setY(0); if (_v.lengthSq() > 1e-6) { const yaw = Math.atan2(-_v.z, _v.x); P.quaternion.slerp(_q.setFromEuler(_e.set(0, yaw, 0)), Math.min(1, dt * 4)); } }
          else { P.position.addScaledVector(f.vel, dt); f.vel.y -= 4.5 * dt; P.quaternion.premultiply(_q.setFromAxisAngle(f.axis, f.w * 0.25 * dt)); }
          if (e > (K.handoff || 4)) { f.done = true; if (f.h.c.give) f.h.c.give('air', P.position); }
        } else if (!f.landed) {
          const tt = Math.min(e, f.Tf);
          P.position.set(f.p.x + f.vel.x * tt, f.p.y + f.vel.y * tt + 0.5 * f.g * tt * tt, f.p.z + f.vel.z * tt);
          P.quaternion.premultiply(_q.setFromAxisAngle(f.axis, f.w * dt));
          if (e >= f.Tf) {
            f.landed = t;
            if (K.home === 'sea') { opt.splash && opt.splash(f.target.x, f.target.z, Math.min(1.2, 0.5 + f.h.sp.R * 4)); }
            else { /* a flower: down on the grass, lying on its side */ f.rest = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2 * (0.75 + 0.2 * Math.random()), Math.random() * TAU, 0, 'YXZ')); }
          }
        } else {
          const el = t - f.landed;
          if (K.home === 'sea') {
            /* under it goes, slowing in the water, gone */
            P.position.y -= dt * (0.6 + 2 * Math.max(0, 0.3 - el)); P.quaternion.premultiply(_q.setFromAxisAngle(f.axis, f.w * 0.3 * dt));
            if (el > 1.2) { f.done = true; if (f.h.c.give) f.h.c.give('sea', f.target); }
          } else {
            P.quaternion.slerp(f.rest, Math.min(1, dt * 9)); P.position.y = f.target.y + 0.012 + 0.05 * Math.max(0, Math.sin(Math.min(1, el / 0.3) * Math.PI)) * (el < 0.3 ? 1 : 0);
            if (el > 0.8) { f.done = true; if (f.h.c.give) f.h.c.give('land', f.target); lying.push({ sp: f.sp, at: t }); if (lying.length > 24) dispose(lying.shift().sp); }
          }
        }
        if (f.sp.anim && !f.landed) f.sp.anim(t * 1.6, true);
        if (f.done) { flying.splice(i, 1); if (K.home !== 'land') dispose(f.sp); }
      }
      /* the held one's light: the key from up and to the left of the eye, tinted by the sky's own light; a fill from the
         right in the sky's colour; a rim from behind */
      if (held && S) {
        const P = held.sp.pivot.position, kc = S.keyCol, kl = Math.max(kc[0], kc[1], kc[2], 1e-4), ac = S.amb, al = Math.max(ac[0], ac[1], ac[2], 1e-4);
        const day = S.day ?? 1;
        key.color.setRGB(0.55 + 0.45 * kc[0] / kl, 0.55 + 0.45 * kc[1] / kl, 0.55 + 0.45 * kc[2] / kl); fill.color.setRGB(0.6 + 0.4 * ac[0] / al, 0.6 + 0.4 * ac[1] / al, 0.6 + 0.4 * ac[2] / al); rim.color.setRGB(1, 0.98, 0.95);
        const place = (L, x, y, z) => { _v.set(x, y, z).applyQuaternion(camera.quaternion); L.position.copy(P).addScaledVector(_v, 4); L.target.position.copy(P); L.target.updateMatrixWorld(); };
        place(key, -0.55, 0.75, 0.55); place(fill, 0.8, 0.1, 0.45); place(rim, 0.1, 0.5, -0.9);
        held.light = { key: 2.6, fill: 0.75 + 0.25 * day, rim: 1.4, amb: oS.environment ? 0 : 0.5 };
      }
    }
    /* drawn over the finished frame (exp: the frame's exposure, so the sky's reflections in it look as they do round it) */
    function draw(R, exp, asp) {
      if (!held && k < 0.003) return;
      /* (straight to the screen, after the post pass: tone-mapped and encoded here) */
      const tm = R.toneMapping, te = R.toneMappingExposure, ac = R.autoClear, cs = R.outputColorSpace;
      R.autoClear = false; R.setRenderTarget(null);
      veil.material.uniforms.uK.value = k; veil.material.uniforms.uAsp.value = asp || 1; R.render(vS, vCam);
      if (held) {
        oS.environment = opt.scene.environment;
        const L = held.light || { key: 2.6, fill: 0.9, rim: 1.4, amb: 0.5 }, e = Math.max(exp, 1e-3);
        key.intensity = L.key / e; fill.intensity = L.fill / e; rim.intensity = L.rim / e; amb.intensity = L.amb / e;
        R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = e; R.outputColorSpace = T.SRGBColorSpace;
        R.clearDepth(); R.render(oS, camera);
      }
      R.toneMapping = tm; R.toneMappingExposure = te; R.autoClear = ac; R.outputColorSpace = cs;
    }
    /* everything let go at once (the coast rebuilt under the camp) */
    function clear() {
      if (held) { if (held.c.give) held.c.give('back', held.from); dispose(held.sp); held = null; }
      for (const f of flying) dispose(f.sp); flying.length = 0; for (const l of lying) dispose(l.sp); lying.length = 0; k = 0;
    }
    /* the whole scene moved: what lies on the grass and what is in the air go with it */
    function shift(dx, dz) { for (const f of flying) { f.p.x += dx; f.p.z += dz; f.target.x += dx; f.target.z += dz; if (f.inWorld) { f.sp.pivot.position.x += dx; f.sp.pivot.position.z += dz; } } for (const l of lying) { l.sp.pivot.position.x += dx; l.sp.pivot.position.z += dz; } }
    return {
      pick, hold, turn, zoom, throwIt, putBack, keep, update, draw, shift, clear,
      get held() { return held ? { kind: held.c.kind, phase: held.phase, name: held.K.name } : null; },
      get busy() { return !!held; },
      get flying() { return flying.length; },
      get k() { return k; },
      candidates, KINDS
    };
  }
  return { build, KINDS };
})();
