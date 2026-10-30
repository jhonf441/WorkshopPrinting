'use strict'

// ---- Pellet feeding (hopper) ----
//
// Pure helpers of the feeding card of the pellet panel (test/pellet-feed.test.js). Feeding has two parts that the person
// defines: a LEVEL SENSOR (a general purpose input of the board, M950 J) and a FEEDING MECHANISM (a general purpose output,
// M950 P: a relay of a vacuum loader, an auger motor driver...). Then it is run by hand ("manual") or by the board itself
// ("automatic": a trigger, M581, runs a macro that feeds while the sensor says the hopper is empty).
// Everything the page writes into modefff.g carries the mark "; workshop:feed" so it can be replaced or removed as a block.

export var MARK = '; workshop:feed'

export var DEFAULT = {
	mode: 'manual', // 'manual' | 'auto'
	sensor: null, // { index: gpIn number, present: 1|0 } present = value of the input while there is pellet
	mechanism: null, // { index: gpOut number }
	run_s: 5, // seconds the mechanism runs each time
	wait_s: 10, // seconds it waits between runs (the pellet has to fall to the sensor)
	max_s: 60 // longest a filling may take: then it stops and tells (an empty bin or a jam)
}

function num(v, min, max, d) {
	var n = Number(v)
	if (!isFinite(n)) return d
	return Math.max(min, Math.min(max, n))
}

// a saved (or empty) setting -> a complete and valid one
export function normalize(raw) {
	var r = raw && typeof raw === 'object' ? raw : {}
	var s = r.sensor && Number.isInteger(Number(r.sensor.index)) && Number(r.sensor.index) >= 0
		? { index: Number(r.sensor.index), present: Number(r.sensor.present) === 0 ? 0 : 1, pin: pinOk(r.sensor.pin) ? String(r.sensor.pin).trim() : '' } : null
	var m = r.mechanism && Number.isInteger(Number(r.mechanism.index)) && Number(r.mechanism.index) >= 0
		? { index: Number(r.mechanism.index), pin: pinOk(r.mechanism.pin) ? String(r.mechanism.pin).trim() : '', freq: Math.round(num(r.mechanism.freq, 1, 5000, 500)) } : null
	return {
		mode: r.mode === 'auto' ? 'auto' : 'manual',
		sensor: s,
		mechanism: m,
		run_s: num(r.run_s, 1, 60, DEFAULT.run_s),
		wait_s: num(r.wait_s, 0, 600, DEFAULT.wait_s),
		max_s: num(r.max_s, 5, 3600, DEFAULT.max_s)
	}
}

// 'sensor' | 'mechanism' | '' : what automatic feeding still needs (it needs both, defined AND present in the board)
export function autoMissing(cfg, gpIn, gpOut) {
	var c = normalize(cfg)
	if (!c.sensor || !(gpIn || [])[c.sensor.index]) return 'sensor'
	if (!c.mechanism || !(gpOut || [])[c.mechanism.index]) return 'mechanism'
	return ''
}

// state of the hopper from the level sensor: 'full' | 'empty' | 'unknown' (no sensor)
export function hopperState(cfg, gpIn) {
	var c = normalize(cfg)
	if (!c.sensor) return 'unknown'
	var g = (gpIn || [])[c.sensor.index]
	if (!g || g.value == null) return 'unknown'
	return Number(g.value) === c.sensor.present ? 'full' : 'empty'
}

// ---- pins ----

// a pin name of the board as RRF writes it: out4, io3.in, io3.out, exp.heater3, 1.out2 (board 1)
export function pinOk(pin) {
	return typeof pin === 'string' && /^[A-Za-z0-9_.]{2,24}$/.test(pin.trim()) && !/\.\./.test(pin)
}

// true when some of the texts (config.g, the three mode files) already use that pin: C"pin" or C"pin+pin2"
export function pinInUse(texts, pin) {
	var p = String(pin || '').trim().toLowerCase()
	if (!p) return false
	var re = /\bC"([^"]*)"/gi
	for (var i = 0; i < texts.length; i++) {
		var lines = String(texts[i] || '').split(/\r?\n/)
		for (var j = 0; j < lines.length; j++) {
			var code = lines[j].split(';')[0]
			if (lines[j].indexOf(MARK) >= 0) continue // our own previous lines do not count as another use
			var m
			re.lastIndex = 0
			while ((m = re.exec(code))) {
				if (m[1].toLowerCase().replace(/^[!^~]+/, '').split('+').some(function (x) { return x.replace(/^[!^~]+/, '') === p })) return true
			}
		}
	}
	return false
}

