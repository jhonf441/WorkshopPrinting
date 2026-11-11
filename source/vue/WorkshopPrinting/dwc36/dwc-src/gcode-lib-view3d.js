'use strict'

// The 3D orbit camera of the G-code library preview, pure (no Vue, no canvas, no DOM): camera state, view presets, orbit / zoom / pan maths, orthographic and
// perspective projection, fit to the bbox, depth order of the layers, the per-frame draw budget (level of detail) and the saved view (localStorage, guarded).
// World: X right, Y away, Z up (mm; z = the layer z). Yaw turns around Z (0 = looking from the front, from -Y toward +Y), pitch lifts the camera
// (0 = horizon, 90 degrees = straight down). test/gcode-lib-view3d.test.js.

export const PITCH_MIN = 0
export const PITCH_MAX = Math.PI / 2
export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 60
export const ISO_PITCH = Math.atan(1 / Math.SQRT2) // the true isometric elevation, 35.26 degrees
export const ORBIT_RAD_PER_PX = 0.008
export const VIEW_KEY = 'workshopPrinting.gcodeLib.view3d'
export const PRESET_IDS = ['iso', 'persp', 'front', 'side', 'top'] // the choices of the "View" control (plus 'free' once the user drags)

// preset -> camera angles; `ortho` only where the preset decides the projection (the others keep the one the user picked)
const PRESETS = {
	iso: { yaw: Math.PI / 4, pitch: ISO_PITCH, ortho: true },
	persp: { yaw: Math.PI / 4, pitch: 0.5, ortho: false },
	front: { yaw: 0, pitch: 0 },
	side: { yaw: Math.PI / 2, pitch: 0 },
	top: { yaw: 0, pitch: PITCH_MAX }
}

export function clamp(v, lo, hi) {
	return Math.min(hi, Math.max(lo, v))
}

export function wrapYaw(y) {
	const t = Math.PI * 2
	let r = (y + Math.PI) % t
	if (r < 0) r += t
	return r - Math.PI
}

// ---------- camera ----------

// { preset, yaw, pitch, ortho, zoom, panX, panY }: zoom and pan are on the screen (px), the angles in radians
export function cameraFor(preset, ortho) {
	const p = PRESETS[preset] || PRESETS.iso
	return { preset: PRESETS[preset] ? preset : 'iso', yaw: p.yaw, pitch: p.pitch, ortho: typeof ortho === 'boolean' ? ortho : p.ortho !== false, zoom: 1, panX: 0, panY: 0 }
}

// the camera of a preset chosen from the control: angles and (iso / perspective) projection come from the preset, zoom and pan are reset (it is a fit)
export function applyPreset(cam, preset) {
	const decided = PRESETS[preset] ? PRESETS[preset].ortho : undefined
	return cameraFor(preset, decided === undefined ? cam.ortho : decided)
}

// the projection switch keeps the angles; the preset becomes 'free' only when it was one that decides the projection
export function setProjection(cam, ortho) {
	const o = !!ortho
	const preset = (cam.preset === 'iso' && !o) || (cam.preset === 'persp' && o) ? 'free' : cam.preset
	return Object.assign({}, cam, { ortho: o, preset })
}

// drag by (dx, dy) px: yaw follows the horizontal drag, pitch the vertical one (clamped, never under the bed or past the zenith)
export function orbit(cam, dx, dy, radPerPx) {
	const k = radPerPx || ORBIT_RAD_PER_PX
	return Object.assign({}, cam, { preset: 'free', yaw: wrapYaw(cam.yaw - dx * k), pitch: clamp(cam.pitch + dy * k, PITCH_MIN, PITCH_MAX) })
}

export function rotateBy(cam, dYaw, dPitch) {
	return Object.assign({}, cam, { preset: 'free', yaw: wrapYaw(cam.yaw + dYaw), pitch: clamp(cam.pitch + dPitch, PITCH_MIN, PITCH_MAX) })
}

// the screen position O of the scene centre moves so the point (mx, my) under the cursor stays fixed while the zoom changes by `factor`
export function zoomAt(frame, cam, factor, mx, my) {
	const zoom = clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX)
	if (zoom === cam.zoom) return cam
	const f = zoom / cam.zoom
	const ox = frame.cx + cam.panX
	const oy = frame.cy + cam.panY
	return Object.assign({}, cam, { zoom, panX: mx + (ox - mx) * f - frame.cx, panY: my + (oy - my) * f - frame.cy })
}

export function panBy(cam, dx, dy) {
	return Object.assign({}, cam, { panX: cam.panX + dx, panY: cam.panY + dy })
}

// back to zoom 1 and centered, keeping the angles ("Fit")
export function fitCamera(cam) {
	return Object.assign({}, cam, { zoom: 1, panX: 0, panY: 0 })
}

