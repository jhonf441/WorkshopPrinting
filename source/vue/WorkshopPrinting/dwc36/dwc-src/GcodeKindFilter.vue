<template>
	<div class="gl-kf" role="group" :aria-label="tx('kinds.filter')">
		<button v-for="c in chips" :key="c.id" type="button" class="gl-kf-chip" :class="{ 'is-on': c.on, 'is-none': c.count === 0, 'is-small': small }" :aria-pressed="c.on ? 'true' : 'false'" @mousedown.prevent @click="$emit('input', toggle(c.id))">
			{{ c.id === 'all' ? tx('kinds.all') : tx('kinds.' + short(c.id)) }}<span v-if="c.count !== null" class="gl-kf-n">{{ c.count }}</span>
		</button>
		<help-tip v-if="help" v-bind="helpKind('filter')" />
	</div>
</template>

<script>
'use strict'

// The kind filter chips (All, 3D, Laser, CNC, Test) with the files of each kind (`counts` of gcodelib.list). `value` = the chosen kinds ([] = all); multi-select.
// `small` = the compact chips inside the dropdown of the picker. Emits `input` with the new list.
import HelpTip from './HelpTip.vue' // vue/_shared36
import { libText } from './gcode-lib-text.js'
import { filterChips, toggleKind, kindMeta } from './gcode-lib-kinds.js'

export default {
	mixins: [libText],
	components: { HelpTip },
	props: {
		value: { type: Array, default: () => [] },
		counts: { type: Object, default: null },
		small: { type: Boolean, default: false },
		help: { type: Boolean, default: true }
	},
	computed: {
		chips() {
			return filterChips(this.value, this.counts)
		}
	},
	methods: {
		toggle(id) {
			return toggleKind(this.value, id)
		},
		short(id) {
			return kindMeta(id).short
		}
	}
}
</script>

<style scoped>
.gl-kf { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 4px 6px 0; }
.gl-kf-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 22px; border: 1px solid rgba(128, 128, 128, 0.4); background: transparent; color: inherit; font-size: 13px; cursor: pointer; }
.gl-kf-chip.is-small { min-height: 32px; padding: 0 10px; font-size: 12px; }
.gl-kf-chip.is-on { background: rgba(25, 118, 210, 0.2); border-color: rgba(25, 118, 210, 0.7); }
.gl-kf-chip.is-none:not(.is-on) { opacity: 0.5; }
.gl-kf-n { font-variant-numeric: tabular-nums; opacity: 0.7; font-size: 11px; }
</style>
