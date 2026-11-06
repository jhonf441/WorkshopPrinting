'use strict'

// ---- Filament extruder panel (N-1, 2026-11-06): the Operate card of a FILAMENT tool ----
//
// The pellet tool has its panel (Pellet.vue); a filament tool had none: only the state page. This module is the pure part of FilamentPanel.vue
// (test/filament-panel.test.js): which heater, which fans, and why an action is not allowed now. Nothing here touches the machine or the DOM.
// The G-code is the one every other page uses: heatCode / coolCode (tool-codes.js), fanCode / flowCode (pellet-hmi.js).
//
// The four parts of a filament tool, as the board declares them:
//   heater     the first heater of the tool (M563 H): the hotend
//   extruder   the first extruder of the tool (M563 D): flow factor here, loading and unloading in Load material
//   layer fan  the fans bound to the tool (M563 F): they blow on the part, set by hand
//   hotend fan the thermostatic fans (M106 H T) that are not the tool's: they cool the heat break, the board runs them

// the hotend heater of a tool: the first of the heaters Print.vue built with that tool (zone 0)
export function toolHeater(heaters, tool) {
	if (!tool) return null
	var mine = (heaters || []).filter(function (h) { return h && h.tool === tool.number })
	mine.sort(function (a, b) { return a.zone - b.zone })
	return mine[0] || null
}

// the fans of a tool in the three groups of the panel; every fan is in exactly one
export function fanGroups(fans, tool) {
	var ids = (tool && tool.fans) || []
	var all = fans || []
	var layer = all.filter(function (f) { return ids.indexOf(f.id) >= 0 })
	var hotend = all.filter(function (f) { return f.thermostatic && layer.indexOf(f) < 0 })
	var others = all.filter(function (f) { return layer.indexOf(f) < 0 && hotend.indexOf(f) < 0 })
	return { layer: layer, hotend: hotend, others: others }
}

// why the heater may not be set now ('' = it may); temp = what the person typed, heater.max = the limit of the board
//   'no_tool' no tool or no heater   'job' a file job runs   'machine' the machine is not free   'sensor' / 'fault' the heater cannot be trusted
//   'range' the temperature is not above 0 or over the limit
export function heatReason(opts) {
	var o = opts || {}
	if (!o.tool || !o.heater) return 'no_tool'
	if (o.busyJob) return 'job'
	if (o.notFree) return 'machine'
	if (o.heater.sensorBad) return 'sensor'
	if (o.heater.state === 'fault') return 'fault'
	var t = Number(o.temp)
	if (!(t > 0) || (o.heater.max > 0 && t > o.heater.max)) return 'range'
	return ''
}

// turning the heater off is safe (a tap): only the job, the machine and a missing tool stop it
export function coolReason(opts) {
	var o = opts || {}
	if (!o.tool || !o.heater) return 'no_tool'
	if (o.busyJob) return 'job'
	if (o.notFree) return 'machine'
	return ''
}

// a hotend fan that is not turning while the hotend is hot (above `limit` degrees): the heat break can soften and the filament jams
export function hotendFanWarning(fan, heater, limit) {
	if (!fan || !heater || heater.sensorBad) return false
	var off = !(fan.value > 0.01)
	return off && heater.current > (limit > 0 ? limit : 60)
}

// the fan's own percentage text, with the rpm when the board reads it
export function fanText(fan) {
	if (!fan) return ''
	var p = Math.round((Number(fan.value) || 0) * 100)
	return p + ' %' + (fan.rpm > 0 ? ' - ' + Math.round(fan.rpm) + ' rpm' : '')
}