// an in-between camera for the short transition between two cameras (t 0..1, ease out); the yaw takes the short way round
export function lerpCamera(a, b, t) {
	const e = 1 - Math.pow(1 - clamp(t, 0, 1), 3)
	let dy = wrapYaw(b.yaw - a.yaw)
	if (e >= 1) return Object.assign({}, b)
	return {
		preset: b.preset, ortho: e < 0.5 ? a.ortho : b.ortho,
		yaw: wrapYaw(a.yaw + dy * e), pitch: a.pitch + (b.pitch - a.pitch) * e,
		zoom: a.zoom + (b.zoom - a.zoom) * e, panX: a.panX + (b.panX - a.panX) * e, panY: a.panY + (b.panY - a.panY) * e
	}
}

// ---------- scene box ----------

// The bbox of the file as { min:[x,y,z], max:[x,y,z] }: z from the bbox when it has it, else from the layers table (last z), else 0..10
export function bbox3(bbox, table) {
	const b = bbox && Array.isArray(bbox.min) && Array.isArray(bbox.max) ? bbox : { min: [0, 0], max: [200, 200] }
	const last = Array.isArray(table) && table.length ? table[table.length - 1] : null
	const lastZ = last && typeof last.z === 'number' ? last.z : null
	const z0 = typeof b.min[2] === 'number' ? b.min[2] : 0
	const z1 = typeof b.max[2] === 'number' && b.max[2] > z0 ? b.max[2] : (lastZ !== null && lastZ > z0 ? lastZ : z0 + 10)
	return { min: [b.min[0], b.min[1], Math.min(0, z0)], max: [b.max[0], b.max[1], z1] }
}

// z of a layer: its own (gcodelib.layers answers `z`), else the layers table, else spread over the box height
export function layerZ(index, layer, table, box, total) {
	if (layer && typeof layer.z === 'number') return layer.z
	const row = Array.isArray(table) ? table[index] : null
	if (row && typeof row.z === 'number') return row.z
	const n = Math.max(1, total | 0)
	return box.min[2] + (box.max[2] - box.min[2]) * ((index + 1) / n)
}

// ---------- frame and projection ----------

function basis(cam) {
	const sy = Math.sin(cam.yaw)
	const cy = Math.cos(cam.yaw)
	const sp = Math.sin(cam.pitch)
	const cp = Math.cos(cam.pitch)
	return {
		right: [cy, sy, 0],
		up: [-sy * sp, cy * sp, cp],
		fwd: [-sy * cp, cy * cp, -sp], // from the camera toward the target
		sp
	}
}

// px per mm at the target and the screen offset that centres the box, for the camera angles and projection (zoom 1, no pan).
// `box` = bbox3(...), w x h = the canvas, pad = margin in px. The result is the `frame` every projection needs; it changes only with the file, the size and the angles.
export function frameFor(box, w, h, cam, pad) {
	const p = pad == null ? 14 : pad
	const target = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]
	const dx = box.max[0] - box.min[0]
	const dy = box.max[1] - box.min[1]
	const dz = box.max[2] - box.min[2]
	const radius = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz) / 2)
	const dist = radius * 3.2
	const b = basis(cam)
	const base = { cx: w / 2, cy: h / 2, target, dist, ortho: cam.ortho, right: b.right, up: b.up, fwd: b.fwd, scale: 1, ox: 0, oy: 0 }
	let minX = Infinity
	let maxX = -Infinity
	let minY = Infinity
	let maxY = -Infinity
	const tmp = [0, 0, 0, 0]
	for (let i = 0; i < 8; i++) {
		projectInto(base, cam, i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2], tmp, true)
		minX = Math.min(minX, tmp[0]); maxX = Math.max(maxX, tmp[0])
		minY = Math.min(minY, tmp[1]); maxY = Math.max(maxY, tmp[1])
	}
	const halfW = Math.max(1e-6, (maxX - minX) / 2)
	const halfH = Math.max(1e-6, (maxY - minY) / 2)
	const scale = Math.max(1e-6, Math.min((w / 2 - p) / halfW, (h / 2 - p) / halfH))
	return Object.assign(base, { scale, ox: -((minX + maxX) / 2) * scale, oy: ((minY + maxY) / 2) * scale })
}

// project the world point into out = [sx, sy, depth, k]: depth = distance along the view direction from the target (bigger = farther),
// k = the perspective factor (1 in orthographic), so a line width or a size scales by it. `unit` = no scale / zoom / pan (used by frameFor, sy up).
export function projectInto(frame, cam, x, y, z, out, unit) {
	const rx = x - frame.target[0]
	const ry = y - frame.target[1]
	const rz = z - frame.target[2]
	const xr = rx * frame.right[0] + ry * frame.right[1] + rz * frame.right[2]
	const yu = rx * frame.up[0] + ry * frame.up[1] + rz * frame.up[2]
	const depth = rx * frame.fwd[0] + ry * frame.fwd[1] + rz * frame.fwd[2]
	let k = 1
	if (frame.ortho === false || (cam && cam.ortho === false)) k = frame.dist / Math.max(0.05 * frame.dist, frame.dist + depth)
	if (unit) {
		out[0] = xr * k
		out[1] = yu * k
	} else {
		out[0] = frame.cx + cam.panX + (frame.ox + xr * k * frame.scale) * cam.zoom
		out[1] = frame.cy + cam.panY + (frame.oy - yu * k * frame.scale) * cam.zoom
	}
	out[2] = depth
	out[3] = k
	return out
}

