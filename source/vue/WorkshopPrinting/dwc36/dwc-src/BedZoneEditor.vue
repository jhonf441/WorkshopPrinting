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
				<v-btn small outlined class="bze-act" :disabled="saving || !edit.config.zones.length" :aria-pressed="edit.arrange ? 'true' : 'false'" @click="act({ type: edit.arrange ? 'arrangeClose' : 'arrangeOpen' })">
					<v-icon small left>mdi-auto-fix</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange') }}
				</v-btn>
				<help-tip v-bind="help('arrange')" />
			</div>

			<!-- the tidy-up: one explicit action with a preview (outlines and arrows on the map, the list here); nothing changes until Apply -->
			<div v-if="edit.arrange" class="bze-arrange mt-3" role="group" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_title')">
				<div class="text-subtitle-2">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_title') }}</div>
				<p class="text-caption mt-1 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_intro') }}</p>
				<div class="d-flex flex-wrap align-center" style="gap:8px">
					<v-btn-toggle :value="edit.arrange.options.order" mandatory dense color="primary" class="bze-toggle" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_order')" @change="act({ type: 'arrangeOption', name: 'order', value: $event })">
						<v-btn small value="keep" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_keep') }}</v-btn>
						<v-btn small value="best" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_best') }}</v-btn>
					</v-btn-toggle>
					<v-btn-toggle :value="edit.arrange.options.anchor" mandatory dense color="primary" class="bze-toggle" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_anchor')" @change="act({ type: 'arrangeOption', name: 'anchor', value: $event })">
						<v-btn small value="center" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_center') }}</v-btn>
						<v-btn small value="corner" class="bze-wide" :disabled="saving">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_corner') }}</v-btn>
					</v-btn-toggle>
				</div>
				<div class="bze-grid mt-3">
					<wf-field id="bze-arr-gap" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_f_gap')">
						<v-text-field id="bze-arr-gap" :key="'ag' + bump" :value="edit.arrange.options.gap === null ? '' : edit.arrange.options.gap" :placeholder="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_f_gap_auto')" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_f_gap')" @change="typed({ type: 'arrangeOption', name: 'gap', value: $event })" />
					</wf-field>
					<wf-field id="bze-arr-min" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_f_min')">
						<v-text-field id="bze-arr-min" :key="'am' + bump" :value="edit.arrange.options.minGap" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_f_min')" @change="typed({ type: 'arrangeOption', name: 'minGap', value: $event })" />
					</wf-field>
				</div>

				<div v-if="plan" class="mt-3" aria-live="polite">
					<div v-if="shrinking" class="wf-note is-warn" role="note">
						<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_shrink_text', { pct: Math.floor(plan.scale * 100) }) }}</span>
					</div>
					<div v-if="plan.fits && plan.changed" class="wf-note mt-2" role="note">
						<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_result', { rows: plan.rows, cols: plan.cols, gap: plan.gap }) }}<template v-if="plan.gapReduced"> {{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_gap_reduced', { gap: plan.gap }) }}</template><template v-if="plan.reordered"> {{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_reordered') }}</template><template v-if="plan.skipped.length"> {{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_skipped', { n: plan.skipped.length }) }}</template></span>
					</div>
					<div v-else-if="plan.fits" class="wf-note" role="note">
						<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-check-circle-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_tidy') }}</span>
					</div>
					<div v-else-if="!plan.ok" class="wf-note is-warn" role="note">
						<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_shrink_fail') }}</span>
					</div>
					<div v-else class="wf-note is-warn" role="note">
						<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
						<span>{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_nofit', { missing: missingText }) }} {{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_nofit_hint') }}</span>
					</div>
					<template v-if="plan.fits && plan.changed">
						<div class="text-subtitle-2 mt-3">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_moves') }}</div>
						<ul class="bze-moves text-caption">
							<li v-for="m in plan.moves" :key="m.index">{{ moveText(m) }}</li>
						</ul>
						<div class="text-caption">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_stay', { n: edit.config.zones.length - plan.moves.length }) }}</div>
					</template>
				</div>

				<div class="d-flex flex-wrap mt-3" style="gap:8px">
					<v-btn small color="primary" class="bze-act" :disabled="saving || !plan || !plan.fits || !plan.changed" @click="act({ type: 'arrangeApply' })">{{ shrinking ? $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_shrink_apply') : $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_apply') }}</v-btn>
					<v-btn v-if="plan && !plan.fits && plan.ok && !edit.arrange.shrink" small outlined class="bze-act" :disabled="saving" @click="act({ type: 'arrangeShrink' })">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_shrink') }}</v-btn>
					<v-btn v-if="edit.arrange.shrink" small outlined class="bze-act" :disabled="saving" @click="act({ type: 'arrangeBack' })">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_shrink_back') }}</v-btn>
					<v-btn small text class="bze-act" :disabled="saving" @click="act({ type: 'arrangeClose' })">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_cancel') }}</v-btn>
				</div>
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
				<v-switch :input-value="edit.guides" dense hide-details class="mt-0 pt-0" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_guides')" :disabled="saving" @change="act({ type: 'guides', value: !!$event })" />
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

				<!-- how it ended up: the view and the measures of every zone on the bed -->
				<div class="text-caption mt-3">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_view', { w: geometry.bed.width, l: geometry.bed.length }) }}</div>
				<v-simple-table dense class="bze-summary mt-1">
					<thead>
						<tr>
							<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_zone') }}</th>
							<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_col_from') }}</th>
							<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_col_size') }}</th>
							<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_col_area') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in summary" :key="r.n">
							<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: r.n }) }}</td>
							<td class="text-right bze-num">{{ r.x }} / {{ r.y }}</td>
							<td class="text-right bze-num">{{ r.w }} x {{ r.h }}</td>
							<td class="text-right bze-num">{{ r.area }} cm2</td>
						</tr>
					</tbody>
				</v-simple-table>
				<div class="text-caption mt-1">{{ $t('plugins.WorkshopPrinting.bedZones.zones_layout_covered', { pct: coverage, area: coveredArea }) }}</div>

			<!-- the zone chosen last (the reference): the same numbers as the drag, typed -->
			<div class="text-subtitle-2 mt-3">{{ chosen ? $t('plugins.WorkshopPrinting.bedZones.zones_layout_selected', { n: chosenIndex + 1 }) : $t('plugins.WorkshopPrinting.bedZones.zones_layout_pick') }}</div>
			<div v-if="chosen" class="bze-grid mt-1">
				<wf-field v-for="f in rectFields" :id="'bze-r-' + f" :key="f" :label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_' + f)">
					<v-text-field :id="'bze-r-' + f" :key="f + chosenIndex + bump" :value="chosen[f]" dense outlined hide-details suffix="mm" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.zones_layout_f_' + f)" @change="typed({ type: 'field', name: f, value: $event })" />
				</wf-field>
			</div>

			<div v-if="edit.note" class="wf-note mt-3" :class="{ 'is-warn': !noteDone }" role="note" aria-live="polite">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">{{ noteDone ? 'mdi-check-circle-outline' : 'mdi-alert-outline' }}</v-icon>
				<span>{{ $t('plugins.WorkshopPrinting.bedZones.' + edit.note, edit.noteArgs || {}) }}</span>
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
// the one-shot tidy-up with its preview (options, list of moves, Apply), undo, add and remove a zone, the bed size and the numbers of the chosen zone, and Save / Cancel. It owns nothing: it receives the state of the edit
// session (bed-zones-edit.js) and answers `act` with an action for that file's reduce(); BedZones.vue keeps the state and does the saving.
// Every icon button has its label as tooltip and accessible name and is 44 px wide.
import { bedFromModel } from './bed-zones-layout.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import HelpGuide from './HelpGuide.vue' // vue/_shared36

