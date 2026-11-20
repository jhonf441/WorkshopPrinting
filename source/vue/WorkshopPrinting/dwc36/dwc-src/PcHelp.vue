<template>
	<help-tip v-if="!pcHelp" :title="title" :what="what" :why="why" :if-missing="ifMissing" :how="how" />
</template>

<script>
// The "?" of a row, as a drop-in for HelpTip (same props), for the sections of the page: inside a PcSection it draws NOTHING at the row and hands its four parts to the section, which
// shows them once, folded, at the end ("Help of this section"); outside a PcSection it is the plain HelpTip. The four parts are kept: what it is, what for, if it is missing, how.
import HelpTip from './HelpTip.vue' // vue/_shared36

export default {
	components: { HelpTip },
	inject: { pcHelp: { default: null } },
	props: {
		title: { type: String, default: '' },
		what: { type: String, default: '' },
		why: { type: String, default: '' },
		ifMissing: { type: String, default: '' },
		how: { type: String, default: '' }
	},
	created() {
		if (this.pcHelp) this.pcHelp.add(this);
	},
	beforeDestroy() {
		if (this.pcHelp) this.pcHelp.remove(this);
	}
};
</script>
