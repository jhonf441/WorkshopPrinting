'use strict'

// ---- Which profiles fit the file of the job (pure: no Vue, no service; test/profile-match.test.js) ----
//
// A SUGGESTION, never a choice: the page marks the profiles that fit ("Matches the file") and lists them first; it never picks one by itself, because choosing
// the material for the person is a risk (the page cannot know what is loaded in the machine).
//
// The rule uses only what the library knows about a file: the nozzle temperature the file asks for (`nozzle_c` of its summary; ONE number, also for a
// pellet file). The file does not say its material. A profile fits when it is of the kind of the tool (pellet / filament) and its nozzle temperature is
// within MATCH_RANGE_C of the one of the file. Without that number (the file sets no temperature, or it is not indexed yet) nothing is said at all.

import { kindOf } from './material-profile.js'

export const MATCH_RANGE_C = 15

const pos = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)

// the nozzle temperature the file asks for, or null when the library does not know it
export function fileNozzle(summary) {
	return summary && typeof summary === 'object' ? pos(summary.nozzle_c) : null
}

// 'match' the profile fits the file; 'none' it does not; 'unknown' the file gives nothing to compare with (the page then shows no mark and no sentence)
export function profileMatch(profile, summary, toolKind, zoneCount) {
	const asked = fileNozzle(summary)
	if (asked === null) return 'unknown'
	const own = pos(profile && profile.nozzle)
	if (own === null) return 'none'
	if (toolKind && kindOf(profile, zoneCount) !== toolKind) return 'none'
	return Math.abs(own - asked) <= MATCH_RANGE_C ? 'match' : 'none'
}

// The profiles in the order the job select shows them: first the ones of the kind of the tool, then the rest (none is hidden); inside each group the ones
// that fit the file come first; otherwise the order of the list is kept. Each entry: { profile, kind, match (boolean) }.
export function orderForJob(list, summary, toolKind, zoneCount) {
	const rows = (Array.isArray(list) ? list : []).map((profile, index) => {
		const kind = kindOf(profile, zoneCount)
		return { profile, kind, index, ofTool: !toolKind || kind === toolKind, match: profileMatch(profile, summary, toolKind, zoneCount) === 'match' }
	})
	rows.sort((a, b) => (Number(b.ofTool) - Number(a.ofTool)) || (Number(b.match) - Number(a.match)) || (a.index - b.index))
	return rows.map(r => ({ profile: r.profile, kind: r.kind, match: r.match }))
}
