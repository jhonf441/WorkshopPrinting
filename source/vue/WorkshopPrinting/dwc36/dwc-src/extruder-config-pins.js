// Pure helpers of the Extruder config page (ExtruderConfig.vue): which connector is used by what, the connectors of each board and the explanations of the output and
// sensor types. No writes and no component: the page keeps its own save() (the only place that writes modefff.g).

import i18n from '../../i18n'
import { partir, command } from './modefff-edit.js'

// files: [[name, text], ...]. exact = false: "io3.in" and "io3.out" count as "io3" (as always)
export function computeUses(files, exact) {
	const uses = {};
	const noteUse = (pin, who) => { uses[pin] = uses[pin] ? uses[pin] + ', ' + who : who; };
	files.forEach(([nombre, txt]) => {
		(txt || '').split(/\r?\n/).forEach(l => {
			const c = command(l);
			if (!c || !['M950', 'M308', 'M574', 'M558', 'M591', 'M280', 'M42'].includes(c)) return;
			const cod = partir(l)[0];
			const rx = /\b[CP]"([^"]+)"/g;
			let m;
			while ((m = rx.exec(cod))) {
				m[1].split('+').forEach(x => {
					const raw = x.trim().toLowerCase().replace(/^[!^]+/, '');
					const pin = raw.replace(/\.(in|out)$/, '');
					if (!/^(\d+\.)?(out|temp|io|spi\.cs)\d+$/.test(pin)) return;
					const who = cod.trim().split(/\s+/).filter(t => t.indexOf('"') < 0).slice(0, 2).join(' ') + ' (' + nombre + ')';
					if (!exact || raw !== pin) noteUse(exact ? raw : pin, who);
					else if (/io\d+$/.test(pin)) { noteUse(pin + '.in', who); noteUse(pin + '.out', who); }
					else noteUse(pin, who);
				});
			}
		});
	});
	return uses;
}

// connectors of each Duet 3 board (those that matter for an extruder); uses = computeUses(files, false)
export function boardsOf(model, uses) {
	const CAT = {
		MB6HC: { cal: [0, 1, 2, 3], fan: [4, 5, 6, 7, 8, 9], temp: [0, 1, 2, 3], io: [0, 1, 2, 3, 4, 5, 6, 7, 8], cs: [0, 1, 2, 3] },
		EXP3HC: { cal: [0, 1, 2], fan: [3, 4, 5, 6, 7, 8], temp: [0, 1, 2], io: [0, 1, 2, 3, 4, 5] },
		TOOL1LC: { cal: [0], fan: [1, 2], temp: [0, 1], io: [0, 1, 2] },
		MB6XD: { cal: [0, 1, 2], fan: [3, 4, 5, 6, 7, 8], temp: [0, 1, 2, 3], io: [0, 1, 2, 3, 4, 5, 6, 7, 8], cs: [0, 1, 2, 3] }
	};
	return ((model && model.boards) || []).map((b, i) => {
		const can = b.canAddress || 0;
		const pre = can ? can + '.' : '';
		const cat = CAT[b.shortName];
		// only in Laser or CNC mode: in FFF it can be used (each mode configures its own), with a notice
		const other = u => !!u && !/(config|modefff)\.g/.test(u);
		const pins = (pref, nums) => nums.map(n => { const u = uses[pre + pref + n] || null; return { pin: pre + pref + n, used: other(u) ? null : u, otherMode: other(u) ? u : null }; });
		return {
			key: 'b' + i,
			name: b.name || b.shortName || i18n.t('plugins.WorkshopPrinting.extruderConfig.board'),
			where: can ? i18n.t('plugins.WorkshopPrinting.extruderConfig.expansion_board_can', { can }) : i18n.t('plugins.WorkshopPrinting.extruderConfig.main_board'),
			note: cat ? '' : (b.shortName === 'EXP1XD' ? i18n.t('plugins.WorkshopPrinting.extruderConfig.single_motor_board_it_has_no') : i18n.t('plugins.WorkshopPrinting.extruderConfig.i_don_t_know_this_board')),
			groups: cat ? [
				{ id: 'cal', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.heater_outputs'), field: 'output', pins: pins('out', cat.cal) },
				{ id: 'temp', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.thermistors'), field: 'pin', pins: pins('temp', cat.temp) },
				{ id: 'fan', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.small_outputs_fans'), field: null, pins: pins('out', cat.fan) },
				{ id: 'io', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.io_inputs_outputs'), field: null, pins: pins('io', cat.io) }
			].concat(cat.cs ? [{ id: 'cs', kind: i18n.t('plugins.WorkshopPrinting.extruderConfig.spi_cs_adapter_board'), field: null, pins: pins('spi.cs', cat.cs) }] : []) : []
		};
	});
}

export function explanationSensor(t) {
	if (t === 'thermistor') return i18n.t('plugins.WorkshopPrinting.extruderConfig.common_thermistor_ntc_on_a_tempn');
	if (t === 'pt1000') return i18n.t('plugins.WorkshopPrinting.extruderConfig.two_wire_pt1000_straight_to_a');
	if (t === 'max31856') return i18n.t('plugins.WorkshopPrinting.extruderConfig.thermocouple_k_j_t_with_the');
	if (t === 'max31855') return i18n.t('plugins.WorkshopPrinting.extruderConfig.type_k_thermocouple_with_a_max31855');
	if (t === 'max31865') return i18n.t('plugins.WorkshopPrinting.extruderConfig.pt100_with_the_max31865_adapter_board');
	if (t === 'linear') return i18n.t('plugins.WorkshopPrinting.extruderConfig.a_temperature_transmitter_that_gives_a');
	return i18n.t('plugins.WorkshopPrinting.extruderConfig.this_sensor_type_is_not_edited');
}

export function explanationKind(kind) {
	if (kind === 'ssrdc') return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_ssrdc');
	if (kind === 'ssr') return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_ssr');
	if (kind === 'relay') return i18n.t('plugins.WorkshopPrinting.extruderConfig.explain_relay');
	return i18n.t('plugins.WorkshopPrinting.extruderConfig.the_heater_cartridge_goes_straight_to');
}
