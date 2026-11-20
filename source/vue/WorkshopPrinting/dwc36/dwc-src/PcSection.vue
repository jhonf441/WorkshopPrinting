<template>
	<div v-if="bare"><slot /></div>
	<section v-else class="pc-section">
		<div v-if="title" class="wf-section-head">
			<v-icon class="pc-ico" small>{{ icon }}</v-icon>
			<h3>{{ title }}</h3>
			<p v-if="lead" class="wf-lead">{{ lead }}</p>
			<slot name="help" />
			<div v-if="$slots.right || role" class="pc-head-right"><slot name="right" /><v-chip v-if="role" small outlined class="pc-role-tag">{{ $t('plugins.WorkshopPrinting.prepare.role_' + role) }}</v-chip></div>
		</div>
		<slot />
		<!-- the "?" of the rows of this section (PcHelp) are drawn here, once, folded -->
		<details v-if="helps.length" class="pc-fold mt-3">
			<summary class="pc-fold-sum">{{ $t('plugins.WorkshopPrinting.common.section_help') }}</summary>
			<div v-for="(h, i) in helps" :key="i" class="pc-sub mt-2">
				<h4>{{ h.title }}</h4>
				<dl class="pc-help4"><template v-for="r in rows(h)"><dt :key="'t' + r.k">{{ r.label }}</dt><dd :key="'d' + r.k">{{ r.text }}</dd></template></dl>
			</div>
		</details>
	</section>
</template>

<script>
// A section of the 3D printing page: the head of the section (gray icon, title, lead; family .wf-section-head) and what the section draws in the slot.
// The slot `right` holds the state (a small outlined chip) or the role of the section, pushed to the right of the head. `role` = a small outlined chip of who the section is for.
// The card around it is the one of the family (.st-body) and its top line takes the color of the section from Print.vue.
// It also collects the "?" of its rows (PcHelp) and draws their four parts once, folded, under the section: no loose question marks.
import { ts } from './shared-t.js' // vue/_shared36

export default {
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
	},
	methods: {
		rows(h) {
			return [['what', 'what', h.what], ['why', 'why', h.why], ['miss', 'missing', h.ifMissing], ['how', 'how', h.how]].filter(r => r[2]).map(r => ({ k: r[0], label: ts('help_tip_' + r[1]), text: r[2] }));
		}
	}
};
</script>
