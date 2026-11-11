'use strict'

// Draws the 3D preview of the library on a 2D canvas context (any object with the canvas 2D API: the tests pass a recorder). No Vue, no DOM.
// Layer shape (gcodelib.layers): { z, segments: { <type>: [[x0,y0,x1,y1,...], ...] }, travel?: [x0,y0,x1,y1, ...] } (travel: 4 numbers per move).
// A frame is DRAWN IN STEPS: drawScene3d(ctx, scene, state) draws layers (farthest first) until the time budget is spent and returns the state; while
// `state.done` is false the caller asks again on the next animation frame with the same state, so a heavy file never blocks the thread for long.

import { typeColor, TRAVEL_COLOR } from './gcode-lib-layers.js'
import { projectInto, cameraKey, depthOrder, layerPick, keepRatio, segmentBudget, shadeFor, lineWidthFor, FRAME_MS, project } from './gcode-lib-view3d.js'

const BG = '#1b1b1f'
const BED_FILL = 'rgba(120,120,130,0.10)'
const BED_LINE = 'rgba(170,170,180,0.45)'
const GRID_LINE = 'rgba(170,170,180,0.14)'
const EXTRUSION_MM = 0.45
const MIN_PX = 0.7 // points closer than this on the screen are merged
const GRID_MM = 50
export const AXIS_COLORS = { x: '#e5484d', y: '#46a758', z: '#3e63dd' }

function polylineSegments(pts) {
	return Array.isArray(pts) && pts.length >= 4 ? (pts.length >> 1) - 1 : 0
}

// the moves of a layer as polylines (travel is a flat list of moves; an array of polylines is accepted too)
export function travelLines(layer) {
	const t = layer && layer.travel
	if (!Array.isArray(t) || !t.length) return []
	if (Array.isArray(t[0])) return t
	const out = []
	for (let i = 0; i + 3 < t.length; i += 4) out.push([t[i], t[i + 1], t[i + 2], t[i + 3]])
	return out
}

// the visible polylines of a layer: [{ type, color, lines }] (the travel moves last, type '' )
function groupsOf(layer, hidden, travel) {
	const out = []
	const seg = (layer && layer.segments) || {}
	Object.keys(seg).forEach((t) => { if (!hidden[t] && seg[t] && seg[t].length) out.push({ type: t, color: typeColor(t), lines: seg[t] }) })
	if (travel) {
		const lines = travelLines(layer)
		if (lines.length) out.push({ type: '', color: TRAVEL_COLOR, lines, travel: true })
	}
	return out
}

export function countSegments(layer, hidden, travel) {
	let n = 0
	groupsOf(layer, hidden || {}, travel).forEach((g) => { for (let i = 0; i < g.lines.length; i++) n += polylineSegments(g.lines[i]) })
	return n
}

// all the polylines of a group projected to the screen: { xy: Float32Array of pairs, off: Int32Array of the first pair of every polyline (+ the end) }
function projectGroup(lines, frame, cam, z) {
	let total = 0
	for (let i = 0; i < lines.length; i++) total += lines[i] ? lines[i].length >> 1 : 0
	const xy = new Float32Array(total * 2)
	const off = new Int32Array(lines.length + 1)
	const tmp = [0, 0, 0, 0]
	let p = 0
	for (let i = 0; i < lines.length; i++) {
		off[i] = p
		const pts = lines[i]
		for (let k = 0; pts && k + 1 < pts.length; k += 2) {
			projectInto(frame, cam, pts[k], pts[k + 1], z, tmp, false)
			xy[p * 2] = tmp[0]
			xy[p * 2 + 1] = tmp[1]
			p++
		}
	}
	off[lines.length] = p
	return { xy, off }
}

// the projected group, from the cache while the camera and the layer are the same (the cache is a WeakMap owned by the caller, keyed by the layer object)
function projected(scene, layer, group, z, key, useCache) {
	const cache = scene.cache
	let entry = cache && useCache ? cache.get(layer) : null
	if (!entry || entry.key !== key) {
		entry = { key, groups: {} }
		if (cache && useCache) cache.set(layer, entry)
	}
	const id = group.travel ? '\u0000travel' : group.type
	if (!entry.groups[id]) entry.groups[id] = projectGroup(group.lines, scene.frame, scene.cam, z)
	return entry.groups[id]
}

function strokeGroup(ctx, pg, st) {
	const { xy, off } = pg
	let drawn = 0
	ctx.beginPath()
	for (let i = 0; i + 1 < off.length; i++) {
		const a = off[i]
		const b = off[i + 1]
		const segs = b - a - 1
		if (segs < 1) continue
		st.credit += st.ratio * segs
		if (st.credit < segs) continue // thinned out by the budget
		st.credit -= segs
		let lx = xy[a * 2]
		let ly = xy[a * 2 + 1]
		ctx.moveTo(lx, ly)
		for (let k = a + 1; k < b; k++) {
			const x = xy[k * 2]
			const y = xy[k * 2 + 1]
			if (k < b - 1 && Math.abs(x - lx) < MIN_PX && Math.abs(y - ly) < MIN_PX) continue
			ctx.lineTo(x, y)
			lx = x
			ly = y
		}
		drawn += segs
	}
	ctx.stroke()
	return drawn
}

