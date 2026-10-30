'use strict'

// The record of a PID tuning (M303) is taken by the SERVICE while the board tunes the heater (dsf/pid_trace.py, API `pid.trace`), so it can
// be seen from any screen or session and it goes on when nobody has this page open. This file only turns the answer into what the chart
// draws and computes the drawing. Pure functions (no DOM, no Vue).

// The answer of `pid.trace` ({heater, target, started_at, ended_at, points}, epoch seconds) -> what the chart needs, or null.
// name: the heater's name on this page; fallbackTarget: the target typed here when the tuning started from this page (the board does not
// always publish the target of a tuning).
export function fromService(raw, name, fallbackTarget) {
	if (!raw || !Array.isArray(raw.points) || raw.points.length < 2) return null
	const target = Number(raw.target) > 0 ? Number(raw.target) : (Number(fallbackTarget) > 0 ? Number(fallbackTarget) : 0)
	return { id: raw.heater, name: name || ('H' + raw.heater), target, startedAt: raw.started_at, endedAt: raw.ended_at == null ? null : raw.ended_at, points: raw.points }
}

// "3:05" for 185 s
export function clock(sec) {
	const s = Math.max(0, Math.round(sec))
	return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function niceStep(span, n) {
	const raw = span / n
	const mag = Math.pow(10, Math.floor(Math.log10(raw)))
	const f = raw / mag
	return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag
}

// What the drawing needs: the paths in the box g = { w, h, l, r, t, b } and the ticks. null while there are fewer than 2 points.
export function chartModel(trace, g) {
	if (!trace || !trace.points || trace.points.length < 2) return null
	const pts = trace.points
	const tMax = Math.max(30, pts[pts.length - 1][0])
	let lo = Math.min.apply(null, pts.map(p => p[1]))
	let hi = Math.max.apply(null, pts.map(p => p[1]))
	if (trace.target > 0) { lo = Math.min(lo, trace.target); hi = Math.max(hi, trace.target) }
	const pad = Math.max(3, (hi - lo) * 0.08)
	lo = Math.floor((lo - pad) / 5) * 5
	hi = Math.ceil((hi + pad) / 5) * 5
	const x = t => g.l + (t / tMax) * (g.w - g.l - g.r)
	const y = v => g.h - g.b - ((v - lo) / (hi - lo)) * (g.h - g.t - g.b)
	const yp = p => g.h - g.b - p * (g.h - g.t - g.b)
	const f = v => Math.round(v * 10) / 10
	const temp = pts.map((p, i) => (i ? 'L' : 'M') + f(x(p[0])) + ' ' + f(y(p[1]))).join(' ')
	// the power as steps (it is on or off most of the time): a point with no power breaks the line
	let power = ''
	let open = false
	pts.forEach(p => {
		if (p[2] == null) { open = false; return }
		power += (open ? 'L' : 'M') + f(x(p[0])) + ' ' + f(yp(p[2])) + ' '
		open = true
	})
	const stepY = niceStep(hi - lo, 4)
	const ticksY = []
	for (let v = Math.ceil(lo / stepY) * stepY; v <= hi + 1e-6; v += stepY) ticksY.push(Math.round(v))
	const stepX = niceStep(tMax, 5)
	const ticksX = []
	for (let t = 0; t <= tMax + 1e-6; t += stepX) ticksX.push(t)
	return {
		temp, power: power.trim(), x, y, tMax, lo, hi, ticksX, ticksY,
		targetY: trace.target > 0 ? y(trace.target) : null,
		max: Math.max.apply(null, pts.map(p => p[1])),
		min: Math.min.apply(null, pts.map(p => p[1])),
		seconds: pts[pts.length - 1][0]
	}
}
