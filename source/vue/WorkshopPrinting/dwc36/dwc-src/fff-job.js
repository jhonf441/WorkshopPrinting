'use strict'

// ---- FFF: the "3D job" tab (2026-10-21, moved here from the Workbench's Simulate and Current job cards) ----
//
// Pure helpers of FffJob.vue (test/fff-job.test.js): the G-code files of 0:/gcodes, the file of the job that is
// running (from the object model, never from another plugin) and the layer shown. Everything is read only.

export var FFF_EXT = /\.(gcode|gco|gc|nc|g)$/i; // same extensions as the Workbench's Simulate list
var IN_PROGRESS = { processing: 1, paused: 1, pausing: 1, resuming: 1, simulating: 1 };

// Files of 0:/gcodes (two folder levels, like the Workbench), newest first: [{path, size, date}].
// getJson(url) -> Promise of the parsed answer of /machine/directory/<dir> (an array of {type, name, size, date}).
export function fffListGcodes(getJson) {
  var out = [];
  function walk(dir, level) {
    return Promise.resolve()
      .then(function () { return getJson("/machine/directory/" + encodeURI("0:/gcodes" + (dir ? "/" + dir : ""))); })
      .then(function (items) {
        return Promise.all((Array.isArray(items) ? items : []).map(function (it) {
          if (!it) return null;
          if (it.type === "d" && level < 2) return walk((dir ? dir + "/" : "") + it.name, level + 1);
          if (it.type === "f" && FFF_EXT.test(it.name)) out.push({ path: (dir ? dir + "/" : "") + it.name, size: it.size || 0, date: it.date || "" });
          return null;
        }));
      })
      .catch(function () {});
  }
  return walk("", 0).then(function () {
    out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return out;
  });
}

// The job file of the machine as a path under 0:/gcodes ("" when there is none or it lives elsewhere).
export function fffJobFile(om) {
  var f = om && om.job && om.job.file && om.job.file.fileName;
  if (!f) return "";
  var m = /^(?:0:)?\/?gcodes\/(.+)$/.exec(String(f));
  return m ? m[1] : "";
}

export function fffPrinting(om) {
  return !!IN_PROGRESS[(om && om.state && om.state.status) || ""];
}

// The layer shown: the one the person picked (sel >= 0) or, while that very file is being printed and nothing was
// picked (sel === null), the layer of the print, up to it. 0 = all layers.
export function fffLayerShown(om, path, sel, mode) {
  if (sel !== null && sel !== undefined) return { sel: sel, mode: mode || "until", follows: false };
  var job = om && om.job;
  if (path && fffPrinting(om) && fffJobFile(om) === path && job && isFinite(job.layer) && job.layer > 0) {
    return { sel: job.layer, mode: "until", follows: true };
  }
  return { sel: 0, mode: mode || "until", follows: false };
}
