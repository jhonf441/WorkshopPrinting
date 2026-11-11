'use strict'

// ---- Calibration assistant of a multizone bed (BedCalibration.vue): the numbers behind each step ----
//
// Pure (test/bed-calibration.test.js). Since 2026-11-10 the SERVICE does the work (bedcal.preheat, bedcal.tune, bedcal.stop; dsf/bed_calibration_ops.py):
// this file only turns the object model and the Bed zones settings into what the card shows and into the arguments of those operations. Nothing
// here sends anything and no G-code is built here: the lines a step sends come from the service (bedcal.plan) so what is shown is what is sent.
// Zones that share one plate are thermally coupled: a zone receives heat from its neighbours, so the tuning of one heater is only right when the
// neighbours are at their working temperature, and the centre of the plate arrives before the edges.
//   zoneMap        zone <-> bed <-> heater <-> sensor, with the model of each heater (M307) and what is missing
//   heatingOrder   which zone starts first (the edges, they lose heat; the centre last, it is fed by its neighbours) and the stagger between them
//   startArgs      the arguments of bedcal.plan / bedcal.preheat / bedcal.tune for a preheat, one zone or all the zones
//   modelValues    the M307 numbers of each heater as the board holds them now (what a tuning leaves) -> the values of the plan kind config.heater_model
//   capValues      the M143 cap of each heater -> the values of the plan kind config.heater_cap
//   offsetsFromMap the offsets of the Bed zones settings from a thermal map (a thermometer reading per zone), and offsetsConfig to apply them

export const DEFAULT_TUNE_TEMP = 60
export const DEFAULT_STAGGER_S = 30
export const DEFAULT_HOLD_MIN = 15
export const TUNE_TEMP_RANGE = [30, 150]
export const STAGGER_RANGE = [0, 600]
export const HOLD_RANGE = [0, 60]
export const E_DEFAULT = '1.35' // the exponent RRF 3.4+ uses by default in M307 (kept explicit so the line is complete)

const finite = v => typeof v === 'number' && isFinite(v)
const num = (v, d) => (finite(v) ? Number(v).toFixed(d) : null)
const round = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d)

export function toNumber(v) {
	if (typeof v === 'number') return finite(v) ? v : null
	const t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.')
	return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null
}

// ---- the map ----

// One row per configured zone: {n, bed, heater, sensor, sensorName, sensorType, max, model, rect, offset, active, problems: [key]}
// problems (keys of the area bedCal): map_no_heater (the board has no heater for that bed), map_no_sensor (the heater reads no sensor),
// map_sensor_shared / map_heater_shared (two zones on the same one: they cannot be tuned apart), map_no_model (never tuned: M307 default)
export function zoneMap(model, config) {
	const heat = (model && model.heat) || {}
	const slots = heat.bedHeaters || []
	const heaters = heat.heaters || []
	const analog = ((model && model.sensors) || {}).analog || []
	const zones = (config && config.zones) || []
	const rows = zones.map((z, i) => {
		const idx = slots[z.bed]
		const h = Number.isInteger(idx) && idx >= 0 ? heaters[idx] || null : null
		const sensor = h && Number.isInteger(h.sensor) && h.sensor >= 0 ? h.sensor : null
		const s = sensor === null ? null : analog[sensor] || null
		const md = (h && h.model) || null
		return {
			n: i + 1, bed: z.bed, heater: h ? idx : null, sensor, sensorName: s && s.name ? String(s.name) : '', sensorType: s && s.type ? String(s.type) : '',
			max: h && finite(h.max) ? h.max : null, model: md, rect: z.rect || null, offset: finite(z.offset) ? z.offset : 0, active: z.active !== false, problems: []
		}
	})
	rows.forEach(r => {
		if (r.heater === null) r.problems.push('map_no_heater')
		else {
			if (r.sensor === null) r.problems.push('map_no_sensor')
			if (rows.some(o => o !== r && o.heater === r.heater)) r.problems.push('map_heater_shared')
			if (r.sensor !== null && rows.some(o => o !== r && o.sensor === r.sensor)) r.problems.push('map_sensor_shared')
			if (!r.model || r.model.enabled === false || !finite(r.model.heatingRate)) r.problems.push('map_no_model')
		}
	})
	return rows
}

export const tunable = rows => rows.filter(r => r.heater !== null && r.problems.indexOf('map_heater_shared') < 0)

