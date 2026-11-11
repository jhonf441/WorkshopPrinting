'use strict'

// The sections of the 3D printing page (side bar, vue/_shared/SideTabs.vue). Pure (no Vue): test/sections.test.js.
// Three groups, in this order: OPERATE (what a person does while printing: state, 3D job, filament load, pellet / filament panels, the
// live bed zones), PREPARE (getting a job ready: the G-code library, the material applied to a file, the material table) and CONFIGURE
// (what changes the machine's configuration: printer tests, head change, pellet zones, bed zone setup, extruder, PID).
// label / group: keys relative to plugins.WorkshopPrinting, translated when the bar is drawn.
//
// `min` = the lowest role that sees the section (role-view.js; none = everybody). The roles apply in the service; this only decides what
// is worth showing. A viewer sees Operate in read-only (the buttons of the pages are disabled for a role below operator).

import { visibleItems, pickAllowed, lockedItems, lockedNeed } from './role-view.js'

export const GROUP_OPERATE = 'printing.group_operate';
export const GROUP_PREPARE = 'printing.group_prepare';
export const GROUP_CONFIGURE = 'printing.group_configure';

export const SECTIONS = [
	// OPERATE: what a person does while printing
	{ id: 'state', icon: 'mdi-thermometer', label: 'common.status', group: GROUP_OPERATE, fff: true },
	{ id: 'job', icon: 'mdi-cube-outline', label: 'fff.tab', group: GROUP_OPERATE, fff: true },
	{ id: 'filament', icon: 'mdi-tray-arrow-down', label: 'printing.filament_load', group: GROUP_OPERATE, min: 'operator', fff: true },
	{ id: 'pellet', icon: 'mdi-grain', label: 'printing.pellet_panel', group: GROUP_OPERATE, fff: true },
	{ id: 'hotend', icon: 'mdi-printer-3d-nozzle', label: 'printing.filament_panel', group: GROUP_OPERATE, fff: true },
	{ id: 'bed', icon: 'mdi-radiator', label: 'printing.bed_zones_live', group: GROUP_OPERATE, fff: true },
	// PREPARE: getting a job ready (the file, the material applied to it, the material table)
	{ id: 'library', icon: 'mdi-bookshelf', label: 'printing.gcode_library', group: GROUP_PREPARE, fff: true },
	{ id: 'layers', icon: 'mdi-layers-triple-outline', label: 'printing.layers_section', group: GROUP_PREPARE, fff: true },
	{ id: 'materials', icon: 'mdi-flask-outline', label: 'printing.materials', group: GROUP_PREPARE, min: 'operator', fff: true },
	// CONFIGURE: what changes the machine's configuration (technician)
	{ id: 'tests', icon: 'mdi-clipboard-check-outline', label: 'printing.printer_tests', group: GROUP_CONFIGURE, min: 'technician', fff: true },
	{ id: 'head', icon: 'mdi-swap-horizontal', label: 'printing.head_change', group: GROUP_CONFIGURE, min: 'technician', fff: false },
	{ id: 'zones', icon: 'mdi-cog-outline', label: 'printing.pellet_and_zones', group: GROUP_CONFIGURE, min: 'technician', fff: true },
	{ id: 'bedsetup', icon: 'mdi-tune-variant', label: 'printing.bed_zones_setup', group: GROUP_CONFIGURE, min: 'technician', fff: true },
	{ id: 'extruder', icon: 'mdi-scale-balance', label: 'printing.extruder', group: GROUP_CONFIGURE, min: 'technician', fff: true },
	{ id: 'pid', icon: 'mdi-chart-bell-curve', label: 'common.pid', group: GROUP_CONFIGURE, min: 'technician', fff: true }
];

// ids of the sections that do not apply to this machine: the head change on a machine that uses one mode only, the pellet sections
// (panel and setup) on a filament extruder, the filament load and the filament panel on a pellet extruder
export function hiddenIds(hideHead, kind) {
	const ids = [];
	if (hideHead) ids.push('head');
	if (kind === 'filament') ids.push('pellet', 'zones');
	else ids.push('filament', 'hotend');
	return ids;
}

// The sections the current role sees (can = a replacement of workshopCan, for the tests)
// hide: ids of sections that do not apply to this machine (the head change on a machine that uses one mode only)
export function visibleSections(can, hide) {
	const skip = Array.isArray(hide) ? hide : [];
	return visibleItems(SECTIONS, can).filter(s => skip.indexOf(s.id) < 0);
}

// `wanted` when the role may open it, otherwise the first one it may
export function allowedSection(wanted, can) {
	return pickAllowed(SECTIONS, wanted, can);
}

// The section saved in the browser (its id), or the first one (an id that no longer exists, from an older version, falls back too)
export function restoreSection(stored) {
	const s = stored == null ? '' : String(stored);
	return SECTIONS.some(x => x.id === s) ? s : SECTIONS[0].id;
}

// Outside FFF only the sections that do not need the extruder are usable (the head change)
export function sectionUsable(section, isFff) {
	return isFff || !section.fff;
}

// The section to show: the wanted one when the role sees it and the mode lets it work; else (not FFF) the head change when the role
// sees it; else the first the role sees
// A section above the role stays openable (it shows the cover that says why, locked-in-place rule), so `wanted` wins even when it is locked.
export function sectionToShow(wanted, isFff, can, hide) {
	const skip = Array.isArray(hide) ? hide : [];
	const all = lockedItems(SECTIONS, can).filter(s => skip.indexOf(s.id) < 0);
	const w = all.find(s => s.id === wanted);
	if (w && sectionUsable(w, isFff)) return w.id;
	const usable = all.find(s => !s.locked && sectionUsable(s, isFff));
	return usable ? usable.id : (all.length ? all[0].id : wanted);
}

// the role that opens the section `id`, or '' when the role may open it
export function lockedSection(id, can) {
	return lockedNeed(SECTIONS, id, can);
}

// The items of the side bar; t(key) = the page's translator (key relative to plugins.WorkshopPrinting)
// ALL the sections that apply to the machine; the ones above the role carry `locked: <role that opens it>` (a lock in the bar, a cover when opened)
export function sideItems(t, isFff, can, hide) {
	const skip = Array.isArray(hide) ? hide : [];
	return lockedItems(SECTIONS, can).filter(s => skip.indexOf(s.id) < 0).map(s => Object.assign({ id: s.id, icon: s.icon, label: t(s.label), group: t(s.group), disabled: !sectionUsable(s, isFff), hint: sectionUsable(s, isFff) ? undefined : t('printing.needs_fff_mode_hint') }, s.locked ? { locked: s.locked } : {}));
}

// ---- who may do what on this page (one operation of the service table per rule: role-view.js roleAtLeast) ----
// The service has no operation for these G-code actions (they go straight to the board / the SD), so each one is tested by the rank
// of an equivalent operation of dsf/permissions.py, as a courtesy of the page: the board and the SD are not guarded by it.
//   operate   operator    like moving, work lights and jobs (light.set): heating a zone, fans, motor test, feeding now, preheat, pausing /
//                         cancelling the job, Z steps and factors, loading filament
//   configure technician  like settings.set / pid.start / motors.disable: anything that writes modefff.g or printing.json, the PID,
//                         the head / mode change (selectfff.g)
//   cold      technician  allowing cold extrusion switches a protection off (an operator may lock it again)
export const NEED = { operate: 'operator', configure: 'technician', cold: 'technician', lockCold: 'operator' };
