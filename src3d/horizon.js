/* ─────────────────────────────────────────────────────────────
   horizon.js — what is seen from the island across the sea
   (Layout.isle): to the east the coast of Borneo, the Crocker
   Range along the horizon, fold behind fold, hazy blue; out of it
   to the east-north-east Kinabalu, four thousand metres of granite
   sixty kilometres off, its summit plateau ragged with spires;
   and nearer, the park's other islands, forested, a beach here and
   there, one big one to the north-north-east, a few small ones
   off to the south-east, a rock or two.
   The far ranges are drawn nearer than they are and smaller by the
   same measure, so each stands as high over the horizon as it
   would (less what the earth's curve hides of it), and its haze is
   that of its true distance. North is -x, east -z.
   ───────────────────────────────────────────────────────────── */
const IsleHorizon = (() => {
  const T = THREE, D2R = Math.PI / 180;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash = (i, k) => { let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((k | 0) + 0x27d4eb2d, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  const vn = (x, k) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, k) * (1 - u) + hash(i + 1, k) * u; };
  const vn2 = (x, y, k) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v), a = hash(i * 7919 + j, k), b = hash((i + 1) * 7919 + j, k), c = hash(i * 7919 + j + 1, k), d = hash((i + 1) * 7919 + j + 1, k); return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv; };
  const fbm = (x, k, o = 5) => { let s = 0, a = 1, n = 0; for (let q = 0; q < o; q++) { s += a * vn(x, k + q * 13); n += a; a *= 0.5; x *= 2.07; } return s / n; };
  const ridged = (x, k, o = 5) => { let s = 0, a = 1, n = 0; for (let q = 0; q < o; q++) { s += a * (1 - Math.abs(2 * vn(x, k + q * 17) - 1)); n += a; a *= 0.5; x *= 2.11; } return s / n; };
  /* the way to a bearing (degrees from north, round through east), as world x, z */
  const dirOf = b => [-Math.cos(b * D2R), -Math.sin(b * D2R)];
  /* how much of a far thing the earth's curve hides, the air's bending allowed for (m) */
  const drop = D => D * D / (2 * 7.4e6);

  /* the material: lit by the sun and the sky, then the air between: the horizon's own colour, brighter toward the sun */
  function material(sky, U, mist) {
    return new T.ShaderMaterial({
      uniforms: { uHor: sky.uHor, uZen: sky.uZen, uGlow: sky.uGlow, uSunDirV: sky.uSunDirV, uKeyDirT: U.uKeyDirT, uKeyColT: U.uKeyColT, uAmbF: U.uAmbF, uMist: mist || { value: 1 } },
      vertexShader: `
attribute vec3 color; attribute float aTrue;
varying vec3 vC, vN, vW; varying float vTrue;
void main(){ vC = color; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; vTrue = aTrue;
  gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
uniform vec3 uHor, uZen, uGlow, uSunDirV, uKeyDirT, uKeyColT, uAmbF; uniform float uMist;
varying vec3 vC, vN, vW; varying float vTrue;
void main(){
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
  /* (its slopes lit by the sun and the sky; forest is dark, the high granite pale) */
  vec3 c = vC*(uAmbF*(0.55 + 0.45*clamp(n.y, 0.0, 1.0)) + uKeyColT*max(dot(n, uKeyDirT), 0.0)*0.9);
  /* (the air: the true distance's haze, the horizon's colour toward the sun brighter) */
  /* (low over the sea the air is thick with the day's damp: an island five kilometres off is a third lost in it) */
  float D = vTrue*distance(cameraPosition, vW), hz = 1.0 - exp(-D/(14000.0/max(uMist, 0.25)));
  vec3 air = uHor + uGlow*pow(max(dot(-V, normalize(uSunDirV)), 0.0), 6.0)*0.35;
  c = mix(c, air, clamp(hz, 0.0, 0.97));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` });
  }

  /* ── an island: an elongated hump of forest, ragged at its shore, a beach along part of it, rock at its points ── */
  function island(o) {
    const nr = 40, na = 128, pos = [], col = [], tr = [], idx = [], [cx, cz] = dirOf(o.b), X = cx * o.D, Z = cz * o.D, cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
    for (let j = 0; j <= nr; j++) for (let i = 0; i <= na; i++) {
      const a = i / na * Math.PI * 2, rim = 1 + 0.14 * (vn(a * 3 + o.seed, o.seed) - 0.5) + 0.07 * (vn(a * 9, o.seed + 3) - 0.5), t = j / nr, r = t * 1.04 * rim;
      const lx = Math.cos(a) * r * o.L / 2, lz = Math.sin(a) * r * o.W / 2;
      /* (its height: a hump off-centre, a second lower one, slopes steeper toward the sea; at the shore a little below the water) */
      const q = Math.hypot(lx / (o.L / 2), lz / (o.W / 2)), q2 = Math.hypot(lx / (o.L / 2) + 0.45, lz / (o.W / 2) - 0.1);
      let h = o.H * Math.max(Math.pow(Math.max(0, 1 - q * q), 0.75) * (0.85 + 0.3 * vn2(lx / 300, lz / 300, o.seed)), 0.6 * Math.pow(Math.max(0, 1 - q2 * q2 * 1.8), 0.8));
      h = t > 0.985 ? -6 : h + 2 - 4 * sm(0.93, 0.985, t);
      const wx = X + lx * cy - lz * sy, wz = Z + lx * sy + lz * cy;
      pos.push(wx, h, wz); tr.push(1);
      /* (forest, its shades; the beach's sand along one side at the water; grey rock at the points) */
      const sandK = (o.beach ? sm(0.25, 0.0, Math.abs(((a - o.beach[0] + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / o.beach[1] - 0.6) : 0) * sm(0.86, 0.95, t), rockK = sm(0.9, 0.97, t) * (1 - sandK) * sm(0.55, 0.75, vn(a * 5, o.seed + 9));
      const v = 0.8 + 0.4 * vn2(lx / 120, lz / 120, o.seed + 1);
      let c = [0.05 * v, 0.075 * v, 0.035 * v];
      c = c.map((q2c, k) => q2c + ([0.42, 0.37, 0.27][k] - q2c) * sandK); c = c.map((q2c, k) => q2c + ([0.16, 0.15, 0.135][k] - q2c) * rockK);
      col.push(...c);
    }
    for (let j = 0; j < nr; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('aTrue', new T.Float32BufferAttribute(tr, 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }

  /* the park's other islands: bearing, distance, length and breadth, height (m), how it lies, a beach (the angle round it
     the sand faces, and how far round it runs) */
  const ISLANDS = [
    { b: 24, D: 8600, L: 6200, W: 2300, H: 300, yaw: 0.5, seed: 11, beach: [3.6, 0.5] },
    { b: 103, D: 5100, L: 1700, W: 820, H: 118, yaw: -0.3, seed: 23, beach: [1.6, 0.6] },
    { b: 121, D: 4100, L: 1050, W: 620, H: 72, yaw: 0.9, seed: 31, beach: [1.3, 0.8] },
    { b: 147, D: 7200, L: 2700, W: 1250, H: 186, yaw: -0.8, seed: 41, beach: [0.6, 0.5] },
    { b: 86, D: 3300, L: 260, W: 150, H: 26, yaw: 0.2, seed: 53 },
    { b: 133, D: 9800, L: 900, W: 500, H: 60, yaw: 0.4, seed: 61, beach: [1.0, 0.7] }
  ];

  /* ── the far ranges and Kinabalu, as the sky draws them (they are further off than anything the camera can reach):
     for every bearing, each layer's crest (its height, m) and how far off it is (km) — the front range, the main range
     behind it, and Kinabalu; the sky's shader works out from these how high each stands over the horizon from wherever
     the eye is, takes off what the earth's curve hides, and hazes it by its distance ── */
  const crest = (b, k) => {
    const D = (k ? 44000 : 30000) + 9000 * (fbm(b / 9 + k * 7, 21 + k) - 0.5), lift = 1 + 0.1 * sm(90, 55, b);
    const H = ((k ? 950 : 460) + (k ? 700 : 560) * ridged(b / 6 + k * 3, 31 + k)) * lift * (0.6 + 0.4 * sm(16, 30, b) * sm(150, 132, b));
    return { D, H: b > 8 && b < 168 ? H * sm(8, 16, b) * sm(168, 158, b) : 0 };
  };
  /* Kinabalu: its height field round its middle (x across the line of sight, z along it, m) */
  const KB = { b: 63, D: 60000 };
  const SP = [[0.4, 600, 4095], [1.1, 900, 4091], [2.0, 1100, 4054], [2.6, 800, 4032], [3.3, 1250, 3933], [4.2, 950, 4062], [5.0, 700, 3990], [5.7, 1000, 4030]];
  function kbH(x, z) {
    /* (the mountain's body: a broad dome out of the range's foothills, its ridges running down west and south, to three
       thousand metres; on it the summit massif, steep walls of granite to a plateau broad from here (north to south)
       and narrow (east to west); on the plateau the spires) */
    const r = Math.hypot(x, z * 1.15), body = 1300 + 2000 * Math.max(0, 1 - Math.pow(r / 13500, 1.25)) + 240 * (vn2(x / 1800, z / 1800, 3) - 0.5) + 120 * (vn2(x / 600, z / 600, 5) - 0.5);
    const rp = Math.hypot(x / 1.0, z * 1.7), wall = 3000 + 820 * (1 - sm(1700, 2500, rp * (1 + 0.12 * Math.sin(Math.atan2(z, x) * 3 + 1)))) + 90 * (vn2(x / 260, z / 260, 9) - 0.5);
    let h = Math.max(body, rp < 2600 ? wall : 0);
    for (const [pa, pr, ph] of SP) { const px = Math.cos(pa) * pr * 1.4, pz = Math.sin(pa) * pr / 1.7, d = Math.hypot(x - px, z - pz); h = Math.max(h, ph - (d / 230) ** 1.35 * 380); }
    return h;
  }
  function profile() {
    const N = 4096, data = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const b = i / N * 360, f = crest(b, 0), m = crest(b, 1);
      data.set([f.H, f.D / 1000, m.H, m.D / 1000], i * 4);
      /* (Kinabalu: along this bearing's line of sight across the massif, the highest it stands over the horizon from the
         camp, as the height that would stand so high at the massif's own distance) */
      let kh = 0; const off = (b - KB.b) * D2R;
      if (Math.abs(off) < 0.3) {
        const x = Math.sin(off) * KB.D; let best = -1;
        for (let z = -16000; z <= 16000; z += 160) { const Dz = KB.D * Math.cos(off) + z, h = kbH(x, z) - drop(Dz), el = Math.atan2(h, Dz); if (el > best) best = el; }
        kh = Math.tan(best) * KB.D + drop(KB.D);
      }
      data.set([kh, KB.D / 1000, 0, 0], (N + i) * 4);
    }
    const tex = new T.DataTexture(new Uint16Array(data.length).map((_, k) => T.DataUtils.toHalfFloat(data[k])), N, 2, T.RGBAFormat, T.HalfFloatType);
    tex.wrapS = T.RepeatWrapping; tex.wrapT = T.ClampToEdgeWrapping; tex.magFilter = tex.minFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    return { tex };
  }

  function build(scene, o) {
    const group = new T.Group(); group.name = 'horizon'; scene.add(group);
    const mat = material(o.sky, o.U, o.mist), t0 = performance.now();
    /* the islands */
    for (const I of ISLANDS) group.add(new T.Mesh(island(I), mat));
    group.traverse(m => { if (m.isMesh) { m.frustumCulled = true; m.matrixAutoUpdate = false; m.updateMatrix(); } });
    return { group, mat, ms: Math.round(performance.now() - t0) };
  }
  return { build, profile, ISLANDS, dirOf };
})();
