'use strict'

// ---- FFF: temperatures and print state of the job (moved from the Workbench, src/_zones/63-fff-temps.js, 2026-10-21) ----
//
// READ ONLY: the numbers come from the object model of the machine (heat.heaters, tools, job, move) that DWC already
// keeps in its store; nothing is asked of the machine and nothing is sent. Pure functions (test/fff-temps.test.js);
// the panel that shows them is FffJobStatus.vue.
//
// Nothing about the machine is assumed: the heaters shown are the ones the model reports (one per tool, the bed
// heaters and the chamber heaters); a machine without heaters shows a note.
export var TZ_FFF_TEMP_TOL = 3; // degrees: closer than this to the target counts as "at temperature"
export var TZ_FFF_IN_PROGRESS = { processing: 1, paused: 1, pausing: 1, resuming: 1, simulating: 1 };
// machine states with a translated name (fff.st_<state>); any other is shown as RRF names it
export var TZ_FFF_STATES = { idle: 1, processing: 1, paused: 1, pausing: 1, resuming: 1, simulating: 1, halted: 1, busy: 1, starting: 1, updating: 1, off: 1, cancelling: 1, changingTool: 1 };
export var TZ_FFF_CLASS_COLOR = { heating: "#ffb300", ok: "#66bb6a", cooling: "#29b6f6", off: "#9e9e9e", fault: "#ef5350" };

// "heating" | "ok" | "cooling" | "off" | "fault"
export function tzFffTempClass(current, target, state) {
  if (state === "fault" || state === "offline") return "fault";
  if (!isFinite(current) || current === null) return "off";
  if (state === "off" || !(target > 0)) return "off";
  if (Math.abs(current - target) <= TZ_FFF_TEMP_TOL) return "ok";
  return current < target ? "heating" : "cooling";
}
export function tzFffTempTarget(h) {
  if (!h) return 0;
  if (h.state === "active") return +h.active || 0;
  if (h.state === "standby") return +h.standby || 0;
  return 0;
}

// [{key, kind: "hotend"|"bed"|"chamber", n, current, target, state, cssClass}] in the order hotends, bed, chamber
export function tzFffTemperatures(om) {
  var heat = (om && om.heat) || {}, hs = heat.heaters || [], out = [], seen = {};
  function item(kind, idx, n, tool) {
    var h = hs[idx];
    if (!h || seen[idx]) return;
    seen[idx] = 1;
    var obj = tzFffTempTarget(h);
    out.push({
      key: kind + idx, kind: kind, n: n, tool: tool, index: idx,
      current: isFinite(h.current) ? h.current : null, target: obj, state: h.state || "off",
      cssClass: tzFffTempClass(isFinite(h.current) ? h.current : null, obj, h.state),
    });
  }
  var bed = (heat.bedHeaters || []).filter(function (i) { return i >= 0; });
  var camera = (heat.chamberHeaters || []).filter(function (i) { return i >= 0; });
  var tools = ((om && om.tools) || []).filter(function (t) { return t && t.heaters && t.heaters.length; });
  tools.forEach(function (t) {
    t.heaters.forEach(function (idx) {
      if (bed.indexOf(idx) < 0 && camera.indexOf(idx) < 0) item("hotend", idx, t.number, t);
    });
  });
  bed.forEach(function (idx, k) { item("bed", idx, k, null); });
  camera.forEach(function (idx, k) { item("chamber", idx, k, null); });
  var nh = out.filter(function (t) { return t.kind === "hotend"; }).length;
  out.forEach(function (t) { t.several = t.kind === "hotend" && nh > 1; });
  return out;
}

