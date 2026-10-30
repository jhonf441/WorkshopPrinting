'use strict'

// Failures of the calls that write the machine's configuration (modefff.g, printing.json, the PID), as a person reads them (F3-P,
// 2026-10-21). Pure (no Vue): test/print-errors.test.js. friendly-error.js (vue/_shared) classifies the error; here we decide which
// ones the page shows with ErrorNotice (the role that is missing, the PIN, the service that does not answer) and which ones keep the
// message the page already had for the step that failed ("not saved: ...").
//
//   isFriendly(e)             true for a 403 (role), 401 (PIN), the service being down or outdated
//   fileError(status, file, t)  the error to throw when the SD refuses to write `file` (HTTP 401 / 403): the same shape as ApiError
//                             (code / message / status) so ErrorNotice shows what role is needed and offers the PIN dialog

import { errorKind } from './friendly-error.js'

const FRIENDLY = ['role', 'login', 'unavailable', 'outdated'];

export function isFriendly(e) {
	return FRIENDLY.includes(errorKind(e));
}

// t(key, params) = the translator of the page. null when the status is not about who the person is
export function fileError(status, file, t) {
	if (status === 403) return Object.assign(new Error(t('plugins.WorkshopPrinting.errors.need_technician', { file })), { code: 'forbidden', status });
	if (status === 401) return Object.assign(new Error(t('plugins.WorkshopPrinting.errors.need_login', { file })), { code: 'login_required', status });
	return null;
}
