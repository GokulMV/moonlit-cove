/* ─────────────────────────────────────────────────────────────
   fx.js — flames, embers, smoke, coffee steam, fireflies, moths
   around the lamps, and butterflies at sunrise.
   ───────────────────────────────────────────────────────────── */
const FX = (() => {
  const T = THREE, TAU = Math.PI * 2;

  const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
  const FLAME_FS = `
uniform float uTime, uI, uSeed; uniform sampler2D uNoise; varying vec2 vUv;
void main(){
  float x = vUv.x*2.0 - 1.0, y = vUv.y, t = uTime;
  float n1 = texture2D(uNoise, vec2(x*0.30 + uSeed, y*0.42 - t*0.62)).r;
  float n2 = texture2D(uNoise, vec2(x*0.70 - uSeed*1.3, y*0.95 - t*1.25)).g;
  float n3 = texture2D(uNoise, vec2(x*1.60 + uSeed*0.6, y*2.10 - t*2.30)).a;
  float turb = n1*0.5 + n2*0.32 + n3*0.18;
  float xd = x + ((n1 - 0.5)*0.9 + (n2 - 0.5)*0.4)*y;
  float w = mix(0.72, 0.06, pow(y, 0.7));
  float body = 1.0 - smoothstep(w*0.4, w, abs(xd));
  float tip = 0.5 + 0.55*turb;
  float flame = body*(1.0 - smoothstep(tip*0.45, tip, y))*smoothstep(0.0, 0.05, y);
  flame *= mix(1.0, smoothstep(0.38, 0.62, n3*0.55 + n2*0.45), smoothstep(0.2, 0.75, y));
  float core = (1.0 - smoothstep(0.0, 0.3, abs(xd)))*(1.0 - smoothstep(0.02, 0.4, y))*smoothstep(0.0, 0.06, y)*smoothstep(0.3, 0.7, n2*0.6 + n3*0.4);
  float I = flame*(0.45 + 0.75*turb) + core*0.38;
  vec3 c = mix(vec3(0.6, 0.08, 0.012), vec3(1.0, 0.33, 0.045), smoothstep(0.08, 0.5, I));
  c = mix(c, vec3(1.0, 0.56, 0.18), smoothstep(0.65, 1.3, I));
  gl_FragColor = vec4(c*I*uI, 1.0);
}`;

  const POINT_FS = `
uniform vec3 uCol; uniform float uCore; varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(uCol*(a*a*0.5 + smoothstep(uCore, 0.0, r)*1.6)*vA, 1.0);
}`;
  const EMBER_VS = `
attribute float aSeed; uniform float uTime, uScale, uI; uniform vec3 uBase; uniform vec2 uWind; varying float vA;
void main(){
  float h = aSeed, life = 1.6 + 1.4*fract(h*7.13), tt = uTime + h*17.0;
  float age = mod(tt, life), cyc = floor(tt/life);
  float r1 = fract(sin((h + cyc)*91.7)*43758.5), r2 = fract(sin((h*3.1 + cyc)*47.3)*31758.5);
  vec3 p = uBase + vec3((r1 - 0.5)*0.4, 0.3, (r2 - 0.5)*0.4);
  p.y += age*(0.45 + 0.55*r1);
  p.xz += uWind*age*(0.3 + 0.45*r2) + vec2(sin(age*3.0 + h*20.0), cos(age*2.3 + h*11.0))*0.1*age;
  vA = exp(-age*1.15)*(0.5 + 0.5*sin(age*24.0 + h*40.0))*uI;
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  gl_PointSize = clamp(0.05*uScale/(-mv.z), 1.5, 24.0);
  gl_Position = projectionMatrix*mv;
}`;
  const FLY_VS = `
${GLSL.FLY}
attribute vec4 aSeed; uniform float uTime, uScale, uI; varying float vA;
void main(){
  float h = aSeed.w, lift, f = flyFlash(uTime, h, lift);
  vA = f*uI;
  if (vA < 0.004){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 mv = modelViewMatrix*vec4(flyPath(aSeed.xyz, uTime, h, lift), 1.0);
  gl_PointSize = clamp(0.15*uScale/(-mv.z), 2.0, 18.0);
  gl_Position = projectionMatrix*mv;
}`;
  const MOTH_VS = `
attribute vec4 aSeed; uniform float uTime, uScale, uI; varying float vA;
void main(){
  float h = aSeed.w, r = 0.09 + 0.12*fract(h*5.3), w = 2.2 + 2.0*fract(h*9.1);
  vec3 p = aSeed.xyz + vec3(cos(uTime*w + h*20.0)*r + sin(uTime*7.0 + h)*0.02, sin(uTime*1.7 + h*5.0)*0.08, sin(uTime*w*1.2 + h*11.0)*r);
  vA = uI*(0.6 + 0.4*sin(uTime*23.0 + h*9.0));
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  gl_PointSize = clamp(0.03*uScale/(-mv.z), 1.2, 10.0);
  gl_Position = projectionMatrix*mv;
}`;
  const PUFF_VS = `
attribute float aSeed; uniform float uTime, uLife, uRise, uGrow, uSize; uniform vec3 uBase; uniform vec2 uWind;
varying vec2 vUv; varying float vA, vH;
void main(){
  float tt = uTime/uLife + aSeed, age = fract(tt), cyc = floor(tt);
  float j = fract(sin((aSeed + cyc)*71.3)*43758.5);
  vec3 c = uBase + vec3((j - 0.5)*0.12, age*uRise, (fract(j*7.0) - 0.5)*0.12);
  c.xz += uWind*age*age*uRise*0.9 + vec2(sin(age*5.0 + aSeed*9.0), cos(age*4.0 + aSeed*7.0))*0.08*age*uRise;
  float s = uSize*(0.35 + age*uGrow);
  float ang = aSeed*6.28 + age*1.6, cs = cos(ang), sn = sin(ang);
  vec2 q = vec2(cs*position.x - sn*position.y, sn*position.x + cs*position.y);
  vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = c + (cr*q.x + cu*q.y)*s;
  vUv = uv; vA = smoothstep(0.0, 0.12, age)*(1.0 - age); vH = age;
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`;
  const PUFF_FS = `
uniform sampler2D uPuff; uniform vec3 uLo, uHi; uniform float uA; varying vec2 vUv; varying float vA, vH;
void main(){ vec4 t = texture2D(uPuff, vUv); gl_FragColor = vec4(mix(uLo, uHi, smoothstep(0.0, 0.6, vH)), t.a*vA*uA); }`;

  function points(n, seedFn, vs, uniforms, blending = T.AdditiveBlending) {
    const g = new T.BufferGeometry(), dims = seedFn(0).length || 1;
    g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const arr = new Float32Array(n * dims); for (let i = 0; i < n; i++) { const s = seedFn(i); if (dims === 1) arr[i] = s; else s.forEach((v, k) => arr[i * dims + k] = v); }
    g.setAttribute('aSeed', new T.Float32BufferAttribute(arr, dims));
    const m = new T.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: POINT_FS, blending, transparent: true, depthWrite: false });
    const p = new T.Points(g, m); p.frustumCulled = false; return p;
  }
  function puffs(n, uniforms) {
    const g = new T.InstancedBufferGeometry(); const base = new T.PlaneGeometry(1, 1);
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    const s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = i / n; g.setAttribute('aSeed', new T.InstancedBufferAttribute(s, 1)); g.instanceCount = n;
    const m = new T.ShaderMaterial({ uniforms, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false });
    const o = new T.Mesh(g, m); o.frustumCulled = false; return o;
  }

  function build(scene, camp, nature, noiseTex) {
    const refs = {}, r = Textures.rng(1234);
    const W = new T.Vector2(Layout.wind[0], Layout.wind[1]);
    /* flames */
    refs.flames = [];
    for (const [ox, oz, w, h, sd] of [[0, 0, 0.52, 0.74, 0.1], [0.1, 0.03, 0.38, 0.6, 0.53], [-0.09, -0.06, 0.36, 0.56, 0.81], [0.04, -0.11, 0.3, 0.48, 0.27], [-0.05, 0.1, 0.28, 0.42, 0.66], [0.13, -0.08, 0.22, 0.34, 0.39]]) {
      const m = new T.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uI: { value: 1 }, uSeed: { value: sd }, uNoise: { value: noiseTex } },
        vertexShader: FLAME_VS, fragmentShader: FLAME_FS, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide });
      const f = new T.Mesh(new T.PlaneGeometry(w, h), m);
      f.position.set(camp.fireBase.x + ox, camp.fireBase.y + h / 2 - 0.02, camp.fireBase.z + oz); f.frustumCulled = false;
      scene.add(f); refs.flames.push(f);
    }
    refs.embers = points(28, i => i / 28 + r() * 0.01, EMBER_VS, { uTime: { value: 0 }, uScale: { value: 1000 }, uI: { value: 1 }, uBase: { value: camp.fireBase.clone() }, uWind: { value: W }, uCol: { value: new T.Vector3(1.0, 0.42, 0.09) }, uCore: { value: 0.22 } });
    scene.add(refs.embers);
    /* smoke + steam */
    const puffTex = Mats.tex(Paint.puff(5), { srgb: false });
    const mk = (n, base, life, rise, grow, size, a) => {
      const u = { uTime: { value: 0 }, uLife: { value: life }, uRise: { value: rise }, uGrow: { value: grow }, uSize: { value: size }, uBase: { value: base }, uWind: { value: W }, uPuff: { value: puffTex }, uLo: { value: new T.Vector3() }, uHi: { value: new T.Vector3() }, uA: { value: a } };
      const o = puffs(n, u); scene.add(o); return o;
    };
    refs.smoke = mk(16, camp.fireBase.clone().add(new T.Vector3(0, 0.95, 0)), 6.0, 2.4, 3.4, 0.7, 0.28);
    refs.steamMug = mk(12, camp.mugTop.clone(), 2.6, 0.45, 2.6, 0.12, 0.7);
    refs.steamPot = mk(12, camp.potTop.clone(), 2.6, 0.5, 2.8, 0.14, 0.6);
    refs.douse = mk(26, camp.fireBase.clone().add(new T.Vector3(0, 0.1, 0)), 2.4, 1.7, 3.2, 0.42, 0);
    /* fireflies round the trees & bushes */
    /* twice as many as the default shows, in shuffled order, so the density setting draws an even share of them */
    const homes = [], shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    for (let rep = 0; rep < 2; rep++) {
      for (const b of [...Layout.bushes, ...Layout.trees, ...(Layout.fruit || []).map(f => [f.x, f.z, 2.4])]) for (let i = 0; i < 7; i++) homes.push([b[0] + (r() - 0.5) * b[2] * 2.4, 0.4 + r() * 2.2, b[1] + (r() - 0.5) * b[2] * 2.0, r()]);
      for (let i = 0; i < 14; i++) { const a = r() * TAU; homes.push([Layout.camp.x + Math.cos(a) * (4.6 + r() * 2), 0.5 + r() * 1.6, Layout.camp.z + Math.sin(a) * (2.8 + r() * 1.5) + 1.0, r()]); }
    }
    shuffle(homes);
    refs.flies = points(homes.length, i => homes[i], FLY_VS, { uTime: { value: 0 }, uScale: { value: 1000 }, uI: { value: 1 }, uCol: { value: new T.Vector3(0.66, 1.0, 0.26) }, uCore: { value: 0.2 } });
    scene.add(refs.flies);
    /* moths circling lanterns and a few bulbs */
    const mh = [];
    for (let rep = 0; rep < 2; rep++) {
      for (const l of camp.lanterns) for (let i = 0; i < 3; i++) mh.push([l.pos.x, l.pos.y + 0.25, l.pos.z, r()]);
      for (let i = 0; i < 10; i++) { const b = camp.bulbs[Math.floor(r() * camp.bulbs.length)]; mh.push([b.p.x, b.p.y, b.p.z, r()]); }
      mh.push([camp.vanLightPos.x, camp.vanLightPos.y + 0.6, camp.vanLightPos.z, r()], [camp.vanLightPos.x, camp.vanLightPos.y + 0.4, camp.vanLightPos.z, r()]);
    }
    shuffle(mh);
    refs.moths = points(mh.length, i => mh[i], MOTH_VS, { uTime: { value: 0 }, uScale: { value: 1000 }, uI: { value: 1 }, uCol: { value: new T.Vector3(1.0, 0.86, 0.62) }, uCore: { value: 0.3 } });
    scene.add(refs.moths);
    /* butterflies round the camp by day: the real thing (models/life/butterfly.js), a little bigger than life so they
       read from the chairs, each beating its wings at its own pace and now and then gliding on them */
    refs.butterflies = [];
    const homesB = [[-3.0, 1.2, 3.4], [2.6, 1.0, 3.6], [-9.0, 1.4, 3.6], [0.4, 0.9, -1.2], [8.0, 1.1, 3.0], [-6.5, 1.6, 5.6],
                    [12.5, 1.3, 4.2], [-13.5, 1.2, 4.6], [5.0, 1.5, 6.4], [-1.5, 1.1, 7.0], [15.5, 1.0, 1.8], [-17.0, 1.4, 2.5]];
    const KINDS = [0, 1, 2, 3, 0, 2, 1, 3, 0, 1, 2, 0];
    homesB.forEach((hm, i) => {
      const g = Models.make('life/butterfly', { kind: KINDS[i] }); g.scale.setScalar(1.7); g.visible = false; scene.add(g);
      refs.butterflies.push({ g, home: new T.Vector3(...hm), ph: r() * TAU, sp: 0.7 + r() * 0.5, hz: 5.5 + r() * 3.5, beat: r() * TAU, gl: r() * TAU, glK: 0 });
    });
    refs.lastT = null;
    return refs;
  }

  function update(refs, st, camera) {
    const t = st.t;
    for (const f of refs.flames) {
      f.material.uniforms.uTime.value = t; f.material.uniforms.uI.value = st.fireI * (0.75 + 0.35 * st.fireFlick) * 0.16;
      f.rotation.y = Math.atan2(camera.position.x - f.position.x, camera.position.z - f.position.z);
    }
    const scale = st.pxScale;
    for (const p of [refs.embers, refs.flies, refs.moths]) { p.material.uniforms.uTime.value = t; p.material.uniforms.uScale.value = scale; }
    refs.embers.material.uniforms.uI.value = st.fireI * 0.55;
    refs.flies.material.uniforms.uI.value = st.flies;
    refs.moths.material.uniforms.uI.value = st.moths;
    /* how many: the density setting (0.5 is as many as the cove always had) */
    const dn = st.insects ?? 0.5;
    refs.flies.geometry.setDrawRange(0, Math.round(refs.flies.geometry.attributes.aSeed.count * dn));
    refs.moths.geometry.setDrawRange(0, Math.round(refs.moths.geometry.attributes.aSeed.count * dn));
    for (const o of [refs.smoke, refs.steamMug, refs.steamPot]) o.material.uniforms.uTime.value = t;
    refs.smoke.material.uniforms.uLo.value.copy(st.smokeLo); refs.smoke.material.uniforms.uHi.value.copy(st.smokeHi);
    for (const o of [refs.steamMug, refs.steamPot]) { o.material.uniforms.uLo.value.copy(st.steamLo); o.material.uniforms.uHi.value.copy(st.steamHi); }
    refs.smoke.material.uniforms.uA.value = 0.28 * st.smoke;
    refs.steamMug.material.uniforms.uA.value = 0.7 * st.steam; refs.steamPot.material.uniforms.uA.value = 0.6 * st.steam;
    { const u = refs.douse.material.uniforms; u.uTime.value = t; u.uA.value = 0.85 * (st.douse || 0); u.uLo.value.copy(st.steamLo).multiplyScalar(1.6); u.uHi.value.copy(st.steamHi).multiplyScalar(1.3); refs.douse.visible = (st.douse || 0) > 0.01; }
    const dtB = refs.lastT === null ? 0 : Math.max(0, Math.min(0.1, t - refs.lastT)); refs.lastT = t;
    refs.butterflies.forEach((b, bi) => {
      const on = st.butterflies > 0.02 && bi < Math.round(refs.butterflies.length * dn); b.g.visible = on; if (!on) return;
      const k = t * b.sp + b.ph;
      /* now and then a second or so of gliding on open wings, more often when it is drifting down */
      const glW = Math.sin(t * 0.47 * b.sp + b.gl) + 0.35 * Math.sin(t * 1.9 + b.gl * 3);
      b.glK += ((glW > 0.95 ? 1 : 0) - b.glK) * Math.min(1, dtB * 6);
      const gliding = b.glK > 0.5;
      b.beat += TAU * b.hz * dtB * (gliding ? 0.15 : 1);
      const lift = gliding ? 0 : 0.028 * Math.sin(b.beat - 1.2);      /* (it rises a little with every downstroke) */
      b.g.position.set(b.home.x + Math.sin(k * 0.37) * 2.2 + Math.sin(k * 1.3) * 0.3, b.home.y + 0.45 * Math.sin(k * 0.9) + 0.15 * Math.sin(k * 3.1) + lift, b.home.z + Math.cos(k * 0.29) * 1.7);
      const vx = Math.cos(k * 0.37) * 0.81 + Math.cos(k * 1.3) * 0.39, vz = -Math.sin(k * 0.29) * 0.49;
      /* (the model's head is toward +x: turned to the way it is going, nose up a touch, rocking with the beat) */
      b.g.rotation.set(0, Math.atan2(-vz, vx), 0.16 + (gliding ? -0.05 : 0.07 * Math.sin(b.beat)));
      b.g.userData.anim(t, true, b.beat, gliding);
    });
  }
  return { build, update };
})();
