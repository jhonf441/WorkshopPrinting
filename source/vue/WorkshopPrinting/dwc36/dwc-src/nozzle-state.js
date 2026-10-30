'use strict'

// What the page may say about the nozzle before the head is taken off. A sensor that is not connected reads -273 °C (open circuit):
// that is NOT "cold" - nobody knows - so it is its own state and the person has to check by hand.

export var UNREADABLE_BELOW = -200 // °C: a thermistor never reads this on a real machine

// 'none' (no nozzle heater) | 'unreadable' (no sensor reading) | 'cold' | 'hot'
export function nozzleState(n, coldBelow) {
	if (!n) return 'none'
	var c = Number(n.current)
	if (n.sensorBad || !isFinite(c) || c < UNREADABLE_BELOW) return 'unreadable'
	return c < coldBelow ? 'cold' : 'hot'
}
