<template>
	<div class="rr mt-4">
		<v-divider class="mb-3" />
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-subtitle-1">{{ external ? $t('plugins.WorkshopPrinting.materials.apply_title') : tx('layer_recipes_run_title') }}</span>
			<v-chip x-small outlined :color="live.phase === 'off' ? undefined : (live.phase === 'running' ? 'success' : 'warning')">{{ tx(live.key) }}</v-chip>
			<help-tip v-bind="help()" />
		</div>
		<div class="text-caption grey--text mt-1">{{ tx('layer_recipes_run_lead') }}</div>
		<error-notice v-if="failure" :error="failure" :action="tx('layer_recipes_run_acting')" retry class="mt-2" @retry="poll()" />
		<lock-reason v-if="!canArm" op="layerrecipes.arm" need="technician" :action="tx('layer_recipes_run_arming')" class="mt-2" />

		<!-- the live state: the layer it is on, what each track applied, when the next change comes -->
		<div class="rr-live mt-3" role="status" aria-live="polite">
			<div v-if="status && status.armed" class="text-body-2">
				<div>{{ tx('layer_recipes_run_recipe', { name: status.recipe, file: status.file }) }}</div>
				<div>{{ status.layer ? tx('pellet_layers_live_layer', { layer: status.layer }) : tx('pellet_layers_live_no_layer') }}</div>
				<div v-for="k in trackKeys" :key="k" class="mt-1">
					<strong>{{ tx('layer_recipes_track_' + k) }}:</strong>
					<template v-if="status.tracks[k].applied">{{ tx('pellet_layers_live_applied', { temps: temps(status.tracks[k].applied) }) }}</template>
					<template v-else>{{ tx('layer_recipes_run_nothing_yet') }}</template>
					<template v-if="status.tracks[k].next"> - {{ tx('pellet_layers_live_next', { at: status.tracks[k].next.at, temps: temps(status.tracks[k].next.temps) }) }}</template>
					<span v-if="status.tracks[k].limited" class="warning--text text-caption"> {{ tx('pellet_layers_live_limited') }}</span>
					<div v-if="status.tracks[k].overridden === true" class="wf-note is-warn" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ overriddenText(status.tracks[k]) }}</span></div>
				</div>
			</div>
			<div v-else-if="live.reason" class="wf-note is-warn" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-alert-outline</v-icon><span>{{ tx('pellet_layers_live_ended_why', { why: tx(live.reason.key, live.reason.params) }) }}</span></div>
			<div v-else class="text-body-2 grey--text">{{ tx('layer_recipes_run_off_note') }}</div>
		</div>

		<!-- turn it on for ONE job: two taps; turning it off is safe (one tap) and leaves the temperatures as they are -->
		<div class="d-flex align-end flex-wrap mt-3" style="gap:12px">
			<wf-field v-if="!external" id="rr-file" :label="tx('pellet_layers_f_file')" :message="fileHint">
				<gcode-picker id="rr-file" :value="fileName" :job-file="jobName" clearable :aria-label="tx('pellet_layers_f_file')" :disabled="!canArm || armedNow" @input="onFilePick" />
			</wf-field>
			<v-btn small class="rr-btn" :color="armed === 'arm' ? 'amber darken-3' : 'primary'" :loading="busy === 'arm'" :disabled="!canArm || armedNow || !canArmNow" @click="touch('arm', arm)">
				<v-icon small left>mdi-fire</v-icon>{{ armed === 'arm' ? tx('layer_recipes_run_tap_again') : (external ? $t('plugins.WorkshopPrinting.materials.apply') : tx('layer_recipes_run_arm')) }}
			</v-btn>
			<v-btn small outlined class="rr-btn" :loading="busy === 'disarm'" :disabled="!armedNow" @click="disarm()"><v-icon small left>mdi-stop-circle-outline</v-icon>{{ tx('pellet_layers_disarm') }}</v-btn>
			<v-btn v-if="!external" small outlined class="rr-btn" :loading="busy === 'preview'" :disabled="!canPreview" @click="readPreview()"><v-icon small left>mdi-file-eye-outline</v-icon>{{ tx('layer_recipes_run_preview') }}</v-btn>
		</div>
		<div v-if="armReason" class="wf-note mt-1" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ armReason }}</span></div>
		<v-alert v-if="msg" dense text :type="msgKind" class="mt-3 mb-0">{{ msg }}</v-alert>

		<!-- what the file will do: the real lines around every layer where a temperature changes, and the exact commands (read only) -->
		<gcode-layer-view v-if="previewShown && !external" class="mt-3" :preview="preview" :loading="busy === 'preview'" :error="previewError" :recipe-name="name" @read="readPreview()" />
	</div>
</template>

<script>
'use strict'

// The run of a saved recipe: arm it for ONE job file (two taps), the live state of each track, stop it (one tap, never blocked), and read what the file will do
// (layerrecipes.preview shown by GcodeLayerView.vue: it only shows). The service applies the temperatures inside the limits of the recipe and of each heater.
import { api } from './workshop-api.js'
import { roleMixin } from './role-mixin.js' // vue/_shared36
import HelpTip from './HelpTip.vue' // vue/_shared36
import ErrorNotice from './ErrorNotice.vue' // vue/_shared36
import LockReason from './LockReason.vue' // vue/_shared36
import WfField from './WfField.vue' // vue/_shared36
import GcodeLayerView from './GcodeLayerView.vue'
import GcodePicker from './GcodePicker.vue' // the select of the G-code library (the job file)
import { liveState, tempsText, fileForJob } from './pellet-layers.js'
import { noteParams, KEY_PREFIX } from './layer-recipes.js'

