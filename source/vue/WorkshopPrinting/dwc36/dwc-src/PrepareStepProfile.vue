<template>
	<div>
		<template v-if="!stop">
			<div class="pc-actions pc-actions-end">
				<wf-field id="pj-profile" class="pc-field-fit" :label="tx('profile')">
					<v-select id="pj-profile" :value="value" :items="items" :disabled="!fileName" :placeholder="tx('profile_pick')" dense outlined hide-details :aria-label="tx('profile')" @input="$emit('input', $event)">
						<template #item="{ item }"><span>{{ item.text }}</span><v-chip x-small outlined class="ml-2">{{ tx('kind_' + item.kind) }}</v-chip><v-chip v-if="item.layers" x-small outlined color="primary" class="ml-1">{{ tx('changes_chip') }}</v-chip><v-chip v-if="item.match" x-small outlined class="ml-1">{{ tx('profile_match') }}</v-chip></template>
					</v-select>
				</wf-field>
				<v-btn small outlined class="pj-btn" @click="$emit('goto', { section: 'profiles' })"><v-icon small left>mdi-pencil-outline</v-icon>{{ tx('edit_profiles') }}</v-btn>
			</div>
			<div v-if="picked" class="pc-actions pc-chips mt-2">
				<v-chip x-small outlined :color="pickedKind === 'pellet' ? 'primary' : 'info'">{{ tx('kind_' + pickedKind) }}</v-chip>
				<span class="text-body-2">{{ summary }}</span>
				<v-chip x-small outlined :color="hasLayers ? 'primary' : undefined">{{ hasLayers ? tx('changes_yes') : tx('changes_no') }}</v-chip>
				<v-chip v-if="pickedMatch" x-small outlined>{{ tx('profile_match') }}</v-chip>
			</div>
			<!-- a suggestion, never a choice: the page marks the profile that fits the file, the person confirms what is loaded -->
			<div v-if="pickedMatch" class="wf-field-msg is-hint mt-1">{{ tx('help_match_what', { c: fileNozzleC }) }} {{ tx('help_match_how') }}</div>
			<pc-empty v-if="hint && hint !== 'not_fff'" compact class="mt-2" icon="mdi-flask-outline" :text="tx(hint === 'profiles_none' && !canEdit ? 'hint_profiles_none_ask' : 'hint_' + hint)">
				<v-btn v-if="hint === 'profiles_none' && canEdit" small text class="pj-btn" @click="$emit('goto', { section: 'profiles' })"><v-icon small left>mdi-flask-plus-outline</v-icon>{{ tx('go_new_profile') }}</v-btn>
			</pc-empty>
		</template>
	</div>
</template>

<script>
// Step 2 of Prepare job: the profile (the material): the select, what the profile is and one line of state. Props down; `input` is the chosen name, goto goes to Profiles.
import WfField from './WfField.vue' // vue/_shared36
import PcEmpty from './PcEmpty.vue'
import { prepareTextMixin } from './prepare-text-mixin.js'

export default {
	mixins: [prepareTextMixin],
	components: { WfField, PcEmpty },
	props: {
		value: { type: String, default: '' },
		items: { type: Array, default: () => [] },
		fileName: { type: String, default: '' },
		stop: { type: String, default: '' },
		hint: { type: String, default: '' }, // the hint of the step (prepare-steps.js)
		picked: { type: Object, default: null },
		pickedKind: { type: String, default: 'pellet' },
		pickedMatch: { type: Boolean, default: false },
		summary: { type: String, default: '' },
		hasLayers: { type: Boolean, default: false },
		fileNozzleC: { type: Number, default: null },
		canEdit: { type: Boolean, default: false }
	}
};
</script>
