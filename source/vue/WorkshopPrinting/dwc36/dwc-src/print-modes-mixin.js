'use strict';

// Which modes this machine uses, as the 3D printing page needs it (3.6, Vue 2 mixin; the 3.7 twin is print-modes.js). The rules are in
// vue/_shared36/machine-modes.js and the answer lives in the machine profile (machine-modes-store.js); this only wires them to the page:
//   * the rows of the start-up card (the question first; mode rows only when two or more modes are on);
//   * the head change section exists only when the machine switches between modes;
//   * the entry that sends to Machine > Machine modes (when that plugin is there) or the switches themselves (when it is not).

import { modeStartupRows, callsAutoModeSelect, modesState, usesSeveralModes, usesExtraModes, enabledList, withMode, MODE_NAMES } from './machine-modes.js';
import { loadModes, saveModes } from './machine-modes-store.js';
import { pluginActive } from './workshop-ids.js';
import { readText } from './util.js';

export const printModesMixin = {
	data() {
		return { modesInfo: null, bootCalls: null };
	},
	computed: {
		modeState() {
			return this.modesInfo ? this.modesInfo.state : null;
		},
		modeNames() {
			return this.modeState && this.modeState.answered ? enabledList(this.modeState).map(m => MODE_NAMES[m]) : null;
		},
		// head change only when the machine switches between modes
		hideHead() {
			return !!this.modeState && this.modeState.answered && !usesSeveralModes(this.modeState);
		},
		machineThere() {
			return pluginActive('machine');
		},
		showModesEntry() {
			return !!this.modeState && this.modeState.answered && !usesExtraModes(this.modeState);
		},
		rowsStartup() {
			if (!this.modesInfo) return [];
			return modeStartupRows(this.modesInfo.state, this.modesInfo.detected, this.bootCalls, this.answerModes);
		},
		// the sections, as the side bar (SideTabs): Operate and Configure, only the ones the role sees (print-sections.js)
	},
	methods: {
		async setModes(answer) {
			const cur = this.modesInfo;
			const r = await saveModes(answer, cur && cur.profile);
			this.modesInfo = Object.assign({}, cur, { state: modesState(answer, null), viaService: r.viaService });
		},
		answerModes(values) {
			return this.setModes({ fff: !!values.fff, laser: !!values.laser, cnc: !!values.cnc });
		},
		// "I do not use it" in the guide: the mode goes off for the whole machine (its files stay)
		modeOff(m) {
			const cur = this.modesInfo;
			if (cur) this.setModes(withMode(cur.state, m, false, cur.detected));
		},
		modeOn(m) {
			return !!(this.modeState && this.modeState.answer[m]);
		},
		toggleMode(m, on) {
			const cur = this.modesInfo;
			if (cur) this.setModes(withMode(cur.state, m, !!on, cur.detected));
		},
		// the Machine plugin has the section where the modes are switched on and set up
		openMachineModes() {
			try {
				localStorage.setItem('workshopMachineSection', 'modes');
			} catch (e) {
				/* the page opens on its last section */
			}
			if (this.$router) this.$router.push('/Plugins/Machine').catch(() => {});
		},
		// the card re-reads what the page owns each time it refreshes: config.g (it calls the saved mode?) and the modes answer
		async recheckModes() {
			try {
				this.bootCalls = callsAutoModeSelect(await readText('0:/sys/config.g'));
			} catch (e) {
				/* not read: no row for it */
			}
			try {
				this.modesInfo = await loadModes(true);
			} catch (e) {
				/* the question stays as it was */
			}
		}
	}
};
