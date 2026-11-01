'use strict'

// ---- The G-code that heats, cools and extrudes a tool: ONE module (pure, test/tool-codes.test.js) ----
//
// Used by the Load material assistant (filament-load.js / FilamentLoad.vue), the nozzle change (NozzleChange.vue), the purge of the
// Extruder tab, the "cool all" of the printing page, the head change and the commissioning tests. Before this each of them wrote its own
// M568 / M83 / G1 E strings and they had drifted apart (cooling was `A0` in one place and `S0 R0 A0` in another).
//
// HEAT: `M568 P<n> S<t> A2` = the ACTIVE temperature and the tool heating. It does not touch the standby temperature (a deselected tool
//   keeps the one it had) and it does not select the tool: selecting runs the tool change macros (tpre / tpost / tfree), which may move
//   the head, so only a caller that is going to extrude selects the tool first (heatCodes).
// COOL: `M568 P<n> S0 R0 A0` = the heaters OFF and both stored temperatures (active and standby) at 0. The safest of the two forms the
//   plugin used: with `A0` alone the tool keeps its active temperature in memory and the next `T<n>` (a job start, a tool change, a
//   macro) would heat it again by surprise; with S0 R0 nothing is left to reheat. The cost is that the temperature set before is not
//   remembered, which is what a person asks for when pressing "cool down".
// EXTRUDE: select the tool, relative extrusion (M83), the moves, then M400 so the page knows when it ended. Whatever caller asks, a move is
//   never longer than EXTRUDE_MAX.mm nor faster than EXTRUDE_MAX.feed (each page has its own, stricter, limits; this is the last cap).

export const EXTRUDE_MAX = {
	mm: 800, // mm of one move (a Bowden tube can be long)
	feed: 1200 // mm/min (20 mm/s)
}

function num(v) {
	if (v === null || v === undefined || v === '') return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

// a tool number is a whole number from 0 up; anything else is not a tool
function toolNumber(tool) {
	const n = num(tool)
	return n !== null && Number.isInteger(n) && n >= 0 ? n : null
}

// the number as the board reads it: no float noise (12.100000000000001), no exponent
function fmt(v) {
	return String(+Number(v).toFixed(3))
}

export function selectCode(tool) {
	const n = toolNumber(tool)
	return n === null ? '' : 'T' + n
}

// the active temperature of ONE tool and the tool heating; '' when the tool or the temperature (above 0) is not valid
export function heatCode(tool, temp) {
	const n = toolNumber(tool), t = num(temp)
	if (n === null || !(t > 0)) return ''
	return 'M568 P' + n + ' S' + Math.round(t) + ' A2'
}

// the active temperature of the zones of ONE tool WITHOUT selecting it (the Materials page heats a tool the person picked, which may not be the
// current one: selecting it would run the tool change macros and move the head). A single zone is heatCode; several zones (pellet) are one code
// with the list `S<a>:<b>:<c>` and the same list as the standby temperature (R). '' when the tool is not valid, a zone has no number or a
// temperature is negative, or the first zone (the one the material is for) is not above 0.
export function heatZonesCode(tool, temps) {
	const n = toolNumber(tool)
	const list = Array.isArray(temps) ? temps.map(num) : []
	if (n === null || !list.length || list.some(v => v === null || v < 0)) return ''
	if (list.length === 1) return heatCode(n, list[0])
	if (!(list[0] > 0)) return ''
	const s = list.map(v => Math.round(v)).join(':')
	return 'M568 P' + n + ' S' + s + ' R' + s + ' A2'
}

// the tool selected and then heated: for what is going to extrude with it
export function heatCodes(tool, temp) {
	const heat = heatCode(tool, temp)
	return heat ? [selectCode(tool), heat] : []
}

// the tool's heaters off and its temperatures cleared (see the header)
export function coolCode(tool) {
	const n = toolNumber(tool)
	return n === null ? '' : 'M568 P' + n + ' S0 R0 A0'
}

export function coolCodes(tool) {
	const c = coolCode(tool)
	return c ? [c] : []
}

// A relative extrusion of one or more moves, [{ mm, feed }] (mm negative = retract, feed in mm/min), waiting for the end (M400).
// [] when the tool is not valid or one move is: no length, longer than EXTRUDE_MAX.mm, no feed or faster than EXTRUDE_MAX.feed.
export function extrudeCodes(tool, moves) {
	const sel = selectCode(tool)
	if (!sel || !Array.isArray(moves) || !moves.length) return []
	const codes = [sel, 'M83']
	for (const m of moves) {
		const mm = num(m && m.mm), feed = num(m && m.feed)
		if (mm === null || mm === 0 || Math.abs(mm) > EXTRUDE_MAX.mm) return []
		if (feed === null || !(feed > 0) || feed > EXTRUDE_MAX.feed) return []
		codes.push('G1 E' + fmt(mm) + ' F' + fmt(feed))
	}
	codes.push('M400')
	return codes
}
