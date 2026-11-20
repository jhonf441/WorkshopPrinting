<template>
	<span v-if="text" class="pc-result wf-state" :class="cls" role="status" aria-live="polite">{{ text }}</span>
	<span v-else class="pc-result-slot" aria-live="polite" />
</template>

<script>
// The result of an action next to the button that did it: a dot of the state + the sentence in the normal color (a state is never text in amber or red).
// The live region stays in the page when empty so a screen reader hears the sentence that arrives. Used with action-result.js (resultMixin).
import { resultKind } from './action-result.js'

export default {
	props: {
		text: { type: String, default: '' },
		kind: { type: String, default: 'info' }
	},
	computed: {
		cls() {
			return resultKind(this.kind);
		}
	}
};
</script>
