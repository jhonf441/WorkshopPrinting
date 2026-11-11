<template>
	<div class="ml">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small aria-hidden="true">mdi-layers-triple-outline</v-icon>
			<span class="text-subtitle-2">{{ tx('layers_title') }}</span>
			<v-chip x-small outlined :color="has ? 'primary' : undefined">{{ has ? tx('layers_on') : tx('layers_off') }}</v-chip>
			<help-tip v-bind="help()" />
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('layers_lead') }}</div>

		<error-notice v-if="failure" :error="failure" :action="tx('layers_acting')" retry class="mt-2" @retry="load()" />
		<div v-if="lockedWhy" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ lockedWhy }}</span></div>
		<lock-reason v-else-if="!canEdit" op="layerrecipes.set" need="technician" :action="tx('layers_acting')" class="mt-2" />
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-2 mb-0">{{ msg }}</v-alert>
		<div v-if="!loaded && !failure" class="text-caption grey--text mt-2" role="status">{{ $t('plugins.WorkshopPrinting.common.reading') }}</div>

		<template v-if="loaded">
			<v-switch :key="'sw' + swKey" :input-value="has" dense hide-details class="mt-2" :label="tx('layers_switch')" :disabled="!canWrite || (!has && !canStart)" @change="toggle(!!$event)" />
			<div v-if="!has && !canStart" class="text-caption grey--text">{{ tx('layers_no_zones') }}</div>

			<div v-if="draft" class="mt-2">
				<div class="d-flex flex-wrap align-end" style="gap:8px 24px">
					<wf-field :id="uid + '-axis'" :label="tx('layers_axis')">
						<template #help><help-tip v-bind="axisHelp()" /></template>
						<v-select :id="uid + '-axis'" :value="axis" :items="axisItems" dense outlined hide-details style="max-width:200px" :disabled="!canWrite" :aria-label="tx('layers_axis')" @change="setAxis" />
					</wf-field>
					<v-switch v-for="k in tracks" :key="k" :input-value="!!draft.tracks[k]" dense hide-details class="mt-0 pt-0" :label="tx('layers_use_' + k)" :disabled="!canWrite || (!!draft.tracks[k] && onlyTrack) || (!draft.tracks[k] && !zonesOf(k).length)" @change="toggleTrack(k, !!$event)" />
				</div>
				<div v-if="fieldError('tracks')" class="wf-field-msg is-error">{{ fieldError('tracks') }}</div>
				<recipe-track
					v-for="k in tracks" v-show="draft.tracks[k]" :key="'t-' + k" class="mt-4"
					:track="k" :draft="draft.tracks[k] || stub(k)" :zones="k === 'bed' ? bedZones : []" :errors="trackErrors(k)" :can-edit="canWrite"
					@shape="applyTrackShape(k, $event)" @add-point="addPoint(k)" @remove-point="removePoint(k, $event)" @zones="setBedZones"
				/>
				<div v-for="e in otherErrors" :key="e.field" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ errorText(e) }}</span></div>
				<ul v-if="serverErrors.length" class="mt-2"><li v-for="(e, i) in serverErrors" :key="i" class="text-caption error--text">{{ e }}</li></ul>
				<div class="d-flex flex-wrap mt-3" style="gap:8px">
					<v-btn small color="primary" class="ml-btn" :loading="busy === 'save'" :disabled="!canWrite || !!errors.length || !dirty" @click="save()"><v-icon small left>mdi-content-save-outline</v-icon>{{ tx('layers_save') }}</v-btn>
					<v-btn small outlined class="ml-btn" :disabled="!dirty" @click="discard()">{{ tx('layers_discard') }}</v-btn>
				</div>
				<div v-if="!canWrite || (!!errors.length || !dirty)" class="text-caption grey--text mt-1">{{ saveReason }}</div>
				<div class="text-caption grey--text mt-1">{{ tx('layers_save_note') }}</div>
			</div>
		</template>
	</div>
