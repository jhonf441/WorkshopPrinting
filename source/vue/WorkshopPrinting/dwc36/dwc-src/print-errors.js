'use strict'

// Failures of the calls that write the machine's configuration (modefff.g, printing.json, the PID), as a person reads them (F3-P,
// 2026-10-21). Pure (no Vue): test/print-errors.test.js. friendly-error.js (vue/_shared) classifies the error; here we decide which
// ones the page shows with ErrorNotice (the role that is missing, the PIN, the service that does not answer) and which ones keep the
// message the page already had for the step that failed ("not saved: ...").
//
//   isFriendly(e)             true for a 403 (role), 401 (PIN), the service being down or outdated
//   fileError(status, file, t)  the error to throw when the SD refuses to write `file` (HTTP 401 / 403): the shape of ApiError plus `action`,
//                             so ErrorNotice names the action, the role that is needed and the current one

import { errorKind } from './friendly-error.js'

const FRIENDLY = ['role', 'login', 'unavailable', 'outdated'];

export function isFriendly(e) {
	return FRIENDLY.includes(errorKind(e));
}

// t(key, params) = the translator of the page. null when the status is not about who the person is.
// The error carries the standard code and `action` (what was being written); it carries NO sentence of its own: ErrorNotice (vue/_shared36, on top of
// session-refusal.js) says "<action> requires the role <needed>. Your role: <role>..." or "Requires signing in" at the moment of drawing, so the text follows the
// role and the language.
export function fileError(status, file, t) {
	const code = status === 403 ? 'forbidden' : status === 401 ? 'login_required' : '';
	if (!code) return null;
	return Object.assign(new Error('HTTP ' + status + ': ' + file), { code, status, action: t('plugins.WorkshopPrinting.errors.save_action', { file }) });
}
