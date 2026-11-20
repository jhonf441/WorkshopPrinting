<template>
	<span class="pc-more" :class="{ 'is-clamped': clamped, 'is-lines': lines > 1 }" :style="{ '--pc-more-lines': lines }">
		<span class="pc-more-text" :class="textClass">{{ text }}</span>
		<v-btn v-if="long" small text class="pc-more-btn" :aria-expanded="open ? 'true' : 'false'" @click="open = !open">{{ open ? $t('plugins.WorkshopPrinting.printing.see_less') : $t('plugins.WorkshopPrinting.printing.see_more') }}</v-btn>
	</span>
</template>

<script>
// A message that can be long (the reading of a sensor, the result of a test, the reason a button is off): ONE line with an ellipsis and a See more button that opens the whole
// sentence. It only clamps when the sentence is long (the button is there then); a short one is drawn whole. Presentational: nothing is hidden for good, the text is always in the page.
const LONG = 60;

export default {
	props: {
		text: { type: String, default: '' },
		textClass: { type: [String, Object, Array], default: '' },
		lines: { type: Number, default: 1 }, // how many lines it shows before See more
		limit: { type: Number, default: LONG } // longer than this (characters) it clamps
	},
	data() {
		return { open: false };
	},
	computed: {
		long() {
			return String(this.text || '').length > this.limit;
		},
		clamped() {
			return this.long && !this.open;
		}
	}
};
</script>

<style scoped>
.pc-more { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0 6px; min-width: 0; max-width: 100%; }
.pc-more.is-clamped { flex-wrap: nowrap; }
.pc-more-text { min-width: 0; overflow-wrap: anywhere; }
.pc-more.is-clamped .pc-more-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-more.is-lines.is-clamped { display: flex; flex-direction: column; align-items: flex-start; }
.pc-more.is-lines.is-clamped .pc-more-text { display: -webkit-box; -webkit-line-clamp: var(--pc-more-lines); -webkit-box-orient: vertical; white-space: normal; overflow: hidden; }
.pc-more-btn { flex: none; }
</style>
