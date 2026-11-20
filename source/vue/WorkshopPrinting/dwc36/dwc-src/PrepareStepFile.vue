<template>
	<div>
		<wf-field id="pj-file" :label="px('pellet_layers_f_file')">
			<gcode-picker id="pj-file" :value="fileName" :job-file="jobName" :default-kinds="['fff']" clearable :show-help="false" :show-line="false" :aria-label="px('pellet_layers_f_file')" @input="$emit('pick', $event)" />
		</wf-field>
		<gcode-info-card v-if="fileName" :file="fileName" mini-preview class="mt-2" @info="$emit('info', $event)" />
		<!-- ONE line of state under the card (or none): the file is not a 3D print, no file yet, or it is the file the machine has loaded -->
		<div v-if="stop" class="wf-note is-warn mt-2" role="alert"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('hint_not_fff', { kind: tx('kind_' + fileKind) }) }}</span></div>
		<pc-empty v-else-if="!fileName" compact class="mt-2" icon="mdi-file-search-outline" :text="tx('hint_file_missing')">
			<v-btn small text class="pj-btn" @click="$emit('goto', { section: 'library' })"><v-icon small left>mdi-bookshelf</v-icon>{{ tx('go_files') }}</v-btn>
		</pc-empty>
		<div v-else-if="isJobFile" class="wf-field-msg is-hint mt-1">{{ tx('file_is_job') }}</div>
	</div>
</template>

<script>
// Step 1 of Prepare job: the file (the select of the G-code library, its card and one line of state). Props down, events up (pick, info, goto).
import WfField from './WfField.vue' // vue/_shared36
import GcodePicker from './GcodePicker.vue'
import GcodeInfoCard from './GcodeInfoCard.vue'
import PcEmpty from './PcEmpty.vue'
import { prepareTextMixin } from './prepare-text-mixin.js'

export default {
	mixins: [prepareTextMixin],
	components: { WfField, GcodePicker, GcodeInfoCard, PcEmpty },
	props: {
		fileName: { type: String, default: '' },
		jobName: { type: String, default: '' },
		fileKind: { type: String, default: null },
		stop: { type: String, default: '' }, // 'not_fff' when the file is a laser / CNC file
		isJobFile: { type: Boolean, default: false }
	}
};
</script>
