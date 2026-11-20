'use strict'

// ---- One copy of printing.json for the page, with a notice to whoever listens (pure: no Vue, no network; test/config-store.test.js) ----
//
// Until now every section read the file by itself, so a profile saved in Profiles was not seen in Prepare job until the page was reloaded. The store keeps what was
// read last, hands out the same answer to two reads that overlap, and tells the listeners whenever the file was read again or written from this page. The format of the
// file does not change and nothing here decides what a value means: the sections still pick what they need from the copy.
//
//   createConfigStore(read, write)
//     read()         -> Promise of the parsed file ({} when it cannot be read: util.js readJson already answers its default)
//     write(change)  -> Promise of the whole file after the change (util.js updateCfg: it reads again right before it writes, so a change made in another tab is kept)
//   store.get()        the copy of the last read ({} before any)
//   store.loaded       true once something was read
//   store.error        the error of the last read that failed (null when it went well): the copy is then empty and `update` REFUSES to write, so a file that could not be
//                      read is never overwritten with only the changed key
//   store.load(force)  the copy; reads when there is none yet or `force` (two overlapping reads share ONE call)
//   store.update(c)    writes the change and keeps the answer as the copy
//   store.subscribe(fn) fn(copy) on every read and write; returns the function that stops it

const clone = v => JSON.parse(JSON.stringify(v || {}))

export function createConfigStore(read, write) {
	let copy = {}
	let loaded = false
	let inflight = null
	let error = null
	const subs = []
	const emit = () => {
		const snap = clone(copy)
		subs.slice().forEach(fn => { try { fn(snap) } catch (e) { /* a broken listener must not stop the others */ } })
	}
	const take = (cfg) => {
		copy = clone(cfg)
		loaded = true
		error = null
		emit()
		return clone(copy)
	}
	const fail = (e) => {
		copy = {}
		loaded = true
		error = e || new Error('unreadable')
		emit()
		return {}
	}
	return {
		get loaded() {
			return loaded
		},
		get error() {
			return error
		},
		get() {
			return clone(copy)
		},
		load(force) {
			if (loaded && !force) return Promise.resolve(clone(copy))
			if (!inflight) inflight = Promise.resolve().then(read).then(take, fail).finally(() => { inflight = null })
			return inflight.then(clone)
		},
		async update(change) {
			if (error) throw error
			return take(await write(change))
		},
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
