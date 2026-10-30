'use strict'

// ---- FFF: 3D view of the toolpath on a 2D canvas (moved from the Workbench, src/_zones/62-fff-3d-view*.js, 2026-10-21) ----
//
// The logic of the 3D view card (Fff3dView.vue owns the DOM: buttons, canvas, events). It is READ ONLY: nothing is sent
// to the machine. The geometry is in fff-3d.js, the height of each layer in fff-layers.js; here are the data of the job,
// the drawing and the gestures.
//
// Cost on a modest screen: closed by default (nothing is read or drawn until it is opened); the file is read once per
// job, in slices, and only when it is not too big (otherwise the layers are spread evenly between the Z limits the
// service reports); at most TZ_FFF3D_MAX_SEC segments are drawn, in a few strokes (one per colour bucket and
// transparency); it is drawn again only when something changed (gesture, layer, time), at most once per frame.
//
// h = { canvas, el (the card), prev(): answer of jobs.preview, path(): file of 0:/gcodes, layer(): {sel, mode},
//       time(): {t, simulating}, om(): object model of the machine (only for the limits of the bed),
//       t(key, params): text of plugins.WorkshopPrinting.<key>, setInfo(text): the line under the canvas }
// fff3dInit(h) prepares it; then fff3dUpdate(h) when the job changes and fff3dRequest(h) to redraw.
import {
  tzFffLayersNew, tzFffLayersPiece, tzFffLayersResult, tzFffLayersUniform, tzFffSegmentsZ,
} from './fff-layers.js'
import {
  TZ_FFF3D_BUCKETS, TZ_FFF3D_VIEWS, tzFff3dProject, tzFff3dMatrix, tzFff3dBatch, tzFff3dFit, tzFff3dSegments,
  tzFff3dUntil, tzFff3dVisibility, tzFff3dBucket, tzFff3dColorBucket, tzFff3dBed,
} from './fff-3d.js'

export var TZ_FFF3D_MAX_BYTES = 25 * 1024 * 1024; // a bigger file is not read in the browser
export var TZ_FFF3D_PIECE = 8000; // lines read per slice
export var TZ_FFF3D_OPEN_KEY = "workshopFff3dView"; // localStorage key of the 3D view (open / closed)

export function fff3dInit(h) {
  h.open = false;
  try {
    var saved = localStorage.getItem(TZ_FFF3D_OPEN_KEY);
    h.open = saved === "1";
  } catch (e) {
    /* closed */
  }
  h.view = { rotX: TZ_FFF3D_VIEWS.iso.rotX, rotZ: TZ_FFF3D_VIEWS.iso.rotZ };
  h.zoom = 1;
  h.withBed = false;
  h.data = null; // {sec, layers, notice}
  h.keyData = "";
  h.token = 0;
  h.reading = "";
  h.out = null; // buffers reused by every draw
  h.order = null;
  h.counts = null;
  h.pending = false;
  h.dragging = false;
  h.widthCv = 0;
  h.heightCv = 0;
  h.enc = null;
  h.encKey = "";
  h.pointers = {};
  h.nPointers = 0;
  h.dist0 = 0;
  h.zoom0 = 1;
  return h;
}

export function fff3dSetOpen(h, open) {
  h.open = !!open;
  try {
    localStorage.setItem(TZ_FFF3D_OPEN_KEY, h.open ? "1" : "0");
  } catch (e) {
    /* not critical */
  }
  if (h.open) fff3dUpdate(h);
}

export function fff3dSetView(h, name) {
  var v = TZ_FFF3D_VIEWS[name];
  if (!v) return;
  h.view = { rotX: v.rotX, rotZ: v.rotZ };
  h.zoom = 1;
  fff3dRequest(h);
}

export function fff3dToggleBed(h) {
  h.withBed = !h.withBed;
  h.encKey = "";
  fff3dRequest(h);
}

export function fff3dDestroy(h) {
  h.token++;
  h.open = false;
  h.data = null;
  h.out = h.order = null;
}

// ---------- the data of the job ----------
function keyJob(h) {
  var p = h.prev();
  return p && p.mode === "FFF" ? [h.path(), p.vertices, p.vertices_total, (p.stats && p.stats.layers) || 0].join("|") : "";
}

