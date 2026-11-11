<template>
	<div class="gl-names" role="group" :aria-label="tx('kinds.layers_label')">
		<div class="gl-names-step">
			<v-btn icon class="gl-btn" :disabled="total < 1" :aria-label="tx('kinds.layer_prev')" :title="tx('kinds.layer_prev')" @click="step(-1)"><v-icon>mdi-chevron-left</v-icon></v-btn>
			<span class="gl-names-cur" role="status">{{ currentText }}</span>
			<v-btn icon class="gl-btn" :disabled="total < 1" :aria-label="tx('kinds.layer_next')" :title="tx('kinds.layer_next')" @click="step(1)"><v-icon>mdi-chevron-right</v-icon></v-btn>
			<help-tip v-bind="helpKind('layers')" />
		</div>
		<div class="gl-names-list">
			<button type="button" class="gl-name-chip" :class="{ 'is-on': picked === null }" :aria-pressed="picked === null ? 'true' : 'false'" @click="pick(null)">{{ tx('kinds.layers_all') }}</button>
			<button v-for="l in list" :key="l.index" type="button" class="gl-name-chip" :class="{ 'is-on': picked === l.index }" :aria-pressed="picked === l.index ? 'true' : 'false'" @click="pick(l.index)">{{ l.name }}</button>
		</div>
	</div>
</template>

<script>
'use strict'

// The layer list of a 2D file (laser, CNC): its layers by NAME (LightBurn C00..Cxx) as chips, a stepper (previous / next, wrapping through "all"), "All".
// Replaces the vertical slider, which only suits the many thin layers of a print. Emits `change` { lo, hi } like the slider.
import HelpTip from './HelpTip.vue' // vue/_shared36
import { libText } from './gcode-lib-text.js'
import { layerNames, layerPickRange, pickedLayer, stepLayer } from './gcode-lib-kinds.js'

export default {
	mixins: [libText],
	components: { HelpTip },
	props: {
		total: { type: Number, default: 0 },
		table: { type: Array, default: () => [] },
		lo: { type: Number, default: 0 },
		hi: { type: Number, default: 0 }
	},
	computed: {
		list() {
			return layerNames(this.table, this.total)
		},
		picked() {
			return this.total > 1 && this.lo === 0 && this.hi === this.total - 1 ? null : pickedLayer(this.lo, this.hi)
		},
		currentText() {
			const p = this.picked
			return p === null || !this.list[p] ? this.tx('kinds.layers_all') : this.list[p].name
		}
	},
	methods: {
		pick(i) {
			this.$emit('change', layerPickRange(i, this.total))
		},
		step(dir) {
			this.pick(stepLayer(this.picked, this.total, dir))
		}
	}
}
</script>

<style scoped>
.gl-names { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 4px 6px; }
.gl-names-step { display: flex; align-items: center; gap: 4px; }
.gl-names-cur { min-width: 56px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
.gl-btn.v-btn { width: 44px; height: 44px; }
.gl-names-list { display: flex; flex-wrap: wrap; gap: 4px; max-height: 160px; overflow-y: auto; }
.gl-name-chip { min-height: 44px; min-width: 44px; padding: 0 10px; border-radius: 22px; border: 1px solid rgba(128, 128, 128, 0.4); background: transparent; color: inherit; font-size: 13px; cursor: pointer; }
.gl-name-chip.is-on { background: rgba(25, 118, 210, 0.2); border-color: rgba(25, 118, 210, 0.7); }
</style>
