'use strict'

// ---- The MATERIAL as the one profile (pure) ----
//
// A material (an entry of `materials` in printing.json) is the profile of a plastic, pellet or filament: name, kind, nozzle, bed, camera, fan, density (as before)
// plus, optionally, the temperature of every ZONE: `zones: { extruder: [t per zone of the tool], bed: { <heater>: t } }`. A zone without its own number follows the
// old rule (extruder: the nozzle temperature plus the step of the zone, bed: the bed temperature). The changes per layer (optional) are a relative recipe (format 2)
// saved in the `layer-recipes` area of the service with the SAME NAME as the material: the link is the name. This file holds the rules of that link.
import { KINDS, NAME_MAX } from './layer-recipes.js'

export { KINDS, NAME_MAX }

const num = v => (typeof v === 'number' && isFinite(v)) ? v : null
const pos = v => { const n = num(v); return n !== null && n > 0 ? n : null }

// The kind of a material: the one it has, else pellet when the tool has several nozzle zones and filament when it has one
export function kindOf(m, zoneCount) {
	if (m && KINDS.indexOf(m.kind) >= 0) return m.kind
	return zoneCount > 1 ? 'pellet' : 'filament'
}

// The temperatures of the extruder zones of a tool. heaters: [{ id, max }] in zone order; step: { <heater>: C } (the staging of Pellet and zones).
// A zone with its own number takes it; else nozzle + step (zone 1 has no step). Never above the cap of the heater.
export function extruderTemps(m, heaters, step) {
	const own = (m && m.zones && Array.isArray(m.zones.extruder)) ? m.zones.extruder : []
	return heaters.map((h, k) => {
		const mine = pos(own[k])
		let v = mine !== null ? mine : Math.round(Number(m && m.nozzle) || 0) + (k > 0 && h.id != null ? Number(step && step[h.id]) || 0 : 0)
		if (h.max) v = Math.min(v, h.max)
		return Math.max(0, Math.round(v))
	})
}

// True when the extruder zone k has its own number (not the staging)
export function hasOwnExtruder(m, k) {
	return !!(m && m.zones && Array.isArray(m.zones.extruder) && pos(m.zones.extruder[k]) !== null)
}

// The temperatures of the bed zones: [{ id, t, own }] one per heater given ({ id, max }); a zone without its own number follows the bed temperature
export function bedTemps(m, heaters) {
	const own = (m && m.zones && m.zones.bed && typeof m.zones.bed === 'object') ? m.zones.bed : {}
	return heaters.map(h => {
		const mine = pos(own[h.id])
		let v = mine !== null ? mine : Math.round(Number(m && m.bed) || 0)
		if (h.max) v = Math.min(v, h.max)
		return { id: h.id, t: Math.max(0, Math.round(v)), own: mine !== null }
	})
}

// The arguments of the FLAT preview of a material without changes per layer (layerrecipes.preview `flat`): its zone temperatures as absolute numbers,
// the extruder ones already staggered by extruderTemps (the stagger rule lives there, the service does not repeat it). Nothing is saved.
// tool: the tool number or null; zones: [{ heater, max }] of the tool in zone order; beds: [{ id, max }] the active bed zones (id = the bed number of the zones config).
// Returns { extruder?, bed? } or null when there is nothing to compare.
export function flatPreviewArgs(m, tool, zones, beds, step) {
	const out = {}
	if (tool !== null && tool !== undefined && zones.length) {
		out.extruder = { tool, heaters: zones.map(z => z.heater), temps: extruderTemps(m, zones.map(z => ({ id: z.heater, max: z.max })), step) }
	}
	if (beds.length) out.bed = { zones: beds.map(b => b.id), temps: bedTemps(m, beds).map(z => z.t) }
	return out.extruder || out.bed ? out : null
}

