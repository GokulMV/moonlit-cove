/* ─────────────────────────────────────────────────────────────
   snow.js — snow falling: flakes in the air round the eye, each its
   own size, drifting down on the wind and turning over as it goes,
   flurrying in the gusts; near ones soft and large, far ones a
   speck; lit by the sky and the sun or the moon, the camp's lights
   catching those close to them. None comes down through a hut's
   roof, and few through the forest's canopy. How much falls is the
   weather's (o.fall, 0..1); what it leaves lying is the ground's own
   business (the shaders' uSnow).
   ───────────────────────────────────────────────────────────── */
const Snow = (() => {
  const T = THREE;
  const N = 14000, BOX = [64, 30, 64];
  const VS = `
${GLSL.ISLE_SH}
attribute vec4 aSeed;
uniform float uTime, uFall; uniform vec3 uBox, uCam; uniform vec4 uWindS; uniform float uPx;
uniform vec4 uHutB[4], uHutS[4];
varying float vA; varying vec2 vQ; varying vec3 vW;
float inHut(vec3 wp){
  float k = 0.0;
  for (int i = 0; i < 4; i++){ vec4 b = uHutB[i], s = uHutS[i]; if (s.w < 0.0) continue;
    vec2 d = wp.xz - b.xy, l = vec2(d.x*b.z - d.y*b.w, d.x*b.w + d.y*b.z);
    if (abs(l.x) < s.x + 0.7 && l.y > -s.y - 0.7 && l.y < s.y + s.z + 0.6 && wp.y < s.w + 4.6 && wp.y > s.w - 1.2) k = 1.0; }
  return k;
}
void main(){
  /* (each flake its own place in a box that moves with the eye, wrapped round it: falling, drifting with the wind, and
     a slow flutter of its own) */
  float size = mix(0.004, 0.011, aSeed.w*aSeed.w), v = mix(0.55, 1.15, fract(aSeed.w*7.13 + aSeed.x));
  vec3 p = aSeed.xyz*uBox;
  p.y -= uTime*v;
  p.xz += uWindS.xy*uTime*uWindS.z*(0.7 + 0.6*aSeed.x);
  float fl = uTime*(0.6 + 0.9*aSeed.y) + aSeed.z*40.0;
  p.xz += vec2(sin(fl), cos(fl*0.83))*(0.18 + 0.25*aSeed.w) + vec2(sin(uTime*0.37 + p.y*0.2), cos(uTime*0.29 + p.y*0.17))*uWindS.w;
  vec3 o = uCam - uBox*vec3(0.5, 0.35, 0.5);
  p = o + mod(p - o, uBox);
  /* (not every flake falls in a light snow) */
  float on = step(aSeed.x*0.999, uFall);
  /* (none inside a hut, few under the canopy) */
  vec2 suv = (p.xz - uIsShG.xy)*uIsShG.zw; float top = (uIsShOn > 0.5 && suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) ? texture2D(uIsSh, suv).b*400.0 : -1e3;
  float under = smoothstep(2.0, 10.0, top - p.y);
  on *= (1.0 - inHut(p))*(1.0 - 0.85*under*step(fract(aSeed.y*13.7), 0.85));
  vec4 vp = viewMatrix*vec4(p, 1.0);
  float d = -vp.z;
  /* (its quad: as big as the flake, never less than a pixel and a half across, fading a little as it shrinks below
     that; turned to the eye) */
  float minS = 1.5*uPx*d, s = max(size, minS);
  vA = on*smoothstep(0.4, 2.0, d)*(1.0 - smoothstep(BOXR*0.8, BOXR, length(p.xz - uCam.xz)))*clamp(size/minS, 0.25, 1.0);
  vQ = position.xy; vW = p;
  vp.xy += position.xy*s;
  gl_Position = projectionMatrix*vp;
  if (vA < 0.01) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;
  const FS = `
uniform vec3 uAmbF, uKeyColT; uniform vec4 uFog;
varying float vA; varying vec2 vQ; varying vec3 vW;
void main(){
  float r = length(vQ)*2.0; if (r > 1.0) discard;
  float a = (1.0 - smoothstep(0.35, 1.0, r))*vA*0.85;
  vec3 c = vec3(0.95, 0.97, 1.0)*(uAmbF*1.15 + uKeyColT*0.55);
  float d = distance(vW, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  gl_FragColor = vec4(c, a);
}`;
  function build(root) {
    const q = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.setIndex(q.index); g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    const S = new Float32Array(N * 4), r = Textures.rng(9091); for (let i = 0; i < S.length; i++) S[i] = r();
    g.setAttribute('aSeed', new T.InstancedBufferAttribute(S, 4)); g.instanceCount = N; g.boundingSphere = new T.Sphere(new T.Vector3(), 1e9);
    const U = Object.assign({}, Mats.shadeU(), { uTime: { value: 0 }, uFall: { value: 0 }, uBox: { value: new T.Vector3(...BOX) }, uCam: { value: new T.Vector3() }, uWindS: { value: new T.Vector4(0.55, -0.83, 0.4, 0.2) }, uPx: { value: 0.002 },
      uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uFog: Mats.U.uFog, uHutB: Mats.U.uHutB, uHutS: Mats.U.uHutS });
    const mat = new T.ShaderMaterial({ uniforms: U, vertexShader: VS.replace(/BOXR/g, (BOX[0] / 2).toFixed(1)), fragmentShader: FS, transparent: true, depthWrite: false });
    const m = new T.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 8; m.visible = false; m.name = 'snow'; root.add(m);
    let t = 0;
    function update(dt, cam, camera, o = {}) {
      const fall = o.fall || 0; m.visible = fall > 0.01;
      if (!m.visible) return;
      t += dt; U.uTime.value = t; U.uFall.value = fall; U.uCam.value.copy(cam);
      const w = o.wind ?? 1; U.uWindS.value.set(Layout.wind[0], Layout.wind[1], 0.25 + 0.6 * (w - 1), 0.15 + 0.35 * (w - 1));
      if (camera) U.uPx.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, o.height || 900);
    }
    return { update, mesh: m };
  }
  return { build };
})();
