'use strict'

// The KINDS of file of the G-code library (3D print, laser, CNC, travel-only test, unknown), pure: how a kind is labelled, coloured and iconed, how a file's kind is
// worked out (tolerating the old service shape that has no `kind`), the tag chips, the kind filter (state, saved choice, arguments of gcodelib.list, counts), the 2D layer
// names, the empty-state decision and the info rows per kind. No Vue, no texts (keys under plugins.WorkshopPrinting.gcodeLib.kinds.*). test/gcode-lib-kinds.test.js.

import { infoRows, shortLine, formatDuration, formatLength, formatBytes, formatDate } from './gcode-lib-format.js'
import { browserStorage } from './gcode-lib-view3d.js'

export const KINDS = ['fff', 'laser', 'cnc', 'travel', 'unknown']
export const FILTER_KINDS = ['fff', 'laser', 'cnc', 'travel'] // the chips after "All" ("travel" is shown as "Test"); `unknown` files only appear under All
export const FILTER_KEY = 'workshopPrinting.gcodeLib.kindFilter'
export const TAG_LIMIT = 3

const META = {
	fff: { icon: 'mdi-printer-3d-nozzle-outline', color: 'primary' },
	laser: { icon: 'mdi-laser-pointer', color: 'deep-orange' },
	cnc: { icon: 'mdi-saw-blade', color: 'teal' },
	travel: { icon: 'mdi-vector-polyline', color: 'blue-grey' },
	unknown: { icon: 'mdi-help-circle-outline', color: 'grey' }
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)

// { id, icon, color, label (key suffix: gcodeLib.kinds.k_<id>), short (kinds.s_<id>, the filter chip) }
export function kindMeta(kind) {
	const id = KINDS.indexOf(kind) >= 0 ? kind : 'unknown'
	return { id, icon: META[id].icon, color: META[id].color, label: 'k_' + id, short: 's_' + id }
}

// The kind of a summary. Without `summary` (not read yet) there is none (null). An old service sends no kind: layers > 0 is a print, anything else unknown.
export function kindOf(summary) {
	if (!summary || typeof summary !== 'object') return null
	if (KINDS.indexOf(summary.kind) >= 0) return summary.kind
	return num(summary.layers) !== null && summary.layers > 0 ? 'fff' : 'unknown'
}

// the kind of a list row or an info answer ({summary} or {row})
export function rowKind(row) {
	return kindOf(row && row.summary)
}

// '2d' for laser / CNC / travel files (the service's `plane` when it sends one), '3d' otherwise
export function planeOf(info, summary) {
	const p = info && info.plane
	if (p === '2d' || p === '3d') return p
	const k = kindOf(summary || (info && info.summary))
	return k === 'laser' || k === 'cnc' || k === 'travel' ? '2d' : '3d'
}

// a file that is not a print has no material temperatures to compare with a recipe
export function isPrint(kind) {
	return kind === 'fff'
}
export function isNotPrint(kind) {
	return kind === 'laser' || kind === 'cnc' || kind === 'travel'
}

// ---------- tags ----------

const KNOWN_TAGS = { 'lightburn': 'tag_lightburn', 'macro-calls': 'tag_macro_calls', 'live-job-markers': 'tag_live_job_markers', 'has-thumbnail': 'tag_has_thumbnail' }

// key suffix of a tag with a translated text ('' = show the raw tag, e.g. a slicer name)
export function tagKey(tag) {
	return KNOWN_TAGS[String(tag).toLowerCase()] || ''
}

// the tags to show: at most `max` and how many are hidden ("+N"); only non-empty strings, without repeats
export function tagChips(tags, max) {
	const seen = {}
	const all = (Array.isArray(tags) ? tags : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => t && !seen[t.toLowerCase()] && (seen[t.toLowerCase()] = true))
	const m = Math.max(0, max == null ? TAG_LIMIT : max)
	return { shown: all.slice(0, m), more: Math.max(0, all.length - m), all }
}

