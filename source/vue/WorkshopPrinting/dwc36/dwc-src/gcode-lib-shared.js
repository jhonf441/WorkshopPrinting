'use strict'

// The ONE store of the G-code library of this page (shared by the library page, the picker and the info cards: what one loads the others reuse).
// Reads are quiet: a failure is shown by the component, never as a toast.

import { api } from './workshop-api.js'
import { createLibStore } from './gcode-lib-store.js'

export const lib = createLibStore((op, args) => api(op, args, { quiet: true }))
