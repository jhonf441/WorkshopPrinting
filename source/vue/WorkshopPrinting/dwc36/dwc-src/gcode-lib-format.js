'use strict'

// Formatting of the numbers of the G-code library (pure, no Vue, no texts: units are symbols; the words come from i18n).

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)

// 3725 -> "1h 02m"; 754 -> "12m 34s"; 45 -> "45s"; unknown -> ''
export function formatDuration(sec) {
	const s = num(sec)
	if (s === null || s < 0) return ''
	const t = Math.round(s)
	const h = Math.floor(t / 3600)
	const m = Math.floor((t % 3600) / 60)
	const r = t % 60
	if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm'
	if (m > 0) return m + 'm ' + String(r).padStart(2, '0') + 's'
	return r + 's'
}

// filament length in mm -> "850 mm" / "12.35 m"
export function formatLength(mm) {
	const v = num(mm)
	if (v === null) return ''
	return v >= 1000 ? (v / 1000).toFixed(2) + ' m' : Math.round(v) + ' mm'
}

export function formatVolume(cm3) {
	const v = num(cm3)
	return v === null ? '' : v.toFixed(v >= 100 ? 0 : 1) + ' cm3'
}

export function formatWeight(g) {
	const v = num(g)
	return v === null ? '' : v.toFixed(v >= 100 ? 0 : 1) + ' g'
}

export function formatCost(c) {
	const v = num(c)
	return v === null ? '' : v.toFixed(2)
}

export function formatBytes(b) {
	const v = num(b)
	if (v === null || v < 0) return ''
	if (v < 1024) return v + ' B'
	if (v < 1048576) return (v / 1024).toFixed(0) + ' KB'
	if (v < 1073741824) return (v / 1048576).toFixed(1) + ' MB'
	return (v / 1073741824).toFixed(2) + ' GB'
}

export function formatTemp(t) {
	const v = num(t)
	return v === null || v <= 0 ? '' : Math.round(v) + ' C'
}

// the service sends the modified time in epoch seconds (or an ISO string); returns a local date text or ''
export function formatDate(m) {
	let ms = null
	if (typeof m === 'number' && isFinite(m)) ms = m < 1e12 ? m * 1000 : m
	else if (typeof m === 'string' && m) ms = Date.parse(m)
	if (ms === null || !isFinite(ms)) return ''
	const d = new Date(ms)
	const p = (n) => String(n).padStart(2, '0')
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

// {min:[x,y,z], max:[x,y,z]} -> {x,y,z} sizes in mm, or null
export function bboxSize(b) {
	if (!b || !Array.isArray(b.min) || !Array.isArray(b.max)) return null
	const d = [0, 1, 2].map((i) => (num(b.max[i]) === null || num(b.min[i]) === null ? null : b.max[i] - b.min[i]))
	return d.every((v) => v !== null) ? { x: d[0], y: d[1], z: d[2] } : null
}

export function formatBbox(b) {
	const s = bboxSize(b)
	return s ? s.x.toFixed(0) + ' x ' + s.y.toFixed(0) + ' x ' + s.z.toFixed(1) + ' mm' : ''
}

export function baseName(path) {
	const s = String(path == null ? '' : path)
	return s.slice(s.lastIndexOf('/') + 1)
}

// the full path of a file given as a job name ("pot.gcode", "sub/pot.gcode") or already complete ("0:/gcodes/pot.gcode")
export function fullPath(p) {
	const s = String(p == null ? '' : p).trim()
	if (!s) return ''
	return /^\d+:\//.test(s) ? s : '0:/gcodes/' + s.replace(/^\/+/, '')
}

export function folderOf(path) {
	const s = String(path == null ? '' : path)
	const i = s.lastIndexOf('/')
	return i < 0 ? '' : s.slice(0, i)
}

// The rows of the info panel for a summary: [{ key, value }] (key = suffix of plugins.WorkshopPrinting.gcodeLib.f_<key>); rows with no value are left out.
// `row` (optional) adds the size and the modified date of the file.
export function infoRows(summary, row) {
	const s = summary || {}
	const list = [
		['slicer', s.slicer ? String(s.slicer) : ''],
		['layers', num(s.layers) !== null ? String(s.layers) : ''],
		['layer_height', num(s.layer_height) !== null ? s.layer_height + ' mm' : ''],
		['time', formatDuration(num(s.time_s) !== null ? s.time_s : s.time_calc_s)],
		['filament_mm', formatLength(s.filament_mm)],
		['filament_cm3', formatVolume(s.filament_cm3)],
		['filament_g', formatWeight(s.filament_g)],
		['cost', formatCost(s.filament_cost)],
		['nozzle', formatTemp(s.nozzle_c)],
		['nozzle_mm', num(s.nozzle_mm) !== null ? s.nozzle_mm + ' mm' : ''],
		['bed', formatTemp(s.bed_c)],
		['chamber', formatTemp(s.chamber_c)],
		['bbox', formatBbox(s.bbox)],
		['object', s.object ? String(s.object) : '']
	]
	if (row) list.push(['size', formatBytes(row.size)], ['modified', formatDate(row.modified)])
	return list.filter((r) => r[1] !== '').map((r) => ({ key: r[0], value: r[1] }))
}

// The few numbers of a compact line / card: time, filament (weight preferred), layers
export function shortLine(summary) {
	const s = summary || {}
	const parts = [formatDuration(num(s.time_s) !== null ? s.time_s : s.time_calc_s), formatWeight(s.filament_g) || formatLength(s.filament_mm), num(s.layers) !== null ? s.layers + ' L' : '']
	return parts.filter(Boolean)
}
