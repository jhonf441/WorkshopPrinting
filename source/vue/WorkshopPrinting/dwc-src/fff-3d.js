'use strict'

// ---- FFF: 3D view without WebGL, pure part (moved from the Workbench, src/_zones/61-fff-3d.js, 2026-10-21) ----
//
// Orthographic projection of the toolpath of a 3D print, drawn by fff-3d-view.js on a 2D canvas. Here is only
// geometry on numbers (no DOM): the projection, its inverse, fitting the model in a box, the list of segments to
// draw (decimated to a budget) and a few helpers; test/fff-3d.test.js checks them.
//
// Camera: rotZ turns the model around the vertical axis (radians); rotX is the elevation of the camera: 0 looks from
// the side, PI/2 looks straight down (then the screen is the XY plane with Y up, like the map). The model never
// assumes a bed size: everything is fitted to the box of the job itself.
export var TZ_FFF3D_MAX_SEC = 20000; // most segments drawn at once (the screen of the Pi is modest)
export var TZ_FFF3D_BUCKETS = 24; // colour buckets: one stroke per bucket and per transparency, not one per layer
export var TZ_FFF3D_VIEWS = {
  iso: { rotX: 0.62, rotZ: -0.62 },
  up: { rotX: Math.PI / 2, rotZ: 0 },
  front: { rotX: 0.1, rotZ: 0 },
};

// one point (x, y, z in mm) -> {x, y (screen, y grows downwards), d (depth: bigger = farther from the camera)}
export function tzFff3dProject(p, rotX, rotZ, scale) {
  var cz = Math.cos(rotZ), sz = Math.sin(rotZ), ce = Math.cos(rotX), se = Math.sin(rotX);
  var x1 = p.x * cz - p.y * sz, y1 = p.x * sz + p.y * cz;
  return { x: x1 * scale, y: -(p.z * ce + y1 * se) * scale, d: (y1 * ce - p.z * se) * scale };
}
// the opposite: from a screen point and its depth back to the point of the model
export function tzFff3dInvert(q, rotX, rotZ, scale) {
  var cz = Math.cos(rotZ), sz = Math.sin(rotZ), ce = Math.cos(rotX), se = Math.sin(rotX);
  var x1 = q.x / scale, up = -q.y / scale, dd = q.d / scale;
  var y1 = up * se + dd * ce, z = up * ce - dd * se;
  return { x: x1 * cz + y1 * sz, y: -x1 * sz + y1 * cz, z: z };
}
// the same projection as a matrix, to project thousands of points without allocating: sx = x*ax + y*ay,
// sy = x*bx + y*by + z*bz
export function tzFff3dMatrix(rotX, rotZ, scale) {
  var cz = Math.cos(rotZ), sz = Math.sin(rotZ), ce = Math.cos(rotX), se = Math.sin(rotX);
  return { ax: scale * cz, ay: -scale * sz, bx: -scale * se * sz, by: -scale * se * cz, bz: -scale * ce };
}
// pts: Float32Array [x0,y0,z0,x1,y1,z1] per segment -> out: Float32Array [sx0,sy0,sx1,sy1] per segment
export function tzFff3dBatch(pts, n, m, ox, oy, out) {
  for (var i = 0, a = 0, b = 0; i < n; i++, a += 6, b += 4) {
    out[b] = pts[a] * m.ax + pts[a + 1] * m.ay + ox;
    out[b + 1] = pts[a] * m.bx + pts[a + 1] * m.by + pts[a + 2] * m.bz + oy;
    out[b + 2] = pts[a + 3] * m.ax + pts[a + 4] * m.ay + ox;
    out[b + 3] = pts[a + 3] * m.bx + pts[a + 4] * m.by + pts[a + 5] * m.bz + oy;
  }
  return out;
}
// scale and offset that put the box {xmin..zmax} inside w x h pixels, centred, with a margin (px). zoom >= 1 enlarges.
export function tzFff3dFit(box, rotX, rotZ, w, h, margin, zoom) {
  var xs = [box.xmin, box.xmax], ys = [box.ymin, box.ymax], zs = [box.zmin, box.zmax];
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (var i = 0; i < 2; i++)
    for (var j = 0; j < 2; j++)
      for (var k = 0; k < 2; k++) {
        var q = tzFff3dProject({ x: xs[i], y: ys[j], z: zs[k] }, rotX, rotZ, 1);
        if (q.x < x0) x0 = q.x;
        if (q.x > x1) x1 = q.x;
        if (q.y < y0) y0 = q.y;
        if (q.y > y1) y1 = q.y;
      }
  var m = margin || 0;
  var ew = Math.max(1e-6, x1 - x0), eh = Math.max(1e-6, y1 - y0);
  var scale = Math.max(1e-6, Math.min((w - 2 * m) / ew, (h - 2 * m) / eh)) * (zoom > 0 ? zoom : 1);
  return { scale: scale, ox: w / 2 - scale * ((x0 + x1) / 2), oy: h / 2 - scale * ((y0 + y1) / 2) };
}

