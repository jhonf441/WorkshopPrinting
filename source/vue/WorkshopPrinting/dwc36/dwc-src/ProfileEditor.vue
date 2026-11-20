<!-- lock-reason-in-parent: the ONE reason of this group is drawn by Profiles.vue, so the controls below are disabled without repeating it -->
<template>
	<div class="pe">
		<!-- section 1: Basics -->
		<section class="pe-sec" :aria-labelledby="uid + '-h1'">
			<h3 :id="uid + '-h1'" class="pe-h"><v-icon small aria-hidden="true">mdi-card-text-outline</v-icon>{{ tx('basics_title') }}</h3>
			<div class="text-caption pc-muted">{{ tx('basics_lead') }}</div>
			<div class="pc-actions pc-actions-end mt-2">
				<wf-field :id="uid + '-name'" :label="tx('f_name')">
					<template #help><help-tip v-bind="help('f_name')" /></template>
					<input :id="uid + '-name'" v-model.trim="profile.name" class="pe-input" style="width:180px" :disabled="!canEdit" @input="touch()" />
				</wf-field>
				<wf-field :id="uid + '-kind'" :label="tx('kind')">
					<template #help><help-tip v-bind="help('kind')" /></template>
					<v-btn-toggle :value="kind" mandatory dense color="primary" @change="setKind">
						<v-btn small value="pellet" :disabled="!canEdit">{{ tx('kind_pellet') }}</v-btn>
						<v-btn small value="filament" :disabled="!canEdit">{{ tx('kind_filament') }}</v-btn>
					</v-btn-toggle>
				</wf-field>
			</div>
			<div class="pc-actions pc-actions-end mt-3">
				<wf-field :id="uid + '-nozzle'" :label="tx('nozzle_c')">
					<template #help><help-tip v-bind="help('f_nozzle')" /></template>
					<input :id="uid + '-nozzle'" v-model.number="profile.nozzle" type="number" class="pe-input" :class="{ bad: over(profile.nozzle, nozzle) }" :disabled="!canEdit" @input="touch()" />
				</wf-field>
				<wf-field :id="uid + '-bed'" :label="tx('bed_c')">
					<template #help><help-tip v-bind="help('f_bed')" /></template>
					<input :id="uid + '-bed'" v-model.number="profile.bed" type="number" class="pe-input" :class="{ bad: over(profile.bed, bed) }" :disabled="!canEdit" @input="touch()" />
				</wf-field>
				<wf-field v-if="camera" :id="uid + '-camera'" :label="tx('chamber_c')">
					<template #help><help-tip v-bind="help('f_camera')" /></template>
					<input :id="uid + '-camera'" v-model.number="profile.camera" type="number" class="pe-input" :class="{ bad: over(profile.camera, camera) }" :disabled="!canEdit" @input="touch()" />
				</wf-field>
				<wf-field :id="uid + '-fan'" :label="tx('fan')">
					<template #help><help-tip v-bind="help('f_fan')" /></template>
					<input :id="uid + '-fan'" v-model.number="profile.fan" type="number" min="0" max="100" class="pe-input" :disabled="!canEdit" @input="touch()" />
				</wf-field>
				<wf-field :id="uid + '-density'" :label="tx('density_g_cm')">
					<template #help><help-tip v-bind="help('f_density')" /></template>
					<input :id="uid + '-density'" v-model.number="profile.density" type="number" step="0.01" class="pe-input" :disabled="!canEdit" @input="touch()" />
				</wf-field>
			</div>
			<div class="text-caption pc-muted mt-2">
				{{ tx('machine_limits', { nozzle: nozzle ? nozzle.max : '--', bed: bed ? bed.max : '--' }) }}<template v-if="camera">, {{ tx('chamber_c_value', { c: camera.max }) }}</template>. {{ tx('red_out_of_limit') }}
			</div>
		</section>

		<!-- section 2: Temperatures by zone -->
		<section class="pe-sec" :aria-labelledby="uid + '-h2'">
			<h3 :id="uid + '-h2'" class="pe-h"><v-icon small aria-hidden="true">mdi-thermometer-lines</v-icon>{{ tx('zones_title') }}</h3>
			<div class="text-caption pc-muted">{{ tx('zones_lead') }}</div>

			<div class="mt-3">
				<div class="d-flex align-center" style="gap:6px"><v-icon small aria-hidden="true">mdi-printer-3d-nozzle-outline</v-icon><span class="pc-card-title">{{ tx('zones_extruder') }}</span><help-tip v-bind="help('zones_extruder')" /></div>
				<div v-if="!nozzleZones.length" class="text-caption pc-muted">{{ tx('zones_extruder_none') }}</div>
				<div v-else class="pc-actions mt-1">
					<label v-for="(h, i) in nozzleZones" :key="'e' + h.id" class="pe-zone">
						<span class="text-caption">{{ tx('zone_label', { n: i + 1, h: h.id }) }}</span>
						<input :value="ownExtruder(i) ? profile.zones.extruder[i] : ''" :placeholder="String(extruderShown[i])" type="number" class="pe-input" :class="{ bad: over(extruderShown[i], h) }" :disabled="!canEdit" @change="setExtruder(i, $event.target.value)" />
						<span class="text-caption pc-muted">{{ ownExtruder(i) ? tx('zone_own') : tx('zone_staged') }}</span>
					</label>
				</div>
			</div>

			<div class="mt-3">
				<div class="d-flex align-center" style="gap:6px"><v-icon small aria-hidden="true">mdi-radiator</v-icon><span class="pc-card-title">{{ tx('zones_bed') }}</span><help-tip v-bind="help('zones_bed')" /></div>
				<div v-if="!bedHeaters.length" class="text-caption pc-muted">{{ tx('zones_bed_none') }}</div>
				<div v-else class="pc-actions mt-1">
					<label v-for="(z, i) in bedShown" :key="'b' + z.id" class="pe-zone">
						<span class="text-caption">{{ tx('zone_label', { n: i + 1, h: z.id }) }}</span>
						<input :value="z.own ? profile.zones.bed[z.id] : ''" :placeholder="String(z.t)" type="number" class="pe-input" :class="{ bad: over(z.t, bedHeaters[i]) }" :disabled="!canEdit" @change="setBed(z.id, $event.target.value)" />
						<span class="text-caption pc-muted">{{ z.own ? tx('zone_own') : tx('zone_follows_bed') }}</span>
					</label>
				</div>
			</div>
		</section>

		<!-- section 3: Changes during the print (optional; off by default) -->
		<section class="pe-sec" :aria-labelledby="uid + '-h3'">
			<h3 :id="uid + '-h3'" class="pe-h"><v-icon small aria-hidden="true">mdi-layers-triple-outline</v-icon>{{ tx('changes_title') }}</h3>
			<material-layers :link-name="profile._from || ''" :current-name="profile.name || ''" :kind="kind" :tool="tool" :bed-config="bedConfig" :exists="hasChanges" @changed="$emit('changes-changed', $event)" />
		</section>
	</div>
