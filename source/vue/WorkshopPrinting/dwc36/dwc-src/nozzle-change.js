'use strict'

// Nozzle change of the pellet extruder: what changes with the diameter. The firmware has no nozzle diameter, so the page keeps it
// (printing.json, key nozzleSize) and says what has to be done again.

export var MIN_D = 0.2 // mm
export var MAX_D = 8 // mm

export function validDiameter(d) {
	var n = Number(d)
	return isFinite(n) && n >= MIN_D && n <= MAX_D
}

// 'smaller' | 'larger' | 'same' | 'first' (no previous diameter known)
export function sizeChange(oldD, newD) {
	if (!validDiameter(newD)) return 'same'
	if (!validDiameter(oldD)) return 'first'
	var a = Math.round(Number(oldD) * 1000)
	var b = Math.round(Number(newD) * 1000)
	return b < a ? 'smaller' : b > a ? 'larger' : 'same'
}

function r2(v) {
	return Math.round(v * 100) / 100
}

// the numbers the slicer profile needs for this nozzle: line width from 100 to 120 % of the diameter, layer up to 80 %
export function slicerLimits(d) {
	var n = Number(d)
	return { lineMin: r2(n), lineMax: r2(n * 1.2), layerMax: r2(n * 0.8), layerMin: r2(n * 0.25) }
}

// the opening of the nozzle changes with the square of the diameter: how many times the section is
export function sectionRatio(oldD, newD) {
	return r2((Number(newD) / Number(oldD)) * (Number(newD) / Number(oldD)))
}

// heats the tool to the melt temperature (active) / stops its heating: only that tool
export function heatCode(tool, temp) {
	return 'M568 P' + Number(tool) + ' S' + Math.round(Number(temp)) + ' A2'
}
export function offCode(tool) {
	return 'M568 P' + Number(tool) + ' S0 R0 A0'
}

// the checks that are due after the change, in order; 'goto' is the section of the page where it is done
export function followUps(change) {
	var list = [
		{ id: 'flow', goto: 'extruder' },
		{ id: 'pid', goto: 'pid' },
		{ id: 'pressure', goto: 'pellet' },
		{ id: 'zoffset', goto: null },
		{ id: 'slicer', goto: null }
	]
	if (change === 'smaller') list.splice(1, 0, { id: 'stall', goto: 'pellet' })
	return list
}
