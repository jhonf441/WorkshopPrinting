'use strict'

// Reading and rewriting the lines of modefff.g that describe a heat zone (M563 tool, M950 output, M308 sensor, M143 cap and
// monitors, M307 model), pure (no Vue, no i18n) so test/modefff-edit.test.js can pin what ExtruderConfig.vue writes into the
// machine's configuration. Moved out of ExtruderConfig.vue without changing its behaviour; the page keeps the texts.

// ---- reading and editing G-code lines (without touching the comments) ----
export function partir(line) {
	// codigo y comentario (";" fuera de comillas)
	let q = false;
	for (let i = 0; i < line.length; i++) {
		if (line[i] === '"') q = !q;
		else if (line[i] === ';' && !q) return [line.slice(0, i), line.slice(i)];
	}
	return [line, ''];
}
export function command(line) {
	const m = partir(line)[0].match(/^\s*([GMT]\d+(?:\.\d+)?)\b/i);
	return m ? m[1].toUpperCase() : null;
}
export function param(line, L) {
	const c = partir(line)[0];
	const q = c.match(new RegExp('(?:^|\\s)' + L + '"([^"]*)"'));
	if (q) return q[1];
	const n = c.match(new RegExp('(?:^|\\s)' + L + '(-?[0-9.:eE+-]+)'));
	return n ? n[1] : null;
}
export function putParam(line, L, value, quotes) {
	const [c, com] = partir(line);
	const v = quotes ? '"' + String(value).replace(/"/g, '') + '"' : String(value);
	const rx = new RegExp('((?:^|\\s)' + L + ')("[^"]*"|-?[0-9.:eE+-]+)');
	const nuevo = rx.test(c) ? c.replace(rx, '$1' + v) : c.replace(/\s*$/, '') + ' ' + L + v + (com ? ' ' : '');
	return nuevo + com;
}

export function removeParam(line, L) {
	const [c, com] = partir(line);
	return c.replace(new RegExp('\\s' + L + '("[^"]*"|-?[0-9.:eE+-]+)'), '') + com;
}
// output type mark in the M950 line's comment ("; workshop:ssr-ca")
export function readMark(line) {
	const m = partir(line || '')[1].match(/workshop:([a-z-]+)/i);
	return m ? m[1].toLowerCase() : null;
}
export function putMark(line, mark) {
	const p = partir(line);
	let com = p[1].replace(/\s*workshop:[a-z-]+/i, '');
	if (/^;\s*$/.test(com)) com = '';
	if (mark) com = com ? com.replace(/^;\s*/, '; workshop:' + mark + ' ') : '; workshop:' + mark;
	return com ? p[0].replace(/\s*$/, '') + '   ' + com : p[0].replace(/\s*$/, '');
}

export const RX_OUTPUT = /^([0-9]+\.)?out[0-9]+$/i;
// with a relay an io output is also valid (2026-10-11)
export const RX_OUTPUT_RELAY = /^([0-9]+\.)?(out[0-9]+|io[0-9]+\.out)$/i;
export const RX_THERMISTOR = /^([0-9]+\.)?temp[0-9]+$/i;

// ---- output types of a zone (2026-10-11) ----
// AC SSR: switches only at the zero crossing (100/120 times per second with 50/60 Hz), so
// the PWM has to be slow: Q10 (Duet3D forum and documentation: "low frequency, 10 Hz, for
// any SSR"; by default RRF uses 250 Hz). Mechanical relay: no PWM, M307 B1 (bang-bang: in RRF 3.5
// LocalHeater sets 0 or the maximum S, without hysteresis) with S1.0 and Q1 (the minimum M950 accepts).
const Q_SSR = 10;
// DC solid-state relay (DC-DC), 2026-10-11: I did not find in the Duet3D forum nor in RRF a value
// of its own for DC SSR; the Duet3D wiki (cited in the forum) says 10 Hz is "compatible with all common
// SSRs". DC-DC ones take 0.1 to about 10 ms to turn on/off: at 10 Hz (period 100 ms) that
// is a small error; at 100 Hz it would already be up to 10 %. That is why Q10 here too.
const Q_SSR_DC = 10;
export const Q_RELAY = 1;
export const qOfKind = t => t === 'ssr' ? Q_SSR : t === 'ssrdc' ? Q_SSR_DC : Q_RELAY;
export function markKind(kind, ca) {
	return kind === 'ssr' ? 'ssr-ca' : kind === 'ssrdc' ? 'ssr-dc' : kind === 'relay' ? (ca ? 'relay-ca' : 'relay') : null;
}
export const isCA = z => z.kind === 'ssr' || (z.kind === 'relay' && !!z.ca);

// ---- sensor types (M308 Y) and watches (M143 P1/P2) (2026-10-11) ----
// Names and parameters according to the RRF 3.5 code (src/Heating/Sensors): the name is compared without
// hyphens nor capitals ("thermocouplemax31856" = "thermocouple-max31856").
// thermistor: T (R at 25), B (beta), C (Steinhart-Hart coef.); pt1000: no parameters of its own;
// max31856: K"letter" (B E J K N R S T, default K), F50/F60 (mains rejection); max31855: only K;
// max31865: W (wires; 3 = three wires, 2 and 4 the same), R (reference, default 400), F50/F60;
// linear-analog: B (°C with the input at 0, default 0) and C (°C at maximum, default 100).
export const SENSORES = {
	thermistor: { y: 'thermistor' },
	pt1000: { y: 'pt1000' },
	max31856: { y: 'thermocouple-max31856' },
	max31855: { y: 'thermocouple-max31855' },
	max31865: { y: 'rtd-max31865' },
	linear: { y: 'linear-analog' }
};
export const isSpiKind = t => t === 'max31856' || t === 'max31855' || t === 'max31865';
export const RX_CS = /^([0-9]+\.)?spi\.cs[0-9]+$/i;
const reducido = s => String(s || '').toLowerCase().replace(/[-_\s]/g, '');
export function kindSensorOf(y) {
	const r = reducido(y);
	return Object.keys(SENSORES).find(k => reducido(SENSORES[k].y) === r) || (r ? 'other' : 'thermistor');
}
// campos de un sensor (zona o vigilancia) leidos de su linea M308
export function readSensor(ls) {
	const y = param(ls, 'Y');
	const t = kindSensorOf(y);
	const num = (L, d) => { const v = param(ls, L); return v == null || v === '' || isNaN(Number(v)) ? d : Number(v); };
	return {
		ysen: t, yRaw: y || '', pin: param(ls, 'P') || '',
		beta: t === 'thermistor' ? num('B', 4725) : 4725, r25: t === 'thermistor' ? num('T', 100000) : 100000,
		shc: t === 'thermistor' && param(ls, 'C') != null ? String(param(ls, 'C')) : '',
		tc: t === 'max31856' ? String(param(ls, 'K') || 'K').toUpperCase() : 'K',
		red: (t === 'max31856' || t === 'max31865') && num('F', 50) === 60 ? 60 : 50,
		threads: t === 'max31865' ? (num('W', 2) === 3 ? 3 : num('W', 2) === 4 ? 4 : 2) : 2,
		rref: t === 'max31865' ? num('R', 400) : 400,
		lb: t === 'linear' ? num('B', 0) : 0, lc: t === 'linear' ? num('C', 100) : 100
	};
}
const FIELDS_SENSOR = ['ysen', 'pin', 'beta', 'r25', 'shc', 'tc', 'red', 'threads', 'rref', 'lb', 'lc'];
export const copySensor = o => FIELDS_SENSOR.reduce((a, k) => { a[k] = o[k]; return a; }, {});
// parameters of each type: [letter, value, quoted]
export function paramsSensor(o) {
	if (o.ysen === 'thermistor') {
		const p = [['T', Math.round(o.r25), false], ['B', Math.round(o.beta), false]];
		if (String(o.shc || '').trim() !== '') p.push(['C', String(o.shc).trim(), false]);
		return p;
	}
	if (o.ysen === 'max31856') return [['K', o.tc, true], ['F', o.red, false]];
	if (o.ysen === 'max31865') return [['W', o.threads, false], ['R', Number(o.rref), false], ['F', o.red, false]];
	if (o.ysen === 'linear') return [['B', Number(o.lb), false], ['C', Number(o.lc), false]];
	return [];
}
export function lineM308(s, o, nombre) {
	return `M308 S${s} P"${o.pin}" Y"${SENSORES[o.ysen].y}" A"${String(nombre || '').replace(/"/g, '')}"` +
		paramsSensor(o).map(([L, v, q]) => ' ' + L + (q ? '"' + v + '"' : v)).join('');
}
// changes an existing M308 line: if the type changed it is redone (it keeps the comment)
export function applySensor(l, s, o, orig, nombre) {
	if (o.ysen === 'other') {
		l = putParam(l, 'P', o.pin, true);
		return putParam(l, 'A', nombre, true);
	}
	if (!orig || o.ysen !== orig.ysen) {
		const com = partir(l)[1];
		return lineM308(s, o, nombre) + (com ? '   ' + com : '');
	}
	l = putParam(l, 'P', o.pin, true);
	l = putParam(l, 'A', nombre, true);
	paramsSensor(o).forEach(([L, v, q]) => { l = putParam(l, L, v, q); });
	if (o.ysen === 'thermistor' && String(o.shc || '').trim() === '' && param(l, 'C') != null) l = removeParam(l, 'C');
	return l;
}

export function kindChange(z) {
	return !!z.orig && (z.kind !== z.orig.kind || (z.kind === 'relay' && !!z.ca !== !!z.orig.ca));
}
// mechanical relay in the file but the M307 line is not at B1 (for example after calibrating the PID)
export function relayWithoutB1(z) {
	return !z.newEntry && z.kind === 'relay' && (z.bFile !== '1' || (z.sFile != null && Number(z.sFile) < 1));
}
// the number of the sensor a watch uses: its own (new M308) or one that already exists
export function sensorMonitor(m) {
	return m.source === 'newItem' ? m.sOwn : Number(String(m.source).replace(/^S/, ''));
}

// watches of a zone read from the file: M143 H<h> P1/P2 (and its own M308 if it has the workshop:watch mark)
export function monitorsOfFile(lines, h, s) {
	return lines.filter(l => command(l) === 'M143' && param(l, 'H') === String(h) && param(l, 'P') != null && param(l, 'P') !== '0').map(l => {
		const p = Number(param(l, 'P'));
		const t = param(l, 'T') != null ? Number(param(l, 'T')) : s;
		const ls = lines.find(x => command(x) === 'M308' && param(x, 'S') === String(t)) || '';
		const own = !!ls && readMark(ls) === 'watch';
		const m = Object.assign(readSensor(ls), {
			key: 'm' + h + '-' + p, p, newItem: false, remove: false,
			source: own ? 'newItem' : 'S' + t, sOwn: own ? t : null, name: own ? (param(ls, 'A') || '') : '',
			limit: Number(param(l, 'S')) || 0, action: Number(param(l, 'A')) || 0, cond: Number(param(l, 'C')) === 1 ? 1 : 0,
			condRaw: param(l, 'C')
		});
		m.orig = { source: m.source, limit: m.limit, action: m.action, cond: m.cond, name: m.name, sensor: copySensor(m), pin: m.pin };
		return m;
	});
}

// the zones of tool `toolNumber`, read from the lines of modefff.g
export function zonesFromLines(lines, toolNumber) {
	const k = lines.findIndex(l => command(l) === 'M563' && param(l, 'P') === String(toolNumber));
	if (k < 0) return [];
	const hs = String(param(lines[k], 'H') || '').split(':').filter(x => x !== '').map(Number);
	return hs.map(h => {
		const lh = lines.find(l => command(l) === 'M950' && param(l, 'H') === String(h)) || '';
		const s = Number(param(lh, 'T'));
		const ls = lines.find(l => command(l) === 'M308' && param(l, 'S') === String(s)) || '';
		// the zone's cap is the M143 without P (or P0); P1/P2 are watches (2026-10-11)
		const lm = lines.find(l => command(l) === 'M143' && param(l, 'H') === String(h) && (param(l, 'P') == null || param(l, 'P') === '0')) || '';
		const lp = lines.find(l => command(l) === 'M307' && param(l, 'H') === String(h)) || '';
		// output type (2026-10-11): the "; workshop:..." mark of the M950 line; if it is not there,
		// it is guessed: M307 B1 = mechanical relay, Q of 30 or less = SSR, otherwise DC board
		const q = param(lh, 'Q'), b = param(lp, 'B');
		const mark = readMark(lh);
		let kind = 'dc', ca = false;
		if (mark === 'ssr-ca') kind = 'ssr';
		else if (mark === 'ssr-dc') kind = 'ssrdc';
		else if (mark === 'relay' || mark === 'relay-ca') { kind = 'relay'; ca = mark === 'relay-ca'; }
		else if (b === '1') kind = 'relay';
		else if (q != null && Number(q) <= 30) kind = 'ssr';
		const z = Object.assign(readSensor(ls), {
			key: 'h' + h, h, s, newEntry: false, remove: false,
			name: param(ls, 'A') || '', output: param(lh, 'C') || '', max: Number(param(lm, 'S')) || 0,
			kind: kind, ca, q, bFile: b, sFile: param(lp, 'S'),
			monitors: monitorsOfFile(lines, h, s),
			incomplete: !lh || !ls || !lm
		});
		z.orig = { name: z.name, output: z.output, pin: z.pin, max: z.max, kind: kind, ca, sensor: copySensor(z) };
		return z;
	});
}

// the lines of an existing zone: output, sensor, cap and model, for the zone as the form leaves it
function editZoneLines(ls, z) {
	// 2026-10-11: the output type changes Q and the mark in M950, and B/S in M307
	const changesKind = kindChange(z);
	const putB1 = z.kind === 'relay' && (changesKind || relayWithoutB1(z));
	const takeB1 = changesKind && z.orig.kind === 'relay' && z.kind !== 'relay';
	let hasM307 = false;
	ls = ls.map(l => {
		const c = command(l);
		if (c === 'M308' && param(l, 'S') === String(z.s)) {
			l = applySensor(l, z.s, z, z.orig.sensor, z.name);
		} else if (c === 'M950' && param(l, 'H') === String(z.h)) {
			l = putParam(l, 'C', z.output, true);
			if (changesKind) {
				l = z.kind === 'dc' ? removeParam(l, 'Q') : putParam(l, 'Q', qOfKind(z.kind), false);
				l = putMark(l, markKind(z.kind, z.ca));
			}
		} else if (c === 'M143' && param(l, 'H') === String(z.h) && (param(l, 'P') == null || param(l, 'P') === '0')) {
			l = putParam(l, 'S', Math.round(z.max), false);
		} else if (c === 'M307' && param(l, 'H') === String(z.h)) {
			hasM307 = true;
			if (putB1) {
				l = putParam(l, 'S', '1.0', false);
				l = putParam(l, 'B', 1, false);
			} else if (takeB1) {
				l = putParam(l, 'B', 0, false);
			}
		}
		return l;
	});
	// relay without an M307 line: it is added after M143 (or M950)
	if (putB1 && !hasM307) {
		let i = ls.findIndex(l => command(l) === 'M143' && param(l, 'H') === String(z.h));
		if (i < 0) i = ls.findIndex(l => command(l) === 'M950' && param(l, 'H') === String(z.h));
		const nueva = `M307 H${z.h} R2.0 K0.3:0.0 D5.0 S1.0 B1   ; mechanical relay: on/off, no PWM`;
		if (i >= 0) ls.splice(i + 1, 0, nueva);
	}
	return ls;
}

// watches already written (2026-10-11): M143 H P and, if they have their own sensor, its M308
function editWatchLines(ls, z) {
	(z.monitors || []).filter(m => !m.newItem).forEach(m => {
		const isLine = l => command(l) === 'M143' && param(l, 'H') === String(z.h) && param(l, 'P') === String(m.p);
		const isItsSensor = l => command(l) === 'M308' && m.sOwn != null && param(l, 'S') === String(m.sOwn);
		if (m.remove) {
			ls = ls.filter(l => !isLine(l) && !(m.orig.source === 'newItem' && isItsSensor(l)));
			return;
		}
		if (m.orig.source === 'newItem' && m.source !== 'newItem') ls = ls.filter(l => !isItsSensor(l));
		ls = ls.map(l => {
			if (isLine(l)) {
				l = putParam(l, 'T', sensorMonitor(m), false);
				l = putParam(l, 'S', Number(m.limit), false);
				l = putParam(l, 'A', Number(m.action), false);
				if (Number(m.cond) !== Number(m.orig.cond)) l = putParam(l, 'C', Number(m.cond), false);
			} else if (m.source === 'newItem' && m.orig.source === 'newItem' && isItsSensor(l)) {
				l = applySensor(l, m.sOwn, m, m.orig.sensor, m.name);
			}
			return l;
		});
		// from an existing sensor to an own one: its M308 goes before the M143 line
		if (m.source === 'newItem' && m.orig.source !== 'newItem') {
			const i = ls.findIndex(isLine);
			if (i >= 0) ls.splice(i, 0, lineM308(m.sOwn, m, m.name) + '   ; workshop:watch H' + z.h);
		}
	});

	return ls;
}

// the lines of a zone that does not exist in the file yet
function newZoneLines(z) {
	// 2026-10-11: according to the output type (Q in M950, B in M307, mark to read it back)
	const m950 = z.kind === 'ssr' || z.kind === 'ssrdc' ? `M950 H${z.h} C"${z.output}" T${z.s} Q${qOfKind(z.kind)}   ; workshop:${markKind(z.kind, z.ca)}`
		: z.kind === 'relay' ? `M950 H${z.h} C"${z.output}" T${z.s} Q${Q_RELAY}   ; workshop:${markKind(z.kind, z.ca)}`
			: `M950 H${z.h} C"${z.output}" T${z.s}`;
	const m307 = z.kind === 'relay' ? `M307 H${z.h} R2.0 K0.3:0.0 D5.0 S1.0 B1   ; mechanical relay: on/off, no PWM`
		: `M307 H${z.h} R2.0 K0.3:0.0 D5.0 S1.0 B0   ; provisional: tune the PID of this zone`;
	return [
		`; heat zone "${z.name.replace(/"/g, '')}" (3D printing > Pellet and zones)`,
		lineM308(z.s, z, z.name),
		m950,
		`M143 H${z.h} S${Math.round(z.max)}`,
		m307
	];

}

// new watches (of new or existing zones), written after the heaters (2026-10-11)
function newWatchLines(zones) {
	const block = [];
	zones.filter(z => !z.remove).forEach(z => (z.monitors || []).filter(m => m.newItem && !m.remove).forEach(m => {
		// the comment goes on the same line: if the watch is removed afterwards nothing is left loose
		if (m.source === 'newItem') block.push(lineM308(m.sOwn, m, m.name) + '   ; workshop:watch H' + z.h);
		block.push(`M143 H${z.h} P${m.p} T${sensorMonitor(m)} S${Number(m.limit)} A${Number(m.action)} C${Number(m.cond)}   ; monitoring of zone "${String(z.name).replace(/"/g, '')}"`);
	}));
	return block;
}

// the new text of modefff.g with the edits of the zones (zones come from zonesFromLines, edited by the form)
export function rewriteModeText(text, zones, toolNumber) {
	let ls = text.split(/\r?\n/);
	const remove = zones.filter(z => z.remove && !z.newEntry);
	ls = ls.filter(l => {
		const c = command(l);
		return !remove.some(z =>
			(c === 'M308' && param(l, 'S') === String(z.s)) ||
			(c === 'M308' && (z.monitors || []).some(m => m.orig && m.orig.source === 'newItem' && param(l, 'S') === String(m.sOwn))) ||
			(['M950', 'M143', 'M307', 'M570'].includes(c) && param(l, 'H') === String(z.h)));
	});
	zones.filter(z => !z.remove && !z.newEntry).forEach(z => {
		ls = editWatchLines(editZoneLines(ls, z), z);
	});
	const k = ls.findIndex(l => command(l) === 'M563' && param(l, 'P') === String(toolNumber));
	if (k < 0) throw Object.assign(new Error('M563 for tool ' + toolNumber + ' not found'), { code: 'm563_not_found', tool: toolNumber });
	const block = [];
	zones.filter(z => z.newEntry && !z.remove).forEach(z => block.push(...newZoneLines(z)));
	block.push(...newWatchLines(zones));
	const hs = zones.filter(z => !z.remove).map(z => z.h).join(':');
	ls[k] = putParam(ls[k], 'H', hs, false);
	ls.splice(k, 0, ...block);
	return ls.join(text.includes('\r\n') ? '\r\n' : '\n');
}
