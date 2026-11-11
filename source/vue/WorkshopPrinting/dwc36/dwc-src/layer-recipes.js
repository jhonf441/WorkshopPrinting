'use strict'

// ---- Temperature-by-layer RECIPES (pure) ----
//
// A recipe is what a material needs along a print: a name, a kind (pellet or filament), the material and up to two tracks that follow the same layer rule: the
// extruder track (exactly a pellet-by-layer profile, see pellet-layers.js) and the bed track (the same shape, whose zones are bed heater numbers). The service
// (dsf/layer_recipes.py) validates and stores them; this file is the form side: the material starting points, the ready-made curve shapes the person picks from a
// list instead of typing every point, the draft (texts in, numbers out) and the same checks as the service so the page can say what is wrong before saving.
import { MIN_TEMP, HARD_MAX_TEMP, MAX_POINTS, MAX_ZONES, MAX_STEP_LIMIT, SPREAD_MIN, SPREAD_MAX, MODES, AXES, NAME_MAX, parseNumber, draftOf, profileOf, targetsAt } from './pellet-layers.js'

export { NAME_MAX, parseNumber }
export const KINDS = ['pellet', 'filament']
export const TRACKS = ['extruder', 'bed']
export const MATERIAL_MAX = 40
export const NOTE_MAX = 200
export const BED_HARD_MAX = 150 // C: the service refuses a bed track above it
export const BED_NUMBER_MAX = 31
export const OTHER = 'other'
const PALETTE = ['#1976d2', '#ef6c00', '#2e7d32', '#8e24aa', '#00838f', '#c62828', '#6d4c41', '#546e7a']

// The names of the material labels of a NEW recipe (a label only: a recipe holds CHANGES over the G-code, not temperatures, so a material has no numbers here)
export const MATERIALS = ['pla', 'petg', 'abs', 'asa', 'pa', 'tpu', 'pp', 'pc']

// Recipes are RELATIVE to the G-code (the only mode, `format: 2`): every point of a track holds a DELTA in degrees per zone over the temperature the file already
// asks for (negative = colder). `max_temp`, `max_step` and `max_spread` stay ABSOLUTE limits the service applies to the result (base + delta).
export const FORMAT = 2
export const DELTA_RANGE = { extruder: 150, bed: 60 } // C: the deltas of a track stay between -N and +N (the same as the service)
export const DEFAULT_MAX_TEMP = { extruder: 250, bed: 90 } // C: the absolute cap of a new track (editable)

// ---- the ready-made shapes of a curve ----

// What each shape asks for (the fields the page shows), with a default. `layers` counts layers of the print; for the Z axis they are converted with the layer height.
export const SHAPES = {
	flat: { fields: [] },
	first_hot: { fields: [{ key: 'delta', def: 10, min: 1, max: 50, unit: 'C' }, { key: 'layers', def: 2, min: 1, max: 50, unit: 'layers' }] },
	taper: { fields: [{ key: 'delta', def: 5, min: 1, max: 30, unit: 'C' }, { key: 'every', def: 20, min: 1, max: 1000, unit: 'layers' }, { key: 'count', def: 3, min: 1, max: 20, unit: 'steps' }] },
	ramp_down: { fields: [{ key: 'delta', def: 15, min: 1, max: 60, unit: 'C' }, { key: 'layers', def: 40, min: 2, max: 2000, unit: 'layers' }] },
	ramp_up: { fields: [{ key: 'delta', def: 15, min: 1, max: 60, unit: 'C' }, { key: 'layers', def: 40, min: 2, max: 2000, unit: 'layers' }] }
}
export const SHAPE_IDS = Object.keys(SHAPES)

export function shapeDefaults(shape) {
	const out = {}
	;((SHAPES[shape] || SHAPES.flat).fields).forEach(f => { out[f.key] = f.def })
	return out
}

const round1 = t => Math.round(t * 10) / 10 + 0 // + 0: never -0
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null

