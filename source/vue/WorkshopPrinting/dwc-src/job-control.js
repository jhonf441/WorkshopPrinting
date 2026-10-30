'use strict'

// ---- Job control of the "3D job" tab (2026-10-30): pause / resume / cancel, Z baby-stepping, speed and flow factors ----
//
// Pure helpers of JobControl.vue (test/job-control.test.js). The codes are the ones DWC sends from its own buttons (M25, M24,
// M0) plus the live corrections a person makes while a print runs: M290 (Z baby-stepping), M220 (speed factor) and M221 (flow
// factor of one extruder). What the machine has now comes from the object model DWC keeps (state.status, move.axes[].babystep,
// move.speedFactor, move.extruders[].factor); nothing is asked of the board. A live job (a program through the bridge) has its
// own controls in the Jog bar: with one running the buttons are not offered (the page passes `live`).

import { flowCode as flowPercentCode } from './pellet-hmi.js' // the M221 of the pellet panel: same range (10..300 %)

export const JOB_CODES = { pause: 'M25', resume: 'M24', cancel: 'M0' }
// the states a file job goes through (a simulation is paused and cancelled with the same codes)
export const JOB_STATES = { processing: 1, pausing: 1, paused: 1, resuming: 1, simulating: 1, cancelling: 1 }

export const BABY_STEPS = [-0.05, -0.02, 0.02, 0.05] // mm per tap (the fine steps a first layer needs)
export const BABY_LIMIT = 2 // mm: the sum never goes further from zero than this (a bigger error is a wrong Z offset, not a correction)
export const SPEED_LIMITS = { min: 10, max: 300 } // % of M220
export const FLOW_LIMITS = { min: 10, max: 300 } // % of M221 (the range of the pellet panel)

function num(v) {
	if (v === null || v === undefined || v === '') return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}

// true while a file job is running, paused or being cancelled
export function jobRunning(status) {
	return !!JOB_STATES[status || '']
}

// Which buttons the card offers for the machine state: { pause, resume, cancel } (booleans). Cancel only while paused, like DWC's
// own button: RRF refuses M0 while a file job is printing ("pause the print before attempting to cancel it").
export function jobButtons(status, live) {
	if (live) return { pause: false, resume: false, cancel: false }
	const s = status || ''
	return {
		pause: s === 'processing',
		resume: s === 'paused',
		cancel: s === 'paused'
	}
}

export function jobCode(action) {
	return JOB_CODES[action] || ''
}

// ---- Z baby-stepping ----

// the Z correction the board has now (move.axes[].babystep of the Z axis); null when the model does not say
export function babyStepNow(om) {
	const axes = (om && om.move && om.move.axes) || []
	for (const a of axes) if (a && a.letter === 'Z') return num(a.babystep)
	return null
}

// 'M290 S<delta>' for one of the steps, '' when the step is not one of BABY_STEPS or the sum would pass BABY_LIMIT
export function babyStepCode(delta, now) {
	const d = num(delta)
	if (d === null || !BABY_STEPS.some(s => Math.abs(s - d) < 1e-9)) return ''
	const sum = (num(now) || 0) + d
	if (Math.abs(sum) > BABY_LIMIT + 1e-9) return ''
	return 'M290 S' + +d.toFixed(2)
}

// back to no correction (R0 = the value is absolute)
export function babyResetCode() {
	return 'M290 R0 S0'
}

// the sum shown next to the buttons: "+0.04 mm" / "-0.10 mm" / "0.00 mm"
export function babyStepText(now) {
	const n = num(now)
	if (n === null) return '--'
	const s = Math.abs(n) < 0.005 ? '' : n > 0 ? '+' : '-'
	return s + Math.abs(n).toFixed(2) + ' mm'
}

// ---- speed and flow factors ----

export function speedCode(percent) {
	const p = Math.round(Number(percent))
	return p >= SPEED_LIMITS.min && p <= SPEED_LIMITS.max ? 'M220 S' + p : ''
}

// M221 of ONE extruder (D): the one of the tool, so a second tool keeps its own factor
export function flowCode(percent, extruder) {
	const base = flowPercentCode(percent)
	const d = num(extruder)
	return base && d !== null && d >= 0 ? base + ' D' + d : ''
}

// What the board applies now: the speed factor and the flow factor of each extruder of the tool (all of them without a tool).
//   -> { speed: % | null, flows: [{ extruder, percent | null }] }
export function factorsNow(om, tool) {
	const mv = (om && om.move) || {}
	const exts = mv.extruders || []
	const idx = tool && tool.extruders && tool.extruders.length ? tool.extruders : exts.map((e, i) => i)
	return {
		speed: num(mv.speedFactor) === null ? null : Math.round(mv.speedFactor * 100),
		flows: idx.filter(i => exts[i]).map(i => ({ extruder: i, percent: num(exts[i].factor) === null ? null : Math.round(exts[i].factor * 100) }))
	}
}
