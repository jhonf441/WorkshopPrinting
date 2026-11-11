<template>
	<section class="rt" :aria-labelledby="'rt-title-' + track">
		<div class="d-flex align-center" style="gap:6px">
			<v-icon small>{{ track === 'bed' ? 'mdi-radiator' : 'mdi-printer-3d-nozzle-outline' }}</v-icon>
			<span :id="'rt-title-' + track" class="text-subtitle-2">{{ tx('layer_recipes_track_' + track) }}</span>
		</div>

		<!-- the zones this track drives: the heaters of the tool (extruder) or the zones of the bed that the person picks -->
		<div v-if="track === 'bed'" class="mt-2">
			<div class="text-caption">{{ tx('layer_recipes_bed_zones') }}</div>
			<div class="d-flex flex-wrap" style="gap:4px 16px">
				<v-checkbox v-for="z in zones" :key="z.heater" :input-value="draft.zones.indexOf(z.heater) >= 0" dense hide-details class="mt-0 pt-0" :disabled="!canEdit" :label="tx('layer_recipes_zone_label', { n: z.n, h: z.heater })" @change="toggleZone(z.heater, !!$event)" />
			</div>
			<div v-if="!zones.length" class="text-caption grey--text">{{ tx('layer_recipes_no_bed_zones') }}</div>
			<div v-if="fieldError('zones')" class="wf-field-msg is-error">{{ fieldError('zones') }}</div>
		</div>
		<div v-else class="text-caption mt-2">{{ tx('layer_recipes_extruder_zones', { tool: draft.tool, list: draft.heaters.join(', ') }) }}</div>

		<!-- the ready-made shapes: pick one, set its few numbers, apply: the points below are filled in and stay editable -->
		<div class="d-flex align-end flex-wrap mt-3" style="gap:12px">
			<wf-field :id="'rt-shape-' + track" :label="tx('layer_recipes_shape')">
				<v-select :id="'rt-shape-' + track" v-model="shape" :items="shapeItems" dense outlined hide-details style="min-width:220px" :disabled="!canEdit" :aria-label="tx('layer_recipes_shape')" />
			</wf-field>
			<wf-field v-for="f in fields" :id="'rt-sf-' + track + '-' + f.key" :key="f.key" :label="tx('layer_recipes_sf_' + f.key)">
				<v-text-field :id="'rt-sf-' + track + '-' + f.key" v-model="opts[f.key]" dense outlined hide-details :suffix="unit(f)" inputmode="decimal" style="max-width:110px" :disabled="!canEdit" :aria-label="tx('layer_recipes_sf_' + f.key)" />
			</wf-field>
			<v-btn small outlined class="rt-btn" :disabled="!canEdit || !shapeReady" @click="$emit('shape', { shape, opts: numericOpts })"><v-icon small left>mdi-chart-line</v-icon>{{ tx('layer_recipes_shape_apply') }}</v-btn>
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('layer_recipes_shape_' + shape + '_help') }}</div>

		<div class="d-flex align-end flex-wrap mt-3" style="gap:12px">
			<wf-field :id="'rt-mode-' + track" :label="tx('pellet_layers_f_mode')">
				<v-select :id="'rt-mode-' + track" v-model="draft.mode" :items="modeItems" dense outlined hide-details style="max-width:170px" :disabled="!canEdit" :aria-label="tx('pellet_layers_f_mode')" />
			</wf-field>
			<wf-field v-for="f in limits" :id="'rt-' + track + '-' + f" :key="f" :label="tx('pellet_layers_f_' + f)" :message="fieldError(f)" level="error">
				<template v-if="f === 'max_temp'" #help><help-tip v-bind="capHelp()" /></template>
				<v-text-field :id="'rt-' + track + '-' + f" v-model="draft[f]" dense outlined hide-details suffix="C" inputmode="decimal" style="max-width:110px" :disabled="!canEdit" :aria-label="tx('pellet_layers_f_' + f)" />
			</wf-field>
		</div>

		<div class="rt-scroll mt-3">
			<table class="rt-table">
				<thead>
					<tr>
						<th scope="col">{{ draft.axis === 'z' ? tx('pellet_layers_col_z') : tx('pellet_layers_col_layer') }}</th>
						<th v-for="(h, k) in heaterList" :key="'h' + h" scope="col">{{ tx('pellet_layers_col_zone', { n: k + 1, h: h }) }}<span class="rt-sub">{{ tx('layer_recipes_col_delta') }}</span></th>
						<th scope="col"><span class="sr-only">{{ tx('pellet_layers_col_remove') }}</span></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(pt, i) in draft.points" :key="i">
						<td><v-text-field v-model="pt.at" dense outlined hide-details inputmode="decimal" class="rt-cell" :error="!!pointError(i, 'at')" :disabled="!canEdit" :aria-label="tx('pellet_layers_point_at_aria', { n: i + 1 })" /></td>
						<td v-for="(h, k) in heaterList" :key="'t' + h"><v-text-field v-model="pt.temps[k]" dense outlined hide-details inputmode="decimal" class="rt-cell" suffix="C" placeholder="+0" :error="!!pointError(i, 'temps')" :disabled="!canEdit" :aria-label="tx('pellet_layers_point_temp_aria', { n: i + 1, zone: k + 1 })" /></td>
						<td><v-btn icon small :disabled="!canEdit || draft.points.length < 2" :aria-label="tx('pellet_layers_remove_point', { n: i + 1 })" @click="$emit('remove-point', i)"><v-icon small>mdi-close</v-icon></v-btn></td>
					</tr>
				</tbody>
			</table>
		</div>
		<v-btn small outlined class="rt-btn mt-2" :disabled="!canEdit || draft.points.length >= maxPoints" @click="$emit('add-point')"><v-icon small left>mdi-plus</v-icon>{{ tx('pellet_layers_add_point') }}</v-btn>
		<div v-for="e in pointErrors" :key="e.field" class="wf-note is-warn mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ errorText(e) }}</span></div>

		<div v-if="chart" class="mt-3">
			<svg :viewBox="'0 0 ' + G.w + ' ' + G.h" class="rt-svg" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="tx('layer_recipes_chart_label')">
				<g v-for="v in chart.ticksY" :key="'y' + v">
					<line :x1="G.l" :x2="G.w - G.r" :y1="chart.y(v)" :y2="chart.y(v)" class="rt-grid" />
					<text :x="G.l - 5" :y="chart.y(v) + 4" text-anchor="end" class="rt-axis">{{ signed(v) }}</text>
				</g>
				<line :x1="G.l" :x2="G.w - G.r" :y1="chart.zeroY" :y2="chart.zeroY" class="rt-zero" />
				<text :x="G.w - G.r" :y="chart.zeroY - 4" text-anchor="end" class="rt-axis rt-zero-label">{{ tx('layer_recipes_chart_zero') }}</text>
				<g v-for="v in chart.ticksX" :key="'x' + v">
					<line :x1="chart.x(v)" :x2="chart.x(v)" :y1="G.t" :y2="G.h - G.b" class="rt-grid" />
					<text :x="chart.x(v)" :y="G.h - 8" text-anchor="middle" class="rt-axis">{{ v }}</text>
				</g>
				<g v-for="ln in chart.lines" :key="'l' + ln.heater">
					<path :d="ln.d" fill="none" :stroke="ln.color" stroke-width="2.5" stroke-linejoin="round" />
					<circle v-for="(d, i) in ln.dots" :key="i" :cx="d.cx" :cy="d.cy" r="3.5" :fill="ln.color" />
				</g>
			</svg>
			<div class="text-caption mt-1">{{ tx('layer_recipes_chart_legend') }}</div>
			<div class="text-body-2 rt-legend">
				<span v-for="ln in chart.lines" :key="'k' + ln.heater"><i class="rt-key" :style="{ borderTopColor: ln.color }" />{{ tx('pellet_layers_col_zone', { n: ln.zone + 1, h: ln.heater }) }}</span>
			</div>
		</div>
	</section>