// the print: {state, inProgress, file, progress (0..100|null), layer, layers, elapsed, remaining, z, speed, flow}
export function tzFffStatePrint(om) {
  var job = (om && om.job) || {}, file = job.file || {}, mv = (om && om.move) || {};
  var estado = (om && om.state && om.state.status) || "";
  var nombre = file.fileName ? String(file.fileName).split("/").pop() : "";
  var pos = +job.filePosition, tam = +file.size;
  var left = job.timesLeft || {};
  var remaining = [left.file, left.filament, left.layer].filter(function (v) { return isFinite(v) && v !== null && v > 0; })[0];
  var z = null;
  (mv.axes || []).forEach(function (a) { if (a && a.letter === "Z" && isFinite(a.userPosition)) z = a.userPosition; });
  var ext = (mv.extruders || [])[0];
  return {
    state: estado,
    inProgress: !!TZ_FFF_IN_PROGRESS[estado],
    file: nombre,
    progress: tam > 0 && pos >= 0 ? Math.max(0, Math.min(100, (100 * pos) / tam)) : null,
    layer: isFinite(job.layer) && job.layer !== null ? job.layer : null,
    layers: isFinite(file.numLayers) && file.numLayers !== null ? file.numLayers : null,
    elapsed: isFinite(job.duration) && job.duration !== null ? job.duration : null,
    remaining: remaining === undefined ? null : remaining,
    z: z,
    speed: isFinite(mv.speedFactor) ? Math.round(mv.speedFactor * 100) : null,
    flow: ext && isFinite(ext.factor) ? Math.round(ext.factor * 100) : null,
  };
}
export function tzFffDur(s) {
  s = Math.max(0, Math.round(s || 0));
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h + ":" + (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x;
}

// Everything the panel shows, as plain rows (keys of plugins.WorkshopPrinting.fff.*, translated by the caller with t()).
// Same rows and order as the old Workbench panel. The key `sig` changes only when a shown number changes (temperatures to
// a tenth), so the panel can skip work when nothing changed.
//   -> { sig, temps: [{key, name, value, color, chip}], print: [{label, value, color}], none: bool, bar: progress|null }
export function tzFffPanel(om, t) {
  var temps = tzFffTemperatures(om), p = tzFffStatePrint(om);
  var sig = JSON.stringify([temps.map(function (x) { return [x.key, x.current === null ? null : Math.round(x.current * 10), x.target, x.state]; }), p]);
  function nameOf(x) {
    if (x.kind === "bed") return t("fff.bed") + (x.n ? " " + (x.n + 1) : "");
    if (x.kind === "chamber") return t("fff.chamber") + (x.n ? " " + (x.n + 1) : "");
    return x.several ? t("fff.hotend_n", { n: x.n }) : t("fff.hotend");
  }
  var rows = temps.map(function (x) {
    var txt = (x.current === null ? "--" : x.current.toFixed(1)) + " C";
    if (x.target > 0) txt += " / " + x.target + " C";
    return { key: x.key, name: nameOf(x), value: txt, color: TZ_FFF_CLASS_COLOR[x.cssClass], chip: x.cssClass === "fault" ? t("fff.heat_fault") : t("fff.heat_" + x.cssClass) };
  });
  var st = p.state ? (TZ_FFF_STATES[p.state] ? t("fff.st_" + p.state) : p.state) : "--";
  var print = [{ label: t("fff.p_state"), value: st, color: p.inProgress ? "#66bb6a" : null }];
  var none = !p.inProgress && !p.file;
  if (!none) {
    if (p.file) print.push({ label: t("fff.p_file"), value: p.file });
    if (p.progress !== null) print.push({ label: t("fff.p_progress"), value: Math.round(p.progress) + " %", bar: p.progress });
    if (p.layer !== null) print.push({ label: t("fff.p_layer"), value: p.layers ? p.layer + " / " + p.layers : String(p.layer) });
    if (p.z !== null) print.push({ label: t("fff.p_z"), value: p.z.toFixed(2) + " mm" });
    if (p.elapsed !== null) print.push({ label: t("fff.p_elapsed"), value: tzFffDur(p.elapsed) });
    if (p.remaining !== null) print.push({ label: t("fff.p_left"), value: tzFffDur(p.remaining) });
    if (p.speed !== null) print.push({ label: t("fff.p_speed"), value: p.speed + " %" });
    if (p.flow !== null) print.push({ label: t("fff.p_flow"), value: p.flow + " %" });
  }
  return { sig: sig, temps: rows, print: print, none: none };
}
