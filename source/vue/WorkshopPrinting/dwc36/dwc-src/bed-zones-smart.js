'use strict'

// ---- Bed zones: the smart tidy-up (pure) ----
//
// ONE explicit action of the technician ("Tidy up" in the editing panel), never a mode: nothing here runs by itself when a zone is added or removed or when
// the bed changes. It RESPECTS what the user did: the width and height of a zone never change (except the second, confirmed action `shrinkToFit`, one uniform
// scale for all), the relative position (rows and columns are read from where the zones are now, the reading order is kept) and it only makes the result
// tidy: edges of every row and column aligned, the same space between neighbours, the block centred (or in the corner). Everything is millimetres of the
// bed (see bed-zones-layout.js); the functions return new data and never touch their input. The component only shows the preview and applies the result.
//
// Steps of arrangeZones (the reasons are in informes/zonas-de-cama-geometria/DISENO.md):
//   1. resolveConflicts: zones outside the bed or overlapping are pushed the least possible along the axis of smaller overlap (order is never swapped);
//   2. rows: zones whose vertical extent overlaps at least ROW_OVERLAP (50 %) of the smaller height, or whose centre falls inside the row, share a row;
//   3. columns: as many as the longest row has; every other row is matched to them keeping its order (left edges, least total distance);
//   4. gap: the most frequent space between neighbours today (1 mm bins), or the one typed, never below the minimum, shrunk only when the block needs it;
//   5. every row is as tall as its tallest zone, every column as wide as its widest; zones sit on the top left of their cell; the block is placed.
// Rows are read first (reading order); only when that cannot fit, the other direction (columns first) is tried, for layouts made of staggered columns.
import { round1, EPS, overlaps } from './bed-zones-layout.js'
import { MIN_ZONE_MM, placeMissing } from './bed-zones-drag.js'

export const ROW_OVERLAP = 0.5 // share of the smaller height (width) that must overlap to be on the same row (column)
export const ORDERS = ['keep', 'best']
export const ANCHORS = ['center', 'corner']
export const DEFAULT_OPTIONS = { order: 'keep', anchor: 'center', gap: null, minGap: 0 }
const SHELF_STEPS = 24 // widths tried by the "best use" packing
const BEST_GAIN = 0.05 // the best use only reorders when it saves at least this share of the wasted area

const finite = v => typeof v === 'number' && isFinite(v)
const floor1 = v => Math.floor(v * 10 + 1e-7) / 10
const ceil1 = v => Math.ceil(v * 10 - 1e-7) / 10
const copy = r => (r ? Object.assign({}, r) : null)
const usable = r => !!r && finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h) && r.w > 0 && r.h > 0
const swapAxes = r => (r ? { x: r.y, y: r.x, w: r.h, h: r.w } : r)

// The options as the page may hand them (a text field may be empty or wrong): always a complete, valid set
export function normalizeOptions(options) {
	const o = options || {}
	const num = v => (finite(v) && v >= 0 ? round1(Math.min(v, 5000)) : null)
	return {
		order: ORDERS.indexOf(o.order) >= 0 ? o.order : DEFAULT_OPTIONS.order,
		anchor: ANCHORS.indexOf(o.anchor) >= 0 ? o.anchor : DEFAULT_OPTIONS.anchor,
		gap: num(o.gap),
		minGap: num(o.minGap) || 0
	}
}

// ---- 1. overlaps and zones outside the bed ----

function clampInside(r, bed) {
	if (r.x < 0 || r.x + r.w > bed.width + EPS) r.x = Math.max(0, floor1(Math.min(r.x, bed.width - r.w)))
	if (r.y < 0 || r.y + r.h > bed.length + EPS) r.y = Math.max(0, floor1(Math.min(r.y, bed.length - r.h)))
}