</template>

<script>
'use strict'

// One track of a recipe (extruder or bed): the zones it drives, a ready-made shape picked from a list, the limits and the points as numbers, and the curve.
// It edits the draft it is given in place (the parent LayerRecipes.vue owns it, validates it and saves it) and only asks the parent, through events, for what
// changes the structure: `shape` {shape, opts} (fill the points from a shape), `add-point`, `remove-point` (index).
import { SHAPE_IDS, SHAPES, shapeDefaults, parseNumber, deltaChartModel, MAX_POINTS, KEY_PREFIX } from './layer-recipes.js'
import { profileOf } from './pellet-layers.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36

export default {
	components: { WfField, HelpTip },
	props: {
		track: { type: String, required: true }, // 'extruder' | 'bed'
		draft: { type: Object, required: true }, // the draft of this track (recipeDraft of layer-recipes.js)
		zones: { type: Array, default: () => [] }, // bed: [{n, heater}] the zones that can be picked
		errors: { type: Array, default: () => [] }, // the errors of THIS track, field relative to the track ('max_temp', 'points[0].at', ...)
		canEdit: { type: Boolean, default: true }
	},
	data() {
		return { G: { w: 600, h: 220, l: 42, r: 12, t: 10, b: 26 }, maxPoints: MAX_POINTS, limits: ['max_temp', 'max_step', 'max_spread'], shape: 'flat', opts: shapeDefaults('flat') }
	},
	computed: {
		heaterList() {
			return this.track === 'bed' ? this.draft.zones : this.draft.heaters
		},
		shapeItems() {
			return SHAPE_IDS.map(s => ({ text: this.tx('layer_recipes_shape_' + s), value: s }))
		},
		fields() {
			return SHAPES[this.shape].fields
		},
		numericOpts() {
			const o = {}
			this.fields.forEach(f => { o[f.key] = parseNumber(this.opts[f.key]) })
			return o
		},
		shapeReady() {
			return this.fields.every(f => { const v = this.numericOpts[f.key]; return v !== null && v >= f.min && v <= f.max })
		},
		modeItems() {
			return ['steps', 'ramp'].map(m => ({ text: this.tx('pellet_layers_mode_' + m), value: m }))
		},
		pointErrors() {
			return this.errors.filter(e => /^points/.test(e.field))
		},
		chart() {
			if (this.errors.length) return null
			const p = profileOf(this.track === 'bed' ? Object.assign({}, this.draft, { tool: '0', heaters: this.draft.zones }) : this.draft)
			return p ? deltaChartModel(p, this.G) : null
		}
	},
	watch: {
		shape(s) {
			this.opts = shapeDefaults(s)
		}
	},
	methods: {
		tx(key, params) {
			return this.$t(KEY_PREFIX + key, params || {})
		},
		// +5, 0, -5: a change over the G-code always carries its sign
		signed(v) {
			return v > 0 ? '+' + v : String(v)
		},
		capHelp() {
			return { title: this.tx('layer_recipes_help_cap_title'), what: this.tx('layer_recipes_help_cap_what'), why: this.tx('layer_recipes_help_cap_why'), ifMissing: this.tx('layer_recipes_help_cap_miss'), how: this.tx('layer_recipes_help_cap_how') }
		},
		unit(f) {
			return f.unit === 'C' ? 'C' : this.tx('layer_recipes_unit_' + f.unit)
		},
		errorText(e) {
			const m = /^points\[(\d+)\]/.exec(e.field)
			return this.tx(e.key, Object.assign({ field: e.field, n: m ? Number(m[1]) + 1 : 0 }, e.params))
		},
		fieldError(field) {
			const e = this.errors.find(x => x.field === field)
			return e ? this.errorText(e) : ''
		},
		pointError(i, part) {
			return this.errors.find(e => e.field === 'points[' + i + '].' + part)
		},
		toggleZone(heater, on) {
			const z = this.draft.zones.filter(h => h !== heater)
			if (on) z.push(heater)
			z.sort((a, b) => a - b)
			this.$emit('zones', z)
		}
	}
}
</script>