export default {
	mixins: [roleMixin],
	sessionData: ['armed', 'msg', 'msgKind', 'status', 'preview'],
	sessionErrors: ['failure', 'msg', 'msgKind'],
	components: { HelpTip, ErrorNotice, LockReason, WfField, GcodeLayerView, GcodePicker },
	props: {
		name: { type: String, default: '' }, // the saved recipe ('' = none)
		recipe: { type: Object, default: null }, // the saved recipe
		dirty: { type: Boolean, default: false }, // the form has changes that are not saved
		fileOverride: { type: String, default: null } // the page that owns the file field (Material and G-code) gives the file: this panel then has no file field, no preview and says Apply
	},
	data() {
		return { status: null, file: '', fileTouched: false, preview: null, previewShown: false, previewError: null, armed: null, armedTimer: null, busy: null, msg: null, msgKind: 'info', failure: null, timer: null }
	},
	computed: {
		model() {
			return this.$store.state.machine.model
		},
		canArm() {
			return this.canDo('layerrecipes.arm')
		},
		live() {
			return liveState(this.status)
		},
		armedNow() {
			return !!(this.status && this.status.armed)
		},
		trackKeys() {
			return this.status && this.status.tracks ? ['extruder', 'bed'].filter(k => this.status.tracks[k]) : []
		},
		jobName() {
			const j = this.model && this.model.job
			return (j && j.file && j.file.fileName) || ''
		},
		external() {
			return this.fileOverride !== null
		},
		fileName() {
			return fileForJob(this.external ? this.fileOverride : this.file)
		},
		canArmNow() {
			return !!this.fileName && !!this.name && !!this.recipe && !this.dirty && !!this.status
		},
		canPreview() {
			return !!this.fileName && !!this.name && !!this.recipe && !this.dirty
		},
		fileHint() {
			return this.fileName ? '' : this.tx('pellet_layers_file_missing')
		},
		armReason() {
			if (this.armedNow) return ''
			if (!this.recipe) return this.tx('layer_recipes_run_needs_saved')
			if (this.dirty) return this.tx('layer_recipes_run_needs_save')
			if (this.external && !this.fileName) return this.tx('pellet_layers_file_missing')
			if (!this.status) return this.tx('layer_recipes_run_no_status')
			return ''
		}
	},
	watch: {
		jobName(v) {
			if (!this.fileTouched) this.file = v
		},
		name() {
			this.preview = null
			this.previewShown = false
			this.previewError = null
		}
	},
	mounted() {
		this.file = this.jobName
		this.poll()
		this.timer = setInterval(() => this.poll(), 3000)
	},
	beforeDestroy() {
		clearInterval(this.timer)
		clearTimeout(this.armedTimer)
	},
	methods: {
		// the file field is the select of the G-code library
		onFilePick(path) {
			this.file = path || ''
			this.fileTouched = true
		},
		tx(key, params) {
			return this.$t(KEY_PREFIX + key, params || {})
		},
		help() {
			return { title: this.tx('layer_recipes_help_run_title'), what: this.tx('layer_recipes_help_run_what'), why: this.tx('layer_recipes_help_run_why'), ifMissing: this.tx('layer_recipes_help_run_miss'), how: this.tx('layer_recipes_help_run_how') }
		},
		onSessionChange() {
			this.poll()
		},
		temps: tempsText,
		// something else (usually a temperature line of the G-code) holds other temperatures than the recipe applied; informational only
		overriddenText(track) {
			const layer = track && typeof track.overridden_layer === 'number' ? track.overridden_layer : null
			return layer === null ? this.tx('layer_recipes_run_overridden_nolayer') : this.tx('layer_recipes_run_overridden', { layer })
		},
		say(kind, text) {
			this.msgKind = kind
			this.msg = text
		},
		fail(e) {
			if (e && e.code === 'cancelled') return
			if (e && (e.code === 'invalid_args' || e.code === 'conflict')) this.say('error', e.message)
			else this.failure = e
		},
		async poll() {
			try {
				this.status = await api('layerrecipes.status', {}, { quiet: true })
				this.failure = null
			} catch (e) { /* the next poll tries again */ }
		},
		// arming heats nothing by itself but lets the service change temperatures during the job: two taps (the first arms the button for 4 s)
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
		async arm() {
			if (!this.canArm || !this.canArmNow || this.armedNow) return
			this.busy = 'arm'
			try {
				this.status = await api('layerrecipes.arm', { name: this.name, file: this.fileName })
				this.say('success', this.tx('layer_recipes_run_armed', { name: this.name }))
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		// stopping is never blocked and takes one tap; it leaves the temperatures as they are
		async disarm() {
			this.busy = 'disarm'
			try {
				this.status = await api('layerrecipes.disarm', {})
				this.say('success', this.tx('layer_recipes_run_disarmed'))
			} catch (e) {
				this.fail(e)
			} finally {
				this.busy = null
			}
		},
		async readPreview() {
			if (!this.canPreview) return
			this.busy = 'preview'
			this.previewError = null
			this.previewShown = true
			try {
				const out = await api('layerrecipes.preview', { name: this.name, file: this.fileName })
				// the service sends its notes as {key, params, message}: the viewer takes the keys and has its own sentences
				this.preview = Object.assign({}, out, { notes: (out.notes || []).map(n => (n && typeof n === 'object' ? n.key : n)), note_params: noteParams(out.notes) })
			} catch (e) {
				if (e && e.code !== 'cancelled') this.previewError = e
			} finally {
				this.busy = null
			}
		}
	}
}
</script>

<style scoped>
.rr-btn.v-btn { height: 44px; min-height: 44px; }
.rr-live { border-left: 3px solid var(--wf-line, rgba(128, 128, 128, 0.4)); padding-left: 10px; }
</style>
