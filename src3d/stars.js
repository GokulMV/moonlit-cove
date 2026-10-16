/* ─────────────────────────────────────────────────────────────
   stars.js — the real night sky over wherever the visitor is.
   Every star to magnitude 6 (the Hipparcos catalogue, stardata.js)
   stands where it really does for their latitude and their time, and
   the sky turns about the celestial pole as the night goes on: the
   stars rise out of the sea in the east and set behind the forest.
   The planets are among them, where they really are tonight, bright
   and steady. Low down the air dims the stars, warms them and makes
   them twinkle; the clouds and the moon hide them. The Milky Way is
   drawn by the sky itself (glsl.js), from the outline traced here
   into a picture of the whole sky (milkyTex).
   ───────────────────────────────────────────────────────────── */
const Stars = (() => {
  const T = THREE;
  const bytes = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  /* a star's colour from its B−V index: its temperature (Ballesteros), the colour of a body that hot (Helland's fit to the
     blackbody), in linear light, its brightest channel 1, and a little paler than that, as the eye sees them */
  function bvRGB(bv) {
    const K = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)), t = K / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    const c = [r, g, b].map(v => Math.pow(Math.max(0, Math.min(255, v)) / 255, 2.2)), m = Math.max(...c);
    return c.map(v => 0.4 + 0.6 * v / m);
  }
  const VS = `
uniform mat3 uEq;                 /* a direction among the stars (equatorial) → the world's (by the sidereal time and latitude) */
uniform float uK, uPx, uTime, uMoonR, uGam;
uniform vec3 uMoonDir;
${Layout.isle ? 'uniform sampler2D uHzP; uniform float uHzOn;   /* the far ranges round the island (horizon.js) */' : ''}
attribute float aMag, aSeed, aTw;
attribute vec3 aCol;
varying vec3 vC; varying float vA;
void main(){
  vec3 d = normalize(uEq*position);
  float alt = d.y;
  /* the air: a fifth of a magnitude dimmer for every thickness of it looked through, and redder low down */
  float am = 1.0/(max(alt, 0.0) + 0.035), ext = exp(-0.19*(am - 1.0));
  /* twinkling: stronger near the horizon, none for the planets */
  float sc = (0.12 + 0.45*smoothstep(0.45, 0.04, alt))*aTw;
  float tw = 1.0 + sc*(0.6*sin(uTime*(8.0 + 6.0*fract(aSeed*13.1)) + aSeed*40.0) + 0.4*sin(uTime*(19.0 + 9.0*fract(aSeed*7.7)) + aSeed*71.0));
  /* (as the eye sees them, not as a camera does: the faint ones not so far below the bright as their light is, uGam,
     so that a dark sky shows its thousands, as it does to eyes that have got used to the dark) */
  float flux = pow(pow(10.0, -0.4*(aMag - 1.0)), uGam)*ext*max(tw, 0.2);
  /* a faint star is a spot a pixel and a half across; a bright one spreads its light wider (in the eye, as in a lens) */
  float sz = uPx*(1.6 + 1.1*clamp(2.0 - aMag, 0.0, 4.0) + 0.6*sqrt(max(flux, 0.0)));
  vA = uK*flux*2.2/(sz*sz);
  vC = mix(aCol, aCol*vec3(1.0, 0.78, 0.55), smoothstep(0.3, 0.02, alt));
  /* (behind the moon's disc there is nothing to see) */
  if (dot(d, uMoonDir) > cos(uMoonR*1.2)) vA = 0.0;${Layout.isle ? `
  /* (round the island, none behind the far ranges: below a crest, as the sky draws it) */
  if (uHzOn > 0.5 && alt < 0.1){
    float a = atan(d.x, -d.z), u = fract(a/6.2831853 + 0.25), hc = max(cameraPosition.y, 0.0), e = asin(clamp(alt, -1.0, 1.0));
    vec4 P0 = textureLod(uHzP, vec2(u, 0.25), 0.0), P1 = textureLod(uHzP, vec2(u, 0.75), 0.0);
    for (int k = 0; k < 3; k++){ vec2 L = k == 0 ? P0.xy : k == 1 ? P0.zw : P1.xy; if (L.x < 1.0) continue; float D = L.y*1000.0; if (e < atan(L.x - hc - D*D/14.8e6, D)) vA = 0.0; }
  }` : ''}
  vec4 p = projectionMatrix*viewMatrix*vec4(cameraPosition + d*1000.0, 1.0);
  p.z = p.w*${Layout.isle ? '0.999989' : '0.99998'};      /* (just in front of the sky dome: drawn on it, and under everything nearer; round the island, behind its neighbours ten kilometres off) */
  gl_Position = alt > -0.03 && vA > 1e-5 ? p : vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = sz;
}`;
  const FS = `
uniform sampler2D uCB; uniform float uCBOn, uCov;
varying vec3 vC; varying float vA;
void main(){
  vec2 q = gl_PointCoord - 0.5; float r2 = dot(q, q)*4.0;
  float g = exp(-r2*4.5);
  if (g < 0.012) discard;
  /* the clouds in front of it: what the sky drew this pixel's clouds from, or, without that, the sky's cover */
  float Tr = 1.0 - uCov;
  if (uCBOn > 0.5) Tr = clamp(texelFetch(uCB, ivec2(gl_FragCoord.xy), 0).a, 0.0, 1.0);
  gl_FragColor = vec4(vC*vA*g*Tr, 1.0);
}`;
  /* the Milky Way: its five outlines of brightness, filled one over the other on a picture of the whole sky (RA across,
     Dec up), softened by a blur of most of a degree; a little warmer toward the bulge in Sagittarius */
  function milkyTex() {
    /* (drawn with a margin either side, so the blur finds the sky on the far side of RA 0 there, not the canvas's edge) */
    const W = 2048, H = 1024, P = 64, c = document.createElement('canvas'); c.width = W + 2 * P; c.height = H;
    const a = c.getContext('2d'), w = new Uint16Array(bytes(StarData.milky).buffer);
    a.fillStyle = '#000'; a.fillRect(0, 0, W + 2 * P, H); a.globalCompositeOperation = 'lighter';
    let k = 0; const nL = w[k++];
    for (let l = 0; l < nL; l++) {
      const nR = w[k++]; a.beginPath();
      for (let ri = 0; ri < nR; ri++) {
        const n = w[k++], pts = [];
        let prev = null;
        for (let i = 0; i < n; i++) { let ra = w[k++] / 10; const dec = w[k++] / 10 - 90; if (prev !== null) { while (ra - prev > 180) ra -= 360; while (ra - prev < -180) ra += 360; } prev = ra; pts.push([ra, dec]); }
        /* (drawn three times, a turn of the sky apart, so whatever crosses RA 0 comes in at the other side) */
        for (const off of [-360, 0, 360]) pts.forEach(([ra, dec], i) => { const x = P + (ra + off) / 360 * W, y = (90 - dec) / 180 * H; i ? a.lineTo(x, y) : a.moveTo(x, y); });
        a.closePath();
      }
      a.fillStyle = `rgba(255,255,255,${[0.22, 0.2, 0.2, 0.19, 0.19][l] || 0.2})`; a.fill('evenodd');
    }
    /* soften it */
    const m = document.createElement('canvas'); m.width = W + 2 * P; m.height = H; const mx = m.getContext('2d');
    mx.filter = 'blur(11px)'; mx.drawImage(c, 0, 0); mx.filter = 'none';
    const b = document.createElement('canvas'); b.width = W; b.height = H; b.getContext('2d').drawImage(m, -P, 0);
    const t = new T.CanvasTexture(b); t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }

  function build(scene, shared) {
    /* the catalogue's stars, to magnitude 6; then the fainter ones a dark sky shows the eye that has got used to it, to
       7.5 (the catalogue stops at 6, so these are scattered as they lie: more of them each magnitude fainter, thickest
       along the Milky Way, as many again as the catalogue thrice over); and the planets */
    const N0 = StarData.count, NF = 16000, N = N0 + NF, NP = 5, u8 = bytes(StarData.stars), dv = new DataView(u8.buffer);
    const pos = new Float32Array((N + NP) * 3), mag = new Float32Array(N + NP), col = new Float32Array((N + NP) * 3), seed = new Float32Array(N + NP), tw = new Float32Array(N + NP);
    for (let i = 0; i < N0; i++) {
      const ra = dv.getUint16(i * 6, true) / 65535 * Math.PI * 2, dec = (dv.getUint16(i * 6 + 2, true) / 65535 - 0.5) * Math.PI;
      pos.set([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], i * 3);
      mag[i] = dv.getUint8(i * 6 + 4) / 30 - 2; col.set(bvRGB(dv.getUint8(i * 6 + 5) / 100 - 0.5), i * 3); seed[i] = (i * 0.618034) % 1; tw[i] = 1;
    }
    const mw = milkyTex(), md = mw.image.getContext('2d').getImageData(0, 0, mw.image.width, mw.image.height).data, MW = mw.image.width, MH = mw.image.height;
    let rs = 0x2f6e2b1; const rnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = N0; i < N;) {
      const z = rnd() * 2 - 1, ra = rnd() * Math.PI * 2, dec = Math.asin(z);
      const px = Math.min(MW - 1, Math.floor(ra / (Math.PI * 2) * MW)), py = Math.min(MH - 1, Math.floor((90 - dec * 180 / Math.PI) / 180 * MH)), m = md[(py * MW + px) * 4] / 255;
      if (rnd() > 0.28 + 2.2 * m * m) continue;
      pos.set([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), z], i * 3);
      /* (counts of stars rise about threefold a magnitude: so mostly the faintest) */
      mag[i] = 6 + Math.log(1 + rnd() * (Math.pow(10, 0.48 * 1.5) - 1)) / (0.48 * Math.LN10);
      let g = 0; for (let k = 0; k < 4; k++) g += rnd(); col.set(bvRGB(0.55 + (g - 2) * 0.55), i * 3); seed[i] = (i * 0.618034) % 1; tw[i] = 1; i++;
    }
    /* the planets: the last five points, placed every frame */
    for (let i = N; i < N + NP; i++) { mag[i] = 9; col.set([1, 1, 1], i * 3); seed[i] = 0; tw[i] = 0.15; pos.set([1, 0, 0], i * 3); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aMag', new T.BufferAttribute(mag, 1)); g.setAttribute('aCol', new T.BufferAttribute(col, 3));
    g.setAttribute('aSeed', new T.BufferAttribute(seed, 1)); g.setAttribute('aTw', new T.BufferAttribute(tw, 1));
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e9);
    const U = { uEq: { value: new T.Matrix3() }, uK: { value: 0 }, uPx: { value: 1 }, uTime: { value: 0 }, uMoonR: { value: 0.0175 }, uGam: { value: 0.78 }, uMoonDir: { value: new T.Vector3(0, -1, 0) },
      uCB: shared.uCB, uCBOn: shared.uCBOn, uCov: { value: 0 }, uHzP: shared.uHzP || { value: null }, uHzOn: shared.uHzOn || { value: 0 } };
    const m = new T.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: false, depthWrite: false, depthTest: true,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1001; scene.add(pts);
    /* the turn of the sky: equatorial directions → the world's (−x north, −z east, y up) */
    const eq = new T.Matrix3(), eqT = new T.Matrix3();
    function frame(ms, loc) {
      const L = Astro.lst(ms, loc.lng), p = loc.lat * Math.PI / 180, cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(p), sp = Math.sin(p);
      eq.set(sp * cL, sp * sL, -cp, cp * cL, cp * sL, sp, sL, -cL, 0); eqT.copy(eq).transpose();
      return eq;
    }
    let plT = -1e18;
    /* every frame: the sky turned to the time; the planets moved (each few minutes of sky time); how bright it all is */
    function update(o) {
      U.uEq.value.copy(frame(o.ms, o.loc)); U.uTime.value = o.t; U.uK.value = o.k; U.uPx.value = o.px; U.uCov.value = o.cover || 0;
      if (o.moonDir) U.uMoonDir.value.set(o.moonDir[0], o.moonDir[1], o.moonDir[2]);
      if (Math.abs(o.ms - plT) > 120e3) {
        plT = o.ms;
        Astro.planets(o.ms).forEach((P, i) => { const k = N + i; pos.set([Math.cos(P.dec) * Math.cos(P.ra), Math.cos(P.dec) * Math.sin(P.ra), Math.sin(P.dec)], k * 3); mag[k] = Math.max(-4.6, P.mag); col.set(P.col, k * 3); });
        g.attributes.position.needsUpdate = g.attributes.aMag.needsUpdate = g.attributes.aCol.needsUpdate = true;
      }
      pts.visible = o.k > 1e-6;
    }
    return { update, frame, eq, eqT, milky: mw, points: pts };
  }
  return { build, bvRGB };
})();
