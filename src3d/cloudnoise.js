/* ─────────────────────────────────────────────────────────────
   cloudnoise.js — the noise the clouds are made of, baked once on
   the GPU as the cove starts (a few milliseconds on a graphics card):
     shape    128³  Perlin-Worley: billows (Perlin) carved into round
                    cells (Worley) — a cumulus' heaped body
     detail    32³  Worley fbm: what eats at the edges (cauliflower on
                    top, wisps underneath)
     weather  512²  where clouds may grow: r cells of fair-weather
                    cumulus of every size, g how tall each may tower,
                    b broad stretches of clearer and cloudier sky
   All of them tile. The method is the one in Schneider's "Real-time
   Volumetric Cloudscapes of Horizon Zero Dawn" (SIGGRAPH 2015), with
   the noise recipes of Sébastien Hillaire's TileableVolumeNoise and
   their use in takram's three-clouds (both MIT; see the credits).
   ───────────────────────────────────────────────────────────── */
const CloudNoise = (() => {
  const T = THREE;
  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const NOISE = `
uniform float uS, uCols;
/* a random point in each cell, from the cell's own (wrapped) coordinates */
vec3 h33(vec3 p){ p = fract(p*vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
/* Worley: the squared distance to the nearest of those points (in cells, at most 1), tiling every \`cells\` */
float worley(vec3 p, float cells){
  vec3 c = p*cells, ic = floor(c), fc = c - ic; float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec3 o = vec3(float(x), float(y), float(z)), r = o + h33(mod(ic + o, cells) + 0.37) - fc;
    d = min(d, dot(r, r));
  }
  return d;
}
/* Perlin (gradient) noise, tiling every \`per\` (about -1 to 1) */
vec3 grd(vec3 i, float per){ return h33(mod(i, per) + 7.13)*2.0 - 1.0; }
float perlin(vec3 p, float per){
  vec3 i = floor(p), f = p - i, u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  float a = dot(grd(i, per), f), b = dot(grd(i + vec3(1, 0, 0), per), f - vec3(1, 0, 0));
  float c = dot(grd(i + vec3(0, 1, 0), per), f - vec3(0, 1, 0)), d = dot(grd(i + vec3(1, 1, 0), per), f - vec3(1, 1, 0));
  float e = dot(grd(i + vec3(0, 0, 1), per), f - vec3(0, 0, 1)), g = dot(grd(i + vec3(1, 0, 1), per), f - vec3(1, 0, 1));
  float h = dot(grd(i + vec3(0, 1, 1), per), f - vec3(0, 1, 1)), k = dot(grd(i + vec3(1, 1, 1), per), f - vec3(1, 1, 1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z)*1.6;
}
float perlinFbm(vec3 p, float freq, int oct){
  float s = 0.0, w = 1.0, ws = 0.0;
  for (int i = 0; i < 8; i++){ if (i >= oct) break; s += perlin(p*freq, freq)*w; ws += w; w *= 0.5; freq *= 2.0; }
  return s/ws;
}
/* three octaves of (inverted) Worley, each half the size of the last, folded into one */
float worleyFbm(vec3 p, float cells){
  vec4 n = vec4(1.0 - worley(p, cells), 1.0 - worley(p, cells*2.0), 1.0 - worley(p, cells*4.0), 1.0 - worley(p, cells*8.0));
  vec3 f = vec3(dot(n.xyz, vec3(0.625, 0.25, 0.125)), dot(n.yzw, vec3(0.625, 0.25, 0.125)), dot(n.zw, vec2(0.75, 0.25)));
  return dot(f, vec3(0.625, 0.25, 0.125));
}
float remap(float x, float a, float b, float c, float d){ return c + (x - a)/(b - a)*(d - c); }
/* this texel's place in the volume: the slices are laid out in a grid of uCols columns */
vec3 voxel(){
  vec2 px = floor(gl_FragCoord.xy); float col = floor(px.x/uS), row = floor(px.y/uS);
  return (vec3(px.x - col*uS, px.y - row*uS, row*uCols + col) + 0.5)/uS;
}`;
  /* the heaped body: Perlin billows, raised into round Worley cells, then eroded by a finer Worley fbm (the recipe of
     TileableVolumeNoise, as three-clouds uses it) */
  const SHAPE = `${NOISE}
void main(){
  vec3 p = voxel();
  float per = clamp(perlinFbm(p, 8.0, 3), 0.0, 1.0);
  vec3 wn = vec3(1.0 - worley(p, 8.0), 1.0 - worley(p, 32.0), 1.0 - worley(p, 56.0));
  float wf = dot(wn, vec3(0.625, 0.25, 0.125));
  float pw = remap(per, 0.0, 1.0, wf, 1.0);
  float v = clamp(remap(pw, worleyFbm(p, 8.0) - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(v, wf, 0.0, 1.0);
}`;
  const DETAIL = `${NOISE}
void main(){ gl_FragColor = vec4(worleyFbm(voxel(), 2.0), 0.0, 0.0, 1.0); }`;
  /* the weather: cumulus cells of many sizes (a few big ones, more small ones round them), how tall each may grow, and
     broad patches of clearer and cloudier sky */
  const WEATHER = `${NOISE}
varying vec2 vUv;
float cellsFbm(vec3 p, float freq){ float s = 0.0, a = 0.4; for (int i = 0; i < 4; i++){ s += a*(1.0 - worley(p, freq)); freq *= 2.0; a *= 0.95; } return s; }
void main(){
  vec3 p = vec3(vUv, 0.5);
  float cells = smoothstep(0.8, 1.4, cellsFbm(p, 12.0));
  float tall = smoothstep(-0.25, 0.55, perlinFbm(p + vec3(0.31, 0.77, 0.0), 5.0, 4));
  float broad = smoothstep(-0.45, 0.45, perlinFbm(p + vec3(0.63, 0.12, 0.25), 2.0, 3));
  gl_FragColor = vec4(cells, tall, broad, 1.0);
}`;

  /* render a shader over a w×h target and read it back */
  function bake(R, fs, w, h, u) {
    const rt = new T.WebGLRenderTarget(w, h, { depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter, generateMipmaps: false });
    const m = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: { uS: { value: u.S || 1 }, uCols: { value: u.cols || 1 } }, depthTest: false, depthWrite: false });
    const sc = new T.Scene(), q = new T.Mesh(new T.PlaneGeometry(2, 2), m); q.frustumCulled = false; sc.add(q);
    const prev = R.getRenderTarget(); R.setRenderTarget(rt); R.render(sc, new T.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    const px = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, px); R.setRenderTarget(prev);
    rt.dispose(); m.dispose(); q.geometry.dispose();
    return px;
  }
  /* a volume of S³, laid out as cols × rows slices, one channel of it as a tiling 3D texture with mipmaps */
  function volume(R, fs, S, cols, ch = [0]) {
    const rows = S / cols, W = S * cols, px = bake(R, fs, W, S * rows, { S, cols }), n = ch.length;
    const out = new Uint8Array(S * S * S * n);
    for (let z = 0; z < S; z++) { const col = z % cols, row = (z / cols) | 0;
      for (let y = 0; y < S; y++) { let src = ((row * S + y) * W + col * S) * 4, dst = (z * S + y) * S * n;
        for (let x = 0; x < S; x++, src += 4) for (let c = 0; c < n; c++) out[dst++] = px[src + ch[c]]; } }
    const t = new T.Data3DTexture(out, S, S, S);
    t.format = n === 1 ? T.RedFormat : T.RGFormat; t.type = T.UnsignedByteType; t.unpackAlignment = 1;
    t.wrapS = t.wrapT = t.wrapR = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }
  function make(R) {
    const t0 = performance.now();
    const shape = volume(R, SHAPE, 128, 16);
    const detail = volume(R, DETAIL, 32, 8);
    const wpx = bake(R, WEATHER, 512, 512, {});
    const weather = new T.DataTexture(wpx, 512, 512, T.RGBAFormat, T.UnsignedByteType);
    weather.wrapS = weather.wrapT = T.RepeatWrapping; weather.magFilter = T.LinearFilter; weather.minFilter = T.LinearMipmapLinearFilter; weather.generateMipmaps = true; weather.needsUpdate = true;
    return { shape, detail, weather, ms: Math.round(performance.now() - t0) };
  }
  return { make };
})();
