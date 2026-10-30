'use strict'

// ---- Pellet extruder panel (industrial HMI style, 2026-10-21) ----
//
// Pure helpers of PelletHmi.vue and Pellet.vue (test/pellet-hmi.test.js): colours, the G-code of every edit the panel
// offers and the reasons why an action is not allowed now. Nothing here touches the machine or the DOM.

// state colours (DESIGN.md 2): green at temperature, amber heating, orange overshoot, red fault, grey off
export var COLORS = { ok: '#2e7d32', heating: '#ff8f00', over: '#e65100', fault: '#c62828', off: '#616161', tuning: '#e65100' }

export function zoneState(z) {
	if (!z) return 'off'
	if (z.sensorBad || z.state === 'fault') return 'fault'
	if (z.state === 'tuning') return 'tuning'
	if (!(z.target > 0) || z.state === 'off') return 'off'
	if (z.current > z.target + 10) return 'over'
	if (Math.abs(z.current - z.target) <= 3) return 'ok'
	return 'heating'
}

// "heat glow" of a barrel band: from cold blue to red-hot along the temperature, 0..1 of its limit
export function glow(z) {
	if (!z || z.sensorBad || !isFinite(z.current)) return 0
	var top = z.max > 0 ? z.max : 300
	return Math.max(0, Math.min(1, (z.current - 25) / (top - 25)))
}

export function glowColor(g) {
	// 0 = grey-blue, 0.5 = orange, 1 = red
	var stops = [[0, [84, 110, 122]], [0.45, [255, 143, 0]], [1, [211, 47, 47]]]
	for (var i = 1; i < stops.length; i++) {
		if (g <= stops[i][0]) {
			var a = stops[i - 1], b = stops[i], k = (g - a[0]) / (b[0] - a[0] || 1)
			return 'rgb(' + [0, 1, 2].map(function (n) { return Math.round(a[1][n] + (b[1][n] - a[1][n]) * k) }).join(',') + ')'
		}
	}
	return 'rgb(211,47,47)'
}

// seconds of one turn of a fan or the screw for the animation (0 = still)
export function spinSeconds(value, slowest, fastest) {
	var v = Number(value)
	if (!(v > 0.01)) return 0
	return +(slowest - (slowest - fastest) * Math.min(1, v)).toFixed(2)
}

// ---- G-code of the edits (all of them are run-time: config.g / modefff.g keep the saved values) ----

export function pct(v) {
	var n = Math.round(Number(v))
	return isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
}

// part / auxiliary fan to a percentage (a thermostatic fan is not set by hand: see fanTriggerCode)
export function fanCode(id, percent) {
	return 'M106 P' + Number(id) + ' S' + (pct(percent) / 100).toFixed(2)
}

// trigger temperature of a thermostatic fan: heaters and the low:high range (the fan runs between them)
export function fanTriggerCode(id, heaters, low, high) {
	var hs = (heaters || []).map(Number).filter(function (n) { return n >= 0 })
	var lo = Math.round(Number(low)), hi = Math.round(Number(high))
	if (!hs.length || !isFinite(lo) || !isFinite(hi) || lo < 0 || hi < lo || hi > 300) return ''
	return 'M106 P' + Number(id) + ' H' + hs.join(':') + ' T' + lo + ':' + hi
}

// extrude / retract a short distance (relative extruder, back to the mode the machine had is not needed: M83 is the mode of the jobs)
export function extrudeCode(distance, speed, retract) {
	var d = Math.abs(Number(distance)), s = Number(speed)
	if (!(d > 0) || d > 100 || !(s > 0) || s > 60) return ''
	return 'M83\nG1 E' + (retract ? '-' : '') + +d.toFixed(2) + ' F' + Math.round(s * 60)
}

export function flowCode(percent) {
	var p = Math.round(Number(percent))
	return p >= 10 && p <= 300 ? 'M221 S' + p : ''
}

export function advanceCode(extruder, seconds) {
	var s = Number(seconds)
	return s >= 0 && s <= 2 ? 'M572 D' + Number(extruder) + ' S' + +s.toFixed(3) : ''
}

