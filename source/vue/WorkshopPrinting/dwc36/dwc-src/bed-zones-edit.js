'use strict'

// ---- Bed zones: editing the geometry inside the page that shows the temperatures (pure) ----
//
// The map and the table of BedZones.vue turn into an editor when the technician presses Edit. Everything the editor does is here, as functions of plain
// data, so it is tested without a screen: the editing aids (align, distribute, make equal) and the state of an edit session (selection, undo, add / remove
// a zone, typed numbers). Nothing in this file lays zones out by itself: a zone only moves or changes size when the user asks for exactly that.
// Millimetres in MAP space (see bed-zones-layout.js).
import { round1, EPS, geometryProblems, bedFromModel, newGeometry } from './bed-zones-layout.js'
import { clampRect, placeMissing, pushUndo, popUndo } from './bed-zones-drag.js'
import { toNumber, fitLayout } from './bed-zones.js'

export const UNDO_LIMIT = 30
export const MAX_BED_NUMBER = 31 // the heater numbers the service accepts (0..31)
export const ALIGN_EDGES = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']
export const DISTRIBUTE_AXES = ['h', 'v']
export const EQUAL_DIMS = ['width', 'height', 'both']

const copyRects = rects => rects.map(r => Object.assign({}, r))

// ---- the editing aids ----

// The zones an aid acts on: the selection, or every zone when nothing is selected
export function targetsOf(count, selection) {
	const sel = (selection || []).filter((i, k, all) => Number.isInteger(i) && i >= 0 && i < count && all.indexOf(i) === k)
	return sel.length ? sel : Array.from({ length: count }, (_, i) => i)
}

// Aligns the targets to an edge or a centre. The line they go to is, in this order: the same edge of the REFERENCE zone (`ref`, when it is one of the targets and
// there is more than one), the box of the whole bed (a lone zone), or the box that holds all the targets. Returns new rects; the other zones are not touched.
export function alignRects(rects, targets, edge, ref, bed) {
	const out = copyRects(rects)
	if (!targets.length || ALIGN_EDGES.indexOf(edge) < 0) return out
	let box
	if (targets.length === 1) box = { x0: 0, y0: 0, x1: bed.width, y1: bed.length }
	else if (ref !== null && ref !== undefined && targets.indexOf(ref) >= 0) box = { x0: rects[ref].x, y0: rects[ref].y, x1: rects[ref].x + rects[ref].w, y1: rects[ref].y + rects[ref].h }
	else box = { x0: Math.min(...targets.map(i => rects[i].x)), y0: Math.min(...targets.map(i => rects[i].y)), x1: Math.max(...targets.map(i => rects[i].x + rects[i].w)), y1: Math.max(...targets.map(i => rects[i].y + rects[i].h)) }
	targets.forEach(i => {
		const r = out[i]
		if (edge === 'left') r.x = box.x0
		else if (edge === 'right') r.x = box.x1 - r.w
		else if (edge === 'hcenter') r.x = (box.x0 + box.x1) / 2 - r.w / 2
		else if (edge === 'top') r.y = box.y0
		else if (edge === 'bottom') r.y = box.y1 - r.h
		else r.y = (box.y0 + box.y1) / 2 - r.h / 2
		r.x = round1(r.x)
		r.y = round1(r.y)
	})
	return out
}

// Spreads the targets along an axis ('h' left to right, 'v' top to bottom) so the space between neighbours is the same. The first and the last stay where they
// are. It needs three zones; when the zones are wider than the span that holds them (they would overlap) nothing moves.
export function distributeRects(rects, targets, axis) {
	const out = copyRects(rects)
	if (targets.length < 3 || DISTRIBUTE_AXES.indexOf(axis) < 0) return out
	const pos = axis === 'h' ? 'x' : 'y'
	const size = axis === 'h' ? 'w' : 'h'
	const order = targets.slice().sort((a, b) => rects[a][pos] - rects[b][pos] || a - b)
	const first = rects[order[0]]
	const last = rects[order[order.length - 1]]
	const total = order.reduce((s, i) => s + rects[i][size], 0)
	const gap = (last[pos] + last[size] - first[pos] - total) / (order.length - 1)
	if (gap < -EPS) return out
	let cursor = first[pos]
	order.forEach(i => {
		out[i][pos] = round1(cursor)
		cursor += rects[i][size] + gap
	})
	return out
}

