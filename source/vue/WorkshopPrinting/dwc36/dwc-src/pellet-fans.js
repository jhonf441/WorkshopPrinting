'use strict'

// ---- Fans added from the pellet panel ----
//
// Pure helpers of PelletFanAdd.vue (test/pellet-fans.test.js). Two kinds of fan:
//   'part'   cools the part / the nozzle: it belongs to the tool (the F list of its M563 line) and is set by hand or by the job
//   'throat' cools the throat of the screw: thermostatic, it follows the temperature of some heaters (M106 H.. T..)
// What is written into modefff.g carries "; workshop:fan <number> <kind> <name>" so it can be listed and removed again.

export var MARK = '; workshop:fan'

export function nameOk(name) {
	return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 24 && !/["';]/.test(name)
}

// the definition a form describes -> a complete and valid one, or {error}
export function normalize(f) {
	var kind = f && f.kind === 'throat' ? 'throat' : 'part'
	var out = {
		kind: kind,
		index: Number(f && f.index),
		name: String((f && f.name) || '').trim(),
		pin: String((f && f.pin) || '').trim(),
		freq: Math.round(Math.max(1, Math.min(50000, Number(f && f.freq) || 250))),
		heaters: ((f && f.heaters) || []).map(Number).filter(function (n) { return isFinite(n) && n >= 0 }),
		low: Math.round(Number(f && f.low)),
		high: Math.round(Number(f && f.high))
	}
	if (!Number.isInteger(out.index) || out.index < 0) return { error: 'index' }
	if (!nameOk(out.name)) return { error: 'name' }
	if (!/^[A-Za-z0-9_.]{2,24}$/.test(out.pin) || /\.\./.test(out.pin)) return { error: 'pin' }
	if (kind === 'throat') {
		if (!out.heaters.length) return { error: 'heaters' }
		if (!(out.low >= 0 && out.high >= out.low && out.high <= 300)) return { error: 'temps' }
	}
	return out
}

// the lines of one fan
export function lines(def) {
	var d = def
	var tag = MARK + ' ' + d.index + ' ' + d.kind + ' ' + d.name
	var out = ['M950 F' + d.index + ' C"' + d.pin + '" Q' + d.freq + '   ' + tag]
	if (d.kind === 'throat') out.push('M106 P' + d.index + ' S1 H' + d.heaters.join(':') + ' T' + d.low + ':' + d.high + '   ' + tag)
	return out
}

function toolLine(ls, tool) {
	for (var i = 0; i < ls.length; i++) {
		var code = ls[i].split(';')[0]
		var p = /\bP(\d+)/i.exec(code)
		if (/^\s*M563\b/i.test(code) && p && Number(p[1]) === Number(tool)) return i
	}
	return -1
}

// the F list of the M563 line with the fan added (or removed)
function withFanList(line, index, add) {
	var comment = line.indexOf(';') >= 0 ? line.slice(line.indexOf(';')) : ''
	var code = comment ? line.slice(0, line.indexOf(';')) : line
	var m = /\bF([\d:]+)/i.exec(code)
	var list = m ? m[1].split(':').map(Number) : []
	list = list.filter(function (n) { return n !== index })
	if (add) list.push(index)
	list.sort(function (a, b) { return a - b })
	if (m) code = list.length ? code.replace(/\bF[\d:]+/i, 'F' + list.join(':')) : code.replace(/\s*\bF[\d:]+/i, '')
	else if (list.length) code = code.replace(/\s+$/, '') + ' F' + list.join(':') + ' '
	return code.replace(/\s+$/, comment ? ' ' : '') + comment
}

// modefff.g with the fan added: its lines go before the tool's M563 line and, if it is a part fan, it joins the tool's F list
export function applyFan(text, tool, def) {
	var eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'
	var ls = text.split(/\r?\n/)
	var k = toolLine(ls, tool)
	if (k < 0) return { ok: false, text: text, error: 'no_m563' }
	if (ls.some(function (l) { return l.indexOf(MARK + ' ' + def.index + ' ') >= 0 })) return { ok: false, text: text, error: 'exists' }
	if (def.kind === 'part') ls[k] = withFanList(ls[k], def.index, true)
	var block = lines(def)
	return { ok: true, text: ls.slice(0, k).concat(block, ls.slice(k)).join(eol), error: '' }
}

// the fans this page created: [{index, kind, name}]
export function marked(text) {
	var out = [], seen = {}
	String(text || '').split(/\r?\n/).forEach(function (l) {
		var m = new RegExp(MARK + ' (\\d+) (part|throat) (.*)$').exec(l)
		if (m && !seen[m[1]]) { seen[m[1]] = 1; out.push({ index: Number(m[1]), kind: m[2], name: m[3].trim() }) }
	})
	return out
}

// modefff.g without a fan this page created (its lines and its place in the tool's F list)
export function removeFan(text, tool, index) {
	var eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'
	var ls = text.split(/\r?\n/)
	var tag = MARK + ' ' + index + ' '
	if (!ls.some(function (l) { return l.indexOf(tag) >= 0 })) return { ok: false, text: text, error: 'missing' }
	ls = ls.filter(function (l) { return l.indexOf(tag) < 0 })
	var k = toolLine(ls, tool)
	if (k >= 0) ls[k] = withFanList(ls[k], index, false)
	return { ok: true, text: ls.join(eol), error: '' }
}

// first fan number free in the board (OM list) and not used by a fan of the file
export function nextFanIndex(omFans, limit) {
	for (var i = 0; i < limit; i++) if (!(omFans || [])[i]) return i
	return -1
}
