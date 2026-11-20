'use strict'

// ---- The draft of the job being prepared (pure: no Vue, no service; test/job-draft.test.js) ----
//
// What the person WANTS for the next job: the file and the profile. One draft for the page, so the choice made in one section travels to the others:
// the files section ("Prepare this file"), the profiles section ("Use in the job") and Prepare job write it; Prepare job and the current job read it.
//
//   draft = { file, fileStamp, fileKind, profile, tool, readState, applied }
//     file       the path of the G-code file ('' = none)
//     fileStamp  the stamp of the file when it was chosen or last read ('<modified>:<size>' of the library; '' = not known)
//     fileKind   'fff' | 'laser' | 'cnc' | 'travel' | 'unknown' | null (null = not known yet)
//     profile    the name of the profile ('' = none)
//     tool       the number of the tool the draft was made for (null = not said)
//     readState  the reading of the file against the profile: 'idle' | 'reading' | 'ok' | 'failed'
//     applied    the changes during the print of the profile were applied for this file from this page
//
// It lives in the memory of the page only: never in localStorage nor on the SD (an old draft that comes back is worse than choosing again). The page clears it
// when the session changes and when the job ends. What IS (the file of the running job, the status of the machine, what the service has armed) is never copied
// here: the page compares the draft with the model and says so when they differ.

export const READ_STATES = ['idle', 'reading', 'ok', 'failed']

const EMPTY = Object.freeze({ file: '', fileStamp: '', fileKind: null, profile: '', tool: null, readState: 'idle', applied: false })

const text = v => (v === null || v === undefined ? '' : String(v))

// the stamp the library gives a file: its modification time and its size (gcode-lib-store.js noteRow uses the same pair)
export function stampOf(row) {
	if (!row || typeof row !== 'object') return ''
	const modified = row.modified === undefined || row.modified === null ? '' : String(row.modified)
	const size = row.size === undefined || row.size === null ? '' : String(row.size)
	return modified || size ? modified + ':' + size : ''
}

// the file changed on the card since the draft took its stamp (an unknown stamp on either side is not a change: nothing is claimed on a guess)
export function stampChanged(known, now) {
	return !!known && !!now && known !== now
}

// same file, whatever the case of the path; a path without a drive is on drive 0 ("0:/gcodes/a.gcode" = "gcodes/A.gcode"), another drive is another file ("0:/..." is not "1:/...")
export function samePath(a, b) {
	const norm = p => {
		const s = text(p).replace(/\\/g, '/').trim()
		const m = /^(\d+):\/*/.exec(s)
		const rest = s.replace(/^\d+:\/*/, '').replace(/^\/+/, '').toLowerCase()
		return rest ? (m ? String(Number(m[1])) : '0') + ':' + rest : ''
	}
	const x = norm(a)
	const y = norm(b)
	return !!x && x === y
}

// the job the draft was made for is over (it finished or was cancelled): the draft did its work and is cleared. Another job ending does not
// touch it (a person may be preparing the next job while one prints).
export function draftJobEnded(wasRunning, isRunning, jobFile, draftFile) {
	return !!wasRunning && !isRunning && samePath(jobFile, draftFile)
}

export function createJobDraft() {
	let state = Object.assign({}, EMPTY)
	const subs = []
	const emit = () => {
		const snap = Object.freeze(Object.assign({}, state))
		subs.slice().forEach(fn => { try { fn(snap) } catch (e) { /* a broken listener must not stop the others */ } })
	}
	const change = (next) => {
		const keys = Object.keys(next)
		if (keys.every(k => state[k] === next[k])) return
		state = Object.assign({}, state, next)
		emit()
	}
	return {
		get() {
			return Object.freeze(Object.assign({}, state))
		},
		// a new file: what was read and applied belonged to the other file
		setFile(path, stamp, kind) {
			const file = text(path)
			if (file === state.file) { change({ fileStamp: text(stamp) || state.fileStamp, fileKind: kind === undefined ? state.fileKind : (kind || null) }); return }
			change({ file, fileStamp: file ? text(stamp) : '', fileKind: file ? (kind || null) : null, readState: 'idle', applied: false })
		},
		// what the library learned about the file later (its stamp, its kind): the choice does not change, so the reading stays
		noteFile(stamp, kind) {
			change({ fileStamp: text(stamp) || state.fileStamp, fileKind: kind === undefined ? state.fileKind : (kind || null) })
		},
		// a new profile: what was read and applied belonged to the other profile
		setProfile(name) {
			const profile = text(name)
			if (profile === state.profile) return
			change({ profile, readState: 'idle', applied: false })
		},
		setTool(number) {
			change({ tool: typeof number === 'number' && isFinite(number) ? number : null })
		},
		setRead(readState) {
			change({ readState: READ_STATES.indexOf(readState) >= 0 ? readState : 'idle' })
		},
		setApplied(applied) {
			change({ applied: !!applied })
		},
		clear() {
			change(Object.assign({}, EMPTY))
		},
		// fn(draft) on every change; returns the function that stops it
		subscribe(fn) {
			if (typeof fn !== 'function') return () => {}
			subs.push(fn)
			return () => {
				const i = subs.indexOf(fn)
				if (i >= 0) subs.splice(i, 1)
			}
		}
	}
}

// the ONE draft of this page
export const jobDraft = createJobDraft()
