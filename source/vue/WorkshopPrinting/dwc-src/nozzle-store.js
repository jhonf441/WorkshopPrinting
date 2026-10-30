'use strict'

// Reads and writes the per-nozzle profiles (nozzle-profiles.js) in printing.json. Helpers like util.js: the callers check the role
// (technician) before they use them.

import { CFG_FILE, MODE_FILE, readJson, readText, writeText, updateCfg, changeLineMode, changeOAddLineMode } from './util.js'
import { replaceM307Lines } from './mode-lines.js'
import { mergeProfile, pidLinesFrom, restorePlan } from './nozzle-profiles.js'

function stamp() {
	return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

export async function readProfiles() {
	const cfg = (await readJson(CFG_FILE, {})) || {}
	return { size: Number(cfg.nozzleSize) > 0 ? Number(cfg.nozzleSize) : 0, nozzles: cfg.nozzles || {} }
}

// remembers `part` ({ flow, advance, pid }) for the diameter given; returns false when there is none to remember it for
export async function rememberAt(d, part) {
	const cur = await readProfiles()
	const next = mergeProfile(cur.nozzles, d, part, stamp())
	if (next === cur.nozzles) return false
	await updateCfg({ nozzles: next })
	return true
}

// ... for the nozzle registered now (a calibration was just saved); silent: it never breaks the calibration that called it
export async function rememberForNozzle(part) {
	try {
		const cur = await readProfiles()
		return cur.size > 0 ? await rememberAt(cur.size, part) : false
	} catch (e) {
		return false
	}
}

// the live values of the nozzle that leaves: steps and advance from the model, the PID lines from the saved modefff.g
export async function snapshotNozzle(d, live, heaterIds) {
	const text = await readText(MODE_FILE)
	return rememberAt(d, { flow: { steps: live.steps }, advance: live.advance, pid: pidLinesFrom(text, heaterIds) })
}

// the pressure advance is not kept by the firmware: a line in modefff.g (after M92 E) sets it again whenever the FFF mode starts
export async function persistAdvance(extruder, seconds) {
	await changeOAddLineMode('M572 D' + Number(extruder) + ' ', 'M572 D' + Number(extruder) + ' S' + Number(seconds) + '   ; pressure advance', 'M92 E')
}

// puts a saved profile on the machine: runs the codes now and writes the M92 / M307 lines into modefff.g (one .bak copy)
export async function applyProfile(sendCode, profile, extruder, heaterIds) {
	const plan = restorePlan(profile, extruder, heaterIds)
	for (const c of plan.codes) {
		const r = await sendCode({ code: c, log: true })
		if (/error|abort/i.test(r || '')) throw new Error(c + ': ' + r)
	}
	if (plan.pidLines.length) {
		const text = await readText(MODE_FILE)
		await writeText(MODE_FILE + '.bak-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15), text)
		await writeText(MODE_FILE, replaceM307Lines(text, plan.pidLines).text)
	}
	if (plan.flowLine) await changeLineMode('M92 E', plan.flowLine)
	if (plan.advance !== null) await persistAdvance(extruder, plan.advance)
	return plan
}
