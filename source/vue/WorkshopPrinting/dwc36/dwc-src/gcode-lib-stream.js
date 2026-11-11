'use strict'

// Progressive loading of the layers of the library viewer, pure (no Vue, no DOM): which windows are still missing (top first), how many layers are loaded,
// a runner that fetches them with a limited concurrency and a cancel check, the "decimated" note and the thumbnail-first decision. test/gcode-lib-stream.test.js.

import { windowsFor } from './gcode-lib-layers.js'

export const CONCURRENCY = 2 // windows fetched at the same time

// The windows [{ win, detail }] still to fetch for the layers from..to, TOP layers first (the part the person sees first). `have(win, detail)` tells whether a window is
// already in memory at that detail; a low-detail request is also satisfied by a normal-detail window.
export function planFetch(from, to, total, detail, have, chunk) {
	const wins = windowsFor(from, to, total, chunk).reverse()
	return wins.filter((w) => !(have(w, detail) || (detail === 'low' && have(w, 'normal')))).map((win) => ({ win, detail }))
}

// the layers of from..to that are in memory ({ done, total }), for "Loading layers 48/138"
export function progressOf(from, to, total, detail, have, chunk) {
	let done = 0
	let all = 0
	windowsFor(from, to, total, chunk).forEach((w) => {
		const a = Math.max(from, w.from)
		const b = Math.min(to, w.to)
		const n = Math.max(0, b - a + 1)
		all += n
		if (have(w, detail) || (detail === 'low' && have(w, 'normal'))) done += n
	})
	return { done, total: all }
}

// Runs the jobs [{ win, detail }] in order with at most `concurrency` fetches at once. `fetch(job)` returns a promise; `onEach(job, answer)` after each one;
// `cancelled()` is checked before starting every job (a new file or range stops the rest). Resolves with the number of jobs finished; rejects with the first error
// (no new job starts after it).
export function runJobs(jobs, fetch, opts) {
	const o = opts || {}
	const limit = Math.max(1, o.concurrency || CONCURRENCY)
	const cancelled = o.cancelled || (() => false)
	let next = 0
	let finished = 0
	let failed = null
	let running = 0
	return new Promise((resolve, reject) => {
		const pump = () => {
			while (!failed && running < limit && next < jobs.length && !cancelled()) {
				const job = jobs[next++]
				running++
				Promise.resolve().then(() => fetch(job)).then((ans) => {
					running--
					finished++
					if (o.onEach && !cancelled()) o.onEach(job, ans)
					pump()
				}, (e) => {
					running--
					if (!failed) failed = e
					pump()
				})
			}
			if (running === 0) {
				if (failed) reject(failed)
				else resolve(finished)
			}
		}
		pump()
	})
}

// the percentage of the strokes drawn when the file is thinned to stay inside the budget (ratio < 1), else 0 (nothing to say)
export function decimationPct(ratio) {
	return typeof ratio === 'number' && ratio < 1 ? Math.max(1, Math.round(ratio * 100)) : 0
}

// Evenly thinned selection: of `count` items keep `keep` of them spread across the whole list (always the first and the last). Used to decimate ACROSS layers
// instead of dropping the lower ones.
export function evenPick(count, keep) {
	const n = Math.max(0, count | 0)
	const k = Math.min(n, Math.max(0, keep | 0))
	if (k >= n) return Array.from({ length: n }, (_, i) => i)
	if (k <= 0) return []
	if (k === 1) return [n - 1]
	const out = []
	for (let i = 0; i < k; i++) out.push(Math.round((i * (n - 1)) / (k - 1)))
	return out.filter((v, i) => i === 0 || v !== out[i - 1])
}

// ---------- thumbnail first ----------

// Lists and cards show the small PNG the service rendered (gcodelib.thumbnail, synthetic or embedded) when the summary says it has one; an old service (the flag missing
// or false) keeps what existed before: the canvas of the top layers in the card, the cube icon in the lists.
export function useThumbnail(summary) {
	return !!summary && summary.has_preview_thumb === true
}

// An answer of gcodelib.thumbnail that already serves a request of `width` px: any answer when the PNG is synthetic (one small picture per file), else one at least as wide
export function thumbReusable(answer, width) {
	if (!answer) return false
	if (answer.none) return true
	if (answer.synthetic) return true
	return (answer.width || 0) >= (width || 0)
}