// New rects with no overlap and nothing outside the bed, moving as little as possible: a zone that is fine does not move. A zone outside is brought inside; two zones
// that overlap are pushed apart half each along the axis of the SMALLER overlap, away from each other (so the order never changes), and brought back inside if that
// pushed them out (`keepOut`: only the overlaps are solved, a zone outside stays where it is; arrangeZones uses it to read the layout of the user as it is). Zones without a rect (null) stay null. Zones larger than the bed cannot be made to fit: they are put at 0 and the rest is done around them.
export function resolveConflicts(rects, bed, keepOut) {
	const out = rects.map(r => (usable(r) ? copy(r) : null))
	const ids = out.map((r, i) => i).filter(i => out[i])
	const inside = r => { if (!keepOut) clampInside(r, bed) }
	ids.forEach(i => inside(out[i]))
	for (let pass = 0; pass < 200; pass++) {
		let moved = false
		for (let p = 0; p < ids.length; p++) {
			for (let q = p + 1; q < ids.length; q++) {
				const a = out[ids[p]], b = out[ids[q]]
				const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
				const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
				if (ox <= EPS || oy <= EPS) continue
				moved = true
				const horizontal = ox <= oy
				const ca = horizontal ? a.x + a.w / 2 : a.y + a.h / 2
				const cb = horizontal ? b.x + b.w / 2 : b.y + b.h / 2
				const dir = cb >= ca ? 1 : -1 // b comes after a unless it is clearly before
				const d = ceil1((horizontal ? ox : oy) / 2)
				const key = horizontal ? 'x' : 'y'
				a[key] = round1(a[key] - dir * d)
				b[key] = round1(b[key] + dir * d)
				inside(a)
				inside(b)
			}
		}
		if (!moved) break
	}
	return out
}

// ---- 2 and 3. rows and columns from where the zones are ----

// Rows of the zones that have a usable rect: [[{i, r}, ...], ...] top to bottom, each row left to right. A zone joins the row with which it shares most of its vertical
// extent (at least ROW_OVERLAP of the smaller height, or its centre inside the row); otherwise it opens a new row at its place.
function clusterRows(rects) {
	const items = rects.map((r, i) => ({ i, r })).filter(it => usable(it.r))
	items.sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x || a.i - b.i)
	const rows = []
	items.forEach(it => {
		let best = null
		let bestOv = 0
		rows.forEach(row => {
			const n = row.members.length
			const top = row.sumTop / n
			const h = row.sumH / n
			const ov = Math.min(it.r.y + it.r.h, top + h) - Math.max(it.r.y, top)
			const cy = it.r.y + it.r.h / 2
			const joins = ov >= ROW_OVERLAP * Math.min(it.r.h, h) - EPS || (cy >= top - EPS && cy <= top + h + EPS)
			if (joins && ov > bestOv + EPS) { best = row; bestOv = ov }
		})
		if (best) {
			best.members.push(it)
			best.sumTop += it.r.y
			best.sumH += it.r.h
		} else rows.push({ members: [it], sumTop: it.r.y, sumH: it.r.h })
	})
	rows.sort((a, b) => a.sumTop / a.members.length - b.sumTop / b.members.length)
	return rows.map(row => row.members.sort((a, b) => a.r.x - b.r.x || a.i - b.i))
}

// The indexes of the zones in reading order (rows top to bottom, each left to right)
export function readingOrder(rects) {
	return clusterRows(rects).reduce((all, row) => all.concat(row.map(it => it.i)), [])
}

// Matches the k members of a short row to k of the nc columns, keeping their order, at the least total distance between left edges (the first column wins a tie)
function matchColumns(lefts, refs) {
	const k = lefts.length
	const nc = refs.length
	const cost = (a, b) => Math.abs(lefts[a] - refs[b])
	const dp = []
	for (let a = 0; a <= k; a++) dp.push(new Array(nc + 1).fill(a === 0 ? 0 : Infinity))
	for (let a = 1; a <= k; a++) {
		for (let b = a; b <= nc; b++) {
			const use = dp[a - 1][b - 1] + cost(a - 1, b - 1)
			dp[a][b] = use < dp[a][b - 1] - EPS ? use : dp[a][b - 1]
		}
	}
	const cols = new Array(k)
	let b = nc
	for (let a = k; a >= 1; a--) {
		while (b > a && dp[a][b] === dp[a][b - 1]) b--
		cols[a - 1] = b - 1
		b--
	}
	return cols
}

