import i18n from '../../i18n'
'use strict'

// Common utilities of the 3D Printing page.

import { api } from './workshop-api.js'
import { replaceFirstLine, changeOrAddLine, mergeCfg } from './mode-lines.js'
import { fileError } from './print-errors.js'

export const CFG_FILE = '0:/sys/workshop/config/printing.json';
export const MODE_FILE = '0:/sys/modefff.g';

// Default pellet materials (typical temperatures; density in g/cm3
// for the flow calibration by weight).
export const MATERIALS_DEF = [
	{ name: 'PLA', nozzle: 200, bed: 60, camera: 0, fan: 100, density: 1.24 },
	{ name: 'PETG', nozzle: 235, bed: 75, camera: 0, fan: 50, density: 1.27 },
	{ name: 'ABS', nozzle: 245, bed: 95, camera: 50, fan: 0, density: 1.04 },
	{ name: 'TPU', nozzle: 225, bed: 50, camera: 0, fan: 50, density: 1.21 },
	{ name: 'PP', nozzle: 230, bed: 90, camera: 40, fan: 30, density: 0.9 }
];

export async function readText(path) {
	const r = await fetch('/machine/file/' + encodeURIComponent(path), { cache: 'no-store' });
	if (!r.ok) throw new Error(i18n.t('plugins.WorkshopPrinting.util.http_reading', { status: r.status, path }));
	return (await r.text()).replace(/^﻿/, '');
}

export async function writeText(path, text) {
	const r = await fetch('/machine/file/' + encodeURIComponent(path), {
		method: 'PUT', body: text, headers: { 'Content-Type': 'application/octet-stream' }
	});
	// 401 / 403: the person (not the file) is the problem: an error ErrorNotice can explain (needed role, PIN dialog)
	if (!r.ok) throw fileError(r.status, path, (k, p) => i18n.t(k, p)) || new Error(i18n.t('plugins.WorkshopPrinting.util.http_writing', { status: r.status, path }));
}

export async function readJson(path, def) {
	try {
		return JSON.parse(await readText(path));
	} catch (e) {
		return def;
	}
}

// Changes in modefff.g the FIRST line that starts with `inicio` (e.g. "M92 E",
// "M307 H1 ") to `nueva`, leaving before it a .bak copy with the date.
export async function changeLineMode(inicio, nueva) {
	const text = await readText(MODE_FILE);
	const r = replaceFirstLine(text, inicio, nueva);
	if (!r) throw new Error(i18n.t('plugins.WorkshopPrinting.util.line_not_found', { start: inicio }));
	const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
	await writeText(MODE_FILE + '.bak-' + stamp, text);
	await writeText(MODE_FILE, r.text);
	return { before: r.before, after: r.after };
}

export function readGlobal(model, k) {
	const g = model && model.global;
	return g && (typeof g.get === 'function' ? g.get(k) : g[k]);
}

export function isError(reply) {
	// a CAN board that does not answer (powered off, unplugged) leaves the code not applied: it counts as a failure
	return /error|abort|timeout/i.test(reply || '');
}

// Changes the line that starts with `inicio` or, if it is not there, adds it after
// the first one that starts with `despuesDe` (or at the end). With .bak copy.
export async function changeOAddLineMode(start, nueva, afterOf) {
	const text = await readText(MODE_FILE);
	const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
	await writeText(MODE_FILE + '.bak-' + stamp, text);
	await writeText(MODE_FILE, changeOrAddLine(text, start, nueva, afterOf));
}

// File names in a folder of the SD (e.g. "0:/sys").
export async function listItemsFolder(dir) {
	try {
		const r = await fetch('/machine/directory/' + encodeURIComponent(dir), { cache: 'no-store' });
		if (!r.ok) return [];
		const d = await r.json();
		return (Array.isArray(d) ? d : []).map(f => f.name || f.Name).filter(Boolean);
	} catch (e) {
		return [];
	}
}

// Marks a commissioning step as done (cfg.startup[id]).
export async function markStartup(id, ok, detail) {
	const cfg = (await readJson(CFG_FILE, {})) || {};
	cfg.startup = Object.assign({}, cfg.startup || {});
	cfg.startup[id] = { ok: !!ok, date: new Date().toISOString().slice(0, 16).replace('T', ' '), detail: detail || '' };
	await writeText(CFG_FILE, JSON.stringify(cfg, null, 1));
	return cfg.startup;
}

// States of an analog sensor that only mean "no data (yet)": not a fault, the page shows neutral empty values.
const SENSOR_NO_DATA = ['notReady', 'notInitialised', 'noDataReceived', 'unknownSensor', 'unknownPort', 'noData'];

// A real sensor fault (open circuit, short...), not simply a missing reading.
export function isSensorFault(estado, reading) {
	if (typeof reading === 'number' && (reading < -200 || reading >= 1000)) return true; // -273 or 2000: what RRF reports for a thermistor with nothing connected
	return !!estado && estado !== 'ok' && SENSOR_NO_DATA.indexOf(estado) === -1;
}

// Explanation of a sensor that does not read well (open circuit, short...).
export function explainSensor(estado, reading) {
	if (!isSensorFault(estado, reading)) return '';
	if (estado === 'openCircuit' || reading < -200) return i18n.t('plugins.WorkshopPrinting.util.the_thermistor_reads_nothing_open_circuit');
	if (estado === 'shortCircuit') return i18n.t('plugins.WorkshopPrinting.util.the_thermistor_is_short_circuited_check');
	if (estado && estado !== 'ok') return i18n.t('plugins.WorkshopPrinting.util.sensor_reports', { state: estado });
	return '';
}

// Change sys/workshop/config/printing.json reading the latest (several tabs write
// different parts: materials, last material, diameter, commissioning).
export async function updateCfg(change) {
	const cfg = (await readJson(CFG_FILE, {})) || {};
	const nuevo = mergeCfg(cfg, change);
	await writeText(CFG_FILE, JSON.stringify(nuevo, null, 1));
	return nuevo;
}

// Notes in Activity (API activity.log of WorkshopService): what is saved here does not leave
// rastro en la maquina. tipo: calibration | config | warning. (sendCode: not used any more,
// kept so the callers do not change)
export function note(sendCode, kind, texto) {
	return api('activity.log', { type: kind, text: String(texto).slice(0, 250) }).catch(() => {});
}
