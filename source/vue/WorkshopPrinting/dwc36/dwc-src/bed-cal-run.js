'use strict'

// ---- Calibration assistant: what a run of the service looks like to the card, and the state machine of an action ----
//
// Pure (test/bed-cal-run.test.js). The SERVICE heats and tunes (bedcal.preheat / bedcal.tune, dsf/bed_calibration_ops.py); this file turns the answer of
// `bedcal.status` into what the card draws and decides which step of an action the card is in. Nothing here calls the service.
//
// The steps of an action (one at a time, whatever the card does):
//   idle        nothing asked
//   planning    the plan was asked (bedcal.plan: reads, sends nothing)
//   confirming  the dialog is open with the zones and the temperatures; NOTHING has been sent to the machine yet
//   starting    the person confirmed and said they will stay: the start was sent
//   running     the service has the run (also when the page was reloaded and finds one in progress)
//   finished    the run ended (done, failed or stopped); the result stays until it is dismissed
// Cancelling the dialog goes back to idle without any call; a confirmation without the "I will stay" box is ignored.

export const POLL_MS = 2000
export const KINDS = { preheat: 'bedcal.preheat', tune: 'bedcal.tune' }

// the error codes of a run (run.error.code of machine.runs) that have their own text: bedCal.err_run_<code>; any other one says "other"
export const RUN_ERRORS = ['stop', 'machine_halted', 'reservation_lost', 'reserved', 'forbidden_code', 'failed', 'no_connection', 'heater_fault', 'over_cap', 'over_target',
	'job_started', 'board_stopped', 'no_model', 'not_reached', 'tune_timeout', 'too_long', 'neighbours_not_ready', 'heaters_turned_off']
// the result of a zone (zones[].result of the run) and the state of its heater
export const ZONE_RESULTS = ['pending', 'heating', 'reached', 'in_progress', 'ok', 'failure', 'cut', 'held']
export const ZONE_ERRORS = ['tune_failed', 'rejected', 'not_cold', 'no_model']

export function errorKey(code) {
	return 'err_run_' + (RUN_ERRORS.indexOf(code) >= 0 ? code : 'other')
}

export function zoneErrorKey(code) {
	return 'zone_err_' + (ZONE_ERRORS.indexOf(code) >= 0 ? code : 'other')
}

// ---- what a run looks like ----

const KIND_OF = { 'bedcal.preheat': 'preheat', 'bedcal.tune': 'tune' }

// The answer of `bedcal.status` ({active, run}) -> what the card draws.
// {has, active, kind: 'preheat'|'tune'|null, state: 'queued'|'running'|'stopping'|'done'|'error'|'aborted'|null, outcome: 'running'|'done'|'failed'|'stopped'|null, phase,
//  step, total, zones: [{bed, heater, target, current, state, result, error, model, modelLine}], off (every zone was turned off), offProblem, elapsedS, holdLeftS,
//  errorCode, user, canStop, tuning: the heater being tuned or null}
export function runView(status) {
	const run = status && status.run
	if (!run) return { has: false, active: false, kind: null, state: null, outcome: null, phase: '', step: 0, total: 0, zones: [], off: false, offProblem: false, elapsedS: 0, holdLeftS: null, errorCode: null, user: '', canStop: false, tuning: null }
	const r = run.result || {}
	const active = !!status.active
	const outcome = active ? 'running' : run.state === 'done' ? 'done' : run.state === 'aborted' ? 'stopped' : 'failed'
	const zones = (r.zones || []).map(z => ({ bed: z.bed, heater: z.heater, target: z.target, current: z.current === undefined ? null : z.current, state: z.state || null, result: z.result || 'pending', error: z.error || null, model: z.model || null, modelLine: z.model_line || null }))
	return {
		has: true, active, kind: KIND_OF[run.kind] || null, state: run.state, outcome, phase: r.phase || run.phase || '', step: run.step || 0, total: run.total || 0, zones,
		off: !!r.off, offProblem: Array.isArray(r.off_errors) && r.off_errors.length > 0, elapsedS: r.elapsed_s || 0, holdLeftS: typeof r.hold_left_s === 'number' ? r.hold_left_s : null,
		errorCode: run.error && run.error.code ? run.error.code : null, user: run.user || '', canStop: active,
		tuning: (zones.find(z => z.state === 'tuning') || null)
	}
}

// the sentence key of the phase of a run: bedCal.phase_<name>
export function phaseKey(view) {
	const known = ['preparing', 'staggering', 'reaching', 'holding', 'waiting', 'tuning', 'finished']
	return 'phase_' + (known.indexOf(view.phase) >= 0 ? view.phase : 'other')
}

