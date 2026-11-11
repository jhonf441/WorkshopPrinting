<template>
	<span v-if="kind" class="gl-kind" :aria-label="tx('kinds.' + meta.label)">
		<v-chip x-small outlined :color="meta.color" class="gl-kind-chip"><v-icon x-small left>{{ meta.icon }}</v-icon>{{ tx('kinds.' + meta.label) }}</v-chip>
		<v-chip v-for="t in chips.shown" :key="t" x-small label class="gl-tag">{{ tagText(t) }}</v-chip>
		<v-chip v-if="chips.more" x-small label class="gl-tag" :title="chips.all.join(', ')">+{{ chips.more }}</v-chip>
	</span>
</template>

<script>
'use strict'

// The badge of the kind of a file (icon, short label, colour: 3D print, Laser, CNC, Test, Unknown) with its tag chips collapsed to `max` and a "+N".
// Nothing is drawn while the kind is unknown because the file is not read yet (kind null).
import { libText } from './gcode-lib-text.js'
import { kindMeta, tagChips, tagKey } from './gcode-lib-kinds.js'

export default {
	mixins: [libText],
	props: {
		kind: { type: String, default: null },
		tags: { type: Array, default: () => [] },
		max: { type: Number, default: 0 } // tag chips shown before the "+N" (0 = none: the compact row)
	},
	computed: {
		meta() {
			return kindMeta(this.kind)
		},
		chips() {
			return tagChips(this.tags, this.max)
		}
	},
	methods: {
		tagText(t) {
			const k = tagKey(t)
			return k ? this.tx('kinds.' + k) : t
		}
	}
}
</script>

<style scoped>
.gl-kind { display: inline-flex; align-items: center; flex-wrap: nowrap; gap: 4px; vertical-align: middle; }
.gl-tag { opacity: 0.8; }
</style>