// Gives the targets the width, the height or both of the reference zone (`ref` when it is a target, else the first target). Each zone keeps its top left corner and
// is only brought back inside the bed when it would leave it. Returns new rects.
export function equalizeRects(rects, targets, dim, ref, bed) {
	const out = copyRects(rects)
	if (targets.length < 2 || EQUAL_DIMS.indexOf(dim) < 0) return out
	const from = ref !== null && ref !== undefined && targets.indexOf(ref) >= 0 ? ref : targets[0]
	const src = rects[from]
	targets.forEach(i => {
		if (i === from) return
		out[i] = clampRect({ x: rects[i].x, y: rects[i].y, w: dim === 'height' ? rects[i].w : src.w, h: dim === 'width' ? rects[i].h : src.h }, bed)
	})
	return out
}

// ---- selection ----

// The selection after a click: with Shift / Ctrl (`multi`) the zone is added or taken out; a plain click on a zone that is already selected only makes it the
// reference; a plain click on another zone selects just it. {selection, reference}: the reference is the last zone chosen.
export function pickZone(selection, reference, index, multi) {
	const has = selection.indexOf(index) >= 0
	if (multi) {
		if (!has) return { selection: selection.concat([index]), reference: index }
		const rest = selection.filter(i => i !== index)
		return { selection: rest, reference: reference === index ? (rest.length ? rest[rest.length - 1] : null) : reference }
	}
	if (has) return { selection, reference: index }
	return { selection: [index], reference: index }
}

// ---- an edit session ----

// Starts editing: a copy of the saved configuration. Without a geometry it gets the bed size (axis limits of the machine) and every zone a free spot, once.
export function startEdit(config, model) {
	const c = JSON.parse(JSON.stringify(config))
	if (!c.geometry) c.geometry = newGeometry(bedFromModel(model))
	c.geometry = { bed: c.geometry.bed }
	c.zones = placeMissing(c.zones, c.geometry.bed).zones
	return { config: c, selection: [], reference: null, undo: [], snap: true, alignTo: 'selection', note: null }
}

// Problems of the zones as a list of {field, key, n?, other?} (keys of the area bedZones); [] when the geometry can be saved
export function editProblems(edit) {
	return edit.config.geometry ? geometryProblems(edit.config.geometry, edit.config.zones) : []
}

export function editDirty(edit, saved) {
	return JSON.stringify(edit.config) !== JSON.stringify(saved)
}

const snapshot = c => ({ zones: c.zones, geometry: c.geometry || null, layout: c.layout })

function remember(edit) {
	return pushUndo(edit.undo, snapshot(edit.config), UNDO_LIMIT)
}

// The edit with a new configuration; `undo` records the state before it. Keys of the configuration that are not given stay.
function change(edit, patch, extra) {
	return Object.assign({}, edit, { config: Object.assign({}, edit.config, patch), undo: remember(edit), note: null }, extra || {})
}

function withRects(edit, make) {
	const zones = edit.config.zones
	const next = make(zones.map(z => z.rect))
	if (JSON.stringify(next) === JSON.stringify(zones.map(z => z.rect))) return edit
	return change(edit, { zones: zones.map((z, i) => Object.assign({}, z, { rect: next[i] })) })
}

function setRectAt(edit, index, rect) {
	const zones = edit.config.zones.map((z, i) => (i === index ? Object.assign({}, z, { rect }) : z))
	return Object.assign({}, edit, { config: Object.assign({}, edit.config, { zones }), note: null })
}

// The lowest heater number no zone uses yet
function freeBed(zones) {
	const used = zones.map(z => z.bed)
	let bed = 0
	while (used.indexOf(bed) >= 0 && bed <= MAX_BED_NUMBER) bed++
	return bed
}

function addZone(edit, max) {
	const c = edit.config
	if (!c.geometry || c.zones.length >= max) return edit
	const zones = c.zones.concat([{ bed: freeBed(c.zones), active: true, offset: 0 }])
	const placed = placeMissing(zones, c.geometry.bed)
	if (!placed.ok) return Object.assign({}, edit, { note: 'zones_layout_nofit' })
	const l = fitLayout(zones.length, c.layout) // the map of the settings grows with the zones: the service refuses a layout with fewer cells than zones
	const index = zones.length - 1
	return change(edit, { zones: placed.zones, layout: { rows: +l.rows, columns: +l.columns } }, { selection: [index], reference: index })
}

