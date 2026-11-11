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
		</div>
		<div v-if="fieldError('zones')" class="wf-field-msg is-error">{{ fieldError('zones') }}</div>
		<p class="text-caption mt-2 mb-0">{{ $t('plugins.WorkshopPrinting.bedZones.zones_edit_elsewhere', { n: draft.zones.length, max: max }) }}</p>

		<div v-if="fieldError('geometry')" class="wf-field-msg is-error">{{ fieldError('geometry') }}</div>

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

// Settings of the bed zones (technician): on / off, the zones (bed number, active, offset) and the limits. Adding, removing and placing zones (and the size of the bed) is done on the map itself, in the editor of BedZones.vue. It saves the whole
// configuration with the revision it was read at (op bedzones.set): the service validates again and refuses a stale revision. Save is the one filled
// button; Cancel puts the form back as saved.
import { api } from './workshop-api.js'
import { draftOf, configOf, sameConfig, zoneLimit, MAX_ZONES } from './bed-zones.js'
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
		return { draft: draftOf(this.config), errors: {}, serverErrors: [], failure: null, saving: false, limits: LIMITS }
	},
	computed: {
		// the zones THIS board supports (its own bed heaters), not a fixed number
		max() {
			return this.$store && this.$store.state && this.$store.state.machine ? zoneLimit(this.$store.state.machine.model) : MAX_ZONES
		},
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
.bz-row { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(70px, 1fr) minmax(90px, 1fr); gap: 12px; align-items: start; margin-bottom: 8px; }
.bz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.bz-errors { padding-left: 16px; }
@media (max-width: 599px) {
	.bz-row { grid-template-columns: 1fr 1fr; }
}
</style>
