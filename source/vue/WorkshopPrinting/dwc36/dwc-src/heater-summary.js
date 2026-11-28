'use strict'

// The one line of state of the heaters ("Heating: 1 of 4 still to reach its target"), pure (test/heater-summary.test.js). It counts with the classification of fff-temps.js
// (tzFffTempClass: ok / heating / cooling / off / fault, the tolerance is the one of that module: nothing is invented here) and returns a KEY and two numbers; the sentences
// are in es.json / en.json (printing.heat_sum_<key>).
//   heaters  [{ current, target, state, sensorBad }] as the page builds them (Print.vue heaters): `target` is what the heater is driven to now (0 = off)
//   -> { key, n, m, kind }
//      key   'none' (no heaters) | 'fault' | 'heating' | 'cooling' | 'ready' | 'off'
//      n, m  heating: n still to reach, m = how many have a target; fault: n faults; cooling: n above their target; ready: n = m at temperature
//      kind  the state dot of the family: ok | warn | err | info

import { tzFffTempClass } from './fff-temps.js'

export function heaterSummary(heaters) {
	const list = (heaters || []).filter(h => h);
	if (!list.length) return { key: 'none', n: 0, m: 0, kind: 'info' };
	const cls = list.map(h => {
		if (h.sensorBad) return 'fault';
		const cur = h.current === undefined ? null : h.current;
		return tzFffTempClass(cur, Number(h.target) || 0, h.state);
	});
	const count = c => cls.filter(x => x === c).length;
	const faults = count('fault');
	const heating = count('heating');
	const cooling = count('cooling');
	const ok = count('ok');
	const on = heating + cooling + ok; // the heaters that have a target
	if (faults) return { key: 'fault', n: faults, m: list.length, kind: 'err' };
	const tuning = list.filter(h => h.state === 'tuning').length; // a PID tuning heats and cools by itself, with no target the page can compare
	if (tuning) return { key: 'tuning', n: tuning, m: list.length, kind: 'warn' };
	if (heating) return { key: 'heating', n: heating, m: on, kind: 'warn' };
	if (cooling) return { key: 'cooling', n: cooling, m: on, kind: 'info' };
	if (ok) return { key: 'ready', n: ok, m: on, kind: 'ok' };
	return { key: 'off', n: 0, m: 0, kind: 'info' };
}