// The points of a shape, as DELTAS (no base temperature: the file gives it). `zones` = how many zones the track drives; every zone gets the same delta, so the
// spread between zones is the one of the file. flat = one point of zeros ("follows the G-code"); first_hot = +delta the first layers, then 0; taper = 0, -d, -2d...;
// ramp_down 0 -> -delta; ramp_up 0 -> +delta. axis 'layer': `at` is a layer number from 1; axis 'z': `at` is a height in mm (a layer is `layerHeight` mm).
// Returns {mode, points} (mode steps for a stepped shape, ramp for a ramp).
export function shapePoints(shape, zones, opts) {
	const o = Object.assign({ axis: 'layer', layerHeight: 0.2 }, shapeDefaults(shape), opts || {})
	const n = Math.max(1, Math.floor(num(zones) === null ? 1 : zones))
	const at = layer => (o.axis === 'z' ? Math.round((layer - 1) * o.layerHeight * 100) / 100 : layer)
	const pt = (layer, d) => ({ at: at(layer), temps: Array.from({ length: n }, () => round1(d)) })
	if (shape === 'first_hot') return { mode: 'steps', points: [pt(1, o.delta), pt(1 + o.layers, 0)] }
	if (shape === 'taper') {
		const pts = [pt(1, 0)]
		for (let k = 1; k <= o.count; k++) pts.push(pt(1 + k * o.every, -k * o.delta))
		return { mode: 'steps', points: pts }
	}
	if (shape === 'ramp_down') return { mode: 'ramp', points: [pt(1, 0), pt(o.layers, -o.delta)] }
	if (shape === 'ramp_up') return { mode: 'ramp', points: [pt(1, 0), pt(o.layers, o.delta)] }
	return { mode: 'steps', points: [pt(1, 0)] }
}

// ---- tracks ----

// The zones a track can drive: the extruder zones of the tool (see toolZones of pellet-layers.js) or the bed zones of the bed-zones config. {n, heater}
export function bedZoneList(config) {
	return ((config && config.zones) || []).map((z, i) => ({ n: i + 1, heater: z.bed, active: z.active !== false }))
}

// A new track: one point of zeros (the track follows the G-code until the person adds changes). `heaters` are the heater numbers of the zones; for the extruder `tool` is its tool number.
// The cap is an absolute temperature (editable): 250 for the extruder, 90 for the bed.
export function emptyTrack(track, heaters, opts) {
	const o = opts || {}
	const tr = { mode: 'steps', axis: o.axis || 'layer', max_step: 10, max_spread: track === 'bed' ? 20 : 60, max_temp: DEFAULT_MAX_TEMP[track === 'bed' ? 'bed' : 'extruder'], points: [{ at: 1, temps: heaters.map(() => 0) }] }
	if (track === 'bed') tr.zones = heaters.slice()
	else { tr.tool = o.tool || 0; tr.heaters = heaters.slice() }
	return tr
}

// The profile shape the pellet-layers helpers understand, for any track (the bed zones play the part of heaters)
export function asProfile(track, t) {
	return track === 'bed' ? Object.assign({}, t, { tool: 0, heaters: t.zones }) : t
}

// Applies a shape to a track: new points (deltas) and mode. The limits and the zones stay.
export function applyShape(track, t, shape, opts) {
	const zones = (track === 'bed' ? t.zones : t.heaters) || []
	const out = shapePoints(shape, zones.length || (t.points[0] && t.points[0].temps.length) || 1, Object.assign({ axis: t.axis }, opts || {}))
	return Object.assign({}, t, { mode: out.mode, points: out.points })
}

// ---- the form (texts in, numbers out) ----

export function emptyRecipe(kind, material, tracks) {
	return { format: FORMAT, kind: KINDS.indexOf(kind) >= 0 ? kind : 'pellet', material: material || '', note: '', tracks: tracks || {} }
}

// A recipe for the form: every number of a track as a text
export function recipeDraft(r) {
	const tracks = {}
	TRACKS.forEach(k => {
		if (!r.tracks || !r.tracks[k]) return
		const d = draftOf(asProfile(k, r.tracks[k]))
		if (k === 'bed') { d.zones = r.tracks[k].zones.slice(); delete d.tool; delete d.heaters } else { delete d.zones }
		tracks[k] = d
	})
	return { kind: r.kind, material: r.material || '', note: r.note || '', tracks }
}