// ---- the order ----

// The centre of each zone in bed space: its rect when the geometry is real, else the cell of the simple grid (rows x columns, row-major)
function centres(rows, layout) {
	const cols = Math.max(1, (layout && layout.columns) | 0 || 1)
	return rows.map((r, i) => (r.rect ? { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 } : { x: (i % cols) + 0.5, y: Math.floor(i / cols) + 0.5 }))
}

// [{bed, n, step (1..), reason, delay_s}]: the zones farthest from the middle of the plate start first (they lose heat to the air and to nothing else),
// the middle one last (its neighbours already feed it; started first it overshoots). `stagger` seconds between two starts (the supply sees one inrush at a time).
export function heatingOrder(rows, layout, stagger) {
	const list = rows.filter(r => r.active && r.heater !== null)
	if (!list.length) return []
	const c = centres(list, layout)
	const mid = { x: c.reduce((a, p) => a + p.x, 0) / c.length, y: c.reduce((a, p) => a + p.y, 0) / c.length }
	const dist = p => Math.hypot(p.x - mid.x, p.y - mid.y)
	const ranked = list.map((r, i) => ({ r, d: dist(c[i]) })).sort((a, b) => b.d - a.d || a.r.n - b.r.n)
	const far = ranked[0].d
	const wait = Math.max(0, toNumber(stagger) === null ? DEFAULT_STAGGER_S : toNumber(stagger))
	return ranked.map((x, k) => ({
		bed: x.r.bed, n: x.r.n, step: k + 1, delay_s: k * wait,
		reason: list.length === 1 ? 'order_only' : far - x.d < 1e-6 ? 'order_edge' : k === ranked.length - 1 ? 'order_centre' : 'order_between'
	}))
}

// ---- what the board holds ----

// The M307 line of a heater from its model in the object model (what a tuning left, or the default): null when the board shows no model
export function m307Line(heater, md) {
	if (!md || md.enabled === false || !finite(md.heatingRate) || !finite(md.coolingRate) || !finite(md.deadTime)) return null
	const K = num(md.coolingRate, 3) + ':' + (finite(md.fanCoolingRate) ? num(md.fanCoolingRate, 3) : '0.000')
	const S = finite(md.maxPwm) ? num(md.maxPwm, 2) : '1.00'
	const V = finite(md.standardVoltage) && md.standardVoltage > 0 ? ' V' + num(md.standardVoltage, 1) : ''
	const B = md.pid && md.pid.used === false ? 1 : 0
	return 'M307 H' + heater + ' R' + num(md.heatingRate, 3) + ' K' + K + ' D' + num(md.deadTime, 2) + ' E' + E_DEFAULT + ' S' + S + V + ' B' + B
}

// The numbers of the plan kind config.heater_model (dsf/machine_heater_save.py) for every zone the board has a model for: [{bed, n, heater, values, line}]
// `values` = {heater, r, k, kf, d, s, v, b} (heating rate, cooling rate, fan cooling rate, dead time, max PWM, calibration voltage, 1 = on/off), `line` the
// M307 as text for the person to read; the file edit itself is done by the service from the values, the page never writes a line.
export function modelValues(rows) {
	return rows.filter(r => r.heater !== null).map(r => {
		const md = r.model
		const line = m307Line(r.heater, md)
		if (!line) return null
		const v = finite(md.standardVoltage) && md.standardVoltage > 0 ? Math.round(md.standardVoltage * 10) / 10 : 0
		return {
			bed: r.bed, n: r.n, heater: r.heater, line,
			values: { heater: r.heater, r: round(md.heatingRate, 3), k: round(md.coolingRate, 3), kf: finite(md.fanCoolingRate) ? round(md.fanCoolingRate, 3) : 0, d: round(md.deadTime, 2), s: finite(md.maxPwm) ? round(md.maxPwm, 2) : 1, v, b: md.pid && md.pid.used === false ? 1 : 0 }
		}
	}).filter(Boolean)
}

// The numbers of the plan kind config.heater_cap for every heater of a zone: the cap the board holds (M143), else the maximum of the settings.
// [{bed, n, heater, max, line, fromSettings}]; a heater with neither is left out. The service accepts 30 to 150.
export function capValues(rows, maxTemp) {
	const fallback = toNumber(maxTemp)
	return rows.filter(r => r.heater !== null).map(r => {
		const max = finite(r.max) ? r.max : fallback
		if (max === null || !finite(max)) return null
		return { bed: r.bed, n: r.n, heater: r.heater, max, line: 'M143 H' + r.heater + ' S' + max, fromSettings: !finite(r.max) }
	}).filter(Boolean)
}