// The grid of the zones: {cells: [{i, row, col}], nr, nc}. Columns are as many as the longest row; every row keeps its order inside them.
function detectGrid(rects) {
	const rows = clusterRows(rects)
	const nc = rows.reduce((m, row) => Math.max(m, row.length), 0)
	const refs = new Array(nc).fill(0)
	const full = rows.filter(row => row.length === nc)
	for (let c = 0; c < nc; c++) refs[c] = full.reduce((s, row) => s + row[c].r.x, 0) / full.length
	const cells = []
	rows.forEach((row, r) => {
		const cols = row.length === nc ? row.map((it, c) => c) : matchColumns(row.map(it => it.r.x), refs)
		row.forEach((it, k) => cells.push({ i: it.i, row: r, col: cols[k] }))
	})
	return { cells, nr: rows.length, nc }
}

// ---- 4. the gap ----

// The most frequent space between neighbouring columns and rows today (1 mm bins; ties go to the smaller; the value is the median of the bin), or null when there is
// no neighbour. Spaces are measured between the extent of a column (or row) and the next one, so a smaller zone inside its cell does not count as a bigger gap.
function estimateGap(grid, rects) {
	const spans = (key, size, count) => {
		const lo = new Array(count).fill(Infinity)
		const hi = new Array(count).fill(-Infinity)
		grid.cells.forEach(c => {
			const k = key === 'x' ? c.col : c.row
			const r = rects[c.i]
			lo[k] = Math.min(lo[k], r[key])
			hi[k] = Math.max(hi[k], r[key] + r[size])
		})
		return { lo, hi }
	}
	const cs = spans('x', 'w', grid.nc)
	const rs = spans('y', 'h', grid.nr)
	const found = []
	for (let c = 0; c + 1 < grid.nc; c++) found.push(cs.lo[c + 1] - cs.hi[c])
	for (let r = 0; r + 1 < grid.nr; r++) found.push(rs.lo[r + 1] - rs.hi[r])
	const spaces = found.filter(v => v >= -EPS).map(v => Math.max(0, v))
	if (!spaces.length) return null
	const bins = {}
	spaces.forEach(v => { const b = Math.round(v); (bins[b] = bins[b] || []).push(v) })
	const win = Object.keys(bins).map(Number).sort((a, b) => bins[b].length - bins[a].length || a - b)[0]
	const list = bins[win].sort((a, b) => a - b)
	return round1(list[Math.floor(list.length / 2)])
}

// ---- 5. placing ----

const sum = list => list.reduce((s, v) => s + v, 0)

// The cell sizes of a grid: the widest zone of every column and the tallest of every row
function cellSizes(grid, rects) {
	const colW = new Array(grid.nc).fill(0)
	const rowH = new Array(grid.nr).fill(0)
	grid.cells.forEach(c => {
		colW[c.col] = Math.max(colW[c.col], rects[c.i].w)
		rowH[c.row] = Math.max(rowH[c.row], rects[c.i].h)
	})
	return { colW, rowH }
}

function blockOrigin(W, H, bed, anchor) {
	return anchor === 'corner' ? { x0: 0, y0: 0 } : { x0: Math.max(0, floor1((bed.width - W) / 2)), y0: Math.max(0, floor1((bed.length - H) / 2)) }
}

// Rects of the grid with `gap` between cells, the block placed by `anchor`; sizes untouched. Returns {rects (by index), W, H}.
function placeGrid(grid, rects, gap, bed, anchor) {
	const { colW, rowH } = cellSizes(grid, rects)
	const W = sum(colW) + gap * (grid.nc - 1)
	const H = sum(rowH) + gap * (grid.nr - 1)
	const o = blockOrigin(W, H, bed, anchor)
	const left = [], top = []
	colW.reduce((x, w, c) => { left[c] = x; return x + w + gap }, 0)
	rowH.reduce((y, h, r) => { top[r] = y; return y + h + gap }, 0)
	const out = rects.map(() => null)
	grid.cells.forEach(c => {
		const r = rects[c.i]
		out[c.i] = { x: round1(o.x0 + left[c.col]), y: round1(o.y0 + top[c.row]), w: r.w, h: r.h }
	})
	return { rects: out, W, H }
}

// The result of a tidy-up that cannot be done: nothing moves
function failure(rects, skipped, shortfall, extra) {
	return Object.assign({ ok: true, fits: false, rects: rects.map(copy), moves: [], changed: false, rows: 0, cols: 0, gap: 0, gapReduced: false, columnsFirst: false, reordered: false, shortfall, skipped }, extra || {})
}