const HELPED = ['bed', 'aids', 'arrange']
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
		serverErrors: { type: Array, default: () => [] },
		plan: { type: Object, default: null } // arrangePlan() of bed-zones-edit.js: what the tidy-up would do now (null when it is not open)
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
		noteDone() {
			return !!this.edit.note && this.edit.note.indexOf('zones_layout_done_') === 0
		},
		// the measures of every zone: its top left corner (mm from the left and from the top of the bed, seen from above), its size and its area
		summary() {
			return this.edit.config.zones.map((z, i) => (z.rect ? { n: i + 1, x: z.rect.x, y: z.rect.y, w: z.rect.w, h: z.rect.h, area: Math.round(z.rect.w * z.rect.h / 100) } : null)).filter(Boolean)
		},
		coveredArea() {
			return this.summary.reduce((t, r) => t + r.area, 0)
		},
		coverage() {
			const b = this.geometry ? this.geometry.bed.width * this.geometry.bed.length / 100 : 0
			return b > 0 ? Math.round(1000 * this.coveredArea / b) / 10 : 0
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
		// the plan is the uniform reduction (every zone changes size): said clearly before it is applied
		shrinking() {
			return !!this.plan && this.plan.fits && this.plan.scale !== undefined && this.plan.scale < 1
		},
		missingText() {
			const p = this.plan
			const parts = []
			if (p && p.shortfall.w > 0) parts.push(this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_miss_w', { n: p.shortfall.w }))
			if (p && p.shortfall.h > 0) parts.push(this.$t('plugins.WorkshopPrinting.bedZones.zones_layout_arrange_miss_h', { n: p.shortfall.h }))
			return parts.join(', ')
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
		moveText(m) {
			const k = m.dw || m.dh ? 'plugins.WorkshopPrinting.bedZones.zones_layout_arrange_move_size' : 'plugins.WorkshopPrinting.bedZones.zones_layout_arrange_move'
			const r = this.plan.rects[m.index]
			return this.$t(k, { n: m.index + 1, dx: m.dx, dy: m.dy, w: r.w, h: r.h })
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
/* one height for every button of the panel, so the rows line up whatever the kind (icon, outlined, toggle) */
.bze-act.v-btn, .bze-wide.v-btn, .bze-arrange .v-btn { height: 44px; min-height: 44px; }
.bze-toggle.v-btn-toggle { height: 44px; align-items: stretch; }
.bze-group { align-items: center; }
.bze-num { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
.bze-summary { max-width: 460px; }
.bze-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.bze-arrange { border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.3)); border-radius: 8px; padding: 12px; background: var(--wf-soft, transparent); }
.bze-arrange .v-btn { white-space: normal; }
.bze-toggle { flex-wrap: wrap; max-width: 100%; }
.bze-moves { padding-left: 16px; margin: 4px 0; }
.bze-errors { padding-left: 16px; }
</style>