// The order the zones are tuned in: the heating order first (edges, then the centre), then any zone that is only tunable (inactive ones)
export function tuneOrder(rows, layout) {
	const first = heatingOrder(rows, layout, 0).map(o => o.bed)
	const rest = tunable(rows).map(r => r.bed).filter(b => first.indexOf(b) < 0)
	return first.filter(b => tunable(rows).some(r => r.bed === b)).concat(rest)
}

// The arguments of bedcal.plan / bedcal.preheat / bedcal.tune. kind: 'preheat' | 'tune'; `only` (tune): the bed numbers to tune, default all.
// Only the zones with a heater of their own go in (the service refuses two zones on one heater). Numbers are numbers, never text.
export function startArgs(kind, rows, config, opts, only) {
	const o = opts || {}
	const layout = (config && config.layout) || null
	const temp = toNumber(o.temp)
	if (kind === 'preheat') {
		return { beds: heatingOrder(rows, layout, 0).filter(x => tunable(rows).some(r => r.bed === x.bed)).map(x => x.bed), temp, stagger_s: Math.round(toNumber(o.stagger)), hold_min: Math.round(toNumber(o.hold)) }
	}
	const beds = tuneOrder(rows, layout)
	const args = { beds, temp, together: !!o.together }
	if (only && only.length) args.only = beds.filter(b => only.indexOf(b) >= 0)
	return args
}

// The settings with the offsets of a thermal map applied (zones[].offset); the rest is untouched. Never changes `config`.
export function offsetsConfig(config, result) {
	const by = {}
	result.rows.forEach(x => { by[x.bed] = x.offset })
	return Object.assign({}, config, { zones: ((config && config.zones) || []).map(z => (Object.prototype.hasOwnProperty.call(by, z.bed) ? Object.assign({}, z, { offset: by[z.bed] }) : z)) })
}

// ---- the thermal map ----

// `measured` = {bed: text} what a thermometer read on each zone, all at the same setpoint. The reference is the mean of the readings; a zone that reads
// colder than the mean gets a positive offset (the service asks it for more), warmer a negative one; clamped to the max offset of the settings.
// -> {rows: [{bed, n, measured, delta, offset, clamped}], reference, ready (two readings or more)}
export function offsetsFromMap(rows, measured, maxOffset) {
	const cap = toNumber(maxOffset) === null ? 15 : Math.abs(toNumber(maxOffset))
	const read = rows.filter(r => r.heater !== null).map(r => ({ r, t: toNumber(measured && measured[r.bed]) })).filter(x => x.t !== null)
	if (read.length < 2) return { rows: [], reference: null, ready: false }
	const reference = read.reduce((a, x) => a + x.t, 0) / read.length
	const out = read.map(x => {
		const delta = Math.round((reference - x.t) * 10) / 10
		const offset = Math.max(-cap, Math.min(cap, delta))
		return { bed: x.r.bed, n: x.r.n, measured: x.t, delta, offset, clamped: offset !== delta }
	})
	return { rows: out, reference: Math.round(reference * 10) / 10, ready: true }
}

// The checks of the inputs of the card: [{field, key}] (keys of the area bedCal)
export function inputIssues(opts) {
	const out = []
	const t = toNumber(opts && opts.temp)
	if (t === null || t < TUNE_TEMP_RANGE[0] || t > TUNE_TEMP_RANGE[1]) out.push({ field: 'temp', key: 'err_temp' })
	const s = toNumber(opts && opts.stagger)
	if (s === null || s < STAGGER_RANGE[0] || s > STAGGER_RANGE[1]) out.push({ field: 'stagger', key: 'err_stagger' })
	const h = toNumber(opts && opts.hold)
	if (opts && opts.hold !== undefined && (h === null || h < HOLD_RANGE[0] || h > HOLD_RANGE[1])) out.push({ field: 'hold', key: 'err_hold' })
	const measured = (opts && opts.measured) || {}
	Object.keys(measured).forEach(bed => { if (String(measured[bed]).trim() !== '' && toNumber(measured[bed]) === null) out.push({ field: 'measured.' + bed, key: 'err_measured' }) })
	return out
}
