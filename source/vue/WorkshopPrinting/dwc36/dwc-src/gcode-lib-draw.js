'use strict'

// Draws the layers of the library preview on a 2D canvas context (any object with the canvas 2D API: the tests pass a recorder). No Vue, no DOM.
// Layer shape (gcodelib.layers): { segments: { <type>: [[x0,y0,x1,y1,...], ...] }, travel?: [x0,y0,x1,y1, x0,y0,x1,y1, ...] }: every entry of a type is a polyline;
// travel is ONE flat list of moves of 4 numbers each (an array of polylines is accepted too).

import { project, scaleOf, thinPolyline, layerAlpha, typeColor, TRAVEL_COLOR, drawBudget, strideFor } from './gcode-lib-layers.js'

const BG = '#1b1b1f'
const BOX = 'rgba(160,160,160,0.35)'
const EXTRUSION_MM = 0.45 // the line is as wide as a typical extrusion, with a floor of 1 px so it never vanishes

// the travel moves of a layer as polylines [[x0,y0,x1,y1], ...]
export function travelLines(layer) {
	const t = layer && layer.travel
	if (!Array.isArray(t) || !t.length) return []
	if (Array.isArray(t[0])) return t
	const out = []
	for (let i = 0; i + 3 < t.length; i += 4) out.push([t[i], t[i + 1], t[i + 2], t[i + 3]])
	return out
}

// number of polylines of a layer in the visible types (for the stride)
function countLines(layer, hidden, travel) {
	let n = 0
	const seg = (layer && layer.segments) || {}
	Object.keys(seg).forEach((t) => { if (!hidden[t]) n += seg[t].length })
	if (travel) n += travelLines(layer).length
	return n
}

function strokeLines(ctx, fit, view, lines, stride, minPx) {
	let drawn = 0
	ctx.beginPath()
	for (let i = 0; i < lines.length; i += stride) {
		const pts = thinPolyline(lines[i], scaleOf(fit, view), minPx)
		if (!pts || pts.length < 4) continue
		const first = project(fit, view, pts[0], pts[1])
		ctx.moveTo(first[0], first[1])
		for (let k = 2; k < pts.length; k += 2) {
			const p = project(fit, view, pts[k], pts[k + 1])
			ctx.lineTo(p[0], p[1])
		}
		drawn++
	}
	ctx.stroke()
	return drawn
}

function drawLayer(ctx, st, layer, index) {
	const { fit, view, hidden, travel, top, stride } = st
	const width = Math.min(8, Math.max(1, EXTRUSION_MM * scaleOf(fit, view)))
	ctx.globalAlpha = layerAlpha(index, top)
	ctx.lineWidth = width
	const seg = layer.segments || {}
	if (travel && layer.travel) {
		ctx.strokeStyle = TRAVEL_COLOR
		ctx.lineWidth = 1
		st.stats.polylines += strokeLines(ctx, fit, view, travelLines(layer), stride, 1)
		ctx.lineWidth = width
	}
	Object.keys(seg).forEach((t) => {
		if (hidden[t]) return
		ctx.strokeStyle = typeColor(t)
		st.stats.polylines += strokeLines(ctx, fit, view, seg[t], stride, 0.8)
	})
}

// The bbox outline (the bed area the file uses)
export function drawBox(ctx, fit, view, bbox) {
	if (!bbox || !Array.isArray(bbox.min) || !Array.isArray(bbox.max)) return
	const a = project(fit, view, bbox.min[0], bbox.min[1])
	const b = project(fit, view, bbox.max[0], bbox.max[1])
	ctx.strokeStyle = BOX
	ctx.lineWidth = 1
	ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
}

// Draws the scene. layers = [{ index, layer }] in index order (bottom first); top = the index of the top layer.
// Returns { polylines, layers, stride } for tests and for the "too much to draw" hint.
export function drawScene(ctx, scene) {
	const { w, h, fit, view, layers, hidden, travel, top, moving, bbox } = scene
	ctx.setTransform(1, 0, 0, 1, 0, 0)
	ctx.globalAlpha = 1
	ctx.fillStyle = BG
	ctx.fillRect(0, 0, w, h)
	drawBox(ctx, fit, view, bbox)
	ctx.lineJoin = 'round'
	ctx.lineCap = 'round'
	const hid = hidden || {}
	const total = layers.reduce((n, l) => n + countLines(l.layer, hid, travel), 0)
	const stride = strideFor(total, drawBudget(!!moving))
	const st = { fit, view, hidden: hid, travel: !!travel, top, stride, stats: { polylines: 0 } }
	layers.forEach((l) => drawLayer(ctx, st, l.layer || {}, l.index))
	ctx.globalAlpha = 1
	return { polylines: st.stats.polylines, layers: layers.length, stride }
}