// ---------- the kind filter ----------

// [] = every kind. Only known filter kinds, in chip order, without repeats; all four chosen is the same as none chosen.
export function normalizeFilter(list) {
	const set = Array.isArray(list) ? list : (typeof list === 'string' && list ? [list] : [])
	const out = FILTER_KINDS.filter((k) => set.indexOf(k) >= 0)
	return out.length === FILTER_KINDS.length ? [] : out
}

// a click on a chip: 'all' clears, a kind is toggled
export function toggleKind(filter, id) {
	if (id === 'all') return []
	const cur = normalizeFilter(filter)
	const next = cur.indexOf(id) >= 0 ? cur.filter((k) => k !== id) : cur.concat([id])
	return normalizeFilter(next)
}

export function isAll(filter) {
	return normalizeFilter(filter).length === 0
}

// the value of the `kind` argument of gcodelib.list, or undefined for every kind
export function filterArg(filter) {
	const f = normalizeFilter(filter)
	return f.length ? f : undefined
}

// the chips: [{ id, count (null when unknown), on }]; "All" counts every ready file (unknown included)
export function filterChips(filter, counts) {
	const f = normalizeFilter(filter)
	const c = counts && typeof counts === 'object' ? counts : null
	const n = (k) => (c && num(c[k]) !== null ? c[k] : null)
	const total = c ? KINDS.reduce((a, k) => a + (n(k) || 0), 0) : null
	const out = [{ id: 'all', count: total, on: f.length === 0 }]
	FILTER_KINDS.forEach((k) => out.push({ id: k, count: n(k), on: f.indexOf(k) >= 0 }))
	return out
}

// "12 of 40" style numbers: the files shown by the filter out of all the ready ones, or '' when the counts are unknown
export function countsText(filter, counts) {
	const chips = filterChips(filter, counts)
	if (chips[0].count === null) return ''
	const f = normalizeFilter(filter)
	const shown = f.length ? f.reduce((a, k) => a + (num(counts[k]) || 0), 0) : chips[0].count
	return shown + ' / ' + chips[0].count
}

export function loadFilter(storage) {
	try {
		const s = storage === undefined ? browserStorage() : storage
		const raw = s ? s.getItem(FILTER_KEY) : null
		return raw ? normalizeFilter(JSON.parse(raw)) : []
	} catch (e) {
		return []
	}
}

export function saveFilter(storage, filter) {
	try {
		const s = storage === undefined ? browserStorage() : storage
		if (!s) return false
		s.setItem(FILTER_KEY, JSON.stringify(normalizeFilter(filter)))
		return true
	} catch (e) {
		return false
	}
}

// ---------- 2D layers ----------

// the name of a 2D layer: the one the file gave (LightBurn "C02"), else "L<n>" (n from 1)
export function layerName(row, index) {
	const n = row && row.name != null ? String(row.name).trim() : ''
	return n || 'L' + (index + 1)
}

// [{ index, name }] for the layers of a file: from the layers table when it has rows, else `total` plain numbers
export function layerNames(table, total) {
	const t = Array.isArray(table) ? table : []
	const n = Math.max(t.length, Math.max(0, total | 0))
	const out = []
	for (let i = 0; i < n; i++) out.push({ index: i, name: layerName(t[i], i) })
	return out
}

// the slider range (lo, hi in layer indexes) of a pick in the layer list: an index selects that layer alone, null selects all of them
export function layerPickRange(index, total) {
	const last = Math.max(0, (total | 0) - 1)
	if (index === null || index === undefined) return { lo: 0, hi: last }
	const i = Math.min(last, Math.max(0, index | 0))
	return { lo: i, hi: i }
}

// which layer the range shows alone (its index), or null when it shows several
export function pickedLayer(lo, hi) {
	return lo === hi ? lo : null
}