function removeZones(edit) {
	const keep = edit.config.zones.filter((z, i) => edit.selection.indexOf(i) < 0)
	if (!edit.selection.length || !keep.length) return edit
	return change(edit, { zones: keep }, { selection: [], reference: null })
}

function typedRect(edit, field, text) {
	const index = edit.reference !== null ? edit.reference : edit.selection[0]
	const n = toNumber(text)
	const zone = edit.config.zones[index]
	if (n === null || !zone || !zone.rect || ((field === 'w' || field === 'h') && n <= 0)) return edit
	return change(edit, { zones: edit.config.zones.map((z, i) => (i === index ? Object.assign({}, z, { rect: Object.assign({}, z.rect, { [field]: round1(n) }) }) : z)) })
}

function typedBed(edit, side, text) {
	const n = toNumber(text)
	if (n === null || !edit.config.geometry) return edit
	return change(edit, { geometry: { bed: Object.assign({}, edit.config.geometry.bed, { [side]: round1(n) }) } })
}

function undoOne(edit) {
	const r = popUndo(edit.undo)
	if (!r.state) return edit
	const patch = { zones: r.state.zones, layout: r.state.layout }
	const config = Object.assign({}, edit.config, patch)
	if (r.state.geometry) config.geometry = r.state.geometry
	else delete config.geometry
	return Object.assign({}, edit, { config, undo: r.stack, selection: [], reference: null, note: null })
}

function simpleGrid(edit) {
	const config = Object.assign({}, edit.config, { zones: edit.config.zones.map(z => { const o = Object.assign({}, z); delete o.rect; return o }) })
	delete config.geometry
	return Object.assign({}, edit, { config, undo: remember(edit), selection: [], reference: null, note: null })
}

function enableGeometry(edit, model) {
	const geometry = newGeometry(bedFromModel(model))
	const placed = placeMissing(edit.config.zones, geometry.bed)
	return change(edit, { geometry, zones: placed.zones }, { note: placed.ok ? null : 'zones_layout_nofit' })
}

// One step of the editor: the new state for an action, or the same state when the action changes nothing (a number that is not a number, an aid with nothing to
// do). ctx: {max: most zones this board supports, model: the object model}. Actions: pick {index, multi}, clear, begin, rect {index, rect}, field {name, value},
// bed {side, value}, align {edge}, distribute {axis}, equal {dim}, add, remove, undo, snap {value}, alignTo {value}, simple, enable.
export function reduce(edit, action, ctx) {
	const c = edit.config
	const bed = c.geometry ? c.geometry.bed : null
	const targets = () => targetsOf(c.zones.length, edit.selection)
	switch (action.type) {
		case 'pick': return Object.assign({}, edit, pickZone(edit.selection, edit.reference, action.index, !!action.multi), { note: null })
		case 'clear': return Object.assign({}, edit, { selection: [], reference: null })
		case 'begin': return Object.assign({}, edit, { undo: remember(edit) }) // once per drag
		case 'rect': return setRectAt(edit, action.index, action.rect)
		case 'field': return typedRect(edit, action.name, action.value)
		case 'bed': return typedBed(edit, action.side, action.value)
		case 'align': return withRects(edit, rects => alignRects(rects, targets(), action.edge, edit.alignTo === 'reference' ? edit.reference : null, bed))
		case 'distribute': return withRects(edit, rects => distributeRects(rects, targets(), action.axis))
		case 'equal': return withRects(edit, rects => equalizeRects(rects, targets(), action.dim, edit.reference, bed))
		case 'add': return addZone(edit, ctx.max)
		case 'remove': return removeZones(edit)
		case 'undo': return undoOne(edit)
		case 'snap': return Object.assign({}, edit, { snap: !!action.value })
		case 'alignTo': return Object.assign({}, edit, { alignTo: action.value === 'reference' ? 'reference' : 'selection' })
		case 'simple': return simpleGrid(edit)
		case 'enable': return enableGeometry(edit, ctx.model)
		default: return edit
	}
}
