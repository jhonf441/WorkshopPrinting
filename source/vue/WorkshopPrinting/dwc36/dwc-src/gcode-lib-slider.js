'use strict'

// The maths of the vertical two-handle layer slider (GcodeLayerSlider.vue), pure. Values are layer indexes 0..total-1; the TOP of the track is the last layer.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// the layer index under a pointer (clientY) for a track at rect {top, height}
export function valueAt(clientY, rect, total) {
	const n = Math.max(1, total | 0)
	if (n === 1 || !rect || !(rect.height > 0)) return 0
	const f = 1 - (clientY - rect.top) / rect.height
	return clamp(Math.round(f * (n - 1)), 0, n - 1)
}

// position of a value as a percentage from the top of the track
export function percentOf(v, total) {
	const n = Math.max(1, total | 0)
	return n === 1 ? 0 : (1 - clamp(v, 0, n - 1) / (n - 1)) * 100
}

// which handle a click on the track moves: the nearest one (the upper when equal and the click is above)
export function nearestHandle(lo, hi, v) {
	const dl = Math.abs(v - lo)
	const dh = Math.abs(v - hi)
	if (dl === dh) return v >= hi ? 'hi' : 'lo'
	return dl < dh ? 'lo' : 'hi'
}

// moves one handle to v keeping lo <= hi (a handle pushes nothing: it stops at the other one)
export function moveHandle(which, v, lo, hi, total) {
	const n = Math.max(1, total | 0)
	const x = clamp(Math.round(v), 0, n - 1)
	return which === 'lo' ? { lo: Math.min(x, hi), hi } : { lo, hi: Math.max(x, lo) }
}

// keyboard: arrows +-1, page keys +-10, Home / End to the ends. Returns the new {lo,hi} or null when the key is not for the slider.
export function keyMove(key, which, lo, hi, total) {
	const cur = which === 'lo' ? lo : hi
	let v = null
	if (key === 'ArrowUp' || key === 'ArrowRight') v = cur + 1
	else if (key === 'ArrowDown' || key === 'ArrowLeft') v = cur - 1
	else if (key === 'PageUp') v = cur + 10
	else if (key === 'PageDown') v = cur - 10
	else if (key === 'Home') v = 0
	else if (key === 'End') v = total - 1
	return v === null ? null : moveHandle(which, v, lo, hi, total)
}
