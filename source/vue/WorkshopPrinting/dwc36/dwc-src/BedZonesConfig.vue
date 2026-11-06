<template>
	<div class="bz-config">
		<div class="d-flex align-center flex-wrap" style="gap:4px">
			<v-switch v-model="draft.enabled" dense hide-details class="mt-0 pt-0" :label="$t('plugins.WorkshopPrinting.bedZones.f_enabled')" :disabled="saving" />
			<help-tip v-bind="help('enabled')" />
		</div>

		<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.bedZones.zones_title') }}</div>
		<div v-for="(z, i) in draft.zones" :key="i" class="bz-row">
			<v-switch v-model="z.active" dense hide-details class="mt-0 pt-0" :label="$t('plugins.WorkshopPrinting.bedZones.zone_n', { n: i + 1 })" :disabled="saving" />
			<wf-field :id="'bz-bed-' + i" :label="$t('plugins.WorkshopPrinting.bedZones.f_bed')" :message="fieldError('zones[' + i + '].bed')" level="error">
				<v-text-field :id="'bz-bed-' + i" v-model="z.bed" dense outlined hide-details inputmode="numeric" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.f_bed')" />
			</wf-field>
			<wf-field :id="'bz-off-' + i" :label="$t('plugins.WorkshopPrinting.bedZones.f_offset')" :message="fieldError('zones[' + i + '].offset')" level="error">
				<template #help><help-tip v-bind="help('offset')" /></template>
				<v-text-field :id="'bz-off-' + i" v-model="z.offset" dense outlined hide-details suffix="°C" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.f_offset')" />
			</wf-field>
			<v-btn icon small :disabled="saving || draft.zones.length <= 1" :aria-label="$t('plugins.WorkshopPrinting.bedZones.remove_zone')" :title="$t('plugins.WorkshopPrinting.bedZones.remove_zone')" @click="draft.zones.splice(i, 1)">
				<v-icon small>mdi-delete-outline</v-icon>
			</v-btn>
		</div>
		<div v-if="fieldError('zones')" class="wf-field-msg is-error">{{ fieldError('zones') }}</div>
		<div class="d-flex align-center flex-wrap mt-2" style="gap:12px">
			<v-btn small outlined :disabled="saving || draft.zones.length >= max" @click="addZone()">
				<v-icon small left>mdi-plus</v-icon>{{ $t('plugins.WorkshopPrinting.bedZones.add_zone') }}
			</v-btn>
			<span class="text-caption" :class="{ 'warning--text': draft.zones.length >= max }">{{ draft.zones.length >= max ? $t('plugins.WorkshopPrinting.bedZones.zones_limit', { max: max }) : $t('plugins.WorkshopPrinting.bedZones.zones_count', { n: draft.zones.length, max: max }) }}</span>
		</div>

		<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.bedZones.layout_title') }}</div>
		<div class="bz-grid">
			<wf-field id="bz-rows" :label="$t('plugins.WorkshopPrinting.bedZones.f_rows')" :message="fieldError('layout')" level="error">
				<template #help><help-tip v-bind="help('layout')" /></template>
				<v-text-field id="bz-rows" v-model="draft.layout.rows" dense outlined hide-details inputmode="numeric" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.f_rows')" />
			</wf-field>
			<wf-field id="bz-cols" :label="$t('plugins.WorkshopPrinting.bedZones.f_columns')">
				<v-text-field id="bz-cols" v-model="draft.layout.columns" dense outlined hide-details inputmode="numeric" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.f_columns')" />
			</wf-field>
		</div>

		<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopPrinting.bedZones.limits_title') }}</div>
		<div class="bz-grid">
			<wf-field v-for="f in limits" :id="'bz-' + f.key" :key="f.key" :label="$t('plugins.WorkshopPrinting.bedZones.f_' + f.key)" :message="fieldError(f.key)" level="error">
				<template #help><help-tip v-bind="help(f.key)" /></template>
				<v-text-field :id="'bz-' + f.key" v-model="draft[f.key]" dense outlined hide-details :suffix="f.unit" inputmode="decimal" :disabled="saving" :aria-label="$t('plugins.WorkshopPrinting.bedZones.f_' + f.key)" />
			</wf-field>
		</div>

		<error-notice v-if="failure" :error="failure" :action="$t('plugins.WorkshopPrinting.bedZones.saving')" class="mt-3" />
		<ul v-if="serverErrors.length" class="bz-errors mt-2">
			<li v-for="(e, i) in serverErrors" :key="i" class="text-caption error--text">{{ e }}</li>
		</ul>

		<div class="d-flex flex-wrap mt-4" style="gap:8px">
			<v-btn small color="primary" :loading="saving" :disabled="!dirty" @click="save()">{{ $t('plugins.WorkshopPrinting.common.save') }}</v-btn>
			<v-btn small outlined :disabled="saving || !dirty" @click="reset()">{{ $t('plugins.WorkshopPrinting.bedZones.cancel') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// Settings of the bed zones (technician): on / off, the zones (bed number, active, offset), the layout of the map and the limits. It saves the whole
// configuration with the revision it was read at (op bedzones.set): the service validates again and refuses a stale revision. Save is the one filled
// button; Cancel puts the form back as saved.
import { api } from './workshop-api.js'
import { draftOf, configOf, sameConfig, fitLayout, MAX_ZONES } from './bed-zones.js'
import WfField from './WfField.vue' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36

const LIMITS = [
	{ key: 'max_temp', unit: '°C' },
	{ key: 'max_offset', unit: '°C' },
	{ key: 'tolerance', unit: '°C' },
	{ key: 'timeout_s', unit: 's' }
]
const HELPED = ['enabled', 'offset', 'layout', 'max_temp', 'max_offset', 'tolerance', 'timeout_s']

export default {
	components: { WfField, HelpTip, ErrorNotice },
	props: {
		config: { type: Object, required: true },
		rev: { type: String, required: true }
	},
	data() {
		return { draft: draftOf(this.config), errors: {}, serverErrors: [], failure: null, saving: false, limits: LIMITS, max: MAX_ZONES }
	},
	computed: {
		dirty() {
			return !sameConfig(this.draft, draftOf(this.config))
		}
	},
	watch: {
		// what is typed is SHOWN at once in the page (map and table) as a preview; Save keeps it, Cancel drops it
		draft: {
			deep: true,
			handler() {
				const r = configOf(this.draft)
				this.$emit('preview', this.dirty && r.config ? r.config : null)
			}
		},
		// a new answer of the service (loaded or saved): the form shows it
		config() {
			this.draft = draftOf(this.config)
			this.errors = {}
		}
	},
	methods: {
		help(k) {
			if (HELPED.indexOf(k) < 0) return {}
			const t = s => this.$t('plugins.WorkshopPrinting.bedZones.help.' + k + '_' + s)
			return { title: t('title'), what: t('what'), why: t('why'), ifMissing: t('miss'), how: t('how') }
		},
		fieldError(f) {
			const k = this.errors[f]
			return k ? this.$t('plugins.WorkshopPrinting.bedZones.' + k) : ''
		},
		addZone() {
			const used = this.draft.zones.map(z => parseInt(z.bed, 10))
			let bed = 0
			while (used.indexOf(bed) >= 0) bed++
			this.draft.zones.push({ bed: String(bed), active: true, offset: '0' })
			this.draft.layout = fitLayout(this.draft.zones.length, this.draft.layout) // the map grows with the zones: the settings never refuse a new zone for lack of cells
		},
		reset() {
			this.draft = draftOf(this.config)
			this.errors = {}
			this.serverErrors = []
			this.failure = null
		},
		async save() {
			this.failure = null
			this.serverErrors = []
			const r = configOf(this.draft)
			this.errors = r.errors || {}
			if (r.errors) return
			this.saving = true
			try {
				const out = await api('bedzones.set', { config: r.config, base_rev: this.rev })
				this.$emit('saved', out)
			} catch (e) {
				if (e && e.code === 'cancelled') return
				const list = e && e.body && e.body.error && e.body.error.errors
				if (Array.isArray(list)) this.serverErrors = list.map(x => x.message)
				else this.failure = e
				if (e && e.code === 'conflict') this.$emit('reload')
			} finally {
				this.saving = false
			}
		}
	}
}
</script>

<style scoped>
.bz-row { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(70px, 1fr) minmax(90px, 1fr) auto; gap: 12px; align-items: start; margin-bottom: 8px; }
.bz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.bz-errors { padding-left: 16px; }
@media (max-width: 599px) {
	.bz-row { grid-template-columns: 1fr 1fr; }
}
</style>
