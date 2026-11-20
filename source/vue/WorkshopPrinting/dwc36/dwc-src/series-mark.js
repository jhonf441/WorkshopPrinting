'use strict'

// The mark of each series of the Status chart: a shape at the end of the line and in the legend, so the series are told apart without color (pure: test/series-mark.test.js).
// The line types keep their meaning (solid = temperature, dashes = target, dots = cap); the shape is what says WHICH heater.

export const SHAPES = ['circle', 'square', 'triangle', 'diamond']

// the shape of the series at position `i` of the list (they repeat after four)
export function markShape(i) {
	const n = Number.isInteger(i) && i >= 0 ? i : 0
	return SHAPES[n % SHAPES.length]
}

// the SVG path of a shape centered at (cx, cy) with radius r
export function markPath(shape, cx, cy, r) {
	const f = v => Number(v.toFixed(2))
	if (shape === 'square') return 'M' + f(cx - r) + ' ' + f(cy - r) + 'h' + f(2 * r) + 'v' + f(2 * r) + 'h' + f(-2 * r) + 'z'
	if (shape === 'triangle') return 'M' + f(cx) + ' ' + f(cy - r) + 'L' + f(cx + r) + ' ' + f(cy + r) + 'L' + f(cx - r) + ' ' + f(cy + r) + 'z'
	if (shape === 'diamond') return 'M' + f(cx) + ' ' + f(cy - r) + 'L' + f(cx + r) + ' ' + f(cy) + 'L' + f(cx) + ' ' + f(cy + r) + 'L' + f(cx - r) + ' ' + f(cy) + 'z'
	return 'M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0z'
}