<style scoped>
.rt { border-left: 3px solid var(--wf-line, rgba(128, 128, 128, 0.4)); padding-left: 12px; }
.rt-btn.v-btn { height: 44px; min-height: 44px; }
.rt-scroll { overflow-x: auto; max-width: 100%; }
.rt-table { border-collapse: collapse; min-width: 100%; }
.rt-table th { text-align: left; font-weight: 500; font-size: 12px; padding: 2px 6px; white-space: nowrap; }
.rt-table td { padding: 3px 4px; vertical-align: middle; }
.rt-cell { min-width: 84px; max-width: 120px; }
.rt-svg { display: block; width: 100%; max-width: 720px; height: auto; }
.rt-grid { stroke: rgba(128, 128, 128, 0.2); stroke-width: 1; }
.rt-sub { display: block; font-weight: 400; font-size: 11px; opacity: 0.8; }
.rt-zero { stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 6 3; opacity: 0.7; }
.rt-zero-label { font-weight: 700; }
.rt-axis { fill: var(--tp-faint, #9e9e9e); font-size: 11px; }
.rt-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; }
.rt-key { display: inline-block; width: 18px; height: 0; border-top: 3px solid currentColor; margin-right: 6px; vertical-align: middle; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 400px) {
	.rt-cell { min-width: 72px; }
}
</style>