</template>

<script>
'use strict'

// The optional "Change per layer" block of ONE material: the relative recipe (format 2) of the material, stored in the `layer-recipes` area of the service under the
// SAME NAME as the material (the link is the name; ops layerrecipes.get / set / remove). Off by default: with the switch off the material has no recipe at all.
// It reuses the track editor (RecipeTrack.vue) and the pure side of the recipes (layer-recipes.js). Nothing here heats or arms anything.
import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import RecipeTrack from './RecipeTrack.vue'
import { toolZones } from './pellet-layers.js'
import { TRACKS, MATERIAL_MAX, emptyTrack, emptyRecipe, recipeDraft, recipeOf, validateRecipe, applyShape, bedZoneList } from './layer-recipes.js'

let seq = 0

export default {
	mixins: [roleMixin],
	sessionData: ['msg', 'msgKind'],
	sessionErrors: ['failure', 'msg', 'msgKind'],
	components: { HelpTip, ErrorNotice, LockReason, WfField, RecipeTrack },
	props: {
		linkName: { type: String, default: '' }, // the name the material has in the SAVED list ('' = a material that is not saved yet)
		currentName: { type: String, default: '' }, // the name in the form (differs from linkName while it is being renamed)
		kind: { type: String, default: 'pellet' },
		tool: { type: Object, default: null },
		bedConfig: { type: Object, default: null }, // the bed-zones config (the zones the bed track can drive)
		exists: { type: Boolean, default: false } // the service already has a recipe with this name
	},
	data() {
		return { uid: 'ml' + (++seq), tracks: TRACKS, loaded: false, saved: null, draft: null, serverErrors: [], busy: null, msg: null, msgKind: 'info', failure: null, offArmed: false, offTimer: null, swKey: 0 }
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		canEdit() {
			return this.canDo('layerrecipes.set')
		},
		lockedWhy() {
			if (!this.linkName) return this.tx('layers_save_material_first')
			if (this.currentName.trim() !== this.linkName) return this.tx('layers_save_rename_first')
			return ''
		},
		canWrite() {
			return this.canEdit && !this.lockedWhy
		},
		has() {
			return !!this.draft
		},
		toolNumber() {
			return this.tool && Number.isInteger(this.tool.number) ? this.tool.number : null
		},
		extruderZones() {
			return this.toolNumber === null ? [] : toolZones(this.model, this.toolNumber)
		},
		bedZones() {
			return bedZoneList(this.bedConfig)
		},
		canStart() {
			return this.extruderZones.length > 0 || this.bedZones.some(z => z.active)
		},
		axisItems() {
			return ['layer', 'z'].map(a => ({ text: this.$t('plugins.WorkshopPrinting.pellet.pellet_layers_axis_' + a), value: a }))
		},
		axis() {
			const t = this.draft && (this.draft.tracks.extruder || this.draft.tracks.bed)
			return t ? t.axis : 'layer'
		},
		onlyTrack() {
			return TRACKS.filter(k => this.draft && this.draft.tracks[k]).length < 2
		},
		recipe() {
			return this.draft ? recipeOf(this.draft) : null
		},
		errors() {
			return this.recipe ? validateRecipe(this.recipe) : []
		},
		otherErrors() {
			return this.errors.filter(e => !/^tracks\.(extruder|bed)\./.test(e.field) && e.field !== 'tracks' && e.field !== 'material')
		},
		dirty() {
			return !!this.draft && JSON.stringify(this.recipe) !== JSON.stringify(this.saved)
		},
		// why Save is off, said next to it (never a mute button)
		saveReason() {
			if (!this.canEdit) return this.tx('layers_why_role')
			if (this.lockedWhy) return this.lockedWhy
			if (this.errors.length) return this.tx('layers_why_errors')
			if (!this.dirty) return this.tx('layers_why_nothing')
			return ''
		}
	},
	watch: {
		linkName() {
			this.load()
		},
		kind(k) {
			if (this.draft) this.draft.kind = k
		}
	},
	mounted() {
		this.load()
	},
	beforeDestroy() {
		clearTimeout(this.offTimer)
	},
	methods: {
		tx(key, params) {
			return this.$t('plugins.WorkshopPrinting.materials.' + key, params || {})
		},
		px(key, params) {
			return this.$t('plugins.WorkshopPrinting.pellet.' + key, params || {})
		},
		help() {
			return { title: this.tx('layers_title'), what: this.tx('layers_help_what'), why: this.tx('layers_help_why'), ifMissing: this.tx('layers_help_miss'), how: this.tx('layers_help_how') }
		},
		axisHelp() {
			return { title: this.px('layer_recipes_help_axis_title'), what: this.px('layer_recipes_help_axis_what'), why: this.px('layer_recipes_help_axis_why'), ifMissing: this.px('layer_recipes_help_axis_miss'), how: this.px('layer_recipes_help_axis_how') }
		},
		onSessionChange() {
			this.load()
		},
		say(kind, text) {
			this.msgKind = kind
			this.msg = text
		},
		errorText(e) {
			return this.px(e.key, Object.assign({ field: e.field }, e.params))
		},
		fieldError(field) {
			const e = this.errors.find(x => x.field === field)
			return e ? this.errorText(e) : ''
		},
		trackErrors(k) {
			const pre = 'tracks.' + k + '.'
			return this.errors.filter(e => e.field.indexOf(pre) === 0).map(e => Object.assign({}, e, { field: e.field.slice(pre.length) }))
		},
		zonesOf(k) {
			return k === 'bed' ? this.bedZones.filter(z => z.active) : this.extruderZones
		},
		stub(k) {
			return k === 'bed' ? { zones: [], mode: 'steps', axis: 'layer', max_temp: '', max_step: '', max_spread: '', points: [] } : { tool: '0', heaters: [], mode: 'steps', axis: 'layer', max_temp: '', max_step: '', max_spread: '', points: [] }
		},
		// reads the recipe of the material (the name is the link); a material without one has the block off
		async load() {
			this.loaded = false
			this.draft = null
			this.saved = null
			this.serverErrors = []
			if (!this.linkName || !this.exists) { this.loaded = true; return }
			try {
				const g = await api('layerrecipes.get', { name: this.linkName }, { quiet: true })
				this.saved = g.recipe
				this.draft = recipeDraft(g.recipe)
				this.failure = null
			} catch (e) {
				this.failure = e
			}
			this.loaded = true
		},
		// switching on: the zones the machine has, no change at all (it follows the G-code); switching off: an unsaved draft is dropped, a saved recipe is removed from the service after a second tap
		toggle(on) {
			if (on) {
				const tracks = {}
				if (this.extruderZones.length) tracks.extruder = emptyTrack('extruder', this.extruderZones.map(z => z.heater), { tool: this.toolNumber })
				const bed = this.bedZones.filter(z => z.active).map(z => z.heater)
				if (bed.length) tracks.bed = emptyTrack('bed', bed)
				this.draft = recipeDraft(emptyRecipe(this.kind, this.currentName, tracks))
				this.say('info', this.tx('layers_switched_on'))
			} else if (!this.saved) {
				this.draft = null
			} else if (!this.offArmed) {
				// a saved recipe is deleted from the service: two taps, with the warning in words (the switch stays on until the second tap)
				this.offArmed = true
				this.swKey++
				clearTimeout(this.offTimer)
				this.offTimer = setTimeout(() => { this.offArmed = false }, 4000)
				this.say('warning', this.tx('layers_off_again', { name: this.linkName }))
			} else {
				this.offArmed = false
				this.removeRecipe()
			}
		},
		setAxis(axis) {
			TRACKS.forEach(k => {
				const t = this.draft.tracks[k]
				if (!t || t.axis === axis) return
				t.axis = axis
				const first = t.points[0]
				t.points = [{ at: axis === 'z' ? '0' : '1', temps: first ? first.temps.slice() : [] }]
			})
		},
		toggleTrack(k, on) {
			if (!on) { this.$delete(this.draft.tracks, k); return }
			const zones = this.zonesOf(k).map(z => z.heater)
			const t = recipeDraft(emptyRecipe('pellet', '', { [k]: emptyTrack(k, zones, { tool: this.toolNumber, axis: this.axis }) })).tracks[k]
			this.$set(this.draft.tracks, k, t)
		},
		setBedZones(zones) {
			const t = this.draft.tracks.bed
			if (!t) return
			const old = t.zones
			t.zones = zones
			t.points.forEach(p => {
				const byHeater = {}
				old.forEach((h, i) => { byHeater[h] = p.temps[i] })
				p.temps = zones.map(h => (byHeater[h] !== undefined ? byHeater[h] : p.temps[0] || '0'))
			})
		},
		applyTrackShape(k, e) {
			const t = recipeOf(this.draft).tracks[k]
			if (!t || this.trackErrors(k).some(x => !/^points/.test(x.field) && x.field !== 'max_temp') || !t.points.length) return
			const next = applyShape(k, t, e.shape, e.opts)
			this.$set(this.draft.tracks, k, recipeDraft({ kind: 'pellet', material: '', note: '', tracks: { [k]: next } }).tracks[k])
		},
		addPoint(k) {
			const t = this.draft.tracks[k]
			const last = t.points[t.points.length - 1]
			const at = last ? Number(last.at) : 0
			const next = t.axis === 'z' ? String(Math.round((at + 1) * 100) / 100) : String((Number.isFinite(at) ? Math.round(at) : 0) + 10)
			t.points.push({ at: next, temps: last ? last.temps.slice() : [] })
		},
		removePoint(k, i) {
			this.draft.tracks[k].points.splice(i, 1)
		},
		discard() {
			if (this.saved) this.draft = recipeDraft(this.saved)
			else this.draft = null
		},
		async save() {
			if (!this.canWrite || this.errors.length) return
			this.busy = 'save'
			this.serverErrors = []
			try {
				const r = Object.assign({}, this.recipe, { kind: this.kind, material: this.linkName.slice(0, MATERIAL_MAX) })
				const out = await api('layerrecipes.set', { name: this.linkName, recipe: r })
				this.saved = out.recipe
				this.draft = recipeDraft(out.recipe)
				this.$emit('changed', { name: this.linkName, has: true })
				this.say('success', this.tx('layers_saved', { name: this.linkName }))
			} catch (e) {
				if (e && e.code === 'cancelled') return
				const list = e && e.body && e.body.error && e.body.error.errors
				if (Array.isArray(list)) this.serverErrors = list.map(x => x.message)
				else if (e && e.code === 'invalid_args') this.say('error', e.message)
				else this.failure = e
			} finally {
				this.busy = null
			}
		},
		// switching off a saved recipe removes it from the service: the parent asks for a second tap before (see Materials.vue); an unsaved draft is just dropped
		async removeRecipe() {
			if (!this.saved) { this.draft = null; return }
			if (!this.canWrite) return
			this.busy = 'remove'
			try {
				await api('layerrecipes.remove', { name: this.linkName })
				this.draft = null
				this.saved = null
				this.$emit('changed', { name: this.linkName, has: false })
				this.say('success', this.tx('layers_removed', { name: this.linkName }))
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.failure = e
			} finally {
				this.busy = null
			}
		}
	}
}
</script>

<style scoped>
.ml { border-left: 3px solid var(--wf-line, rgba(128, 128, 128, 0.4)); padding-left: 12px; }
.ml-btn.v-btn { height: 44px; min-height: 44px; }
</style>
