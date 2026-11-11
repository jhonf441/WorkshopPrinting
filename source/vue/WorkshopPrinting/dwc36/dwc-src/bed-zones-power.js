'use strict'

// ---- Bed zones: what the geometry says about power (pure, an estimate) ----
//
// From the size of a zone (its rect, mm), the thickness and the material of the bed plate it heats, the energy to bring it from the room to a target
// temperature and the power to keep it there. EVERY input but the rect is optional: what is missing takes a reference value and is reported in `assumed`,
// and the figures that need an input the user did not give (the time with a given heater, the power margin) are left out instead of invented.
// It is an estimate for planning, never a safety limit: the limits of the settings stay the safety of the bed.

export const MATERIALS = {
	aluminium: { density: 2700, cp: 900 }, // kg/m3, J/(kg K)
	steel: { density: 7850, cp: 490 },
	glass: { density: 2500, cp: 840 },
	copper: { density: 8960, cp: 385 },
	custom: { density: 0, cp: 0 } // the user types both
}
export const DEFAULTS = { ambient: 20, target: 60, thickness: 6, material: 'aluminium', minutes: 15, cover: false }
// W per m2 per K of surface, free air (both faces of the plate) and with an insulating cover on the top face
export const H_TOP_OPEN = 10
export const H_TOP_COVER = 3
export const H_BOTTOM = 8

const num = v => {
	if (v === null || v === undefined || v === '') return null
	const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
	return isFinite(n) ? n : null
}
const pos = v => { const n = num(v); return n !== null && n > 0 ? n : null }
const round = (v, d) => { const k = Math.pow(10, d); return Math.round(v * k) / k }

// The inputs as the form holds them (text or numbers, '' = not given) to numbers or null
export function readInputs(raw) {
	const r = raw || {}
	return {
		ambient: num(r.ambient), target: num(r.target), thickness: pos(r.thickness), material: MATERIALS[r.material] ? r.material : null,
		density: pos(r.density), cp: pos(r.cp), minutes: pos(r.minutes), power: pos(r.power), cover: !!r.cover
	}
}

// rects: [{x, y, w, h}] mm (zones without a rect are skipped). Returns {zones: [...], total, assumed: [names of the inputs that took a reference value], problems: [keys]}
export function estimate(rects, raw) {
	const inp = readInputs(raw)
	const assumed = []
	const pick = (name, value, fallback) => { if (value === null) { assumed.push(name); return fallback } return value }
	const ambient = pick('ambient', inp.ambient, DEFAULTS.ambient)
	const target = pick('target', inp.target, DEFAULTS.target)
	const thickness = pick('thickness', inp.thickness, DEFAULTS.thickness)
	const minutes = pick('minutes', inp.minutes, DEFAULTS.minutes)
	const material = pick('material', inp.material, DEFAULTS.material)
	let density = MATERIALS[material].density
	let cp = MATERIALS[material].cp
	const problems = []
	if (material === 'custom') {
		if (inp.density === null || inp.cp === null) problems.push('power_err_custom')
		density = inp.density || 0
		cp = inp.cp || 0
	}
	const dT = target - ambient
	if (!(dT > 0)) problems.push('power_err_target')
	if (problems.length) return { zones: [], total: null, assumed, problems }
	const hTop = inp.cover ? H_TOP_COVER : H_TOP_OPEN
	const zones = []
	rects.forEach((r, i) => {
		if (!r || !(r.w > 0) || !(r.h > 0)) return
		const area = r.w * r.h / 1e6 // m2
		const mass = area * (thickness / 1000) * density // kg
		const energy = mass * cp * dT // J
		const hold = (hTop + H_BOTTOM) * area * dT // W kept lost at the target
		const wanted = energy / (minutes * 60) + hold / 2 // W: heating up in `minutes`, the loss grows while it warms (about half of the final one on average)
		const z = { n: i + 1, area_cm2: round(area * 1e4, 0), mass: round(mass, 2), energy_wh: round(energy / 3600, 1), hold: round(hold, 1), wanted: round(wanted, 0), density_wcm2: round(wanted / (area * 1e4), 2) }
		if (inp.power !== null) {
			const net = inp.power - hold / 2
			z.margin = round(inp.power - hold, 0) // W left over once it is hot: negative = it never gets there
			z.minutes = net > 0 ? round(energy / net / 60, 1) : null // null = the heater can not even cover the losses
		}
		zones.push(z)
	})
	const sum = k => round(zones.reduce((t, z) => t + z[k], 0), 1)
	return { zones, total: { area_cm2: sum('area_cm2'), mass: sum('mass'), energy_wh: sum('energy_wh'), hold: sum('hold'), wanted: sum('wanted') }, assumed, problems }
}
