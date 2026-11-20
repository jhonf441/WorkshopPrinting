'use strict'

// The Vue side of tap-arm.js. Same names the sections already had (`armed`, `armedTimer`, `arm(id, fn)`), so a section migrates by deleting its own copy:
//   arm(id, fn)  first tap arms (amber button, 4 s), second runs fn
//   cancelArm()  disarm (the person goes elsewhere); it also runs when the component is destroyed
//   isArmed(id)  for the colour and the "Tap again" label of the button
// `armed` is in data so the session reset (sessionData: ['armed']) keeps working.

import { ARM_MS } from './tap-arm.js'

// the tap itself; also exposed as tapArm() for a page whose own method is called arm() (a service call that arms something else): its own name wins over the mixin's
function tap(id, fn) {
	clearTimeout(this.armedTimer);
	// the time since the first tap is checked too: a timer that a hidden tab delayed must not leave the arm alive
	if (this.armed !== id || Date.now() - this.armedAt >= ARM_MS) {
		this.armed = id;
		this.armedAt = Date.now();
		this.armedTimer = setTimeout(() => { this.armed = null; }, ARM_MS);
		return;
	}
	this.armed = null;
	fn();
}

export const tapArmMixin = {
	data() {
		return { armed: null, armedTimer: null, armedAt: 0 };
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
	methods: {
		isArmed(id) {
			return this.armed !== null && this.armed === id;
		},
		arm: tap,
		tapArm: tap,
		cancelArm() {
			clearTimeout(this.armedTimer);
			this.armed = null;
		}
	}
};
