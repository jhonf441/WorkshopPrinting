'use strict'

// The layer preview of the G-code library, pure (no Vue, no canvas): which windows of layers to ask the service for, the colour of every feature type,
// the fit of the bed / bbox into the canvas with zoom and pan, and what is worth drawing at a zoom. test/gcode-lib-layers.test.js.
//
// Layers are addressed by INDEX (0-based, slider order) here; apiRange() converts to the layer numbers the service uses
// (layers_table[i].layer when the table is known, else the index: the service numbers layers from 0), the one place to change if that ever differs.

export const CHUNK = 16 // layers per gcodelib.layers call (windows are aligned to it, so the LRU of windows is hit again when the slider moves)
export const DRAW_CAP = 3000 // layers fetched and drawn at once: the whole model (the service keeps at most 1500 rows in the layers table); only a bigger file is capped
export const LOW_SPAN = 20 // above this many layers the cheap detail is asked
export const PREFETCH = 1 // neighbour windows fetched after the visible ones

// ---------- windows of layers ----------

// The effective range to draw for the handles lo..hi (indexes, inclusive): the top DRAW_CAP layers; `capped` tells that lower layers were left out
export function effectiveRange(lo, hi, total, cap) {
	const n = Math.max(0, total | 0)
	if (n === 0) return { from: 0, to: -1, capped: false }
	const top = Math.min(n - 1, Math.max(0, Math.floor(hi)))
	const bottom = Math.min(top, Math.max(0, Math.floor(lo)))
	const c = cap || DRAW_CAP
	const from = Math.max(bottom, top - c + 1)
	return { from, to: top, capped: from > bottom }
}

// The aligned windows [{from, to}] (indexes, inclusive, clipped to total) that cover the layers from..to
export function windowsFor(from, to, total, chunk) {
	const size = chunk || CHUNK
	const n = Math.max(0, total | 0)
	const out = []
	if (n === 0 || to < from) return out
	const a = Math.max(0, from)
	const b = Math.min(n - 1, to)
	for (let s = Math.floor(a / size) * size; s <= b; s += size) out.push({ from: s, to: Math.min(n - 1, s + size - 1) })
	return out
}

// the windows to fetch right now: the visible ones first, then PREFETCH neighbours below (the user scrolls down more often than up)
export function plannedWindows(from, to, total, chunk, prefetch) {
	const size = chunk || CHUNK
	const visible = windowsFor(from, to, total, size)
	if (!visible.length) return { visible, ahead: [] }
	const extra = prefetch == null ? PREFETCH : prefetch
	const first = visible[0].from
	const ahead = windowsFor(Math.max(0, first - extra * size), first - 1, total, size)
	return { visible, ahead }
}

export function detailFor(span, zoom) {
	return span > LOW_SPAN && (zoom || 1) < 3 ? 'low' : 'normal'
}

export function windowKey(file, detail, win) {
	return file + '|' + detail + '|' + win.from
}

// layer number the service uses for an index
export function layerNo(index, table) {
	const row = Array.isArray(table) ? table[index] : null
	return row && typeof row.layer === 'number' ? row.layer : index
}

// the arguments of gcodelib.layers for a window
export function apiRange(win, table) {
	return { from: layerNo(win.from, table), to: layerNo(win.to, table) }
}

// The layers of the given fetched windows between from..to as [{ index, layer }] in index order. `get(win)` returns the cached answer of a window or null.
export function collectLayers(from, to, total, get, chunk) {
	const out = []
	windowsFor(from, to, total, chunk).forEach((w) => {
		const ans = get(w)
		if (!ans || !Array.isArray(ans.layers)) return
		ans.layers.forEach((layer, k) => {
			const index = w.from + k
			if (index >= from && index <= to) out.push({ index, layer })
		})
	})
	return out
}

// ---------- features: colour and legend ----------

// The colours of PrusaSlicer's preview (feature types)
const COLORS = {
	'perimeter': '#ffe64d',
	'external perimeter': '#ff7d38',
	'overhang perimeter': '#1f1fff',
	'internal infill': '#b03029',
	'solid infill': '#9654cc',
	'top solid infill': '#f04040',
	'bridge infill': '#4d80ba',
	'gap fill': '#ffffff',
	'skirt': '#00876e',
	'support material': '#00ff00',
	'support material interface': '#008000',
	'wipe tower': '#b3e3ab',
	'custom': '#5ed194',
	'ironing': '#a0a0a0',
	'unknown': '#ff9a3c', // a slicer that writes no feature types (Simplify3D, Cura without plugin): warm orange, never a derived light blue
	'cut': '#ffb300', // 2D files (laser, CNC): the cutting / engraving path, the plunges and the travel moves
	'plunge': '#e53935',
	'travel': '#8a8a8a'
}
const ALIASES = {
	'wall inner': 'perimeter', 'inner wall': 'perimeter', 'wall outer': 'external perimeter', 'outer wall': 'external perimeter',
	'overhang wall': 'overhang perimeter', 'sparse infill': 'internal infill', 'internal solid infill': 'solid infill',
	'top surface': 'top solid infill', 'bottom surface': 'solid infill', 'skirt/brim': 'skirt', 'brim': 'skirt', 'support': 'support material',
	'support interface': 'support material interface', 'prime tower': 'wipe tower', 'fill': 'internal infill'
}
export const TRAVEL_COLOR = '#8a8a8a'