// One candidate of the grid kind in one direction (`flip`: columns first, everything seen with x and y swapped). Returns {fits, ...} with rects in the real axes.
function gridCandidate(rects, bed, o, flip) {
	const f = flip ? swapAxes : r => r
	const seen = rects.map(f)
	const b = flip ? { width: bed.length, length: bed.width } : bed
	const grid = detectGrid(seen)
	const { colW, rowH } = cellSizes(grid, seen)
	const wanted = Math.max(o.minGap, o.gap !== null ? o.gap : (estimateGap(grid, seen) || 0))
	const needW = sum(colW)
	const needH = sum(rowH)
	const roomW = grid.nc > 1 ? (b.width - needW) / (grid.nc - 1) : Infinity
	const roomH = grid.nr > 1 ? (b.length - needH) / (grid.nr - 1) : Infinity
	const room = Math.min(roomW, roomH)
	const area = sum(grid.cells.map(c => seen[c.i].w * seen[c.i].h))
	if (room < o.minGap - EPS || needW > b.width + EPS || needH > b.length + EPS) {
		const sw = Math.max(0, needW + o.minGap * (grid.nc - 1) - b.width)
		const sh = Math.max(0, needH + o.minGap * (grid.nr - 1) - b.length)
		return { fits: false, cells: grid.nr * grid.nc, shortfall: flip ? { w: sh, h: sw } : { w: sw, h: sh } }
	}
	const gap = Math.max(o.minGap, Math.min(wanted, isFinite(room) ? floor1(room) : wanted))
	const placed = placeGrid(grid, seen, gap, b, o.anchor)
	return { fits: true, columnsFirst: flip, cells: grid.nr * grid.nc, rects: placed.rects.map(f), rows: flip ? grid.nc : grid.nr, cols: flip ? grid.nr : grid.nc, gap, gapReduced: gap < wanted - EPS, waste: placed.W * placed.H - area }
}

// Rows of zones packed one after the other (next fit) up to `limit` wide, in the given order; every row left aligned, top aligned. Real axes unless `flip`.
function shelfCandidate(rects, order, bed, o, flip, limit, gap) {
	const f = flip ? swapAxes : r => r
	const b = flip ? { width: bed.length, length: bed.width } : bed
	const rows = []
	let cur = null
	order.forEach(i => {
		const r = f(rects[i])
		if (cur && cur.w + gap + r.w <= limit + EPS) { cur.items.push(i); cur.w += gap + r.w; cur.h = Math.max(cur.h, r.h) } else { cur = { items: [i], w: r.w, h: r.h }; rows.push(cur) }
	})
	const W = rows.reduce((m, row) => Math.max(m, row.w), 0)
	const H = sum(rows.map(row => row.h)) + gap * (rows.length - 1)
	if (W > b.width + EPS || H > b.length + EPS) return null
	const org = blockOrigin(W, H, b, o.anchor)
	const out = rects.map(() => null)
	let y = org.y0
	rows.forEach(row => {
		let x = org.x0
		row.items.forEach(i => {
			const r = f(rects[i])
			out[i] = f({ x: round1(x), y: round1(y), w: r.w, h: r.h })
			x += r.w + gap
		})
		y += row.h + gap
	})
	const area = sum(order.map(i => rects[i].w * rects[i].h))
	return { rects: out, rows: flip ? Math.max(...rows.map(row => row.items.length)) : rows.length, cols: flip ? rows.length : Math.max(...rows.map(row => row.items.length)), waste: W * H - area }
}

function moveTotal(from, to) {
	return sum(from.map((r, i) => (r && to[i] ? Math.abs(to[i].x - r.x) + Math.abs(to[i].y - r.y) : 0)))
}

function movesOf(from, to) {
	const out = []
	from.forEach((r, i) => {
		if (!r || !to[i]) return
		const m = { index: i, dx: round1(to[i].x - r.x), dy: round1(to[i].y - r.y), dw: round1(to[i].w - r.w), dh: round1(to[i].h - r.h) }
		if (Math.abs(m.dx) > EPS || Math.abs(m.dy) > EPS || Math.abs(m.dw) > EPS || Math.abs(m.dh) > EPS) out.push(m)
	})
	return out
}