function armData(h, zs, layers, notice) {
  var p = h.prev();
  h.data = { sec: tzFff3dSegments(p.segments || [], zs), layers: layers, notice: notice };
  h.out = new Float32Array(h.data.sec.n * 4);
  h.order = new Uint32Array(h.data.sec.n);
  h.enc = null;
  h.encKey = "";
  h.reading = "";
  fff3dRequest(h);
}

function zOfService(h) {
  var t = h.prev().segments || [];
  return t.length && t.every(function (r) { return !r.w || isFinite(r.z); });
}

function uniform(h, notice) {
  var p = h.prev(), s = p.stats || {};
  var u = tzFffLayersUniform(s.layers || 0, s.z_min, s.z_max);
  armData(h, tzFffSegmentsZ(p.segments || [], u.layerZ), s.layers || 0, notice);
}

function readFile(h, myToken) {
  var p = h.prev(), path = h.path();
  if ((p.bytes || 0) > TZ_FFF3D_MAX_BYTES) {
    uniform(h, h.t("fff.too_big"));
    return;
  }
  h.reading = h.t("fff.reading", { pct: 0 });
  h.setInfo(h.reading);
  fetch("/machine/file/" + encodeURI("0:/gcodes/" + path), { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (text) {
      var s = tzFffLayersNew(), i = 0;
      function piece() {
        if (myToken !== h.token) return; // another job or the view was closed
        i = tzFffLayersPiece(s, text, i, TZ_FFF3D_PIECE);
        if (i < text.length) {
          h.reading = h.t("fff.reading", { pct: Math.round((100 * i) / text.length) });
          h.setInfo(h.reading);
          setTimeout(piece, 0);
          return;
        }
        var r = tzFffLayersResult(s);
        var pl = h.prev(), layersSvc = (pl.stats && pl.stats.layers) || 0;
        // the file must agree with the plan (same layer rule); if not the Z of a layer would be wrong
        if (r.layers !== layersSvc) uniform(h, h.t("fff.layers_differ", { a: r.layers, b: layersSvc }));
        else armData(h, tzFffSegmentsZ(pl.segments || [], r.layerZ), r.layers, "");
      }
      piece();
    })
    .catch(function (e) {
      if (myToken !== h.token) return;
      uniform(h, h.t("fff.read_error", { e: (e && e.message) || e }));
    });
}

// called when the job shown changes (and when the card is opened)
export function fff3dUpdate(h) {
  var k = keyJob(h);
  if (k !== h.keyData) {
    h.keyData = k;
    h.token++;
    h.data = null;
    h.reading = "";
  }
  if (!h.open) return;
  if (!k) {
    h.setInfo(h.prev() ? h.t("fff.only_fff") : h.t("fff.no_job"));
    drawEmpty(h);
    return;
  }
  if (h.data || h.reading) {
    fff3dRequest(h);
    return;
  }
  if (zOfService(h)) armData(h, tzFffSegmentsZ(h.prev().segments || [], null), (h.prev().stats && h.prev().stats.layers) || 0, "");
  else readFile(h, h.token);
}

// ---------- drawing ----------
export function fff3dRequest(h) {
  if (h.pending || !h.open) return;
  h.pending = true;
  (typeof requestAnimationFrame === "function" ? requestAnimationFrame : function (fn) { setTimeout(fn, 16); })(function () { fff3dPaint(h); });
}

function drawEmpty(h) {
  var cv = adjustCanvas(h);
  if (!cv) return;
  cv.clearRect(0, 0, h.widthCv, h.heightCv);
}

function adjustCanvas(h) {
  var w = Math.round(h.canvas.clientWidth || h.el.clientWidth || 0);
  if (w < 40) return null;
  var hh = Math.max(180, Math.min(420, Math.round(w * 0.65)));
  if (w !== h.widthCv || hh !== h.heightCv) {
    h.widthCv = w;
    h.heightCv = hh;
    h.canvas.width = w;
    h.canvas.height = hh;
    h.canvas.style.height = hh + "px";
    h.encKey = "";
  }
  return h.canvas.getContext("2d");
}

function box3d(h) {
  var c = h.data.sec.box;
  var b = { xmin: c.xmin, xmax: c.xmax, ymin: c.ymin, ymax: c.ymax, zmin: c.zmin, zmax: Math.max(c.zmax, c.zmin + 0.01) };
  var bed = h.withBed ? tzFff3dBed(h.om && h.om()) : null;
  if (bed) {
    b.xmin = Math.min(b.xmin, bed.xmin); b.xmax = Math.max(b.xmax, bed.xmax);
    b.ymin = Math.min(b.ymin, bed.ymin); b.ymax = Math.max(b.ymax, bed.ymax);
  }
  return { box: b, bed: bed };
}

// the floor: the footprint of the model (and the bed if asked), at the lowest Z
function floor(h, cv, b, zf, color, dash) {
  var q = [[b.xmin, b.ymin], [b.xmax, b.ymin], [b.xmax, b.ymax], [b.xmin, b.ymax], [b.xmin, b.ymin]].map(function (p) {
    var r = tzFff3dProject({ x: p[0], y: p[1], z: zf }, h.view.rotX, h.view.rotZ, h.enc.scale);
    return [r.x + h.enc.ox, r.y + h.enc.oy];
  });
  cv.beginPath();
  cv.strokeStyle = color;
  cv.lineWidth = 1;
  if (cv.setLineDash) cv.setLineDash(dash || []);
  q.forEach(function (p, i) { if (i) cv.lineTo(p[0], p[1]); else cv.moveTo(p[0], p[1]); });
  cv.stroke();
  if (cv.setLineDash) cv.setLineDash([]);
}

// one pass: sort the segments by (transparency, colour bucket) with a counting sort; no stroke per layer
function sortSegments(h, sec, kMax, cs) {
  var B = TZ_FFF3D_BUCKETS, G = 2 * B, nLayers = h.data.layers || 0;
  var jump = h.dragging && kMax > 6000 ? 2 : 1;
  if (!h.counts) h.counts = new Uint32Array(G + 1);
  h.counts.fill(0);
  var vis = {}, i, g;
  function tierOf(layer) {
    var v = vis[layer];
    if (v === undefined) v = vis[layer] = tzFff3dVisibility(layer, cs.sel, cs.mode);
    return v;
  }
  for (i = 0; i < kMax; i += jump) {
    var t = tierOf(sec.layer[i]);
    if (t === 0) continue;
    g = (t === 2 ? B : 0) + tzFff3dBucket(sec.layer[i], nLayers, B);
    h.counts[g + 1]++;
  }
  for (g = 0; g < G; g++) h.counts[g + 1] += h.counts[g];
  var pos = h.counts.slice(0, G);
  for (i = 0; i < kMax; i += jump) {
    var t2 = tierOf(sec.layer[i]);
    if (t2 === 0) continue;
    g = (t2 === 2 ? B : 0) + tzFff3dBucket(sec.layer[i], nLayers, B);
    h.order[pos[g]++] = i;
  }
}

function strokeSegments(h, cv, cs) {
  var B = TZ_FFF3D_BUCKETS, G = 2 * B;
  var alphaDim = cs.mode === "single" ? 0.1 : 0.4;
  cv.lineCap = "round";
  cv.lineWidth = h.dragging ? 1 : Math.max(1, Math.min(2.2, h.enc.scale * 0.4));
  for (var g = 0; g < G; g++) {
    var a = h.counts[g], b = h.counts[g + 1];
    if (a === b) continue;
    cv.globalAlpha = g >= B ? 1 : alphaDim;
    cv.strokeStyle = tzFff3dColorBucket(g % B, B);
    cv.beginPath();
    for (var j = a; j < b; j++) {
      var s4 = h.order[j] * 4;
      cv.moveTo(h.out[s4], h.out[s4 + 1]);
      cv.lineTo(h.out[s4 + 2], h.out[s4 + 3]);
    }
    cv.stroke();
  }
  cv.globalAlpha = 1;
}

export function fff3dPaint(h) {
  h.pending = false;
  if (!h.open || !h.el.isConnected) return;
  var cv = adjustCanvas(h);
  if (!cv) return;
  cv.clearRect(0, 0, h.widthCv, h.heightCv);
  if (!h.data) return;
  var sec = h.data.sec;
  if (!sec.n) {
    h.setInfo(h.t("fff.nothing"));
    return;
  }
  var c3 = box3d(h);
  var key = [h.view.rotX.toFixed(3), h.view.rotZ.toFixed(3), h.zoom.toFixed(3), h.widthCv, h.heightCv, h.withBed ? 1 : 0, sec.n].join("|");
  if (key !== h.encKey) {
    h.encKey = key;
    h.enc = tzFff3dFit(c3.box, h.view.rotX, h.view.rotZ, h.widthCv, h.heightCv, 12, h.zoom);
  }
  var m = tzFff3dMatrix(h.view.rotX, h.view.rotZ, h.enc.scale);
  tzFff3dBatch(sec.pts, sec.n, m, h.enc.ox, h.enc.oy, h.out);
  if (c3.bed) floor(h, cv, c3.bed, sec.box.zmin, "rgba(255,255,255,0.35)", [4, 4]);
  floor(h, cv, sec.box, sec.box.zmin, "rgba(255,255,255,0.18)", [2, 3]);

  var cs = h.layer() || { sel: 0, mode: "until" };
  var ti = h.time() || { t: 0, simulating: false };
  var kMax = ti.simulating && ti.t > 0 ? tzFff3dUntil(sec.tEnd, sec.n, ti.t) : sec.n;
  sortSegments(h, sec, kMax, cs);
  strokeSegments(h, cv, cs);
  // the tip of the print while it is simulated
  if (ti.simulating && ti.t > 0 && kMax > 0) {
    var e4 = (kMax - 1) * 4;
    cv.beginPath();
    cv.fillStyle = "#ff1744";
    cv.arc(h.out[e4 + 2], h.out[e4 + 3], 3.5, 0, 6.2832);
    cv.fill();
  }
  var txt = h.t("fff.drawn", { n: sec.n, total: sec.total });
  if (sec.step > 1) txt += " " + h.t("fff.thinned", { k: sec.step });
  if (h.data.notice) txt += " " + h.data.notice;
  h.setInfo(txt);
}

// ---------- gestures: one finger or the mouse turns, the wheel or two fingers zoom ----------
function limit(h) {
  h.view.rotX = Math.max(0.05, Math.min(Math.PI / 2, h.view.rotX));
  h.zoom = Math.max(0.5, Math.min(10, h.zoom));
}

function distance(h) {
  var ids = Object.keys(h.pointers);
  return Math.hypot(h.pointers[ids[0]].x - h.pointers[ids[1]].x, h.pointers[ids[0]].y - h.pointers[ids[1]].y) || 1;
}

export function fff3dPointerDown(h, ev) {
  try {
    h.canvas.setPointerCapture(ev.pointerId);
  } catch (e) {
    /* no capture: the gesture still works inside the canvas */
  }
  if (!h.pointers[ev.pointerId]) h.nPointers++;
  h.pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
  h.dragging = true;
  if (h.nPointers === 2) {
    h.dist0 = distance(h);
    h.zoom0 = h.zoom;
  }
  h.canvas.style.cursor = "grabbing";
}

export function fff3dPointerMove(h, ev) {
  var p = h.pointers[ev.pointerId];
  if (!p) return;
  if (h.nPointers >= 2) {
    p.x = ev.clientX;
    p.y = ev.clientY;
    h.zoom = h.zoom0 * (distance(h) / h.dist0);
  } else {
    h.view.rotZ -= (ev.clientX - p.x) * 0.01;
    h.view.rotX += (ev.clientY - p.y) * 0.01;
    p.x = ev.clientX;
    p.y = ev.clientY;
  }
  limit(h);
  fff3dRequest(h);
}

export function fff3dRelease(h, ev) {
  if (h.pointers[ev.pointerId]) {
    delete h.pointers[ev.pointerId];
    h.nPointers--;
  }
  if (h.nPointers <= 0) {
    h.nPointers = 0;
    h.dragging = false;
    h.canvas.style.cursor = "grab";
    fff3dRequest(h); // once more at full quality
  }
}

export function fff3dWheel(h, ev) {
  ev.preventDefault();
  h.zoom *= ev.deltaY < 0 ? 1.12 : 1 / 1.12;
  limit(h);
  fff3dRequest(h);
}
