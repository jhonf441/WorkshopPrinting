'use strict'

// A refused call told by its cause (owner rule, 2026-11-04: the reason is written next to the thing that does not move, and a refusal is
// never shown as an empty state or as a raw "Sin permiso" / "HTTP 401" text). Test: test/session-note.test.js.
//
//   isRefusal(e)                      true when the service refused the call for who the person is: 403 (role) or 401 (no session)
//   refusalText(e, need, who)         the sentence for a refusal, by cause: no session -> "sign in"; low role -> "needs role X, yours is Y".
//                                     who = { signedOut, role, t }  (t = translator of the shared texts). '' when e is not a refusal
//                                     (the page keeps its own text for it). Pure.
//   (session-now.js: refusalNow(e, need) = the same with the identity of this moment and the shared texts)
// The kind of the error is its code (friendly-error.js errorKind: 'forbidden' = role, 'login_required' = no session).

const ROLE = 'forbidden';
const LOGIN = 'login_required';

export function isRefusal(e) {
	const code = e && e.code;
	return code === ROLE || code === LOGIN;
}

export function refusalText(e, need, who) {
	if (!isRefusal(e)) return '';
	// a 401 is always "no session"; a 403 while nobody is signed in too (signing in may fix it)
	if (e.code === LOGIN || who.signedOut) return who.t('lock_signed_out');
	return who.t('lock_role', { needed: who.t('lockrole_' + need), role: who.t('lockrole_' + (who.role || 'viewer')) });
}
