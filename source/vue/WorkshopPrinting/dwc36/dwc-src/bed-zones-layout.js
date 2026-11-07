'use strict'

// ---- Bed zones: geometry checks (pure) ----
//
// Millimetres in MAP space: origin at the top-left corner of the bed seen from above, x to the right, y downwards. The geometry is the size of the bed and
// a rect per zone, EXACTLY as the user left them: nothing here moves or resizes a zone by itself. Layout and view only: the heating never reads it.

export const BED_MIN = 10
export const BED_MAX = 5000
export const EPS = 1e-6
export const DEFAULT_BED = { width: 300, length: 300 }

const finite = v => typeof v === 'number' && isFinite(v)

// 0.1 mm, the same rounding as the service (floor(v * 10 + 0.5) / 10, no banker rounding)
export function round1(v) {
	return Math.floor(v * 10 + 0.5) / 10
}

// Pairs [i, j], i < j, of rects that share area (touching edges is not an overlap)
export function overlaps(rects) {
	const out = []
	for (let i = 0; i < rects.length; i++) {
		for (let j = i + 1; j < rects.length; j++) {
			const a = rects[i], b = rects[j]
			if (a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS) out.push([i, j])
		}
	}
	return out
}

// True when the rect is not completely inside the bed {width, length}
export function outside(r, bed) {
	return r.x < -EPS || r.y < -EPS || r.x + r.w > bed.width + EPS || r.y + r.h > bed.length + EPS
}

// The bed size from the object model (move.axes X and Y: max - min), else the default. Millimetres.
export function bedFromModel(model) {
	const axes = (model && model.move && model.move.axes) || []
	const span = letter => {
		const a = axes.find(x => x && x.letter === letter)
		return a && finite(a.max) && finite(a.min) && a.max - a.min >= BED_MIN ? round1(a.max - a.min) : null
	}
	const w = span('X'), l = span('Y')
	return { width: w || DEFAULT_BED.width, length: l || DEFAULT_BED.length, fromMachine: !!(w && l) }
}

// A geometry block: the size of the bed, nothing else (the rect of every zone lives in the zone)
export function newGeometry(bed) {
	return { bed: { width: bed.width, length: bed.length } }
}

// Problems of a geometry as a list of {field, key, n?, other?}; keys of the area bedZones (the page translates them). [] when it is fine.
export function geometryProblems(geometry, zones) {
	const out = []
	const b = geometry.bed || {}
	const inRange = (v, lo, hi) => finite(v) && v >= lo && v <= hi
	if (!inRange(b.width, BED_MIN, BED_MAX) || !inRange(b.length, BED_MIN, BED_MAX)) out.push({ field: 'bed', key: 'zones_layout_err_bed' })
	if (out.length) return out
	const rects = zones.map(z => z.rect)
	if (rects.some(r => !r || !(r.w > 0) || !(r.h > 0))) { out.push({ field: 'zones', key: 'zones_layout_err_rect' }); return out }
	rects.forEach((r, i) => { if (outside(r, b)) out.push({ field: 'zones[' + i + ']', key: 'zones_layout_err_outside', n: i + 1 }) })
	overlaps(rects).forEach(p => out.push({ field: 'zones[' + p[1] + ']', key: 'zones_layout_err_overlap', n: p[1] + 1, other: p[0] + 1 }))
	return out
}
