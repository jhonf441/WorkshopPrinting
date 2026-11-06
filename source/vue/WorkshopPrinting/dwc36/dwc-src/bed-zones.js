'use strict'

// ---- Bed zones: the numbers behind the "Bed zones" section (BedZones.vue, BedZoneMap.vue, BedZonesConfig.vue) ----
//
// Pure functions (test/bed-zones.test.js), nothing is asked of the machine: the rows come from the object model DWC already keeps (heat.bedHeaters,
// heat.heaters) and from the configuration the service sends (op bedzones.get, dsf/bed_zones_config.py). The heating itself is the service's:
// this file only decides what to show. Temperatures use the colors and the 3 degree tolerance of fff-temps.js (the state colors of the page), so a
// zone reads the same here and in the status cards.

import { tzFffTempClass, tzFffTempTarget, TZ_FFF_CLASS_COLOR } from './fff-temps.js'

export const MAX_LAYOUT = 4 // rows / columns of the map
export const MAX_ZONES = MAX_LAYOUT * MAX_LAYOUT // what the map can draw (dsf/bed_zones_config.py MAX_ZONES): the ceiling of the page, NOT what a board supports (see zoneLimit)
export const AMBIENT = 20 // the cold end of the map colors, in C
const NO_SENSOR_BELOW = -200 // a thermistor that is not connected reads about -273: that is no reading, not a very cold bed (the Status chart cuts at the same value)
const NO_DATA = '#9e9e9e' // the "off" color of fff-temps.js

// How many zones THIS board supports: its own number of bed heaters (object model limits.bedHeaters, RRF 3.4+), never more than the map draws. A board that does not
// report it only has the map as the ceiling: there is no fixed number of beds.
export function zoneLimit(model) {
	const n = model && model.limits && model.limits.bedHeaters
	return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ZONES) : MAX_ZONES
}

// The default configuration of the service (dsf/bed_zones.py DEFAULTS + bed_zones_config.defaults()): used only until the first answer arrives
export function emptyConfig() {
	return {
		enabled: false,
		zones: [0, 1, 2, 3].map(bed => ({ bed, active: true, offset: 0 })),
		max_temp: 110, max_offset: 15, tolerance: 2, timeout_s: 600,
		layout: { rows: 2, columns: 2 }
	}
}

const finite = v => typeof v === 'number' && isFinite(v)

// One row per configured zone, in the order of the configuration:
//   {n (1..), bed, heater|null, active, offset, current|null, target, state, cls, color, fault, missing, noReading, over, lagging, alert}
// missing: the board has no heater for that bed (heat.bedHeaters). noReading: the heater is there but its sensor gives no usable temperature (disconnected, about -273): current is
// null, so the map shows "--" and not a freezing bed. over: warmer than target + tolerance. lagging: more than the tolerance below its
// target while every other zone with a target is within it (the group arrived, this one did not). alert: fault, missing, noReading, over or lagging.
export function zoneRows(model, config) {
	const heat = (model && model.heat) || {}
	const slots = heat.bedHeaters || []
	const heaters = heat.heaters || []
	const tol = finite(config && config.tolerance) ? config.tolerance : 2
	const rows = ((config && config.zones) || []).map((z, i) => {
		const idx = slots[z.bed]
		const h = Number.isInteger(idx) && idx >= 0 ? heaters[idx] : null
		const missing = !h
		const reading = h && finite(h.current) ? h.current : null
		const current = reading !== null && reading > NO_SENSOR_BELOW ? reading : null
		const target = h ? tzFffTempTarget(h) : 0
		const state = h ? (h.state || 'off') : 'off'
		const cls = missing ? 'off' : tzFffTempClass(current, target, state)
		return {
			n: i + 1, bed: z.bed, heater: missing ? null : idx, active: !!z.active, offset: +z.offset || 0,
			current, target, state, cls, color: TZ_FFF_CLASS_COLOR[cls],
			fault: cls === 'fault', missing, noReading: !missing && current === null,
			over: target > 0 && current !== null && current > target + tol,
			lagging: false, alert: false
		}
	})
	const heating = rows.filter(r => r.active && !r.missing && r.target > 0 && r.current !== null)
	heating.forEach(r => {
		const behind = r.current < r.target - tol
		const others = heating.filter(o => o !== r)
		r.lagging = behind && others.length > 0 && others.every(o => Math.abs(o.current - o.target) <= tol)
	})
	rows.forEach(r => { r.alert = r.fault || (r.active && (r.missing || r.noReading || r.over || r.lagging)) })
	return rows
}

// Why a zone is flagged, as the key of the area bedZones (the page translates it); '' when it is fine
export function alertKey(row) {
	if (row.fault) return 'alert_fault'
	if (!row.active) return ''
	if (row.missing) return 'alert_missing'
	if (row.noReading) return 'alert_fault' // the same sentence as a heater or sensor fault: "heater or sensor fault"
	if (row.over) return 'alert_over'
	if (row.lagging) return 'alert_lagging'
	return ''
}

