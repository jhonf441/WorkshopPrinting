'use strict'

// ---- Load / unload filament (2026-10-30): the short assistant of the "Load material" section (FilamentLoad.vue) ----
//
// Pure helpers (test/filament-load.test.js). Only for a filament tool: print-sections.js hides the section for a pellet tool.
// The assistant heats to the material's temperature, pushes or pulls a length at a safe speed and cools down at the end. With the
// filament macros of RRF (0:/filaments/<name>/load.g and unload.g) it runs M701 / M702; without them it moves the extruder
// directly (M83 + G1 E) within LOAD_LIMITS. The extruder NEVER moves below the machine's cold extrusion temperature
// (heat.coldExtrudeTemperature): the board refuses it anyway, and the page does not even offer the buttons (moveBlock).

export const LOAD_LIMITS = {
	length: { min: 1, max: 800 }, // mm (a Bowden tube can be long)
	speed: { min: 1, max: 20 } // mm/s (short enough to wait for, slow enough for the drive gear not to grind the filament)
}
export const LOAD_DEFAULTS = { length: 100, speed: 5 }
export const TEMP_TOL = 5 // degrees: this close to the target counts as ready
export const FILAMENTS_DIR = '0:/filaments' // where RRF keeps one folder per filament with load.g / unload.g
export const TIP_PUSH_MM = 3 // before pulling the filament out a short push softens the tip so it does not leave a string in the nozzle

function num(v) {
	if (v === null || v === undefined || v === '') return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

// The temperature to heat to: the material's nozzle temperature (Materials table) or, without a material, the target the tool
// has now. Never over the cap of the heater (M143). null = nothing to heat to.
export function loadTemp(material, nozzle) {
	let t = material && num(material.nozzle) > 0 ? num(material.nozzle) : null
	if (t === null && nozzle && num(nozzle.target) > 0) t = num(nozzle.target)
	if (t === null) return null
	if (nozzle && num(nozzle.max) > 0) t = Math.min(t, nozzle.max)
	return Math.round(t)
}

// 'off' (no target), 'heating' (not there yet) or 'ready' (within TEMP_TOL of the target)
export function heatState(nozzle) {
	if (!nozzle || !(num(nozzle.target) > 0)) return 'off'
	if (num(nozzle.current) === null) return 'heating'
	return Math.abs(nozzle.current - nozzle.target) <= TEMP_TOL ? 'ready' : 'heating'
}

// checks what was typed; returns { ok: true, value } with numbers in range, or { ok: false, field }
export function normalize(f) {
	const out = {}
	for (const k of ['length', 'speed']) {
		const v = num(f && f[k])
		if (v === null || v < LOAD_LIMITS[k].min || v > LOAD_LIMITS[k].max) return { ok: false, field: k }
		out[k] = k === 'length' ? Math.round(v) : Math.round(v * 10) / 10
	}
	return { ok: true, value: out }
}

// which of the two macros the folder of the material holds: { load, unload } (files = names in 0:/filaments/<name>)
export function macroState(files) {
	const names = (files || []).map(f => String(f).toLowerCase())
	return { load: names.indexOf('load.g') !== -1, unload: names.indexOf('unload.g') !== -1 }
}

export function heatCodes(toolNumber, temp) {
	const n = num(toolNumber), t = num(temp)
	if (n === null || !(t > 0)) return []
	return ['T' + n, 'M568 P' + n + ' S' + Math.round(t) + ' R' + Math.round(t) + ' A2']
}

export function coolCodes(toolNumber) {
	const n = num(toolNumber)
	return n === null ? [] : ['M568 P' + n + ' A0']
}

// M701 / M702 with the filament macros of the board (the name is the folder under 0:/filaments)
export function macroCodes(action, toolNumber, name) {
	const n = num(toolNumber)
	if (n === null) return []
	if (action === 'load') return name ? ['T' + n, 'M701 S"' + String(name).replace(/"/g, '') + '"'] : []
	if (action === 'unload') return ['T' + n, 'M702']
	return []
}

// Without the macros: a relative extrusion at the typed length and speed, waiting for it to end (M400). Unload pushes TIP_PUSH_MM
// first, then pulls the whole length back.
export function directCodes(action, toolNumber, form) {
	const n = num(toolNumber)
	const v = normalize(form)
	if (n === null || !v.ok || (action !== 'load' && action !== 'unload')) return []
	const F = Math.round(v.value.speed * 60)
	const codes = ['T' + n, 'M83']
	if (action === 'load') codes.push('G1 E' + v.value.length + ' F' + F)
	else codes.push('G1 E' + TIP_PUSH_MM + ' F' + Math.min(F, 120), 'G1 E-' + v.value.length + ' F' + F)
	codes.push('M400')
	return codes
}

// ---- why the extruder may not move now ('' = it may) ----
//   opts: { tool, nozzle, minTemp, busyJob, notFree }
//   'no_tool'  no tool or no nozzle heater      'job'   a file job runs       'machine'  the machine is not free (reason of machineFree)
//   'fault'    the nozzle reads no temperature  'cold'  below the cold extrusion temperature of the board
export function moveBlock(opts) {
	const o = opts || {}
	if (!o.tool || !o.nozzle) return 'no_tool'
	if (o.busyJob) return 'job'
	if (o.notFree) return 'machine'
	if (o.nozzle.sensorBad || o.nozzle.state === 'fault') return 'fault'
	const min = num(o.minTemp)
	if (min === null || !(num(o.nozzle.current) >= min)) return 'cold'
	return ''
}

// the filament the board says is loaded in the extruder (M701 remembers it): '' when none or unknown
export function loadedFilament(om, extruder) {
	const e = ((om && om.move && om.move.extruders) || [])[num(extruder)]
	return e && e.filament ? String(e.filament) : ''
}
