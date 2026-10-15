/* ─────────────────────────────────────────────────────────────
   camp.js — rug, table, cushions, lanterns, string lights,
   camper van, campfire with coffee, chairs, driftwood, bottle,
   the wish board and the radio on the table.
   ───────────────────────────────────────────────────────────── */
const Camp = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const mesh = (geo, mat, cast = true, recv = true) => { const o = new T.Mesh(geo, mat); o.castShadow = cast; o.receiveShadow = recv; return o; };
  const grp = (x = 0, y = 0, z = 0, ry = 0) => { const o = new T.Group(); o.position.set(x, y, z); o.rotation.y = ry; return o; };
  const C = h => new T.Color(h);
  const L = (hex, p = {}, key) => Mats.lit(Object.assign({ color: C(hex) }, p), key);
  const glow = (r, g, b) => new T.MeshBasicMaterial({ color: new T.Color(r, g, b) });
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const between = (geo, mat, a, b) => {                 /* cylinder from a to b */
    const d = new T.Vector3().subVectors(b, a), o = mesh(geo, mat);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
    return o;
  };

  /* a bulb is clear glass round a filament: lit, the filament burns bright in the middle and the glass glows softer
     round it, brightest where it is seen through most glass; unlit, the glass shows the sky's sheen at its rim and a
     glint, the dark filament inside */
  const BULB_VS = `
attribute float aOrder; varying float vOrder; varying vec3 vN; varying vec3 vW;
void main(){
  vOrder = aOrder;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix*p;
  #endif
  vec4 w = modelMatrix*p; vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
  const BULB_FS = `
uniform float uProg, uTime, uI, uTw; uniform vec3 uOff, uCol; varying float vOrder; varying vec3 vN; varying vec3 vW;
void main(){
  float on = smoothstep(vOrder - 0.012, vOrder + 0.012, uProg*1.03 - 0.015);
  float tw = 1.0 - uTw + uTw*(0.5 + 0.5*sin(uTime*(2.0 + vOrder*5.0) + vOrder*91.0)*sin(uTime*1.3 + vOrder*37.0));
  vec3 V = normalize(cameraPosition - vW), n = normalize(vN);
  float c = max(dot(n, V), 0.0), rim = pow(1.0 - c, 2.5);
  vec3 lit = uCol*uI*tw*(0.16 + 2.3*pow(c, 10.0) + 0.3*rim);
  float glint = pow(max(dot(reflect(-V, n), normalize(vec3(0.3, 1.0, 0.25))), 0.0), 70.0);
  /* (unlit, clear glass: see-through in the middle but for the dark filament across it, the sky's sheen round its rim,
     a glint) */
  float fil = smoothstep(0.93, 0.99, c)*0.8;
  vec3 off = uOff*3.0*(0.45 + 1.25*rim) + vec3(1.0, 0.98, 0.94)*glint*(0.5 + uOff.g*6.0);
  off = mix(off, vec3(0.015), fil);
  float aOff = clamp(0.16 + 0.8*rim + glint + fil, 0.0, 1.0);
  gl_FragColor = vec4(mix(off, lit, on), mix(aOff, 1.0, on));
}`;

  /* inside the van, seen through its open door and every window: one room traced through by each of them in the van's
     own frame, so all of them look into the same place. Birch-ply walls, a plank floor with a rug, the rear bench in a
     plaid with its backrest under the back window, a kitchen unit with sink and stove along the far side and a locker
     over it, a little table on its leg, the cab's two seats with the dashboard and the steering wheel beyond them; a warm
     lamp on the ceiling, fairy lights strung along it, the daylight in through the windows and the door; through the
     pop-top's opening the lit canvas. A window's own glass reflects the sky, and the living windows have their curtains
     gathered at the sides */
  const VAN_VS = `