export function normType(t) {
	const s = String(t == null ? '' : t).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
	return ALIASES[s] || s
}

// a stable colour for a type: the known one, else one derived from the name
export function typeColor(t) {
	const n = normType(t)
	if (COLORS[n]) return COLORS[n]
	let h = 0
	for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360
	return 'hsl(' + h + ', 60%, 55%)'
}

// i18n key (gcodeLib.t_<id>) for a known type, '' for an unknown one (the legend then shows the raw name)
export function typeKey(t) {
	const n = normType(t)
	return COLORS[n] ? 't_' + n.replace(/ /g, '_') : ''
}

// The legend: [{ type, color, key, on }] for the types of the file; `hidden` = a map type -> true
export function legendEntries(types, hidden) {
	const h = hidden || {}
	return (Array.isArray(types) ? types : []).map((t) => ({ type: t, color: typeColor(t), key: typeKey(t), on: !h[t] }))
}

// ---------- projection, zoom and pan ----------

// The base fit of a bbox ({min:[x,y,..], max:[x,y,..]}, mm) into a w x h canvas with `pad` px of margin
export function fitBox(bbox, w, h, pad) {
	const p = pad == null ? 12 : pad
	const b = bbox && Array.isArray(bbox.min) && Array.isArray(bbox.max) ? bbox : { min: [0, 0], max: [200, 200] }
	const bw = Math.max(1e-6, b.max[0] - b.min[0])
	const bh = Math.max(1e-6, b.max[1] - b.min[1])
	const s0 = Math.max(1e-6, Math.min((w - 2 * p) / bw, (h - 2 * p) / bh))
	return { bx: (b.min[0] + b.max[0]) / 2, by: (b.min[1] + b.max[1]) / 2, cx: w / 2, cy: h / 2, s0 }
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 40

export function clampZoom(z) {
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

export function newView() {
	return { zoom: 1, panX: 0, panY: 0 }
}

// px per mm
export function scaleOf(fit, view) {
	return fit.s0 * view.zoom
}

// world (mm, Y up) -> canvas px
export function project(fit, view, x, y) {
	const s = scaleOf(fit, view)
	return [fit.cx + (x - fit.bx) * s + view.panX, fit.cy - (y - fit.by) * s + view.panY]
}

// canvas px -> world mm
export function unproject(fit, view, px, py) {
	const s = scaleOf(fit, view)
	return [(px - fit.cx - view.panX) / s + fit.bx, -(py - fit.cy - view.panY) / s + fit.by]
}

// zoom by `factor` keeping the world point under (mx, my) fixed; returns a new view
export function zoomAt(fit, view, factor, mx, my) {
	const zoom = clampZoom(view.zoom * factor)
	if (zoom === view.zoom) return view
	const [wx, wy] = unproject(fit, view, mx, my)
	const s = fit.s0 * zoom
	const panX = mx - fit.cx - (wx - fit.bx) * s
	const panY = my - fit.cy + (wy - fit.by) * s
	return zoom === 1 ? newView() : { zoom, panX, panY }
}

export function panBy(view, dx, dy) {
	return { zoom: view.zoom, panX: view.panX + dx, panY: view.panY + dy }
}

// ---------- what is worth drawing ----------

// Drops the points closer than `minPx` canvas px to the last kept one (always keeps the first and the last): a flat polyline [x0,y0,x1,y1,...] in mm
export function thinPolyline(pts, scale, minPx) {
	if (!Array.isArray(pts) || pts.length <= 4) return pts || []
	const min = Math.max(0, minPx) / Math.max(1e-9, scale)
	const min2 = min * min
	const out = [pts[0], pts[1]]
	let lx = pts[0]
	let ly = pts[1]
	for (let i = 2; i < pts.length - 2; i += 2) {
		const dx = pts[i] - lx
		const dy = pts[i + 1] - ly
		if (dx * dx + dy * dy >= min2) {
			out.push(pts[i], pts[i + 1])
			lx = pts[i]
			ly = pts[i + 1]
		}
	}
	out.push(pts[pts.length - 2], pts[pts.length - 1])
	return out
}

// The opacity of a layer: the top one is full, the ones below fade a little so the top reads clearly
export function layerAlpha(index, top) {
	return index >= top ? 1 : 0.55
}

// Skip polylines entirely outside the canvas (px bbox test on their world bbox is too costly: test the first point only with a margin when zoomed in)
export function inCanvas(px, py, w, h, margin) {
	const m = margin == null ? 40 : margin
	return px >= -m && px <= w + m && py >= -m && py <= h + m
}

// how many polylines may be drawn per frame; above it a stride skips some (only while the user pans / zooms)
export function drawBudget(moving) {
	return moving ? 6000 : 40000
}

export function strideFor(count, budget) {
	return count > budget ? Math.ceil(count / budget) : 1
}

// the label of a slider position: Z of the layer (table row) and its number
export function layerLabel(index, table, total) {
	const row = Array.isArray(table) ? table[index] : null
	const z = row && typeof row.z === 'number' ? row.z : null
	return { n: Math.min(total, index + 1), total, z }
}
