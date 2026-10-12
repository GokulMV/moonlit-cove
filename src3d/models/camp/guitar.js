/* ─────────────────────────────────────────────────────────────
   models/camp/guitar.js — a steel-string acoustic, a dreadnought:
   a waisted body (40 cm across the lower bout, 29 cm the upper, a
   10.5 cm deep box), a spruce top with its grain, a rosette round
   the sound hole, a tortoiseshell pickguard and cream binding; a
   rosewood bridge with a bone saddle and six pins; a mahogany neck
   with a rosewood fretboard, twenty frets at their true spacing
   (645 mm scale), pearl dots, a bone nut; a headstock angled back,
   three tuners a side; six strings from the saddle over the nut to
   the posts.
   Built standing up: the neck along +y, the top facing +z, the
   middle of the body at the origin; it is 1.03 m tall.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, canvas, rng } = Models;
  const D = 0.105, ZT = D / 2;                  /* depth of the box; the top's plane */
  const SCALE = 0.645, NUT = 0.616, SADDLE = NUT - SCALE, HOLE = { y: 0.108, r: 0.05 };
  /* the outline's right half, from the tail up to the neck */
  const HALF = [[0, -0.252], [0.075, -0.247], [0.135, -0.228], [0.178, -0.19], [0.198, -0.135], [0.2, -0.085], [0.192, -0.035], [0.17, 0.008], [0.143, 0.042],
    [0.136, 0.07], [0.141, 0.105], [0.148, 0.15], [0.146, 0.19], [0.132, 0.223], [0.1, 0.247], [0.05, 0.257], [0, 0.259]];
  function outline(n) {
    const pts = HALF.map(([x, y]) => new T.Vector2(x, y)), full = [...pts, ...pts.slice(1, -1).reverse().map(p => new T.Vector2(-p.x, p.y))];
    const c = new T.SplineCurve([...full, full[0]]); return c.getSpacedPoints(n).slice(0, -1);
  }
  /* the top: spruce grain, purfling, the rosette and the dark of the sound hole, the pickguard */
  function topTexture(P) {
    const W = 0.42, H = 0.53, x0 = -0.21, y0 = -0.262, S = 1200, c = canvas(Math.round(W * S), Math.round(H * S)), a = c.getContext('2d'), r = rng(41);
    const X = x => (x - x0) * S, Y = y => c.height - (y - y0) * S;
    a.fillStyle = '#d8b27a'; a.fillRect(0, 0, c.width, c.height);
    /* grain: fine straight lines along the length, a little darker at the edges of the bookmatched halves */
    for (let x = 0; x < c.width; x += 1 + r() * 3) { a.fillStyle = `rgba(${120 + r() * 30},${80 + r() * 20},${40},${0.05 + r() * 0.14})`; a.fillRect(x, 0, 0.6 + r() * 1.4, c.height); }
    for (let i = 0; i < 40; i++) { a.fillStyle = `rgba(255,240,210,${0.03 + r() * 0.05})`; a.fillRect(r() * c.width, r() * c.height, 30 + r() * 120, 2 + r() * 3); }   /* silk: the cross-grain shimmer */
    const g = a.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, 'rgba(120,70,30,0.25)'); g.addColorStop(0.18, 'rgba(120,70,30,0)'); g.addColorStop(0.82, 'rgba(120,70,30,0)'); g.addColorStop(1, 'rgba(120,70,30,0.25)');
    a.fillStyle = g; a.fillRect(0, 0, c.width, c.height);
    /* purfling: a fine black and white line inside the binding */
    /* (the outline runs anticlockwise, so its inward side is to the left of the way it goes) */
    const path = inset => { a.beginPath(); const n = P.length; P.forEach((p, i) => { const q = P[(i + 1) % n], o = P[(i + n - 1) % n], tx = q.x - o.x, ty = q.y - o.y, l = Math.hypot(tx, ty) || 1;
      (i ? a.lineTo : a.moveTo).call(a, X(p.x - ty / l * inset), Y(p.y + tx / l * inset)); }); a.closePath(); };
    a.lineWidth = 2.2; a.strokeStyle = '#1b120c'; path(0.007); a.stroke(); a.lineWidth = 1.1; a.strokeStyle = '#efe4c8'; path(0.0095); a.stroke();
    /* the rosette: rings of black, cream and a band of abalone */
    const hx = X(0), hy = Y(HOLE.y), R = HOLE.r * S;
    [[1.42, 1.5, '#1d140e'], [1.34, 1.42, '#efe4c8'], [1.16, 1.34, null], [1.1, 1.16, '#efe4c8'], [1.05, 1.1, '#1d140e']].forEach(([r0, r1, col]) => {
      if (col) { a.beginPath(); a.arc(hx, hy, R * r1, 0, Math.PI * 2); a.arc(hx, hy, R * r0, 0, Math.PI * 2, true); a.fillStyle = col; a.fill(); return; }
      for (let k = 0; k < 90; k++) { const a0 = k / 90 * Math.PI * 2, a1 = a0 + Math.PI * 2 / 90 + 0.002, h = 160 + 60 * Math.sin(k * 0.7) + 30 * r();
        a.beginPath(); a.arc(hx, hy, R * r1, a0, a1); a.arc(hx, hy, R * r0, a1, a0, true); a.fillStyle = `hsl(${h},${45 + r() * 25}%,${48 + r() * 22}%)`; a.fill(); }
    });
    /* the sound hole: dark, the inside of the box just showing round its edge */
    const sg = a.createRadialGradient(hx, hy + R * 0.25, R * 0.2, hx, hy, R); sg.addColorStop(0, '#050302'); sg.addColorStop(0.82, '#0d0805'); sg.addColorStop(1, '#3a2614');
    a.beginPath(); a.arc(hx, hy, R, 0, Math.PI * 2); a.fillStyle = sg; a.fill();
    /* pickguard: a teardrop below and to the right of the hole, tortoiseshell */
    a.save(); a.translate(X(0.062), Y(0.05)); a.rotate(-0.35);
    a.beginPath(); a.moveTo(0, -0.085 * S); a.bezierCurveTo(0.06 * S, -0.06 * S, 0.06 * S, 0.05 * S, 0, 0.07 * S); a.bezierCurveTo(-0.045 * S, 0.06 * S, -0.03 * S, -0.02 * S, 0, -0.085 * S); a.closePath();
    a.clip(); a.fillStyle = '#3a1a0c'; a.fillRect(-0.1 * S, -0.1 * S, 0.2 * S, 0.2 * S);
    for (let i = 0; i < 60; i++) { a.fillStyle = `rgba(${150 + r() * 70},${70 + r() * 40},${20},${0.15 + r() * 0.3})`; a.beginPath(); a.ellipse((r() - 0.5) * 0.12 * S, (r() - 0.5) * 0.17 * S, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, Math.PI * 2); a.fill(); }
    a.restore();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    t.repeat.set(1 / W, 1 / H); t.offset.set(-x0 / W, -y0 / H);
    return t;
  }
  /* mahogany for the back, sides and neck: deep red-brown with a ribbon figure */
  function mahogany(seed) {
    const c = canvas(256, 512), a = c.getContext('2d'), r = rng(seed);
    a.fillStyle = '#5b2a16'; a.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 2 + r() * 4) { a.fillStyle = `rgba(${30 + r() * 30},${10 + r() * 10},${5},${0.12 + r() * 0.2})`; a.fillRect(x, 0, 1 + r() * 2, 512); }
    for (let i = 0; i < 18; i++) { const x = r() * 256, w = 10 + r() * 30; const g = a.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(160,80,40,0)'); g.addColorStop(0.5, `rgba(170,90,45,${0.1 + r() * 0.12})`); g.addColorStop(1, 'rgba(160,80,40,0)'); a.fillStyle = g; a.fillRect(x, 0, w, 512); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }

  Models.add('camp/guitar', () => {
    const g = new T.Group(), P = outline(120);
    const wood = mahogany(17), woodM = Mats.litP({ map: wood, roughness: 0.34, clearcoat: 0.45, clearcoatRoughness: 0.25 });
    const topM = Mats.litP({ map: topTexture(P), roughness: 0.34, clearcoat: 0.45, clearcoatRoughness: 0.22 });
    const rosewood = Mats.lit({ color: new T.Color('#2a170e'), roughness: 0.5 }), bone = Mats.lit({ color: new T.Color('#ece3cc'), roughness: 0.38 });
    const metal = Mats.lit({ color: new T.Color('#d9d5cc'), roughness: 0.22, metalness: 0.95 }), cream = Mats.lit({ color: new T.Color('#eee4cb'), roughness: 0.62 });
    /* the box: back and sides in one, the top laid on it, the binding round both edges */
    const shape = new T.Shape(P);
    const box = new T.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 1 }); box.translate(0, 0, -ZT);
    { const uv = box.attributes.uv, p = box.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 2.2 + 0.5, p.getY(i) * 1.6 + 0.5); }
    const body = mesh(box, [woodM, woodM]); g.add(body);
    const top = mesh(new T.ShapeGeometry(shape, 1), topM, false, true); top.position.z = ZT + 0.0004; g.add(top);
    const ring = z => { const c = new T.CatmullRomCurve3(P.map(p => new T.Vector3(p.x, p.y, z)), true); return mesh(new T.TubeGeometry(c, 160, 0.0032, 6, true), cream, false, false); };
    g.add(ring(ZT - 0.001), ring(-ZT + 0.001));
    /* the bridge, its saddle and pins */
    const br = new T.Shape(); { const w = 0.078, h = 0.016, rr = 0.006; br.moveTo(-w + rr, -h); br.lineTo(w - rr, -h); br.quadraticCurveTo(w, -h, w, -h + rr); br.lineTo(w, h - rr); br.quadraticCurveTo(w, h, w - rr, h);
      br.lineTo(-w + rr, h); br.quadraticCurveTo(-w, h, -w, h - rr); br.lineTo(-w, -h + rr); br.quadraticCurveTo(-w, -h, -w + rr, -h); }
    const bridge = mesh(new T.ExtrudeGeometry(br, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 4 }), rosewood);
    at(bridge, 0, SADDLE - 0.006, ZT); g.add(bridge);
    g.add(at(mesh(new T.BoxGeometry(0.074, 0.0028, 0.004), bone), 0, SADDLE, ZT + 0.0105));
    for (let i = 0; i < 6; i++) { const pin = mesh(new T.CylinderGeometry(0.0026, 0.0022, 0.004, 10), bone, false); pin.rotation.x = Math.PI / 2; at(pin, (i - 2.5) * 0.0105, SADDLE - 0.012, ZT + 0.011); g.add(pin); }
    /* the neck: a D-shaped section that slims toward the nut, and the heel where it meets the body */
    const y0 = 0.236, y1 = NUT, wOf = y => 0.057 + (0.0445 - 0.057) * (y - y0) / (y1 - y0), dOf = y => 0.022 - 0.003 * (y - y0) / (y1 - y0);
    { const NJ = 14, NA = 12, pos = [], uv = [], idx = [];
      for (let j = 0; j <= NJ; j++) { const y = y0 + (y1 - y0) * j / NJ, w = wOf(y) / 2, d = dOf(y);
        for (let k = 0; k <= NA; k++) { const a = Math.PI * k / NA; pos.push(Math.cos(a) * w, y, ZT - Math.sin(a) * d); uv.push(k / NA, y * 3); } }
      for (let j = 0; j < NJ; j++) for (let k = 0; k < NA; k++) { const i0 = j * (NA + 1) + k, i1 = i0 + NA + 1; idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1); }
      const ng = new T.BufferGeometry(); ng.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ng.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); ng.setIndex(idx); ng.computeVertexNormals();
      g.add(mesh(ng, Mats.lit({ map: wood, roughness: 0.42 }))); }
    const heel = mesh(new T.CylinderGeometry(0.026, 0.03, D - 0.02, 14, 1), woodM); heel.rotation.x = Math.PI / 2; heel.scale.set(1, 1, 1); at(heel, 0, 0.262, -0.008); g.add(heel);
    /* the fretboard, frets at their true spacing, dots, the nut */
    const fbEnd = 0.162, fbT = 0.0058, fw = y => wOf(Math.max(y0, y)) + 0.0015;
    { const fbG = new T.BufferGeometry(), a = fw(fbEnd) / 2, b = fw(NUT) / 2, z0 = ZT, z1 = ZT + fbT;
      const v = [[-a, fbEnd, z1], [a, fbEnd, z1], [b, NUT, z1], [-b, NUT, z1], [-a, fbEnd, z0], [a, fbEnd, z0], [b, NUT, z0], [-b, NUT, z0]];
      const quads = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]], pos = [], idx = [];
      quads.forEach((q, i) => { q.forEach(k => pos.push(...v[k])); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
      fbG.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); fbG.setIndex(idx); fbG.computeVertexNormals();
      g.add(mesh(fbG, rosewood)); }
    const fretY = n => NUT - SCALE * (1 - Math.pow(2, -n / 12));
    for (let n = 1; n <= 20; n++) { const y = fretY(n); if (y < fbEnd + 0.003) break; const f = mesh(new T.CylinderGeometry(0.0011, 0.0011, fw(y) - 0.001, 5), metal, false); f.rotation.z = Math.PI / 2; at(f, 0, y, ZT + fbT + 0.0004); g.add(f); }
    const dot = new T.CylinderGeometry(0.0028, 0.0028, 0.0008, 12);
    for (const n of [3, 5, 7, 9, 12, 15, 17]) { const y = (fretY(n - 1) + fretY(n)) / 2;
      for (const x of n === 12 ? [-0.011, 0.011] : [0]) { const d = mesh(dot, cream, false); d.rotation.x = Math.PI / 2; at(d, x, y, ZT + fbT + 0.0002); g.add(d); } }
    g.add(at(mesh(new T.BoxGeometry(fw(NUT), 0.005, 0.0045), bone), 0, NUT + 0.0025, ZT + fbT + 0.0018));
    /* the headstock, angled back at the nut, its face veneered black, three tuners a side */
    const hs = new T.Group(); at(hs, 0, NUT + 0.005, ZT - 0.003); hs.rotation.x = -0.23; g.add(hs);
    { const s = new T.Shape(); s.moveTo(-0.037, 0); s.lineTo(0.037, 0); s.lineTo(0.041, 0.175); s.quadraticCurveTo(0, 0.19, -0.041, 0.175); s.closePath();
      const hg = new T.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 }); hg.translate(0, 0, -0.015);
      hs.add(mesh(hg, [Mats.lit({ color: new T.Color('#120b07'), roughness: 0.3 }), Mats.lit({ map: wood, roughness: 0.4 })])); }
    const posts = [];
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1, k = i % 3, y = 0.045 + k * 0.045, x = side * 0.021;
      hs.add(at(mesh(new T.CylinderGeometry(0.0032, 0.0035, 0.012, 8), metal, false), x, y, 0.006)).children.at(-1).rotation.x = Math.PI / 2;
      const shaft = mesh(new T.CylinderGeometry(0.0022, 0.0022, 0.016, 6), metal, false); shaft.rotation.z = Math.PI / 2; at(shaft, side * 0.046, y, -0.008); hs.add(shaft);
      const knob = mesh(new T.CylinderGeometry(0.009, 0.009, 0.004, 14), metal, false); knob.rotation.z = Math.PI / 2; knob.scale.set(1, 1, 0.62); at(knob, side * 0.058, y, -0.008); hs.add(knob);
      posts.push(new T.Vector3(x, y, 0.011));
    }
    /* end pin and strap button */
    g.add(at(mesh(new T.CylinderGeometry(0.004, 0.005, 0.008, 10), bone, false), 0, -0.256, 0));
    /* the strings: saddle, over the nut, to their posts (the heavier four wound bronze, the top two plain steel), lit like
       the metal they are */
    g.updateMatrixWorld(true);
    const nutZ = ZT + fbT + 0.0042, bronzeM = Mats.lit({ color: new T.Color('#b48c57'), roughness: 0.35, metalness: 0.9 }), steelM = Mats.lit({ color: new T.Color('#d6d6d0'), roughness: 0.25, metalness: 0.95 });
    const wire = (a, b, r, m) => { const d = b.clone().sub(a), w = mesh(new T.CylinderGeometry(r, r, d.length(), 4, 1), m, false, false); w.position.copy(a).add(b).multiplyScalar(0.5); w.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(w); };
    for (let i = 0; i < 6; i++) {
      /* low E, A and D to the bass side's posts from the nut up; G, B and high E to the treble side's from the top down */
      const s = new T.Vector3((i - 2.5) * 0.0105, SADDLE, ZT + 0.0122), n = new T.Vector3((i - 2.5) * 0.0071, NUT + 0.0025, nutZ), p = posts[i < 3 ? i : 8 - i].clone().applyMatrix4(hs.matrix);
      const r = [0.00068, 0.00056, 0.00045, 0.00036, 0.00026, 0.00021][i], m = i < 4 ? bronzeM : steelM;
      wire(s, n, r, m); wire(n, p, r, m);
    }
    g.userData.size = { height: 0.19 + NUT + 0.252, bottom: -0.256 };
    return g;
  });
})();