// "12:05" for 725 seconds
export function clock(sec) {
	const s = Math.max(0, Math.round(sec || 0))
	return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

// The zones that have a model after a tuning, as the values of the plan kind config.heater_model: [{heater, r, k, kf, d, s, v, b}]
export function tunedModels(view) {
	return view.zones.filter(z => z.result === 'ok' && z.model).map(z => ({
		heater: z.heater, r: z.model.heating_rate, k: z.model.cooling_rate, kf: z.model.fan_cooling_rate, d: z.model.dead_time, s: z.model.max_pwm, v: z.model.voltage, b: z.model.pid_used === false ? 1 : 0
	}))
}

// ---- the state machine of an action ----

export function initial() {
	return { step: 'idle', action: null, plan: null, error: null, view: null, stopping: false }
}

// action = {kind: 'preheat' | 'tune', args} (the arguments of bedcal.plan without `kind`); error = {message, key?}
export function reduce(state, ev) {
	const s = state || initial()
	switch (ev.type) {
		case 'ask':
			if (s.step !== 'idle' && s.step !== 'finished') return s // one action at a time: a run in progress is never replaced
			return { step: 'planning', action: ev.action, plan: null, error: null, view: null, stopping: false }
		case 'plan':
			return s.step === 'planning' ? Object.assign({}, s, { step: 'confirming', plan: ev.plan }) : s
		case 'plan_failed':
			return s.step === 'planning' ? Object.assign({}, initial(), { error: ev.error }) : s
		case 'cancel':
			return s.step === 'confirming' ? initial() : s // nothing was sent: nothing to undo
		case 'confirm':
			return s.step === 'confirming' && ev.stays === true ? Object.assign({}, s, { step: 'starting' }) : s // without "I will stay" the confirmation is ignored
		case 'started':
			return s.step === 'starting' ? Object.assign({}, s, { step: 'running' }) : s
		case 'start_failed':
			return s.step === 'starting' ? Object.assign({}, initial(), { error: ev.error }) : s
		case 'stop':
			return s.step === 'running' ? Object.assign({}, s, { stopping: true }) : s
		case 'status':
			return fromStatus(s, ev.status)
		case 'dismiss':
			return s.step === 'finished' ? initial() : s
		default:
			return s
	}
}

// the state after a read of bedcal.status: a run in progress is picked up (a reload, another screen); one that ended closes the action
function fromStatus(s, status) {
	const view = runView(status)
	if (view.active) return Object.assign({}, s, { step: 'running', view, action: s.action || { kind: view.kind, args: null } })
	if (s.step === 'running') return Object.assign({}, s, { step: 'finished', view, stopping: false })
	if (s.step === 'idle' && view.has) return Object.assign({}, s, { view }) // the last run of the service stays visible as information
	return s
}

// the buttons that start something are off while an action is in any step but idle / finished (and while the machine is not idle: the service says so)
export function canAsk(state) {
	return state.step === 'idle' || state.step === 'finished'
}

// the confirmation button of the dialog: only with the "I will stay" box ticked
export function canConfirm(state, stays) {
	return state.step === 'confirming' && stays === true
}

// What the dialog says: the zones (bed, temperature) in the order they heat, for the person to read before the confirmation
// plan = the answer of bedcal.plan -> [{bed, heater, target, startS, tune}]
export function planZones(plan) {
	return ((plan && plan.zones) || []).map(z => ({ bed: z.bed, heater: z.heater, target: z.target, startS: z.start_s === undefined ? 0 : z.start_s, tune: z.tune !== false }))
}

// The lines of the plan for the read-only "show the G-code this does" section: [{at, code}] for a preheat, [{zone, code}] for a tuning
export function planLines(plan) {
	return ((plan && plan.steps) || []).map(x => ({ at: x.at_s === undefined ? null : x.at_s, zone: x.zone === undefined ? null : x.zone, code: x.code }))
}

// The read-only text of the section "show the G-code this does": the lines of the plan in the order the service sends them, with when (a preheat) or for which
// zone (a tuning). `zoneLabel(bed)` is the comment that names a zone (a text of the page's catalog); `afterLabel(s)` the one that says "after s seconds".
export function linesText(lines, zoneLabel, afterLabel) {
	const out = []
	let zone = null
	lines.forEach(l => {
		if (l.zone !== null && l.zone !== zone) { zone = l.zone; out.push('; ' + zoneLabel(l.zone)) }
		out.push(l.code + (l.at !== null ? '   ; ' + afterLabel(l.at) : ''))
	})
	return out.join('\n')
}
