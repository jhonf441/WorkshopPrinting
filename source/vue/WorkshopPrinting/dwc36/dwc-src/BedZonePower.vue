<template>
	<div class="bzp">
		<div class="d-flex align-center" style="gap:4px">
			<h4>{{ $t('plugins.WorkshopPrinting.bedZones.power_title') }}</h4>
			<pc-help :title="$t('plugins.WorkshopPrinting.bedZones.power_title')" :what="$t('plugins.WorkshopPrinting.bedZones.power_help_what')" :why="$t('plugins.WorkshopPrinting.bedZones.power_help_why')" :if-missing="$t('plugins.WorkshopPrinting.bedZones.power_help_miss')" :how="$t('plugins.WorkshopPrinting.bedZones.power_help_how')" />
		</div>
		<p class="text-caption mt-1 mb-2">{{ $t('plugins.WorkshopPrinting.bedZones.power_intro') }}</p>

		<div class="pc-field-row">
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
			<div class="bzp-scroll mt-3" role="region" tabindex="0" :aria-label="$t('plugins.WorkshopPrinting.bedZones.power_table_label')">
			<v-simple-table dense class="bzp-table">
				<thead>
					<tr>
						<th>{{ $t('plugins.WorkshopPrinting.bedZones.col_zone') }}</th>
						<th class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_mass_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_mass') }}</th>
						<th class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_energy_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_energy') }}</th>
						<th class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_hold_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_hold') }}</th>
						<th class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_wanted_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_wanted') }}</th>
						<th v-if="hasPower" class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_time_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_time') }}</th>
						<th v-if="hasPower" class="text-right" :title="$t('plugins.WorkshopPrinting.bedZones.power_col_margin_title')">{{ $t('plugins.WorkshopPrinting.bedZones.power_col_margin') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="z in result.zones" :key="z.n">
						<td class="bzp-zone">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: z.n }) }} <span class="pc-muted text-caption">{{ z.area_cm2 }} cm2</span></td>
						<td class="text-right bzp-num">{{ z.mass }} kg</td>
						<td class="text-right bzp-num">{{ z.energy_wh }} Wh</td>
						<td class="text-right bzp-num">{{ z.hold }} W</td>
						<td class="text-right bzp-num">{{ z.wanted }} W <span class="pc-muted">({{ z.density_wcm2 }} W/cm2)</span></td>
						<td v-if="hasPower" class="text-right bzp-num">{{ z.minutes === null ? '-' : z.minutes + ' min' }}</td>
						<td v-if="hasPower" class="text-right bzp-num"><span :class="{ 'wf-state err': z.margin < 0 }">{{ z.margin }} W</span></td>
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
			</div>
			<!-- under 640 px of content the table is one card per zone (label: value), no sideways scroll -->
			<ul class="bzp-cards mt-3" :aria-label="$t('plugins.WorkshopPrinting.bedZones.power_table_label')">
				<li v-for="z in result.zones" :key="'c' + z.n" class="bzp-card">
					<div class="bzp-card-head">{{ $t('plugins.WorkshopPrinting.bedZones.zone_n', { n: z.n }) }} <span class="pc-muted text-caption">{{ z.area_cm2 }} cm2</span></div>
					<dl class="bzp-card-dl">
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_mass') }}</dt><dd class="bzp-num">{{ z.mass }} kg</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_energy') }}</dt><dd class="bzp-num">{{ z.energy_wh }} Wh</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_hold') }}</dt><dd class="bzp-num">{{ z.hold }} W</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_wanted') }}</dt><dd class="bzp-num">{{ z.wanted }} W <span class="pc-muted">({{ z.density_wcm2 }} W/cm2)</span></dd></div>
						<div v-if="hasPower"><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_time') }}</dt><dd class="bzp-num">{{ z.minutes === null ? '-' : z.minutes + ' min' }}</dd></div>
						<div v-if="hasPower"><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_margin') }}</dt><dd class="bzp-num"><span :class="{ 'wf-state err': z.margin < 0 }">{{ z.margin }} W</span></dd></div>
					</dl>
				</li>
				<li class="bzp-card font-weight-medium">
					<div class="bzp-card-head">{{ $t('plugins.WorkshopPrinting.bedZones.power_total') }}</div>
					<dl class="bzp-card-dl">
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_mass') }}</dt><dd class="bzp-num">{{ result.total.mass }} kg</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_energy') }}</dt><dd class="bzp-num">{{ result.total.energy_wh }} Wh</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_hold') }}</dt><dd class="bzp-num">{{ result.total.hold }} W</dd></div>
						<div><dt>{{ $t('plugins.WorkshopPrinting.bedZones.power_col_wanted') }}</dt><dd class="bzp-num">{{ result.total.wanted }} W</dd></div>
					</dl>
				</li>
			</ul>
			<div class="text-caption mt-2" role="note">{{ $t('plugins.WorkshopPrinting.bedZones.power_cols_note') }}</div>
			<div v-if="result.assumed.length" class="wf-note mt-3" role="note">
				<v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon>
				<span>{{ $t('plugins.WorkshopPrinting.bedZones.power_assumed', { list: assumedText }) }}</span>
			</div>
			<div v-if="!hasPower" class="text-caption mt-2">{{ $t('plugins.WorkshopPrinting.bedZones.power_no_heater') }}</div>
			<div class="text-caption mt-1 pc-muted">{{ $t('plugins.WorkshopPrinting.bedZones.power_disclaimer') }}</div>
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
import PcHelp from './PcHelp.vue' // the "?" of a row, drawn folded by the section

const NUMBERS = [
	{ key: 'ambient', unit: '°C' },
	{ key: 'target', unit: '°C' },
	{ key: 'thickness', unit: 'mm' },
	{ key: 'power', unit: 'W' },
	{ key: 'minutes', unit: 'min' }
]
const CUSTOMS = [{ key: 'density', unit: 'kg/m3' }, { key: 'cp', unit: 'J/(kg K)' }]

export default {
	components: { WfField, PcHelp },
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
.bzp-num { font-family: var(--tp-font-mono, monospace); font-size: 12px; white-space: nowrap; }
.bzp-scroll { max-width: 100%; overflow-x: auto; background: linear-gradient(to right, var(--wf-surface, transparent), var(--wf-surface, transparent)) left / 24px 100% no-repeat local, linear-gradient(to right, var(--wf-surface, transparent), var(--wf-surface, transparent)) right / 24px 100% no-repeat local, linear-gradient(to right, var(--wf-line), transparent) left / 14px 100% no-repeat scroll, linear-gradient(to left, var(--wf-line), transparent) right / 14px 100% no-repeat scroll; }
.bzp-cards { display: none; list-style: none; margin: 0; padding: 0; gap: 8px; }
.bzp-card { padding: 8px 10px; border: 1px solid var(--wf-line); border-radius: 8px; min-width: 0; }
.bzp-card-head { font-weight: 600; white-space: nowrap; }
.bzp-card-dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 4px 12px; margin: 4px 0 0; }
.bzp-card-dl dt { font-size: 12px; opacity: 0.75; }
.bzp-card-dl dd { margin: 0; }
@container pg (max-width: 640px) { .bzp-scroll { display: none; } .bzp-cards { display: grid; } }
.bzp-scroll:focus-visible { outline: 2px solid var(--wf-accent); outline-offset: 1px; }
.bzp-table th, .bzp-zone { white-space: nowrap; }
</style>