// bed rectangle (z = 0), a coarse grid and the XYZ axes at its min corner; `bed` = { min:[x,y], max:[x,y] }
export function drawReference(ctx, scene, bed) {
	if (!bed || !Array.isArray(bed.min) || !Array.isArray(bed.max)) return
	const { frame, cam } = scene
	const P = (x, y, z) => project(frame, cam, x, y, z || 0)
	const x0 = bed.min[0]
	const y0 = bed.min[1]
	const x1 = bed.max[0]
	const y1 = bed.max[1]
	const c = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
	ctx.globalAlpha = 1
	ctx.beginPath()
	ctx.moveTo(c[0][0], c[0][1])
	for (let i = 1; i < 4; i++) ctx.lineTo(c[i][0], c[i][1])
	ctx.closePath()
	ctx.fillStyle = BED_FILL
	ctx.fill()
	ctx.strokeStyle = BED_LINE
	ctx.lineWidth = 1
	ctx.stroke()
	if ((x1 - x0) / GRID_MM < 40 && (y1 - y0) / GRID_MM < 40) {
		ctx.beginPath()
		for (let x = Math.ceil(x0 / GRID_MM) * GRID_MM; x < x1; x += GRID_MM) { const a = P(x, y0); const b = P(x, y1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
		for (let y = Math.ceil(y0 / GRID_MM) * GRID_MM; y < y1; y += GRID_MM) { const a = P(x0, y); const b = P(x1, y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
		ctx.strokeStyle = GRID_LINE
		ctx.stroke()
	}
	const len = Math.max(15, Math.min(x1 - x0, y1 - y0) * 0.18)
	const o = P(x0, y0, 0)
	const axes = [['x', P(x0 + len, y0, 0)], ['y', P(x0, y0 + len, 0)], ['z', P(x0, y0, len)]]
	ctx.lineWidth = 2
	ctx.font = '11px sans-serif'
	axes.forEach(([id, e]) => {
		ctx.strokeStyle = AXIS_COLORS[id]
		ctx.fillStyle = AXIS_COLORS[id]
		ctx.beginPath()
		ctx.moveTo(o[0], o[1])
		ctx.lineTo(e[0], e[1])
		ctx.stroke()
		ctx.fillText(id.toUpperCase(), e[0] + 3, e[1] - 3)
	})
}

// Starts a frame: clears, draws the reference and plans which layers to draw (LOD) and the share of polylines to keep.
// scene = { w, h, frame, cam, layers: [{ index, z, layer }], hidden, travel, top, moving, bed, cache?, budgetMs?, now? }
function plan(ctx, scene) {
	const hidden = scene.hidden || {}
	ctx.setTransform(1, 0, 0, 1, 0, 0)
	ctx.globalAlpha = 1
	ctx.fillStyle = BG
	ctx.fillRect(0, 0, scene.w, scene.h)
	drawReference(ctx, scene, scene.bed)
	const ordered = depthOrder(scene.layers, scene.frame)
	const picked = layerPick(ordered.length, !!scene.moving).map((i) => ordered[i])
	// the lowest and the top index of the window, for the shading
	let from = Infinity
	scene.layers.forEach((l) => { if (l.index < from) from = l.index })
	const counts = picked.map((l) => countSegments(l.layer, hidden, scene.travel))
	const total = counts.reduce((a, b) => a + b, 0)
	return { picked, cursor: 0, from, ratio: keepRatio(total, segmentBudget(!!scene.moving)), credit: 0, total, drawn: 0, layersDrawn: 0, done: picked.length === 0, key: cameraKey(scene.frame, scene.cam) }
}

export function drawScene3d(ctx, scene, state) {
	const st = state || plan(ctx, scene)
	if (st.done) return st
	const hidden = scene.hidden || {}
	const now = scene.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
	const budget = scene.budgetMs == null ? FRAME_MS : scene.budgetMs
	const t0 = now()
	ctx.lineJoin = 'round'
	ctx.lineCap = 'round'
	while (st.cursor < st.picked.length) {
		const item = st.picked[st.cursor++]
		const z = typeof item.z === 'number' ? item.z : 0
		const k = projectInto(scene.frame, scene.cam, scene.frame.target[0], scene.frame.target[1], z, [0, 0, 0, 0], false)[3]
		const width = lineWidthFor(EXTRUSION_MM, scene.frame.scale, scene.cam.zoom, k)
		ctx.globalAlpha = shadeFor(item.index, st.from, scene.top)
		groupsOf(item.layer, hidden, scene.travel).forEach((g) => {
			ctx.strokeStyle = g.color
			ctx.lineWidth = g.travel ? 1 : width
			st.drawn += strokeGroup(ctx, projected(scene, item.layer, g, z, st.key, !scene.moving), st)
		})
		st.layersDrawn++
		if (now() - t0 >= budget) break
	}
	ctx.globalAlpha = 1
	st.done = st.cursor >= st.picked.length
	return st
}
