'use strict'

// The double tap of the page, one rule (DESIGN.md 5, level 2: heating or moving): the first tap ARMS the button, the second one within 4 s runs the
// action. Arming another thing (or letting the 4 s pass) disarms the first. Pure (no Vue, no DOM): the timers are injected so a test can drive them.
// The module does not choose which actions need it (that is the level of each action) and never blocks a stop: a stop is not armed.
// tap-arm-mixin.js is the thin Vue side; the text "Tap again: ..." is each button's own (es.json / en.json).

export const ARM_MS = 4000;

// timers: { set(fn, ms) -> handle, clear(handle) }, default the global ones; now() the clock (a throttled timer, as in a hidden tab, must not leave a stale arm alive:
// the second tap also checks the time since the first)
export function createTapArm(onChange, timers, now) {
	const t = timers || { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h) };
	const clock = typeof now === 'function' ? now : Date.now;
	let armed = null;
	let at = 0;
	let handle = null;
	const change = id => {
		armed = id;
		if (typeof onChange === 'function') onChange(armed);
	};
	return {
		// the id that is armed now, or null
		get armed() { return armed; },
		isArmed(id) { return armed !== null && armed === id; },
		// the tap on button `id`: arms it and returns false; with it armed, disarms and returns true (the caller runs the action)
		tap(id) {
			if (armed === id && clock() - at < ARM_MS) {
				t.clear(handle);
				handle = null;
				change(null);
				return true;
			}
			t.clear(handle);
			at = clock();
			change(id);
			handle = t.set(() => { handle = null; change(null); }, ARM_MS);
			return false;
		},
		// the person went elsewhere (another section, the dialog closed, the component goes away)
		cancel() {
			t.clear(handle);
			handle = null;
			if (armed !== null) change(null);
		}
	};
}

// The label of a button that arms: `armedLabel` while it is the armed one, `idleLabel` otherwise
export function armLabel(armedId, id, armedLabel, idleLabel) {
	return armedId !== null && armedId === id ? armedLabel : idleLabel;
}
