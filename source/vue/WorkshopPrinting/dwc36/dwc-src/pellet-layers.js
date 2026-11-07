'use strict'

// Temperature of the pellet extruder by layer: the numbers behind PelletLayers.vue. Pure code (no Vue, no network): test/pellet-layers.test.js.
//
// The profile is saved by the service (operations pelletlayers.*, dsf/pellet_layers.py) and applied there, while a job is printing and only if
// the job was turned on for it. This file repeats the SAME rules (the curve, the limits per layer) so the page can draw the curve and preview it
// against the loaded job before anything is saved; the service validates and limits again on its own, and the test compares both with the same cases.
//
// Profile: { tool, heaters: [h...], mode: 'steps' | 'ramp', axis: 'layer' | 'z', max_temp, max_step, max_spread, points: [{ at, temps: [..] }] }
//   steps: from the point on, the point's temperatures hold until the next point. ramp: straight line between points.
//   at: a layer number (axis layer, whole, 1 or more) or a height in mm (axis z).

export const MIN_TEMP = 30 // C: a profile never asks for less (it cannot switch a heater off)
export const HARD_MAX_TEMP = 450
export const HEADROOM = 10 // C below the heater's own maximum that is never crossed
export const MAX_STEP_LIMIT = 50
export const SPREAD_MIN = 5
export const SPREAD_MAX = 200
export const MAX_POINTS = 60
export const MAX_ZONES = 8
export const NAME_MAX = 40
export const MODES = ['steps', 'ramp']
export const AXES = ['layer', 'z']
export const Z_TOL = 0.01 // mm: the same rule as the plan of the service and fff-layers.js

const num = v => (typeof v === 'number' && isFinite(v)) ? v : null

// What the person types: a number with a comma or a point; '' and anything else is null
export function parseNumber(text) {
	if (typeof text === 'number') return isFinite(text) ? text : null
	const s = String(text == null ? '' : text).trim().replace(',', '.')
	if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
	const v = Number(s)
	return isFinite(v) ? v : null
}

// ---- the heaters of the tool ----

// The extruder zones the profile can drive: the heaters of the tool, in the order RRF gives them (tool.heaters), with their name and maximum
export function toolZones(model, toolNumber) {
	const tool = ((model && model.tools) || []).find(t => t && t.number === toolNumber)
	if (!tool) return []
	const hs = (model.heat && model.heat.heaters) || []
	return (tool.heaters || []).map((h, i) => ({ index: i, heater: h, max: num(hs[h] && hs[h].max), current: num(hs[h] && hs[h].current), target: num(tool.active && tool.active[i]) }))
}

// A new profile for the tool: one point at layer 1 with the temperatures the tool has now (or 200)
export function emptyProfile(tool, heaters, active) {
	const temps = heaters.map((h, i) => { const a = num(active && active[i]); return a && a >= MIN_TEMP ? Math.round(a) : 200 })
	return { tool, heaters: heaters.slice(), mode: 'steps', axis: 'layer', max_temp: 250, max_step: 10, max_spread: 60, points: [{ at: 1, temps }] }
}

// ---- the form: texts in, numbers out ----

// A copy of the profile for the form: every number as a text the person edits
export function draftOf(profile) {
	return {
		tool: String(profile.tool), heaters: profile.heaters.slice(), mode: profile.mode, axis: profile.axis,
		max_temp: String(profile.max_temp), max_step: String(profile.max_step), max_spread: String(profile.max_spread),
		points: profile.points.map(p => ({ at: String(p.at), temps: p.temps.map(String) }))
	}
}

// The profile of a draft, or null where a number does not read. Does not judge limits: validateProfile does.
export function profileOf(draft) {
	if (!draft) return null
	const tool = parseNumber(draft.tool)
	const points = (draft.points || []).map(p => ({ at: parseNumber(p.at), temps: (p.temps || []).map(parseNumber) }))
	return {
		tool: tool, heaters: (draft.heaters || []).slice(), mode: draft.mode, axis: draft.axis,
		max_temp: parseNumber(draft.max_temp), max_step: parseNumber(draft.max_step), max_spread: parseNumber(draft.max_spread), points
	}
}

