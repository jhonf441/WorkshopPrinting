'use strict'

// Copy a short text (a file path) to the clipboard. The kiosk and most machines are opened over plain http, where the async clipboard does not exist:
// the old selection command is the fallback. Resolves true when the text was copied, false when the browser refused (the page then says so: the text
// stays on screen to be read). It writes nothing to the machine. env = { navigator, document } (the browser's by default; the tests give fakes).

export function copyText(text, env) {
	const e = env || {}
	const nav = e.navigator || (typeof navigator !== 'undefined' ? navigator : null)
	const doc = e.document || (typeof document !== 'undefined' ? document : null)
	const value = String(text == null ? '' : text)
	if (!value) return Promise.resolve(false)
	const viaSelection = () => {
		if (!doc || typeof doc.createElement !== 'function' || !doc.body) return false
		let field = null
		try {
			field = doc.createElement('textarea')
			field.value = value
			field.setAttribute('readonly', '')
			field.setAttribute('aria-hidden', 'true')
			field.style.position = 'fixed'
			field.style.opacity = '0'
			doc.body.appendChild(field)
			field.select()
			return doc.execCommand('copy') === true
		} catch (err) {
			return false
		} finally {
			if (field && field.parentNode) field.parentNode.removeChild(field)
		}
	}
	const clip = nav && nav.clipboard
	if (clip && typeof clip.writeText === 'function') {
		return Promise.resolve().then(() => clip.writeText(value)).then(() => true, () => viaSelection())
	}
	return Promise.resolve(viaSelection())
}