// Sets (or clears, with '' / null / not a number) the number of one zone. kind 'extruder': key is the zone index and n the zone count; kind 'bed': key is the heater.
export function setZone(m, kind, key, value, n) {
	if (!m.zones || typeof m.zones !== 'object') m.zones = {}
	const v = pos(typeof value === 'string' ? Number(value.replace(',', '.')) : value)
	if (kind === 'extruder') {
		const arr = Array.isArray(m.zones.extruder) ? m.zones.extruder.slice() : []
		while (arr.length < Math.max(n || 0, key + 1)) arr.push(null)
		arr[key] = v === null ? null : Math.round(v)
		m.zones.extruder = arr
	} else {
		const o = Object.assign({}, m.zones.bed || {})
		if (v === null) delete o[key]
		else o[key] = Math.round(v)
		m.zones.bed = o
	}
	return cleanZones(m)
}

// Drops empty zone data so a material without zone numbers is saved exactly as before
export function cleanZones(m) {
	const z = m.zones
	if (!z || typeof z !== 'object') { delete m.zones; return m }
	if (Array.isArray(z.extruder)) {
		const arr = z.extruder.map(v => pos(v))
		if (arr.every(v => v === null)) delete z.extruder
		else z.extruder = arr
	} else delete z.extruder
	if (z.bed && typeof z.bed === 'object') {
		Object.keys(z.bed).forEach(k => { if (pos(z.bed[k]) === null) delete z.bed[k] })
		if (!Object.keys(z.bed).length) delete z.bed
	} else delete z.bed
	if (!z.extruder && !z.bed) delete m.zones
	return m
}

// The materials as they are saved: no transient field, no empty zone data, the kind only when the person set it
export function cleanList(list) {
	return list.map(m => {
		const c = Object.assign({}, m)
		delete c._from
		delete c._open
		return cleanZones(c)
	})
}

// The checks of a list before saving: [{ key, params }] (key under plugins.WorkshopPrinting.materials). Names are the link with the layer recipes:
// they must be there, not repeat (any case) and fit the recipe name.
export function nameProblems(list) {
	const out = []
	const seen = {}
	list.forEach(m => {
		const n = String(m.name || '').trim()
		if (!n) return out.push({ key: 'err_name_missing', params: {} })
		if (n.length > NAME_MAX) out.push({ key: 'err_name_long', params: { name: n, max: NAME_MAX } })
		const id = n.toLowerCase()
		if (seen[id]) out.push({ key: 'err_name_repeated', params: { name: n } })
		seen[id] = true
	})
	return out
}

// What saving the list does to the recipes linked by name. `_from` of each entry is the name it was loaded with (absent = a new material); `recipes` the names of
// the saved recipes; `originals` the names the list was loaded with. Returns { rename: [{from, to}], remove: [name], clash: [to] }: a material renamed moves its
// recipe; a material taken out takes its recipe; a rename onto a name that already has a recipe is a clash (nothing is moved and the person is told).
export function linkPlan(list, recipes, originals) {
	const have = {}
	recipes.forEach(r => { have[String(r).toLowerCase()] = r })
	const rename = []
	const clash = []
	list.forEach(m => {
		if (!m._from) return
		const to = String(m.name || '').trim()
		const was = have[String(m._from).toLowerCase()]
		if (!was || was === to) return
		if (have[to.toLowerCase()] && to.toLowerCase() !== was.toLowerCase()) { clash.push(to); return }
		rename.push({ from: was, to })
	})
	const remove = removedNames(originals || [], list).map(n => have[String(n).toLowerCase()]).filter(Boolean)
	return { rename, remove, clash }
}

// The recipe that belongs to a material, by name (case-insensitive): the name as the service has it, or ''
export function recipeNameFor(name, recipes) {
	const id = String(name || '').trim().toLowerCase()
	const r = (recipes || []).find(x => String(x).toLowerCase() === id)
	return r || ''
}

// The list of the materials taken out since loading: the original names that no entry carries any more
export function removedNames(originals, list) {
	const keep = {}
	list.forEach(m => { if (m._from) keep[String(m._from).toLowerCase()] = true })
	return originals.filter(n => !keep[String(n).toLowerCase()])
}