export function project(frame, cam, x, y, z) {
	return projectInto(frame, cam, x, y, z, [0, 0, 0, 0], false)
}

// a string that changes when the projection of any point changes: the key of the projected-geometry cache
export function cameraKey(frame, cam) {
	return [cam.yaw.toFixed(4), cam.pitch.toFixed(4), cam.zoom.toFixed(3), cam.panX.toFixed(1), cam.panY.toFixed(1), cam.ortho ? 'o' : 'p', frame.cx, frame.cy, frame.scale.toFixed(4), frame.target.join(',')].join('|')
}

// ---------- depth order and level of detail ----------

// Painter's algorithm per layer: the farthest layer first, ties (a flat layer stack seen from the front) keep the index order. items = [{ index, z, ... }]
export function depthOrder(items, frame) {
	const key = (it) => (it.z - frame.target[2]) * frame.fwd[2]
	return items.slice().sort((a, b) => (key(b) - key(a)) || (a.index - b.index))
}

export const BUDGET_MOVING = 12000 // polyline segments per frame while the user rotates / zooms
export const BUDGET_IDLE = 80000 // at rest (full detail, spread over frames by the time budget)
export const MOVING_LAYERS = 10 // while moving at most this many layers are drawn (every Nth, the top one always)
export const FRAME_MS = 12 // drawing time per animation frame before the rest waits for the next one

export function segmentBudget(moving) {
	return moving ? BUDGET_MOVING : BUDGET_IDLE
}

// the layer indexes (positions in `count`) to draw: all at rest, every Nth while moving; the last (top) one is always in
export function layerPick(count, moving) {
	const all = []
	if (!moving || count <= MOVING_LAYERS) {
		for (let i = 0; i < count; i++) all.push(i)
		return all
	}
	const stride = Math.ceil(count / MOVING_LAYERS)
	for (let i = count - 1; i >= 0; i -= stride) all.push(i)
	return all.reverse()
}

// the share of polylines worth drawing for `total` segments under `budget` (1 = all). Applied with a credit counter so the drawn count never exceeds the budget.
export function keepRatio(total, budget) {
	return total <= budget ? 1 : budget / total
}

// 0.4 (lowest) .. 0.85, the top layer 1: older layers read darker, the top one brighter
export function shadeFor(index, from, top) {
	if (index >= top) return 1
	return 0.4 + 0.45 * ((index - from) / Math.max(1, top - from))
}

// line width in px: an extrusion wide at the camera scale, never under 1 px nor over 6
export function lineWidthFor(mmWide, scale, zoom, k) {
	return clamp(mmWide * scale * zoom * k, 1, 6)
}

// ---------- the saved view ----------

export function defaultView() {
	return { preset: 'iso', ortho: true, yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch }
}

// the storage of the browser, or null (private mode or no localStorage throws)
export function browserStorage() {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null
	} catch (e) {
		return null
	}
}

// the saved view with every field checked; anything missing or broken falls back to the isometric orthographic default
export function loadView(storage) {
	const def = defaultView()
	try {
		const s = storage === undefined ? browserStorage() : storage
		const raw = s ? s.getItem(VIEW_KEY) : null
		if (!raw) return def
		const o = JSON.parse(raw)
		if (!o || typeof o !== 'object') return def
		const preset = o.preset === 'free' || PRESETS[o.preset] ? o.preset : def.preset
		const out = { preset, ortho: typeof o.ortho === 'boolean' ? o.ortho : def.ortho, yaw: def.yaw, pitch: def.pitch }
		if (preset === 'free') {
			if (typeof o.yaw === 'number' && isFinite(o.yaw)) out.yaw = wrapYaw(o.yaw)
			if (typeof o.pitch === 'number' && isFinite(o.pitch)) out.pitch = clamp(o.pitch, PITCH_MIN, PITCH_MAX)
		}
		return out
	} catch (e) {
		return def
	}
}

export function saveView(storage, cam) {
	try {
		const s = storage === undefined ? browserStorage() : storage
		if (!s || !cam) return false
		s.setItem(VIEW_KEY, JSON.stringify({ preset: cam.preset, ortho: !!cam.ortho, yaw: +cam.yaw.toFixed(4), pitch: +cam.pitch.toFixed(4) }))
		return true
	} catch (e) {
		return false
	}
}

// the camera for a saved view; `miniCam` = the isometric camera of the mini preview, which keeps only the saved projection
export function cameraFromView(v, mini) {
	const view = v || defaultView()
	if (mini) return cameraFor('iso', view.ortho)
	if (view.preset === 'free') return Object.assign(cameraFor('iso', view.ortho), { preset: 'free', yaw: view.yaw, pitch: view.pitch })
	const cam = cameraFor(view.preset, view.ortho)
	return cam
}