// The best-use candidates: packed rows (and columns) in a few orders and widths; the least wasted area wins, ties go to the least movement
function bestShelf(rects, ids, bed, o, gap) {
	const reading = readingOrder(rects)
	const by = key => ids.slice().sort((a, b) => rects[b][key] - rects[a][key] || reading.indexOf(a) - reading.indexOf(b))
	const orders = [reading, by('h'), by('w'), ids.slice().sort((a, b) => rects[b].w * rects[b].h - rects[a].w * rects[a].h || reading.indexOf(a) - reading.indexOf(b))]
	let best = null
	;[false, true].forEach(flip => {
		const b = flip ? { width: bed.length, length: bed.width } : bed
		const widest = Math.max(...ids.map(i => (flip ? rects[i].h : rects[i].w)))
		for (let s = 0; s <= SHELF_STEPS; s++) {
			const limit = widest + (b.width - widest) * s / SHELF_STEPS
			orders.forEach(order => {
				const c = shelfCandidate(rects, order, bed, o, flip, limit, gap)
				if (!c) return
				const move = moveTotal(rects, c.rects)
				if (!best || c.waste < best.waste - EPS || (Math.abs(c.waste - best.waste) <= EPS && move < best.move)) best = Object.assign(c, { move })
			})
		}
	})
	return best
}

// The tidy-up. rects: one per zone, null where a zone has no rect yet (those are left out and listed in `skipped`). Returns
// {ok, fits, rects, moves: [{index, dx, dy, dw, dh}], changed, rows, cols, gap, gapReduced, columnsFirst (the layout was read column by column), reordered, shortfall: {w, h} (mm that are missing when it does not fit), skipped}.
// When it does not fit nothing moves; the sizes of the zones are never changed.
export function arrangeZones(rects, bed, options) {
	const o = normalizeOptions(options)
	const ids = rects.map((r, i) => i).filter(i => usable(rects[i]))
	const skipped = rects.map((r, i) => i).filter(i => !usable(rects[i]))
	if (!ids.length) return failure(rects, skipped, { w: 0, h: 0 }, { fits: true })
	const start = resolveConflicts(rects, bed, true)
	const a = gridCandidate(start, bed, o, false)
	const b = gridCandidate(start, bed, o, true)
	const keep = a.fits ? a : b.fits ? b : null
	let pick = keep
	let wasted = keep ? keep.waste : Infinity
	if (o.order === 'best') {
		const gap = keep ? keep.gap : o.gap !== null ? Math.max(o.gap, o.minGap) : o.minGap
		let shelf = bestShelf(start, ids, bed, o, gap)
		if (!shelf && gap > o.minGap) shelf = bestShelf(start, ids, bed, o, o.minGap)
		if (shelf && (!keep || shelf.waste < wasted * (1 - BEST_GAIN) - EPS)) pick = Object.assign({ fits: true, gap: shelf.gap === undefined ? gap : shelf.gap, gapReduced: false }, shelf)
	}
	if (!pick) {
		const miss = a.cells <= b.cells ? a.shortfall : b.shortfall
		return failure(rects, skipped, { w: round1(miss.w), h: round1(miss.h) })
	}
	const out = rects.map((r, i) => (usable(r) ? pick.rects[i] : copy(r)))
	const moves = movesOf(rects, out)
	return {
		ok: true,
		fits: true,
		rects: out,
		moves,
		changed: moves.length > 0,
		rows: pick.rows,
		cols: pick.cols,
		gap: pick.gap,
		gapReduced: !!pick.gapReduced,
		columnsFirst: !!pick.columnsFirst,
		reordered: o.order === 'best' && JSON.stringify(readingOrder(out)) !== JSON.stringify(readingOrder(start)),
		shortfall: { w: 0, h: 0 },
		skipped
	}
}

// ---- the second action: one uniform reduction ----

