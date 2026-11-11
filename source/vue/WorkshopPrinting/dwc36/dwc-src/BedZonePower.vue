<template>
	<div class="bzp">
		<div class="d-flex align-center" style="gap:4px">
			<div class="text-subtitle-1 font-weight-medium">{{ $t('plugins.WorkshopPrinting.bedZones.power_title') }}</div>
			<help-tip :title="$t('plugins.WorkshopPrinting.bedZones.power_title')" :what="$t('plugins.WorkshopPrinting.bedZones.power_help_what')" :why="$t('plugins.WorkshopPrinting.bedZones.power_help_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.power_help_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.power_help_how')" />
		</div>
		<p class="text-caption mt-1 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.power_intro') }}</p>

		<div class="bzp-grid">
			<wf-field v-for="f in numbers" :id="'bzp-' + f.key" :key="f.key" :label="$t('plugins.WorkshopPrinting.bedZones.power_f_' + f.key)">
				<v-text-field :id="'bzp-' + f.key" :value="inputs[f.key]" dense outlined hide-details :suffix="f.unit" inputmode="decimal" :placeholder="$t('plugins.WorkshopPrinting.bedZones.power_optional')" :aria-label="$t('plugins.WorkshopPrinting.bedZones.power_f_' + f.key)" @change="set(f.key, $event)" />
			</wf-field>
			<wf-field id="bzp-material" :label="$t('plugins.WorkshopPrinting.bedZones.power_f_material')">
				<v-select id="bzp-material" :value="inputs.material || null" :items="materials" dense outlined hide-details clearable :placeholder="$t('plugins.WorkshopPrinting.bedZones.power_optional')" :aria-label="$t('plugins.WorkshopPrinting.bedZones.power_f_material')" @change="set('material', $event || '')" />
			</wf-field>
			<template v-if="inputs.material === 'custom'">
				<wf-field v-for="f in customs" :id="'bzp-' + f.key" :key="f.key" :label="$t('plugins.WorkshopPrinting.bedZones.power_f_' + f.key)">
					<v-text-field :id="'bzp-' + f.key" :value="inputs[f.key]" dense outlined hide-details :suffix="f.unit" inputmode="decimal" :aria-label="$t('plugins.WorkshopPrinting.bedZones.power_f_' + f.key)" @change="set(f.key, $event)" />
				</wf-field>
			</template>
		</div>
		<v-switch :input-value="!!inputs.cover" dense hide-details class="mt-2 pt-0" :label="$t('plugins.WorkshopPrinting.bedZones.power_f_cover')" @change="set('cover', !!$event)" />

		<div v-for="p in result.problems" :key="p" class="wf-note is-warn mt-3" role="note">
			<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon>
			<span>{{ $t('plugins.WorkshopPrinting.bedZones.' + p) }}</span>
		</div>

		<template v-if="result.zones.length">
			<v-simple-table dense class="bzp-table mt-3">
				<thead>
					<tr>
						<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_zone') }}</th>
						<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_mass') }}</th>
						<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_energy') }}</th>
						<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_hold') }}</th>
						<th class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_wanted') }}</th>
						<th v-if="hasPower" class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_time') }}</th>
						<th v-if="hasPower" class="text-right">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_margin') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="z in result.zones" :key="z.n">
						<td>{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: z.n }) }} <span class="grey--text text-caption">{{ z.area_cm2 }} cm2</span></td>
						<td class="text-right bzp-num">{{ z.mass }} kg</td>
						<td class="text-right bzp-num">{{ z.energy_wh }} Wh</td>
						<td class="text-right bzp-num">{{ z.hold }} W</td>
						<td class="text-right bzp-num">{{ z.wanted }} W <span class="grey--text">({{ z.density_wcm2 }} W/cm2)</span></td>
						<td v-if="hasPower" class="text-right bzp-num">{{ z.minutes === null ? '-' : z.minutes + ' min' }}</td>
						<td v-if="hasPower" class="text-right bzp-num" :class="{ 'error--text': z.margin < 0 }">{{ z.margin }} W</td>
					</tr>
					<tr class="font-weight-medium">
						<td>{{ $t('plugins.WorkshopPrinting.bedZones.power_total') }}</td>
						<td class="text-right bzp-num">{{ result.total.mass }} kg</td>
						<td class="text-right bzp-num">{{ result.total.energy_wh }} Wh</td>
						<td class="text-right bzp-num">{{ result.total.hold }} W</td>
						<td class="text-right bzp-num">{{ result.total.wanted }} W</td>
						<td v-if="hasPower" />
						<td v-if="hasPower" />
					</tr>
				</tbody>
			</v-simple-table>
			<div v-if="result.assumed.length" class="wf-note mt-3" role="note">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
				<span>{{ $t('plugins.WorkshopPrinting.bedZones.power_assumed', { list: assumedText }) }}</span>
			</div>
			<div v-if="!hasPower" class="text-caption mt-2">{{ $t('plugins.WorkshopPrinting.bedZones.power_no_heater') }}</div>
			<div class="text-caption mt-1 grey--text">{{ $t('plugins.WorkshopPrinting.bedZones.power_disclaimer') }}</div>
		</template>
	</div>
</template>

<script>
'use strict'

// The power estimate of the bed zones: the geometry of the map (size of every zone) plus the thickness and material of the plate, all of them optional,
// give the energy to heat each zone, the power to keep it hot and the power to heat it in a time. The numbers are in bed-zones-power.js; this card only
// holds the typed inputs (the page keeps them, so the insulation test shares the room temperature) and writes the table. An estimate, not a limit.
import { estimate, MATERIALS, DEFAULTS } from './bed-zones-power.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36

const NUMBERS = [
	{ key: 'ambient', unit: '°C' },
	{ key: 'target', unit: '°C' },
	{ key: 'thickness', unit: 'mm' },
	{ key: 'power', unit: 'W' },
	{ key: 'minutes', unit: 'min' }
]
const CUSTOMS = [{ key: 'density', unit: 'kg/m3' }, { key: 'cp', unit: 'J/(kg K)' }]

export default {
	components: { WfField, HelpTip },
	props: {
		rows: { type: Array, required: true }, // zoneRows(): the rect of every zone
		inputs: { type: Object, required: true } // the typed inputs ('' = not given), kept by the page
	},
	data() {
		return { numbers: NUMBERS, customs: CUSTOMS }
	},
	computed: {
		materials() {
			return Object.keys(MATERIALS).map(k => ({ value: k, text: this.$t('plugins.WorkshopPrinting.bedZones.power_material_' + k) }))
		},
		result() {
			return estimate(this.rows.map(r => r.rect || null), this.inputs)
		},
		hasPower() {
			return this.result.zones.length > 0 && this.result.zones[0].margin !== undefined
		},
		assumedText() {
			const unit = { ambient: DEFAULTS.ambient + ' °C', target: DEFAULTS.target + ' °C', thickness: DEFAULTS.thickness + ' mm', minutes: DEFAULTS.minutes + ' min', material: this.$t('plugins.WorkshopPrinting.bedZones.power_material_' + DEFAULTS.material) }
			return this.result.assumed.map(k => this.$t('plugins.WorkshopPrinting.bedZones.power_f_' + k) + ' = ' + unit[k]).join(', ')
		}
	},
	methods: {
		set(key, value) {
			this.$emit('change', { key, value })
		}
	}
}
</script>

<style scoped>
.bzp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.bzp-num { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
</style>
