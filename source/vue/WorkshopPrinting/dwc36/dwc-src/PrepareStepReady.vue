<template>
	<div>
		<template v-if="fileName && !stop">
			<!-- two blocks, each with the role it asks: Preheat (operator) and Apply (technician, only when the profile has changes during the print) -->
			<div v-if="ready" class="pc-g2">
				<div class="pc-sub">
					<h4>{{ tx('ready_preheat_title') }} <wf-role-tag role="operator" class="ml-1" /></h4>
					<p class="wf-field-msg is-hint mb-2">{{ tx('ready_preheat_help', { name: name }) }}</p>
					<!-- ONE filled button per block: Preheat when the profile has no changes (Apply is not there), else Apply -->
					<profile-preheat :profile="picked" :is-fff="isFff" :heaters="heaters" :tools="tools" :current-tool="currentTool" :bed-config="bedConfig" :state="state" :outlined="hasLayers" />
				</div>
				<div class="pc-sub">
					<template v-if="hasLayers">
						<h4>{{ tx('ready_apply_title') }} <wf-role-tag role="technician" class="ml-1" /></h4>
						<p class="wf-field-msg is-hint mb-2">{{ tx('ready_apply_help') }}</p>
						<!-- Apply exists only with changes during the print: it gets them ready for this file (two taps, live state, Remove) -->
						<recipe-run :name="name" :recipe="recipe" :dirty="false" :file-override="file" :reason-id="uid + '-role'" :was-applied="draftApplied" :before-apply="beforeApply" @status="$emit('status', $event)" @stale="$emit('stale', $event)" @removed="$emit('removed')" />
					</template>
					<template v-else>
						<h4>{{ tx('ready_none_title') }}</h4>
						<p class="wf-field-msg is-hint mb-2">{{ tx('ready_none_help') }}</p>
						<!-- without them there is nothing to apply; a technician can go and switch them on in Profiles -->
						<v-btn v-if="canEdit" small outlined class="pj-btn" @click="$emit('goto', { section: 'profiles' })"><v-icon small left>mdi-layers-plus</v-icon>{{ tx('apply_go_changes') }}</v-btn>
					</template>
				</div>
			</div>
			<pc-empty v-else compact icon="mdi-information-outline" :text="tx('ready_choose_first')" />

			<dl class="pc-facts mt-3">
				<div><dt>{{ tx('sum_folder') }}</dt><dd class="pj-path">{{ pathParts.folder || tx('sum_folder_root') }}</dd></div>
				<div><dt>{{ tx('sum_file') }}</dt><dd class="pj-path">{{ pathParts.name }}<v-btn small text class="pj-btn ml-2" @click="$emit('copy-path')"><v-icon small left>mdi-content-copy</v-icon>{{ tx('copy_path') }}</v-btn><span v-if="copied" class="wf-field-msg is-hint ml-2" role="status">{{ tx(copied === 'ok' ? 'path_copied' : 'path_copy_failed') }}</span></dd></div>
				<div><dt>{{ tx('sum_profile') }}</dt><dd>{{ name || '--' }}</dd></div>
				<div v-if="picked"><dt>{{ tx('sum_changes') }}</dt><dd>{{ changesText }}</dd></div>
			</dl>
			<pc-empty v-if="hint" compact class="mt-2" :ok="hint === 'started'" aria-live="polite" :icon="hint === 'started' ? 'mdi-check-circle-outline' : 'mdi-information-outline'" :text="tx('hint_' + hint, { file: jobParts.name })">
				<v-btn v-if="['started', 'other_job', 'other_job_unnamed', 'simulating'].indexOf(hint) >= 0" small text class="pj-btn" @click="$emit('goto', { section: 'job' })"><v-icon small left>mdi-cube-outline</v-icon>{{ tx('go_job') }}</v-btn>
			</pc-empty>
			<!-- the page never starts the job: it says where the file is and opens DWC Jobs (navigation only, no code is sent) -->
			<div class="pc-sticky-act">
				<div class="pc-actions">
					<v-btn small color="primary" class="pj-btn" @click="$emit('open-jobs')"><v-icon small left>mdi-folder-play-outline</v-icon>{{ tx('open_jobs') }}</v-btn>
					<span class="wf-field-msg is-hint">{{ tx('step_start_help', { folder: pathParts.folder || tx('sum_folder_root') }) }}</span>
				</div>
			</div>
		</template>
	</div>
</template>

<script>
// The last step of Prepare job (Get ready): Preheat and Apply, each with its role, the facts of what is prepared, where the job is started and the button that opens DWC Jobs.
// Props down, events up (status, stale, removed, goto, copy-path, open-jobs). The page never starts the job and sends no code from here.
import ProfilePreheat from './ProfilePreheat.vue'
import RecipeRun from './RecipeRun.vue'
import PcEmpty from './PcEmpty.vue'
import WfRoleTag from './WfRoleTag.vue' // vue/_shared36: the role the block asks for (only with the access control on)
import { prepareTextMixin } from './prepare-text-mixin.js'

export default {
	mixins: [prepareTextMixin],
	components: { ProfilePreheat, RecipeRun, PcEmpty, WfRoleTag },
	props: {
		uid: { type: String, required: true },
		fileName: { type: String, default: '' },
		file: { type: String, default: '' }, // the file as chosen (RecipeRun takes it as is)
		stop: { type: String, default: '' },
		ready: { type: Boolean, default: false },
		hint: { type: String, default: '' }, // the hint of the last step
		picked: { type: Object, default: null },
		name: { type: String, default: '' },
		hasLayers: { type: Boolean, default: false },
		recipe: { type: Object, default: null },
		draftApplied: { type: Boolean, default: false },
		beforeApply: { type: Function, default: null },
		isFff: { type: Boolean, default: false },
		heaters: { type: Array, default: () => [] },
		tools: { type: Array, default: () => [] },
		currentTool: { type: Object, default: null },
		bedConfig: { type: Object, default: null },
		state: { type: String, default: '' },
		pathParts: { type: Object, default: () => ({ folder: '', name: '', path: '' }) },
		jobParts: { type: Object, default: () => ({ folder: '', name: '', path: '' }) },
		changesText: { type: String, default: '' },
		copied: { type: String, default: '' },
		canEdit: { type: Boolean, default: false }
	}
};
</script>
