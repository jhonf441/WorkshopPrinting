<template>
	<div v-if="bare"><slot /></div>
	<section v-else class="pc-section">
		<div v-if="title" class="wf-section-head">
			<v-icon class="pc-ico" small>{{ icon }}</v-icon>
			<h3>{{ title }}</h3>
			<p v-if="lead" class="wf-lead">{{ lead }}</p>
		</div>
		<slot />
	</section>
</template>

<script>
// A section of the 3D printing page: the head of the section (gray icon, title, lead; family .wf-section-head) and what the section draws in the slot.
// The card around it is the one of the family (.st-body) and its top line takes the color of the section from Print.vue.

export default {
	props: {
		icon: { type: String, default: 'mdi-circle' },
		title: { type: String, default: '' },
		lead: { type: String, default: '' },
		bare: { type: Boolean, default: false } // only the slot (a section mounted inside another one)
	}
};
</script>
