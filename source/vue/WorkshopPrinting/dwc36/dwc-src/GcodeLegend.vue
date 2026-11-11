<template>
	<div class="gl-legend" role="group" :aria-label="tx('legend')">
		<button v-for="e in entries" :key="e.type" type="button" class="gl-leg" :class="{ 'is-off': !e.on }" :aria-pressed="e.on ? 'true' : 'false'" @click="$emit('toggle', e.type)">
			<i class="gl-dot" :style="{ background: e.color }" />{{ e.key ? tx(e.key) : e.type }}
		</button>
		<button v-if="withTravel" type="button" class="gl-leg" :class="{ 'is-off': !travel }" :aria-pressed="travel ? 'true' : 'false'" @click="$emit('travel', !travel)">
			<i class="gl-dot gl-dot-travel" />{{ tx('travel') }}
		</button>
		<help-tip v-bind="help('legend')" />
	</div>
</template>

<script>
'use strict'

// The legend of the feature types: every entry is a toggle (show / hide that type), the last one toggles the travel moves.
import HelpTip from './HelpTip.vue' // vue/_shared36
import { libText } from './gcode-lib-text.js'
import { legendEntries } from './gcode-lib-layers.js'

export default {
	mixins: [libText],
	components: { HelpTip },
	props: {
		types: { type: Array, default: () => [] },
		hidden: { type: Object, default: () => ({}) },
		travel: { type: Boolean, default: false },
		withTravel: { type: Boolean, default: true } // false for 2D files: their travel moves are a type of their own
	},
	computed: {
		entries() {
			return legendEntries(this.types, this.hidden)
		}
	}
}
</script>

<style scoped>
.gl-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.gl-leg { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 10px; border-radius: 22px; border: 1px solid rgba(128, 128, 128, 0.4); background: transparent; color: inherit; font-size: 12px; cursor: pointer; }
.gl-leg.is-off { opacity: 0.45; text-decoration: line-through; }
.gl-dot { width: 12px; height: 12px; border-radius: 3px; flex: none; }
.gl-dot-travel { background: #8a8a8a; height: 2px; }
</style>