</template>

<script>
'use strict'

// The editor of ONE profile, in three flat sections (nothing is hidden two levels deep): Basics, Temperatures by zone and Changes during the print (an optional section
// with an on/off switch, MaterialLayers.vue). It edits the profile it is given in place and says `changed` (the page keeps the draft and saves it).
import HelpTip from './HelpTip.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import MaterialLayers from './MaterialLayers.vue'
import { kindOf, extruderTemps, hasOwnExtruder, bedTemps, setZone } from './material-profile.js'

let seq = 0

export default {
	components: { HelpTip, WfField, MaterialLayers },
	props: {
		profile: { type: Object, required: true },
		canEdit: { type: Boolean, default: false },
		nozzleZones: { type: Array, default: () => [] }, // the nozzle heaters of the selected tool, in zone order
		nozzle: { type: Object, default: null },
		bed: { type: Object, default: null },
		camera: { type: Object, default: null },
		bedHeaters: { type: Array, default: () => [] }, // [{ id, max }] the bed zones
		step: { type: Object, default: () => ({}) }, // the stagger of the zones (Pellet and zones)
		tool: { type: Object, default: null },
		bedConfig: { type: Object, default: null },
		hasChanges: { type: Boolean, default: false } // the service already stores changes during the print under this name
	},
	data() {
		return { uid: 'pe' + (++seq) }
	},
	computed: {
		kind() {
			return kindOf(this.profile, this.nozzleZones.length)
		},
		extruderShown() {
			return extruderTemps(this.profile, this.nozzleZones.map(h => ({ id: h.id, max: h.max || null })), this.step)
		},
		bedShown() {
			return bedTemps(this.profile, this.bedHeaters)
		}
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.profiles.' + key, params || {})
		},
		help(k) {
			return { title: this.tx('help_' + k + '_title'), what: this.tx('help_' + k + '_what'), why: this.tx('help_' + k + '_why'), ifMissing: this.tx('help_' + k + '_miss'), how: this.tx('help_' + k + '_how') }
		},
		touch() {
			this.$emit('changed')
		},
		over(t, h) {
			return !!h && h.max != null && t > h.max
		},
		ownExtruder(i) {
			return hasOwnExtruder(this.profile, i)
		},
		setKind(kind) {
			if (!this.canEdit || this.profile.kind === kind) return
			this.$set(this.profile, 'kind', kind)
			this.touch()
		},
		// setZone writes `zones` into the plain object: make the new value reactive so the numbers shown follow
		refresh() {
			const z = this.profile.zones
			this.$delete(this.profile, 'zones')
			if (z) this.$set(this.profile, 'zones', z)
			this.touch()
		},
		setExtruder(i, v) {
			if (!this.canEdit) return
			setZone(this.profile, 'extruder', i, v, this.nozzleZones.length)
			this.refresh()
		},
		setBed(id, v) {
			if (!this.canEdit) return
			setZone(this.profile, 'bed', id, v)
			this.refresh()
		}
	}
}
</script>

<style scoped>
.pe-sec { padding: 14px 0; border-top: 1px solid var(--wf-line, rgba(128, 128, 128, 0.3)); }
.pe-sec:first-child { border-top: 0; padding-top: 0; }
.pe-h { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; margin-bottom: 2px; }
.pe-input { width: 76px; min-height: 40px; padding: 4px 8px; border: 1px solid rgba(128, 128, 128, 0.45); border-radius: 4px; color: inherit; background: transparent; font-variant-numeric: tabular-nums; }
.pe-input.bad { border-color: var(--wf-err); }
.pe-zone { display: flex; flex-direction: column; gap: 2px; }
</style>
