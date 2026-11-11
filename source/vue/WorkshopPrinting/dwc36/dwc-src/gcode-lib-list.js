'use strict'

// The list of the G-code library: windowing (only the visible rows are drawn), paging (only the pages those rows need are fetched)
// and the polling rule for files the service is still indexing. Pure, no Vue: test/gcode-lib-list.test.js.

export const PAGE_SIZE = 50
export const ROW_HEIGHT = 64
export const OVERSCAN = 4
export const SORTS = ['name', 'modified', 'size', 'time']

// The rows [first, last) to draw for a scroll position (clamped; `overscan` rows of margin each side)
export function visibleRange(scrollTop, viewHeight, rowHeight, total, overscan) {
	const rh = Math.max(1, rowHeight || ROW_HEIGHT)
	const n = Math.max(0, total || 0)
	const extra = overscan == null ? OVERSCAN : overscan
	const top = Math.max(0, scrollTop || 0)
	const first = Math.min(n, Math.max(0, Math.floor(top / rh) - extra))
	const last = Math.min(n, Math.ceil((top + Math.max(0, viewHeight || 0)) / rh) + extra)
	return { first, last: Math.max(first, last) }
}

// Offsets of the pages that cover the rows [first, last)
export function pagesFor(first, last, pageSize) {
	const ps = pageSize || PAGE_SIZE
	const out = []
	if (last <= first) return out
	for (let p = Math.floor(first / ps); p <= Math.floor((last - 1) / ps); p++) out.push(p * ps)
	return out
}

// The arguments of gcodelib.list for a page
export function listArgs(q, offset, limit) {
	const a = { limit: Math.min(200, limit || PAGE_SIZE), offset: offset || 0 }
	if (q && q.dir) a.dir = q.dir
	if (q && q.query && String(q.query).trim()) a.query = String(q.query).trim()
	a.sort = q && SORTS.indexOf(q.sort) >= 0 ? q.sort : 'name'
	if (q && q.desc) a.desc = true
	if (q && Array.isArray(q.kind) && q.kind.length) a.kind = q.kind.slice() // the kinds of file to list (3D print, laser, CNC, travel); none = all
	return a
}

// A sparse store of rows by index, filled page by page. A new query (reset) empties it.
export function createRowStore(pageSize) {
	const ps = pageSize || PAGE_SIZE
	let rows = new Map()
	let loaded = new Set()
	let inflight = new Set()
	return {
		pageSize: ps,
		reset() {
			rows = new Map()
			loaded = new Set()
			inflight = new Set()
		},
		get(i) {
			return rows.get(i) || null
		},
		set(offset, list) {
			(list || []).forEach((r, k) => rows.set(offset + k, r))
			loaded.add(offset)
			inflight.delete(offset)
		},
		// the offsets still to fetch for the rows [first, last) (not loaded and not being fetched); they are marked as being fetched
		claim(first, last) {
			const need = pagesFor(first, last, ps).filter((o) => !loaded.has(o) && !inflight.has(o))
			need.forEach((o) => inflight.add(o))
			return need
		},
		// keeps the rows on screen but forgets what was loaded: the next claim fetches the visible pages again (files finished indexing, a refresh)
		markStale() {
			loaded = new Set()
			inflight = new Set()
		},
		release(offset) {
			inflight.delete(offset)
		},
		loadedOffsets() {
			return Array.from(loaded)
		}
	}
}

// ms until the next poll of the list: 0 = do not poll (nothing pending). Backs off while the answer does not change.
export function pollDelay(pending, quietRounds) {
	if (!(pending > 0)) return 0
	const q = Math.max(0, quietRounds || 0)
	return Math.min(8000, 2000 + q * 1000)
}

// How a row is shown: the chip (null when ready) with its icon, colour and kind (label key gcodeLib.state_<kind>)
export function stateChip(row) {
	const st = (row && row.state) || 'ready'
	if (st === 'ready') return null
	if (st === 'error') return { kind: 'error', icon: 'mdi-alert-circle-outline', color: 'error' }
	if (st === 'working') return { kind: 'working', icon: 'mdi-progress-clock', color: 'primary' }
	return { kind: 'pending', icon: 'mdi-clock-outline', color: 'grey' }
}

// folders: the sub-folder `name` of `base` (the answer of gcodelib.list carries `dir` and `dirs`), and the parent of `dir` ('' = the root, the default folder of the service)
export const ROOT_DIR = '0:/gcodes'

export function childDir(base, name) {
	return String(base || ROOT_DIR).replace(/\/+$/, '') + '/' + name
}

export function parentDir(dir, root) {
	const top = String(root || ROOT_DIR).replace(/\/+$/, '')
	const d = String(dir || '').replace(/\/+$/, '')
	const up = d.slice(0, Math.max(0, d.lastIndexOf('/')))
	return !d || d === top || up.length <= top.length ? '' : up
}

// the service of this machine does not know the library (old WorkshopService)
export function isUnsupported(err) {
	return !!err && (err.code === 'service_outdated' || err.code === 'unknown_op')
}
