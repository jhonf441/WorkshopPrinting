<template>
	<v-card outlined class="lr-card pa-3" aria-labelledby="lr-title">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-icon small>mdi-layers-triple-outline</v-icon>
			<span id="lr-title" class="text-subtitle-1">{{ tx('layer_recipes_title') }}</span>
			<help-tip v-bind="help('recipes')" />
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('layer_recipes_lead') }}</div>

		<error-notice v-if="failure" :error="failure" :action="tx('layer_recipes_acting')" retry class="mt-2" @retry="load()" />
		<lock-reason v-if="!canEdit" op="layerrecipes.set" need="technician" :action="tx('layer_recipes_acting')" class="mt-2" />
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

		<!-- pick a saved recipe by its name (kind and material beside it), or start a new one from a material -->
		<div class="d-flex align-end flex-wrap mt-3" style="gap:12px">
			<wf-field id="lr-pick" :label="tx('layer_recipes_f_recipe')">
				<v-select id="lr-pick" :value="picked" :items="pickItems" dense outlined hide-details style="min-width:260px" :aria-label="tx('layer_recipes_f_recipe')" @change="choose">
					<template #item="{ item }"><span>{{ item.text }}</span><v-chip v-if="item.kind" x-small outlined class="ml-2">{{ tx('layer_recipes_kind_' + item.kind) }}</v-chip></template>
				</v-select>
			</wf-field>
			<template v-if="!picked && canEdit">
				<wf-field id="lr-from" :label="tx('layer_recipes_f_from')">
					<v-select id="lr-from" v-model="from" :items="fromItems" dense outlined hide-details style="min-width:180px" :aria-label="tx('layer_recipes_f_from')" />
				</wf-field>
				<wf-field id="lr-from-kind" :label="tx('layer_recipes_f_kind')">
					<v-select id="lr-from-kind" v-model="fromKind" :items="kindItems" dense outlined hide-details style="min-width:150px" :aria-label="tx('layer_recipes_f_kind')" />
				</wf-field>
				<v-btn small color="primary" class="lr-btn" :disabled="!canStart" @click="startNew()"><v-icon small left>mdi-plus</v-icon>{{ tx('layer_recipes_new_btn') }}</v-btn>
			</template>
			<v-btn v-if="canEdit" small outlined class="lr-btn" :loading="busy === 'import'" @click="importPellet()"><v-icon small left>mdi-database-import-outline</v-icon>{{ tx('layer_recipes_import') }}</v-btn>
		</div>

		<div v-if="canEdit" class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ tx('layer_recipes_import_note') }}</span></div>

		<div v-if="draft" class="mt-3">
			<div class="d-flex align-end flex-wrap" style="gap:12px">
				<wf-field id="lr-name" :label="tx('layer_recipes_f_name')" :message="nameError" level="error">
					<v-text-field id="lr-name" v-model="name" dense outlined hide-details style="min-width:200px" :disabled="!canEdit || !!picked" :aria-label="tx('layer_recipes_f_name')" />
				</wf-field>
				<wf-field id="lr-kind" :label="tx('layer_recipes_f_kind')">
					<v-select id="lr-kind" v-model="draft.kind" :items="kindItems" dense outlined hide-details style="max-width:170px" :disabled="!canEdit" :aria-label="tx('layer_recipes_f_kind')" />
				</wf-field>
				<wf-field id="lr-mat" :label="tx('layer_recipes_f_material')" :message="fieldError('material')" level="error">
					<v-select id="lr-mat" :value="materialPick" :items="materialItems" dense outlined hide-details style="min-width:170px" :disabled="!canEdit" :aria-label="tx('layer_recipes_f_material')" @change="pickMaterial" />
				</wf-field>
				<wf-field v-if="materialPick === other" id="lr-mat-text" :label="tx('layer_recipes_f_material_name')">
					<v-text-field id="lr-mat-text" v-model="draft.material" dense outlined hide-details style="min-width:160px" :disabled="!canEdit" :aria-label="tx('layer_recipes_f_material_name')" />
				</wf-field>
				<wf-field id="lr-axis" :label="tx('pellet_layers_f_axis')">
					<template #help><help-tip v-bind="help('axis')" /></template>
					<v-select id="lr-axis" :value="axis" :items="axisItems" dense outlined hide-details style="max-width:190px" :disabled="!canEdit" :aria-label="tx('pellet_layers_f_axis')" @change="setAxis" />
				</wf-field>
			</div>
			<wf-field id="lr-note" :label="tx('layer_recipes_f_note')" class="mt-3">
				<v-text-field id="lr-note" v-model="draft.note" dense outlined hide-details :disabled="!canEdit" :aria-label="tx('layer_recipes_f_note')" />
			</wf-field>

			<!-- the tracks: each one is optional, the two follow the same layer rule -->
			<div class="d-flex flex-wrap mt-3" style="gap:4px 24px">
				<v-switch v-for="k in tracks" :key="k" :input-value="!!draft.tracks[k]" dense hide-details class="mt-0 pt-0" :label="tx('layer_recipes_use_' + k)" :disabled="!canEdit || (!!draft.tracks[k] && onlyTrack)" @change="toggleTrack(k, !!$event)" />
			</div>
			<div v-if="fieldError('tracks')" class="wf-field-msg is-error">{{ fieldError('tracks') }}</div>
			<recipe-track
				v-for="k in tracks" v-show="draft.tracks[k]" :key="'track-' + k" class="mt-4"
				:track="k" :draft="draft.tracks[k] || stub(k)" :zones="k === 'bed' ? bedZones : []" :errors="trackErrors(k)" :can-edit="canEdit"
				@shape="applyTrackShape(k, $event)" @add-point="addPoint(k)" @remove-point="removePoint(k, $event)" @zones="setBedZones"
			/>
			<div v-for="e in otherErrors" :key="e.field" class="wf-note is-warn mt-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ errorText(e) }}</span></div>
			<ul v-if="serverErrors.length" class="mt-2"><li v-for="(e, i) in serverErrors" :key="i" class="text-caption error--text">{{ e }}</li></ul>

			<!-- save / delete: saving never heats anything -->
			<div class="d-flex flex-wrap mt-4" style="gap:8px">
				<v-btn small color="primary" class="lr-btn" :loading="busy === 'save'" :disabled="!canEdit || !!errors.length || !nameOk || !dirty" @click="save()"><v-icon small left>mdi-content-save-outline</v-icon>{{ tx('layer_recipes_save') }}</v-btn>
				<v-btn small outlined class="lr-btn" :disabled="!dirty && !!picked" @click="discard()">{{ tx('layer_recipes_discard') }}</v-btn>
				<v-btn small outlined class="lr-btn" :color="armed === 'remove' ? 'amber darken-3' : undefined" :loading="busy === 'remove'" :disabled="!canEdit || !picked" @click="touch('remove', remove)"><v-icon small left>mdi-delete-outline</v-icon>{{ armed === 'remove' ? tx('layer_recipes_tap_again') : tx('layer_recipes_remove') }}</v-btn>
			</div>
			<div class="text-caption grey--text mt-1">{{ tx('layer_recipes_save_note') }}</div>
			<slot name="run" :name="picked" :recipe="saved" :dirty="dirty" />
		</div>
	</v-card>