// Segments of the printed (extruding) runs of the plan, in the order of the job. A run whose z is unknown (null) is
// drawn at 0. When there are more than `max` segments the vertices of each run are thinned out by the same step (the
// path stays connected and keeps its first and last vertex) until it fits. `zs` = tzFffSegmentsZ(plan, capaZ).
//   -> { n, pts, capa, tFin, caja, paso, total }  (n = 0 when nothing to draw)
export function tzFff3dSegments(plan, zs, max) {
  max = max > 0 ? max : TZ_FFF3D_MAX_SEC;
  var runs = [], total = 0;
  (plan || []).forEach(function (r, i) {
    if (!r || !r.w || !r.p || r.p.length < 4) return;
    runs.push({ r: r, z: zs && isFinite(zs[i]) ? zs[i] : 0 });
    total += r.p.length / 2 - 1;
  });
  // more runs than the budget (each needs at least one segment): keep one of every k runs
  if (runs.length > max) {
    var each = Math.ceil(runs.length / max);
    runs = runs.filter(function (o, i) { return i % each === 0; });
    total = 0;
    runs.forEach(function (o) { total += o.r.p.length / 2 - 1; });
  }
  function count(paso) {
    var c = 0;
    for (var i = 0; i < runs.length; i++) c += Math.ceil((runs[i].r.p.length / 2 - 1) / paso);
    return c;
  }
  var step = 1;
  if (total > max) {
    step = Math.max(2, Math.ceil(total / max));
    while (count(step) > max) step = Math.ceil(step * 1.1) + 1; // at the longest run the count is the number of runs, which fits
  }
  var n = count(step);
  var pts = new Float32Array(n * 6), layer = new Uint32Array(n), tEnd = new Float32Array(n);
  var box = { xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity, zmin: Infinity, zmax: -Infinity };
  var s = 0;
  runs.forEach(function (o) {
    var r = o.r, nv = r.p.length / 2, ix = 0, has = !!(r.t && r.t.length === nv);
    while (ix < nv - 1) {
      var jx = Math.min(nv - 1, ix + step);
      var a = s * 6;
      pts[a] = r.p[2 * ix]; pts[a + 1] = r.p[2 * ix + 1]; pts[a + 2] = o.z;
      pts[a + 3] = r.p[2 * jx]; pts[a + 4] = r.p[2 * jx + 1]; pts[a + 5] = o.z;
      layer[s] = r.c | 0;
      tEnd[s] = has ? r.t[jx] : s;
      for (var q = 0; q < 6; q += 3) {
        var x = pts[a + q], y = pts[a + q + 1];
        if (x < box.xmin) box.xmin = x;
        if (x > box.xmax) box.xmax = x;
        if (y < box.ymin) box.ymin = y;
        if (y > box.ymax) box.ymax = y;
      }
      if (o.z < box.zmin) box.zmin = o.z;
      if (o.z > box.zmax) box.zmax = o.z;
      s++;
      ix = jx;
    }
  });
  if (!n) box = { xmin: 0, xmax: 1, ymin: 0, ymax: 1, zmin: 0, zmax: 1 };
  return { n: n, pts: pts, layer: layer, tEnd: tEnd, box: box, step: step, total: total };
}

// how many segments (from the start) are done at time t: tFin does not decrease along the job (binary search)
export function tzFff3dUntil(tEnd, n, t) {
  var lo = 0, hi = n;
  while (lo < hi) {
    var mid = (lo + hi) >> 1;
    if (tEnd[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
// what to do with a layer: 0 hidden, 1 dimmed, 2 full. capaSel 0 = all layers; modo "hasta" (up to it) or "sola" (only it)
export function tzFff3dVisibility(layer, layerSel, mode) {
  if (!(layerSel > 0)) return 2;
  if (mode === "single") return layer === layerSel ? 2 : 1;
  if (layer > layerSel) return 0;
  return layer === layerSel ? 2 : 1;
}
// colour bucket of a layer (1..nCapas) and the colour of a bucket (blue at the bed, red at the top)
export function tzFff3dBucket(layer, nLayers, buckets) {
  buckets = buckets || TZ_FFF3D_BUCKETS;
  if (!(nLayers > 1)) return 0;
  return Math.max(0, Math.min(buckets - 1, Math.floor(((Math.max(1, layer) - 1) / nLayers) * buckets)));
}
export function tzFff3dColorBucket(bucket, buckets) {
  buckets = buckets || TZ_FFF3D_BUCKETS;
  return "hsl(" + Math.round(220 - (200 * bucket) / Math.max(1, buckets - 1)) + ",75%,58%)";
}
// the area the machine can reach, from the object model (X and Y limits), or null: drawn as the floor of the view
export function tzFff3dBed(om) {
  var ejes = (om && om.move && om.move.axes) || [], c = {};
  ejes.forEach(function (a) {
    if (a && (a.letter === "X" || a.letter === "Y") && isFinite(a.min) && isFinite(a.max) && a.max > a.min) c[a.letter] = a;
  });
  if (!c.X || !c.Y) return null;
  return { xmin: c.X.min, xmax: c.X.max, ymin: c.Y.min, ymax: c.Y.max };
}