// The recipe of a draft (numbers; a text that does not read is null and the checks below name it)
export function recipeOf(d) {
	const tracks = {}
	TRACKS.forEach(k => {
		if (!d.tracks || !d.tracks[k]) return
		const src = d.tracks[k]
		const p = profileOf(k === 'bed' ? Object.assign({}, src, { tool: '0', heaters: src.zones }) : src)
		if (k === 'bed') { delete p.tool; p.zones = p.heaters; delete p.heaters }
		tracks[k] = p
	})
	return { format: FORMAT, kind: d.kind, material: (d.material || '').trim(), note: (d.note || '').trim(), tracks }
}

// The checks of ONE track (the same rules as the service for a relative track): [{field, key, params}] with `field` relative to the track.
// The points are deltas: each between -DELTA_RANGE and +DELTA_RANGE of its track, and the difference between the deltas of a point at most max_spread.
// There is no minimum or maximum on the points: the cap (max_temp) is absolute and the service applies it to base + delta.
export function validateTrack(track, t) {
	const errs = []
	const e = (field, key, params) => errs.push({ field, key, params: params || {} })
	const zones = track === 'bed' ? t.zones : t.heaters
	if (track !== 'bed' && (!Number.isInteger(t.tool) || t.tool < 0 || t.tool > 31)) e('tool', 'pellet_layers_err_tool')
	if (!Array.isArray(zones) || !zones.length || zones.length > MAX_ZONES) e(track === 'bed' ? 'zones' : 'heaters', 'pellet_layers_err_heaters', { max: MAX_ZONES })
	if (MODES.indexOf(t.mode) < 0) e('mode', 'pellet_layers_err_mode')
	if (AXES.indexOf(t.axis) < 0) e('axis', 'pellet_layers_err_axis')
	if (num(t.max_temp) === null || t.max_temp <= MIN_TEMP || t.max_temp > HARD_MAX_TEMP) e('max_temp', 'pellet_layers_err_max_temp', { min: MIN_TEMP + 1, max: HARD_MAX_TEMP })
	if (num(t.max_step) === null || t.max_step < 1 || t.max_step > MAX_STEP_LIMIT) e('max_step', 'pellet_layers_err_max_step', { max: MAX_STEP_LIMIT })
	const spreadOk = num(t.max_spread) !== null && t.max_spread >= SPREAD_MIN && t.max_spread <= SPREAD_MAX
	if (!spreadOk) e('max_spread', 'pellet_layers_err_max_spread', { min: SPREAD_MIN, max: SPREAD_MAX })
	if (!Array.isArray(t.points) || !t.points.length || t.points.length > MAX_POINTS) { e('points', 'pellet_layers_err_points', { max: MAX_POINTS }); return errs }
	const range = DELTA_RANGE[track === 'bed' ? 'bed' : 'extruder']
	let last = null
	t.points.forEach((pt, i) => {
		const f = 'points[' + i + ']'
		const atOk = t.axis === 'layer' ? (Number.isInteger(pt.at) && pt.at >= 1 && pt.at <= 100000) : (num(pt.at) !== null && pt.at >= 0 && pt.at <= 100000)
		if (!atOk) return e(f + '.at', 'pellet_layers_err_point_at')
		if (last !== null && pt.at <= last) e(f + '.at', 'pellet_layers_err_point_order')
		last = pt.at
		if (!Array.isArray(pt.temps) || (Array.isArray(zones) && pt.temps.length !== zones.length)) return e(f + '.temps', 'pellet_layers_err_point_temps')
		if (!pt.temps.every(d => num(d) !== null && d >= -range && d <= range)) return e(f + '.temps', 'layer_recipes_err_delta_range', { min: -range, max: range })
		if (spreadOk && Math.max.apply(null, pt.temps) - Math.min.apply(null, pt.temps) > t.max_spread) e(f + '.temps', 'layer_recipes_err_delta_spread', { max: t.max_spread })
	})
	return errs
}

