'use strict'

// ---- FFF: the "3D job" tab (2026-10-21, moved here from the Workbench's Simulate and Current job cards) ----
//
// Pure helpers of FffJob.vue (test/fff-job.test.js): the file of the job that is running (from the object model, never from
// another plugin), the layer shown and the sentence about the last job. The files to choose come from the G-code library (GcodePicker.vue). Everything is read only.

var IN_PROGRESS = { processing: 1, paused: 1, pausing: 1, resuming: 1, simulating: 1 };

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

// Nothing is running: no file job going on (also not a simulation or a cancel). A live job (laser) has no file and is not told apart here.
export function fffNoJob(om) {
  return !fffPrinting(om) && ((om && om.state && om.state.status) || "") !== "cancelling";
}

// The sentence about the LAST job, as { key (under plugins.WorkshopPrinting.fff.), file } or null. Only with nothing running, only when the object model
// names the file, and only when the library says that file is a 3D print (`kind` = the kind of its summary, 'fff'): the last file of the machine may have been laser
// or CNC, and a sentence about the wrong kind of job is worse than none. No cause is ever given: the model keeps the flags, not the reason.
export function fffLastJob(om, kind) {
  var job = om && om.job;
  var file = job && job.lastFileName ? String(job.lastFileName) : "";
  if (!file || kind !== "fff" || !fffNoJob(om)) return null;
  var key = job.lastFileSimulated ? "last_simulated" : job.lastFileCancelled ? "last_cancelled" : job.lastFileAborted ? "last_aborted" : "last_done";
  return { key: key, file: file.replace(/^.*\//, "") };
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
