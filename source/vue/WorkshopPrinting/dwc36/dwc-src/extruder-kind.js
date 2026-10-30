'use strict'

// The kind of extruder (pellets or filament) is a choice of the machine, kept in printing.json. The pellet sections of the page are only
// shown for pellets; the flow calibration text follows it. The page and the extruder section share it through this store.

import Vue from 'vue'
import { CFG_FILE, readJson, updateCfg } from './util.js'

export const KINDS = ['pellet', 'filament'];

// anything that is not 'filament' is pellets (the default of this plugin)
export function kindOf(v) {
	return v === 'filament' ? 'filament' : 'pellet';
}

export const extruderKind = Vue.observable({ value: 'pellet', loaded: false })

export async function loadExtruderKind() {
	if (extruderKind.loaded) return;
	extruderKind.loaded = true;
	const cfg = (await readJson(CFG_FILE, {})) || {};
	extruderKind.value = kindOf(cfg.extruderType);
}

// writes printing.json: the caller checks the role first and shows the error
export async function saveExtruderKind(v) {
	const next = kindOf(v);
	await updateCfg({ extruderType: next });
	extruderKind.value = next;
}
