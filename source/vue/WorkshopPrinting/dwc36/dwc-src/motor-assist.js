'use strict'

// The motion settings of the extruder motor (a pellet screw is not a filament drive): acceleration, jerk, top speed and the firmware
// retraction. Pure helpers; PelletMotor.vue reads the model, shows these numbers and writes them. Units on the page: acceleration in
// mm/s2, jerk in mm/min (as the object model), speed in mm/s (the G-code takes mm/min), retraction in mm and mm/s.

export const LIMITS = {
	accel: { min: 10, max: 5000 },
	jerk: { min: 1, max: 2000 },
	speed: { min: 1, max: 300 },
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

// checks what was typed; returns { ok: true, value } with numbers in range, or { ok: false, field }
export function normalize(f) {
	const out = {}
	for (const k of ['accel', 'jerk', 'speed']) {
		const n = num(f && f[k])
		if (n === null || n < LIMITS[k].min || n > LIMITS[k].max) return { ok: false, field: k }
		out[k] = n
	}
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

// "a:b:c" for the extruders up to `index`: the other extruders keep what they have now (a colon list sets them in order)
function list(extruders, index, key, value) {
	const out = []
	for (let i = 0; i <= index; i++) {
		const cur = i === index ? value : num(extruders && extruders[i] && extruders[i][key])
		out.push(cur === null ? value : cur)
	}
	return out.join(':')
}

const round = n => Math.round(n * 1000) / 1000

// the codes to run now and the lines that keep them in modefff.g (each: start of the line it replaces, the line, and what it follows)
export function plan(value, extruders, index) {
	const i = Math.max(0, Math.floor(Number(index) || 0))
	const acc = list(extruders, i, 'acceleration', value.accel)
	const jerk = list(extruders, i, 'jerk', value.jerk)
	const spd = list(extruders, i, 'speed', round(value.speed * 60))
	const lines = [
		{ start: 'M201 E', text: 'M201 E' + acc + '   ; extruder acceleration (mm/s2)' },
		{ start: 'M566 E', text: 'M566 E' + jerk + '   ; extruder jerk (mm/min)' },
		{ start: 'M203 E', text: 'M203 E' + spd + '   ; extruder top speed (mm/min)' }
	]
	const retract = value.retractLength > 0
		? 'M207 S' + round(value.retractLength) + ' F' + round(value.retractSpeed * 60) + '   ; firmware retraction (G10 / G11)'
		: 'M207 S0   ; firmware retraction off'
	lines.push({ start: 'M207 ', text: retract })
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
