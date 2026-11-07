'use strict'

// ---- Bed zones: the pure part of dragging and resizing a zone on the map ----
//
// The component (BedZoneMap.vue) only turns pointer events into these calls. Everything is millimetres of the bed (see bed-zones-layout.js); `scale` is
// pixels per millimetre of the drawn map. A step of 0 (or null) means free movement; the usual step is SNAP_MM.

import { round1, overlaps, outside, EPS } from './bed-zones-layout.js'

export const SNAP_MM = 5 // the grid zones snap to
export const MIN_ZONE_MM = 5 // a zone is never made smaller than this
export const TOUCH_PX = 44 // the minimum touch target of a handle or a zone

// Snaps a value to the grid (0 / null = free, rounded to 0.1 mm)
export function snap(v, step) {
	return step > 0 ? Math.round(v / step) * step : round1(v)
}

// Pixels of the pointer to millimetres of the bed
export function pxToMm(px, scale) {
	return scale > 0 ? px / scale : 0
}

// Millimetres of a handle that must be at least TOUCH_PX wide on screen (the handle grows in the bed space when the map is small)
export function touchMm(scale) {
	return scale > 0 ? TOUCH_PX / scale : TOUCH_PX
}

// A rect kept inside the bed (size first, then position)
export function clampRect(r, bed) {
	const w = Math.max(MIN_ZONE_MM, Math.min(r.w, bed.width))
	const h = Math.max(MIN_ZONE_MM, Math.min(r.h, bed.length))
	return { x: round1(Math.max(0, Math.min(r.x, bed.width - w))), y: round1(Math.max(0, Math.min(r.y, bed.length - h))), w: round1(w), h: round1(h) }
}

// The rect moved by (dx, dy) mm from where the drag began, snapped and kept inside the bed (clamped AFTER snapping, so it never leaves the bed)
export function moveRect(start, dx, dy, bed, step) {
	return clampRect({ x: snap(start.x + dx, step), y: snap(start.y + dy, step), w: start.w, h: start.h }, bed)
}

// The rect resized by (dw, dh) mm from the bottom-right handle: the far edge lands on the grid and the rect stays inside the bed
export function resizeRect(start, dw, dh, bed, step) {
	const w = snap(start.x + start.w + dw, step) - start.x
	const h = snap(start.y + start.h + dh, step) - start.y
	return clampRect({ x: start.x, y: start.y, w: Math.min(w, bed.width - start.x), h: Math.min(h, bed.length - start.y) }, bed)
}

// Indexes of the rects that overlap another one or leave the bed: what the map paints as a problem
export function conflicts(rects, bed) {
	const bad = new Set()
	overlaps(rects).forEach(p => { bad.add(p[0]); bad.add(p[1]) })
	rects.forEach((r, i) => { if (outside(r, bed)) bad.add(i) })
	return Array.from(bad).sort((a, b) => a - b)
}

// The first free place (reading order, scanning every `step` mm) for a w x h rect that touches no other; null when there is none
export function freeSpot(rects, w, h, bed, step) {
	const s = step > 0 ? step : SNAP_MM
	for (let y = 0; y + h <= bed.length + EPS; y += s) {
		for (let x = 0; x + w <= bed.width + EPS; x += s) {
			const all = rects.concat([{ x, y, w, h }])
			if (!overlaps(all).some(p => p[1] === rects.length)) return { x, y, w, h }
		}
	}
	return null
}

// Undo as a stack of snapshots: the new stack with `state` on top, never more than `limit` entries
export function pushUndo(stack, state, limit) {
	const next = stack.concat([JSON.stringify(state)])
	return next.length > limit ? next.slice(next.length - limit) : next
}

// {state, stack}: the last snapshot and the stack without it; state is null when there is nothing to undo
export function popUndo(stack) {
	if (!stack.length) return { state: null, stack }
	return { state: JSON.parse(stack[stack.length - 1]), stack: stack.slice(0, -1) }
}

// Gives every zone WITHOUT a rect the first free spot, once, and touches no other zone: {zones, ok}. The size is the one of the last zone that has a rect, else a
// quarter of the shorter side; when it does not fit it is halved until it does (never below MIN_ZONE_MM). ok is false when some zone has no room (that zone stays
// without a rect). The same rule as dsf/bed_zones_geometry.py place_missing.
export function placeMissing(zones, bed) {
	const out = zones.map(z => Object.assign({}, z))
	const have = out.filter(z => z.rect).map(z => z.rect)
	const last = have.length ? have[have.length - 1] : null
	const side = round1(Math.min(bed.width, bed.length) / 4)
	let ok = true
	out.forEach(z => {
		if (z.rect) return
		let w = last ? last.w : side
		let h = last ? last.h : side
		let spot = freeSpot(have, w, h, bed, SNAP_MM)
		while (!spot && (w > MIN_ZONE_MM || h > MIN_ZONE_MM)) {
			w = round1(Math.max(MIN_ZONE_MM, w / 2))
			h = round1(Math.max(MIN_ZONE_MM, h / 2))
			spot = freeSpot(have, w, h, bed, SNAP_MM)
		}
		if (!spot) { ok = false; return }
		z.rect = spot
		have.push(spot)
	})
	return { zones: out, ok }
}