// first number of a board list (gpIn / gpOut) that is free (null or missing), up to the limit
export function nextFree(list, limit) {
	for (var i = 0; i < limit; i++) if (!(list || [])[i]) return i
	return -1
}

// ---- G-code the page sends ----

// pulse of the mechanism by hand: on, wait, off (the off line is also sent if the page fails in the middle)
export function pulseCodes(index, seconds) {
	var s = Math.round(num(seconds, 1, 60, 5))
	return { on: 'M42 P' + Number(index) + ' S1', wait: 'G4 S' + s, off: 'M42 P' + Number(index) + ' S0' }
}

// ---- what is written into modefff.g and the trigger macro ----

export function definitionLines(cfg) {
	var c = normalize(cfg)
	var out = []
	if (c.sensor && c.sensor.pin) out.push('M950 J' + c.sensor.index + ' C"' + c.sensor.pin + '"' + '   ' + MARK + ' (level sensor)')
	if (c.mechanism && c.mechanism.pin) out.push('M950 P' + c.mechanism.index + ' C"' + c.mechanism.pin + '" Q' + c.mechanism.freq + '   ' + MARK + ' (feeder)')
	return out
}

// the line that makes the board run the trigger macro when the sensor goes EMPTY (falling edge if "present" is 1)
export function triggerLine(cfg, trigger) {
	var c = normalize(cfg)
	if (!c.sensor) return ''
	return 'M581 P' + c.sensor.index + ' T' + trigger + ' S' + (c.sensor.present === 1 ? 0 : 1) + ' R0   ' + MARK + ' (automatic feeding)'
}

// the macro: feeds in short runs while the sensor still says empty, never longer than max_s, and always leaves the output off
export function triggerMacro(cfg) {
	var c = normalize(cfg)
	if (!c.sensor || !c.mechanism) return MARK + '\n; automatic feeding is off\n'
	var empty = c.sensor.present === 1 ? 0 : 1
	return [
		MARK + ' (written by the 3D printing page; edit it there)',
		'; feeds pellet while the level sensor says the hopper is empty, in runs of ' + c.run_s + ' s with ' + c.wait_s + ' s between them, at most ' + c.max_s + ' s',
		'var t = 0',
		'while sensors.gpIn[' + c.sensor.index + '].value = ' + empty + ' && var.t < ' + c.max_s,
		'  M42 P' + c.mechanism.index + ' S1',
		'  G4 S' + c.run_s,
		'  M42 P' + c.mechanism.index + ' S0',
		'  G4 S' + c.wait_s,
		'  set var.t = var.t + ' + (c.run_s + c.wait_s),
		'M42 P' + c.mechanism.index + ' S0',
		'if sensors.gpIn[' + c.sensor.index + '].value = ' + empty,
		'  M291 P"The hopper is still empty after ' + c.max_s + ' s: check the bin and the feeder" R"Pellet feeding" S1 T0',
		''
	].join('\n')
}

// modefff.g with the feed block replaced: every line carrying the mark goes away and `lines` are put before the tool's M563
// line (so the inputs and outputs exist before the tool). Returns {ok, text, error}.
export function applyFeedToMode(text, tool, lines) {
	var eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'
	var ls = text.split(/\r?\n/).filter(function (l) { return l.indexOf(MARK) < 0 })
	var k = -1
	for (var i = 0; i < ls.length; i++) {
		var code = ls[i].split(';')[0]
		var p = /\bP(\d+)/i.exec(code)
		if (/^\s*M563\b/i.test(code) && p && Number(p[1]) === Number(tool)) { k = i; break }
	}
	if (k < 0) return { ok: false, text: text, error: 'no_m563' }
	var block = lines.slice()
	return { ok: true, text: ls.slice(0, k).concat(block, ls.slice(k)).join(eol), error: '' }
}

// first free trigger number from 3 up (0 is the emergency stop, 1 pause, 2 resume): files = names in 0:/sys
export function nextTrigger(files) {
	var used = {}
	;(files || []).forEach(function (f) { var m = /^trigger(\d+)\.g$/i.exec(String(f)); if (m) used[Number(m[1])] = 1 })
	for (var i = 3; i < 20; i++) if (!used[i]) return i
	return -1
}

// trigger number of the M581 line this page wrote (null if there is none): the macro is rewritten in the same file
export function markedTrigger(text) {
	var ls = String(text || '').split(/\r?\n/)
	for (var i = 0; i < ls.length; i++) {
		if (ls[i].indexOf(MARK) < 0 || !/^\s*M581\b/i.test(ls[i])) continue
		var m = /\bT(\d+)/i.exec(ls[i].split(';')[0])
		if (m) return Number(m[1])
	}
	return null
}
