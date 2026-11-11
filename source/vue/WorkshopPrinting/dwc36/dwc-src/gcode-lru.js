'use strict'

// A small least-recently-used cache (Map keeps insertion order: the first key is the oldest). Pure, no Vue.
// Used by the G-code library for thumbnails, file info and fetched windows of layers, so that browsing many files
// never grows the memory of the page without limit.

export function createLru(max) {
	const limit = Math.max(1, Math.floor(max) || 1)
	const map = new Map()
	return {
		get(key) {
			if (!map.has(key)) return undefined
			const v = map.get(key)
			map.delete(key)
			map.set(key, v)
			return v
		},
		peek(key) {
			return map.get(key)
		},
		has(key) {
			return map.has(key)
		},
		set(key, value) {
			if (map.has(key)) map.delete(key)
			map.set(key, value)
			while (map.size > limit) map.delete(map.keys().next().value)
			return value
		},
		delete(key) {
			return map.delete(key)
		},
		// removes every entry whose key starts with `prefix` (all the windows of one file)
		deletePrefix(prefix) {
			for (const k of Array.from(map.keys())) if (typeof k === 'string' && k.indexOf(prefix) === 0) map.delete(k)
		},
		clear() {
			map.clear()
		},
		get size() {
			return map.size
		},
		keys() {
			return Array.from(map.keys())
		}
	}
}

// ---------- a cache limited by SIZE (bytes), not by count ----------

// The estimated memory of an answer of gcodelib.layers (windows of layers): 8 bytes per number of the polylines and of the travel lists, plus a little per entry.
export function estimateWindowBytes(ans) {
	let n = 64
	const layers = ans && Array.isArray(ans.layers) ? ans.layers : []
	for (let i = 0; i < layers.length; i++) {
		const l = layers[i] || {}
		n += 48
		const seg = l.segments || {}
		const types = Object.keys(seg)
		for (let t = 0; t < types.length; t++) {
			const lines = seg[types[t]] || []
			for (let k = 0; k < lines.length; k++) n += 24 + (lines[k] ? lines[k].length * 8 : 0)
		}
		if (Array.isArray(l.travel)) n += l.travel.length * 8
	}
	return n
}

// Same API as createLru, but the limit is the sum of sizeOf(value) of the entries: a whole file of a few MB stays in memory while many small ones are not
// counted by number. The newest entry is never evicted by its own size (an answer bigger than the limit is kept alone).
export function createSizedLru(maxBytes, sizeOf) {
	const limit = Math.max(1, Math.floor(maxBytes) || 1)
	const map = new Map() // key -> { value, size }
	let total = 0
	const drop = (k) => {
		const e = map.get(k)
		if (e) { total -= e.size; map.delete(k) }
		return !!e
	}
	return {
		get(key) {
			const e = map.get(key)
			if (!e) return undefined
			map.delete(key)
			map.set(key, e)
			return e.value
		},
		peek(key) {
			const e = map.get(key)
			return e ? e.value : undefined
		},
		has(key) {
			return map.has(key)
		},
		set(key, value) {
			drop(key)
			const size = Math.max(0, sizeOf(value) || 0)
			map.set(key, { value, size })
			total += size
			while (total > limit && map.size > 1) drop(map.keys().next().value)
			return value
		},
		delete(key) {
			return drop(key)
		},
		deletePrefix(prefix) {
			for (const k of Array.from(map.keys())) if (typeof k === 'string' && k.indexOf(prefix) === 0) drop(k)
		},
		clear() {
			map.clear()
			total = 0
		},
		get size() {
			return map.size
		},
		get bytes() {
			return total
		},
		keys() {
			return Array.from(map.keys())
		}
	}
}