// The same checks as dsf/pellet_layers.py validate_profile, as [{ field, key, params }] (key relative to plugins.WorkshopPrinting.pellet)
export function validateProfile(p) {
	const errs = []
	const e = (field, key, params) => errs.push({ field, key: 'pellet_layers_err_' + key, params: params || {} })
	if (!p) return [{ field: 'profile', key: 'pellet_layers_err_profile', params: {} }]
	if (!Number.isInteger(p.tool) || p.tool < 0 || p.tool > 31) e('tool', 'tool')
	if (!Array.isArray(p.heaters) || !p.heaters.length || p.heaters.length > MAX_ZONES) e('heaters', 'heaters', { max: MAX_ZONES })
	if (MODES.indexOf(p.mode) < 0) e('mode', 'mode')
	if (AXES.indexOf(p.axis) < 0) e('axis', 'axis')
	const capOk = num(p.max_temp) !== null && p.max_temp > MIN_TEMP && p.max_temp <= HARD_MAX_TEMP
	if (!capOk) e('max_temp', 'max_temp', { min: MIN_TEMP + 1, max: HARD_MAX_TEMP })
	if (num(p.max_step) === null || p.max_step < 1 || p.max_step > MAX_STEP_LIMIT) e('max_step', 'max_step', { max: MAX_STEP_LIMIT })
	const spreadOk = num(p.max_spread) !== null && p.max_spread >= SPREAD_MIN && p.max_spread <= SPREAD_MAX
	if (!spreadOk) e('max_spread', 'max_spread', { min: SPREAD_MIN, max: SPREAD_MAX })
	if (!Array.isArray(p.points) || !p.points.length || p.points.length > MAX_POINTS) { e('points', 'points', { max: MAX_POINTS }); return errs }
	let last = null
	p.points.forEach((pt, i) => {
		const f = 'points[' + i + ']'
		const atOk = p.axis === 'layer' ? (Number.isInteger(pt.at) && pt.at >= 1 && pt.at <= 100000) : (num(pt.at) !== null && pt.at >= 0 && pt.at <= 100000)
		if (!atOk) return e(f + '.at', 'point_at')
		if (last !== null && pt.at <= last) e(f + '.at', 'point_order')
		last = pt.at
		if (!Array.isArray(pt.temps) || (Array.isArray(p.heaters) && pt.temps.length !== p.heaters.length)) return e(f + '.temps', 'point_temps')
		const top = capOk ? p.max_temp : HARD_MAX_TEMP
		if (!pt.temps.every(t => num(t) !== null && t >= MIN_TEMP && t <= top)) return e(f + '.temps', 'point_range', { min: MIN_TEMP, max: top })
		if (spreadOk && Math.max.apply(null, pt.temps) - Math.min.apply(null, pt.temps) > p.max_spread) e(f + '.temps', 'point_spread', { max: p.max_spread })
	})
	return errs
}

// ---- the curve (same as raw_targets of the service) ----

export function targetsAt(p, key) {
	const pts = p.points
	if (key <= pts[0].at) return pts[0].temps.slice()
	if (key >= pts[pts.length - 1].at) return pts[pts.length - 1].temps.slice()
	let j = 0
	pts.forEach((pt, i) => { if (pt.at <= key) j = i })
	const a = pts[j]
	if (p.mode === 'steps') return a.temps.slice()
	const b = pts[j + 1]
	const f = (key - a.at) / (b.at - a.at)
	return a.temps.map((x, i) => Math.round((x + (b.temps[i] - x) * f) * 100) / 100)
}

// ---- the job: how many layers and where each point falls ----

// The heights of the layers of a job. `layerZ` (the Z of layer N at [N - 1]) when known, else spread evenly between z_min and z_max of the
// service's stats (tzFffLayersUniform of fff-layers.js has the same idea: then the heights are approximate)
export function jobLayers(preview) {
	const s = preview && preview.stats
	const n = s && Number.isInteger(s.layers) ? s.layers : 0
	if (!n) return { layers: 0, layerZ: [], approximate: true }
	const a = num(s.z_min) !== null ? s.z_min : 0
	const b = num(s.z_max) !== null ? s.z_max : a
	const layerZ = []
	for (let c = 1; c <= n; c++) layerZ.push(n > 1 ? Math.round((a + ((b - a) * (c - 1)) / (n - 1)) * 1000) / 1000 : a)
	return { layers: n, layerZ, approximate: true }
}