// ---- the map ----

// Where each zone goes: row-major in rows x columns. A zone that does not fit (layout smaller than the zones) goes after the last cell.
export function cells(rows, layout) {
	const columns = layoutSize(rows, layout).columns
	return rows.map((r, i) => ({ n: r.n, row: Math.floor(i / columns), col: i % columns }))
}

// The grid is as big as the zones need, never bigger: one bed is ONE big square in the middle, not a corner of an empty 2 x 2.
export function layoutSize(rows, layout) {
	const wanted = Math.max(1, Math.min(MAX_LAYOUT, (layout && layout.columns) | 0 || 1))
	const columns = Math.max(1, Math.min(wanted, rows.length))
	return { columns, rows: Math.max(1, Math.ceil(rows.length / columns)) }
}

// The colors of the map: cold blue, green, amber, red: the four state colors of fff-temps.js, evenly from AMBIENT to the maximum temperature
const RAMP = [TZ_FFF_CLASS_COLOR.cooling, TZ_FFF_CLASS_COLOR.ok, TZ_FFF_CLASS_COLOR.heating, TZ_FFF_CLASS_COLOR.fault]

function rgb(hex) {
	const n = parseInt(hex.slice(1), 16)
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hex(c) {
	return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

// The fill of a zone for its temperature; no reading = the gray of "off"
export function heatColor(current, maxTemp) {
	if (!finite(current)) return NO_DATA
	const top = finite(maxTemp) && maxTemp > AMBIENT ? maxTemp : 110
	const x = Math.max(0, Math.min(1, (current - AMBIENT) / (top - AMBIENT))) * (RAMP.length - 1)
	const k = Math.min(RAMP.length - 2, Math.floor(x))
	const a = rgb(RAMP[k]), b = rgb(RAMP[k + 1]), f = x - k
	return hex(a.map((v, i) => v + (b[i] - v) * f))
}

// Dark or white text for a fill, whichever reads better (WCAG relative luminance)
export function inkFor(fill) {
	const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
	const [r, g, b] = rgb(fill).map(lin)
	const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
	return lum > 0.35 ? '#212121' : '#ffffff'
}

export function fmtTemp(v) {
	return finite(v) ? v.toFixed(1) : '--'
}

// ---- the chart ----

// The series of ChartState.vue for the zones: the ones the Status chart already has (same color per heater), renamed with the zone name.
// `all` = seriesChart of Print.vue, `name(row)` = the translated name of a zone.
export function zoneSeries(rows, all, name) {
	const out = []
	rows.forEach(r => {
		if (r.heater === null) return
		const s = (all || []).find(x => x.id === r.heater)
		if (s) out.push(Object.assign({}, s, { name: name(r) }))
	})
	return out
}

// ---- the settings form ----

export function toNumber(v) {
	if (typeof v === 'number') return finite(v) ? v : null
	const t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.')
	if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null
	return parseFloat(t)
}

// Form draft: numbers as text so a half-typed value is not lost
export function draftOf(config) {
	const c = JSON.parse(JSON.stringify(config || emptyConfig()))
	c.zones = c.zones.map(z => ({ bed: String(z.bed), active: !!z.active, offset: String(z.offset) }))
	;['max_temp', 'max_offset', 'tolerance', 'timeout_s'].forEach(k => { c[k] = String(c[k]) })
	c.layout = { rows: String(c.layout.rows), columns: String(c.layout.columns) }
	return c
}

// The configuration to send, or {errors: {field: key}} (keys of the area bedZones, `err_*`); the service validates again and is the one that decides
export function configOf(draft) {
	const errors = {}
	const num = (field, v, lo, hi) => {
		const n = toNumber(v)
		if (n === null || n < lo || n > hi) { errors[field] = 'err_number'; return null }
		return n
	}
	const whole = (field, v, lo, hi) => {
		const n = toNumber(v)
		if (n === null || !Number.isInteger(n) || n < lo || n > hi) { errors[field] = 'err_whole'; return null }
		return n
	}
	const zones = draft.zones.map((z, i) => ({
		bed: whole('zones[' + i + '].bed', z.bed, 0, 31),
		active: !!z.active,
		offset: num('zones[' + i + '].offset', z.offset, -30, 30)
	}))
	const beds = zones.map(z => z.bed).filter(b => b !== null)
	zones.forEach((z, i) => { if (z.bed !== null && beds.indexOf(z.bed) !== beds.lastIndexOf(z.bed)) errors['zones[' + i + '].bed'] = 'err_repeated' })
	if (!zones.length) errors.zones = 'err_no_zones'
	const out = {
		enabled: !!draft.enabled, zones,
		max_temp: num('max_temp', draft.max_temp, 1, 200),
		max_offset: num('max_offset', draft.max_offset, 1, 30),
		tolerance: num('tolerance', draft.tolerance, 0.5, 20),
		timeout_s: num('timeout_s', draft.timeout_s, 1, 3600),
		layout: { rows: whole('layout', draft.layout.rows, 1, MAX_LAYOUT), columns: whole('layout', draft.layout.columns, 1, MAX_LAYOUT) }
	}
	if (!errors.layout && zones.length > out.layout.rows * out.layout.columns) errors.layout = 'err_layout_small'
	if (!errors.max_offset && zones.some(z => z.offset !== null && Math.abs(z.offset) > out.max_offset)) errors.max_offset = 'err_offset_over'
	return Object.keys(errors).length ? { errors } : { config: out }
}

export function sameConfig(a, b) {
	return JSON.stringify(a) === JSON.stringify(b)
}

// The setpoint typed in the page (text) as a number the service accepts, or null
export function setpointOf(text, maxTemp) {
	const n = toNumber(text)
	return n !== null && n >= 0 && (!finite(maxTemp) || n <= maxTemp) ? n : null
}

// How many beds the board defines vs the configured zones: {board, missing: [bed...]}
export function boardCheck(detected, config) {
	const have = (detected || []).filter(d => d && d.heater !== null && d.heater !== undefined).map(d => d.bed)
	return { board: have.length, missing: ((config && config.zones) || []).filter(z => have.indexOf(z.bed) < 0).map(z => z.bed) }
}

// The Bed heaters assistant of Machine (the plan of the configuration: preview, backup, history) with the beds to define: the Bed zones section never writes heater lines itself.
// Machine reads ?layout=beds&beds=1,2,3 (vue/WorkshopMachine lib/cross-page.js); null when there is nothing to define.
export function machineBedsRoute(beds, limit) {
	const room = Number.isInteger(limit) && limit > 0 ? limit : MAX_ZONES
	const list = (Array.isArray(beds) ? beds : []).filter((n, i, a) => Number.isInteger(n) && n >= 0 && n <= 31 && a.indexOf(n) === i).slice(0, room)
	return list.length ? { path: '/Plugins/Machine', query: { layout: 'beds', beds: list.join(',') } } : null
}

// The layout (rows x columns, as text) that holds `count` zones: the one it has when it already does, else it grows one column or one row at a time (squarer first) up to
// MAX_LAYOUT x MAX_LAYOUT. A new zone must never make the settings fail with "the map has fewer cells than zones".
export function fitLayout(count, layout) {
	const clamp = v => Math.max(1, Math.min(MAX_LAYOUT, parseInt(v, 10) || 1))
	let rows = clamp(layout && layout.rows)
	let columns = clamp(layout && layout.columns)
	while (rows * columns < count && (rows < MAX_LAYOUT || columns < MAX_LAYOUT)) {
		if (columns <= rows && columns < MAX_LAYOUT) columns++
		else if (rows < MAX_LAYOUT) rows++
		else columns++
	}
	return { rows: String(rows), columns: String(columns) }
}

// The beds the board defines (heat.bedHeaters, live) that no zone covers yet, in bed order, up to the room left under the limit of the board (zoneLimit). The map only draws the configured zones, so a
// bed defined later in Machine is offered here instead of staying invisible.
export function unassignedBeds(model, config) {
	const heat = (model && model.heat) || {}
	const slots = heat.bedHeaters || []
	const heaters = heat.heaters || []
	const have = ((config && config.zones) || []).map(z => z.bed)
	const found = []
	slots.forEach((idx, bed) => { if (Number.isInteger(idx) && idx >= 0 && heaters[idx] && have.indexOf(bed) < 0) found.push(bed) })
	return found.slice(0, Math.max(0, zoneLimit(model) - have.length))
}

// The configuration with those beds added as zones (active, no offset) and the map grown to hold them: what the one-tap button of the page saves.
export function withBeds(config, beds) {
	const zones = ((config && config.zones) || []).concat(beds.map(bed => ({ bed, active: true, offset: 0 })))
	const l = fitLayout(zones.length, config && config.layout)
	return Object.assign({}, config, { zones, layout: { rows: +l.rows, columns: +l.columns } })
}

// The first step when the board has no bed at all: DEFINE the zone (name, heater, size of the limit) before anything can be set or watched. `detected` = the beds the service
// found (bedzones.get), `model` = the live object model. needed: true when neither the model nor the service knows a bed heater; beds: what to ask Machine to define (the first
// configured zone, else bed 0): one zone first, the others follow from the same assistant.
export function firstDefinition(model, detected, config) {
	const heat = (model && model.heat) || {}
	const inModel = (heat.bedHeaters || []).some((idx, bed) => Number.isInteger(idx) && idx >= 0 && !!(heat.heaters || [])[idx] && bed >= 0)
	const inService = (detected || []).some(d => d && d.heater !== null && d.heater !== undefined)
	const zones = (config && config.zones) || []
	const first = zones.length ? zones.map(z => z.bed).filter(Number.isInteger).sort((a, b) => a - b)[0] : 0
	return { needed: !inModel && !inService, beds: [Number.isInteger(first) ? first : 0] }
}
