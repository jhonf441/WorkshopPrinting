'use strict'

// ---- The list of PROFILES on the Profiles page (pure: list, new, duplicate, delete) ----
//
// A profile is an entry of `materials` in printing.json (see material-profile.js). These functions never touch the entries they are given: each returns a NEW list,
// so the page can keep a draft and compare. `_from` is the name an entry was loaded with (the link with its stored changes during the print); `_copyOf` is the saved
// profile a duplicate was made from (saving copies its changes during the print under the new name: material-profile.js linkPlan).
import { kindOf, recipeNameFor, NAME_MAX } from './material-profile.js'

// A name that no entry has (any case): base, then base 2, base 3...
export function uniqueName(list, base) {
	const taken = {}
	list.forEach(m => { taken[String(m.name || '').trim().toLowerCase()] = true })
	let name = String(base || '').trim().slice(0, NAME_MAX)
	for (let n = 2; taken[name.toLowerCase()]; n++) {
		const tail = ' ' + n
		name = String(base || '').trim().slice(0, NAME_MAX - tail.length) + tail
	}
	return name
}

// A new profile with the usual numbers; the kind follows the tool (several nozzle zones: pellet)
export function newProfile(list, base, zoneCount) {
	const m = { name: uniqueName(list, base), kind: zoneCount > 1 ? 'pellet' : 'filament', nozzle: 210, bed: 60, camera: 0, fan: 50, density: 1.2 }
	return { list: list.concat([m]), index: list.length }
}

// A copy of the profile at `index`, put right after it, with its own name (copyWord is the already translated word, e.g. "copy") and with no link of its own
export function duplicateProfile(list, index, copyWord) {
	const src = list[index]
	if (!src) return { list, index: -1 }
	const m = JSON.parse(JSON.stringify(src))
	delete m._from
	delete m._open
	m._copyOf = src._from || src._copyOf || ''
	m.name = uniqueName(list, String(src.name || '').trim() + ' ' + copyWord)
	const next = list.slice()
	next.splice(index + 1, 0, m)
	return { list: next, index: index + 1 }
}

// The list without the profile at `index`, and the index to select afterwards (the next one, else the previous, else -1)
export function removeProfile(list, index) {
	if (index < 0 || index >= list.length) return { list, index: Math.min(index, list.length - 1) }
	const next = list.filter((_, i) => i !== index)
	return { list: next, index: next.length ? Math.min(index, next.length - 1) : -1 }
}

// What the delete confirmation says: the profile to remove and whether it also takes stored changes during the print with it
export function deletePlan(list, index, recipes) {
	const m = list[index]
	if (!m) return null
	return { name: String(m.name || ''), withChanges: !!(m._from && recipeNameFor(m._from, recipes)) }
}

// The one-line summary of a profile for the list: { kind, nozzle, bed, camera, layers } (numbers as the profile has them, null when it has none)
export function summaryOf(m, zoneCount, recipes) {
	const n = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)
	return { kind: kindOf(m, zoneCount), nozzle: n(m.nozzle), bed: n(m.bed), camera: n(m.camera), layers: !!(m._from && recipeNameFor(m._from, recipes)) }
}

// The rows of the list (left column, or the select on a narrow screen)
export function listRows(list, zoneCount, recipes) {
	return list.map((m, index) => Object.assign({ index, name: String(m.name || '') }, summaryOf(m, zoneCount, recipes)))
}

// The index to keep selected when the list changes under the page (a loaded list, a restore): the same name when it is still there, else the first, else -1
export function keepSelection(list, name) {
	const i = list.findIndex(m => String(m.name || '') === name)
	return i >= 0 ? i : (list.length ? 0 : -1)
}
