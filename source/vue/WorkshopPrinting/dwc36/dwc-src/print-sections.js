'use strict'

// The sections of the 3D printing page (side bar, vue/_shared/SideTabs.vue). Pure (no Vue): test/sections.test.js.
// Two groups (F3-P, 2026-10-21): OPERATE (what a person does while printing: state, material preheat, the pellet panel, the 3D job)
// and CONFIGURE (what changes the machine's configuration: printer tests, head change, pellet zones / feeding / outputs / sensors,
// extruder, PID). label / group: keys relative to plugins.WorkshopPrinting, translated when the bar is drawn.
//
// `min` = the lowest role that sees the section (role-view.js; none = everybody). The roles apply in the service; this only decides what
// is worth showing. A viewer sees Operate in read-only (the buttons of the pages are disabled for a role below operator).

import { visibleItems, pickAllowed } from './role-view.js'

export const SECTIONS = [
	{ id: 'state', icon: 'mdi-thermometer', label: 'common.status', group: 'printing.group_operate', fff: true },
	{ id: 'pellet', icon: 'mdi-grain', label: 'printing.pellet_panel', group: 'printing.group_operate', fff: true },
	{ id: 'materials', icon: 'mdi-flask-outline', label: 'printing.materials', group: 'printing.group_operate', min: 'operator', fff: true },
	{ id: 'job', icon: 'mdi-cube-outline', label: 'fff.tab', group: 'printing.group_operate', fff: true },
	{ id: 'tests', icon: 'mdi-clipboard-check-outline', label: 'printing.printer_tests', group: 'printing.group_configure', min: 'technician', fff: true },
	{ id: 'head', icon: 'mdi-swap-horizontal', label: 'printing.head_change', group: 'printing.group_configure', min: 'technician', fff: false },
	{ id: 'zones', icon: 'mdi-cog-outline', label: 'printing.pellet_and_zones', group: 'printing.group_configure', min: 'technician', fff: true },
	{ id: 'extruder', icon: 'mdi-scale-balance', label: 'printing.extruder', group: 'printing.group_configure', min: 'technician', fff: true },
	{ id: 'pid', icon: 'mdi-chart-bell-curve', label: 'common.pid', group: 'printing.group_configure', min: 'technician', fff: true }
];

// ids of the sections that do not apply to this machine: the head change on a machine that uses one mode only, the pellet sections
// (panel and setup) on a filament extruder
export function hiddenIds(hideHead, kind) {
	const ids = [];
	if (hideHead) ids.push('head');
	if (kind === 'filament') ids.push('pellet', 'zones');
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

// The section saved in the browser (its id), or the first one
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
export function sectionToShow(wanted, isFff, can, hide) {
	const ok = visibleSections(can, hide);
	const w = ok.find(s => s.id === wanted);
	if (w && sectionUsable(w, isFff)) return w.id;
	const usable = ok.find(s => sectionUsable(s, isFff));
	return usable ? usable.id : (ok.length ? ok[0].id : wanted);
}

// The items of the side bar; t(key) = the page's translator (key relative to plugins.WorkshopPrinting)
export function sideItems(t, isFff, can, hide) {
	return visibleSections(can, hide).map(s => ({ id: s.id, icon: s.icon, label: t(s.label), group: t(s.group), disabled: !sectionUsable(s, isFff), hint: sectionUsable(s, isFff) ? undefined : t('printing.needs_fff_mode_hint') }));
}

// ---- who may do what on this page (one operation of the service table per rule: role-view.js roleAtLeast) ----
// The service has no operation for these G-code actions (they go straight to the board / the SD), so each one is tested by the rank
// of an equivalent operation of dsf/permissions.py, as a courtesy of the page: the board and the SD are not guarded by it.
//   operate   operator    like moving, work lights and jobs (light.set): heating a zone, fans, motor test, feeding now, preheat
//   configure technician  like settings.set / pid.start / motors.disable: anything that writes modefff.g or printing.json, the PID,
//                         the head / mode change (selectfff.g)
//   cold      technician  allowing cold extrusion switches a protection off (an operator may lock it again)
export const NEED = { operate: 'operator', configure: 'technician', cold: 'technician', lockCold: 'operator' };
