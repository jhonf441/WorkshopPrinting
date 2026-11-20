<template>
	<details class="pc-step" :class="['is-' + state, { 'is-current': state === 'current' }]" :open="open" :aria-current="state === 'current' ? 'step' : undefined" @toggle="$emit('toggle', $event.target.open)">
		<summary :id="uid + '-s' + n" class="pc-step-sum">
			<span class="pc-step-num" aria-hidden="true"><v-icon v-if="state === 'done'" x-small>mdi-check</v-icon><v-icon v-else-if="state === 'blocked'" x-small>mdi-close</v-icon><template v-else>{{ n }}</template></span>
			<span class="pc-step-title">{{ title }}</span>
			<span class="pc-step-res">{{ result }}</span>
		</summary>
		<!-- the body stays in the page when the step is folded: the polls and the timers of what is inside keep running -->
		<div class="pc-step-body">
			<div v-if="lead" class="pc-step-lead"><span class="wf-field-msg is-hint">{{ lead }}</span></div>
			<slot />
		</div>
	</details>
</template>

<script>
// One step of Prepare job: a details with the numbered circle (outline; a check when done, a cross when it does not apply), the title, the result on the right and the body.
// Props down, events up: the parent keeps which steps are open and hears `toggle` (true / false) when the person opens or folds one.
import HelpTip from './HelpTip.vue' // vue/_shared36

export default {
	components: { HelpTip },
	props: {
		uid: { type: String, required: true },
		n: { type: Number, required: true },
		state: { type: String, default: 'pending' }, // done | current | pending | blocked (prepare-steps.js)
		title: { type: String, default: '' },
		result: { type: String, default: '' },
		open: { type: Boolean, default: false },
		lead: { type: String, default: '' },
		help: { type: Object, default: null }
	}
};
</script>
