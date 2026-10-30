'use strict'

// ---- "How it is configured" rows of the Status section (2026-10-30, moved out of Print.vue to keep it small) ----
//
// Pure (test/heater-config.test.js): one row per heater with what the board's model says: whom it belongs to, the sensor, the cap
// and its monitors (M143), the heater model (M307) and the control (PID), all as text ready for the table. t(key, params) = the
// page's translator (key relative to plugins.WorkshopPrinting); fmt(v) = the page's number formatter (no decimals, '--' when
// unknown); readings = what "Read from the board" answered so far ({ [heaterId]: { output } }, Print.vue).

// sensor types with a name of their own (the others have a translated name)
const SENSOR_NAMES = { pt1000: 'PT1000', rtdmax31865: 'PT100 (MAX31865)', drivers: 'drivers' }
const SENSOR_KEYS = { thermistor: 'printing.st_thermistor', thermocouplemax31856: 'printing.st_tc_31856', thermocouplemax31855: 'printing.st_tc_31855', linearanalog: 'printing.st_linear', mcutemp: 'printing.st_mcu' }
// RRF: M143 A<n> (the action of a heater's monitor)
const MONITOR_ACTIONS = { 0: 'printing.mon_heater_fault', 1: 'printing.mon_turns_it_off', 2: 'printing.mon_turns_it_off_briefly', 3: 'printing.mon_shuts_machine_down' }

export function kindSensor(type, t) {
	if (!type) return t('printing.unknown_type')
	const k = String(type).toLowerCase()
	return SENSOR_NAMES[k] || (SENSOR_KEYS[k] ? t(SENSOR_KEYS[k]) : type)
}

export function monitorAction(action, t) {
	return MONITOR_ACTIONS[action] ? t(MONITOR_ACTIONS[action]) : t('printing.action_n', { n: action })
}

function dec(v, d) {
	return v == null || isNaN(v) ? '--' : Number(v).toFixed(d)
}

// opts: { heaters (the page's list), model (object model), tools, readings, fmt, t }
export function heaterConfigRows(opts) {
	const o = opts || {}
	const t = o.t, fmt = o.fmt
	const hs = (o.model && o.model.heat && o.model.heat.heaters) || []
	const sensors = (o.model && o.model.sensors && o.model.sensors.analog) || []
	const tools = o.tools || []
	const readings = o.readings || {}
	return (o.heaters || []).map(c => {
		const h = hs[c.id] || {}
		const sn = sensors[c.sensor] || {}
		const md = h.model || {}
		const pid = md.pid || {}
		const tool = c.tool != null ? tools.find(x => x.number === c.tool) : null
		let belongs = t('printing.no_tool')
		if (c.paper === 'bed') belongs = t('printing.bed_m140')
		else if (c.paper === 'camera') belongs = t('printing.chamber_m141')
		else if (tool) belongs = (tool.name ? tool.name + ' (T' + tool.number + ')' : 'T' + tool.number) + (tool.heaters.length > 1 ? ', ' + t('printing.zone_n_of_total', { n: c.zone + 1, total: tool.heaters.length }) : '')
		const mons = (h.monitors || []).filter(m => m && m.condition && m.condition !== 'disabled')
		const stopTxt = fmt(h.max) + ' °C' + (mons.length
			? ' · ' + mons.map(m => (m.condition === 'tooLow' ? t('printing.if_below_c', { c: fmt(m.limit) }) : t('printing.if_above_c', { c: fmt(m.limit) })) + ': ' + monitorAction(m.action, t)).join('; ')
			: '')
		const modelTxt = md.enabled === false ? t('printing.no_model_heater_disabled')
			: t('printing.model_heats_cools', { heat: dec(md.heatingRate, 2), cool: dec(md.coolingRate, 3) }) + (md.fanCoolingRate ? ' ' + t('printing.model_with_fan', { rate: dec(md.fanCoolingRate, 3) }) : '')
				+ ' · ' + t('printing.model_dead_time_max_power', { dead: dec(md.deadTime, 1), pwm: dec((md.maxPwm || 0) * 100, 0) })
				+ (md.standardVoltage ? ' · ' + t('printing.model_at_v', { v: dec(md.standardVoltage, 1) }) : '') + (md.inverted ? ' · ' + t('printing.model_inverted') : '')
		const pidTxt = pid.used === false ? t('printing.on_off_no_pid')
			: 'PID ' + (pid.overridden ? t('printing.pid_by_hand') : t('printing.pid_from_model')) + (pid.p != null ? ': P ' + dec(pid.p, 3) + ' · I ' + dec(pid.i, 4) + ' · D ' + dec(pid.d, 3) : '')
		const lec = readings[c.id] || {}
		return {
			id: c.id, name: c.name, icon: c.icon, sensor: c.sensor, max: h.max, belongsA: belongs, stopTxt, modelTxt, pidTxt,
			pidShort: md.enabled === false ? t('common.no_model') : pid.used === false ? t('printing.no_pid') : 'PID',
			output: lec.output || '',
			sensorTxt: 'S' + c.sensor + (sn.name ? ' "' + sn.name + '"' : '') + ' · ' + kindSensor(sn.type, t) + ' · ' + t('printing.reads') + ' ' + (c.sensorBad ? '--' : fmt(sn.lastReading != null ? sn.lastReading : c.current) + ' °C')
		}
	})
}
