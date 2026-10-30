'use strict'

// ---- FFF: height (Z) of every layer of a job (moved from the Workbench, src/_zones/60-fff-layers.js, 2026-10-21) ----
//
// The plan of jobs.preview (WorkshopService, dsf/gcode_plan.py) gives every run the index of its layer ("c") but not
// its height. The service starts a new layer when an EXTRUDING move reaches a Z higher than the layer before by more
// than 0.01 mm; this file repeats exactly that rule over the text of the file to learn the Z of each layer, so the
// layer count is the same as the service's (test/fff-layers.test.js checks it against a fixture).
//
// Pure code (no DOM, no network): the text is read in slices by the caller so the screen of the Pi is never frozen.
// What it follows, like the service: G0-G3 (Z word), G90/G91, G20/G21, G53, M82/M83, G92 E. Like the service it
// ignores G92 on the axes. The Z is the one WRITTEN in the file (job coordinates; the zone offsets of the machine
// are not added), and a relative move needs a start height: opc.z0 (default 0).
export var TZ_FFF_LAYER_TOL = 0.01; // mm: same tolerance as the service
export var TZ_FFF_WORD = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;

export function tzFffLayersNew(opc) {
  return {
    rel: false, // G91
    relE: false, // M83
    mm: 1, // G20 = 25.4
    eAbs: 0,
    z: (opc && isFinite(opc.z0) ? opc.z0 : 0),
    zLayer: null,
    layer: 0,
    layerZ: [null], // capaZ[c] = Z where layer c starts (0 = before the first extrusion)
    lines: 0,
  };
}

// one line of G-code (already without the end of line)
export function tzFffLayersLine(s, line) {
  var k = line.indexOf(";");
  if (k >= 0) line = line.slice(0, k);
  if (line.indexOf("(") >= 0 && !/^\s*m/i.test(line)) line = line.split("(")[0];
  if (!line.trim()) return;
  var gs = [], ms = [], d = {}, m;
  TZ_FFF_WORD.lastIndex = 0;
  while ((m = TZ_FFF_WORD.exec(line))) {
    var L = m[1].toUpperCase(), v = parseFloat(m[2]);
    if (!isFinite(v)) continue;
    if (L === "G") gs.push(v);
    else if (L === "M") ms.push(v);
    else d[L] = v;
  }
  if (!gs.length && !ms.length && d.Z === undefined && d.E === undefined) return;
  var mov = null, g53 = false, g92 = false, i;
  for (i = 0; i < gs.length; i++) {
    var gi = Math.round(gs[i] * 10) / 10;
    if (gi === 0 || gi === 1 || gi === 2 || gi === 3) mov = gi;
    else if (gi === 90) s.rel = false;
    else if (gi === 91) s.rel = true;
    else if (gi === 20) s.mm = 25.4;
    else if (gi === 21) s.mm = 1;
    else if (gi === 53) g53 = true;
    else if (gi === 92) {
      g92 = true;
      if (d.E !== undefined) s.eAbs = d.E;
    }
  }
  for (i = 0; i < ms.length; i++) {
    var mi = Math.trunc(ms[i]);
    if (mi === 82) s.relE = false;
    else if (mi === 83) s.relE = true;
  }
  if (ms.length || g92) return; // the service does not plan lines with M words or G92
  if (mov === null) return;
  var z = s.z;
  if (d.Z !== undefined) {
    var val = d.Z * s.mm;
    z = s.rel ? s.z + val : val; // G53 and the user coordinates are the same here (no offsets known)
    if (g53) z = val;
  }
  var extrudes = false;
  if (d.E !== undefined) {
    if (s.relE) extrudes = d.E > 0.0001;
    else {
      extrudes = d.E - s.eAbs > 0.0001;
      s.eAbs = d.E;
    }
  }
  if (extrudes && (s.zLayer === null || z > s.zLayer + TZ_FFF_LAYER_TOL)) {
    s.layer++;
    s.zLayer = z;
    s.layerZ[s.layer] = z;
  }
  s.z = z;
}

// Reads up to `maxLineas` lines of `texto` from the character `desde`; returns the character where it stopped
// (texto.length when it is over). Call again with the returned value to go on.
export function tzFffLayersPiece(s, text, since, maxLines) {
  var i = since, n = text.length, done = 0;
  while (i < n && done < maxLines) {
    var f = text.indexOf("\n", i);
    if (f < 0) f = n;
    var end = f > i && text.charCodeAt(f - 1) === 13 ? f - 1 : f;
    if (end > i) tzFffLayersLine(s, text.slice(i, end));
    i = f + 1;
    done++;
  }
  s.lines += done;
  return Math.min(i, n);
}

// the result of a state that has read the whole file
export function tzFffLayersResult(s) {
  var layerZ = s.layerZ.slice();
  layerZ[0] = layerZ.length > 1 ? layerZ[1] : s.z; // before the first layer: the height of the first one
  var zMin = null, zMax = null;
  for (var c = 1; c < layerZ.length; c++) {
    if (zMin === null || layerZ[c] < zMin) zMin = layerZ[c];
    if (zMax === null || layerZ[c] > zMax) zMax = layerZ[c];
  }
  return { layers: s.layer, layerZ: layerZ, zMin: zMin, zMax: zMax, lines: s.lines };
}

// whole text in one go (tests and small files)
export function tzFffLayersZ(text, opc) {
  var s = tzFffLayersNew(opc);
  tzFffLayersPiece(s, text, 0, Infinity);
  return tzFffLayersResult(s);
}

// When the file is too big to be read here: the layers are spread evenly between the lowest and the highest Z that
// the service reports for the extruding moves (stats.z_min / z_max). Uneven layer heights are lost; says so (uniforme).
export function tzFffLayersUniform(layers, zMin, zMax) {
  var layerZ = [], n = Math.max(0, Math.round(layers || 0));
  var a = isFinite(zMin) ? zMin : 0, b = isFinite(zMax) ? zMax : a;
  for (var c = 0; c <= n; c++) layerZ.push(n > 1 ? a + ((b - a) * (Math.max(1, c) - 1)) / (n - 1) : a);
  return { layers: n, layerZ: layerZ, zMin: a, zMax: b, uniform: true };
}

// Z of every run of the plan: the plan's own "z" when the service sends it, else the one of its layer (null = unknown)
export function tzFffSegmentsZ(plan, layerZ) {
  var out = [], cap = layerZ ? layerZ.length - 1 : -1;
  (plan || []).forEach(function (r) {
    if (r && isFinite(r.z)) {
      out.push(r.z);
      return;
    }
    if (!r || cap < 0) {
      out.push(null);
      return;
    }
    var c = Math.max(0, Math.min(cap, r.c | 0));
    out.push(layerZ[c] === null || layerZ[c] === undefined ? null : layerZ[c]);
  });
  return out;
}
