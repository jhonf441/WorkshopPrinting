'use strict'

// The layout of the pellet panel (vertical or horizontal) is a choice of the machine, kept in printing.json. The panel (Operate) and the
// configuration (Configure) are two components that share it through this store: change it in one and the other follows.

import Vue from 'vue'
import { CFG_FILE, readJson, updateCfg } from './util.js'
import { layoutOf } from './pellet-hmi.js'

export const layout = Vue.observable({ value: 'vertical', loaded: false })

export async function loadLayout() {
	if (layout.loaded) return;
	layout.loaded = true;
	const cfg = (await readJson(CFG_FILE, {})) || {};
	layout.value = layoutOf(cfg.pelletOrientation);
}

// writes printing.json: the caller checks the role first and shows the error
export async function saveLayout(v) {
	const next = layoutOf(v);
	await updateCfg({ pelletOrientation: next });
	layout.value = next;
}
