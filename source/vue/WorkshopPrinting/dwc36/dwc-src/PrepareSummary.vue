<template>
	<dl class="pj-strip" :aria-label="tx('strip_label')">
		<div v-for="it in items" :key="it.id" class="pj-strip-item">
			<dt>{{ tx(it.label) }}</dt>
			<dd :title="it.text || undefined">{{ it.text || tx(it.value) }}</dd>
		</div>
	</dl>
</template>

<script>
// The strip of four data at the top of Prepare job (file, profile, changes by layer, your role): what was chosen is always in sight, and the role is said before the first action.
// It only draws what summaryItems (prepare-summary.js) gives it.
import { prepareTextMixin } from './prepare-text-mixin.js'

export default {
	mixins: [prepareTextMixin],
	props: { items: { type: Array, default: () => [] } }
};
</script>

<style scoped>
.pj-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0 0 12px; }
.pj-strip-item { min-width: 0; padding: 8px 10px; border: 1px solid var(--wf-line); border-radius: 8px; }
.pj-strip dt { font-size: 12px; opacity: 0.7; }
.pj-strip dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
@container pg (max-width: 760px) { .pj-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