// The layer of a height: how many layers start at or below z (+ tolerance); 0 when below the first one
export function layerOfZ(layerZ, z) {
	let n = 0
	layerZ.forEach(h => { if (h <= z + Z_TOL) n++ })
	return n
}

// Where each point falls in the job: [{ index, at, layer, beyond }]; beyond = after the last layer (it would never be reached)
export function pointLayers(p, job) {
	return p.points.map((pt, index) => {
		const layer = p.axis === 'layer' ? pt.at : Math.max(1, layerOfZ(job.layerZ, pt.at))
		return { index, at: pt.at, layer, beyond: job.layers > 0 && layer > job.layers }
	})
}

// What the service would ask layer by layer (only the limit per layer and the caps of the profile: the heater maximum is read in the service from
// the board). start = temperatures the tool has when the job begins (the first change starts from them).
export function simulate(p, job, start, caps) {
	const out = []
	let prev = start && start.length === p.heaters.length ? start.slice() : null
	let lastLayer = null
	for (let layer = 1; layer <= job.layers; layer++) {
		const key = p.axis === 'layer' ? layer : (job.layerZ[layer - 1] === undefined ? 0 : job.layerZ[layer - 1])
		const raw = targetsAt(p, key)
		const base = prev || raw
		const room = p.max_step * Math.max(1, lastLayer === null ? 1 : layer - lastLayer)
		const temps = raw.map((r, i) => {
			const cap = Math.min(p.max_temp, caps && caps[i] !== undefined && caps[i] !== null ? caps[i] - HEADROOM : p.max_temp)
			let t = Math.max(MIN_TEMP, Math.min(r, cap))
			t = Math.min(Math.max(t, base[i] - room), base[i] + room)
			return Math.round(Math.min(t, cap) * 10) / 10
		})
		out.push({ layer, key, raw, temps, limited: temps.some((t, i) => Math.abs(t - raw[i]) > 0.05) })
		prev = temps
		lastLayer = layer
	}
	return out
}

// Warnings of the preview, as [{ key, params }] (keys relative to plugins.WorkshopPrinting.pellet): a point beyond the last layer, and a jump
// between two points bigger than the limit per layer (the service will take more layers than the profile says to get there)
export function previewWarnings(p, job) {
	const w = []
	if (!job.layers) return [{ key: 'pellet_layers_warn_no_job', params: {} }]
	pointLayers(p, job).forEach(r => { if (r.beyond) w.push({ key: 'pellet_layers_warn_beyond', params: { n: r.index + 1, layer: r.layer, layers: job.layers } }) })
	for (let i = 1; i < p.points.length; i++) {
		const a = p.points[i - 1], b = p.points[i]
		const jump = Math.max.apply(null, b.temps.map((t, k) => Math.abs(t - a.temps[k])))
		const la = p.axis === 'layer' ? a.at : Math.max(1, layerOfZ(job.layerZ, a.at))
		const lb = p.axis === 'layer' ? b.at : Math.max(1, layerOfZ(job.layerZ, b.at))
		const room = p.max_step * Math.max(1, lb - la)
		if (p.mode === 'steps' && jump > p.max_step) w.push({ key: 'pellet_layers_warn_jump', params: { n: i + 1, jump: Math.round(jump), step: p.max_step, layers: Math.ceil(jump / p.max_step) } })
		else if (p.mode === 'ramp' && jump > room) w.push({ key: 'pellet_layers_warn_ramp', params: { n: i + 1, jump: Math.round(jump), room: Math.round(room) } })
	}
	return w
}

// ---- the chart ----

const PALETTE = ['#1976d2', '#ef6c00', '#2e7d32', '#8e24aa', '#00838f', '#c62828', '#6d4c41', '#546e7a']

