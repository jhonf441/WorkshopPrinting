'use strict'

// The data layer of the G-code library: calls the operations of the service ONCE per thing and keeps the answers in LRU caches (thumbnails, file info,
// windows of layers), so the page, the picker and the info cards share them. `call(op, args)` is injected (gcode-lib-shared.js gives the api client).
// Pure of Vue: test/gcode-lib-store.test.js.

import { createLru, createSizedLru, estimateWindowBytes } from './gcode-lru.js'
import { thumbReusable } from './gcode-lib-stream.js'
import { windowKey, apiRange } from './gcode-lib-layers.js'
import { isUnsupported } from './gcode-lib-list.js'

export function createLibStore(call, limits) {
	// windows are limited by their estimated size (a whole file of a few MB stays), `windows` (a count) only when a caller asks for it
	const lim = Object.assign({ thumbs: 120, infos: 40, windowBytes: 48 * 1024 * 1024 }, limits || {})
	const thumbs = createLru(lim.thumbs)
	const infos = createLru(lim.infos)
	const windows = lim.windows ? createLru(lim.windows) : createSizedLru(lim.windowBytes, estimateWindowBytes)
	const pending = new Map() // in-flight promises by key: the same request is never sent twice
	const stamps = new Map() // file -> 'modified:size' last seen in a list row
	const store = { unsupported: false }

	function once(key, make) {
		if (pending.has(key)) return pending.get(key)
		const p = make().then((v) => { pending.delete(key); return v }, (e) => { pending.delete(key); throw e })
		pending.set(key, p)
		return p
	}

	async function guarded(op, args) {
		try {
			return await call(op, args)
		} catch (e) {
			if (isUnsupported(e)) store.unsupported = true
			throw e
		}
	}

	// the answers {state: 'pending' | 'working'} (not read yet) and {state: 'error', error} of the info / layers operations
	function notReady(out) {
		if (out && out.state === 'error') {
			const e = new Error(out.error || 'error')
			e.code = 'file_error'
			return e
		}
		const e = new Error('pending')
		e.code = 'pending'
		return e
	}
	const ready = (out) => !!out && (!out.state || out.state === 'ready')

	// one window of layers; the service stops at ~400 KB (`truncated`, `to` = the last layer sent): the rest is asked from to + 1 and joined
	async function fetchWindow(file, win, detail, table) {
		const r = apiRange(win, table)
		let from = r.from
		const layers = []
		const types = []
		let last = null
		for (let round = 0; round < 8; round++) {
			const out = await guarded('gcodelib.layers', { file, from, to: r.to, detail })
			if (!ready(out)) throw notReady(out)
			last = out
			;(out.layers || []).forEach((l) => layers.push(l))
			;(out.types || []).forEach((t) => { if (types.indexOf(t) < 0) types.push(t) })
			if (!out.truncated || !(out.layers || []).length) break
			from = (typeof out.to === 'number' ? out.to : from + out.layers.length - 1) + 1
			if (from > r.to) break
		}
		return { from: r.from, to: r.to, total: last ? last.total : 0, types, detail, layers }
	}

	store.forgetFile = (file) => {
		thumbs.delete(file)
		infos.delete(file)
		windows.deletePrefix(file + '|')
	}

	// a list row seen: when the file changed on the card its cached data is dropped
	store.noteRow = (row) => {
		if (!row || !row.path) return
		const stamp = row.modified + ':' + row.size
		const old = stamps.get(row.path)
		stamps.set(row.path, stamp)
		if (old !== undefined && old !== stamp) store.forgetFile(row.path)
	}

	store.list = (args) => guarded('gcodelib.list', args).then((out) => {
		store.unsupported = false
		if (out && out.counts && typeof out.counts === 'object') store.counts = out.counts // files per kind over the whole library
		;((out && out.rows) || []).forEach(store.noteRow)
		return out
	})

	// {summary, header, temps, layers_table} or {state:'pending'} (not cached while pending)
	store.info = (file) => {
		if (infos.has(file)) return Promise.resolve(infos.get(file))
		return once('i|' + file, async () => {
			const out = await guarded('gcodelib.info', { file })
			if (out && out.state === 'error') throw notReady(out)
			if (out && out.summary && ready(out)) return infos.set(file, out)
			return { state: 'pending' }
		})
	}
	store.cachedInfo = (file) => infos.peek(file) || null

	// {width,height,png_base64} or {none:true}; resolves a data URL (or '') for convenience: store.thumbUrl
	// ONE request per file: the answer is kept by file and serves every width (a synthetic PNG is one small picture; an embedded one serves the widths up to its own)
	store.thumbnail = (file, width) => {
		if (thumbs.has(file) && thumbReusable(thumbs.peek(file), width)) return Promise.resolve(thumbs.get(file))
		return once('t|' + file, async () => {
			const out = await guarded('gcodelib.thumbnail', width ? { file, width } : { file })
			if (out && (out.png_base64 || out.none)) return thumbs.set(file, out)
			return { none: true } // not read yet or unreadable: no picture now, not remembered
		})
	}
	store.cachedThumbnail = (file, width) => {
		const t = thumbs.peek(file)
		return t && thumbReusable(t, width) ? t : null
	}

	// the answer of gcodelib.layers for an aligned window (win = {from,to} indexes), table = layers_table of the file
	store.layerWindow = (file, win, detail, table) => {
		const key = windowKey(file, detail, win)
		if (windows.has(key)) return Promise.resolve(windows.get(key))
		return once('w|' + key, async () => {
			return windows.set(key, await fetchWindow(file, win, detail, table))
		})
	}
	store.cachedWindow = (file, win, detail) => windows.peek(windowKey(file, detail, win)) || null

	store.refresh = async (file) => {
		if (file) store.forgetFile(file)
		return guarded('gcodelib.refresh', file ? { file } : {})
	}

	store.sizes = () => ({ thumbs: thumbs.size, infos: infos.size, windows: windows.size, windowBytes: windows.bytes || 0 })
	return store
}

// the data URL of a thumbnail answer ('' when the file has none)
export function thumbUrl(t) {
	return t && t.png_base64 ? 'data:image/png;base64,' + t.png_base64 : ''
}
