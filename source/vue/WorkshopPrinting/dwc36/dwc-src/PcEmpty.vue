<template>
	<div class="pc-empty" :class="{ 'is-compact': compact, 'is-ok': ok }" role="status">
		<v-icon :size="compact ? 20 : 40" aria-hidden="true">{{ icon }}</v-icon>
		<h4 v-if="title && !compact">{{ title }}</h4>
		<p v-if="text">{{ text }}</p>
		<p v-if="note" class="pc-empty-note">{{ note }}</p>
		<div v-if="$slots.default" class="pc-actions"><slot /></div>
	</div>
</template>

<script>
// An empty state: a gray icon, a title, ONE sentence and one or two actions in the slot (the main one only when there is a real action to take).
// `compact` is the line version inside a step or a card (icon, sentence and a text button on one row). The texts come from the caller (es.json / en.json).

export default {
	props: {
		icon: { type: String, default: 'mdi-information-outline' },
		title: { type: String, default: '' },
		text: { type: String, default: '' },
		note: { type: String, default: '' }, // a second, quieter sentence
		compact: { type: Boolean, default: false },
		ok: { type: Boolean, default: false } // a done state (a solid green outline)
	}
};
</script>