// The same checks as dsf/layer_recipes.py validate_recipe: [{field, key, params}] (key under plugins.WorkshopPrinting.pellet)
export function validateRecipe(r) {
	const errs = []
	const e = (field, key, params) => errs.push({ field, key, params: params || {} })
	if (!r) return [{ field: 'recipe', key: 'layer_recipes_err_recipe', params: {} }]
	if (r.format !== FORMAT) e('format', 'layer_recipes_err_format')
	if (KINDS.indexOf(r.kind) < 0) e('kind', 'layer_recipes_err_kind')
	if (typeof r.material !== 'string' || r.material.length > MATERIAL_MAX) e('material', 'layer_recipes_err_material', { max: MATERIAL_MAX })
	if (typeof r.note !== 'string' || r.note.length > NOTE_MAX) e('note', 'layer_recipes_err_note', { max: NOTE_MAX })
	const have = TRACKS.filter(k => r.tracks && r.tracks[k])
	if (!have.length) e('tracks', 'layer_recipes_err_tracks')
	have.forEach(k => {
		const t = r.tracks[k]
		validateTrack(k, t).forEach(x => errs.push({ field: 'tracks.' + k + '.' + x.field, key: x.key, params: x.params }))
		if (k === 'bed') {
			if (Array.isArray(t.zones) && t.zones.some(z => !Number.isInteger(z) || z < 0 || z > BED_NUMBER_MAX)) e('tracks.bed.zones', 'layer_recipes_err_bed_zones', { max: BED_NUMBER_MAX })
			if (typeof t.max_temp === 'number' && t.max_temp > BED_HARD_MAX) e('tracks.bed.max_temp', 'layer_recipes_err_bed_max', { max: BED_HARD_MAX })
		}
	})
	if (have.length === 2 && r.tracks.extruder.axis !== r.tracks.bed.axis) e('tracks.bed.axis', 'layer_recipes_err_axis')
	return errs
}

// The model of the SVG chart of a track: x = layer (or Z), y = the DELTA over the G-code in degrees (positive and negative), with the zero line (what the G-code asks).
// p: a track as numbers (profileOf of pellet-layers.js). G = { w, h, l, r, t, b }. Null when there is nothing valid to draw.
export function deltaChartModel(p, G) {
	if (!p || !Array.isArray(p.points) || !p.points.length || !Array.isArray(p.heaters) || !p.heaters.length) return null
	if (AXES.indexOf(p.axis) < 0 || MODES.indexOf(p.mode) < 0) return null
	if (!p.points.every(pt => num(pt.at) !== null && Array.isArray(pt.temps) && pt.temps.length === p.heaters.length && pt.temps.every(v => num(v) !== null))) return null
	const lastAt = p.points[p.points.length - 1].at
	const xmax = p.axis === 'layer' ? Math.max(lastAt, 2) : Math.max(lastAt, 1)
	const xmin = p.axis === 'layer' ? 1 : 0
	const all = [0]
	p.points.forEach(pt => pt.temps.forEach(v => all.push(v)))
	let lo = Math.floor((Math.min.apply(null, all) - 2) / 5) * 5
	let hi = Math.ceil((Math.max.apply(null, all) + 2) / 5) * 5
	if (hi - lo < 10) { lo -= 5; hi += 5 }
	const x = v => G.l + ((v - xmin) / (xmax - xmin)) * (G.w - G.l - G.r)
	const y = v => G.h - G.b - ((v - lo) / (hi - lo)) * (G.h - G.t - G.b)
	const xs = []
	for (let i = 0; i <= 120; i++) xs.push(xmin + ((xmax - xmin) * i) / 120)
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
	const tick = (a, b, n) => { const out = []; for (let i = 0; i <= n; i++) out.push(Math.round((a + ((b - a) / n) * i) * 10) / 10); return out }
	return { lines, x, y, zeroY: y(0), ticksX: tick(xmin, xmax, 5), ticksY: tick(lo, hi, 4), min: lo, max: hi, xmin, xmax }
}

// One line of the picker: the name with what the recipe is, so a person picks by name and sees the kind and the material beside it
export function pickLabel(item) {
	const parts = [item.name]
	if (item.material) parts.push(item.material)
	return parts.join(' - ')
}

export function trackList(summary) {
	return (summary && summary.tracks) || []
}

export { MAX_POINTS, MAX_ZONES }
export const KEY_PREFIX = 'plugins.WorkshopPrinting.pellet.'

// The params of the notes of a preview answer ({ key, params }) by key, for the viewer: { key: params } (the notes themselves are kept as keys)
export function noteParams(notes) {
	const out = {}
	;(Array.isArray(notes) ? notes : []).forEach(n => { if (n && typeof n === 'object' && typeof n.key === 'string' && n.params && typeof n.params === 'object') out[n.key] = n.params })
	return out
}
