<template>
	<div v-if="toolsZones.length" class="pc-sub">
		<h4>
			<template v-if="!zonesOnly">{{ $t('plugins.WorkshopPrinting.pid.all_zones_automatic') }}</template>
			<pc-help :title="$t('plugins.WorkshopPrinting.pid.all_zones_automatic')">
				{{ $t('plugins.WorkshopPrinting.pid.in_a_barrel_with_several_zones') }} <b>{{ $t('plugins.WorkshopPrinting.pid.coupled') }}</b>{{ $t('plugins.WorkshopPrinting.pid.if_you_tune_a_zone_with') }}
			</pc-help>
		</h4>
		<div v-if="toolsZones.length > 1" class="mt-2">
			<v-btn-toggle v-model="toolSel" mandatory dense color="primary">
				<v-btn v-for="t in toolsZones" :key="t" small :value="t" :disabled="zActive">T{{ t }}</v-btn>
			</v-btn-toggle>
		</div>
		<v-simple-table dense class="mt-2">
			<thead>
				<tr><th>{{ $t('plugins.WorkshopPrinting.common.zone') }}</th><th>{{ $t('plugins.WorkshopPrinting.common.now') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.target_c') }}</th><th>{{ $t('plugins.WorkshopPrinting.pid.result') }}</th></tr>
			</thead>
			<tbody>
				<tr v-for="z in zonesSel" :key="z.id" :class="zCurrent === z.id ? 'zone-current' : ''">
					<td>{{ z.name }}<span class="pc-muted text-caption"> (H{{ z.id }})</span></td>
					<td>{{ z.current != null ? Math.round(z.current) + ' °C' : '-' }}</td>
					<td class="pz-target">
						<v-text-field v-model.number="objZ[z.id]" type="number" inputmode="decimal" dense outlined hide-details class="pz-field" :disabled="zActive" :error="!tempZOk(z)" suffix="°C" :placeholder="String(Math.max(0, Math.round(z.max - 50)))" :aria-label="$t('plugins.WorkshopPrinting.pid.target_c') + ': ' + z.name" />
						<div class="pz-limit text-caption" :class="{ 'wf-state err': !tempZOk(z) }">{{ $t('plugins.WorkshopPrinting.pid.limit_n', { n: z.max }) }}</div>
					</td>
					<td>
						<v-chip x-small outlined :color="chipZ(z.id).color">{{ chipZ(z.id).text }}</v-chip>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="zonesSel.some(z => !tempZOk(z))" class="wf-state err mt-1">{{ $t('plugins.WorkshopPrinting.pid.each_target_must_be_from_50') }}</div>
		<div class="pc-actions mt-3">
			<v-btn small :color="armedZ ? 'amber darken-3' : 'primary'" :outlined="!armedZ" :disabled="!canZ" @click="$emit('tune')">
				{{ armedZ ? $t('plugins.WorkshopPrinting.pid.tap_again_it_will_heat') : $t('plugins.WorkshopPrinting.pid.tune_all') }}
			</v-btn>
			<v-btn v-if="zActive" small outlined :loading="cancellingZ" @click="$emit('cancel')">
				<v-icon small left>mdi-stop</v-icon>{{ $t('plugins.WorkshopPrinting.pid.cancel') }}
			</v-btn>
		</div>
		<div v-if="!zActive && reasonNoZ" class="pc-why"><v-icon x-small aria-hidden="true">mdi-lock-outline</v-icon><span>{{ reasonNoZ }}</span></div>
		<div v-if="zActive" class="mt-3" role="status">
			<div class="wf-state info">{{ textPhase }} <span class="pc-muted">({{ minutes }} min)</span></div>
			<div class="text-caption pc-muted">{{ $t('plugins.WorkshopPrinting.pid.to_stop_cancel_turns_the_zones') }}</div>
		</div>
		<div v-if="zState && !zActive && zState.error" class="wf-note mt-2" :class="{ 'is-warn': true }" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ zState.error }}</span></div>
		<div v-for="z in zErrors" :key="'e' + z.h" class="wf-state err mt-1">H{{ z.h }}: {{ z.error }}</div>
		<template v-if="linesZ.length && !zActive">
			<h4 class="mt-3">{{ $t('plugins.WorkshopPrinting.pid.new_lines_for_sys_modefff_g') }}</h4>
			<div v-for="l in linesZ" :key="l.h" class="text-body-2"><code>{{ l.line }}</code></div>
			<div class="pc-actions mt-3">
				<v-btn small :color="armedZG ? 'amber darken-3' : 'primary'" :loading="savingZ" @click="$emit('save')">
					{{ armedZG ? $t('plugins.WorkshopPrinting.common.tap_again') : $t('plugins.WorkshopPrinting.pid.save_all_to_modefff_g') }}
				</v-btn>
			</div>
			<div class="text-caption pc-muted mt-1">
				{{ $t('plugins.WorkshopPrinting.pid.the_new_models_are_already_in') }}
			</div>
		</template>
	</div>
</template>

<script>
import PcHelp from './PcHelp.vue' // the "?" of a row, drawn folded by the section

// All the zones of a tool tuned one after the other (presentation only: props down, events up). The page keeps the state, the service calls and the save of the lines.
export default {
	components: { PcHelp },
	props: {
		zonesOnly: { type: Boolean, default: false },
		toolsZones: { type: Array, default: () => [] },
		toolZ: { type: Number, default: null },
		zonesSel: { type: Array, default: () => [] },
		objZ: { type: Object, default: () => ({}) }, // target of each zone, edited in place
		zActive: Boolean,
		zCurrent: { type: Number, default: null },
		zState: { type: Object, default: null },
		zErrors: { type: Array, default: () => [] },
		linesZ: { type: Array, default: () => [] },
		canZ: Boolean,
		reasonNoZ: { type: String, default: '' },
		textPhase: { type: String, default: '' },
		minutes: { type: Number, default: 0 },
		armedZ: Boolean,
		armedZG: Boolean,
		cancellingZ: Boolean,
		savingZ: Boolean,
		tempZOk: { type: Function, required: true },
		chipZ: { type: Function, required: true }
	},
	computed: {
		toolSel: {
			get() { return this.toolZ; },
			set(v) { this.$emit('update:toolZ', v); }
		}
	}
};
</script>

<style scoped>
.zone-current {
	background: var(--wf-soft);
	box-shadow: inset 3px 0 0 var(--wf-err);
}
</style>
