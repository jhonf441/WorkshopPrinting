'use strict'

// What the strip of Prepare job and the result of each step say (pure: test/prepare-summary.test.js). It only chooses KEYS (under plugins.WorkshopPrinting.prepare.)
// from what the page already knows; it decides nothing and reads nothing. The sentences are in es.json / en.json.
//   i = { flow, fileName, profileName, hasLayers, applied, role }
//     flow       the output of prepareSteps (prepare-steps.js)
//     applied    appliedState(...) or 'unknown'
//     role       'viewer' | 'operator' | 'technician' (what the person can do here, from the page)

// The role as the strip says it: the highest thing the person can do on this page
export function roleOf(canApply, canPreheat) {
	if (canApply) return 'technician'
	return canPreheat ? 'operator' : 'viewer'
}

// The four data of the strip: [{ id, label, value, text }]. `label` and `value` are keys; `text` replaces the value when it is a name (file, profile)
export function summaryItems(i) {
	const input = i || {}
	const out = []
	out.push({ id: 'file', label: 'strip_file', value: input.fileName ? '' : 'strip_file_none', text: baseName(input.fileName) })
	out.push({ id: 'profile', label: 'strip_profile', value: input.profileName ? '' : 'strip_profile_none', text: input.profileName || '' })
	let changes = 'strip_changes_none'
	if (input.applied === 'unknown') changes = 'strip_changes_unknown'
	else if (input.hasLayers) changes = input.applied === 'here' ? 'strip_changes_on' : 'strip_changes_off'
	else if (input.applied === 'other') changes = 'strip_changes_other'
	if (!input.profileName) changes = 'strip_changes_pending'
	out.push({ id: 'changes', label: 'strip_changes', value: changes, text: '' })
	out.push({ id: 'role', label: 'strip_role', value: 'strip_role_' + (input.role || 'viewer'), text: '' })
	return out
}

// The result on the right of the summary line of a step: { key, params } (key under prepare.), from the state of the step
export function stepResult(id, i) {
	const input = i || {}
	const flow = input.flow || { steps: [] }
	const st = (flow.steps.find(s => s.id === id) || {}).state || 'pending'
	if (st === 'blocked') return { key: 'state_blocked', params: {} }
	if (id === 'file') return st === 'done' ? { key: 'res_file_done', params: { name: baseName(input.fileName) } } : { key: 'res_file_missing', params: {} }
	if (id === 'profile') {
		if (st === 'done') return { key: 'res_profile_done', params: { name: input.profileName || '' } }
		return st === 'pending' ? { key: 'res_first_file', params: {} } : { key: 'res_profile_missing', params: {} }
	}
	if (id === 'review') {
		if (st === 'done') return { key: input.hasLayers ? 'res_review_layers' : 'res_review_flat', params: {} }
		return st === 'pending' ? { key: 'res_first_choose', params: {} } : { key: 'res_review_read', params: {} }
	}
	// start
	if (st === 'done') return { key: 'res_start_done', params: {} }
	return st === 'pending' ? { key: 'res_first_review', params: {} } : { key: 'res_start_next', params: {} }
}

function baseName(path) {
	const s = String(path || '').split('\\').join('/')
	return s.slice(s.lastIndexOf('/') + 1)
}

// Which steps are open: the current one opens when it changes (never again on a poll: the person may have opened another one, and none is closed for them);
// `open` is the map of what the person sees, `current` the id from prepareSteps ('done' or '' = nothing to open)
export function openOnChange(open, current) {
	const out = Object.assign({}, open)
	if (current && current !== 'done') out[current] = true
	return out
}
