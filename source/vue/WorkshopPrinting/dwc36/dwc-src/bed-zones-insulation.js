'use strict'

// ---- Bed zones: the insulation test (pure) ----
//
// The page never drives the heater for this. The person heats the WHOLE bed (every zone) with the usual controls and turns it off; the test only RECORDS the temperature of
// the bed (the area-weighted average of the zones, a sample every few seconds) and then measures how fast the bed loses heat: while it cools with the heater off, T - room falls as
// exp(-t / tau) and tau (minutes) is the time constant: the longer it is, the better the bed keeps its heat. The same measurement with a cover or
// insulation on the bed and without says how much was gained. The room temperature is optional: without it 20 degrees stand for it
// and the result says so (give the real one for an exact number).

export const SAMPLE_S = 10 // seconds between samples
export const MIN_MINUTES = 5 // the shortest cooling that is measured
export const MIN_DROP = 4 // and the least it must fall (degrees)
export const MAX_SAMPLES = 2000 // a run of about 5 hours
export const ASSUMED_ROOM = 20 // the room, when the person does not give it

// The samples of a run: [{t: seconds since the start, v: degrees}]. Adds one, ignoring a non-number, keeping the run under its limit.
export function addSample(samples, t, v) {
	if (typeof v !== 'number' || !isFinite(v)) return samples
	const next = samples.concat([{ t: Math.round(t), v: Math.round(v * 10) / 10 }])
	return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
}

// The cooling part of a run: from the highest temperature to the end, only while the zone is not being heated (a sample above the one before it breaks it)
export function coolingPart(samples) {
	if (samples.length < 2) return []
	let top = 0
	samples.forEach((s, i) => { if (s.v >= samples[top].v) top = i })
	const part = [samples[top]]
	for (let i = top + 1; i < samples.length; i++) {
		if (samples[i].v > samples[i - 1].v + 0.3) break // it warmed again: the heater is on, the cooling ended here
		part.push(samples[i])
	}
	return part
}

// {ok, tau (minutes), minutes, drop, room, roomGiven, rate (degrees per minute at the start)} or {ok: false, why} when the run is too short
export function fitCooling(samples, room) {
	const part = coolingPart(samples)
	if (part.length < 3) return { ok: false, why: 'insulation_err_short' }
	const minutes = (part[part.length - 1].t - part[0].t) / 60
	const drop = part[0].v - part[part.length - 1].v
	const given = typeof room === 'number' && isFinite(room)
	const lowest = Math.min(...samples.map(s => s.v))
	const floor = given ? room : Math.min(ASSUMED_ROOM, lowest - 1) // the bed does not cool all the way down in one test, so its lowest reading is NOT the room: 20 stands for it, said in the result
	if (minutes < MIN_MINUTES || drop < MIN_DROP) return { ok: false, why: 'insulation_err_short', minutes, drop }
	const pts = part.filter(s => s.v - floor > 1).map(s => ({ x: (s.t - part[0].t) / 60, y: Math.log(s.v - floor) }))
	if (pts.length < 3) return { ok: false, why: 'insulation_err_short', minutes, drop }
	const n = pts.length
	const mx = pts.reduce((t, p) => t + p.x, 0) / n
	const my = pts.reduce((t, p) => t + p.y, 0) / n
	let sxx = 0, sxy = 0
	pts.forEach(p => { sxx += (p.x - mx) * (p.x - mx); sxy += (p.x - mx) * (p.y - my) })
	const slope = sxx > 0 ? sxy / sxx : 0
	if (!(slope < 0)) return { ok: false, why: 'insulation_err_flat', minutes, drop }
	const tau = -1 / slope
	return { ok: true, tau: Math.round(tau * 10) / 10, minutes: Math.round(minutes * 10) / 10, drop: Math.round(drop * 10) / 10, room: Math.round(floor * 10) / 10, roomGiven: given, rate: Math.round(-slope * (part[0].v - floor) * 100) / 100 }
}

// Two fits (the bed as it was, the bed with the cover): {gain (percent more time to keep its heat), lossCut (percent less heat lost at the same temperature)} or null
export function compareRuns(before, after) {
	if (!before || !after || !before.ok || !after.ok || !(before.tau > 0)) return null
	return { gain: Math.round((after.tau / before.tau - 1) * 1000) / 10, lossCut: Math.round((1 - before.tau / after.tau) * 1000) / 10, sameRoom: before.roomGiven === after.roomGiven }
}

// Watts that the bed loses at `degrees` above the room, from its time constant and its heat capacity C (J/K): P = C * degrees / tau. null when C or tau is unknown.
export function lossWatts(capacity, tauMinutes, degrees) {
	return capacity > 0 && tauMinutes > 0 ? Math.round(capacity * degrees / (tauMinutes * 60) * 10) / 10 : null
}

// The temperature of the whole bed from the zone rows ({current, rect: {w, h}|null}): the average of the zones that have a numeric reading, weighted by their area
// (rect w x h) when every one of them has a rect, a plain average otherwise. null when no zone has a reading.
export function bedTemperature(rows) {
	const read = (rows || []).filter(r => r && typeof r.current === 'number' && isFinite(r.current))
	if (!read.length) return null
	const area = r => (r.rect && r.rect.w > 0 && r.rect.h > 0 ? r.rect.w * r.rect.h : 0)
	const weighted = read.every(r => area(r) > 0)
	let sum = 0, total = 0
	read.forEach(r => { const w = weighted ? area(r) : 1; sum += r.current * w; total += w })
	return sum / total
}

// The heat capacity of the whole plate (J/K): the area of every zone (rect w x h in mm) x thickness (mm) x density (kg/m3) x cp (J/kg/K). null when the plate or any
// zone geometry is unknown (a partial sum would understate it).
export function plateCapacity(rows, thickness, density, cp) {
	if (!rows || !rows.length || !(thickness > 0) || !(density > 0) || !(cp > 0)) return null
	let area = 0
	for (const r of rows) {
		if (!r || !r.rect || !(r.rect.w > 0) || !(r.rect.h > 0)) return null
		area += r.rect.w * r.rect.h
	}
	return area / 1e6 * thickness / 1000 * density * cp
}
