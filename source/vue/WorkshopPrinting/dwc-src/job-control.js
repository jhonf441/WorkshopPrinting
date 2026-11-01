'use strict'

// ---- Job control of the "3D job" tab (2026-10-30): pause / resume / cancel, Z baby-stepping, speed and flow factors ----
//
// Pure helpers of JobControl.vue (test/job-control.test.js). Pause / resume / cancel (the buttons by machine state and their codes
// M25, M24, M0) are the rule of ./job-rules.js (vue/_shared), the same one the status bar of the Workbench pages uses; here are the
// live corrections a person makes while a print runs: M290 (Z baby-stepping), M220 (speed factor) and M221 (flow factor of one
// extruder). What the machine has now comes from the object model DWC keeps (state.status, move.axes[].babystep,
// move.speedFactor, move.extruders[].factor); nothing is asked of the board.

import { flowCode as flowPercentCode } from './pellet-hmi.js' // the M221 of the pellet panel: same range (10..300 %)

// the states a file job goes through (which of them offer Pause / Resume / Cancel is job-rules.js)
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

// ---- the corrections (M290, M220, M221) only belong to a print in progress ----
// RRF keeps a Z baby-step and the speed and flow factors AFTER the job ends: nothing clears them, so one given with nothing printing
// (or left behind by the last job) starts the NEXT job already shifted. The Z steps and the factors are therefore offered only while a
// job is going on (a file job printing or paused, or a live job); putting them back (Reset, 100 %) is offered always, and what is still
// applied with no job is shown as a warning (leftoverCorrections).
export const CORRECTION_STATES = { processing: 1, pausing: 1, paused: 1, resuming: 1 }

export function correctionsOpen(status, live) {
	return !!live || !!CORRECTION_STATES[status || '']
}

// What is still applied: [{ id: 'baby', value: mm } | { id: 'speed', value: % } | { id: 'flow', extruder, value: % }]; empty when
// everything is neutral (no Z step, 100 % speed, 100 % flow). baby = babyStepNow(om), factors = factorsNow(om, tool).
export function leftoverCorrections(baby, factors) {
	const out = []
	const b = num(baby)
	if (b !== null && Math.abs(b) >= 0.005) out.push({ id: 'baby', value: b })
	const f = factors || {}
	if (num(f.speed) !== null && f.speed !== 100) out.push({ id: 'speed', value: f.speed })
	for (const x of f.flows || []) {
		if (x && num(x.percent) !== null && x.percent !== 100) out.push({ id: 'flow', extruder: x.extruder, value: x.percent })
	}
	return out
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

// ---- the double tap of a button that ends or resets something (cancel, baby-step reset; DESIGN.md 5 level 2) ----
// state = { id, at } of the button armed now (null = none); id = the button tapped; now = ms. The first tap arms it and sends
// nothing; a second tap of the SAME button within ARM_MS fires it; later, or another button, arms again (never fires the first one).
//   -> { state: the new armed state (null after firing), fire: true when the action must run now }
export const ARM_MS = 4000
export function armedPress(state, id, now) {
	const t = num(now)
	const at = state ? num(state.at) : null
	if (state && state.id === id && t !== null && at !== null && t >= at && t - at < ARM_MS) return { state: null, fire: true }
	return { state: { id, at: t }, fire: false }
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
