'use strict'

// The result of an action, one way to say it: ONE line next to the action (PcResult.vue, aria-live polite), never a green box. Pure: test/action-result.test.js.
// The sections kept `msg` + `msgKind` ('info' | 'success' | 'error' | 'warning'); the mixin keeps those names so a section migrates by deleting its copy.

// the kind of the line: the state class of the family (.wf-state ok | err | warn | info)
export function resultKind(kind) {
	if (kind === 'success' || kind === 'ok') return 'ok';
	if (kind === 'error' || kind === 'err') return 'err';
	if (kind === 'warning' || kind === 'warn') return 'warn';
	return 'info';
}

export const resultMixin = {
	data() {
		return { msg: null, msgKind: 'info' };
	},
	methods: {
		// say(text, 'success'|'error'|...): a new result replaces the one shown
		say(text, kind) {
			this.msgKind = kind || 'info';
			this.msg = text || null;
		},
		clearResult() {
			this.msg = null;
			this.msgKind = 'info';
		}
	}
};
