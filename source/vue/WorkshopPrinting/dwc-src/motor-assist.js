'use strict'

// The motion settings of the extruder motor (a pellet screw is not a filament drive): acceleration, jerk, top speed and the firmware
// retraction. Pure helpers; PelletMotor.vue reads the model and shows these numbers. Units on the page: acceleration in mm/s2, jerk in
// mm/min (as the object model), speed in mm/s (the G-code takes mm/min), retraction in mm and mm/s.
//
// Acceleration, jerk and top speed (M201 / M566 / M203 of the extruder) are settings of the machine: they are NOT written from here.
// They are changed in the Motion module of Machine, which prepares a plan, shows the change, keeps a backup and records it in the
// history (docs-internal/CONFIG-WRITE-PATH.md). This file only reads them, offers starting points and builds the link to Machine.
// The firmware retraction (M207) has no plan in Machine yet, so it is still written here, into modefff.g.

export const LIMITS = {
	retractLength: { min: 0, max: 20 },
	retractSpeed: { min: 1, max: 100 }
}

// starting points to pick from: the rows a screw needs are the first two (soft starts, no lost steps); the drive of a filament
// extruder takes the last. They are a first guess, not a measurement: the page says so and the test extrusion checks them
export const PRESETS = [
	{ id: 'soft', accel: 250, jerk: 120, speed: 20 },
	{ id: 'balanced', accel: 500, jerk: 300, speed: 40 },
	{ id: 'fast', accel: 1000, jerk: 600, speed: 60 }
]

// the value of the page -> the parameter of the Motion module of Machine (ids of its lib/motion-table.js PARAMS)
export const MACHINE_PARAMS = { accel: 'acceleration', jerk: 'jerk', speed: 'speed' }

const MACHINE_PATH = '/Plugins/Machine'

function num(v) {
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

function clamp(v, k) {
	return Math.min(LIMITS[k].max, Math.max(LIMITS[k].min, v))
}

// the values the page shows from an entry of move.extruders (jerk and speed arrive in mm/min)
export function fromModel(ext) {
	const e = ext || {}
	return {
		accel: num(e.acceleration),
		jerk: num(e.jerk),
		speed: num(e.speed) === null ? null : Math.round((e.speed / 60) * 10) / 10
	}
}

// a preset that matches the numbers (the "current" one is none of them)
export function presetOf(v) {
	return PRESETS.find(p => p.accel === v.accel && p.jerk === v.jerk && p.speed === v.speed) || null
}

// the route that opens Machine on the Motion module with that value's parameter chosen (?layout=motion&param=acceleration), or null for a key it does not know
export function machineRoute(key) {
	const param = Object.prototype.hasOwnProperty.call(MACHINE_PARAMS, key) ? MACHINE_PARAMS[key] : null
	return param ? { path: MACHINE_PATH, query: { layout: 'motion', param } } : null
}

// Machine's plan edits ONE letter per extruder ("E"): the first extruder. A second one ("E1") is edited by hand in the configuration file.
export function machineEditable(index) {
	return (Math.floor(Number(index)) || 0) === 0
}

// checks the retraction that was typed; returns { ok: true, value: { retractLength, retractSpeed } } with numbers in range, or { ok: false, field }
export function normalizeRetract(f) {
	const out = {}
	const len = num(f && f.retractLength === '' ? 0 : f && f.retractLength)
	if (len === null || len < LIMITS.retractLength.min || len > LIMITS.retractLength.max) return { ok: false, field: 'retractLength' }
	out.retractLength = len
	if (len > 0) {
		const sp = num(f && f.retractSpeed)
		if (sp === null || sp < LIMITS.retractSpeed.min || sp > LIMITS.retractSpeed.max) return { ok: false, field: 'retractSpeed' }
		out.retractSpeed = sp
	} else {
		out.retractSpeed = clamp(num(f && f.retractSpeed) || 20, 'retractSpeed')
	}
	return { ok: true, value: out }
}

const round = n => Math.round(n * 1000) / 1000

// the code to run now and the line that keeps it in modefff.g (the start of the line it replaces, the line, and what it follows)
export function retractPlan(value) {
	const text = value.retractLength > 0
		? 'M207 S' + round(value.retractLength) + ' F' + round(value.retractSpeed * 60) + '   ; firmware retraction (G10 / G11)'
		: 'M207 S0   ; firmware retraction off'
	const lines = [{ start: 'M207 ', text }]
	return { codes: lines.map(l => l.text.split('   ;')[0]), lines }
}

// can the extruder retract at the temperature of its heaters? (below the cold retract limit the board refuses the move)
export function retractCheck(coldRetract, targets) {
	const limit = num(coldRetract)
	const t = (targets || []).map(num).filter(n => n !== null && n > 0)
	if (limit === null || limit <= 0) return { ok: true, limit: 0, cold: [] }
	const cold = t.filter(n => n < limit)
	return { ok: cold.length === 0, limit, cold }
}
