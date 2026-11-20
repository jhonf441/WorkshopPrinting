'use strict'

// ---- Did the file change on the card since it was read? (pure: no Vue, no service; test/file-stamp.test.js) ----
//
// The service tells nothing live about a file that changes: the page asks again at three fixed moments (the section is shown, before Apply, when step 4 is reached),
// ONE gcodelib.list call filtered by the name of the file, and compares the stamp ('<modified>:<size>') with the one the draft took when the file was read.
// An unknown stamp on either side is never a change: nothing is claimed on a guess.

import { listArgs } from './gcode-lib-list.js'
import { baseName, folderOf, fullPath } from './gcode-lib-format.js'
import { samePath, stampOf, stampChanged } from './job-draft.js'

// the arguments of the one gcodelib.list call that finds the file: its folder and its name as the search text
export function stampListArgs(file) {
	const path = fullPath(file)
	return listArgs({ dir: folderOf(path), query: baseName(path), sort: 'name' }, 0, 50)
}

// the row of the answer that is that very file (null when the answer does not have it)
export function rowOf(rows, file) {
	const list = Array.isArray(rows) ? rows : []
	return list.find(r => r && samePath(r.path, file)) || null
}

// the stamp the card has now for the file, '' when the answer does not say
export function stampNow(rows, file) {
	return stampOf(rowOf(rows, file))
}

// 'stale' the file changed since the stamp was taken; 'fresh' it did not; 'unknown' one of the two stamps is missing
export function staleState(known, rows, file) {
	const now = stampNow(rows, file)
	if (!known || !now) return 'unknown'
	return stampChanged(known, now) ? 'stale' : 'fresh'
}
