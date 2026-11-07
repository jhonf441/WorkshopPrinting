<template>
	<div class="bze">
		<div class="text-subtitle-2 mb-1">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_title') }}</div>
		<help-guide :title="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guide_title')" :what="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guide_what')" :why="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guide_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guide_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guide_how')" />

		<!-- no geometry yet: the map shows the simple grid; drawing the real bed is a choice of the technician -->
		<template v-if="!geometry">
			<p class="text-body-2 mt-3 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_off_body') }}</p>
			<v-btn small outlined :disabled="saving" @click="act({ type: 'enable' })">
				<v-icon small left>mdi-ruler-square</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_enable') }}
			</v-btn>
		</template>

		<template v-else>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<div class="bze-group" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_group_align')">
					<v-btn v-for="a in aligns" :key="a.edge" icon class="bze-tool" :disabled="saving" :title="tip('align_' + a.edge)" :aria-label="tip('align_' + a.edge)" @click="act({ type: 'align', edge: a.edge })">
						<v-icon>{{ a.icon }}</v-icon>
					</v-btn>
				</div>
				<div class="bze-group" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_group_distribute')">
					<v-btn v-for="d in distributes" :key="d.axis" icon class="bze-tool" :disabled="saving" :title="tip('distribute_' + d.axis)" :aria-label="tip('distribute_' + d.axis)" @click="act({ type: 'distribute', axis: d.axis })">
						<v-icon>{{ d.icon }}</v-icon>
					</v-btn>
				</div>
				<div class="bze-group" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_group_equal')">
					<v-btn v-for="q in equals" :key="q.dim" icon class="bze-tool" :disabled="saving" :title="tip('equal_' + q.dim)" :aria-label="tip('equal_' + q.dim)" @click="act({ type: 'equal', dim: q.dim })">
						<v-icon>{{ q.icon }}</v-icon>
					</v-btn>
				</div>
				<help-tip v-bind="help('aids')" />
			</div>

			<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
				<v-btn-toggle :value="edit.alignTo" mandatory dense color="primary" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_align_to')" @change="act({ type: 'alignTo', value: $event })">
					<v-btn small value="selection" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_align_selection') }}</v-btn>
					<v-btn small value="reference" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_align_reference') }}</v-btn>
				</v-btn-toggle>
				<span class="text-caption" aria-live="polite">{{ targetText }}</span>
			</div>

			<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
				<v-btn small outlined class="bze-act" :disabled="saving || !edit.undo.length" @click="act({ type: 'undo' })">
					<v-icon small left>mdi-undo</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_undo') }}
				</v-btn>
				<v-btn small outlined class="bze-act" :disabled="saving || edit.config.zones.length >= max" @click="act({ type: 'add' })">
					<v-icon small left>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.add_zone') }}
				</v-btn>
				<v-btn small outlined class="bze-act" :disabled="saving || !edit.selection.length || edit.selection.length >= edit.config.zones.length" @click="act({ type: 'remove' })">
					<v-icon small left>mdi-delete-outline</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.remove_zone') }}
				</v-btn>
				<v-switch :input-value="edit.snap" dense hide-details class="mt-0 pt-0" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_snap')" :disabled="saving" @change="act({ type: 'snap', value: !!$event })" />
			</div>

			<div class="bze-grid mt-3">
				<wf-field id="bze-bed-w" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_bed_width')">
					<template #help><help-tip v-bind="help('bed')" /></template>
					<v-text-field id="bze-bed-w" :key="'bw' + bump" :value="geometry.bed.width" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_bed_width')" @change="typed({ type: 'bed', side: 'width', value: $event })" />
				</wf-field>
				<wf-field id="bze-bed-l" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_bed_length')" :message="bedProblem" level="error">
					<v-text-field id="bze-bed-l" :key="'bl' + bump" :value="geometry.bed.length" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_bed_length')" @change="typed({ type: 'bed', side: 'length', value: $event })" />
				</wf-field>
			</div>

			<!-- the zone chosen last (the reference): the same numbers as the drag, typed -->
			<div class="text-subtitle-2 mt-3">{{ chosen ? $t('plugins.WorkshopPrinting.bedZones.zones_layout_selected', { n: chosenIndex + 1 }) : $t('plugins.WorkshopPrinting.bedZones.zones_layout_pick') }}</div>
			<div v-if="chosen" class="bze-grid mt-1">
				<wf-field v-for="f in rectFields" :id="'bze-r-' + f" :key="f" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_' + f)">
					<v-text-field :id="'bze-r-' + f" :key="f + chosenIndex + bump" :value="chosen[f]" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_' + f)" @change="typed({ type: 'field', name: f, value: $event })" />
				</wf-field>
			</div>

			<div v-if="edit.note" class="wf-note is-warn mt-3" role="note">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
				<span>{{ $t('plugins.WorkshopPrinting.bedZones.' + edit.note) }}</span>
			</div>
			<div v-if="messages.length" class="wf-note is-warn mt-3" role="note">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
				<span>{{ messages.join(' ') }}</span>
			</div>
			<div v-else-if="bedNote" class="wf-note mt-3" role="note">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
				<span>{{ bedNote }}</span>
			</div>

			<v-btn small text class="mt-2" :disabled="saving" @click="act({ type: 'simple' })">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_disable') }}</v-btn>
		</template>

		<ul v-if="serverErrors.length" class="bze-errors mt-2">
			<li v-for="(e, i) in serverErrors" :key="i" class="text-caption error--text">{{ e }}</li>
		</ul>

		<div class="d-flex flex-wrap mt-3" style="gap:8px">
			<v-btn small color="primary" :loading="saving" :disabled="!canSave" @click="$emit('save')">{{ $t('plugins.WorkshopPrinting.common.save') }}</v-btn>
			<v-btn small outlined :disabled="saving" @click="$emit('cancel')">{{ $t('plugins.WorkshopPrinting.bedZones.cancel') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// The editing panel of the bed map (technician), shown under the map of BedZones.vue while Edit is on: the editing aids (align, distribute, make equal),
// undo, add and remove a zone, the bed size and the numbers of the chosen zone, and Save / Cancel. It owns nothing: it receives the state of the edit
// session (bed-zones-edit.js) and answers `act` with an action for that file's reduce(); BedZones.vue keeps the state and does the saving.
// Every icon button has its label as tooltip and accessible name and is 44 px wide.
import { bedFromModel } from './bed-zones-layout.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import HelpGuide from './HelpGuide.vue' // vue/_shared36

const HELPED = ['bed', 'aids']
const ALIGNS = [
	{ edge: 'left', icon: 'mdi-align-horizontal-left' },
	{ edge: 'hcenter', icon: 'mdi-align-horizontal-center' },
	{ edge: 'right', icon: 'mdi-align-horizontal-right' },
	{ edge: 'top', icon: 'mdi-align-vertical-top' },
	{ edge: 'vcenter', icon: 'mdi-align-vertical-center' },
	{ edge: 'bottom', icon: 'mdi-align-vertical-bottom' }
]
const DISTRIBUTES = [
	{ axis: 'h', icon: 'mdi-align-horizontal-distribute' },
	{ axis: 'v', icon: 'mdi-align-vertical-distribute' }
]
const EQUALS = [
	{ dim: 'width', icon: 'mdi-arrow-expand-horizontal' },
	{ dim: 'height', icon: 'mdi-arrow-expand-vertical' },
	{ dim: 'both', icon: 'mdi-arrow-expand-all' }
]

export default {
	components: { WfField, HelpTip, HelpGuide },
	props: {
		edit: { type: Object, required: true }, // the state of the session (startEdit of bed-zones-edit.js)
		problems: { type: Array, default: () => [] }, // editProblems(): {field, key, n?, other?}
		max: { type: Number, default: 16 }, // the most zones this board supports
		model: { type: Object, default: null }, // the live object model (bed size from the axes)
		dirty: { type: Boolean, default: false },
		saving: { type: Boolean, default: false },
		serverErrors: { type: Array, default: () => [] }
	},
	data() {
		return { bump: 0, aligns: ALIGNS, distributes: DISTRIBUTES, equals: EQUALS, rectFields: ['x', 'y', 'w', 'h'] }
	},
	computed: {
		geometry() {
			return this.edit.config.geometry || null
		},
		// the zone whose numbers are typed: the reference, else the only one chosen
		chosenIndex() {
			const i = this.edit.reference !== null ? this.edit.reference : this.edit.selection[0]
			return i === undefined ? null : i
		},
		chosen() {
			const z = this.chosenIndex === null ? null : this.edit.config.zones[this.chosenIndex]
			return z && z.rect ? z.rect : null
		},
		canSave() {
			return this.dirty && !this.problems.length && !this.saving
		},
		messages() {
			return this.problems.map(p => this.$t('plugins.WorkshopPrinting.bedZones.' + p.key, { n: p.n, other: p.other }))
		},
		bedProblem() {
			const p = this.problems.find(x => x.field === 'bed')
			return p ? this.$t('plugins.WorkshopPrinting.bedZones.' + p.key) : ''
		},
		targetText() {
			const n = this.edit.selection.length
			return n ? this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_target_n', { n }) : this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_target_all')
		},
		bedNote() {
			const b = bedFromModel(this.model)
			return b.fromMachine ? this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_bed_machine') : this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_bed_default')
		}
	},
	methods: {
		help(k) {
			if (HELPED.indexOf(k) < 0) return {}
			const t = s => this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_help_' + k + '_' + s)
			return { title: t('title'), what: t('what'), why: t('why'), ifMissing: t('miss'), how: t('how') }
		},
		tip(k) {
			return this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_' + k)
		},
		act(action) {
			this.$emit('act', action)
		},
		// a typed number: the field is drawn again from the state, so a rejected text does not stay on screen
		typed(action) {
			this.bump++
			this.act(action)
		}
	}
}
</script>

<style scoped>
.bze-group { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.3)); border-radius: 6px; }
.bze-tool.v-btn.v-btn--icon { width: 44px; height: 44px; }
.bze-act.v-btn, .bze-wide.v-btn { min-height: 44px; }
.bze-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.bze-errors { padding-left: 16px; }
</style>
