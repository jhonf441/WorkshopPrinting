'use strict'

// ---- The 4 steps of "Prepare job" (pure) ----
//
//   1 file      choose the G-code file (from the library)
//   2 profile   choose the profile (the material)
//   3 review    see what changes (the file next to the profile); Preheat and Apply are actions of this step, not conditions of it
//   4 start     the job is started in DWC Jobs, never from this page: the step only tells where and says when that file is printing
//
// Given what the person has chosen, which step is the current one, which are done, and what the page must tell. No Vue, no service: test/prepare-steps.test.js.
// Input { file, fileKind, profile, hasProfiles, readable, preview, job }:
//   file        the path chosen ('' = none)
//   fileKind    'fff' | 'laser' | 'cnc' | 'unknown' | null (null = not known yet: the page does not stop on a guess)
//   profile     the name of the profile chosen ('' = none)
//   hasProfiles the list of profiles is not empty
//   readable    the profile has something to compare (layer changes, or zone temperatures on this machine)
//   preview     { shown, loading, error, ok, stale } the state of the reading of the file against the profile (stale: the file changed on the card since it was read)
//   job         { file, printing, busy, simulating } what the MACHINE has (the object model, never the draft): the file of the job, whether it is printing
//               (processing / pausing / paused / resuming), whether any job is going on (also a simulation or a cancel) and whether it is a simulation
// Step 3 is done as soon as the comparison was read well, with or without changes during the print: Apply never paints a step (a profile without
// changes has nothing to apply, and an operator who may not apply must not be stuck). Step 4 is never done by a tap: only the model says the file is printing.
// Output { steps: [{ id, state, hint }], current, stop, ready }:
//   state    'done' | 'current' | 'pending' | 'blocked'
//   hint     the key (under plugins.WorkshopPrinting.prepare.hint_) of the one sentence that tells what to do or what is wrong ('' = nothing to say)
//   current  the id of the step to work on now, or 'done' when all four are
//   stop     'not_fff' when the file is a laser / CNC file: nothing else can be done
//   ready    the two choices are made and the file can be read against the profile

import { samePath } from './job-draft.js'

export const STEPS = ['file', 'profile', 'review', 'start']

// laser / cnc files have no material temperatures: nothing to prepare for the extruder
export function isNotFff(kind) {
	return kind === 'laser' || kind === 'cnc'
}

export function prepareSteps(i) {
	const input = i || {}
	const file = String(input.file || '')
	const profile = String(input.profile || '')
	const pv = input.preview || {}
	const job = input.job || {}
	const stop = file && isNotFff(input.fileKind) ? 'not_fff' : ''
	const fileDone = !!file && !stop
	const profileDone = !!profile
	const ready = fileDone && profileDone && input.readable !== false
	const readDone = ready && !!pv.ok && !pv.loading && !pv.error && !pv.stale
	// the machine is printing THIS file: the only thing that closes the last step
	const started = fileDone && !!job.printing && samePath(job.file, file)
	const simulated = fileDone && !started && !!job.simulating && !!job.file && samePath(job.file, file)
	// another job holds the machine: named when the model gives its file, unnamed for a live job (laser) that has none
	const otherJob = fileDone && !started && !simulated && !!job.busy && !(job.file && samePath(job.file, file))

	const steps = [
		{ id: 'file', state: stop ? 'blocked' : (fileDone ? 'done' : 'current'), hint: stop ? 'not_fff' : (fileDone ? '' : 'file_missing') },
		{ id: 'profile', state: '', hint: '' },
		{ id: 'review', state: '', hint: '' },
		{ id: 'start', state: '', hint: '' }
	]
	const p = steps[1]
	if (!fileDone) {
		p.state = stop ? 'blocked' : 'pending'
		p.hint = stop ? 'not_fff' : ''
	} else if (!profileDone) {
		p.state = 'current'
		p.hint = input.hasProfiles === false ? 'profiles_none' : 'profile_missing'
	} else {
		p.state = 'done'
	}
	const c = steps[2]
	if (!ready) {
		c.state = stop ? 'blocked' : 'pending'
		c.hint = stop ? 'not_fff' : (fileDone && profileDone && input.readable === false ? 'not_readable' : '')
		if (c.hint === 'not_readable') c.state = 'current'
	} else if (readDone) {
		c.state = 'done'
		c.hint = 'review_done'
	} else {
		c.state = 'current'
		c.hint = pv.error ? 'read_failed' : (pv.loading ? 'reading' : (pv.stale ? 'read_stale' : 'read_needed'))
	}
	const s = steps[3]
	if (stop) {
		s.state = 'blocked'
		s.hint = 'not_fff'
	} else if (started) {
		s.state = 'done'
		s.hint = 'started'
	} else {
		s.state = readDone ? 'current' : 'pending'
		s.hint = simulated ? 'simulating' : (otherJob ? (job.file ? 'other_job' : 'other_job_unnamed') : (readDone ? 'start_next' : ''))
	}
	const cur = steps.find(x => x.state === 'current')
	const allDone = steps.every(x => x.state === 'done')
	return { steps, current: allDone ? 'done' : (cur ? cur.id : ''), stop, ready }
}

// ---- where the file is, as DWC Jobs shows it: the folder under gcodes and the name ----
// DWC Jobs opens at the root of gcodes and has no search: the person walks to the folder and taps the file, so the two are shown apart.
// { folder: 'pieces/big' ('' = the root of gcodes; the whole folder when the file lives elsewhere), name: 'pot.gcode', path: 'gcodes/pieces/big/pot.gcode' }
export function jobPathParts(path) {
	const full = String(path == null ? '' : path).trim().replace(/\\/g, '/')
	if (!full) return { folder: '', name: '', path: '' }
	const noDrive = full.replace(/^\d+:\/*/, '').replace(/^\/+/, '')
	const cut = noDrive.lastIndexOf('/')
	const name = noDrive.slice(cut + 1)
	const dir = cut < 0 ? '' : noDrive.slice(0, cut)
	const folder = /^gcodes(\/|$)/i.test(dir) ? dir.replace(/^gcodes\/?/i, '') : dir
	return { folder, name, path: noDrive }
}

// ---- what the service has applied, against what the person chose ----
// status = the answer of layerrecipes.status ({ armed, recipe, file, reason }); file / recipe = the choice of the page (the recipe has the name of the profile).
//   'here'   the changes of THIS profile are applied for THIS file
//   'other'  something is applied, but for another file or of another profile (only one can be applied at a time)
//   'ended'  nothing is applied and the service says why it turned off by itself
//   'none'   nothing is applied
export function appliedState(status, file, recipe) {
	const st = status || {}
	if (st.armed) {
		const sameRecipe = !!recipe && String(st.recipe || '').toLowerCase() === String(recipe).toLowerCase()
		return sameRecipe && samePath(st.file, file) ? 'here' : 'other'
	}
	return st.reason ? 'ended' : 'none'
}