// The model of the SVG chart: x = layer (or Z), y = temperature. G = { w, h, l, r, t, b }. Lines: the temperatures that will be asked (curve), one per
// zone, and the points as dots. Returns null when there is nothing to draw.
export function chartModel(p, job, G, start) {
	if (!p || !p.points.length || validateProfile(p).length) return null
	const lastAt = p.points[p.points.length - 1].at
	const useJob = job && job.layers > 0
	const xmax = p.axis === 'layer' ? Math.max(lastAt, useJob ? job.layers : 0, 2) : Math.max(lastAt, useJob ? job.layerZ[job.layers - 1] : 0, 1)
	const xmin = p.axis === 'layer' ? 1 : 0
	const all = []
	p.points.forEach(pt => pt.temps.forEach(t => all.push(t)))
	if (start) start.forEach(t => all.push(t))
	let lo = Math.floor((Math.min.apply(null, all) - 10) / 10) * 10
	let hi = Math.ceil((Math.max.apply(null, all) + 10) / 10) * 10
	if (hi - lo < 20) hi = lo + 20
	const x = v => G.l + ((v - xmin) / (xmax - xmin)) * (G.w - G.l - G.r)
	const y = v => G.h - G.b - ((v - lo) / (hi - lo)) * (G.h - G.t - G.b)
	const steps = 120
	const xs = []
	for (let i = 0; i <= steps; i++) xs.push(xmin + ((xmax - xmin) * i) / steps)
	const lines = p.heaters.map((h, k) => {
		let d = ''
		let prev = null
		xs.forEach(v => {
			const key = p.axis === 'layer' ? Math.max(1, Math.round(v)) : v
			const t = targetsAt(p, key)[k]
			if (p.mode === 'steps' && prev !== null && t !== prev) d += 'L' + x(v).toFixed(1) + ' ' + y(prev).toFixed(1) + ' '
			d += (d ? 'L' : 'M') + x(v).toFixed(1) + ' ' + y(t).toFixed(1) + ' '
			prev = t
		})
		return { heater: h, zone: k, color: PALETTE[k % PALETTE.length], d: d.trim(), dots: p.points.map(pt => ({ cx: x(pt.at), cy: y(pt.temps[k]) })) }
	})
	const tick = (a, b, n) => { const out = []; const stepV = (b - a) / n; for (let i = 0; i <= n; i++) out.push(Math.round((a + stepV * i) * 10) / 10); return out }
	return { lines, x, y, ticksX: tick(xmin, xmax, 5), ticksY: tick(lo, hi, 4), min: lo, max: hi, xmin, xmax }
}

// ---- the job file for arming ----

// The name RRF reports for the file: a short name goes under 0:/gcodes/
export function fileForJob(text) {
	const s = String(text == null ? '' : text).trim()
	if (!s) return ''
	if (/^\d+:\//.test(s)) return s
	return '0:/gcodes/' + s.replace(/^\/+/, '')
}

// The path of the job file that jobs.preview wants (under 0:/gcodes)
export function previewPath(fileName) {
	const s = String(fileName || '')
	const m = /^\d+:\/gcodes\/(.+)$/.exec(s)
	return m ? m[1] : ''
}

// ---- the live state ----

// The state the service publishes (pelletlayers.status), as the words the page shows: { phase, key (text key), params }.
export function liveState(st) {
	if (!st || !st.armed) {
		const r = st && st.reason
		return { phase: 'off', key: r ? 'pellet_layers_live_ended' : 'pellet_layers_live_off', params: {}, reason: r ? { key: r.key, params: r.params || {} } : null, warn: !!(r && r.warn) }
	}
	const phases = { waiting: 'waiting', waiting_heat: 'waiting_heat', waiting_layer: 'waiting_layer', running: 'running', holding: 'holding' }
	const phase = phases[st.phase] || 'waiting'
	return { phase, key: 'pellet_layers_live_' + phase, params: {}, reason: null, warn: false }
}

// The temperatures applied, as "200 / 210 / 220" (or '' when none yet)
export function tempsText(temps) {
	return Array.isArray(temps) ? temps.map(t => String(Math.round(t * 10) / 10)).join(' / ') : ''
}
