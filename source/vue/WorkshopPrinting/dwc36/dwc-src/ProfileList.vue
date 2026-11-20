<!-- lock-reason-in-parent: the ONE reason of this group is drawn by Profiles.vue, so the controls below are disabled without repeating it -->
<template>
	<div class="pl">
		<div class="pc-actions pl-head">
			<span class="pc-card-title">{{ tx('list_title') }}</span>
			<help-tip v-bind="help()" />
			<!-- New is the one action of the list, on top (Save, Duplicate, Delete and Use are under the profile) -->
			<v-btn small color="primary" class="pl-btn pl-new" :disabled="!canEdit" @click="$emit('new')"><v-icon small left>mdi-plus</v-icon>{{ tx('new_profile') }}</v-btn>
		</div>
		<!-- a narrow screen: a select above the editor -->
		<v-select class="pl-select mt-2" :value="selected" :items="selectItems" dense outlined hide-details :aria-label="tx('list_title')" @change="$emit('select', $event)">
			<template #item="{ item }"><span>{{ item.text }}</span><v-chip x-small outlined class="ml-2">{{ tx('kind_' + item.kind) }}</v-chip></template>
		</v-select>
		<!-- a wide screen: the list, one profile per row: name, type chip and a one line summary -->
		<div class="pl-list mt-2" role="listbox" :aria-label="tx('list_title')">
			<button v-for="r in rows" :key="r.index" type="button" role="option" class="pl-row" :class="{ 'is-on': r.index === selected }" :aria-selected="r.index === selected ? 'true' : 'false'" @click="$emit('select', r.index)">
				<span class="pl-name">{{ r.name || tx('unnamed') }}</span>
				<span class="pl-sub">
					<v-chip x-small outlined :color="r.kind === 'pellet' ? 'primary' : 'info'">{{ tx('kind_' + r.kind) }}</v-chip>
					<span class="pl-sum">{{ summary(r) }}</span>
					<v-chip v-if="r.layers" x-small outlined color="primary">{{ tx('changes_chip') }}</v-chip>
				</span>
			</button>
			<div v-if="!rows.length" class="text-caption pc-muted pa-2">{{ tx('list_empty') }}</div>
		</div>
	</div>
</template>

<script>
'use strict'

// The left column of the Profiles page: the profiles (name, type chip, one line summary) and New. On a narrow screen the list becomes a select.
// It only shows and asks: the page owns the list and does the work (profile-list.js).
import HelpTip from './HelpTip.vue' // vue/_shared36

export default {
	components: { HelpTip },
	props: {
		rows: { type: Array, default: () => [] }, // profile-list.js listRows
		selected: { type: Number, default: -1 },
		canEdit: { type: Boolean, default: false }
	},
	computed: {
		selectItems() {
			return this.rows.map(r => ({ text: r.name || this.tx('unnamed'), value: r.index, kind: r.kind }))
		}
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.profiles.' + key, params || {})
		},
		help() {
			return { title: this.tx('help_list_title'), what: this.tx('help_list_what'), why: this.tx('help_list_why'), ifMissing: this.tx('help_list_miss'), how: this.tx('help_list_how') }
		},
		summary(r) {
			const parts = []
			if (r.nozzle !== null) parts.push(this.tx('sum_nozzle', { c: r.nozzle }))
			if (r.bed !== null) parts.push(this.tx('sum_bed', { c: r.bed }))
			return parts.join(' / ')
		}
	}
}
</script>

<style scoped>
.pl-btn.v-btn { height: 44px; min-height: 44px; }
.pl-new { margin-left: auto; }
.pl-select { display: none; }
.pl-list { display: flex; flex-direction: column; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 6px; }
.pl-row { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 8px 12px; min-height: 44px; border: 0; border-bottom: 1px solid var(--wf-line, rgba(128, 128, 128, 0.25)); background: transparent; color: inherit; cursor: pointer; font: inherit; }
.pl-row:last-child { border-bottom: 0; }
.pl-row:hover { background: rgba(128, 128, 128, 0.08); }
.pl-row.is-on { background: var(--wf-soft); box-shadow: inset 3px 0 0 var(--wf-sec-now); }
.pl-name { font-weight: 500; }
.pl-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.pl-sum { font-size: 12px; opacity: 0.75; }
@container pg (max-width: 760px) {
	.pl-select { display: block; }
	.pl-list { display: none; }
}
</style>
