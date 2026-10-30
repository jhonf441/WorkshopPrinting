'use strict';

// Which modes this machine uses, as the 3D printing page needs it (3.7). The rules are in vue/_shared/machine-modes.js and the answer
// lives in the machine profile (machine-modes-store.js); this only wires them to the page:
//   * the rows of the start-up card (the question first; mode rows only when two or more modes are on);
//   * the head change section exists only when the machine switches between modes;
//   * the entry that sends to Machine > Machine modes (when that plugin is there) or the switches themselves (when it is not).

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { modeStartupRows, callsAutoModeSelect, modesState, usesSeveralModes, usesExtraModes, enabledList, withMode, MODE_NAMES } from './machine-modes.js';
import { loadModes, saveModes } from './machine-modes-store.js';
import { pluginActive } from './workshop-ids.js';
import { readText } from './util.js';

export function usePrintModes() {
	const modesInfo = ref(null);
	const bootCalls = ref(null);
	const router = useRouter();

	const modeState = computed(() => (modesInfo.value ? modesInfo.value.state : null));
	const modeNames = computed(() => (modeState.value && modeState.value.answered ? enabledList(modeState.value).map(m => MODE_NAMES[m]) : null));
	// head change only when the machine switches between modes
	const hideHead = computed(() => !!modeState.value && modeState.value.answered && !usesSeveralModes(modeState.value));
	const machineThere = computed(() => pluginActive('machine'));
	const showModesEntry = computed(() => !!modeState.value && modeState.value.answered && !usesExtraModes(modeState.value));
	// nothing before the answer is read: no false red while it loads
	const rowsStartup = computed(() => {
		if (!modesInfo.value) return [];
		return modeStartupRows(modesInfo.value.state, modesInfo.value.detected, bootCalls.value, answerModes);
	});

	async function setModes(answer) {
		const cur = modesInfo.value;
		const r = await saveModes(answer, cur && cur.profile);
		modesInfo.value = Object.assign({}, cur, { state: modesState(answer, null), viaService: r.viaService });
	}
	function answerModes(values) {
		return setModes({ fff: !!values.fff, laser: !!values.laser, cnc: !!values.cnc });
	}
	// "I do not use it" in the guide: the mode goes off for the whole machine (its files stay)
	function modeOff(m) {
		const cur = modesInfo.value;
		if (cur) setModes(withMode(cur.state, m, false, cur.detected));
	}
	function modeOn(m) {
		return !!(modeState.value && modeState.value.answer[m]);
	}
	function toggleMode(m, on) {
		const cur = modesInfo.value;
		if (cur) setModes(withMode(cur.state, m, !!on, cur.detected));
	}
	// the Machine plugin has the section where the modes are switched on and set up
	function openMachineModes() {
		try {
			localStorage.setItem('workshopMachineSection', 'modes');
		} catch (e) {
			/* the page opens on its last section */
		}
		router.push('/Plugins/Machine').catch(() => {});
	}
	// the card re-reads what the page owns each time it refreshes: config.g (does it call the saved mode?) and the modes answer
	async function recheckModes() {
		try {
			bootCalls.value = callsAutoModeSelect(await readText('0:/sys/config.g'));
		} catch (e) {
			/* not read: no row for it */
		}
		try {
			modesInfo.value = await loadModes(true);
		} catch (e) {
			/* the question stays as it was */
		}
	}

	return { modeNames, hideHead, machineThere, showModesEntry, rowsStartup, answerModes, modeOff, modeOn, toggleMode, openMachineModes, recheckModes, bootCalls };
}
