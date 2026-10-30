'use strict'

// Text-level edits of modefff.g that util.js, Pid.vue and the pages share, pure (no Vue, no fetch, no i18n) so
// test/mode-lines.test.js can pin them. They only compute the new text; reading, the .bak copy and writing stay in util.js / Pid.vue.

const NL = /\r?\n/;

// the line ending of a text: CRLF when it has one, else LF
export function eol(text) {
	return text.includes('\r\n') ? '\r\n' : '\n';
}

// Replaces the FIRST line that starts with `start` (after trimming) by `nueva`, keeping its comment. null: no such line.
// -> { text, before, after }
export function replaceFirstLine(text, start, nueva) {
	const lines = text.split(NL);
	const k = lines.findIndex(l => l.trim().startsWith(start));
	if (k < 0) return null;
	const coment = lines[k].includes(';') ? '   ' + lines[k].slice(lines[k].indexOf(';')) : '';
	const before = lines[k];
	lines[k] = nueva + coment;
	return { text: lines.join(eol(text)), before, after: lines[k] };
}

// Replaces the line that starts with `start` or, if it is not there, adds `nueva` after the first line that starts
// with `afterOf` (or at the end). The replaced line loses its comment.
export function changeOrAddLine(text, start, nueva, afterOf) {
	const lines = text.split(NL);
	let k = lines.findIndex(l => l.trim().startsWith(start));
	if (k >= 0) {
		lines[k] = nueva;
	} else {
		k = afterOf ? lines.findIndex(l => l.trim().startsWith(afterOf)) : -1;
		if (k >= 0) lines.splice(k + 1, 0, nueva);
		else lines.push(nueva);
	}
	return lines.join(eol(text));
}

// All the M307 lines at once (Pid.vue "save all zones"): each { h, line } replaces the M307 H<h> line keeping its comment;
// a zone with no line is added after the last M307 (or at the end). -> { lines (array), text, added (heaters added) }
export function replaceM307Lines(text, list) {
	const lineas = text.split(NL);
	const added = [];
	list.forEach(({ h, line }) => {
		const k = lineas.findIndex(l => l.trim().startsWith('M307 H' + h + ' '));
		if (k >= 0) {
			const coment = lineas[k].includes(';') ? '   ' + lineas[k].slice(lineas[k].indexOf(';')) : '';
			lineas[k] = line + coment;
		} else {
			let u = -1;
			lineas.forEach((l, i) => { if (/^\s*M307\s/.test(l)) u = i; });
			lineas.splice(u >= 0 ? u + 1 : lineas.length, 0, line);
			added.push(h);
		}
	});
	return { lines: lineas, text: lineas.join(eol(text)), added };
}

// The M307 line of heater `h` as the board answers M307 H<h>:
// "Heater 1 model: heating rate 2.166, cooling rate 0.429/0.000, dead time 5.39, max PWM 1.00, calibration voltage 23.9, mode PID"
// -> M307 H1 R.. K..:.. D.. E<eDef> S.. V.. B0. null when the answer has no model.
export function lineSince(h, txt, eDef) {
	const num = re => {
		const m = txt.match(re);
		return m ? m[1] : null;
	};
	const R = num(/heating rate ([\d.]+)/i);
	const K = txt.match(/cooling rate ([\d.]+)(?:\/([\d.]+))?/i);
	const D = num(/dead time ([\d.]+)/i);
	const S = num(/max PWM ([\d.]+)/i);
	// RRF 3.5 answers ", calibrated at 23.9V" (FopDt::AppendModelParameters); 2026-10-11
	const V = num(/(?:calibration voltage|calibrated at) ([\d.]+)/i);
	if (!R || !K || !D) return null;
	const B = /mode bang-bang/i.test(txt) ? 1 : 0;
	return `M307 H${h} R${R} K${K[1]}:${K[2] || '0.000'} D${D} E${eDef} S${S || '1.00'}` + (V ? ` V${V}` : '') + ` B${B}`;
}

// printing.json after a partial change (several pages write different parts of it)
export function mergeCfg(cfg, change) {
	return Object.assign({}, cfg, change);
}
