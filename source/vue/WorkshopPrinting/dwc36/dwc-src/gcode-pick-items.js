'use strict'

// The pure logic of the G-code select (GcodePicker.vue): the arguments of the list call, when a typed text becomes a server search, the items of the dropdown
// (the job's current file first, then the library newest first). No Vue, no texts (the words come from i18n).
// Tested by test/gcode-pick-items.test.js.

import { listArgs, stateChip } from './gcode-lib-list.js'
import { baseName, fullPath } from './gcode-lib-format.js'
import { kindOf, kindShortLine } from './gcode-lib-kinds.js'

export const PICK_LIMIT = 200 // rows of the folder the dropdown asks for (the service caps a page at 200)
export const PICK_DEBOUNCE = 300 // ms of quiet before a typed text is sent to the service

// the arguments of gcodelib.list for the dropdown: newest first, the first PICK_LIMIT rows, `query` only when something was typed
export function pickListArgs(query, dir, kinds) {
	return listArgs({ dir: dir || '', query: query || '', sort: 'modified', desc: true, kind: kinds }, 0, PICK_LIMIT)
}

// The search a typed text asks for: '' when nothing (or only blanks) was typed, or when the text is just the name of the current choice (the autocomplete
// writes the chosen name into its search box: that is not a search).
export function searchText(typed, chosenName) {
	const t = String(typed == null ? '' : typed).trim()
	if (!t) return ''
	if (chosenName && t === String(chosenName).trim()) return ''
	return t
}

// The search to run now, or null when the one on screen is already that one (no second call for the same text)
export function nextSearch(typed, chosenName, current) {
	const q = searchText(typed, chosenName)
	return q === String(current == null ? '' : current) ? null : q
}

const sameFile = (a, b) => !!a && !!b && fullPath(a) === fullPath(b)

function itemOf(path, name, summary, state, extra) {
	const numbers = summary ? kindShortLine(summary).join('  ') : ''
	const chip = stateChip({ state: state || 'ready' })
	return Object.assign({ text: name || baseName(path), value: path, path, sub: numbers, chip: chip ? chip.kind : '', summary: summary || null, kind: kindOf(summary), current: false, muted: !!chip }, extra || {})
}

// The items of the dropdown, in order:
//  1. the current job file (`jobFile`), flagged `current`; with the numbers of the library when it knows the file (`jobInfo` = its summary)
//  2. the file chosen now (`value`) when it is not in the list (a subfolder picked in the dialog): the person sees what is selected
//  3. the rows of the library, as the service sent them (the job file is not repeated)
// Each item: { text (file name), value (path), sub (time, weight / length, layers), chip ('' | pending | working | error), summary, current, muted }
export function buildPickItems(rows, opts) {
	const o = opts || {}
	const items = []
	const job = o.jobFile ? fullPath(o.jobFile) : ''
	const list = Array.isArray(rows) ? rows : []
	if (job) {
		const row = list.find((r) => r && sameFile(r.path, job))
		items.push(itemOf(job, baseName(job), (row && row.summary) || o.jobInfo || null, row && row.state, { current: true }))
	}
	const chosen = o.value ? fullPath(o.value) : ''
	if (chosen && !sameFile(chosen, job) && !list.some((r) => r && sameFile(r.path, chosen))) items.push(itemOf(chosen, baseName(chosen), o.valueInfo || null, 'ready'))
	list.forEach((r) => {
		if (!r || !r.path || sameFile(r.path, job)) return
		items.push(itemOf(r.path, r.name || baseName(r.path), r.summary, r.state))
	})
	return items
}
