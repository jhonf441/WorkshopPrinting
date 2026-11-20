<template>
	<div class="mt-3">
		<v-btn small text color="primary" :aria-expanded="viewPins ? 'true' : 'false'" @click="viewPins = !viewPins">
			<v-icon x-small left>{{ viewPins ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>{{ viewPins ? $t('plugins.WorkshopPrinting.extruderConfig.hide_connectors') : $t('plugins.WorkshopPrinting.extruderConfig.show_free_connectors_of_each_board') }}
		</v-btn>
		<template v-if="viewPins">
			<div class="text-caption pc-muted mt-1">
				{{ $t('plugins.WorkshopPrinting.extruderConfig.green_free_orange_used_only_by') }}
			</div>
			<div v-for="b in boards" :key="b.key" class="mt-2">
				<div class="text-body-2"><b>{{ b.name }}</b> <span class="pc-muted">{{ b.where }}</span></div>
				<div v-if="!b.groups.length" class="text-caption pc-muted">{{ b.note }}</div>
				<div v-for="g in b.groups" :key="g.kind" class="pin-group mt-1">
					<span class="text-caption pc-muted pin-kind">{{ g.kind }}</span>
					<v-chip v-for="c in g.pins" :key="c.pin" x-small :outlined="!c.used" :color="c.used ? 'grey' : c.otherMode ? 'warning' : 'success'"
						:title="c.used ? $t('plugins.WorkshopPrinting.extruderConfig.used_by', { who: c.used }) : c.otherMode ? $t('plugins.WorkshopPrinting.extruderConfig.only_in_other_mode_title', { who: c.otherMode }) : (g.field ? $t('plugins.WorkshopPrinting.extruderConfig.free_tap_to_use') : $t('plugins.WorkshopPrinting.extruderConfig.free_cap'))"
						@click="!c.used && g.field && $emit('use', g.field, c.pin, c.otherMode)">{{ c.pin }}</v-chip>
				</div>
			</div>
			<div v-if="msg" class="text-caption mt-1">{{ msg }}</div>
		</template>
	</div>
</template>

<script>
// The connectors of each board (presentation only: props down, one event up). Tapping a free connector asks the page to use it.
export default {
	props: {
		boards: { type: Array, default: () => [] },
		msg: { type: String, default: '' }
	},
	data() {
		return { viewPins: false };
	}
};
</script>

<style scoped>
.pin-group {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
}
.pin-kind {
	min-width: 150px;
}
</style>