// ---- reasons why the motor test is not allowed now ('' = it is) ----
// zones: the tool's heaters; minTemp: the machine's cold extrusion limit (RRF refuses below it anyway)
export function motorBlock(opts) {
	if (opts.busyJob) return 'job'
	if (opts.notFree) return 'machine'
	var zs = opts.zones || []
	if (!zs.length) return 'no_zone'
	if (zs.some(function (z) { return z.sensorBad || z.state === 'fault' })) return 'fault'
	var cold = zs.filter(function (z) { return !(z.current >= opts.minTemp) })
	if (cold.length) return 'cold'
	return ''
}

// ---- zone order (drag to reorder) ----
// Zone 1 is the NOZZLE: it is the first heater of the tool's M563 line (H1:2:3). Moving a zone changes which heater is the
// nozzle and the order of the staging, so the new order is written into modefff.g and the mode has to be reloaded.

// the list with the item `from` moved to the place `to` (indexes of the list; out of range = no change)
export function moveItem(list, from, to) {
	var n = list.length
	if (from === to || from < 0 || to < 0 || from >= n || to >= n) return list.slice()
	var out = list.slice()
	var it = out.splice(from, 1)[0]
	out.splice(to, 0, it)
	return out
}

// modefff.g text with the heater order of the tool changed. order = heater numbers, nozzle first. Returns
// {ok, text, error}: it only touches the H of the M563 line of that tool (comments and the rest of the file stay as they are)
export function reorderM563(text, tool, order) {
	var eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n'
	var lines = text.split(/\r?\n/)
	var done = false
	for (var i = 0; i < lines.length && !done; i++) {
		var code = lines[i].split(';')[0]
		if (!/^\s*M563\b/i.test(code)) continue
		var p = /\bP(\d+)/i.exec(code)
		if (!p || Number(p[1]) !== Number(tool)) continue
		var h = /\bH([\d:]+)/i.exec(code)
		if (!h) return { ok: false, text: text, error: 'no_h' }
		var old = h[1].split(':').map(Number).sort(function (a, b) { return a - b }).join(':')
		var neu = order.map(Number).slice().sort(function (a, b) { return a - b }).join(':')
		if (old !== neu) return { ok: false, text: text, error: 'other_heaters' } // not the same heaters: something changed meanwhile
		var at = lines[i].search(/\bH[\d:]+/i)
		var len = ('H' + h[1]).length
		lines[i] = lines[i].slice(0, at) + 'H' + order.map(Number).join(':') + lines[i].slice(at + len)
		done = true
	}
	if (!done) return { ok: false, text: text, error: 'no_m563' }
	return { ok: true, text: lines.join(eol), error: '' }
}

// ---- fans: what is known about them ----
// The board only tells the value that was ORDERED. A fan with a tachometer also reports its rpm (-1 = no tachometer): only that
// is evidence that it turns. Without it the panel shows the order as a gauge and never animates a spin.

// seconds of one turn drawn for a measured rpm (0 = not drawn turning)
export function fanSpin(f) {
	var rpm = Number(f && f.rpm)
	if (!(rpm > 0)) return 0
	return +Math.max(0.18, Math.min(1.6, 1.6 - (rpm / 6000) * 1.4)).toFixed(2)
}

// 'off' | 'ordered' (running by order, no tachometer) | 'turning' | 'stalled' (ordered, tachometer reads 0)
export function fanState(f) {
	var v = Number(f && f.value) || 0
	var rpm = Number(f && f.rpm)
	if (!(v > 0.01)) return 'off'
	if (!isFinite(rpm) || rpm < 0) return 'ordered'
	return rpm > 0 ? 'turning' : 'stalled'
}

// ---- layout and the text of a zone state ----

export function layoutOf(v) {
	return v === 'horizontal' ? 'horizontal' : 'vertical'
}

// the words of a zone state; t = the translator (key -> text)
export function zoneLabel(z, t) {
	var st = zoneState(z)
	var k = 'plugins.WorkshopPrinting.'
	if (st === 'fault') return z.sensorBad ? t(k + 'common.no_sensor') : t(k + 'pellet.st_fault')
	if (st === 'tuning') return t(k + 'pellet.st_tuning')
	if (st === 'off') return z.current > 50 ? t(k + 'pellet.off_still_hot') : t(k + 'pellet.st_off')
	if (st === 'over') return t(k + 'pellet.hotter_than_the_target')
	if (st === 'ok') return t(k + 'pellet.at_temperature')
	return t(k + 'pellet.st_heating')
}
