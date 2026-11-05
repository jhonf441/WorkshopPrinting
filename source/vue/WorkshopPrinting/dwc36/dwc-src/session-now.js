'use strict'

// The sentence of a refusal with the identity of this moment (see session-note.js): used by the pages in their catch blocks.

import { refusalText } from './session-note.js'
import { signedOut, workshopRole } from './workshop-auth.js'
import { ts } from './shared-t.js'

export function refusalNow(e, need) {
	return refusalText(e, need || 'technician', { signedOut: signedOut(), role: workshopRole(), t: ts });
}
