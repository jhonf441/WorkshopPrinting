<template>
	<div>
		<pc-empty v-if="hint && hint !== 'read_needed' && hint !== 'not_fff'" compact :ok="hint === 'review_done'" aria-live="polite" :icon="hint === 'review_done' ? 'mdi-check-circle-outline' : 'mdi-information-outline'" :text="tx('hint_' + hint, { name: name })">
			<v-btn v-if="hint === 'read_stale'" small text class="pj-btn" @click="$emit('read')"><v-icon small left>mdi-refresh</v-icon>{{ tx('read_again') }}</v-btn>
		</pc-empty>
		<template v-if="ready">
			<gcode-layer-view v-if="shown" class="mt-3" :preview="preview" :loading="busy" :error="previewError" :recipe-name="name" @read="$emit('read')" />
			<v-btn v-else small color="primary" class="pj-btn mt-3" :loading="busy" @click="$emit('read')"><v-icon small left>mdi-file-eye-outline</v-icon>{{ tx('apply_read') }}</v-btn>
			<!-- a profile without changes during the print has nothing to apply: ONE note says the file temperatures rule during the job -->
			<!-- something else is applied for this file: the service WILL change the temperatures with it, so the sentence says that (and Remove, a stop, is open to every role) instead of saying the file rules -->
			<div v-if="!hasLayers && applied === 'other'" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('applied_other', { recipe: runStatus.recipe, file: runStatus.file }) }}</span><v-btn small outlined class="pj-btn ml-2" :loading="removing" @click="$emit('remove-other')"><v-icon small left>mdi-stop-circle-outline</v-icon>{{ tx('unapply') }}</v-btn></div>
			<div v-else-if="!hasLayers" class="wf-note mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('flat_note', { name: name }) }}</span></div>
		</template>
	</div>
</template>

<script>
// Step 3 of Prepare job: review what changes (the file next to the profile, by zone and by layer, with the G-code lines). It only shows and reads: Preheat and Apply are
// in the last step. Props down, events up (read, remove-other).
import GcodeLayerView from './GcodeLayerView.vue'
import PcEmpty from './PcEmpty.vue'
import { prepareTextMixin } from './prepare-text-mixin.js'

export default {
	mixins: [prepareTextMixin],
	components: { GcodeLayerView, PcEmpty },
	props: {
		hint: { type: String, default: '' },
		ready: { type: Boolean, default: false },
		name: { type: String, default: '' },
		hasLayers: { type: Boolean, default: false },
		shown: { type: Boolean, default: false },
		preview: { type: Object, default: null },
		previewError: { type: [Object, String, Error], default: null },
		busy: { type: Boolean, default: false },
		applied: { type: String, default: 'none' },
		runStatus: { type: Object, default: null },
		removing: { type: Boolean, default: false }
	}
};
</script>
