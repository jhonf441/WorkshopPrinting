'use strict'

// The kind of extruder (pellets or filament) is a choice of each TOOL, kept in printing.json (extruderTypes: {"<tool number>": "pellet" |
// "filament"}): one machine can have a pellet tool and a filament tool. The pellet sections of the page are only shown for a pellet tool;
// the flow calibration text follows it. The page and the extruder section share it through this store.

import { reactive } from 'vue'
import { CFG_FILE, readJson, updateCfg } from './util.js'

export const KINDS = ['pellet', 'filament'];

// anything that is not 'filament' is pellets (the default of this plugin)
export function kindOf(v) {
	return v === 'filament' ? 'filament' : 'pellet';
}

export const extruderKinds = reactive({ map: {}, loaded: false })

// the kind of the tool with that number (a tool nobody chose for is pellets)
export function kindOfTool(number) {
	return kindOf(extruderKinds.map[String(number)]);
}

export async function loadExtruderKinds() {
	if (extruderKinds.loaded) return;
	extruderKinds.loaded = true;
	const cfg = (await readJson(CFG_FILE, {})) || {};
	const raw = cfg.extruderTypes && typeof cfg.extruderTypes === 'object' ? cfg.extruderTypes : {};
	const map = {};
	Object.keys(raw).forEach(k => { map[k] = kindOf(raw[k]); });
	extruderKinds.map = map;
}

// writes printing.json: the caller checks the role first and shows the error
export async function saveExtruderKind(number, v) {
	const map = Object.assign({}, extruderKinds.map, { [String(number)]: kindOf(v) });
	await updateCfg({ extruderTypes: map });
	extruderKinds.map = map;
}