// When the zones do not fit at their size: ONE scale for all (the same share of width and height, so proportions between zones and inside each zone stay) at the
// largest value that fits, then tidied as arrangeZones does. Sizes are rounded DOWN to 0.1 mm. {ok, scale, ...the tidy-up}; ok is false (nothing changes) when the
// zones would become smaller than MIN_ZONE_MM. When they already fit the scale is 1 and nothing is resized.
export function shrinkToFit(rects, bed, options) {
	const base = arrangeZones(rects, bed, options)
	if (base.fits) return Object.assign({ scale: 1 }, base)
	const ids = rects.map((r, i) => i).filter(i => usable(rects[i]))
	const smallest = Math.min(...ids.map(i => Math.min(rects[i].w, rects[i].h)))
	const scaled = s => rects.map(r => (usable(r) ? { x: r.x * s, y: r.y * s, w: Math.max(0.1, floor1(r.w * s)), h: Math.max(0.1, floor1(r.h * s)) } : r))
	const tryScale = s => arrangeZones(scaled(s), bed, options)
	let lo = 0, hi = 1
	for (let n = 0; n < 40; n++) {
		const mid = (lo + hi) / 2
		if (tryScale(mid).fits) lo = mid
		else hi = mid
	}
	let s = lo
	let res = tryScale(s)
	for (let n = 0; n < 200 && !res.fits && s > 0; n++) { s = floor1(s * 1000 - 1) / 1000 ; res = tryScale(s) }
	if (!res.fits || s * smallest < MIN_ZONE_MM - EPS) return Object.assign({ scale: s }, failure(rects, base.skipped, base.shortfall, { ok: false }))
	return Object.assign(res, { scale: Math.floor(s * 10000) / 10000, moves: movesOf(rects, res.rects), changed: true })
}

// ---- a sensible spot for a zone that has no rect yet ----

// Gives every zone WITHOUT a rect the size of the last zone that has one and a spot that goes with the rows and columns of the others, without moving any of them:
// the end of a row that is shorter than the longest (the last one first), else a new row below or a new column at the right (the side with more room), else the
// first free spot of placeMissing. Spaces use the usual gap of the existing zones. Same result shape as placeMissing: {zones, ok}.
export function placeNew(zones, bed) {
	const out = zones.map(z => Object.assign({}, z))
	let ok = true
	out.forEach(z => {
		if (z.rect) return
		const have = out.filter(q => q.rect).map(q => q.rect)
		const rect = have.length ? smartSpot(have, bed) : null
		if (rect) { z.rect = rect; return }
		const placed = placeMissing(out.filter(q => q.rect).concat([Object.assign({}, z)]), bed)
		const spot = placed.zones[placed.zones.length - 1].rect
		if (spot) z.rect = spot
		else ok = false
	})
	return { zones: out, ok }
}

function smartSpot(have, bed) {
	const last = have[have.length - 1]
	const w = last.w, h = last.h
	const grid = detectGrid(have)
	const gap = estimateGap(grid, have) || 0
	const free = c => c.x >= -EPS && c.y >= -EPS && c.x + w <= bed.width + EPS && c.y + h <= bed.length + EPS && !overlaps(have.concat([{ x: c.x, y: c.y, w, h }])).some(p => p[1] === have.length)
	const rows = []
	for (let r = 0; r < grid.nr; r++) rows.push(grid.cells.filter(c => c.row === r).map(c => have[c.i]))
	const tries = []
	for (let r = rows.length - 1; r >= 0; r--) {
		if (rows[r].length < grid.nc) tries.push({ x: Math.max(...rows[r].map(q => q.x + q.w)) + gap, y: Math.min(...rows[r].map(q => q.y)) })
	}
	const right = Math.max(...have.map(q => q.x + q.w))
	const below = Math.max(...have.map(q => q.y + q.h))
	const left = Math.min(...have.map(q => q.x))
	const top = Math.min(...have.map(q => q.y))
	const newColumn = { x: right + gap, y: top }
	const newRow = { x: left, y: below + gap }
	const roomRight = (bed.width - right - gap - w) / bed.width
	const roomBelow = (bed.length - below - gap - h) / bed.length
	if (roomRight >= roomBelow) tries.push(newColumn, newRow)
	else tries.push(newRow, newColumn)
	for (const t of tries) {
		const c = { x: round1(t.x), y: round1(t.y) }
		if (free(c)) return { x: c.x, y: c.y, w, h }
	}
	return null
}