</template>

<script>
'use strict'

// The temperature-by-layer RECIPES of the Printing plugin: pick a recipe by name, or start one from a material; each recipe has an extruder track and / or a bed
// track that follow the same layer rule; a ready-made curve shape is picked from a list and its points stay editable. Saving only stores the recipe in the service
// (ops layerrecipes.*): nothing here heats. The pure side (shapes, drafts, checks) is layer-recipes.js, the track editor is RecipeTrack.vue; the run (arm, live state,
// what the file will do) goes in the `run` slot.
import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import RecipeTrack from './RecipeTrack.vue'
import { toolZones } from './pellet-layers.js'
import {
	KINDS, TRACKS, MATERIALS, OTHER, NAME_MAX, KEY_PREFIX, emptyTrack, emptyRecipe, recipeDraft, recipeOf, validateRecipe, applyShape, bedZoneList, pickLabel
} from './layer-recipes.js'

const HELP = ['recipes', 'axis']

export default {
	mixins: [roleMixin],
	// what the person who left read, did or was refused stays nowhere (role-mixin.js)
	sessionData: ['armed', 'msg', 'msgKind'],
	sessionErrors: ['failure', 'msg', 'msgKind'],
	components: { HelpTip, ErrorNotice, LockReason, WfField, RecipeTrack },
	props: {
		tool: { type: Object, default: null } // the current tool of the page (its heaters are the zones of the extruder track)
	},
	data() {
		return {
			tracks: TRACKS, other: OTHER, list: [], picked: '', name: '', draft: null, saved: null, from: 'pla', fromKind: 'pellet', bedConfig: null, serverErrors: [],
			armed: null, armedTimer: null, busy: null, msg: null, msgKind: 'info', failure: null
		}
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		canEdit() {
			return this.canDo('layerrecipes.set')
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
		pickItems() {
			return [{ text: this.tx('layer_recipes_new'), value: '' }].concat(this.list.map(r => ({ text: pickLabel(r), value: r.name, kind: r.kind })))
		},
		fromItems() {
			return MATERIALS.map(id => ({ text: this.tx('layer_recipes_material_' + id), value: id })).concat([{ text: this.tx('layer_recipes_material_other'), value: OTHER }])
		},
		materialItems() {
			return this.fromItems
		},
		materialPick() {
			if (!this.draft) return ''
			const id = MATERIALS.find(i => this.tx('layer_recipes_material_' + i).toLowerCase() === (this.draft.material || '').trim().toLowerCase())
			return id || (this.draft.material ? OTHER : '')
		},
		kindItems() {
			return KINDS.map(k => ({ text: this.tx('layer_recipes_kind_' + k), value: k }))
		},
		axisItems() {
			return ['layer', 'z'].map(a => ({ text: this.tx('pellet_layers_axis_' + a), value: a }))
		},
		axis() {
			const t = this.draft && (this.draft.tracks.extruder || this.draft.tracks.bed)
			return t ? t.axis : 'layer'
		},
		onlyTrack() {
			return TRACKS.filter(k => this.draft && this.draft.tracks[k]).length < 2
		},
		canStart() {
			return this.extruderZones.length > 0 || this.bedZones.length > 0
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
		nameOk() {
			return this.name.trim().length >= 1 && this.name.trim().length <= NAME_MAX
		},
		nameError() {
			return this.name !== '' && !this.nameOk ? this.tx('pellet_layers_err_name', { max: NAME_MAX }) : ''
		},
		dirty() {
			return !!this.draft && JSON.stringify(this.recipe) !== JSON.stringify(this.saved)
		}
	},
	mounted() {
		this.load()
		this.loadBed()
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer)
	},
	methods: {
		tx(key, params) {
			return this.$t(KEY_PREFIX + key, params || {})
		},
		help(k) {
			return HELP.indexOf(k) < 0 ? {} : {
				title: this.tx('layer_recipes_help_' + k + '_title'), what: this.tx('layer_recipes_help_' + k + '_what'), why: this.tx('layer_recipes_help_' + k + '_why'),
				ifMissing: this.tx('layer_recipes_help_' + k + '_miss'), how: this.tx('layer_recipes_help_' + k + '_how')
			}
		},
		onSessionChange() {
			this.load()
		},
		say(kind, text) {
			this.msgKind = kind
			this.msg = text
		},
		errorText(e) {
			return this.tx(e.key, Object.assign({ field: e.field }, e.params))
		},
		fieldError(field) {
			const e = this.errors.find(x => x.field === field)
			return e ? this.errorText(e) : ''
		},
		trackErrors(k) {
			const pre = 'tracks.' + k + '.'
			return this.errors.filter(e => e.field.indexOf(pre) === 0).map(e => Object.assign({}, e, { field: e.field.slice(pre.length) }))
		},
		stub(k) {
			return k === 'bed' ? { zones: [], mode: 'steps', axis: 'layer', max_temp: '', max_step: '', max_spread: '', points: [] } : { tool: '0', heaters: [], mode: 'steps', axis: 'layer', max_temp: '', max_step: '', max_spread: '', points: [] }
		},
		async load(keep) {
			try {
				const g = await api('layerrecipes.list', {}, { quiet: true })
				this.list = g.recipes || []
				this.failure = null
				if (!keep) this.picked = ''
			} catch (e) {
				this.failure = e
			}
		},
		async loadBed() {
			try {
				this.bedConfig = (await api('bedzones.get', {}, { quiet: true })).config
			} catch (e) { /* no bed zones: the bed track is not offered */ }
		},
		async choose(name) {
			this.msg = null
			this.serverErrors = []
			if (!name) { this.picked = ''; this.draft = null; this.saved = null; this.name = ''; return }
			try {
				const g = await api('layerrecipes.get', { name }, { quiet: true })
				this.picked = name
				this.name = name
				this.saved = g.recipe
				this.draft = recipeDraft(g.recipe)
			} catch (e) {
				this.failure = e
			}
		},
		// a new recipe: the zones the machine has, with no change at all (it follows the G-code); the material only gives the label and the kind the form of the material
		startNew() {
			const tracks = {}
			if (this.extruderZones.length) tracks.extruder = emptyTrack('extruder', this.extruderZones.map(z => z.heater), { tool: this.toolNumber })
			if (this.bedZones.length) tracks.bed = emptyTrack('bed', this.bedZones.filter(z => z.active).map(z => z.heater))
			if (tracks.bed && !tracks.bed.zones.length) delete tracks.bed
			this.name = ''
			this.saved = null
			this.picked = ''
			this.draft = recipeDraft(emptyRecipe(this.fromKind, this.from === OTHER ? '' : this.tx('layer_recipes_material_' + this.from), tracks))
		},
		pickMaterial(id) {
			this.draft.material = id === OTHER ? '' : this.tx('layer_recipes_material_' + id)
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
			const zones = k === 'bed' ? this.bedZones.filter(z => z.active).map(z => z.heater) : this.extruderZones.map(z => z.heater)
			const t = recipeDraft(emptyRecipe('pellet', '', { [k]: emptyTrack(k, zones, { tool: this.toolNumber, axis: this.axis }) })).tracks[k]
			this.$set(this.draft.tracks, k, t)
		},
		setBedZones(zones) {
			const t = this.draft.tracks.bed
			if (!t) return
			const old = t.zones
			t.zones = zones
			// every point keeps one temperature per zone: a zone added takes the first temperature of the point, a zone taken out drops its own
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
			const d = recipeDraft({ kind: 'pellet', material: '', note: '', tracks: { [k]: next } }).tracks[k]
			this.$set(this.draft.tracks, k, d)
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
			if (this.picked) this.choose(this.picked)
			else { this.draft = null; this.name = '' }
		},
		touch(id, fn) {
			if (this.armed !== id) {
				this.armed = id
				clearTimeout(this.armedTimer)
				this.armedTimer = setTimeout(() => { this.armed = null }, 4000)
				return
			}
			this.armed = null
			fn.call(this)
		},
		async save() {
			if (!this.nameOk || this.errors.length) return
			this.busy = 'save'
			this.serverErrors = []
			try {
				const name = this.name.trim()
				const out = await api('layerrecipes.set', { name, recipe: this.recipe })
				this.saved = out.recipe
				this.draft = recipeDraft(out.recipe)
				this.picked = name
				this.name = name
				await this.load(true)
				this.say('success', this.tx('layer_recipes_saved', { name }))
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
		async remove() {
			this.busy = 'remove'
			try {
				const name = this.picked
				await api('layerrecipes.remove', { name })
				this.draft = null
				this.saved = null
				this.picked = ''
				this.name = ''
				await this.load()
				this.say('success', this.tx('layer_recipes_removed', { name }))
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.failure = e
			} finally {
				this.busy = null
			}
		},
		async importPellet() {
			this.busy = 'import'
			try {
				const out = await api('layerrecipes.import_pellet', {})
				await this.load(true)
				this.say('info', out.added.length ? this.tx('layer_recipes_imported', { n: out.added.length }) : this.tx('layer_recipes_imported_none'))
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
.lr-btn.v-btn { height: 44px; min-height: 44px; }
</style>
