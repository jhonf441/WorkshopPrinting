<template>
	<div v-if="bare"><slot /></div>
	<section v-else class="pc-section">
		<!-- the head of the card (family redesign 2026-11-23, CardHead of vue/_shared36): icon 20 in the color of the section + title 16/600 on a 4 % tint and, on the right, the
		     state, the age of the data and the one action of the card. No sentence under the title: what the section is for goes into its one help at the foot -->
		<card-head v-if="title" :icon="icon" :title="title" class="pc-head">
			<span v-if="$slots.right" class="pc-head-right"><slot name="right" /></span>
			<wf-role-tag v-if="role" :role="role" />
		</card-head>
		<slot />
		<!-- ONE help per section, at its foot (family's fold "What it is and how to use it", HelpFold): the sentence that used to sit under the title (lead), the section's own
		     guide (slot "guide") and the "?" of its rows (PcHelp) -->
		<help-fold v-if="lead || helps.length || $slots.guide" class="pc-section-help" :what="lead" :items="helps"><slot name="guide" /></help-fold>
	</section>
</template>

<script>
// A section of the 3D printing page: the head of the card (icon, title; family CardHead / .wf-card-head) and what the section draws in the slot.
// The slot `right` holds the state (a dot + the word), the age of the data and the one action of the card, pushed to the right of the head. `role` = a small outlined chip of who
// the section is for. The card around it is the one of the family (.st-body) and its top line takes the color of the section from Print.vue.
// It draws ONE help at its foot, closed: the `lead` (what the section is for: it no longer sits under the title), the slot `guide` (the steps of the section) and the four parts of
// every "?" of its rows (PcHelp), so a section never shows two helps or a loose question mark.
import CardHead from './CardHead.vue' // vue/_shared36: the head of a card of the family
import HelpFold from './HelpFold.vue' // vue/_shared36
import WfRoleTag from './WfRoleTag.vue' // vue/_shared36: the role the section asks for (only with the access control on)

export default {
	components: { CardHead, HelpFold, WfRoleTag },
	inject: { outerHelp: { from: 'pcHelp', default: null } },
	provide() {
		// a bare section (mounted inside another one) passes the collector of the one around it
		return { pcHelp: this.bare ? this.outerHelp : { add: vm => this.helps.push(vm), remove: vm => { const i = this.helps.indexOf(vm); if (i >= 0) this.helps.splice(i, 1); } } };
	},
	props: {
		icon: { type: String, default: 'mdi-circle' },
		title: { type: String, default: '' },
		lead: { type: String, default: '' },
		role: { type: String, default: '' },
		bare: { type: Boolean, default: false }
	},
	data() {
		return { helps: [] };
	}
};
</script>
