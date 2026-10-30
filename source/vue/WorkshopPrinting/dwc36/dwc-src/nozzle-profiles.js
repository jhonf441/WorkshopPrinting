'use strict'

// What was calibrated with each nozzle, kept by diameter in printing.json (key nozzles): the extruder steps per mm (M92 E), the PID line
// of each heater (M307 H<n>) and the pressure advance (M572 S). Pure helpers; nozzle-store.js reads and writes the file.
//   nozzles: { "0.8": { date, flow: { steps }, advance: 0.05, pid: { "1": "M307 H1 R..." } } }

export function profileKey(d) {
	var n = Number(d)
	return isFinite(n) && n > 0 ? String(Math.round(n * 1000) / 1000) : ''
}

export function getProfile(nozzles, d) {
	var k = profileKey(d)
	var p = k && nozzles && typeof nozzles === 'object' ? nozzles[k] : null
	return p && typeof p === 'object' ? p : null
}

function validSteps(v) {
	return isFinite(Number(v)) && Number(v) > 0 && Number(v) < 100000
}
function validAdvance(v) {
	return v !== null && v !== '' && isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 2
}
function validPidLine(h, line) {
	return typeof line === 'string' && line.indexOf('M307 H' + h + ' ') === 0
}

// the piece of a profile that is worth keeping: only valid values, the rest is dropped
export function cleanPart(part) {
	var out = {}
	if (!part) return out
	if (part.flow && validSteps(part.flow.steps)) out.flow = { steps: Math.round(Number(part.flow.steps) * 1000) / 1000 }
	if (validAdvance(part.advance)) out.advance = Math.round(Number(part.advance) * 1000) / 1000
	if (part.pid) {
		var pid = {}
		Object.keys(part.pid).forEach(function (h) {
			if (validPidLine(h, part.pid[h])) pid[h] = part.pid[h].split(';')[0].trim()
		})
		if (Object.keys(pid).length) out.pid = pid
	}
	return out
}

// the nozzles map after remembering `part` for diameter d (flow and advance replace; the PID lines merge by heater)
export function mergeProfile(nozzles, d, part, date) {
	var k = profileKey(d)
	var clean = cleanPart(part)
	var base = nozzles && typeof nozzles === 'object' ? nozzles : {}
	if (!k || !Object.keys(clean).length) return base
	var old = getProfile(base, d) || {}
	var next = Object.assign({}, old, clean, { date: date })
	if (old.pid || clean.pid) next.pid = Object.assign({}, old.pid, clean.pid)
	var out = Object.assign({}, base)
	out[k] = next
	return out
}

// the M307 lines of the tool's heaters as they are in modefff.g text: { "1": "M307 H1 ..." }
export function pidLinesFrom(text, heaterIds) {
	var out = {}
	var lines = String(text || '').split(/\r?\n/)
	heaterIds.forEach(function (h) {
		var l = lines.find(function (x) { return x.trim().indexOf('M307 H' + h + ' ') === 0 })
		if (l) out[h] = l.split(';')[0].trim()
	})
	return out
}

// what a profile holds, for showing: [{ id: 'flow'|'pid'|'advance', text }]
export function profileItems(p) {
	var items = []
	if (!p) return items
	if (p.flow && validSteps(p.flow.steps)) items.push({ id: 'flow', text: 'M92 E' + p.flow.steps })
	if (p.pid && Object.keys(p.pid).length) items.push({ id: 'pid', text: Object.keys(p.pid).sort(function (a, b) { return a - b }).map(function (h) { return 'H' + h }).join(' ') })
	if (validAdvance(p.advance)) items.push({ id: 'advance', text: 'M572 S' + p.advance })
	return items
}

// what applying a profile does: runtime codes, the M92 line and the M307 lines to write into modefff.g (only heaters in `heaterIds`)
export function restorePlan(p, extruder, heaterIds) {
	var plan = { codes: [], flowLine: '', pidLines: [], advance: null, ids: [] }
	if (!p) return plan
	if (p.flow && validSteps(p.flow.steps)) {
		plan.flowLine = 'M92 E' + p.flow.steps
		plan.codes.push(plan.flowLine)
		plan.ids.push('flow')
	}
	if (p.pid) {
		heaterIds.forEach(function (h) {
			if (validPidLine(h, p.pid[h])) {
				plan.pidLines.push({ h: h, line: p.pid[h] })
				plan.codes.push(p.pid[h])
			}
		})
		if (plan.pidLines.length) plan.ids.push('pid')
	}
	if (validAdvance(p.advance)) {
		plan.advance = Number(p.advance)
		plan.codes.push('M572 D' + Number(extruder) + ' S' + plan.advance)
		plan.ids.push('advance')
	}
	return plan
}