uniform mat4 uVanInv;
varying vec3 vL, vCam; varying vec2 vP2, vWxz;
void main(){
  vec4 w = modelMatrix*vec4(position, 1.0);
  vL = (uVanInv*w).xyz; vCam = (uVanInv*vec4(cameraPosition, 1.0)).xyz; vP2 = position.xy; vWxz = w.xz;
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
  const VAN_FS = `
uniform vec3 uLamp, uAmbIn, uKeyDirT, uKeyColT, uAmbF, uNrm; uniform float uTime, uMode, uPop, uDoor; uniform vec2 uHalf; uniform mat4 uVanInv;
varying vec3 vL, vCam; varying vec2 vP2, vWxz;
${GLSL.ISLE_SH}
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
/* (a box hit from outside, nearer than t so far: t, the normal, and which it was) */
void box(vec3 ro, vec3 rd, vec3 a, vec3 b, float id, inout float t, inout vec3 n, inout float hit){
  vec3 i = 1.0/rd, t0 = (a - ro)*i, t1 = (b - ro)*i, mn = min(t0, t1), mx = max(t0, t1);
  float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(mx.x, mx.y), mx.z);
  if (tn > 0.0 && tn < tf && tn < t){ t = tn; hit = id; n = -sign(rd)*step(mn.yzx, mn.xyz)*step(mn.zxy, mn.xyz); }
}
vec3 plaid(vec3 p){
  float a = step(0.5, fract(p.x*5.0 + p.y*5.0)), b = step(0.5, fract(p.z*5.0)), l = max(step(0.94, fract(p.x*5.0 + p.y*5.0 + 0.25)), step(0.94, fract(p.z*5.0 + 0.25)));
  return mix(vec3(0.5, 0.12, 0.07)*(0.7 + 0.3*a)*(0.7 + 0.3*b), vec3(0.75, 0.62, 0.38), l*0.7);
}
vec3 wood(vec3 p, vec3 base){ return base*(0.86 + 0.14*sin(p.x*38.0 + 2.5*sin(p.y*9.0 + p.z*7.0)))*(0.94 + 0.06*h21(floor(p.xz*6.0))); }
/* what shows through a window or the door from inside: the day, or the night */
vec3 outside(vec3 rd){ return uAmbF*mix(vec3(0.55, 0.5, 0.42)*0.9, vec3(1.25, 1.4, 1.6), smoothstep(-0.12, 0.18, rd.y)); }
void main(){
  vec3 ro = vL, rd = normalize(vL - vCam);
  /* the room: the inside of the box the walls make */
  vec3 rmin = vec3(-2.08, 0.46, -0.8), rmax = vec3(2.02, 1.84, 0.8);
  vec3 tr = (mix(rmin, rmax, step(0.0, rd)) - ro)/rd;
  float t = min(min(tr.x, tr.y), tr.z), hit = 0.0;
  vec3 n = tr.x < min(tr.y, tr.z) ? vec3(-sign(rd.x), 0.0, 0.0) : (tr.y < tr.z ? vec3(0.0, -sign(rd.y), 0.0) : vec3(0.0, 0.0, -sign(rd.z)));
  /* and what stands in it */
  box(ro, rd, vec3(-2.08, 0.46, -0.8), vec3(-1.32, 0.9, 0.8), 1.0, t, n, hit);     /* the bench: its base */
  box(ro, rd, vec3(-2.06, 0.9, -0.78), vec3(-1.3, 1.03, 0.78), 2.0, t, n, hit);     /*   its cushion */
  box(ro, rd, vec3(-2.08, 1.03, -0.78), vec3(-1.9, 1.24, 0.78), 2.0, t, n, hit);    /*   its backrest */
  box(ro, rd, vec3(-1.28, 0.46, 0.44), vec3(0.34, 1.1, 0.8), 3.0, t, n, hit);       /* the kitchen unit */
  box(ro, rd, vec3(-1.3, 1.1, 0.42), vec3(0.36, 1.13, 0.8), 4.0, t, n, hit);        /*   its worktop */
  box(ro, rd, vec3(-1.28, 1.62, 0.52), vec3(0.34, 1.84, 0.8), 3.0, t, n, hit);      /* the locker over it */
  box(ro, rd, vec3(-1.22, 0.9, -0.2), vec3(-0.62, 0.93, 0.36), 5.0, t, n, hit);     /* the table */
  box(ro, rd, vec3(-0.94, 0.46, 0.06), vec3(-0.9, 0.9, 0.1), 5.0, t, n, hit);       /*   its leg */
  box(ro, rd, vec3(1.16, 0.46, 0.12), vec3(1.62, 0.86, 0.74), 6.0, t, n, hit);      /* the driver's seat */
  box(ro, rd, vec3(1.1, 0.86, 0.14), vec3(1.24, 1.52, 0.72), 6.0, t, n, hit);
  box(ro, rd, vec3(1.16, 0.46, -0.74), vec3(1.62, 0.86, -0.12), 6.0, t, n, hit);    /* the passenger's */
  box(ro, rd, vec3(1.1, 0.86, -0.72), vec3(1.24, 1.52, -0.14), 6.0, t, n, hit);
  box(ro, rd, vec3(1.8, 0.92, -0.8), vec3(2.02, 1.18, 0.8), 7.0, t, n, hit);        /* the dashboard */
  box(ro, rd, vec3(0.28, 0.46, -0.8), vec3(1.05, 1.84, -0.46), 9.0, t, n, hit);     /* the wardrobe by the cab, on the door's side */
  /* the steering wheel: a ring, tipped back toward the driver, its hub and a spoke across */
  { vec3 c = vec3(1.66, 1.14, 0.43), wn = normalize(vec3(-0.85, 0.53, 0.0)), up = normalize(cross(wn, vec3(0.0, 0.0, 1.0))); float dn = dot(rd, wn);
    if (abs(dn) > 1e-4){ float tw = dot(c - ro, wn)/dn; vec3 q = ro + rd*tw - c; float rr = length(q);
      bool on = abs(rr - 0.19) < 0.017 || rr < 0.035 || (rr < 0.19 && abs(dot(q, up)) < 0.012);
      if (tw > 0.0 && tw < t && on){ t = tw; hit = 8.0; n = -wn*sign(dn); } } }
  vec3 p = ro + rd*t, alb = vec3(0.6), emit = vec3(0.0);
  bool open = false;
  if (hit == 0.0){
    /* the room's own surfaces, and where they open to the outside */
    if (n.y > 0.5){
      /* the floor: planks, and the rug */
      alb = wood(p.zxy*vec3(1.0, 0.2, 1.0), vec3(0.36, 0.22, 0.12))*(0.9 + 0.1*step(0.04, fract(p.z*8.0)));
      if (p.x > -1.25 && p.x < 0.95 && abs(p.z + 0.08) < 0.42){
        /* (a woven rug: narrow bands, a plain border round it) */
        float bd = min(min(p.x + 1.25, 0.95 - p.x), 0.42 - abs(p.z + 0.08)), st = step(0.5, fract(p.x*7.0));
        alb = bd < 0.06 ? vec3(0.62, 0.3, 0.16) : mix(vec3(0.12, 0.17, 0.3), vec3(0.72, 0.66, 0.52), st)*(0.9 + 0.1*step(0.8, fract(p.z*14.0)));
      }
    } else if (n.y < -0.5){
      alb = vec3(0.8, 0.76, 0.68);
      /* (the pop-top's opening: the canvas up there, lit through) */
      if (uPop > 0.5 && p.x > -1.58 && p.x < 1.02 && abs(p.z) < 0.68){ alb = vec3(0.72, 0.58, 0.4)*(0.94 + 0.06*h21(floor(p.xz*40.0))); emit += alb*uAmbF*0.7*(0.8 + 0.2*smoothstep(0.68, 0.3, abs(p.z))); }
      /* the lamp in the middle of it */
      emit += uLamp*9.0*smoothstep(0.075, 0.055, length(p.xz - vec2(-0.45, 0.05)));
    } else {
      /* the walls: birch ply in panels */
      alb = vec3(0.66, 0.52, 0.36)*(0.92 + 0.08*step(0.03, fract(p.x*1.6 + p.z*1.6 + 0.5)))*(p.y < 0.9 ? 0.85 : 1.0);
      float side = n.z;   /* (−1: the wall on the far side, +1: the door's) */
      if (abs(n.z) > 0.5){
        bool liv = false; float xc = 0.0, hw = 0.0;
        if (side < 0.0){ for (int i = 0; i < 3; i++){ float c0 = 0.55 - float(i)*0.97; if (abs(p.x - c0) < 0.4 && abs(p.y - 1.36) < 0.21){ open = true; liv = true; xc = c0; hw = 0.4; } } }
        if (abs(p.x - 1.5) < 0.33 && abs(p.y - 1.36) < 0.21) open = true;
        if (side > 0.0 && uDoor > 0.5 && p.x > -0.86 && p.x < 0.2 && p.y < 1.76) open = true;
        /* (and on that side, a chart of the coast in a frame) */
        if (side > 0.0 && p.x > -1.27 && p.x < -0.93 && abs(p.y - 1.4) < 0.15){ vec2 m = vec2(p.x + 1.1, p.y - 1.4); float fr = min(0.17 - abs(m.x), 0.15 - abs(m.y)); alb = fr < 0.018 ? vec3(0.25, 0.15, 0.08) : mix(vec3(0.2, 0.42, 0.55), vec3(0.78, 0.7, 0.52), smoothstep(-0.01, 0.01, m.y - 0.06*sin(m.x*28.0) + 0.03))*(0.9 + 0.1*step(0.92, fract(m.x*30.0))); }
        /* (curtains gathered at the sides of the living windows) */
        if (side < 0.0){ for (int i = 0; i < 3; i++){ float c0 = 0.55 - float(i)*0.97, dx = abs(p.x - c0); if (dx > 0.27 && dx < 0.45 && abs(p.y - 1.36) < 0.25){ open = false; alb = vec3(0.62, 0.24, 0.1)*(0.72 + 0.28*sin(p.x*95.0)); } } }
      } else if (n.x > 0.5){
        /* the back: its window over the bench */
        if (abs(p.z) < 0.55 && abs(p.y - 1.42) < 0.17) open = true;
      } else {
        /* the front: the windscreen over the dashboard */
        if (p.y > 1.18 && abs(p.z) < 0.72) open = true;
      }
    }
  } else if (hit == 1.0) alb = wood(p, vec3(0.38, 0.23, 0.12));
  else if (hit == 2.0) alb = plaid(p);
  else if (hit == 3.0){
    alb = wood(p, vec3(0.46, 0.3, 0.16));
    if (n.z < -0.5){ float dx = fract((p.x + 1.28)/0.405); alb *= 0.75 + 0.25*smoothstep(0.0, 0.03, min(dx, 1.0 - dx)); if (length(vec2(dx - 0.88, p.y - (p.y > 1.5 ? 1.66 : 1.02))) < 0.05) alb = vec3(0.75, 0.7, 0.6); }
  } else if (hit == 4.0){
    alb = vec3(0.74, 0.7, 0.62);
    if (n.y > 0.5){
      if (length(p.xz - vec2(-0.3, 0.6)) < 0.13) alb = vec3(0.5, 0.52, 0.55)*(0.6 + 0.4*smoothstep(0.13, 0.09, length(p.xz - vec2(-0.3, 0.6))));
      for (int i = 0; i < 2; i++){ float d = length(p.xz - vec2(-0.92 + float(i)*0.28, 0.6)); if (abs(d - 0.06) < 0.012 || d < 0.015) alb = vec3(0.06); }
    }
  } else if (hit == 5.0) alb = wood(p, vec3(0.6, 0.42, 0.24));
  else if (hit == 6.0) alb = vec3(0.62, 0.52, 0.38)*(0.88 + 0.12*step(0.08, fract(p.y*6.0 + p.x*6.0)));
  else if (hit == 7.0){
    alb = vec3(0.07, 0.07, 0.075);
    if (n.x < -0.5){ for (int i = 0; i < 2; i++){ float d = length(p.yz - vec2(1.07, 0.32 + float(i)*0.19)); if (d < 0.055) alb = d > 0.045 ? vec3(0.7) : vec3(0.82, 0.78, 0.66); } }
  } else if (hit == 9.0){
    alb = wood(p, vec3(0.46, 0.3, 0.16));
    if (n.z > 0.5){ float dx = abs(p.x - 0.665); alb *= 0.75 + 0.25*smoothstep(0.0, 0.012, dx)*smoothstep(0.0, 0.025, min(p.x - 0.28, 1.05 - p.x)); if (length(vec2(dx - 0.05, p.y - 1.15)) < 0.018) alb = vec3(0.75, 0.7, 0.6); }
  } else alb = vec3(0.82, 0.78, 0.68);
  vec3 col;
  if (open) col = outside(rd);
  else {
    /* the lamp, the daylight (from the door and the windows, more higher up), the fairy lights' glow along the
       ceiling, and the corners darker */
    vec3 Lp = vec3(-0.45, 1.78, 0.05), d = Lp - p; float r2 = dot(d, d);
    float ndl = max(dot(n, d*inversesqrt(r2)), 0.0)*0.85 + 0.15;
    vec3 lt = uLamp*(ndl*1.5/(1.0 + r2*2.2) + 0.15);
    lt += uAmbIn*(0.42 + 0.3*smoothstep(0.46, 1.7, p.y) + 0.35*smoothstep(0.2, -0.8, p.z)*uDoor + 0.15*max(n.y, 0.0));
    float fy = smoothstep(1.55, 1.84, p.y);
    if (fy > 0.0){ float fx = fract(p.x/0.17) - 0.5; lt += uLamp*fy*3.0*exp(-(fx*fx*0.0289 + (abs(p.z) - 0.72)*(abs(p.z) - 0.72))*260.0)*(0.8 + 0.2*sin(uTime*3.0 + floor(p.x/0.17)*1.7)); }
    vec3 dw = vec3(min(p.x - rmin.x, rmax.x - p.x), min(p.y - rmin.y, rmax.y - p.y), min(p.z - rmin.z, rmax.z - p.z));
    dw = mix(dw, vec3(9.0), abs(n)*step(hit, 0.5));
    float ao = 0.62 + 0.38*smoothstep(0.0, 0.22, min(min(dw.x, dw.y), dw.z));
    col = alb*lt*ao + emit;
  }
  /* the window itself: its curtains, its glass */
  if (uMode > 0.5){
    vec2 q = abs(vP2), hf = uHalf;
    if (uMode < 1.5){
      float cw = 0.16*hf.x/0.4;
      if (q.x > hf.x - cw || q.y > hf.y - 0.025){ vec3 cu = vec3(0.62, 0.24, 0.1)*(0.7 + 0.3*sin(vP2.x*85.0))*(q.y > hf.y - 0.025 ? 0.7 : 1.0); col = cu*(uAmbF*0.55 + uAmbIn*0.3 + uLamp*1.6); }
    }
    col *= 0.62 + 0.38*smoothstep(0.0, 0.05, min(hf.x - q.x, hf.y - q.y));
    float cv = clamp(dot(-rd, uNrm), 0.0, 1.0), F = 0.05 + 0.95*pow(1.0 - cv, 5.0);
    vec3 R = reflect(rd, uNrm), kd = normalize(mat3(uVanInv)*uKeyDirT);
    vec3 refl = uAmbF*mix(vec3(0.5, 0.45, 0.38)*0.7, vec3(1.1, 1.25, 1.45), smoothstep(-0.15, 0.3, R.y)) + uKeyColT*isleSh(vWxz)*pow(max(dot(R, kd), 0.0), 500.0)*3.0;
    col = mix(col*0.85, refl, min(1.0, F + 0.08));
  } else {
    /* (the doorway's own edge: the thickness of the body) */
    col *= 0.55 + 0.45*smoothstep(0.0, 0.06, min(uHalf.x - abs(vP2.x), uHalf.y - abs(vP2.y)));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  function instancedLights(points, radius, uniforms) {
    const geo = new T.SphereGeometry(radius, 14, 10);
    geo.setAttribute('aOrder', new T.InstancedBufferAttribute(new Float32Array(points.map(p => p.order)), 1));
    const mat = new T.ShaderMaterial({ uniforms, vertexShader: BULB_VS, fragmentShader: BULB_FS, transparent: true });
    const inst = new T.InstancedMesh(geo, mat, points.length);
    const m4 = new T.Matrix4();
    points.forEach((p, i) => { m4.makeTranslation(p.p.x, p.p.y, p.p.z); inst.setMatrixAt(i, m4); });
    inst.frustumCulled = false;
    return inst;
  }

  function rshape(x0, y0, x1, y1, r) {
    const s = new T.Shape();
    s.moveTo(x0 + r[0], y0); s.lineTo(x1 - r[1], y0); if (r[1]) s.quadraticCurveTo(x1, y0, x1, y0 + r[1]);
    s.lineTo(x1, y1 - r[2]); if (r[2]) s.quadraticCurveTo(x1, y1, x1 - r[2], y1);
    s.lineTo(x0 + r[3], y1); if (r[3]) s.quadraticCurveTo(x0, y1, x0, y1 - r[3]);
    s.lineTo(x0, y0 + r[0]); if (r[0]) s.quadraticCurveTo(x0, y0, x0 + r[0], y0);
    return s;
  }
  function extrude(shape, depth, bevel = 0.05) {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    g.translate(0, 0, -depth / 2); g.computeVertexNormals();
    return g;
  }

  /* ── picnic ── */
  function picnic(root, refs) {
    const R = Layout.rug, g = grp(R.x, 0, R.z, R.rot); root.add(g);
    const rug = mesh(new T.PlaneGeometry(R.w, R.d), Mats.lit({ map: Mats.tex(Paint.rug()), roughness: 0.96 }), false, true); refs.rugMat = rug.material;
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.012; g.add(rug); refs.rugMesh = rug;
    /* low table */
    const wood = Mats.tex(Paint.wood(5));
    const tg = grp(0, 0, 0); g.add(tg); { const g = tg;
    const top = mesh(new T.BoxGeometry(1.45, 0.05, 0.78), Mats.lit({ map: wood, roughness: 0.6 })); at(top, 0, 0.4, 0); g.add(top);
    const legM = L('#4a2d1a');
    for (const [x, z] of [[-0.62, -0.31], [0.62, -0.31], [-0.62, 0.31], [0.62, 0.31]]) g.add(at(mesh(new T.BoxGeometry(0.06, 0.38, 0.06), legM), x, 0.19, z));
    /* on the table, arranged round the menu: cheese board left, plates and glasses right, the candle by the menu */
    const board = mesh(new T.BoxGeometry(0.42, 0.025, 0.26), L('#b5814f', { roughness: 0.7 })); at(board, -0.46, 0.437, -0.06); g.add(board);
    const cheese = L('#e8c766', { roughness: 0.6 });
    for (const [x, z] of [[-0.6, -0.1], [-0.52, 0.0], [-0.44, -0.12]]) g.add(at(mesh(new T.BoxGeometry(0.07, 0.04, 0.05), cheese), x, 0.47, z));
    const grape = L('#4f2446', { roughness: 0.35 });
    for (let i = 0; i < 9; i++) g.add(at(mesh(new T.SphereGeometry(0.02, 8, 6), grape), -0.36 + (i % 3) * 0.035, 0.465 + Math.floor(i / 6) * 0.02, -0.06 + Math.floor(i / 3) * 0.03));
    const plate = L('#efe9de', { roughness: 0.4 });
    for (const [x, z] of [[0.38, -0.22], [0.42, 0.22]]) g.add(at(mesh(new T.CylinderGeometry(0.12, 0.11, 0.015, 20), plate), x, 0.432, z));
    const wine = L('#5c0d1d', { roughness: 0.15 }), glass = new T.MeshStandardMaterial({ color: C('#cfdde6'), roughness: 0.05, transparent: true, opacity: 0.35 });
    for (const [x, z] of [[0.62, -0.1], [0.63, 0.13]]) { g.add(at(mesh(new T.CylinderGeometry(0.034, 0.03, 0.07, 12), wine), x, 0.47, z)); g.add(at(mesh(new T.CylinderGeometry(0.038, 0.032, 0.15, 12), glass, false), x, 0.5, z)); }
    const bottle = mesh(new T.CylinderGeometry(0.04, 0.04, 0.25, 12), L('#1f3a2a', { roughness: 0.2 })); at(bottle, -0.14, 0.55, -0.27); g.add(bottle);
    g.add(at(mesh(new T.CylinderGeometry(0.014, 0.02, 0.1, 8), L('#1f3a2a', { roughness: 0.2 })), -0.14, 0.72, -0.27));
    const jar = mesh(new T.CylinderGeometry(0.05, 0.05, 0.1, 14), glow(1.0, 0.62, 0.3)); at(jar, 0.17, 0.475, -0.24); g.add(jar);
    refs.candles.push(jar.material);
    /* the drawing board where the menu was, facing the green cushion (models/camp/sketchboard.js) */
    const sk = Models.make('camp/sketchboard'); at(sk, 0.0, 0.425, 0.13); sk.rotation.y = 0.04; g.add(sk); sk.userData.pick = 'sketch';
    refs.sketch = sk;
    refs.table = tg;
    }
    /* the toolbox that keeps the drawings, on the corner of the rug by the green cushion (models/camp/toolbox.js) */
    { const tb = Models.make('camp/toolbox'); at(tb, 1.5, 0.012, 0.98); tb.rotation.y = -0.5; g.add(tb); tb.userData.pick = 'toolbox';
      refs.toolbox = tb; refs.dyn.push({ o: tb, kind: 'slide', half: 0.25, tip: 0.3 }); }
    refs.dyn.push({ o: tg, kind: 'slide', half: 0.42, tip: 0.22, candle: true });
    /* floor cushions & pouf */
    const cushion = (hex, sx, sy, sz, x, z, ry = 0) => {
      const o = mesh(new T.SphereGeometry(1, 22, 14), L(hex, { roughness: 0.95 })); o.scale.set(sx, sy, sz); o.position.set(x, sy * 0.92, z); o.rotation.y = ry; g.add(o);
      refs.dyn.push({ o, kind: 'float', half: sx, tip: 0.3 }); (refs.cushions = refs.cushions || []).push(o);
    };
    cushion('#c4943a', 0.5, 0.14, 0.3, -0.22, -0.92, 0.06); cushion('#7d9277', 0.5, 0.14, 0.3, 0.26, 0.93, -0.08);
    cushion('#ddd0b4', 0.32, 0.21, 0.32, -1.32, 0.08); cushion('#a64d33', 0.3, 0.13, 0.3, 1.3, -0.15, 0.3);
    cushion('#6c84a6', 0.24, 0.13, 0.2, -0.78, -1.05, -0.4); cushion('#d8c9ad', 0.34, 0.06, 0.26, -1.0, 0.95, 0.4);
    /* the picnic hamper, the blueprints standing in it (models/camp/basket.js) */
    const bk = grp(1.45, 0.012, -0.98, 0.3); g.add(bk); bk.add(Models.make('camp/basket'));
    refs.dyn.push({ o: bk, kind: 'tip', half: 0.17, tip: 1.35 });
    refs.planRoll = bk.children[0].userData.planRoll;
    refs.basket = bk;
    /* book */
    const bookM = L('#efe6d1', { roughness: 0.9 });
    const bkL = mesh(new T.BoxGeometry(0.2, 0.02, 0.28), bookM); at(bkL, -1.45, 0.02, -0.9); bkL.rotation.set(0, 0.5, 0.06); g.add(bkL); refs.dyn.push({ o: bkL, kind: 'float', half: 0.14, tip: 0.4 }); refs.bookLoose = bkL;
  }

  function lanterns(root, refs) {
    for (const [x, z, s] of Layout.lanterns) {
      const g = grp(x, 0, z, 0.3); root.add(g);
      const iron = L('#26201c', { roughness: 0.55, metalness: 0.4 });
      g.add(at(mesh(new T.CylinderGeometry(0.135 * s, 0.135 * s, 0.03 * s, 6), iron), 0, 0.015 * s, 0));
      const glassM = glow(1.0, 0.55, 0.22);
      g.add(at(mesh(new T.CylinderGeometry(0.105 * s, 0.12 * s, 0.3 * s, 6), glassM, false), 0, 0.18 * s, 0));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(at(mesh(new T.BoxGeometry(0.014 * s, 0.31 * s, 0.014 * s), iron), Math.cos(a) * 0.116 * s, 0.18 * s, Math.sin(a) * 0.116 * s)); }
      g.add(at(mesh(new T.ConeGeometry(0.15 * s, 0.13 * s, 6), iron), 0, 0.395 * s, 0));
      const ring = mesh(new T.TorusGeometry(0.04 * s, 0.008 * s, 6, 14), iron); at(ring, 0, 0.49 * s, 0); g.add(ring);
      refs.lanterns.push({ mat: glassM, pos: new T.Vector3(x, 0.2 * s, z), s });
      refs.dyn.push({ o: g, kind: 'tip', half: 0.12 * s, tip: 1.5, lantern: refs.lanterns.length - 1 }); (refs.lanternGroups = refs.lanternGroups || []).push(g);
    }
  }

  function stringLights(root, refs, U) {
    const poleM = L('#6a4d33', { roughness: 0.9 }), wireM = new T.MeshStandardMaterial({ color: C('#151210'), roughness: 0.6 });
    refs.poles = []; refs.poleCaps = []; refs.strands = [];
    for (const [x, z] of Layout.poles) {
      const pole = at(mesh(new T.CylinderGeometry(0.032, 0.045, Layout.POLE_H, 8), poleM), x, Layout.POLE_H / 2, z), cap = at(mesh(new T.SphereGeometry(0.045, 8, 6), poleM), x, Layout.POLE_H, z);
      root.add(pole); root.add(cap); refs.poles.push(pole); refs.poleCaps.push(cap);
    }
    const segs = Layout.strands.map(([i, j]) => { const a = Layout.poles[i], b = Layout.poles[j]; return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
    const total = segs.reduce((s, q) => s + q.len, 0);
    let acc = 0; const bulbs = [];
    for (const [si, s] of segs.entries()) {
      const top = Layout.POLE_H - 0.05, sag = 0.26 + s.len * 0.035;
      const P = t => new T.Vector3(s.a[0] + (s.b[0] - s.a[0]) * t, top - sag * 4 * t * (1 - t), s.a[1] + (s.b[1] - s.a[1]) * t);
      const pts = []; for (let i = 0; i <= 20; i++) pts.push(P(i / 20));
      const wire = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 30, 0.009, 4, false), wireM, false, false); root.add(wire); refs.strands.push(wire);
      const n = Math.max(3, Math.round(s.len / 0.45));
      for (let i = 1; i < n; i++) { const t = i / n, p = P(t); p.y -= 0.075; bulbs.push({ p, order: (acc + t * s.len) / total, strand: si, t }); }
      acc += s.len;
    }
    const inst = instancedLights(bulbs, 0.032, U.bulb);
    root.add(inst); refs.bulbMesh = inst;
    refs.bulbs = bulbs;
  }

  /* ── camper van: a retro split-screen camper parked on the sand, sliding door open onto a lit
     interior, striped awning on two poles with fairy lights along its edge ── */
  function rrect(w, h, r) { return rshape(-w / 2, -h / 2, w / 2, h / 2, [r, r, r, r]); }
  function van(root, refs, U) {
    const V = Layout.van, g = grp(V.x, 0, V.z, V.rot); root.add(g);
    const bodyM = Mats.litP({ color: C('#ffffff'), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 }, 'van');
    refs.vanGlow = [];
    const glass = new T.MeshStandardMaterial({ color: C('#0a1016'), roughness: 0.04, metalness: 0.85 });
    const rubber2 = L('#0e0e0f', { roughness: 0.7 });
    const chrome = new T.MeshStandardMaterial({ color: C('#d8dbde'), roughness: 0.18, metalness: 0.95 });
    const dark = L('#141416', { roughness: 0.85 }), rubber = L('#121212', { roughness: 0.92 }), rimW = L('#e9e5da', { roughness: 0.4 });
    /* the light inside (the engine sets the lamp and the daylight each frame), whether the pop-top is up and the door open */
    const lamp = new T.Color(0, 0, 0), ambIn = new T.Color(0, 0, 0), uPop = { value: 1 }, uDoor = { value: 1 };
    refs.vanInside = { color: lamp, amb: ambIn, pop: uPop, door: uDoor };
    /* a pane that looks into the van: mode 0 the open doorway, 1 a living window with its curtains, 2 the cab's glass */
    const paneMat = (hw, hh, mode, nrm) => new T.ShaderMaterial({ uniforms: { uLamp: { value: lamp }, uAmbIn: { value: ambIn }, uPop, uDoor, uTime: U.bulb.uTime, uVanInv: Mats.U.uVanInv,
      uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF, uHalf: { value: new T.Vector2(hw, hh) }, uMode: { value: mode }, uNrm: { value: nrm.clone() }, ...Mats.shadeU() }, vertexShader: VAN_VS, fragmentShader: VAN_FS });
    /* body: side profile with real wheel arches, extruded across the width with rounded edges */
    const sill = 0.36, xr = -1.25, xf = 1.28, AR = 0.53, BV = 0.1;
    const sh = new T.Shape();
    sh.moveTo(-2.0, sill);
    sh.lineTo(xr - AR, sill); sh.absarc(xr, sill, AR, Math.PI, 0, true);
    sh.lineTo(xf - AR, sill); sh.absarc(xf, sill, AR, Math.PI, 0, true);
    sh.lineTo(2.02, sill); sh.quadraticCurveTo(2.14, sill, 2.15, sill + 0.14);
    sh.lineTo(2.17, 0.92); sh.quadraticCurveTo(2.18, 1.02, 2.14, 1.1);
    sh.lineTo(2.0, 1.58); sh.quadraticCurveTo(1.9, 1.86, 1.58, 1.86);
    sh.lineTo(-1.72, 1.86); sh.quadraticCurveTo(-2.06, 1.85, -2.09, 1.52);
    sh.lineTo(-2.1, 0.52); sh.quadraticCurveTo(-2.1, sill, -2.0, sill);
    const bg = new T.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 6, curveSegments: 22 });
    bg.translate(0, 0, -0.75); bg.computeVertexNormals();
    g.add(mesh(bg, bodyM));
    const SZ = 0.75 + BV;                                   /* flat side faces at z = ±SZ */
    /* windows: a rubber seal round each, and in it a pane that looks into the van (its own glass on it) */
    const ringG = (w, h, r, t) => { const o = rrect(w + 2 * t, h + 2 * t, r + t); o.holes.push(rrect(w, h, r)); return new T.ShapeGeometry(o, 6); };
    const win = (x, y, w, h, side, mode, r = 0.07, parent = g, zOff = 0) => {
      const tr = mesh(ringG(w, h, r, 0.024), rubber2, false); at(tr, x, y, side * (SZ + 0.006 + zOff));
      /* (the pane a little bigger than the seal's opening, its edge tucked under it: no slit of paint between them seen side-on) */
      const gl = mesh(new T.ShapeGeometry(rrect(w + 0.016, h + 0.016, r + 0.008), 6), paneMat(w / 2, h / 2, mode, new T.Vector3(0, 0, side)), false); at(gl, x, y, side * (SZ + 0.003 + zOff));
      if (side < 0) { tr.rotation.y = Math.PI; gl.rotation.y = Math.PI; }
      parent.add(tr, gl); return gl;
    };
    /* (the door's side: the cab's window, the doorway, and a plain panel between where the clipboard hangs) */
    for (const [x, w, mode] of [[1.5, 0.66, 2], [0.55, 0.8, 1], [-0.42, 0.8, 1], [-1.38, 0.8, 1]]) win(x, 1.36, w, 0.42, 1, mode);
    win(1.5, 1.36, 0.66, 0.42, -1, 2);
    /* rear window, split windscreen, wipers */
    { const rw = mesh(new T.ShapeGeometry(rrect(1.116, 0.356, 0.078), 6), paneMat(0.55, 0.17, 2, new T.Vector3(-1, 0, 0)), false); rw.rotation.y = -Math.PI / 2; at(rw, -2.1 - BV - 0.004, 1.42, 0); g.add(rw);
      const rs = mesh(ringG(1.1, 0.34, 0.07, 0.024), rubber2, false); rs.rotation.y = -Math.PI / 2; at(rs, -2.1 - BV - 0.007, 1.42, 0); g.add(rs); }
    const A = new T.Vector2(2.14 + BV * 0.97, 1.1 + BV * 0.24), Bp = new T.Vector2(2.0 + BV * 0.96, 1.58 + BV * 0.28);
    const th = Math.atan2(Bp.x - A.x, Bp.y - A.y) * -1, mid = A.clone().add(Bp).multiplyScalar(0.5), len = A.distanceTo(Bp);
    for (const z of [-0.36, 0.36]) {
      const ws = mesh(new T.ShapeGeometry(rrect(0.656, len - 0.044, 0.088), 6), glass, false);
      ws.rotation.set(0, Math.PI / 2, -th, 'ZYX'); at(ws, mid.x + 0.006, mid.y, z);
      ws.material = paneMat(0.32, (len - 0.06) / 2, 2, new T.Vector3(0, 0, 1).applyEuler(ws.rotation)); g.add(ws);
      const wsr = mesh(ringG(0.64, len - 0.06, 0.08, 0.022), rubber2, false); wsr.rotation.copy(ws.rotation); at(wsr, mid.x + 0.009, mid.y, z); g.add(wsr);
      const wp = mesh(new T.BoxGeometry(0.01, 0.42, 0.012), dark); wp.rotation.set(0.5 * Math.sign(z), 0, -th); at(wp, mid.x + 0.02, mid.y - 0.12, z * 0.6); g.add(wp);
    }
    /* front: round headlamps in chrome bezels, bumper, an indicator pair */
    for (const z of [-0.58, 0.58]) {
      const bz = mesh(new T.TorusGeometry(0.095, 0.02, 8, 24), chrome); bz.rotation.y = Math.PI / 2; at(bz, 2.17 + BV + 0.01, 0.8, z); g.add(bz);
      const lm = new T.MeshStandardMaterial({ color: C('#d5dbe0'), roughness: 0.05, metalness: 0.4, emissive: new T.Color(1, 0.93, 0.8), emissiveIntensity: 0 }); refs.vanHead.push(lm);
      const lens = mesh(new T.SphereGeometry(0.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lm);
      lens.rotation.z = -Math.PI / 2; lens.scale.set(1, 0.35, 1); at(lens, 2.17 + BV, 0.8, z); g.add(lens);
      g.add(at(mesh(new T.SphereGeometry(0.03, 10, 8), L('#d98a2b', { roughness: 0.3 })), 2.17 + BV, 1.0, z * 1.12));
    }
    const bump = (x) => { const b = mesh(new T.CapsuleGeometry(0.045, 1.7, 6, 12), chrome); b.rotation.x = Math.PI / 2; at(b, x, 0.46, 0); g.add(b); };
    bump(2.17 + BV + 0.07); bump(-2.1 - BV - 0.07);
    for (const z of [-0.68, 0.68]) { const tm = new T.MeshStandardMaterial({ color: C('#8f1a12'), roughness: 0.25, emissive: new T.Color(1, 0.08, 0.04), emissiveIntensity: 0 }); refs.vanTail.push(tm); g.add(at(mesh(new T.BoxGeometry(0.03, 0.18, 0.09), tm), -2.1 - BV - 0.01, 0.98, z)); }
    /* side mirrors */
    for (const z of [-1, 1]) {
      { const a = new T.Vector3(1.86, 1.25, z * (SZ + 0.01)), b = new T.Vector3(1.9, 1.38, z * (SZ + 0.16)); g.add(between(new T.CylinderGeometry(0.008, 0.008, a.distanceTo(b), 6), chrome, a, b)); }   /* (between() keeps the length it is given) */
      g.add(at(mesh(new T.CapsuleGeometry(0.045, 0.06, 4, 10), dark), 1.9, 1.42, z * (SZ + 0.17))).children.at(-1).scale.set(0.35, 1, 1.3);
    }
    /* cab door seams + handles, engine louvres at the back */
    for (const z of [-1, 1]) {
      /* (the cab door's back edge, from over the wheel arch to the roof's curve) */
      g.add(at(mesh(new T.BoxGeometry(0.006, 0.9, 0.004), dark), 1.02, 1.29, z * (SZ + 0.002)));
      g.add(at(mesh(new T.BoxGeometry(0.1, 0.02, 0.02), chrome), 1.15, 1.08, z * (SZ + 0.012)));
    }
    /* the engine's louvres, low on the back corner (clear of the window over them and the wheel arch in front) */
    for (let i = 0; i < 6; i++) g.add(at(mesh(new T.BoxGeometry(0.3, 0.012, 0.006), dark), -1.95, 0.86 + i * 0.045, SZ + 0.002));
    /* the back: the engine lid's seam and its handle, the number plate under it with its little lamp */
    { const lid = mesh(ringG(0.9, 0.4, 0.07, 0.008), dark, false); lid.rotation.y = -Math.PI / 2; at(lid, -2.1 - BV - 0.003, 0.88, 0); g.add(lid);
      const hd = mesh(new T.BoxGeometry(0.02, 0.025, 0.12), chrome); at(hd, -2.1 - BV - 0.012, 1.0, 0); g.add(hd);
      const pc = document.createElement('canvas'); pc.width = 256; pc.height = 72; const a = pc.getContext('2d');
      a.fillStyle = '#f2efe6'; a.fillRect(0, 0, 256, 72); a.strokeStyle = '#222'; a.lineWidth = 4; a.strokeRect(4, 4, 248, 64);
      a.fillStyle = '#1d1d1f'; a.font = 'bold 44px "IBM Plex Mono", monospace'; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillText('COVE 77', 128, 38);
      const pl = mesh(new T.PlaneGeometry(0.3, 0.085), L('#ffffff', { map: Mats.tex(pc), roughness: 0.5 }), false); pl.rotation.y = -Math.PI / 2; at(pl, -2.1 - BV - 0.004, 0.6, 0); g.add(pl);
      g.add(at(mesh(new T.BoxGeometry(0.03, 0.022, 0.08), chrome), -2.1 - BV - 0.012, 0.66, 0)); }

    /* wheels: rounded tyres, white rims, chrome caps */
    const tyreG = new T.LatheGeometry([[0.2, -0.1], [0.29, -0.1], [0.322, -0.082], [0.333, -0.045], [0.333, 0.045], [0.322, 0.082], [0.29, 0.1], [0.2, 0.1]].map(([r, y]) => new T.Vector2(r, y)), 32);
    for (const x of [xr, xf]) for (const z of [-1, 1]) {
      const ws = grp(x, 0.333, z * 0.73); g.add(ws); const w = new T.Group(); ws.add(w); refs.vanWheels.push({ steer: ws, spin: w, front: x === xf });
      const ty = mesh(tyreG, rubber); ty.rotation.x = Math.PI / 2; w.add(ty);
      const rim = mesh(new T.CylinderGeometry(0.205, 0.205, 0.16, 28), rimW); rim.rotation.x = Math.PI / 2; w.add(rim);
      const cap = mesh(new T.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), chrome); cap.rotation.x = z * Math.PI / 2; cap.scale.set(1, 0.42, 1); at(cap, 0, 0, z * 0.08); w.add(cap);
    }
    /* pop-top roof: the lid hinged at the back and raised at the front on lit canvas walls */
    { const y0 = 1.86 + BV, xh = -1.62, xf2 = 1.08, zw = 0.7, th = 0.19, Lx = xf2 - xh;
      const lid = grp(xh, y0 + 0.01, 0); lid.rotation.z = th; g.add(lid); refs.vanPop = { lid, th };
      const lg = new T.ExtrudeGeometry(rshape(0, -zw - 0.04, Lx + 0.06, zw + 0.04, [0.08, 0.2, 0.2, 0.08]), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10 });
      lg.rotateX(Math.PI / 2); lg.translate(0, 0.06, 0);
      lid.add(mesh(lg, Mats.litP({ color: C('#efe9dc'), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 })));
      const lidTip = (z) => new T.Vector3(xh + Lx * Math.cos(th), y0 + 0.01 + Lx * Math.sin(th), z);
      const R0 = new T.Vector3(xh, y0, -zw), R1 = new T.Vector3(xf2, y0, -zw), R2 = new T.Vector3(xf2, y0, zw), R3 = new T.Vector3(xh, y0, zw), L1 = lidTip(-zw), L2 = lidTip(zw);
      const pos = [], uv = [], push = (v, u, w) => { pos.push(v.x, v.y, v.z); uv.push(u, w); };
      const sag = (a, b, k) => a.clone().lerp(b, 0.5).add(new T.Vector3(0, 0, k));
      /* side walls (triangles, slightly sagging inwards) and the front wall */
      for (const [A, B, Cc, sgn] of [[R0, R1, L1, 1], [R3, R2, L2, -1]]) { const M = sag(B, Cc, 0.03 * sgn); push(A, 0, 0); push(B, 1, 0); push(M, 1, 0.5); push(A, 0, 0); push(M, 1, 0.5); push(Cc, 1, 1); }
      { const M1 = sag(R1, L1, 0).add(new T.Vector3(-0.05, 0, 0)), M2 = sag(R2, L2, 0).add(new T.Vector3(-0.05, 0, 0));
        push(R1, 0, 0); push(R2, 1, 0); push(M2, 1, 0.5); push(R1, 0, 0); push(M2, 1, 0.5); push(M1, 0, 0.5);
        push(M1, 0, 0.5); push(M2, 1, 0.5); push(L2, 1, 1); push(M1, 0, 0.5); push(L2, 1, 1); push(L1, 0, 1); }
      const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); cg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); cg.computeVertexNormals();
      const clothT = Mats.tex(Paint.canvasCloth(), { repeat: true });
      const cm = Mats.lit({ map: clothT, emissiveMap: clothT, emissive: new T.Color(1, 0.62, 0.32), emissiveIntensity: 0.1, side: T.DoubleSide, roughness: 0.95 });
      refs.vanGlow.push({ m: cm, k: 0.05 });
      const canvasM = mesh(cg, cm, true, false); g.add(canvasM); refs.vanPop.canvas = canvasM;
      /* the same surfboard, strapped to the closed lid for driving */
      const rb = grp(0.3, 0.115, 0.0); lid.add(rb); rb.visible = false; refs.boardRoof = rb;
      const b1 = mesh(new T.SphereGeometry(1, 32, 12), L('#efe4c8', { roughness: 0.3 })); b1.scale.set(1.12, 0.035, 0.26); rb.add(b1);
      const b2 = mesh(new T.SphereGeometry(1, 32, 12), L('#d9684e', { roughness: 0.3 })); b2.scale.set(1.115, 0.037, 0.05); rb.add(b2);
    }
    /* surfboard leaning on the back corner */
    /* (its foot out on the sand behind the bumper, its back resting against the van's rear corner, through neither) */
    { const sb = grp(-2.6, 0, -0.52, 0); g.add(sb); sb.rotation.set(0.0, 0.2, -0.24); refs.boardLean = sb;
      const board = mesh(new T.SphereGeometry(1, 32, 14), L('#efe4c8', { roughness: 0.3 })); board.scale.set(0.035, 1.12, 0.26); at(board, 0, 1.1, 0); sb.add(board);
      const st2 = mesh(new T.SphereGeometry(1, 32, 14), L('#d9684e', { roughness: 0.3 })); st2.scale.set(0.037, 1.115, 0.05); at(st2, 0, 1.1, 0); sb.add(st2);
      const fin = mesh(new T.BoxGeometry(0.11, 0.1, 0.012), dark); at(fin, 0.06, 0.18, 0); sb.add(fin); }
    /* the sliding door, open: the room inside seen through the doorway, the door panel slid back outside */
    const DX = -0.33, DW = 1.06, DH = 1.3, DY = 0.46 + DH / 2;
    const seal = mesh(ringG(DW, DH, 0.06, 0.03), dark, false); seal.rotation.y = Math.PI; at(seal, DX, DY, -SZ - 0.003); g.add(seal); refs.vanOpen = [seal];
    const door = new T.Mesh(new T.PlaneGeometry(DW, DH), paneMat(DW / 2, DH / 2, 0, new T.Vector3(0, 0, -1))); door.rotation.y = Math.PI; at(door, DX, DY, -SZ - 0.004); g.add(door); refs.vanOpen.push(door);
    { const st = at(mesh(new T.BoxGeometry(DW, 0.05, 0.12), L('#3a2a1e', { roughness: 0.8 })), DX, 0.47, -SZ - 0.04); g.add(st); refs.vanOpen.push(st); }          /* step */
    const slid = new T.Group(); g.add(slid); refs.vanSlid = { g: slid, dx: DW + 0.06 };
    const sd = mesh(new T.ExtrudeGeometry(rrect(DW, DH, 0.06), { depth: 0.03, bevelEnabled: false }), bodyM); sd.rotation.y = Math.PI; at(sd, DX - DW - 0.06, DY, -SZ - 0.035); slid.add(sd);
    win(DX - DW - 0.06, 1.36, 0.8, 0.4, -1, 1, 0.06, slid, 0.066);
    slid.add(at(mesh(new T.BoxGeometry(0.1, 0.022, 0.022), chrome), DX - DW / 2 - 0.02 - DW - 0.06 + DW / 2 + 0.38, 1.05, -SZ - 0.075));
    /* awning over the doorway: striped canvas from the roof edge out to two poles, scalloped valance */
    const AW = { x0: -1.95, x1: 0.62, zi: -SZ - 0.02, zo: -2.55, yi: 1.9, yo: 1.74 };
    const awn = new T.Group(); g.add(awn); refs.vanAwning = { g: awn, zi: AW.zi, poles: [] };
    const cloth = Mats.lit({ map: Mats.tex(Paint.stripes('#efe6d2', '#c8643f', 9), { repeat: true }), side: T.DoubleSide, roughness: 0.92 });
    { const n = 12, pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) for (let j = 0; j <= 6; j++) {
        const u = i / n, v = j / 6, x = AW.x0 + (AW.x1 - AW.x0) * u, z = AW.zi + (AW.zo - AW.zi) * v;
        const y = AW.yi + (AW.yo - AW.yi) * v - Math.sin(Math.PI * u) * 0.05 * v - Math.sin(Math.PI * v) * 0.03;
        pos.push(x, y, z); uv.push(u * 2.2, v);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) { const a = i * 7 + j, b2 = a + 7; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
      const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ag.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); ag.setIndex(idx); ag.computeVertexNormals();
      awn.add(mesh(ag, cloth));
      /* the scalloped valance is cloth, pinned along the awning's sagging edge: it lifts and flaps in the breeze,
         more in a storm (a column for every 1/48 of its length, so the twelve scallops keep their round) */
      const VN = 49, VR = 4, drop = i => 0.1 + 0.035 * Math.abs(Math.sin(i / (VN - 1) * Math.PI * 12));
      const vcl = Cloth.create({ grids: [{ nx: VN, ny: VR, at: (i, j) => { const u = i / (VN - 1); return [AW.x0 + (AW.x1 - AW.x0) * u, AW.yo - Math.sin(Math.PI * u) * 0.05 - drop(i) * j / (VR - 1), AW.zo]; },
        pin: (i, j) => j === 0, uv: (i, j) => [i / (VN - 1) * 2.2, j / (VR - 1)], stretch: 1, shear: 0.5, bend: 0.08, tether: true }], step: 1 / 120, iters: 4, maxSteps: 12, damp: 1.2, air: 2.2 });
      const vm = mesh(vcl.geometry(0), cloth); vm.geometry.boundingSphere = new T.Sphere(new T.Vector3((AW.x0 + AW.x1) / 2, AW.yo - 0.1, AW.zo), (AW.x1 - AW.x0) / 2 + 0.4); awn.add(vm);
      refs.fabric.push({ cl: vcl, mesh: vm, frame: awn, gust: 1, r: (AW.x1 - AW.x0) / 2 + 0.4, c: vm.geometry.boundingSphere.center });
      /* the poles: painted aluminium, a foot plate in the sand, each held by a guy line out to a peg */
      const poleM = L('#aeb2b5', { roughness: 0.42, metalness: 0.55 }), ropeM = L('#d8cfb8', { roughness: 0.9 }), pegM = L('#6b6f73', { roughness: 0.5, metalness: 0.4 });
      for (const [x, sd] of [[AW.x0 + 0.03, -1], [AW.x1 - 0.03, 1]]) {
        const pl = at(mesh(new T.CylinderGeometry(0.0125, 0.0125, AW.yo, 10), poleM), x, AW.yo / 2, AW.zo); awn.add(pl); refs.vanAwning.poles.push(pl);
        const ft = at(mesh(new T.CylinderGeometry(0.035, 0.04, 0.012, 12), pegM), x, 0.006, AW.zo); awn.add(ft); refs.vanAwning.poles.push(ft);
        const top = new T.Vector3(x, AW.yo - 0.02, AW.zo), peg = new T.Vector3(x + sd * 0.45, 0.03, AW.zo - 0.95);
        const c = new T.CatmullRomCurve3([top, top.clone().lerp(peg, 0.5).add(new T.Vector3(0, -0.025, 0)), peg]);
        const rp = mesh(new T.TubeGeometry(c, 16, 0.0035, 5, false), ropeM, false); awn.add(rp); refs.vanAwning.poles.push(rp);
        const pg = mesh(new T.CylinderGeometry(0.006, 0.004, 0.12, 6), pegM); pg.rotation.set(-0.5, 0, sd * 0.25); at(pg, peg.x, 0.03, peg.z); awn.add(pg); refs.vanAwning.poles.push(pg);
      }
      const rail = mesh(new T.CylinderGeometry(0.03, 0.03, AW.x1 - AW.x0 + 0.1, 12), L('#d9d4c8', { roughness: 0.5 })); rail.rotation.z = Math.PI / 2; at(rail, (AW.x0 + AW.x1) / 2, AW.yi + 0.02, AW.zi - 0.02); g.add(rail);
    }
    /* fairy lights along the awning edge */
    const pts = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30, x = AW.x0 + 0.05 + t * (AW.x1 - AW.x0 - 0.1), sc = Math.sin(((i % 6) / 6) * Math.PI); pts.push({ p: new T.Vector3(x, AW.yo - 0.13 - sc * 0.07, AW.zo - 0.02), order: t }); }
    const fl = instancedLights(pts, 0.021, U.fairy); awn.add(fl);
    /* the string hangs from the valance's hem, so each light goes where the hem above it goes */
    { const V = refs.fabric[refs.fabric.length - 1], vc = V.cl, nx = vc.grids[0].nx, e = (vc.grids[0].ny - 1) * nx, m4 = new T.Matrix4();
      const col = pts.map(q => e + Math.round((q.p.x - AW.x0) / (AW.x1 - AW.x0) * (nx - 1))), off = pts.map((q, k) => [q.p.x - vc.R[col[k] * 3], q.p.y - vc.R[col[k] * 3 + 1], q.p.z - vc.R[col[k] * 3 + 2]]);
      V.after = () => { const P = vc.P; for (let k = 0; k < col.length; k++) { const i = col[k] * 3; m4.makeTranslation(P[i] + off[k][0], P[i + 1] + off[k][1], P[i + 2] + off[k][2]); fl.setMatrixAt(k, m4); } fl.instanceMatrix.needsUpdate = true; }; }
    /* doormat + sandals + a camp stool */
    g.updateMatrixWorld(true);
    { const mat = grp(0, 0, 0); g.add(mat);
      mat.add(at(mesh(new T.BoxGeometry(0.8, 0.012, 0.48), L('#b89a6c', { roughness: 1 }), false), DX, 0.006, -SZ - 0.55));
      for (const [x, z, r] of [[DX - 0.12, -SZ - 0.52, 0.2], [DX + 0.12, -SZ - 0.58, -0.15]]) { const sa = mesh(new T.BoxGeometry(0.26, 0.02, 0.1), L('#5b3a29')); at(sa, x, 0.02, z); sa.rotation.y = r; mat.add(sa); }
      g.updateMatrixWorld(true); root.attach(mat); refs.vanMat = mat; }
    /* a clipboard with the packing list, hung on the van's side by the door */
    { const cb = grp(0.62, 1.22, -SZ - 0.012, Math.PI); g.add(cb);
      const bw = 0.266, bh = 0.376;
      cb.add(at(mesh(new T.BoxGeometry(bw, bh, 0.005), L('#7a5a3a', { roughness: 0.75 })), 0, 0, -0.003));
      const pc = document.createElement('canvas'); pc.width = 250; pc.height = 350; { const a = pc.getContext('2d'); a.fillStyle = '#f7f3e8'; a.fillRect(0, 0, 250, 350); a.strokeStyle = 'rgba(80,120,170,0.25)'; for (let y = 70; y < 340; y += 12) { a.beginPath(); a.moveTo(15, y); a.lineTo(235, y); a.stroke(); } }
      const pt = Mats.tex(pc), pm = Mats.lit({ map: pt, roughness: 0.9 });
      const sheet = mesh(new T.PlaneGeometry(0.24, 0.336), pm, false); at(sheet, 0, -0.012, 0.0005); cb.add(sheet);
      cb.add(at(mesh(new T.BoxGeometry(0.09, 0.03, 0.012), new T.MeshStandardMaterial({ color: C('#c9ccd1'), roughness: 0.3, metalness: 0.9 })), 0, bh / 2 - 0.012, 0.004));
      /* the hook it hangs from stays on the van when the clipboard is taken down */
      { const hk = mesh(new T.CylinderGeometry(0.004, 0.004, 0.03, 6), L('#3a3a3a')); hk.rotation.x = Math.PI / 2; at(hk, 0.62, 1.22 + bh / 2 + 0.01, -SZ - 0.012); g.add(hk); }
      refs.clipboard = cb; refs.clipSheet = { mesh: sheet, canvas: pc, tex: pt }; }
    refs.vanLightPos = g.localToWorld(new T.Vector3(DX, 1.1, -SZ - 0.2));
    refs.vanDoor = g.localToWorld(new T.Vector3(DX, DY - 0.1, -SZ - 0.02));
    refs.vanLightDir = new T.Vector3(0, -0.35, -1).normalize().applyQuaternion(g.quaternion);
    refs.vanGroup = g; refs.vanDoorLocal = new T.Vector3(DX, DY - 0.1, -SZ - 0.02); refs.vanLightLocal = new T.Vector3(DX, 1.1, -SZ - 0.2);
    Mats.U.uVanInv.value.copy(g.matrixWorld).invert();
  }

  /* smooth lumpy rock: welded icosphere, displaced, flattened underneath (vertex colours set later) */
  function rockGeo(radius, seed, detail = 3) {
    const src = new T.IcosahedronGeometry(1, detail), pa = src.attributes.position, map = new Map(), v = [], idx = [];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      let id = map.get(k); if (id === undefined) { id = v.length / 3; map.set(k, id); v.push(x, y, z); } idx.push(id);
    }
    const r = Textures.rng(seed), ph = [0, 1, 2, 3, 4, 5].map(() => r() * 9);
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i], y = v[i + 1], z = v[i + 2];
      const k = 1 + Math.sin(x * 2.1 + ph[0]) * Math.sin(y * 2.3 + ph[1]) * Math.sin(z * 1.9 + ph[2]) * 0.24
                  + Math.sin(x * 4.7 + ph[3]) * Math.sin(y * 5.1 + ph[4]) * Math.sin(z * 4.3 + ph[5]) * 0.07;
      let yy = y * k; if (yy < -0.3) yy = -0.3 + (yy + 0.3) * 0.2;
      v[i] = x * k * radius; v[i + 1] = yy * radius; v[i + 2] = z * k * radius;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /* bake soot + mottling into a rock's vertex colours, in world space round the fire */
  function sootRock(m, base, F, rr) {
    m.updateMatrixWorld(true);
    const pa = m.geometry.attributes.position, col = new Float32Array(pa.count * 3), p = new T.Vector3();
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
      const d = Math.hypot(p.x - F.x, p.z - F.z), soot = Math.min(1, Math.max(0, (0.56 - d) / 0.16)) * Math.min(1, p.y / 0.06 + 0.4);
      const mot = 0.82 + 0.3 * (Math.sin(p.x * 61 + rr) * Math.sin(p.z * 57 - rr) * 0.5 + 0.5);
      const k = mot * (1 - 0.72 * soot);
      col[i * 3] = base[0] * k; col[i * 3 + 1] = base[1] * k; col[i * 3 + 2] = base[2] * k;
    }
    m.geometry.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  }

  /* ── fire + coffee: a log teepee in a ring of river stones; an iron tripod holds the enamel
     coffee kettle on a chain just above the flame tips; a tin mug warms on a flat stone ── */
  function campfire(root, refs) {
    const F = Layout.fire, g = grp(F.x, 0, F.z); root.add(g); refs.fireGroup = g;
    const r = Textures.rng(91);
    const noFire = o => { o.userData.noFireShadow = true; return o; };
    const barkT = Mats.tex(Paint.logBark(7), { repeat: true });
    const charM = Mats.lit({ map: barkT, color: new T.Color(0.32, 0.29, 0.27), roughness: 1 }, 'log');
    /* stone ring */
    const nS = 13;
    for (let i = 0; i < nS; i++) {
      const a = i / nS * TAU + (r() - 0.5) * 0.18, k = 0.5 + (r() - 0.5) * 0.05, rs = 0.075 + r() * 0.03;
      const st = mesh(rockGeo(rs, 300 + i), Mats.lit({ vertexColors: true, roughness: 0.9 }, 'rock'));
      st.scale.set(1.25 + r() * 0.3, 0.85 + r() * 0.3, 1.0 + r() * 0.2); st.rotation.set(0, a + (r() - 0.5) * 0.6, 0);
      at(st, Math.cos(a) * k, rs * 0.42, Math.sin(a) * k); g.add(st);
      const gr = 0.34 + r() * 0.14; st.userData.base = [gr, gr * 0.96, gr * 0.9].map(c => Math.pow(c, 2.2));
    }
    /* flat stone outside the ring for the mug */
    const ma = 1.62, flat = mesh(rockGeo(0.13, 777), Mats.lit({ vertexColors: true, roughness: 0.85 }, 'rock'));
    flat.scale.set(1.15, 0.42, 1.0); flat.rotation.y = 0.4; at(flat, Math.cos(ma) * 0.74, 0.035, Math.sin(ma) * 0.74); g.add(flat);
    flat.userData.base = [0.47, 0.45, 0.42].map(c => Math.pow(c, 2.2));
    /* ash + embers */
    const bed = mesh(new T.CircleGeometry(0.36, 32), L('#2a2622', { roughness: 1 }, 'log'), false, true); bed.rotation.x = -Math.PI / 2; at(bed, 0, 0.012, 0); g.add(noFire(bed));
    for (let i = 0; i < 18; i++) { const a = r() * TAU, k = Math.sqrt(r()) * 0.27, c = mesh(rockGeo(0.02 + r() * 0.022, 500 + i, 1), charM, false); c.scale.y = 0.7; at(c, Math.cos(a) * k, 0.02, Math.sin(a) * k); g.add(noFire(c)); }
    /* the fire as it is laid: logs in a star over the embers, sticks leaning over the middle (models/camp/firewood.js) */
    { const fl = Models.make('camp/fireLogs'); g.add(fl); refs.fireLogs = fl; }
    refs.coals = new T.MeshBasicMaterial({ color: new T.Color(0, 0, 0) });
    /* iron tripod, chain and the hanging kettle */
    const ironM = new T.MeshStandardMaterial({ color: C('#1d1c1e'), roughness: 0.45, metalness: 0.75 });
    let kettle; const apex = new T.Vector3(0, 1.46, 0), tri = grp(0, 0, 0); g.add(tri); { const g = tri;
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * TAU + 0.5, foot = new T.Vector3(Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86);
      const over = apex.clone().add(new T.Vector3(-Math.cos(a) * 0.05, 0.1, -Math.sin(a) * 0.05));
      g.add(between(new T.CylinderGeometry(0.011, 0.013, foot.distanceTo(over), 8), ironM, foot, over));
    }
    g.add(at(mesh(new T.TorusGeometry(0.03, 0.007, 6, 16), ironM), 0, 1.47, 0)).children.at(-1).rotation.x = Math.PI / 2;
    const linkG = new T.TorusGeometry(0.013, 0.0032, 5, 10);
    let k = 0, lowY = 1.43; for (let y = 1.43; y > 1.1; y -= 0.031, k++) { const l = mesh(linkG, ironM, true, false); l.scale.set(1, 1.55, 1); l.rotation.y = k % 2 ? Math.PI / 2 : 0; at(l, 0, y, 0); g.add(noFire(l)); lowY = y; }
    /* the coffee pot, its S-hook through the last link (models/camp/coffeepot.js) */
    const pot = Models.make('camp/coffeepot'); pot.traverse(o => { if (o.isMesh) o.userData.noFireShadow = true; });
    kettle = grp(0, lowY - 0.019 - pot.userData.hangY, 0, -0.9); kettle.add(pot); g.add(kettle);
    }
    refs.dyn.push({ o: tri, kind: 'fall', half: 0.86, tip: 1.25 }); refs.tripod = tri;
    /* tin mug on the flat stone */
    const mug = grp(Math.cos(ma) * 0.74 - 0.03, 0.082, Math.sin(ma) * 0.74 + 0.02, 0.4); g.add(mug);
    const mugM = Mats.lit({ map: Mats.tex(Paint.enamel('#e9e2d2'), { repeat: true }), roughness: 0.35 });
    mug.add(noFire(at(mesh(new T.CylinderGeometry(0.045, 0.041, 0.095, 22), mugM), 0, 0.048, 0)));
    const coffee = mesh(new T.CircleGeometry(0.04, 20), L('#2b170d', { roughness: 0.12 }), false); coffee.rotation.x = -Math.PI / 2; at(coffee, 0, 0.088, 0); mug.add(noFire(coffee));
    const rim = mesh(new T.TorusGeometry(0.044, 0.004, 4, 24), L('#24486f')); rim.rotation.x = Math.PI / 2; at(rim, 0, 0.095, 0); mug.add(noFire(rim));
    const mh = mesh(new T.TorusGeometry(0.028, 0.007, 6, 12), mugM); at(mh, 0.055, 0.05, 0); mug.add(noFire(mh));
    refs.dyn.push({ o: mug, kind: 'tip', half: 0.045, tip: 1.57, float: true, mug: true }); refs.mug = mug;
    g.updateMatrixWorld(true);
    g.children.forEach(o => { if (o.userData.base) sootRock(o, o.userData.base, F, o.position.x * 13); });
    refs.mugTop = mug.localToWorld(new T.Vector3(0, 0.1, 0));
    refs.potTop = kettle.localToWorld(new T.Vector3(-0.152, 0.196, 0));
    refs.kettle = kettle;
    refs.fireBase = new T.Vector3(F.x, 0.08, F.z);
  }

  /* plank with rounded long edges, built along x (length), y (thickness), z (width) like a box */
  const plankCache = new Map();
  function plankGeo(len, th, w) {
    const key = [len, th, w].map(v => v.toFixed(3)).join(',');
    if (plankCache.has(key)) return plankCache.get(key);
    const r = Math.min(th, w) * 0.42, sh = rshape(-w / 2, -th / 2, w / 2, th / 2, [r, r, r, r]);
    const g = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: true, bevelThickness: Math.min(0.006, th * 0.25), bevelSize: Math.min(0.004, r * 0.5), bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals();
    plankCache.set(key, g); return g;
  }
  /* Adirondack chair: slatted seat on sloping stringers, fanned reclining back, wide flat arms */
  function adirondack(m) {
    const g = new T.Group(), P = (l, th, w) => mesh(plankGeo(l, th, w), m);
    const A = new T.Vector3(0.40, 0.33, 0), B = new T.Vector3(-0.52, 0.04, 0), phi = Math.atan2(A.y - B.y, A.x - B.x), sl = Math.tan(phi);
    const yc = x => B.y + (x - B.x) * sl;
    for (const z of [-0.27, 0.27]) { const s = P(A.distanceTo(B), 0.1, 0.026); s.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, z); s.rotation.z = phi; g.add(s); }
    for (const z of [-0.305, 0.305]) { const l = P(0.6, 0.09, 0.026); l.rotation.z = Math.PI / 2; at(l, 0.32, 0.3, z); g.add(l); }
    for (let i = 0; i < 7; i++) { const x = 0.37 - i * 0.074, sl_ = P(0.6, 0.022, 0.066); sl_.rotation.set(0, Math.PI / 2, phi, 'ZYX'); at(sl_, x, yc(x) + 0.052 / Math.cos(phi) + 0.011, 0); g.add(sl_); }
    const beta = 0.42, x0 = -0.15, y0 = yc(x0) + 0.07, up = new T.Vector3(-Math.sin(beta), Math.cos(beta), 0), bn = new T.Vector3(-Math.cos(beta), -Math.sin(beta), 0);
    [[-2, 0.74], [-1, 0.81], [0, 0.85], [1, 0.81], [2, 0.74]].forEach(([k, len]) => {
      const al = -k * 0.045, b = P(len, 0.02, 0.084); b.rotation.set(0, al, Math.PI / 2 + beta, 'ZYX');
      const dir = new T.Vector3(1, 0, 0).applyEuler(b.rotation);
      b.position.set(x0, y0, k * 0.105).addScaledVector(dir, len / 2); g.add(b);
    });
    for (const [sAlong, L_] of [[0.2, 0.58], [0.6, 0.7]]) { const bt = P(L_, 0.022, 0.06); bt.rotation.set(0, Math.PI / 2, Math.PI / 2 + beta, 'ZYX'); bt.position.set(x0, y0, 0).addScaledVector(up, sAlong).addScaledVector(bn, 0.022); g.add(bt); }
    const yArm = 0.6, xBack = x0 - (yArm - y0) * Math.tan(beta) - 0.03;
    const brace = P(0.86, 0.06, 0.026); brace.rotation.y = Math.PI / 2; at(brace, xBack, yArm - 0.04, 0); g.add(brace);
    for (const z of [-0.335, 0.335]) {
      const arm = P(0.42 - xBack + 0.05, 0.024, 0.135); at(arm, (0.42 + xBack) / 2 + 0.01, yArm + 0.012, z); g.add(arm);
      g.add(at(P(0.1, 0.07, 0.03), 0.3, yArm - 0.05, z + Math.sign(z) * 0.03));
    }
    g.userData.back = { x0, y0, beta, up, bn, yc, phi, xBack, yArm };
    return g;
  }
  /* a wool throw draped over a chair back: front flap, over the top, long fall behind, loose sides */
  function throwOver(ch, tex) {
    const { x0, y0, up, bn } = ch.userData.back, NU = 26, NV = 34, pos = [], uv = [], idx = [];
    const sTop = 0.86, rr = 0.035;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = i / NU, v = j / NV, z = (u - 0.5) * 0.92, edge = Math.max(0, Math.abs(z) - 0.27);
      let s, off;
      if (v < 0.35) { s = 0.5 + (sTop - 0.5) * (v / 0.35); off = -rr; }
      else if (v < 0.47) { const a = (v - 0.35) / 0.12 * Math.PI; s = sTop + Math.sin(a) * rr * 0.9; off = -Math.cos(a) * rr; }
      else { s = sTop - (v - 0.47) / 0.53 * 0.8; off = rr + 0.012; }
      const wr = 0.012 * Math.sin(u * 17.0 + v * 5.0) + 0.008 * Math.sin(u * 7.0 - v * 11.0);
      const p = new T.Vector3(x0, y0, z).addScaledVector(up, s).addScaledVector(bn, off + wr * (v > 0.45 ? 1.4 : 0.6));
      p.y -= edge * edge * 4.0 * (v > 0.4 ? 1.0 : 0.5); p.addScaledVector(bn, edge * 0.35 * (v > 0.47 ? 1 : -0.4));
      pos.push(p.x, p.y, p.z); uv.push(u * 1.6, v * 1.9);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = mesh(geo, Mats.lit({ map: tex, side: T.DoubleSide, roughness: 0.97 })); ch.add(m); return m;
  }
  function chairs(root, refs) {
    const paintT = [Mats.tex(Paint.plank(31, '#e7e1d3', 1), { repeat: true }), Mats.tex(Paint.plank(38, '#e3dccd', 1), { repeat: true })];
    const chs = [];
    Layout.chairs.forEach((ch, idx) => {
      const ry = Math.atan2(-(ch.face[1] - ch.z), ch.face[0] - ch.x);
      const m = Mats.lit({ map: paintT[idx], roughness: 0.72 });
      const g = adirondack(m); g.position.set(ch.x, 0, ch.z); g.rotation.y = ry; g.userData.ry0 = ry; root.add(g); chs.push(g);
      refs.dyn.push({ o: g, kind: 'tip', half: 0.45, tip: 1.3 });
      g.userData.pick = 'chair' + idx;                              /* a click on either chair sits you in it */
    });
    refs.chairs = chs; refs.chairProps = chs.map(() => []);    /* (what lies on a chair, out of sight while you sit in it) */
    /* a plaid throw over the first chair, a striped pad and a guitar at the second */
    refs.chairProps[0].push(throwOver(chs[0], Mats.tex(Paint.plaid(), { repeat: true })));
    /* a thin striped pad on the second chair's seat */
    { const c2 = chs[1], { yc, phi } = c2.userData.back;
      const pad = mesh(Models.extrude(Models.rshape(-0.21, -0.25, 0.21, 0.25, [0.06, 0.06, 0.06, 0.06]), 0.03, 0.012), Mats.lit({ map: Mats.tex(Paint.stripes('#2f4d5e', '#e8dfc8', 9)), roughness: 0.95 }));
      pad.rotation.set(-Math.PI / 2, 0, 0); const pg = grp(0.08, yc(0.08) + 0.075, 0); pg.rotation.z = phi; pg.add(pad); c2.add(pg);
      refs.chairProps[1].push(pg); }
    towel(chs[1], refs);
  }
  /* a beach towel left over the second chair's back to dry by the fire. It is cloth: the two rows lying over the
     top of the back are pinned there, the front half rests on the slats, the back half hangs free and lifts in the
     gusts. Rows run from the front end, up over the top (rows jf and jf + 1) and down the back. */
  function towel(ch, refs) {
    const { x0, y0, up, bn, xBack, yArm } = ch.userData.back, fw = new T.Vector3(-bn.x, -bn.y, 0);   /* fw: out of the front of the back */
    const NXt = 7, NYt = 13, jf = 5, TW = 0.48, FRONT = 0.4, BACK = 0.62, FOLD = 0.07, LEN = FRONT + FOLD + BACK;
    const top = z => 0.85 - 0.11 * Math.min(1, (z / 0.21) ** 2);                /* the fanned slats: the middle one is longest */
    const s = j => j <= jf ? FRONT * j / jf : FRONT + FOLD + BACK * (j - jf - 1) / (NYt - jf - 2);
    const at = (i, j) => {
      const z = (i / (NXt - 1) - 0.5) * TW, p = new T.Vector3(x0, y0, z).addScaledVector(up, top(z) + 0.012);
      return (j <= jf ? p.addScaledVector(fw, 0.024).addScaledVector(up, s(j) - FRONT) : p.addScaledVector(bn, 0.046).add(new T.Vector3(0, FRONT + FOLD - s(j), 0))).toArray();
    };
    const tex = Mats.tex(Paint.stripes('#e7dcc3', '#3e6a6c', 7), { repeat: true });
    const cl = Cloth.create({ grids: [{ nx: NXt, ny: NYt, at, pin: (i, j) => j === jf || j === jf + 1, uv: (i, j) => [s(j) / LEN * 2, i / (NXt - 1)], stretch: 1, shear: 0.6, bend: 0.25, tether: true }],
      step: 1 / 120, iters: 5, maxSteps: 12, damp: 1, air: 1.6, friction: 0.6 });
    /* the back of the chair as a wall the towel stays either side of (front half in front, back half behind, below
       the top), the arms as rods, and the sand (a plane worked out each frame, as the chair can be knocked over) */
    const d0 = fw.x * x0 + fw.y * y0;
    cl.collide = (P, Q, n, W, contact) => {
      for (let i = 0; i < n; i++) {
        if (W[i] === 0) continue;
        const k = i * 3, j = Math.floor(i / NXt), x = P[k], y = P[k + 1], z = P[k + 2];
        if (up.x * (x - x0) + up.y * (y - y0) > top(z) + 0.01) continue;
        const d = fw.x * x + fw.y * y - d0;
        if (j < jf && d < 0.022) { const e = 0.022 - d; P[k] += fw.x * e; P[k + 1] += fw.y * e; contact(i, fw.x, fw.y, 0, e, 0.6); }
        if (j > jf + 1 && d > -0.045) { const e = d + 0.045; P[k] -= fw.x * e; P[k + 1] -= fw.y * e; contact(i, -fw.x, -fw.y, 0, e, 0.6); }
      }
    };
    for (const zs of [-1, 1]) cl.colliders.push({ type: 'capsule', a: [xBack, yArm + 0.012, zs * 0.335], b: [0.43, yArm + 0.012, zs * 0.335], r: 0.075 });
    const ground = { type: 'plane', n: [0, 1, 0], d: 0.02 }; cl.colliders.push(ground);
    const m = mesh(cl.geometry(0), Mats.lit({ map: tex, side: T.DoubleSide, roughness: 0.97 }));
    const c = new T.Vector3(x0 - 0.2, 0.75, 0); m.geometry.boundingSphere = new T.Sphere(c.clone(), 0.9); ch.add(m);
    refs.fabric.push({ cl, mesh: m, frame: ch, gust: 0.8, r: 0.9, c, ground }); refs.chairProps[1].push(m);
  }
  /* split firewood stacked by the fire (models/camp/firewood.js) */
  function woodpile(root, refs) {
    const W = { x: 8.35, z: -5.15, rot: 0.6 }, g = grp(W.x, 0, W.z, W.rot); root.add(g);
    g.add(Models.make('camp/woodpile'));
    refs.dyn.push({ o: g, kind: 'slide', half: 0.25, tip: 0.5 }); refs.woodpile = g;
  }

  function shoreBits(root, refs) {
    /* the driftwood log by the fire (models/beach/driftwood.js), sat on: its root end away from the fire's side */
    const D = Layout.driftwood, dwg = grp(D.x, 0, D.z, D.rot); root.add(dwg);
    dwg.add(Models.make('beach/driftwood', { len: D.len, seed: 5 }));
    dwg.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    refs.dyn.push({ o: dwg, kind: 'slide', half: 1.2, tip: 0.0, heavy: true }); refs.driftwood = dwg;
    /* the message in a bottle (models/beach/bottle.js), lying on the sand a little sunk into it, half as big again as
       life so it can be seen from the camp; uncork.js picks it up and opens it */
    const B = Layout.bottle, bg = grp(B.x, 0.046, B.z, B.rot); bg.scale.setScalar(1.6); bg.rotation.z = 0.06; root.add(bg);
    const bm = Models.make('beach/bottle'); bg.add(bm);
    refs.bottle = bg; refs.bottleModel = bm; refs.cork = bm.userData.cork; refs.letterProp = bm.userData.letter;
    refs.dyn.push({ o: bg, kind: 'float', half: 0.1, tip: 0.0, seaward: true });
    /* a sand castle built by the camp (models/beach/sandcastle.js), its gate toward the camp, a bucket and a spade left
       lying beside it. A swell that runs up over it washes it away (shacks.js, which has it as one of the coast's
       castles); the bucket floats off and the spade is knocked flat, as the camp's other things are */
    const SC = Layout.castle, cg = grp(SC.x, 0, SC.z, SC.rot); root.add(cg);
    const cp = { x: SC.x, z: SC.z, rot: SC.rot, seed: SC.seed, wear: 0.1, toys: true, toyAng: 4.02, flag: 'leaf' };
    const cm = Models.make('beach/sandcastle', cp), cbody = new T.Group(), toys = cm.userData.toys;
    for (const c of [...cm.children]) (toys.includes(c) ? cg : cbody).add(c);
    cg.add(cbody);
    for (const o of toys) refs.dyn.push(o.userData.toy === 'bucket' ? { o, kind: 'float', half: 0.09, tip: 0.6 } : { o, kind: 'tip', half: 0.06, tip: 1.05 });
    refs.castle = { p: cp, g: cg, body: cbody, sand: cm.userData.sand, r: cm.userData.base }; SC.radius = cm.userData.radius;
  }

  /* ── the wish board: a corkboard between two driftwood posts under a little plank roof, to the right of the fire.
     Its face is a canvas the page paints with the visitors' wishes, pinned up as paper notes; a small lamp hangs
     under the eave so they can still be read after dark ── */
  function wishBoard(root, refs) {
    const B = Layout.board, g = grp(B.x, 0, B.z, B.rot); root.add(g); g.userData.pick = 'board';
    const W = 1.5, H = 0.94, Y = 1.24, PX = W / 2 + 0.085, RY = 2.055, SL = 0.36, RUN = 0.42;   /* cork size and centre; posts; ridge, pitch and reach of the roof */
    const dw = Mats.lit({ map: Mats.tex(Paint.driftwood(), { repeat: true }), roughness: 0.95 });
    for (const x of [-PX, PX]) g.add(at(mesh(new T.BoxGeometry(0.09, 2.04, 0.09), dw), x, 1.02, 0));
    g.add(at(mesh(new T.BoxGeometry(2 * PX + 0.16, 0.07, 0.08), dw), 0, 1.99, 0));                 /* the lintel the roof rests on */
    /* the cork: its face is the painted canvas, its edges and back plain cork, in a dark wooden frame */
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = Math.round(1600 * H / W);
    const tex = Mats.tex(cv, { aniso: 8 }), face = Mats.lit({ map: tex, emissive: new T.Color(1, 1, 1), emissiveMap: tex, emissiveIntensity: 0, roughness: 0.92 });
    const cork = L('#9c7148', { roughness: 0.95 }), frameM = L('#5e4430', { roughness: 0.8 });
    g.add(at(mesh(new T.BoxGeometry(W, H, 0.03), [cork, cork, cork, cork, face, cork]), 0, Y, 0));
    for (const s of [-1, 1]) {
      g.add(at(mesh(new T.BoxGeometry(W + 0.12, 0.06, 0.045), frameM), 0, Y + s * (H / 2 + 0.03), 0.004));
      g.add(at(mesh(new T.BoxGeometry(0.06, H, 0.045), frameM), s * (W / 2 + 0.03), Y, 0.004));
    }
    /* the roof: two plank slopes meeting over the lintel, reaching out front and back to keep the rain off */
    const roofM = Mats.lit({ map: Mats.tex(Paint.wood(83, ['#5a4535', '#4e3b2c', '#634c39', '#553f30'], 6), { repeat: true }), roughness: 0.9 });
    for (const s of [-1, 1]) { const r = mesh(new T.BoxGeometry(2 * PX + 0.36, 0.028, RUN / Math.cos(SL) + 0.03), roofM); r.rotation.x = s * SL; at(r, 0, RY - RUN / 2 * Math.tan(SL), s * RUN / 2); g.add(r); }
    { const ridge = mesh(new T.CylinderGeometry(0.022, 0.022, 2 * PX + 0.38, 8), roofM); ridge.rotation.z = Math.PI / 2; at(ridge, 0, RY + 0.012, 0); g.add(ridge); }
    /* a small lamp on a wire under the front eave */
    const iron = L('#26201c', { roughness: 0.55, metalness: 0.4 }), lamp = glow(1.0, 0.55, 0.22), ly = 1.8, lz = 0.27;
    g.add(at(mesh(new T.CylinderGeometry(0.003, 0.003, 0.1, 4), iron, false), 0, ly + 0.11, lz));
    g.add(at(mesh(new T.ConeGeometry(0.05, 0.04, 6), iron), 0, ly + 0.065, lz));
    g.add(at(mesh(new T.CylinderGeometry(0.032, 0.036, 0.085, 6), lamp, false), 0, ly, lz));
    g.add(at(mesh(new T.CylinderGeometry(0.042, 0.042, 0.012, 6), iron), 0, ly - 0.048, lz));
    /* a ledge under the notes: a pad of blank ones, a pencil, a tin of pins */
    const ty = Y - H / 2 - 0.06;
    g.add(at(mesh(new T.BoxGeometry(W + 0.06, 0.022, 0.1), frameM), 0, ty - 0.011, 0.05));
    { const pad = mesh(new T.BoxGeometry(0.11, 0.014, 0.075), L('#f1e6c4', { roughness: 0.9 })); pad.rotation.y = 0.08; at(pad, -0.52, ty + 0.007, 0.058); g.add(pad);
      const pen = mesh(new T.CylinderGeometry(0.0055, 0.0055, 0.16, 6), L('#d9a630', { roughness: 0.6 })); pen.rotation.set(0, 0.25, Math.PI / 2); at(pen, 0.42, ty + 0.0055, 0.066); g.add(pen);
      g.add(at(mesh(new T.CylinderGeometry(0.028, 0.028, 0.02, 14), new T.MeshStandardMaterial({ color: C('#9aa3ab'), roughness: 0.3, metalness: 0.85 })), -0.3, ty + 0.01, 0.055)); }
    refs.board = { group: g, W, H, Y,
      paint(fn) { fn(cv); tex.needsUpdate = true; },
      /* k: how brightly the paper reads (it carries a little light of its own, like the books); the lamp's glow */
      light(k, lampK, amb) { face.emissiveIntensity = k; lamp.color.setRGB(1.0 * lampK + amb[0] * 0.5, 0.55 * lampK + amb[1] * 0.5, 0.22 * lampK + amb[2] * 0.5); } };
    refs.board.paint(c => Paint.wishBoard(c, [], {}));
    refs.dyn.push({ o: g, kind: 'tip', half: 0.3, tip: 1.3 });
  }

  /* ── a small table between the chairs by the fire (models/camp/sidetable.js): the valve radio at one end (models/camp/
     radio.js), the journal at the other, its page tops toward the fire so it is read from the camp's side, and the
     guitar leaning against the far end (models/camp/guitar.js), out of the way of whoever sits in the chairs ── */
  function sideTable(root, refs) {
    const K = Layout.crate, tg = grp(K.x, 0, K.z, K.rot); root.add(tg);
    const tb = Models.make('camp/sidetable'); tg.add(tb); const top = tb.userData.top;
    const g = Models.make('camp/radio'); g.position.set(-0.22, top, -0.09); g.rotation.y = Math.PI + 0.42; tg.add(g); g.userData.pick = 'radio';   /* (its face, its dial and knobs, toward the fire, the log and the first chair) */
    refs.radio = { group: g, set: g.userData.set };
    const jg = grp(0.08, top + 0.0031, 0.095, -0.06); tg.add(jg);
    refs.journal = Book.build(jg, { W: 0.17, H: 0.24, cloth: '#4a2a18', ribbon: '#a3262a', T: 0.014 }); refs.journalGroup = jg;
    /* the guitar: its back against the radio's end of the table, its foot on the sand a hand's breadth out, tilted 15
       degrees so the table's edge meets it just below the neck, turned a little toward the camp (resting on one end of
       the edge) */
    { const a = 0.26, b = 0.18, L2 = tb.userData.L / 2, gt = Models.make('camp/guitar'), pv = grp(-L2, 0, -0.02, Math.PI - b); tg.add(pv);
      gt.quaternion.setFromAxisAngle(new T.Vector3(0, 0, 1), a).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2));
      gt.position.set(0.112 + 0.145 * Math.tan(b), 0.252 * Math.cos(a), 0); pv.add(gt);
      tg.updateMatrixWorld(true); gt.position.y -= new T.Box3().setFromObject(gt).min.y - tg.position.y;
      refs.guitar = gt; }
    refs.dyn.push({ o: tg, kind: 'tip', half: 0.3, tip: 1.2 }); refs.crate = tg;
  }

  /* string-light pools, top-down, sqrt-encoded (R channel) */
  function poolMap(bulbs) {
    const rect = { x: -7.5, z: -8.5, w: 17, d: 10.5 }, res = 14;
    const w = Math.round(rect.w * res), h = Math.round(rect.d * res), acc = new Float32Array(w * h);
    for (const b of bulbs) {
      const hh = b.p.y;
      for (let j = 0; j < h; j++) { const z = rect.z + (j + 0.5) / res, dz = z - b.p.z;
        for (let i = 0; i < w; i++) { const x = rect.x + (i + 0.5) / res, dx = x - b.p.x; acc[j * w + i] += hh / Math.pow(dx * dx + dz * dz + hh * hh, 1.5); } }
    }
    let mx = 0; for (const v of acc) mx = Math.max(mx, v);
    const out = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { out[i * 4] = Math.sqrt(acc[i] / mx) * 255; out[i * 4 + 3] = 255; }
    return { rect, tex: Mats.dataTex(out, w, h, { mip: false }) };
  }

  function build(root, U) {
    const refs = { candles: [], lanterns: [], dyn: [], vanHead: [], vanTail: [], vanWheels: [], fabric: [] };
    picnic(root, refs); lanterns(root, refs); stringLights(root, refs, U); van(root, refs, U); campfire(root, refs); chairs(root, refs); woodpile(root, refs); shoreBits(root, refs);
    wishBoard(root, refs); sideTable(root, refs);
    /* what a click in the scene can land on: the chairs, the driftwood and the cushions at the table (all seats), the
       radio, the wish board */
    if (refs.driftwood) refs.driftwood.userData.pick = 'log0';
    if (refs.cushions) { if (refs.cushions[1]) refs.cushions[1].userData.pick = 'rug0'; if (refs.cushions[0]) refs.cushions[0].userData.pick = 'rug1'; }
    refs.pick = [...refs.chairs, refs.radio.group, refs.board.group, refs.driftwood, ...(refs.cushions || []).slice(0, 2), refs.sketch, refs.toolbox].filter(Boolean);
    refs.pool = poolMap(refs.bulbs);
    return refs;
  }

  /* each frame, the camp's cloth moves on: every piece in its own frame (the awning, the chair), under the world's
     gravity and the breeze, both turned into that frame. wind: 1 on a calm night, up to about 3 in a storm. Cloth that
     is hidden (the awning packed away), far off or out of view is left as it is. */
  const _q = new T.Quaternion(), _v = new T.Vector3(), _m = new T.Matrix4(), _fr = new T.Frustum(), _s = new T.Sphere();
  function flutter(refs, dt, wind, cam) {
    _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_m);
    for (const F of refs.fabric) {
      F.live = false;
      let vis = true; for (let o = F.mesh; o && vis; o = o.parent) vis = o.visible;
      if (!vis) continue;
      F.frame.getWorldQuaternion(_q);                      /* (this brings the frame's world matrix up to date too) */
      _s.center.copy(F.c).applyMatrix4(F.frame.matrixWorld); _s.radius = F.r;
      if (_s.center.distanceToSquared(cam.position) > 70 * 70 || !_fr.intersectsSphere(_s)) continue;
      const cl = F.cl; _q.invert();
      _v.set(0, -9.81, 0).applyQuaternion(_q); cl.g[0] = _v.x; cl.g[1] = _v.y; cl.g[2] = _v.z;
      _v.set(Layout.wind[0], 0, Layout.wind[1]).normalize().applyQuaternion(_q); cl.wind.dir[0] = _v.x; cl.wind.dir[1] = _v.y; cl.wind.dir[2] = _v.z;
      /* a breeze of a couple of metres a second that gusts; a storm blows harder and gustier */
      cl.wind.speed = 1.7 * wind * F.gust; cl.wind.gust = Math.min(0.85, 0.5 + 0.12 * (wind - 1));
      if (F.ground) {
        /* the sand, in the chair's frame: world up turned in, at the height the chair stands */
        _v.set(0, 1, 0).applyQuaternion(_q); F.ground.n[0] = _v.x; F.ground.n[1] = _v.y; F.ground.n[2] = _v.z;
        F.ground.d = 0.02 - F.frame.matrixWorld.elements[13];
      }
      cl.update(dt); cl.write(); if (F.after) F.after();
      F.live = true;
    }
  }
  return { build, flutter, extrude, rshape };
})();