// next / previous layer of the stepper, wrapping to "all" (null) at both ends: null -> 0 -> 1 ... -> last -> null
export function stepLayer(current, total, dir) {
	const last = (total | 0) - 1
	if (last < 0) return null
	if (current === null || current === undefined) return dir > 0 ? 0 : last
	const next = current + (dir > 0 ? 1 : -1)
	return next < 0 || next > last ? null : next
}

// ---------- what to say when there is nothing to draw ----------

// null when there is something to draw; else the id of the sentence (key gcodeLib.kinds.empty_<id>): pending, error, or the kind of a file with no geometry
export function emptyState(row, summary) {
	const st = (row && row.state) || (summary ? 'ready' : 'pending')
	if (st === 'error') return 'error'
	if (st === 'pending' || st === 'working' || !summary) return 'pending'
	if (num(summary.layers) !== null && summary.layers > 0) return null
	const k = kindOf(summary)
	return k
}

// ---------- numbers per kind ----------

function names(summary, table) {
	const n = layerNames(table, summary && summary.layers)
	if (!n.length) return ''
	const some = n.slice(0, 6).map((l) => l.name).join(', ')
	return n.length > 6 ? some + ' +' + (n.length - 6) : some
}

// The rows of the info panel for a file of that kind: [{ key, value, labelKey? }] (labelKey = a full key under gcodeLib, default f_<key>).
// 3D prints: the usual rows. Laser / CNC / travel: cut length, travel length, max power, feed, time, layers by name, size; no filament, nozzle or bed rows.
export function kindInfoRows(summary, row, table) {
	const kind = kindOf(summary)
	if (kind === null || kind === 'fff' || kind === 'unknown') return infoRows(summary, row)
	const s = summary
	const list = [
		['slicer', s.slicer ? String(s.slicer) : '', null],
		['cut_len', formatLength(s.cut_mm), 'kinds.f_cut_len'],
		['travel_len', formatLength(s.travel_mm), 'kinds.f_travel_len'],
		['power_max', num(s.power_max) !== null && s.power_max > 0 ? 'S ' + s.power_max : '', 'kinds.f_power_max'],
		['feed', num(s.feed_mm_min) !== null && s.feed_mm_min > 0 ? Math.round(s.feed_mm_min) + ' mm/min' : '', 'kinds.f_feed'],
		['time', formatDuration(num(s.time_s) !== null ? s.time_s : s.time_calc_s), null],
		['layers', num(s.layers) !== null && s.layers > 0 ? String(s.layers) : '', null],
		['layer_names', names(s, table), 'kinds.f_layer_names'],
		['area', s.bbox && Array.isArray(s.bbox.min) && Array.isArray(s.bbox.max) ? (s.bbox.max[0] - s.bbox.min[0]).toFixed(0) + ' x ' + (s.bbox.max[1] - s.bbox.min[1]).toFixed(0) + ' mm' : '', 'kinds.f_area']
	]
	if (row) list.push(['size', formatBytes(row.size), null], ['modified', formatDate(row.modified), null])
	return list.filter((r) => r[1] !== '').map((r) => (r[2] ? { key: r[0], value: r[1], labelKey: r[2] } : { key: r[0], value: r[1] }))
}

// the compact line of a row / card: 3D prints as always; the others time, cut length and layers
export function kindShortLine(summary) {
	const k = kindOf(summary)
	if (k === null || k === 'fff' || k === 'unknown') return shortLine(summary)
	const s = summary
	const parts = [formatDuration(num(s.time_s) !== null ? s.time_s : s.time_calc_s), formatLength(s.cut_mm), num(s.layers) !== null && s.layers > 0 ? s.layers + ' L' : '']
	return parts.filter(Boolean)
}

// the rows the info card keeps (four at most), per kind
export function cardKeys(kind) {
	return isNotPrint(kind) ? ['time', 'cut_len', 'power_max', 'layers'] : ['time', 'filament_g', 'filament_mm', 'layers', 'layer_height', 'bbox']
}
